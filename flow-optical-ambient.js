(()=>{
  if(window.__flowOpticalAmbientInstalled)return;
  window.__flowOpticalAmbientInstalled=true;

  /*
   * Compatibility entry point for retired ambient glass.
   *
   * The former floating "dynamic glass" object remains fully retired. Keep this
   * entry point for cached refraction bundles, and use only a bounded post-scroll
   * geometry tail so the real Optical copy cannot retain a one-frame stale scene
   * position after rapid direction reversals. No persistent animation loop runs.
   */
  try{localStorage.removeItem('flow-optical-jelly-v1')}catch{}
  const root=document.documentElement;
  root.removeAttribute('data-flow-optical-jelly');
  document.querySelectorAll('.flow-optical-jelly,[data-flow-jelly-setting]').forEach(node=>node.remove());

  const INSET=5;
  let tailTimers=[];
  const visible=node=>{if(!node)return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
  function syncRefractionScene(){
    if(root.dataset.flowGlassMode!=='optical'||root.dataset.flowGlassRefraction!=='true')return;
    const nav=[...document.querySelectorAll('.mobile-bottom-nav,.bottom-nav')].find(visible);if(!nav)return;
    let source=null;
    if(nav.classList.contains('mobile-bottom-nav')){
      const dedicated=document.querySelector('#switchDialog[open][data-flow-dedicated="true"]');
      source=dedicated&&visible(dedicated)?dedicated:document.querySelector('.product-main');
    }else source=document.querySelector('.main');
    if(!source||!visible(source))return;
    const navRect=nav.getBoundingClientRect(),sourceRect=source.getBoundingClientRect(),dedicated=source.matches?.('#switchDialog[open][data-flow-dedicated="true"]'),localScrollLeft=dedicated?source.scrollLeft:0,localScrollTop=dedicated?source.scrollTop:0;
    nav.style.setProperty('--flow-refraction-scene-left',`${(sourceRect.left-localScrollLeft-(navRect.left+INSET)).toFixed(2)}px`);
    nav.style.setProperty('--flow-refraction-scene-top',`${(sourceRect.top-localScrollTop-(navRect.top+INSET)).toFixed(2)}px`);
  }
  function postScrollSync(){
    tailTimers.forEach(clearTimeout);tailTimers=[];
    syncRefractionScene();
    tailTimers=[0,12,24].map(delay=>setTimeout(syncRefractionScene,delay));
  }
  window.addEventListener('scroll',postScrollSync,{passive:true,capture:true});
  window.visualViewport?.addEventListener('scroll',postScrollSync,{passive:true});
})();
