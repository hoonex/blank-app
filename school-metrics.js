const EVENT_EDGE = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-quest-event';
const ANON_KEY = 'flow-school-anon-v1';
const SEEN_KEY = 'flow-school-seen-v1';

/* Visual layers are styles only now. Runtime behavior lives in school.js. */
for (const href of ['./school-v5.css','./school-hotfix.css']) {
  if (document.querySelector(`link[href="${href}"]`)) continue;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

let anonId = localStorage.getItem(ANON_KEY);
if (!anonId) {
  anonId = crypto.randomUUID();
  localStorage.setItem(ANON_KEY, anonId);
}

function track(name) {
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
for (const input of [document.querySelector('#schoolSearch'), document.querySelector('#switchSearch')].filter(Boolean)) {
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
