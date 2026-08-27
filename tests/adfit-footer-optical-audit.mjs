import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='adfit-footer-optical-audit';
const UNIT='DAN-ovpJn5XCBs1n1owQ';
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
const viewports=[['mobile-portrait',390,844],['mobile-landscape',844,390],['desktop',1366,768]];
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report=[];

function assert(value,message){if(!value)throw new Error(message)}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function ymd(){const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`}

for(const [name,width,height] of viewports){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<=520,hasTouch:width<=900,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const consoleErrors=[],pageErrors=[];page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});page.on('pageerror',error=>pageErrors.push(error.message));
  await page.route('https://t1.kakaocdn.net/kas/static/ba.min.js',route=>route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:`document.querySelectorAll('.kakao_ad_area').forEach(function(el){el.style.display='block';var ad=document.createElement('span');ad.className='flow-adfit-mock';ad.style.cssText='display:flex;width:'+el.dataset.adWidth+'px;max-width:100%;height:'+el.dataset.adHeight+'px;align-items:center;justify-content:center;border-radius:12px;background:#f0f2f5;color:#727a88;font:600 12px sans-serif';ad.textContent='Kakao AdFit · footer test';el.append(ad);});`}));
  await page.route('**/functions/v1/school-data**',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'',date=ymd();
    if(action==='dashboard')return json(route,{school:SCHOOL,selected:date,from:date,to:date,timetable:Array.from({length:7},(_,i)=>({date,period:i+1,subject:['문학','수학Ⅱ','영어Ⅱ','화학','미적분','정보','체육'][i],grade:'2',className:'6'})),meals:[{date,type:'중식',dishes:['현미밥','미역국','닭갈비'],calories:'720 Kcal'}],events:[],scheduleMeta:{mode:'fixture',count:0}});
    if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});
    if(action==='place')return json(route,{provider:'kakao',place:null});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({school})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','optical')},{school:SCHOOL});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('#dashboard:not(.hidden)').waitFor();
  await page.locator(`body > .flow-adfit-rail .flow-adfit-slot[data-ad-unit="${UNIT}"]`).waitFor({state:'visible'});
  await page.waitForFunction(()=>document.documentElement.dataset.flowRefractionCopy==='true');
  await page.waitForTimeout(160);
  await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
  await page.waitForTimeout(100);
  const state=await page.evaluate(unit=>{
    const rail=document.querySelector('body > .flow-adfit-rail'),slot=rail?.querySelector('.flow-adfit-slot'),creative=rail?.querySelector('.flow-adfit-mock'),app=document.querySelector('#dashboard'),nav=[...document.querySelectorAll('.mobile-bottom-nav,.bottom-nav')].find(node=>getComputedStyle(node).display!=='none');
    const rr=rail?.getBoundingClientRect(),cr=creative?.getBoundingClientRect(),ar=app?.getBoundingClientRect(),nr=nav?.getBoundingClientRect();
    return{unit:slot?.dataset.adUnit||'',totalSlots:document.querySelectorAll('.flow-adfit-slot').length,totalRails:document.querySelectorAll('.flow-adfit-rail').length,lensSlots:document.querySelectorAll('.flow-refraction-copy-lens .flow-adfit-slot').length,lensRails:document.querySelectorAll('.flow-refraction-copy-lens .flow-adfit-rail').length,label:rail?.querySelector('.flow-adfit-label')?.textContent?.trim()||'',bodyOwned:rail?.parentElement===document.body,afterApp:Boolean(app&&rail&&app.compareDocumentPosition(rail)&Node.DOCUMENT_POSITION_FOLLOWING),rail:rr?{top:rr.top,bottom:rr.bottom,width:rr.width}:null,creative:cr?{top:cr.top,bottom:cr.bottom,left:cr.left,right:cr.right,width:cr.width,height:cr.height}:null,app:ar?{bottom:ar.bottom}:null,nav:nr?{top:nr.top,bottom:nr.bottom}:null,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,refraction:document.documentElement.dataset.flowRefractionCopy||'',sdkCount:document.querySelectorAll('script[data-flow-adfit-sdk]').length,unitExpected:unit};
  },UNIT);
  assert(state.unit===UNIT,`${name}: approved unit drifted ${JSON.stringify(state)}`);
  assert(state.totalSlots===1&&state.totalRails===1&&state.sdkCount===1,`${name}: AdFit must exist exactly once ${JSON.stringify(state)}`);
  assert(state.lensSlots===0&&state.lensRails===0,`${name}: Optical source copy duplicated monetization DOM ${JSON.stringify(state)}`);
  assert(state.bodyOwned&&state.afterApp,`${name}: AdFit is not the document footer after the app ${JSON.stringify(state)}`);
  assert(state.label==='광고',`${name}: disclosure label missing ${JSON.stringify(state)}`);
  assert(state.creative&&Math.abs(state.creative.width-320)<=2&&Math.abs(state.creative.height-100)<=2,`${name}: creative geometry drifted ${JSON.stringify(state)}`);
  assert(state.rail&&state.rail.width<=420.5,`${name}: footer rail is visually oversized ${JSON.stringify(state)}`);
  assert(state.overflow<=3,`${name}: footer introduced horizontal overflow ${JSON.stringify(state)}`);
  if(state.nav)assert(state.creative.bottom<=state.nav.top-16||state.creative.top>=state.nav.bottom+16,`${name}: footer creative collides with mobile nav ${JSON.stringify(state)}`);
  assert(state.refraction==='true',`${name}: Optical baseline did not initialize ${JSON.stringify(state)}`);
  assert(consoleErrors.length===0&&pageErrors.length===0,`${name}: browser errors ${JSON.stringify({consoleErrors,pageErrors})}`);
  await page.screenshot({path:`${OUT}/${name}.png`,fullPage:false,animations:'disabled'});
  report.push({name,viewport:{width,height},state,consoleErrors,pageErrors});
  await context.close();
}
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
await browser.close();
console.log(JSON.stringify(report,null,2));
