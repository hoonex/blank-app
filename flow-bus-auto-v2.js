(() => {
  'use strict';
  // Keep native Rust state authoritative. Map is an explicit secondary action.
  let queued=false,visibleStop='',lastRefreshAt=0,reveal=null;
  const findScene=()=>document.querySelector('.scene[data-scene="school"]');
  function reconcile(){
    // School info must not mount a bus map until the separate Bus tab is active.
    if(document.querySelector('.flow-shell')?.dataset.flowSection!=='bus')return;
    const scene=findScene();
    if(!scene){visibleStop='';return;}
    const selected=scene.querySelector('.bus-selected');
    const toggle=selected?.querySelector('.bus-map-toggle');
    if(!selected||!toggle)return; // A map needs an actual stop.
    const stopName=selected.querySelector('.bus-stop-name strong')?.textContent?.trim()||'';
    const stopNumber=selected.querySelector('.bus-stop-name span')?.textContent?.trim()||'';
    const stopKey=stopName+'|'+stopNumber;
    if(!stopName)return;
    if(stopKey!==visibleStop){
      visibleStop=stopKey;
      lastRefreshAt=Date.now();
    }
    const panel=selected.querySelector('#flow-bus-map');
    // Leptos boolean attributes may be empty strings. ARIA requires a value.
    const expanded=String(!!panel);
    if(toggle.getAttribute('aria-expanded')!==expanded)toggle.setAttribute('aria-expanded',expanded);
    if(panel){
      panel.classList.add('flow-bus-map-auto');
      const heading=panel.querySelector('.bus-map-heading');
      if(heading&&!heading.querySelector('.flow-map-dismiss')){
        const close=document.createElement('button');close.type='button';
        close.className='flow-map-dismiss';close.textContent='지도 닫기';
        close.addEventListener('click',()=>{
          const native=panel.closest('.bus-selected')?.querySelector('.bus-map-toggle');
          native?.click();native?.focus();
        });
        heading.append(close);
      }
      const subtitle=panel.querySelector('.bus-map-heading small');
      if(subtitle&&subtitle.textContent!=='정류장 위치 · 실제 버스 위치 아님'){
        subtitle.textContent='정류장 위치 · 실제 버스 위치 아님';
      }
      // The map follows arrival rows. Explicitly revealing it must also bring
      // it into view, including when many routes precede it.
      if(reveal===toggle){
        reveal=null;
        if(heading){
          heading.tabIndex=-1;heading.focus({preventScroll:true});
          heading.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
        }
      }
    }
  }
  const observer=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;reconcile();});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,
    attributeFilter:['aria-expanded']});
  document.addEventListener('click',event=>{
    const toggle=event.target.closest?.('.bus-map-toggle');
    if(!toggle||document.querySelector('.flow-shell')?.dataset.flowSection!=='bus')return;
    reveal=toggle.closest('.bus-selected')?.querySelector('#flow-bus-map')?null:toggle;
  },true);
  addEventListener('pageshow',reconcile);
  addEventListener('flow:section',reconcile);
  addEventListener('visibilitychange',()=>{if(!document.hidden){lastRefreshAt=Date.now();reconcile();}});
  // While the student is actually viewing the school tab, keep arrival data
  // current without wasting requests in background/other tabs.
  setInterval(()=>{
    if(document.hidden||document.querySelector('.flow-shell')?.dataset.flowSection!=='bus')return;
    const scene=findScene();
    const selected=scene?.querySelector('.bus-selected');
    if(!selected)return;
    if(Date.now()-lastRefreshAt<45000)return;
    const refresh=selected.querySelector('.bus-refresh');
    if(!refresh||refresh.disabled)return;
    lastRefreshAt=Date.now();
    refresh.click();
  },15000);
  reconcile();
})();
