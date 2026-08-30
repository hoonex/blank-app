const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const BELL_KEY='flow-school-bell-v1';
const PROFILE_KEY='flow-school-profile-v3';
const TRANSIT_LAB_KEY='flow-school-transit-lab-v1';
const observers=[];

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
function pad(value){return String(value).padStart(2,'0')}
function todayKey(){const now=new Date();return`${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`}
function addMinutes(value,minutes){const [hour,minute]=String(value||'00:00').split(':').map(Number);const total=((hour||0)*60+(minute||0)+Number(minutes||0)+1440)%1440;return`${pad(Math.floor(total/60))}:${pad(total%60)}`}
function toMinutes(value){const match=String(value||'').match(/^(\d{2}):(\d{2})$/);return match?Number(match[1])*60+Number(match[2]):NaN}
function defaults(){const kind=readJson(PROFILE_KEY,{})?.school?.kind||'';if(kind.includes('초등'))return{start:'09:00',lesson:40,break:10,meal:'12:10',mealEnd:'13:00'};if(kind.includes('중학'))return{start:'09:00',lesson:45,break:10,meal:'12:20',mealEnd:'13:10'};return{start:'08:30',lesson:50,break:10,meal:'12:20',mealEnd:'13:10'}}
function bellConfig(){const cfg={...defaults(),...readJson(BELL_KEY,{})};if(!cfg.mealEnd)cfg.mealEnd=addMinutes(cfg.meal||'12:20',50);return cfg}
function localTransitLab(){const host=location.hostname;return(host==='127.0.0.1'||host==='localhost')&&localStorage.getItem(TRANSIT_LAB_KEY)!=='off'}

function installStyle(){
  if($('#flow-school-surface-cleanup-style'))return;
  const style=document.createElement('style');style.id='flow-school-surface-cleanup-style';style.textContent=`
#todayView .status-card.flow-home-noise{display:none!important}
#todayView .status-grid{grid-template-columns:minmax(0,1.45fr) minmax(0,1fr)!important}
.flow-bell-summary{display:grid;gap:5px;margin-top:14px;padding:13px 14px;border-radius:14px;background:var(--surface-2);border:1px solid color-mix(in srgb,var(--text) 6%,transparent)}
.flow-bell-summary>span{font-size:.58rem;font-weight:800;letter-spacing:.06em;color:var(--muted)}
.flow-bell-summary>strong{font-size:.75rem;line-height:1.55;letter-spacing:-.025em;color:var(--text);word-break:keep-all}
#flowSchoolSettingsView .flow-settings-fields.flow-meal-window{grid-template-columns:repeat(2,minmax(0,1fr))}
#settingsDialog .setting-fields.flow-meal-window{grid-template-columns:repeat(2,minmax(0,1fr))}
.flow-future-empty{margin-top:4px}
.calendar-day.flow-past-day .calendar-dot,.calendar-day.flow-past-day .calendar-event-label{display:none!important}
html[data-flow-transit-surface="dormant"] .mobile-bottom-nav{--flow-tab-count:4!important;grid-template-columns:repeat(4,minmax(0,1fr))!important}
html[data-flow-transit-surface="dormant"] [data-flow-transit-nav],html[data-flow-transit-surface="dormant"] #transitView{display:none!important}
@media(max-width:900px){
  #todayView .status-grid{grid-template-columns:minmax(0,1.35fr) minmax(0,.85fr)!important}
  #todayView .clock-card{grid-column:auto!important}
  #flowSchoolSettingsView .flow-settings-fields.flow-meal-window{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:360px){#todayView .status-grid{grid-template-columns:1fr!important}}
`;
  document.head.append(style);
}

function hideHomeNoise(){
  $('#quickLessons')?.closest('.status-card')?.classList.add('flow-home-noise');
  $('#quickMeal')?.closest('.status-card')?.classList.add('flow-home-noise');
}

function retireTransitSurface(){
  if(localTransitLab())return;
  document.documentElement.dataset.flowTransitSurface='dormant';
  $$('[data-flow-transit-nav]').forEach(node=>node.remove());
  $('#transitView')?.remove();
  if(location.pathname==='/transit'){
    history.replaceState({view:'today'},'', '/home');
    queueMicrotask(()=>($('#bottomNav>[data-view="today"]')||$('.side-nav>[data-view="today"]'))?.click());
  }
}

function parseScheduleDate(row){const raw=$('time',row)?.textContent||'';const digits=raw.replace(/\D/g,'');return digits.length>=8?digits.slice(0,8):''}
function filterPastSchedule(){
  const cutoff=todayKey(),grid=$('#scheduleGrid');
  if(grid){
    const heading=grid.closest('.content-card')?.querySelector('.card-heading h2');if(heading)heading.textContent='남은 일정';
    const rows=$$('.schedule-row',grid);let visible=0;
    rows.forEach(row=>{const key=parseScheduleDate(row),past=Boolean(key&&key<cutoff);row.hidden=past;if(!past)visible+=1});
    let empty=$('.flow-future-empty',grid);
    const nativeEmpty=$('.empty:not(.flow-future-empty)',grid);
    if(!visible&&rows.length){if(!empty){empty=document.createElement('div');empty.className='empty flow-future-empty';grid.append(empty)}empty.textContent='남은 학사일정이 없습니다.';nativeEmpty?.classList.add('hidden')}
    else{empty?.remove();nativeEmpty?.classList.remove('hidden')}
  }
  $$('.calendar-day[data-calendar-date]').forEach(day=>day.classList.toggle('flow-past-day',String(day.dataset.calendarDate||'')<cutoff));
  $$('#nationalScheduleCard .national-event').forEach(event=>{
    const month=String($('#monthPicker')?.value||'');const md=$('time',event)?.textContent?.replace(/\D/g,'')||'';const key=month&&md.length>=4?`${month.replace('-','')}${md.slice(0,4)}`:'';event.hidden=Boolean(key&&key<cutoff);
  });
}

function summaryText(values){return`1교시 ${values.start} · 수업 ${values.lesson}분 · 쉬는 시간 ${values.break}분 · 급식 ${values.meal}–${values.mealEnd}`}
function valuesFrom(root){const cfg=bellConfig();const get=(selector,fallback)=>$(selector,root)?.value||fallback;return{start:get('[data-flow-bell="start"],#bellStart',cfg.start),lesson:Math.max(30,Math.min(90,Number(get('[data-flow-bell="lesson"],#lessonMinutes',cfg.lesson))||cfg.lesson)),break:Math.max(5,Math.min(30,Number(get('[data-flow-bell="break"],#breakMinutes',cfg.break))||cfg.break)),meal:get('[data-flow-bell="meal"],#mealStart',cfg.meal),mealEnd:get('[data-flow-bell="mealEnd"],#mealEnd',cfg.mealEnd)}}
function ensureSummary(host,root){let summary=$('.flow-bell-summary',host);if(!summary){summary=document.createElement('div');summary.className='flow-bell-summary';summary.innerHTML='<span>현재 설정 미리보기</span><strong></strong>';host.append(summary)}const render=()=>{const values=valuesFrom(root);$('strong',summary).textContent=summaryText(values)};if(!root.dataset.flowBellPreviewBound){root.dataset.flowBellPreviewBound='true';root.addEventListener('input',event=>{if(event.target.matches?.('input[type="time"],input[type="number"]'))render()})}render();return summary}
function ensureSettings(){
  const cfg=bellConfig();
  const panel=$('#flowSchoolSettingsView');
  if(panel){
    const mealInput=$('[data-flow-bell="meal"]',panel),mealFields=mealInput?.closest('.flow-settings-fields');
    if(mealFields){mealFields.classList.remove('one');mealFields.classList.add('flow-meal-window');if(!$('[data-flow-bell="mealEnd"]',mealFields)){const label=document.createElement('label');label.innerHTML='점심 종료<input type="time" data-flow-bell="mealEnd">';mealFields.append(label)}const end=$('[data-flow-bell="mealEnd"]',mealFields);if(end&&!end.value)end.value=cfg.mealEnd}
    const bellCard=$('[data-flow-bell="start"]',panel)?.closest('.flow-settings-card');if(bellCard)ensureSummary(bellCard,panel);
  }
  const dialog=$('#settingsDialog');
  if(dialog){
    const mealInput=$('#mealStart',dialog),mealFields=mealInput?.closest('.setting-fields');
    if(mealFields){mealFields.classList.add('flow-meal-window');if(!$('#mealEnd',mealFields)){const label=document.createElement('label');label.innerHTML='점심 종료<input id="mealEnd" type="time">';mealFields.append(label)}const end=$('#mealEnd',mealFields);if(end&&!end.value)end.value=cfg.mealEnd}
    const bellGroup=$('#bellStart',dialog)?.closest('.settings-group');if(bellGroup)ensureSummary(bellGroup,dialog);
  }
}
function refreshSettings(){const cfg=bellConfig();for(const root of [$('#flowSchoolSettingsView'),$('#settingsDialog')].filter(Boolean)){const end=$('[data-flow-bell="mealEnd"],#mealEnd',root);if(end)end.value=cfg.mealEnd;const summary=$('.flow-bell-summary',root);if(summary)$('strong',summary).textContent=summaryText(valuesFrom(root))}}
function validMealWindow(values){return Number.isFinite(toMinutes(values.meal))&&Number.isFinite(toMinutes(values.mealEnd))&&toMinutes(values.mealEnd)>toMinutes(values.meal)}
function toast(message){const node=$('#toast');if(!node)return;node.textContent=message;node.classList.add('show');setTimeout(()=>node.classList.remove('show'),1800)}
function saveValues(root){const values=valuesFrom(root);if(!validMealWindow(values)){toast('급식 종료 시간은 시작 시간보다 뒤로 설정해주세요.');return false}writeJson(BELL_KEY,values);syncMealFooter();const summary=$('.flow-bell-summary',root);if(summary)$('strong',summary).textContent=summaryText(values);window.dispatchEvent(new CustomEvent('flow:school-time-settings',{detail:values}));toast('시간 설정을 저장했습니다.');return true}
function handleSave(event){
  const flowSave=event.target.closest?.('[data-flow-save-school]');if(flowSave){event.preventDefault();event.stopImmediatePropagation();const panel=$('#flowSchoolSettingsView');if(panel)saveValues(panel);return}
  const legacy=event.target.closest?.('#saveSettingsBtn');if(legacy){event.preventDefault();event.stopImmediatePropagation();const dialog=$('#settingsDialog');if(dialog&&saveValues(dialog)){dialog.close();document.body.classList.remove('dialog-open')}return}
}

function syncMealFooter(){
  const node=$('#mealCal');if(!node||!node.textContent.trim())return;const cfg=bellConfig(),rest=node.textContent.split(' · ').filter(part=>!part.trim().startsWith('급식 '));const next=[`급식 ${cfg.meal}–${cfg.mealEnd}`,...rest].join(' · ');if(node.textContent!==next)node.textContent=next
}

function attachObservers(){
  const schedule=$('#scheduleGrid'),calendar=$('#calendarGrid'),meal=$('#mealCal');
  if(schedule){const observer=new MutationObserver(filterPastSchedule);observer.observe(schedule,{childList:true,subtree:true});observers.push(observer)}
  if(calendar){const observer=new MutationObserver(filterPastSchedule);observer.observe(calendar,{childList:true,subtree:true});observers.push(observer)}
  if(meal){const observer=new MutationObserver(syncMealFooter);observer.observe(meal,{childList:true,subtree:true,characterData:true});observers.push(observer)}
  if(!localTransitLab()){
    const observer=new MutationObserver(retireTransitSurface);observer.observe(document.body,{childList:true,subtree:true});observers.push(observer)
  }
}
function bind(){
  document.addEventListener('click',handleSave,true);
  document.addEventListener('click',event=>{if(event.target.closest?.('#mobileSettingsBtn,#settingsBtn'))queueMicrotask(()=>{ensureSettings();refreshSettings()})});
  window.addEventListener('flow:school-time-settings',()=>{refreshSettings();syncMealFooter()});
}
function init(){installStyle();hideHomeNoise();ensureSettings();filterPastSchedule();syncMealFooter();retireTransitSurface();attachObservers();bind();queueMicrotask(()=>{retireTransitSurface();filterPastSchedule();syncMealFooter()});document.documentElement.dataset.flowSchoolSurfaceCleanup='ready'}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
