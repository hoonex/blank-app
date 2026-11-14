(() => {
  'use strict';
  // Reuse the ONE approved AdFit unit already mounted by Flow's Rust app.
  // Never clone <ins>, invent an ad unit, or intercept the provider SDK.
  let scheduled=false;
  let lastSlot=null;
  let hideTimer=null;
  const sdkRequested=new WeakSet();
  function place() {
    const shell=document.querySelector('.flow-shell');
    if(!shell)return;
    const header=shell.querySelector(':scope > .global-header');
    const slot=shell.querySelector('.flow-adfit-native');
    if(!header||!slot)return;
    const unit=slot.querySelector('ins.kakao_ad_area[data-ad-unit]');
    if(!unit)return;
    // Keep the provider's original live node and all of its attributes.
    const brand=header.querySelector('.brand-wrap');
    if(brand)brand.remove();
    header.classList.add('flow-ad-header');
    if(slot.parentElement!==header)header.appendChild(slot);
    if(lastSlot!==slot){
      if(hideTimer)clearTimeout(hideTimer);
      lastSlot=slot;
      slot.dataset.flowAdState='loading';
      hideTimer=setTimeout(()=>{
        hideTimer=null;
        if(!slot.isConnected)return;
        if(!slot.querySelector('iframe'))slot.dataset.flowAdState='empty';
      },7000);
    }
    if(slot.querySelector('iframe'))slot.dataset.flowAdState='filled';
    // The Rust effect can fire before <ins> exists; retry only after it exists.
    if(!sdkRequested.has(slot)&&typeof window.flowAdfitStart==='function'){
      sdkRequested.add(slot);
      window.flowAdfitStart();
    }
  }
  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;place();});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('pageshow',place);
  place();
})();