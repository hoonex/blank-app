(()=>{
  if(window.__flowOpticalAmbientInstalled)return;
  window.__flowOpticalAmbientInstalled=true;

  /*
   * Compatibility entry point only.
   *
   * The former floating "dynamic glass" object was a CSS blur blob driven by
   * pointer/device-orientation input. It was visually separate from Flow's real
   * Optical Glass refraction and behaved inconsistently on mobile, so the
   * product surface is intentionally retired. Keep this tiny entry point while
   * older cached refraction bundles may still request it.
   */
  try{localStorage.removeItem('flow-optical-jelly-v1')}catch{}
  document.documentElement.removeAttribute('data-flow-optical-jelly');
  document.querySelectorAll('.flow-optical-jelly,[data-flow-jelly-setting]').forEach(node=>node.remove());
})();
