(function(){
  'use strict';
  const mq=matchMedia('(max-width:590px)');
  const dayNames=['일','월','화','수','목','금','토'];
  const remember=new Map();
  let active=null,mountQueued=false;
  const pad=n=>String(n).padStart(2,'0');
  const key=(y,m)=>`${y}-${pad(m)}`;
  const monthShift=(y,m,delta)=>{const d=new Date(y,m-1+delta,1);return [d.getFullYear(),d.getMonth()+1];};
  const limit=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const ease=t=>1-(1-t)**3;
  const readMonth=scene=>{const txt=scene.querySelector('.calendar-toolbar h2')?.textContent||'';const m=txt.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/);return m?[+m[1],+m[2]]:null;};
  function capture(sheet){
    const days=new Set();
    sheet.querySelectorAll('.calendar-grid button:not(.out-month)').forEach(btn=>{
      const n=Number(btn.querySelector('.calendar-num')?.textContent);
      const event=btn.querySelector('.calendar-event-text')?.textContent.trim();
      if(n>=1&&n<=31&&event)days.add(n);
    });
    return days;
  }
  function makeMonth(offset,year,month,known){
    const [y,m]=monthShift(year,month,offset);
    const panel=document.createElement('section');
    panel.className='flow-orbit-preview';
    panel.dataset.orbitSide=offset;
    panel.setAttribute('role','button');
    panel.setAttribute('tabindex','0');
    panel.setAttribute('aria-label',`${y}년 ${m}월 보기`);
    const heading=document.createElement('div');
    heading.className='flow-orbit-preview-title';
    heading.textContent=`${y}년 ${m}월`;
    const grid=document.createElement('div');
    grid.className='flow-orbit-grid';
    dayNames.forEach(name=>{const cell=document.createElement('span');cell.className='flow-orbit-weekday';cell.textContent=name;grid.appendChild(cell);});
    const offsetDay=new Date(y,m-1,1).getDay();
    const days=new Date(y,m,0).getDate();
    const count=Math.ceil((offsetDay+days)/7)*7;
    for(let i=0;i<count;i++){
      const date=new Date(y,m-1,i+1-offsetDay);
      const outside=date.getMonth()!==m-1;
      const cell=document.createElement('span');
      cell.className='flow-orbit-day'+(outside?' out-month':'');
      const number=document.createElement('span');
      number.textContent=pad(date.getDate());
      cell.appendChild(number);
      if(!outside&&known?.has(date.getDate())){
        const dot=document.createElement('i');dot.className='flow-orbit-event';cell.appendChild(dot);
      }
      grid.appendChild(cell);
    }
    const edge=document.createElement('span');
    edge.className='flow-orbit-edge-label';
    edge.textContent=`${m}월`;
    panel.append(heading,grid,edge);
    panel.addEventListener('click',()=>{
      if(active?.animating||performance.now()<(active?.ignoreClickUntil||0))return;
      navigate(offset);
    });
    panel.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate(offset);}
    });
    return panel;
  }
  function place(progress){
    const s=active;if(!s||!s.scene.isConnected)return;
    s.progress=progress;
    const radius=Math.max(185,s.layout.clientWidth-72)*1.18;
    const height=s.main.offsetHeight;
    for(const [element,slot,central] of [[s.main,0,true],[s.left,-1,false],[s.right,1,false]]){
      if(!element)continue;
      const rel=slot-progress,distance=Math.min(2.2,Math.abs(rel));
      const radians=rel*.90;
      const x=Math.sin(radians)*radius;
      const z=-(1-Math.cos(radians))*radius*.63;
      const turn=-rel*32;
      const size=1-distance*.065;
      const transform=`translate3d(${x.toFixed(2)}px,0,${z.toFixed(2)}px) rotateY(${turn.toFixed(2)}deg) scale(${size.toFixed(4)})`;
      if(central){s.layout.style.setProperty('--flow-orbit-center',transform);}
      else{
        element.style.transform=transform;
        element.style.opacity=String(limit(1-Math.max(0,distance-1.15)*1.6,0,1));
        element.style.zIndex=String(Math.round(20-distance*10));
        element.style.height=height+'px';
        element.style.pointerEvents=distance<1.4&&!s.animating?'auto':'none';
      }
    }
  }
  function refresh(force=false){
    const s=active;
    if(!s||s.animating||!s.scene.isConnected)return;
    const month=readMonth(s.scene);
    if(!month)return;
    const [year,mo]=month;
    const currentKey=key(year,mo);
    const marks=capture(s.main);
    const stamp=[...marks].sort((a,b)=>a-b).join(',');
    remember.set(currentKey,marks);
    if(!force&&s.monthKey===currentKey&&s.eventStamp===stamp)return;
    s.monthKey=currentKey;s.eventStamp=stamp;
    for(const side of [-1,1]){
      const [y,m]=monthShift(year,mo,side);
      const panel=makeMonth(side,year,mo,remember.get(key(y,m)));
      const old=side<0?s.left:s.right;
      if(old)old.replaceWith(panel);
      else s.layout.insertBefore(panel,s.layout.querySelector('.event-sheet'));
      if(side<0)s.left=panel;else s.right=panel;
    }
    place(s.progress);
  }
  function tween(target,duration,done){
    const s=active;if(!s||s.animating)return;
    s.animating=true;
    const initial=s.progress,start=performance.now();
    function draw(now){
      if(active!==s||!s.scene.isConnected)return;
      const t=limit((now-start)/duration,0,1);
      place(initial+(target-initial)*ease(t));
      if(t<1)requestAnimationFrame(draw);
      else{s.animating=false;done?.();}
    }
    requestAnimationFrame(draw);
  }
  function navigate(direction){
    const s=active;if(!s||s.animating)return;
    const delta=direction<0?-1:1;
    s.ignoreClickUntil=performance.now()+750;
    s.stopNativeUntil=performance.now()+1100;
    tween(delta,400,()=>{
      const arrows=s.scene.querySelectorAll('.month-actions .month-chevron');
      const target=delta<0?arrows[0]:arrows[arrows.length-1];
      if(!target||arrows.length<2){tween(0,270);return;}
      // The visible neighboring DOM card is centered before Leptos changes its month.
      // Swap the real calendar at that point, then return the orbit to its rest position.
      target.click();
      requestAnimationFrame(()=>{
        if(active!==s)return;
        s.progress=0;
        refresh(true);
        place(0);
      });
    });
  }
  function down(e){
    const s=active;
    if(!s||s.animating||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
    const panel=e.target.closest('.calendar-sheet,.flow-orbit-preview');
    if(!panel||!s.layout.contains(panel))return;
    s.drag={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),moved:false,vertical:false};
  }
  function move(e){
    const s=active;if(!s?.drag||s.drag.id!==e.pointerId||s.animating)return;
    const d=s.drag,dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.moved){
      if(Math.abs(dy)>11&&Math.abs(dy)>Math.abs(dx)*1.14){d.vertical=true;return;}
      if(d.vertical||Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.16)return;
      d.moved=true;s.layout.classList.add('flow-orbit-dragging');
    }
    if(e.cancelable)e.preventDefault();
    place(limit(-dx/(Math.max(180,s.layout.clientWidth)*.79),-1.24,1.24));
  }
  function up(e){
    const s=active;
    if(!s?.drag||s.drag.id!==e.pointerId)return;
    const d=s.drag;s.drag=null;s.layout.classList.remove('flow-orbit-dragging');
    if(!d.moved)return;
    if(e.cancelable)e.preventDefault();
    e.stopPropagation();
    s.stopNativeUntil=performance.now()+850;
    const traveled=e.clientX-d.x;
    const velocity=Math.abs(traveled)/Math.max(1,performance.now()-d.time);
    if(Math.abs(s.progress)>.23||(Math.abs(traveled)>22&&velocity>.48))navigate(s.progress>0?1:-1);
    else tween(0,290);
  }
  function remove(){
    const s=active;if(!s)return;
    s.observe.disconnect();s.left?.remove();s.right?.remove();
    s.layout.classList.remove('flow-orbit-enabled','flow-orbit-dragging');
    s.layout.style.removeProperty('--flow-orbit-center');
    active=null;
  }
  function setup(scene){
    const layout=scene.querySelector('.calendar-layout');
    const main=layout?.querySelector(':scope > .calendar-sheet');
    if(!layout||!main||!readMonth(scene))return;
    remove();
    const s={scene,layout,main,left:null,right:null,progress:0,drag:null,
      monthKey:'',eventStamp:'',ignoreClickUntil:0,stopNativeUntil:0,animating:false,observe:null};
    active=s;layout.classList.add('flow-orbit-enabled');
    layout.addEventListener('pointerdown',down,{passive:true});
    layout.addEventListener('pointermove',move,{passive:false});
    layout.addEventListener('pointerup',up,{passive:false});
    layout.addEventListener('pointercancel',up,{passive:false});
    layout.addEventListener('touchstart',e=>{
      if(e.target.closest('.flow-orbit-preview'))e.stopPropagation();
    },{passive:true});
    layout.addEventListener('touchend',e=>{
      if(performance.now()<s.stopNativeUntil||s.drag?.moved){
        if(e.cancelable)e.preventDefault();
        e.stopImmediatePropagation();
      }
    },{capture:true,passive:false});
    refresh(true);
    let scheduled=false;
    s.observe=new MutationObserver(()=>{
      if(scheduled)return;scheduled=true;
      requestAnimationFrame(()=>{scheduled=false;if(active===s)refresh();});
    });
    s.observe.observe(scene.querySelector('.calendar-toolbar'),{subtree:true,childList:true,characterData:true});
    s.observe.observe(main.querySelector('.calendar-grid'),{subtree:true,childList:true,characterData:true});
  }
  function mount(){
    if(!mq.matches){remove();return;}
    const scene=document.querySelector('.scene[data-scene="calendar"]');
    if(scene&&(!active||active.scene!==scene))setup(scene);
    else if(!scene&&active)remove();
  }
  new MutationObserver(()=>{
    if(mountQueued)return;mountQueued=true;
    requestAnimationFrame(()=>{mountQueued=false;mount();});
  }).observe(document.documentElement,{subtree:true,childList:true});
  mq.addEventListener('change',mount);
  window.addEventListener('pageshow',mount);
  window.addEventListener('resize',()=>{if(active)place(active.progress);},{passive:true});
  mount();
})();