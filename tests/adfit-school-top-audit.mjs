import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='adfit-school-top-audit';
const UNIT='DAN-ovpJn5XCBs1n1owQ';
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
const standardViewports=[
  ['mobile-portrait',390,844],
  ['mobile-landscape',844,390],
  ['tablet-portrait',768,1024],
  ['tablet-landscape',1024,768],
  ['desktop-1366',1366,768],
  ['desktop-1920',1920,1080],
];
const opticalViewports=[
  ['mobile-portrait',390,844],
  ['mobile-landscape',844,390],
];

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={cases:[],failures:[]};

function assert(value,message){if(!value)throw new Error(message)}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function ymd(){const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`}

async function prepare(mode,width,height){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<=520,hasTouch:width<=1024,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const consoleErrors=[],pageErrors=[];
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.route('https://t1.kakaocdn.net/kas/static/ba.min.js',route=>route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:`document.querySelectorAll('.kakao_ad_area').forEach(function(el){el.style.display='block';var ad=document.createElement('span');ad.className='flow-adfit-mock';ad.style.cssText='display:flex;box-sizing:border-box;width:'+el.dataset.adWidth+'px;max-width:100%;height:'+el.dataset.adHeight+'px;align-items:center;justify-content:center;border:1px solid rgba(80,90,110,.16);border-radius:12px;background:rgba(246,247,249,.96);color:#6f7785;font:600 12px/1.2 sans-serif';ad.textContent='Kakao AdFit · top test';el.append(ad);});`}));
  await page.route('**/functions/v1/school-data**',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'',date=ymd();
    if(action==='dashboard')return json(route,{school:SCHOOL,selected:date,from:date,to:date,timetable:Array.from({length:7},(_,i)=>({date,period:i+1,subject:['문학','수학Ⅱ','영어Ⅱ','화학','미적분','정보','체육'][i],grade:'2',className:'6'})),meals:[{date,type:'중식',dishes:['현미밥','미역국','닭갈비'],calories:'720 Kcal'}],events:[{date,name:'동아리 활동',content:'학급별 활동',grade1:'N',grade2:'Y',grade3:'N',holidayType:''}],scheduleMeta:{mode:'fixture',count:1}});
    if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});
    if(action==='place')return json(route,{provider:'kakao',place:null});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({school,mode})=>{
    localStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2',mode);
    localStorage.setItem('flow-school-transit-lab-v1','off');
  },{school:SCHOOL,mode});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('#dashboard:not(.hidden)').waitFor();
  await page.locator(`.flow-adfit-rail--school-top .flow-adfit-slot[data-ad-unit="${UNIT}"]`).waitFor({state:'visible'});
  await page.locator('.flow-adfit-rail--school-top .flow-adfit-mock').waitFor({state:'visible'});
  if(mode==='optical')await page.waitForFunction(()=>document.documentElement.dataset.flowRefractionCopy==='true');
  await page.waitForTimeout(180);
  await page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
  return{context,page,consoleErrors,pageErrors};
}

async function audit(mode,name,width,height){
  const {context,page,consoleErrors,pageErrors}=await prepare(mode,width,height);
  try{
    const state=await page.evaluate(()=>{
      const hero=document.querySelector('#todayView .school-hero');
      const rail=document.querySelector('#todayView .flow-adfit-rail--school-top');
      const status=document.querySelector('#todayView .status-grid');
      const slot=rail?.querySelector('.flow-adfit-slot');
      const creative=rail?.querySelector('.flow-adfit-mock');
      const rect=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};
      return{
        hero:rect(hero),rail:rect(rail),status:rect(status),creative:rect(creative),
        immediateAfterHero:hero?.nextElementSibling===rail,
        immediateBeforeStatus:rail?.nextElementSibling===status,
        unit:slot?.dataset.adUnit||'',slotCount:document.querySelectorAll('.flow-adfit-slot').length,
        railCount:document.querySelectorAll('.flow-adfit-rail--school-top').length,
        sdkCount:document.querySelectorAll('script[data-flow-adfit-sdk]').length,
        copiedAdCount:document.querySelectorAll('.flow-refraction-source-copy .flow-adfit-rail,.flow-refraction-source-copy .flow-adfit-slot,.flow-refraction-source-copy .kakao_ad_area').length,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        glassMode:document.documentElement.dataset.flowGlassMode||'',
        refractionCopy:document.documentElement.dataset.flowRefractionCopy||'',
      };
    });
    assert(state.hero&&state.rail&&state.status&&state.creative,`${mode}/${name}: top ad geometry missing`);
    assert(state.immediateAfterHero&&state.immediateBeforeStatus,`${mode}/${name}: expected Hero → ad → status DOM order ${JSON.stringify(state)}`);
    assert(state.hero.bottom<=state.rail.top+1&&state.rail.bottom<=state.status.top+1,`${mode}/${name}: visual order overlaps ${JSON.stringify(state)}`);
    assert(state.unit===UNIT,`${mode}/${name}: approved School unit changed (${state.unit})`);
    assert(state.slotCount===1&&state.railCount===1&&state.sdkCount===1,`${mode}/${name}: duplicate AdFit runtime ${JSON.stringify(state)}`);
    assert(Math.abs(state.creative.width-Math.min(320,width))<=2||Math.abs(state.creative.width-320)<=2,`${mode}/${name}: creative width ${state.creative.width}`);
    assert(Math.abs(state.creative.height-100)<=2,`${mode}/${name}: creative height ${state.creative.height}`);
    assert(state.creative.left>=-1&&state.creative.right<=width+1,`${mode}/${name}: creative outside viewport ${JSON.stringify(state.creative)}`);
    assert(state.creative.top<height,`${mode}/${name}: School ad does not begin in the first viewport ${JSON.stringify(state.creative)}`);
    assert(state.overflow<=3,`${mode}/${name}: horizontal overflow ${state.overflow}`);
    if(mode==='optical'){
      assert(state.glassMode==='optical'&&state.refractionCopy==='true',`${mode}/${name}: Optical refraction inactive ${JSON.stringify(state)}`);
      assert(state.copiedAdCount===0,`${mode}/${name}: AdFit leaked into Optical source copy ${state.copiedAdCount}`);
      const schedule=page.locator('.mobile-bottom-nav [data-view="schedule"]:visible').first();
      const today=page.locator('.mobile-bottom-nav [data-view="today"]:visible').first();
      await schedule.click();await page.waitForTimeout(90);await today.click();await page.waitForTimeout(140);
      const copiedAfterNavigation=await page.locator('.flow-refraction-source-copy .flow-adfit-rail,.flow-refraction-source-copy .flow-adfit-slot,.flow-refraction-source-copy .kakao_ad_area').count();
      assert(copiedAfterNavigation===0,`${mode}/${name}: AdFit leaked after Optical source refresh (${copiedAfterNavigation})`);
      state.copiedAfterNavigation=copiedAfterNavigation;
    }
    assert(consoleErrors.length===0,`${mode}/${name}: console errors ${JSON.stringify(consoleErrors)}`);
    assert(pageErrors.length===0,`${mode}/${name}: page errors ${JSON.stringify(pageErrors)}`);
    await page.screenshot({path:`${OUT}/${mode}-${name}.png`,fullPage:false,animations:'disabled'});
    return{mode,name,viewport:{width,height},state,consoleErrors,pageErrors};
  }finally{await context.close()}
}

for(const [name,width,height] of standardViewports){
  try{report.cases.push(await audit('standard',name,width,height))}catch(error){report.failures.push(`standard/${name}: ${error.message}`)}
}
for(const [name,width,height] of opticalViewports){
  try{report.cases.push(await audit('optical',name,width,height))}catch(error){report.failures.push(`optical/${name}: ${error.message}`)}
}

await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(report.failures.length){console.error(JSON.stringify(report,null,2));process.exit(1)}
console.log(JSON.stringify(report,null,2));
