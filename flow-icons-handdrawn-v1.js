(() => {
  'use strict';
  /*
   * FLOW ICON SYSTEM — hand-drawn vectors on a common 24 × 24 grid.
   * Not an icon font, no third-party assets, no new network requests.
   *
   * Keep the original button text: Rust + flow-five-tabs-stable-v2.js
   * identify destinations using button.textContent.trim().
   */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const designs = Object.freeze({
    '오늘': [
      ['path', {d:'M3.8 10.6 12 4.1l8.2 6.5'}],
      ['path', {d:'M5.3 10v8.5c0 1 .7 1.7 1.7 1.7h10c1 0 1.7-.7 1.7-1.7V10'}],
      ['path', {d:'M9 20.2v-6h4.2v6'}],
      ['circle', {cx:'16.2',cy:'15',r:'1.6',fill:'currentColor',stroke:'none'}]
    ],
    '일정': [
      ['rect', {x:'4.2',y:'5.5',width:'15.6',height:'14.5',rx:'2.6'}],
      ['path', {d:'M8 3.7v3.7M16 3.7v3.7M4.2 10.2h15.6'}],
      ['rect', {x:'7.8',y:'13.1',width:'3.7',height:'3.7',rx:'1',fill:'currentColor',stroke:'none'}],
      ['path', {d:'M14.1 14.8h2.6'}]
    ],
    '학교': [
      ['path', {d:'M3.4 10.3 12 4.8l8.6 5.5'}],
      ['path', {d:'M5.1 10.3v9.4h13.8v-9.4'}],
      ['path', {d:'M3.9 19.7h16.2M9.8 19.7v-5.3h4.4v5.3'}],
      ['rect', {x:'7.5',y:'11.6',width:'1.7',height:'1.9',rx:'.45',fill:'currentColor',stroke:'none'}],
      ['rect', {x:'14.8',y:'11.6',width:'1.7',height:'1.9',rx:'.45',fill:'currentColor',stroke:'none'}]
    ],
    '버스': [
      ['rect', {x:'5',y:'3.7',width:'14',height:'15',rx:'3.2'}],
      ['path', {d:'M5.1 11.1h13.8M8 18.6v2M16 18.6v2'}],
      ['path', {d:'M8.1 14.7h2.1M13.8 14.7h2.1'}],
      ['path', {d:'M9.2 6.5h5.6'}]
    ],
    '설정': [
      ['path', {d:'M4.1 6.8h15.8M4.1 12h15.8M4.1 17.2h15.8'}],
      ['circle', {cx:'9.4',cy:'6.8',r:'2.1',fill:'var(--flow-control-surface, #f4f3ee)'}],
      ['circle', {cx:'15.1',cy:'12',r:'2.1',fill:'var(--flow-control-surface, #f4f3ee)'}],
      ['circle', {cx:'8.4',cy:'17.2',r:'2.1',fill:'var(--flow-control-surface, #f4f3ee)'}]
    ]
  });
  function vector(label) {
    const svg=document.createElementNS(SVG_NS,'svg');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('class','flow-nav-symbol');
    svg.setAttribute('width','24');
    svg.setAttribute('height','24');
    svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','1.85');
    svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round');
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('focusable','false');
    svg.setAttribute('data-flow-symbol',label);
    for(const [kind,attributes] of designs[label]){
      const element=document.createElementNS(SVG_NS,kind);
      for(const [name,value] of Object.entries(attributes))element.setAttribute(name,value);
      svg.append(element);
    }
    return svg;
  }
  // Flow action icons use the same 24-unit grid, stroke and rounded joints
  // as the existing navigation icons. Never use font glyphs as UI controls.
  const actionPaths=Object.freeze({
    'calendar':'M4.5 9.5h15M8 3.5v3M16 3.5v3M6.5 5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8.5 13h2M13.5 13h2M8.5 16.5h2',
    'chevron-left':'M14.5 5.5 8 12l6.5 6.5',
    'chevron-right':'M9.5 5.5 16 12l-6.5 6.5',
    'external-link':'M13.5 5h5.5v5.5M19 5l-9.5 9.5M19 13.5V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4.5'
  });
  function action(name){
    if(!Object.hasOwn(actionPaths,name))throw new Error('Unknown Flow action icon: '+name);
    const svg=document.createElementNS(SVG_NS,'svg');
    svg.setAttribute('class','flow-action-icon');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('width','20');
    svg.setAttribute('height','20');
    svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','2');
    svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round');
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('focusable','false');
    svg.setAttribute('data-flow-action',name);
    const path=document.createElementNS(SVG_NS,'path');
    path.setAttribute('d',actionPaths[name]);
    svg.append(path);
    return svg;
  }
  // Loaded before feature scripts. The helper makes icons reusable and
  // avoids independent, visually mismatched arrows in each UI feature.
  window.FlowActionIcons=Object.freeze({create:action});
  function upgradeSettingsActions(){
    for(const el of document.querySelectorAll('.flow-shell .settings-sheet .setting-toggle')){
      if(el.dataset.flowIconDone==='true')continue;
      const label=el.textContent.trim();
      if(!label.endsWith('↗'))continue;
      const copy=label.slice(0,-1).trim();
      if(!copy)continue;
      el.replaceChildren(document.createTextNode(copy),action(copy==='다시 선택'?'chevron-right':'external-link'));
      el.dataset.flowIconDone='true';
      if(el.tagName==='A'&&el.target==='_blank'&&!el.getAttribute('aria-label'))el.setAttribute('aria-label',copy+' 새 탭에서 열기');
    }
  }
  const targets=['.flow-shell .mobile-bottom','.flow-shell .rail-navigation'];
  function apply() {
    for(const selector of targets){
      const nav=document.querySelector(selector);
      if(!nav)continue;
      nav.classList.add('flow-icons-ready');
      for(const button of nav.querySelectorAll(':scope > button')){
        const label=button.textContent.trim();
        if(!Object.prototype.hasOwnProperty.call(designs,label))continue;
        const existing=button.querySelector(':scope > .flow-nav-symbol');
        if(existing?.getAttribute('data-flow-symbol')===label)continue;
        existing?.remove();
        button.insertBefore(vector(label),button.firstChild);
        if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label',label);
      }
    }
    upgradeSettingsActions();
  }
  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;apply();});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('pageshow',apply);
  apply();
})();
