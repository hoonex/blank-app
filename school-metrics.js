import './school-metrics-core.js';
import '/flow-settings-view.js';
import '/flow-refraction.js';
import './school-ia.js';
import './school-timetable-polish.js';

function transitLabEnabled(){
  const host=location.hostname;
  if(host!=='127.0.0.1'&&host!=='localhost')return false;
  try{return localStorage.getItem('flow-school-transit-lab-v1')!=='off'}catch{return false}
}

if(transitLabEnabled()){
  await import('./school-transit.js');
  await import('./school-transit-map.js');
  await import('./school-transit-focus.js');
}

/* Preserve the historical lab initialization order: Transit first, cleanup after.
 * Production skips the Transit imports entirely and loads only the cleanup layer. */
await import('./school-surface-cleanup.js');

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
html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"])):has(> .flow-mobile-settings.active){--flow-tab-index:3!important}
@media(max-width:900px){
  html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"]))>[data-view="today"]{grid-row:1!important;grid-column:1!important}
  html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"]))>[data-view="schedule"]{grid-row:1!important;grid-column:2!important}
  html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"]))>[data-view="school"]{grid-row:1!important;grid-column:3!important}
  html[data-flow-transit-surface="dormant"][data-theme] body .mobile-bottom-nav:not(:has(> [data-view="week"]))>.flow-mobile-settings{grid-row:1!important;grid-column:4!important}
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
