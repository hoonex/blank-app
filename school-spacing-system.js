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

/* Wide-touch landscape had a portrait-sized hero, leaving school facts under
   the floating navigation. Keep the identity readable while revealing facts. */
@media (orientation:landscape) and (min-width:700px) and (max-width:1180px) and (max-height:820px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView>.view-header{
    min-height:72px!important;
    height:auto!important;
    padding:10px 16px!important;
    justify-content:center!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView>.view-header p{display:none!important}
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView>.view-header h1{
    font-size:clamp(1.35rem,3vw,1.7rem)!important;
    line-height:1.2!important;
    margin:0!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-hero,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-content{
    min-height:158px!important;
    height:auto!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-content{
    padding:18px 22px!important;
  }
}
@media (orientation:landscape) and (min-width:700px) and (max-width:900px) and (max-height:520px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-hero,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-content{
    min-height:126px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-content{
    padding:10px 20px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden) #schoolView#schoolView .profile-content h2{
    font-size:1.45rem!important;
  }
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
/* Unified capacity-first composition.  The historic "mobile / tablet / desktop"
   attribute remains only for legacy components; these content rules use
   orientation and minimum usable card widths, never pointer/device detection. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden){
  --flow-fluid-outer:clamp(14px,1.5vw,28px);
  --flow-school-section-gap:clamp(12px,1.35vw,20px)!important;
  --flow-fluid-gap:var(--flow-school-section-gap);
  --flow-fluid-radius:clamp(18px,1.65vw,24px);
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) main.product-main :is(#todayView,#scheduleView,#schoolView){
  min-width:0!important;
}

/* The card rail uses one gap token in every orientation, including status,
   timetable, meal, and upcoming sections. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) #todayView :is(.status-grid,.today-grid,.right-stack){
  gap:var(--flow-school-section-gap)!important;
}

/* A tall canvas should never squeeze the timetable into a narrow left column.
   Use one readable primary rail, with two secondary cards only when both fit. */
@media (orientation:portrait) and (min-width:521px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    grid-auto-rows:max-content!important;
    align-items:start!important;
    gap:var(--flow-fluid-gap)!important;
    height:auto!important;
    min-height:0!important;
    background:transparent!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.right-stack{
    display:grid!important;
    grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))!important;
    grid-template-rows:none!important;
    grid-auto-rows:max-content!important;
    align-content:start!important;
    align-items:start!important;
    height:auto!important;
    min-height:0!important;
    gap:var(--flow-fluid-gap)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.right-stack>:is(.meal-card,.upcoming-card){
    height:auto!important;
    min-height:0!important;
  }
}

/* Landscape becomes side-by-side only once a 390px timetable AND a 290px
   context panel can fit.  The same condition governs a phone or a monitor. */
@media (orientation:landscape) and (min-width:700px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid{
    display:grid!important;
    grid-template-columns:minmax(390px,1.18fr) minmax(285px,.82fr)!important;
    align-items:start!important;
    grid-auto-rows:max-content!important;
    gap:var(--flow-fluid-gap)!important;
    height:auto!important;
    min-height:0!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.timetable-card,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.right-stack{
    grid-column:auto!important;grid-row:auto!important;
    min-width:0!important;min-height:0!important;
    align-self:start!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.right-stack{
    display:flex!important;
    flex-direction:column!important;
    height:auto!important;
    gap:var(--flow-fluid-gap)!important;
  }
}

/* The desktop shell must remain identical on touch and pointer devices.
   Legacy touch-only topbar overrides must not duplicate the desktop rail. */
@media (orientation:landscape) and (min-width:1181px) and (min-height:681px){
 html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) .mobile-topbar,
 html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) #bottomNav.mobile-bottom-nav{
   display:none!important;
 }
}

/* A real workspace rail belongs to a roomy landscape, NOT to a particular
   hardware class. The user-facing content geometry below stays shared. */
@media (orientation:landscape) and (min-width:1181px) and (min-height:681px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden){
    --flow-workspace-rail:clamp(220px,16.8vw,252px);
    display:grid!important;
    grid-template-columns:var(--flow-workspace-rail) minmax(0,1fr)!important;
    width:min(1680px,calc(100% - 2 * var(--flow-fluid-outer)))!important;
    max-width:none!important;
    gap:var(--flow-fluid-gap)!important;
    align-items:start!important;
    padding:var(--flow-fluid-outer) 0 40px!important;
    margin-inline:auto!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden)>#desktopSidebar.desktop-sidebar{
    display:flex!important;
    width:var(--flow-workspace-rail)!important;
    min-width:0!important;
    top:var(--flow-fluid-outer)!important;
    height:calc(100dvh - 2 * var(--flow-fluid-outer))!important;
    padding:20px 16px!important;
    border-radius:var(--flow-fluid-radius)!important;
    box-shadow:0 14px 34px rgba(35,46,70,.065)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #desktopSidebar .sidebar-logo{
    margin-bottom:18px!important;
    padding-inline:8px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #desktopSidebar .sidebar-logo .flow-logo-copy strong{
    font-size:1.42rem!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #desktopSidebar .school-identity{
    height:72px!important;min-height:72px!important;
    margin-bottom:18px!important;padding:10px 12px!important;
    border-radius:16px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #desktopSidebar .school-identity-copy strong{
    font-size:.87rem!important;letter-spacing:-.03em!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #desktopSidebar .school-identity-copy small{font-size:.68rem!important}
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #desktopSidebar .side-nav{
    gap:5px!important;grid-auto-rows:54px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #desktopSidebar .side-nav .nav-item{
    height:54px!important;min-height:54px!important;
    padding:9px 12px 9px 16px!important;
    border-radius:13px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #desktopSidebar .side-nav .nav-item span{
    font-size:.9rem!important;line-height:1.2!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #desktopSidebar .side-nav .nav-item small{
    font-size:.67rem!important;line-height:1.25!important;margin-top:2px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) #todayView{
    width:100%!important;max-width:none!important;min-width:0!important;
    padding:0!important;margin:0!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) #todayView #schoolHero{
    display:block!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden)>.product-main{
    width:100%!important;max-width:none!important;min-width:0!important;
    margin:0!important;padding:0!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView #schoolHero{
    height:86px!important;min-height:86px!important;
    margin-bottom:var(--flow-fluid-gap)!important;
    border-radius:var(--flow-fluid-radius)!important;
    box-shadow:0 6px 22px rgba(35,46,70,.045)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView #schoolHero .school-hero-content{
    height:86px!important;min-height:86px!important;
    padding:12px 18px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView #schoolHero .school-hero-copy::before{
    font-size:1.44rem!important;letter-spacing:-.05em!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView #schoolHero .school-hero-copy::after{
    font-size:.73rem!important;margin-top:5px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView .status-grid{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:var(--flow-fluid-gap)!important;
    margin:0 0 var(--flow-fluid-gap)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView .status-card:not(.flow-home-noise){
    min-height:96px!important;padding:16px 20px!important;
    border-radius:var(--flow-fluid-radius)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView .status-card .status-label{
    font-size:.71rem!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView .status-card strong{
    font-size:1.04rem!important;letter-spacing:-.03em!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid{
    grid-template-columns:minmax(420px,1.15fr) minmax(345px,.85fr)!important;
    gap:var(--flow-fluid-gap)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView :is(.timetable-card,.meal-card,.upcoming-card){
    min-height:0!important;height:auto!important;
    border-radius:var(--flow-fluid-radius)!important;
    padding:clamp(16px,1.5vw,23px)!important;
    box-shadow:0 10px 28px rgba(36,48,74,.055)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView .card-heading h2{
    font-size:1.26rem!important;letter-spacing:-.04em!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView .card-heading p{
    font-size:.75rem!important;line-height:1.4!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView #timetable{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    grid-auto-rows:minmax(58px,max-content)!important;
    gap:9px!important;
    min-width:0!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView #timetable .period-button{
    min-width:0!important;min-height:58px!important;
    height:auto!important;padding:10px 12px!important;
    border:1px solid color-mix(in srgb,var(--text) 5%,transparent)!important;
    border-radius:14px!important;
    display:grid!important;grid-template-columns:37px minmax(0,1fr)!important;
    align-items:center!important;gap:11px!important;
    box-shadow:none!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView #timetable .period-no{
    width:37px!important;height:37px!important;border-radius:11px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView #timetable .period-name{
    font-size:.9rem!important;line-height:1.3!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView #timetable .flow-period-time{
    font-size:.72rem!important;line-height:1.3!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #todayView .meal-list :is(.dish,.meal-dish){
    font-size:.94rem!important;line-height:1.45!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #schoolView .profile-hero,
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #schoolView .profile-content{
    min-height:148px!important;height:148px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #schoolView .profile-content{
    padding:18px 22px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard #schoolView .profile-content h2{
    font-size:clamp(1.55rem,2vw,2rem)!important;
  }
}
/* Medium content widths never stretch individual cards solely to fill a track. */
@media (orientation:landscape) and (min-width:700px) and (max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid{
    grid-template-columns:minmax(390px,1.2fr) minmax(280px,.8fr)!important;
  }
}
/* Readable section headings and consistent panel density at any aspect ratio. */
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) :is(#scheduleView,#schoolView)>.view-header{
  max-width:none!important;
}
html[data-flow-school-ui="v2"] body #dashboard#dashboard#dashboard:not(.hidden) :is(#todayView,#schoolView,#scheduleView) :is(.content-card,.calendar-card,.profile-hero,.info-group){
  box-sizing:border-box!important;
}

`;
  document.head.append(style);
}
root.dataset.flowSchoolSpacingSystem='v1';
