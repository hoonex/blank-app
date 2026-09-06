const style=document.createElement('style');
style.id='flow-school-today-review-polish-style';
style.textContent=`
/* Screenshot-driven Today refinements. Keep the outer compact chrome geometry
   unchanged while matching the School button's inner alignment across views. */
@media(max-width:520px){
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar .mobile-school-button{
    padding:6px 9px!important;
  }
}

/* The two status cards need the same breathing room as the base Today system.
   The old phone override compressed the pair to 8px and made them read as one block. */
@media(max-width:699px){
  html[data-flow-school-ui="v2"] body #dashboard #todayView .status-grid{
    gap:12px!important;
  }
}

/* Today used light-oriented ambient/specular mixes after the rest of School had
   already switched to the dark material tokens. Normalize only Today surfaces;
   other destinations keep their established dark-mode treatment. */
html[data-flow-school-ui="v2"][data-theme="dark"] body #dashboard #todayView .status-card:not(.flow-home-noise){
  background:color-mix(in srgb,var(--surface) 96%,var(--surface-2))!important;
  box-shadow:0 10px 28px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.055)!important;
}
html[data-flow-school-ui="v2"][data-theme="dark"] body #dashboard #todayView :is(.timetable-card,.meal-card,.upcoming-card){
  background:color-mix(in srgb,var(--surface) 96%,var(--surface-2))!important;
  box-shadow:0 10px 30px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.05)!important;
}
html[data-flow-school-ui="v2"][data-theme="dark"] body #dashboard #todayView :is(.period-button,.flow-school-utility-action,.timetable-actions>.neo-button){
  box-shadow:0 4px 13px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.045)!important;
}
html[data-flow-school-ui="v2"][data-theme="dark"] body #dashboard #todayView .period-no,
html[data-flow-school-ui="v2"][data-theme="dark"] body #dashboard #todayView .timetable-mode-toggle{
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important;
}
html[data-flow-school-ui="v2"][data-theme="dark"] body #dashboard #todayView .timetable-mode-toggle::after{
  box-shadow:0 3px 10px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.055)!important;
}
html[data-flow-school-ui="v2"][data-theme="dark"] body #dashboard:has(#todayView:not(.hidden)) .flow-adfit-rail--school-top:has(iframe),
html[data-flow-school-ui="v2"][data-theme="dark"] body #dashboard:has(#todayView:not(.hidden)) .flow-adfit-rail--school-top:has(.flow-adfit-mock){
  background:linear-gradient(135deg,color-mix(in srgb,var(--surface) 96%,var(--surface-2)),color-mix(in srgb,var(--accent) 3%,var(--surface)))!important;
  box-shadow:0 10px 30px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.05)!important;
}

@media(max-width:520px){
  html[data-flow-school-ui="v2"][data-theme="dark"]:not([data-flow-glass-mode="optical"]) body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#flowTodayDateDock){
    background:color-mix(in srgb,var(--surface) 90%,var(--bg))!important;
    box-shadow:0 8px 24px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.045)!important;
  }
  html[data-flow-school-ui="v2"][data-theme="dark"]:not([data-flow-glass-mode="optical"]) body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar .mobile-school-button{
    background:color-mix(in srgb,var(--surface) 90%,var(--surface-2))!important;
    box-shadow:0 3px 10px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.055)!important;
  }
  html[data-flow-school-ui="v2"][data-theme="dark"] body #dashboard #flowTodayDateDock .flow-date-focus{
    box-shadow:0 5px 14px color-mix(in srgb,var(--accent) 12%,transparent),inset 0 1px 0 rgba(255,255,255,.06)!important;
  }
}
`;
document.head.append(style);
document.documentElement.dataset.flowSchoolTodayReviewPolish='v1';
