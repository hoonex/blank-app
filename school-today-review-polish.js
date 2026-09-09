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
   The old phone override compressed the pair to 8px and made them read as one block.
   Match the spacing-system selector weight so its compact token cannot re-tighten it. */
@media(max-width:699px){
  html[data-flow-school-ui="v2"] body #dashboard#dashboard:not(.hidden):has(#todayView:not(.hidden)) #todayView .status-grid{
    gap:12px!important;
  }
}

/* Wide Today now uses a vertical utility column. The responsive Today stylesheet
   still carries height:100% from the older horizontal meal/exam utility row; once
   the IA changed right-stack to one column, that percentage sizing inflated the
   second track to ~420px. Flex the final wide utility column to intrinsic card
   heights and explicitly retire the legacy equal-height/min-height contract.
   Exam feed v3 owns this card after hiding #eventList, so keep the populated feed
   in layout even if a later generic content rule attempts to hide it. */
@media(min-width:1181px) and (min-height:681px){
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid{
    height:max-content!important;
    min-height:0!important;
    align-self:start!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.right-stack{
    display:flex!important;
    flex-direction:column!important;
    height:max-content!important;
    min-height:0!important;
    grid-template-columns:none!important;
    grid-template-rows:none!important;
    align-content:normal!important;
    align-items:stretch!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.right-stack>:is(.meal-card,.upcoming-card){
    flex:0 0 auto!important;
    width:100%!important;
    height:auto!important;
    min-height:0!important;
    align-self:stretch!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.right-stack>.upcoming-card[data-flow-exam-feed="v3"]{
    height:max-content!important;
    min-height:0!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden) #flowExamFeedV3{
    display:grid!important;
    width:100%!important;
    height:auto!important;
    min-height:0!important;
    grid-auto-rows:max-content!important;
    align-content:start!important;
  }
}

/* Today used light-oriented ambient/specular mixes after the rest of School had
   already switched to the dark material tokens. Normalize only Today surfaces;
   other destinations keep their established dark-mode treatment. */
html[data-flow-school-ui="v2"][data-theme="dark"] body:has(#dashboard:not(.hidden) #todayView:not(.hidden)){
  background-color:var(--bg)!important;
  background-image:
    radial-gradient(760px 560px at 78% -12%,color-mix(in srgb,var(--accent) 10%,transparent),transparent 68%),
    radial-gradient(720px 560px at 4% 108%,color-mix(in srgb,var(--surface-2) 34%,transparent),transparent 72%),
    linear-gradient(145deg,color-mix(in srgb,var(--surface-2) 42%,var(--bg)),var(--bg))!important;
}
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
