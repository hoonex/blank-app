(() => {
  'use strict';
  // Follow the finger 1:1; a sustained pull adds acceleration in that SAME direction.
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const MAX_AUTO=1600, AUTO_ZONE=30, HOLD_DELAY=115;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ease=t=>1-Math.pow(1-t,3);
  let mounted=null,queued=false;

  function mount(rail){
    if(mounted?.rail===rail)return;
    unmount();
    const s={rail,phase:'idle',gesture:null,frameId:0,lastFrame:0,
      speed:0,autoSpeed:0,releaseAt:0,snapStart:0,snapFrom:0,snapTo:0,
      snapDuration:0,blockClickUntil:0,blockScrollUntil:0,rebasing:false,disposed:false};
    mounted=s;
    rail.classList.add('flow-direct-rail');
    rail.setAttribute('aria-label','날짜 선택: 좌우로 끌면 날짜가 손가락을 따라 이동하고, 멀리 당긴 채 유지하면 그 방향으로 더 빨라집니다.');
    const cancel=()=>{if(s.frameId)cancelAnimationFrame(s.frameId);s.frameId=0;};
    const schedule=()=>{if(!s.frameId)s.frameId=requestAnimationFrame(frame);};
    const metrics=()=>{
      const middle=(rail.scrollWidth-rail.clientWidth)/2;
      const step=middle/90;
      return {middle,step,offset:step>0?(rail.scrollLeft-middle)/step:0};
    };
    function adjust(delta){
      const old=rail.scrollLeft;
      rail.scrollLeft=clamp(old+delta,0,rail.scrollWidth-rail.clientWidth);
      return rail.scrollLeft-old;
    }
    function rebaseIfNeeded(){
      const {offset}=metrics();
      if(s.rebasing||Math.abs(offset)<73)return;
      const idx=clamp(Math.round(offset),-89,89)+90;
      const btn=rail.querySelector('.day-strip')?.children[idx];
      if(!btn)return;
      s.rebasing=true;
      btn.click(); // Rust rebases its 181-date data window.
      requestAnimationFrame(()=>requestAnimationFrame(()=>{s.rebasing=false;}));
    }
    function selectNearest(){
      const {offset}=metrics();
      const index=clamp(Math.round(offset),-90,90)+90;
      const btn=rail.querySelector('.day-strip')?.children[index];
      s.blockScrollUntil=performance.now()+550;
      btn?.click(); // Reuse the existing Rust date-selection handler.
      done();
    }
    function done(){
      cancel();
      s.phase='idle';s.gesture=null;s.speed=0;s.autoSpeed=0;s.lastFrame=0;
      rail.classList.remove('flow-direct-dragging');
    }
    function snap(){
      const {middle,step,offset}=metrics();
      if(step<1){done();return;}
      s.snapFrom=rail.scrollLeft;
      s.snapTo=clamp(middle+clamp(Math.round(offset),-90,90)*step,0,rail.scrollWidth-rail.clientWidth);
      s.snapStart=0;
      s.snapDuration=reduced.matches?0:clamp(Math.abs(s.snapTo-s.snapFrom)*2.2,115,250);
      s.phase='snap';s.blockScrollUntil=performance.now()+700;
      if(!s.snapDuration){rail.scrollLeft=s.snapTo;selectNearest();return;}
      schedule();
    }
    function frame(time){
      s.frameId=0;
      if(s.disposed||!rail.isConnected){done();return;}
      const dt=s.lastFrame?clamp(time-s.lastFrame,1,45):16.7;
      s.lastFrame=time;
      if(s.phase==='drag'){
        const g=s.gesture;
        if(!g){snap();return;}
        // A moving finger owns the visual position. Auto-scroll starts only
        // after the finger rests in an extended pull for 115ms.
        const idleFor=time-g.lastMove;
        const travel=Math.max(0,Math.abs(g.dx)-AUTO_ZONE);
        const ramp=clamp(travel/Math.max(135,rail.clientWidth*.42),0,1);
        const target=idleFor>HOLD_DELAY ? -Math.sign(g.dx)*MAX_AUTO*Math.pow(ramp,1.6):0;
        s.autoSpeed+=(target-s.autoSpeed)*(1-Math.exp(-dt/125));
        if(Math.abs(s.autoSpeed)>.8)adjust(s.autoSpeed*dt/1000);
        if(Math.abs(metrics().offset)>73)rebaseIfNeeded();
        schedule();
      } else if(s.phase==='inertia'){
        s.speed*=Math.exp(-dt/235);
        if(Math.abs(adjust(s.speed*dt/1000))<.1)s.speed=0;
        if(Math.abs(metrics().offset)>73)rebaseIfNeeded();
        if(Math.abs(s.speed)<25||time-s.releaseAt>900)snap();
        else schedule();
      } else if(s.phase==='snap'){
        if(!s.snapStart)s.snapStart=time;
        const t=clamp((time-s.snapStart)/s.snapDuration,0,1);
        rail.scrollLeft=s.snapFrom+(s.snapTo-s.snapFrom)*ease(t);
        if(t<1)schedule(); else selectNearest();
      }
    }
    function down(e){
      if(s.disposed||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
      if(!e.target.closest('.day-strip,.day-carousel'))return;
      if(s.phase!=='idle')done();
      const now=performance.now();
      s.gesture={id:e.pointerId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,
        lastTime:now,lastMove:now,dx:0,didDrag:false,vertical:false,dragSpeed:0};
      s.phase='press';s.lastFrame=0;
    }
    function move(e){
      const g=s.gesture;
      if(!g||g.id!==e.pointerId||s.disposed||g.vertical)return;
      const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
      if(!g.didDrag){
        if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.2){g.vertical=true;return;}
        if(Math.abs(dx)<7||Math.abs(dx)<Math.abs(dy)*1.12)return;
        g.didDrag=true;s.phase='drag';
        rail.classList.add('flow-direct-dragging');
        try{rail.setPointerCapture(e.pointerId);}catch(_){}
        schedule();
      }
      // CSS scrollLeft is the opposite of visual content movement.
      // Finger +40px => scrollLeft -40px => date cell +40px.
      const fingerDelta=e.clientX-g.lastX;
      const now=performance.now();
      const elapsed=clamp(now-g.lastTime,8,100);
      adjust(-fingerDelta);
      const instant=-fingerDelta*1000/elapsed;
      g.dragSpeed=clamp(g.dragSpeed*.4+instant*.6,-2800,2800);
      g.dx=dx;g.lastX=e.clientX;g.lastTime=now;g.lastMove=now;
      s.autoSpeed=0;
      s.blockClickUntil=now+650;
      s.blockScrollUntil=now+650;
      if(e.cancelable)e.preventDefault();
    }
    function up(e){
      const g=s.gesture;
      if(!g||g.id!==e.pointerId)return;
      s.gesture=null;
      if(!g.didDrag){s.phase='idle';return;} // plain tap remains native
      if(e.cancelable)e.preventDefault();
      e.stopPropagation();
      const now=performance.now();
      s.blockClickUntil=now+650;s.blockScrollUntil=now+900;
      const sinceMove=now-g.lastMove;
      // Release in the direction the cells were already moving.
      s.speed=sinceMove<95?g.dragSpeed:s.autoSpeed;
      if(reduced.matches||Math.abs(s.speed)<45){snap();return;}
      s.phase='inertia';s.releaseAt=now;s.lastFrame=0;schedule();
    }
    function scrollend(e){
      if(s.phase!=='idle'||performance.now()<s.blockScrollUntil)e.stopImmediatePropagation();
    }
    function click(e){
      if(e.isTrusted&&performance.now()<s.blockClickUntil){
        e.preventDefault();e.stopImmediatePropagation();
      }
    }
    rail.addEventListener('pointerdown',down);
    rail.addEventListener('pointermove',move,{passive:false});
    rail.addEventListener('pointerup',up,{passive:false});
    rail.addEventListener('pointercancel',up,{passive:false});
    rail.addEventListener('scrollend',scrollend,{capture:true});
    rail.addEventListener('click',click,{capture:true});
    s.cleanup=()=>{
      s.disposed=true;cancel();
      rail.removeEventListener('pointerdown',down);
      rail.removeEventListener('pointermove',move);
      rail.removeEventListener('pointerup',up);
      rail.removeEventListener('pointercancel',up);
      rail.removeEventListener('scrollend',scrollend,true);
      rail.removeEventListener('click',click,true);
      rail.classList.remove('flow-direct-rail','flow-direct-dragging');
    };
  }
  function unmount(){if(mounted){mounted.cleanup?.();mounted=null;}}
  function reconcile(){
    const rail=document.querySelector('.scene[data-scene="today"] .day-carousel');
    if(rail)mount(rail);else unmount();
  }
  new MutationObserver(()=>{
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;reconcile();});
  }).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('pageshow',reconcile);
  reconcile();
})();