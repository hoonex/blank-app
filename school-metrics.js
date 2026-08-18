const nativeObserve = MutationObserver.prototype.observe;
MutationObserver.prototype.observe = function(target, options = {}) {
  const guarded = target instanceof Element && ['timetable', 'calendarGrid'].includes(target.id) && options.childList
    ? { ...options, subtree: false }
    : options;
  return nativeObserve.call(this, target, guarded);
};

const v5Style = document.createElement('link');
v5Style.rel = 'stylesheet';
v5Style.href = './school-v5.css';
document.head.append(v5Style);
const hotfixStyle = document.createElement('link');
hotfixStyle.rel = 'stylesheet';
hotfixStyle.href = './school-hotfix.css';
document.head.append(hotfixStyle);
import('./school-v5.js').then(() => import('./school-hotfix.js')).catch(() => {});

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

function timetableShareText() {
  const school = document.querySelector('#heroSchoolName')?.textContent?.trim() || '학교';
  const klass = document.querySelector('#heroSchoolMeta')?.textContent?.trim() || '';
  const date = document.querySelector('#dateTitle')?.textContent?.trim() || '';
  const periods = [...document.querySelectorAll('#timetable .period-button[data-period]')]
    .map((row) => {
      const period = row.dataset.period;
      const subject = row.querySelector('.period-name')?.textContent?.trim() || '—';
      return `${period}교시 ${subject}`;
    });
  const state = document.querySelector('#timetable .timetable-state strong, #timetable .empty')?.textContent?.trim();
  const body = periods.length ? periods.join('\n') : (state || '시간표 정보 없음');
  return `${school}${klass ? ` · ${klass}` : ''}\n${date}\n\n${body}\n\nFlow School · ${location.origin}/home`;
}

async function shareTimetable() {
  const text = timetableShareText();
  try {
    if (navigator.share) {
      await navigator.share({ title: '오늘 시간표', text });
    } else {
      await navigator.clipboard.writeText(text);
      const button = document.querySelector('#shareTimetableBtn');
      if (button) {
        const old = button.textContent;
        button.textContent = '복사됨';
        setTimeout(() => { button.textContent = old; }, 1400);
      }
    }
    track('timetable_share');
  } catch (error) {
    if (error?.name !== 'AbortError') console.warn('timetable_share_failed');
  }
}

function ensureShareButton() {
  const heading = document.querySelector('.timetable-card .card-heading');
  if (!heading || document.querySelector('#shareTimetableBtn')) return;
  const edit = document.querySelector('#editSubjectsBtn');
  const actions = document.createElement('div');
  actions.className = 'timetable-actions';
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.alignItems = 'center';
  const share = document.createElement('button');
  share.id = 'shareTimetableBtn';
  share.type = 'button';
  share.className = 'neo-button compact';
  share.textContent = '시간표 공유';
  share.addEventListener('click', shareTimetable);
  if (edit) {
    edit.replaceWith(actions);
    actions.append(share, edit);
  } else {
    actions.append(share);
    heading.append(actions);
  }
}

ensureShareButton();
const timetable = document.querySelector('#timetable');
if (timetable) new MutationObserver(() => ensureShareButton()).observe(timetable, { childList: true, subtree: true });

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
