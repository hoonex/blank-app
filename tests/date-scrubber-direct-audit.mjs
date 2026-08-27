import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_DATE_SCRUB_OUT||'flow-experience-audit/date-scrubber';
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',location:'대구광역시',type:'사립',address:'대구광역시 동구 반야월북로 199',phone:'053-000-0000',homepage:'https://jungdong.dge.hs.kr',highSchoolType:'일반고',highSchoolTrack:'일반계',coed:'남녀공학',dayNight:'주간'};
const VIEWPORTS=[
  {name:'mobile-portrait',width:390,height:844},
  {name:'mobile-landscape',width:844,height:390},
  {name:'tablet-portrait',width:768,height:1024},
  {name:'tablet-landscape',width:1024,height:768},
  {name:'desktop',width:1366,height:768},
  {name:'desktop-wide',width:1920,height:1080},
];

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};
const ymd=(date=new Date())=>`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function dashboard(){const selected=ymd();return{school:SCHOOL,selected,from:selected,to:selected,timetable:[{date:selected,period:1,subject:'문학',grade:'2',className:'6'}],meals:[],events:[],scheduleMeta:{mode:'fixture',count:0}}}
async function routes(page){
  await page.route('**/functions/v1/school-data**',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard());if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});if(action==='place')return json(route,{provider:'kakao',place:{id:'fixture',name:SCHOOL.name,url:'https://place.map.kakao.com/fixture',address:SCHOOL.address,roadAddress:SCHOOL.address,x:'128.687',y:'35.875'}});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
}
async function dispatch(page,type,id,x,y,buttons){
  await page.locator('.date-label').dispatchEvent(type,{pointerId:id,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons,bubbles:true,cancelable:true});
}
async function presentation(page){
  return page.evaluate(()=>{
    const label=document.querySelector('.date-label'),controller=document.querySelector('.date-controller'),pseudo=label?getComputedStyle(label,'::after'):null;
    const transform=pseudo?.transform||'none';let tx=0,ty=0;
    try{if(transform!=='none'){const matrix=new DOMMatrixReadOnly(transform);tx=matrix.m41;ty=matrix.m42}}catch{}
    const rect=label?.getBoundingClientRect();const drag=parseFloat(controller?.style.getPropertyValue('--flow-date-drag')||'0')||0;
    return{drag,transform,tx,ty,label:label?.dataset.flowScrubLabel||'',scrubbing:label?.dataset.flowScrubbing||'',date:document.querySelector('#datePicker')?.value||'',center:rect?rect.left+rect.width/2:0,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth};
  });
}

for(const viewport of VIEWPORTS){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:viewport.width<900,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(9000);const consoleErrors=[],pageErrors=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});page.on('pageerror',error=>pageErrors.push(String(error)));
  try{
    await routes(page);
    await page.addInitScript(({school})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light')},{school:SCHOOL});
    await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowExperience==='ready');
    await page.locator('#datePicker').evaluate(input=>{input.value='2026-08-24'});
    const box=await page.locator('.date-label').boundingBox();if(!box)throw new Error(`${viewport.name}: date label missing`);
    const x=box.x+box.width/2,y=box.y+box.height/2,direction=x>viewport.width/2?-1:1,id=401;
    await dispatch(page,'pointerdown',id,x,y,1);
    const dx1=direction*18,dx2=direction*38,dxReverse=direction*16;
    await dispatch(page,'pointermove',id,x+dx1,y,1);const first=await presentation(page);
    await dispatch(page,'pointermove',id,x+dx2,y,1);const direct=await presentation(page);
    if(first.scrubbing!=='true'||direct.scrubbing!=='true')throw new Error(`${viewport.name}: scrub presentation did not activate`);
    if(Math.abs(first.drag-dx1)>1||Math.abs(direct.drag-dx2)>1)throw new Error(`${viewport.name}: inward direct tracking is not 1:1: ${JSON.stringify({dx1,dx2,first,direct})}`);
    const renderedDelta=direct.tx-first.tx;if(Math.abs(renderedDelta-(dx2-dx1))>1.5)throw new Error(`${viewport.name}: pseudo bubble did not render 1:1 delta: ${JSON.stringify({renderedDelta,expected:dx2-dx1,first,direct})}`);
    if(direct.date!=='2026-08-24')throw new Error(`${viewport.name}: date committed during drag: ${direct.date}`);
    await page.screenshot({path:`${OUT}/${viewport.name}.png`,fullPage:false});

    await dispatch(page,'pointermove',id,x+dxReverse,y,1);const reversed=await presentation(page);
    if(Math.abs(reversed.drag-dxReverse)>1||Math.abs((reversed.tx-direct.tx)-(dxReverse-dx2))>1.5)throw new Error(`${viewport.name}: bubble did not reverse immediately: ${JSON.stringify({direct,reversed})}`);

    const outward=direction>0?-viewport.width*1.4:viewport.width*1.4;
    await dispatch(page,'pointermove',id,x+outward,y,1);const edge=await presentation(page);
    if(Math.abs(edge.drag)>=Math.abs(outward)*.7)throw new Error(`${viewport.name}: edge drag was not rubber-banded: ${JSON.stringify({outward,edge})}`);
    const bubbleCenter=edge.center+edge.drag;if(bubbleCenter<42||bubbleCenter>edge.clientWidth-42)throw new Error(`${viewport.name}: rubber-band bubble left safe viewport: ${JSON.stringify({bubbleCenter,edge})}`);
    if(edge.scrollWidth>edge.clientWidth+2)throw new Error(`${viewport.name}: scrub presentation caused horizontal overflow: ${JSON.stringify(edge)}`);
    if(edge.date!=='2026-08-24')throw new Error(`${viewport.name}: edge drag committed before release`);
    await dispatch(page,'pointercancel',id,x+outward,y,0);const cancelled=await presentation(page);
    if(cancelled.scrubbing||cancelled.date!=='2026-08-24')throw new Error(`${viewport.name}: pointer cancel did not restore inert state: ${JSON.stringify(cancelled)}`);
    if(consoleErrors.length||pageErrors.length)throw new Error(`${viewport.name}: browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
    report.cases.push({viewport,direction,first,direct,renderedDelta,reversed,edge,cancelled,consoleErrors,pageErrors});
  }catch(error){report.failures.push(String(error?.stack||error));await context.close();break}
  await context.close();
}

if(!report.failures.length){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',reducedMotion:'reduce'});const page=await context.newPage();
  try{
    await routes(page);await page.addInitScript(({school})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}))},{school:SCHOOL});await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowExperience==='ready');await page.locator('#datePicker').evaluate(input=>{input.value='2026-08-24'});
    const box=await page.locator('.date-label').boundingBox();if(!box)throw new Error('reduced-motion: date label missing');const x=box.x+box.width/2,y=box.y+box.height/2,id=501;await dispatch(page,'pointerdown',id,x,y,1);await dispatch(page,'pointermove',id,x-34,y,1);const reduced=await presentation(page);if(Math.abs(reduced.drag+34)>1)throw new Error(`reduced-motion: direct tracking was disabled: ${JSON.stringify(reduced)}`);await dispatch(page,'pointercancel',id,x-34,y,0);report.reducedMotion=reduced;
  }catch(error){report.failures.push(String(error?.stack||error))}finally{await context.close()}
}

await browser.close();await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
if(report.failures.length){console.error(report.failures.join('\n'));process.exit(1)}
console.log(JSON.stringify(report,null,2));