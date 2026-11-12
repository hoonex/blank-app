import {
  PROFILE_KEY, THEME_KEY, escapeHtml, dateKey, isoDate, fromKey, addDays, mondayDays,
  readProfile, saveProfile, readTheme, saveTheme, searchSchools, getClasses, dashboard,
  displaySubject, updateSubject, gradeEventApplies, safeUrl
} from "./data.js";

const H = escapeHtml;
const $ = (selector) => document.querySelector(selector);
const days = ["일","월","화","수","목","금","토"];
const navItems = [
  { id:"today", label:"오늘", icon:"◉" },
  { id:"schedule", label:"일정", icon:"▦" },
  { id:"school", label:"학교", icon:"▤" },
  { id:"settings", label:"설정", icon:"⚙" }
];
const initial = new URL(location.href).searchParams.get("view");
const state = {
  profile:readProfile(),
  date:new Date(),
  view:navItems.some(item => item.id === initial) ? initial : "today",
  mode:"day",
  data:null, loading:false, stale:false, error:"",
  schoolResults:[], setupSchool:null, setupGrade:1, setupClasses:[],
  searchQuery:"", searching:false, classError:""
};
state.date = new Date(state.date.getFullYear(),state.date.getMonth(),state.date.getDate(),12);
let requestVersion = 0, schoolSearchVersion = 0, searchTimer, setupAbort;
const root = $("#app");

function koDate(date, options = { month:"long",day:"numeric",weekday:"long" }) {
  return new Intl.DateTimeFormat("ko-KR",options).format(date);
}
function schoolLabel() {
  if (!state.profile) return "";
  return String(state.profile.grade) + "학년 " + String(state.profile.className) + "반";
}
function changedDate(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return;
  state.date = new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);
  refresh();
}
function navButton(item) {
  const active = state.view === item.id;
  return '<button class="nav-button" type="button" data-nav="'+item.id+'"'+
    (active ? ' aria-current="page"' : "")+
    '><span class="nav-icon" aria-hidden="true">'+item.icon+'</span><span>'+item.label+'</span></button>';
}
function go(view) {
  if (!navItems.some(item => item.id === view)) return;
  state.view = view;
  const url = new URL(location.href);
  url.searchParams.set("view",view);
  history.pushState({view},"",url);
  render();
}
function header(title,subtitle,right="") {
  return '<header class="page-heading"><div><span class="eyebrow">FLOW / SCHOOL</span><h1>'+
    H(title)+'</h1><p class="page-subtitle">'+H(subtitle)+'</p></div><div class="heading-actions">'+right+'</div></header>';
}
function section(name,content,action="") {
  return '<section class="panel panel-pad"><div class="section-head"><h2>'+H(name)+'</h2>'+action+'</div>'+content+'</section>';
}
function empty(text) { return '<div class="empty">'+H(text)+'</div>'; }
function errorBanner() {
  return state.error ? '<div role="alert" class="error-banner">'+H(state.error)+'</div>' :
    (state.stale ? '<div role="status" class="error-banner">저장된 정보를 표시합니다. 최신 정보가 아닐 수 있습니다.</div>' : "");
}
function currentRows(date = state.date) {
  return (state.data?.timetable || [])
    .filter(row => row.date === dateKey(date))
    .sort((a,b) => Number(a.period) - Number(b.period));
}
function mealFor(date = state.date) {
  const list = (state.data?.meals || []).filter(row => row.date === dateKey(date));
  return list.find(item => item.type?.includes("중식")) || list[0] || null;
}
function eventRows() {
  return (state.data?.events || [])
    .filter(row => row?.date && gradeEventApplies(state.profile,row))
    .sort((a,b) => String(a.date).localeCompare(String(b.date)));
}
function labelDateKey(value) {
  const d = fromKey(value);
  return Number.isFinite(d.getTime()) ? koDate(d,{month:"numeric",day:"numeric"}) : "";
}
function subjectEditorButton(row) {
  const label = displaySubject(state.profile,row);
  return '<button class="btn small" type="button" data-edit-subject="'+H(row.date)+
    '" data-edit-period="'+Number(row.period)+'" aria-label="'+H(label)+
    ' 과목 변경">편집</button>';
}
function todayStats() {
  const rows = currentRows();
  const meal = mealFor();
  const later = eventRows().filter(e => e.date >= dateKey(state.date));
  const item = (name,value,caption) => '<div class="panel stat"><small>'+name+'</small><strong>'+
    H(value)+'</strong><p>'+H(caption)+'</p></div>';
  return '<div class="stat-row">'+
    item("오늘 수업",rows.length ? rows.length + "교시" : "—","시간표 기준")+
    item("급식",meal ? "제공 정보" : "—",meal ? (meal.type || "오늘 급식") : "등록된 급식 없음")+
    item("가까운 일정",later.length ? later[0].name : "예정 없음",later.length ? labelDateKey(later[0].date) : "학사일정 기준")+
    '</div>';
}
function dayStrip() {
  return '<div class="date-strip" role="group" aria-label="수업 날짜">'+mondayDays(state.date).map(date =>
    '<button type="button" class="day-pill'+(dateKey(date) === dateKey(state.date) ? ' active' : '')+
    '" data-date="'+dateKey(date)+'"><small>'+days[date.getDay()]+'</small><strong>'+date.getDate()+'</strong></button>'
  ).join("")+'</div>';
}
function timetableDay() {
  const rows = currentRows();
  const list = rows.length ?
    '<ol class="class-list">'+rows.map(row =>
      '<li class="class-item"><span class="period">'+Number(row.period)+'</span><div class="class-info"><strong>'+
      H(displaySubject(state.profile,row))+'</strong><small>'+Number(row.period)+'교시</small></div>'+
      subjectEditorButton(row)+'</li>'
    ).join("")+'</ol>' : empty("이 날짜에 등록된 시간표가 없습니다.");
  return dayStrip()+list;
}
function timetableWeek() {
  const dates = mondayDays(state.date);
  const all = dates.flatMap(currentRows);
  if (!all.length) return empty("이번 주 시간표가 없습니다.");
  const max = Math.max(...all.map(row => Number(row.period) || 0));
  const headerRow = '<thead><tr><th scope="col">교시</th>'+dates.map(d =>
    '<th scope="col">'+days[d.getDay()]+' '+d.getDate()+'</th>').join("")+'</tr></thead>';
  const body = Array.from({length:max},(_,index) => {
    const period = index+1;
    return '<tr><td class="period-col">'+period+'</td>'+dates.map(d => {
      const row = currentRows(d).find(r => Number(r.period) === period);
      return '<td class="'+(dateKey(d) === dateKey(new Date()) ? 'today-col' : '')+'">'+
        (row ? '<button type="button" class="subtle-action" data-edit-subject="'+H(row.date)+
          '" data-edit-period="'+period+'">'+H(displaySubject(state.profile,row))+'</button>' : '—')+'</td>';
    }).join("")+'</tr>';
  }).join("");
  return '<div class="week-wrap"><table class="week-grid">'+headerRow+'<tbody>'+body+'</tbody></table></div>';
}
function renderMeal() {
  const meal = mealFor();
  if (!meal) return empty("급식 데이터가 없습니다.");
  const dishes = (Array.isArray(meal.dishes) ? meal.dishes : [])
    .map(dish => '<li>'+H(dish)+'</li>').join("");
  return '<ul class="meal-dishes">'+dishes+'</ul>'+
    '<p class="meal-meta">'+H(meal.type || "급식")+(meal.calories ? ' · '+H(meal.calories) : '')+'</p>';
}
function eventList(events) {
  if (!events.length) return empty("표시할 일정이 없습니다.");
  return '<div class="event-list">'+events.map(e =>
    '<div class="event-item"><span class="event-date">'+H(labelDateKey(e.date))+'</span>'+
    '<div class="event-content"><strong>'+H(e.name || "학교 행사")+'</strong>'+
    (e.content ? '<small>'+H(e.content)+'</small>' : '')+'</div></div>'
  ).join("")+'</div>';
}
function renderToday() {
  const controls = '<button class="btn btn-icon" type="button" data-date-shift="-1" aria-label="이전 날짜">‹</button>'+
    '<input class="btn" type="date" id="dateSelect" aria-label="날짜 선택" value="'+isoDate(state.date)+'">'+
    '<button class="btn btn-icon" type="button" data-date-shift="1" aria-label="다음 날짜">›</button>'+
    '<button class="btn" type="button" data-today>오늘로</button>';
  const chooser = '<div class="chooser" role="group" aria-label="시간표 보기">'+
    '<button type="button" data-mode="day" class="'+(state.mode === "day" ? "active" : "")+'">하루</button>'+
    '<button type="button" data-mode="week" class="'+(state.mode === "week" ? "active" : "")+'">주간</button></div>';
  const upcoming = eventRows().filter(e => e.date >= dateKey(state.date)).slice(0,5);
  return header(koDate(state.date),schoolLabel(),controls)+errorBanner()+todayStats()+
    '<div class="grid-today">'+
      section("시간표",state.mode === "week" ? timetableWeek() : timetableDay(),chooser)+
      '<div class="stack">'+section("급식",renderMeal())+
        section("다가오는 일정",eventList(upcoming),'<button type="button" class="subtle-action" data-nav="schedule">달력 보기</button>')+
        section("등하교",'<p class="page-subtitle">대구 교통 정보는 기존 실시간 교통 화면과 연결됩니다.</p>'+
          '<div class="links-row"><a class="btn" href="/transit">교통 보기</a></div>')+
      '</div></div>';
}
function calendarCells() {
  const month = state.date.getMonth();
  const first = new Date(state.date.getFullYear(),month,1,12);
  const start = addDays(first,-first.getDay());
  const evs = eventRows();
  const weekdays = days.map(d => '<div class="calendar-weekday">'+d+'</div>').join("");
  const cells = Array.from({length:42},(_,n) => {
    const date = addDays(start,n);
    const key = dateKey(date);
    const list = evs.filter(e => e.date === key);
    const selected = key === dateKey(state.date);
    const today = key === dateKey(new Date());
    return '<button type="button" class="calendar-cell'+(date.getMonth() !== month ? ' other' : '')+
      (selected ? ' selected' : '')+(today ? ' today' : '')+'" data-date="'+key+
      '" aria-label="'+H(koDate(date))+(list.length ? ', 일정 '+list.length+'개' : '')+'">'+
      '<span class="calendar-num">'+date.getDate()+'</span>'+
      (list[0] ? '<span class="calendar-event">'+H(list[0].name)+'</span>' : '')+
      (list.length > 1 ? '<span class="calendar-more">+'+(list.length-1)+'</span>' : '')+'</button>';
  }).join("");
  return '<div class="calendar-grid">'+weekdays+cells+'</div>';
}
function renderSchedule() {
  const month = koDate(state.date,{year:"numeric",month:"long"});
  return header("학사일정","월별 일정과 학교 행사를 확인합니다.")+errorBanner()+
    '<div class="calendar-layout"><section class="panel panel-pad">'+
    '<div class="calendar-head"><button class="btn btn-icon" data-month-shift="-1" type="button" aria-label="이전 달">‹</button>'+
    '<h2>'+H(month)+'</h2><button class="btn btn-icon" data-month-shift="1" type="button" aria-label="다음 달">›</button></div>'+
    calendarCells()+'</section>'+
    section("이번 달 일정",eventList(eventRows()),'<button type="button" class="subtle-action" data-today>오늘로</button>')+
    '</div>';
}
function infoRow(name,value) {
  return value ? '<div class="info-item"><small>'+H(name)+'</small><strong>'+H(value)+'</strong></div>' : "";
}
function renderSchool() {
  const school = {...state.profile.school,...(state.data?.school || {})};
  const name = school.name || "학교";
  const url = safeUrl(school.homepage);
  const links = '<div class="links-row">'+
    (url ? '<a class="btn" target="_blank" rel="noopener noreferrer" href="'+H(url)+'">학교 홈페이지</a>' : '')+
    (school.address ? '<a class="btn" target="_blank" rel="noopener noreferrer" href="https://map.kakao.com/?q='+encodeURIComponent(name)+'">지도 보기</a>' : '')+
    '<a class="btn" href="https://www.schoolinfo.go.kr/Main.do" target="_blank" rel="noopener noreferrer">학교알리미</a>'+
    '</div>';
  return header("학교 정보","학교 기본정보와 공식 링크")+errorBanner()+
    '<section class="panel panel-pad"><div class="profile-lead"><div class="profile-mark" aria-hidden="true">'+H(name.slice(0,1))+'</div>'+
    '<div><h2>'+H(name)+'</h2><p>'+H(school.kind || "학교")+' · '+H(schoolLabel())+'</p></div></div>'+
    '<div class="info-grid">'+
      infoRow("학교명(영문)",school.englishName)+infoRow("주소",school.address)+
      infoRow("전화",school.phone)+infoRow("설립 형태",school.type)+
      infoRow("관할 교육청",school.officeName || school.jurisdiction)+
      infoRow("남녀공학",school.coed)+infoRow("학교 유형",school.highSchoolType)+
      infoRow("개교기념일",school.anniversary)+
    '</div>'+links+'</section><p class="muted-note">NEIS 교육정보 개방 데이터를 사용합니다. 공개되지 않은 항목은 표시하지 않습니다.</p>';
}
function renderSettings() {
  const theme = readTheme();
  const chooser = '<div class="chooser" role="group" aria-label="화면 테마">'+
    [["light","라이트"],["system","시스템"],["dark","다크"]].map(pair =>
    '<button type="button" data-theme-choice="'+pair[0]+'" class="'+(theme === pair[0] ? "active" : "")+'">'+pair[1]+'</button>').join("")+'</div>';
  return header("설정","학교 정보와 앱 환경을 관리합니다.")+
    section("화면 및 데이터",'<div class="setting-section">'+
      '<div class="setting-row"><div><strong>화면 테마</strong><p>기기 설정을 따르거나 직접 선택할 수 있습니다.</p></div>'+chooser+'</div>'+
      '<div class="setting-row"><div><strong>학교 및 학급</strong><p>'+H(state.profile.school.name)+' · '+H(schoolLabel())+'</p></div>'+
        '<button type="button" class="btn" data-change-school>변경</button></div>'+
      '<div class="setting-row"><div><strong>최신 데이터 가져오기</strong><p>오래된 데이터가 있다면 새로 요청합니다.</p></div>'+
        '<button type="button" class="btn" data-refresh>새로고침</button></div>'+
    '</div>')+'<div style="height:16px"></div>'+
    section("연결된 서비스",'<div class="setting-section">'+
      '<div class="setting-row"><div><strong>기존 Flow</strong><p>아직 새 UI로 이식되지 않은 모든 기능에 접근합니다.</p></div><a class="btn" href="/">기존 버전</a></div>'+
      '<div class="setting-row"><div><strong>대학 모드</strong><p>대학 시간표·캠퍼스·에브리타임 가져오기</p></div><a class="btn" href="/university">대학 모드</a></div>'+
      '<div class="setting-row"><div><strong>관리자</strong><p>기존 인증 및 관리 시스템은 그대로 유지됩니다.</p></div><a class="btn" href="/admin">관리자</a></div>'+
    '</div>')+
    '<p class="muted-note">이 미리보기는 기존 PWA·광고 배치·관리자·대학 모드 코드를 수정하지 않습니다.</p>';
}
function shell() {
  return '<div class="shell"><aside class="sidebar" aria-label="Flow 메뉴">'+
    '<a href="./index.html" class="brand">Flow <small>School</small></a>'+
    '<span class="sidebar-label">나의 학교</span>'+
    '<button class="school-chip" type="button" data-change-school><strong>'+H(state.profile.school.name)+'</strong>'+
      '<small>'+H(schoolLabel())+' · 학교 변경</small></button>'+
    '<nav class="side-nav" aria-label="주 메뉴">'+navItems.map(navButton).join("")+'</nav>'+
    '<div class="sidebar-footer"><span>일상이 조금 더 간단해지도록.</span><a href="/">기존 Flow 열기</a></div></aside>'+
    '<header class="topbar"><a href="./index.html" class="brand">Flow <small>School</small></a>'+
      '<button class="school-chip" type="button" data-change-school><strong>'+H(state.profile.school.name)+'</strong></button></header>'+
    '<main class="main" id="mainContent"><div class="main-inner">'+
      (state.view === "schedule" ? renderSchedule() : state.view === "school" ? renderSchool() :
       state.view === "settings" ? renderSettings() : renderToday())+
    '</div></main><nav class="bottom-nav" aria-label="모바일 메뉴">'+navItems.map(navButton).join("")+'</nav>'+
    '<dialog id="subjectDialog"><form method="dialog" class="dialog-inner" id="subjectForm">'+
      '<h2>과목 수정</h2><p>이 기기에 저장되며 기존 Flow의 과목 설정과 공유됩니다.</p>'+
      '<div class="field"><label for="subjectInput">과목명</label><input id="subjectInput" name="subject" maxlength="60" required></div>'+
      '<input id="subjectDate" type="hidden"><input id="subjectPeriod" type="hidden">'+
      '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog>취소</button>'+
      '<button class="btn primary" type="submit">저장</button></div></form></dialog></div>';
}
function resultMarkup() {
  return state.schoolResults.length ?
    state.schoolResults.map(s =>
      '<button class="school-result'+(state.setupSchool?.schoolCode === s.schoolCode ? ' selected' : '')+
      '" type="button" data-school-code="'+H(s.schoolCode)+'"><strong>'+H(s.name)+'</strong>'+
      '<small>'+H(s.address || s.officeName || s.kind)+'</small></button>').join("") :
    (state.searching ? empty("학교를 검색하는 중입니다.") :
      state.searchQuery.length >= 2 ? empty("검색 결과가 없습니다.") : '');
}
function setup() {
  const school = state.setupSchool;
  const classInputs = school ? '<div class="field"><label for="setupGrade">학년</label>'+
    '<select id="setupGrade">'+Array.from({length:String(school.kind||"").includes("초등")?6:3},
      (_,i) => '<option value="'+(i+1)+'"'+(state.setupGrade === i+1?' selected':'')+'>'+(i+1)+'학년</option>').join("")+'</select></div>'+
    '<div class="field"><label for="setupClass">반</label>'+
    (state.setupClasses.length ? '<select id="setupClass">'+state.setupClasses.map(c =>
      '<option value="'+H(c)+'">'+H(c)+'반</option>').join("")+'</select>' :
      '<input id="setupClass" inputmode="numeric" placeholder="반을 입력하세요" maxlength="12" required>')+
    (state.classError ? '<small role="status">'+H(state.classError)+'</small>' : '')+'</div>' : "";
  return '<div class="setup"><div class="setup-heading"><a class="brand" href="/">Flow <small>School</small></a>'+
    '<span class="eyebrow">FLOW / SCHOOL 2.0</span>'+
    '<h1>학교 생활을<br><span>더 간결하게.</span></h1>'+
    '<p>시간표와 급식, 학사일정을 필요한 순간에 확인하세요. 학교와 학급을 한 번 설정하면 그대로 저장됩니다.</p>'+
    '<p class="muted-note"><a href="/">기존 Flow로 돌아가기</a></p></div>'+
    '<section class="panel setup-card"><h2>학교 선택</h2><p>기존 설정이 있다면 자동으로 이어집니다.</p>'+
      '<form id="setupForm"><div class="field"><label for="schoolQuery">학교 검색</label>'+
      '<div class="search-row"><input id="schoolQuery" value="'+H(state.searchQuery)+'" autocomplete="off" placeholder="학교명을 입력하세요">'+
      '<button class="btn" type="button" data-search>검색</button></div></div>'+
      '<div class="school-results" id="schoolResults" aria-live="polite">'+resultMarkup()+'</div>'+
      (school ? '<p style="margin-top:12px"><strong>선택: '+H(school.name)+'</strong></p>' : '')+
      classInputs+
      '<div class="form-actions"><button type="submit" class="btn primary"'+(!school ? " disabled" : "")+'>시작하기</button></div>'+
      '</form></section></div>';
}
function applyTheme() {
  const theme = readTheme();
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
function render() {
  applyTheme();
  root.innerHTML = state.profile ? shell() : setup();
}
async function refresh(force = false) {
  if (!state.profile) { render(); return; }
  const token = ++requestVersion;
  state.loading = true; state.error = "";
  render();
  try {
    const result = await dashboard(state.profile,state.date,{force});
    if (token !== requestVersion) return;
    state.data = result.payload;
    state.stale = result.stale;
    state.error = result.warning || "";
    if (result.payload.school) {
      state.profile.school = {...state.profile.school,...result.payload.school};
      saveProfile(state.profile);
    }
  } catch (error) {
    if (token !== requestVersion) return;
    state.data = null;
    state.error = error instanceof Error ? error.message : "학교 데이터를 불러오지 못했습니다.";
  } finally {
    if (token === requestVersion) { state.loading = false; render(); }
  }
}
async function loadClassList() {
  if (!state.setupSchool) return;
  const currentSchool = state.setupSchool.schoolCode;
  const grade = state.setupGrade;
  setupAbort?.abort();
  setupAbort = new AbortController();
  state.setupClasses=[];state.classError="반 정보를 불러오는 중입니다.";
  render();
  try {
    const list = await getClasses(state.setupSchool,grade,setupAbort.signal);
    if (state.setupSchool?.schoolCode !== currentSchool || state.setupGrade !== grade) return;
    state.setupClasses = list;
    state.classError = list.length ? "" : "반 목록이 없어 직접 입력할 수 있습니다.";
  } catch(error) {
    if (setupAbort.signal.aborted) return;
    state.classError = "반을 직접 입력하세요.";
    state.setupClasses = [];
  }
  render();
}
function beginSearch(query) {
  state.searchQuery = String(query||"").trim();
  clearTimeout(searchTimer);
  const token = ++schoolSearchVersion;
  state.searching = state.searchQuery.length >= 2;
  if (!state.searching) {
    state.schoolResults = [];
    const target = $("#schoolResults"); if(target) target.innerHTML = resultMarkup();
    return;
  }
  const results = $("#schoolResults");
  if (results) results.innerHTML = resultMarkup();
  searchTimer = setTimeout(async () => {
    try {
      const schools = await searchSchools(state.searchQuery);
      if(token !== schoolSearchVersion) return;
      state.schoolResults = schools;
    } catch {
      if(token !== schoolSearchVersion) return;
      state.schoolResults = [];
    } finally {
      if(token === schoolSearchVersion) {
        state.searching = false;
        const target = $("#schoolResults"); if(target) target.innerHTML = resultMarkup();
      }
    }
  },250);
}
function editSubject(date,period) {
  const row = (state.data?.timetable || []).find(r => r.date === date && Number(r.period) === period);
  if (!row) return;
  const dialog = $("#subjectDialog");
  $("#subjectDate").value = date;
  $("#subjectPeriod").value = String(period);
  $("#subjectInput").value = displaySubject(state.profile,row);
  dialog?.showModal();
}
document.addEventListener("click",async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  const d = target.dataset;
  if (d.nav) return go(d.nav);
  if (d.today !== undefined) return changedDate(new Date());
  if (d.dateShift) return changedDate(addDays(state.date,Number(d.dateShift)));
  if (d.monthShift) return changedDate(new Date(state.date.getFullYear(),state.date.getMonth()+Number(d.monthShift),1,12));
  if (d.date) return changedDate(fromKey(d.date));
  if (d.mode) {state.mode = d.mode; render();return;}
  if (d.themeChoice) {saveTheme(d.themeChoice);render();return;}
  if (d.refresh !== undefined) return refresh(true);
  if (d.changeSchool !== undefined) {
    state.profile = null; state.data = null; state.error = "";
    state.setupSchool = null;state.setupClasses=[];state.schoolResults=[];
    render();return;
  }
  if (d.schoolCode) {
    state.setupSchool = state.schoolResults.find(s => s.schoolCode === d.schoolCode) || null;
    state.setupGrade = 1; await loadClassList(); return;
  }
  if (d.search !== undefined) {beginSearch($("#schoolQuery")?.value||"");return;}
  if (d.editPeriod) return editSubject(d.editSubject,Number(d.editPeriod));
  if (d.closeDialog !== undefined) return $("#subjectDialog")?.close();
});
document.addEventListener("change",(event) => {
  const target = event.target;
  if (target.id === "dateSelect") return changedDate(fromKey(target.value.replaceAll("-","")));
  if (target.id === "setupGrade") {
    state.setupGrade = Number(target.value) || 1;
    loadClassList();
  }
});
document.addEventListener("input",(event) => {
  const target = event.target;
  if (target.id === "schoolQuery") beginSearch(target.value);
});
document.addEventListener("submit",(event) => {
  if (event.target.id === "setupForm") {
    event.preventDefault();
    if (!state.setupSchool) return;
    const cls = String($("#setupClass")?.value || "").trim();
    if (!cls) { state.classError = "반을 입력하세요."; render(); return; }
    const profile = { school:state.setupSchool,grade:state.setupGrade,className:cls };
    if (!saveProfile(profile)) { state.classError = "설정을 저장할 수 없습니다. 브라우저 저장 공간을 확인하세요."; render(); return; }
    state.profile = profile; state.date = new Date(); state.view="today";
    state.date = new Date(state.date.getFullYear(),state.date.getMonth(),state.date.getDate(),12);
    refresh(); return;
  }
  if (event.target.id === "subjectForm") {
    event.preventDefault();
    const date = $("#subjectDate").value,period = Number($("#subjectPeriod").value);
    const row = (state.data?.timetable || []).find(r => r.date === date && Number(r.period) === period);
    if (row) updateSubject(state.profile,row,$("#subjectInput").value);
    $("#subjectDialog")?.close();render();
  }
});
window.addEventListener("popstate",() => {
  const requested = new URL(location.href).searchParams.get("view");
  state.view = navItems.some(item => item.id === requested) ? requested : "today";
  render();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",applyTheme);
render();
if(state.profile) refresh();
