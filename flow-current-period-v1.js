(() => {
  'use strict';
  // Reimplemented from the observed Haksi timetable algorithm:
  // current local minutes ∈ [start, end), with the SAME high-school periods.
  // These are Haksi's common high-school hours, not verified bell times at
  // any particular school. Do not label as an official school timetable.
  const PERIODS=[
    {period:1,start:500,end:550},
    {period:2,start:560,end:610},
    {period:3,start:620,end:670},
    {period:4,start:680,end:730},
    {period:5,start:790,end:840},
    {period:6,start:850,end:900},
    {period:7,start:910,end:960}
  ];
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
  function chooseState(current){
    const next=PERIODS.find(p=>current.minutes<p.start);
    const during=PERIODS.find(p=>current.minutes>=p.start&&current.minutes<p.end);
    const past=PERIODS.filter(p=>p.end<=current.minutes).map(p=>p.period);
    if(during)return {
      type:'live',number:during.period,
      title:during.period+'교시 수업 중',
      detail:Math.max(1,during.end-current.minutes)+'분 남음',
      times:toTime(during.start)+'–'+toTime(during.end),
      progress:Math.max(0,Math.min(1,(current.minutes-during.start)/(during.end-during.start))),
      past
    };
    if(next){
      const isLunch=current.minutes>=PERIODS[3].end && current.minutes<PERIODS[4].start;
      const label=isLunch?'점심시간':current.minutes<PERIODS[0].start?'수업 시작 전':'쉬는 시간';
      return {type:isLunch?'lunch':'break',number:0,
        title:label,detail:next.period+'교시 시작까지 '+(next.start-current.minutes)+'분',
        times:next.period+'교시 '+toTime(next.start)+' 시작',progress:0,past};
    }
    return {type:'done',number:0,title:'오늘 수업 종료',
      detail:'7교시 종료 기준 '+toTime(PERIODS[6].end),
      times:'고등학교 공통 시간 기준',progress:1,past};
  }
  let scene=null,heading=null,indicator=null,observer=null,queued=false;
  const getDateMode=()=>scene?.querySelector('.hero-tag')?.textContent.trim()==='오늘의 학교생활';
  function mount(){
    const found=document.querySelector('.scene[data-scene="today"]');
    if(found===scene)return;
    observer?.disconnect();observer=null;scene=found;
    indicator=null;heading=null;
    if(!scene)return;
    heading=scene.querySelector('.timetable-sheet .module-heading-copy');
    if(!heading)return;
    indicator=document.createElement('div');
    indicator.className='flow-live-period';
    indicator.setAttribute('role','status');
    indicator.setAttribute('aria-live','off');
    const dot=document.createElement('span');dot.className='flow-live-period-dot';
    const title=document.createElement('strong');title.className='flow-live-period-title';
    const summary=document.createElement('span');summary.className='flow-live-period-summary';
    const line=document.createElement('span');line.className='flow-live-period-progress';
    const fill=document.createElement('i');line.append(fill);
    indicator.append(dot,title,summary,line);
    heading.append(indicator);
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
    const school=scene.querySelector('.hero-school')?.textContent||'';
    const isHigh=school.includes('고등학교')||school.includes('정동고');
    const hasLessons=rows.length>0||[...scene.querySelectorAll('.timetable-sheet .week-grid .week-cell')].some(cell=>!cell.classList.contains('empty'));
    const active=isToday&&isHigh&&hasLessons&&current.weekday!=='Sat'&&current.weekday!=='Sun';
    setClass(indicator,'flow-live-hidden',!active);
    if(!active){
      for(const row of [...rows,...weekRows]) {
        setClass(row,'flow-period-active',false);setClass(row,'flow-period-done',false);
        row.style.removeProperty('--flow-progress');
        row.removeAttribute('aria-current');
      }
      return;
    }
    const status=chooseState(current);
    setAttribute(indicator,'data-phase',status.type);
    setText(indicator.querySelector('.flow-live-period-title'),status.title);
    setText(indicator.querySelector('.flow-live-period-summary'),status.detail+' · '+status.times+' · 참고 시간');
    const fill=indicator.querySelector('.flow-live-period-progress i');
    if(fill&&fill.style.transform!=='scaleX('+status.progress.toFixed(3)+')')
      fill.style.transform='scaleX('+status.progress.toFixed(3)+')';
    [...rows,...weekRows].forEach(row=>{
      const period=Number(row.querySelector('.class-period,.week-period')?.textContent);
      const live=status.type==='live'&&status.number===period;
      const done=status.past.includes(period);
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