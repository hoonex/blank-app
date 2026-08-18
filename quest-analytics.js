const FLOW_METRICS_ENDPOINT = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-quest-event';
const FLOW_ANON_KEY = 'flow-quest-anon-v1';
const FLOW_VISIT_KEY = 'flow-quest-visit-v1';

function flowLocalDate() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function flowAnonId() {
  let id = localStorage.getItem(FLOW_ANON_KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    localStorage.setItem(FLOW_ANON_KEY, id);
  }
  return id;
}

function flowTrack(eventName, options = {}) {
  const payload = {
    anon_id: flowAnonId(),
    event_name: eventName,
    session_minutes: Number.isInteger(options.minutes) ? options.minutes : null,
    metadata: options.metadata || {}
  };

  fetch(FLOW_METRICS_ENDPOINT, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-store',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function readQuestState() {
  try { return JSON.parse(localStorage.getItem('flow-quest-state-v1')) || {}; }
  catch { return {}; }
}

function readFocusPlans() {
  try {
    const value = JSON.parse(localStorage.getItem('flow-focus-plans-v1'));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

let pendingRun = (() => {
  const active = readQuestState().active;
  return active ? {
    minutes: Number(active.minutes) || 0,
    linked: Boolean(active.planId)
  } : null;
})();

(function trackVisit() {
  const today = flowLocalDate();
  const previous = localStorage.getItem(FLOW_VISIT_KEY);
  flowTrack('page_view', { metadata: { level: Number(readQuestState().level) || 1 } });
  if (previous && previous !== today) flowTrack('return_visit', { metadata: { level: Number(readQuestState().level) || 1 } });
  localStorage.setItem(FLOW_VISIT_KEY, today);

  if (!sessionStorage.getItem('flow-focus-import-seen')) {
    const plans = readFocusPlans();
    const hasOpenSession = plans.some((p) => Array.isArray(p.sessions) && p.sessions.some((s) => !s.done));
    if (hasOpenSession) {
      flowTrack('focus_import');
      sessionStorage.setItem('flow-focus-import-seen', '1');
    }
  }
})();

// Capture phase runs before the game handlers mutate localStorage/UI.
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('button') : null;
  if (!target) return;

  if (target.id === 'startBtn') {
    const value = document.querySelector('#timerValue')?.textContent || '25:00';
    const minutes = Math.max(1, Math.min(240, Number(value.split(':')[0]) || 25));
    const linked = document.querySelector('#timerEyebrow')?.textContent === 'QUEST READY';
    pendingRun = { minutes, linked };
    flowTrack('quest_start', { minutes, metadata: { linked } });
  }

  if (target.id === 'stopBtn') {
    const active = readQuestState().active;
    const elapsed = active?.startedAt ? Math.max(0, Math.min(240, Math.floor((Date.now() - active.startedAt) / 60000))) : 0;
    flowTrack('quest_abort', { minutes: pendingRun?.minutes || Number(active?.minutes) || 0, metadata: { elapsed } });
    pendingRun = null;
  }

  if (target.matches('[data-shop]')) {
    flowTrack('shop_purchase', { metadata: { item: target.dataset.shop || '' } });
  }

  if (target.id === 'shareBtn' || target.id === 'rewardShareBtn') {
    flowTrack('share', { metadata: { level: Number(readQuestState().level) || 1 } });
  }
}, true);

const rewardDialog = document.querySelector('#rewardDialog');
if (rewardDialog) {
  const observer = new MutationObserver(() => {
    if (!rewardDialog.hasAttribute('open')) return;
    const state = readQuestState();
    const damage = Number((document.querySelector('#rewardDamage')?.textContent || '').replace(/[^0-9]/g, '')) || 0;
    const minutes = pendingRun?.minutes || 0;
    flowTrack('quest_complete', {
      minutes,
      metadata: {
        linked: Boolean(pendingRun?.linked),
        damage,
        stage: Number(state.boss?.stage) || 1,
        level: Number(state.level) || 1
      }
    });
    pendingRun = null;
  });
  observer.observe(rewardDialog, { attributes: true, attributeFilter: ['open'] });
}
