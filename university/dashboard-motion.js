const ACTIVE_STATES=new Set(['running','pending','paused']);
let resizeTakeoverInstalled=false;

function targetsTransform(animation,el){
  if(!animation||animation.effect?.target!==el)return false;
  const frames=animation.effect?.getKeyframes?.()||[];
  return frames.some(frame=>frame?.transform!==undefined&&frame.transform!==null&&String(frame.transform)!=='none');
}

export function cancelWidgetTransformMotion(el){
  if(!el?.getAnimations)return 0;
  let cancelled=0;
  for(const animation of el.getAnimations()){
    if(!ACTIVE_STATES.has(animation.playState)||!targetsTransform(animation,el))continue;
    try{animation.cancel();cancelled++}catch{}
  }
  return cancelled;
}

export function takeWidgetPresentation(el){
  const rect=el?.getBoundingClientRect?.();
  if(!rect)return null;
  cancelWidgetTransformMotion(el);
  return rect;
}

export function installWidgetResizePresentationTakeover(root=document){
  if(resizeTakeoverInstalled||!root?.addEventListener)return false;
  resizeTakeoverInstalled=true;
  root.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const handle=event.target?.closest?.('.widget-v2-resize');
    const widget=handle?.closest?.('#widgetDashboard [data-widget-id]');
    if(!widget)return;
    /* The resize owner samples its live rect later in this same pointerdown dispatch.
       Cancel after that synchronous lift, but before the next rendered frame. */
    queueMicrotask(()=>cancelWidgetTransformMotion(widget));
  },{capture:true});
  return true;
}
