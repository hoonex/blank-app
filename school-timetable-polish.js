const $=(selector,root=document)=>root.querySelector(selector);

function installStyles(){
  if($('#flow-school-timetable-polish-style'))return;
  const style=document.createElement('style');
  style.id='flow-school-timetable-polish-style';
  style.textContent=`
/* Today actions have three roles: view mode, edit, then share. Keep them borderless
 * and visually quieter than the timetable itself. */
html[data-flow-school-ui="v2"] body #todayView .timetable-actions{
  gap:6px!important;
  align-items:center!important;
  justify-content:flex-end!important;
}
html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle{
  box-sizing:border-box!important;
  min-width:104px!important;
  height:40px!important;
  padding:3px!important;
  border:0!important;
  border-radius:999px!important;
  background:color-mix(in srgb,var(--surface-2) 86%,var(--surface))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.62),inset 0 -2px 6px rgba(55,72,101,.055)!important;
}
html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button{
  min-height:34px!important;
  padding:0 11px!important;
  border:0!important;
  border-radius:999px!important;
  font-size:.64rem!important;
  font-weight:820!important;
  color:var(--muted)!important;
  box-shadow:none!important;
}
html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button.active{
  background:var(--surface)!important;
  color:var(--accent)!important;
  box-shadow:0 5px 13px rgba(43,57,78,.09),inset 0 1px 0 rgba(255,255,255,.72)!important;
}
html[data-flow-school-ui="v2"] body #todayView .flow-school-utility-action{
  box-sizing:border-box!important;
  min-height:40px!important;
  padding:0 13px!important;
  border:0!important;
  border-radius:999px!important;
  background:color-mix(in srgb,var(--surface) 91%,var(--surface-2))!important;
  color:var(--text)!important;
  box-shadow:0 5px 14px rgba(43,57,78,.075),inset 0 1px 0 rgba(255,255,255,.7),inset 0 -2px 6px rgba(55,72,101,.045)!important;
  font-size:.64rem!important;
  font-weight:790!important;
  transition:transform .16s ease,background .16s ease,box-shadow .16s ease!important;
}
html[data-flow-school-ui="v2"] body #todayView #editSubjectsBtn.flow-school-utility-action{
  background:color-mix(in srgb,var(--accent) 8%,var(--surface))!important;
  color:var(--accent)!important;
}
html[data-flow-school-ui="v2"] body #todayView .flow-school-utility-action:active{
  transform:translateY(1px) scale(.98)!important;
  box-shadow:inset 0 3px 8px rgba(58,75,105,.10),inset 0 -1px 1px rgba(255,255,255,.6)!important;
}
html[data-flow-school-ui="v2"] body #todayView .meal-card #allergyBtn.flow-school-utility-action{
  min-height:38px!important;
  padding-inline:12px!important;
  background:color-mix(in srgb,var(--surface) 88%,var(--surface-2))!important;
}
/* Period identity should read as a number badge, not another miniature card. */
html[data-flow-school-ui="v2"] body #todayView .period-no{
  border-radius:50%!important;
}
.inline-week-timetable{gap:11px!important}
.inline-week-toolbar{padding-top:1px!important}
.inline-week-toolbar .week-controls{gap:6px!important}
.inline-week-toolbar .week-controls .neo-button{box-sizing:border-box!important;min-width:70px!important;min-height:40px!important;padding:0 12px!important;border-radius:13px!important;border:1px solid color-mix(in srgb,var(--text) 7%,transparent)!important;background:var(--surface-2)!important;color:var(--text)!important;box-shadow:none!important;font-size:.64rem!important;font-weight:780!important}
.inline-week-toolbar .week-controls #thisWeekBtn{background:color-mix(in srgb,var(--accent) 11%,var(--surface))!important;border-color:color-mix(in srgb,var(--accent) 20%,transparent)!important;color:var(--accent)!important}
.flow-inline-week-active .timetable-card .neis-timetable-help{margin-top:13px!important;padding-top:13px!important}
@media(max-width:900px){
  html[data-flow-school-ui="v2"] body #todayView .timetable-actions{gap:4px!important}
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle{min-width:86px!important;height:36px!important;padding:2px!important}
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button{min-height:32px!important;padding:0 7px!important;font-size:.57rem!important}
  html[data-flow-school-ui="v2"] body #todayView .flow-school-utility-action{min-height:36px!important;padding:0 9px!important;font-size:.57rem!important}
  html[data-flow-school-ui="v2"] body #todayView .meal-card #allergyBtn.flow-school-utility-action{min-height:36px!important;padding-inline:10px!important}
  .inline-week-toolbar .week-controls{gap:5px!important}
  .inline-week-toolbar .week-controls .neo-button{min-width:0!important;min-height:36px!important;padding:0 8px!important;border-radius:11px!important;font-size:.58rem!important}
}
@media(prefers-reduced-motion:reduce){
  html[data-flow-school-ui="v2"] body #todayView .flow-school-utility-action{transition:none!important}
}
`;
  document.head.append(style);
}

function normalizeActionControls(){
  const actions=$('.timetable-actions');
  const toggle=actions?$('.timetable-mode-toggle',actions):null;
  const edit=$('#editSubjectsBtn');
  const share=$('#shareTimetableBtn');
  const allergy=$('#allergyBtn');
  if(actions){
    if(toggle&&actions.firstElementChild!==toggle)actions.prepend(toggle);
    if(edit)actions.append(edit);
    if(share)actions.append(share);
  }
  if(edit){edit.classList.add('flow-school-utility-action');edit.dataset.flowSchoolAction='edit'}
  if(share){share.classList.add('flow-school-utility-action');share.dataset.flowSchoolAction='share'}
  if(allergy){allergy.classList.add('flow-school-utility-action');allergy.dataset.flowSchoolAction='allergy'}
}

function moveHelpLast(){
  const card=$('.timetable-card'),help=$('#neisTimetableHelp');
  if(!card||!help||help.parentElement!==card)return;
  if(card.lastElementChild!==help)card.append(help);
}

function init(){
  installStyles();
  normalizeActionControls();
  moveHelpLast();
  queueMicrotask(normalizeActionControls);
  setTimeout(normalizeActionControls,0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
