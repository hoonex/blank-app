import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-home-cleanup-audit/wide-portrait-destinations';
await fs.mkdir(OUT,{recursive:true});

const pad=value=>String(value).padStart(2,'0');
const seoulYmd=(days=0)=>{const date=new Date(Date.now()+9*60*60*1000+days*24*60*60*1000);return`${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}`};
const today=seoulYmd(0),tomorrow=seoulYmd(1);
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const dashboard={
  school:{...profile.school,homepage:'https://example.com',phone:'053-000-0000'},selected:today,from:today,to:tomorrow,
  timetable:Array.from({length:7},(_,i)=>({date:today,period:i+1,subject:['자율·자치활동','문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육'][i]})),
  meals:[{date:today,type:'중식',dishes:['현미밥','된장국','제육볶음'],calories:'812.4 Kcal',nutrition:'단백질 32g',origin:'쌀 국내산'}],
  events:[{date:tomorrow,name:'다가오는 행사',content:'앞으로 확인할 일정'}],scheduleMeta:{mode:'month',count:1},
};

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixture(page){
  await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});return json(route,{})});
  await page.addInitScript(({profile})=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard');localStorage.setItem('flow-school-transit-lab-v1','off')},{profile});
}

async function shellState(page){return page.evaluate(()=>{
  const shown=node=>Boolean(node&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0);
  const box=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};
  const schoolName=document.querySelector('#mobileSchoolName');
  const className=document.querySelector('#mobileClassName');
  return{
    desktop:shown(document.querySelector('.desktop-sidebar')),
    topbar:shown(document.querySelector('.mobile-topbar')),
    bottom:shown(document.querySelector('#bottomNav')),
    brandSmallVisible:shown(document.querySelector('.mobile-topbar .flow-logo-copy small')),
    schoolNameDisplay:schoolName?getComputedStyle(schoolName).display:'',
    classNameDisplay:className?getComputedStyle(className).display:'',
    schoolName:box(schoolName),
    className:box(className),
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  };
})}
async function scheduleState(page){return page.evaluate(()=>{
  const shown=node=>Boolean(node&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0);
  const box=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};
  const header=document.querySelector('#scheduleView .view-header');
  const layout=document.querySelector('#scheduleView .schedule-layout');
  const cards=[...document.querySelectorAll('#scheduleView .schedule-layout>.content-card')];
  const day=document.querySelector('#scheduleView .calendar-day');
  const hs=header?getComputedStyle(header):null,ls=layout?getComputedStyle(layout):null,ds=day?getComputedStyle(day):null;
  return{headerFlex:hs?.flexDirection||'',header:box(header),layoutDisplay:ls?.display||'',layoutColumns:ls?.gridTemplateColumns||'',cards:cards.map(box),dayHeight:parseFloat(ds?.minHeight||'0')||0,eventLabelVisible:shown(document.querySelector('#scheduleView .calendar-event-label')),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
})}
async function schoolState(page){return page.evaluate(()=>{
  const box=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};
  const header=document.querySelector('#schoolView .view-header');
  const grid=document.querySelector('#schoolView .school-info-grid');
  const actions=document.querySelector('#schoolView .school-actions');
  const profile=document.querySelector('#schoolView .profile-hero');
  const tiles=[...document.querySelectorAll('#schoolView .school-info-grid>.info-tile')];
  const hs=header?getComputedStyle(header):null,gs=grid?getComputedStyle(grid):null,as=actions?getComputedStyle(actions):null;
  return{headerFlex:hs?.flexDirection||'',header:box(header),grid:box(grid),gridColumns:gs?.gridTemplateColumns||'',tiles:tiles.map(box),actionsDisplay:as?.display||'',actionsColumns:as?.gridTemplateColumns||'',profile:box(profile),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
})}
async function settingsState(page){return page.evaluate(()=>{
  const shown=node=>Boolean(node&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0);
  const box=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};
  const panel=document.querySelector('#flowSchoolSettingsView');
  const fields=[...document.querySelectorAll('#flowSchoolSettingsView .flow-settings-fields')].filter(shown);
  const style=panel?getComputedStyle(panel):null;
  return{position:style?.position||'',panel:box(panel),columns:fields.map(node=>getComputedStyle(node).gridTemplateColumns),fieldRects:fields.map(box),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
})}
async function navigationState(page){return page.evaluate(()=>{
  const shown=node=>Boolean(node&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0);
  const box=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};
  const nav=document.querySelector('#bottomNav'),settings=document.querySelector('#mobileSettingsBtn'),panel=document.querySelector('#flowSchoolSettingsView');
  const tabs=nav?[...nav.querySelectorAll(':scope>.mobile-tab')].filter(shown):[];
  const ns=nav?getComputedStyle(nav):null,ps=panel?getComputedStyle(panel):null,ss=settings?getComputedStyle(settings):null,lens=nav?getComputedStyle(nav,'::before'):null;
  const number=value=>{const parsed=Number.parseFloat(value||'');return Number.isFinite(parsed)?parsed:0};
  return{
    visible:shown(nav),nav:box(nav),tabs:tabs.map(node=>({text:node.textContent.trim(),active:node.classList.contains('active'),rect:box(node)})),
    settingsActive:Boolean(settings?.classList.contains('active')),settingsLegacyClass:Boolean(settings?.classList.contains('flow-mobile-settings')),
    settingsBorderTop:ss?.borderTopWidth||'',settingsDisplay:ss?.display||'',settingsRect:box(settings),
    tabIndex:ns?.getPropertyValue('--flow-tab-index').trim()||'',pointer:ns?.pointerEvents||'',navZ:Number.parseInt(ns?.zIndex||'0',10)||0,
    panel:box(panel),panelZ:Number.parseInt(ps?.zIndex||'0',10)||0,
    lens:{display:lens?.display||'',top:number(lens?.top),bottom:number(lens?.bottom),width:number(lens?.width),height:number(lens?.height)},
  };
})}

const browser=await chromium.launch({headless:true});
const report={};
for(const testCase of [
  {name:'wide-tablet-portrait',width:960,height:1536,touch:true,portrait:true},
  {name:'tablet-landscape',width:1024,height:768,touch:true,portrait:false},
]){
  const {name,width,height,touch,portrait}=testCase;
  const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage(),pageErrors=[],consoleErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  await fixture(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurfaceCleanup==='ready');

  const shell=await shellState(page);
  const schoolIdentitySplit=shell.schoolName&&shell.className&&shell.schoolNameDisplay==='block'&&shell.classNameDisplay==='block'&&shell.className.top>=shell.schoolName.bottom-1;
  if(shell.desktop||!shell.topbar||!shell.bottom||shell.brandSmallVisible||!schoolIdentitySplit||shell.overflow>1){
    throw new Error(`${name}: 901–1180 compact shell did not fully engage ${JSON.stringify(shell)}`);
  }

  await page.locator('[data-view="schedule"]:visible').first().click();
  await page.waitForSelector('#scheduleView:not(.hidden)');
  await page.waitForTimeout(60);
  const schedule=await scheduleState(page);
  if(portrait){
    const stacked=schedule.cards.length>=2&&schedule.cards[1].top>=schedule.cards[0].bottom-1;
    if(schedule.headerFlex!=='column'||schedule.layoutDisplay!=='block'||!stacked||schedule.dayHeight>70||schedule.eventLabelVisible||schedule.overflow>1){
      throw new Error(`${name}: Schedule is not touch-first ${JSON.stringify(schedule)}`);
    }
  }else if(schedule.headerFlex==='column'||schedule.layoutDisplay==='block'||schedule.overflow>1){
    throw new Error(`${name}: Schedule landscape composition regressed ${JSON.stringify(schedule)}`);
  }
  await page.screenshot({path:`${OUT}/schedule-${name}.png`,fullPage:true});

  await page.locator('[data-view="school"]:visible').first().click();
  await page.waitForSelector('#schoolView:not(.hidden)');
  await page.waitForTimeout(60);
  const school=await schoolState(page);
  if(portrait){
    const first=school.tiles[0],second=school.tiles[1],third=school.tiles[2];
    const twoTileRow=school.tiles.length<2||(first&&second&&Math.abs(first.top-second.top)<=2&&second.left>first.left&&Math.abs(first.width-second.width)<=4);
    const wrapsAfterTwo=school.tiles.length<3||(third&&first&&third.top>=first.bottom-1);
    const halfWidth=school.tiles.length===0||(school.grid&&first&&first.width>=school.grid.width*.45&&first.width<=school.grid.width*.52);
    const twoActions=school.actionsColumns.trim().split(/\s+/).filter(Boolean).length===2;
    if(school.headerFlex!=='column'||!twoTileRow||!wrapsAfterTwo||!halfWidth||school.actionsDisplay!=='grid'||!twoActions||!school.profile||school.profile.height>215||school.overflow>1){
      throw new Error(`${name}: School profile is not touch-first ${JSON.stringify(school)}`);
    }
  }else if(school.headerFlex==='column'||school.actionsDisplay==='grid'||school.overflow>1){
    throw new Error(`${name}: School landscape composition regressed ${JSON.stringify(school)}`);
  }
  await page.screenshot({path:`${OUT}/school-${name}.png`,fullPage:true});

  await page.locator('#mobileSettingsBtn:visible,#settingsBtn:visible').first().click();
  await page.waitForSelector('#flowSchoolSettingsView:not(.hidden)');
  await page.waitForSelector('#flowSchoolSettingsView .flow-settings-fields');
  await page.locator('#flowSchoolSettingsView').evaluate(node=>{node.scrollTop=node.scrollHeight});
  await page.waitForTimeout(60);
  const settings=await settingsState(page),settingsNav=await navigationState(page);
  if(portrait){
    const single=settings.columns.length>0&&settings.columns.every(value=>value.trim().split(/\s+/).filter(Boolean).length===1);
    const mobileSurface=settings.position==='fixed'&&settings.panel&&settings.panel.top>=60&&settings.panel.top<=68&&settings.panel.width>=950;
    const fourTabs=settingsNav.tabs.length===4&&settingsNav.tabs.every(tab=>tab.rect&&tab.rect.height>=46);
    const firstTab=settingsNav.tabs[0]?.rect;
    const sameTabGeometry=Boolean(firstTab)&&settingsNav.tabs.every(tab=>tab.rect&&Math.abs(tab.rect.top-firstTab.top)<=1&&Math.abs(tab.rect.height-firstTab.height)<=1&&Math.abs(tab.rect.width-firstTab.width)<=2);
    const navAbovePanel=settingsNav.nav&&settingsNav.panel&&settingsNav.panel.bottom<=settingsNav.nav.top+2&&settingsNav.navZ>settingsNav.panelZ;
    const fullLens=settingsNav.nav&&settingsNav.lens.display!=='none'&&settingsNav.lens.height>=Math.max(40,settingsNav.nav.height-12)&&settingsNav.lens.width>=firstTab.width-4;
    const cleanSettingsTab=!settingsNav.settingsLegacyClass&&settingsNav.settingsBorderTop==='0px'&&sameTabGeometry;
    if(!single||!mobileSurface||settings.overflow>1||!settingsNav.visible||!fourTabs||!navAbovePanel||settingsNav.pointer==='none'||!settingsNav.settingsActive||settingsNav.tabIndex!=='3'||!cleanSettingsTab||!fullLens){
      throw new Error(`${name}: Settings bottom-nav/lens geometry is broken ${JSON.stringify({settings,settingsNav,sameTabGeometry,fullLens,cleanSettingsTab})}`);
    }
  }else if(settings.position==='fixed'||settings.overflow>1){
    throw new Error(`${name}: Settings landscape composition regressed ${JSON.stringify(settings)}`);
  }
  await page.screenshot({path:`${OUT}/settings-${name}.png`,fullPage:true});

  await page.locator('[data-view="today"]:visible').first().click();
  await page.waitForSelector('#todayView:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#flowSchoolSettingsView')?.classList.contains('hidden'));
  await page.waitForTimeout(50);
  const returnedNav=await navigationState(page);
  if(portrait){
    if(!returnedNav.visible||returnedNav.tabs.length!==4||returnedNav.tabs[0]?.active!==true||returnedNav.settingsActive||returnedNav.tabIndex!=='0'||returnedNav.settingsLegacyClass){
      throw new Error(`${name}: could not return from Settings through Today tab ${JSON.stringify(returnedNav)}`);
    }
  }

  if(pageErrors.length||consoleErrors.length)throw new Error(`${name}: browser errors ${JSON.stringify({pageErrors,consoleErrors})}`);
  report[name]={shell,schedule,school,settings,settingsNav,returnedNav,pageErrors,consoleErrors};
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({ok:true,widePortrait:'all-school-destinations-touch-first',topbar:'mobile-internals',settings:'mobile-surface-with-full-height-lens-and-bottom-nav-return',landscape:'compact-shell-with-landscape-content'},null,2));