(() => {
  'use strict';
  // Independent Flow implementation of a compact NEIS meal explorer.
  // No Haksi assets/scripts/endpoints are copied or requested.
  // Only fetch school data after the user opens the meal explorer.
  const PROFILE_KEY='flow-school-profile-v3';
  const API='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data';
  const CACHE_MS=10*60*1000;
  const cache=new Map();
  const weekdays=['월','화','수','목','금'];
  const kst=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
  });
  let host=null,explorer=null,toggle=null,current=null,view='week',month=null;
  let ticket=0,pending=false,loaded=null,queued=false;
  const el=(tag,cl,text)=>{
    const e=document.createElement(tag);if(cl)e.className=cl;
    if(text!==undefined)e.textContent=text;return e;
  };
  const pad=n=>String(n).padStart(2,'0');
  const keyOf=d=>d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate());
  const fromKey=s=>new Date(Date.UTC(Number(s.slice(0,4)),Number(s.slice(4,6))-1,Number(s.slice(6,8))));
  const monday=d=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()-(x.getUTCDay()+6)%7);return x;};
  const addDays=(d,count)=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()+count);return x;};
  const today=()=>{const p=Object.fromEntries(kst.formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return fromKey(p.year+p.month+p.day);};
  const validProfile=()=>{
    try{
      const p=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');
      if(!p||!p.school)return null;
      const s=p.school;
      if(!/^[A-Z0-9]{1,12}$/i.test(String(s.officeCode||'')))return null;
      if(!/^[A-Z0-9]{1,12}$/i.test(String(s.schoolCode||'')))return null;
      const grade=Number(p.grade);
      if(!Number.isInteger(grade)||grade<1||grade>6)return null;
      return {office:s.officeCode,school:s.schoolCode,kind:s.kind||'',
        grade,className:String(p.className||'1')};
    }catch(_){return null;}
  };
  function monthKey(d){return keyOf(d).slice(0,6);}
  function monthStart(d){return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1));}
  function shiftMonth(d,step){
    const day=d.getUTCDate();
    const next=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+step,1));
    const last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
    next.setUTCDate(Math.min(day,last));return next;
  }
  function normalizeMeals(value,forMonth,byDate){
    if(!value || !Array.isArray(value.meals))return;
    for(const meal of value.meals){
      if(!meal||!/^20\d{6}$/.test(String(meal.date||'')))continue;
      const date=String(meal.date);
      if(date.slice(0,6)!==forMonth || !Array.isArray(meal.dishes))continue;
      const prev=byDate.get(date);
      const lunch=String(meal.type||'').includes('중식');
      if(prev && !lunch)continue;
      byDate.set(date,{date,type:String(meal.type||'중식'),
        dishes:meal.dishes.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()),
        calories:String(meal.calories||'')});
    }
  }
  async function fetchSnapshot(profile,day){
    const params=new URLSearchParams({
      action:'dashboard',office:profile.office,school:profile.school,
      grade:String(profile.grade),class:profile.className,
      kind:profile.kind,date:keyOf(day)
    });
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const res=await fetch(API+'?'+params.toString(),{signal:controller.signal});
      if(!res.ok)throw Error('급식 요청 오류 ('+res.status+')');
      const json=await res.json();
      if(!json||!Array.isArray(json.meals))throw Error('급식 데이터 형식이 올바르지 않아요.');
      return json;
    }finally{clearTimeout(timeout);}
  }
  async function loadMeals(forDate,profile){
    const key=profile.office+':'+profile.school+':'+monthKey(forDate);
    const saved=cache.get(key);
    if(saved&&Date.now()-saved.time<CACHE_MS)return saved.meals;
    const first=monthStart(forDate),byDate=new Map();
    const initial=await fetchSnapshot(profile,first);
    normalizeMeals(initial,monthKey(forDate),byDate);
    const dates=[...byDate.keys()].sort();
    // A complete monthly result normally includes the first through last
    // school weeks. Otherwise request just one anchor per missing week.
    if(dates.length<11 || (dates.length&&Number(dates[dates.length-1].slice(6))<22)){
      const anchors=[8,15,22,29]
        .filter(day=>day<=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate())
        .map(day=>new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),day)));
      // At most two concurrent provider queries to avoid request storms.
      for(let i=0;i<anchors.length;i+=2){
        const settled=await Promise.allSettled(anchors.slice(i,i+2).map(d=>fetchSnapshot(profile,d)));
        for(const result of settled)if(result.status==='fulfilled')
          normalizeMeals(result.value,monthKey(forDate),byDate);
      }
    }
    cache.set(key,{time:Date.now(),meals:byDate});
    if(cache.size>8)cache.delete(cache.keys().next().value);
    return byDate;
  }
  function resetMonth(){current=today();month=monthStart(current);view='week';loaded=null;}
  function status(value,mode='info'){
    const node=explorer?.querySelector('.flow-meal-status');
    if(node){node.textContent=value;node.dataset.state=mode;}
  }
  function makeDay(day){
    const key=keyOf(day),meal=loaded?.get(key),isCurrent=key===keyOf(current);
    const button=el('button','flow-meal-day'+(isCurrent?' is-selected':''));button.type='button';
    button.setAttribute('aria-pressed',String(isCurrent));
    button.setAttribute('aria-label',pad(day.getUTCMonth()+1)+'월 '+day.getUTCDate()+'일 급식');
    const number=el('strong','flow-meal-date',String(day.getUTCDate()));
    const teaser=el('span','flow-meal-teaser');
    if(meal && meal.dishes.length){
      teaser.textContent=meal.dishes.slice(0,2).join(' · ');
      const count=meal.dishes.length-2;
      if(count>0)button.append(number,teaser,el('small','flow-meal-more','+'+count));
      else button.append(number,teaser);
    }else{
      teaser.textContent='—';
      button.classList.add('is-empty');
      button.append(number,teaser);
    }
    button.addEventListener('click',()=>{
      current=day;
      renderCalendar();
      renderDetails();
    });
    return button;
  }
  function setTabs(){
    for(const b of explorer?.querySelectorAll('.flow-meal-view button')||[]){
      const selected=b.dataset.view===view;
      b.classList.toggle('is-current',selected);
      b.setAttribute('aria-pressed',String(selected));
    }
  }
  function renderCalendar(){
    if(!explorer || !loaded)return;
    const grid=explorer.querySelector('.flow-meal-grid');
    grid.replaceChildren();
    const heading=explorer.querySelector('.flow-meal-range');
    const first=monthStart(current);
    month=first;
    const title=first.getUTCFullYear()+'년 '+(first.getUTCMonth()+1)+'월';
    heading.textContent=title+(view==='week'?' · 이번 주':'');
    explorer.querySelector('.flow-meal-grid-title').textContent=view==='month'?'월간 식단':'주간 식단';
    for(const name of weekdays)grid.append(el('span','flow-meal-weekday',name));
    if(view==='week'){
      const mondayDate=monday(current);
      for(let i=0;i<5;i++)grid.append(makeDay(addDays(mondayDate,i)));
    }else{
      const firstMonday=monday(first);
      const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0));
      const lastFriday=addDays(monday(last),4);
      let cells=0;
      for(let week=firstMonday;week<=lastFriday;week=addDays(week,7)){
        for(let i=0;i<5;i++){
          const day=addDays(week,i);
          if(day.getUTCMonth()===first.getUTCMonth())grid.append(makeDay(day));
          else grid.append(el('span','flow-meal-placeholder'));
          cells++;
        }
      }
    }
    setTabs();
  }
  function renderDetails(){
    if(!explorer||!loaded)return;
    const d=explorer.querySelector('.flow-meal-detail');
    d.replaceChildren();
    const key=keyOf(current),meal=loaded.get(key);
    const head=el('div','flow-meal-detail-top');
    head.append(el('strong','',current.getUTCMonth()+1+'월 '+current.getUTCDate()+'일'));
    if(meal?.calories)head.append(el('span','flow-meal-kcal',meal.calories));
    d.append(head);
    if(meal?.dishes?.length){
      const chips=el('div','flow-meal-detail-chips');
      for(const dish of meal.dishes)chips.append(el('span','flow-meal-detail-chip',dish));
      d.append(chips);
    }else{
      d.append(el('p','flow-meal-detail-empty','등록된 급식 메뉴가 없어요.'));
    }
  }
  async function refresh(){
    if(!explorer||!current)return;
    const id=++ticket,profile=validProfile();
    const grid=explorer.querySelector('.flow-meal-grid');
    const detail=explorer.querySelector('.flow-meal-detail');
    grid.replaceChildren();detail.replaceChildren();
    if(!profile){
      status('학교·학급 정보를 확인할 수 없어요. 설정에서 학교를 다시 선택해 주세요.','error');return;
    }
    explorer.classList.add('is-loading');
    status('급식표를 확인하고 있어요.');
    try{
      const meals=await loadMeals(current,profile);
      if(ticket!==id||!explorer?.isConnected)return;
      loaded=meals;
      status('','ready');
      renderCalendar();
      renderDetails();
    }catch(err){
      if(ticket!==id)return;
      loaded=null;
      status('급식 정보를 불러오지 못했어요. 다시 시도해 주세요.','error');
      const retry=el('button','flow-meal-retry','다시 시도');
      retry.type='button';retry.addEventListener('click',refresh);
      grid.append(retry);
    }finally{
      if(ticket===id)explorer?.classList.remove('is-loading');
    }
  }
  function change(delta){
    const next=view==='week'?addDays(current,7*delta):shiftMonth(current,delta);
    const oldMonth=monthKey(current);
    current=next;
    if(monthKey(next)!==oldMonth)refresh();
    else {renderCalendar();renderDetails();}
  }
  function openClose(){
    if(!explorer||!toggle)return;
    const show=explorer.hidden;
    explorer.hidden=!show;
    toggle.textContent=show?'접기 ↑':'급식표 보기 ↗';
    toggle.setAttribute('aria-expanded',String(show));
    if(show){resetMonth();refresh();}
    else ticket++;
  }
  function mount(){
    const next=document.querySelector('.scene[data-scene="today"] .meal-sheet');
    if(next===host&&explorer?.isConnected&&toggle?.isConnected)return;
    host=next;explorer=null;toggle=null;ticket++;
    if(!host)return;
    host.classList.add('flow-meal-compact');
    const top=host.querySelector('.aside-top');
    if(!top)return;
    toggle=el('button','flow-meal-toggle','급식표 보기 ↗');
    toggle.type='button';toggle.setAttribute('aria-expanded','false');
    toggle.addEventListener('click',openClose);
    top.append(toggle);
    explorer=el('div','flow-meal-explorer');
    explorer.hidden=true;
    explorer.id='flow-meal-explorer';
    toggle.setAttribute('aria-controls',explorer.id);
    const toolbar=el('div','flow-meal-tools');
    const heading=el('strong','flow-meal-grid-title','주간 식단');
    const switcher=el('div','flow-meal-view');
    for(const [key,label] of [['week','주간'],['month','월간']]){
      const b=el('button','',''+label);
      b.type='button';b.dataset.view=key;
      b.addEventListener('click',()=>{view=key;renderCalendar();renderDetails();});
      switcher.append(b);
    }
    toolbar.append(heading,switcher);
    const monthbar=el('div','flow-meal-monthbar');
    const left=el('button','flow-meal-arrow','‹');left.type='button';left.setAttribute('aria-label','이전 기간');
    left.addEventListener('click',()=>change(-1));
    const title=el('strong','flow-meal-range','');
    const right=el('button','flow-meal-arrow','›');right.type='button';right.setAttribute('aria-label','다음 기간');
    right.addEventListener('click',()=>change(1));
    monthbar.append(left,title,right);
    const grid=el('div','flow-meal-grid');
    grid.setAttribute('role','group');grid.setAttribute('aria-label','날짜별 급식 메뉴');
    const detail=el('div','flow-meal-detail');
    const foot=el('p','flow-meal-source','학교 급식정보(NEIS 기반) · 메뉴는 변경될 수 있어요.');
    const progress=el('p','flow-meal-status','');progress.setAttribute('role','status');
    explorer.append(toolbar,monthbar,progress,grid,detail,foot);
    host.append(explorer);
  }
  const observer=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;mount();});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',mount);
  mount();
})();