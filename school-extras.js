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
  #dateTitle{cursor:pointer;border-radius:9px;padding:7px 8px}
  #dateTitle:hover{background:var(--accent-soft)}
`;
document.head.appendChild(style);

function mealSearch(target) {
  const dish = target.closest?.('.dish');
  if (!dish) return false;
  const name = dish.textContent.replace(/\s*사진\s*$/, '').trim();
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

const mealObserver = new MutationObserver(() => {
  document.querySelectorAll('.dish').forEach((dish) => {
    dish.tabIndex = 0;
    dish.setAttribute('role', 'link');
    dish.title = '음식 사진 검색';
  });
});
const mealList = $('#mealList');
if (mealList) mealObserver.observe(mealList, { childList: true, subtree: true });

const dateTitle = $('#dateTitle');
if (dateTitle) {
  dateTitle.title = '날짜 선택';
  dateTitle.tabIndex = 0;
  const openPicker = () => {
    const input = document.createElement('input');
    input.type = 'date';
    input.style.cssText = 'position:fixed;left:50%;top:80px;opacity:.01;width:1px;height:1px;pointer-events:none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      if (input.value) {
        const [y,m,d] = input.value.split('-').map(Number);
        const picked = new Date(y, m - 1, d, 12);
        const current = new Date();
        const delta = Math.round((picked - new Date(current.getFullYear(), current.getMonth(), current.getDate(), 12)) / 86400000);
        const todayButton = $('#todayBtn');
        if (todayButton) todayButton.click();
        if (delta !== 0) {
          const direction = delta > 0 ? $('#nextDay') : $('#prevDay');
          const count = Math.abs(delta);
          let i = 0;
          const step = () => {
            if (i++ >= count) return;
            direction?.click();
            if (i < count) setTimeout(step, 10);
          };
          step();
        }
      }
      input.remove();
    }, { once:true });
    input.addEventListener('blur', () => setTimeout(() => input.remove(), 500), { once:true });
    try { input.showPicker(); } catch { input.click(); }
  };
  dateTitle.addEventListener('click', openPicker);
  dateTitle.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } });
}
