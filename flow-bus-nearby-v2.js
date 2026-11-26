(() => {
  'use strict';
  // Daegu public coordinates: locally compute proximity; GPS never sent to server.
  // Resolve IDs against the existing BIS search bridge before suggesting a stop.
  const DATA='/flow-v2/frontend-rust/dist/bus-stop-coords.json';
  const FAVORITE='flow-daegu-favorite-stop-v1';
  const MAX_DISTANCE=5000;
  const R=6371000;
  let datasetPromise=null,scene=null,card=null,run=0,loading=false;
  let currentCandidates=[],anchor=null,pendingChoice=false;
  const round=n=>Math.round(n);
  function dist(a,b,c,d){
    const x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180;
    const h=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function saved(){
    try{
      const s=JSON.parse(localStorage.getItem(FAVORITE)||'null');
      return s&&Number.isFinite(s.lat)&&Number.isFinite(s.lng)?s:null;
    }catch(_){return null;}
  }
  function dataset(){
    if(!datasetPromise){
      datasetPromise=fetch(DATA,{cache:'force-cache'}).then(r=>{
        if(!r.ok)throw Error('정류장 데이터 연결 실패');
        return r.json();
      }).then(d=>{
        if(!Array.isArray(d.stops))throw Error('정류장 데이터 형식 오류');
        return d.stops.filter(x=>Array.isArray(x)&&typeof x[0]==='string'&&
          Number.isFinite(x[1])&&Number.isFinite(x[2]));
      }).catch(err=>{datasetPromise=null;throw err;});
    }
    return datasetPromise;
  }
  function text(tag,cl,label){
    const e=document.createElement(tag);
    if(cl)e.className=cl;
    if(label!==undefined)e.textContent=label;
    return e;
  }
  function makeUI(host){
    const section=text('section','flow-nearby-stops');
    section.setAttribute('aria-label','주변 버스 정류장 빠른 선택');
    const heading=text('div','flow-nearby-heading');
    const headingCopy=text('div','flow-nearby-title');
    headingCopy.append(text('strong','','근처 정류장'),text('small','flow-nearby-description','내 위치 또는 선택한 정류장 주변'));
    const refresh=text('button','flow-nearby-locate','내 위치로 찾기');
    refresh.type='button';
    refresh.addEventListener('click',locate);
    heading.append(headingCopy,refresh);
    const status=text('p','flow-nearby-status','');
    status.setAttribute('role','status');
    const list=text('div','flow-nearby-list');
    list.setAttribute('aria-label','가까운 정류장 3곳');
    const help=text('p','flow-nearby-footnote','거리 = 직선거리 · 대구시 정류장 데이터');
    section.append(heading,status,list,help);
    const search=host.querySelector('.bus-search');
    if(search)search.after(section);
    else host.append(section);
    card=section;
    return section;
  }
  function setStatus(message,mode){
    const el=card?.querySelector('.flow-nearby-status');
    if(!el)return;
    el.textContent=message;
    el.dataset.state=mode||'info';
    card.classList.toggle('flow-nearby-loading',mode==='loading');
  }
  function render(stops,source){
    if(!card?.isConnected)return;
    const list=card.querySelector('.flow-nearby-list');
    list.replaceChildren();
    const description=card.querySelector('.flow-nearby-description');
    description.textContent=(source==='gps'?'내 위치 기준':'선택한 정류장 기준')+' · 가까운 3곳';
    setStatus(stops.length?'':'현재 가까운 정류장을 찾지 못했어요.',stops.length?'ready':'error');
    card.classList.toggle('flow-nearby-ready',stops.length>0);
    const selectedName=scene?.querySelector('.bus-selected .bus-stop-name strong')?.textContent?.trim();
    const selectedNumber=scene?.querySelector('.bus-selected .bus-stop-name span')?.textContent?.replace(/[^0-9]/g,'');
    for(const [i,stop] of stops.entries()){
      const button=text('button','flow-nearby-stop');
      button.type='button';button.dataset.stopId=stop.id;
      const chosen=stop.name===selectedName&&stop.number===selectedNumber;
      if(chosen)button.classList.add('is-selected');
      const index=text('span','flow-nearby-rank',String(i+1).padStart(2,'0'));
      const label=text('span','flow-nearby-stop-label');
      label.append(text('strong','',stop.name),text('small','',stop.number?'정류장 '+stop.number:'대구 버스 정류장'));
      const distance=text('span','flow-nearby-distance',stop.m<1000?round(stop.m)+'m':(stop.m/1000).toFixed(1)+'km');
      const chevron=text('span','flow-nearby-arrow');chevron.setAttribute('aria-hidden','true');
      chevron.append(FlowActionIcons.create('chevron-right'));
      button.append(index,label,distance,chevron);
      button.setAttribute('aria-label',stop.name+', 직선거리 '+distance.textContent+', 선택하기');
      button.addEventListener('click',()=>choose(stop,button));
      list.append(button);
    }
  }
  function nearRecords(rows,lat,lng){
    const found=rows.map(x=>({name:x[0],lat:x[1],lng:x[2],d:dist(lat,lng,x[1],x[2])}))
      .filter(x=>x.d<=MAX_DISTANCE).sort((a,b)=>a.d-b.d);
    const unique=[],names=new Map();
    for(const entry of found){
      // Identically named stops across opposite street directions remain separate candidates.
      const points=names.get(entry.name)||[];
      if(points.some(p=>dist(p.lat,p.lng,entry.lat,entry.lng)<20))continue;
      points.push(entry);names.set(entry.name,points);unique.push(entry);
      if(unique.length>=22)break;
    }
    return unique;
  }
  async function lookupNames(records,lat,lng,signal){
    const names=[...new Set(records.map(x=>x.name))].slice(0,14);
    const valid=new Map();
    for(let i=0;i<names.length;i+=5){
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');
      const group=names.slice(i,i+5);
      const result=await Promise.all(group.map(async name=>{
        try{
          const response=await fetch('/api/bus/search?q='+encodeURIComponent(name),{signal});
          if(!response.ok)return[];
          const body=await response.json();
          return body.ok&&Array.isArray(body.stops)?body.stops:[];
        }catch(e){
          if(e.name==='AbortError')throw e;
          return[];
        }
      }));
      for(const stops of result){
        for(const s of stops){
          if(!/^\d{10}$/.test(s.id||'')||!Number.isFinite(s.lat)||!Number.isFinite(s.lng))continue;
          // Match official coordinate dataset to the actual current BIS stop.
          if(!records.some(p=>p.name===s.name&&dist(p.lat,p.lng,s.lat,s.lng)<180))continue;
          const meters=dist(lat,lng,s.lat,s.lng);
          if(meters<=MAX_DISTANCE)valid.set(s.id,{...s,m:meters});
        }
      }
      if(valid.size>=3)break;
    }
    return [...valid.values()].sort((a,b)=>a.m-b.m).slice(0,3);
  }
  async function populate(loc,source){
    const token=++run;
    anchor={lat:loc.lat,lng:loc.lng,source};
    card?.classList.remove('flow-nearby-ready');
    setStatus('주변 정류장을 확인하는 중…','loading');
    const list=card?.querySelector('.flow-nearby-list');
    list?.replaceChildren();
    try{
      const rows=await dataset();
      if(run!==token||!card?.isConnected)return;
      const nearest=nearRecords(rows,loc.lat,loc.lng);
      if(!nearest.length){
        currentCandidates=[];render([],source);
        setStatus('대구 시내버스 정류장 자료 범위 밖이에요. 직접 검색해 주세요.','error');
        return;
      }
      const controller=new AbortController();
      // Do not permit stale results to overwrite a different nearby anchor.
      const stops=await lookupNames(nearest,loc.lat,loc.lng,controller.signal);
      if(run!==token||!card?.isConnected)return;
      currentCandidates=stops;
      render(stops,source);
      if(!stops.length)setStatus('정류장 확인에 실패했어요. 이름 검색을 이용해 주세요.','error');
    }catch(e){
      if(run!==token)return;
      currentCandidates=[];
      setStatus('정류장 정보를 불러오지 못했어요. 다시 시도해 주세요.','error');
    }
  }
  function locate(){
    if(!card||loading)return;
    if(!navigator.geolocation){
      setStatus('이 브라우저에서 위치 기능을 사용할 수 없어요. 정류장 이름을 검색해 주세요.','error');return;
    }
    loading=true;
    const button=card.querySelector('.flow-nearby-locate');
    if(button){button.disabled=true;button.textContent='위치 확인 중';}
    setStatus('위치 권한을 확인하는 중…','loading');
    navigator.geolocation.getCurrentPosition(pos=>{
      loading=false;
      if(button){button.disabled=false;button.textContent='내 위치로 찾기';}
      if(!card?.isConnected)return;
      populate({lat:pos.coords.latitude,lng:pos.coords.longitude},'gps');
    },err=>{
      loading=false;
      if(button){button.disabled=false;button.textContent='내 위치로 찾기';}
      const old=saved();
      if(old){populate(old,'saved');return;}
      const denied=err.code===1;
      setStatus(denied?'위치 접근이 거부됐어요. 브라우저 권한을 허용하거나 정류장을 검색해 주세요.':
        '현재 위치를 확인하지 못했어요. 다시 시도하거나 정류장을 검색해 주세요.','error');
    },{enableHighAccuracy:false,timeout:8500,maximumAge:120000});
  }
  function nativeValue(input,value){
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    if(setter)setter.call(input,value);else input.value=value;
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  async function choose(stop,button){
    if(pendingChoice||!scene?.isConnected)return;
    const form=scene.querySelector('.bus-search'),input=form?.querySelector('#bus-stop-query');
    if(!input||!form){setStatus('정류장 검색을 사용할 수 없어요.','error');return;}
    pendingChoice=true;
    button.disabled=true;
    setStatus(stop.name+' 선택 중…','loading');
    nativeValue(input,stop.name);
    const searchButton=form.querySelector('button[type="submit"]');
    if(searchButton)searchButton.click();
    else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    const started=Date.now();
    const finish=(success)=>{
      pendingChoice=false;
      button.disabled=false;
      if(success){
        setStatus('','ready');
        card.querySelectorAll('.flow-nearby-stop').forEach(b=>b.classList.toggle('is-selected',b.dataset.stopId===stop.id));
      }else{
        setStatus('해당 정류장을 선택하지 못했어요. 아래 검색 결과에서 직접 선택해 주세요.','error');
      }
    };
    const poll=()=>{
      if(!scene?.isConnected){finish(false);return;}
      const results=[...scene.querySelectorAll('.bus-results .bus-stop-option')];
      const match=results.find(b=>
        b.querySelector('strong')?.textContent.trim()===stop.name&&
        b.querySelector('span')?.textContent.replace(/[^0-9]/g,'')===stop.number);
      if(match){match.click();finish(true);return;}
      if(Date.now()-started>9500){finish(false);return;}
      setTimeout(poll,100);
    };
    poll();
  }
  function activate(next){
    if(document.querySelector('.flow-shell')?.dataset.flowSection!=='bus')return;
    if(scene===next&&card?.isConnected)return;
    scene=next;card=null;run++;
    if(!scene)return;
    const panel=scene.querySelector('.bus-panel');
    if(!panel)return;
    makeUI(panel);
    const stop=saved();
    if(stop)populate(stop,'saved');
    // Never open a geolocation permission prompt without a user gesture.
    navigator.permissions?.query({name:'geolocation'}).then(result=>{
      if(result.state==='granted'&&scene===next)locate();
    }).catch(()=>{});
  }
  let queued=false;
  const observe=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      activate(document.querySelector('.scene[data-scene="school"]'));
    });
  });
  observe.observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('pageshow',()=>activate(document.querySelector('.scene[data-scene="school"]')));
  addEventListener('flow:section',()=>activate(document.querySelector('.scene[data-scene="school"]')));
  activate(document.querySelector('.scene[data-scene="school"]'));
})();
