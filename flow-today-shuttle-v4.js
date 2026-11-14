(() => {
'use strict';
const MAX_SPEED=2150, DEAD_ZONE=9, RELEASE_DECAY_MS=230;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const ease=t=>1-(1-t)**3;
let active=null,queued=false;
function attach(rail){
  if(active?.rail===rail)return;
  detach();
  const outer=rail.parentElement;
  const s={rail,outer,phase:'idle',gesture:null,grip:null,raf:0,last:0,
    velocity:0,started:0,snapFrom:0,snapTo:0,snapDuration:0,blockClick:0,blockScroll:0,
    rebase:false,disposed:false,releaseTimer:0,preview:null,
    previewCell:null,plannedIndex:90,landingFrom:0,landingTo:0,landingTime:0,landingDuration:0};
  active=s;
  rail.classList.add('flow-shuttle-rail');
  rail.setAttribute('aria-label','날짜 속도 손잡이: 손잡이를 오른쪽으로 당기면 날짜 줄은 왼쪽으로 흐릅니다. 멀리 당길수록 빨라집니다.');
  function stop(){if(s.raf)cancelAnimationFrame(s.raf);s.raf=0;}
  function start(){if(!s.raf)s.raf=requestAnimationFrame(frame);}
  function metrics(){
    const middle=(rail.scrollWidth-rail.clientWidth)*.5,step=middle/90;
    return {middle,step,offset:step>0?(rail.scrollLeft-middle)/step:0};
  }
  function scroll(delta){
    const old=rail.scrollLeft;
    rail.scrollLeft=clamp(old+delta,0,rail.scrollWidth-rail.clientWidth);
    return rail.scrollLeft-old;
  }
  // Do not rebase the Rust date-window in the middle of a gesture:
  // it makes the rail jump to another scroll position.
  // Rust can safely rebase only after the landing animation completes.
  function getLanding(velocity=s.velocity){
    const {middle,step}=metrics();
    if(step<1)return {index:90,left:rail.scrollLeft};
    const future=clamp(rail.scrollLeft+velocity*RELEASE_DECAY_MS/1000,0,rail.scrollWidth-rail.clientWidth);
    const index=clamp(Math.round((future-middle)/step)+90,0,180);
    return {index,left:clamp(middle+(index-90)*step,0,rail.scrollWidth-rail.clientWidth)};
  }
  function showPreview(){
    if(!s.preview){
      const label=document.createElement('div');
      label.className='flow-shuttle-landing-label';
      label.setAttribute('role','status');
      label.setAttribute('aria-live','off');
      outer.appendChild(label);
      s.preview=label;
    }
    s.preview.hidden=false;
  }
  function hidePreview(){
    if(s.previewCell){s.previewCell.classList.remove('flow-shuttle-landing');s.previewCell=null;}
    if(s.preview){s.preview.remove();s.preview=null;}
  }
  function previewLanding(force=false){
    if(s.phase!=='drag'&&!force)return;
    const plan=getLanding(s.velocity);
    s.plannedIndex=plan.index;
    const cell=rail.querySelector('.day-strip')?.children[plan.index];
    if(!cell)return;
    if(s.previewCell!==cell){
      s.previewCell?.classList.remove('flow-shuttle-landing');
      s.previewCell=cell;
      cell.classList.add('flow-shuttle-landing');
    }
    showPreview();
    const title=cell.getAttribute('aria-label')||
      ((cell.querySelector('small')?.textContent||'')+' '+(cell.querySelector('strong')?.textContent||''));
    const text='놓으면 '+title+' 선택';
    if(s.preview.textContent!==text)s.preview.textContent=text;
  }
  function removeGrip(){
    if(s.releaseTimer){clearTimeout(s.releaseTimer);s.releaseTimer=0;}
    outer.querySelectorAll('.flow-shuttle-grip').forEach(el=>el.remove());
    s.grip=null;
  }
  function showGrip(g){
    removeGrip();
    const cell=g.cell;if(!cell)return;
    const rect=cell.getBoundingClientRect(),shellRect=outer.getBoundingClientRect();
    const grip=document.createElement('div');
    grip.className='flow-shuttle-grip';
    grip.setAttribute('aria-hidden','true');
    grip.innerHTML=cell.innerHTML;
    grip.style.left=(rect.left-shellRect.left)+'px';
    grip.style.top=(rect.top-shellRect.top)+'px';
    grip.style.width=rect.width+'px';
    grip.style.height=rect.height+'px';
    outer.appendChild(grip);
    s.grip=grip; g.originLeft=rect.left;g.width=rect.width;
  }
  function updateGrip(g){
    if(!s.grip)return;
    const bounds=rail.getBoundingClientRect();
    const left=clamp(g.originLeft+g.dx,bounds.left+2,bounds.right-g.width-2);
    const delta=left-g.originLeft;
    s.grip.style.transform='translate3d('+delta.toFixed(2)+'px,0,0)';
  }
  function releaseGrip(){
    const grip=s.grip;
    if(!grip)return;
    s.grip=null;
    grip.classList.add('is-releasing');
    requestAnimationFrame(()=>{
      grip.style.opacity='0';
      grip.style.transform='translate3d(0,0,0)';
    });
    s.releaseTimer=setTimeout(()=>{grip.remove();s.releaseTimer=0;},320);
  }
  function reset(){
    stop();s.phase='idle';s.gesture=null;s.velocity=0;s.last=0;
    rail.classList.remove('flow-shuttle-dragging');
    hidePreview();removeGrip();
  }
  function choose(index){
    const cell=rail.querySelector('.day-strip')?.children[index];
    s.blockScroll=performance.now()+850;
    if(cell){
      // First complete the visible movement; only then tell Leptos to select.
      cell.click();
    }
    reset();
  }
  function smoothLanding(){
    const {index,left}=getLanding(s.velocity);
    s.plannedIndex=index;
    s.landingFrom=rail.scrollLeft;
    s.landingTo=left;
    s.landingTime=0;
    const distance=Math.abs(s.landingTo-s.landingFrom);
    s.landingDuration=reduce.matches?0:clamp(340+distance*.12,340,620);
    s.phase='landing';s.blockScroll=performance.now()+s.landingDuration+850;
    if(s.landingDuration<1){
      rail.scrollLeft=left;choose(index);
    }else start();
  }
  function frame(time){
    s.raf=0;
    if(s.disposed||!rail.isConnected){reset();return;}
    const dt=s.last?clamp(time-s.last,1,45):16.7;
    s.last=time;
    if(s.phase==='drag'){
      const g=s.gesture;if(!g){snap();return;}
      const d=Math.max(0,Math.abs(g.dx)-DEAD_ZONE);
      const strength=clamp(d/Math.max(150,rail.clientWidth*.45),0,1);
      // Pull right => positive scrollLeft => dates travel visually LEFT.
      const wanted=Math.sign(g.dx)*MAX_SPEED*strength**1.55;
      s.velocity+=(wanted-s.velocity)*(1-Math.exp(-dt/90));
      scroll(s.velocity*dt/1000);
      previewLanding();
      start();
    }else if(s.phase==='landing'){
      if(!s.landingTime)s.landingTime=time;
      const t=clamp((time-s.landingTime)/s.landingDuration,0,1);
      // Physically continuous pixel positions, not a one-frame jump.
      rail.scrollLeft=s.landingFrom+(s.landingTo-s.landingFrom)*ease(t);
      if(t<1)start();
      else {rail.scrollLeft=s.landingTo;choose(s.plannedIndex);}
    }
  }
  function down(e){
    if(s.disposed||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
    const cell=e.target.closest('.day-strip button');
    if(!cell)return;
    if(s.phase!=='idle')reset();
    s.gesture={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,drag:false,vertical:false,cell};
    s.phase='press';s.last=0;
  }
  function move(e){
    const g=s.gesture;
    if(!g||g.id!==e.pointerId||g.vertical)return;
    const dx=e.clientX-g.x,dy=e.clientY-g.y;
    if(!g.drag){
      if(Math.abs(dy)>11&&Math.abs(dy)>Math.abs(dx)*1.15){g.vertical=true;return;}
      if(Math.abs(dx)<7||Math.abs(dx)<Math.abs(dy)*1.15)return;
      g.drag=true;s.phase='drag';
      rail.classList.add('flow-shuttle-dragging');
      showGrip(g);
      showPreview();
      try{rail.setPointerCapture(e.pointerId);}catch(_){}
      start();
    }
    g.dx=dx;
    updateGrip(g);
    previewLanding();
    s.blockClick=performance.now()+680;
    s.blockScroll=performance.now()+700;
    if(e.cancelable)e.preventDefault();
  }
  function up(e){
    const g=s.gesture;
    if(!g||g.id!==e.pointerId)return;
    s.gesture=null;
    if(!g.drag){s.phase='idle';return;}
    if(e.cancelable)e.preventDefault();
    e.stopPropagation();
    s.blockClick=performance.now()+680;
    s.blockScroll=performance.now()+1000;
    rail.classList.remove('flow-shuttle-dragging');
    releaseGrip();
    // Freeze the advertised landing before releasing the handle;
    // glide to that exact date instead of simulating inertia then snapping.
    smoothLanding();
  }
  function scrollend(e){
    if(s.phase!=='idle'||performance.now()<s.blockScroll)e.stopImmediatePropagation();
  }
  function click(e){
    if(e.isTrusted&&performance.now()<s.blockClick){
      e.preventDefault();e.stopImmediatePropagation();
    }
  }
  rail.addEventListener('pointerdown',down);
  rail.addEventListener('pointermove',move,{passive:false});
  rail.addEventListener('pointerup',up,{passive:false});
  rail.addEventListener('pointercancel',up,{passive:false});
  rail.addEventListener('scrollend',scrollend,true);
  rail.addEventListener('click',click,true);
  s.cleanup=()=>{
    s.disposed=true;stop();hidePreview();removeGrip();
    rail.removeEventListener('pointerdown',down);
    rail.removeEventListener('pointermove',move);
    rail.removeEventListener('pointerup',up);
    rail.removeEventListener('pointercancel',up);
    rail.removeEventListener('scrollend',scrollend,true);
    rail.removeEventListener('click',click,true);
    rail.classList.remove('flow-shuttle-rail','flow-shuttle-dragging');
  };
}
function detach(){if(active){active.cleanup?.();active=null;}}
function check(){
  const rail=document.querySelector('.scene[data-scene="today"] .day-carousel');
  if(rail)attach(rail);else detach();
}
new MutationObserver(()=>{
  if(queued)return;queued=true;
  requestAnimationFrame(()=>{queued=false;check();});
}).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('pageshow',check);
check();
})();