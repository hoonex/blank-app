import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='adfit-layout-audit';
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
const report={cases:[],unconfigured:[],failures:[]};

function assert(condition,message){if(!condition)throw new Error(message)}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function mockSdk(page){
  await page.route('https://t1.kakaocdn.net/kas/static/ba.min.js',route=>route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:`document.querySelectorAll('.kakao_ad_area').forEach(function(el){el.style.display='block';var ad=document.createElement('span');ad.className='flow-adfit-mock';ad.style.cssText='display:inline-flex;box-sizing:border-box;width:'+el.dataset.adWidth+'px;max-width:100%;height:'+el.dataset.adHeight+'px;align-items:center;justify-content:center;border:1px solid rgba(80,90,110,.16);border-radius:12px;background:rgba(246,247,249,.96);color:#6f7785;font:600 12px/1.2 sans-serif';ad.textContent='Kakao AdFit · test creative';el.append(ad);});`}));
}
async function fixtures(page,app,configured=true){
  await mockSdk(page);
  if(configured)await page.addInitScript(({app})=>{window.__FLOW_ADFIT_CONFIG={[app]:{unit:`DAN-test-${app}`,width:320,height:100}}},{app});
  if(app==='school'){
    const school={officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
    const timetable=Array.from({length:7},(_,i)=>({date:'20260825',period:i+1,subject:['국어','수학','영어Ⅱ','화학','미적분','정보','체육'][i]}));
    await page.route('**/functions/v1/school-data**',route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='dashboard')return json(route,{school,selected:'20260825',from:'20260824',to:'20260828',timetable,meals:[{date:'20260825',type:'중식',menu:['현미밥','미역국','닭갈비'],calories:'720 Kcal'}],events:[{date:'20260827',name:'동아리 활동'}],scheduleMeta:{mode:'fixture',count:1}});if(action==='media')return json(route,{media:{},homepage:school.homepage});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});return json(route,{})});
    await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
    await page.addInitScript(school=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light')},school);
  }else{
    const university={id:'knu',name:'경북대학교',kind:'대학교',address:'대구광역시 북구 대학로 80',homepage:'https://www.knu.ac.kr'};
    await page.route('**/functions/v1/university-data**',route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='majors')return json(route,{schools:[],majors:[]});return json(route,{school:university,metrics:{students:'32,000',faculty:'1,200'},partial:false,unavailable:[]})});
    await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
    await page.addInitScript(university=>{localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[{name:'네트워크',times:[{day:1,start:'14:00',end:'15:15',startMinutes:840,endMinutes:915,place:'IT융합산업빌딩'}]}]}));localStorage.setItem('flow-university-theme-v1','light')},university);
  }
}
async function prepare(app,width,height,configured=true){
  const context=await browser.newContext({viewport:{width,height},locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',hasTouch:width<=1024,isMobile:width<=520});
  const page=await context.newPage(),consoleErrors=[],pageErrors=[];
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});page.on('pageerror',error=>pageErrors.push(error.message));
  await fixtures(page,app,configured);
  await page.goto(app==='school'?BASE:`${BASE}/university/`,{waitUntil:'domcontentloaded'});
  await page.locator(app==='school'?'#dashboard:not(.hidden)':'#appView:not(.hidden)').waitFor({timeout:12000});
  if(configured){await page.locator(`.flow-adfit-slot[data-flow-adfit-kind="${app}"]`).waitFor({state:'visible',timeout:8000});await page.locator('.flow-adfit-mock').waitFor({state:'visible',timeout:4000})}
  else await page.waitForFunction(()=>document.documentElement.dataset.flowAdfit==='unconfigured',null,{timeout:6000});
  return{context,page,consoleErrors,pageErrors};
}
async function auditConfigured(app,name,width,height){
  const {context,page,consoleErrors,pageErrors}=await prepare(app,width,height,true);
  try{
    const slot=page.locator(`.flow-adfit-slot[data-flow-adfit-kind="${app}"]`),creative=slot.locator('.flow-adfit-mock');
    await slot.scrollIntoViewIfNeeded();await page.waitForTimeout(80);
    const geometry=await page.evaluate(app=>{
      const slot=document.querySelector(`.flow-adfit-slot[data-flow-adfit-kind="${app}"]`),creative=slot?.querySelector('.flow-adfit-mock'),nav=[...document.querySelectorAll('.mobile-bottom-nav,.bottom-nav')].find(node=>getComputedStyle(node).display!=='none');
      const s=slot?.getBoundingClientRect(),c=creative?.getBoundingClientRect(),n=nav?.getBoundingClientRect();
      return{slot:s?{left:s.left,top:s.top,right:s.right,bottom:s.bottom,width:s.width,height:s.height}:null,creative:c?{left:c.left,top:c.top,right:c.right,bottom:c.bottom,width:c.width,height:c.height}:null,nav:n?{left:n.left,top:n.top,right:n.right,bottom:n.bottom}:null,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,sdkCount:document.querySelectorAll('script[data-flow-adfit-sdk]').length,slotCount:document.querySelectorAll('.flow-adfit-slot').length,unit:slot?.dataset.adUnit||'',width:slot?.dataset.adWidth||'',height:slot?.dataset.adHeight||''};
    },app);
    assert(geometry.slot&&geometry.creative,`${app}/${name}: rendered AdFit slot missing`);
    assert(geometry.creative.width<=width+1&&geometry.creative.left>=-1&&geometry.creative.right<=width+1,`${app}/${name}: creative outside viewport ${JSON.stringify(geometry.creative)}`);
    assert(Math.abs(geometry.creative.width-Math.min(320,width))<=2||geometry.creative.width===320,`${app}/${name}: unexpected creative width ${geometry.creative.width}`);
    assert(Math.abs(geometry.creative.height-100)<=2,`${app}/${name}: unexpected creative height ${geometry.creative.height}`);
    assert(geometry.sdkCount===1&&geometry.slotCount===1,`${app}/${name}: duplicate SDK/slot ${JSON.stringify(geometry)}`);
    assert(geometry.unit===`DAN-test-${app}`&&geometry.width==='320'&&geometry.height==='100',`${app}/${name}: AdFit attributes changed ${JSON.stringify(geometry)}`);
    assert(geometry.overflow<=3,`${app}/${name}: horizontal overflow ${geometry.overflow}`);
    if(width<=900&&geometry.nav)assert(geometry.creative.bottom<=geometry.nav.top-16||geometry.creative.top>=geometry.nav.bottom+16,`${app}/${name}: ad touches mobile navigation ${JSON.stringify(geometry)}`);
    assert(consoleErrors.length===0,`${app}/${name}: console errors ${JSON.stringify(consoleErrors)}`);assert(pageErrors.length===0,`${app}/${name}: page errors ${JSON.stringify(pageErrors)}`);
    await page.screenshot({path:`${OUT}/${app}-${name}.png`,fullPage:false,animations:'disabled'});
    return{app,name,viewport:{width,height},geometry,consoleErrors,pageErrors};
  }finally{await context.close()}
}
async function auditUnconfigured(app){
  const {context,page,consoleErrors,pageErrors}=await prepare(app,390,844,false);
  try{
    const state=await page.evaluate(()=>({mode:document.documentElement.dataset.flowAdfit,slots:document.querySelectorAll('.flow-adfit-slot').length,sdk:document.querySelectorAll('script[data-flow-adfit-sdk]').length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
    assert(state.mode==='unconfigured'&&state.slots===0&&state.sdk===0,`${app}: unconfigured AdFit should be zero-cost ${JSON.stringify(state)}`);assert(state.overflow<=3,`${app}: unconfigured overflow ${state.overflow}`);assert(consoleErrors.length===0&&pageErrors.length===0,`${app}: unconfigured errors ${JSON.stringify({consoleErrors,pageErrors})}`);return{app,...state};
  }finally{await context.close()}
}

for(const app of ['school','university'])for(const [name,width,height] of viewports){try{report.cases.push(await auditConfigured(app,name,width,height))}catch(error){report.failures.push(`${app}/${name}: ${error.message}`)}}
for(const app of ['school','university']){try{report.unconfigured.push(await auditUnconfigured(app))}catch(error){report.failures.push(`${app}/unconfigured: ${error.message}`)}}
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));await browser.close();
if(report.failures.length){console.error(JSON.stringify(report,null,2));process.exit(1)}
console.log(JSON.stringify(report,null,2));
