const $=(selector,root=document)=>root.querySelector(selector);

function installStyles(){
  if($('#flow-school-timetable-polish-style'))return;
  const style=document.createElement('style');
  style.id='flow-school-timetable-polish-style';
  style.textContent=`
/* Keep Today/Week/share/edit controls in one restrained control system. */
.timetable-actions{gap:7px!important;align-items:center!important}
.timetable-mode-toggle{box-sizing:border-box!important;min-width:104px!important;height:42px!important;padding:3px!important;border-radius:14px!important;background:var(--surface-2)!important;border:1px solid color-mix(in srgb,var(--text) 7%,transparent)!important}
.timetable-mode-toggle button{min-height:34px!important;padding:0 11px!important;border-radius:11px!important;font-size:.66rem!important;font-weight:800!important;color:var(--muted)!important}
.timetable-mode-toggle button.active{background:color-mix(in srgb,var(--accent) 11%,var(--surface))!important;color:var(--accent)!important;box-shadow:0 2px 7px rgba(35,52,86,.07)!important}
.timetable-actions>.neo-button{box-sizing:border-box!important;min-height:42px!important;padding:0 13px!important;border-radius:14px!important;border:1px solid color-mix(in srgb,var(--text) 7%,transparent)!important;background:var(--surface-2)!important;color:var(--text)!important;box-shadow:none!important;font-size:.66rem!important;font-weight:780!important}
.timetable-actions>.neo-button:active{background:color-mix(in srgb,var(--text) 5%,var(--surface-2))!important}
.inline-week-timetable{gap:11px!important}
.inline-week-toolbar{padding-top:1px!important}
.inline-week-toolbar .week-controls{gap:6px!important}
.inline-week-toolbar .week-controls .neo-button{box-sizing:border-box!important;min-width:70px!important;min-height:40px!important;padding:0 12px!important;border-radius:13px!important;border:1px solid color-mix(in srgb,var(--text) 7%,transparent)!important;background:var(--surface-2)!important;color:var(--text)!important;box-shadow:none!important;font-size:.64rem!important;font-weight:780!important}
.inline-week-toolbar .week-controls #thisWeekBtn{background:color-mix(in srgb,var(--accent) 11%,var(--surface))!important;border-color:color-mix(in srgb,var(--accent) 20%,transparent)!important;color:var(--accent)!important}
.flow-inline-week-active .timetable-card .neis-timetable-help{margin-top:13px!important;padding-top:13px!important}
@media(max-width:900px){
  .timetable-actions{gap:5px!important}
  .timetable-mode-toggle{min-width:88px!important;height:36px!important;padding:2px!important;border-radius:11px!important}
  .timetable-mode-toggle button{min-height:30px!important;padding:0 7px!important;border-radius:9px!important;font-size:.57rem!important}
  .timetable-actions>.neo-button{min-height:36px!important;padding:0 8px!important;border-radius:11px!important;font-size:.57rem!important}
  .inline-week-toolbar .week-controls{gap:5px!important}
  .inline-week-toolbar .week-controls .neo-button{min-width:0!important;min-height:36px!important;padding:0 8px!important;border-radius:11px!important;font-size:.58rem!important}
}
`;
  document.head.append(style);
}

function moveHelpLast(){
  const card=$('.timetable-card'),help=$('#neisTimetableHelp');
  if(!card||!help||help.parentElement!==card)return;
  if(card.lastElementChild!==help)card.append(help);
}

function init(){installStyles();moveHelpLast()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
