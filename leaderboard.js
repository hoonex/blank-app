import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://eicwcohfrvhwimwevzkd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-9Cf0yVjLWf88pcvAqQ-EQ_YN9v3Obz';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (s) => document.querySelector(s);
const themes = ['system','light','dark'];
const THEME_KEY = 'flow-theme-v1';
let scope = new URLSearchParams(location.search).get('scope') === 'all' ? 'all' : 'weekly';

function applyTheme(theme){const value=themes.includes(theme)?theme:'system';document.documentElement.dataset.theme=value;localStorage.setItem(THEME_KEY,value);$('#themeLabel').textContent=value.toUpperCase()}
function cycleTheme(){const now=document.documentElement.dataset.theme||'system';applyTheme(themes[(themes.indexOf(now)+1)%themes.length])}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function mark(name='P'){return String(name).trim().slice(0,1).toUpperCase()||'P'}
function setScopeUi(){
  document.querySelectorAll('[data-scope]').forEach((button)=>button.classList.toggle('active',button.dataset.scope===scope));
  $('#arenaModeLabel').textContent=scope==='weekly'?'WEEKLY ARENA':'ALL-TIME ARENA';
  $('#arenaDescription').textContent=scope==='weekly'
    ? '매주 월요일 00:00 KST부터 서버가 검증한 완료 세션 XP만 합산합니다. 이번 주 공부량으로 다시 경쟁할 수 있습니다.'
    : '가입 이후 서버가 검증한 모든 완료 세션의 누적 XP를 비교합니다.';
}

async function loadWeekly(me){
  const { data, error } = await supabase.rpc('flow_weekly_leaderboard',{p_limit:50});
  if(error) throw error;
  return (data||[]).map((row)=>({
    user_id:row.user_id,
    nickname:row.nickname||'Player',
    xp:Number(row.weekly_xp)||0,
    minutes:Number(row.weekly_minutes)||0,
    sessions:Number(row.completed_sessions)||0,
    rank:Number(row.rank_position)||0,
    me:row.user_id===me,
    week_start:row.week_start
  }));
}

async function loadAllTime(me){
  const { data: scores, error } = await supabase.from('flow_quest_scores')
    .select('user_id,total_xp,total_minutes,completed_sessions,level,updated_at')
    .gt('total_xp',0)
    .order('total_xp',{ascending:false})
    .order('total_minutes',{ascending:false})
    .limit(50);
  if(error) throw error;
  if(!scores?.length) return [];
  const ids=scores.map(x=>x.user_id);
  const { data: profiles } = await supabase.from('flow_profiles').select('user_id,nickname').in('user_id',ids);
  const names=new Map((profiles||[]).map(p=>[p.user_id,p.nickname]));
  return scores.map((row,i)=>({
    user_id:row.user_id,
    nickname:names.get(row.user_id)||'Player',
    xp:Number(row.total_xp)||0,
    minutes:Number(row.total_minutes)||0,
    sessions:Number(row.completed_sessions)||0,
    rank:i+1,
    me:row.user_id===me
  }));
}

function renderRows(rows){
  if(!rows.length){
    $('#boardRows').innerHTML=`<div class="empty">${scope==='weekly'?'이번 주 서버 검증 완료 기록이 아직 없습니다.':'아직 서버 검증 누적 기록이 없습니다.'} 로그인 후 첫 원정을 완료하면 여기에 나타납니다.</div>`;
    return;
  }
  $('#boardRows').innerHTML=rows.map((row)=>`<div class="board-row${row.me?' me':''}"><span class="position">${row.rank}</span><span class="player"><span class="player-mark">${esc(mark(row.nickname))}</span><span>${esc(row.nickname)}${row.me?' · 나':''}<small>${row.sessions.toLocaleString('ko-KR')} sessions</small></span></span><span class="xp">${row.xp.toLocaleString('ko-KR')} XP</span><span class="minutes">${row.minutes.toLocaleString('ko-KR')}분</span></div>`).join('');
}

async function loadBoard(){
  $('#boardRows').innerHTML='<div class="empty">순위를 불러오는 중…</div>';
  const { data: sessionData } = await supabase.auth.getSession();
  const me = sessionData.session?.user?.id || null;
  try{
    const rows=scope==='weekly'?await loadWeekly(me):await loadAllTime(me);
    renderRows(rows);
  }catch(error){
    console.error(error);
    $('#boardRows').innerHTML='<div class="empty">리더보드를 불러오지 못했습니다.</div>';
  }
}

function changeScope(next){
  if(next!== 'weekly' && next!=='all') return;
  scope=next;
  const url=new URL(location.href);
  if(scope==='weekly') url.searchParams.delete('scope'); else url.searchParams.set('scope','all');
  history.replaceState({},'',url);
  setScopeUi();
  loadBoard();
}

applyTheme(localStorage.getItem(THEME_KEY)||'system');
$('#themeBtn').addEventListener('click',cycleTheme);
document.querySelectorAll('[data-scope]').forEach((button)=>button.addEventListener('click',()=>changeScope(button.dataset.scope)));
setScopeUi();
await loadBoard();
