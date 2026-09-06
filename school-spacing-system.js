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
@media(max-width:820px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
  }
}
@media(max-width:520px){
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
@media(max-width:1120px) and (orientation:portrait){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .schedule-layout>.calendar-card{
    margin-bottom:var(--flow-school-section-gap)!important;
  }
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

/* Settings responsive composition.
   Phones stay a readable single column. Wider compact shells use two balanced
   columns instead of stretching one narrow stack down the left side of a
   landscape/tablet canvas. Desktop keeps the dedicated 6-track 2+2+2 layout
   from school-settings-wide.css. */
@media(max-width:639px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-stack{
    width:100%!important;
    max-width:none!important;
    grid-template-columns:minmax(0,1fr)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView :is(.flow-settings-card,.flow-settings-save),
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-save~.flow-settings-card{
    grid-column:auto!important;
    grid-row:auto!important;
  }
}
@media(min-width:640px) and (max-width:1099px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-stack{
    width:100%!important;
    max-width:none!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    align-items:stretch!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-card{
    min-width:0!important;
    height:100%!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-card:nth-child(1){grid-column:1;grid-row:1}
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-card:nth-child(2){grid-column:2;grid-row:1}
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-card:nth-child(3){grid-column:1;grid-row:2}
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-card:nth-child(4){grid-column:2;grid-row:2}
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-card:nth-child(5){grid-column:1;grid-row:3}
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-save~.flow-settings-card{grid-column:2;grid-row:3}
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-save{
    grid-column:1/-1!important;
    grid-row:4!important;
  }
}
@media(min-width:901px) and (max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView{
    padding-inline:var(--flow-school-page-inset)!important;
    padding-bottom:calc(126px + env(safe-area-inset-bottom))!important;
    scroll-padding-bottom:calc(126px + env(safe-area-inset-bottom))!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-stack{
    width:100%!important;
    max-width:none!important;
  }
}
@media(max-width:900px) and (max-height:520px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView:not(.hidden){
    padding-left:var(--flow-school-page-inset)!important;
    padding-right:var(--flow-school-page-inset)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-header{
    margin-bottom:var(--flow-school-section-gap)!important;
  }
}
`;
  document.head.append(style);
}
root.dataset.flowSchoolSpacingSystem='v1';
