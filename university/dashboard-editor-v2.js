const STATE_KEY='flow-university-dashboard-layout-v2';
const MEMO_KEY='flow-university-memo-v1';
const LEGACY_LAYOUT_KEY='flow-university-dashboard-v1';
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
  memo:Object.keys(SIZE_MAP),
};
const DEFAULT_MEMO_SIZE='2x1';
let state=null,resizeSession=null,dragSession=null,memoSaveTimer=null;
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
  getWidgets().forEach((el,index)=>{const id=widgetId(el),old=legacyMap.get(id)||{};widgets[id]={size:normalizeSize(id,old.size||el.dataset.size||'1x1'),visible:typeof old.visible==='boolean'?old.visible:!el.classList.contains('widget-hidden'),order:Number.isFinite(old.order)?old.order:index}});
  widgets.memo??={size:DEFAULT_MEMO_SIZE,visible:true,order:Object.keys(widgets).length};
  return{columns:defaultColumns(),widgets};
}
function loadState(){const saved=read(STATE_KEY,null);state=saved&&typeof saved==='object'?saved:buildInitialState();state.columns=clampColumns(state.columns);state.widgets=state.widgets&&typeof state.widgets==='object'?state.widgets:{};return state}
function saveState(){if(!state)return;getWidgets().forEach((el,order)=>{const id=widgetId(el),entry=stateFor(id);entry.size=normalizeSize(id,el.dataset.size||entry.size);entry.visible=!el.classList.contains('widget-hidden');entry.order=order});write(STATE_KEY,state)}
function applyWidgetSize(el,size){const id=widgetId(el),normalized=normalizeSize(id,size),[w,h]=sizeParts(normalized),cols=clampColumns(state?.columns);el.dataset.size=normalized;el.dataset.widgetCols=String(w);el.dataset.widgetRows=String(h);el.style.setProperty('--widget-w',String(Math.min(w,cols)));el.style.setProperty('--widget-h',String(h));const label=$('.widget-v2-size-label',el);if(label)label.textContent=`${w}×${h}`}
function applyColumns(){const grid=getGrid();if(!grid||!state)return;grid.dataset.columns=String(state.columns);grid.style.setProperty('--dashboard-columns',String(state.columns));getWidgets().forEach(el=>applyWidgetSize(el,stateFor(widgetId(el)).size));$$('[data-dashboard-columns]').forEach(b=>b.classList.toggle('active',Number(b.dataset.dashboardColumns)===state.columns))}
function applyState(){const grid=getGrid();if(!grid||!state)return;const entries=Object.entries(state.widgets).sort((a,b)=>(a[1].order??0)-(b[1].order??0));for(const[id,item]of entries){const el=grid.querySelector(`[data-widget-id="${CSS.escape(id)}"]`);if(!el)continue;applyWidgetSize(el,item.size);el.classList.toggle('widget-hidden',item.visible===false);grid.append(el)}applyColumns();refreshMemoPicker()}
function injectStyles(){if($('link[href="/university/dashboard-editor-v2.css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/university/dashboard-editor-v2.css';document.head.append(link)}
function buildMemo(){const grid=getGrid();if(!grid||grid.querySelector('[data-widget-id="memo"]'))return;const el=document.createElement('article');el.className='summary-card dashboard-widget utility-widget memo-widget';el.dataset.widgetId='memo';el.dataset.widgetLabel='메모';el.innerHTML='<span>메모</span><textarea class="widget-memo-input" id="widgetMemoInput" maxlength="3000" placeholder="메모를 적어두세요"></textarea><small class="widget-memo-status">이 기기에 자동 저장</small>';const input=$('#widgetMemoInput',el);input.value=localStorage.getItem(MEMO_KEY)||'';input.addEventListener('input',()=>{clearTimeout(memoSaveTimer);memoSaveTimer=setTimeout(()=>{try{localStorage.setItem(MEMO_KEY,input.value)}catch{}},120)});grid.append(el);bindMemoLongPress(el)}
function bindMemoLongPress(el){let timer=null,start=null;el.addEventListener('pointerdown',e=>{if($('#todayView')?.classList.contains('dashboard-editing')||e.button!==0||e.target.closest('textarea,button,a,input,select'))return;start={x:e.clientX,y:e.clientY};clearTimeout(timer);timer=setTimeout(()=>$('#dashboardEditBtn')?.click(),520)});el.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>10){clearTimeout(timer);start=null}});['pointerup','pointercancel','pointerleave'].forEach(type=>el.addEventListener(type,()=>{clearTimeout(timer);start=null}))}
function installControls(el){el.querySelector('.widget-controls')?.remove();if(el.querySelector('.widget-v2-controls'))return;const controls=document.createElement('div');controls.className='widget-v2-controls';controls.innerHTML='<button class="widget-v2-remove" type="button" aria-label="위젯 제거">−</button><span class="widget-v2-size-label" aria-hidden="true"></span><button class="widget-v2-resize" type="button" aria-label="위젯 크기 조절"></button>';el.append(controls);$('.widget-v2-remove',controls).addEventListener('click',e=>{e.stopPropagation();el.classList.add('widget-hidden');stateFor(widgetId(el)).visible=false;saveState();refreshMemoPicker()});$('.widget-v2-resize',controls).addEventListener('pointerdown',e=>startResize(e,el));el.addEventListener('pointerdown',e=>startDrag(e,el));applyWidgetSize(el,stateFor(widgetId(el)).size)}
function installAllControls(){getWidgets().forEach(installControls)}
function nearestSize(id,targetW,targetH){const options=SIZE_OPTIONS[id]||['1x1'];let best=options[0],score=Infinity;for(const key of options){const[w,h]=sizeParts(key),s=Math.abs(w-targetW)*1.1+Math.abs(h-targetH);if(s<score){score=s;best=key}}return best}
function gridMetrics(){const grid=getGrid(),style=grid?getComputedStyle(grid):null,cols=state?.columns||defaultColumns(),gap=parseFloat(style?.columnGap||style?.gap||'0')||0,rowGap=parseFloat(style?.rowGap||style?.gap||'0')||0,rect=grid?.getBoundingClientRect();const cell=rect?(rect.width-gap*(cols-1))/cols:100;const row=parseFloat(style?.gridAutoRows||'108')||108;return{cols,gap,rowGap,cell,row}}
function startResize(e,el){if(!$('#todayView')?.classList.contains('dashboard-editing'))return;e.preventDefault();e.stopPropagation();const[w,h]=sizeParts(el.dataset.size),m=gridMetrics();resizeSession={el,id:widgetId(el),pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,startW:w,startH:h,m,moved:false};el.dataset.resizing='1';e.currentTarget.setPointerCapture?.(e.pointerId);document.addEventListener('pointermove',resizeMove);document.addEventListener('pointerup',endResize,{once:true});document.addEventListener('pointercancel',endResize,{once:true})}
function resizeMove(e){const s=resizeSession;if(!s)return;const dx=e.clientX-s.startX,dy=e.clientY-s.startY;if(Math.hypot(dx,dy)>6)s.moved=true;const targetW=Math.max(1,Math.min(4,Math.round(s.startW+dx/(s.m.cell+s.m.gap))));const targetH=Math.max(1,Math.min(3,Math.round(s.startH+dy/(s.m.row+s.m.rowGap))));const size=nearestSize(s.id,targetW,targetH);stateFor(s.id).size=size;applyWidgetSize(s.el,size)}
function endResize(){const s=resizeSession;if(!s)return;if(!s.moved){const options=SIZE_OPTIONS[s.id]||['1x1'],current=options.indexOf(s.el.dataset.size),next=options[(current+1)%options.length];stateFor(s.id).size=next;applyWidgetSize(s.el,next)}s.el.removeAttribute('data-resizing');resizeSession=null;document.removeEventListener('pointermove',resizeMove);saveState()}
function startDrag(e,el){if(!$('#todayView')?.classList.contains('dashboard-editing')||e.button!==0||resizeSession||e.target.closest('.widget-v2-controls,textarea,input,select,button,a'))return;e.preventDefault();dragSession={el,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false};el.setPointerCapture?.(e.pointerId);document.addEventListener('pointermove',dragMove);document.addEventListener('pointerup',endDrag,{once:true});document.addEventListener('pointercancel',endDrag,{once:true})}
function dragMove(e){const s=dragSession;if(!s)return;if(!s.moved&&Math.hypot(e.clientX-s.startX,e.clientY-s.startY)<8)return;s.moved=true;s.el.classList.add('widget-dragging');document.body.classList.add('widget-drag-active');const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('#widgetDashboard [data-widget-id]');if(!target||target===s.el||target.classList.contains('widget-hidden'))return;const r=target.getBoundingClientRect(),before=e.clientY<r.top+r.height/2||(Math.abs(e.clientY-(r.top+r.height/2))<r.height*.25&&e.clientX<r.left+r.width/2);target.parentElement.insertBefore(s.el,before?target:target.nextSibling)}
function endDrag(){if(!dragSession)return;dragSession.el.classList.remove('widget-dragging');dragSession=null;document.body.classList.remove('widget-drag-active');document.removeEventListener('pointermove',dragMove);saveState()}
function installColumnControl(){const bar=$('#widgetEditorBar');if(!bar||bar.querySelector('.widget-column-control'))return;const actions=bar.querySelector(':scope > div');if(!actions)return;const control=document.createElement('div');control.className='widget-column-control';control.innerHTML='<span>열</span><button type="button" data-dashboard-columns="2">2</button><button type="button" data-dashboard-columns="3">3</button><button type="button" data-dashboard-columns="4">4</button>';actions.prepend(control);control.addEventListener('click',e=>{const b=e.target.closest('[data-dashboard-columns]');if(!b)return;state.columns=clampColumns(b.dataset.dashboardColumns);applyColumns();saveState()});applyColumns()}
function memoPickerMarkup(shown){return `<button class="widget-picker-item${shown?' is-added':''}" type="button" data-v2-picker-id="memo"><span><strong>메모</strong><small>${shown?'오늘 화면에 표시 중':'바로 적고 자동 저장'}</small></span><b>${shown?'✓':'+'}</b></button>`}
function refreshMemoPicker(){const box=$('#widgetPickerList'),memo=getGrid()?.querySelector('[data-widget-id="memo"]');if(!box||!memo)return;box.querySelector('[data-v2-picker-id="memo"]')?.remove();box.insertAdjacentHTML('beforeend',memoPickerMarkup(!memo.classList.contains('widget-hidden')));box.querySelector('[data-v2-picker-id="memo"]')?.addEventListener('click',()=>{memo.classList.toggle('widget-hidden');stateFor('memo').visible=!memo.classList.contains('widget-hidden');saveState();refreshMemoPicker()})}
function syncAfterLegacyAction(){setTimeout(()=>{if(!getGrid())return;installAllControls();saveState();refreshMemoPicker()},40)}
function init(){injectStyles();const wait=()=>{if(!getGrid()){setTimeout(wait,80);return}buildMemo();loadState();installAllControls();installColumnControl();applyState();document.addEventListener('click',e=>{if(e.target.closest('#widgetAddBtn,[data-picker-id],#widgetResetBtn,#widgetDoneBtn'))syncAfterLegacyAction()},{passive:true});window.addEventListener('resize',()=>{if(!state)return;applyColumns()},{passive:true})};wait()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
