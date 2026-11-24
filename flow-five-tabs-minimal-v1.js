(() => {
  'use strict';
  // Extend the existing four native Leptos pages into five visible destinations
  // without changing Rust's dashboard, calendar, school, or bus state.
  // Native School stays mounted for both School and Bus; the sections are
  // exclusive and the hidden bus API is not duplicated.
  const labels=['오늘','일정','학교','버스','설정'];
  const nativeOf=label=>label==='버스'?'학교':label;
  let current='오늘',pendingNative='',queued=false,internalClick=false;
  let navTouch=null,sceneTouch=null;
  const nativeBtn=(nav,label)=>[...nav?.querySelectorAll(':scope > button:not(.flow-bus-tab)')||[]]
    .find(b=>b.textContent.trim()===label);
  const shell=()=>document.querySelector('.flow-shell');
  const allNav=()=>[...document.querySelectorAll('.flow-shell .mobile-bottom,.flow-shell .rail-navigation')];
  function invokeNative(label){
    const nav=document.querySelector('.flow-shell .mobile-bottom')||
      document.querySelector('.flow-shell .rail-navigation');
    const target=nativeBtn(nav,nativeOf(label));
    if(!target)return;
    pendingNative=nativeOf(label);
    internalClick=true;
    try{target.click();}finally{internalClick=false;}
  }
  function switchTo(label,callNative=true){
    if(!labels.includes(label))return;
    const previous=current;
    current=label;
    pendingNative=nativeOf(label);
    if(callNative)invokeNative(label);
    if(previous!==label && (previous==='학교'||previous==='버스') &&
       (label==='학교'||label==='버스')){
      const main=document.querySelector('.flow-main');
      if(main)main.scrollTop=0;
      window.scrollTo(0,0);
    }
    paint();
    requestAnimationFrame(paint);
  }
  function insertBus(nav){
    if(nav.querySelector(':scope > .flow-bus-tab'))return;
    const button=document.createElement('button');
    button.type='button';
    button.className='flow-bus-tab';
    button.textContent='버스';
    button.setAttribute('aria-label','버스 정보');
    const settings=nativeBtn(nav,'설정');
    if(settings)nav.insertBefore(button,settings);
    else nav.append(button);
  }
  function paint(){
    const root=shell();
    if(!root)return;
    const view=root.querySelector('.flow-main > .scene');
    const nav=allNav();
    const nativeActive=[...nav[0]?.querySelectorAll(':scope > button.active:not(.flow-bus-tab)')||[]][0];
    const actual=nativeActive?.textContent.trim();
    if(pendingNative){
      if(actual===pendingNative)pendingNative='';
    }else if(actual && actual!==nativeOf(current)){
      // Covers navigation from native shortcuts or the browser's own swipe.
      current=actual;
    }
    root.dataset.flowSection=current==='버스'?'bus':current==='학교'?'school':'other';
    for(const item of nav){
      for(const button of item.querySelectorAll(':scope > button')){
        const label=button.classList.contains('flow-bus-tab')?'버스':button.textContent.trim();
        if(!labels.includes(label))continue;
        const selected=label===current;
        button.classList.toggle('flow-selected',selected);
        if(button.getAttribute('aria-current')!==(selected?'page':'false')){
          button.setAttribute('aria-current',selected?'page':'false');
        }
      }
    }
    const s=root.querySelector('.scene[data-scene="school"]');
    if(s) {
      // The native school section contains both components, never duplicate.
      const extra=s.querySelector('.scene-head .eyebrow');
      if(extra && extra.textContent.trim()) extra.textContent='';
    }
    const settings=root.querySelector('.scene[data-scene="settings"] .settings-sheet');
    if(settings){
      for(const row of settings.querySelectorAll(':scope > .setting-row')){
        const label=row.querySelector('strong')?.textContent.trim();
        if(label==='시간표 관리'||label==='버스 정보'){
          row.classList.add('flow-nonaction-row');
        }
      }
    }
  }
  function onNavClick(event){
    if(internalClick)return;
    const button=event.target.closest('button');
    if(!button||!this.contains(button))return;
    const label=button.classList.contains('flow-bus-tab')?'버스':button.textContent.trim();
    if(!labels.includes(label))return;
    if(performance.now()<((this.__flowClickBlock)||0)){
      event.preventDefault();event.stopImmediatePropagation();return;
    }
    if(label==='버스'){
      event.preventDefault();
      switchTo('버스',true);
    }else{
      // Let Leptos own the native click. Persist the subtab selection here.
      switchTo(label,false);
    }
  }
  function clearPreview(nav){
    nav.classList.remove('flow-nav-drag');
    nav.querySelectorAll('button.flow-preview').forEach(b=>b.classList.remove('flow-preview'));
  }
  function onNavStart(event){
    if(event.touches.length!==1)return;
    const finger=event.touches[0];
    navTouch={nav:this,startX:finger.clientX,startY:finger.clientY,moved:false,idx:-1};
    // Stop the existing Rust 4-slot navigation from interpreting a 5-slot bar.
    event.stopImmediatePropagation();
  }
  function onNavMove(event){
    if(!navTouch||navTouch.nav!==this||event.touches.length!==1)return;
    const finger=event.touches[0],dx=finger.clientX-navTouch.startX;
    if(Math.abs(dx)<12 || Math.abs(finger.clientY-navTouch.startY)>45){
      event.stopImmediatePropagation();return;
    }
    navTouch.moved=true;
    const rect=this.getBoundingClientRect();
    const idx=Math.max(0,Math.min(4,Math.floor((finger.clientX-rect.left)/rect.width*5)));
    navTouch.idx=idx;
    this.classList.add('flow-nav-drag');
    [...this.querySelectorAll(':scope > button')].forEach((b,i)=>b.classList.toggle('flow-preview',i===idx));
    if(event.cancelable)event.preventDefault();
    event.stopImmediatePropagation();
  }
  function onNavEnd(event){
    if(!navTouch||navTouch.nav!==this)return;
    if(navTouch.moved){
      const rect=this.getBoundingClientRect(),x=event.changedTouches[0]?.clientX||navTouch.startX;
      const idx=Math.max(0,Math.min(4,Math.floor((x-rect.left)/rect.width*5)));
      this.__flowClickBlock=performance.now()+500;
      if(event.cancelable)event.preventDefault();
      switchTo(labels[idx],true);
    }
    clearPreview(this);navTouch=null;
    event.stopImmediatePropagation();
  }
  function onNavCancel(event){clearPreview(this);navTouch=null;event.stopImmediatePropagation();}
  function bindNav(nav){
    if(nav.dataset.flowNavBound==='yes')return;
    nav.dataset.flowNavBound='yes';
    nav.addEventListener('click',onNavClick,true);
    if(nav.classList.contains('mobile-bottom')){
      nav.addEventListener('touchstart',onNavStart,{capture:true,passive:true});
      nav.addEventListener('touchmove',onNavMove,{capture:true,passive:false});
      nav.addEventListener('touchend',onNavEnd,{capture:true,passive:false});
      nav.addEventListener('touchcancel',onNavCancel,{capture:true,passive:true});
    }
  }
  function bindSwipe(main){
    if(!main||main.dataset.flowSwipeBound==='yes')return;
    main.dataset.flowSwipeBound='yes';
    main.addEventListener('touchstart',event=>{
      sceneTouch=null;
      if(event.touches.length!==1)return;
      const target=event.target;
      if(target.closest?.('button,a,input,textarea,select,[contenteditable],.calendar-grid,.calendar-sheet,.day-carousel,.day-strip,.week-grid,.bus-map-canvas,.flow-nearby-list'))return;
      const p=event.touches[0];
      sceneTouch={x:p.clientX,y:p.clientY};
    },true);
    main.addEventListener('touchend',event=>{
      if(!sceneTouch)return;
      const start=sceneTouch;sceneTouch=null;
      const p=event.changedTouches[0];if(!p)return;
      const dx=p.clientX-start.x,dy=p.clientY-start.y;
      if(Math.abs(dx)>=68&&Math.abs(dx)>Math.abs(dy)*1.35){
        // Capture the event before Rust's four-tab swipe handler.
        event.stopImmediatePropagation();
        const i=labels.indexOf(current);
        const target=labels[Math.max(0,Math.min(4,i+(dx<0?1:-1)))];
        if(target!==current)switchTo(target,true);
      }
    },true);
  }
  function reconcile(){
    const root=shell();if(!root)return;
    for(const nav of allNav()){insertBus(nav);bindNav(nav);}
    bindSwipe(root.querySelector('.flow-main'));
    paint();
  }
  // The "bus arrivals" shortcut in Today previously opened the School page.
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.transit-link')){
      current='버스';pendingNative='학교';
      requestAnimationFrame(paint);
    }
  },true);
  const observer=new MutationObserver(()=>{
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;reconcile();});
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('pageshow',reconcile);
  // Let bus/map enhancements lazily initialize only when Bus is visible.
  let lastSection='';
  const notify=new MutationObserver(()=>{
    const section=shell()?.dataset.flowSection;
    if(!section||section===lastSection)return;
    lastSection=section;
    window.dispatchEvent(new CustomEvent('flow:section',{detail:section}));
  });
  notify.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['data-flow-section']});
  reconcile();
})();