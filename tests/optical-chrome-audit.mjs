import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='optical-chrome-audit';
const GLASS_KEY='flow-glass-mode-v2';
const viewports=[
  ['mobile-portrait',390,844],['mobile-landscape',844,390],['tablet-portrait',768,1024],
  ['tablet-landscape',1024,768],['desktop-1366',1366,768],['desktop-1920',1920,1080],
];
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={cases:[],failures:[]};

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function fingerprint(state){return [state.backgroundImage,state.backgroundColor,state.backdropFilter,state.borderColor,state.boxShadow].join('|')}

async function preparePage(app,mode,width,height){
  const context=await browser.newContext({viewport:{width,height},locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',hasTouch:width<=1024,isMobile:width<=520});
  const page=await context.newPage();
  if(app==='school'){
    const school={officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
    await page.route('**/functions/v1/school-data**',route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='dashboard')return json(route,{school,timetable:[],meals:[],events:[]});if(action==='media')return json(route,{media:{},homepage:school.homepage});if(action==='place')return json(route,{provider:'kakao',place:null});return json(route,{})});
    await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
    await page.addInitScript(({school,mode,key})=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem(key,mode)},{school,mode,key:GLASS_KEY});
    await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor({timeout:10000});
  }else{
    const university={id:'knu',name:'경북대학교',kind:'대학교',address:'대구광역시 북구 대학로 80',homepage:'https://www.knu.ac.kr'};
    await page.route('**/functions/v1/university-data**',route=>json(route,{school:university,metrics:{},partial:false,unavailable:[]}));
    await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
    await page.addInitScript(({university,mode,key})=>{localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[]}));localStorage.setItem('flow-university-theme-v1','light');localStorage.setItem(key,mode)},{university,mode,key:GLASS_KEY});
    await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#appView:not(.hidden)').waitFor({timeout:10000});
  }
  await page.waitForFunction(expected=>document.documentElement.dataset.flowGlassMode===expected,mode,{timeout:5000});
  await page.waitForFunction(()=>Boolean(document.querySelector('style#flow-liquid-glass-runtime-style')),null,{timeout:5000});
  await page.waitForTimeout(180);
  return{context,page};
}

async function materialState(page,app){return page.evaluate(app=>{
  const visible=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1};
  const selectors=app==='school'?['.mobile-topbar','.desktop-sidebar']:['.mobile-header','.sidebar'];
  const chrome=selectors.map(s=>document.querySelector(s)).find(visible);
  const content=document.querySelector(app==='school'?'.status-card':'.summary-card:not(.next-card)');
  const describe=el=>{if(!el)return null;const s=getComputedStyle(el),r=el.getBoundingClientRect();return{className:el.className,backgroundImage:s.backgroundImage,backgroundColor:s.backgroundColor,backdropFilter:s.backdropFilter||s.webkitBackdropFilter||'none',borderColor:s.borderColor,boxShadow:s.boxShadow,rect:{left:r.left,top:r.top,width:r.width,height:r.height}}};
  return{mode:document.documentElement.dataset.flowGlassMode||'',refraction:document.documentElement.dataset.flowGlassRefraction||'',chrome:describe(chrome),content:describe(content),width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth};
},app)}

async function sheetState(page,app,{capture=null}={}){
  await page.evaluate(app=>{const dialog=document.querySelector(app==='school'?'#settingsDialog':'#flowUniversitySettingsDialog');if(dialog&&!dialog.open)dialog.showModal()},app);
  await page.waitForTimeout(120);
  const state=await page.evaluate(app=>{const dialog=document.querySelector(app==='school'?'#settingsDialog':'#flowUniversitySettingsDialog'),sheet=dialog?.querySelector(':scope > .sheet, :scope > .dialog-sheet');if(!sheet)return null;const s=getComputedStyle(sheet),r=sheet.getBoundingClientRect();return{backgroundImage:s.backgroundImage,backgroundColor:s.backgroundColor,backdropFilter:s.backdropFilter||s.webkitBackdropFilter||'none',borderColor:s.borderColor,boxShadow:s.boxShadow,rect:{left:r.left,top:r.top,width:r.width,height:r.height}}},app);
  if(capture)await page.screenshot({path:capture,fullPage:false,animations:'disabled'});
  await page.evaluate(app=>{const dialog=document.querySelector(app==='school'?'#settingsDialog':'#flowUniversitySettingsDialog');if(dialog?.open)dialog.close()},app);
  return state;
}

for(const app of ['school','university'])for(const[name,width,height]of viewports){
  let standardContext,opticalContext;
  try{
    const standard=await preparePage(app,'standard',width,height);standardContext=standard.context;
    const standardState=await materialState(standard.page,app),standardSheet=await sheetState(standard.page,app);
    await standard.page.screenshot({path:`${OUT}/${app}-${name}-standard.png`,fullPage:false,animations:'disabled'});

    const optical=await preparePage(app,'optical',width,height);opticalContext=optical.context;
    const opticalState=await materialState(optical.page,app),opticalSheet=await sheetState(optical.page,app,{capture:`${OUT}/${app}-${name}-optical-settings.png`});
    await optical.page.screenshot({path:`${OUT}/${app}-${name}-optical.png`,fullPage:false,animations:'disabled'});

    if(!standardState.chrome||!opticalState.chrome)throw new Error('Visible chrome surface missing.');
    if(standardState.mode!=='standard'||opticalState.mode!=='optical')throw new Error(`Glass mode did not apply: ${standardState.mode}/${opticalState.mode}`);
    if(fingerprint(standardState.chrome)===fingerprint(opticalState.chrome))throw new Error('Optical mode did not change the visible app chrome material.');
    if(!/gradient/i.test(opticalState.chrome.backgroundImage))throw new Error(`Optical chrome lacks specular material: ${opticalState.chrome.backgroundImage}`);
    if(opticalState.content?.backdropFilter!=='none')throw new Error(`Content surface became glass: ${opticalState.content?.backdropFilter}`);
    if(!standardSheet||!opticalSheet)throw new Error('Settings sheet material missing.');
    if(fingerprint(standardSheet)===fingerprint(opticalSheet)||!/gradient/i.test(opticalSheet.backgroundImage))throw new Error('Optical settings sheet is not visibly distinct.');
    if(opticalState.scrollWidth>opticalState.width+3)throw new Error(`Horizontal overflow: ${opticalState.scrollWidth}/${opticalState.width}`);
    report.cases.push({app,name,width,height,standard:standardState,optical:opticalState,standardSheet,opticalSheet});
  }catch(error){report.failures.push({app,name,error:String(error)});}
  finally{await standardContext?.close();await opticalContext?.close()}
}
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
await browser.close();
console.log(JSON.stringify(report,null,2));
if(report.failures.length)process.exitCode=1;
