(function() {
  'use strict';
  const mq = matchMedia('(max-width:590px)');
  const labels = ['일','월','화','수','목','금','토'];
  const memory = new Map();
  let state=null, queued=false;

  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const pad=n=>String(n).padStart(2,'0');
  const monthKey=(year,month)=>`${year}-${pad(month)}`;
  const shift=(year,month,offset)=>{
    const d=new Date(year,month-1+offset,1);
    return [d.getFullYear(),d.getMonth()+1];
  };
  const easing=t=>1-Math.pow(1-t,3);
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  function monthFrom(scene) {
    const s=scene.querySelector('.calendar-toolbar h2')?.textContent||'';
    const m=s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/);
    return m && Number(m[2])>=1 && Number(m[2])<=12 ? [Number(m[1]),Number(m[2])] : null;
  }
  function capturedEvents(sheet) {
    const result=new Set();
    sheet.querySelectorAll('.calendar-grid button:not(.out-month)').forEach(button=>{
      const date=Number(button.querySelector('.calendar-num')?.textContent);
      const text=button.querySelector('.calendar-event-text')?.textContent.trim();
      if(date>0&&date<=31&&text)result.add(date);
    });
    return result;
  }
  function buildCard(side,year,month) {
    const [y,m]=shift(year,month,side);
    const card=document.createElement('section');
    card.className='flow-wheel-neighbor';
    card.dataset.wheelSide=String(side);
    card.dataset.year=String(y);
    card.dataset.month=String(m);
    card.setAttribute('role','button');
    card.tabIndex=0;
    card.setAttribute('aria-label',`${y}년 ${m}월로 이동`);
    const title=document.createElement('div');
    title.className='flow-wheel-title';
    title.textContent=`${y}년 ${m}월`;
    const grid=document.createElement('div');
    grid.className='flow-wheel-grid';
    const lip=document.createElement('span');
    lip.className='flow-wheel-lip';
    lip.textContent=`${m}월`;
    card.append(title,grid,lip);
    const info={card,grid,side,y,m,visibleColumns:''};
    card.addEventListener('click',()=>{
      if(!state?.animating && performance.now()>=(state?.clickBlockUntil||0)) navigate(side);
    });
    card.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();navigate(side);}
    });
    return info;
  }
  function visibleColumns(info, relative) {
    const amount=Math.abs(relative);
    const count=amount>.82?2:amount>.62?4:7;
    if(info.side<0)return Array.from({length:count},(_,i)=>7-count+i);
    return Array.from({length:count},(_,i)=>i);
  }
  function updateGrid(info,relative) {
    const cols=visibleColumns(info,relative);
    const stamp=cols.join(',')+'|'+[...(memory.get(monthKey(info.y,info.m))||[])].join(',');
    if(info.visibleColumns===stamp)return;
    info.visibleColumns=stamp;
    info.grid.replaceChildren();
    const wanted=new Set(cols);
    for(let c=0;c<7;c++) {
      if(!wanted.has(c))continue;
      const th=document.createElement('span');
      th.className='flow-wheel-weekday';
      th.textContent=labels[c];
      th.style.gridColumn=String(c+1);
      th.style.gridRow='1';
      info.grid.appendChild(th);
    }
    const first=new Date(info.y,info.m-1,1).getDay();
    const days=new Date(info.y,info.m,0).getDate();
    const count=Math.ceil((first+days)/7)*7;
    const known=memory.get(monthKey(info.y,info.m));
    for(let i=0;i<count;i++){
      const col=i%7;
      if(!wanted.has(col))continue;
      const date=new Date(info.y,info.m-1,1+i-first);
      const outside=date.getMonth()!==info.m-1;
      const item=document.createElement('span');
      item.className='flow-wheel-date'+(outside?' out-month':'');
      item.style.gridColumn=String(col+1);
      item.style.gridRow=String(2+Math.floor(i/7));
      const number=document.createElement('span');
      number.textContent=pad(date.getDate());
      item.appendChild(number);
      if(!outside && known?.has(date.getDate())){
        const dot=document.createElement('i');
        dot.className='flow-wheel-event';
        item.appendChild(dot);
      }
      info.grid.appendChild(item);
    }
  }
  // Actual wheel geometry: cards rotate around one common hub below their bottoms.
  // They are not translated horizontally or rotated around their Y axes.
  function position(progress){
    const s=state;
    if(!s||!s.scene.isConnected)return;
    s.progress=progress;
    const viewportWidth=s.layout.clientWidth;
    const width=s.main.offsetWidth, height=s.main.offsetHeight;
    const angle=.58; // radians, ~33 degrees per month
    const outerWidth=width*.5*Math.cos(angle)+height*.5*Math.sin(angle);
    const radius=clamp((viewportWidth*.5+outerWidth-21)/Math.sin(angle),430,1500);
    const pivot=`50% calc(50% + ${radius.toFixed(1)}px)`;
    s.main.style.transformOrigin=pivot;
    s.main.style.transform=`rotate(${(-progress*angle).toFixed(5)}rad)`;
    const nextHeight=height+'px';
    for(const info of s.neighbors){
      const relative=info.side-progress;
      const rad=relative*angle;
      const card=info.card;
      card.style.height=nextHeight;
      card.style.transformOrigin=pivot;
      card.style.transform=`translateX(-50%) rotate(${rad.toFixed(5)}rad)`;
      card.style.pointerEvents=!s.animating&&Math.abs(relative)<1.15?'auto':'none';
      card.style.zIndex=String(10-Math.round(Math.abs(relative)*3));
      // Virtualize offscreen columns; full grid only as the month turns toward center.
      updateGrid(info,relative);
    }
  }
  function refresh(force=false) {
    const s=state;
    if(!s||s.animating||!s.scene.isConnected)return;
    const m=monthFrom(s.scene);
    if(!m)return;
    const [y,mo]=m;
    const key=monthKey(y,mo);
    const marks=capturedEvents(s.main);
    const stamp=Array.from(marks).sort((a,b)=>a-b).join(',');
    memory.set(key,marks);
    if(!force&&s.key===key&&s.stamp===stamp)return;
    s.key=key;s.stamp=stamp;
    for(const side of [-1,1]){
      const next=buildCard(side,y,mo);
      const index=side<0?0:1;
      const old=s.neighbors[index];
      if(old)old.card.replaceWith(next.card);
      else s.layout.insertBefore(next.card,s.layout.querySelector(':scope > .event-sheet'));
      s.neighbors[index]=next;
    }
    position(s.progress);
  }
  function tween(target,duration,complete){
    const s=state;
    if(!s||s.animating)return;
    s.animating=true;
    const from=s.progress,begin=performance.now();
    if(reduced||duration===0){
      position(target);
      s.animating=false;
      complete?.();
      return;
    }
    const loop=t=>{
      if(state!==s||!s.scene.isConnected)return;
      const u=clamp((t-begin)/duration,0,1);
      position(from+(target-from)*easing(u));
      if(u<1)requestAnimationFrame(loop);
      else{s.animating=false;complete?.();}
    };
    requestAnimationFrame(loop);
  }
  function navigate(delta){
    const s=state;
    if(!s||s.animating)return;
    const direction=delta<0?-1:1;
    s.clickBlockUntil=performance.now()+650;
    tween(direction,370,()=>{
      const buttons=s.scene.querySelectorAll('.month-actions .month-chevron');
      const chosen=direction<0?buttons[0]:buttons[buttons.length-1];
      if(!chosen || buttons.length<2){tween(0,230);return;}
      chosen.click();  // Original Leptos month transition; preserves real data.
      requestAnimationFrame(()=>{
        if(state!==s)return;
        s.progress=0;
        refresh(true);
        position(0);
      });
    });
  }
  function start(e){
    const s=state;
    if(!s||s.animating||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
    if(!e.target.closest('.calendar-sheet,.flow-wheel-neighbor'))return;
    s.drag={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),moved:false,vertical:false};
  }
  function move(e){
    const s=state,d=s?.drag;
    if(!d||s.animating||e.pointerId!==d.id)return;
    const dx=e.clientX-d.x, dy=e.clientY-d.y;
    if(!d.moved){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.18){d.vertical=true;return;}
      if(d.vertical||Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.2)return;
      d.moved=true;
      s.layout.classList.add('flow-wheel-dragging');
    }
    if(e.cancelable)e.preventDefault();
    position(clamp(-dx/(s.layout.clientWidth*.83),-1.25,1.25));
  }
  function finish(e){
    const s=state,d=s?.drag;
    if(!d||e.pointerId!==d.id)return;
    s.drag=null;
    s.layout.classList.remove('flow-wheel-dragging');
    if(!d.moved)return;
    if(e.cancelable)e.preventDefault();
    e.stopPropagation();
    s.clickBlockUntil=performance.now()+520;
    const dx=e.clientX-d.x;
    const velocity=Math.abs(dx)/Math.max(1,performance.now()-d.time);
    if(Math.abs(s.progress)>.23 || (Math.abs(dx)>20&&velocity>.48)){
      navigate(s.progress>0?1:-1);
    }else tween(0,260);
  }
  function clear(){
    const s=state;
    if(!s)return;
    s.observe.disconnect();
    s.neighbors.forEach(info=>info?.card.remove());
    s.layout.classList.remove('flow-wheel-enabled','flow-wheel-dragging');
    s.main.style.removeProperty('transform');
    s.main.style.removeProperty('transform-origin');
    state=null;
  }
  function setup(scene){
    const layout=scene.querySelector('.calendar-layout');
    const main=layout?.querySelector(':scope > .calendar-sheet');
    if(!layout||!main||!monthFrom(scene))return;
    clear();
    const s={scene,layout,main,neighbors:[null,null],drag:null,progress:0,key:'',stamp:'',animating:false,clickBlockUntil:0,observe:null};
    state=s;
    layout.classList.add('flow-wheel-enabled');
    layout.addEventListener('pointerdown',start,{passive:true});
    layout.addEventListener('pointermove',move,{passive:false});
    layout.addEventListener('pointerup',finish,{passive:false});
    layout.addEventListener('pointercancel',finish,{passive:false});
    // Capture touch before Rust handlers to avoid a second month navigation.
    layout.addEventListener('touchstart',e=>{
      if(e.target.closest('.calendar-sheet,.flow-wheel-neighbor'))e.stopPropagation();
    },{capture:true,passive:true});
    layout.addEventListener('touchmove',e=>{
      if(s.drag?.moved){
        if(e.cancelable)e.preventDefault();
        e.stopImmediatePropagation();
      }
    },{capture:true,passive:false});
    layout.addEventListener('touchend',e=>{
      if(s.drag?.moved||performance.now()<s.clickBlockUntil){
        if(e.cancelable)e.preventDefault();
        e.stopImmediatePropagation();
      }
    },{capture:true,passive:false});
    layout.addEventListener('click',e=>{
      if(performance.now()<s.clickBlockUntil && e.target.closest('.calendar-sheet')) {
        e.preventDefault();e.stopImmediatePropagation();
      }
    },{capture:true});
    refresh(true);
    let pending=false;
    s.observe=new MutationObserver(()=>{
      if(pending)return;
      pending=true;
      requestAnimationFrame(()=>{
        pending=false;
        if(state===s){refresh();position(s.progress);}
      });
    });
    const title=scene.querySelector('.calendar-toolbar');
    const grid=main.querySelector('.calendar-grid');
    if(title)s.observe.observe(title,{childList:true,subtree:true,characterData:true});
    if(grid)s.observe.observe(grid,{childList:true,subtree:true,characterData:true});
  }
  function mount(){
    if(!mq.matches){clear();return;}
    const scene=document.querySelector('.scene[data-scene="calendar"]');
    if(scene&&(!state||state.scene!==scene))setup(scene);
    else if(!scene&&state)clear();
  }
  new MutationObserver(()=>{
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;mount();});
  }).observe(document.documentElement,{subtree:true,childList:true});
  mq.addEventListener('change',mount);
  addEventListener('pageshow',mount);
  addEventListener('resize',()=>{if(state)position(state.progress);},{passive:true});
  mount();
})();