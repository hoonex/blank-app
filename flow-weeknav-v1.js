(() => {
'use strict';
/*
 * FLOW Week Navigator v1.
 * User-facing week selector is independent from the legacy physics shuttle.
 * The original Leptos day-strip remains the single source of truth and owns
 * every date change, schedule fetch, and selection state.
 */
const DAY = 86400000;
const DAYS = ['일','월','화','수','목','금','토'];
const ROOT = '.flow-shell .scene[data-scene="today"]';
const dateUTC = (y,m,d) => Date.UTC(y,m-1,d);
const fromMs = ms => new Date(ms);
const dayIndex = ms => Math.floor(ms/DAY);
const addDay = (ms,d) => ms+d*DAY;
const sameDay = (a,b) => a===b;
const monday = ms => addDay(ms,-((fromMs(ms).getUTCDay()+6)%7));
const pad = n => String(n).padStart(2,'0');
const iso = ms => {const x=fromMs(ms);return x.getUTCFullYear()+'-'+pad(x.getUTCMonth()+1)+'-'+pad(x.getUTCDate());};
const formatLong = ms => {const x=fromMs(ms);return x.getUTCFullYear()+'년 '+(x.getUTCMonth()+1)+'월 '+x.getUTCDate()+'일 '+DAYS[x.getUTCDay()]+'요일';};
function actualToday(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date());
  const get=t=>Number(parts.find(x=>x.type===t)?.value);
  return dateUTC(get('year'),get('month'),get('day'));
}
const TODAY=actualToday();
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const state={scene:null,source:null,widget:null,dialog:null,selected:null,week:null,month:null,
  sourceObserver:null,scheduled:false,pending:false,lastSwipe:0,seq:0,focused:null};
function el(tag,cls,txt){
  const v=document.createElement(tag);
  if(cls)v.className=cls;
  if(txt!==undefined)v.textContent=txt;
  return v;
}
function findNearest(month,day,around){
  const year=fromMs(around).getUTCFullYear();
  const candidates=[];
  for(let y=year-1;y<=year+1;y++){
    const t=dateUTC(y,month,day);
    if(fromMs(t).getUTCDate()===day)candidates.push(t);
  }
  candidates.sort((a,b)=>Math.abs(a-around)-Math.abs(b-around));
  return candidates[0]??around;
}
function nativeView(){
  const strip=state.source?.querySelector('.day-strip');
  const buttons=strip?[...strip.querySelectorAll(':scope > button')]:[];
  const active=buttons.findIndex(x=>x.classList.contains('active'));
  if(active<0 || !buttons.length)return null;
  const actual=buttons.findIndex(x=>x.classList.contains('real-today'));
  let selected;
  if(actual>=0)selected=addDay(TODAY,active-actual);
  else{
    const match=buttons[active].getAttribute('aria-label')?.match(/(\d+)월\s*(\d+)일/);
    const base=state.selected??TODAY;
    selected=match?findNearest(+match[1],+match[2],base):base;
  }
  return {buttons,active,actual,selected};
}
function setText(node,value){
  if(node&&node.textContent!==value)node.textContent=value;
}
function render(){
  const s=state,root=s.widget;
  if(!root||!s.selected)return;
  const selected=s.selected,week=monday(selected);
  const month=fromMs(selected);
  const period=month.getUTCFullYear()+'년 '+(month.getUTCMonth()+1)+'월';
  setText(root.querySelector('.flow-weeknav-month-text'),period);
  root.querySelector('.flow-weeknav-month')?.setAttribute('aria-label',period+' 월간 달력에서 날짜 선택');
  const todayBtn=root.querySelector('.flow-weeknav-today');
  todayBtn.dataset.atToday=sameDay(selected,TODAY)?'true':'false';
  todayBtn.setAttribute('aria-label',sameDay(selected,TODAY)?'오늘 날짜가 선택되어 있습니다':'오늘 날짜로 돌아가기');
  if(state.week!==week){
    state.week=week;
    const row=root.querySelector('.flow-weeknav-days');
    const items=[];
    for(let i=0;i<7;i++){
      const date=addDay(week,i),dt=fromMs(date);
      const b=el('button','flow-weeknav-day');b.type='button';
      b.dataset.date=iso(date);
      b.append(el('small','',DAYS[dt.getUTCDay()]));
      b.append(el('strong','',String(dt.getUTCDate())));
      const dot=el('span','flow-weeknav-day-marker');
      dot.setAttribute('aria-hidden','true');b.append(dot);
      b.addEventListener('click',()=>{
        if(performance.now()-s.lastSwipe<550)return;
        void choose(date);
      });
      items.push(b);
    }
    row.replaceChildren(...items);
  }
  for(const b of root.querySelectorAll('.flow-weeknav-day')){
    const selectedNow=b.dataset.date===iso(selected);
    const actualNow=b.dataset.date===iso(TODAY);
    b.classList.toggle('is-selected',selectedNow);
    b.classList.toggle('is-today',actualNow);
    b.setAttribute('aria-pressed',String(selectedNow));
    if(actualNow)b.setAttribute('aria-current','date');else b.removeAttribute('aria-current');
    const d=b.dataset.date;
    const parts=d.split('-').map(Number);
    b.setAttribute('aria-label',formatLong(dateUTC(parts[0],parts[1],parts[2]))+
      (actualNow?' 오늘':'')+(selectedNow?' 선택됨':''));
  }
  setText(root.querySelector('.flow-weeknav-status'),formatLong(selected)+' 선택');
}
function sync(){
  if(!state.widget?.isConnected)return;
  const view=nativeView();
  if(!view)return;
  if(state.pending)return;
  if(state.selected!==view.selected){state.selected=view.selected;render();}
}
function waitFrame(){return new Promise(resolve=>requestAnimationFrame(resolve));}
async function choose(target){
  if(state.pending)return false;
  const token=++state.seq;
  state.pending=true;
  state.widget?.classList.add('flow-weeknav-busy');
  let ok=false;
  try{
    for(let tries=0;tries<28;tries++){
      if(token!==state.seq)break;
      const view=nativeView();
      if(!view)break;
      if(view.selected===target){ok=true;break;}
      const delta=dayIndex(target)-dayIndex(view.selected);
      const idx=view.active+delta;
      const dest=idx>=0&&idx<view.buttons.length?idx:(idx<0?0:view.buttons.length-1);
      const button=view.buttons[dest];
      if(!button)break;
      const desired=addDay(view.selected,dest-view.active);
      if(desired===view.selected)break;
      const acrossWindow=(idx<0||idx>=view.buttons.length);
      const firstBefore=view.buttons[0]?.getAttribute('aria-label');
      button.click(); // Only Leptos changes the actual selected date.
      state.selected=desired;
      await waitFrame();
      await waitFrame();
      if(acrossWindow){
        // Rust rebases its 181-day window asynchronously. Do not attempt
        // another edge click against the old window while that rebase runs.
        for(let settle=0;settle<30;settle++){
          const current=nativeView();
          if(current&&(current.active!==dest||
            current.buttons[0]?.getAttribute('aria-label')!==firstBefore))break;
          await new Promise(resolve=>setTimeout(resolve,20));
        }
      }
      const check=nativeView();
      if(check?.selected===target){ok=true;break;}
    }
  }finally{
    state.pending=false;
    state.widget?.classList.remove('flow-weeknav-busy');
    const snapshot=nativeView();
    if(snapshot)state.selected=snapshot.selected;
    render();
  }
  return ok;
}
function navigateWeek(step){if(state.selected!==null)void choose(addDay(state.selected,step*7));}
function drawMonth(dialog){
  const wrap=dialog.querySelector('.flow-month-sheet-grid');
  if(!wrap)return;
  const year=fromMs(state.month).getUTCFullYear(),month=fromMs(state.month).getUTCMonth();
  setText(dialog.querySelector('.flow-month-sheet-title'),year+'년 '+(month+1)+'월');
  const first=dateUTC(year,month+1,1);
  const lead=(fromMs(first).getUTCDay()+6)%7;
  const last=dateUTC(year,month+2,0),n=fromMs(last).getUTCDate();
  const nodes=[];
  for(const wd of ['월','화','수','목','금','토','일'])nodes.push(el('span','flow-month-sheet-weekday',wd));
  for(let i=0;i<lead;i++)nodes.push(el('span','flow-month-sheet-placeholder'));
  for(let d=1;d<=n;d++){
    const ms=dateUTC(year,month+1,d);
    const b=el('button','flow-month-sheet-day',String(d));b.type='button';
    if(ms===state.selected){b.classList.add('is-selected');b.setAttribute('aria-pressed','true')}
    else b.setAttribute('aria-pressed','false');
    if(ms===TODAY){b.classList.add('is-today');b.setAttribute('aria-current','date')}
    b.setAttribute('aria-label',formatLong(ms)+(ms===TODAY?' 오늘':''));
    b.addEventListener('click',async()=>{
      if(state.pending)return;
      const worked=await choose(ms);
      if(worked){dialog.close();}
      else setText(dialog.querySelector('.flow-month-sheet-hint'),'해당 날짜를 불러오지 못했어요. 다시 선택해 주세요.');
    });
    nodes.push(b);
  }
  wrap.replaceChildren(...nodes);
  setText(dialog.querySelector('.flow-month-sheet-hint'),'날짜를 누르면 선택한 날의 시간표와 급식이 표시됩니다.');
}
function showMonth(){
  if(!state.selected)return;
  state.dialog?.remove();
  const d=el('dialog','flow-month-sheet');d.setAttribute('aria-label','날짜 선택');
  state.dialog=d;state.month=dateUTC(fromMs(state.selected).getUTCFullYear(),fromMs(state.selected).getUTCMonth()+1,1);
  const body=el('div','flow-month-sheet-inner');
  const header=el('header','flow-month-sheet-header');
  const copy=el('div','flow-month-sheet-copy');
  copy.append(el('span','flow-month-sheet-kicker','날짜 선택'));
  copy.append(el('h2','flow-month-sheet-title',''));
  const close=el('button','flow-month-sheet-close','×');close.type='button';close.setAttribute('aria-label','달력 닫기');
  close.addEventListener('click',()=>d.close());
  header.append(copy,close);body.append(header);
  const nav=el('div','flow-month-sheet-nav');
  const prev=el('button','flow-month-sheet-prev','‹'),next=el('button','flow-month-sheet-next','›');
  for(const b of [prev,next])b.type='button';
  prev.setAttribute('aria-label','이전 달');next.setAttribute('aria-label','다음 달');
  prev.addEventListener('click',()=>{const t=fromMs(state.month);state.month=dateUTC(t.getUTCFullYear(),t.getUTCMonth(),1);drawMonth(d);});
  next.addEventListener('click',()=>{const t=fromMs(state.month);state.month=dateUTC(t.getUTCFullYear(),t.getUTCMonth()+2,1);drawMonth(d);});
  nav.append(prev,el('span','flow-month-sheet-nav-label','월간 달력'),next);body.append(nav);
  body.append(el('div','flow-month-sheet-grid'));
  const foot=el('div','flow-month-sheet-footer');
  const now=el('button','flow-month-sheet-now','오늘로 이동');now.type='button';
  now.addEventListener('click',async()=>{if(await choose(TODAY))d.close()});
  foot.append(now,el('p','flow-month-sheet-hint',''));body.append(foot);d.append(body);
  d.addEventListener('close',()=>{d.remove();state.dialog=null;state.widget?.querySelector('.flow-weeknav-month')?.focus({preventScroll:true})},{once:true});
  document.body.append(d);drawMonth(d);
  try{d.showModal()}catch(_){d.remove();state.dialog=null}
}
function createWidget(){
  const root=el('section','flow-weeknav');
  root.setAttribute('aria-label','날짜 선택');
  const head=el('div','flow-weeknav-head');
  const month=el('button','flow-weeknav-month');month.type='button';
  month.setAttribute('aria-label','월간 달력에서 날짜 선택');
  month.append(el('span','flow-weeknav-month-text','날짜'));
  month.append(el('span','flow-weeknav-chevron','⌄'));
  month.addEventListener('click',showMonth);
  const actions=el('div','flow-weeknav-actions');
  const prev=el('button','flow-weeknav-arrow','‹'),next=el('button','flow-weeknav-arrow','›');
  for(const b of [prev,next])b.type='button';
  prev.setAttribute('aria-label','이전 주');next.setAttribute('aria-label','다음 주');
  prev.addEventListener('click',()=>navigateWeek(-1));next.addEventListener('click',()=>navigateWeek(1));
  const today=el('button','flow-weeknav-today','오늘');today.type='button';
  today.addEventListener('click',()=>void choose(TODAY));
  actions.append(prev,next,today);head.append(month,actions);root.append(head);
  const strip=el('div','flow-weeknav-days');strip.setAttribute('role','group');strip.setAttribute('aria-label','요일별 날짜');
  let touch=null;
  strip.addEventListener('pointerdown',e=>{if(e.isPrimary&&(e.pointerType!=='mouse'||e.button===0))touch={x:e.clientX,y:e.clientY,id:e.pointerId}},{passive:true});
  strip.addEventListener('pointerup',e=>{
    if(!touch||touch.id!==e.pointerId)return;
    const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;
    if(Math.abs(dx)>42 && Math.abs(dx)>Math.abs(dy)*1.2){
      state.lastSwipe=performance.now();
      if(e.cancelable)e.preventDefault();
      navigateWeek(dx<0?1:-1);
    }
  });
  strip.addEventListener('pointercancel',()=>{touch=null});
  root.append(strip);
  const status=el('span','flow-weeknav-status','');status.setAttribute('aria-live','polite');
  root.append(status);
  return root;
}
function mount(){
  const scene=document.querySelector(ROOT),source=scene?.querySelector('.day-carousel');
  const heading=scene?.querySelector('.today-heading');
  if(!scene||!source||!heading){
    if(state.widget&&!state.widget.isConnected){state.widget=null;state.source=null}
    return;
  }
  if(state.widget?.isConnected&&state.source===source&&state.scene===scene){sync();return}
  state.sourceObserver?.disconnect();state.sourceObserver=null;
  state.scene=scene;state.source=source;
  if(!state.widget||!state.widget.isConnected)state.widget=createWidget();
  const view=nativeView();if(!view)return;
  state.selected=view.selected;state.week=null;
  if(heading.previousElementSibling!==state.widget)heading.before(state.widget);
  scene.classList.add('flow-weeknav-enabled');
  render();
  const strip=source.querySelector('.day-strip');
  if(strip){
    state.sourceObserver=new MutationObserver(schedule);
    state.sourceObserver.observe(strip,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-label','aria-current']});
  }
}
function schedule(){
  if(state.scheduled)return;
  state.scheduled=true;
  requestAnimationFrame(()=>{state.scheduled=false;mount()});
}
const globalObserver=new MutationObserver(records=>{
  for(const r of records){
    if(r.type!=='childList')continue;
    if([...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1 &&
      (n.matches?.('.today-heading,.scene[data-scene="today"],.day-carousel,.day-strip')||
       n.querySelector?.('.today-heading,.scene[data-scene="today"],.day-carousel,.day-strip')))){
      schedule();break;
    }
  }
});
globalObserver.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',e=>{
  if(e.target.closest('.mobile-bottom,.rail-navigation'))setTimeout(schedule,50);
},{passive:true,capture:true});
addEventListener('pageshow',schedule);
addEventListener('TrunkApplicationStarted',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
setTimeout(schedule,300);setTimeout(schedule,1000);
})();