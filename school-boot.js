const root=document.documentElement;
const boot=document.querySelector('#flowSchoolBoot');
const required=['/school-v5.css','/school-hotfix.css','/school-polish.css','/school-settings-wide.css','/flow-refraction.css','/flow-experience.css','/flow-material.css','/school-boot.css'];

function pathOf(link){try{return new URL(link.href,location.href).pathname}catch{return''}}
function styleReady(path){
  const link=[...document.querySelectorAll('link[rel="stylesheet"]')].find(node=>pathOf(node)===path);
  if(!link)return Promise.resolve(false);
  if(link.sheet)return Promise.resolve(true);
  return new Promise(resolve=>{
    let settled=false;
    const done=value=>{if(settled)return;settled=true;resolve(value)};
    link.addEventListener('load',()=>done(true),{once:true});
    link.addEventListener('error',()=>done(false),{once:true});
    setTimeout(()=>done(Boolean(link.sheet)),1600);
  });
}
function nextPaint(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
async function releaseBoot(){
  await Promise.all(required.map(styleReady));
  /* flow-native intentionally raises the shared material sheet during startup.
     Re-raise the already-loaded refraction owner after it, then keep the School
     first-paint/reveal layer last. This moves existing nodes only; no duplicate
     stylesheet or second optical runtime is created. */
  const links=[...document.querySelectorAll('link[rel="stylesheet"]')];
  const refractionStyle=links.find(node=>pathOf(node)==='/flow-refraction.css');
  const bootStyle=links.find(node=>pathOf(node)==='/school-boot.css');
  if(refractionStyle?.parentElement===document.head)document.head.append(refractionStyle);
  if(bootStyle?.parentElement===document.head)document.head.append(bootStyle);
  await nextPaint();
  root.dataset.flowSchoolBootReady='true';
  root.dataset.flowSchoolPresentation='ready';
  setTimeout(()=>boot?.remove(),430);
}

if(root.dataset.flowSchoolBoot!=='saved'){
  root.dataset.flowSchoolBootReady='true';
  boot?.remove();
}else if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{void releaseBoot()},{once:true});
}else{
  void releaseBoot();
}
