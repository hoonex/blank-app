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

/* Layout primitives: let orientation choose the reading flow, and usable
   width determine whether adjacent columns have enough room to breathe.
   Semantic week tables remain row/column grids, not arbitrary cards. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid{
  display:grid!important;
  grid-template-columns:minmax(0,1fr)!important;
  gap:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .right-stack{
  display:grid!important;
  grid-template-columns:minmax(0,1fr)!important;
  gap:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .status-grid{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:var(--flow-school-control-gap)!important;
}
@media (orientation:portrait) and (min-width:690px),
       (orientation:landscape) and (min-width:680px) and (max-width:1259px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .right-stack{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }
}
@media (orientation:landscape) and (min-width:1260px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid{
    grid-template-columns:minmax(0,1.42fr) minmax(0,.78fr)!important;
    align-items:start!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid>.timetable-card,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .today-grid>.right-stack{
    grid-column:auto!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .right-stack{
    grid-template-columns:minmax(0,1fr)!important;
  }
  /* The dashboard currently exposes two summary cards, not four.
     Four forced tracks left half of the wide header unusable. */
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .status-grid{
    width:100%!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #todayView .status-grid>.clock-card{
    grid-column:auto!important;
  }
}

/* Calendar plus day detail are peers only when two meaningful columns fit.
   A narrow landscape viewport must not compress either column. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .schedule-layout{
  display:grid!important;
  grid-template-columns:minmax(0,1fr)!important;
  gap:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .schedule-layout>.calendar-card{
  margin-bottom:0!important;
}
@media (orientation:landscape) and (min-width:980px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .schedule-layout{
    grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr)!important;
  }
}

/* Information tiles have equal automatic columns instead of 12 hand-placed
   lanes and nth-child centering rules from the legacy desktop style. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #schoolView#schoolView .school-info-grid{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:var(--flow-school-section-gap)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #schoolView#schoolView .school-info-grid>.info-tile{
  grid-column:auto!important;
  min-width:0!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #schoolView#schoolView .school-info-grid>.info-tile-empty{
  grid-column:1/-1!important;
}
@media (orientation:landscape) and (min-width:900px),
       (orientation:portrait) and (min-width:1100px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #schoolView#schoolView .school-info-grid{
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
  }
}
@media (orientation:landscape) and (min-width:1280px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #schoolView#schoolView .school-info-grid{
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
  }
}

/* Week retains the period-by-day matrix. Give each subject a readable minimum
   and scroll inside the table instead of squeezing five day columns to 8px text. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #weekView#weekView .week-table-wrap{
  max-width:100%;
  min-width:0;
  overflow-x:auto!important;
  overscroll-behavior-inline:contain;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #weekView#weekView .week-table{
  width:100%;
  min-width:740px;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #weekView#weekView .week-cell{
  font-size:clamp(.72rem,calc(.63rem + .15vi),.84rem)!important;
}
`;
  document.head.append(style);
}
root.dataset.flowSchoolSpacingSystem='v1';
