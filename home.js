import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://eicwcohfrvhwimwevzkd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-9Cf0yVjLWf88pcvAqQ-EQ_YN9v3Obz';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (s) => document.querySelector(s);
const THEME_KEY = 'flow-theme-v1';
const QUEST_KEY = 'flow-quest-state-v1';
const themes = ['system', 'light', 'dark'];
let authMode = 'signin';
let currentUser = null;
let currentProfile = null;

function safeJson(key, fallback = {}) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function applyTheme(theme) {
  const value = themes.includes(theme) ? theme : 'system';
  document.documentElement.dataset.theme = value;
  localStorage.setItem(THEME_KEY, value);
  $('#themeLabel').textContent = value.toUpperCase();
  const color = value === 'dark' ? '#080b11' : value === 'light' ? '#edf1f6' : '';
  if (color) document.querySelector('meta[name="theme-color"]').setAttribute('content', color);
}

function cycleTheme() {
  const now = document.documentElement.dataset.theme || 'system';
  applyTheme(themes[(themes.indexOf(now) + 1) % themes.length]);
}

function renderLocalSnapshot() {
  const q = safeJson(QUEST_KEY, {});
  $('#levelValue').textContent = Number(q.level) || 1;
  $('#streakValue').textContent = Number(q.streak) || 0;
  let todayMinutes = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const row of Array.isArray(q.log) ? q.log : []) {
    if (row?.date === today) todayMinutes += Number(row.minutes) || 0;
  }
  $('#todayMinutes').textContent = `${todayMinutes}m`;
}

function renderGreeting() {
  const h = new Date().getHours();
  const prefix = h < 6 ? '아직 안 잤다면,' : h < 12 ? '좋은 아침.' : h < 18 ? '오늘도 이어서.' : '좋은 밤.';
  const name = currentProfile?.nickname || '';
  $('#greeting').textContent = name ? `${prefix} ${name}` : `${prefix} 할 일을 고르세요.`;
}

function initials(value = 'F') {
  const clean = String(value).trim();
  return clean ? clean.slice(0, 1).toUpperCase() : 'F';
}

async function loadProfile(user = currentUser) {
  if (!user) { currentProfile = null; renderAccount(); renderGreeting(); return; }
  const { data, error } = await supabase.from('flow_profiles').select('nickname,theme').eq('user_id', user.id).maybeSingle();
  if (!error && data) {
    currentProfile = data;
    if (!localStorage.getItem(THEME_KEY) && themes.includes(data.theme)) applyTheme(data.theme);
  }
  renderAccount();
  renderGreeting();
}

function renderAccount() {
  if (!currentUser) {
    $('#accountLabel').textContent = '로그인';
    $('#accountAvatar').textContent = 'F';
    return;
  }
  const nick = currentProfile?.nickname || currentUser.email?.split('@')[0] || 'Flow';
  $('#accountLabel').textContent = nick;
  $('#accountAvatar').textContent = initials(nick);
  $('#nicknameInput').value = currentProfile?.nickname || '';
}

function setStatus(target, message = '', error = false) {
  const el = $(target);
  el.textContent = message;
  el.classList.toggle('error', error);
}

function openAccount() {
  if (currentUser) $('#profileDialog').showModal();
  else $('#authDialog').showModal();
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  $('#authTitle').textContent = signup ? '계정 만들기' : '로그인';
  $('#authSubmit').textContent = signup ? '계정 만들기' : '로그인';
  $('#authModeBtn').textContent = signup ? '이미 계정이 있다면 로그인' : '처음이라면 계정 만들기';
  $('#authPassword').setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
  setStatus('#authStatus');
}

async function submitAuth() {
  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  if (!email || password.length < 6) return setStatus('#authStatus', '이메일과 6자 이상 비밀번호를 확인하세요.', true);
  $('#authSubmit').disabled = true;
  setStatus('#authStatus', '처리 중…');
  try {
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (authMode === 'signup' && !result.data.session) {
      setStatus('#authStatus', '가입됨. 이메일 확인이 켜져 있다면 메일의 확인 링크를 눌러주세요.');
      return;
    }
    $('#authDialog').close();
    setStatus('#authStatus');
  } catch (err) {
    setStatus('#authStatus', err?.message || '로그인에 실패했습니다.', true);
  } finally {
    $('#authSubmit').disabled = false;
  }
}

async function saveProfile() {
  if (!currentUser) return;
  const nickname = $('#nicknameInput').value.trim();
  if (nickname.length < 2 || nickname.length > 16) return setStatus('#profileStatus', '닉네임은 2~16자로 입력하세요.', true);
  const theme = document.documentElement.dataset.theme || 'system';
  $('#saveProfileBtn').disabled = true;
  const { error } = await supabase.from('flow_profiles').update({ nickname, theme, updated_at: new Date().toISOString() }).eq('user_id', currentUser.id);
  $('#saveProfileBtn').disabled = false;
  if (error) return setStatus('#profileStatus', error.message || '저장에 실패했습니다.', true);
  currentProfile = { ...(currentProfile || {}), nickname, theme };
  renderAccount(); renderGreeting();
  setStatus('#profileStatus', '저장했습니다.');
}

async function signOut() {
  await supabase.auth.signOut();
  $('#profileDialog').close();
}

async function loadLeaderboardPreview() {
  const preview = $('#rankPreview');
  const { data: scores, error } = await supabase.from('flow_quest_scores').select('user_id,total_xp').order('total_xp', { ascending: false }).limit(3);
  if (error || !scores?.length) {
    preview.innerHTML = '<div class="rank-row"><span class="rank-pos">—</span><span>첫 기록을 기다리는 중</span><span class="rank-xp">0 XP</span></div>';
    return;
  }
  const ids = scores.map((x) => x.user_id);
  const { data: profiles } = await supabase.from('flow_profiles').select('user_id,nickname').in('user_id', ids);
  const names = new Map((profiles || []).map((p) => [p.user_id, p.nickname]));
  preview.innerHTML = scores.map((row, i) => `<div class="rank-row"><span class="rank-pos">${i + 1}</span><span>${escapeHtml(names.get(row.user_id) || 'Player')}</span><span class="rank-xp">${Number(row.total_xp).toLocaleString('ko-KR')} XP</span></div>`).join('');
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function bind() {
  $('#themeBtn').addEventListener('click', cycleTheme);
  $('#accountBtn').addEventListener('click', openAccount);
  $('#authModeBtn').addEventListener('click', () => setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));
  $('#authSubmit').addEventListener('click', submitAuth);
  $('#saveProfileBtn').addEventListener('click', saveProfile);
  $('#signOutBtn').addEventListener('click', signOut);
  $('#schoolPreviewBtn').addEventListener('click', () => $('#schoolDialog').showModal());
}

applyTheme(localStorage.getItem(THEME_KEY) || 'system');
renderLocalSnapshot();
bind();
setAuthMode('signin');

const { data: sessionData } = await supabase.auth.getSession();
currentUser = sessionData.session?.user || null;
await loadProfile();
await loadLeaderboardPreview();

supabase.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user || null;
  await loadProfile();
  if (currentUser) $('#authDialog')?.open && $('#authDialog').close();
});
