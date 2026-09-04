(()=>{
  if(window.__flowOpticalAmbientInstalled)return;
  window.__flowOpticalAmbientInstalled=true;

  /*
   * Compatibility entry point for retired ambient glass.
   *
   * The former floating "dynamic glass" object remains fully retired. Keep this
   * entry point for cached refraction bundles, and use only a bounded post-scroll
   * geometry tail so the real Optical copy cannot retain a one-frame stale scene
   * position after rapid direction reversals. No persistent animation loop runs.
   *
   * This module also owns the final, passive School visual contract. Time-of-day
   * ambient color already comes from flow-experience.js; the contract below lets
   * that color reach glass, cards and shadows very lightly instead of changing
   * only the page background. It also normalizes visible School geometry to plain
   * circular rounding and a small responsive spacing scale.
   */
  try{localStorage.removeItem('flow-optical-jelly-v1')}catch{}
  const root=document.documentElement;
  root.removeAttribute('data-flow-optical-jelly');
  document.querySelectorAll('.flow-optical-jelly,[data-flow-jelly-setting]').forEach(node=>node.remove());

  const VISUAL_STYLE_ID='flow-school-visual-contract-v7';
  function installVisualContract(){
    let style=document.querySelector(`#${VISUAL_STYLE_ID}`);
    if(!style){
      style=document.createElement('style');
      style.id=VISUAL_STYLE_ID;
      style.textContent=`
/* Final School visual contract: one spacing rhythm, ordinary round corners, and
   a restrained time-of-day tint that reaches surfaces instead of the backdrop only. */
html[data-flow-school-ui="v2"] body #dashboard:not(.hidden){
  --flow-school-page-inset:18px;
  --flow-school-section-gap:16px;
  --flow-school-control-gap:8px;
  --flow-school-card-pad:18px;
  --flow-school-card-radius:20px;
  --flow-school-control-radius:12px;
}
@media(max-width:699px){
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden){
    --flow-school-page-inset:10px;
    --flow-school-section-gap:12px;
    --flow-school-control-gap:8px;
    --flow-school-card-pad:15px;
    --flow-school-card-radius:18px;
  }
}
@media(min-width:700px) and (max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden){
    --flow-school-page-inset:18px;
    --flow-school-section-gap:16px;
    --flow-school-control-gap:8px;
    --flow-school-card-pad:18px;
    --flow-school-card-radius:20px;
  }
}
@media(min-width:1181px){
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden){
    --flow-school-section-gap:18px;
    --flow-school-control-gap:10px;
    --flow-school-card-pad:18px;
    --flow-school-card-radius:20px;
  }
}

/* Nothing in the visible School product uses a superellipse. Pills remain pills;
   cards and controls are ordinary rounded rectangles. */
html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) :where(
  .status-card,.content-card,.timetable-card,.meal-card,.upcoming-card,.calendar-card,
  .week-card,.profile-hero,.info-tile,.rank-card,.national-schedule-card,.flow-settings-card,
  .period-button,.period-no,.meal-tab,.dish,.timetable-mode-toggle,.timetable-mode-toggle button,
  .flow-school-utility-action,.timetable-actions>.neo-button,#allergyBtn,.mobile-school-button,
  #flowTodayDateDock .flow-date-focus,#flowTodayDateDock .flow-date-day,#flowTodayDateDock .flow-date-edge,
  .flow-exam-card-v5,.flow-exam-card-v5::after,.flow-adfit-rail--school-top,
  .mobile-tab,.school-actions .neo-button,.month-picker,.calendar-day
){corner-shape:round!important}

/* Bottom navigation and the moving material follower are true circular pills. */
@media(max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #bottomNav.mobile-bottom-nav,
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.mobile-tab,
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #bottomNav.mobile-bottom-nav::before,
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
    border-radius:9999px!important;
    corner-shape:round!important;
  }
}

/* Today spacing uses one hierarchy instead of unrelated 7/8/9/12/16px gaps. */
html[data-flow-school-ui="v2"] body #todayView{
  --flow-today-gap:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #todayView .status-grid{
  gap:var(--flow-school-control-gap)!important;
  margin-bottom:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #todayView :where(.today-grid,.right-stack){
  gap:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #todayView .timetable-actions{
  gap:var(--flow-school-control-gap)!important;
}
html[data-flow-school-ui="v2"] body #todayView :where(.timetable-card,.right-stack>.meal-card,.right-stack>.upcoming-card){
  padding:var(--flow-school-card-pad)!important;
  border-radius:var(--flow-school-card-radius)!important;
}
html[data-flow-school-ui="v2"] body #todayView .status-card:not(.flow-home-noise){
  border-radius:var(--flow-school-card-radius)!important;
}
@media(max-width:1180px){
  html[data-flow-school-ui="v2"] body #todayView{padding-inline:var(--flow-school-page-inset)!important}
}

/* Other destinations share the same macro rhythm without replacing their layout. */
html[data-flow-school-ui="v2"] body :where(#scheduleView,#schoolView,#flowSchoolSettingsView) :where(
  .schedule-layout,.school-info-grid,.school-actions,.flow-settings-stack
){gap:var(--flow-school-section-gap)!important}

/* Ambient color is deliberately weak on surfaces. Text colors stay untouched. */
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard:not(.hidden){
  --flow-school-ambient-surface:color-mix(in srgb,var(--surface) 95%,var(--flow-ambient-a) 5%);
  --flow-school-ambient-surface-2:color-mix(in srgb,var(--surface-2) 94%,var(--flow-ambient-b) 6%);
  --flow-school-ambient-edge:color-mix(in srgb,var(--text) 6%,var(--flow-ambient-a) 4%);
  --flow-school-ambient-shadow:color-mix(in srgb,rgba(31,42,68,.11) 84%,var(--flow-ambient-b) 16%);
  --flow-school-ambient-specular:color-mix(in srgb,rgba(255,255,255,.82) 90%,var(--flow-ambient-a) 10%);
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body::before{opacity:.62!important}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard:not(.hidden) .product-main{
  background-color:color-mix(in srgb,var(--bg) 90%,transparent)!important;
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard:not(.hidden) :where(
  .status-card:not(.flow-home-noise),.content-card,.calendar-card,.week-card,.info-tile,.rank-card,
  .national-schedule-card,.flow-settings-card
){
  background-color:var(--flow-school-ambient-surface)!important;
  border-color:var(--flow-school-ambient-edge)!important;
  box-shadow:0 10px 28px var(--flow-school-ambient-shadow),inset 0 1px 0 var(--flow-school-ambient-specular)!important;
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard:not(.hidden) :where(
  .period-button,.dish,.timetable-mode-toggle,.flow-school-utility-action,.timetable-actions>.neo-button,
  #allergyBtn,.month-picker,.calendar-day
){background-color:var(--flow-school-ambient-surface-2)!important}

/* The app chrome shares the same time temperature, so the page no longer looks
   like a colored wallpaper behind unrelated neutral controls. */
@media(max-width:1180px){
  html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard:not(.hidden) .mobile-topbar{
    background:color-mix(in srgb,var(--surface) 86%,var(--flow-ambient-a) 14%)!important;
    border-bottom-color:color-mix(in srgb,var(--text) 6%,var(--flow-ambient-a) 5%)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard:not(.hidden) #bottomNav.mobile-bottom-nav{
    background:color-mix(in srgb,var(--flow-glass-fill,rgba(248,250,253,.54)) 91%,var(--flow-ambient-b) 9%)!important;
    border-color:color-mix(in srgb,var(--flow-glass-edge,rgba(255,255,255,.68)) 88%,var(--flow-ambient-a) 12%)!important;
    box-shadow:0 10px 28px color-mix(in srgb,var(--flow-glass-depth,rgba(34,51,82,.12)) 86%,var(--flow-ambient-b) 14%),inset 0 1px 0 var(--flow-school-ambient-specular)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard:not(.hidden) #bottomNav.mobile-bottom-nav::before{
    background:
      radial-gradient(130% 112% at var(--flow-lens-light-x,34%) -8%,var(--flow-school-ambient-specular) 0%,rgba(255,255,255,.08) 31%,transparent 60%),
      linear-gradient(180deg,color-mix(in srgb,var(--flow-ambient-a) 7%,rgba(255,255,255,.07)),color-mix(in srgb,var(--flow-ambient-b) 5%,rgba(255,255,255,.018)))!important;
  }
}

/* Dark mode keeps the same idea but reduces the tint to prevent muddy surfaces. */
html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="dark"] body #dashboard:not(.hidden){
  --flow-school-ambient-surface:color-mix(in srgb,var(--surface) 97%,var(--flow-ambient-a) 3%);
  --flow-school-ambient-surface-2:color-mix(in srgb,var(--surface-2) 96%,var(--flow-ambient-b) 4%);
  --flow-school-ambient-edge:color-mix(in srgb,rgba(255,255,255,.08) 92%,var(--flow-ambient-a) 8%);
  --flow-school-ambient-shadow:color-mix(in srgb,rgba(0,0,0,.24) 91%,var(--flow-ambient-b) 9%);
  --flow-school-ambient-specular:color-mix(in srgb,rgba(255,255,255,.14) 92%,var(--flow-ambient-a) 8%);
}
`;
      document.head.append(style);
    }
    return style;
  }
  function raiseVisualContract(){
    const style=installVisualContract();
    if(style.parentElement===document.head&&document.head.lastElementChild!==style)document.head.append(style);
  }
  raiseVisualContract();
  const headObserver=new MutationObserver(()=>queueMicrotask(raiseVisualContract));
  headObserver.observe(document.head,{childList:true});
  root.dataset.flowSchoolVisualContract='v7';

  const INSET=5;
  let tailTimers=[];
  const visible=node=>{if(!node)return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
  function syncRefractionScene(){
    if(root.dataset.flowGlassMode!=='optical'||root.dataset.flowGlassRefraction!=='true')return;
    const nav=[...document.querySelectorAll('.mobile-bottom-nav,.bottom-nav')].find(visible);if(!nav)return;
    let source=null;
    if(nav.classList.contains('mobile-bottom-nav')){
      const dedicated=document.querySelector('#switchDialog[open][data-flow-dedicated="true"]');
      source=dedicated&&visible(dedicated)?dedicated:document.querySelector('.product-main');
    }else source=document.querySelector('.main');
    if(!source||!visible(source))return;
    const navRect=nav.getBoundingClientRect(),sourceRect=source.getBoundingClientRect(),dedicated=source.matches?.('#switchDialog[open][data-flow-dedicated="true"]'),localScrollLeft=dedicated?source.scrollLeft:0,localScrollTop=dedicated?source.scrollTop:0;
    nav.style.setProperty('--flow-refraction-scene-left',`${(sourceRect.left-localScrollLeft-(navRect.left+INSET)).toFixed(2)}px`);
    nav.style.setProperty('--flow-refraction-scene-top',`${(sourceRect.top-localScrollTop-(navRect.top+INSET)).toFixed(2)}px`);
  }
  function postScrollSync(){
    tailTimers.forEach(clearTimeout);tailTimers=[];
    syncRefractionScene();
    tailTimers=[0,12,24].map(delay=>setTimeout(syncRefractionScene,delay));
  }
  window.addEventListener('scroll',postScrollSync,{passive:true,capture:true});
  window.visualViewport?.addEventListener('scroll',postScrollSync,{passive:true});
})();
