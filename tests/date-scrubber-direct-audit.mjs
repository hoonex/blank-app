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
async function seed(page){
  await routes(page);
  await page.addInitScript(({school})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light')},{school:SCHOOL});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('#dashboard:not(.hidden)').waitFor();
  await page.waitForFunction(()=>document.documentElement.dataset.flowExperience==='ready');
  await page.locator('#datePicker').evaluate(input=>{input.value='2026-08-24'});
}
async function visibleBox(locator){try{return await locator.boundingBox()}catch{return null}}
async function compactPresentation(page){
  return page.evaluate(()=>{
    const dock=document.querySelector('#flowTodayDateDock'),rail=dock?.querySelector('.flow-date-rail'),preview=rail?.querySelector('[data-preview="true"]');
    const transform=rail?getComputedStyle(rail).transform:'none';let tx=0;
    try{if(transform&&transform!=='none')tx=new DOMMatrixReadOnly(transform).m41}catch{}
    const drag=parseFloat(rail?.style.getPropertyValue('--flow-date-x')||'0')||0;
    return{drag,transform,tx,dragging:dock?.dataset.kineticDragging||'',snap:dock?.dataset.kineticSnap||'',kinetic:dock?.dataset.flowKinetic||'',preview:preview?.dataset.iso||'',date:document.querySelector('#datePicker')?.value||'',clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth};
  });
}
async function legacyDispatch(page,type,id,x,y,buttons){
  await page.locator('.date-label').dispatchEvent(type,{pointerId:id,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons,bubbles:true,cancelable:true});
}
async function legacyPresentation(page){
  return page.evaluate(()=>{
    const label=document.querySelector('.date-label'),controller=document.querySelector('.date-controller'),pseudo=label?getComputedStyle(label,'::after'):null;
    const transform=pseudo?.transform||'none';let tx=0,ty=0;
    try{if(transform!=='none'){const matrix=new DOMMatrixReadOnly(transform);tx=matrix.m41;ty=matrix.m42}}catch{}
    const rect=label?.getBoundingClientRect();const drag=parseFloat(controller?.style.getPropertyValue('--flow-date-drag')||'0')||0;
    return{drag,transform,tx,ty,label:label?.dataset.flowScrubLabel||'',scrubbing:label?.dataset.flowScrubbing||'',date:document.querySelector('#datePicker')?.value||'',center:rect?rect.left+rect.width/2:0,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth};
  });
}
function dayDelta(a,b){const A=new Date(`${a}T12:00:00`),B=new Date(`${b}T12:00:00`);return Math.round((B-A)/86400000)}

async function auditCompact(page,viewport,box){
  const x=box.x+box.width/2,y=box.y+box.height/2,direction=x>viewport.width/2?-1:1;
  const dx1=direction*18,dx2=direction*38;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+dx1,y,{steps:1});const first=await compactPresentation(page);
  await page.mouse.move(x+dx2,y,{steps:1});const direct=await compactPresentation(page);
  if(first.dragging!=='true'||direct.dragging!=='true'||direct.kinetic!=='v5')throw new Error(`${viewport.name}: kinetic date rail did not enter direct manipulation`);
  if(Math.abs(first.drag-dx1)>1.2||Math.abs((direct.drag-first.drag)-(dx2-dx1))>1.2)throw new Error(`${viewport.name}: kinetic date rail is not 1:1 in the direct zone: ${JSON.stringify({dx1,dx2,first,direct})}`);
  if(Math.abs(first.tx-dx1)>1.5||Math.abs((direct.tx-first.tx)-(dx2-dx1))>1.5)throw new Error(`${viewport.name}: kinetic date rail render did not track pointer delta 1:1: ${JSON.stringify({dx1,dx2,first,direct})}`);
  if(direct.date!=='2026-08-24')throw new Error(`${viewport.name}: kinetic date committed during drag: ${direct.date}`);

  const reverse=direction*16;
  await page.mouse.move(x+reverse,y,{steps:1});const reversed=await compactPresentation(page);
  if(Math.abs(reversed.drag-reverse)>1.2||Math.abs((reversed.tx-direct.tx)-(reverse-dx2))>1.5)throw new Error(`${viewport.name}: kinetic date rail did not reverse immediately: ${JSON.stringify({reverse,direct,reversed})}`);

  const sweep=direction*Math.min(96,viewport.width*.24);
  await page.mouse.move(x+sweep,y,{steps:1});const extended=await compactPresentation(page);
  if(Math.abs(extended.drag-sweep)>1.5||Math.abs((extended.tx-reversed.tx)-(sweep-reverse))>2)throw new Error(`${viewport.name}: kinetic date rail lost direct tracking across a wider sweep: ${JSON.stringify({sweep,reversed,extended})}`);
  if(extended.scrollWidth>extended.clientWidth+2)throw new Error(`${viewport.name}: kinetic date rail caused horizontal overflow: ${JSON.stringify(extended)}`);
  if(extended.date!=='2026-08-24')throw new Error(`${viewport.name}: kinetic date rail committed before release`);
  await page.screenshot({path:`${OUT}/${viewport.name}.png`,fullPage:false});

  await page.mouse.up();const released=await compactPresentation(page);await page.waitForTimeout(90);const coasting=await compactPresentation(page);
  if(released.dragging==='true'||coasting.dragging==='true')throw new Error(`${viewport.name}: kinetic dragging state survived pointer release`);
  if(coasting.date!=='2026-08-24')throw new Error(`${viewport.name}: kinetic date committed before inertia had time to coast: ${JSON.stringify({released,coasting})}`);
  if(Math.abs(coasting.drag-released.drag)<2&&coasting.preview===released.preview&&coasting.snap!=='true')throw new Error(`${viewport.name}: kinetic date rail stopped immediately on release: ${JSON.stringify({released,coasting})}`);
  await page.waitForFunction(previous=>document.querySelector('#datePicker')?.value!==previous,'2026-08-24',{timeout:5000});
  await page.waitForFunction(()=>{const dock=document.querySelector('#flowTodayDateDock'),rail=dock?.querySelector('.flow-date-rail'),x=parseFloat(rail?.style.getPropertyValue('--flow-date-x')||'0')||0;return Math.abs(x)<=1.5&&dock?.dataset.kineticDragging!=='true'&&dock?.dataset.kineticSnap!=='true'},{timeout:1500});
  const settled=await compactPresentation(page),delta=dayDelta('2026-08-24',settled.date);
  if(!delta||Math.sign(delta)!==-Math.sign(direction))throw new Error(`${viewport.name}: kinetic date settled in the wrong direction: ${JSON.stringify({direction,delta,settled})}`);
  if(Math.abs(settled.drag)>1.5)throw new Error(`${viewport.name}: kinetic date did not magnetically settle to center: ${JSON.stringify(settled)}`);
  if(settled.scrollWidth>settled.clientWidth+2)throw new Error(`${viewport.name}: kinetic date settle caused horizontal overflow: ${JSON.stringify(settled)}`);
  return{mode:'kinetic-rail',viewport,direction,first,direct,reversed,extended,released,coasting,settled,delta};
}

async function auditLegacy(page,viewport,box){
  const x=box.x+box.width/2,y=box.y+box.height/2,direction=x>viewport.width/2?-1:1,id=401;
  await legacyDispatch(page,'pointerdown',id,x,y,1);
  const dx1=direction*18,dx2=direction*38,dxReverse=direction*16;
  await legacyDispatch(page,'pointermove',id,x+dx1,y,1);const first=await legacyPresentation(page);
  await legacyDispatch(page,'pointermove',id,x+dx2,y,1);const direct=await legacyPresentation(page);
  if(first.scrubbing!=='true'||direct.scrubbing!=='true')throw new Error(`${viewport.name}: legacy scrub presentation did not activate`);
  if(Math.abs(first.drag-dx1)>1||Math.abs(direct.drag-dx2)>1)throw new Error(`${viewport.name}: legacy inward direct tracking is not 1:1: ${JSON.stringify({dx1,dx2,first,direct})}`);
  const renderedDelta=direct.tx-first.tx;if(Math.abs(renderedDelta-(dx2-dx1))>1.5)throw new Error(`${viewport.name}: legacy pseudo bubble did not render 1:1 delta: ${JSON.stringify({renderedDelta,expected:dx2-dx1,first,direct})}`);
  if(direct.date!=='2026-08-24')throw new Error(`${viewport.name}: legacy date committed during drag: ${direct.date}`);
  await page.screenshot({path:`${OUT}/${viewport.name}.png`,fullPage:false});
  await legacyDispatch(page,'pointermove',id,x+dxReverse,y,1);const reversed=await legacyPresentation(page);
  if(Math.abs(reversed.drag-dxReverse)>1||Math.abs((reversed.tx-direct.tx)-(dxReverse-dx2))>1.5)throw new Error(`${viewport.name}: legacy bubble did not reverse immediately: ${JSON.stringify({direct,reversed})}`);
  const outward=direction>0?-viewport.width*1.4:viewport.width*1.4;
  await legacyDispatch(page,'pointermove',id,x+outward,y,1);const edge=await legacyPresentation(page);
  if(Math.abs(edge.drag)>=Math.abs(outward)*.7)throw new Error(`${viewport.name}: legacy edge drag was not rubber-banded: ${JSON.stringify({outward,edge})}`);
  const bubbleCenter=edge.center+edge.drag;if(bubbleCenter<42||bubbleCenter>edge.clientWidth-42)throw new Error(`${viewport.name}: legacy rubber-band bubble left safe viewport: ${JSON.stringify({bubbleCenter,edge})}`);
  if(edge.scrollWidth>edge.clientWidth+2)throw new Error(`${viewport.name}: legacy scrub presentation caused horizontal overflow: ${JSON.stringify(edge)}`);
  if(edge.date!=='2026-08-24')throw new Error(`${viewport.name}: legacy edge drag committed before release`);
  await legacyDispatch(page,'pointercancel',id,x+outward,y,0);const cancelled=await legacyPresentation(page);
  if(cancelled.scrubbing||cancelled.date!=='2026-08-24')throw new Error(`${viewport.name}: legacy pointer cancel did not restore inert state: ${JSON.stringify(cancelled)}`);
  return{mode:'legacy-scrubber',viewport,direction,first,direct,renderedDelta,reversed,edge,cancelled};
}

for(const viewport of VIEWPORTS){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:viewport.width<900,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(9000);page.setDefaultNavigationTimeout(20000);const consoleErrors=[],pageErrors=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});page.on('pageerror',error=>pageErrors.push(String(error)));
  try{
    await seed(page);
    const dock=page.locator('#flowTodayDateDock'),label=page.locator('.date-label');
    const dockBox=await visibleBox(dock),labelBox=await visibleBox(label);
    let result;
    if(dockBox)result=await auditCompact(page,viewport,dockBox);
    else if(labelBox)result=await auditLegacy(page,viewport,labelBox);
    else throw new Error(`${viewport.name}: no visible date manipulation control`);
    if(consoleErrors.length||pageErrors.length)throw new Error(`${viewport.name}: browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
    report.cases.push({...result,consoleErrors,pageErrors});
  }catch(error){report.failures.push(String(error?.stack||error));await context.close();break}
  await context.close();
}

if(!report.failures.length){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',reducedMotion:'reduce'});const page=await context.newPage();
  try{
    await seed(page);const box=await visibleBox(page.locator('#flowTodayDateDock'));if(!box)throw new Error('reduced-motion: kinetic date rail missing');
    const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-34,y,{steps:1});const reduced=await compactPresentation(page);
    if(reduced.dragging!=='true'||Math.abs(reduced.drag+34)>1.2)throw new Error(`reduced-motion: direct tracking was disabled: ${JSON.stringify(reduced)}`);
    if(reduced.date!=='2026-08-24')throw new Error(`reduced-motion: date committed during drag: ${reduced.date}`);
    await page.mouse.up();await page.waitForFunction(previous=>document.querySelector('#datePicker')?.value!==previous,'2026-08-24',{timeout:5000});
    await page.waitForFunction(()=>{const dock=document.querySelector('#flowTodayDateDock'),rail=dock?.querySelector('.flow-date-rail'),x=parseFloat(rail?.style.getPropertyValue('--flow-date-x')||'0')||0;return Math.abs(x)<=1.5&&dock?.dataset.kineticDragging!=='true'&&dock?.dataset.kineticSnap!=='true'},{timeout:1500});
    const settled=await compactPresentation(page),delta=dayDelta('2026-08-24',settled.date);if(delta<=0)throw new Error(`reduced-motion: kinetic rail settled in the wrong direction: ${JSON.stringify({delta,settled})}`);
    report.reducedMotion={...reduced,settled,delta};
  }catch(error){report.failures.push(String(error?.stack||error))}finally{await context.close()}
}

await browser.close();await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
if(report.failures.length){console.error(report.failures.join('\n'));process.exit(1)}
console.log(JSON.stringify(report,null,2));