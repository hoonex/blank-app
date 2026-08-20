const SUPABASE_URL='https://eicwcohfrvhwimwevzkd.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_-9Cf0yVjLWf88pcvAqQ-EQ_YN9v3Obz';
const ADMIN_EDGE=`${SUPABASE_URL}/functions/v1/flow-admin`;
const SESSION_KEY='flow-admin-session-v2';
const LEGACY_SESSION_KEY='flow-admin-session-v1';
const $=(s)=>document.querySelector(s);

const state={token:'',refreshToken:'',expiresAt:0,email:'',overview:null,busy:false,setupToken:''};

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

function consumeSetupToken(){
  const params=new URLSearchParams(location.search);
  const token=String(params.get('setup')||'').trim();
  if(!token)return'';
  params.delete('setup');
  const clean=params.toString();
  history.replaceState(null,'',location.pathname+(clean?`?${clean}`:'')+location.hash);
  return token;
}

function consumeAuthFragment(){
  const params=new URLSearchParams(location.hash.replace(/^#/,''));
  const error=params.get('error_description')||params.get('error')||'';
  const accessToken=params.get('access_token')||'';
  if(accessToken){
    saveSession({
      access_token:accessToken,
      refresh_token:params.get('refresh_token')||'',
      expires_in:Number(params.get('expires_in')||0),
      expires_at:Number(params.get('expires_at')||0)
    });
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
async function signInWithPassword(username,password){
  const response=await fetch(`${ADMIN_EDGE}?action=login`,{
    method:'POST',
    headers:{'apikey':PUBLISHABLE_KEY,'content-type':'application/json'},
    body:JSON.stringify({username,password}),
    cache:'no-store'
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body?.access_token){
    if(response.status===400||response.status===401)throw new Error('아이디 또는 비밀번호가 맞지 않습니다.');
    if(response.status===429)throw new Error('로그인 시도가 너무 많습니다. 잠시 뒤 다시 시도하세요.');
    throw new Error(body?.error||`로그인 실패 (HTTP ${response.status})`);
  }
  saveSession(body,body?.user?.email||'');
  return true;
}

async function bootstrapPassword(token,password){
  const response=await fetch(`${ADMIN_EDGE}?action=bootstrap-password`,{
    method:'POST',headers:{'apikey':PUBLISHABLE_KEY,'content-type':'application/json'},
    body:JSON.stringify({token,password}),cache:'no-store'
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    if(response.status===410)throw new Error('이 설정 링크는 만료되었거나 이미 사용되었습니다.');
    if(response.status===400)throw new Error(body?.error||'비밀번호는 10자 이상으로 설정해 주세요.');
    throw new Error(body?.error||`비밀번호 설정 실패 (HTTP ${response.status})`);
  }
  return body;
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

function showSetup(){
  $('#loginPanel').classList.remove('hidden');$('#dashboard').classList.add('hidden');$('#signOutBtn').classList.add('hidden');$('#accessPill').textContent='Setup';
  $('#passwordForm').classList.add('hidden');$('#setupForm').classList.remove('hidden');$('#setupHint').classList.remove('hidden');
  setStatus('새 Flow 관리자 비밀번호를 정해 주세요.');
}
function showLogin(message=''){
  $('#passwordForm').classList.remove('hidden');$('#setupForm').classList.add('hidden');$('#setupHint').classList.add('hidden');
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
  $('#accessPill').textContent=admin?.loginName||'flowadmin';
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
function inventoryStateClass(state){return state==='healthy'||state==='connected'||state==='configured'?'status-good':state==='degraded'?'status-warn':'status-good'}
function renderInventory(items=[]){
  const el=$('#inventoryList');
  $('#inventoryMeta').textContent=`${items.length} connected`;
  if(!items.length){el.innerHTML='<div class="empty">연결 서비스 목록이 없습니다.</div>';return}
  const order=['Runtime','Infrastructure','Operations','External'];
  const groups=new Map(order.map(x=>[x,[]]));
  for(const item of items){const group=groups.get(item.group)||groups.get('External');group.push(item)}
  el.innerHTML=order.filter(g=>groups.get(g).length).map(group=>`<div class="inventory-group"><div class="inventory-group-title">${escapeHtml(group.toUpperCase())}</div>${groups.get(group).map(item=>`<div class="integration-row"><div class="integration-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.via||item.type||'')}</small></div><div class="integration-purpose">${escapeHtml(item.purpose||'')}</div><span class="integration-state ${inventoryStateClass(item.state)}">${escapeHtml((item.state||'connected').toUpperCase())}</span></div>`).join('')}</div>`).join('');
}

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
  renderTimeline(a.hourly||[]);renderTop(a.topEvents||[]);renderInventory(o.inventory||[]);renderProbes(o.probes||[]);
}

async function loadOverview(){
  if(!state.token)return showLogin();
  try{
    const response=await adminFetch('overview');
    const body=await response.json().catch(()=>({}));
    if(response.status===401){clearSession();return showLogin('관리자 세션이 종료되었습니다. 다시 로그인해 주세요.')}
    if(response.status===403){clearSession();return showLogin('이 계정은 Flow 관리자 allowlist에 없습니다.')}
    if(!response.ok)throw new Error(body?.error||`HTTP ${response.status}`);
    render(body);
  }catch(error){
    if(error?.message==='AUTH_REQUIRED')return showLogin('관리자 세션이 종료되었습니다. 다시 로그인해 주세요.');
    showLogin(`관리자 데이터를 불러오지 못했습니다: ${error.message||error}`);
  }
}
async function runProbe(){
  if(state.busy)return;state.busy=true;const btn=$('#probeBtn');btn.disabled=true;btn.textContent='검사 중';
  try{const response=await adminFetch('probe',{method:'POST'});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error||`HTTP ${response.status}`);render({admin:{loginName:'flowadmin'},overview:body.overview})}catch(error){alert(`API 상태 검사를 완료하지 못했습니다: ${error.message||error}`)}finally{state.busy=false;btn.disabled=false;btn.textContent='API 상태 검사'}
}
async function signOut(){
  const token=state.token;
  if(token){try{await authFetch('/auth/v1/logout',{method:'POST',headers:{authorization:`Bearer ${token}`}})}catch{}}
  clearSession();showLogin();setStatus('이 기기의 관리자 세션을 종료했습니다.');
}

$('#setupForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const password=$('#newPasswordInput').value;
  const confirm=$('#confirmPasswordInput').value;
  if(password.length<10)return setStatus('비밀번호는 10자 이상으로 설정해 주세요.',true);
  if(password!==confirm)return setStatus('비밀번호 확인이 일치하지 않습니다.',true);
  const btn=e.submitter||$('#setupForm button[type="submit"]');btn.disabled=true;setStatus('비밀번호 설정 중…');
  try{
    await bootstrapPassword(state.setupToken,password);
    state.setupToken='';
    await signInWithPassword('flowadmin',password);
    $('#newPasswordInput').value='';$('#confirmPasswordInput').value='';setStatus('');
    await loadOverview();
  }catch(error){setStatus(error.message||String(error),true)}finally{btn.disabled=false}
});

$('#passwordForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const username=$('#usernameInput').value.trim();
  const password=$('#passwordInput').value;
  if(!username||!password)return;
  const btn=e.submitter||$('#passwordForm button[type="submit"]');
  btn.disabled=true;setStatus('로그인 중…');
  try{
    await signInWithPassword(username,password);
    $('#passwordInput').value='';
    setStatus('');
    await loadOverview();
  }catch(error){
    setStatus(error.message||String(error),true);
  }finally{
    btn.disabled=false;
  }
});
$('#refreshBtn').addEventListener('click',loadOverview);
$('#windowSelect').addEventListener('change',loadOverview);
$('#probeBtn').addEventListener('click',runProbe);
$('#signOutBtn').addEventListener('click',signOut);
window.addEventListener('hashchange',()=>{
  const result=consumeAuthFragment();
  if(result.authenticated)loadOverview();
  else if(result.error)showLogin('인증 링크가 만료되었거나 이미 사용되었습니다.');
});

state.setupToken=consumeSetupToken();
const linkResult=consumeAuthFragment();
restoreSession();
if(state.token)loadOverview();
else if(state.setupToken)showSetup();
else showLogin(linkResult.error?'인증 링크가 만료되었거나 이미 사용되었습니다.':'');
