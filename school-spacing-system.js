const root=document.documentElement;
const STYLE_ID='flow-school-spacing-system-v1';
if(!document.querySelector(`#${STYLE_ID}`)){
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
/* School spacing system v1
   One responsive token source already exists on #dashboard. This layer removes
   legacy block/margin exceptions so those tokens actually govern the rendered
   rails, section gaps, card stacks, and dense calendar grid. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden){
  --flow-school-dense-gap:max(4px,calc(var(--flow-school-control-gap) - 2px));
}

/* Compact destinations share one content rail. Today already owned this inset;
   Week/Schedule/School now use the same rail instead of falling back to the old
   product-main-only 11px edge. */
@media(max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) :where(#todayView,#weekView,#scheduleView,#schoolView){
    padding-inline:var(--flow-school-page-inset)!important;
  }
}

/* Desktop-class scrollbars make 100vw wider than the School content viewport.
   Keep the compact topbar aligned with the clamped page inset instead of 100vw,
   avoiding an 8px horizontal spill on small Windows landscape/tablet screens. */
@media(min-width:521px) and (max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard#dashboard.product-shell:not(.hidden):has(#flowTodayDateDock) .mobile-topbar:has(#flowTodayDateDock){
    box-sizing:border-box!important;
    width:calc(100% + 2 * var(--flow-school-page-inset))!important;
    min-width:0!important;
    max-width:none!important;
    margin-left:calc(-1 * var(--flow-school-page-inset))!important;
    margin-right:calc(-1 * var(--flow-school-page-inset))!important;
  }
}

/* Today: the legacy mobile stylesheet switched these stacks to display:block,
   which made their declared gap values inert and reintroduced 10/11px margins.
   Keep Today as a real grid. On phones preserve the established utility flex
   column; wider compact layouts keep their existing tablet grid composition. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .status-grid{
  gap:var(--flow-school-control-gap)!important;
  margin:0 0 var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid{
  gap:var(--flow-school-section-gap)!important;
  margin:0!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .right-stack{
  gap:var(--flow-school-section-gap)!important;
  margin:0!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView :where(.timetable-card,.meal-card,.upcoming-card){
  margin:0!important;
  padding:var(--flow-school-card-pad)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .flow-adfit-rail--school-top{
  margin-bottom:var(--flow-school-section-gap)!important;
}
@media(max-width:520px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .right-stack{
    display:flex!important;
    flex-direction:column!important;
  }
}

/* Schedule: spacing follows the tokens without changing the established
   responsive composition. Landscape keeps the calendar + event context row;
   compact portrait keeps the touch-first vertical stack. Grid layouts consume
   the shared gap directly, while block portrait stacks use the same token as
   the calendar's bottom margin. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView>.view-header{
  margin-bottom:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .schedule-layout{
  gap:var(--flow-school-section-gap)!important;
  margin:0!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .schedule-layout>.content-card{
  margin:0!important;
  padding:var(--flow-school-card-pad)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .calendar-head{
  margin-bottom:var(--flow-school-control-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .calendar-grid{
  gap:var(--flow-school-dense-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .schedule-list{
  gap:var(--flow-school-control-gap)!important;
}

/* Orientation-first content geometry, with a minimum comfortable card width.
   A 768px portrait tablet has room for two readable rails; a 390px portrait
   phone does not. Landscape uses the same rails without device-name checks. */
@media(orientation:portrait) and (max-width:620px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    grid-auto-rows:max-content!important;
    align-content:start!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .right-stack{
    display:flex!important;
    flex-direction:column!important;
    height:auto!important;
  }
}
@media(orientation:portrait) and (min-width:621px) and (max-width:900px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid{
    display:grid!important;
    grid-template-columns:minmax(0,1.42fr) minmax(0,.72fr)!important;
    align-items:start!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .right-stack{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    grid-template-rows:none!important;
    grid-auto-rows:max-content!important;
    align-content:start!important;
    height:auto!important;
    min-height:0!important;
  }
}
@media(orientation:landscape) and (min-width:700px) and (max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid{
    display:grid!important;
    grid-template-columns:minmax(0,1.42fr) minmax(0,.72fr)!important;
    align-items:start!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .right-stack{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    grid-template-rows:none!important;
    grid-auto-rows:max-content!important;
    align-content:start!important;
    height:auto!important;
    min-height:0!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid>.timetable-card{
    grid-column:1!important;
    grid-row:1!important;
    min-width:0!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid>.right-stack{
    grid-column:2!important;
    grid-row:1!important;
    min-width:0!important;
  }
}
@media(min-width:700px) and (max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .status-grid{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    max-width:none!important;
  }
}
@media(orientation:portrait) and (max-width:900px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView .schedule-layout{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    grid-auto-rows:max-content!important;
    align-items:start!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView .schedule-layout>.calendar-card{
    margin-bottom:0!important;
  }
}
@media(orientation:landscape) and (min-width:680px) and (max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView .schedule-layout{
    display:grid!important;
    grid-template-columns:minmax(0,1.45fr) minmax(0,1fr)!important;
    align-items:start!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView .schedule-layout>.calendar-card{
    margin-bottom:0!important;
  }
}

/* School profile: remove the separate 9/14/15px legacy rhythm. The information
   grid and action cluster keep their existing section-token contract, while the
   note uses the smaller control token. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView>.view-header{
  margin-bottom:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .school-info-grid{
  gap:var(--flow-school-section-gap)!important;
  margin-top:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .school-actions{
  gap:var(--flow-school-section-gap)!important;
  margin-top:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .public-data-note{
  margin:var(--flow-school-control-gap) 4px 0!important;
}

/* Settings cards follow the same macro rhythm and card padding. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-stack{
  gap:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-card{
  margin:0!important;
  padding:var(--flow-school-card-pad)!important;
}
`;
  document.head.append(style);
}
root.dataset.flowSchoolSpacingSystem='v1';
