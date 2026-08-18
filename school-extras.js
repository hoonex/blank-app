const $ = (s) => document.querySelector(s);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

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
  const name = dish.textContent.trim();
  if (!name) return false;
  const school = $('#schoolNameTop')?.textContent?.trim() || '';
  const query = encodeURIComponent(`${name} 음식 ${school}`.trim());
  window.open(`https://www.google.com/search?tbm=isch&q=${query}`, '_blank', 'noopener,noreferrer');
  return true;
}

document.addEventListener('click', (event) => mealSearch(event.target));
document.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.closest?.('.dish')) {
    event.preventDefault();
    mealSearch(event.target);
  }
});

function enhanceDishes() {
  document.querySelectorAll('.dish').forEach((dish) => {
    dish.tabIndex = 0;
    dish.setAttribute('role', 'link');
    dish.title = '음식 사진 검색';
  });
}
const mealList = $('#mealList');
if (mealList) {
  new MutationObserver(enhanceDishes).observe(mealList, { childList: true, subtree: true });
  enhanceDishes();
}
