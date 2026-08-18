const FLOW_GAME_BASE = new URL('./quest.html', location.href);
FLOW_GAME_BASE.search = '';
FLOW_GAME_BASE.hash = '';

function flowReadState() {
  try { return JSON.parse(localStorage.getItem('flow-quest-state-v1')) || {}; }
  catch { return {}; }
}

function flowShowToast(message) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(flowShowToast.t);
  flowShowToast.t = setTimeout(() => el.classList.remove('show'), 1700);
}

async function flowShareInvite() {
  const state = flowReadState();
  const url = new URL(FLOW_GAME_BASE.href);
  url.searchParams.set('quick', '10');
  const text = `Flow Quest에서 현실 공부로 보스를 잡는 중. Level ${Number(state.level) || 1}, Stage ${Number(state.boss?.stage) || 1}. 10분만 같이 해보자.`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Flow Quest', text, url: url.href });
    } else {
      await navigator.clipboard.writeText(`${text}\n${url.href}`);
      flowShowToast('플레이 링크를 복사했습니다');
    }
  } catch {}
}

// Analytics capture listener is registered before this file. Stop the old text-only
// share handler after analytics records the click, then use a playable link instead.
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button || (button.id !== 'shareBtn' && button.id !== 'rewardShareBtn')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  flowShareInvite();
}, true);

(function applyQuickStartFromLink() {
  const quick = Number(new URLSearchParams(location.search).get('quick'));
  if (![10, 25, 40, 50].includes(quick)) return;
  requestAnimationFrame(() => {
    const button = document.querySelector(`[data-quick="${quick}"]`);
    if (button) {
      button.click();
      flowShowToast(`${quick}분 원정 준비 완료`);
    }
  });
})();
