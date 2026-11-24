(() => {
  'use strict';
  // Keep the native Rust state authoritative. Auto-activate its existing
  // map toggle for a selected stop; never create a duplicate Kakao instance.
  const opened=new WeakSet();
  let queued=false,visibleStop='',lastRefreshAt=0;
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
    // A React/Leptos click changes map_open and mounts the exact supported
    // map canvas; only then the existing flowBusMapOpen call loads the SDK.
    if(toggle.getAttribute('aria-expanded')!=='true'&&!opened.has(toggle)){
      opened.add(toggle);
      toggle.click();
      return;
    }
    const panel=selected.querySelector('#flow-bus-map');
    if(panel){
      panel.classList.add('flow-bus-map-auto');
      const subtitle=panel.querySelector('.bus-map-heading small');
      if(subtitle&&subtitle.textContent!=='정류장 위치 · 실제 버스 위치 아님'){
        subtitle.textContent='정류장 위치 · 실제 버스 위치 아님';
      }
      // The map is always visible after selecting a stop, but the selected
      // coordinates still come from BIS, never inferred from the stop name.
    }
  }
  const observer=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;reconcile();});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,
    attributeFilter:['aria-expanded']});
  addEventListener('pageshow',reconcile);
  addEventListener('flow:section',reconcile);
  addEventListener('visibilitychange',()=>{if(!document.hidden){lastRefreshAt=Date.now();reconcile();}});
  // While the student is actually viewing the school tab, keep arrival data
  // current without wasting requests in background/other tabs.
  setInterval(()=>{
    if(document.hidden||document.querySelector('.flow-shell')?.dataset.flowSection!=='bus')return;
    const scene=findScene();
    const selected=scene?.querySelector('.bus-selected');
    if(!selected||!selected.querySelector('#flow-bus-map-canvas'))return;
    if(Date.now()-lastRefreshAt<45000)return;
    const refresh=selected.querySelector('.bus-refresh');
    if(!refresh||refresh.disabled)return;
    lastRefreshAt=Date.now();
    refresh.click();
  },15000);
  reconcile();
})();