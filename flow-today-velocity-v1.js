(() => {
  'use strict';
  // Flow Today: hold + pull controls velocity, not one-to-one drag distance.
  // The Rust date strip remains the single source of truth for date selection.
  const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)');
  const DEAD_ZONE=12;
  const MAX_SPEED=2250;  // px/s, reached with a strong sustained pull
  let mounted=null, mountQueued=false;

  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const easeOut=t=>1-Math.pow(1-t,3);

  function mount(rail) {
    if(mounted?.rail===rail)return;
    detach();
    const state={rail,phase:'idle',gesture:null,raf:0,prev:0,
      speed:0,releaseSpeed:0,releaseAt:0,rebasing:false,snapStart:0,
      snapFrom:0,snapTo:0,snapDuration:220,ignoreClickUntil:0,disposed:false};
    mounted=state;
    rail.classList.add('flow-velocity-rail');
    rail.setAttribute('aria-label','날짜 선택: 꾹 누르고 좌우로 당기면 거리만큼 이동 속도가 빨라집니다. 놓으면 날짜에 맞춰 멈춥니다.');
    function stopRaf(){if(state.raf)cancelAnimationFrame(state.raf);state.raf=0;}
    function beginFrame(){if(!state.raf)state.raf=requestAnimationFrame(frame);}
    function position(){
      const midpoint=(rail.scrollWidth-rail.clientWidth)*.5;
      const step=midpoint/90;
      return {midpoint,step,offset:step>0?(rail.scrollLeft-midpoint)/step:0};
    }
    function maybeRebase(){
      if(state.rebasing||!rail.isConnected)return;
      const {offset,step}=position();
      if(step<1||Math.abs(offset)<66)return;
      const i=clamp(Math.round(offset),-89,89)+90;
      const button=rail.querySelector('.day-strip')?.children[i];
      if(!button)return;
      state.rebasing=true;
      // 65+ days away from its origin: Leptos rebases the virtual window.
      // Preserve the exact selected day while silently recycling 181 dates.
      button.click();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{state.rebasing=false;}));
    }
    function moveRail(delta){
      const before=rail.scrollLeft;
      rail.scrollLeft=clamp(before+delta,0,rail.scrollWidth-rail.clientWidth);
      if(Math.abs(rail.scrollLeft-before)>0.01)maybeRebase();
      else state.speed=0;
    }
    function targetVelocity(dx){
      const distance=Math.max(0,Math.abs(dx)-DEAD_ZONE);
      const ramp=clamp(distance/Math.max(90,rail.clientWidth*.45),0,1);
      // Right pull makes dates travel right (toward earlier dates).
      return -Math.sign(dx)*MAX_SPEED*Math.pow(ramp,1.65);
    }
    function activate(){
      state.phase='hold';
      state.speed=0;
      rail.classList.add('flow-velocity-active');
      beginFrame();
    }
    function settle(){
      if(state.disposed)return;
      const {midpoint,step,offset}=position();
      if(step<1){finish();return;}
      const nearest=clamp(Math.round(offset),-90,90);
      state.snapFrom=rail.scrollLeft;
      state.snapTo=clamp(midpoint+nearest*step,0,rail.scrollWidth-rail.clientWidth);
      state.snapStart=0;
      state.snapDuration=reduceMotion.matches?0:clamp(Math.abs(state.snapTo-state.snapFrom)*2.5,130,270);
      state.phase='snap';
      if(!state.snapDuration){
        rail.scrollLeft=state.snapTo;
        select(nearest);
        return;
      }
      beginFrame();
    }
    function select(offset){
      if(!rail.isConnected){finish();return;}
      const index=clamp(offset,-90,90)+90;
      const button=rail.querySelector('.day-strip')?.children[index];
      // Click goes through the same Rust handler as a normal date tap.
      button?.click();
      finish();
    }
    function finish(){
      stopRaf();
      state.phase='idle';
      state.speed=0;
      state.gesture=null;
      rail.classList.remove('flow-velocity-active');
    }
    function frame(now){
      state.raf=0;
      if(state.disposed||!rail.isConnected){finish();return;}
      const dt=state.prev?clamp(now-state.prev,1,48):16.67;
      state.prev=now;
      if(state.phase==='hold'){
        const target=targetVelocity(state.gesture?.dx||0);
        state.speed+=(target-state.speed)*(1-Math.exp(-dt/82));
        moveRail(state.speed*dt/1000);
        beginFrame();
      }else if(state.phase==='inertia'){
        state.speed*=Math.exp(-dt/245);
        moveRail(state.speed*dt/1000);
        if(Math.abs(state.speed)<32||now-state.releaseAt>940)settle();
        else beginFrame();
      }else if(state.phase==='snap'){
        if(!state.snapStart)state.snapStart=now;
        const t=clamp((now-state.snapStart)/state.snapDuration,0,1);
        rail.scrollLeft=state.snapFrom+(state.snapTo-state.snapFrom)*easeOut(t);
        if(t<1)beginFrame();
        else {
          const {offset}=position();
          select(clamp(Math.round(offset),-90,90));
        }
      }
    }
    function pointerDown(event){
      if(state.disposed||!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;
      if(!event.target.closest('.day-carousel,.day-strip'))return;
      if(state.phase!=='idle')finish();
      state.gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,started:false,vertical:false};
      state.phase='press';
      state.prev=0;
    }
    function pointerMove(event){
      const g=state.gesture;
      if(!g||event.pointerId!==g.id||state.disposed)return;
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      if(!g.started){
        if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)*1.2){g.vertical=true;return;}
        if(g.vertical||Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.15)return;
        g.started=true;
        state.ignoreClickUntil=performance.now()+900;
        activate();
        try{rail.setPointerCapture(event.pointerId);}catch(_){}
      }
      g.dx=dx;
      if(event.cancelable)event.preventDefault();
      state.ignoreClickUntil=performance.now()+650;
    }
    function pointerUp(event){
      const g=state.gesture;
      if(!g||event.pointerId!==g.id)return;
      state.gesture=null;
      if(!g.started){state.phase='idle';return;}
      if(event.cancelable)event.preventDefault();
      event.stopPropagation();
      state.ignoreClickUntil=performance.now()+600;
      if(reduceMotion.matches||Math.abs(state.speed)<65){settle();return;}
      state.phase='inertia';
      state.releaseAt=performance.now();
      beginFrame();
    }
    function preventNativeScrollend(event){
      if(state.phase!=='idle'){event.stopImmediatePropagation();}
    }
    function clickGuard(event){
      if(event.isTrusted&&performance.now()<state.ignoreClickUntil){
        event.preventDefault();event.stopImmediatePropagation();
      }
    }
    rail.addEventListener('pointerdown',pointerDown);
    rail.addEventListener('pointermove',pointerMove,{passive:false});
    rail.addEventListener('pointerup',pointerUp,{passive:false});
    rail.addEventListener('pointercancel',pointerUp,{passive:false});
    rail.addEventListener('scrollend',preventNativeScrollend,{capture:true});
    rail.addEventListener('click',clickGuard,{capture:true});
    state.cleanup=()=>{
      state.disposed=true;
      stopRaf();
      rail.removeEventListener('pointerdown',pointerDown);
      rail.removeEventListener('pointermove',pointerMove);
      rail.removeEventListener('pointerup',pointerUp);
      rail.removeEventListener('pointercancel',pointerUp);
      rail.removeEventListener('scrollend',preventNativeScrollend,true);
      rail.removeEventListener('click',clickGuard,true);
      rail.classList.remove('flow-velocity-rail','flow-velocity-active');
    };
  }
  function detach(){
    if(mounted){mounted.cleanup?.();mounted=null;}
  }
  function reconcile(){
    const rail=document.querySelector('.scene[data-scene="today"] .day-carousel');
    if(rail)mount(rail);
    else detach();
  }
  const observer=new MutationObserver(()=>{
    if(mountQueued)return;
    mountQueued=true;
    requestAnimationFrame(()=>{mountQueued=false;reconcile();});
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('pageshow',reconcile);
  reconcile();
})();