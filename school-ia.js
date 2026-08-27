const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const MODE_KEY='flow-school-timetable-mode-v1';
let mode='today';
let legacyWeekButton=null;
let inlineWeek=null;

function installStyles(){
  if($('#flow-school-ia-style'))return;
  const style=document.createElement('style');
  style.id='flow-school-ia-style';
  style.textContent=`
/* School information architecture: Week is a representation of the Today timetable, not a separate destination. */
html[data-theme] body .mobile-bottom-nav{--flow-tab-count:5!important;grid-template-columns:repeat(5,minmax(0,1fr))!important}
.side-nav>[data-view="week"]{display:none!important}
.timetable-mode-toggle{display:inline-grid;grid-template-columns:1fr 1fr;min-width:92px;padding:3px;border-radius:12px;background:var(--surface-2);border:1px solid color-mix(in srgb,var(--text) 6%,transparent)}
.timetable-mode-toggle button{min-width:0;min-height:32px;padding:0 9px;border:0;border-radius:9px;background:transparent!important;box-shadow:none!important;color:var(--muted);font-size:.61rem;font-weight:800;cursor:pointer;position:relative!important;z-index:auto!important;overflow:visible!important}
.timetable-mode-toggle button.active{background:var(--surface)!important;color:var(--accent)!important;box-shadow:0 2px 8px rgba(35,52,86,.08)!important}
.timetable-actions{display:flex!important;align-items:center!important;gap:5px!important;flex-wrap:nowrap!important}
.inline-week-timetable{display:grid;gap:9px}
.inline-week-timetable.hidden{display:none!important}
.inline-week-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.inline-week-toolbar #weekRangeText{margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:.62rem;line-height:1.3}
.inline-week-toolbar .week-controls{display:flex;gap:4px;flex:none}
.inline-week-toolbar .week-controls .neo-button{min-height:32px!important;padding:0 8px!important;border-radius:10px!important;font-size:.57rem!important;box-shadow:none!important}
.timetable-card .week-table-wrap{overflow:visible!important;margin:0!important;padding:0!important}
.timetable-card .week-table{width:100%!important;min-width:0!important;grid-template-columns:34px repeat(5,minmax(0,1fr))!important;border-radius:14px!important}
.timetable-card .week-cell{min-width:0!important;min-height:42px!important;padding:5px 4px!important;font-size:.56rem!important;overflow:hidden}
.timetable-card .week-head{min-height:34px!important;padding:4px 2px!important;font-size:.56rem!important;white-space:nowrap}
.timetable-card .week-period{font-size:.58rem!important}
.timetable-card .week-subject{font-size:.56rem!important;line-height:1.22!important;overflow-wrap:anywhere;word-break:keep-all;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.timetable-card .week-cell.is-today-column{background:color-mix(in srgb,var(--accent) 7%,var(--surface))!important}
.timetable-card .week-head.is-today-column{background:color-mix(in srgb,var(--accent) 15%,var(--surface-2))!important;color:var(--accent)!important}
/* The old route host stays rendered off-canvas so route/motion contracts remain intact; all visible Week UI lives inside Today. */
.flow-inline-week-active #weekView{position:absolute!important;left:-9999px!important;top:0!important;width:1px!important;height:1px!important;min-height:1px!important;margin:0!important;padding:0!important;overflow:hidden!important;pointer-events:none!important}
.flow-inline-week-active .timetable-card #dayStrip,.flow-inline-week-active .timetable-card #timetable{display:none!important}
.flow-inline-week-active .timetable-card .inline-week-timetable{display:grid!important}
#scheduleView>.view-header p,#schoolView>.view-header p,#flowSchoolSettingsView .flow-settings-header p{max-width:28rem}
#calendarMonthTitle{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:42px;padding:0 10px;border-radius:12px;cursor:pointer;user-select:none;-webkit-user-select:none}
#calendarMonthTitle::after{content:"";width:7px;height:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px);opacity:.48}
#calendarMonthTitle:active{background:var(--surface-2)}
.calendar-month-native{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;clip-path:inset(50%)!important}
#scheduleView>.view-header>.month-picker{display:none!important}

/* School switching is a destination-like surface, not a modal sheet floating over the page. */
#switchDialog[open][data-flow-dedicated="true"]{display:block!important;position:fixed!important;z-index:75!important;inset:0!important;width:auto!important;max-width:none!important;height:auto!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;background:var(--bg)!important;overflow:auto!important;color:var(--text)!important}
#switchDialog[open][data-flow-dedicated="true"]::backdrop{display:none!important;background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
#switchDialog[data-flow-dedicated="true"]>.sheet{width:min(760px,calc(100% - 32px))!important;max-width:none!important;min-height:100%!important;margin:0 auto!important;padding:clamp(28px,5vw,56px) 0 120px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation:flow-view-enter var(--flow-motion-medium,240ms) var(--flow-motion-spring,cubic-bezier(.16,1,.3,1)) both!important}
#switchDialog[data-flow-dedicated="true"] .flow-sheet-grab-handle{display:none!important}
#switchDialog[data-flow-dedicated="true"] .dialog-close{position:static!important;display:grid!important;place-items:center!important;width:44px!important;height:44px!important;min-width:44px!important;margin:0 0 24px!important;border-radius:14px!important;background:var(--surface-2)!important;color:var(--text)!important;font-size:1.5rem!important;box-shadow:none!important}
#switchDialog[data-flow-dedicated="true"] .section-kicker{margin-bottom:7px}
#switchDialog[data-flow-dedicated="true"] h2{margin:0!important;font-size:clamp(2rem,5vw,3rem)!important;letter-spacing:-.055em!important;line-height:1.02!important}
#switchDialog[data-flow-dedicated="true"] #currentSchoolMeta{margin:10px 0 24px!important;color:var(--muted)!important;font-size:.78rem!important}
#switchDialog[data-flow-dedicated="true"] .modal-search{margin:0!important}
#switchDialog[data-flow-dedicated="true"] .modal-results{position:relative!important;inset:auto!important;top:auto!important;left:auto!important;right:auto!important;margin-top:8px!important;max-height:45vh!important;border-radius:16px!important;box-shadow:none!important;border:1px solid color-mix(in srgb,var(--text) 7%,transparent)!important}
#switchDialog[data-flow-dedicated="true"] #reselectClassBtn{margin-top:16px!important;min-height:46px!important;box-shadow:none!important}
#switchDialog[data-flow-dedicated="true"] #changeSchoolBtn{min-height:44px!important;margin-top:22px!important;border-top:1px solid color-mix(in srgb,var(--danger) 14%,transparent)!important;padding-top:14px!important}

@media(max-width:900px){
  #scheduleView>.view-header p,#schoolView>.view-header p,#flowSchoolSettingsView .flow-settings-header p{display:none!important}
  #scheduleView>.view-header,#schoolView>.view-header{gap:6px!important;padding-bottom:12px!important}
  .flow-settings-view .flow-settings-header{margin-bottom:14px!important}
  .timetable-card .card-heading{grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important}
  .timetable-card .card-heading h2{white-space:nowrap}
  .timetable-actions .neo-button{min-height:34px!important;padding:0 7px!important;font-size:.57rem!important;border-radius:10px!important}
  .timetable-mode-toggle{min-width:82px;padding:2px;border-radius:10px}
  .timetable-mode-toggle button{min-height:30px;padding:0 6px;font-size:.56rem}
  .inline-week-toolbar{align-items:stretch;flex-direction:column;gap:6px}
  .inline-week-toolbar .week-controls{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
  .inline-week-toolbar .week-controls .neo-button{width:100%}
  .timetable-card .week-table{grid-template-columns:30px repeat(5,minmax(0,1fr))!important}
  .timetable-card .week-cell{min-height:39px!important;padding:4px 3px!important}
  .timetable-card .week-subject{font-size:.53rem!important;line-height:1.18!important}
  #switchDialog[open][data-flow-dedicated="true"]{inset:calc(64px + env(safe-area-inset-top)) 0 0!important;z-index:75!important}
  #switchDialog[data-flow-dedicated="true"]>.sheet{width:100%!important;min-height:100%!important;padding:18px 14px 110px!important}
  #switchDialog[data-flow-dedicated="true"] .dialog-close{margin-bottom:16px!important}
  #switchDialog[data-flow-dedicated="true"] h2{font-size:2.15rem!important}
}
@media(max-width:900px) and (max-height:520px){
  #switchDialog[open][data-flow-dedicated="true"]{inset:calc(54px + env(safe-area-inset-top)) 0 0!important}
  #switchDialog[data-flow-dedicated="true"]>.sheet{padding-top:12px!important}
  .inline-week-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center}
  .inline-week-toolbar .week-controls{width:auto;display:flex}
}
`;
  document.head.append(style);
}

function trimPageCopy(){
  const schedule=$('#scheduleView>.view-header p');if(schedule)schedule.textContent='시험 · 행사 · 휴업일';
  const school=$('#schoolView>.view-header p');if(school)school.textContent='학교 기본정보';
  const settings=$('#flowSchoolSettingsView .flow-settings-header p');if(settings)settings.textContent='테마 · 타종 · 급식';
}

function syncTodayColumn(){
  const table=$('#weekTable');if(!table)return;
  const cells=[...table.children];cells.forEach(cell=>{cell.classList.remove('is-today-column');cell.removeAttribute('aria-current')});
  const today=new Date(),column=today.getDay();if(column<1||column>5||cells.length<6)return;
  const header=cells[column],match=header?.textContent?.trim().match(/(\d+)$/);if(!match||Number(match[1])!==today.getDate())return;
  cells.forEach((cell,index)=>{if(index%6===column)cell.classList.add('is-today-column')});header?.setAttribute('aria-current','date');
}

function setBottomTodayActive(){
  $$('#bottomNav>[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view==='today'));
  $$('.side-nav>[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view==='today'));
}

function buildInlineWeek(){
  if(inlineWeek)return inlineWeek;
  const card=$('.timetable-card'),mobileWeek=$('#bottomNav>[data-view="week"]'),range=$('#weekRangeText'),controls=$('#weekView .week-controls'),wrap=$('#weekView .week-table-wrap');
  if(!card||!mobileWeek||!range||!controls||!wrap)return null;
  legacyWeekButton=mobileWeek;
  const actions=$('.timetable-actions',card);if(!actions)return null;
  const toggle=document.createElement('div');toggle.className='timetable-mode-toggle';toggle.setAttribute('role','group');toggle.setAttribute('aria-label','시간표 보기');
  const today=document.createElement('button');today.type='button';today.className='active';today.dataset.timetableMode='today';today.textContent='오늘';today.setAttribute('aria-pressed','true');
  mobileWeek.classList.add('timetable-mode-button');mobileWeek.textContent='주간';mobileWeek.setAttribute('aria-label','주간 시간표');mobileWeek.setAttribute('aria-pressed','false');
  toggle.append(today,mobileWeek);actions.prepend(toggle);
  const shell=document.createElement('div');shell.id='inlineWeekTimetable';shell.className='inline-week-timetable hidden';
  const toolbar=document.createElement('div');toolbar.className='inline-week-toolbar';toolbar.append(range,controls);shell.append(toolbar,wrap);card.append(shell);inlineWeek=shell;
  const legacyHost=$('#weekView');if(legacyHost)legacyHost.setAttribute('aria-hidden','true');
  const desktopWeek=$('.side-nav>[data-view="week"]');if(desktopWeek){desktopWeek.hidden=true;desktopWeek.setAttribute('aria-hidden','true');desktopWeek.tabIndex=-1}
  today.addEventListener('click',()=>setTimetableMode('today',{drive:true}));
  mobileWeek.addEventListener('click',()=>activateInlineWeek());
  $('#editSubjectsBtn')?.addEventListener('click',()=>{if(mode==='week')setTimetableMode('today',{drive:true})});
  return shell;
}

function activateInlineWeek(){
  if(!inlineWeek)buildInlineWeek();if(!inlineWeek)return;
  mode='week';localStorage.setItem(MODE_KEY,'week');
  document.body.classList.add('flow-inline-week-active');
  $('#todayView')?.classList.remove('hidden');
  $('#inlineWeekTimetable')?.classList.remove('hidden');
  const title=$('.timetable-card .card-heading h2');if(title)title.textContent='주간 시간표';
  $('[data-timetable-mode="today"]')?.classList.remove('active');
  $('[data-timetable-mode="today"]')?.setAttribute('aria-pressed','false');
  legacyWeekButton?.classList.add('active');legacyWeekButton?.setAttribute('aria-pressed','true');
  setBottomTodayActive();
  if(location.pathname==='/week')history.replaceState({view:'today'},'', '/home');
  syncTodayColumn();
}

function setTimetableMode(next,{drive=false}={}){
  const normalized=next==='week'?'week':'today';if(!inlineWeek)buildInlineWeek();if(!inlineWeek)return;
  if(normalized==='week'){
    if(drive&&legacyWeekButton){legacyWeekButton.click();return}
    activateInlineWeek();return;
  }
  mode='today';localStorage.setItem(MODE_KEY,'today');document.body.classList.remove('flow-inline-week-active');inlineWeek.classList.add('hidden');
  const title=$('.timetable-card .card-heading h2');if(title)title.textContent='오늘 시간표';
  $('[data-timetable-mode="today"]')?.classList.add('active');$('[data-timetable-mode="today"]')?.setAttribute('aria-pressed','true');
  legacyWeekButton?.classList.remove('active');legacyWeekButton?.setAttribute('aria-pressed','false');
  if(drive){const today=$('#bottomNav>[data-view="today"]')||$('.side-nav>[data-view="today"]');today?.click()}
}

function installMonthPicker(){
  const picker=$('#monthPicker'),label=picker?.closest('.month-picker'),title=$('#calendarMonthTitle'),head=title?.parentElement;if(!picker||!title||!head)return;
  picker.classList.add('calendar-month-native');head.append(picker);if(label)label.hidden=true;
  title.setAttribute('role','button');title.tabIndex=0;title.setAttribute('aria-label','월 선택');
  const open=()=>{try{if(typeof picker.showPicker==='function')picker.showPicker();else picker.click()}catch{picker.click()}};
  title.addEventListener('click',open);title.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}});
}

function openDedicatedSchoolSwitch(event){
  const trigger=event.target.closest?.('#schoolBtn,#mobileSchoolBtn');if(!trigger)return;
  event.preventDefault();event.stopImmediatePropagation();
  const dialog=$('#switchDialog');if(!dialog)return;
  const school=$('#schoolNameTop')?.textContent?.trim()||$('#mobileSchoolName')?.textContent?.trim()||'학교';
  const cls=$('#schoolClassTop')?.textContent?.trim()||$('#mobileClassName')?.textContent?.trim()||'';
  const meta=$('#currentSchoolMeta');if(meta)meta.textContent=[school,cls].filter(Boolean).join(' · ');
  const input=$('#switchSearch');if(input)input.value='';const results=$('#switchResults');if(results){results.classList.add('hidden');results.innerHTML=''}
  dialog.dataset.flowDedicated='true';document.body.classList.add('flow-school-switch-open');
  const close=$('.dialog-close',dialog);if(close){close.textContent='‹';close.setAttribute('aria-label','뒤로')}
  if(!dialog.open)dialog.show();setTimeout(()=>input?.focus({preventScroll:true}),80);
}

function installDedicatedSchoolSwitch(){
  const dialog=$('#switchDialog');if(!dialog)return;
  document.addEventListener('click',openDedicatedSchoolSwitch,true);
  dialog.addEventListener('close',()=>document.body.classList.remove('flow-school-switch-open'));
  document.addEventListener('click',event=>{if(!dialog.open)return;const nav=event.target.closest?.('#bottomNav>[data-view],#mobileSettingsBtn,.side-nav>[data-view],#settingsBtn');if(nav)dialog.close()},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open){event.preventDefault();dialog.close()}},{capture:true});
}

function installNavigationReset(){
  document.addEventListener('click',event=>{
    const destination=event.target.closest?.('[data-view]');if(!destination||destination===legacyWeekButton)return;
    if(mode==='week'&&destination.dataset.view!=='week')setTimetableMode('today',{drive:false});
  });
  for(const button of ['#prevWeek','#thisWeekBtn','#nextWeek'])$(button)?.addEventListener('click',()=>{queueMicrotask(syncTodayColumn);setTimeout(syncTodayColumn,240)});
}

function init(){
  if(!$('#dashboard'))return;installStyles();trimPageCopy();buildInlineWeek();installMonthPicker();installDedicatedSchoolSwitch();installNavigationReset();
  setTimeout(trimPageCopy,0);
  if(location.pathname==='/week')activateInlineWeek();else setTimetableMode('today',{drive:false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();