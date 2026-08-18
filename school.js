const EDGE = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data';
const PROFILE_KEY = 'flow-school-profile-v2';
const THEME_KEY = 'flow-school-theme-v2';
const OVERRIDE_KEY = 'flow-school-overrides-v1';
const CACHE_PREFIX = 'flow-school-cache-v2:';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let profile = readJson(PROFILE_KEY, null);
let selectedDate = new Date();
let data = null;
let currentView = 'today';
let editMode = false;
let mealType = null;
let searchTimer = null;
let searchAbort = null;
let dashboardAbort = null;
let toastTimer = null;
let searchResults = [];

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }
function parseYmd(v) { return new Date(+v.slice(0,4), +v.slice(4,6)-1, +v.slice(6,8), 12); }
function koDate(d) { return new Intl.DateTimeFormat('ko-KR', { month:'long', day:'numeric', weekday:'short' }).format(d); }
function shortDay(d) { return new Intl.DateTimeFormat('ko-KR', { weekday:'short' }).format(d).replace('요일',''); }
function monthDay(v) { const d = parseYmd(v); return `${d.getMonth()+1}.${d.getDate()}`; }
function isSame(a,b) { return ymd(a) === ymd(b); }
function currentTheme() { return localStorage.getItem(THEME_KEY) || 'system'; }

function applyTheme(value = currentTheme()) {
  const allowed = ['system','light','dark'];
  const next = allowed.includes(value) ? value : 'system';
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  $('#themeBtn').textContent = next === 'system' ? 'A' : next === 'light' ? 'L' : 'D';
}
function cycleTheme() {
  const themes = ['system','light','dark'];
  applyTheme(themes[(themes.indexOf(currentTheme()) + 1) % themes.length]);
}
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function loading(on) { $('#loadingLine').classList.toggle('active', on); }
function cacheKey() {
  if (!profile) return '';
  return `${CACHE_PREFIX}${profile.school.schoolCode}:${profile.grade}:${profile.className}`;
}
function saveCache(payload) { if (profile) writeJson(cacheKey(), { at: Date.now(), payload }); }
function loadCache() { return readJson(cacheKey(), null)?.payload || null; }
function overrides() { return readJson(OVERRIDE_KEY, {}); }
function overrideId(date, period) {
  return `${profile?.school?.schoolCode || ''}:${profile?.grade || ''}:${profile?.className || ''}:${date}:${period}`;
}
function subjectFor(row) { return overrides()[overrideId(row.date, row.period)] || row.subject || '—'; }
function setOverride(row, subject) {
  const all = overrides();
  const id = overrideId(row.date, row.period);
  const clean = subject.trim();
  if (!clean || clean === row.subject) delete all[id];
  else all[id] = clean;
  writeJson(OVERRIDE_KEY, all);
}

async function api(params, signal) {
  const url = new URL(EDGE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || '데이터를 불러오지 못했습니다.');
  return body;
}

function showLanding() {
  $('#landing').classList.remove('hidden');
  $('#dashboard').classList.add('hidden');
  $('#schoolBtn').classList.add('hidden');
  $('#bottomNav').classList.add('hidden');
  setTimeout(() => $('#schoolSearch')?.focus(), 80);
}
function showDashboard() {
  $('#landing').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
  $('#schoolBtn').classList.remove('hidden');
  $('#bottomNav').classList.remove('hidden');
  renderProfileBits();
}
function renderProfileBits() {
  if (!profile) return;
  $('#schoolNameTop').textContent = profile.school.name;
  $('#schoolClassTop').textContent = `${profile.grade}학년 ${profile.className}반`;
}

function renderSearchResults(target, schools, message = '검색 결과가 없습니다.') {
  const box = $(target);
  searchResults = Array.isArray(schools) ? schools : [];
  if (!searchResults.length) {
    box.innerHTML = `<div class="search-state">${esc(message)}</div>`;
    box.classList.remove('hidden');
    return;
  }
  box.innerHTML = searchResults.map((s, i) => `
    <button class="result-btn" type="button" data-result-index="${i}">
      <span><span class="result-name">${esc(s.name)}</span><span class="result-meta">${esc(s.officeName)} · ${esc(s.address || s.type || '')}</span></span>
      <span class="result-kind">${esc(s.kind || '학교')}</span>
    </button>`).join('');
  box.classList.remove('hidden');
  box.querySelectorAll('[data-result-index]').forEach((button) => {
    button.addEventListener('click', () => chooseSchool(searchResults[Number(button.dataset.resultIndex)]));
  });
}
async function runSearch(inputSelector, resultSelector) {
  const q = $(inputSelector).value.trim();
  const box = $(resultSelector);
  if (q.length < 2) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  searchAbort?.abort();
  searchAbort = new AbortController();
  box.classList.remove('hidden');
  box.innerHTML = '<div class="search-state">학교 찾는 중…</div>';
  try {
    const result = await api({ action:'search', q }, searchAbort.signal);
    renderSearchResults(resultSelector, result.schools);
  } catch (error) {
    if (error.name !== 'AbortError') renderSearchResults(resultSelector, [], error.message || '검색에 실패했습니다.');
  }
}
function debounceSearch(inputSelector, resultSelector) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(inputSelector, resultSelector), 250);
}

function gradeCount(kind = '') { return kind.includes('초등') ? 6 : 3; }
function chooseSchool(school) {
  if (!school) return;
  $('#schoolResults').classList.add('hidden');
  $('#switchResults').classList.add('hidden');
  if ($('#switchDialog').open) $('#switchDialog').close();
  $('#setupDialog').dataset.schoolIndex = String(searchResults.indexOf(school));
  $('#setupDialog')._school = school;
  $('#setupSchoolName').textContent = `${school.name} · ${school.officeName}`;
  const max = gradeCount(school.kind);
  $('#gradeRow').innerHTML = Array.from({ length:max }, (_, i) => `<button type="button" class="grade-btn${i===0?' active':''}" data-grade="${i+1}">${i+1}학년</button>`).join('');
  $('#classInput').value = '1';
  $('#gradeRow').querySelectorAll('.grade-btn').forEach((button) => button.addEventListener('click', () => {
    $('#gradeRow .active')?.classList.remove('active');
    button.classList.add('active');
  }));
  $('#setupDialog').showModal();
}
function saveSetup() {
  const school = $('#setupDialog')._school;
  if (!school) return;
  const grade = Number($('#gradeRow .active')?.dataset.grade || 1);
  const className = Math.max(1, Math.min(99, Number($('#classInput').value) || 1));
  profile = { school, grade, className };
  writeJson(PROFILE_KEY, profile);
  $('#setupDialog').close();
  selectedDate = new Date();
  showDashboard();
  loadDashboard();
}
function adjustClass(delta) {
  $('#classInput').value = String(Math.max(1, Math.min(99, (Number($('#classInput').value) || 1) + delta)));
}
function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
  profile = null;
  data = null;
  if ($('#switchDialog').open) $('#switchDialog').close();
  showLanding();
}

async function loadDashboard() {
  if (!profile) return;
  dashboardAbort?.abort();
  dashboardAbort = new AbortController();
  loading(true);
  $('#errorBox').classList.add('hidden');
  const params = {
    action:'dashboard', office:profile.school.officeCode, school:profile.school.schoolCode,
    grade:profile.grade, class:profile.className, kind:profile.school.kind, date:ymd(selectedDate)
  };
  try {
    data = await api(params, dashboardAbort.signal);
    saveCache(data);
    renderAll();
  } catch (error) {
    if (error.name === 'AbortError') return;
    const cached = loadCache();
    if (cached) {
      data = cached;
      renderAll();
      $('#errorBox').textContent = '새 데이터를 불러오지 못해 마지막으로 저장된 정보를 표시하고 있습니다.';
    } else {
      data = { timetable:[], meals:[], events:[] };
      renderAll();
      $('#errorBox').textContent = error.message || '학교 정보를 불러오지 못했습니다.';
    }
    $('#errorBox').classList.remove('hidden');
  } finally { loading(false); }
}

function selectedRows() {
  return (data?.timetable || []).filter((x) => x.date === ymd(selectedDate)).sort((a,b) => a.period - b.period);
}
function selectedMeals() { return (data?.meals || []).filter((x) => x.date === ymd(selectedDate)); }
function nextEvents() {
  const today = ymd(new Date());
  return (data?.events || []).filter((e) => e.date >= today).sort((a,b) => a.date.localeCompare(b.date)).slice(0,5);
}
function nextEventText() {
  const event = nextEvents()[0];
  if (!event) return '예정 없음';
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const diff = Math.ceil((parseYmd(event.date) - base) / 86400000);
  return diff <= 0 ? event.name : `D-${diff} ${event.name}`;
}
function renderHero() {
  $('#heroKicker').textContent = isSame(selectedDate, new Date()) ? 'TODAY' : 'SELECTED DATE';
  $('#heroDate').textContent = koDate(selectedDate);
  $('#heroSub').textContent = `${profile.school.name} · ${profile.grade}학년 ${profile.className}반`;
  $('#dateTitle').textContent = `${selectedDate.getMonth()+1}월 ${selectedDate.getDate()}일`;
  const lessons = selectedRows().length;
  const meals = selectedMeals();
  $('#quickLessons').textContent = lessons ? `${lessons}교시` : '수업 없음';
  $('#quickMeal').textContent = meals.length ? meals.map((m) => m.type).join(' · ') : '급식 없음';
  $('#quickEvent').textContent = nextEventText();
}
function weekDates() {
  if (data?.from) {
    const start = parseYmd(data.from);
    return Array.from({ length:5 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d; });
  }
  const start = new Date(selectedDate);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1-day));
  return Array.from({ length:5 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d; });
}
function renderDayStrip() {
  $('#dayStrip').innerHTML = weekDates().map((d) => `<button class="day-btn${isSame(d,selectedDate)?' active':''}" data-date="${ymd(d)}"><span>${shortDay(d)}</span><strong>${d.getDate()}</strong></button>`).join('');
  $$('#dayStrip .day-btn').forEach((button) => button.addEventListener('click', () => {
    selectedDate = parseYmd(button.dataset.date);
    renderAll();
  }));
}
function renderTimetable() {
  const rows = selectedRows();
  const box = $('#timetable');
  $('#editSubjectsBtn').classList.toggle('active', editMode);
  $('#editSubjectsBtn').textContent = editMode ? '수정 완료' : '과목 수정';
  if (!rows.length) { box.innerHTML = '<div class="empty">이 날짜에는 공개된 시간표가 없습니다.</div>'; return; }
  box.innerHTML = rows.map((row) => {
    const shown = subjectFor(row);
    const changed = shown !== (row.subject || '—');
    return `<div class="period"><span class="period-no">${row.period}</span><span class="period-subject" data-date="${row.date}" data-period="${row.period}" data-original="${esc(row.subject || '')}" contenteditable="${editMode?'true':'false'}">${esc(shown)}</span><span class="period-original">${changed?`NEIS ${esc(row.subject || '—')}`:''}</span></div>`;
  }).join('');
  if (editMode) $$('.period-subject').forEach((el) => {
    el.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); el.blur(); } });
    el.addEventListener('blur', () => {
      setOverride({ date:el.dataset.date, period:Number(el.dataset.period), subject:el.dataset.original }, el.textContent);
      renderTimetable();
    });
  });
}
function dishName(raw = '') { return raw.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(); }
function renderMeals() {
  const meals = selectedMeals();
  const tabs = $('#mealTabs');
  const list = $('#mealList');
  const cal = $('#mealCal');
  if (!meals.length) { tabs.innerHTML=''; list.innerHTML='<div class="empty">이 날짜에는 급식 정보가 없습니다.</div>'; cal.textContent=''; return; }
  if (!mealType || !meals.some((m) => m.type === mealType)) mealType = meals[0].type;
  tabs.innerHTML = meals.map((m) => `<button class="meal-tab${m.type===mealType?' active':''}" data-type="${esc(m.type)}">${esc(m.type)}</button>`).join('');
  tabs.querySelectorAll('.meal-tab').forEach((button) => button.addEventListener('click', () => { mealType = button.dataset.type; renderMeals(); }));
  const meal = meals.find((m) => m.type === mealType) || meals[0];
  list.innerHTML = meal.dishes.map((dish) => `<div class="dish">${esc(dishName(dish))}</div>`).join('');
  cal.textContent = meal.calories ? `총 ${meal.calories}` : 'NEIS 급식 데이터';
}
function renderEvents() {
  const events = nextEvents();
  const box = $('#eventList');
  if (!events.length) { box.innerHTML='<div class="empty">이번 달 남은 학사일정이 없습니다.</div>'; return; }
  box.innerHTML = events.map((event) => {
    const date = parseYmd(event.date);
    return `<div class="event"><div class="event-date"><strong>${date.getDate()}</strong><span>${date.getMonth()+1}월</span></div><div><div class="event-name">${esc(event.name)}</div>${event.content?`<div class="event-content">${esc(event.content)}</div>`:''}</div></div>`;
  }).join('');
}
function renderWeek() {
  const days = weekDates();
  const rows = data?.timetable || [];
  const max = Math.max(0, ...rows.map((r) => Number(r.period) || 0));
  if (!max) { $('#weekTable').innerHTML='<div class="empty">이번 주 시간표가 없습니다.</div>'; return; }
  const cells = ['<div class="week-cell week-head">교시</div>', ...days.map((d) => `<div class="week-cell week-head">${shortDay(d)} ${d.getDate()}</div>`)];
  for (let p=1; p<=max; p++) {
    cells.push(`<div class="week-cell week-period">${p}</div>`);
    for (const d of days) {
      const row = rows.find((x) => x.date === ymd(d) && Number(x.period) === p);
      cells.push(`<div class="week-cell"><div class="week-subject">${row ? esc(subjectFor(row)) : '—'}</div></div>`);
    }
  }
  $('#weekTable').innerHTML = cells.join('');
}
function renderSchedule() {
  const rows = [...(data?.events || [])].sort((a,b) => a.date.localeCompare(b.date));
  $('#scheduleGrid').innerHTML = rows.length ? rows.map((event) => `<div class="schedule-row"><time>${esc(monthDay(event.date))}</time><strong>${esc(event.name)}</strong>${event.content?`<p>${esc(event.content)}</p>`:''}</div>`).join('') : '<div class="empty">이번 달 학사일정이 없습니다.</div>';
}
function renderView() {
  $('#todaySection').classList.toggle('hidden', currentView !== 'today');
  $('#weekSection').classList.toggle('hidden', currentView !== 'week');
  $('#scheduleSection').classList.toggle('hidden', currentView !== 'schedule');
  $$('.tab-btn').forEach((button) => button.classList.toggle('active', button.dataset.view === currentView));
}
function renderAll() {
  renderProfileBits(); renderHero(); renderDayStrip(); renderTimetable(); renderMeals(); renderEvents(); renderWeek(); renderSchedule(); renderView();
}

function shiftDay(delta) { const d = new Date(selectedDate); d.setDate(d.getDate()+delta); selectedDate=d; loadDashboard(); }
function shiftWeek(delta) { const d = new Date(selectedDate); d.setDate(d.getDate()+delta*7); selectedDate=d; loadDashboard(); }
function switchView(view) { currentView=view; renderView(); }
function openSwitch() {
  $('#switchSearch').value='';
  $('#switchResults').classList.add('hidden');
  $('#currentSchoolMeta').textContent = profile ? `${profile.school.name} · ${profile.grade}학년 ${profile.className}반` : '';
  $('#switchDialog').showModal();
  setTimeout(() => $('#switchSearch').focus(), 100);
}

function bind() {
  applyTheme();
  $('#themeBtn').addEventListener('click', cycleTheme);
  $('#schoolSearch').addEventListener('input', () => debounceSearch('#schoolSearch','#schoolResults'));
  $('#schoolSearchBtn').addEventListener('click', () => runSearch('#schoolSearch','#schoolResults'));
  $('#schoolSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch('#schoolSearch','#schoolResults'); });
  $('#switchSearch').addEventListener('input', () => debounceSearch('#switchSearch','#switchResults'));
  $('#schoolBtn').addEventListener('click', openSwitch);
  $('#changeSchoolBtn').addEventListener('click', clearProfile);
  $('#setupSave').addEventListener('click', saveSetup);
  $('#classMinus').addEventListener('click', () => adjustClass(-1));
  $('#classPlus').addEventListener('click', () => adjustClass(1));
  $('#prevDay').addEventListener('click', () => shiftDay(-1));
  $('#nextDay').addEventListener('click', () => shiftDay(1));
  $('#prevWeek').addEventListener('click', () => shiftWeek(-1));
  $('#nextWeek').addEventListener('click', () => shiftWeek(1));
  $('#todayBtn').addEventListener('click', () => { selectedDate=new Date(); loadDashboard(); });
  $('#editSubjectsBtn').addEventListener('click', () => { editMode=!editMode; renderTimetable(); if (editMode) toast('수정한 과목은 이 기기에만 저장됩니다.'); });
  $$('.tab-btn').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
  $$('.dialog-close').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
}

bind();
if (profile) { showDashboard(); loadDashboard(); }
else showLanding();
