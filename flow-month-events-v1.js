(() => {
  'use strict';
  // Uses the exact dashboard API and profile schema already used by Flow's Rust client.
  // Do not infer complete monthly events from calendar dots / truncated day previews.
  const ENDPOINT='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data';
  const PROFILE_KEY='flow-school-profile-v3';
  const WEEK=['일','월','화','수','목','금','토'];
  const cache=new Map();
  let scene=null,host=null,title=null,monthObserver=null,controller=null,activeKey='',scheduled=false;
  const pad=n=>String(n).padStart(2,'0');
  function parseMonth(){
    const txt=title?.textContent||'';
    const m=txt.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/);
    if(!m)return null;
    const year=Number(m[1]),month=Number(m[2]);
    return year>=2000&&year<2100&&month>0&&month<13?{year,month,key:String(year)+pad(month)}:null;
  }
  function profile(){
    try {
      const raw=localStorage.getItem(PROFILE_KEY);
      if(!raw)return null;
      const p=JSON.parse(raw);
      if(!p||!p.school||!p.school.officeCode||!p.school.schoolCode)return null;
      return p;
    }catch(_){return null;}
  }
  function create(tag,className,content){
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(content!==undefined)element.textContent=String(content);
    return element;
  }
  function formatLabel(date){
    const y=Number(date.slice(0,4)),m=Number(date.slice(4,6)),d=Number(date.slice(6,8));
    const parsed=new Date(y,m-1,d);
    const valid=parsed.getFullYear()===y&&parsed.getMonth()===m-1&&parsed.getDate()===d;
    return valid?{day:d,week:WEEK[parsed.getDay()]}:null;
  }
  function ensureHost(root){
    let panel=root.querySelector(':scope > .flow-month-events');
    if(!panel){
      panel=create('section','flow-month-events');
      panel.setAttribute('aria-label','이번 달 전체 학사일정');
      const top=create('div','flow-month-events-head');
      const copy=create('div','flow-month-events-heading');
      copy.append(create('span','flow-month-events-eyebrow','학사일정'),create('h3','','이번 달 일정'));
      const count=create('span','flow-month-events-count','');
      top.append(copy,count);
      const content=create('div','flow-month-events-body');
      content.setAttribute('aria-live','polite');
      panel.append(top,content);
      root.appendChild(panel);
    }
    return panel;
  }
  function message(text,secondary){
    const body=host.querySelector('.flow-month-events-body');
    body.replaceChildren();
    const box=create('p','flow-month-events-message',text);
    body.appendChild(box);
    if(secondary)body.appendChild(create('p','flow-month-events-footnote',secondary));
  }
  function fill(items,month,partial=false){
    if(!host||!host.isConnected)return;
    const count=host.querySelector('.flow-month-events-count');
    count.textContent=partial?'일부 표시':items.length+'건';
    const body=host.querySelector('.flow-month-events-body');
    body.replaceChildren();
    if(!items.length){
      message(partial?'달력에서 확인할 수 있는 일정이 없어요.':'이번 달에 등록된 학사일정이 없어요.',
        partial?'학사일정 연결을 확인한 뒤 다시 표시합니다.':null);
      return;
    }
    const list=create('div','flow-month-events-list');
    const sorted=[...items].sort((a,b)=>a.date.localeCompare(b.date));
    for(const item of sorted){
      const when=formatLabel(item.date);
      if(!when)continue;
      const row=create('button','flow-month-event');
      row.type='button';
      row.dataset.day=String(when.day);
      row.setAttribute('aria-label',month.month+'월 '+when.day+'일 '+when.week+'요일, '+item.name);
      const date=create('span','flow-month-event-date');
      date.append(create('strong','',pad(when.day)),create('small','',when.week));
      const name=create('span','flow-month-event-name',item.name);
      const arrow=create('span','flow-month-event-arrow','›');
      arrow.setAttribute('aria-hidden','true');
      row.append(date,name,arrow);
      row.addEventListener('click',()=>{
        const current=parseMonth();
        if(!current||current.key!==month.key)return;
        const cell=[...scene.querySelectorAll('.calendar-sheet .calendar-grid button:not(.out-month)')]
          .find(btn=>Number(btn.querySelector('.calendar-num')?.textContent)===when.day);
        cell?.click(); // Original Leptos date selector, preserving event details.
      });
      list.appendChild(row);
    }
    body.appendChild(list);
    if(partial)body.appendChild(create('p','flow-month-events-footnote',
      '전체 일정 데이터를 불러오지 못해 달력에 표시된 첫 번째 일정만 보여줍니다.'));
  }
  function fallback(month){
    // Never claim this is the full list: the Rust calendar truncates multiple
    // events on one day to the first title plus '+N'.
    const out=[];
    for(const cell of scene?.querySelectorAll('.calendar-sheet .calendar-grid button:not(.out-month)')||[]){
      const number=Number(cell.querySelector('.calendar-num')?.textContent);
      const name=cell.querySelector('.calendar-event-text')?.textContent.trim();
      if(name&&number>=1&&number<=31)
        out.push({date:month.key+pad(number),name});
    }
    fill(out,month,true);
  }
  async function load(month){
    if(!scene||!host)return;
    const p=profile();
    if(!p){host.querySelector('.flow-month-events-count').textContent='';message('학교 정보를 불러올 수 없어요.');return;}
    const cacheKey=[p.school.officeCode,p.school.schoolCode,p.grade,p.className,month.key].join('/');
    const saved=cache.get(cacheKey);
    if(saved&&Date.now()-saved.at<300000){fill(saved.events,month);return;}
    host.querySelector('.flow-month-events-count').textContent='';
    message('이번 달 일정을 불러오는 중…');
    controller?.abort();
    const own=new AbortController();controller=own;
    try{
      const params=new URLSearchParams({
        action:'dashboard',
        office:String(p.school.officeCode),
        school:String(p.school.schoolCode),
        grade:String(p.grade||1),
        class:String(p.className||''),
        kind:String(p.school.kind||''),
        date:month.key+'15'
      });
      const response=await fetch(ENDPOINT+'?'+params.toString(),{signal:own.signal,headers:{Accept:'application/json'}});
      if(!response.ok)throw Error('HTTP '+response.status);
      const json=await response.json();
      if(!Array.isArray(json?.events))throw Error('Invalid event response');
      const grade=Number(p.grade)||1;
      const events=json.events.filter(event=>{
        if(!event||typeof event.name!=='string'||!/^\d{8}$/.test(event.date||''))return false;
        if(!event.date.startsWith(month.key))return false;
        if(grade===1&&event.grade1==='N')return false;
        if(grade===2&&event.grade2==='N')return false;
        if(grade===3&&event.grade3==='N')return false;
        return !!event.name.trim();
      }).map(event=>({date:event.date,name:event.name.trim()}));
      if(own.signal.aborted||activeKey!==cacheKey||!scene?.isConnected)return;
      cache.set(cacheKey,{at:Date.now(),events});
      fill(events,month);
    }catch(err){
      if(own.signal.aborted)return;
      if(activeKey===cacheKey&&scene?.isConnected)fallback(month);
    }
  }
  function update(force=false){
    if(!scene?.isConnected||!host?.isConnected)return;
    const month=parseMonth(),p=profile();
    if(!month||!p)return;
    const nextKey=[p.school.officeCode,p.school.schoolCode,p.grade,p.className,month.key].join('/');
    if(!force&&nextKey===activeKey)return;
    activeKey=nextKey;
    controller?.abort();
    load(month);
  }
  function disconnect(){
    monthObserver?.disconnect();monthObserver=null;
    controller?.abort();controller=null;
    scene=null;host=null;title=null;activeKey='';
  }
  function reconcile(){
    const nextScene=document.querySelector('.scene[data-scene="calendar"]');
    if(!nextScene){if(scene)disconnect();return;}
    if(nextScene===scene)return;
    disconnect();
    scene=nextScene;
    const layout=scene.querySelector('.calendar-layout');
    title=scene.querySelector('.calendar-toolbar h2');
    if(!layout||!title)return;
    host=ensureHost(layout);
    monthObserver=new MutationObserver(()=>update());
    monthObserver.observe(title,{childList:true,subtree:true,characterData:true});
    update(true);
  }
  new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;reconcile();});
  }).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('pageshow',reconcile);
  reconcile();
})();