import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
await mkdir('university-audit',{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},locale:'ko-KR',timezoneId:'Asia/Seoul',isMobile:true,hasTouch:true,colorScheme:'light'});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[];
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
page.on('pageerror',error=>pageErrors.push(String(error)));

await page.addInitScript(()=>{
  localStorage.setItem('flow-university-profile-v1',JSON.stringify({id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80'}));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[
    {name:'자료구조',professor:'김교수',place:'IT대학 101호',times:[{day:0,start:'09:00',end:'10:30',startMinutes:540,endMinutes:630,place:'IT대학 101호'}]},
    {name:'운영체제',professor:'이교수',place:'공대9호관',times:[{day:1,start:'13:00',end:'14:30',startMinutes:780,endMinutes:870,place:'공대9호관'}]},
  ]}));
  if(!sessionStorage.getItem('flow-timetable-density-fixture')){
    sessionStorage.setItem('flow-timetable-density-fixture','1');
    localStorage.removeItem('flow-university-timetable-density-v1');
  }
});

async function openTimetable(){
  const course=page.locator('#timeGrid .course-block').first();
  if(!await course.isVisible().catch(()=>false)){
    const tab=page.locator('.bottom-item[data-view="timetable"]');
    await tab.waitFor({state:'visible',timeout:10000});
    await tab.click();
  }
  await course.waitFor({state:'visible',timeout:10000});
  await page.waitForTimeout(220);
}

await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded'});
await openTimetable();

const initial=await page.evaluate(()=>{const grid=document.querySelector('#timeGrid'),body=grid?.querySelector('.grid-body'),scroll=grid?.closest('.timetable-scroll');if(scroll)scroll.scrollTop=Math.min(100,scroll.scrollHeight-scroll.clientHeight);return{hour:parseFloat(getComputedStyle(grid).getPropertyValue('--hour')),density:grid?.dataset.timetableDensity||'',touchAction:getComputedStyle(grid).touchAction||'',bodyHeight:body?.getBoundingClientRect().height||0,scrollTop:scroll?.scrollTop||0,visualScale:window.visualViewport?.scale||1}});
if(Math.abs(initial.hour-72)>1)throw new Error(`Unexpected initial mobile hour height: ${JSON.stringify(initial)}`);
if(initial.touchAction!=='pan-x pan-y')throw new Error(`Timetable must preserve one-finger panning while disabling native pinch zoom: ${JSON.stringify(initial)}`);

async function dispatchPinch(startDistance,endDistance,{centerX=190,centerY=430}={}){
  await page.evaluate(({startDistance,endDistance,centerX,centerY})=>{
    const grid=document.querySelector('#timeGrid');
    if(!grid)throw new Error('timeGrid missing');
    const touch=(identifier,x,y)=>new Touch({identifier,target:grid,clientX:x,clientY:y,pageX:x+scrollX,pageY:y+scrollY,screenX:x,screenY:y,radiusX:8,radiusY:8,rotationAngle:0,force:.5});
    const pair=(distance)=>[touch(1,centerX-distance/2,centerY),touch(2,centerX+distance/2,centerY)];
    const start=pair(startDistance),move=pair(endDistance);
    grid.dispatchEvent(new TouchEvent('touchstart',{touches:start,targetTouches:start,changedTouches:start,bubbles:true,cancelable:true,composed:true}));
    grid.dispatchEvent(new TouchEvent('touchmove',{touches:move,targetTouches:move,changedTouches:move,bubbles:true,cancelable:true,composed:true}));
    grid.dispatchEvent(new TouchEvent('touchend',{touches:[],targetTouches:[],changedTouches:move,bubbles:true,cancelable:true,composed:true}));
  },{startDistance,endDistance,centerX,centerY});
  await page.waitForTimeout(120);
}

await dispatchPinch(100,160);
const expanded=await page.evaluate(()=>{const grid=document.querySelector('#timeGrid'),body=grid.querySelector('.grid-body'),scroll=grid.closest('.timetable-scroll'),block=grid.querySelector('.course-block');return{hour:parseFloat(getComputedStyle(grid).getPropertyValue('--hour')),density:grid.dataset.timetableDensity,stored:Number(localStorage.getItem('flow-university-timetable-density-v1')),bodyHeight:body.getBoundingClientRect().height,blockHeight:block.getBoundingClientRect().height,scrollTop:scroll.scrollTop,visualScale:window.visualViewport?.scale||1}});
if(expanded.hour<113||expanded.hour>116||expanded.density!=='160'||Math.abs(expanded.stored-1.6)>.01)throw new Error(`Pinch-out did not expand timetable density to the clamp: ${JSON.stringify(expanded)}`);
if(expanded.bodyHeight<=initial.bodyHeight||expanded.visualScale!==initial.visualScale)throw new Error(`Pinch-out changed browser zoom instead of timetable geometry: ${JSON.stringify({initial,expanded})}`);

await dispatchPinch(160,80);
const compact=await page.evaluate(()=>{const grid=document.querySelector('#timeGrid'),body=grid.querySelector('.grid-body');return{hour:parseFloat(getComputedStyle(grid).getPropertyValue('--hour')),density:Number(grid.dataset.timetableDensity),stored:Number(localStorage.getItem('flow-university-timetable-density-v1')),bodyHeight:body.getBoundingClientRect().height,visualScale:window.visualViewport?.scale||1}});
if(compact.hour<56||compact.hour>59||compact.density<79||compact.density>81||Math.abs(compact.stored-.8)>.02)throw new Error(`Pinch-in did not compact timetable spacing: ${JSON.stringify(compact)}`);
if(compact.bodyHeight>=expanded.bodyHeight||compact.visualScale!==initial.visualScale)throw new Error(`Pinch-in failed to keep browser scale fixed: ${JSON.stringify({initial,compact})}`);

const beforeSingle=compact.hour;
await page.evaluate(()=>{
  const grid=document.querySelector('#timeGrid');
  const a=new Touch({identifier:7,target:grid,clientX:180,clientY:420,pageX:180+scrollX,pageY:420+scrollY,screenX:180,screenY:420,radiusX:8,radiusY:8,force:.5});
  const b=new Touch({identifier:7,target:grid,clientX:180,clientY:360,pageX:180+scrollX,pageY:360+scrollY,screenX:180,screenY:360,radiusX:8,radiusY:8,force:.5});
  grid.dispatchEvent(new TouchEvent('touchstart',{touches:[a],targetTouches:[a],changedTouches:[a],bubbles:true,cancelable:true}));
  grid.dispatchEvent(new TouchEvent('touchmove',{touches:[b],targetTouches:[b],changedTouches:[b],bubbles:true,cancelable:true}));
  grid.dispatchEvent(new TouchEvent('touchend',{touches:[],targetTouches:[],changedTouches:[b],bubbles:true,cancelable:true}));
});
await page.waitForTimeout(60);
const afterSingle=await page.locator('#timeGrid').evaluate(grid=>parseFloat(getComputedStyle(grid).getPropertyValue('--hour')));
if(Math.abs(afterSingle-beforeSingle)>.5)throw new Error(`Single-finger scrolling must not alter timetable density: ${beforeSingle} -> ${afterSingle}`);

await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded'});
await openTimetable();
const restored=await page.evaluate(()=>{const grid=document.querySelector('#timeGrid');return{hour:parseFloat(getComputedStyle(grid).getPropertyValue('--hour')),density:Number(grid.dataset.timetableDensity),stored:Number(localStorage.getItem('flow-university-timetable-density-v1')),visualScale:window.visualViewport?.scale||1,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}});
if(restored.hour<56||restored.hour>59||restored.density<79||restored.density>81||Math.abs(restored.stored-.8)>.02)throw new Error(`Stored timetable density was not restored after app re-entry: ${JSON.stringify(restored)}`);
if(restored.overflow>3||restored.visualScale!==initial.visualScale)throw new Error(`Restored density caused viewport regression: ${JSON.stringify(restored)}`);

await page.screenshot({path:'university-audit/mobile-timetable-pinch-density.png',fullPage:false});
const report={initial,expanded,compact,restored,consoleErrors,pageErrors};
await writeFile('university-audit/timetable-pinch-density.json',JSON.stringify(report,null,2));
await browser.close();
if(consoleErrors.length||pageErrors.length)throw new Error(`Browser errors detected: ${JSON.stringify({consoleErrors,pageErrors})}`);
console.log(JSON.stringify({ok:true,initialHour:initial.hour,expandedHour:expanded.hour,compactHour:compact.hour,restoredHour:restored.hour},null,2));
