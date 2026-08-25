import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='optical-ambient-scroll-audit';
const GLASS_KEY='flow-glass-mode-v2';
const JELLY_KEY='flow-optical-jelly-v1';
const viewports=[
  ['mobile-portrait',390,844],
  ['mobile-landscape',844,390],
  ['tablet-portrait',768,1024],
  ['tablet-landscape',1024,768],
  ['desktop-1366',1366,768],
  ['desktop-1920',1920,1080],
];
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={cases:[],scrollReversal:null,failures:[]};

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function rectData(rect){return rect?{left:rect.x,top:rect.y,right:rect.x+rect.width,bottom:rect.y+rect.height,width:rect.width,height:rect.height}:null}
function assert(condition,message){if(!condition)throw new Error(message)}

async function prepare(app,width,height){
  const context=await browser.newContext({viewport:{width,height},locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',hasTouch:width<=1024,isMobile:width<=520});
  const page=await context.newPage();
  if(app==='school'){
    const school={officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
    const timetable=Array.from({length:7},(_,i)=>({date:'20260825',period:i+1,subject:['국어','수학','영어Ⅱ','선택과목','선택과목','선택과목','선택과목'][i]}));
    await page.route('**/functions/v1/school-data**',route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='dashboard')return json(route,{school,selected:'20260825',from:'20260824',to:'20260828',timetable,meals:[{date:'20260825',type:'중식',menu:['현미밥','미역국','닭갈비'],calories:'720 Kcal'}],events:[],scheduleMeta:{mode:'fixture',count:0}});if(action==='media')return json(route,{media:{},homepage:school.homepage});if(action==='place')return json(route,{provider:'kakao',place:null});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});return json(route,{})});
    await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
    await page.addInitScript(({school,glassKey,jellyKey})=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem(glassKey,'optical');localStorage.setItem(jellyKey,'true')},{school,glassKey:GLASS_KEY,jellyKey:JELLY_KEY});
    await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor({timeout:12000});
  }else{
    const university={id:'knu',name:'경북대학교',kind:'대학교',address:'대구광역시 북구 대학로 80',homepage:'https://www.knu.ac.kr'};
    await page.route('**/functions/v1/university-data**',route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='majors')return json(route,{schools:[],majors:[]});return json(route,{school:university,metrics:{students:'32,000',faculty:'1,200'},partial:false,unavailable:[]})});
    await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
    await page.addInitScript(({university,glassKey,jellyKey})=>{localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[]}));localStorage.setItem('flow-university-theme-v1','light');localStorage.setItem(glassKey,'optical');localStorage.setItem(jellyKey,'true')},{university,glassKey:GLASS_KEY,jellyKey:JELLY_KEY});
    await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#appView:not(.hidden)').waitFor({timeout:12000});
  }
  await page.waitForFunction(()=>document.documentElement.dataset.flowGlassMode==='optical'&&document.documentElement.dataset.flowOpticalJelly==='true'&&document.querySelector('.flow-optical-jelly'),null,{timeout:8000});
  await page.waitForTimeout(100);
  return{context,page};
}

async function openSettings(page,app){
  const trigger=app==='school'?page.locator('#mobileSettingsBtn:visible,#settingsBtn:visible').first():page.locator('.flow-mobile-settings:visible,.flow-university-settings-button:visible').first();
  await trigger.waitFor({timeout:5000});await trigger.click();
  const panel=app==='school'?'#flowSchoolSettingsView:not(.hidden)':'#flowUniversitySettingsView:not(.hidden)';
  await page.locator(`${panel} [data-flow-jelly-toggle]`).waitFor({timeout:5000});
  return panel;
}
async function closeSettings(page){const today=page.locator('[data-view="today"]:visible').first();await today.click();await page.waitForTimeout(180)}

async function exerciseJelly(page){
  const before=await page.locator('.flow-optical-jelly').evaluate(node=>getComputedStyle(node).transform);
  const hasOrientation=await page.evaluate(()=>typeof DeviceOrientationEvent!=='undefined');
  if(hasOrientation){
    await page.evaluate(()=>{
      const fire=(beta,gamma)=>{const event=new Event('deviceorientation');Object.defineProperties(event,{beta:{value:beta},gamma:{value:gamma}});window.dispatchEvent(event)};
      fire(22,3);fire(42,18);
    });
  }else{
    const size=page.viewportSize();await page.mouse.move(size.width*.18,size.height*.74);
  }
  await page.waitForTimeout(330);
  const after=await page.locator('.flow-optical-jelly').evaluate(node=>({transform:getComputedStyle(node).transform,lightX:node.style.getPropertyValue('--flow-jelly-light-x'),lightY:node.style.getPropertyValue('--flow-jelly-light-y'),placement:node.dataset.flowJellyPlacement,placementOverlap:Number(node.dataset.flowJellyOverlap||NaN)}));
  assert(after.transform!==before,`jelly did not respond to ${hasOrientation?'orientation':'pointer'} input`);
  assert(Number.isFinite(after.placementOverlap)&&after.placementOverlap===0,`jelly placement envelope overlaps a visible control by ${after.placementOverlap}`);
  return{input:hasOrientation?'orientation':'pointer',before,after};
}
async function visibleControlCollisions(page){
  return page.evaluate(()=>{
    const jelly=document.querySelector('.flow-optical-jelly');if(!jelly)return['missing jelly'];
    const jr=jelly.getBoundingClientRect(),selector='button:enabled,a[href],input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[role="button"],[role="switch"]';
    const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    return [...document.querySelectorAll(selector)].filter(node=>{
      if(node.closest('.flow-optical-jelly,.flow-refraction-copy-lens'))return false;
      const style=getComputedStyle(node),r=node.getBoundingClientRect();
      if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0||r.width<=1||r.height<=1||r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth)return false;
      return overlap(jr,r)>.5;
    }).map(node=>({tag:node.tagName,id:node.id||'',text:(node.textContent||node.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,48),rect:rectData(node.getBoundingClientRect())}));
  });
}

async function auditCase(app,name,width,height){
  const {context,page}=await prepare(app,width,height);
  try{
    const jelly=page.locator('.flow-optical-jelly');
    const jellyBox=await jelly.boundingBox();assert(jellyBox,`${app}/${name}: jelly hidden`);
    const jr=rectData(jellyBox);assert(jr.left>=-1&&jr.right<=width+1&&jr.top>=-1&&jr.bottom<=height+1,`${app}/${name}: jelly outside viewport ${JSON.stringify(jr)}`);
    assert(await jelly.evaluate(node=>getComputedStyle(node).pointerEvents)==='none',`${app}/${name}: jelly captures input`);
    const panel=await openSettings(page,app),toggle=page.locator(`${panel} [data-flow-jelly-toggle]`);
    const switchState=await toggle.evaluate(node=>{const style=getComputedStyle(node),thumb=getComputedStyle(node.firstElementChild);return{checked:node.getAttribute('aria-checked'),disabled:node.disabled,background:style.backgroundImage,backdrop:style.backdropFilter||style.webkitBackdropFilter||'',thumbTransform:thumb.transform,status:node.parentElement?.querySelector('[data-flow-jelly-status]')?.textContent||''}});
    assert(switchState.checked==='true'&&!switchState.disabled,`${app}/${name}: Optical jelly switch not enabled ${JSON.stringify(switchState)}`);
    assert(switchState.background.includes('gradient'),`${app}/${name}: switch has no Optical specular gradient`);
    assert(/blur\(/.test(switchState.backdrop),`${app}/${name}: switch has no glass backdrop ${switchState.backdrop}`);
    await page.screenshot({path:`${OUT}/${app}-${name}-settings.png`,fullPage:false,animations:'disabled'});
    await closeSettings(page);
    const motion=await exerciseJelly(page),collisions=await visibleControlCollisions(page);
    assert(collisions.length===0,`${app}/${name}: moved jelly covers visible controls ${JSON.stringify(collisions)}`);
    const finalBox=rectData(await jelly.boundingBox());assert(finalBox&&finalBox.left>=-1&&finalBox.right<=width+1&&finalBox.top>=-1&&finalBox.bottom<=height+1,`${app}/${name}: moved jelly outside viewport ${JSON.stringify(finalBox)}`);
    const scroll=await page.evaluate(()=>({client:document.documentElement.clientWidth,width:document.documentElement.scrollWidth}));
    assert(scroll.width<=scroll.client+3,`${app}/${name}: horizontal overflow ${JSON.stringify(scroll)}`);
    await page.screenshot({path:`${OUT}/${app}-${name}-jelly.png`,fullPage:false,animations:'disabled'});
    return{app,name,viewport:{width,height},jelly:jr,finalJelly:finalBox,switchState,motion,collisions,scroll};
  }finally{await context.close()}
}

async function scrollReversalAudit(){
  const {context,page}=await prepare('school',390,844);
  try{
    await page.evaluate(()=>{
      document.documentElement.style.scrollBehavior='auto';document.body.style.scrollBehavior='auto';
      const spacer=document.createElement('div');spacer.id='flow-refraction-scroll-fixture';spacer.style.cssText='height:1500px;background:repeating-linear-gradient(180deg,#5577e9 0 32px,#f2a55f 32px 64px);margin-top:12px;border-radius:18px';document.querySelector('.product-main')?.append(spacer);
      window.dispatchEvent(new Event('flow:refraction-refresh'));
    });
    await page.waitForTimeout(160);
    await page.waitForFunction(()=>document.documentElement.dataset.flowRefractionCopy==='true'&&document.querySelector('.flow-refraction-copy-lens'),null,{timeout:5000});
    const read=()=>page.evaluate(()=>{
      const nav=document.querySelector('.mobile-bottom-nav'),source=document.querySelector('.product-main'),navRect=nav.getBoundingClientRect(),sourceRect=source.getBoundingClientRect();
      const actual=Number.parseFloat(nav.style.getPropertyValue('--flow-refraction-scene-top'));return{actual,expected:sourceRect.top-(navRect.top+5),scrollY:window.scrollY};
    });
    await page.evaluate(()=>window.scrollTo({top:720,behavior:'instant'}));await page.waitForTimeout(22);
    const down=await read();
    await page.evaluate(()=>window.scrollTo({top:535,behavior:'instant'}));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const reverse=await read();
    await page.evaluate(()=>window.scrollTo({top:760,behavior:'instant'}));await page.waitForTimeout(18);await page.evaluate(()=>window.scrollTo({top:610,behavior:'instant'}));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const reverseAgain=await read();
    for(const [label,state] of [['down',down],['reverse',reverse],['reverseAgain',reverseAgain]])assert(Math.abs(state.actual-state.expected)<=1.25,`${label}: refracted scene stale by ${Math.abs(state.actual-state.expected).toFixed(2)}px ${JSON.stringify(state)}`);
    await page.waitForTimeout(230);const settledA=await read();await page.waitForTimeout(120);const settledB=await read();
    assert(Math.abs(settledA.actual-settledB.actual)<=.05,'scroll follower did not settle after bounded follow-through');
    await page.screenshot({path:`${OUT}/school-mobile-scroll-reversal.png`,fullPage:false,animations:'disabled'});
    return{down,reverse,reverseAgain,settledA,settledB};
  }finally{await context.close()}
}

for(const app of ['school','university'])for(const [name,width,height] of viewports){
  try{report.cases.push(await auditCase(app,name,width,height))}catch(error){report.failures.push(`${app}/${name}: ${error.message}`)}
}
try{report.scrollReversal=await scrollReversalAudit()}catch(error){report.failures.push(`scroll-reversal: ${error.message}`)}
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(report.failures.length){console.error(JSON.stringify(report,null,2));process.exit(1)}
console.log(JSON.stringify(report,null,2));