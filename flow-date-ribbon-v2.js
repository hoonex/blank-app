/* Flow date ribbon: accessible week strip + compact month sheet.
   Reads/activates existing Leptos date buttons. Does not fetch or invent dates. */
(() => {
  'use strict';
  const mql = matchMedia('(min-width:871px)');
  const motion = matchMedia('(prefers-reduced-motion:reduce)');
  const dayNames = ['일','월','화','수','목','금','토'];
  let state = null;
  let queued = false;
  const elem = (tag,cls,text) => {
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text!==undefined)e.textContent=text;
    return e;
  };
  const sameDay=(a,b)=>a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  const noon=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);
  // Derive the base date from the real Leptos "오늘" button, not a guessed
  // browser timezone. Choose the closest matching calendar year.
  function nativeToday(button){
    const now=noon(new Date());
    const match=(button?.getAttribute('aria-label')||'').match(/(\d+)월\s*(\d+)일/);
    if(!match)return now;
    return [-1,0,1].map(delta=>new Date(now.getFullYear()+delta,Number(match[1])-1,Number(match[2]),12))
      .sort((a,b)=>Math.abs(a.getTime()-now.getTime())-Math.abs(b.getTime()-now.getTime()))[0];
  }
  const dayAdd=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n,12);
  const dayDiff=(a,b)=>Math.round((Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())-Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()))/86400000);
  const mondayIdx=(s,i)=>i-((s.dates[i].getDay()+6)%7);
  const maxIdx=s=>s.buttons.length-1;
  const inRange=(s,i)=>i>=0&&i<s.buttons.length;
  const dateAt=(s,i)=>dayAdd(s.realDate,i-s.realIndex);
  const monthTitle=d=>d.getFullYear()+'년 '+(d.getMonth()+1)+'월';
  function observe(s){
    s.observer=new MutationObserver(queueSync);
    s.observer.observe(s.strip,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-current']});
  }
  function stop(){
    if(!state)return;
    state.observer?.disconnect();
    state.dialog?.close();
    state.dialog?.remove();
    state.ribbon?.remove();
    state.heading?.classList.remove('flow-date-ribbon-ready');
    state=null;
  }
  function jump(s,index){
    if(!inRange(s,index))return false;
    const b=s.buttons[index];
    if(!b?.isConnected)return false;
    b.click();
    s.selected=index;
    s.weekStart=mondayIdx(s,index);
    render(s,0);
    queueSync();
    return true;
  }
  function toWeek(s,n,direction){
    const target=s.weekStart+7*n;
    if(target+6<0||target>maxIdx(s))return;
    s.weekStart=target;
    render(s,direction);
  }
  function updateDayCells(s){
    for(const b of s.weekGrid.querySelectorAll('button[data-index]')){
      const i=Number(b.dataset.index);
      const chosen=i===s.selected;
      const today=i===s.realIndex;
      b.classList.toggle('is-selected',chosen);
      b.classList.toggle('is-today',today);
      if(chosen)b.setAttribute('aria-current','date'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-pressed',chosen?'true':'false');
    }
  }
  function visibleCount(){return mql.matches?14:7}
  function render(s,direction){
    if(!s.heading.isConnected)return;
    const count=visibleCount();
    const showingSelected=s.selected>=s.weekStart&&s.selected<s.weekStart+count;
    const monthTarget=showingSelected?s.dates[s.selected]:dateAt(s,s.weekStart+3);
    s.monthButton.querySelector('.flow-date-month-name').textContent=monthTitle(monthTarget);
    s.monthButton.setAttribute('aria-label',monthTitle(monthTarget)+' 날짜 선택 달력 열기');
    s.todayButton.hidden=s.selected===s.realIndex&&showingSelected;
    s.prevButton.disabled=s.weekStart+6<7;
    s.nextButton.disabled=s.weekStart+7>maxIdx(s);
    if(s.renderedWeek===s.weekStart&&s.renderedCount===count){
      updateDayCells(s);
      return;
    }
    s.renderedWeek=s.weekStart;s.renderedCount=count;
    const frag=document.createDocumentFragment();
    for(let j=0;j<count;j++){
      const i=s.weekStart+j;
      const d=dateAt(s,i);
      const b=elem('button','flow-date-day');
      b.type='button';
      b.dataset.index=String(i);
      b.disabled=!inRange(s,i);
      b.setAttribute('aria-label',d.getFullYear()+'년 '+(d.getMonth()+1)+'월 '+d.getDate()+'일 '+dayNames[d.getDay()]+'요일'+(i===s.realIndex?' 오늘':''));
      b.append(elem('small','flow-date-weekday',dayNames[d.getDay()]),elem('strong','flow-date-number',String(d.getDate()).padStart(2,'0')));
      b.addEventListener('click',()=>{if(performance.now()<s.suppressClickUntil)return;jump(s,i)});
      frag.append(b);
    }
    s.weekGrid.replaceChildren(frag);
    updateDayCells(s);
    if(direction&&!motion.matches&&typeof s.weekGrid.animate==='function'){
      s.weekGrid.animate([{opacity:.45,transform:'translate3d('+(-direction*12)+'px,0,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:210,easing:'cubic-bezier(.22,.82,.24,1)'});
    }
  }
  function openPicker(s){
    if(s.dialog?.open)return;
    const dialog=elem('dialog','flow-date-month-dialog');
    dialog.id='flow-date-picker';
    dialog.setAttribute('aria-label','날짜 선택 달력');
    const content=elem('div','flow-date-picker-body');
    const head=elem('div','flow-date-picker-head');
    const prev=elem('button','flow-date-picker-arrow flow-date-picker-prev');
    const title=elem('h2','flow-date-picker-title');
    const next=elem('button','flow-date-picker-arrow flow-date-picker-next');
    prev.append(FlowActionIcons.create('chevron-left'));
    next.append(FlowActionIcons.create('chevron-right'));
    const close=elem('button','flow-date-picker-close','닫기');
    prev.type=next.type=close.type='button';
    prev.setAttribute('aria-label','이전 달');
    next.setAttribute('aria-label','다음 달');
    close.addEventListener('click',()=>dialog.close());
    head.append(prev,title,next);
    const weekdays=elem('div','flow-date-picker-weekdays');
    for(const name of ['월','화','수','목','금','토','일'])weekdays.append(elem('span','',name));
    const grid=elem('div','flow-date-picker-grid');
    content.append(head,weekdays,grid,close);
    dialog.append(content);
    document.body.append(dialog);
    s.dialog=dialog;
    const current=s.selected>=s.weekStart&&s.selected<s.weekStart+visibleCount()?s.dates[s.selected]:dateAt(s,s.weekStart+3);
    let yy=current.getFullYear(),mm=current.getMonth();
    const first=s.dates[0],last=s.dates.at(-1);
    function monthAllowed(y,m){const d=new Date(y,m,1);return d<=new Date(last.getFullYear(),last.getMonth(),1)&&d>=new Date(first.getFullYear(),first.getMonth(),1)}
    function draw(){
      title.textContent=yy+'년 '+(mm+1)+'월';
      prev.disabled=!monthAllowed(yy,mm-1);
      next.disabled=!monthAllowed(yy,mm+1);
      const days=new Date(yy,mm+1,0).getDate();
      const offset=(new Date(yy,mm,1).getDay()+6)%7;
      const fragment=document.createDocumentFragment();
      for(let i=0;i<offset;i++){const blank=elem('span','flow-date-picker-space');blank.setAttribute('aria-hidden','true');fragment.append(blank)}
      for(let day=1;day<=days;day++){
        const date=new Date(yy,mm,day,12);
        const index=s.realIndex+dayDiff(date,s.realDate);
        const b=elem('button','flow-date-picker-day',String(day));
        b.type='button';b.disabled=!inRange(s,index);
        b.classList.toggle('is-selected',index===s.selected);
        b.classList.toggle('is-today',index===s.realIndex);
        b.setAttribute('aria-label',yy+'년 '+(mm+1)+'월 '+day+'일 '+dayNames[date.getDay()]+'요일');
        if(index===s.selected)b.setAttribute('aria-current','date');
        b.addEventListener('click',()=>{if(jump(s,index))dialog.close()});
        fragment.append(b);
      }
      grid.replaceChildren(fragment);
    }
    prev.addEventListener('click',()=>{if(monthAllowed(yy,mm-1)){const d=new Date(yy,mm-1,1);yy=d.getFullYear();mm=d.getMonth();draw()}});
    next.addEventListener('click',()=>{if(monthAllowed(yy,mm+1)){const d=new Date(yy,mm+1,1);yy=d.getFullYear();mm=d.getMonth();draw()}});
    dialog.addEventListener('close',()=>{
      dialog.remove();s.dialog=null;
      if(s.monthButton.isConnected){
        s.monthButton.setAttribute('aria-expanded','false');
        s.monthButton.focus({preventScroll:true});
      }
    },{once:true});
    draw();
    try{dialog.showModal();s.monthButton.setAttribute('aria-expanded','true')}
    catch(e){dialog.remove();s.dialog=null;s.monthButton.setAttribute('aria-expanded','false')}
  }
  function make(s){
    const ribbon=elem('div','flow-date-ribbon');
    ribbon.setAttribute('role','region');ribbon.setAttribute('aria-label','오늘 탭 날짜 탐색');
    const head=elem('div','flow-date-ribbon-head');
    const month=elem('button','flow-date-month-button');
    month.type='button';
    month.setAttribute('aria-haspopup','dialog');
    month.setAttribute('aria-controls','flow-date-picker');
    month.setAttribute('aria-expanded','false');
    const monthIcon=elem('span','flow-date-month-icon');
    monthIcon.setAttribute('aria-hidden','true');
    monthIcon.append(FlowActionIcons.create('calendar'));
    month.append(elem('span','flow-date-month-name'),monthIcon);
    const actions=elem('div','flow-date-tools');
    const today=elem('button','flow-date-today','오늘');today.type='button';
    today.addEventListener('click',()=>jump(s,s.realIndex));
    const prev=elem('button','flow-date-step flow-date-prev');
    const next=elem('button','flow-date-step flow-date-next');
    prev.append(FlowActionIcons.create('chevron-left'));
    next.append(FlowActionIcons.create('chevron-right'));
    prev.type=next.type='button';
    prev.setAttribute('aria-label','이전 주');
    next.setAttribute('aria-label','다음 주');
    prev.addEventListener('click',()=>toWeek(s,-1,-1));
    next.addEventListener('click',()=>toWeek(s,1,1));
    actions.append(today,prev,next);
    head.append(month,actions);
    month.addEventListener('click',()=>openPicker(s));
    const windowEl=elem('div','flow-date-week-window');
    windowEl.setAttribute('role','group');
    windowEl.setAttribute('aria-label','요일별 날짜');
    const grid=elem('div','flow-date-week-grid');
    windowEl.append(grid);
    const drag={startX:0,startY:0,active:false};
    windowEl.addEventListener('pointerdown',e=>{
      if(e.button!==0&&e.pointerType==='mouse')return;
      drag.active=true;drag.startX=e.clientX;drag.startY=e.clientY;
    },{passive:true});
    windowEl.addEventListener('pointercancel',()=>{drag.active=false});
    windowEl.addEventListener('pointerup',e=>{
      if(!drag.active)return;
      drag.active=false;
      const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
      if(Math.abs(dx)<38||Math.abs(dx)<Math.abs(dy)*1.2)return;
      s.suppressClickUntil=performance.now()+380;
      toWeek(s,dx<0?1:-1,dx<0?1:-1);
    },{passive:true});
    windowEl.addEventListener('click',e=>{
      if(performance.now()<s.suppressClickUntil){e.preventDefault();e.stopImmediatePropagation()}
    },true);
    windowEl.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
      const i=Number(e.target.dataset?.index);
      if(!Number.isFinite(i)||!inRange(s,i))return;
      e.preventDefault();
      const nextIdx=i+(e.key==='ArrowRight'?1:-1);
      if(jump(s,nextIdx))s.weekGrid.querySelector('[data-index="'+nextIdx+'"]')?.focus({preventScroll:true});
    });
    ribbon.append(head,windowEl);
    s.heading.append(ribbon);
    s.heading.classList.add('flow-date-ribbon-ready');
    s.ribbon=ribbon;s.monthButton=month;s.todayButton=today;s.prevButton=prev;s.nextButton=next;s.weekGrid=grid;
  }
  function sync(){
    if(!state)return;
    if(!state.heading.isConnected||!state.strip.isConnected){stop();return}
    let replacedNativeButtons=false;
    if(!state.buttons[0]?.isConnected){
      const fresh=[...state.strip.querySelectorAll('button')];
      const ri=fresh.findIndex(b=>b.classList.contains('real-today')||b.getAttribute('aria-label')?.includes('오늘'));
      if(ri<0||fresh.length<7){stop();return}
      state.buttons=fresh;state.realIndex=ri;
      state.realDate=nativeToday(fresh[ri]);
      state.dates=fresh.map((_,i)=>dayAdd(state.realDate,i-ri));
      state.renderedWeek=null;replacedNativeButtons=true;
    }
    const current=state.buttons.findIndex(b=>b.classList.contains('active'));
    if(current>=0&&(current!==state.selected||replacedNativeButtons)){
      state.selected=current;state.weekStart=mondayIdx(state,current);
      render(state,0);
    }
  }
  function queueSync(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;sync()});
  }
  function mount(){
    const heading=document.querySelector('.flow-shell .scene[data-scene="today"] .today-heading');
    if(!heading)return;
    const strip=heading.querySelector('.day-strip');
    if(!strip)return;
    if(state?.heading===heading&&state.strip===strip&&state.ribbon?.isConnected){sync();return}
    stop();
    const buttons=Array.from(strip.querySelectorAll('button'));
    const realIndex=buttons.findIndex(b=>b.classList.contains('real-today')||b.getAttribute('aria-label')?.includes('오늘'));
    const selected=buttons.findIndex(b=>b.classList.contains('active'));
    if(realIndex<0||selected<0||buttons.length<7)return;
    const realDate=nativeToday(buttons[realIndex]);
    const s={heading,strip,buttons,realIndex,realDate,dates:buttons.map((_,i)=>dayAdd(realDate,i-realIndex)),
      selected,weekStart:0,renderedWeek:null,renderedCount:null,suppressClickUntil:0,observer:null,dialog:null};
    s.weekStart=mondayIdx(s,selected);
    state=s;
    make(s);render(s,0);observe(s);
  }
  function queueMount(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;mount()});
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('.mobile-bottom,.rail-navigation')){
      setTimeout(queueMount,60);
    }else if(!state||!state.heading?.isConnected){
      // First-time school setup can complete well after the initial Rust boot.
      setTimeout(queueMount,100);
      setTimeout(queueMount,650);
    }
  },{capture:true,passive:true});
  addEventListener('TrunkApplicationStarted',()=>setTimeout(queueMount,80));
  addEventListener('pageshow',queueMount);
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',queueMount,{once:true});
  else queueMount();
  mql.addEventListener?.('change',()=>{if(state){state.renderedCount=null;render(state,0)}});
  setTimeout(queueMount,300);
  setTimeout(queueMount,900);
})();
