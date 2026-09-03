const root=document.documentElement;
const STYLE_ID='flow-school-global-shell-glass-style';
let raiseQueued=false;
let geometryQueued=false;

function raiseStyle(){
  const style=document.querySelector(`#${STYLE_ID}`);
  if(style?.parentElement===document.head)document.head.append(style);
}
function queueRaiseStyle(){
  if(raiseQueued)return;
  raiseQueued=true;
  queueMicrotask(()=>{raiseQueued=false;raiseStyle()});
}
function applyGeometry(){
  const desktop=window.innerWidth>=1181;
  const nav=document.querySelector('#bottomNav.mobile-bottom-nav');
  const dock=document.querySelector('#flowTodayDateDock');
  if(nav&&!desktop){
    nav.style.setProperty('border-radius','9999px','important');
    nav.style.setProperty('corner-shape','round','important');
  }
  if(dock){
    if(desktop){
      dock.style.setProperty('display','none','important');
      dock.style.setProperty('visibility','hidden','important');
      dock.style.setProperty('pointer-events','none','important');
    }else{
      dock.style.removeProperty('display');
      dock.style.removeProperty('visibility');
      dock.style.removeProperty('pointer-events');
    }
  }
}
function queueGeometry(){
  if(geometryQueued)return;
  geometryQueued=true;
  requestAnimationFrame(()=>{geometryQueued=false;applyGeometry()});
}

function installStyle(){
  if(document.querySelector(`#${STYLE_ID}`))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
/* Shared School chrome contract. Geometry is shared. Standard/Optical material
   remains owned by the glass system so switching modes visibly changes optics. */
@media(max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .desktop-sidebar{display:none!important}

  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) .mobile-topbar,
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden):has(#flowTodayDateDock) .mobile-topbar:has(#flowTodayDateDock){
    display:flex!important;
    box-sizing:border-box!important;
    width:100vw!important;
    min-width:100vw!important;
    max-width:none!important;
    min-height:64px!important;
    margin-left:calc(50% - 50vw)!important;
    margin-right:calc(50% - 50vw)!important;
    padding:7px max(14px,env(safe-area-inset-right)) 7px max(14px,env(safe-area-inset-left))!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:8px!important;
    border-radius:0!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"]:not([data-flow-glass-mode="optical"]) body #dashboard.product-shell:not(.hidden) .mobile-topbar{
    border:0!important;
    border-bottom:1px solid color-mix(in srgb,var(--text) 5%,transparent)!important;
    background:color-mix(in srgb,var(--surface) 78%,transparent)!important;
    box-shadow:0 8px 26px rgba(31,42,68,.065),inset 0 1px 0 rgba(255,255,255,.62)!important;
    backdrop-filter:blur(22px) saturate(166%)!important;
    -webkit-backdrop-filter:blur(22px) saturate(166%)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .mobile-topbar .flow-logo{flex:0 0 auto!important}
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .mobile-topbar .mobile-school-button{
    flex:0 0 auto!important;
    min-height:44px!important;
    height:44px!important;
    border-radius:12px!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"]:not([data-flow-glass-mode="optical"]) body #dashboard:not(.hidden) .mobile-topbar .mobile-school-button{
    border:0!important;
    background:color-mix(in srgb,var(--surface) 66%,transparent)!important;
    box-shadow:0 5px 16px rgba(35,48,72,.07),inset 0 1px 0 rgba(255,255,255,.66)!important;
  }

  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav{
    display:grid!important;
    box-sizing:border-box!important;
    isolation:isolate!important;
    overflow:hidden!important;
    border-radius:9999px!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"]:not([data-flow-glass-mode="optical"]) body #bottomNav.mobile-bottom-nav{
    background:color-mix(in srgb,var(--surface) 76%,transparent)!important;
    border:1px solid color-mix(in srgb,var(--text) 7%,rgba(255,255,255,.42))!important;
    box-shadow:0 14px 38px rgba(31,42,68,.14),inset 0 1px 0 rgba(255,255,255,.72)!important;
    backdrop-filter:blur(26px) saturate(172%)!important;
    -webkit-backdrop-filter:blur(26px) saturate(172%)!important;
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.mobile-tab,
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav::before,
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
    border-radius:9999px!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.mobile-tab{background:transparent!important;box-shadow:none!important}
  html[data-flow-school-ui="v2"]:not([data-flow-glass-mode="optical"]) body #bottomNav.mobile-bottom-nav::before{
    background:radial-gradient(125% 110% at var(--flow-lens-light-x,34%) -8%,rgba(255,255,255,.80) 0%,rgba(255,255,255,.24) 31%,transparent 59%),linear-gradient(180deg,color-mix(in srgb,var(--accent) 10%,var(--surface)),color-mix(in srgb,var(--accent) 5%,var(--surface)))!important;
    border:1px solid color-mix(in srgb,var(--accent) 17%,rgba(255,255,255,.48))!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.84),inset 0 -1px 0 rgba(35,56,94,.045),0 6px 18px rgba(44,73,146,.11)!important;
    backdrop-filter:blur(19px) saturate(188%)!important;
    -webkit-backdrop-filter:blur(19px) saturate(188%)!important;
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav[data-flow-lens-pressed="true"]::before,
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav[data-flow-lens-dragging="true"]::before{border-radius:9999px!important}
}

@media(max-width:520px){
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden) .mobile-topbar,
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden):has(#flowTodayDateDock) .mobile-topbar:has(#flowTodayDateDock){
    min-height:56px!important;height:56px!important;
    padding:3px max(7px,env(safe-area-inset-right)) 3px max(7px,env(safe-area-inset-left))!important;
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav{
    left:10px!important;right:10px!important;width:auto!important;
    min-height:56px!important;height:56px!important;max-height:56px!important;
    padding:5px!important;bottom:calc(8px + env(safe-area-inset-bottom))!important;transform:none!important;
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.mobile-tab{min-height:44px!important;height:44px!important}
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) #flowSchoolSettingsView:not(.hidden){inset:56px 0 0!important}
}

@media(min-width:521px) and (max-width:1180px){
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav{
    left:50%!important;right:auto!important;width:min(680px,calc(100vw - 32px))!important;
    min-height:60px!important;height:60px!important;max-height:60px!important;
    padding:7px!important;bottom:calc(10px + env(safe-area-inset-bottom))!important;transform:translateX(-50%)!important;
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.mobile-tab{min-height:44px!important;height:44px!important}
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav::before{
    top:var(--flow-lens-top,8px)!important;
    bottom:auto!important;
    height:var(--flow-lens-height,44px)!important;
  }
}

@media(min-width:1181px){
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden).product-shell{display:grid!important}
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .desktop-sidebar{display:flex!important}
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .mobile-topbar,
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav,
  html[data-flow-school-ui="v2"] body #flowTodayDateDock{
    display:none!important;visibility:hidden!important;pointer-events:none!important;
  }
}
`;
  document.head.append(style);
}

installStyle();
root.dataset.flowSchoolGlobalShell='v1';
const headObserver=new MutationObserver(records=>{
  const own=document.querySelector(`#${STYLE_ID}`);
  const added=records.some(record=>[...record.addedNodes].some(node=>node!==own&&(node.nodeName==='STYLE'||(node.nodeName==='LINK'&&node.rel==='stylesheet'))));
  if(added)queueRaiseStyle();
});
headObserver.observe(document.head,{childList:true});
const bodyObserver=new MutationObserver(()=>queueGeometry());
bodyObserver.observe(document.body,{childList:true,subtree:true});
window.addEventListener('resize',queueGeometry,{passive:true});
window.visualViewport?.addEventListener('resize',queueGeometry,{passive:true});
window.addEventListener('load',()=>{raiseStyle();applyGeometry()},{once:true,passive:true});
window.addEventListener('flow:glass-mode-changed',()=>{queueRaiseStyle();queueGeometry();setTimeout(()=>{raiseStyle();applyGeometry()},180)},{passive:true});
for(const delay of [0,120,600,1400])setTimeout(()=>{raiseStyle();applyGeometry()},delay);
