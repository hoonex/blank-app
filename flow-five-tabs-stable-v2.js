(() => {
  'use strict';
  // Five visible tabs. The underlying Leptos app still owns four scenes;
  // School and Bus share the native School scene without duplicating data.
  const labels=['오늘','일정','학교','버스','설정'];
  const nativeOf=label=>label==='버스'?'학교':label;
  const root=()=>document.querySelector('.flow-shell');
  const navs=()=>[...document.querySelectorAll('.flow-shell .mobile-bottom,.flow-shell .rail-navigation')];
  const buttons=nav=>[...nav.querySelectorAll(':scope > button')];
  const nativeButton=(nav,name)=>buttons(nav).find(b=>!b.classList.contains('flow-bus-tab')&&b.textContent.trim()===name);
  let current='오늘',desired=null,programmatic=false,queued=false,mainTouch=null,lastSection='';
  const timers=new WeakMap();
  function ensureNav(nav){
    if(!nav.querySelector(':scope > .flow-bus-tab')){
      const bus=document.createElement('button');
      bus.type='button';bus.className='flow-bus-tab';bus.textContent='버스';
      bus.setAttribute('aria-label','버스');
      const settings=nativeButton(nav,'설정');
      if(settings)nav.insertBefore(bus,settings);else nav.append(bus);
    }
    if(nav.classList.contains('mobile-bottom')&&!nav.querySelector(':scope > .flow-dock-thumb')){
      const thumb=document.createElement('span');
      thumb.className='flow-dock-thumb';thumb.setAttribute('aria-hidden','true');
      nav.insertBefore(thumb,nav.firstChild);
    }
  }
  function thumbAt(nav,index,animate=true,centerOverride=null){
    const thumb=nav.querySelector('.flow-dock-thumb'),bs=buttons(nav);
    if(!thumb||bs.length!==5)return;
    const btn=bs[Math.max(0,Math.min(4,index))];
    if(!btn)return;
    const parent=nav.getBoundingClientRect(),rect=btn.getBoundingClientRect();
    const min=bs[0].getBoundingClientRect().left-parent.left;
    const max=bs[4].getBoundingClientRect().right-parent.left-rect.width;
    const left=centerOverride===null?rect.left-parent.left:
      Math.min(max,Math.max(min,centerOverride-rect.width/2));
    thumb.style.width=rect.width+'px';
    thumb.style.transform='translate3d('+left.toFixed(2)+'px,0,0)';
    thumb.classList.toggle('is-dragging',!animate);
  }
  function setVisual(){
    const shell=root();if(!shell)return;
    shell.dataset.flowSection=current==='버스'?'bus':current==='학교'?'school':'other';
    for(const nav of navs()){
      const bs=buttons(nav);
      for(const b of bs){
        const label=b.textContent.trim(),yes=label===current;
        b.classList.toggle('flow-selected',yes);
        if(b.getAttribute('aria-current')!==(yes?'page':'false'))
          b.setAttribute('aria-current',yes?'page':'false');
      }
      if(nav.classList.contains('mobile-bottom')&&!nav._flowDragging){
        thumbAt(nav,Math.max(0,labels.indexOf(current)),true);
      }
    }
    const settings=shell.querySelector('.scene[data-scene="settings"] .settings-sheet');
    if(settings)for(const row of settings.querySelectorAll(':scope > .setting-row')){
      const txt=row.querySelector('strong')?.textContent.trim();
      if(txt==='시간표 관리'||txt==='버스 정보')row.classList.add('flow-nonaction-row');
    }
  }
  function notify(){
    const section=root()?.dataset.flowSection;
    if(!section||section===lastSection)return;
    lastSection=section;
    window.dispatchEvent(new CustomEvent('flow:section',{detail:section}));
  }
  function invokeNative(label){
    const nav=document.querySelector('.flow-shell .mobile-bottom')||
      document.querySelector('.flow-shell .rail-navigation');
    const btn=nav&&nativeButton(nav,nativeOf(label));
    if(!btn)return false;
    programmatic=true;
    try{btn.click();}finally{programmatic=false;}
    return true;
  }
  function select(label,forward=true){
    if(!labels.includes(label))return;
    const before=current;
    current=label;
    desired=nativeOf(label);
    if(forward)invokeNative(label);
    if(before!==label){
      // Switching School/Bus is a subscene switch, not a second scroll view.
      if(['학교','버스'].includes(before)&&['학교','버스'].includes(label)){
        const view=document.querySelector('.flow-main');if(view)view.scrollTop=0;
      }
    }
    setVisual();notify();
    requestAnimationFrame(()=>{setVisual();notify();});
  }
  function reconcile(){
    const shell=root();if(!shell)return;
    for(const nav of navs()){
      ensureNav(nav);bindNav(nav);
    }
    bindMain(shell.querySelector('.flow-main'));
    const nativeActive=navs()[0]&&buttons(navs()[0]).find(b=>!b.classList.contains('flow-bus-tab')&&b.classList.contains('active'));
    const actual=nativeActive?.textContent.trim();
    if(desired){
      if(actual===desired)desired=null;
    }else if(actual&&actual!==nativeOf(current)){
      current=actual;
    }
    setVisual();notify();
  }
  function click(e){
    if(programmatic)return;
    const nav=e.currentTarget,b=e.target.closest('button');
    if(!b||!nav.contains(b))return;
    const label=b.textContent.trim();
    if(!labels.includes(label))return;
    // A touch is already committed by touchEnd. Suppress only its synthesized
    // browser click, never a later mouse/keyboard/programmatic click.
    if(e.isTrusted && e.sourceCapabilities?.firesTouchEvents &&
       performance.now()<(nav._flowGhostUntil||0)){
      e.preventDefault();e.stopImmediatePropagation();return;
    }
    if(label==='버스'){
      e.preventDefault();e.stopImmediatePropagation();
      select(label,true);
    }else{
      // Let Leptos process this click once; never synthesize a second click.
      select(label,false);
    }
  }
  function touchStart(e){
    if(e.touches.length!==1)return;
    const nav=e.currentTarget,t=e.touches[0];
    const b=e.target.closest('button');
    const index=b?buttons(nav).indexOf(b):labels.indexOf(current);
    const idx=Math.max(0,Math.min(4,index));
    const rect=buttons(nav)[idx].getBoundingClientRect();
    nav._flowGesture={startX:t.clientX,startY:t.clientY,center:rect.left+rect.width/2,
      index:idx,moved:false,cancelled:false};
    nav._flowDragging=false;
    thumbAt(nav,idx,true);
    // Native Rust interprets this as a four-slot gesture; disable that path.
    e.stopImmediatePropagation();
  }
  function touchMove(e){
    const nav=e.currentTarget,g=nav._flowGesture,t=e.touches[0];
    if(!g||!t)return;
    const dx=t.clientX-g.startX,dy=t.clientY-g.startY;
    if(Math.abs(dy)>Math.abs(dx)*1.5&&Math.abs(dy)>17){
      g.cancelled=true;nav._flowDragging=false;return;
    }
    if(Math.abs(dx)>=5)g.moved=true;
    if(!g.moved)return;
    const bs=buttons(nav),r=nav.getBoundingClientRect();
    const min=bs[0].getBoundingClientRect().left+bs[0].getBoundingClientRect().width/2;
    const max=bs[4].getBoundingClientRect().left+bs[4].getBoundingClientRect().width/2;
    const center=Math.max(min,Math.min(max,g.center+dx));
    const index=Math.max(0,Math.min(4,Math.round((center-min)/(max-min)*4)));
    g.index=index;
    nav._flowDragging=true;
    thumbAt(nav,index,false,center-r.left);
    bs.forEach((b,i)=>b.classList.toggle('flow-preview',i===index));
    if(e.cancelable)e.preventDefault();
    e.stopImmediatePropagation();
  }
  function touchEnd(e){
    const nav=e.currentTarget,g=nav._flowGesture;
    if(!g)return;
    nav._flowGesture=null;nav._flowDragging=false;
    const bs=buttons(nav);
    bs.forEach(b=>b.classList.remove('flow-preview'));
    const target=g.cancelled?labels.indexOf(current):g.index;
    if(!g.cancelled)select(labels[Math.max(0,target)],true);
    nav._flowGhostUntil=performance.now()+400;
    if(e.cancelable)e.preventDefault();
    e.stopImmediatePropagation();
    requestAnimationFrame(()=>thumbAt(nav,labels.indexOf(current),true));
  }
  function touchCancel(e){
    const nav=e.currentTarget;
    nav._flowGesture=null;nav._flowDragging=false;
    buttons(nav).forEach(b=>b.classList.remove('flow-preview'));
    thumbAt(nav,labels.indexOf(current),true);
    e.stopImmediatePropagation();
  }
  function bindNav(nav){
    if(nav.dataset.flowNavV2Bound==='yes')return;
    nav.dataset.flowNavV2Bound='yes';
    nav.addEventListener('click',click,true);
    if(nav.classList.contains('mobile-bottom')){
      nav.addEventListener('touchstart',touchStart,{capture:true,passive:true});
      nav.addEventListener('touchmove',touchMove,{capture:true,passive:false});
      nav.addEventListener('touchend',touchEnd,{capture:true,passive:false});
      nav.addEventListener('touchcancel',touchCancel,{capture:true,passive:true});
    }
  }
  function bindMain(main){
    if(!main||main.dataset.flowMainV2Bound==='yes')return;
    main.dataset.flowMainV2Bound='yes';
    main.addEventListener('touchstart',e=>{
      mainTouch=null;
      if(e.touches.length!==1)return;
      if(e.target.closest?.('button,a,input,textarea,select,[contenteditable],.calendar-sheet,.day-carousel,.week-grid,.switch-track,.flow-meal-single,.timetable-editor,.bus-map-canvas,.flow-nearby-list'))return;
      const t=e.touches[0];
      mainTouch={x:t.clientX,y:t.clientY};
    },true);
    main.addEventListener('touchend',e=>{
      if(!mainTouch)return;
      const start=mainTouch;mainTouch=null;
      const t=e.changedTouches[0];if(!t)return;
      const dx=t.clientX-start.x,dy=t.clientY-start.y;
      if(Math.abs(dx)<75||Math.abs(dx)<Math.abs(dy)*1.45)return;
      e.stopImmediatePropagation();
      const i=labels.indexOf(current),to=labels[Math.max(0,Math.min(4,i+(dx<0?1:-1)))];
      if(to!==current)select(to,true);
    },true);
  }
  document.addEventListener('click',e=>{
    if(e.target.closest?.('.transit-link')){
      current='버스';desired='학교';
      requestAnimationFrame(()=>{setVisual();notify();});
    }
  },true);
  const observer=new MutationObserver(()=>{
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;reconcile();});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('resize',()=>{for(const n of navs())if(!n._flowDragging)thumbAt(n,labels.indexOf(current),true);});
  addEventListener('pageshow',reconcile);
  reconcile();
})();