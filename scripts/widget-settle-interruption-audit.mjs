import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='university-audit';
await mkdir(OUT,{recursive:true});

const UNIVERSITY={id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80'};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},locale:'ko-KR',timezoneId:'Asia/Seoul',isMobile:true,hasTouch:true,colorScheme:'light',reducedMotion:'no-preference'});
const page=await context.newPage();
page.setDefaultTimeout(10000);
const consoleErrors=[],pageErrors=[];
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
page.on('pageerror',error=>pageErrors.push(String(error)));

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function widgetState(){
  return page.evaluate(()=>{
    const el=document.querySelector('[data-widget-id="campus"]'),r=el?.getBoundingClientRect(),style=el?getComputedStyle(el):null;
    const animations=el?[...el.getAnimations()].map(animation=>({playState:animation.playState,currentTime:animation.currentTime,keyframes:animation.effect?.getKeyframes?.().map(frame=>frame.transform).filter(Boolean)||[]})):[];
    return{settling:el?.dataset.widgetSettling||'',dragging:el?.dataset.directDragging||'',position:style?.position||'',transform:style?.transform||'none',rect:r&&{left:r.left,top:r.top,width:r.width,height:r.height},animations,floating:document.querySelectorAll('.widget-direct-floating').length,placeholder:document.querySelectorAll('.widget-drag-placeholder').length};
  });
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
await page.locator('#widgetDashboard').waitFor();
await page.locator('[data-widget-id="campus"]').waitFor();
await page.locator('[data-widget-id="next"]').waitFor();
await page.waitForTimeout(280);
await page.locator('#dashboardEditBtn').click();
await page.waitForFunction(()=>document.querySelector('#todayView')?.classList.contains('dashboard-editing'));

const source=page.locator('[data-widget-id="campus"]');
const target=page.locator('[data-widget-id="next"]');
const sourceBox=await source.boundingBox(),targetBox=await target.boundingBox();
if(!sourceBox||!targetBox)throw new Error('Widget interruption fixture geometry is missing.');

const start={x:sourceBox.x+sourceBox.width*.5,y:sourceBox.y+sourceBox.height*.5};
const drop={x:targetBox.x+Math.min(18,targetBox.width*.2),y:targetBox.y+Math.min(18,targetBox.height*.2)};
await page.mouse.move(start.x,start.y);
await page.mouse.down();
await page.mouse.move(start.x+42,start.y+34,{steps:5});
await page.mouse.move(drop.x,drop.y,{steps:10});
await page.mouse.up();
await page.waitForTimeout(30);

const settling=await widgetState();
const transformAnimation=settling.animations.some(animation=>animation.playState==='running'&&animation.keyframes.some(transform=>transform&&transform!=='none'));
if(settling.position==='fixed'||settling.floating||settling.placeholder||(!transformAnimation&&settling.transform==='none'))throw new Error(`Widget did not enter a rendered in-grid settle before re-grab: ${JSON.stringify(settling)}`);

const live=await source.boundingBox();
if(!live)throw new Error('Settling widget lost live geometry.');
const grabPoint={x:live.x+live.width*.5,y:live.y+live.height*.5};
await page.mouse.move(grabPoint.x,grabPoint.y);
const preGrab=await source.boundingBox();
if(!preGrab)throw new Error('Widget presentation rect missing immediately before re-grab.');
await page.mouse.down();
await page.waitForTimeout(18);

const grabbed=await widgetState();
if(grabbed.dragging!=='1'||grabbed.position!=='fixed'||grabbed.floating!==1||grabbed.placeholder!==1)throw new Error(`Settling widget was not synchronously converted back to direct manipulation: ${JSON.stringify(grabbed)}`);
const oldSettleStillRunning=grabbed.animations.some(animation=>animation.playState==='running'&&animation.keyframes.some(transform=>transform&&transform!=='none'));
if(oldSettleStillRunning)throw new Error(`Old grid settle animation still owns the re-grabbed widget: ${JSON.stringify(grabbed.animations)}`);
const jump=Math.hypot((grabbed.rect?.left??0)-preGrab.x,(grabbed.rect?.top??0)-preGrab.y);
if(jump>6)throw new Error(`Widget re-grab jumped ${jump.toFixed(2)}px away from its presentation position: ${JSON.stringify({preGrab,grabbed})}`);

await page.mouse.move(grabPoint.x-38,grabPoint.y-28,{steps:5});
await page.waitForTimeout(32);
const reversed=await source.boundingBox();
if(!reversed)throw new Error('Re-grabbed widget lost geometry while reversing.');
if(!(reversed.x<grabbed.rect.left-22&&reversed.y<grabbed.rect.top-14))throw new Error(`Re-grabbed widget did not reverse immediately with the pointer: ${JSON.stringify({grabbed,reversed})}`);
await page.screenshot({path:`${OUT}/mobile-widget-settle-regrab.png`,fullPage:true});

await page.mouse.up();
await page.waitForTimeout(320);
const final=await page.evaluate(()=>({
  settling:document.querySelector('[data-widget-id="campus"]')?.dataset.widgetSettling||'',
  floating:document.querySelectorAll('.widget-direct-floating').length,
  placeholder:document.querySelectorAll('.widget-drag-placeholder').length,
  width:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth,
}));
if(final.settling||final.floating||final.placeholder||final.scrollWidth>final.width+3)throw new Error(`Interrupted widget did not settle cleanly: ${JSON.stringify(final)}`);
if(consoleErrors.length||pageErrors.length)throw new Error(`Widget interruption browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);

const report={sourceBox,targetBox,settling,preGrab,grabbed,jump,reversed,final,consoleErrors,pageErrors};
await writeFile(`${OUT}/widget-settle-interruption-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await context.close();
await browser.close();
