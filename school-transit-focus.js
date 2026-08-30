const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const PRIMARY_VISIBLE_ROUTES=3;
let expanded=false;

function installStyle(){
  if($('link[data-flow-transit-focus]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='/school-transit-focus.css?v=20260830-1';
  link.dataset.flowTransitFocus='';
  document.head.append(link);
}
function routeLines(route){
  const values=[];
  for(const segment of route?.segments||[]){
    if(segment?.type!=='bus'&&segment?.type!=='subway')continue;
    const lines=(segment.lines||[]).map(value=>String(value||'').trim()).filter(Boolean);
    const label=lines[0]||(segment.type==='bus'?'버스':'지하철');
    if(label&&!values.includes(label))values.push(label);
  }
  return values.slice(0,3).join(' → ');
}
function realtimeCopy(route){
  const live=(Array.isArray(route?.realtimeLegs)?route.realtimeLegs.filter(Boolean):[])[0]||route?.realtime;
  if(!live)return'';
  const minutes=Math.max(0,Math.round(Number(live.arrivalMinutes)||0));
  const line=String(live.routeNo||'버스').trim()||'버스';
  return`${line} ${minutes}분 후`;
}
function compactMeta(card){
  $$('.flow-transit-meta span',card).forEach(item=>{
    const text=item.textContent.trim();
    item.hidden=text==='요금 정보 없음';
    if(text==='환승 0회')item.textContent='직행';
  });
}
function setAlternativeVisibility(cards){
  cards.forEach((card,index)=>{
    const hidden=index>=PRIMARY_VISIBLE_ROUTES&&!expanded;
    card.dataset.focusHidden=String(hidden);
  });
  const button=$('#transitMoreRoutesBtn');
  if(!button)return;
  const hiddenCount=Math.max(0,cards.length-PRIMARY_VISIBLE_ROUTES);
  button.classList.toggle('hidden',hiddenCount===0);
  button.textContent=expanded?'다른 경로 접기':`다른 경로 ${hiddenCount}개 더 보기`;
  button.setAttribute('aria-expanded',String(expanded));
}
function installMoreButton(cards){
  const container=$('#transitRoutes');if(!container)return;
  let button=$('#transitMoreRoutesBtn');
  if(!button){
    button=document.createElement('button');
    button.id='transitMoreRoutesBtn';
    button.type='button';
    button.className='neo-button compact flow-transit-more-routes';
    button.addEventListener('click',()=>{expanded=!expanded;setAlternativeVisibility($$('[data-transit-route]',container));});
    container.after(button);
  }
  setAlternativeVisibility(cards);
}
function renderFocus(detail){
  const routes=Array.isArray(detail?.routes)?detail.routes:[];
  const cards=$$('[data-transit-route]');
  if(!routes.length||!cards.length)return;
  expanded=false;
  const view=$('#transitView');view?.classList.add('flow-transit-focused','has-results');
  const header=$('.flow-transit-header p');if(header)header.textContent='목적지를 정하면 지금 탈 경로부터 보여줍니다.';
  const primary=routes[0];
  const summary=$('#transitSummary');
  if(summary){
    const lines=routeLines(primary)||'대중교통';
    const live=realtimeCopy(primary);
    const transfer=Number(primary?.transfers)||0;
    summary.classList.remove('hidden');
    summary.innerHTML=`<strong>추천 ${Math.max(1,Math.round(Number(primary?.totalMinutes)||0))}분</strong><span>${[live,lines,transfer?`환승 ${transfer}회`:'직행'].filter(Boolean).join(' · ')}</span>`;
  }
  cards.forEach((card,index)=>{
    card.classList.toggle('flow-transit-primary',index===0);
    card.classList.toggle('flow-transit-alternative',index>0);
    card.querySelector('.flow-transit-details')?.removeAttribute('open');
    compactMeta(card);
    const firstBadge=card.querySelector('.flow-transit-badges span');
    if(index===0&&firstBadge)firstBadge.textContent='지금 추천';
  });
  installMoreButton(cards);
  const state=$('#transitState');
  if(state){
    state.textContent=`현재 위치 기준 · ${routes.length}개 비교 · 상위 ${Math.min(PRIMARY_VISIBLE_ROUTES,routes.length)}개 표시`;
    state.dataset.kind='neutral';
  }
}
function clearFocusWhenEmpty(){
  queueMicrotask(()=>{
    if($$('[data-transit-route]').length)return;
    $('#transitView')?.classList.remove('has-results');
    $('#transitMoreRoutesBtn')?.remove();
    expanded=false;
  });
}
function init(){
  installStyle();
  const view=$('#transitView');
  if(view){
    view.classList.add('flow-transit-focused');
    const header=$('.flow-transit-header p',view);if(header)header.textContent='목적지를 정하면 지금 탈 경로부터 보여줍니다.';
    const state=$('#transitState',view);if(state&&!$('[data-transit-route]',view))state.textContent='목적지를 선택하고 경로 찾기를 누르세요.';
    view.addEventListener('click',event=>{if(event.target.closest?.('#transitDestinationEditBtn,#transitDestinationResetBtn,[data-destination-suggestion]'))clearFocusWhenEmpty()});
  }
  window.addEventListener('flow:transit-routes-rendered',event=>renderFocus(event.detail));
  document.documentElement.dataset.flowTransitFocus='ready';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
