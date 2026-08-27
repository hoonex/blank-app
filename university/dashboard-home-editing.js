import {takeWidgetPresentation,installWidgetResizePresentationTakeover} from '/university/dashboard-motion.js';
const STATE_KEY='flow-university-dashboard-layout-v2';
const HOLD_MS=430,EDIT_HOLD_MS=210,DWELL_MS=190,EDGE=104,EDGE_SPEED=20,PICKER_HOLD_MS=340;
let press=null,drag=null,edgeRaf=0,moveRaf=0,pickerPress=null;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];

function editing(){return $('#todayView')?.classList.contains('dashboard-editing')}
function grid(){return $('#widgetDashboard')}
function widgetId(el){return el?.dataset?.widgetId||''}
function interactive(target){return target?.closest?.('textarea,input,select,button,a,.widget-v2-controls,.widget-controls')}
function ensureStyle(){if($('link[href="/university/dashboard-home-editing.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='/university/dashboard-home-editing.css';document.head.append(l)}
function ensureEditing(){if(editing())return true;$('#dashboardEditBtn')?.click();return editing()}
function persist(){
  const g=grid();if(!g)return;
  let state;try{state=JSON.parse(localStorage.getItem(STATE_KEY)||'null')}catch{}
  if(!state||typeof state!=='object')state={columns:Number(g.dataset.columns)||2,widgets:{}};
  state.widgets=state.widgets&&typeof state.widgets==='object'?state.widgets:{};
  $$('[data-widget-id]',g).forEach((el,order)=>{
    const id=widgetId(el);state.widgets[id]??={};state.widgets[id].order=order;
    state.widgets[id].visible=!el.classList.contains('widget-hidden');
    if(el.dataset.size)state.widgets[id].size=el.dataset.size;
  });
  try{localStorage.setItem(STATE_KEY,JSON.stringify(state))}catch{}
}
function polishEditorBar(){
  const bar=$('#widgetEditorBar');if(!bar)return;
  const title=$(':scope>strong',bar),copy=$(':scope>span',bar),add=$('#widgetAddBtn',bar);
  if(title)title.textContent='홈 화면 편집';
  if(copy)copy.textContent='길게 눌러 이동 · 화면 가장자리에서 자동 스크롤';
  if(add)add.textContent='위젯 추가';
}

function clearPress(){if(!press)return;clearTimeout(press.timer);press.el?.classList.remove('widget-longpress-arming');press=null}
function armPointer(e,el){
  clearPress();
  press={kind:'pointer',el,id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,timer:setTimeout(()=>{
    const p=press;if(!p)return;if(!ensureEditing())return clearPress();
    try{navigator.vibrate?.(15)}catch{}
    clearPress();beginDrag(el,p.x,p.y,'pointer',p.id);
  },HOLD_MS)};
  el.classList.add('widget-longpress-arming');
}
function armTouch(t,el){
  clearPress();const delay=editing()?EDIT_HOLD_MS:HOLD_MS;
  press={kind:'touch',el,id:t.identifier,x:t.clientX,y:t.clientY,sx:t.clientX,sy:t.clientY,timer:setTimeout(()=>{
    const p=press;if(!p)return;if(!ensureEditing())return clearPress();
    try{navigator.vibrate?.(15)}catch{}
    clearPress();beginDrag(el,p.x,p.y,'touch',p.id);
  },delay)};
  el.classList.add('widget-longpress-arming');
}
function placeholderFor(el){
  const p=document.createElement('div');
  p.className='widget-grid-placeholder widget-drag-placeholder';
  p.setAttribute('aria-hidden','true');
  p.style.gridColumn=`span ${Math.max(1,Number(el.dataset.widgetCols)||1)}`;
  p.style.gridRow=`span ${Math.max(1,Number(el.dataset.widgetRows)||1)}`;
  el.parentElement?.insertBefore(p,el);return p;
}
function beginDrag(el,x,y,input,id,visualRect=null){
  const g=grid();if(drag||!editing()||!g||el.parentElement!==g)return false;
  const source=takeWidgetPresentation(el);
  if(!source?.width||!source?.height)return false;
  const r=visualRect&&visualRect.width&&visualRect.height?visualRect:source,p=placeholderFor(el);
  drag={
    el,g,p,input,id,
    offsetX:Math.max(0,Math.min(r.width,x-r.left)),
    offsetY:Math.max(0,Math.min(r.height,y-r.top)),
    x,y,candidate:null,key:'',committed:'',timer:null
  };
  el.classList.add('widget-direct-floating','widget-direct-drag','widget-dragging');
  el.dataset.directDragging='1';
  Object.assign(el.style,{position:'fixed',left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,margin:'0',zIndex:'10000',gridColumn:'auto',gridRow:'auto'});
  document.body.append(el);document.body.classList.add('widget-direct-active','widget-drag-active');
  moveFloating(x,y);startEdge();return true;
}
function moveFloating(x,y){
  const d=drag;if(!d)return;
  cancelAnimationFrame(moveRaf);
  moveRaf=requestAnimationFrame(()=>{if(!drag)return;d.el.style.left=`${x-d.offsetX}px`;d.el.style.top=`${y-d.offsetY}px`});
}
function rectTargets(d){
  return $$('[data-widget-id]',d.g)
    .filter(el=>el!==d.el&&!el.classList.contains('widget-hidden'))
    .map(el=>({el,r:el.getBoundingClientRect()}))
    .filter(x=>x.r.width&&x.r.height);
}
function distance(x,y,r){const dx=x<r.left?r.left-x:x>r.right?x-r.right:0,dy=y<r.top?r.top-y:y>r.bottom?y-r.bottom:0;return Math.hypot(dx,dy)}
function hitFor(d,x,y){
  const a=rectTargets(d);if(!a.length)return null;
  const inside=a.find(({r})=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom);if(inside)return inside;
  let best=null,score=Infinity;
  for(const it of a){
    const cx=it.r.left+it.r.width/2,cy=it.r.top+it.r.height/2;
    const s=distance(x,y,it.r)*2.5+Math.hypot((x-cx)*.65,y-cy)*.18;
    if(s<score){score=s;best=it}
  }
  return best;
}
function beforeFor(x,y,r){const cy=r.top+r.height/2,cx=r.left+r.width/2,band=Math.min(30,r.height*.2);if(y<cy-band)return true;if(y>cy+band)return false;return x<cx}
function schedule(d,x,y){
  const h=hitFor(d,x,y);if(!h)return clearCandidate(d);
  const before=beforeFor(x,y,h.r),key=`${widgetId(h.el)}:${before?'b':'a'}`;
  if(key===d.key)return;
  clearTimeout(d.timer);d.key=key;d.candidate={el:h.el,before};d.p.dataset.dropPending='1';
  d.timer=setTimeout(()=>{if(drag===d&&d.key===key)commit(d)},DWELL_MS);
}
function clearCandidate(d){clearTimeout(d.timer);d.timer=null;d.key='';d.candidate=null;d.p?.removeAttribute('data-drop-pending')}
function capture(d){
  const m=new Map();
  for(const el of $$('[data-widget-id]',d.g)){
    if(el===d.el||el.classList.contains('widget-hidden'))continue;
    const r=el.getBoundingClientRect();if(r.width&&r.height)m.set(el,r);
  }
  return m;
}
function animateShift(before){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  requestAnimationFrame(()=>{
    for(const[el,old]of before){
      const r=el.getBoundingClientRect(),dx=old.left-r.left,dy=old.top-r.top;
      if(Math.abs(dx)<1&&Math.abs(dy)<1)continue;
      el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:285,easing:'cubic-bezier(.2,.9,.22,1)'});
    }
  });
}
function commit(d){
  const c=d.candidate;if(!c?.el?.isConnected||c.el.parentElement!==d.g)return;
  const anchor=c.before?c.el:c.el.nextSibling;
  if(anchor===d.p||(c.before&&d.p.nextSibling===c.el)||(!c.before&&c.el.nextSibling===d.p)){
    d.committed=d.key;d.p.removeAttribute('data-drop-pending');return;
  }
  const old=capture(d);d.g.insertBefore(d.p,anchor);d.committed=d.key;d.p.removeAttribute('data-drop-pending');animateShift(old);
}
function dragAt(x,y){if(!drag)return;drag.x=x;drag.y=y;moveFloating(x,y);schedule(drag,x,y)}
function startEdge(){if(!edgeRaf)edgeRaf=requestAnimationFrame(edgeStep)}
function stopEdge(){if(edgeRaf)cancelAnimationFrame(edgeRaf);edgeRaf=0;document.documentElement.removeAttribute('data-widget-auto-scroll')}
function edgeStep(){
  const d=drag;if(!d)return stopEdge();
  const h=innerHeight,zone=Math.min(EDGE,Math.max(72,h*.14));let speed=0;
  if(d.y<zone)speed=-EDGE_SPEED*(1-Math.max(0,d.y)/zone);
  else if(d.y>h-zone)speed=EDGE_SPEED*(1-Math.max(0,h-d.y)/zone);
  if(Math.abs(speed)>.35){
    const y=scrollY;scrollBy(0,speed);
    if(Math.abs(scrollY-y)>.1){
      document.documentElement.dataset.widgetAutoScroll=speed<0?'up':'down';
      schedule(d,d.x,d.y);
    }
  }else document.documentElement.removeAttribute('data-widget-auto-scroll');
  edgeRaf=requestAnimationFrame(edgeStep);
}
function settle(){
  const d=drag;if(!d)return;
  if(d.candidate&&d.committed!==d.key)commit(d);
  clearTimeout(d.timer);drag=null;stopEdge();cancelAnimationFrame(moveRaf);moveRaf=0;
  const from=d.el.getBoundingClientRect();d.el.removeAttribute('data-direct-dragging');d.p.replaceWith(d.el);
  d.el.classList.remove('widget-direct-floating','widget-direct-drag','widget-dragging');
  for(const k of ['position','left','top','width','height','margin','z-index','grid-column','grid-row'])d.el.style.removeProperty(k);
  document.body.classList.remove('widget-direct-active','widget-drag-active');persist();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const to=d.el.getBoundingClientRect(),dx=from.left-to.left,dy=from.top-to.top,sx=from.width/to.width,sy=from.height/to.height;
  if(Math.abs(dx)>1||Math.abs(dy)>1||Math.abs(sx-1)>.01||Math.abs(sy-1)>.01){
    d.el.animate([{transformOrigin:'top left',transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`},{transformOrigin:'top left',transform:'none'}],{duration:300,easing:'cubic-bezier(.2,.88,.24,1)'});
  }
}

function pointerDown(e){
  const el=e.target.closest?.('#widgetDashboard [data-widget-id]');
  if(!el||interactive(e.target)||e.button!==0)return;
  if(e.pointerType==='touch'){e.stopPropagation();return}
  e.stopPropagation();
  if(editing()){e.preventDefault();beginDrag(el,e.clientX,e.clientY,'pointer',e.pointerId)}
  else armPointer(e,el);
}
function pointerMove(e){
  if(press?.kind==='pointer'&&e.pointerId===press.id){
    press.x=e.clientX;press.y=e.clientY;
    if(Math.hypot(e.clientX-press.sx,e.clientY-press.sy)>10)clearPress();
  }
  if(drag?.input==='pointer'&&e.pointerId===drag.id){
    e.preventDefault();e.stopPropagation();dragAt(e.clientX,e.clientY);
  }
}
function pointerEnd(e){
  if(press?.kind==='pointer'&&e.pointerId===press.id)clearPress();
  if(drag?.input==='pointer'&&e.pointerId===drag.id){e.preventDefault();e.stopPropagation();settle()}
}
function touchStart(e){
  const el=e.target.closest?.('#widgetDashboard [data-widget-id]');
  if(!el||interactive(e.target)||e.touches.length!==1)return;
  armTouch(e.touches[0],el);
}
function touchBy(list,id){return[...list].find(t=>t.identifier===id)}
function touchMove(e){
  if(pickerPress?.kind==='touch'){
    const t=touchBy(e.touches,pickerPress.id);
    if(t){
      pickerPress.x=t.clientX;pickerPress.y=t.clientY;
      if(Math.hypot(t.clientX-pickerPress.sx,t.clientY-pickerPress.sy)>10)clearPickerPress();
    }
  }
  if(press?.kind==='touch'){
    const t=touchBy(e.touches,press.id);
    if(t){
      press.x=t.clientX;press.y=t.clientY;
      if(Math.hypot(t.clientX-press.sx,t.clientY-press.sy)>11)clearPress();
    }
  }
  if(drag?.input==='touch'){
    const t=touchBy(e.touches,drag.id);
    if(t){e.preventDefault();e.stopPropagation();dragAt(t.clientX,t.clientY)}
  }
}
function touchEnd(e){
  if(pickerPress?.kind==='touch'&&touchBy(e.changedTouches,pickerPress.id))clearPickerPress();
  if(press?.kind==='touch'&&touchBy(e.changedTouches,press.id))clearPress();
  if(drag?.input==='touch'&&touchBy(e.changedTouches,drag.id)){e.preventDefault();e.stopPropagation();settle()}
}

function previewClone(source){
  const c=source.cloneNode(true);
  c.removeAttribute('data-widget-id');c.removeAttribute('data-direct-manipulation-bound');c.removeAttribute('data-direct-dragging');c.removeAttribute('data-picker-lifted');
  c.classList.remove('widget-hidden','widget-longpress-arming','widget-direct-floating','widget-direct-drag','widget-dragging','widget-pressing');
  c.classList.add('widget-picker-live-preview');c.removeAttribute('style');
  c.querySelectorAll('.widget-v2-controls,.widget-controls').forEach(x=>x.remove());
  c.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
  c.querySelectorAll('[data-widget-id],[data-direct-manipulation-bound],[data-direct-dragging],[data-picker-lifted]').forEach(x=>{x.removeAttribute('data-widget-id');x.removeAttribute('data-direct-manipulation-bound');x.removeAttribute('data-direct-dragging');x.removeAttribute('data-picker-lifted')});
  c.querySelectorAll('button,a,input,textarea,select').forEach(n=>{
    const s=document.createElement('span');s.className='widget-picker-inert-control';
    s.textContent=n.textContent?.trim()||n.getAttribute('placeholder')||n.getAttribute('aria-label')||'';n.replaceWith(s);
  });
  c.querySelectorAll('*').forEach(x=>{x.removeAttribute('tabindex');x.setAttribute('aria-hidden','true')});
  c.setAttribute('aria-hidden','true');return c;
}
const hints={next:'다음 수업과 강의실',today:'오늘 수업 요약',semester:'학기와 시간표 상태',schedule:'오늘 시간표',campus:'강의실 이동 정보',gap:'다음 공강',clock:'현재 시간',progress:'현재 수업 진행률',remaining:'남은 수업',tomorrow:'내일 첫 수업',credits:'이번 학기 학점',shortcuts:'자주 쓰는 화면',week:'주간 수업',backup:'백업 상태',memo:'간단 메모',dayflow:'오늘 흐름',weekload:'주간 밀도'};
function pickerItems(){const g=grid();return g?$$('[data-widget-id]',g).map(el=>({el,id:widgetId(el),label:el.dataset.widgetLabel||widgetId(el),shown:!el.classList.contains('widget-hidden')})):[]}
function upgradePicker(){
  const dlg=$('#widgetPicker'),sheet=$('.widget-picker-sheet',dlg),box=$('#widgetPickerList',dlg);
  if(!dlg||!sheet||!box)return;
  sheet.classList.add('widget-gallery-sheet');
  const title=$('h2',sheet);if(title)title.textContent='위젯 갤러리';
  const copy=$(':scope>p',sheet);if(copy)copy.textContent='실제 모양을 미리 보고 추가하세요. 길게 누르면 바로 집어 배치할 수 있습니다.';
  let input=$('#widgetPickerSearch',sheet);
  if(!input){
    const label=document.createElement('label');label.className='widget-picker-search';
    label.innerHTML='<input id="widgetPickerSearch" type="search" autocomplete="off" placeholder="위젯 검색" aria-label="위젯 검색">';
    sheet.insertBefore(label,box);input=$('#widgetPickerSearch',sheet);input.addEventListener('input',renderPicker);
  }
  if(box.dataset.homeGalleryBound!=='1'){
    box.dataset.homeGalleryBound='1';
    box.addEventListener('click',pickerClick);
    box.addEventListener('pointerdown',pickerDown);
    box.addEventListener('touchstart',pickerTouchStart,{passive:true});
  }
  renderPicker();
}
function renderPicker(){
  const box=$('#widgetPickerList'),sheet=box?.closest('.widget-gallery-sheet'),q=($('#widgetPickerSearch')?.value||'').trim().toLowerCase();if(!box||!sheet)return;
  box.replaceChildren();
  for(const item of pickerItems().filter(x=>!q||`${x.label} ${hints[x.id]||''}`.toLowerCase().includes(q))){
    const b=document.createElement('button');b.type='button';
    b.className=`widget-picker-item widget-gallery-item${item.shown?' is-added':''}`;b.dataset.pickerId=item.id;
    if(item.id==='memo')b.dataset.v2PickerId='memo';
    const pv=document.createElement('span');pv.className='widget-picker-preview';pv.append(previewClone(item.el));
    const meta=document.createElement('span');meta.className='widget-picker-meta';meta.innerHTML='<strong></strong><small></small><b></b>';
    meta.querySelector('strong').textContent=item.label;meta.querySelector('small').textContent=hints[item.id]||'오늘 화면에 표시';meta.querySelector('b').textContent=item.shown?'추가됨':'+';
    b.append(pv,meta);box.append(b);
  }
  if(!box.children.length){const e=document.createElement('div');e.className='widget-picker-empty';e.textContent='검색 결과가 없습니다.';box.append(e)}
}
function showWidget(id,refreshPicker=true){
  const el=grid()?.querySelector(`[data-widget-id="${CSS.escape(id)}"]`);if(!el)return null;
  el.classList.remove('widget-hidden');persist();if(refreshPicker)renderPicker();return el;
}
function pickerClick(e){
  if(Date.now()<Number(e.currentTarget.dataset.suppressUntil||0))return;
  const b=e.target.closest?.('[data-picker-id]');if(!b)return;
  const el=grid()?.querySelector(`[data-widget-id="${CSS.escape(b.dataset.pickerId)}"]`);
  if(el?.classList.contains('widget-hidden'))showWidget(b.dataset.pickerId);
}
function pickerVisualRect(el,x,y){
  const source=el.getBoundingClientRect();
  const width=Math.max(120,Math.min(source.width||300,innerWidth-24));
  const height=Math.max(96,Math.min(source.height||150,innerHeight-24));
  const left=Math.max(8,Math.min(innerWidth-width-8,x-width/2));
  const top=Math.max(8,Math.min(innerHeight-height-8,y-Math.min(height*.34,62)));
  return{left,top,width,height,right:left+width,bottom:top+height};
}
function liftPickerWidget(existing,p,input,id){
  const list=p.b.parentElement;if(list)list.dataset.suppressUntil=String(Date.now()+550);
  try{navigator.vibrate?.(14)}catch{}
  const el=existing.classList.contains('widget-hidden')?showWidget(p.id,false):existing;
  $('#widgetPicker')?.close();
  if(!ensureEditing()||!el)return clearPickerPress();
  const visual=pickerVisualRect(el,p.x,p.y);
  const started=beginDrag(el,p.x,p.y,input,id,visual);
  if(started)el.dataset.pickerLifted='1';
  clearPickerPress();
}
function pickerDown(e){
  if(e.pointerType==='touch')return;
  const b=e.target.closest?.('[data-picker-id]');if(!b||e.button!==0)return;
  const existing=grid()?.querySelector(`[data-widget-id="${CSS.escape(b.dataset.pickerId)}"]`);if(!existing)return;
  clearPickerPress();
  pickerPress={kind:'pointer',b,id:b.dataset.pickerId,inputId:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,timer:setTimeout(()=>{
    const p=pickerPress;if(!p||p.kind!=='pointer')return;
    liftPickerWidget(existing,p,'pointer',p.inputId);
  },PICKER_HOLD_MS)};
}
function pickerTouchStart(e){
  if(e.touches.length!==1)return;
  const b=e.target.closest?.('[data-picker-id]');if(!b)return;
  const existing=grid()?.querySelector(`[data-widget-id="${CSS.escape(b.dataset.pickerId)}"]`);if(!existing)return;
  const t=e.touches[0];clearPickerPress();
  pickerPress={kind:'touch',b,id:t.identifier,pickerId:b.dataset.pickerId,x:t.clientX,y:t.clientY,sx:t.clientX,sy:t.clientY,timer:setTimeout(()=>{
    const p=pickerPress;if(!p||p.kind!=='touch')return;
    p.id=p.pickerId;
    liftPickerWidget(existing,p,'touch',t.identifier);
  },PICKER_HOLD_MS)};
}
function clearPickerPress(){if(!pickerPress)return;clearTimeout(pickerPress.timer);pickerPress=null}
function pickerMove(e){if(pickerPress?.kind==='pointer'&&e.pointerId===pickerPress.inputId&&Math.hypot(e.clientX-pickerPress.sx,e.clientY-pickerPress.sy)>10)clearPickerPress()}
function pickerEnd(e){if(pickerPress?.kind==='pointer'&&e.pointerId===pickerPress.inputId)clearPickerPress()}

function init(){
  installWidgetResizePresentationTakeover();ensureStyle();polishEditorBar();
  document.addEventListener('pointerdown',pointerDown,{capture:true});
  document.addEventListener('pointermove',pointerMove,{capture:true,passive:false});
  document.addEventListener('pointerup',pointerEnd,{capture:true,passive:false});
  document.addEventListener('pointercancel',pointerEnd,{capture:true,passive:false});
  document.addEventListener('touchstart',touchStart,{capture:true,passive:true});
  document.addEventListener('touchmove',touchMove,{capture:true,passive:false});
  document.addEventListener('touchend',touchEnd,{capture:true,passive:false});
  document.addEventListener('touchcancel',touchEnd,{capture:true,passive:false});
  document.addEventListener('pointermove',pickerMove,{passive:true});
  document.addEventListener('pointerup',pickerEnd,{passive:true});
  document.addEventListener('pointercancel',pickerEnd,{passive:true});
  document.addEventListener('click',e=>{
    if(e.target.closest('#widgetAddBtn'))setTimeout(upgradePicker,35);
    if(e.target.closest('.widget-v2-remove,#widgetResetBtn,#widgetDoneBtn'))setTimeout(()=>{persist();renderPicker()},45);
  },{passive:true});
  window.addEventListener('blur',()=>{clearPress();clearPickerPress();if(drag)settle()},{passive:true});
  setTimeout(polishEditorBar,120);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();