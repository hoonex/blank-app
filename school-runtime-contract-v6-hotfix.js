const root=document.documentElement;
if(!document.querySelector('#flow-school-runtime-v6-hotfix')){
  const style=document.createElement('style');
  style.id='flow-school-runtime-v6-hotfix';
  style.textContent=`
/* Production School has four destinations; localhost Transit lab has five. */
@media(max-width:1180px){
  html:not([data-flow-transit-surface="dormant"]) body #bottomNav.mobile-bottom-nav:not(:has(>[data-view="week"])){grid-template-columns:repeat(5,minmax(0,1fr))!important;--flow-tab-count:5!important}
}
@media(orientation:landscape) and (pointer:coarse) and (hover:none) and (max-width:1366px){
  html:not([data-flow-transit-surface="dormant"]) body #bottomNav.mobile-bottom-nav:not(:has(>[data-view="week"])){grid-template-columns:repeat(5,minmax(0,1fr))!important;--flow-tab-count:5!important}
  html[data-flow-school-ui="v2"] body #todayView .status-grid{position:relative!important;z-index:1!important}
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .mobile-topbar{box-shadow:none!important}
}
/* The School setup utility is a flat action, not a raised neumorphic control. */
#landing .landing-header-actions .landing-mode-switch{box-shadow:none!important}
`;
  document.head.append(style);
}
root.dataset.flowSchoolRuntimeV6Hotfix='ready';
