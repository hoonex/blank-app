import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://eicwcohfrvhwimwevzkd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-9Cf0yVjLWf88pcvAqQ-EQ_YN9v3Obz';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (s) => document.querySelector(s);
const themes = ['system','light','dark'];
const THEME_KEY = 'flow-theme-v1';

function applyTheme(theme){const value=themes.includes(theme)?theme:'system';document.documentElement.dataset.theme=value;localStorage.setItem(THEME_KEY,value);$('#themeLabel').textContent=value.toUpperCase()}
function cycleTheme(){const now=document.documentElement.dataset.theme||'system';applyTheme(themes[(themes.indexOf(now)+1)%themes.length])}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function mark(name='P'){return String(name).trim().slice(0,1).toUpperCase()||'P'}

async function loadBoard(){
  const { data: sessionData } = await supabase.auth.getSession();
  const me = sessionData.session?.user?.id || null;
  const { data: scores, error } = await supabase.from('flow_quest_scores')
    .select('user_id,total_xp,total_minutes,completed_sessions,level,updated_at')
    .gt('total_xp',0)
    .order('total_xp',{ascending:false})
    .order('total_minutes',{ascending:false})
    .limit(50);
  if(error){$('#boardRows').innerHTML='<div class="empty">리더보드를 불러오지 못했습니다.</div>';return}
  if(!scores?.length){$('#boardRows').innerHTML='<div class="empty">아직 서버 검증 기록이 없습니다. 로그인 후 첫 원정을 완료하면 여기에 나타납니다.</div>';return}
  const ids=scores.map(x=>x.user_id);
  const { data: profiles } = await supabase.from('flow_profiles').select('user_id,nickname').in('user_id',ids);
  const names=new Map((profiles||[]).map(p=>[p.user_id,p.nickname]));
  $('#boardRows').innerHTML=scores.map((row,i)=>{
    const name=names.get(row.user_id)||'Player';
    return `<div class="board-row${row.user_id===me?' me':''}"><span class="position">${i+1}</span><span class="player"><span class="player-mark">${esc(mark(name))}</span><span>${esc(name)}${row.user_id===me?' · 나':''}</span></span><span class="xp">${Number(row.total_xp).toLocaleString('ko-KR')} XP</span><span class="minutes">${Number(row.total_minutes).toLocaleString('ko-KR')}분</span></div>`
  }).join('');
}

applyTheme(localStorage.getItem(THEME_KEY)||'system');
$('#themeBtn').addEventListener('click',cycleTheme);
await loadBoard();
