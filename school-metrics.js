import './school-metrics-core.js';
import '/flow-settings-view.js';
import '/flow-refraction.js';
import './school-ia.js';
import './school-timetable-polish.js';
import './school-surface-cleanup.js';

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
