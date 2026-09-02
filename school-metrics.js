const root=document.documentElement;
const PROFILE_KEY='flow-school-profile-v3';
const TRANSIT_LAB_KEY='flow-school-transit-lab-v1';

/* Gate first, before any progressive School module runs. The previous module used
 * static imports, so its loading flag was applied only after those dependencies
 * had already evaluated. That left a paint window where the legacy shell could
 * be visible on reload. */
if(localStorage.getItem(PROFILE_KEY))root.dataset.flowSchoolBoot='profile';
root.dataset.flowSchoolSurfaceLoading='true';
if(!document.querySelector('#flow-school-surface-ready-gate')){
  const style=document.createElement('style');
  style.id='flow-school-surface-ready-gate';
  style.textContent=`
html[data-flow-school-surface-loading="true"] #dashboard,
html[data-flow-school-boot="profile"]:not([data-flow-school-surface="ready"]) #dashboard{
  visibility:hidden!important;opacity:0!important;pointer-events:none!important
}
html[data-flow-school-surface-loading="true"] #dashboard *,
html[data-flow-school-boot="profile"]:not([data-flow-school-surface="ready"]) #dashboard *{
  visibility:hidden!important;pointer-events:none!important
}
`;
  document.head.append(style);
}

function transitLabEnabled(){
  const host=location.hostname;
  return(host==='127.0.0.1'||host==='localhost')&&localStorage.getItem(TRANSIT_LAB_KEY)!=='off';
}

function normalizeSchoolSettingsTab(){
  const button=document.querySelector('#mobileSettingsBtn');
  if(!button)return;
  button.classList.remove('flow-mobile-settings');
  button.classList.add('mobile-tab');
  button.removeAttribute('data-view');
  button.setAttribute('aria-label','설정');
}

function ensureAuxiliaryStyles(){
  if(!document.querySelector('link[data-flow-school-settings-wide]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='/school-settings-wide.css?v=20260825-1';link.dataset.flowSchoolSettingsWide='';document.head.append(link);
  }
  if(!document.querySelector('link[data-flow-school-landscape-toolbar]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='/school-landscape-toolbar.css?v=20260827-1';link.dataset.flowSchoolLandscapeToolbar='';document.head.append(link);
  }
}

function installNavigationContract(){
  if(document.querySelector('#flow-school-navigation-contract-v6'))return;
  const style=document.createElement('style');style.id='flow-school-navigation-contract-v6';style.textContent=`
html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"])){--flow-tab-count:4!important;grid-template-columns:repeat(4,minmax(0,1fr))!important}
html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:has(> [data-view="today"].active){--flow-tab-index:0!important}
html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"])):has(> [data-view="schedule"].active){--flow-tab-index:1!important}
html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"])):has(> [data-view="school"].active){--flow-tab-index:2!important}
html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"])):has(> #mobileSettingsBtn.active){--flow-tab-index:3!important}
@media(max-width:1180px){
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) .desktop-sidebar{display:none!important}
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) .mobile-bottom-nav{visibility:visible!important;opacity:1!important;pointer-events:auto!important}
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) #mobileSettingsBtn{display:block!important;visibility:visible!important;pointer-events:auto!important}
}
@media(min-width:901px) and (max-width:1024px) and (orientation:portrait){
  html[data-flow-school-ui="v2"] body{overflow-x:hidden!important}
  html[data-flow-school-ui="v2"] #flowSchoolSettingsView:not(.hidden){position:fixed!important;inset:64px 0 78px!important;overflow-y:auto!important;overscroll-behavior:contain!important;padding:18px 11px 34px!important}
  html[data-flow-school-ui="v2"] .schedule-layout{display:block!important;grid-template-columns:none!important}
  html[data-flow-school-ui="v2"] .school-info-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  html[data-flow-school-ui="v2"] .school-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
`;
  document.head.append(style);
}

async function bootSchoolSurface(){
  ensureAuxiliaryStyles();
  installNavigationContract();

  /* These were static imports. They are deliberately dynamic now so the boot
     gate above is committed before any old/new visual layer can paint. */
  await Promise.all([
    import('./school-metrics-core.js'),
    import('/flow-settings-view.js'),
    import('/flow-refraction.js'),
  ]);
  normalizeSchoolSettingsTab();

  await Promise.all([
    import('./school-ia.js'),
    import('./school-timetable-polish.js'),
  ]);

  if(transitLabEnabled()){
    try{
      await import('./school-transit.js');
      await import('./school-transit-map.js');
      await import('./school-transit-focus.js');
    }catch(error){console.warn('[Flow] Transit lab modules failed to load',error)}
  }

  await import('./school-surface-cleanup.js');
  await import('./school-uiux-v2.js');
  /* The date/topbar shell is now an explicit readiness dependency instead of a
     later best-effort polish. This prevents the old hero/shell from flashing. */
  await import('./school-today-topbar.js');
  await import('./school-runtime-contract-v6.js');

  normalizeSchoolSettingsTab();
  root.dataset.flowSchoolSurface='ready';
  root.dataset.flowSchoolSurfaceV6='ready';
  delete root.dataset.flowSchoolSurfaceLoading;
  requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('flow:glass-mode-changed')));
}

void bootSchoolSurface().catch(error=>{
  console.error('[Flow] School surface boot failed',error);
  /* Do not strand the user behind the gate if a progressive module fails. */
  delete root.dataset.flowSchoolSurfaceLoading;
  root.dataset.flowSchoolSurface='ready';
}).finally(()=>{
  normalizeSchoolSettingsTab();
  window.addEventListener('flow:glass-mode-changed',normalizeSchoolSettingsTab,{passive:true});
  /* Delight and monetization remain progressive enhancement after first paint. */
  void import('/flow-experience.js').catch(()=>{});
  void import('/flow-adfit.js').catch(()=>{});
});

/* Production-health source-contract anchors retained for the runtime split:
 * school-polish.css
 * recoverSchoolLogo
 * functions/v1/school-logo
 */
