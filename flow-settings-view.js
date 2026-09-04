const SCHOOL_THEME_KEY='flow-school-theme-v3';
const UNIVERSITY_THEME_KEY='flow-university-theme-v1';
const BELL_KEY='flow-school-bell-v1';
const SCHOOL_PROFILE_KEY='flow-school-profile-v3';
const GLASS_KEY='flow-glass-mode-v2';

const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
let toastTimer=0;
function read(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function dismissToast(){const node=$('#toast');if(!node)return;clearTimeout(toastTimer);toastTimer=0;node.classList.remove('show')}
function toast(message){const node=$('#toast');if(!node)return;clearTimeout(toastTimer);node.textContent=message;node.classList.add('show');toastTimer=setTimeout(()=>{node.classList.remove('show');toastTimer=0},1800)}
function ensureStyles(){
  if($('#flow-settings-view-style'))return;
  const style=document.createElement('style');style.id='flow-settings-view-style';style.textContent=`
.flow-settings-view{padding-bottom:110px}
.flow-settings-view.flow-settings-enter:not(.hidden){animation:flow-view-enter var(--flow-motion-medium,240ms) var(--flow-motion-spring,cubic-bezier(.16,1,.3,1)) both!important;transform-origin:50% 18%}
.flow-settings-view .flow-settings-header{margin-bottom:22px}
.flow-settings-view .flow-settings-header h1{margin:0 0 7px;font-size:clamp(2rem,4vw,3rem);letter-spacing:-.06em;line-height:1}
.flow-settings-view .flow-settings-header p{margin:0;color:var(--muted);font-size:.9rem;line-height:1.55}
.flow-settings-view .flow-settings-stack{display:grid;gap:14px;max-width:820px}
.flow-settings-view .flow-settings-card{padding:22px;border-radius:22px;background:var(--surface);border:1px solid color-mix(in srgb,var(--text) 7%,transparent);box-shadow:0 12px 34px rgba(31,42,68,.055)}
.flow-settings-view .flow-settings-card h2{margin:0 0 5px;font-size:1.05rem;letter-spacing:-.035em}
.flow-settings-view .flow-settings-card>p{margin:0 0 16px;color:var(--muted);font-size:.76rem;line-height:1.55;word-break:keep-all}
.flow-settings-view .flow-settings-segment{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.flow-settings-view .flow-settings-segment.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.flow-settings-view .flow-settings-segment button,.flow-settings-view .flow-settings-action{min-height:46px;border:1px solid color-mix(in srgb,var(--text) 8%,transparent);border-radius:14px;background:var(--surface-2);color:var(--text);font:inherit;font-weight:760;cursor:pointer}
.flow-settings-view .flow-settings-segment button.active{background:color-mix(in srgb,var(--accent) 12%,var(--surface-2));border-color:color-mix(in srgb,var(--accent) 34%,transparent);color:var(--accent)}
.flow-settings-view .flow-settings-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.flow-settings-view .flow-settings-fields.one{grid-template-columns:minmax(0,260px)}
.flow-settings-view label{display:grid;gap:7px;color:var(--muted);font-size:.72rem;font-weight:680}
.flow-settings-view input{width:100%;min-width:0;min-height:46px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--text) 8%,transparent);border-radius:14px;background:var(--surface-2);color:var(--text);padding:0 14px;font:inherit;font-size:.86rem;outline:none}
.flow-settings-view input:focus{border-color:color-mix(in srgb,var(--accent) 48%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 10%,transparent)}
.flow-settings-view .flow-settings-save{margin-top:16px;min-height:48px;width:100%;border:0;border-radius:14px;background:var(--text);color:var(--bg);font:inherit;font-weight:800;cursor:pointer}
.flow-settings-view .flow-settings-meta{display:block;margin-top:10px;color:var(--muted);font-size:.68rem;line-height:1.5}
.flow-settings-sheet>.kicker{display:none!important}
html[data-theme] body .mobile-bottom-nav:has(> .mobile-tab.active:nth-child(5)),html[data-theme] body .bottom-nav:has(> .bottom-item.active:nth-child(5)){--flow-tab-index:4}
html[data-theme] body :is(.mobile-bottom-nav,.bottom-nav)>.flow-mobile-settings{border:0!important;box-shadow:none!important;background:transparent!important;border-radius:0!important}
@media(max-width:900px){
  .flow-settings-view{padding-top:4px}
  #flowSchoolSettingsView:not(.hidden),#flowUniversitySettingsView:not(.hidden){position:fixed;z-index:35;inset:64px 0 0;overflow-y:auto;overscroll-behavior:contain;background:var(--bg);padding:18px 11px 112px}
  .flow-settings-view .flow-settings-stack{gap:12px}.flow-settings-view .flow-settings-card{padding:18px;border-radius:18px}.flow-settings-view .flow-settings-fields{grid-template-columns:1fr}.flow-settings-view .flow-settings-fields.one{grid-template-columns:1fr}.flow-settings-view .flow-settings-header h1{font-size:2.15rem}.flow-settings-view .flow-settings-header p{font-size:.8rem}
}
@media(max-width:900px) and (max-height:520px){#flowSchoolSettingsView:not(.hidden),#flowUniversitySettingsView:not(.hidden){inset:54px 0 0;padding-top:10px}}
@media(max-width:430px){.flow-settings-view .flow-settings-card{padding:16px}.flow-settings-view .flow-settings-segment{gap:6px}.flow-settings-view .flow-settings-segment button{font-size:.78rem}}
@media(prefers-reduced-motion:reduce){.flow-settings-view.flow-settings-enter:not(.hidden){animation:none!important}}
`;
  document.head.append(style);
}
function themeValue(kind){const key=kind==='school'?SCHOOL_THEME_KEY:UNIVERSITY_THEME_KEY;const value=localStorage.getItem(key)||'light';return['light','system','dark'].includes(value)?value:'light'}
function fallbackTheme(kind,value){
  const key=kind==='school'?SCHOOL_THEME_KEY:UNIVERSITY_THEME_KEY,effective=value==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):value,root=document.documentElement;
  localStorage.setItem(key,value);root.dataset.theme=effective;root.dataset.themeMode=value;root.style.colorScheme=effective==='dark'?'dark':'only light';
  $('meta[name="color-scheme"]')?.setAttribute('content',effective==='dark'?'dark':'only light');
  $('meta[name="theme-color"]')?.setAttribute('content',effective==='dark'?'#202833':kind==='school'?'#edf2f7':'#f5f7fa');
}
function applyTheme(kind,value){
  const relay=kind==='school'?$(`#themeSegment [data-theme-choice="${value}"]`):$(`#flowUniversitySettingsDialog [data-flow-university-theme-choice="${value}"]`)||$(`.flow-theme-segment [data-university-theme="${value}"]`);
  if(relay)relay.click();else fallbackTheme(kind,value);
  syncPanels({fill:false});
}
function glassValue(){return localStorage.getItem(GLASS_KEY)==='optical'?'optical':'standard'}
function applyGlass(value){
  const relay=$(`#settingsDialog [data-flow-glass-choice="${value}"]`)||$(`#flowUniversitySettingsDialog [data-flow-glass-choice="${value}"]`);
  if(relay)relay.click();else localStorage.setItem(GLASS_KEY,value==='optical'?'optical':'standard');
  syncPanels({fill:false});
}
function themeButtons(kind){return`<div class="flow-settings-segment" data-flow-settings-theme-host>${[['light','밝게'],['system','기기 설정'],['dark','어둡게']].map(([value,label])=>`<button type="button" data-flow-settings-theme="${value}">${label}</button>`).join('')}</div>`}
function glassButtons(){return`<div class="flow-settings-segment two">${[['standard','기본'],['optical','Optical']].map(([value,label])=>`<button type="button" data-flow-settings-glass="${value}">${label}</button>`).join('')}</div><small class="flow-settings-meta" data-flow-settings-glass-status></small>`}
function schoolDefaults(){const kind=read(SCHOOL_PROFILE_KEY,{})?.school?.kind||'';if(kind.includes('초등'))return{start:'09:00',lesson:40,break:10,meal:'12:10'};if(kind.includes('중학'))return{start:'09:00',lesson:45,break:10,meal:'12:20'};return{start:'08:30',lesson:50,break:10,meal:'12:20'}}
function schoolBell(){return{...schoolDefaults(),...read(BELL_KEY,{})}}
function schoolMarkup(){return`<header class="flow-settings-header"><h1>설정</h1><p>화면과 학교생활 표시 기준을 이 기기에서 조정합니다.</p></header><div class="flow-settings-stack"><section class="flow-settings-card"><h2>화면</h2><p>밝기 모드는 직접 선택한 값을 우선합니다. 기기 설정일 때만 시스템 테마를 따릅니다.</p>${themeButtons('school')}</section><section class="flow-settings-card"><h2>예상 타종표</h2><p>현재 교시 표시에 사용하는 기준입니다.</p><div class="flow-settings-fields"><label>1교시 시작<input type="time" data-flow-bell="start"></label><label>수업 시간<input type="number" min="30" max="90" inputmode="numeric" data-flow-bell="lesson"></label><label>쉬는 시간<input type="number" min="5" max="30" inputmode="numeric" data-flow-bell="break"></label></div></section><section class="flow-settings-card"><h2>급식 시간</h2><p>급식 카드에서 점심 시간 판단에 사용합니다.</p><div class="flow-settings-fields one"><label>점심 시작<input type="time" data-flow-bell="meal"></label></div></section><section class="flow-settings-card"><h2>유리 효과</h2><p>기본은 뒤 표면이 읽히는 안정적인 유리입니다. Optical은 지원되는 Chromium에서 굴절과 하이라이트를 더 분명하게 표시합니다.</p>${glassButtons()}</section><section class="flow-settings-card"><h2>앱처럼 사용</h2><p>지원되는 브라우저에서는 홈 화면에 설치할 수 있습니다.</p><button class="flow-settings-action" data-flow-install type="button">홈 화면에 설치</button></section><button class="flow-settings-save" data-flow-save-school type="button">설정 저장</button></div>`}
function universityMarkup(){return`<header class="flow-settings-header"><h1>설정</h1><p>화면 표현과 유리 효과를 이 기기에서 조정합니다.</p></header><div class="flow-settings-stack"><section class="flow-settings-card"><h2>화면</h2><p>밝게·어둡게를 직접 고정하거나 기기 설정을 따를 수 있습니다.</p>${themeButtons('university')}</section><section class="flow-settings-card"><h2>유리 효과</h2><p>기본은 뒤 표면이 읽히는 안정적인 유리입니다. Optical은 지원 브라우저에서 굴절과 하이라이트를 더 분명하게 표시합니다.</p>${glassButtons()}</section><section class="flow-settings-card"><h2>내 데이터</h2><p>시간표와 대학 설정은 이 기기에 저장됩니다. 필요하면 백업 파일로 보관할 수 있습니다.</p><div class="flow-settings-segment two"><button type="button" data-flow-backup="export">백업 저장</button><button type="button" data-flow-backup="import">백업 불러오기</button></div></section></div>`}
function makePanel(kind){
  const id=kind==='school'?'flowSchoolSettingsView':'flowUniversitySettingsView';if($('#'+id))return $('#'+id);
  const panel=document.createElement('section');panel.id=id;panel.className='view hidden flow-settings-view';
  if(kind==='school'){panel.dataset.viewPanel='flow-settings';panel.innerHTML=schoolMarkup();const footer=$('.product-main>.source-note');(footer?.parentElement||$('.product-main'))?.insertBefore(panel,footer||null)}
  else{panel.dataset.panel='flow-settings';panel.innerHTML=universityMarkup();$('.main')?.append(panel)}
  panel.addEventListener('click',event=>{
    const theme=event.target.closest('[data-flow-settings-theme]');if(theme)return applyTheme(kind,theme.dataset.flowSettingsTheme);
    const glass=event.target.closest('[data-flow-settings-glass]');if(glass)return applyGlass(glass.dataset.flowSettingsGlass);
    if(event.target.closest('[data-flow-save-school]'))return saveSchool(panel);
    if(event.target.closest('[data-flow-install]'))return $('#installBtn')?.click();
    const backup=event.target.closest('[data-flow-backup]');if(backup){if(backup.dataset.flowBackup==='export')$('#exportBackupBtn')?.click();else $('#importBackupBtn')?.click()}
  });
  return panel
}
function fillSchool(panel){const cfg=schoolBell();for(const key of ['start','lesson','break','meal']){const input=panel.querySelector(`[data-flow-bell="${key}"]`);if(input)input.value=String(cfg[key]??'')}}
function saveSchool(panel){const value=(key)=>panel.querySelector(`[data-flow-bell="${key}"]`)?.value||'';const cfg={start:value('start')||'08:30',lesson:Math.max(30,Math.min(90,Number(value('lesson'))||50)),break:Math.max(5,Math.min(30,Number(value('break'))||10)),meal:value('meal')||'12:20'};localStorage.setItem(BELL_KEY,JSON.stringify(cfg));panel.querySelector(':focus')?.blur();toast('설정을 저장했습니다.')}
function syncPanel(kind,panel,{fill=true}={}){
  const theme=themeValue(kind),glass=glassValue();panel.querySelectorAll('[data-flow-settings-theme]').forEach(button=>button.classList.toggle('active',button.dataset.flowSettingsTheme===theme));panel.querySelectorAll('[data-flow-settings-glass]').forEach(button=>button.classList.toggle('active',button.dataset.flowSettingsGlass===glass));
  const status=panel.querySelector('[data-flow-settings-glass-status]');if(status){const refraction=document.documentElement.dataset.flowGlassRefraction||'off';status.textContent=glass==='standard'?'기본 유리 · 뒤 표면을 유지하는 안정 모드':refraction==='true'?'Optical Glass 활성화 · 실시간 굴절 사용':'Optical Glass 선택됨 · 굴절 준비 중 또는 기본 유리로 대체됨'}
  if(kind==='school'&&fill)fillSchool(panel)
}
function syncPanels({fill=true}={}){const school=$('#flowSchoolSettingsView'),university=$('#flowUniversitySettingsView');if(school)syncPanel('school',school,{fill});if(university)syncPanel('university',university,{fill})}
function settingsTriggers(kind){return kind==='school'?$$('#mobileSettingsBtn,#settingsBtn'):$$('.flow-mobile-settings,.flow-university-settings-button')}
function restartSettingsMotion(panel){
  panel.classList.remove('flow-settings-enter');
  void panel.offsetWidth;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  panel.classList.add('flow-settings-enter');
  panel.addEventListener('animationend',()=>panel.classList.remove('flow-settings-enter'),{once:true});
}
function showSettings(kind){
  dismissToast();const panel=makePanel(kind);if(!panel)return;const group=kind==='school'?'[data-view-panel]':'[data-panel]';$$(group).forEach(node=>node.classList.toggle('hidden',node!==panel));restartSettingsMotion(panel);$$('[data-view]').forEach(node=>node.classList.remove('active'));settingsTriggers(kind).forEach(node=>node.classList.add('active'));syncPanel(kind,panel);
  const old=kind==='school'?$('#settingsDialog'):$('#flowUniversitySettingsDialog');if(old?.open)old.close();
}
function isSchool(){return Boolean($('#dashboard')&&$('#settingsDialog'))}
function isUniversity(){return Boolean($('#appView')&&$('.mobile-header'))}
function init(){
  ensureStyles();const kind=isSchool()?'school':isUniversity()?'university':'';if(!kind)return;makePanel(kind);syncPanels();
  document.addEventListener('click',event=>{const trigger=event.target.closest(kind==='school'?'#mobileSettingsBtn,#settingsBtn':'.flow-mobile-settings,.flow-university-settings-button');if(!trigger)return;event.preventDefault();event.stopImmediatePropagation();showSettings(kind)},true);
  document.addEventListener('click',event=>{const view=event.target.closest('[data-view]');if(view&&!view.matches('#mobileSettingsBtn,.flow-mobile-settings')){dismissToast();settingsTriggers(kind).forEach(node=>node.classList.remove('active'))}});
  window.addEventListener('popstate',()=>{dismissToast();settingsTriggers(kind).forEach(node=>node.classList.remove('active'))},{passive:true});
  window.addEventListener('flow:glass-mode-changed',()=>syncPanels({fill:false}),{passive:true});
  setTimeout(()=>{makePanel(kind);syncPanels()},0)
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();