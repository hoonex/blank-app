const PROFILE_KEY='flow-school-profile-v3';
const DESTINATION_KEY='flow-school-transit-destination-v1';
const SUMMARY_KEY='flow-school-transit-today-v1';
const SUMMARY_TTL_MS=10*60*1000;
const $=(selector,root=document)=>root.querySelector(selector);

function readJson(storage,key,fallback=null){
  try{return JSON.parse(storage.getItem(key)||'null')??fallback}catch{return fallback}
}
function destinationInfo(){
  const custom=readJson(localStorage,DESTINATION_KEY,null),query=String(custom?.query||'').trim();
  if(query){
    const x=Number(custom?.x),y=Number(custom?.y),name=String(custom?.name||query).trim()||query;
    return{
      key:`custom:${query}|${Number.isFinite(x)?x:''}|${Number.isFinite(y)?y:''}`,
      name,
      custom:true,
    };
  }
  const school=readJson(localStorage,PROFILE_KEY,{})?.school||{},name=String(school.name||'선택한 학교').trim()||'선택한 학교';
  return{key:`school:${school.schoolCode||name}`,name,custom:false};
}
function summary(){
  const value=readJson(sessionStorage,SUMMARY_KEY,null),destination=destinationInfo();
  if(!value||value.destinationKey!==destination.key)return null;
  const savedAt=Number(value.savedAt)||0;
  if(!savedAt||Date.now()-savedAt>SUMMARY_TTL_MS){sessionStorage.removeItem(SUMMARY_KEY);return null}
  return value;
}
function clock(iso){
  const date=new Date(iso);if(Number.isNaN(date.getTime()))return'';
  return new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
}
function routeLines(route){
  const labels=[];
  for(const segment of route?.segments||[]){
    if(segment?.type!=='bus'&&segment?.type!=='subway')continue;
    const lines=(segment.lines||[]).map(value=>String(value||'').trim()).filter(Boolean);
    const label=lines.length?lines.slice(0,2).join('/'):(segment.type==='bus'?'버스':'지하철');
    if(label&&!labels.includes(label))labels.push(label);
  }
  return labels.slice(0,3).join(' → ');
}
function saveRouteSummary(detail){
  const route=Array.isArray(detail?.routes)?detail.routes[0]:null,totalMinutes=Math.round(Number(route?.totalMinutes)||0);
  if(!route||totalMinutes<=0)return;
  const destination=destinationInfo(),arrivalAt=String(route.arrivalAt||new Date(Date.now()+totalMinutes*60000).toISOString());
  const next={
    destinationKey:destination.key,
    destinationName:destination.name,
    totalMinutes,
    arrivalAt,
    transfers:Math.max(0,Math.round(Number(route.transfers)||0)),
    lines:routeLines(route),
    generatedAt:String(detail?.generatedAt||new Date().toISOString()),
    savedAt:Date.now(),
  };
  sessionStorage.setItem(SUMMARY_KEY,JSON.stringify(next));
  renderCard();
}
function installStyle(){
  if($('link[data-flow-school-transit-today]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='/school-transit-today.css?v=20260830-1';link.dataset.flowSchoolTransitToday='';document.head.append(link);
}
function openTransit(){
  const nav=$('[data-flow-transit-nav]');
  if(nav){nav.click();return}
  if(location.pathname!=='/transit')location.assign('/transit');
}
function installCard(){
  const grid=$('#todayView .status-grid');if(!grid)return null;
  let card=$('#flowTransitTodayCard');
  if(card)return card;
  card=document.createElement('button');card.id='flowTransitTodayCard';card.type='button';card.className='status-card neo-panel flow-transit-today-card';card.dataset.state='idle';
  card.innerHTML='<span class="status-label" data-transit-today-label>교통</span><strong data-transit-today-value>학교까지 경로</strong><p data-transit-today-meta>교통에서 현재 위치로 확인</p>';
  card.addEventListener('click',openTransit);
  const eventCard=$('#quickEvent')?.closest('.status-card');if(eventCard)eventCard.before(card);else grid.append(card);
  grid.classList.add('flow-transit-today-ready');
  return card;
}
function renderCard(){
  const card=installCard();if(!card)return;
  const destination=destinationInfo(),recent=summary(),label=$('[data-transit-today-label]',card),value=$('[data-transit-today-value]',card),meta=$('[data-transit-today-meta]',card);
  if(recent){
    const arrival=clock(recent.arrivalAt),transferCopy=recent.transfers?`환승 ${recent.transfers}회`:'환승 없음',routeCopy=[recent.destinationName,recent.lines,transferCopy].filter(Boolean).join(' · ');
    card.dataset.state='recent';label.textContent='최근 교통';value.textContent=[`${recent.totalMinutes}분`,arrival?`${arrival} 도착`:null].filter(Boolean).join(' · ');meta.textContent=routeCopy;card.setAttribute('aria-label',`${recent.destinationName}까지 최근 교통 ${recent.totalMinutes}분. 교통 화면 열기`);
    return;
  }
  card.dataset.state='idle';label.textContent='교통';value.textContent=destination.custom?`${destination.name}까지`:'학교까지 경로';meta.textContent=destination.custom?'교통에서 현재 위치로 확인':`${destination.name} · 교통에서 확인`;card.setAttribute('aria-label',`${destination.name}까지 교통 경로 열기`);
}
function init(){
  installStyle();renderCard();
  window.addEventListener('flow:transit-routes-rendered',event=>saveRouteSummary(event.detail));
  window.addEventListener('pageshow',renderCard);
  window.addEventListener('popstate',()=>queueMicrotask(renderCard));
  window.addEventListener('storage',event=>{if(event.key===PROFILE_KEY||event.key===DESTINATION_KEY)renderCard()});
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="today"]'))queueMicrotask(renderCard)},{capture:true});
  document.documentElement.dataset.flowTransitToday='ready';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
