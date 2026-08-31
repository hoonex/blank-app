import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='native-feel-audit';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function waitMaterial(page){
  await page.waitForFunction(()=>[...document.styleSheets].some(s=>{try{return new URL(s.href||'',location.href).pathname==='/flow-material.css'}catch{return false}}),null,{timeout:10000});
  await page.waitForTimeout(160);
}
async function glassState(page,nav){
  return page.evaluate((selector)=>{
    const root=document.documentElement,n=document.querySelector(selector),ns=n?getComputedStyle(n,'::before'):null,sample=n?.querySelector('.flow-refraction-sample'),ss=sample?getComputedStyle(sample):null;
    return{mode:root.dataset.flowGlassMode||'',refraction:root.dataset.flowGlassRefraction||'',copy:root.dataset.flowRefractionCopy||'',stored:localStorage.getItem('flow-glass-mode-v2'),navBackdrop:ns?.backdropFilter||ns?.webkitBackdropFilter||'',sampleFilter:ss?.filter||'',navFilter:Boolean(document.querySelector('#flow-liquid-nav-refraction')),copyLens:Boolean(n?.querySelector('.flow-refraction-copy-lens')),rootWidth:root.clientWidth,scrollWidth:root.scrollWidth};
  },nav);
}
async function mockSchool(page){
  const school={officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
  await page.route('**/functions/v1/school-data**',async route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='dashboard')return json(route,{school,selected:'20260823',from:'20260823',to:'20260823',timetable:[],meals:[],events:[],scheduleMeta:{mode:'fixture',count:0}});if(action==='media')return json(route,{media:{},homepage:school.homepage});if(action==='place')return json(route,{provider:'kakao',place:null});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({school})=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light')},{school});
}
async function mockUniversity(page){
  const university={id:'knu',name:'경북대학교',kind:'대학교',address:'대구광역시 북구 대학로 80',homepage:'https://www.knu.ac.kr'};
  await page.route('**/functions/v1/university-data**',route=>json(route,{school:university,metrics:{},partial:false,unavailable:[]}));
  await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
  await page.addInitScript(({university})=>{localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[]}));localStorage.setItem('flow-university-theme-v1','light')},{university});
}

async function schoolMobile(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});const page=await context.newPage();
  await mockSchool(page);await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await waitMaterial(page);
  const trigger=page.locator('#bottomNav > #mobileSettingsBtn');await trigger.waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#bottomNav>[data-view="transit"]'));
  const shell=await page.evaluate(()=>{const nav=document.querySelector('#bottomNav'),settings=document.querySelector('#mobileSettingsBtn'),items=[...nav.querySelectorAll(':scope > .mobile-tab')].filter(x=>getComputedStyle(x).display!=='none'),week=document.querySelector('.timetable-mode-toggle > .mobile-tab[data-view="week"]');return{count:items.length,settingsLast:settings===items.at(-1),transitInline:Boolean(nav.querySelector(':scope > [data-view="transit"]')),weekInBottom:Boolean(nav.querySelector(':scope > [data-view="week"]')),weekInline:Boolean(week),grid:getComputedStyle(nav).gridTemplateColumns,width:settings.getBoundingClientRect().width,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}});
  if(shell.count!==5||!shell.settingsLast||!shell.transitInline||shell.weekInBottom||!shell.weekInline||shell.grid.trim().split(/\s+/).length!==5||shell.width<44||shell.scrollWidth>shell.clientWidth+3)throw new Error(`school five-slot navigation / inline Week failed ${JSON.stringify(shell)}`);
  let g=await glassState(page,'#bottomNav');if(g.mode!=='standard'||g.refraction!=='off'||g.copy||g.stored!==null||/url\(/i.test(g.navBackdrop)||g.navFilter||g.copyLens)throw new Error(`standard glass must remain default ${JSON.stringify(g)}`);
  await trigger.click();await page.locator('#flowSchoolSettingsView:not(.hidden)').waitFor();
  const modal=await page.locator('#settingsDialog').evaluate(el=>el.open);if(modal)throw new Error('School Settings still opened as a dialog');
  const selected=await page.evaluate(()=>({active:[...document.querySelectorAll('#bottomNav>.mobile-tab')].findIndex(x=>x.classList.contains('active')),index:getComputedStyle(document.querySelector('#bottomNav')).getPropertyValue('--flow-tab-index').trim()}));
  if(selected.active!==4||selected.index!=='4')throw new Error(`school Settings lens did not reach fifth slot ${JSON.stringify(selected)}`);
  await page.locator('#flowSchoolSettingsView [data-flow-settings-glass="optical"]').click();await page.waitForFunction(()=>document.documentElement.dataset.flowRefractionCopy==='true');await page.waitForTimeout(120);g=await glassState(page,'#bottomNav');if(g.mode!=='optical'||g.stored!=='optical'||g.refraction!=='true'||g.copy!=='true'||!g.navFilter||!g.copyLens||!/url\([^)]*flow-liquid-nav-refraction/i.test(g.sampleFilter))throw new Error(`school optical glass failed ${JSON.stringify(g)}`);
  await page.screenshot({path:`${OUT}/settings-school-dedicated.png`,fullPage:false});
  await page.locator('#flowSchoolSettingsView [data-flow-settings-glass="standard"]').click();await page.waitForTimeout(100);g=await glassState(page,'#bottomNav');if(g.mode!=='standard'||g.stored!=='standard'||g.refraction!=='off'||g.copy||g.copyLens||/url\(/i.test(g.navBackdrop))throw new Error(`school standard restore failed ${JSON.stringify(g)}`);
  await context.close();return{shell,selected};
}

async function universityMobile(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});const page=await context.newPage();
  await mockUniversity(page);await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#appView:not(.hidden)').waitFor();await waitMaterial(page);
  const trigger=page.locator('.bottom-nav > .flow-mobile-settings');await trigger.waitFor({state:'visible'});
  const nav=await page.evaluate(()=>{const bar=document.querySelector('.bottom-nav'),settings=bar.querySelector(':scope>.flow-mobile-settings'),items=[...bar.querySelectorAll(':scope>.bottom-item')].filter(x=>getComputedStyle(x).display!=='none');return{count:items.length,settingsLast:settings===items.at(-1),grid:getComputedStyle(bar).gridTemplateColumns,width:settings.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}});
  if(nav.count!==5||!nav.settingsLast||nav.grid.trim().split(/\s+/).length!==5||nav.width<44||nav.overflow>3)throw new Error(`university five-slot navigation failed ${JSON.stringify(nav)}`);
  await trigger.click();await page.locator('#flowUniversitySettingsView:not(.hidden)').waitFor();
  const modal=await page.locator('#flowUniversitySettingsDialog').evaluate(el=>el.open);if(modal)throw new Error('University Settings still opened as a dialog');
  await page.locator('#flowUniversitySettingsView [data-flow-settings-theme="dark"]').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark'&&document.documentElement.dataset.themeMode==='dark');
  const state=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,mode:document.documentElement.dataset.themeMode,active:[...document.querySelectorAll('.bottom-nav>.bottom-item')].findIndex(x=>x.classList.contains('active')),index:getComputedStyle(document.querySelector('.bottom-nav')).getPropertyValue('--flow-tab-index').trim(),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  if(state.theme!=='dark'||state.mode!=='dark'||state.active!==4||state.index!=='4'||state.overflow>3)throw new Error(`university Settings state failed ${JSON.stringify(state)}`);
  await page.screenshot({path:`${OUT}/settings-university-dedicated-mobile.png`,fullPage:false});await context.close();return{nav,state};
}

async function universityDesktop(){
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'ko-KR'});const page=await context.newPage();
  await mockUniversity(page);await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#appView:not(.hidden)').waitFor();await waitMaterial(page);
  const trigger=page.locator('.flow-university-settings-button');await trigger.waitFor({state:'visible'});await trigger.click();await page.locator('#flowUniversitySettingsView:not(.hidden)').waitFor();
  const geometry=await page.evaluate(()=>{const view=document.querySelector('#flowUniversitySettingsView'),stack=view.querySelector('.flow-settings-stack'),vr=view.getBoundingClientRect(),sr=stack.getBoundingClientRect();return{clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,viewWidth:vr.width,stackWidth:sr.width,stackRight:sr.right,viewRight:vr.right,modal:document.querySelector('#flowUniversitySettingsDialog').open}});
  if(geometry.scrollWidth>geometry.clientWidth+3||geometry.stackWidth<500||geometry.stackWidth<geometry.viewWidth*.9||geometry.stackWidth>geometry.viewWidth+3||geometry.stackRight>geometry.viewRight+3||geometry.modal)throw new Error(`university desktop Settings geometry failed ${JSON.stringify(geometry)}`);
  await page.screenshot({path:`${OUT}/settings-university-dedicated-desktop.png`,fullPage:false});await context.close();return geometry;
}

const result={schoolMobile:await schoolMobile(),universityMobile:await universityMobile(),universityDesktop:await universityDesktop()};
await browser.close();console.log(JSON.stringify(result,null,2));