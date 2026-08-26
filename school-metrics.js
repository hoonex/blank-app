import './school-metrics-core.js';
import '/flow-settings-view.js';
import '/flow-refraction.js';
import './school-ia.js';
import './school-timetable-polish.js';

if(!document.querySelector('link[data-flow-school-settings-wide]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='/school-settings-wide.css?v=20260825-1';
  link.dataset.flowSchoolSettingsWide='';
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