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
/* Final landscape invariant. This deliberately has higher specificity than the
   retired short-landscape toolbar rules, so a late stylesheet cannot move the
   destination bar back into the header. */
@media(max-width:1366px) and (max-height:620px) and (orientation:landscape){
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) #bottomNav.mobile-bottom-nav{
    display:grid!important;
    position:fixed!important;
    z-index:90!important;
    top:auto!important;
    bottom:max(9px,env(safe-area-inset-bottom))!important;
    left:50%!important;
    right:auto!important;
    width:min(620px,calc(100% - 28px))!important;
    min-height:58px!important;
    height:58px!important;
    max-height:58px!important;
    padding:5px!important;
    transform:translateX(-50%)!important;
    grid-template-rows:48px!important;
    gap:2px!important;
    border-radius:16px!important;
    corner-shape:round!important;
    overflow:hidden!important;
  }
  html[data-flow-school-ui="v2"][data-flow-transit-surface="dormant"] body #dashboard.product-shell:not(.hidden) #bottomNav.mobile-bottom-nav{
    --flow-tab-count:4!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
  }
  html[data-flow-school-ui="v2"]:not([data-flow-transit-surface="dormant"]) body #dashboard.product-shell:not(.hidden) #bottomNav.mobile-bottom-nav{
    --flow-tab-count:5!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) #bottomNav.mobile-bottom-nav>.mobile-tab,
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) #bottomNav.mobile-bottom-nav>.flow-mobile-settings{
    min-width:0!important;
    width:100%!important;
    min-height:48px!important;
    height:48px!important;
    border-radius:11px!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) .desktop-sidebar,
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) #schoolHero{display:none!important}
  html[data-flow-school-ui="v2"] body{padding-bottom:78px!important}
}
/* The School setup utility is a flat action, not a raised neumorphic control.
   Disable its shadow transition too; otherwise the old raised shadow can remain
   visible for a few intermediate frames during first paint. */
#landing .landing-header-actions .landing-mode-switch{
  box-shadow:none!important;
  transition:none!important;
  animation:none!important
}

/* Make time ambience materially visible on School instead of being buried under
   an opaque app shell. Cards remain neutral; the page field carries the time cue. */
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body :is(.product-shell,.product-main){
  background-color:color-mix(in srgb,var(--bg) 48%,transparent)!important
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body .mobile-topbar{
  background-color:color-mix(in srgb,var(--bg) 64%,transparent)!important
}
`;
  document.head.append(style);
}

function ambientPhase(){
  const now=new Date(),h=now.getHours()+now.getMinutes()/60;
  if(h<6.5)return'night';
  if(h<8.5)return'dawn';
  if(h<16.5)return'day';
  if(h<18.5)return'golden';
  if(h<21)return'evening';
  return'night';
}
const SCHOOL_AMBIENT={
  light:{
    dawn:['#ffe7c7','#f0ddff'],
    day:['#fff0a8','#ffe0a3'],
    golden:['#ffd27f','#ffc6a0'],
    evening:['#e7d7ff','#d8d2ff'],
    night:['#d8ccff','#cbbcff'],
  },
  dark:{
    dawn:['#49352d','#342b48'],
    day:['#40351f','#332d24'],
    golden:['#4b3324','#3a2934'],
    evening:['#302443','#26223d'],
    night:['#211831','#2c2045'],
  },
};
function applySchoolAmbientPalette(){
  const phase=root.dataset.flowAmbientPhase||ambientPhase();
  const theme=root.dataset.theme==='dark'?'dark':'light';
  const palette=SCHOOL_AMBIENT[theme][phase]||SCHOOL_AMBIENT[theme].day;
  root.style.setProperty('--flow-ambient-a',palette[0]);
  root.style.setProperty('--flow-ambient-b',palette[1]);
}
applySchoolAmbientPalette();
new MutationObserver(records=>{
  if(records.some(record=>record.attributeName==='data-flow-ambient-phase'||record.attributeName==='data-theme'||record.attributeName==='data-flow-ambient'))queueMicrotask(applySchoolAmbientPalette);
}).observe(root,{attributes:true,attributeFilter:['data-flow-ambient-phase','data-theme','data-flow-ambient']});
addEventListener('storage',event=>{if(event.key==='flow-ambient-v1'||event.key==='flow-school-theme-v3')applySchoolAmbientPalette()});
root.dataset.flowSchoolRuntimeV6Hotfix='ready';
