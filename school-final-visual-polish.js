const style=document.createElement('style');
style.id='flow-school-final-visual-polish-style';
style.textContent=`
/* Final School visual contract. Time ambience must be visible on the rendered
   surface, not merely present as hidden custom properties behind opaque shells. */
html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="light"][data-flow-ambient-phase="dawn"]{
  --flow-ambient-a:#ffe8d8!important;--flow-ambient-b:#e9e5ff!important
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="light"][data-flow-ambient-phase="day"]{
  --flow-ambient-a:#fff0b8!important;--flow-ambient-b:#fff7dd!important
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="light"][data-flow-ambient-phase="golden"]{
  --flow-ambient-a:#ffe0ad!important;--flow-ambient-b:#f3e1ff!important
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="light"][data-flow-ambient-phase="evening"]{
  --flow-ambient-a:#e5d9ff!important;--flow-ambient-b:#dce2ff!important
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"][data-theme="light"][data-flow-ambient-phase="night"]{
  --flow-ambient-a:#d9d3ff!important;--flow-ambient-b:#e7ddff!important
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body{
  background-color:var(--bg)!important;
  background-image:
    radial-gradient(920px 680px at var(--flow-ambient-x) -120px,color-mix(in srgb,var(--flow-ambient-a) 92%,transparent),transparent 68%),
    radial-gradient(820px 620px at calc(100% - var(--flow-ambient-x)) 108%,color-mix(in srgb,var(--flow-ambient-b) 86%,transparent),transparent 70%),
    linear-gradient(145deg,color-mix(in srgb,var(--flow-ambient-a) 70%,var(--bg)),color-mix(in srgb,var(--flow-ambient-b) 64%,var(--bg)))!important;
  background-attachment:fixed!important;
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard.product-shell,
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard .product-main,
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #todayView{
  background-color:transparent!important;
  background-image:none!important;
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #todayView .status-card:not(.flow-home-noise){
  background:color-mix(in srgb,var(--surface) 89%,var(--flow-ambient-a))!important;
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #todayView :is(.timetable-card,.meal-card,.upcoming-card){
  background:color-mix(in srgb,var(--surface) 91%,var(--flow-ambient-b))!important;
}

/* Timetable help is an inline disclosure, not another card/button. Keep the 44px
   hit target while removing the visible rectangle. */
html[data-flow-school-ui="v2"] body #dashboard #todayView .neis-timetable-help{
  margin-top:8px!important;
  padding-top:0!important;
  border-top:0!important;
}
html[data-flow-school-ui="v2"] body #dashboard #todayView .neis-timetable-help summary{
  display:inline-flex!important;
  align-items:center!important;
  box-sizing:border-box!important;
  width:max-content!important;
  max-width:100%!important;
  min-height:44px!important;
  margin:0!important;
  padding:0 2px!important;
  border:0!important;
  border-radius:0!important;
  corner-shape:round!important;
  background:transparent!important;
  color:var(--accent)!important;
  box-shadow:none!important;
  font-weight:780!important;
}

/* One equal-width segmented control in every viewport. The selection is a single
   moving rounded rectangle so Today -> Week no longer snaps between two cards. */
html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-mode-toggle{
  position:relative!important;
  isolation:isolate!important;
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  width:112px!important;
  min-width:112px!important;
  max-width:112px!important;
  height:44px!important;
  min-height:44px!important;
  padding:3px!important;
  overflow:hidden!important;
  border:0!important;
  border-radius:12px!important;
  corner-shape:round!important;
  background:color-mix(in srgb,var(--surface-2) 72%,transparent)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.58)!important;
}
html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-mode-toggle::before{display:none!important;content:none!important}
html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-mode-toggle::after{
  content:""!important;
  display:block!important;
  position:absolute!important;
  z-index:0!important;
  left:3px!important;
  top:3px!important;
  bottom:3px!important;
  width:calc(50% - 3px)!important;
  border:0!important;
  border-radius:10px!important;
  corner-shape:round!important;
  background:var(--surface)!important;
  box-shadow:0 3px 10px rgba(43,57,78,.075),inset 0 1px 0 rgba(255,255,255,.82)!important;
  transform:translate3d(0,0,0)!important;
  transition:transform 300ms cubic-bezier(.16,1,.3,1)!important;
  pointer-events:none!important;
}
html[data-flow-school-ui="v2"] body.flow-inline-week-active #dashboard #todayView .timetable-mode-toggle::after{
  transform:translate3d(100%,0,0)!important;
}
html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-mode-toggle button{
  position:relative!important;
  z-index:1!important;
  box-sizing:border-box!important;
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  height:38px!important;
  min-height:38px!important;
  margin:0!important;
  padding:0 7px!important;
  border:0!important;
  border-radius:10px!important;
  corner-shape:round!important;
  background:transparent!important;
  box-shadow:none!important;
  transform:none!important;
  transition:color 190ms ease!important;
}
html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-mode-toggle button.active{
  background:transparent!important;
  box-shadow:none!important;
  transform:none!important;
  color:var(--accent)!important;
}

/* Representation changes still happen immediately for correctness, but the new
   content settles into place instead of appearing as a hard cut. */
html[data-flow-school-ui="v2"] body #dashboard #todayView #timetable,
html[data-flow-school-ui="v2"] body.flow-inline-week-active #dashboard #todayView #inlineWeekTimetable{
  animation:flow-school-timetable-enter 360ms cubic-bezier(.16,1,.3,1) both!important;
  transform-origin:top center!important;
}
@keyframes flow-school-timetable-enter{
  0%{opacity:.42;transform:translate3d(0,6px,0) scale(.995)}
  55%{opacity:.94}
  100%{opacity:1;transform:translate3d(0,0,0) scale(1)}
}

@media(max-width:520px){
  /* Today app bar is sticky, so a viewport-fixed date deck has identical scroll
     behavior while making its center independent from padded/asymmetric parents. */
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#flowTodayDateDock){
    position:sticky!important;
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    min-height:56px!important;
    height:56px!important;
    padding:3px 7px!important;
    gap:0!important;
    background:color-mix(in srgb,var(--surface) 82%,var(--flow-ambient-a,transparent))!important;
    overflow:visible!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard .mobile-topbar .flow-logo{
    position:relative!important;
    z-index:3!important;
    flex:0 0 auto!important;
    min-width:62px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #flowTodayDateDock{
    position:fixed!important;
    z-index:62!important;
    left:50%!important;
    top:3px!important;
    transform:translateX(-50%)!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    width:164px!important;
    min-width:164px!important;
    max-width:164px!important;
    height:50px!important;
    margin:0!important;
    padding:3px 0!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #flowTodayDateDock .flow-date-edge{display:none!important}
  html[data-flow-school-ui="v2"] body #dashboard #flowTodayDateDock .flow-date-viewport{
    grid-column:1!important;
    width:100%!important;
    min-width:0!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard .mobile-topbar .mobile-school-button{
    position:relative!important;
    z-index:3!important;
    flex:0 0 94px!important;
    width:94px!important;
    min-width:94px!important;
    max-width:94px!important;
    height:44px!important;
    min-height:44px!important;
    padding:4px 4px!important;
    border:0!important;
    border-radius:10px!important;
    corner-shape:round!important;
    background:color-mix(in srgb,var(--surface) 64%,var(--flow-ambient-b,transparent))!important;
    box-shadow:0 2px 7px rgba(43,57,78,.04),inset 0 1px 0 rgba(255,255,255,.58),inset 0 -1px 0 rgba(43,57,78,.025)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard .mobile-topbar .mobile-school-button span{
    font-size:.62rem!important;
    letter-spacing:-.035em!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard .mobile-topbar .mobile-school-button small{
    font-size:.48rem!important;
  }

  /* Utilities keep intrinsic proportions. The editor must not absorb all leftover
     width simply because the old grid used a 1fr middle track. */
  html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-actions{
    display:flex!important;
    align-items:center!important;
    justify-content:flex-start!important;
    width:100%!important;
    min-width:0!important;
    gap:6px!important;
    transform:none!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-mode-toggle{
    flex:0 0 104px!important;
    width:104px!important;
    min-width:104px!important;
    max-width:104px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView #editSubjectsBtn{
    flex:0 0 94px!important;
    box-sizing:border-box!important;
    width:94px!important;
    min-width:94px!important;
    max-width:94px!important;
    padding:0 8px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView #shareTimetableBtn{
    flex:0 0 58px!important;
    box-sizing:border-box!important;
    width:58px!important;
    min-width:58px!important;
    max-width:58px!important;
    padding:0 7px!important;
  }
  html[data-flow-school-ui="v2"] body.flow-inline-week-active #dashboard #todayView .timetable-actions{
    justify-content:flex-start!important;
  }
  html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #dashboard #bottomNav.mobile-bottom-nav{
    background:color-mix(in srgb,var(--surface) 92%,var(--flow-ambient-b))!important;
  }
}

@media(max-width:380px){
  html[data-flow-school-ui="v2"] body #dashboard #flowTodayDateDock{
    width:156px!important;min-width:156px!important;max-width:156px!important
  }
  html[data-flow-school-ui="v2"] body #dashboard .mobile-topbar .mobile-school-button{
    flex-basis:88px!important;width:88px!important;min-width:88px!important;max-width:88px!important
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView #editSubjectsBtn{
    flex-basis:90px!important;width:90px!important;min-width:90px!important;max-width:90px!important
  }
}

@media(prefers-reduced-motion:reduce){
  html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-mode-toggle::after{transition:none!important}
  html[data-flow-school-ui="v2"] body #dashboard #todayView #timetable,
  html[data-flow-school-ui="v2"] body.flow-inline-week-active #dashboard #todayView #inlineWeekTimetable{animation:none!important}
}
`;
document.head.append(style);
document.documentElement.dataset.flowSchoolFinalVisual='v1';