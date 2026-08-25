(()=>{
  if(window.__flowOpticalAmbientInstalled)return;
  window.__flowOpticalAmbientInstalled=true;

  const JELLY_KEY='flow-optical-jelly-v1';
  const STYLE_HREF='/flow-optical-ambient.css';
  const root=document.documentElement;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

  let jelly=null,frame=0,lastFrame=0,placementFrame=0;
  let x=0,y=0,vx=0,vy=0,targetX=0,targetY=0;
  let neutralBeta=null,neutralGamma=null;
  let orientationListening=false,pointerListening=false;
  let sensorPermission='unknown';

  function optical(){return root.dataset.flowGlassMode==='optical'}
  function enabled(){return localStorage.getItem(JELLY_KEY)==='true'}
  function active(){return optical()&&enabled()}
  function ensureStyle(){
    let link=[...document.querySelectorAll('link[rel="stylesheet"]')].find(node=>{try{return new URL(node.href,location.href).pathname===STYLE_HREF}catch{return false}});
    if(link)return;
    link=document.createElement('link');link.rel='stylesheet';link.href=STYLE_HREF;document.head.append(link);
  }
  function ensureJelly(){
    if(jelly?.isConnected)return jelly;
    jelly=document.createElement('div');
    jelly.className='flow-optical-jelly';
    jelly.setAttribute('aria-hidden','true');
    jelly.innerHTML='<span class="flow-optical-jelly-core"></span>';
    document.body.append(jelly);
    return jelly;
  }
  function settingHosts(){
    const hosts=[...document.querySelectorAll('.flow-glass-settings')];
    document.querySelectorAll('[data-flow-settings-glass]').forEach(button=>{
      const card=button.closest('.flow-settings-card');if(card&&!hosts.includes(card))hosts.push(card);
    });
    return hosts;
  }
  function statusText(){
    if(!optical())return 'Optical을 켜면 사용할 수 있습니다.';
    if(!enabled())return '꺼짐 · 화면에는 아무 오브젝트도 추가하지 않습니다.';
    if(sensorPermission==='denied')return '켜짐 · 기울기 권한이 없어 포인터 움직임을 사용합니다.';
    return '켜짐 · 기울기에 따라 유리가 관성 있게 움직입니다.';
  }
  function syncControls(){
    const on=enabled();
    root.dataset.flowOpticalJelly=String(optical()&&on);
    document.querySelectorAll('[data-flow-jelly-toggle]').forEach(button=>{
      button.setAttribute('aria-checked',String(on));
      button.disabled=!optical();
    });
    document.querySelectorAll('[data-flow-jelly-status]').forEach(node=>node.textContent=statusText());
    syncInputs();schedulePlacement();
  }
  function installSettings(){
    ensureStyle();
    for(const host of settingHosts()){
      if(host.querySelector('[data-flow-jelly-setting]'))continue;
      const row=document.createElement('div');row.className='flow-optical-ambient-setting';row.dataset.flowJellySetting='true';
      row.innerHTML='<div class="flow-optical-ambient-copy"><strong>동적 유리 오브젝트</strong><small>기기를 기울이면 한 개의 젤리가 관성과 함께 움직입니다.</small></div><button class="flow-optical-switch" type="button" role="switch" aria-label="동적 유리 오브젝트" aria-checked="false" data-flow-jelly-toggle><span aria-hidden="true"></span></button><small class="flow-optical-ambient-status" data-flow-jelly-status></small>';
      host.append(row);
      row.querySelector('[data-flow-jelly-toggle]')?.addEventListener('click',toggleJelly);
    }
    syncControls();
  }

  function rectOverlap(a,b){
    const width=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
    const height=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    return width*height;
  }
  function visibleInteractiveRects(){
    const selector='button:enabled,a[href],input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[role="button"],[role="switch"]';
    return [...document.querySelectorAll(selector)].filter(node=>{
      if(node.closest('.flow-optical-jelly,.flow-refraction-copy-lens'))return false;
      const style=getComputedStyle(node),rect=node.getBoundingClientRect();
      return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&rect.width>1&&rect.height>1&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth;
    }).map(node=>{const r=node.getBoundingClientRect(),pad=10;return{left:r.left-pad,top:r.top-pad,right:r.right+pad,bottom:r.bottom+pad}});
  }
  function placeJelly(){
    placementFrame=0;
    const node=ensureJelly();if(!active())return;
    const width=node.offsetWidth||68,height=node.offsetHeight||60,moveX=24,moveY=20,edge=8;
    const minLeft=moveX+edge,maxLeft=Math.max(minLeft,innerWidth-width-moveX-edge);
    const minTop=moveY+edge,maxTop=Math.max(minTop,innerHeight-height-moveY-edge);
    const preferredTop=clamp(innerWidth<=820?88:48,minTop,maxTop);
    const rightEdge=maxLeft;
    const candidates=[
      [rightEdge,preferredTop],
      [clamp(innerWidth*.68-width/2,minLeft,maxLeft),preferredTop],
      [clamp(innerWidth*.56-width/2,minLeft,maxLeft),preferredTop],
      [rightEdge,clamp(innerHeight*.36-height/2,minTop,maxTop)],
      [clamp(innerWidth*.72-width/2,minLeft,maxLeft),clamp(innerHeight*.30-height/2,minTop,maxTop)],
      [rightEdge,clamp(innerHeight-height-112,minTop,maxTop)],
    ];
    const controls=visibleInteractiveRects();
    let best=null;
    candidates.forEach(([left,top],index)=>{
      const envelope={left:left-moveX,top:top-moveY,right:left+width+moveX,bottom:top+height+moveY};
      const overlap=controls.reduce((sum,rect)=>sum+rectOverlap(envelope,rect),0);
      const score=overlap*1000+index*12;
      if(!best||score<best.score)best={left,top,index,overlap,score};
    });
    if(!best)return;
    node.style.left=`${best.left.toFixed(1)}px`;
    node.style.top=`${best.top.toFixed(1)}px`;
    node.style.right='auto';
    node.dataset.flowJellyPlacement=String(best.index);
    node.dataset.flowJellyOverlap=best.overlap.toFixed(2);
  }
  function schedulePlacement(delay=0){
    if(placementFrame)cancelAnimationFrame(placementFrame);
    if(delay){setTimeout(schedulePlacement,delay);return}
    placementFrame=requestAnimationFrame(()=>requestAnimationFrame(placeJelly));
  }

  function setVisual(nx,ny,speed=0){
    const node=ensureJelly();
    node.style.setProperty('--flow-jelly-light-x',`${clamp(48+nx*24,22,78).toFixed(1)}%`);
    node.style.setProperty('--flow-jelly-light-y',`${clamp(28+ny*17,12,62).toFixed(1)}%`);
    const stretch=Math.min(.11,speed*.0065);
    node.style.setProperty('--flow-jelly-sx',(1+stretch).toFixed(4));
    node.style.setProperty('--flow-jelly-sy',(1-Math.min(.075,stretch*.62)).toFixed(4));
  }
  function animate(ts){
    frame=0;
    if(!active()||reducedMotion.matches){x=y=vx=vy=0;applyTransform();return}
    const dt=clamp((ts-(lastFrame||ts))/16.667,.35,1.8);lastFrame=ts;
    const spring=.115,damping=Math.pow(.79,dt);
    vx=(vx+(targetX-x)*spring*dt)*damping;
    vy=(vy+(targetY-y)*spring*dt)*damping;
    x+=vx*dt;y+=vy*dt;
    applyTransform();
    const dx=targetX-x,dy=targetY-y,speed=Math.hypot(vx,vy);
    setVisual(targetX/24,targetY/20,speed);
    if(Math.hypot(dx,dy)>.08||speed>.045)frame=requestAnimationFrame(animate);
    else{x=targetX;y=targetY;vx=vy=0;applyTransform();setVisual(targetX/24,targetY/20,0)}
  }
  function applyTransform(){
    const node=ensureJelly();
    node.style.setProperty('--flow-jelly-x',`${x.toFixed(2)}px`);
    node.style.setProperty('--flow-jelly-y',`${y.toFixed(2)}px`);
  }
  function kick(){if(!frame)frame=requestAnimationFrame(animate)}
  function setTarget(nx,ny){
    targetX=clamp(nx,-1,1)*24;targetY=clamp(ny,-1,1)*20;
    if(reducedMotion.matches){x=y=vx=vy=targetX=targetY=0;applyTransform();setVisual(nx,ny,0);return}
    kick();
  }
  function onOrientation(event){
    const beta=Number(event.beta),gamma=Number(event.gamma);if(!Number.isFinite(beta)||!Number.isFinite(gamma))return;
    if(neutralBeta===null){neutralBeta=beta;neutralGamma=gamma}
    const nx=clamp((gamma-neutralGamma)/20,-1,1),ny=clamp((beta-neutralBeta)/24,-1,1);
    setTarget(nx,ny);
  }
  function onPointer(event){
    if(orientationListening&&sensorPermission!=='denied')return;
    const nx=clamp((event.clientX/window.innerWidth-.5)*1.5,-1,1),ny=clamp((event.clientY/window.innerHeight-.5)*1.35,-1,1);
    setTarget(nx,ny);
  }
  function addInputs(){
    if(typeof DeviceOrientationEvent!=='undefined'&&!orientationListening&&sensorPermission!=='denied'){
      window.addEventListener('deviceorientation',onOrientation,{passive:true});orientationListening=true;
    }
    if(!pointerListening){window.addEventListener('pointermove',onPointer,{passive:true});pointerListening=true}
  }
  function removeInputs(){
    if(orientationListening){window.removeEventListener('deviceorientation',onOrientation);orientationListening=false}
    if(pointerListening){window.removeEventListener('pointermove',onPointer);pointerListening=false}
    neutralBeta=neutralGamma=null;
    targetX=targetY=0;
    if(frame){cancelAnimationFrame(frame);frame=0}
    x=y=vx=vy=0;lastFrame=0;if(jelly)applyTransform();
  }
  function syncInputs(){
    ensureJelly();
    if(active())addInputs();else removeInputs();
  }
  async function toggleJelly(){
    if(!optical())return;
    const next=!enabled();
    if(next&&typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
      try{sensorPermission=(await DeviceOrientationEvent.requestPermission())==='granted'?'granted':'denied'}catch{sensorPermission='denied'}
    }else if(next&&typeof DeviceOrientationEvent!=='undefined')sensorPermission='granted';
    localStorage.setItem(JELLY_KEY,String(next));
    syncControls();
  }
  function resetNeutral(){neutralBeta=neutralGamma=null;setTarget(0,0);schedulePlacement()}

  window.addEventListener('flow:glass-mode-changed',()=>{installSettings();syncControls();schedulePlacement()},{passive:true});
  window.addEventListener('orientationchange',resetNeutral,{passive:true});
  window.addEventListener('resize',()=>schedulePlacement(),{passive:true});
  window.visualViewport?.addEventListener('resize',()=>schedulePlacement(),{passive:true});
  window.addEventListener('pageshow',()=>{installSettings();syncControls();schedulePlacement()},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)removeInputs();else{syncInputs();schedulePlacement()}},{passive:true});
  document.addEventListener('click',event=>{
    if(!active()||event.target.closest?.('[data-flow-jelly-toggle]'))return;
    if(event.target.closest?.('[data-view],[data-go],[data-go-view],.flow-mobile-settings,.flow-university-settings-button,#mobileSettingsBtn,#settingsBtn'))schedulePlacement(90);
  },{capture:true,passive:true});
  reducedMotion.addEventListener?.('change',()=>{resetNeutral();syncControls()});

  const init=()=>{ensureStyle();ensureJelly();installSettings();syncControls();schedulePlacement()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  setTimeout(()=>{installSettings();schedulePlacement()},0);
})();