import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='liquid-glass-stability-audit';
const GLASS_KEY='flow-glass-mode-v2';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function firstSeconds(value='0s'){const first=String(value).split(',')[0].trim();return first.endsWith('ms')?Number.parseFloat(first)/1000:Number.parseFloat(first)||0}
function matrixX(transform='none'){
  if(!transform||transform==='none')return 0;
  const match=transform.match(/matrix(?:3d)?\(([^)]+)\)/);if(!match)return NaN;
  const values=match[1].split(',').map(Number);return values.length===16?values[12]:values[4];
}
async function navState(page,navSelector){
  return page.evaluate(navSelector=>{
    const nav=document.querySelector(navSelector);if(!nav)return null;
    const real=[...nav.querySelectorAll(':scope > .mobile-tab, :scope > .bottom-item')].filter(node=>!node.hidden&&getComputedStyle(node).display!=='none');
    const isSettings=node=>node.id==='mobileSettingsBtn'||node.classList.contains('flow-mobile-settings');
    const describe=node=>isSettings(node)?'settings':node.dataset.view||node.textContent.trim();
    const rect=nav.getBoundingClientRect(),pseudo=getComputedStyle(nav,'::before'),settings=real.find(isSettings);
    return{
      order:real.map(describe),
      centers:real.map(node=>{const r=node.getBoundingClientRect();return(r.left+r.right)/2}),
      widths:real.map(node=>node.getBoundingClientRect().width),
      settingsRect:settings?(()=>{const r=settings.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,grid:getComputedStyle(settings).gridColumnStart}})():null,
      navRect:{left:rect.left,right:rect.right,width:rect.width},
      pseudo:{transform:pseudo.transform,transitionDuration:pseudo.transitionDuration,backgroundColor:pseudo.backgroundColor},
      inlineX:nav.style.getPropertyValue('--flow-lens-x')||'',
      active:real.findIndex(node=>node.classList.contains('active')),
      rootMode:document.documentElement.dataset.flowGlassMode||'',
      refraction:document.documentElement.dataset.flowGlassRefraction||'',
      helper:Boolean(nav.querySelector(':scope > .flow-refraction-copy-lens')),
      scroll:{client:document.documentElement.clientWidth,width:document.documentElement.scrollWidth}
    };
  },navSelector);
}
function assertOrder(state,expected,label){
  if(!state)throw new Error(`${label}: nav missing`);
  if(JSON.stringify(state.order)!==JSON.stringify(expected))throw new Error(`${label}: wrong nav order ${JSON.stringify(state.order)}`);
  if(!state.settingsRect)throw new Error(`${label}: settings missing`);
  if(state.scroll.width>state.scroll.client+3)throw new Error(`${label}: horizontal overflow ${JSON.stringify(state.scroll)}`);
  for(let i=1;i<state.centers.length;i++)if(!(state.centers[i]>state.centers[i-1]+8))throw new Error(`${label}: controls are not ordered left-to-right ${JSON.stringify(state.centers)}`);
}
function assertSettledSettings(state,label){
  const count=state.order.length,slot=(state.navRect.width-10)/count,expected=(count-1)*slot,x=matrixX(state.pseudo.transform);
  if(state.active!==count-1)throw new Error(`${label}: settings is not active final slot ${JSON.stringify(state)}`);
  if(Math.abs(x-expected)>3)throw new Error(`${label}: lens is not aligned to settings (${x} vs ${expected})`);
  if(firstSeconds(state.pseudo.transitionDuration)>.24)throw new Error(`${label}: lens default transition is still sluggish ${state.pseudo.transitionDuration}`);
}
async function dragWithoutMovingSettings(page,{nav,from,to,label}){
  const before=await navState(page,nav),a=await page.locator(from).boundingBox(),b=await page.locator(to).boundingBox();
  if(!a||!b)throw new Error(`${label}: drag geometry missing`);
  const start={x:a.x+a.width/2,y:a.y+a.height/2},end={x:b.x+b.width/2,y:b.y+b.height/2};
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.waitForTimeout(35);await page.mouse.move(end.x,end.y,{steps:7});await page.waitForTimeout(25);
  const during=await navState(page,nav);
  if(Math.abs((during.settingsRect?.left??0)-(before.settingsRect?.left??0))>1)throw new Error(`${label}: settings moved during lens drag ${JSON.stringify({before:before.settingsRect,during:during.settingsRect})}`);
  if(firstSeconds(during.pseudo.transitionDuration)>.01)throw new Error(`${label}: direct drag is not realtime ${during.pseudo.transitionDuration}`);
  await page.mouse.up();await page.waitForTimeout(430);
  const after=await navState(page,nav);
  if(Math.abs((after.settingsRect?.left??0)-(before.settingsRect?.left??0))>1)throw new Error(`${label}: settings moved after lens settle ${JSON.stringify({before:before.settingsRect,after:after.settingsRect})}`);
  if(after.scroll.width>after.scroll.client+3)throw new Error(`${label}: drag caused overflow`);
  return{before,during,after};
}

async function schoolStandard(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});const page=await context.newPage();
  const school={officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
  await page.route('**/functions/v1/school-data**',async route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='dashboard')return json(route,{school,selected:'20260824',from:'20260824',to:'20260828',timetable:[],meals:[],events:[],scheduleMeta:{mode:'fixture',count:0}});if(action==='media')return json(route,{media:{},homepage:school.homepage});if(action==='place')return json(route,{provider:'kakao',place:null});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({school,key})=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem(key,'standard')},{school,key:GLASS_KEY});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();
  await page.waitForFunction(()=>!document.querySelector('#bottomNav > [data-view="week"]')&&document.querySelector('#bottomNav > [data-view="transit"]')&&document.querySelector('#mobileSettingsBtn'));
  let state=await navState(page,'#bottomNav');assertOrder(state,['today','schedule','transit','school','settings'],'school standard');
  if(state.settingsRect.grid!=='5')throw new Error(`school standard: settings grid column drifted ${JSON.stringify(state.settingsRect)}`);
  if(state.rootMode!=='standard'||state.helper)throw new Error(`school standard: Optical helper leaked into Standard ${JSON.stringify(state)}`);
  await page.locator('#mobileSettingsBtn').click();await page.waitForTimeout(280);state=await navState(page,'#bottomNav');assertSettledSettings(state,'school standard');
  await page.locator('#bottomNav > [data-view="today"]').click();await page.waitForTimeout(280);
  const drag=await dragWithoutMovingSettings(page,{nav:'#bottomNav',from:'#bottomNav > [data-view="today"]',to:'#bottomNav > [data-view="school"]',label:'school standard'});
  await page.screenshot({path:`${OUT}/school-standard.png`,fullPage:false,animations:'disabled'});await context.close();return{settings:state,drag};
}

async function university(mode='standard'){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});const page=await context.newPage();
  const university={id:'knu',name:'경북대학교',kind:'대학교',address:'대구광역시 북구 대학로 80',homepage:'https://www.knu.ac.kr'};
  await page.route('**/functions/v1/university-data**',route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='profile')return json(route,{school:university,metrics:{},partial:false,unavailable:[]});if(action==='majors')return json(route,{schools:[],majors:[]});return json(route,{school:university,metrics:{},partial:false,unavailable:[]})});
  await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
  await page.addInitScript(({university,mode,key})=>{localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[]}));localStorage.setItem('flow-university-theme-v1','light');localStorage.setItem(key,mode)},{university,mode,key:GLASS_KEY});
  await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#appView:not(.hidden)').waitFor();
  await page.waitForFunction(()=>document.querySelector('.bottom-nav > [data-view="campus"]')&&document.querySelector('.bottom-nav > .flow-mobile-settings'));
  let state=await navState(page,'.bottom-nav');assertOrder(state,['today','timetable','campus','school','settings'],`university ${mode}`);
  if(state.settingsRect.grid!=='5')throw new Error(`university ${mode}: settings grid column drifted ${JSON.stringify(state.settingsRect)}`);
  if(mode==='standard'){
    if(state.rootMode!=='standard'||state.helper)throw new Error(`university standard: Optical helper leaked ${JSON.stringify(state)}`);
    await page.locator('.bottom-nav > .flow-mobile-settings').click();await page.waitForTimeout(280);state=await navState(page,'.bottom-nav');assertSettledSettings(state,'university standard');
    await page.locator('.bottom-nav > [data-view="today"]').click();await page.waitForTimeout(280);
    const drag=await dragWithoutMovingSettings(page,{nav:'.bottom-nav',from:'.bottom-nav > [data-view="today"]',to:'.bottom-nav > [data-view="school"]',label:'university standard'});
    await page.screenshot({path:`${OUT}/university-standard.png`,fullPage:false,animations:'disabled'});await context.close();return{settings:state,drag};
  }
  await page.waitForFunction(()=>document.documentElement.dataset.flowRefractionCopy==='true'&&document.querySelector('.bottom-nav > .flow-refraction-copy-lens'),null,{timeout:5000});
  await page.locator('.bottom-nav > [data-view="timetable"]').click();
  await page.waitForFunction(()=>{const copy=document.querySelector('.flow-refraction-source-copy');const timetable=copy?.querySelector('[data-panel="timetable"]');return Boolean(timetable&&!timetable.classList.contains('hidden'))},null,{timeout:260});
  await page.waitForTimeout(230);state=await navState(page,'.bottom-nav');
  const tint=String(state.pseudo.backgroundColor||'');if(!tint||tint==='transparent'||tint==='rgba(0, 0, 0, 0)')throw new Error(`university optical: lens still looks punched-through ${tint}`);
  if(firstSeconds(state.pseudo.transitionDuration)>.24)throw new Error(`university optical: helper/rim motion is sluggish ${state.pseudo.transitionDuration}`);
  const helperDuration=await page.locator('.flow-refraction-copy-lens').evaluate(el=>getComputedStyle(el).transitionDuration);
  if(firstSeconds(helperDuration)>.24)throw new Error(`university optical: refraction helper lags rim ${helperDuration}`);
  await page.screenshot({path:`${OUT}/university-optical.png`,fullPage:false,animations:'disabled'});await context.close();return{state,helperDuration};
}

const result={school:await schoolStandard(),universityStandard:await university('standard'),universityOptical:await university('optical')};
await browser.close();console.log(JSON.stringify(result,null,2));