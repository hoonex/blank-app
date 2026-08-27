import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='university-audit';
const UNIVERSITY={id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80'};
await mkdir(OUT,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},locale:'ko-KR',timezoneId:'Asia/Seoul',isMobile:true,hasTouch:true,colorScheme:'light',reducedMotion:'no-preference'});
const page=await context.newPage();
page.setDefaultTimeout(10000);
const consoleErrors=[],pageErrors=[];
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
page.on('pageerror',error=>pageErrors.push(String(error)));

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function activeTransform(animations=[]){return animations.some(animation=>['running','pending','paused'].includes(animation.playState)&&animation.keyframes.some(transform=>transform&&transform!=='none'))}
function distance(a,b){return Math.hypot((a?.x??a?.left??0)-(b?.x??b?.left??0),(a?.y??a?.top??0)-(b?.y??b?.top??0))}
async function state(){
  return page.evaluate(()=>{
    const el=document.querySelector('[data-widget-id="campus"]'),r=el?.getBoundingClientRect(),style=el?getComputedStyle(el):null;
    const animations=el?[...el.getAnimations()].map(animation=>({playState:animation.playState,currentTime:animation.currentTime,keyframes:animation.effect?.getKeyframes?.().map(frame=>frame.transform).filter(value=>value!==undefined&&value!==null)||[]})):[];
    return{
      dragging:el?.dataset.directDragging||'',resizing:el?.dataset.directResizing||'',position:style?.position||'',
      rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height},animations,
      floating:document.querySelectorAll('.widget-direct-floating').length,
      dragPlaceholder:document.querySelectorAll('.widget-drag-placeholder').length,
      resizePlaceholder:document.querySelectorAll('.widget-resize-placeholder').length,
      width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
    };
  });
}
async function requireRenderedSettle(label){
  await page.waitForTimeout(28);
  const current=await state();
  if(current.position==='fixed'||current.floating||!activeTransform(current.animations))throw new Error(`${label} did not enter an active rendered settle: ${JSON.stringify(current)}`);
  return current;
}

await page.route('**/functions/v1/university-data**',route=>{
  const action=new URL(route.request().url()).searchParams.get('action')||'';
  if(action==='profile')return json(route,{school:UNIVERSITY,metrics:{},partial:false,unavailable:[]});
  if(action==='search')return json(route,{surveyYear:'2025',total:1,schools:[UNIVERSITY]});
  if(action==='majors')return json(route,{surveyYear:'2025',total:0,majors:[]});
  return json(route,{});
});
await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
await page.addInitScript(({university})=>{
  const d=(new Date().getDay()+6)%7;
  const subject={name:'자료구조',professor:'테스트',credit:3,times:[{day:d,start:'09:00',end:'10:15',startMinutes:540,endMinutes:615,place:'IT대학1호관'}]};
  localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[subject]}));
  localStorage.setItem('flow-university-theme-v1','light');
  localStorage.removeItem('flow-university-dashboard-layout-v2');
  localStorage.removeItem('flow-university-dashboard-v1');
},{university:UNIVERSITY});

await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});
const source=page.locator('[data-widget-id="campus"]'),target=page.locator('[data-widget-id="next"]');
await page.locator('#widgetDashboard').waitFor();await source.waitFor();await target.waitFor();await page.waitForTimeout(280);
await page.locator('#dashboardEditBtn').click();
await page.waitForFunction(()=>document.querySelector('#todayView')?.classList.contains('dashboard-editing'));

const sourceBox=await source.boundingBox(),targetBox=await target.boundingBox();
if(!sourceBox||!targetBox)throw new Error('Widget motion fixture geometry is missing.');
const start={x:sourceBox.x+sourceBox.width*.5,y:sourceBox.y+sourceBox.height*.5};
const drop={x:targetBox.x+Math.min(18,targetBox.width*.2),y:targetBox.y+Math.min(18,targetBox.height*.2)};
await page.mouse.move(start.x,start.y);await page.mouse.down();
await page.mouse.move(start.x+42,start.y+34,{steps:5});await page.mouse.move(drop.x,drop.y,{steps:10});await page.mouse.up();
const firstSettle=await requireRenderedSettle('Initial drag');

const live=await source.boundingBox();if(!live)throw new Error('Settling widget lost geometry before drag re-grab.');
const grab={x:live.x+live.width*.5,y:live.y+live.height*.5};
await page.mouse.move(grab.x,grab.y);const beforeDragRegrab=await source.boundingBox();await page.mouse.down();await page.waitForTimeout(18);
const dragRegrab=await state();
if(dragRegrab.dragging!=='1'||dragRegrab.position!=='fixed'||dragRegrab.floating!==1||dragRegrab.dragPlaceholder!==1)throw new Error(`Drag settle was not synchronously taken over: ${JSON.stringify(dragRegrab)}`);
if(activeTransform(dragRegrab.animations))throw new Error(`Drag settle transform still owns re-grabbed widget: ${JSON.stringify(dragRegrab.animations)}`);
const dragJump=distance(beforeDragRegrab,dragRegrab.rect);if(dragJump>6)throw new Error(`Drag re-grab jumped ${dragJump.toFixed(2)}px: ${JSON.stringify({beforeDragRegrab,dragRegrab})}`);
await page.mouse.move(grab.x-40,grab.y-30,{steps:5});await page.waitForTimeout(30);
const reversed=await source.boundingBox();if(!reversed||!(reversed.x<(dragRegrab.rect?.left??0)-22&&reversed.y<(dragRegrab.rect?.top??0)-14))throw new Error(`Re-grabbed widget did not reverse immediately: ${JSON.stringify({dragRegrab,reversed})}`);
await page.mouse.up();
const secondSettle=await requireRenderedSettle('Reversed drag');
const pausedDragSettle=await page.evaluate(()=>{
  const el=document.querySelector('[data-widget-id="campus"]');let paused=0;
  for(const animation of el?.getAnimations?.()||[]){
    const frames=animation.effect?.getKeyframes?.()||[];
    if(!['running','pending'].includes(animation.playState)||!frames.some(frame=>frame?.transform&&frame.transform!=='none'))continue;
    animation.pause();paused++;
  }
  const r=el?.getBoundingClientRect();return{paused,rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height}};
});
if(pausedDragSettle.paused<1)throw new Error(`Could not freeze proven drag settle for stable resize hit-testing: ${JSON.stringify({secondSettle,pausedDragSettle})}`);

const resizeHandle=source.locator('.widget-v2-resize');const handleBox=await resizeHandle.boundingBox(),beforeResizeTakeover=await source.boundingBox();
if(!handleBox||!beforeResizeTakeover)throw new Error('Resize takeover geometry is missing.');
await page.mouse.move(handleBox.x+handleBox.width*.5,handleBox.y+handleBox.height*.5);await page.mouse.down();await page.waitForTimeout(18);
const resizeTakeover=await state();
if(resizeTakeover.resizing!=='1'||resizeTakeover.position!=='fixed'||resizeTakeover.floating!==1||resizeTakeover.resizePlaceholder!==1)throw new Error(`Drag settle was not handed to resize owner: ${JSON.stringify(resizeTakeover)}`);
if(activeTransform(resizeTakeover.animations))throw new Error(`Old drag settle survived resize takeover: ${JSON.stringify(resizeTakeover.animations)}`);
const resizeJump=distance(beforeResizeTakeover,resizeTakeover.rect);if(resizeJump>7)throw new Error(`Resize takeover jumped ${resizeJump.toFixed(2)}px: ${JSON.stringify({beforeResizeTakeover,resizeTakeover})}`);
await page.mouse.move(handleBox.x+handleBox.width*.5+72,handleBox.y+handleBox.height*.5+52,{steps:7});await page.mouse.up();
const resizeSettle=await requireRenderedSettle('Resize');

const resizedLive=await source.boundingBox();if(!resizedLive)throw new Error('Resize-settling widget lost geometry.');
const resizeGrab={x:resizedLive.x+resizedLive.width*.5,y:resizedLive.y+resizedLive.height*.5};
await page.mouse.move(resizeGrab.x,resizeGrab.y);const beforeResizeRegrab=await source.boundingBox();await page.mouse.down();await page.waitForTimeout(18);
const resizeRegrab=await state();
if(resizeRegrab.dragging!=='1'||resizeRegrab.position!=='fixed'||resizeRegrab.floating!==1||resizeRegrab.dragPlaceholder!==1)throw new Error(`Resize settle was not handed back to drag owner: ${JSON.stringify(resizeRegrab)}`);
if(activeTransform(resizeRegrab.animations))throw new Error(`Resize settle transform survived drag takeover: ${JSON.stringify(resizeRegrab.animations)}`);
const resizeToDragJump=distance(beforeResizeRegrab,resizeRegrab.rect);if(resizeToDragJump>7)throw new Error(`Resize-to-drag takeover jumped ${resizeToDragJump.toFixed(2)}px: ${JSON.stringify({beforeResizeRegrab,resizeRegrab})}`);
await page.mouse.move(resizeGrab.x+34,resizeGrab.y-24,{steps:5});await page.waitForTimeout(25);await page.screenshot({path:`${OUT}/mobile-widget-motion-ownership.png`,fullPage:true});await page.mouse.up();
await page.waitForTimeout(340);

const final=await state();
if(final.floating||final.dragPlaceholder||final.resizePlaceholder||final.scrollWidth>final.width+3)throw new Error(`Widget motion ownership did not cleanly settle: ${JSON.stringify(final)}`);
if(consoleErrors.length||pageErrors.length)throw new Error(`Widget motion ownership browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);

const report={sourceBox,targetBox,firstSettle,beforeDragRegrab,dragRegrab,dragJump,reversed,secondSettle,pausedDragSettle,beforeResizeTakeover,resizeTakeover,resizeJump,resizeSettle,beforeResizeRegrab,resizeRegrab,resizeToDragJump,final,consoleErrors,pageErrors};
await writeFile(`${OUT}/widget-motion-ownership-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await context.close();await browser.close();