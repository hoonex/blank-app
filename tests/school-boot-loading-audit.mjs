import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT='school-boot-audit';
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
const REQUIRED=['/school-v5.css','/school-hotfix.css','/school-polish.css','/school-settings-wide.css','/flow-refraction.css','/flow-experience.css','/flow-material.css','/school-boot.css'];
const AD_UNIT='DAN-ovpJn5XCBs1n1owQ';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={cases:[]};

function assert(value,message){if(!value)throw new Error(message)}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function ymd(){const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`}
function alpha(color){const m=String(color).match(/rgba?\([^/]*?(?:,|\s)([\d.]+)\)?$/);if(!m)return 1;const value=Number(m[1]);return Number.isFinite(value)?value:1}

async function run(name,viewport){
  const context=await browser.newContext({viewport,isMobile:viewport.width<=520,hasTouch:viewport.width<=1024,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const errors=[],consoleErrors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
  let releaseDashboard;const gate=new Promise(resolve=>{releaseDashboard=resolve});let seenDashboard;const seen=new Promise(resolve=>{seenDashboard=resolve});
  await page.route('https://t1.kakaocdn.net/kas/static/ba.min.js',route=>route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:`document.querySelectorAll('.kakao_ad_area').forEach(function(el){el.style.display='block';var n=document.createElement('span');n.className='flow-adfit-mock';n.style.cssText='display:block;width:'+el.dataset.adWidth+'px;max-width:100%;height:'+el.dataset.adHeight+'px;margin:auto;background:rgba(120,130,145,.08);border-radius:12px';el.append(n);});`}));
  await page.route('**/functions/v1/school-data**',async route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'',date=ymd();
    if(action==='dashboard'){
      seenDashboard();await gate;
      return json(route,{school:SCHOOL,selected:date,from:date,to:date,timetable:Array.from({length:7},(_,i)=>({date,period:i+1,subject:['문학','수학Ⅱ','영어Ⅱ','화학','미적분','정보','체육'][i],grade:'2',className:'6'})),meals:[{date,type:'중식',dishes:['현미밥','미역국','닭갈비'],calories:'720 Kcal',nutrition:'',origin:'',people:'320'}],events:[{date,name:'동아리 활동',content:'학급별 활동',grade1:'N',grade2:'Y',grade3:'N',holidayType:''}],scheduleMeta:{mode:'fixture',count:1}});
    }
    if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});
    if(action==='place')return json(route,{provider:'kakao',place:null});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({school})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','optical')},{school:SCHOOL});

  await page.goto(BASE,{waitUntil:'commit'});
  await page.locator('#flowSchoolBoot').waitFor({state:'attached'});
  const firstPaint=await page.evaluate(()=>{
    const visible=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&r.width>0&&r.height>0};
    return{boot:document.documentElement.dataset.flowSchoolBoot||'',landingVisible:visible(document.querySelector('#landing')),bootVisible:visible(document.querySelector('#flowSchoolBoot')),theme:document.documentElement.dataset.theme||'',glass:document.documentElement.dataset.flowGlassMode||''};
  });
  assert(firstPaint.boot==='saved'&&!firstPaint.landingVisible,`${name}: saved profile painted legacy landing ${JSON.stringify(firstPaint)}`);
  assert(firstPaint.bootVisible,`${name}: stable boot shell was not visible on first paint ${JSON.stringify(firstPaint)}`);
  assert(firstPaint.theme==='light'&&firstPaint.glass==='optical',`${name}: first-paint theme/glass state drifted ${JSON.stringify(firstPaint)}`);

  await seen;
  await page.waitForFunction(()=>document.querySelector('#loadingLine')?.classList.contains('active'));
  await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolBootReady==='true');
  await page.waitForTimeout(60);
  const loading=await page.evaluate(required=>{
    const card=document.querySelector('.timetable-card'),overlay=getComputedStyle(card,'::after'),links=[...document.querySelectorAll('link[rel="stylesheet"]')];
    const counts=Object.fromEntries(required.map(path=>[path,links.filter(link=>{try{return new URL(link.href,location.href).pathname===path}catch{return false}}).length]));
    return{active:document.querySelector('#loadingLine')?.classList.contains('active'),overlayOpacity:Number(overlay.opacity||0),cardOpacity:Number(getComputedStyle(card).opacity||1),counts,landingDisplay:getComputedStyle(document.querySelector('#landing')).display,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  },REQUIRED);
  assert(loading.active&&loading.overlayOpacity>.5&&loading.cardOpacity<.9,`${name}: dashboard request did not become a material skeleton ${JSON.stringify(loading)}`);
  assert(loading.landingDisplay==='none',`${name}: landing returned during data load`);
  assert(Object.values(loading.counts).every(count=>count===1),`${name}: final visual styles are missing or duplicated ${JSON.stringify(loading.counts)}`);
  assert(loading.overflow<=3,`${name}: loading shell overflow ${loading.overflow}`);
  await page.screenshot({path:`${OUT}/${name}-loading.png`,fullPage:false,animations:'disabled'});

  releaseDashboard();
  await page.waitForFunction(()=>!document.querySelector('#loadingLine')?.classList.contains('active'));
  await page.locator('#timetable .period-button, #timetable .timetable-state').first().waitFor({state:'visible'});
  await page.waitForFunction(()=>document.documentElement.dataset.flowRefractionCopy==='true');
  await page.locator(`.flow-adfit-slot[data-ad-unit="${AD_UNIT}"]`).waitFor({state:'visible',timeout:8000});
  await page.waitForTimeout(280);
  const ready=await page.evaluate(adUnit=>{
    const nav=document.querySelector('#bottomNav'),style=getComputedStyle(nav),slot=document.querySelector('.flow-adfit-slot'),boot=document.querySelector('#flowSchoolBoot');
    const r=nav.getBoundingClientRect();return{presentation:document.documentElement.dataset.flowSchoolPresentation||'',bootConnected:Boolean(boot),landingDisplay:getComputedStyle(document.querySelector('#landing')).display,navBackground:style.backgroundColor,navBackdrop:style.backdropFilter||style.webkitBackdropFilter||'',navRect:{left:r.left,right:r.right,bottom:r.bottom,width:r.width},refraction:document.documentElement.dataset.flowRefractionCopy||'',unit:slot?.dataset.adUnit||'',sdkCount:document.querySelectorAll('script[data-flow-adfit-sdk]').length,slotCount:document.querySelectorAll('.flow-adfit-slot').length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,adUnit};
  },AD_UNIT);
  assert(ready.presentation==='ready'&&!ready.bootConnected&&ready.landingDisplay==='none',`${name}: boot did not hand off cleanly ${JSON.stringify(ready)}`);
  assert(ready.refraction==='true'&&/blur\(/.test(ready.navBackdrop),`${name}: School Optical Glass runtime not active ${JSON.stringify(ready)}`);
  assert(alpha(ready.navBackground)<.9,`${name}: School glass remained nearly opaque ${JSON.stringify(ready)}`);
  assert(ready.unit===AD_UNIT&&ready.sdkCount===1&&ready.slotCount===1,`${name}: approved AdFit unit was not wired exactly once ${JSON.stringify(ready)}`);
  assert(ready.overflow<=3,`${name}: ready state overflow ${ready.overflow}`);
  assert(errors.length===0&&consoleErrors.length===0,`${name}: browser errors ${JSON.stringify({errors,consoleErrors})}`);
  await page.screenshot({path:`${OUT}/${name}-ready.png`,fullPage:false,animations:'disabled'});
  report.cases.push({name,viewport,firstPaint,loading,ready:{...ready,navAlpha:alpha(ready.navBackground)},errors,consoleErrors});
  await context.close();
}

await run('mobile-390',{width:390,height:844});
await run('desktop-1366',{width:1366,height:768});
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
await browser.close();
console.log(JSON.stringify(report,null,2));
