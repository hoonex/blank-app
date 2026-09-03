const style=document.createElement('style');
style.id='flow-school-real-device-refine-style';
style.textContent=`
@media(max-width:520px){
  /* Preserve the existing soft-clay material contract without restoring the old
     floating tile appearance. On-device this reads as edge definition, not a card. */
  html[data-flow-school-ui="v2"] body #dashboard .mobile-topbar .mobile-school-button{
    box-shadow:inset 0 1px 0 rgba(255,255,255,.48),inset 0 -1px 0 rgba(43,57,78,.03)!important;
  }

  /* Keep the two status surfaces balanced; solve long Korean exam names through
     typography instead of stealing width from the current-state card. */
  html[data-flow-school-ui="v2"] body #todayView .status-card:last-child strong{
    font-size:.72rem!important;
    line-height:1.2!important;
    letter-spacing:-.035em!important;
    word-break:keep-all!important;
    overflow-wrap:anywhere!important;
  }

  /* Make the help affordance read as a control rather than a stray footer label. */
  html[data-flow-school-ui="v2"] body #todayView .neis-timetable-help{
    border-top:0!important;
    padding-top:3px!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .neis-timetable-help summary{
    box-sizing:border-box!important;
    min-height:44px!important;
    padding:0 10px!important;
    border-radius:10px!important;
    corner-shape:round!important;
    background:color-mix(in srgb,var(--surface-2) 54%,transparent)!important;
    color:var(--muted)!important;
    font-weight:760!important;
  }

  /* This is a final geometry contract, not a theme suggestion. #dashboard adds
     enough specificity that school-today-responsive.css may load later without
     reintroducing its older 9px/11px curvature. */
  html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-mode-toggle{
    border-radius:12px!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-mode-toggle button,
  html[data-flow-school-ui="v2"] body #dashboard #todayView #editSubjectsBtn,
  html[data-flow-school-ui="v2"] body #dashboard #todayView #shareTimetableBtn{
    border-radius:10px!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView #editSubjectsBtn{
    background:color-mix(in srgb,var(--accent) 7%,var(--surface))!important;
    color:var(--accent)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView #shareTimetableBtn{
    background:color-mix(in srgb,var(--surface-2) 58%,var(--surface))!important;
    color:var(--text)!important;
  }

  /* Do not move the segmented control when Week hides Today-only utilities. */
  html[data-flow-school-ui="v2"] body.flow-inline-week-active #dashboard #todayView .timetable-actions{
    justify-content:flex-start!important;
  }

  /* A 360px device has ~304px of timetable content width. The old 320px floor
     clipped Friday even though the six columns can fit comfortably. Fit the grid
     to its card instead of forcing horizontal scrolling. */
  html[data-flow-school-ui="v2"] body #dashboard #todayView .week-table-wrap{
    overflow-x:hidden!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView .week-table{
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    grid-template-columns:24px repeat(5,minmax(0,1fr))!important;
  }

  /* Bottom navigation is explicitly circular-rounded, never a superellipse.
     Every inner interactive/optical layer shares the same 12px radius. */
  html[data-flow-school-ui="v2"] body #dashboard #bottomNav.mobile-bottom-nav{
    border-radius:16px!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #bottomNav.mobile-bottom-nav>.mobile-tab,
  html[data-flow-school-ui="v2"] body #dashboard #bottomNav.mobile-bottom-nav::before,
  html[data-flow-school-ui="v2"] body #dashboard #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
    border-radius:12px!important;
    corner-shape:round!important;
  }

  /* Keep the moving active lens geometry for interaction/optical contracts, but
     lower its standard-mode contrast so it stops reading as a nested giant card. */
  html[data-flow-school-ui="v2"]:not([data-flow-glass-mode="optical"]) body #dashboard #bottomNav.mobile-bottom-nav::before{
    background:color-mix(in srgb,var(--accent) 2.5%,var(--surface))!important;
    border-color:transparent!important;
    box-shadow:none!important;
  }
}

@media(max-width:380px){
  html[data-flow-school-ui="v2"] body #dashboard #todayView .week-cell{padding-inline:2px!important}
  html[data-flow-school-ui="v2"] body #dashboard #todayView .week-head{font-size:.49rem!important}
  html[data-flow-school-ui="v2"] body #dashboard #todayView .week-subject{font-size:.49rem!important;letter-spacing:-.015em!important}
}

@media(min-width:390px) and (max-width:520px){
  html[data-flow-school-ui="v2"] body #todayView .week-head{font-size:.53rem!important}
  html[data-flow-school-ui="v2"] body #todayView .week-period{font-size:.54rem!important}
  html[data-flow-school-ui="v2"] body #todayView .week-subject{font-size:.54rem!important;line-height:1.2!important}
}
`;
document.head.append(style);
document.documentElement.dataset.flowSchoolRealDeviceRefine='v1';
