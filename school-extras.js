const $ = (s) => document.querySelector(s);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

const EVENT_EDGE = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-quest-event';
const ANON_KEY = 'flow-school-anon-v1';
const SEEN_KEY = 'flow-school-seen-v1';
let anonId = localStorage.getItem(ANON_KEY);
if (!anonId) {
  anonId = crypto.randomUUID();
  localStorage.setItem(ANON_KEY, anonId);
}
function track(eventName) {
  fetch(EVENT_EDGE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ event_name: `school_${eventName}`, anon_id: anonId }),
  }).catch(() => {});
}
track('page_view');
if (localStorage.getItem(SEEN_KEY)) track('return_visit');
else localStorage.setItem(SEEN_KEY, String(Date.now()));

const style = document.createElement('style');
style.textContent = `
  .dish{color:var(--text);text-decoration:none;cursor:pointer;border-radius:8px;padding:2px 4px;margin-left:-4px;transition:background .15s ease}
  .dish:hover,.dish:focus-visible{background:var(--accent-soft);outline:none}
  .dish::after{content:' 사진';font-size:.58rem;color:var(--muted2);opacity:0;transition:opacity .15s ease;margin-left:5px}
  .dish:hover::after,.dish:focus-visible::after{opacity:1}
`;
document.head.appendChild(style);

function mealSearch(target) {
  const dish = target.closest?.('.dish');
  if (!dish) return false;
  const name = dish.textContent.replace(/\s*사진\s*$/, '').trim();
  if (!name) return false;
  const school = $('#schoolNameTop')?.textContent?.trim() || '';
  track('meal_photo_search');
  const query = encodeURIComponent(`${name} 음식 ${school}`.trim());
  window.open(`https://www.google.com/search?tbm=isch&q=${query}`, '_blank', 'noopener,noreferrer');
  return true;
}

document.addEventListener('click', (event) => {
  if (mealSearch(event.target)) return;
  if (event.target.closest?.('[data-result-index]')) track('select');
  if (event.target.closest?.('#setupSave')) track('setup_complete');
  const tab = event.target.closest?.('.tab-btn');
  if (tab) track('tab_view');
});
document.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.closest?.('.dish')) {
    event.preventDefault();
    mealSearch(event.target);
  }
});
document.addEventListener('focusout', (event) => {
  if (event.target.matches?.('.period-subject[contenteditable="true"]')) track('subject_override');
}, true);

let searchMetricTimer = null;
for (const input of [$('#schoolSearch'), $('#switchSearch')].filter(Boolean)) {
  input.addEventListener('input', () => {
    clearTimeout(searchMetricTimer);
    searchMetricTimer = setTimeout(() => {
      if (input.value.trim().length >= 2) track('search');
    }, 700);
  });
}

const dashboard = $('#dashboard');
let dashboardVisible = dashboard && !dashboard.classList.contains('hidden');
if (dashboardVisible) track('dashboard_view');
if (dashboard) {
  new MutationObserver(() => {
    const nowVisible = !dashboard.classList.contains('hidden');
    if (nowVisible && !dashboardVisible) track('dashboard_view');
    dashboardVisible = nowVisible;
  }).observe(dashboard, { attributes: true, attributeFilter: ['class'] });
}

const mealObserver = new MutationObserver(() => {
  document.querySelectorAll('.dish').forEach((dish) => {
    dish.tabIndex = 0;
    dish.setAttribute('role', 'link');
    dish.title = '음식 사진 검색';
  });
});
const mealList = $('#mealList');
if (mealList) mealObserver.observe(mealList, { childList: true, subtree: true });
