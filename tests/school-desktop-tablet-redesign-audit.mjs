import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_DT_OUT||'school-landscape-toolbar-audit/desktop-tablet-redesign';
const CASES=[
  {name:'tablet-portrait',width:768,height:1024,touch:true,expect:'tablet'},
  {name:'tablet-landscape',width:1024,height:768,touch:true,expect:'tablet'},
  {name:'wide-touch-tablet',width:1536,height:1024,touch:true,expect:'tablet'},
  {name:'desktop',width:1366,height:768,touch:false,expect:'desktop'},
  {name:'large-desktop',width:1920,height:1080,touch:false,expect:'desktop'},
];
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',location:'대구광역시',type:'사립',address:'대구광역시 동구 반야월북로 199',phone:'053-000-0000',homepage:'https://jungdong.dge.hs.kr',highSchoolType:'일반고',highSchoolTrack:'일반계',coed:'남녀공학',dayNight:'주간'};
const pad=n=>String(n).padStart(2,'0');
const ymd=(d=new Date())=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)});
function dashboard(){const selected=ymd();return{school:SCHOOL,selected,from:selected,to:selected,timetable:Array.from({length:7},(_,i)=>({date:selected,period:i+1,subject:['자율·자치활동','선택과목','음악 감상과 비평','사진의 이해','선택과목','선택과목','영어Ⅱ'][i],grade:'2',className:'6'})),meals:[{date:selected,type:'중식',dishes:['찰현미밥','한우설렁탕','골뱅이야채무침','서문시장삼각만두','깍두기'],calories:'873.1 Kcal',nutrition:'',origin:''}],events:[{date:selected,name:'2학기 전국 영어듣기능력평가',content:'',grade2:'Y'}],scheduleMeta:{mode:'fixture',count:1}}}
async function fixture(page){
  await page.route('**/functions/v1/school-data**',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard());if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});if(action==='place')return json(route,{provider:'kakao',place:null});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.route('**/functions/v1/flow-quest-event**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(school=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-ambient-v1','on');localStorage.setItem('flow-glass-mode-v2','standard');localStorage.setItem('flow-school-transit-lab-v1','off')},SCHOOL);
}
async function state(page){return page.evaluate(()=>{
  const root=document.documentElement,visible=node=>{if(!node)return false;const s=getComputedStyle(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.05&&r.width>0&&r.height>0},box=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}},pick=s=>document.querySelector(s);
  const shell=pick('#dashboard'),sidebar=pick('#desktopSidebar'),top=pick('.mobile-topbar'),dock=pick('#flowTodayDateDock'),nav=pick('#bottomNav'),hero=pick('#schoolHero'),heroImage=hero?.querySelector('.school-hero-image'),heroShade=hero?.querySelector('.school-hero-shade'),timetable=pick('#todayView .timetable-card'),meal=pick('#todayView .meal-card'),status=[...document.querySelectorAll('#todayView .status-card')].filter(visible),sideNav=pick('#desktopSidebar .side-nav');
  const hs=hero?getComputedStyle(hero):null,ns=nav?getComputedStyle(nav):null;
  return{layout:root.dataset.flowSchoolLayout||'',ui:root.dataset.flowSchoolDesktopTabletUi||'',viewport:{width:innerWidth,height:innerHeight,clientWidth:root.clientWidth,scrollWidth:root.scrollWidth},shell:box(shell),sidebar:{visible:visible(sidebar),box:box(sidebar)},top:{visible:visible(top),box:box(top)},dock:{visible:visible(dock),box:box(dock),days:[...(dock?.querySelectorAll('.flow-date-day')||[])].filter(visible).length},nav:{visible:visible(nav),box:box(nav),position:ns?.position||'',radius:parseFloat(ns?.borderRadius)||0},hero:{visible:visible(hero),box:box(hero),background:hs?.backgroundColor||'',imageVisible:visible(heroImage),shadeVisible:visible(heroShade)},sideNav:{visible:visible(sideNav),box:box(sideNav)},timetable:box(timetable),meal:box(meal),statusCount:status.length};
})}
function assertTwoColumn(name,s){
  if(!s.timetable||!s.meal||s.meal.left<=s.timetable.left+100||Math.abs(s.meal.top-s.timetable.top)>180)throw new Error(`${name}: non-mobile viewport did not use the shared desktop content proportion ${JSON.stringify({timetable:s.timetable,meal:s.meal})}`);
}
function assertState(c,s){
  if(s.ui!=='v2'||s.layout!==c.expect)throw new Error(`${c.name}: layout marker mismatch ${JSON.stringify({ui:s.ui,layout:s.layout})}`);
  if(s.viewport.scrollWidth>s.viewport.clientWidth+2)throw new Error(`${c.name}: horizontal overflow ${JSON.stringify(s.viewport)}`);
  if(c.expect==='tablet'){
    if(s.sidebar.visible)throw new Error(`${c.name}: desktop sidebar visible on tablet ${JSON.stringify(s.sidebar)}`);
    if(!s.top.visible||!s.dock.visible||s.dock.days!==5)throw new Error(`${c.name}: tablet app bar/date rail incomplete ${JSON.stringify({top:s.top,dock:s.dock})}`);
    if(!s.nav.visible||s.nav.position!=='fixed'||s.nav.radius<24)throw new Error(`${c.name}: tablet floating pill nav missing ${JSON.stringify(s.nav)}`);
    if(s.hero.visible)throw new Error(`${c.name}: legacy Today hero visible on tablet ${JSON.stringify(s.hero)}`);
    assertTwoColumn(c.name,s);
  }else{
    if(!s.sidebar.visible||!s.sideNav.visible)throw new Error(`${c.name}: desktop command bar missing ${JSON.stringify({sidebar:s.sidebar,sideNav:s.sideNav})}`);
    if((s.sidebar.box?.height||999)>92||(s.sidebar.box?.width||0)<900)throw new Error(`${c.name}: desktop sidebar was not redesigned horizontally ${JSON.stringify(s.sidebar)}`);
    if((s.sideNav.box?.width||0)<360||(s.sideNav.box?.height||999)>58)throw new Error(`${c.name}: desktop nav is not a horizontal control group ${JSON.stringify(s.sideNav)}`);
    if(s.top.visible||s.nav.visible)throw new Error(`${c.name}: mobile chrome leaked into desktop ${JSON.stringify({top:s.top,nav:s.nav})}`);
    if(!s.hero.visible||s.hero.imageVisible||s.hero.shadeVisible||(s.hero.box?.height||999)>110)throw new Error(`${c.name}: desktop neutral Today header contract failed ${JSON.stringify(s.hero)}`);
    assertTwoColumn(c.name,s);
    const used=(s.meal?.right||0)-(s.timetable?.left||0);
    if(used<1260)throw new Error(`${c.name}: desktop Today workspace is artificially capped and under-uses the shell ${JSON.stringify({used,shell:s.shell,timetable:s.timetable,meal:s.meal})}`);
  }
}

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};
for(const c of CASES){
  const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:false,hasTouch:c.touch,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});const page=await context.newPage();page.setDefaultTimeout(15000);
  try{
    await fixture(page);await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolDesktopTabletUi==='v2'&&document.documentElement.dataset.flowSchoolSurface==='ready');await page.waitForTimeout(260);
    const s=await state(page);assertState(c,s);await page.screenshot({path:`${OUT}/${c.name}.png`,fullPage:false,animations:'disabled'});await page.screenshot({path:`${OUT}/${c.name}-full.png`,fullPage:true,animations:'disabled'});report.cases.push({name:c.name,state:s,pass:true});console.log(`${c.name}: PASS`);
  }catch(error){const message=String(error?.stack||error);report.failures.push({name:c.name,message});report.cases.push({name:c.name,pass:false,message});console.error(`${c.name}: FAIL\n${message}`);try{await page.screenshot({path:`${OUT}/${c.name}-failure.png`,fullPage:false,animations:'disabled'})}catch{}}
  await context.close();
}
await browser.close();await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));if(report.failures.length)process.exit(1);console.log('School desktop/tablet redesign PASS');
