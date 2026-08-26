const STATE_KEY='flow-university-dashboard-layout-v2';
const MEMO_KEY='flow-university-memo-v1';
const LEGACY_LAYOUT_KEY='flow-university-dashboard-v1';
const LONG_PRESS_MS=430;
const SIZE_MAP={
  '1x1':[1,1],'2x1':[2,1],'3x1':[3,1],'4x1':[4,1],
  '1x2':[1,2],'2x2':[2,2],'3x2':[3,2],'4x2':[4,2],
  '1x3':[1,3],'2x3':[2,3],'3x3':[3,3],'4x3':[4,3],
};
const LEGACY_SIZE={small:'1x1',wide:'2x1',large:'2x2'};
const SIZE_OPTIONS={
  next:['2x1','3x1','4x1','2x2','3x2','4x2'],
  today:['1x1','2x1','3x1','1x2','2x2','3x2'],
  semester:['1x1','2x1','3x1','1x2','2x2','3x2'],
  schedule:['2x2','3x2','4x2','2x3','3x3','4x3'],
  campus:['1x1','2x1','3x1','1x2','2x2','3x2'],
  gap:['1x1','2x1','3x1','1x2','2x2'],
  week:['1x1','2x1','3x1','1x2','2x2'],
  backup:['1x1','2x1','3x1','1x2','2x2'],
  clock:['1x1','2x1','3x1','1x2','2x2'],
  progress:['1x1','2x1','3x1','1x2','2x2','3x2'],
  remaining:['1x1','2x1','3x1','1x2','2x2'],
  tomorrow:['1x1','2x1','3x1','1x2','2x2'],
  credits:['1x1','2x1','3x1','1x2','2x2'],
  shortcuts:['1x1','2x1','3x1','1x2','2x2'],
  memo:Object.keys(SIZE_MAP),
};
const DEFAULT_MEMO_SIZE='2x1';
let state=null,resizeSession=null,dragSession=null,pressSession=null,memoSaveTimer=null,moveRaf=0;
const settleAnimations=new WeakMap();
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
function read(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function defaultColumns(){return innerWidth<=820?2:4}
function clampColumns(value){const n=Number(value);return[2,3,4].includes(n)?n:defaultColumns()}
function sizeParts(size){return SIZE_MAP[size]||SIZE_MAP['1x1']}
function normalizeSize(id,size){const mapped=LEGACY_SIZE[size]||size;const options=SIZE_OPTIONS[id]||['1x1','2x1','2x2'];return options.includes(mapped)?mapped:options[0]}
function widgetId(el){return el?.dataset?.widgetId||''}
function getGrid(){return $('#widgetDashboard')}
function getWidgets(){const grid=getGrid();return grid?$$('[data-widget-id]',grid):[]}
function stateFor(id){state.widgets[id]??={size:normalizeSize(id,id==='memo'?DEFAULT_MEMO_SIZE:'1x1'),visible:true,order:Object.keys(state.widgets).length};return state.widgets[id]}
function buildInitialState(){
  const legacy=read(LEGACY_LAYOUT_KEY,[]),legacyMap=new Map(Array.isArray(legacy)?legacy.map(x=>[x.id,x]):[]),widgets={};
  getWidgets().forEach((el,index)=>{const id=widgetId(el),old=legacyMap.get(id)||{},fallback=id==='memo'?DEFAULT_MEMO_SIZE:'1x1';widgets[id]={size:normalizeSize(id,old.size||el.dataset.size||fallback),visible:typeof old.visible==='boolean'?old.visible:!el.classList.contains('widget-hidden'),order:Number.isFinite(old.order)?old.order:index}});
  widgets.memo??={size:DEFAULT_MEMO_SIZE,visible:true,order:Object.keys(widgets).length};
  return{columns:defaultColumns(),widgets};
}
function loadState(){const saved=read(STATE_KEY,null);state=saved&&typeof saved==='object'?saved:buildInitialState();state.columns=clampColumns(state.columns);state.widgets=state.widgets&&typeof state.widgets==='object'?state.widgets:{};return state}
function saveState(){if(!state)return;getWidgets().forEach((el,order)=>{const id=widgetId(el),entry=stateFor(id);entry.size=normalizeSize(id,el.dataset.size||entry.size);entry.visible=!el.classList.contains('widget-hidden');entry.order=order});write(STATE_KEY,state)}
function applyWidgetSize(el,size){const id=widgetId(el),normalized=normalizeSize(id,size),[w,h]=sizeParts(normalized),cols=clampColumns(state?.columns);el.dataset.size=normalized;el.dataset.widgetCols=String(w);el.dataset.widgetRows=String(h);el.style.setProperty('--widget-w',String(Math.min(w,cols)));el.style.setProperty('--widget-h',String(h));const label=$('.widget-v2-size-label',el);if(label)label.textContent=`${Math.min(w,cols)}×${h}`}
function applyColumns(){const grid=getGrid();if(!grid||!state)return;grid.dataset.columns=String(state.columns);grid.style.setProperty('--dashboard-columns',String(state.columns));getWidgets().forEach(el=>applyWidgetSize(el,stateFor(widgetId(el)).size));$$('[data-dashboard-columns]').forEach(b=>b.classList.toggle('active',Number(b.dataset.dashboardColumns)===state.columns))}
function applyState(){const grid=getGrid();if(!grid||!state)return;const entries=Object.entries(state.widgets).sort((a,b)=>(a[1].order??0)-(b[1].order??0));for(const[id,item]of entries){const el=grid.querySelector(`[data-widget-id="${CSS.escape(id)}"]`);if(!el)continue;applyWidgetSize(el,item.size);el.classList.toggle('widget-hidden',item.visible===false);grid.append(el)}applyColumns();refreshMemoPicker()}
function injectStyles(){if($('link[href="/university/dashboard-editor-v2.css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/university/dashboard-editor-v2.css';document.head.append(link)}
function buildMemo(){const grid=getGrid();if(!grid||grid.querySelector('[data-widget-id="memo"]'))return;const el=document.createElement('article');el.className='summary-card dashboard-widget utility-widget memo-widget';el.dataset.widgetId='memo';el.dataset.widgetLabel='메모';el.innerHTML='<span>메모</span><textarea class="widget-memo-input" id="widgetMemoInput" maxlength="3000" placeholder="메모를 적어두세요"></textarea><small class="widget-memo-status">이 기기에 자동 저장</small>';const input=$('#widgetMemoInput',el);input.value=localStorage.getItem(MEMO_KEY)||'';input.addEventListener('input',()=>{clearTimeout(memoSaveTimer);memoSaveTimer=setTimeout(()=>{try{localStorage.setItem(MEMO_KEY,input.value)}catch{}},120)});grid.append(el)}
function editing(){return $('#todayView')?.classList.contains('dashboard-editing')}
function interactiveTarget(target){return target?.closest?.('textarea,input,select,button,a,.widget-v2-controls')}
function installControls(el){
  el.querySelector('.widget-controls')?.remove();
  if(!el.querySelector('.widget-v2-controls')){
    const controls=document.createElement('div');controls.className='widget-v2-controls';controls.innerHTML='<button class="widget-v2-remove" type="button" aria-label="위젯 제거">−</button><span class="widget-v2-size-label" aria-hidden="true"></span><button class="widget-v2-resize" type="button" aria-label="위젯 크기 조절"></button>';el.append(controls);
    $('.widget-v2-remove',controls).addEventListener('click',e=>{e.stopPropagation();el.classList.add('widget-hidden');stateFor(widgetId(el)).visible=false;saveState();refreshMemoPicker()});
    $('.widget-v2-resize',controls).addEventListener('pointerdown',e=>startResize(e,el));
  }
  if(el.dataset.directManipulationBound!=='1'){
    el.dataset.directManipulationBound='1';
    el.addEventListener('pointerdown',e=>handleWidgetPointerDown(e,el));
  }
  applyWidgetSize(el,stateFor(widgetId(el)).size)
}
function installAllControls(){getWidgets().forEach(installControls)}
function availableSizes(id,cols=clampColumns(state?.columns)){const options=SIZE_OPTIONS[id]||['1x1'];const fit=options.filter(key=>sizeParts(key)[0]<=cols);return fit.length?fit:[options[0]]}
function gridMetrics(){const grid=getGrid(),style=grid?getComputedStyle(grid):null,cols=clampColumns(state?.columns),gap=parseFloat(style?.columnGap||style?.gap||'0')||0,rowGap=parseFloat(style?.rowGap||style?.gap||'0')||0,rect=grid?.getBoundingClientRect();const cell=rect?(rect.width-gap*(cols-1))/cols:100;const row=parseFloat(style?.gridAutoRows||'108')||108;return{grid,cols,gap,rowGap,cell,row}}
function spanWidth(w,m){return m.cell*w+m.gap*Math.max(0,w-1)}
function spanHeight(h,m){return m.row*h+m.rowGap*Math.max(0,h-1)}
function nearestSizeByPixels(id,width,height,m){const options=availableSizes(id,m.cols);let best=options[0],score=Infinity;for(const key of options){const[w,h]=sizeParts(key),dw=Math.abs(width-spanWidth(w,m))/Math.max(1,m.cell),dh=Math.abs(height-spanHeight(h,m))/Math.max(1,m.row),s=dw*1.08+dh;if(s<score){score=s;best=key}}return best}
function makePlaceholder(el,kind){const [w,h]=sizeParts(el.dataset.size),p=document.createElement('div');p.className=`widget-grid-placeholder widget-${kind}-placeholder`;p.style.gridColumn=`span ${Math.min(w,clampColumns(state?.columns))}`;p.style.gridRow=`span ${h}`;p.setAttribute('aria-hidden','true');el.parentElement?.insertBefore(p,el);return p}
function liftWidget(el,rect,kind){el.classList.add('widget-direct-floating',`widget-direct-${kind}`);el.style.position='fixed';el.style.left=`${rect.left}px`;el.style.top=`${rect.top}px`;el.style.width=`${rect.width}px`;el.style.height=`${rect.height}px`;el.style.margin='0';el.style.zIndex='10000';el.style.gridColumn='auto';el.style.gridRow='auto';document.body.append(el);document.body.classList.add('widget-direct-active',`widget-${kind}-active`)}
function clearFloatingStyles(el){el.classList.remove('widget-direct-floating','widget-direct-resize','widget-direct-drag','widget-dragging');for(const prop of ['position','left','top','width','height','margin','z-index','grid-column','grid-row','transform','transform-origin','pointer-events','will-change'])el.style.removeProperty(prop)}
function cancelSettleAnimation(el){const animation=settleAnimations.get(el);if(!animation)return null;const rect=el.getBoundingClientRect();settleAnimations.delete(el);el.removeAttribute('data-widget-settling');try{animation.cancel()}catch{}return rect}
function presentationRect(el){return cancelSettleAnimation(el)||el.getBoundingClientRect()}
function animateIntoGrid(el,fromRect){
  const previous=settleAnimations.get(el);if(previous){settleAnimations.delete(el);el.removeAttribute('data-widget-settling');try{previous.cancel()}catch{}}
  if(!fromRect||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const to=el.getBoundingClientRect();if(!to.width||!to.height)return;const dx=fromRect.left-to.left,dy=fromRect.top-to.top,sx=fromRect.width/to.width,sy=fromRect.height/to.height;if(Math.abs(dx)<1&&Math.abs(dy)<1&&Math.abs(sx-1)<.01&&Math.abs(sy-1)<.01)return;
  const animation=el.animate([{transformOrigin:'top left',transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`},{transformOrigin:'top left',transform:'none'}],{duration:230,easing:'cubic-bezier(.2,.86,.24,1)',fill:'none'});settleAnimations.set(el,animation);el.dataset.widgetSettling='1';
  const clear=()=>{if(settleAnimations.get(el)!==animation)return;settleAnimations.delete(el);el.removeAttribute('data-widget-settling')};animation.addEventListener('finish',clear,{once:true});animation.addEventListener('cancel',clear,{once:true})
}
function startResize(e,el){
  if(!editing()||e.button!==0||dragSession)return;e.preventDefault();e.stopPropagation();cancelPress();
  const m=gridMetrics(),rect=presentationRect(el),id=widgetId(el),options=availableSizes(id,m.cols),dims=options.map(size=>({size,w:sizeParts(size)[0],h:sizeParts(size)[1]}));
  const minW=Math.min(...dims.map(x=>spanWidth(x.w,m))),maxW=Math.max(...dims.map(x=>spanWidth(x.w,m))),minH=Math.min(...dims.map(x=>spanHeight(x.h,m))),maxH=Math.max(...dims.map(x=>spanHeight(x.h,m))),placeholder=makePlaceholder(el,'resize');
  resizeSession={el,id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,startRect:rect,m,placeholder,minW,maxW,minH,maxH,preview:el.dataset.size,moved:false,lastX:e.clientX,lastY:e.clientY};
  el.dataset.directResizing='1';el.dataset.resizePressed='1';e.currentTarget.setPointerCapture?.(e.pointerId);liftWidget(el,rect,'resize');
  document.addEventListener('pointermove',resizeMove,{passive:false});document.addEventListener('pointerup',endResize,{once:true});document.addEventListener('pointercancel',endResize,{once:true})
}
function resizeMove(e){const s=resizeSession;if(!s||e.pointerId!==s.pointerId)return;e.preventDefault();s.lastX=e.clientX;s.lastY=e.clientY;const dx=e.clientX-s.startX,dy=e.clientY-s.startY;if(Math.hypot(dx,dy)>4){s.moved=true;s.el.dataset.resizeMoving='1'}const width=Math.max(s.minW,Math.min(s.maxW,s.startRect.width+dx)),height=Math.max(s.minH,Math.min(s.maxH,s.startRect.height+dy));s.preview=nearestSizeByPixels(s.id,width,height,s.m);const[w,h]=sizeParts(s.preview),label=$('.widget-v2-size-label',s.el);if(label)label.textContent=`${Math.min(w,s.m.cols)}×${h}`;cancelAnimationFrame(moveRaf);moveRaf=requestAnimationFrame(()=>{if(!resizeSession)return;s.el.style.width=`${width}px`;s.el.style.height=`${height}px`})}
function endResize(e){const s=resizeSession;if(!s)return;if(e?.pointerId!==undefined&&e.pointerId!==s.pointerId)return;resizeSession=null;cancelAnimationFrame(moveRaf);moveRaf=0;document.removeEventListener('pointermove',resizeMove);const live=s.el.getBoundingClientRect(),target=s.moved?s.preview:s.el.dataset.size;s.el.removeAttribute('data-direct-resizing');s.el.removeAttribute('data-resize-pressed');s.el.removeAttribute('data-resize-moving');s.placeholder.replaceWith(s.el);clearFloatingStyles(s.el);document.body.classList.remove('widget-direct-active','widget-resize-active');stateFor(s.id).size=target;applyWidgetSize(s.el,target);animateIntoGrid(s.el,live);saveState()}
function handleWidgetPointerDown(e,el){
  if(e.button!==0||resizeSession||dragSession||interactiveTarget(e.target))return;
  if(editing()){e.preventDefault();beginDrag(el,e.pointerId,e.clientX,e.clientY);return}
  armLongPress(e,el)
}
function armLongPress(e,el){cancelPress();el.classList.add('widget-longpress-arming');pressSession={el,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,timer:null};pressSession.timer=setTimeout(()=>{const s=pressSession;if(!s)return;if(!editing())$('#dashboardEditBtn')?.click();if(editing()){try{navigator.vibrate?.(16)}catch{}beginDrag(s.el,s.pointerId,s.lastX,s.lastY,true)}cancelPress(false)},LONG_PRESS_MS);document.addEventListener('pointermove',pressMove,{passive:true});document.addEventListener('pointerup',pressEnd,{once:true});document.addEventListener('pointercancel',pressEnd,{once:true})}
function pressMove(e){const s=pressSession;if(!s||e.pointerId!==s.pointerId)return;s.lastX=e.clientX;s.lastY=e.clientY;if(Math.hypot(e.clientX-s.startX,e.clientY-s.startY)>10)cancelPress()}
function pressEnd(e){if(pressSession&&e.pointerId===pressSession.pointerId)cancelPress()}
function cancelPress(removeEnd=true){if(!pressSession)return;const s=pressSession;clearTimeout(s.timer);s.el?.classList.remove('widget-longpress-arming');pressSession=null;document.removeEventListener('pointermove',pressMove);if(removeEnd){document.removeEventListener('pointerup',pressEnd);document.removeEventListener('pointercancel',pressEnd)}}
function snapshotDropTargets(grid,el){return $$('[data-widget-id]',grid).filter(target=>target!==el&&!target.classList.contains('widget-hidden')).map(target=>{const r=target.getBoundingClientRect();return{el:target,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2}})}
function beginDrag(el,pointerId,x,y,fromLongPress=false){
  if(dragSession||resizeSession||!editing()||!el.isConnected)return;cancelPress(false);const grid=getGrid();if(!grid||el.parentElement!==grid)return;
  const rect=presentationRect(el),placeholder=makePlaceholder(el,'drag'),offsetX=Math.max(0,Math.min(rect.width,x-rect.left)),offsetY=Math.max(0,Math.min(rect.height,y-rect.top)),dropTargets=snapshotDropTargets(grid,el);
  dragSession={el,pointerId,placeholder,grid,offsetX,offsetY,lastX:x,lastY:y,fromLongPress,moved:fromLongPress,startX:x,startY:y,dropTargets,startScrollX:scrollX,startScrollY:scrollY,lastPlacementKey:''};el.classList.add('widget-dragging');el.dataset.directDragging='1';try{el.setPointerCapture?.(pointerId)}catch{}liftWidget(el,rect,'drag');moveFloatingDrag(x,y);document.addEventListener('pointermove',dragMove,{passive:false});document.addEventListener('pointerup',endDrag,{once:true});document.addEventListener('pointercancel',endDrag,{once:true})
}
function moveFloatingDrag(x,y){const s=dragSession;if(!s)return;cancelAnimationFrame(moveRaf);moveRaf=requestAnimationFrame(()=>{if(!dragSession)return;s.el.style.left=`${x-s.offsetX}px`;s.el.style.top=`${y-s.offsetY}px`})}
function adjustedTargetRect(s,t){const dx=scrollX-s.startScrollX,dy=scrollY-s.startScrollY;return{left:t.left-dx,top:t.top-dy,right:t.right-dx,bottom:t.bottom-dy,width:t.width,height:t.height,cx:t.cx-dx,cy:t.cy-dy}}
function pointRectDistance(x,y,r){const dx=x<r.left?r.left-x:x>r.right?x-r.right:0,dy=y<r.top?r.top-y:y>r.bottom?y-r.bottom:0;return Math.hypot(dx,dy)}
function targetForPoint(s,x,y){let best=null,bestScore=Infinity;for(const target of s.dropTargets){if(!target.el.isConnected||target.el.classList.contains('widget-hidden'))continue;const r=adjustedTargetRect(s,target),edge=pointRectDistance(x,y,r),center=Math.hypot((x-r.cx)*.72,y-r.cy),score=edge*2.4+center*.18;if(score<bestScore){bestScore=score;best={el:target.el,rect:r}}}if(!best)return null;const gridRect=s.grid.getBoundingClientRect(),outsideX=x<gridRect.left?gridRect.left-x:x>gridRect.right?x-gridRect.right:0,outsideY=y<gridRect.top?gridRect.top-y:y>gridRect.bottom?y-gridRect.bottom:0;if(Math.hypot(outsideX,outsideY)>180)return null;return best}
function placementBefore(x,y,r){const bandY=Math.min(28,r.height*.18);if(y<r.cy-bandY)return true;if(y>r.cy+bandY)return false;return x<r.cx}
function dragMove(e){const s=dragSession;if(!s||e.pointerId!==s.pointerId)return;e.preventDefault();s.lastX=e.clientX;s.lastY=e.clientY;if(!s.moved&&Math.hypot(e.clientX-s.startX,e.clientY-s.startY)>5)s.moved=true;moveFloatingDrag(e.clientX,e.clientY);const hit=targetForPoint(s,e.clientX,e.clientY);if(!hit)return;const before=placementBefore(e.clientX,e.clientY,hit.rect),key=`${widgetId(hit.el)}:${before?'before':'after'}`;if(key===s.lastPlacementKey)return;s.lastPlacementKey=key;const anchor=before?hit.el:hit.el.nextSibling;if(anchor===s.placeholder||(!before&&hit.el.nextSibling===s.placeholder)|| (before&&s.placeholder.nextSibling===hit.el))return;s.grid.insertBefore(s.placeholder,anchor)}
function endDrag(e){const s=dragSession;if(!s)return;if(e?.pointerId!==undefined&&e.pointerId!==s.pointerId)return;dragSession=null;cancelAnimationFrame(moveRaf);moveRaf=0;document.removeEventListener('pointermove',dragMove);const live=s.el.getBoundingClientRect();s.el.removeAttribute('data-direct-dragging');s.placeholder.replaceWith(s.el);clearFloatingStyles(s.el);document.body.classList.remove('widget-direct-active','widget-drag-active');animateIntoGrid(s.el,live);saveState()}
function installColumnControl(){const bar=$('#widgetEditorBar');if(!bar||bar.querySelector('.widget-column-control'))return;const actions=bar.querySelector(':scope > div');if(!actions)return;const control=document.createElement('div');control.className='widget-column-control';control.innerHTML='<span>열</span><button type="button" data-dashboard-columns="2">2</button><button type="button" data-dashboard-columns="3">3</button><button type="button" data-dashboard-columns="4">4</button>';actions.prepend(control);control.addEventListener('click',e=>{const b=e.target.closest('[data-dashboard-columns]');if(!b)return;state.columns=clampColumns(b.dataset.dashboardColumns);applyColumns();saveState()});applyColumns()}
function memoPickerMarkup(shown){return `<button class="widget-picker-item${shown?' is-added':''}" type="button" data-v2-picker-id="memo"><span><strong>메모</strong><small>${shown?'오늘 화면에 표시 중':'간단한 메모를 이 기기에 저장'}</small></span><b>${shown?'✓':'+'}</b></button>`}
function refreshMemoPicker(){const box=$('#widgetPickerList'),memo=getGrid()?.querySelector('[data-widget-id="memo"]');if(!box||!memo)return;box.querySelector('[data-v2-picker-id="memo"]')?.remove();box.insertAdjacentHTML('beforeend',memoPickerMarkup(!memo.classList.contains('widget-hidden')));box.querySelector('[data-v2-picker-id="memo"]')?.addEventListener('click',()=>{memo.classList.toggle('widget-hidden');stateFor('memo').visible=!memo.classList.contains('widget-hidden');saveState();refreshMemoPicker()})}
function syncAfterLegacyAction(){setTimeout(()=>{if(!getGrid())return;installAllControls();saveState();refreshMemoPicker()},40)}
function init(){injectStyles();const wait=()=>{if(!getGrid()){setTimeout(wait,80);return}buildMemo();loadState();installAllControls();installColumnControl();applyState();document.addEventListener('click',e=>{if(e.target.closest('#widgetAddBtn,[data-picker-id],#widgetResetBtn,#widgetDoneBtn'))syncAfterLegacyAction()},{passive:true});window.addEventListener('resize',()=>{if(!state||resizeSession||dragSession)return;applyColumns()},{passive:true})};wait()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();