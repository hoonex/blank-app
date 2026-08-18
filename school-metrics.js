const EVENT_EDGE = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-quest-event';
const ANON_KEY = 'flow-school-anon-v1';
const SEEN_KEY = 'flow-school-seen-v1';

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
  });
}

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-result-index]')) track('school_select');
  if (event.target.closest?.('#setupSave')) track('setup_complete');
  if (event.target.closest?.('[data-view]')) track('tab_view');
  if (event.target.closest?.('#saveSubjectBtn')) track('subject_override');
  if (event.target.closest?.('.dish[data-dish]')) track('meal_photo_search');
  if (event.target.closest?.('.calendar-day[data-calendar-date]')) track('calendar_date_select');
  if (event.target.closest?.('.national-event')) track('national_schedule_open');
});

const dashboard = document.querySelector('#dashboard');
let visible = dashboard && !dashboard.classList.contains('hidden');
if (visible) track('dashboard_view');
if (dashboard) {
  new MutationObserver(() => {
    const nowVisible = !dashboard.classList.contains('hidden');
    if (nowVisible && !visible) track('dashboard_view');
    visible = nowVisible;
  }).observe(dashboard, { attributes: true, attributeFilter: ['class'] });
}
