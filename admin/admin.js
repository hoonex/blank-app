const SUPABASE_URL='https://eicwcohfrvhwimwevzkd.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_-9Cf0yVjLWf88pcvAqQ-EQ_YN9v3Obz';
const ADMIN_EDGE=`${SUPABASE_URL}/functions/v1/flow-admin`;
const SESSION_KEY='flow-admin-session-v2';
const LEGACY_SESSION_KEY='flow-admin-session-v1';
const PENDING_EMAIL_KEY='flow-admin-pending-email';
const LOGIN_REQUEST_KEY='flow-admin-login-requested-at-v1';
const $=(s)=>document.querySelector(s);

const state={token:'',refreshToken:'',expiresAt:0,email:'',overview:null,busy:false};

function setStatus(message,error=false){const el=$('#authStatus');el.textContent=message||'';el.style.color=error?'var(--bad)':'var(--muted)'}
function number(value){return new Intl.NumberFormat('ko-KR').format(Number(value||0))}
function when(value){if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)}
function duration(ms){const n=Number(ms||0);return n>=1000?`${(n/1000).toFixed(1)}s`:`${n}ms`}
function safeText(v){return String(v??'')}
function escapeHtml(v){return safeText(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function decodeJwt(token){try{const part=String(token||'').split('.')[1];if(!part)return{};const normalized=part.replace(/-/g,'+').replace(/_/g,'/');const padded=normalized+'='.repeat((4-normalized.length%4)%4);const bytes=Uint8Array.from(atob(padded),c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}catch{return{}}}
function tokenExpiresAt(token){const exp=Number(decodeJwt(token)?.exp||0);return exp>0?exp*1000:0}
function tokenEmail(token){return String(decodeJwt(token)?.email||'')}

function saveSession(session,email=''){
  const accessToken=String(session?.access_token||session?.token||'');
  if(!accessToken)return false;
  const refreshToken=String(session?.refresh_token||state.refreshToken||'');
  const explicitExpiresAt=Number(session?.expires_at||0);
  const expiresIn=Number(session?.expires_in||0);
  const expiresAt=explicitExpiresAt>0?explicitExpiresAt*1000:(expiresIn>0?Date.now()+expiresIn*1000:tokenExpiresAt(accessToken));
  const resolvedEmail=String(email||session?.user?.email||tokenEmail(accessToken)||state.email||'');
  state.token=accessToken;
  state.refreshToken=refreshToken;
  state.expiresAt=expiresAt;
  state.email=resolvedEmail;
  localStorage.setItem(SESSION_KEY,JSON.stringify({accessToken,refreshToken,expiresAt,email:resolvedEmail}));
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
  if(resolvedEmail)localStorage.removeItem(PENDING_EMAIL_KEY);
  return true;
}
function clearSession(){
  state.token='';state.refreshToken='';state.expiresAt=0;state.email='';state.overview=null;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
}
function restoreSession(){
  try{
    const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
    if(saved?.accessToken){
      state.token=String(saved.accessToken);
      state.refreshToken=String(saved.refreshToken||'');
      state.expiresAt=Number(saved.expiresAt||tokenExpiresAt(saved.accessToken)||0);
      state.email=String(saved.email||tokenEmail(saved.accessToken)||'');
      return true;
    }
  }catch{}
  try{
    const legacy=JSON.parse(sessionStorage.getItem(LEGACY_SESSION_KEY)||'null');
    if(legacy?.token){
      state.token=String(legacy.token);
      state.expiresAt=tokenExpiresAt(legacy.token);
      state.email=String(legacy.email||tokenEmail(legacy.token)||'');
      return true;
    }
  }catch{}
  return false;
}
function consumeMagicLink(){
  const params=new URLSearchParams(location.hash.replace(/^#/,''));
  const error=params.get('error_description')||params.get('error')||'';
  const accessToken=params.get('access_token')||'';
  if(accessToken){
    saveSession({
      access_token:accessToken,
      refresh_token:params.get('refresh_token')||'',
      expires_in:Number(params.get('expires_in')||0),
      expires_at:Number(params.get('expires_at')||0)
    },localStorage.getItem(PENDING_EMAIL_KEY)||'');
    history.replaceState(null,'',location.pathname+location.search);
    return {authenticated:true,error:''};
  }
  if(error){
    history.replaceState(null,'',location.pathname+location.search);
    return {authenticated:false,error};
  }
  return {authenticated:false,error:''};
}

async function authFetch(path,init={}){
  const headers=new Headers(init.headers||{});
  headers.set('apikey',PUBLISHABLE_KEY);
  if(init.body)headers.set('content-type','application/json');
  return fetch(`${SUPABASE_URL}${path}`,{...init,headers,cache:'no-store'});
}
async function refreshSession(){
  if(!state.refreshToken)return false;
  try{
    const response=await authFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:state.refreshToken})});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body?.access_token){clearSession();return false}
    saveSession(body,state.email);
    return true;
  }catch{
    return false;
  }
}
async function ensureSession(){
  if(!state.token)return false;
  const expiresSoon=state.expiresAt>0&&state.expiresAt<=Date.now()+60_000;
  if(expiresSoon&&state.refreshToken)return refreshSession();
  if(expiresSoon&&!state.refreshToken){clearSession();return false}
  return true;
}
async function adminFetch(action='overview',init={},retry=true){
  if(!(await ensureSession()))throw new Error('AUTH_REQUIRED');
  const headers=new Headers(init.headers||{});
  headers.set('apikey',PUBLISHABLE_KEY);
  headers.set('authorization',`Bearer ${state.token}`);
  if(init.body)headers.set('content-type','application/json');
  const url=`${ADMIN_EDGE}?action=${encodeURIComponent(action)}${action==='overview'?`&hours=${encodeURIComponent($('#windowSelect')?.value||24)}`:''}`;
  const response=await fetch(url,{...init,headers,cache:'no-store'});
  if(response.status===401&&retry&&state.refreshToken&&await refreshSession())return adminFetch(action,init,false);
  return response;
}

async function requestLogin(email){
  const recent=Number(localStorage.getItem(LOGIN_REQUEST_KEY)||0);
  if(recent&&Date.now()-recent<60_000)throw new Error('방금 로그인 메일을 보냈습니다. 받은 메일을 사용하세요. 새로 요청할 필요가 없습니다.');
  const redirect=`${location.origin}/admin/`;
  const response=await authFetch(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',body:JSON.stringify({email,create_user:false})});
  if(!response.ok){
    if(response.status===429)localStorage.setItem(LOGIN_REQUEST_KEY,String(Date.now()));
    throw new Error(response.status===429?'Supabase 메일 요청 제한에 걸렸습니다. 잠시 뒤 딱 한 번만 다시 요청하면 됩니다.':'등록된 관리자 계정인지 확인하세요.');
  }
  state.email=email;
  localStorage.setItem(PENDING_EMAIL_KEY,email);
  localStorage.setItem(LOGIN_REQUEST_KEY,String(Date.now()));
}

function showLogin(message=''){
  $('#loginPanel').classList.remove('hidden');
  $('#dashboard').classList.add('hidden');
  $('#signOutBtn').classList.add('hidden');
  $('#accessPill').textContent='Locked';
  if(message)setStatus(message,true);
}
function showDashboard(admin){
  $('#loginPanel').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
  $('#signOutBtn').classList.remove('hidden');
  $('#accessPill').textContent=admin?.email||state.email||'Authorized';
}

function renderTimeline(items=[]){
  const el=$('#timeline');el.innerHTML='';
  if(!items.length){el.innerHTML='<div class="empty">이 기간의 활동 데이터가 없습니다.</div>';return}
  const max=Math.max(...items.map(x=>Number(x.count||0)),1);
  for(const item of items){
    const bar=document.createElement('div');bar.className='timeline-bar';
    bar.style.height=`${Math.max(4,Math.round(Number(item.count||0)/max*100))}%`;
    bar.dataset.label=`${when(item.hour)} · ${number(item.count)}`;
    el.append(bar);
  }
}

function renderTop(items=[]){const el=$('#topEvents');if(!items.length){el.innerHTML='<div class="empty">집계된 이벤트가 없습니다.</div>';return}el.innerHTML=items.map(x=>`<div class="rank-row"><span title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</span><strong>${number(x.count)}</strong></div>`).join('')}
function healthClass(status){if(status>=200&&status<400)return'status-good';if(status===429||status===599)return'status-warn';return'status-bad'}
function renderProbes(items=[]){
  const el=$('#probeList');if(!items.length){el.innerHTML='<div class="empty">아직 API 상태 검사를 실행하지 않았습니다.</div>';$('#healthScore').textContent='—';$('#healthCaption').textContent='아직 검사 없음';return}
  const latest=new Map();for(const p of items){if(!latest.has(p.service))latest.set(p.service,p)}const rows=[...latest.values()];const ok=rows.filter(x=>x.ok).length;
  $('#healthScore').textContent=`${ok}/${rows.length}`;$('#healthCaption').textContent=ok===rows.length?'정상':`${rows.length-ok}개 확인 필요`;
  $('#probeMeta').textContent=`최근 ${items.length}건`;
  el.innerHTML=items.slice(0,12).map(p=>`<div class="health-row"><span class="service">${escapeHtml(p.service)}</span><span class="health-action">${escapeHtml(p.action)}</span><strong class="${healthClass(Number(p.status))}">${Number(p.status)===599?'TIMEOUT':escapeHtml(p.status)}</strong><span class="health-time">${duration(p.durationMs)} · ${when(p.checkedAt)}</span></div>`).join('');
}

function render(body){
  const o=body?.overview||{};state.overview=o;showDashboard(body?.admin||{});const a=o.activity||{};
  $('#generatedAt').textContent=`생성 ${when(o.generatedAt)}`;$('#totalEvents').textContent=number(a.totalEvents);$('#uniqueAnonymous').textContent=number(a.uniqueAnonymous);$('#registeredProfiles').textContent=number(a.registeredProfiles);$('#windowLabel').textContent=`최근 ${o.windowHours||24}시간`;$('#activityMeta').textContent=`${number(a.totalEvents)} events`;
  renderTimeline(a.hourly||[]);renderTop(a.topEvents||[]);renderProbes(o.probes||[]);
}

async function loadOverview(){
  if(!state.token)return showLogin();
  try{
    const response=await adminFetch('overview');
    const body=await response.json().catch(()=>({}));
    if(response.status===401){clearSession();return showLogin('관리자 세션이 종료되었습니다. 다시 한 번만 로그인해 주세요.')}
    if(response.status===403){clearSession();return showLogin('이 계정은 Flow 관리자 allowlist에 없습니다.')}
    if(!response.ok)throw new Error(body?.error||`HTTP ${response.status}`);
    render(body);
  }catch(error){
    if(error?.message==='AUTH_REQUIRED')return showLogin('관리자 세션이 종료되었습니다. 다시 한 번만 로그인해 주세요.');
    showLogin(`관리자 데이터를 불러오지 못했습니다: ${error.message||error}`);
  }
}

async function runProbe(){
  if(state.busy)return;state.busy=true;const btn=$('#probeBtn');btn.disabled=true;btn.textContent='검사 중';
  try{const response=await adminFetch('probe',{method:'POST'});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error||`HTTP ${response.status}`);render({admin:{email:state.email||'Authorized'},overview:body.overview})}catch(error){alert(`API 상태 검사를 완료하지 못했습니다: ${error.message||error}`)}finally{state.busy=false;btn.disabled=false;btn.textContent='API 상태 검사'}
}
async function signOut(){
  const token=state.token;
  if(token){try{await authFetch('/auth/v1/logout',{method:'POST',headers:{authorization:`Bearer ${token}`}})}catch{}}
  clearSession();showLogin();setStatus('이 기기의 관리자 세션을 종료했습니다.');
}

$('#emailForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const email=$('#emailInput').value.trim();if(!email)return;
  const btn=e.submitter||$('#emailForm button[type="submit"]');
  btn.disabled=true;setStatus('로그인 메일을 요청하는 중…');
  try{await requestLogin(email);setStatus('메일을 보냈습니다. 이 기기에서는 이번 한 번만 링크를 누르면 이후 자동 로그인됩니다.')}
  catch(error){setStatus(error.message||String(error),true)}
  finally{btn.disabled=false}
});
$('#refreshBtn').addEventListener('click',loadOverview);
$('#windowSelect').addEventListener('change',loadOverview);
$('#probeBtn').addEventListener('click',runProbe);
$('#signOutBtn').addEventListener('click',signOut);
window.addEventListener('hashchange',()=>{
  const result=consumeMagicLink();
  if(result.authenticated)loadOverview();
  else if(result.error)showLogin('로그인 링크가 만료되었거나 이미 사용되었습니다. 새 링크는 한 번만 요청해 주세요.');
});

const linkResult=consumeMagicLink();
restoreSession();
if(state.email)$('#emailInput').value=state.email;
if(state.token)loadOverview();
else showLogin(linkResult.error?'로그인 링크가 만료되었거나 이미 사용되었습니다. 새 링크는 한 번만 요청해 주세요.':'');
