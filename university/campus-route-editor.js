const ROUTE_PREFIX='flow-university-campus-route-v1:';
const TOUCH_REORDER_THRESHOLD=8;
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let draft=[],draftMode='default',currentDay=null,pendingEditIndex=null,dragIndex=null,touchReorder=null,initialized=false;

function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function bridge(){return window.flowCampusRouteBridge||null}
function context(){return bridge()?.getContext?.()||null}
function scopeKey(ctx=context(),day=ctx?.day){
  if(!ctx||!Number.isFinite(Number(day)))return'';
  const p=ctx.profile||{},tt=ctx.timetable||{};
  return `${ROUTE_PREFIX}${encodeURIComponent([p.id||p.name||'university',tt.year||'',tt.semester||'',Number(day)].join('|'))}`;
}
function sanitizeStop(stop,index=0){
  const x=String(stop?.x??'').trim(),y=String(stop?.y??'').trim();
  return{
    id:String(stop?.id||`custom:${Date.now()}:${index}`),
    kind:stop?.kind==='class'?'class':'custom',
    name:String(stop?.name||'').trim(),
    label:String(stop?.label||stop?.name||'').trim(),
    meta:String(stop?.meta||'').trim(),
    x,y,url:String(stop?.url||'').trim(),sourcePlace:String(stop?.sourcePlace||'').trim(),
  };
}
function defaultStops(ctx=context()){return (ctx?.defaultStops||[]).map(sanitizeStop).filter(x=>x.name)}
function readSaved(ctx=context(),day=ctx?.day){
  const key=scopeKey(ctx,day);if(!key)return null;
  try{const value=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(value?.stops)?value.stops.map(sanitizeStop).filter(x=>x.name):null}catch{return null}
}
function writeSaved(){const ctx=context(),key=scopeKey(ctx,currentDay);if(!key)return;if(draftMode==='default'){localStorage.removeItem(key);return}localStorage.setItem(key,JSON.stringify({version:1,day:currentDay,stops:draft.map(sanitizeStop),savedAt:Date.now()}))}
function setStatus(text,state=''){const node=$('#campusRouteEditorStatus');if(!node)return;node.textContent=text;node.dataset.state=state}
function markDirty(){draftMode='custom';setStatus('변경사항 있음 · 지도에 반영하세요','dirty')}

function installStyles(){
  if($('link[href="/university/campus-route-editor.css"]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='/university/campus-route-editor.css';document.head.append(link);
}
function moveNearbyQuickAccess(){
  const header=$('#campusView>.view-header'),filter=$('#campusFilter'),refresh=$('#campusRefreshBtn');
  if(!header||!filter||!refresh||$('#campusHeaderTools'))return;
  const tools=document.createElement('div');tools.id='campusHeaderTools';tools.className='campus-header-tools';
  const nearby=document.createElement('div');nearby.className='campus-nearby-quick';
  const copy=document.createElement('div');copy.className='campus-nearby-quick-copy';copy.innerHTML='<span>NEARBY</span><strong>캠퍼스 주변</strong>';
  nearby.append(copy,filter);tools.append(nearby);header.append(refresh,tools);
}
function ensureEditor(){
  const card=$('.campus-map-card'),note=$('.campus-map-note',card);if(!card||!note||$('#campusRouteEditor'))return;
  const details=document.createElement('details');details.id='campusRouteEditor';details.className='campus-route-editor';
  details.innerHTML=`<summary><span><b>경로 편집</b><small>순서 · 추가 · 수정 · 삭제</small></span><i aria-hidden="true"></i></summary><div class="campus-route-editor-body"><div class="campus-route-editor-list" id="campusRouteEditorList"></div><div class="campus-route-editor-actions"><button type="button" class="soft-button" id="campusRouteAddBtn">장소 추가</button><button type="button" class="soft-button" id="campusRouteResetBtn">기본 순서</button><button type="button" class="primary-button" id="campusRouteApplyBtn">지도에 반영</button></div><p class="campus-route-editor-status" id="campusRouteEditorStatus"></p></div>`;
  note.insertAdjacentElement('afterend',details);
  $('#campusRouteAddBtn')?.addEventListener('click',()=>openSearch(null));
  $('#campusRouteResetBtn')?.addEventListener('click',resetDraft);
  $('#campusRouteApplyBtn')?.addEventListener('click',applyDraft);
  const list=$('#campusRouteEditorList');
  list?.addEventListener('click',onListClick);
  list?.addEventListener('dragstart',onDragStart);
  list?.addEventListener('dragover',event=>{if(event.target.closest?.('[data-route-index]'))event.preventDefault()});
  list?.addEventListener('drop',onDrop);
  list?.addEventListener('pointerdown',onTouchReorderDown,{passive:false});
}
function ensureSearchDialog(){
  if($('#campusRoutePlaceDialog'))return;
  const dialog=document.createElement('dialog');dialog.id='campusRoutePlaceDialog';dialog.className='campus-route-place-dialog';
  dialog.innerHTML=`<div class="campus-route-place-sheet"><button class="campus-route-place-close" type="button" aria-label="닫기">×</button><span class="campus-section-label">PLACE SEARCH</span><h2>경로에 넣을 장소</h2><p>캠퍼스 주변 장소를 검색해 경유지로 추가하거나 기존 위치를 바꿉니다.</p><div class="campus-route-search"><input id="campusRouteSearchInput" type="search" autocomplete="off" placeholder="건물, 카페, 편의점 검색"><button id="campusRouteSearchBtn" type="button">검색</button></div><div class="campus-route-search-results" id="campusRouteSearchResults"></div></div>`;
  document.body.append(dialog);
  $('.campus-route-place-close',dialog)?.addEventListener('click',()=>dialog.close());
  $('#campusRouteSearchBtn')?.addEventListener('click',runSearch);
  $('#campusRouteSearchInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void runSearch()}});
  $('#campusRouteSearchResults')?.addEventListener('click',event=>{const button=event.target.closest?.('[data-place-index]');if(!button)return;selectSearchResult(Number(button.dataset.placeIndex))});
}

function refreshContext({force=false}={}){
  const ctx=context();if(!ctx||!Number.isFinite(Number(ctx.day)))return;
  const day=Number(ctx.day);if(!force&&currentDay===day&&draft.length)return;
  currentDay=day;
  const saved=readSaved(ctx,day);
  draft=saved||defaultStops(ctx);draftMode=saved?'custom':'default';
  renderDraft();
  if(saved?.length){bridge()?.applyPlan?.(day,saved);setStatus('저장된 경로를 지도에 반영했습니다.','applied')}
  else setStatus('시간표 순서대로 표시 중','default');
}
function renderDraft(){
  const box=$('#campusRouteEditorList');if(!box)return;
  if(touchReorder)finishTouchReorder(true);
  if(!draft.length){box.innerHTML='<div class="campus-route-editor-empty">경로에 표시할 장소가 없습니다. 장소를 추가할 수 있습니다.</div>';return}
  box.innerHTML=draft.map((stop,index)=>`<div class="campus-route-stop" draggable="true" data-route-index="${index}"><span class="campus-route-grip" data-route-grip aria-hidden="true">⋮⋮</span><span class="campus-route-order">${index+1}</span><span class="campus-route-stop-copy"><strong>${esc(stop.label||stop.name)}</strong><small>${esc(stop.name)}${stop.kind==='custom'?' · 직접 추가':''}</small></span><span class="campus-route-stop-actions"><button type="button" data-route-up aria-label="위로 이동" ${index===0?'disabled':''}>↑</button><button type="button" data-route-down aria-label="아래로 이동" ${index===draft.length-1?'disabled':''}>↓</button><button type="button" data-route-edit>수정</button><button type="button" data-route-delete>삭제</button></span></div>`).join('')
}
function move(from,to){if(from===to||from<0||to<0||from>=draft.length||to>=draft.length)return;const [item]=draft.splice(from,1);draft.splice(to,0,item);markDirty();renderDraft()}
function onListClick(event){
  const row=event.target.closest?.('[data-route-index]');if(!row)return;const index=Number(row.dataset.routeIndex);
  if(event.target.closest('[data-route-up]'))move(index,index-1);
  else if(event.target.closest('[data-route-down]'))move(index,index+1);
  else if(event.target.closest('[data-route-edit]'))openSearch(index);
  else if(event.target.closest('[data-route-delete]')){draft.splice(index,1);markDirty();renderDraft()}
}
function onDragStart(event){const row=event.target.closest?.('[data-route-index]');if(!row)return;dragIndex=Number(row.dataset.routeIndex);event.dataTransfer?.setData('text/plain',String(dragIndex));if(event.dataTransfer)event.dataTransfer.effectAllowed='move'}
function onDrop(event){const row=event.target.closest?.('[data-route-index]');if(!row)return;event.preventDefault();const from=Number.isFinite(dragIndex)?dragIndex:Number(event.dataTransfer?.getData('text/plain'));const to=Number(row.dataset.routeIndex);dragIndex=null;move(from,to)}

function touchReorderSlot(state=touchReorder){
  const list=state?.list,placeholder=state?.placeholder;if(!list||!placeholder?.isConnected)return state?.from??0;
  const children=[...list.children],index=children.indexOf(placeholder);
  return children.slice(0,Math.max(0,index)).filter(node=>node.classList?.contains('campus-route-stop')).length;
}
function beginTouchReorder(state){
  if(state.active)return;
  const {row,list,rect}=state,placeholder=document.createElement('div');
  placeholder.className='campus-route-touch-placeholder';placeholder.setAttribute('aria-hidden','true');placeholder.style.height=`${rect.height}px`;
  list.insertBefore(placeholder,row);state.placeholder=placeholder;state.active=true;state.slot=state.from;
  row.draggable=false;row.classList.add('campus-route-touch-floating');row.dataset.routeTouchDragging='true';
  Object.assign(row.style,{position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,margin:'0',zIndex:'10000',transform:'translate3d(0,0,0)'});
  document.body.append(row);list.dataset.touchReordering='true';
}
function moveTouchPlaceholder(state,clientY){
  const {list,placeholder,row,rect}=state;if(!list||!placeholder||!row)return;
  const dy=clientY-state.startY;row.style.transform=`translate3d(0,${dy}px,0)`;
  const center=rect.top+dy+rect.height/2,rows=$$('.campus-route-stop',list);let placed=false;
  for(const candidate of rows){const r=candidate.getBoundingClientRect();if(center<r.top+r.height/2){list.insertBefore(placeholder,candidate);placed=true;break}}
  if(!placed)list.append(placeholder);
  state.slot=touchReorderSlot(state);
}
function onTouchReorderDown(event){
  if(event.pointerType==='mouse'||!event.isPrimary||event.button!==0||touchReorder)return;
  const grip=event.target.closest?.('[data-route-grip]'),row=grip?.closest?.('[data-route-index]'),list=$('#campusRouteEditorList');
  if(!grip||!row||!list||row.parentElement!==list)return;
  const rect=row.getBoundingClientRect();if(!rect.width||!rect.height)return;
  event.preventDefault();touchReorder={id:event.pointerId,row,list,from:Number(row.dataset.routeIndex),startX:event.clientX,startY:event.clientY,rect,active:false,placeholder:null,slot:Number(row.dataset.routeIndex)};
}
function onTouchReorderMove(event){
  const state=touchReorder;if(!state||event.pointerId!==state.id)return;
  const dx=event.clientX-state.startX,dy=event.clientY-state.startY;
  if(!state.active&&Math.hypot(dx,dy)<TOUCH_REORDER_THRESHOLD)return;
  event.preventDefault();if(!state.active)beginTouchReorder(state);moveTouchPlaceholder(state,event.clientY)
}
function finishTouchReorder(cancel=false){
  const state=touchReorder;if(!state)return;touchReorder=null;
  if(!state.active)return;
  const to=Math.max(0,Math.min(draft.length-1,touchReorderSlot(state)));
  state.row.remove();state.placeholder?.remove();state.list?.removeAttribute('data-touch-reordering');
  if(!cancel&&Number.isFinite(state.from)&&state.from!==to){const [item]=draft.splice(state.from,1);draft.splice(to,0,item);markDirty()}
  renderDraft();
}
function onTouchReorderEnd(event){const state=touchReorder;if(!state||event.pointerId!==state.id)return;event.preventDefault();finishTouchReorder(event.type==='pointercancel')}

let searchResults=[];
function openSearch(index){pendingEditIndex=Number.isInteger(index)?index:null;ensureSearchDialog();const dialog=$('#campusRoutePlaceDialog'),input=$('#campusRouteSearchInput'),results=$('#campusRouteSearchResults');if(results)results.innerHTML='';if(input){input.value=pendingEditIndex===null?'':draft[pendingEditIndex]?.name||''}if(dialog&&!dialog.open)dialog.showModal();setTimeout(()=>input?.focus({preventScroll:true}),60)}
async function runSearch(){
  const input=$('#campusRouteSearchInput'),box=$('#campusRouteSearchResults'),query=input?.value.trim()||'';if(!box||query.length<2){if(box)box.innerHTML='<div class="campus-route-search-state">검색어를 2자 이상 입력하세요.</div>';return}
  box.innerHTML='<div class="campus-route-search-state">장소 찾는 중…</div>';
  try{searchResults=await bridge()?.searchPlaces?.(query)||[];if(!searchResults.length){box.innerHTML='<div class="campus-route-search-state">검색 결과가 없습니다.</div>';return}box.innerHTML=searchResults.slice(0,8).map((place,index)=>`<button type="button" class="campus-route-place-result" data-place-index="${index}"><strong>${esc(place.name)}</strong><small>${esc(place.roadAddress||place.address||place.category||'')}</small></button>`).join('')}catch(error){box.innerHTML=`<div class="campus-route-search-state">${esc(error?.message||'장소 검색에 실패했습니다.')}</div>`}
}
function selectSearchResult(index){const place=searchResults[index];if(!place)return;const stop=sanitizeStop({id:`custom:${place.id||Date.now()}`,kind:'custom',name:place.name,label:place.name,meta:place.category||'',x:place.x,y:place.y,url:place.url});if(pendingEditIndex===null)draft.push(stop);else draft.splice(pendingEditIndex,1,stop);pendingEditIndex=null;markDirty();renderDraft();$('#campusRoutePlaceDialog')?.close()}
function resetDraft(){const ctx=context();draft=defaultStops(ctx);draftMode='default';renderDraft();setStatus('기본 시간표 순서 · 지도에 반영하세요','dirty')}
function applyDraft(){
  if(!Number.isFinite(currentDay))return;
  const valid=draft.map(sanitizeStop).filter(stop=>stop.name&&stop.x&&stop.y);draft=valid;renderDraft();writeSaved();
  if(draftMode==='default'){bridge()?.clearPlan?.(currentDay);document.querySelector(`#campusDayTabs [data-campus-day="${currentDay}"]`)?.click();setStatus('시간표 기본 순서를 지도에 반영했습니다.','applied')}
  else{bridge()?.applyPlan?.(currentDay,draft);setStatus('사용자 경로를 지도에 반영했습니다.','applied')}
}
function renderCustomRouteList(detail){
  if(Number(detail?.day)!==currentDay||draftMode!=='custom')return;const box=$('#campusRouteList');if(!box)return;const segments=Array.isArray(detail?.segments)?detail.segments:[];
  if(!segments.length){box.innerHTML='<div class="campus-status">연결할 수 있는 경로가 없습니다.</div>';return}
  box.innerHTML=segments.map(segment=>{const time=Number(segment.time||0),distance=Number(segment.distance||0),minutes=time>0?Math.max(1,Math.round(time/60)):0;const meta=segment.same?'같은 장소':[[minutes?`도보 ${minutes}분`:'' ,distance?distance>=1000?`${(distance/1000).toFixed(1)}km`:`${Math.round(distance/10)*10}m`:'' ].filter(Boolean).join(' · ')][0];return `<${segment.landingUrl?'a':'div'} class="campus-route" ${segment.landingUrl?`href="${esc(segment.landingUrl)}" target="_blank" rel="noopener noreferrer"`:''}><span class="campus-pin">→</span><span><strong>${esc(segment.from?.name||'출발')} → ${esc(segment.to?.name||'도착')}</strong><small>${esc(meta)}</small></span><span class="campus-distance">${esc(minutes?`${minutes}분`:segment.same?'이동 없음':'경로')}</span></${segment.landingUrl?'a':'div'}>`}).join('')
}

function bindEvents(){
  document.addEventListener('click',event=>{if(event.target.closest?.('#campusDayTabs [data-campus-day]'))setTimeout(()=>refreshContext({force:true}),0)});
  document.addEventListener('pointermove',onTouchReorderMove,{capture:true,passive:false});
  document.addEventListener('pointerup',onTouchReorderEnd,{capture:true,passive:false});
  document.addEventListener('pointercancel',onTouchReorderEnd,{capture:true,passive:false});
  window.addEventListener('blur',()=>finishTouchReorder(true),{passive:true});
  window.addEventListener('flow:campus-context-ready',()=>refreshContext({force:true}));
  window.addEventListener('flow:campus-custom-route-rendered',event=>renderCustomRouteList(event.detail));
}
function init(){
  if(initialized)return;const campus=$('#campusView');if(!campus){setTimeout(init,100);return}
  initialized=true;installStyles();moveNearbyQuickAccess();ensureEditor();ensureSearchDialog();bindEvents();refreshContext({force:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
