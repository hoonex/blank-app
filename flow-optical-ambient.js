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

/* The time palette reaches surfaces and chrome very lightly. Content/text colors
   are untouched, and the underlying product main remains transparent. */
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard:not(.hidden){
  --flow-school-ambient-surface:color-mix(in srgb,var(--surface) 95%,var(--flow-ambient-a) 5%);
  --flow-school-ambient-surface-2:color-mix(in srgb,var(--surface-2) 94%,var(--flow-ambient-b) 6%);
  --flow-school-ambient-edge:color-mix(in srgb,var(--text) 6%,var(--flow-ambient-a) 4%);
  --flow-school-ambient-shadow:color-mix(in srgb,rgba(31,42,68,.11) 84%,var(--flow-ambient-b) 16%);
  --flow-school-ambient-specular:color-mix(in srgb,rgba(255,255,255,.82) 90%,var(--flow-ambient-a) 10%);
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body::before{opacity:.62!important}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard#dashboard:not(.hidden) .product-main{background-color:transparent!important}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard#dashboard#dashboard:not(.hidden) :where(
  .status-card:not(.flow-home-noise),.content-card,.calendar-card,.week-card,.info-tile,.rank-card,
  .national-schedule-card,.flow-settings-card
){
  background-color:var(--flow-school-ambient-surface)!important;
  border-color:var(--flow-school-ambient-edge)!important;
  box-shadow:0 10px 28px var(--flow-school-ambient-shadow),inset 0 1px 0 var(--flow-school-ambient-specular)!important;
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard#dashboard#dashboard:not(.hidden) :where(
  .period-button,.dish,.timetable-mode-toggle,.flow-school-utility-action,.timetable-actions>.neo-button,
  #allergyBtn,.month-picker,.calendar-day
){background-color:var(--flow-school-ambient-surface-2)!important}

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

@media(max-width:1180px){
  /* Neutral/standard chrome can take a direct ambient surface tint. Optical keeps
     its specular gradient stack and only mixes the same palette into that stack. */
  html[data-flow-school-ui="v2"][data-flow-ambient="on"]:not([data-flow-glass-mode="optical"]) body #dashboard#dashboard#dashboard#dashboard:not(.hidden) .mobile-topbar{
    background:color-mix(in srgb,var(--surface) 90%,var(--flow-ambient-a) 10%)!important;
    border-bottom-color:color-mix(in srgb,var(--text) 6%,var(--flow-ambient-a) 5%)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="dark"]:not([data-flow-glass-mode="optical"]) body #dashboard#dashboard#dashboard#dashboard:not(.hidden) .mobile-topbar{
    background:color-mix(in srgb,var(--surface) 96%,var(--flow-ambient-a) 4%)!important;
    border-bottom-color:color-mix(in srgb,rgba(255,255,255,.08) 94%,var(--flow-ambient-a) 6%)!important;
    box-shadow:0 9px 28px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.10)!important;
    backdrop-filter:blur(22px) saturate(140%) brightness(.97)!important;
    -webkit-backdrop-filter:blur(22px) saturate(140%) brightness(.97)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="dark"]:not([data-flow-glass-mode="optical"]) body #dashboard#dashboard#dashboard#dashboard:not(.hidden) .mobile-topbar .mobile-school-button{
    background:color-mix(in srgb,var(--surface-2) 86%,transparent)!important;
    border-color:rgba(255,255,255,.08)!important;
    box-shadow:0 5px 16px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.11)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-flow-glass-mode="optical"] body #dashboard#dashboard#dashboard#dashboard:not(.hidden) .mobile-topbar{
    background:
      radial-gradient(145% 125% at 16% -34%,var(--flow-school-ambient-specular) 0%,rgba(255,255,255,.20) 32%,transparent 57%),
      linear-gradient(180deg,color-mix(in srgb,rgba(247,250,255,.66) 94%,var(--flow-ambient-a) 6%),color-mix(in srgb,rgba(244,248,253,.47) 94%,var(--flow-ambient-b) 6%))!important;
    border-bottom-color:color-mix(in srgb,rgba(255,255,255,.62) 90%,var(--flow-ambient-a) 10%)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-flow-glass-mode="optical"][data-theme="dark"] body #dashboard#dashboard#dashboard#dashboard:not(.hidden) .mobile-topbar{
    background:
      radial-gradient(145% 125% at 16% -34%,rgba(255,255,255,.16) 0%,rgba(255,255,255,.035) 33%,transparent 58%),
      linear-gradient(180deg,color-mix(in srgb,rgba(25,31,40,.68) 96%,var(--flow-ambient-a) 4%),color-mix(in srgb,rgba(18,23,30,.53) 96%,var(--flow-ambient-b) 4%))!important;
    border-bottom-color:color-mix(in srgb,rgba(255,255,255,.14) 92%,var(--flow-ambient-a) 8%)!important;
    box-shadow:0 10px 32px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.15)!important;
    backdrop-filter:blur(18px) saturate(145%) brightness(.97) contrast(1.03)!important;
    -webkit-backdrop-filter:blur(18px) saturate(145%) brightness(.97) contrast(1.03)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-flow-glass-mode="optical"][data-theme="dark"] body #dashboard#dashboard#dashboard#dashboard:not(.hidden) .mobile-topbar .mobile-school-button{
    background:color-mix(in srgb,var(--surface-2) 80%,transparent)!important;
    border-color:rgba(255,255,255,.10)!important;
    box-shadow:0 5px 16px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.13)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav{
    background:color-mix(in srgb,var(--flow-glass-fill,rgba(248,250,253,.54)) 93%,var(--flow-ambient-b) 7%)!important;
    border-color:color-mix(in srgb,var(--flow-glass-edge,rgba(255,255,255,.68)) 90%,var(--flow-ambient-a) 10%)!important;
    box-shadow:0 10px 28px color-mix(in srgb,var(--flow-glass-depth,rgba(34,51,82,.12)) 88%,var(--flow-ambient-b) 12%),inset 0 1px 0 var(--flow-school-ambient-specular)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav::before{
    background:
      radial-gradient(130% 112% at var(--flow-lens-light-x,34%) -8%,var(--flow-school-ambient-specular) 0%,rgba(255,255,255,.08) 31%,transparent 60%),
      linear-gradient(180deg,color-mix(in srgb,var(--flow-ambient-a) 6%,rgba(255,255,255,.07)),color-mix(in srgb,var(--flow-ambient-b) 4%,rgba(255,255,255,.018)))!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="dark"] body #dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav{
    background:color-mix(in srgb,var(--flow-glass-fill) 97%,var(--flow-ambient-b) 3%)!important;
    border-color:color-mix(in srgb,var(--flow-glass-edge) 96%,var(--flow-ambient-a) 4%)!important;
    box-shadow:0 12px 30px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.11)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="dark"] body #dashboard#dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav::before{
    background:
      radial-gradient(130% 112% at var(--flow-lens-light-x,34%) -8%,rgba(255,255,255,.18) 0%,rgba(255,255,255,.045) 31%,transparent 60%),
      linear-gradient(180deg,color-mix(in srgb,var(--flow-ambient-a) 3%,rgba(255,255,255,.035)),color-mix(in srgb,var(--flow-ambient-b) 2%,rgba(255,255,255,.008)))!important;
    border-color:rgba(255,255,255,.16)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -1px 0 rgba(0,0,0,.18),0 7px 17px rgba(0,0,0,.22)!important;
  }
}
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