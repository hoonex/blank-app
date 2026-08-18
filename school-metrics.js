const EVENT_EDGE = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-quest-event';
const ANON_KEY = 'flow-school-anon-v1';
const SEEN_KEY = 'flow-school-seen-v1';

/* Visual layers are styles only now. Runtime behavior lives in school.js. */
for (const href of ['./school-v5.css','./school-hotfix.css','./school-polish.css']) {
  if (document.querySelector(`link[href="${href}"]`)) continue;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

/* Keep the source HTML generic; no school-specific examples or marketing filler. */
const schoolSearch = document.querySelector('#schoolSearch');
const switchSearch = document.querySelector('#switchSearch');
if (schoolSearch) schoolSearch.placeholder = '학교 이름을 입력하세요';
if (switchSearch) switchSearch.placeholder = '학교 이름을 입력하세요';
const eyebrow = document.querySelector('.onboarding-copy .eyebrow');
if (eyebrow) eyebrow.textContent = 'FLOW SCHOOL';
const intro = document.querySelector('.onboarding-copy p');
if (intro) intro.textContent = '시간표, 급식, 학사일정과 학교정보를 한곳에서 확인합니다.';
const hints = document.querySelector('.search-hints');
if (hints) hints.innerHTML = '<span>시간표</span><span>급식</span><span>학사일정</span>';

const telemetryEnabled = !['localhost','127.0.0.1','::1'].includes(location.hostname);
let anonId = localStorage.getItem(ANON_KEY);
if (!anonId) {
  anonId = crypto.randomUUID();
  localStorage.setItem(ANON_KEY, anonId);
}

function track(name) {
  if (!telemetryEnabled) return;
  fetch(EVENT_EDGE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ event_name: `school_${name}`, anon_id: anonId }),
  }).catch(() => {});
}

track('page_view');
if (localStorage.getItem(SEEN_KEY)) track('return_visit');
else localStorage.setItem(SEEN_KEY, String(Date.now()));

let searchTimer = null;
for (const input of [schoolSearch, switchSearch].filter(Boolean)) {
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (input.value.trim().length >= 2) track('school_search');
    }, 700);
  }, { passive: true });
}

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-result-index]')) track('school_select');
  else if (event.target.closest?.('#setupSave')) track('setup_complete');
  else if (event.target.closest?.('[data-view]')) track('tab_view');
  else if (event.target.closest?.('#saveSubjectBtn')) track('subject_override');
  else if (event.target.closest?.('.dish[data-dish]')) track('meal_photo_search');
  else if (event.target.closest?.('.calendar-day[data-calendar-date]')) track('calendar_date_select');
  else if (event.target.closest?.('.national-event')) track('national_schedule_open');
  else if (event.target.closest?.('#shareTimetableBtn')) track('timetable_share');
}, { passive: true });
