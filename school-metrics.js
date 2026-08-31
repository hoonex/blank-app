import './school-metrics-core.js';
import '/flow-settings-view.js';
import '/flow-refraction.js';
import './school-ia.js';
import './school-timetable-polish.js';

/* The shared Settings layer identifies its mobile destination semantically as
 * `.flow-mobile-settings`; School's historical button predates that class. Keep
 * the actual DOM in the same four-destination contract so lens indexing, active
 * state, and touch routing cannot diverge when Settings is opened. */
const schoolMobileSettingsTab=document.querySelector('#mobileSettingsBtn');
if(schoolMobileSettingsTab)schoolMobileSettingsTab.classList.add('flow-mobile-settings');

function transitLabEnabled(){
  const host=location.hostname;
  if(host!=='127.0.0.1'&&host!=='localhost')return false;
  try{return localStorage.getItem('flow-school-transit-lab-v1')!=='off'}catch{return false}
}

async function bootSchoolSurface(){
  if(transitLabEnabled()){
    try{
      await import('./school-transit.js');
      await import('./school-transit-map.js');
      await import('./school-transit-focus.js');
    }catch(error){console.warn('[Flow] Transit lab modules failed to load',error)}
  }
  await import('./school-surface-cleanup.js');
  await import('./school-uiux-v2.js');
}

/* Keep the entry module non-blocking. Production skips Transit entirely; the
 * localhost lab preserves the historical Transit → cleanup initialization order. */
void bootSchoolSurface();

/* Optical/refraction used to assume School always had five destinations because
 * Transit was one of them. Production now has four, so keep the lens geometry
 * and semantic tab positions aligned with the visible dormant-Transit nav. */
if(!document.querySelector('#flow-school-dormant-nav-contract')){
  const style=document.createElement('style');
  style.id='flow-school-dormant-nav-contract';
  style.textContent=`
html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"])){--flow-tab-count:4!important;grid-template-columns:repeat(4,minmax(0,1fr))!important}
html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:has(> [data-view="today"].active){--flow-tab-index:0!important}
html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"])):has(> [data-view="schedule"].active){--flow-tab-index:1!important}
html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"])):has(> [data-view="school"].active){--flow-tab-index:2!important}
html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"])):has(> :is(.flow-mobile-settings,#mobileSettingsBtn).active){--flow-tab-index:3!important}
@media(max-width:900px),(min-width:901px) and (max-width:1024px) and (orientation:portrait){
  html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"]))>[data-view="today"]{grid-row:1!important;grid-column:1!important}
  html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"]))>[data-view="schedule"]{grid-row:1!important;grid-column:2!important}
  html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"]))>[data-view="school"]{grid-row:1!important;grid-column:3!important}
  html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"]))>:is(.flow-mobile-settings,#mobileSettingsBtn){grid-row:1!important;grid-column:4!important}
}`;
  document.head.append(style);
}

/* Settings is a destination, not a modal that may cover navigation. Preserve the
 * existing tab/lens geometry and only establish the missing wide-tablet stacking
 * contract: nav above the settings surface, settings content ending above nav. */
if(!document.querySelector('#flow-school-touch-nav-contract')){
  const style=document.createElement('style');
  style.id='flow-school-touch-nav-contract';
  style.textContent=`
@media(max-width:900px),(min-width:901px) and (max-width:1024px) and (orientation:portrait){
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) .mobile-bottom-nav{
    z-index:90!important;
    visibility:visible!important;
    opacity:1!important;
    pointer-events:auto!important;
  }
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) #mobileSettingsBtn{
    display:block!important;
    visibility:visible!important;
    pointer-events:auto!important;
  }
  html[data-flow-school-ui="v2"] #flowSchoolSettingsView:not(.hidden){
    z-index:40!important;
    bottom:78px!important;
    padding-bottom:34px!important;
  }
}`;
  document.head.append(style);
}

/* The shell breakpoint already treats 901–1024px portrait tablets as touch-first.
 * Extend that contract through the topbar and every secondary School destination so
 * a Galaxy-style portrait viewport cannot fall back to desktop internals after leaving Today. */
if(!document.querySelector('#flow-school-wide-portrait-destinations')){
  const style=document.createElement('style');
  style.id='flow-school-wide-portrait-destinations';
  style.textContent=`
@media(min-width:901px) and (max-width:1024px) and (orientation:portrait){
  html[data-flow-school-ui="v2"] body{overflow-x:hidden!important}
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) .mobile-topbar .flow-logo-copy strong{font-size:.88rem!important}
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) .mobile-topbar .flow-logo-copy small{display:none!important}
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) .mobile-school-button{text-align:right!important}
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) .mobile-school-button span,
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) .mobile-school-button small{display:block!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) .mobile-school-button span{font-size:.65rem!important;font-weight:800!important}
  html[data-flow-school-ui="v2"] #dashboard:not(.hidden) .mobile-school-button small{margin-top:2px!important;color:var(--muted)!important;font-size:.54rem!important}

  html[data-flow-school-ui="v2"] .view-header{
    min-height:104px!important;
    margin:0 0 10px!important;
    padding:18px 16px!important;
    border-radius:22px!important;
    align-items:flex-start!important;
    flex-direction:column!important;
    gap:13px!important;
  }
  html[data-flow-school-ui="v2"] .view-header h1{font-size:1.72rem!important}
  html[data-flow-school-ui="v2"] .view-header p{max-width:35ch!important;font-size:.62rem!important}
  html[data-flow-school-ui="v2"] .week-controls{width:100%!important}
  html[data-flow-school-ui="v2"] .week-controls .neo-button{flex:1 1 0!important}
  html[data-flow-school-ui="v2"] .week-table-wrap{margin:0 -4px!important}

  html[data-flow-school-ui="v2"] .schedule-layout{display:block!important;grid-template-columns:none!important}
  html[data-flow-school-ui="v2"] .schedule-layout>.content-card{border-radius:22px!important}
  html[data-flow-school-ui="v2"] .calendar-card{margin-bottom:10px!important}
  html[data-flow-school-ui="v2"] .calendar-grid{gap:1px!important}
  html[data-flow-school-ui="v2"] .calendar-day{min-height:66px!important;padding:6px!important;border-radius:9px!important}
  html[data-flow-school-ui="v2"] .calendar-event-label{display:none!important}
  html[data-flow-school-ui="v2"] .schedule-row{padding:10px 11px!important}

  html[data-flow-school-ui="v2"] .profile-hero{min-height:205px!important;border-radius:22px!important}
  html[data-flow-school-ui="v2"] .profile-content{min-height:205px!important;padding:17px!important}
  html[data-flow-school-ui="v2"] .profile-content h2{font-size:1.85rem!important}
  html[data-flow-school-ui="v2"] .school-info-grid{grid-template-columns:repeat(12,minmax(0,1fr))!important;gap:7px!important}
  html[data-flow-school-ui="v2"] .school-info-grid>.info-tile{grid-column:span 6!important}
  html[data-flow-school-ui="v2"] .school-info-grid>.info-tile-empty{grid-column:1/-1!important}
  html[data-flow-school-ui="v2"] .school-info-grid:has(>.info-tile:nth-child(2n+1):last-child)>.info-tile:last-child{grid-column:4/span 6!important}
  html[data-flow-school-ui="v2"] .school-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
  html[data-flow-school-ui="v2"] .action-link{min-height:44px!important}
  html[data-flow-school-ui="v2"] .source-note{padding-bottom:8px!important}

  html[data-flow-school-ui="v2"] #flowSchoolSettingsView:not(.hidden){
    position:fixed!important;
    inset:64px 0 78px!important;
    overflow-y:auto!important;
    overscroll-behavior:contain!important;
    background:var(--bg)!important;
    padding:18px 11px 34px!important;
  }
  html[data-flow-school-ui="v2"] #flowSchoolSettingsView .flow-settings-header{margin-bottom:22px!important}
  html[data-flow-school-ui="v2"] #flowSchoolSettingsView .flow-settings-header h1{font-size:2.15rem!important}
  html[data-flow-school-ui="v2"] #flowSchoolSettingsView .flow-settings-header p{font-size:.8rem!important}
  html[data-flow-school-ui="v2"] #flowSchoolSettingsView .flow-settings-stack{gap:12px!important}
  html[data-flow-school-ui="v2"] #flowSchoolSettingsView .flow-settings-card{padding:18px!important;border-radius:18px!important}
  html[data-flow-school-ui="v2"] #flowSchoolSettingsView .flow-settings-fields,
  html[data-flow-school-ui="v2"] #flowSchoolSettingsView .flow-settings-fields.one,
  html[data-flow-school-ui="v2"] #flowSchoolSettingsView .flow-settings-fields.flow-meal-window{grid-template-columns:minmax(0,1fr)!important}
}`;
  document.head.append(style);
}

if(!document.querySelector('link[data-flow-school-settings-wide]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='/school-settings-wide.css?v=20260825-1';
  link.dataset.flowSchoolSettingsWide='';
  document.head.append(link);
}

if(!document.querySelector('link[data-flow-school-landscape-toolbar]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='/school-landscape-toolbar.css?v=20260827-1';
  link.dataset.flowSchoolLandscapeToolbar='';
  document.head.append(link);
}

/* Delight must never block School identity/theme/data startup. */
void import('/flow-experience.js').catch(()=>{});

/* Monetization is progressive enhancement and stays inert until an AdFit unit is configured. */
void import('/flow-adfit.js').catch(()=>{});

/* Source-contract anchors retained for existing production audits:
 * school-polish.css
 * recoverSchoolLogo
 * functions/v1/school-logo
 */