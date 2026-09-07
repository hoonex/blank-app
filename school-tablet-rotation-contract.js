const root=document.documentElement;
const MOBILE_QUERY='(max-width:520px)';
const TABLET_QUERY='(min-width:521px) and (max-width:1180px)';
const WIDE_TOUCH_TABLET='(min-width:1181px) and (max-width:1536px) and (max-height:1024px) and (orientation:landscape)';
let syncFrame=0;

function wideTouchTablet(){
  if(!matchMedia(WIDE_TOUCH_TABLET).matches)return false;
  const touchCapable=Number(navigator.maxTouchPoints||0)>0;
  const touchPrimary=matchMedia('(pointer:coarse)').matches||matchMedia('(hover:none)').matches;
  return touchCapable&&touchPrimary;
}

function layoutMode(){
  if(matchMedia(MOBILE_QUERY).matches)return'mobile';
  if(matchMedia(TABLET_QUERY).matches||wideTouchTablet())return'tablet';
  return'desktop';
}

function applyLayoutState(){
  const mode=layoutMode();
  root.dataset.flowSchoolLayout=mode;
  root.dataset.flowSchoolTabletRotation=mode==='desktop'?'wide':'compact';
  root.dataset.flowTodayTopbar=mode==='desktop'?'wide':'ready';
  root.dataset.flowSchoolResponsiveContract='v2';
}

function syncLayoutState(){
  cancelAnimationFrame(syncFrame);
  syncFrame=requestAnimationFrame(applyLayoutState);
}

applyLayoutState();
window.addEventListener('resize',syncLayoutState,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(syncLayoutState,60),{passive:true});
window.visualViewport?.addEventListener?.('resize',syncLayoutState,{passive:true});
