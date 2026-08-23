import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='native-feel-audit';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function waitMaterial(page){
  await page.waitForFunction(()=>[...document.styleSheets].some(s=>{try{return new URL(s.href||'',location.href).pathname==='/flow-material.css'}catch{return false}}),null,{timeout:10000});
  await page.waitForTimeout(140);
}
async function glassState(page,{nav,sheet=null}={}){
  return page.evaluate(({nav,sheet})=>{
    const root=document.documentElement,n=document.querySelector(nav),s=sheet?document.querySelector(sheet):null;
    const ns=n?getComputedStyle(n,'::before'):null,ss=s?getComputedStyle(s):null;
    return{
      mode:root.dataset.flowGlassMode||'',refraction:root.dataset.flowGlassRefraction||'',stored:localStorage.getItem('flow-glass-mode-v2'),
      navBackdrop:ns?.backdropFilter||ns?.webkitBackdropFilter||'',sheetBackdrop:ss?.backdropFilter||ss?.webkitBackdropFilter||'',
      navFilter:Boolean(document.querySelector('#flow-liquid-nav-refraction')),sheetFilter:Boolean(document.querySelector('#flow-liquid-sheet-refraction')),
      rootWidth:root.clientWidth,scrollWidth:root.scrollWidth
    };
  },{nav,sheet});
}
async function mockSchool(page){
  const school={officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
  await page.route('**/functions/v1/school-data**',async route=>{
    const action=new URL(route.request().url()).searchParams.get('action');
    if(action==='dashboard')return json(route,{school,selected:'20260823',from:'20260823',to:'20260823',timetable:[],meals:[],events:[],scheduleMeta:{mode:'fixture',count:0}});
    if(action==='media')return json(route,{media:{},homepage:school.homepage});
    if(action==='place')return json(route,{provider:'kakao',place:null});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({school})=>{
    localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));
    localStorage.setItem('flow-school-theme-v3','light');
  },{school});
}
async function mockUniversity(page){
  const university={id:'knu',name:'경북대학교',kind:'대학교',address:'대구광역시 북구 대학로 80',homepage:'https://www.knu.ac.kr'};
  await page.route('**/functions/v1/university-data**',route=>json(route,{school:university,metrics:{},partial:false,unavailable:[]}));
  await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
  await page.addInitScript(({university})=>{
    localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));
    localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[]}));
    localStorage.setItem('flow-university-theme-v1','light');
  },{university});
}

async function schoolMobile(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});const page=await context.newPage();
  await mockSchool(page);await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await waitMaterial(page);
  await page.locator('#bottomNav > #mobileSettingsBtn.flow-mobile-settings').waitFor({state:'visible'});
  const shell=await page.evaluate(()=>{
    const nav=document.querySelector('#bottomNav'),settings=document.querySelector('#mobileSettingsBtn');
    const visible=[...nav.querySelectorAll(':scope > .mobile-tab')].filter(x=>getComputedStyle(x).display!=='none');
    return{visibleTabs:visible.length,settingsInNav:settings.parentElement===nav,settingsDisplay:getComputedStyle(settings).display,settingsWidth:settings.getBoundingClientRect().width,grid:getComputedStyle(nav).gridTemplateColumns,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth};
  });
  if(shell.visibleTabs!==5||!shell.settingsInNav||shell.settingsDisplay==='none')throw new Error(`school settings is not the fifth bottom-navigation slot ${JSON.stringify(shell)}`);
  if(shell.settingsWidth<44||shell.grid.trim().split(/\s+/).length!==5)throw new Error(`school five-slot mobile nav geometry is wrong ${JSON.stringify(shell)}`);
  if(shell.scrollWidth>shell.clientWidth+3)throw new Error(`school settings layout caused overflow ${JSON.stringify(shell)}`);

  let g=await glassState(page,{nav:'#bottomNav'});
  if(g.mode!=='standard'||g.refraction!=='off'||g.stored!==null||/url\(/i.test(g.navBackdrop)||g.navFilter)throw new Error(`standard glass must be the lazy default ${JSON.stringify(g)}`);
  await page.screenshot({path:`${OUT}/settings-school-standard.png`,fullPage:false});

  await page.locator('#bottomNav > #mobileSettingsBtn.flow-mobile-settings').click();await page.locator('#settingsDialog[open]').waitFor();
  await page.locator('#settingsDialog [data-flow-glass-choice="standard"]').waitFor({state:'visible'});
  const status=await page.locator('#settingsDialog [data-flow-glass-status]').textContent();
  if(!status?.includes('기본 유리'))throw new Error(`school standard glass status missing: ${status}`);
  await page.locator('#settingsDialog [data-flow-glass-choice="optical"]').click();await page.waitForTimeout(180);
  g=await glassState(page,{nav:'#bottomNav',sheet:'#settingsDialog .settings-sheet'});
  if(g.mode!=='optical'||g.stored!=='optical'||g.refraction!=='true'||!g.navFilter||!g.sheetFilter)throw new Error(`school optical glass did not activate on Chromium ${JSON.stringify(g)}`);
  if(!/url\([^)]*flow-liquid-nav-refraction/i.test(g.navBackdrop)||!/url\([^)]*flow-liquid-sheet-refraction/i.test(g.sheetBackdrop))throw new Error(`live displacement filters are not attached ${JSON.stringify(g)}`);
  await page.screenshot({path:`${OUT}/settings-school-optical.png`,fullPage:false});

  await page.reload({waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await waitMaterial(page);await page.waitForTimeout(120);
  g=await glassState(page,{nav:'#bottomNav'});
  if(g.mode!=='optical'||g.stored!=='optical'||g.refraction!=='true'||!/url\(/i.test(g.navBackdrop))throw new Error(`optical glass preference did not survive reload ${JSON.stringify(g)}`);
  await page.locator('#bottomNav > #mobileSettingsBtn.flow-mobile-settings').click();await page.locator('#settingsDialog[open]').waitFor();await page.locator('#settingsDialog [data-flow-glass-choice="standard"]').click();await page.waitForTimeout(100);
  g=await glassState(page,{nav:'#bottomNav',sheet:'#settingsDialog .settings-sheet'});
  if(g.mode!=='standard'||g.stored!=='standard'||g.refraction!=='off'||/url\(/i.test(g.navBackdrop)||/url\(/i.test(g.sheetBackdrop))throw new Error(`returning to standard glass did not remove displacement ${JSON.stringify(g)}`);
  await context.close();return{shell,opticalPersistence:true};
}

async function universityMobile(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});const page=await context.newPage();
  await mockUniversity(page);await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#appView:not(.hidden)').waitFor();await waitMaterial(page);
  await page.locator('.bottom-nav > .flow-mobile-settings').waitFor({state:'visible'});
  await page.waitForFunction(()=>Boolean(document.querySelector('.mobile-header>.flow-theme-cycle')),null,{timeout:10000});
  const oldThemeDisplay=await page.locator('.mobile-header>.flow-theme-cycle').evaluate(el=>getComputedStyle(el).display);
  if(oldThemeDisplay!=='none')throw new Error(`legacy university mobile theme control remains visible: ${oldThemeDisplay}`);
  const navGeometry=await page.evaluate(()=>{
    const nav=document.querySelector('.bottom-nav'),settings=nav.querySelector(':scope > .flow-mobile-settings');
    const items=[...nav.querySelectorAll(':scope > .bottom-item')].filter(x=>getComputedStyle(x).display!=='none');
    return{count:items.length,settingsLast:settings===items.at(-1),grid:getComputedStyle(nav).gridTemplateColumns,width:settings?.getBoundingClientRect().width||0,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });
  if(navGeometry.count!==5||!navGeometry.settingsLast||navGeometry.grid.trim().split(/\s+/).length!==5||navGeometry.width<44||navGeometry.overflow>3)throw new Error(`university five-slot mobile nav geometry failed ${JSON.stringify(navGeometry)}`);
  await page.locator('.bottom-nav > .flow-mobile-settings').click();await page.locator('#flowUniversitySettingsDialog[open]').waitFor();
  await page.locator('#flowUniversitySettingsDialog [data-flow-university-theme-choice="dark"]').click();
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  const settings=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,themeMode:document.documentElement.dataset.themeMode,glassMode:document.documentElement.dataset.flowGlassMode,glassControls:document.querySelectorAll('#flowUniversitySettingsDialog [data-flow-glass-choice]').length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  if(settings.theme!=='dark'||settings.themeMode!=='dark'||settings.glassMode!=='standard'||settings.glassControls!==2||settings.overflow>3)throw new Error(`university settings contract failed ${JSON.stringify(settings)}`);
  await page.screenshot({path:`${OUT}/settings-university-mobile.png`,fullPage:false});await context.close();return{...settings,navGeometry};
}

async function universityDesktop(){
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'ko-KR'});const page=await context.newPage();
  await mockUniversity(page);await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#appView:not(.hidden)').waitFor();await waitMaterial(page);
  await page.locator('.flow-university-settings-button').waitFor({state:'visible'});
  await page.waitForFunction(()=>Boolean(document.querySelector('.flow-theme-segment')),null,{timeout:10000});
  const legacy=await page.locator('.flow-theme-segment').evaluate(el=>getComputedStyle(el).display);
  if(legacy!=='none')throw new Error(`legacy university desktop theme segment remains visible: ${legacy}`);
  await page.locator('.flow-university-settings-button').click();await page.locator('#flowUniversitySettingsDialog[open]').waitFor();
  const geometry=await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,dialogWidth:document.querySelector('#flowUniversitySettingsDialog .flow-settings-sheet')?.getBoundingClientRect().width||0}));
  if(geometry.scrollWidth>geometry.clientWidth+3||geometry.dialogWidth<360||geometry.dialogWidth>560)throw new Error(`university desktop settings geometry failed ${JSON.stringify(geometry)}`);
  await page.screenshot({path:`${OUT}/settings-university-desktop.png`,fullPage:false});await context.close();return geometry;
}

const result={schoolMobile:await schoolMobile(),universityMobile:await universityMobile(),universityDesktop:await universityDesktop()};
await browser.close();console.log(JSON.stringify(result,null,2));
