import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'school-desktop-workspace-audit';
await mkdir(OUT,{recursive:true});

const SCHOOL={officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199',englishName:'Jeongdong High School',homepage:'https://jungdong.dge.hs.kr'};
const profile={school:SCHOOL,grade:2,className:'6'};
const pad=n=>String(n).padStart(2,'0');
const ymd=(d=new Date())=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
const today=ymd();
const dashboard={
  school:SCHOOL,selected:today,from:today,to:today,
  timetable:Array.from({length:7},(_,i)=>({date:today,period:i+1,subject:['문학','영어Ⅱ','수학Ⅱ','정보','스포츠 생활2','화학','진로활동'][i],grade:'2',className:'6'})),
  meals:[{date:today,type:'중식',dishes:['현미밥','부대찌개','계란찜','배추김치'],calories:'742 Kcal'}],
  events:[{date:today,name:'영어듣기평가',content:'2학년 평가'},{date:'20260928',name:'2학기중간시험',content:'1,2학년 중간시험'}],
  scheduleMeta:{mode:'fixture',count:2}
};
const cases=[{name:'desktop-1366',width:1366,height:768},{name:'desktop-1920',width:1920,height:1080}];
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)});
const close=(a,b,t=3)=>Math.abs(a-b)<=t;
const assert=(value,message)=>{if(!value)throw new Error(message)};

async function wire(page){
  await page.route('**/functions/v1/school-data*',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='dashboard')return json(route,dashboard);
    if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6','7','8']});
    if(action==='place')return json(route,{provider:'kakao',place:{url:'https://place.map.kakao.com/7240101'}});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo*',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({profile})=>{
    localStorage.clear();sessionStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
    localStorage.setItem('flow-school-transit-lab-v1','off');
  },{profile});
}

async function desktopState(page){
  return page.evaluate(()=>{
    const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
    const shown=n=>Boolean(n&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'&&n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0);
    const box=n=>{if(!n)return null;const r=n.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const sidebar=q('#desktopSidebar'),main=q('#dashboard .product-main'),hero=q('#todayView #schoolHero'),tt=q('#todayView .timetable-card'),right=q('#todayView .right-stack'),meal=q('#todayView .meal-card'),up=q('#todayView .upcoming-card');
    const status=qa('#todayView .status-card').filter(shown),nav=qa('#desktopSidebar .side-nav .nav-item').filter(shown);
    return{
      layout:document.documentElement.dataset.flowSchoolLayout||'',workspace:document.documentElement.dataset.flowSchoolDesktopWorkspace||'',
      viewport:{width:innerWidth,height:innerHeight},scroll:{client:document.documentElement.clientWidth,width:document.documentElement.scrollWidth},
      sidebar:box(sidebar),main:box(main),hero:box(hero),heroNameVisible:shown(q('#heroSchoolName')),
      mobileTopbar:shown(q('.mobile-topbar')),bottomNav:shown(q('#bottomNav')),inlineToggle:shown(q('#todayView .timetable-mode-toggle')),
      nav:nav.map(n=>({text:n.textContent.trim(),box:box(n),smallVisible:shown(n.querySelector('small'))})),
      status:status.map(n=>box(n)),today:{tt:box(tt),right:box(right),meal:box(meal),up:box(up)}
    };
  });
}

async function headerState(page,view){
  return page.evaluate(view=>{
    const q=s=>document.querySelector(s),box=n=>{if(!n)return null;const r=n.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const panel=q(`#${view}View`),header=panel?.querySelector(':scope > .view-header');
    return{header:box(header),panel:box(panel),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  },view);
}

const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};
for(const c of cases){
  const context=await browser.newContext({viewport:{width:c.width,height:c.height},deviceScaleFactor:1,isMobile:false,hasTouch:false,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(12000);await wire(page);
  const row={name:c.name,viewport:{width:c.width,height:c.height}};
  try{
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});
    await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready'&&document.documentElement.dataset.flowSchoolDesktopWorkspace==='v1');
    await page.waitForTimeout(180);await page.evaluate(()=>scrollTo(0,0));
    const s=await desktopState(page);row.today=s;
    assert(s.layout==='desktop',`${c.name}: not classified as desktop ${JSON.stringify(s)}`);
    assert(s.workspace==='v1',`${c.name}: desktop workspace module missing`);
    assert(!s.mobileTopbar&&!s.bottomNav,`${c.name}: mobile navigation leaked into desktop`);
    assert(s.sidebar&&s.sidebar.width>=190&&s.sidebar.width<=240&&s.sidebar.height>=c.height*.82,`${c.name}: sidebar is not a persistent desktop rail ${JSON.stringify(s.sidebar)}`);
    assert(s.main&&s.main.left>=s.sidebar.right+12&&s.main.width>=c.width-470,`${c.name}: main workspace does not sit beside the rail ${JSON.stringify({sidebar:s.sidebar,main:s.main})}`);
    assert(s.nav.length===4&&s.nav.every(x=>x.smallVisible),`${c.name}: desktop nav lost descriptive hierarchy ${JSON.stringify(s.nav)}`);
    for(let i=1;i<s.nav.length;i++)assert(s.nav[i].box.top>=s.nav[i-1].box.bottom+3,`${c.name}: desktop nav is not vertically stacked ${JSON.stringify(s.nav)}`);
    assert(!s.inlineToggle,`${c.name}: duplicate Today/Week segmented control is still visible`);
    assert(s.hero&&s.hero.height>=60&&s.hero.height<=92&&!s.heroNameVisible,`${c.name}: Today command bar still behaves like duplicate school hero ${JSON.stringify({hero:s.hero,heroNameVisible:s.heroNameVisible})}`);
    assert(s.status.length===2&&close(s.status[0].top,s.status[1].top)&&Math.abs(s.status[0].width-s.status[1].width)<=8,`${c.name}: two desktop status surfaces do not use the row ${JSON.stringify(s.status)}`);
    assert(s.status[1].right>=s.main.right-12,`${c.name}: status row leaves desktop dead space ${JSON.stringify({status:s.status,main:s.main})}`);
    const ratio=s.today.tt.width/s.today.right.width,target=1.42/.72;
    assert(close(s.today.tt.top,s.today.right.top)&&s.today.right.left>=s.today.tt.right+10&&Math.abs(ratio-target)<=.12,`${c.name}: Today workspace ratio/columns failed ${JSON.stringify({ratio,target,today:s.today})}`);
    assert(close(s.today.meal.left,s.today.up.left)&&s.today.up.top>=s.today.meal.bottom+10,`${c.name}: utility rail is not vertically stacked ${JSON.stringify(s.today)}`);
    assert(s.scroll.width<=s.scroll.client+2,`${c.name}: horizontal overflow ${JSON.stringify(s.scroll)}`);
    await page.screenshot({path:`${OUT}/${c.name}-today-viewport.png`,fullPage:false,animations:'disabled'});

    await page.locator('#desktopSidebar [data-view="week"]').click();
    await page.waitForFunction(()=>document.body.classList.contains('flow-inline-week-active')||!document.querySelector('#weekView')?.classList.contains('hidden'));
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${OUT}/${c.name}-week-viewport.png`,fullPage:false,animations:'disabled'});

    await page.locator('#desktopSidebar [data-view="schedule"]').click();await page.waitForSelector('#scheduleView:not(.hidden)');await page.evaluate(()=>scrollTo(0,0));
    const schedule=await headerState(page,'schedule');row.schedule=schedule;
    assert(schedule.header&&schedule.header.height<=92&&schedule.overflow<=2,`${c.name}: Schedule still uses oversized mobile-style heading ${JSON.stringify(schedule)}`);
    const scheduleColumns=await page.evaluate(()=>{const a=document.querySelector('#scheduleView .calendar-card')?.getBoundingClientRect(),b=document.querySelector('#scheduleView .schedule-layout>.content-card:not(.calendar-card)')?.getBoundingClientRect();return a&&b?{a:{left:a.left,right:a.right,top:a.top,width:a.width},b:{left:b.left,right:b.right,top:b.top,width:b.width}}:null});
    assert(scheduleColumns&&close(scheduleColumns.a.top,scheduleColumns.b.top)&&scheduleColumns.b.left>=scheduleColumns.a.right+10,`${c.name}: Schedule is not a desktop two-column workspace ${JSON.stringify(scheduleColumns)}`);
    await page.screenshot({path:`${OUT}/${c.name}-schedule-viewport.png`,fullPage:false,animations:'disabled'});

    await page.locator('#desktopSidebar [data-view="school"]').click();await page.waitForSelector('#schoolView:not(.hidden)');await page.waitForSelector('#schoolInfoGrid .info-tile');await page.evaluate(()=>scrollTo(0,0));
    const school=await headerState(page,'school');row.school=school;
    const schoolProfile=await page.locator('#schoolView .profile-hero').boundingBox();
    assert(school.header&&school.header.height<=92&&schoolProfile&&schoolProfile.height<=220&&school.overflow<=2,`${c.name}: School page still has oversized stacked heroes ${JSON.stringify({school,schoolProfile})}`);
    await page.screenshot({path:`${OUT}/${c.name}-school-viewport.png`,fullPage:false,animations:'disabled'});
    row.pass=true;
  }catch(error){row.pass=false;row.error=error?.stack||String(error);report.failures.push({case:c.name,error:row.error});console.error(`${c.name}: FAIL\n${row.error}`)}
  finally{report.cases.push(row);await context.close()}
}
await browser.close();await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
if(report.failures.length)throw new Error(`School desktop workspace found ${report.failures.length} failure(s)`);
console.log(`School desktop workspace PASS: ${cases.length} viewports`);
