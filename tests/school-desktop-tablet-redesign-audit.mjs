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
  const shell=pick('#dashboard'),sidebar=pick('#desktopSidebar'),top=pick('.mobile-topbar'),dock=pick('#flowTodayDateDock'),nav=pick('#bottomNav'),hero=pick('#schoolHero'),heroImage=hero?.querySelector('.school-hero-image'),heroShade=hero?.querySelector('.school-hero-shade'),todayGrid=pick('#todayView>.today-grid'),rightStack=pick('#todayView>.today-grid>.right-stack'),timetable=pick('#todayView .timetable-card'),meal=pick('#todayView .meal-card'),upcoming=pick('#todayView .upcoming-card'),upcomingHeading=pick('#todayView .upcoming-card .card-heading'),examFeed=pick('#flowExamFeedV3'),status=[...document.querySelectorAll('#todayView .status-card')].filter(visible),sideNav=pick('#desktopSidebar .side-nav'),main=pick('#dashboard>.product-main'),toggle=pick('#todayView .timetable-mode-toggle');
  const hs=hero?getComputedStyle(hero):null,ns=nav?getComputedStyle(nav):null,gs=todayGrid?getComputedStyle(todayGrid):null,rs=rightStack?getComputedStyle(rightStack):null,us=upcoming?getComputedStyle(upcoming):null,fs=examFeed?getComputedStyle(examFeed):null;
  const feedChildren=[...(examFeed?.children||[])].filter(visible).map(node=>({className:node.className,box:box(node)}));
  return{layout:root.dataset.flowSchoolLayout||'',ui:root.dataset.flowSchoolDesktopTabletUi||'',viewport:{width:innerWidth,height:innerHeight,clientWidth:root.clientWidth,scrollWidth:root.scrollWidth},shell:box(shell),main:box(main),sidebar:{visible:visible(sidebar),box:box(sidebar)},top:{visible:visible(top),box:box(top)},dock:{visible:visible(dock),box:box(dock),days:[...(dock?.querySelectorAll('.flow-date-day')||[])].filter(visible).length},nav:{visible:visible(nav),box:box(nav),position:ns?.position||'',radius:parseFloat(ns?.borderRadius)||0},hero:{visible:visible(hero),box:box(hero),background:hs?.backgroundColor||'',imageVisible:visible(heroImage),shadeVisible:visible(heroShade)},sideNav:{visible:visible(sideNav),box:box(sideNav)},toggleVisible:visible(toggle),todayGrid:{box:box(todayGrid),height:gs?.height||'',minHeight:gs?.minHeight||'',background:gs?.backgroundColor||''},rightStack:{box:box(rightStack),height:rs?.height||'',minHeight:rs?.minHeight||'',rows:rs?.gridTemplateRows||'',display:rs?.display||'',direction:rs?.flexDirection||''},timetable:box(timetable),meal:box(meal),upcoming:{box:box(upcoming),height:us?.height||'',minHeight:us?.minHeight||'',paddingTop:us?.paddingTop||'',paddingBottom:us?.paddingBottom||'',alignSelf:us?.alignSelf||'',flex:us?.flex||''},upcomingHeading:box(upcomingHeading),examFeed:{visible:visible(examFeed),box:box(examFeed),height:fs?.height||'',minHeight:fs?.minHeight||'',rows:fs?.gridTemplateRows||'',children:feedChildren},statusCount:status.length};
})}
function assertTwoColumn(name,s){
  if(!s.timetable||!s.meal||s.meal.left<=s.timetable.left+100||Math.abs(s.meal.top-s.timetable.top)>180)throw new Error(`${name}: non-mobile viewport did not use the shared desktop content proportion ${JSON.stringify({timetable:s.timetable,meal:s.meal})}`);
}
function assertWideTodayDensity(c,s){
  if(c.width<1181||c.height<681)return;
  const grid=s.todayGrid?.box,card=s.upcoming?.box,feed=s.examFeed?.box,heading=s.upcomingHeading;
  if(!grid||!card||!feed||!heading||!s.examFeed?.visible)throw new Error(`${c.name}: Today density geometry missing ${JSON.stringify({todayGrid:s.todayGrid,upcoming:s.upcoming,upcomingHeading:s.upcomingHeading,examFeed:s.examFeed})}`);
  const paddingBottom=parseFloat(s.upcoming?.paddingBottom||'0')||0;
  const realUpcomingBottom=Math.max(heading.bottom||0,feed.bottom||0);
  const innerTrailing=Math.max(0,card.bottom-paddingBottom-realUpcomingBottom);
  const outerContentBottom=Math.max(s.timetable?.bottom||0,s.meal?.bottom||0,realUpcomingBottom+paddingBottom);
  const outerTrailing=Math.max(0,grid.bottom-outerContentBottom);
  if(innerTrailing>48||outerTrailing>48)throw new Error(`${c.name}: Today workspace contains excessive vertical dead space ${JSON.stringify({innerTrailing,outerTrailing,paddingBottom,todayGrid:s.todayGrid,rightStack:s.rightStack,timetable:s.timetable,meal:s.meal,upcoming:s.upcoming,upcomingHeading:s.upcomingHeading,examFeed:s.examFeed})}`);
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
    if(!s.sidebar.visible||!s.sideNav.visible||!s.main)throw new Error(`${c.name}: desktop workspace rail missing ${JSON.stringify({sidebar:s.sidebar,sideNav:s.sideNav,main:s.main})}`);
    if((s.sidebar.box?.width||0)<200||(s.sidebar.box?.width||999)>235||(s.sidebar.box?.height||0)<c.height-64)throw new Error(`${c.name}: persistent desktop rail geometry regressed ${JSON.stringify(s.sidebar)}`);
    if((s.sideNav.box?.width||0)<170||(s.sideNav.box?.height||0)<180)throw new Error(`${c.name}: desktop destinations are not a vertical rail ${JSON.stringify(s.sideNav)}`);
    if(Math.abs((s.sidebar.box?.top||0)-(s.main?.top||0))>4||s.main.left<(s.sidebar.box?.right||0)+12)throw new Error(`${c.name}: main workspace no longer starts beside the rail ${JSON.stringify({sidebar:s.sidebar.box,main:s.main})}`);
    if(s.top.visible||s.nav.visible||s.toggleVisible)throw new Error(`${c.name}: duplicate mobile/Today-Week chrome leaked into desktop ${JSON.stringify({top:s.top,nav:s.nav,toggleVisible:s.toggleVisible})}`);
    if(!s.hero.visible||s.hero.imageVisible||s.hero.shadeVisible||(s.hero.box?.height||999)>110)throw new Error(`${c.name}: desktop neutral Today header contract failed ${JSON.stringify(s.hero)}`);
    assertTwoColumn(c.name,s);
    const used=(s.meal?.right||0)-(s.timetable?.left||0),available=Math.max(0,(s.main?.width||0)-8);
    if(used<Math.min(1050,available*.84))throw new Error(`${c.name}: desktop Today workspace under-uses the main column ${JSON.stringify({used,available,shell:s.shell,main:s.main,timetable:s.timetable,meal:s.meal})}`);
  }
  assertWideTodayDensity(c,s);
}

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};
for(const c of CASES){
  const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:false,hasTouch:c.touch,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});const page=await context.newPage();page.setDefaultTimeout(15000);
  try{
    await fixture(page);await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolDesktopTabletUi==='v2'&&document.documentElement.dataset.flowSchoolSurface==='ready');await page.waitForTimeout(260);
    if(c.width>=1181&&c.height>=681){await page.locator('#flowExamFeedV3').waitFor({state:'visible'});await page.waitForTimeout(80)}
    const s=await state(page);assertState(c,s);await page.screenshot({path:`${OUT}/${c.name}.png`,fullPage:false,animations:'disabled'});await page.screenshot({path:`${OUT}/${c.name}-full.png`,fullPage:true,animations:'disabled'});report.cases.push({name:c.name,state:s,pass:true});console.log(`${c.name}: PASS`);
  }catch(error){const message=String(error?.stack||error);report.failures.push({name:c.name,message});report.cases.push({name:c.name,pass:false,message});console.error(`${c.name}: FAIL\n${message}`);try{await page.screenshot({path:`${OUT}/${c.name}-failure.png`,fullPage:false,animations:'disabled'})}catch{}}
  await context.close();
}
await browser.close();await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));if(report.failures.length)process.exit(1);console.log('School desktop/tablet redesign PASS');
