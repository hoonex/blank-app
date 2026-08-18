const STATE_KEY = 'flow-quest-state-v1';
const FOCUS_KEY = 'flow-focus-plans-v1';

const $ = (s) => document.querySelector(s);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const todayKey = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};
const yesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const bossNames = [
  'Deadline Warden',
  'The Procrastinator',
  'Noise Colossus',
  'Nightfall Examiner',
  'The Last Chapter',
  'Clockwork Tyrant',
  'Finals Sovereign'
];

const shopItems = [
  { id: 'steel-edge', name: 'Steel Edge', price: 120, desc: '집중 완료 피해량 +8%', stat: 'damage' },
  { id: 'focus-lantern', name: 'Focus Lantern', price: 170, desc: '획득 경험치 +10%', stat: 'xp' },
  { id: 'glass-room', name: 'Glass Chamber', price: 240, desc: '원정 배경을 밝은 유리 톤으로 변경', stat: 'cosmetic' },
  { id: 'warden-cloak', name: 'Warden Cloak', price: 320, desc: '집중 완료 골드 +12%', stat: 'gold' }
];

function defaultState() {
  return {
    level: 1,
    xp: 0,
    gold: 0,
    streak: 0,
    lastStudyDate: null,
    lastChestDate: null,
    owned: [],
    boss: { stage: 1, hp: 600, maxHp: 600 },
    totalMinutes: 0,
    totalSessions: 0,
    active: null,
    sound: true,
    log: []
  };
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATE_KEY));
    if (!raw || typeof raw !== 'object') return defaultState();
    const base = defaultState();
    return {
      ...base,
      ...raw,
      owned: Array.isArray(raw.owned) ? raw.owned : [],
      log: Array.isArray(raw.log) ? raw.log.slice(0, 10) : [],
      boss: { ...base.boss, ...(raw.boss || {}) }
    };
  } catch {
    return defaultState();
  }
}

let state = loadState();
let selectedQuest = null;
let timerTick = null;
let impactUntil = 0;
let impactAmount = 0;
let audioCtx = null;

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function xpNeeded(level = state.level) {
  return 120 + (level - 1) * 90;
}

function multipliers() {
  return {
    damage: state.owned.includes('steel-edge') ? 1.08 : 1,
    xp: state.owned.includes('focus-lantern') ? 1.10 : 1,
    gold: state.owned.includes('warden-cloak') ? 1.12 : 1
  };
}

function powerLabel() {
  const m = multipliers();
  const levelPower = 1 + (state.level - 1) * 0.025;
  return (m.damage * levelPower).toFixed(2);
}

function updateStreak() {
  const today = todayKey();
  if (state.lastStudyDate === today) return;
  state.streak = state.lastStudyDate === yesterdayKey() ? state.streak + 1 : 1;
  state.lastStudyDate = today;
}

function addXp(amount) {
  state.xp += amount;
  let leveled = false;
  while (state.xp >= xpNeeded()) {
    state.xp -= xpNeeded();
    state.level += 1;
    state.gold += 40 + state.level * 8;
    leveled = true;
  }
  return leveled;
}

function currentBossName() {
  return bossNames[(state.boss.stage - 1) % bossNames.length];
}

function spawnNextBoss() {
  state.boss.stage += 1;
  state.boss.maxHp = Math.round(560 + Math.pow(state.boss.stage, 1.15) * 165);
  state.boss.hp = state.boss.maxHp;
  state.gold += 120 + state.boss.stage * 15;
  addXp(80 + state.boss.stage * 12);
  logRun(`Stage ${state.boss.stage - 1} 보스 격파`, 0, '보스 보상 획득');
}

function logRun(title, minutes, detail) {
  const time = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
  state.log.unshift({ title, minutes, detail, time, date: todayKey() });
  state.log = state.log.slice(0, 8);
}

function loadFocusPlans() {
  try {
    const data = JSON.parse(localStorage.getItem(FOCUS_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function collectQuests() {
  const plans = loadFocusPlans();
  const today = todayKey();
  const rows = [];
  for (const plan of plans) {
    for (const session of Array.isArray(plan.sessions) ? plan.sessions : []) {
      if (session.done) continue;
      rows.push({
        id: `${plan.id}:${session.id}`,
        title: plan.title || '집중 퀘스트',
        minutes: Number(session.minutes) || Number(plan.sessionLength) || 25,
        date: session.date,
        planId: plan.id,
        sessionId: session.id,
        kind: plan.kind || 'study',
        priority: session.date === today ? 0 : session.date < today ? 1 : 2
      });
    }
  }
  rows.sort((a, b) => a.priority - b.priority || String(a.date).localeCompare(String(b.date)));
  return rows.slice(0, 5);
}

function markFocusSessionDone(planId, sessionId) {
  if (!planId || !sessionId) return;
  const plans = loadFocusPlans();
  const plan = plans.find((p) => p.id === planId);
  const session = plan?.sessions?.find((s) => s.id === sessionId);
  if (!session) return;
  session.done = true;
  localStorage.setItem(FOCUS_KEY, JSON.stringify(plans));
}

function renderQuests() {
  const list = $('#questList');
  const quests = collectQuests();
  if (!quests.length) {
    list.innerHTML = `<div class="quest selected" data-empty="true"><div><div class="quest-title">자유 원정</div><div class="quest-meta">Flow Focus 계획이 없어도 바로 시작할 수 있습니다</div></div><span class="quest-time">25m</span></div>`;
    if (!selectedQuest || selectedQuest.planId) selectQuest({ title: '자유 원정', minutes: 25, planId: null, sessionId: null });
    list.querySelector('.quest').addEventListener('click', () => selectQuest({ title: '자유 원정', minutes: 25, planId: null, sessionId: null }));
    return;
  }
  list.innerHTML = quests.map((q) => {
    const dateText = q.date === todayKey() ? '오늘' : q.date < todayKey() ? '밀린 퀘스트' : q.date;
    const selected = selectedQuest?.id === q.id ? ' selected' : '';
    return `<button class="quest${selected}" type="button" data-id="${q.id}"><div><div class="quest-title">${escapeHtml(q.title)}</div><div class="quest-meta">${dateText} · ${q.kind === 'exam' ? '시험 원정' : '집중 원정'}</div></div><span class="quest-time">${q.minutes}m</span></button>`;
  }).join('');
  list.querySelectorAll('.quest').forEach((el) => {
    el.addEventListener('click', () => {
      const q = quests.find((x) => x.id === el.dataset.id);
      if (q) selectQuest(q);
    });
  });
  if (!selectedQuest && quests[0]) selectQuest(quests[0]);
}

function escapeHtml(v = '') {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function selectQuest(q) {
  if (state.active) return;
  selectedQuest = { ...q, id: q.id || `quick-${q.minutes}` };
  $('#timerTitle').textContent = selectedQuest.title;
  $('#timerValue').textContent = `${String(selectedQuest.minutes).padStart(2, '0')}:00`;
  $('#timerEyebrow').textContent = selectedQuest.planId ? 'QUEST READY' : 'QUICK RUN';
  renderQuests();
}

function setQuick(minutes) {
  selectQuest({ id: `quick-${minutes}`, title: `${minutes}분 자유 원정`, minutes, planId: null, sessionId: null });
}

function startFocus() {
  if (state.active) return;
  if (!selectedQuest) setQuick(25);
  const now = Date.now();
  const totalMs = selectedQuest.minutes * 60 * 1000;
  state.active = {
    title: selectedQuest.title,
    minutes: selectedQuest.minutes,
    planId: selectedQuest.planId || null,
    sessionId: selectedQuest.sessionId || null,
    startedAt: now,
    endAt: now + totalMs
  };
  saveState();
  startTimerLoop();
  renderAll();
  tone(280, .06);
}

function stopFocus() {
  if (!state.active) return;
  const elapsed = Math.max(0, Math.floor((Date.now() - state.active.startedAt) / 60000));
  if (elapsed > 0) logRun('원정 중단', elapsed, '보상 없음');
  state.active = null;
  saveState();
  stopTimerLoop();
  renderAll();
}

function finishFocus() {
  if (!state.active) return;
  const active = { ...state.active };
  state.active = null;
  stopTimerLoop();
  updateStreak();

  const m = multipliers();
  const levelPower = 1 + (state.level - 1) * .025;
  const streakBonus = Math.min(state.streak * 2, 30);
  const damage = Math.max(20, Math.round(active.minutes * 4.5 * m.damage * levelPower + streakBonus));
  const xp = Math.round(active.minutes * 3.2 * m.xp);
  let gold = Math.round(active.minutes * 1.7 * m.gold);
  let chestBonus = 0;
  if (state.lastChestDate !== todayKey()) {
    state.lastChestDate = todayKey();
    chestBonus = 80;
    gold += chestBonus;
  }

  state.boss.hp = Math.max(0, state.boss.hp - damage);
  state.gold += gold;
  state.totalMinutes += active.minutes;
  state.totalSessions += 1;
  const leveled = addXp(xp);
  markFocusSessionDone(active.planId, active.sessionId);
  logRun(active.title, active.minutes, `-${damage} HP · +${xp} XP · +${gold} GOLD`);

  const defeated = state.boss.hp <= 0;
  impactUntil = performance.now() + 900;
  impactAmount = damage;
  showDamage(damage);
  if (defeated) spawnNextBoss();
  saveState();
  renderAll();
  tone(defeated ? 520 : 390, .11);
  setTimeout(() => tone(defeated ? 720 : 520, .12), 100);

  $('#rewardTitle').textContent = defeated ? '보스 격파' : `${active.minutes}분 원정 완료`;
  $('#rewardSummary').textContent = `${active.title} 완료. ${chestBonus ? '오늘의 보급 상자도 함께 열었습니다.' : leveled ? '레벨이 올랐습니다.' : '다음 원정을 이어가세요.'}`;
  $('#rewardDamage').textContent = damage;
  $('#rewardXp').textContent = `+${xp}`;
  $('#rewardGold').textContent = `+${gold}`;
  const dialog = $('#rewardDialog');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  selectedQuest = null;
  renderQuests();
}

function startTimerLoop() {
  stopTimerLoop();
  tickTimer();
  timerTick = setInterval(tickTimer, 250);
}

function stopTimerLoop() {
  if (timerTick) clearInterval(timerTick);
  timerTick = null;
}

function tickTimer() {
  if (!state.active) return;
  const remaining = state.active.endAt - Date.now();
  if (remaining <= 0) {
    finishFocus();
    return;
  }
  const totalSec = Math.ceil(remaining / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  $('#timerValue').textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  $('#timerEyebrow').textContent = 'EXPEDITION IN PROGRESS';
  $('#timerTitle').textContent = state.active.title;
}

function showDamage(amount) {
  const el = $('#damagePop');
  el.textContent = `-${amount}`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function renderHud() {
  $('#levelValue').textContent = state.level;
  $('#goldValue').textContent = state.gold.toLocaleString('ko-KR');
  $('#streakValue').textContent = state.streak;
  $('#levelLabel').textContent = `Level ${state.level}`;
  $('#xpLabel').textContent = `${state.xp} / ${xpNeeded()} XP`;
  $('#xpFill').style.width = `${clamp(state.xp / xpNeeded() * 100, 0, 100)}%`;
  $('#bossName').textContent = currentBossName();
  $('#stageNumber').textContent = `STAGE ${state.boss.stage}`;
  $('#bossHpFill').style.width = `${clamp(state.boss.hp / state.boss.maxHp * 100, 0, 100)}%`;
  $('#bossHpText').textContent = `${state.boss.hp.toLocaleString('ko-KR')} / ${state.boss.maxHp.toLocaleString('ko-KR')} HP`;
  $('#powerLabel').textContent = `POWER ${powerLabel()}x`;
  $('#soundBtn').textContent = state.sound ? 'SOUND ON' : 'SOUND OFF';
  $('#soundBtn').setAttribute('aria-pressed', state.sound ? 'true' : 'false');

  if (state.active) {
    $('#startBtn').classList.add('hidden');
    $('#stopBtn').classList.remove('hidden');
    $('#bossHint').textContent = '원정이 진행 중입니다';
  } else {
    $('#startBtn').classList.remove('hidden');
    $('#stopBtn').classList.add('hidden');
    $('#bossHint').textContent = '집중을 끝내면 피해를 줍니다';
  }
}

function renderShop() {
  $('#shopList').innerHTML = shopItems.map((item) => {
    const owned = state.owned.includes(item.id);
    const canBuy = state.gold >= item.price;
    return `<div class="shop-item"><div class="shop-icon" aria-hidden="true"></div><div class="shop-name">${item.name}</div><div class="shop-desc">${item.desc}</div><button class="shop-buy" type="button" data-shop="${item.id}" ${owned || !canBuy ? 'disabled' : ''}>${owned ? 'OWNED' : `${item.price} GOLD`}</button></div>`;
  }).join('');
  $('#shopList').querySelectorAll('[data-shop]').forEach((btn) => {
    btn.addEventListener('click', () => buyItem(btn.dataset.shop));
  });
}

function buyItem(id) {
  const item = shopItems.find((x) => x.id === id);
  if (!item || state.owned.includes(id) || state.gold < item.price) return;
  state.gold -= item.price;
  state.owned.push(id);
  saveState();
  renderAll();
  toast(`${item.name} 획득`);
  tone(620, .08);
}

function renderLog() {
  const el = $('#runLog');
  if (!state.log.length) {
    el.innerHTML = `<div class="log-item"><strong>첫 원정을 시작하세요</strong><span>기록 없음</span></div>`;
  } else {
    el.innerHTML = state.log.map((r) => `<div class="log-item"><div><strong>${escapeHtml(r.title)}</strong><div class="quest-meta">${escapeHtml(r.detail)}</div></div><span>${r.time}</span></div>`).join('');
  }
  const claimed = state.lastChestDate === todayKey();
  $('#dailyBox').classList.toggle('claimed', claimed);
  $('#dailyTitle').textContent = claimed ? '오늘의 보급 상자 획득 완료' : '오늘 첫 집중을 완료하세요';
  $('#dailyReward').textContent = claimed ? 'CLAIMED' : '+80 GOLD';
}

function renderAll() {
  renderHud();
  renderShop();
  renderLog();
  if (state.active) {
    $('#timerTitle').textContent = state.active.title;
    startTimerLoop();
  } else if (!selectedQuest) {
    setQuick(25);
  }
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 1700);
}

function tone(freq, seconds) {
  if (!state.sound) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.055, audioCtx.currentTime + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + seconds);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + seconds + .02);
  } catch {}
}

async function shareProgress() {
  const text = `Flow Quest · Level ${state.level} · 누적 집중 ${state.totalMinutes}분 · Stage ${state.boss.stage} · 연속 ${state.streak}일`;
  try {
    if (navigator.share) await navigator.share({ title: 'Flow Quest', text });
    else {
      await navigator.clipboard.writeText(text);
      toast('진행 상황을 복사했습니다');
    }
  } catch {}
}

// Canvas world
const canvas = $('#world');
const ctx = canvas.getContext('2d');
let cw = 0, ch = 0, dpr = 1;
const motes = Array.from({ length: 34 }, (_, i) => ({ x: Math.random(), y: Math.random(), s: .3 + Math.random() * 1.3, p: i * .71 }));

function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cw = r.width; ch = r.height;
  canvas.width = Math.max(1, Math.round(cw * dpr));
  canvas.height = Math.max(1, Math.round(ch * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function worldProgress() {
  if (!state.active) return .12;
  const total = Math.max(1, state.active.endAt - state.active.startedAt);
  return clamp((Date.now() - state.active.startedAt) / total, 0, 1);
}

function drawWorld(t) {
  if (!cw || !ch) resizeCanvas();
  const glassRoom = state.owned.includes('glass-room');
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, glassRoom ? '#1b2a3b' : '#111827');
  grad.addColorStop(.58, glassRoom ? '#13242b' : '#121823');
  grad.addColorStop(1, '#080b11');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // distant glow
  const rg = ctx.createRadialGradient(cw * .72, ch * .3, 10, cw * .72, ch * .3, cw * .48);
  rg.addColorStop(0, glassRoom ? 'rgba(117,229,202,.13)' : 'rgba(104,142,235,.17)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, cw, ch);

  // drifting particles
  ctx.save();
  for (const m of motes) {
    const x = (m.x * cw + Math.sin(t * .00018 + m.p) * 18 + cw) % cw;
    const y = (m.y * ch + (t * .009 * m.s)) % ch;
    ctx.globalAlpha = .18 + m.s * .08;
    ctx.fillStyle = glassRoom ? '#b7f2e2' : '#b9cdf8';
    ctx.beginPath(); ctx.arc(x, y, m.s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // horizon structures
  ctx.globalAlpha = .25;
  ctx.fillStyle = '#31415a';
  for (let i = 0; i < 8; i++) {
    const w = 20 + (i % 3) * 13;
    const h = 35 + ((i * 37) % 70);
    ctx.fillRect(i * (cw / 7) - 10, ch * .58 - h, w, h);
  }
  ctx.globalAlpha = 1;

  // floor platform
  const floorY = ch * .72;
  const floor = ctx.createLinearGradient(0, floorY, 0, ch);
  floor.addColorStop(0, 'rgba(116,141,181,.24)');
  floor.addColorStop(.03, 'rgba(255,255,255,.08)');
  floor.addColorStop(1, 'rgba(4,6,10,.88)');
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(cw * .07, floorY);
  ctx.lineTo(cw * .93, floorY);
  ctx.lineTo(cw, ch);
  ctx.lineTo(0, ch);
  ctx.closePath(); ctx.fill();

  const p = worldProgress();
  const heroX = cw * (.21 + p * .31);
  const heroY = floorY - 12;
  const bob = Math.sin(t * .007) * (state.active ? 3 : 1.8);
  drawHero(heroX, heroY + bob, t);
  drawBoss(cw * .78, floorY - 18, t);

  if (state.active) {
    // expedition trail
    ctx.save();
    ctx.strokeStyle = 'rgba(157,188,248,.26)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(cw * .2, floorY + 12); ctx.lineTo(cw * .72, floorY + 12); ctx.stroke();
    ctx.restore();
  }

  if (performance.now() < impactUntil) {
    ctx.save();
    const a = clamp((impactUntil - performance.now()) / 900, 0, 1);
    ctx.globalAlpha = a * .24;
    ctx.fillStyle = '#ffd38b';
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }

  requestAnimationFrame(drawWorld);
}

function drawHero(x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const active = !!state.active;
  if (active) ctx.rotate(Math.sin(t * .011) * .025);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, 13, 24, 7, 0, 0, Math.PI * 2); ctx.fill();
  // cape
  ctx.fillStyle = state.owned.includes('warden-cloak') ? '#6377b6' : '#35415f';
  ctx.beginPath(); ctx.moveTo(-12, -43); ctx.lineTo(-23, 7); ctx.lineTo(7, 0); ctx.lineTo(12, -38); ctx.closePath(); ctx.fill();
  // body
  ctx.fillStyle = '#aabce8';
  roundRect(-11, -42, 22, 38, 7); ctx.fill();
  // head
  ctx.fillStyle = '#dbe5fb';
  ctx.beginPath(); ctx.arc(0, -56, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c273d';
  ctx.fillRect(2, -58, 9, 3);
  // weapon
  ctx.strokeStyle = state.owned.includes('steel-edge') ? '#e6efff' : '#8796b6';
  ctx.lineWidth = state.owned.includes('steel-edge') ? 4 : 3;
  ctx.beginPath(); ctx.moveTo(9, -30); ctx.lineTo(31, -59); ctx.stroke();
  ctx.strokeStyle = '#64718d'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(4, -36); ctx.lineTo(16, -28); ctx.stroke();
  ctx.restore();
}

function drawBoss(x, y, t) {
  ctx.save();
  const shake = performance.now() < impactUntil ? Math.sin(t * .09) * 7 : 0;
  ctx.translate(x + shake, y + Math.sin(t * .003) * 4);
  const stageScale = 1 + Math.min(state.boss.stage, 10) * .015;
  ctx.scale(stageScale, stageScale);
  ctx.fillStyle = 'rgba(0,0,0,.42)';
  ctx.beginPath(); ctx.ellipse(0, 20, 46, 12, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(-30, -95, 30, 15);
  g.addColorStop(0, '#773d57'); g.addColorStop(.6, '#3c3148'); g.addColorStop(1, '#222634');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-36, 9); ctx.lineTo(-26, -63); ctx.lineTo(-11, -86); ctx.lineTo(10, -86); ctx.lineTo(29, -59); ctx.lineTo(37, 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#191d28';
  ctx.beginPath(); ctx.arc(0, -73, 25, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffb0a5';
  ctx.fillRect(-14, -77, 9, 4); ctx.fillRect(6, -77, 9, 4);
  ctx.strokeStyle = 'rgba(255,155,142,.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -72, 34 + Math.sin(t * .004) * 3, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function bindEvents() {
  $('#startBtn').addEventListener('click', startFocus);
  $('#stopBtn').addEventListener('click', stopFocus);
  $('#refreshQuests').addEventListener('click', () => { selectedQuest = null; renderQuests(); toast('퀘스트를 다시 불러왔습니다'); });
  document.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => setQuick(Number(b.dataset.quick))));
  $('#shareBtn').addEventListener('click', shareProgress);
  $('#rewardShareBtn').addEventListener('click', shareProgress);
  $('#continueBtn').addEventListener('click', () => $('#rewardDialog').close());
  $('#soundBtn').addEventListener('click', () => { state.sound = !state.sound; saveState(); renderHud(); if (state.sound) tone(440, .05); });
  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.active) tickTimer(); });
}

function boot() {
  if (!state.boss?.maxHp) state.boss = defaultState().boss;
  bindEvents();
  renderQuests();
  renderAll();
  resizeCanvas();
  requestAnimationFrame(drawWorld);
  if (state.active) {
    if (Date.now() >= state.active.endAt) finishFocus();
    else startTimerLoop();
  }
}

boot();
