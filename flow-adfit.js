import {FLOW_ADFIT_CONFIG} from '/flow-adfit-config.js';

const STYLE_HREF='/flow-adfit.css';
const SDK_SELECTOR='script[data-flow-adfit-sdk]';

function appKind(){
  if(document.querySelector('#dashboard:not(.hidden)')&&document.querySelector('#todayView')&&localStorage.getItem('flow-school-profile-v3'))return'school';
  if(document.querySelector('#appView:not(.hidden)')&&document.querySelector('#todayView')&&localStorage.getItem('flow-university-profile-v1'))return'university';
  return'';
}
function configFor(kind){
  const override=globalThis.__FLOW_ADFIT_CONFIG?.[kind]||{};
  const base=FLOW_ADFIT_CONFIG[kind]||{};
  return{...base,...override};
}
function validConfig(config){
  const unit=String(config?.unit||'').trim(),width=Number(config?.width),height=Number(config?.height);
  return Boolean(unit)&&Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0;
}
function ensureStyle(){
  if([...document.querySelectorAll('link[rel="stylesheet"]')].some(node=>{try{return new URL(node.href,location.href).pathname===STYLE_HREF}catch{return false}}))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=STYLE_HREF;link.dataset.flowAdfitStyle='true';document.head.append(link);
}
function ensureSlot(kind,config){
  let slot=document.querySelector(`body > .flow-adfit-rail .flow-adfit-slot[data-flow-adfit-kind="${kind}"]`);
  if(slot)return slot;
  const app=kind==='school'?document.querySelector('#dashboard:not(.hidden)'):document.querySelector('#appView:not(.hidden)');
  if(!app||!document.body)return null;
  const rail=document.createElement('section');
  rail.className='flow-adfit-rail';
  rail.dataset.flowAdfitKind=kind;
  rail.setAttribute('aria-label','광고 영역');
  const label=document.createElement('span');
  label.className='flow-adfit-label';
  label.textContent='광고';
  slot=document.createElement('ins');
  slot.className='kakao_ad_area flow-adfit-slot';
  slot.style.cssText='display:none;width:100%;max-width:320px;margin:0 auto;';
  slot.dataset.adUnit=String(config.unit).trim();
  slot.dataset.adWidth=String(config.width);
  slot.dataset.adHeight=String(config.height);
  slot.dataset.flowAdfitKind=kind;
  slot.setAttribute('aria-label','Kakao AdFit 광고');
  rail.append(label,slot);
  document.body.append(rail);
  return slot;
}
function ensureSdk(src){
  if(document.querySelector(SDK_SELECTOR))return;
  const script=document.createElement('script');
  script.async=true;script.src=src;script.dataset.flowAdfitSdk='true';
  document.head.append(script);
}
function init(){
  if(document.documentElement.dataset.flowAdfit==='ready')return;
  const kind=appKind();if(!kind)return;
  const config=configFor(kind);
  if(!validConfig(config)){
    document.documentElement.dataset.flowAdfit='unconfigured';
    return;
  }
  ensureStyle();
  if(!ensureSlot(kind,config))return;
  ensureSdk(String(globalThis.__FLOW_ADFIT_CONFIG?.sdk||FLOW_ADFIT_CONFIG.sdk));
  document.documentElement.dataset.flowAdfit='ready';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
document.addEventListener('click',event=>{if(event.target.closest?.('#setupSave'))setTimeout(init,0)},{capture:true,passive:true});
