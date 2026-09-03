const root=document.documentElement;
const style=document.createElement('style');
style.id='flow-school-toolbar-grouping-style';
style.textContent=`
/* Final timetable grouping contract: mode switching is one control on the left;
   editing/sharing is a separate action cluster on the right. */
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
  flex:0 0 auto!important;
  margin:0!important;
}
html[data-flow-school-ui="v2"] body #dashboard #todayView #editSubjectsBtn{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  flex:0 0 auto!important;
  width:auto!important;
  min-width:86px!important;
  max-width:none!important;
  margin-left:auto!important;
  padding-inline:11px!important;
}
html[data-flow-school-ui="v2"] body #dashboard #todayView #shareTimetableBtn{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  flex:0 0 auto!important;
  width:auto!important;
  min-width:54px!important;
  max-width:none!important;
  margin-left:0!important;
  padding-inline:10px!important;
}
/* Week is still the same timetable feature. Keep its utilities available instead
   of hiding them just because the representation changed. */
html[data-flow-school-ui="v2"] body.flow-inline-week-active #dashboard #todayView :is(#editSubjectsBtn,#shareTimetableBtn){
  display:inline-flex!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
}

/* The help disclosure is supporting copy, not a primary action. */
html[data-flow-school-ui="v2"] body #dashboard #todayView .neis-timetable-help summary{
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
  color:color-mix(in srgb,var(--muted) 88%,var(--text))!important;
  font-weight:720!important;
  text-decoration:none!important;
}
html[data-flow-school-ui="v2"] body #dashboard #todayView .neis-timetable-help[open] summary{
  color:color-mix(in srgb,var(--muted) 68%,var(--text))!important;
}

/* Week movement is one connected segmented bar rather than three floating cards.
   Keep a 45px inner track inside the 1px outer border so device/subpixel rounding
   cannot reduce the actual button hit box below the 44px accessibility floor. */
html[data-flow-school-ui="v2"] body #dashboard #todayView .inline-week-toolbar .week-controls{
  box-sizing:border-box!important;
  display:grid!important;
  grid-template-columns:45px minmax(0,1fr) 45px!important;
  grid-template-rows:45px!important;
  align-items:stretch!important;
  width:100%!important;
  height:47px!important;
  min-height:47px!important;
  gap:0!important;
  padding:0!important;
  overflow:hidden!important;
  border:1px solid color-mix(in srgb,var(--text) 8%,transparent)!important;
  border-radius:12px!important;
  corner-shape:round!important;
  background:color-mix(in srgb,var(--surface-2) 58%,var(--surface))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.62)!important;
}
html[data-flow-school-ui="v2"] body #dashboard #todayView .inline-week-toolbar .week-controls .neo-button{
  box-sizing:border-box!important;
  width:100%!important;
  min-width:45px!important;
  height:45px!important;
  min-height:45px!important;
  margin:0!important;
  padding:0 8px!important;
  border:0!important;
  border-radius:0!important;
  corner-shape:round!important;
  background:transparent!important;
  box-shadow:none!important;
}
html[data-flow-school-ui="v2"] body #dashboard #todayView .inline-week-toolbar #prevWeek{
  border-radius:11px 0 0 11px!important;
}
html[data-flow-school-ui="v2"] body #dashboard #todayView .inline-week-toolbar #thisWeekBtn{
  border-left:1px solid color-mix(in srgb,var(--text) 7%,transparent)!important;
  border-right:1px solid color-mix(in srgb,var(--text) 7%,transparent)!important;
  background:color-mix(in srgb,var(--accent) 4%,transparent)!important;
  color:var(--accent)!important;
}
html[data-flow-school-ui="v2"] body #dashboard #todayView .inline-week-toolbar #nextWeek{
  border-radius:0 11px 11px 0!important;
}

@media(max-width:520px){
  /* The header is a viewport bar. Product-main padding must not leave lavender
     gutters at its left/right edges. */
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#flowTodayDateDock){
    box-sizing:border-box!important;
    width:100vw!important;
    max-width:100vw!important;
    margin-left:calc(50% - 50vw)!important;
    margin-right:calc(50% - 50vw)!important;
    padding-left:max(7px,env(safe-area-inset-left))!important;
    padding-right:max(7px,env(safe-area-inset-right))!important;
  }
  /* The bar itself now owns the viewport, so its absolute date rail should use
     the bar's true midpoint rather than the pre-expansion pixel coordinate. */
  html[data-flow-school-ui="v2"] body #dashboard #flowTodayDateDock{
    left:50%!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-actions{
    gap:5px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView #editSubjectsBtn{
    min-width:84px!important;
    padding-inline:9px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView #shareTimetableBtn{
    min-width:52px!important;
    padding-inline:8px!important;
  }
}
@media(max-width:380px){
  html[data-flow-school-ui="v2"] body #dashboard #todayView #editSubjectsBtn{
    min-width:82px!important;
    padding-inline:8px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView #shareTimetableBtn{
    min-width:50px!important;
    padding-inline:7px!important;
  }
}
`;
document.head.append(style);

/* Editing from Week should remain useful: move back to Today first, then let the
   existing edit handler receive the original click and enter edit mode. */
document.addEventListener('click',event=>{
  const edit=event.target.closest?.('#editSubjectsBtn');
  if(!edit||!document.body.classList.contains('flow-inline-week-active'))return;
  document.querySelector('.timetable-mode-toggle [data-timetable-mode="today"]')?.click();
},true);

root.dataset.flowSchoolToolbarGrouping='v1';