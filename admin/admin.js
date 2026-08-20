const SUPABASE_URL='https://eicwcohfrvhwimwevzkd.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_-9Cf0yVjLWf88pcvAqQ-EQ_YN9v3Obz';
const ADMIN_EDGE=`${SUPABASE_URL}/functions/v1/flow-admin`;
const SESSION_KEY='flow-admin-session-v1';
const $=(s)=>document.querySelector(s);

const state={token:'',email:'',overview:null,busy:false};

function setStatus(message,error=false){const el=$('#authStatus');el.textContent=message||'';el.style.color=error?'var(--bad)':'var(--muted)'}
function number(value){return new Intl.NumberFormat('ko-KR').format(Number(value||0))}
function when(value){if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)}
function duration(ms){const n=Number(ms||0);return n>=1000?`${(n/1000).toFixed(1)}s`:`${n}ms`}
function safeText(v){return String(v??'')}
function escapeHtml(v){return safeText(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function saveToken(token,email=''){state.token=token;state.email=email;sessionStorage.setItem(SESSION_KEY,JSON.stringify({token,email}))}
function clearToken(){state.token='';state.email='';state.overview=null;sessionStorage.removeItem(SESSION_KEY)}
function restoreToken(){try{const s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(s?.token){state.token=String(s.token);state.email=String(s.email||'')}}catch{}}
function consumeMagicLink(){const p=new URLSearchParams(location.hash.replace(/^#/,''));const token=p.get('access_token')||'';if(token){saveToken(token);history.replaceState(null,'',location.pathname+location.search)}}

async function authFetch(path,init={}){const headers=new Headers(init.headers||{});headers.set('apikey',PUBLISHABLE_KEY);headers.set('content-type','application/json');return fetch(`${SUPABASE_URL}${path}`,{...init,headers})}
async function adminFetch(action='overview',init={}){const headers=new Headers(init.headers||{});headers.set('apikey',PUBLISHABLE_KEY);headers.set('authorization',`Bearer ${state.token}`);if(init.body)headers.set('content-type','application/json');return fetch(`${ADMIN_EDGE}?action=${encodeURIComponent(action)}${action==='overview'?`&hours=${encodeURIComponent($('#windowSelect')?.value||24)}`:''}`,{...init,headers,cache:'no-store'})}

async function requestLogin(email){
  const redirect=`${location.origin}/admin/`;
  const response=await authFetch(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',body:JSON.stringify({email,create_user:false})});
  if(!response.ok)throw new Error(response.status===429?'로그인 메일 요청이 너무 많습니다. 잠시 후 다시 시도하세요.':'등록된 관리자 계정인지 확인하세요.');
  state.email=email;sessionStorage.setItem('flow-admin-pending-email',email);
}

async function verifyOtp(email,token){
  const response=await authFetch('/auth/v1/verify',{method:'POST',body:JSON.stringify({email,token,type:'email'})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body?.access_token)throw new Error('코드를 확인하지 못했습니다.');
  saveToken(body.access_token,body?.user?.email||email);
}

function showLogin(message=''){$('#loginPanel').classList.remove('hidden');$('#dashboard').classList.add('hidden');$('#signOutBtn').classList.add('hidden');$('#accessPill').textContent='Locked';if(message)setStatus(message,true)}
function showDashboard(admin){$('#loginPanel').classList.add('hidden');$('#dashboard').classList.remove('hidden');$('#signOutBtn').classList.remove('hidden');$('#accessPill').textContent=admin?.email||'Authorized'}

function renderTimeline(items=[]){
  const el=$('#timeline');el.innerHTML='';if(!items.length){el.innerHTML='<div class="empty">이 기간의 활동 데이터가 없습니다.</div>';return}
  const max=Math.max(...items.map(x=>Number(x.count||0)),1);
  for(const item of items){const bar=document.createElement('div');bar.className='timeline-bar';bar.style.height=`${Math.max(4,Math.round(Number(item.count||0)/max*100))}%`;bar.dataset.label=`${when(item.hour)} · ${number(item.count)}`;el.append(bar)}
}

function renderTop(items=[]){const el=$('#topEvents');if(!items.length){el.innerHTML='<div class="empty">집계된 이벤트가 없습니다.</div>';return}el.innerHTML=items.map(x=>`<div class="rank-row"><span title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</span><strong>${number(x.count)}</strong></div>`).join('')}
function healthClass(status){if(status>=200&&status<400)return'status-good';if(status===429||status===599)return'status-warn';return'status-bad'}
function renderProbes(items=[]){
  const el=$('#probeList');if(!items.length){el.innerHTML='<div class="empty">아직 API 상태 검사를 실행하지 않았습니다.</div>';$('#healthScore').textContent='—';$('#healthCaption').textContent='아직 검사 없음';return}
  const latest=new Map();for(const p of items){if(!latest.has(p.service))latest.set(p.service,p)}const rows=[...latest.values()];const ok=rows.filter(x=>x.ok).length;
  $('#healthScore').textContent=`${ok}/${rows.length}`;$('#healthCaption').textContent=ok===rows.length?'정상':`${rows.length-ok}개 확인 필요`;
  $('#probeMeta').textContent=`최근 ${items.length}건`;
  el.innerHTML=items.slice(0,12).map(p=>`<div class="health-row"><span class="service">${escapeHtml(p.service)}</span><span class="health-action">${escapeHtml(p.action)}</span><strong class="${healthClass(Number(p.status))}">${Number(p.status)===599?'TIMEOUT':escapeHtml(p.status)}</strong><span class="health-time">${duration(p.durationMs)} · ${when(p.checkedAt)}</span></div>`).join('')
}

function render(body){
  const o=body?.overview||{};state.overview=o;showDashboard(body?.admin||{});const a=o.activity||{};
  $('#generatedAt').textContent=`생성 ${when(o.generatedAt)}`;$('#totalEvents').textContent=number(a.totalEvents);$('#uniqueAnonymous').textContent=number(a.uniqueAnonymous);$('#registeredProfiles').textContent=number(a.registeredProfiles);$('#windowLabel').textContent=`최근 ${o.windowHours||24}시간`;$('#activityMeta').textContent=`${number(a.totalEvents)} events`;
  renderTimeline(a.hourly||[]);renderTop(a.topEvents||[]);renderProbes(o.probes||[]);
}

async function loadOverview(){
  if(!state.token)return showLogin();
  try{const response=await adminFetch('overview');const body=await response.json().catch(()=>({}));if(response.status===401){clearToken();return showLogin('세션이 만료되었습니다. 다시 로그인하세요.')}if(response.status===403){clearToken();return showLogin('이 계정은 Flow 관리자 allowlist에 없습니다.')}if(!response.ok)throw new Error(body?.error||`HTTP ${response.status}`);render(body)}catch(error){showLogin(`관리자 데이터를 불러오지 못했습니다: ${error.message||error}`)}}

async function runProbe(){
  if(state.busy)return;state.busy=true;const btn=$('#probeBtn');btn.disabled=true;btn.textContent='검사 중';
  try{const response=await adminFetch('probe',{method:'POST'});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error||`HTTP ${response.status}`);render({admin:{email:state.email||'Authorized'},overview:body.overview})}catch(error){alert(`API 상태 검사를 완료하지 못했습니다: ${error.message||error}`)}finally{state.busy=false;btn.disabled=false;btn.textContent='API 상태 검사'}
}

$('#emailForm').addEventListener('submit',async e=>{e.preventDefault();const email=$('#emailInput').value.trim();if(!email)return;setStatus('로그인 메일을 요청하는 중…');try{await requestLogin(email);setStatus('이메일을 확인하세요. 링크 또는 6자리 코드로 로그인할 수 있습니다.')}catch(error){setStatus(error.message||String(error),true)}});
$('#otpForm').addEventListener('submit',async e=>{e.preventDefault();const token=$('#otpInput').value.trim();const email=state.email||sessionStorage.getItem('flow-admin-pending-email')||$('#emailInput').value.trim();if(!email||!/^[0-9]{6}$/.test(token))return setStatus('이메일과 6자리 코드를 확인하세요.',true);setStatus('코드를 확인하는 중…');try{await verifyOtp(email,token);setStatus('');await loadOverview()}catch(error){setStatus(error.message||String(error),true)}});
$('#refreshBtn').addEventListener('click',loadOverview);$('#windowSelect').addEventListener('change',loadOverview);$('#probeBtn').addEventListener('click',runProbe);$('#signOutBtn').addEventListener('click',()=>{clearToken();showLogin()});

consumeMagicLink();restoreToken();if(state.token)loadOverview();else showLogin();
