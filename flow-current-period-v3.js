(() => {
  'use strict';
  // Reimplemented from the observed Haksi timetable algorithm:
  // current local minutes ∈ [start, end), with the SAME high-school periods.
  // These are Haksi's common high-school hours, not verified bell times at
  // any particular school. Do not label as an official school timetable.
  // Haksi 2026: for schoolType === "중학교" use middle-school clock;
  // for all other types Haksi falls back to the high-school clock.
  // No separate elementary clock is published in the inspected code.
  const HIGH=[
    {period:1,start:500,end:550},
    {period:2,start:560,end:610},
    {period:3,start:620,end:670},
    {period:4,start:680,end:730},
    {period:5,start:790,end:840},
    {period:6,start:850,end:900},
    {period:7,start:910,end:960}
  ];
  const MIDDLE=[
    {period:1,start:540,end:585},
    {period:2,start:595,end:640},
    {period:3,start:650,end:695},
    {period:4,start:705,end:750},
    {period:5,start:810,end:855},
    {period:6,start:865,end:910},
    {period:7,start:920,end:965}
  ];
  function schoolType(){
    let p=null;
    try {p=JSON.parse(localStorage.getItem('flow-school-profile-v3')||'null');}catch(_){}
    const raw=(p?.school?.kind||'')+' '+(p?.school?.name||'');
    if(/초등학교|초등|초등부/.test(raw))return 'elementary';
    if(/중학교|중등학교|중학/.test(raw))return 'middle';
    if(/고등학교|고등|고교|특성화고/.test(raw))return 'high';
    return 'unknown';
  }
  const timeFormatter=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hour12:false,hourCycle:'h23'
  });
  const pad=n=>String(n).padStart(2,'0');
  function clock(now=new Date()){
    const parts=Object.fromEntries(timeFormatter.formatToParts(now)
      .filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    const hour=Number(parts.hour)%24,minute=Number(parts.minute);
    return {
      date:parts.year+parts.month+parts.day,
      minutes:hour*60+minute,
      weekday:new Date(now).toLocaleDateString('en-US',{timeZone:'Asia/Seoul',weekday:'short'})
    };
  }
  function toTime(minutes){return pad(Math.floor(minutes/60))+':'+pad(minutes%60);}
  function chooseState(current, periods){
    const next=periods.find(p=>current.minutes<p.start);
    const during=periods.find(p=>current.minutes>=p.start&&current.minutes<p.end);
    const past=periods.filter(p=>p.end<=current.minutes).map(p=>p.period);
    if(during)return {
      type:'live',number:during.period,
      title:during.period+'교시 예상 시간',
      detail:Math.max(1,during.end-current.minutes)+'분 남음',
      times:toTime(during.start)+'–'+toTime(during.end),
      progress:Math.max(0,Math.min(1,(current.minutes-during.start)/(during.end-during.start))),
      past
    };
    if(next){
      const lunch=periods.find(p=>p.period===4),afternoon=periods.find(p=>p.period===5);
      const isLunch=!!lunch&&!!afternoon&&current.minutes>=lunch.end&&current.minutes<afternoon.start;
      const label=isLunch?'점심시간 참고':current.minutes<periods[0].start?'수업 시작 전 참고':'다음 교시 참고';
      return {type:isLunch?'lunch':'break',number:0,
        title:label,detail:next.period+'교시 시작까지 '+(next.start-current.minutes)+'분',
        times:next.period+'교시 '+toTime(next.start)+' 시작',progress:0,past};
    }
    const final=periods[periods.length-1];
    return {type:'done',number:0,title:'오늘 수업 종료',
      detail:final.period+'교시 종료 기준 '+toTime(final.end),
      times:'고등학교 공통 시간 기준',progress:1,past};
  }
  let scene=null,heading=null,indicator=null,observer=null,queued=false;
  const getDateMode=()=>scene?.querySelector('.hero-tag')?.textContent.trim()==='오늘의 학교생활';
  function mount(){
    const found=document.querySelector('.scene[data-scene="today"]');
    if(found===scene&&indicator?.isConnected)return;
    observer?.disconnect();observer=null;scene=found;
    indicator=null;heading=null;
    if(!scene)return;
    heading=scene.querySelector('.timetable-sheet .module-heading');
    if(!heading)return;
    indicator=document.createElement('div');
    indicator.className='flow-live-period';
    indicator.setAttribute('role','status');
    indicator.setAttribute('aria-live','off');
    const dot=document.createElement('span');dot.className='flow-live-period-dot';
    const title=document.createElement('strong');title.className='flow-live-period-title';
    const summary=document.createElement('span');summary.className='flow-live-period-summary';
    const next=document.createElement('span');next.className='flow-live-period-next';
    const caution=document.createElement('span');caution.className='flow-live-period-caution';
    const line=document.createElement('span');line.className='flow-live-period-progress';
    const fill=document.createElement('i');line.append(fill);
    indicator.append(dot,title,summary,next,caution,line);
    heading.after(indicator);
    observer=new MutationObserver(schedule);
    observer.observe(scene,{childList:true,subtree:true,characterData:true});
    render();
  }
  function setText(el,value){if(el&&el.textContent!==value)el.textContent=value;}
  function setClass(el,name,yes){if(el&&el.classList.contains(name)!==yes)el.classList.toggle(name,yes);}
  function setAttribute(el,name,value){if(el&&el.getAttribute(name)!==value)el.setAttribute(name,value);}
  function render(){
    if(!scene?.isConnected||!indicator)return;
    const rows=[...scene.querySelectorAll('.timetable-sheet .class-rows .class-row')];
    const weekRows=[...scene.querySelectorAll('.timetable-sheet .week-grid .week-grid-row:not(.week-grid-header)')];
    const isToday=getDateMode();
    const current=clock();
    const type=schoolType();
    const weekToday=[...scene.querySelectorAll('.timetable-sheet .week-grid .week-cell.today:not(.empty)')];
    const available=rows.length?rows.map(row=>Number(row.querySelector('.class-period')?.textContent)):
      weekToday.map(row=>Number(row.closest('.week-grid-row')?.querySelector('.week-period')?.textContent));
    const reference=type==='middle'?MIDDLE:HIGH;
    // Missing NEIS rows are unknown, not confirmed lessons. Never fall back
    // to high-school hours for elementary or unclassified school profiles.
    const periods=reference.filter(period=>available.includes(period.period));
    const subjectFor=period=>{
      const daily=rows.find(r=>Number(r.querySelector('.class-period')?.textContent)===period);
      const weekly=weekToday.find(r=>Number(r.closest('.week-grid-row')?.querySelector('.week-period')?.textContent)===period);
      return daily?.querySelector('strong')?.textContent.trim()||weekly?.textContent.trim()||'';
    };
    const active=isToday&&(type==='middle'||type==='high')&&periods.length>0&&current.weekday!=='Sat'&&current.weekday!=='Sun';
    setClass(indicator,'flow-live-hidden',!active);
    if(!active){
      for(const row of [...rows,...weekRows,...weekToday]) {
        setClass(row,'flow-period-active',false);setClass(row,'flow-period-done',false);
        setClass(row,'flow-period-next',false);
        row.style.removeProperty('--flow-progress');
        row.removeAttribute('aria-current');
      }
      return;
    }
    const status=chooseState(current,periods);
    // After dismissal no redundant end-of-day banner or faded lesson rows.
    if(status.type==='done'){
      setClass(indicator,'flow-live-hidden',true);
      for(const row of [...rows,...weekRows,...weekToday]){
        setClass(row,'flow-period-active',false);
        setClass(row,'flow-period-done',false);
        setClass(row,'flow-period-next',false);
        row.style.removeProperty('--flow-progress');
        row.removeAttribute('aria-current');
      }
      return;
    }
    setClass(indicator,'flow-live-hidden',false);
    setAttribute(indicator,'data-phase',status.type);
    setAttribute(indicator,'data-school-type',type);
    const upcoming=periods.find(p=>current.minutes<p.start);
    const currentSubject=status.number?subjectFor(status.number):'';
    const nextSubject=upcoming?subjectFor(upcoming.period):'';
    setText(indicator.querySelector('.flow-live-period-title'),status.type==='live'?
      status.number+'교시'+(currentSubject?' · '+currentSubject:''):'다음 '+(upcoming?upcoming.period+'교시':'수업')+(nextSubject?' · '+nextSubject:''));
    setText(indicator.querySelector('.flow-live-period-summary'),status.type==='live'?status.detail:status.times);
    setText(indicator.querySelector('.flow-live-period-next'),status.type==='live'&&upcoming?'다음 '+upcoming.period+'교시'+(nextSubject?' · '+nextSubject:''):status.type!=='live'?status.detail:'');
    setText(indicator.querySelector('.flow-live-period-caution'),'예상 시간 · 학교별 타종 미확인');
    const fill=indicator.querySelector('.flow-live-period-progress i');
    if(fill&&fill.style.transform!=='scaleX('+status.progress.toFixed(3)+')')
      fill.style.transform='scaleX('+status.progress.toFixed(3)+')';
    // A weekly grid contains multiple dates per row. Highlight only today's
    // actual lesson cell, never the entire week at that period.
    for(const row of weekRows){
      setClass(row,'flow-period-active',false);setClass(row,'flow-period-done',false);setClass(row,'flow-period-next',false);
      row.removeAttribute('aria-current');
    }
    [...rows,...weekToday].forEach(row=>{
      const period=Number(row.querySelector('.class-period')?.textContent||row.closest('.week-grid-row')?.querySelector('.week-period')?.textContent);
      const live=status.type==='live'&&status.number===period;
      const done=status.past.includes(period);
      setClass(row,'flow-period-next',!live&&upcoming?.period===period);
      setClass(row,'flow-period-active',live);
      setClass(row,'flow-period-done',done&&!live);
      if(live)setAttribute(row,'aria-current','step');
      else row.removeAttribute('aria-current');
    });
  }
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;mount();render();});
  }
  const rootObserver=new MutationObserver(schedule);
  rootObserver.observe(document.documentElement,{childList:true,subtree:true});
  const timer=setInterval(()=>{if(!document.hidden)render();},30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  addEventListener('pageshow',schedule);
  schedule();
})();
