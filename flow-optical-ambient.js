(()=>{
  if(window.__flowOpticalAmbientInstalled)return;
  window.__flowOpticalAmbientInstalled=true;

  /* Compatibility entry point for the retired floating ambient glass. */
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
/* One responsive spacing rhythm. */
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

/* Final computed shape contract. Repeating the dashboard ID is intentional: old
   responsive modules still contain !important squircle declarations and the
   final shared contract must win by specificity, not by racing stylesheet order. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) :where(
  .status-card,.content-card,.timetable-card,.meal-card,.upcoming-card,.calendar-card,
  .week-card,.profile-hero,.info-tile,.rank-card,.national-schedule-card,.flow-settings-card,
  .period-button,.period-no,.meal-tab,.dish,.timetable-mode-toggle,.timetable-mode-toggle button,
  .flow-school-utility-action,.timetable-actions>.neo-button,#allergyBtn,.mobile-school-button,
  #flowTodayDateDock .flow-date-focus,#flowTodayDateDock .flow-date-day,#flowTodayDateDock .flow-date-edge,
  .flow-exam-card-v5,.flow-exam-card-v5::after,.flow-adfit-rail--school-top,
  .mobile-tab,.school-actions .neo-button,.month-picker,.calendar-day
){corner-shape:round!important}

/* Navigation outer surface, tabs, active material follower and Optical copy are
   all ordinary circular pills, never superellipses. */
@media(max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.mobile-tab,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav::before,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
    border-radius:9999px!important;
    corner-shape:round!important;
  }
}

/* Bottom-nav proportions are one geometry system. The visible follower and the
   Optical refraction aperture use the same vertical bounds as their tab targets. */
@media(max-width:520px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav{
    min-height:56px!important;height:56px!important;max-height:56px!important;padding:6px 5px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.mobile-tab{
    min-height:44px!important;height:44px!important;max-height:44px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav::before,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
    top:6px!important;bottom:auto!important;height:44px!important;
  }
}
@media(min-width:521px) and (max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav{
    min-height:60px!important;height:60px!important;max-height:60px!important;padding:6px 7px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.mobile-tab{
    min-height:48px!important;height:48px!important;max-height:48px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav::before,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
    top:6px!important;bottom:auto!important;height:48px!important;
  }
}
@media(max-width:1366px) and (max-height:620px) and (orientation:landscape){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav{
    min-height:58px!important;height:58px!important;max-height:58px!important;padding:5px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.mobile-tab{
    min-height:48px!important;height:48px!important;max-height:48px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav::before,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
    top:5px!important;bottom:auto!important;height:48px!important;
  }
}

/* Today uses the same macro and control gaps instead of unrelated local values. */
html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #todayView{
  --flow-today-gap:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #todayView .status-grid{
  gap:var(--flow-school-control-gap)!important;
  margin-bottom:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #todayView :where(.today-grid,.right-stack){
  gap:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #todayView .timetable-actions{
  gap:var(--flow-school-control-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #todayView :where(.timetable-card,.right-stack>.meal-card,.right-stack>.upcoming-card){
  padding:var(--flow-school-card-pad)!important;
  border-radius:var(--flow-school-card-radius)!important;
}
html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #todayView .status-card:not(.flow-home-noise){
  border-radius:var(--flow-school-card-radius)!important;
}
@media(max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #todayView{padding-inline:var(--flow-school-page-inset)!important}
}
/* Keep the destination-level rhythm explicit so late tablet/landscape rules cannot
   silently return School information tiles to their old 9px compact gap. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .schedule-layout,
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #schoolView#schoolView .school-info-grid,
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #schoolView#schoolView .school-actions,
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-stack{
  gap:var(--flow-school-section-gap)!important;
}

/* Time ambience is wallpaper-only: it may change the scene behind School, but it
   must not restyle cards, rows, calendar cells, controls, top chrome, or nav. */
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body::before{opacity:.62!important}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard#dashboard:not(.hidden) .product-main{background-color:transparent!important}

/* Dark keeps the same time-of-day hue, but the atmosphere is mixed into the dark
   base instead of painting a light pastel wallpaper behind dark cards. */
html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="dark"]{
  background-color:var(--bg)!important;
  background-image:
    radial-gradient(980px 660px at var(--flow-ambient-x) -130px,color-mix(in srgb,var(--flow-ambient-a) 22%,transparent),transparent 70%),
    radial-gradient(820px 560px at calc(100% - var(--flow-ambient-x)) 110%,color-mix(in srgb,var(--flow-ambient-b) 18%,transparent),transparent 72%),
    linear-gradient(145deg,color-mix(in srgb,var(--bg) 84%,var(--flow-ambient-a) 16%),color-mix(in srgb,var(--bg) 86%,var(--flow-ambient-b) 14%))!important;
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="dark"] body{
  background-color:var(--bg)!important;
  background-image:
    radial-gradient(980px 660px at var(--flow-ambient-x) -130px,color-mix(in srgb,var(--flow-ambient-a) 18%,transparent),transparent 70%),
    radial-gradient(820px 560px at calc(100% - var(--flow-ambient-x)) 110%,color-mix(in srgb,var(--flow-ambient-b) 14%,transparent),transparent 72%)!important;
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="dark"] body::before{opacity:.36!important}
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
  [80,220,520,1100].forEach(delay=>setTimeout(raiseVisualContract,delay));
  window.addEventListener('flow:glass-mode-changed',()=>setTimeout(raiseVisualContract,0),{passive:true});
  root.dataset.flowSchoolVisualContract='v7';

  /* Bounded Optical post-scroll geometry tail; no persistent RAF/render loop. */
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