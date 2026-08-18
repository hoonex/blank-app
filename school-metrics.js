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

/*
 * UX patch for the academic calendar.
 * school.js historically switches to the Today tab when a calendar day is clicked.
 * Intercept that click before the old bubble handler, drive the existing date picker,
 * and let the dashboard reload while keeping the current Schedule view intact.
 */
function calendarDateToIso(raw) {
  return /^\d{8}$/.test(raw || '') ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : '';
}

function syncScheduleSelection() {
  const selected = document.querySelector('.calendar-day.selected[data-calendar-date]');
  const rows = [...document.querySelectorAll('.schedule-row')];
  rows.forEach((row) => row.classList.remove('selected-event'));
  if (!selected) return;
  const raw = selected.dataset.calendarDate || '';
  if (!/^\d{8}$/.test(raw)) return;
  const label = `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
  rows.forEach((row) => {
    if (row.querySelector('time')?.textContent?.trim() === label) row.classList.add('selected-event');
  });
}

document.addEventListener('click', (event) => {
  const day = event.target.closest?.('.calendar-day[data-calendar-date]');
  if (!day) return;
  const iso = calendarDateToIso(day.dataset.calendarDate);
  const picker = document.querySelector('#datePicker');
  if (!iso || !picker) return;

  event.preventDefault();
  event.stopPropagation();
  picker.value = iso;
  picker.dispatchEvent(new Event('change', { bubbles: true }));
  window.setTimeout(syncScheduleSelection, 80);
}, true);

for (const target of [document.querySelector('#calendarGrid'), document.querySelector('#scheduleGrid')].filter(Boolean)) {
  new MutationObserver(() => window.requestAnimationFrame(syncScheduleSelection))
    .observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-result-index]')) track('school_select');
  if (event.target.closest?.('#setupSave')) track('setup_complete');
  if (event.target.closest?.('[data-view]')) track('tab_view');
  if (event.target.closest?.('#saveSubjectBtn')) track('subject_override');
  if (event.target.closest?.('.dish[data-dish]')) track('meal_photo_search');
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
