import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_SCHOOL_TABLET_ROTATION_OUT||'school-landscape-toolbar-audit/tablet-rotation';
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',location:'대구광역시',type:'사립',address:'대구광역시 동구 반야월북로 199',phone:'053-000-0000',homepage:'https://jungdong.dge.hs.kr',highSchoolType:'일반고',highSchoolTrack:'일반계',coed:'남녀공학',dayNight:'주간'};

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};
const ymd=(date=new Date())=>`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)});
function dashboard(){
  const selected=ymd();
  return{
    school:SCHOOL,selected,from:selected,to:selected,
    timetable:Array.from({length:7},(_,i)=>({date:selected,period:i+1,subject:['자율·자치활동','선택과목','음악 감상과 비평','사진의 이해','선택과목','선택과목','영어Ⅱ'][i],grade:'2',className:'6'})),
    meals:[{date:selected,type:'중식',dishes:['현미밥','닭갈비'],calories:'742 Kcal',nutrition:'',origin:''}],
    events:[{date:selected,name:'2학기 전국 영어듣기능력평가',content:'fixture',grade1:'N',grade2:'Y',grade3:'N',holidayType:''}],
    scheduleMeta:{mode:'fixture',count:1},
  };
}
async function installFixture(page,glassMode){
  await page.route('**/functions/v1/school-data**',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='dashboard')return json(route,dashboard());
    if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});
    if(action==='place')return json(route,{provider:'kakao',place:{id:'fixture',name:SCHOOL.name,url:'https://place.map.kakao.com/fixture',address:SCHOOL.address,roadAddress:SCHOOL.address,x:'128.687',y:'35.875'}});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({school,glassMode})=>{
    localStorage.clear();sessionStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2',glassMode);
    localStorage.setItem('flow-school-transit-lab-v1','off');
  },{school:SCHOOL,glassMode});
}
async function inspect(page,label){
  return page.evaluate(({label})=>{
    const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const visible=node=>{if(!node)return false;const s=getComputedStyle(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.05&&r.width>0&&r.height>0};
    const root=document.documentElement,header=document.querySelector('.mobile-topbar'),dock=document.querySelector('#flowTodayDateDock'),school=document.querySelector('#mobileSchoolBtn'),hero=document.querySelector('#schoolHero'),sidebar=document.querySelector('#desktopSidebar'),nav=document.querySelector('#bottomNav');
    const days=[...(dock?.querySelectorAll('.flow-date-day')||[])].filter(visible).map(node=>({offset:node.dataset.offset||'',active:node.dataset.active||'',text:(node.textContent||'').trim(),rect:rect(node)}));
    const navStyle=nav?getComputedStyle(nav):null,before=nav?getComputedStyle(nav,'::before'):null;
    const navItems=[...(nav?.children||[])].filter(node=>node.matches('.mobile-tab,.flow-mobile-settings')&&visible(node)).map(node=>({text:(node.textContent||'').trim(),view:node.dataset.view||'',settings:node.id==='mobileSettingsBtn',rect:rect(node)}));
    return{
      label,
      viewport:{width:innerWidth,height:innerHeight,clientWidth:root.clientWidth,scrollWidth:root.scrollWidth},
      pointerCoarse:matchMedia('(pointer:coarse)').matches,
      orientationLandscape:matchMedia('(orientation:landscape)').matches,
      topbarMode:root.dataset.flowTodayTopbar||'',
      tabletMode:root.dataset.flowSchoolTabletRotation||'',
      glassMode:root.dataset.flowGlassMode||'',
      header:{visible:visible(header),rect:rect(header)},
      dock:{visible:visible(dock),rect:rect(dock)},
      school:{visible:visible(school),rect:rect(school),text:(school?.textContent||'').trim()},
      hero:{visible:visible(hero),rect:rect(hero)},
      sidebar:{visible:visible(sidebar),rect:rect(sidebar)},
      days,
      nav:{visible:visible(nav),rect:rect(nav),position:navStyle?.position||'',radius:parseFloat(navStyle?.borderRadius)||0,corner:navStyle?.getPropertyValue('corner-shape')||'',lensRadius:parseFloat(before?.borderRadius)||0,items:navItems},
    };
  },{label});
}
function assertCommon(name,state,{landscape=false}={}){
  if(state.topbarMode!=='ready'||state.tabletMode!=='compact')throw new Error(`${name}: compact topbar state lost ${JSON.stringify({topbarMode:state.topbarMode,tabletMode:state.tabletMode,viewport:state.viewport})}`);
  if(!state.pointerCoarse)throw new Error(`${name}: fixture did not expose coarse touch pointer ${JSON.stringify(state.viewport)}`);
  if(state.orientationLandscape!==landscape)throw new Error(`${name}: orientation mismatch ${JSON.stringify(state.viewport)}`);
  if(!state.header.visible||!state.dock.visible||!state.school.visible)throw new Error(`${name}: compact top shell is incomplete ${JSON.stringify({header:state.header,dock:state.dock,school:state.school})}`);
  if(state.hero.visible||(state.hero.rect?.height||0)>1.5)throw new Error(`${name}: legacy blue School hero returned ${JSON.stringify(state.hero)}`);
  if(state.days.length!==5||state.days.filter(day=>day.active==='true').length!==1||state.days.some(day=>!day.text))throw new Error(`${name}: five-day date rail is missing/blank ${JSON.stringify(state.days)}`);
  if(!state.school.text.includes('정동고등학교')||!state.school.text.includes('2학년 6반'))throw new Error(`${name}: School identity is missing from compact topbar ${JSON.stringify(state.school)}`);
  if(state.viewport.scrollWidth>state.viewport.clientWidth+2)throw new Error(`${name}: horizontal overflow ${JSON.stringify(state.viewport)}`);
}
function assertLandscape(name,state){
  assertCommon(name,state,{landscape:true});
  if(state.sidebar.visible)throw new Error(`${name}: desktop sidebar returned on touch landscape ${JSON.stringify(state.sidebar)}`);
  if((state.header.rect?.height||999)>72)throw new Error(`${name}: landscape topbar is not compact ${JSON.stringify(state.header)}`);
  if(!state.nav.visible||state.nav.position!=='fixed')throw new Error(`${name}: bottom navigation is not fixed/visible ${JSON.stringify(state.nav)}`);
  if((state.nav.rect?.bottom||0)>state.viewport.height+1||(state.nav.rect?.bottom||0)<state.viewport.height-28)throw new Error(`${name}: bottom navigation is not anchored to viewport bottom ${JSON.stringify({nav:state.nav.rect,viewport:state.viewport})}`);
  if(state.nav.radius<(state.nav.rect?.height||0)/2-2||state.nav.lensRadius<20)throw new Error(`${name}: bottom navigation lost pill curvature ${JSON.stringify({radius:state.nav.radius,lensRadius:state.nav.lensRadius,height:state.nav.rect?.height,corner:state.nav.corner})}`);
  if(state.nav.items.length!==4||state.nav.items.some(item=>item.view==='week'||item.view==='transit')||state.nav.items.filter(item=>item.settings).length!==1)throw new Error(`${name}: production destination nav contract changed ${JSON.stringify(state.nav.items)}`);
  if(state.nav.items.some(item=>(item.rect?.width||0)<44||(item.rect?.height||0)<44))throw new Error(`${name}: landscape nav target is undersized ${JSON.stringify(state.nav.items)}`);
}

for(const glassMode of ['standard','optical']){
  const context=await browser.newContext({viewport:{width:800,height:1280},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const consoleErrors=[],pageErrors=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  page.on('pageerror',error=>pageErrors.push(String(error)));
  try{
    await installFixture(page,glassMode);
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.locator('#dashboard:not(.hidden)').waitFor();
    await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready'&&document.documentElement.dataset.flowSchoolRuntimeV6==='ready');
    await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolTabletRotation==='compact'&&document.documentElement.dataset.flowTodayTopbar==='ready'&&document.querySelector('#flowTodayDateDock'));
    await page.waitForFunction(()=>document.querySelectorAll('#bottomNav>.mobile-tab').length>=4);
    await page.waitForTimeout(240);

    const portraitBefore=await inspect(page,'portrait-before');
    assertCommon(`${glassMode}/portrait-before`,portraitBefore,{landscape:false});
    await page.screenshot({path:`${OUT}/${glassMode}-portrait-before.png`,fullPage:false});

    await page.setViewportSize({width:1280,height:800});
    await page.waitForFunction(()=>innerWidth===1280&&innerHeight===800&&matchMedia('(orientation:landscape)').matches&&document.documentElement.dataset.flowSchoolTabletRotation==='compact'&&document.documentElement.dataset.flowTodayTopbar==='ready');
    await page.waitForTimeout(260);
    const landscape=await inspect(page,'landscape');
    assertLandscape(`${glassMode}/landscape`,landscape);
    await page.screenshot({path:`${OUT}/${glassMode}-landscape.png`,fullPage:false});

    await page.setViewportSize({width:800,height:1280});
    await page.waitForFunction(()=>innerWidth===800&&innerHeight===1280&&!matchMedia('(orientation:landscape)').matches&&document.documentElement.dataset.flowSchoolTabletRotation==='compact'&&document.documentElement.dataset.flowTodayTopbar==='ready');
    await page.waitForTimeout(260);
    const portraitAfter=await inspect(page,'portrait-after');
    assertCommon(`${glassMode}/portrait-after`,portraitAfter,{landscape:false});
    await page.screenshot({path:`${OUT}/${glassMode}-portrait-after.png`,fullPage:false});

    if(glassMode==='optical'&&landscape.glassMode!=='optical')throw new Error(`optical mode did not survive rotation: ${JSON.stringify(landscape.glassMode)}`);
    if(consoleErrors.length||pageErrors.length)throw new Error(`${glassMode}: browser errors ${JSON.stringify({consoleErrors,pageErrors})}`);
    report.cases.push({glassMode,portraitBefore,landscape,portraitAfter,consoleErrors,pageErrors});
  }catch(error){
    report.failures.push(String(error?.stack||error));
    try{await page.screenshot({path:`${OUT}/${glassMode}-failure.png`,fullPage:false})}catch{}
  }
  await context.close();
}

await browser.close();
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
if(report.failures.length){console.error(report.failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({ok:true,cases:report.cases.map(item=>item.glassMode),contract:'800x1280 -> 1280x800 -> 800x1280 keeps the compact top date rail, hides the legacy hero, and preserves a true pill bottom nav'},null,2));