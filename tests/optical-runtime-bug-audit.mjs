import { chromium } from 'playwright';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
const ALT={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240202',name:'대구동부고등학교',kind:'고등학교',address:'대구광역시 동구 동부로 1'};

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function ymd(){const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`}
async function fixtures(page){
  await page.route('**/functions/v1/school-data**',async route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'',date=ymd();
    if(action==='dashboard')return json(route,{school:SCHOOL,selected:date,from:date,to:date,timetable:[{date,period:1,subject:'문학',grade:'2',className:'6'}],meals:[],events:[],scheduleMeta:{mode:'fixture',count:0}});
    if(action==='search')return json(route,{schools:[ALT]});
    if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});
    if(action==='place')return json(route,{provider:'kakao',place:null});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',serviceWorkers:'block'});
const page=await context.newPage();
page.setDefaultTimeout(10000);
const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
await fixtures(page);
await page.addInitScript(({school})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','optical')},{school:SCHOOL});
await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.locator('#dashboard:not(.hidden)').waitFor();
await page.waitForFunction(()=>document.documentElement.dataset.flowRefractionCopy==='true'&&document.querySelector('.flow-refraction-source-copy[data-flow-refraction-source="school-main"]'));

// The visual copy must keep ID-scoped CSS, without stealing normal DOM lookups.
await page.evaluate(()=>{
  const style=document.createElement('style');style.id='flowRuntimeFidelityStyle';style.textContent='#flowRefractionFidelityProbe{color:rgb(7,33,71)!important;font-size:37px!important;font-weight:800!important}';document.head.append(style);
  const probe=document.createElement('div');probe.id='flowRefractionFidelityProbe';probe.textContent='ID STYLE PROBE';document.querySelector('.product-main').append(probe);
  window.dispatchEvent(new CustomEvent('flow:refraction-refresh'));
});
await page.waitForFunction(()=>document.querySelector('.flow-refraction-source-copy[data-flow-refraction-source="school-main"] #flowRefractionFidelityProbe'));
const fidelity=await page.evaluate(()=>{
  const original=document.querySelector('.product-main>#flowRefractionFidelityProbe'),copy=document.querySelector('.flow-refraction-source-copy[data-flow-refraction-source="school-main"] #flowRefractionFidelityProbe'),os=getComputedStyle(original),cs=getComputedStyle(copy);
  return{originalLookup:document.getElementById('flowRefractionFidelityProbe')===original,color:[os.color,cs.color],fontSize:[os.fontSize,cs.fontSize]};
});
if(!fidelity.originalLookup||fidelity.color[0]!==fidelity.color[1]||fidelity.fontSize[0]!==fidelity.fontSize[1])throw new Error(`Optical copy lost ID-scoped visual fidelity or stole the source lookup: ${JSON.stringify(fidelity)}`);

// School switching is a full destination surface. The lens must sample it, not the page behind it.
await page.locator('.product-main #mobileSchoolBtn').click();
await page.locator('body > #switchDialog[open][data-flow-dedicated="true"]').waitFor();
await page.waitForFunction(()=>document.querySelector('.flow-refraction-source-copy[data-flow-refraction-source="school-switch"] #switchSearch'));
const sourceState=await page.evaluate(()=>({source:document.querySelector('.flow-refraction-source-copy')?.dataset.flowRefractionSource,hasSwitch:!!document.querySelector('.flow-refraction-source-copy #switchSearch'),hasHero:!!document.querySelector('.flow-refraction-source-copy #heroSchoolName')}));
if(sourceState.source!=='school-switch'||!sourceState.hasSwitch||sourceState.hasHero)throw new Error(`Optical lens sampled the wrong School surface: ${JSON.stringify(sourceState)}`);

// Internal scrolling of the dedicated destination must stay registered to the sampled copy.
const scrollState=await page.evaluate(async()=>{
  const dialog=document.querySelector('body > #switchDialog');
  const filler=document.createElement('div');filler.style.height='420px';filler.setAttribute('aria-hidden','true');dialog.querySelector('.sheet').append(filler);
  dialog.scrollTop=Math.min(120,Math.max(0,dialog.scrollHeight-dialog.clientHeight));window.dispatchEvent(new Event('scroll'));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  const nav=document.querySelector('#bottomNav'),dr=dialog.getBoundingClientRect(),nr=nav.getBoundingClientRect(),expected=dr.top-dialog.scrollTop-(nr.top+5),actual=Number.parseFloat(nav.style.getPropertyValue('--flow-refraction-scene-top'));
  return{scrollTop:dialog.scrollTop,expected,actual,error:Math.abs(expected-actual)};
});
if(scrollState.scrollTop>0&&scrollState.error>2)throw new Error(`Dedicated School surface scroll drifted inside Optical lens: ${JSON.stringify(scrollState)}`);

// Async search content should refresh into the active refraction source.
await page.locator('body > #switchDialog #switchSearch').fill('동부고');
await page.locator('body > #switchDialog #switchResults [data-result-index]').waitFor();
await page.waitForFunction(()=>document.querySelector('.flow-refraction-source-copy[data-flow-refraction-source="school-switch"] #switchResults [data-result-index]'));

// Closing the destination must switch the lens source back to the School page.
await page.evaluate(()=>document.querySelector('body > #switchDialog')?.close());
await page.waitForFunction(()=>document.querySelector('.flow-refraction-source-copy[data-flow-refraction-source="school-main"] #flowRefractionFidelityProbe'));

// BFCache pagehide must not revoke the live displacement-map blob used on restore.
const lifecycle=await page.evaluate(async()=>{
  const image=document.querySelector('#flow-liquid-nav-refraction feImage'),href=image?.getAttribute('href')||'';
  const probe=async()=>{try{return (await fetch(href)).ok}catch{return false}};
  const before=await probe();
  const make=(type,persisted)=>{try{return new PageTransitionEvent(type,{persisted})}catch{const event=new Event(type);Object.defineProperty(event,'persisted',{value:persisted});return event}};
  window.dispatchEvent(make('pagehide',true));const afterHide=await probe();window.dispatchEvent(make('pageshow',true));await new Promise(resolve=>setTimeout(resolve,80));const afterShow=await probe();
  return{href,before,afterHide,afterShow,source:document.querySelector('.flow-refraction-source-copy')?.dataset.flowRefractionSource};
});
if(!lifecycle.href.startsWith('blob:')||!lifecycle.before||!lifecycle.afterHide||!lifecycle.afterShow||lifecycle.source!=='school-main')throw new Error(`Optical BFCache lifecycle broke the displacement map or source: ${JSON.stringify(lifecycle)}`);
if(pageErrors.length)throw new Error(`Page errors during Optical runtime audit: ${JSON.stringify(pageErrors)}`);

console.log(JSON.stringify({fidelity,sourceState,scrollState,lifecycle},null,2));
await context.close();await browser.close();