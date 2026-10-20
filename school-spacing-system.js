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

/* The compact shell has a 14px outer inset; page content has a separate fluid
   spacing token. Measure the topbar against the shell rail, not 100vw or the
   fluid content token (which can be wider than the shell at 1024px). */
@media(min-width:521px) and (max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard#dashboard.product-shell:not(.hidden):has(#flowTodayDateDock) .mobile-topbar:has(#flowTodayDateDock){
    box-sizing:border-box!important;
    width:calc(100% + 28px)!important;
    min-width:0!important;
    max-width:none!important;
    margin-inline:-14px!important;
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

/* Compact school facts and a consistent safe inset for the brand. */
@media(max-width:900px){
 html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .mobile-topbar .flow-logo{margin-inline-start:max(10px,env(safe-area-inset-left))!important}
 html[data-flow-school-ui="v2"] body #dashboard #schoolView #schoolInfoGrid.school-info-grid{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:12px!important}
 html[data-flow-school-ui="v2"] body #dashboard #schoolView #schoolInfoGrid.school-info-grid>.info-group{grid-column:1/-1!important;padding:14px 16px!important;min-height:0!important}
 html[data-flow-school-ui="v2"] body #dashboard #schoolView #schoolInfoGrid .info-group-fields{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0 12px!important}
 html[data-flow-school-ui="v2"] body #dashboard #schoolView #schoolInfoGrid .info-group .info-tile{min-height:0!important;height:auto!important;padding:9px 0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
 html[data-flow-school-ui="v2"] body #dashboard #schoolView #schoolInfoGrid .info-group .info-tile strong{font-size:.85rem!important}
}
/* Secondary destinations: match Today's compact, readable card rhythm.
   Keep all dates/controls intact; only the unused vertical chrome is reduced. */
@media (orientation:portrait) and (max-width:900px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) :is(#scheduleView,#schoolView,#weekView)>.view-header{
    min-height:68px!important;
    padding:13px 16px!important;
    margin-bottom:var(--flow-school-control-gap)!important;
    align-items:flex-start!important;
    justify-content:center!important;
    gap:8px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) :is(#scheduleView,#schoolView,#weekView)>.view-header h1{
    font-size:clamp(1.35rem,3.7vw,1.65rem)!important;
    line-height:1.2!important;
    margin:0!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) :is(#scheduleView,#schoolView,#weekView)>.view-header p{
    display:none!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .calendar-card{
    padding:12px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .calendar-head{
    margin-bottom:var(--flow-school-control-gap)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .calendar-head button{
    min-width:44px!important;
    width:44px!important;
    height:44px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .calendar-grid{
    grid-template-rows:auto repeat(6,52px)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .calendar-weekday{
    padding:4px 0 6px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .calendar-day{
    height:52px!important;
    max-height:52px!important;
    padding:5px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-hero,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-content{
    min-height:164px!important;
  }
}
@media (orientation:portrait) and (max-width:520px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .calendar-grid{
    grid-template-rows:auto repeat(6,44px)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #scheduleView#scheduleView .calendar-day{
    height:44px!important;
    max-height:44px!important;
    padding:4px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-hero,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-content{
    min-height:148px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-content{
    padding:16px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-content h2{
    font-size:1.48rem!important;
  }
}

/* Settings: restore clear group boundaries and a scannable hierarchy. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-header{
  padding:15px 18px!important;
  margin:0 0 var(--flow-school-section-gap)!important;
  border:1px solid color-mix(in srgb,var(--text) 10%,transparent)!important;
  border-radius:20px!important;
  background:var(--surface)!important;
  box-shadow:0 5px 18px rgba(30,44,70,.055)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-header h1{
  font-size:clamp(1.45rem,3vw,1.8rem)!important;
  margin:0 0 5px!important;
  line-height:1.2!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-card{
  position:relative;
  border:1px solid color-mix(in srgb,var(--text) 15%,transparent)!important;
  border-radius:20px!important;
  background:var(--surface)!important;
  box-shadow:0 8px 22px rgba(30,44,70,.095)!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-card::before{
  content:"";
  position:absolute;
  left:0;
  top:19px;
  bottom:19px;
  width:3px;
  border-radius:0 4px 4px 0;
  background:color-mix(in srgb,var(--accent) 64%,transparent);
  pointer-events:none;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-card h2{
  font-size:1rem!important;
  font-weight:800!important;
  letter-spacing:-.025em!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-card>p{
  margin-bottom:12px!important;
  line-height:1.5!important;
}
@media(max-width:520px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-fields:not(.one){
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:10px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-fields:not(.one)>label:first-child{
    grid-column:1/-1!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #flowSchoolSettingsView#flowSchoolSettingsView .flow-settings-fields.one{
    grid-template-columns:minmax(0,1fr)!important;
  }
}
`;
  document.head.append(style);
}
root.dataset.flowSchoolSpacingSystem='v1';
