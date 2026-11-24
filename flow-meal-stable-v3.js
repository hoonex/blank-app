(() => {
  'use strict';
  // Single-surface meal view; data is the school's NEIS-backed Flow API.
  // The native Leptos meal list remains mounted as a fallback source,
  // but is visually replaced to avoid repeating the same menu twice.
  const PROFILE='flow-school-profile-v3';
  const API='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data';
  const CACHE_MS=600000,MONTH_LIMIT=8;
  const cache=new Map(),pendingMonths=new Map(),weekdays=['월','화','수','목','금'];
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',
    year:'numeric',month:'2-digit',day:'2-digit'});
  const mk=(t,cl,value)=>{const e=document.createElement(t);if(cl)e.className=cl;
    if(value!==undefined)e.textContent=value;return e;};
  const pad=n=>String(n).padStart(2,'0');
  const ymd=d=>d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate());
  const dateOf=s=>new Date(Date.UTC(+s.slice(0,4),+s.slice(4,6)-1,+s.slice(6,8)));
  const dayAdd=(d,n)=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x;};
  const monday=d=>dayAdd(d,-(d.getUTCDay()+6)%7);
  const monthOf=d=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1));
  const monthKey=d=>ymd(d).slice(0,6);
  const today=()=>{const x=Object.fromEntries(formatter.formatToParts(new Date())
    .filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    return dateOf(x.year+x.month+x.day);};
  const sanitize=dish=>String(dish||'')
    .replace(/[\(（]\s*\d+(?:\s*[.,·]\s*\d+)*\s*[\)）]/g,'')
    .replace(/\s{2,}/g,' ').trim();
  const cleanCalories=raw=>String(raw||'').replace(/(\d)\s+[kK]cal/,'$1 Kcal').trim();
  const changed=(a,b)=>ymd(a)!==ymd(b);
  let host=null,ui=null,originDate=null,selected=null,mode='week',meals=new Map();
  let requestId=0,queued=false,sourceObserver=null,sourceList=null,sourceFoot=null;
  let activeRequest=false,cachedNative=null,lastNativeSignature='',fetchError=false;
  let loadedMonths=new Set();
  let railDrag=null;
  const asProfile=()=>{
    try{
      const p=JSON.parse(localStorage.getItem(PROFILE)||'null'),s=p?.school;
      if(!s)return null;
      if(!/^[A-Z0-9]{1,12}$/i.test(String(s.officeCode||''))||
         !/^[A-Z0-9]{1,12}$/i.test(String(s.schoolCode||'')))return null;
      const grade=+p.grade;
      if(!Number.isInteger(grade)||grade<1||grade>6)return null;
      return {office:s.officeCode,school:s.schoolCode,kind:s.kind||'',
        grade,className:String(p.className||'1')};
    }catch(_){return null;}
  };
  function selectedNativeDate(){
    const base=today();
    const label=document.querySelector('.scene[data-scene="today"] .hero-numeral')?.textContent||'';
    const match=label.match(/(\d{1,2})\s*\.\s*(\d{1,2})/);
    if(!match)return base;
    const m=+match[1],d=+match[2];
    const years=[base.getUTCFullYear()-1,base.getUTCFullYear(),base.getUTCFullYear()+1];
    const possibilities=years.map(y=>new Date(Date.UTC(y,m-1,d)))
      .filter(date=>date.getUTCMonth()+1===m&&date.getUTCDate()===d);
    possibilities.sort((a,b)=>Math.abs(a-base)-Math.abs(b-base));
    return possibilities[0]||base;
  }
  function visibleRange(){
    if(mode==='week'){
      const start=monday(selected);
      return {start,end:dayAdd(start,4),
        label:(start.getUTCMonth()+1)+'월 '+start.getUTCDate()+'–'+
          (dayAdd(start,4).getUTCMonth()+1)+'월 '+dayAdd(start,4).getUTCDate()+'일'};
    }
    const start=monthOf(selected);
    return {start,end:new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)),
      label:start.getUTCFullYear()+'년 '+(start.getUTCMonth()+1)+'월'};
  }
  function nativeFallback(){
    if(!host||!originDate)return null;
    const values=[...host.querySelectorAll(':scope > .meal-list li')].map(li=>li.textContent.trim())
      .map(sanitize).filter(Boolean);
    if(!values.length)return null;
    const calorie=host.querySelector(':scope > .meal-foot')?.textContent.trim()||'';
    return {date:ymd(originDate),type:'중식',dishes:values,calories:cleanCalories(calorie)};
  }
  function syncNative(){
    const next=selectedNativeDate(),nextKey=ymd(next);
    const changedDate=!originDate||changed(next,originDate);
    originDate=next;
    const fallback=nativeFallback();
    const signature=JSON.stringify(fallback);
    const nativeChanged=signature!==lastNativeSignature;
    lastNativeSignature=signature;
    cachedNative=fallback;
    if(changedDate){
      selected=next;
      // Track the selected day in Today. Keep the chosen viewing mode.
      render();
      requestVisible();
    }else if(nativeChanged && ui && selected && cachedNative?.date===ymd(selected)){
      renderDetail();renderDays();
    }
  }
  function accept(raw,key,out){
    if(!Array.isArray(raw?.meals))return;
    for(const m of raw.meals){
      const date=String(m?.date||''),type=String(m?.type||'');
      if(!/^20\d{6}$/.test(date)||date.slice(0,6)!==key||
         !Array.isArray(m?.dishes))continue;
      const dishes=m.dishes.map(sanitize).filter(Boolean);
      if(!dishes.length)continue;
      const old=out.get(date);
      if(old&&!type.includes('중식'))continue;
      out.set(date,{date,type:type||'중식',dishes,calories:cleanCalories(m.calories)});
    }
  }
  async function snapshot(p,d){
    const qs=new URLSearchParams({
      action:'dashboard',office:p.office,school:p.school,
      grade:String(p.grade),class:p.className,kind:p.kind,date:ymd(d)
    });
    const controller=new AbortController(),tm=setTimeout(()=>controller.abort(),11000);
    try{
      const response=await fetch(API+'?'+qs.toString(),{signal:controller.signal});
      if(!response.ok)throw Error('HTTP '+response.status);
      const value=await response.json();
      if(!Array.isArray(value?.meals))throw Error('Invalid meal response');
      return value;
    }finally{clearTimeout(tm);}
  }
  async function loadMonth(date,p){
    const key=[p.office,p.school,monthKey(date)].join(':');
    const saved=cache.get(key);
    if(saved&&Date.now()-saved.at<CACHE_MS)return saved.values;
    if(pendingMonths.has(key))return pendingMonths.get(key);
    const job=(async()=>{
    const first=monthOf(date),value=new Map();
    accept(await snapshot(p,first),monthKey(date),value);
    const days=[...value.keys()].sort();
    if(days.length<11||!days.length||+days[days.length-1].slice(6)<22){
      const finalDay=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
      const anchors=[8,15,22,29].filter(d=>d<=finalDay)
        .map(d=>new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),d)));
      for(let i=0;i<anchors.length;i+=2){
        const results=await Promise.allSettled(anchors.slice(i,i+2).map(d=>snapshot(p,d)));
        for(const r of results)if(r.status==='fulfilled')accept(r.value,monthKey(date),value);
      }
    }
    cache.set(key,{at:Date.now(),values:value});
    if(cache.size>MONTH_LIMIT)cache.delete(cache.keys().next().value);
    return value;
    })();
    pendingMonths.set(key,job);
    try{return await job;}
    finally{if(pendingMonths.get(key)===job)pendingMonths.delete(key);}
  }
  function mealFor(d){
    return (cachedNative?.date===ymd(d)?cachedNative:null)||meals.get(ymd(d))||null;
  }
  function warn(message){
    if(!ui)return;
    const node=ui.querySelector('.flow-meal-warning');
    if(node.textContent!==message)node.textContent=message;
    node.hidden=!message;
  }
  function visibleMonths(){
    const r=visibleRange(),months=[];
    for(let cursor=monthOf(r.start);cursor<=r.end;
        cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1))){
      months.push(cursor);
      if(months.length>=3)break;
    }
    return months;
  }
  async function requestVisible(){
    if(!ui||!selected)return;
    const missing=visibleMonths().filter(d=>!loadedMonths.has(monthKey(d)));
    if(!missing.length){activeRequest=false;fetchError=false;warn('');return;}
    const p=asProfile(),id=++requestId;
    if(!p){
      activeRequest=false;fetchError=true;
      warn('급식 정보를 연결하려면 학교를 다시 선택해 주세요.');
      return;
    }
    activeRequest=true;fetchError=false;
    ui.classList.add('is-loading');
    try{
      const results=await Promise.allSettled(missing.map(d=>loadMonth(d,p)));
      if(id!==requestId||!ui?.isConnected)return;
      let failures=0;
      for(let i=0;i<results.length;i++){
        const result=results[i],month=missing[i];
        if(result.status!=='fulfilled'){failures++;continue;}
        loadedMonths.add(monthKey(month));
        for(const [key,value] of result.value)meals.set(key,value);
      }
      activeRequest=false;fetchError=failures>0;
      warn(failures?'일부 날짜의 급식 조회에 실패했어요. 다시 시도할 수 있어요.':'');
      render();
    }catch(_){
      if(id!==requestId)return;
      activeRequest=false;fetchError=true;
      warn('급식을 불러오지 못했어요. 다시 시도할 수 있어요.');
      render();
    }finally{if(id===requestId)ui?.classList.remove('is-loading');}
  }
  function setMode(next){
    if(next!== 'week'&&next!=='month')return;
    if(mode===next)return;
    mode=next;
    ui.dataset.view=next;
    ui.querySelectorAll('.flow-meal-segment button').forEach(b=>{
      const yes=b.dataset.view===next;
      b.classList.toggle('selected',yes);
      b.setAttribute('aria-pressed',String(yes));
    });
    render();requestVisible();
  }
  function onSelectDate(d){
    if(!d||ymd(d)===ymd(selected))return;
    selected=d;
    render();requestVisible();
  }
  function periodStep(step){
    if(mode==='week')selected=dayAdd(selected,step*7);
    else{
      const first=new Date(Date.UTC(selected.getUTCFullYear(),
        selected.getUTCMonth()+step,1));
      const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
      first.setUTCDate(Math.min(selected.getUTCDate(),last));
      selected=first;
    }
    render();requestVisible();
  }
  function makeDate(d,inMonth=true){
    const meal=mealFor(d);
    const chosen=ymd(d)===ymd(selected);
    const button=mk('button','flow-meal-day'+(chosen?' selected':''));
    button.type='button';button.dataset.date=ymd(d);
    button.setAttribute('aria-pressed',String(chosen));
    button.setAttribute('aria-label',(d.getUTCMonth()+1)+'월 '+d.getUTCDate()+'일 급식 선택');
    button.append(mk('strong','flow-meal-day-number',String(d.getUTCDate())));
    const dishes=meal?.dishes||[];
    const hint=mk('span','flow-meal-day-teaser',
      dishes.length?dishes.slice(0,2).join(' · '):activeRequest?'':'—');
    button.append(hint);
    if(dishes.length>2)button.append(mk('small','flow-meal-day-count','+'+(dishes.length-2)));
    button.addEventListener('click',()=>onSelectDate(d));
    return button;
  }
  function renderDays(){
    if(!ui||!selected)return;
    const range=visibleRange(),grid=ui.querySelector('.flow-meal-calendar');
    const before=grid.scrollTop;
    const oldMode=grid.dataset.view;
    grid.dataset.view=mode;
    ui.querySelector('.flow-meal-range').textContent=range.label;
    grid.replaceChildren();
    for(const d of weekdays)grid.append(mk('span','flow-meal-weekday',d));
    if(mode==='week'){
      for(let i=0;i<5;i++)grid.append(makeDate(dayAdd(range.start,i)));
    }else{
      const weekStart=monday(range.start);
      const weekEnd=dayAdd(monday(range.end),4);
      for(let w=weekStart;w<=weekEnd;w=dayAdd(w,7)){
        for(let i=0;i<5;i++){
          const d=dayAdd(w,i);
          if(d.getUTCMonth()!==selected.getUTCMonth())grid.append(mk('span','flow-meal-spacer'));
          else grid.append(makeDate(d));
        }
      }
    }
    if(oldMode===mode)grid.scrollTop=before;
  }
  function renderDetail(){
    if(!ui||!selected)return;
    const target=ui.querySelector('.flow-meal-main'),meal=mealFor(selected);
    const date=selected.getUTCMonth()+1+'월 '+selected.getUTCDate()+'일';
    ui.querySelector('.flow-meal-date-label').textContent=
      ymd(selected)===ymd(today())?'오늘의 급식':date+' 급식';
    target.replaceChildren();
    const top=mk('div','flow-meal-detail-heading');
    top.append(mk('span','',date+' · '+(meal?.type||'중식')));
    if(meal?.calories)top.append(mk('span','flow-meal-kcal',meal.calories));
    target.append(top);
    if(meal?.dishes?.length){
      const chips=mk('div','flow-meal-chips');
      for(const dish of meal.dishes)chips.append(mk('span','flow-meal-chip',dish));
      target.append(chips);
    }else{
      target.append(mk('p','flow-meal-empty',activeRequest?
        '급식 정보를 확인 중이에요.':'이날 등록된 급식이 없어요.'));
    }
  }
  function render(){
    if(!ui||!selected)return;
    renderDetail();renderDays();
  }
  function bindSegment(segment){
    // One pointer gesture controls the pill directly. Tap selection happens
    // at pointerdown, rather than waiting for a delayed synthesized click.
    let gesture=null;
    function pick(x){
      const r=segment.getBoundingClientRect();
      return x<r.left+r.width/2?'week':'month';
    }
    function fraction(x){
      const r=segment.getBoundingClientRect();
      const inner=(x-r.left-r.width*.25)/(r.width*.5);
      return Math.min(1,Math.max(0,inner));
    }
    segment.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      gesture={id:e.pointerId,x:e.clientX,y:e.clientY};
      segment.dataset.dragging='true';
      segment.style.setProperty('--flow-meal-shift',String(fraction(e.clientX)));
      setMode(pick(e.clientX));
      if(segment.setPointerCapture){
        try{segment.setPointerCapture(e.pointerId);}catch(_){}
      }
    });
    segment.addEventListener('pointermove',e=>{
      if(!gesture||e.pointerId!==gesture.id)return;
      segment.style.setProperty('--flow-meal-shift',String(fraction(e.clientX)));
      const candidate=pick(e.clientX);
      segment.dataset.preview=candidate;
      // The selected mode follows the finger, not an on-release threshold.
      setMode(candidate);
    });
    const finish=e=>{
      if(!gesture||e.pointerId!==gesture.id)return;
      const candidate=pick(e.clientX);
      gesture=null;
      setMode(candidate);
      segment.style.removeProperty('--flow-meal-shift');
      segment.removeAttribute('data-dragging');
      segment.removeAttribute('data-preview');
    };
    segment.addEventListener('pointerup',finish);
    segment.addEventListener('pointercancel',()=>{
      gesture=null;segment.style.removeProperty('--flow-meal-shift');
      segment.removeAttribute('data-dragging');
      segment.removeAttribute('data-preview');
    });
    segment.addEventListener('click',e=>{
      const button=e.target.closest('button[data-view]');
      if(button)setMode(button.dataset.view);
    });
    segment.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
        e.preventDefault();setMode(e.key==='ArrowRight'?'month':'week');
      }
    });
  }
  function bindSwipe(rail){
    rail.addEventListener('touchstart',e=>{
      if(e.touches.length!==1)return;
      const t=e.touches[0];railDrag={x:t.clientX,y:t.clientY};
      // Prevent the native 5-tab handler seeing a meal-only gesture.
      e.stopPropagation();
    },{passive:true});
    rail.addEventListener('touchend',e=>{
      if(!railDrag)return;
      const t=e.changedTouches[0],dx=t.clientX-railDrag.x,dy=t.clientY-railDrag.y;
      railDrag=null;e.stopPropagation();
      if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.5){
        if(e.cancelable)e.preventDefault();
        periodStep(dx<0?1:-1);
      }
    },{passive:false});
    rail.addEventListener('touchcancel',()=>{railDrag=null;});
  }
  function build(next){
    host=next;requestId++;sourceObserver?.disconnect();sourceObserver=null;
    const old=host.querySelector(':scope > .flow-meal-single');
    if(old)old.remove();
    host.classList.add('flow-meal-single-host');
    const root=mk('div','flow-meal-single');
    root.dataset.view=mode;ui=root;
    const header=mk('header','flow-meal-single-head');
    const title=mk('strong','flow-meal-date-label','오늘의 급식');
    const segment=mk('div','flow-meal-segment');
    segment.setAttribute('role','group');segment.setAttribute('aria-label','급식표 보기');
    for(const [id,label] of [['week','주간'],['month','월간']]){
      const b=mk('button',id===mode?'selected':'',label);
      b.type='button';b.dataset.view=id;b.setAttribute('aria-pressed',String(id===mode));
      segment.append(b);
    }
    bindSegment(segment);header.append(title,segment);
    const main=mk('section','flow-meal-main');
    main.setAttribute('aria-label','선택한 날짜 급식 메뉴');
    const rail=mk('div','flow-meal-navigator');
    const prev=mk('button','flow-meal-arrow','‹');prev.type='button';
    prev.setAttribute('aria-label','이전 '+(mode==='week'?'기간':'기간'));
    prev.addEventListener('click',()=>periodStep(-1));
    const label=mk('strong','flow-meal-range');
    const nextButton=mk('button','flow-meal-arrow','›');nextButton.type='button';
    nextButton.setAttribute('aria-label','다음 기간');
    nextButton.addEventListener('click',()=>periodStep(1));
    rail.append(prev,label,nextButton);
    const calendar=mk('div','flow-meal-calendar');
    calendar.setAttribute('role','group');calendar.setAttribute('aria-label','급식 날짜 선택');
    bindSwipe(calendar);
    root.addEventListener('touchend',e=>e.stopPropagation(),{passive:true});
    const message=mk('p','flow-meal-warning');message.hidden=true;
    const retry=mk('button','flow-meal-retry','다시 시도');
    retry.type='button';retry.addEventListener('click',()=>requestVisible());
    root.append(header,main,rail,calendar,message,retry);
    host.append(root);
    const list=host.querySelector(':scope > .meal-list');
    const foot=host.querySelector(':scope > .meal-foot');
    sourceList=list;sourceFoot=foot;
    sourceObserver=new MutationObserver(schedule);
    if(list)sourceObserver.observe(list,{childList:true,characterData:true,subtree:true});
    if(foot)sourceObserver.observe(foot,{childList:true,characterData:true,subtree:true});
    originDate=null;selected=null;cachedNative=null;lastNativeSignature='';meals=new Map();loadedMonths=new Set();mode='week';
    root.dataset.view=mode;
    syncNative();
    // Native data can render just after this component mounts.
  }
  function mount(){
    const next=document.querySelector('.scene[data-scene="today"] .meal-sheet');
    if(!next){
      sourceObserver?.disconnect();sourceObserver=null;
      host=null;ui=null;return;
    }
    if(next!==host||!ui?.isConnected){build(next);return;}
    syncNative();
  }
  function schedule(){
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;mount();});
  }
  const rootObserver=new MutationObserver(schedule);
  rootObserver.observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('pageshow',schedule);
  schedule();
})();