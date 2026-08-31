import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-portrait-tablet-composition-audit';
await fs.mkdir(OUT,{recursive:true});

const pad=value=>String(value).padStart(2,'0');
const today=(()=>{const date=new Date(Date.now()+9*60*60*1000);return`${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}`})();
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const dashboard={
  school:profile.school,selected:today,from:today,to:today,
  timetable:Array.from({length:7},(_,i)=>({date:today,period:i+1,subject:['자율·자치활동','선택과목','음악 감상과 비평','사진의 이해','선택과목','선택과목','영어Ⅱ'][i]})),
  meals:[{date:today,type:'중식',dishes:['누룽현미밥','배추된장국'],calories:'812.4 Kcal',nutrition:'단백질 32g',origin:'쌀 국내산'}],
  events:[],scheduleMeta:{mode:'month',count:0},
};

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixture(page){
  await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});return json(route,{})});
  await page.addInitScript(({profile})=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard');localStorage.setItem('flow-school-transit-lab-v1','off')},{profile});
}

async function composition(page){
  return page.evaluate(()=>{
    const shown=node=>Boolean(node&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0);
    const rect=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};
    const style=selector=>{const node=document.querySelector(selector);return node?getComputedStyle(node):null};
    const grid=style('#todayView .today-grid');
    const right=style('#todayView .right-stack');
    const meal=style('#todayView .meal-card');
    const heading=style('#todayView .timetable-card .card-heading h2');
    const period=style('#todayView .period-button');
    return{
      shell:{
        desktopSidebar:shown(document.querySelector('.desktop-sidebar')),
        mobileTopbar:shown(document.querySelector('.mobile-topbar')),
        bottomNav:shown(document.querySelector('#bottomNav')),
      },
      bottom:[...document.querySelectorAll('#bottomNav>*')].filter(shown).map(node=>node.textContent.trim()),
      todayJump:shown(document.querySelector('.today-jump')),
      hero:rect(document.querySelector('.school-hero')),
      todayGrid:{display:grid?.display||'',columns:grid?.gridTemplateColumns||''},
      rightStack:{display:right?.display||'',columns:right?.gridTemplateColumns||'',rows:right?.gridTemplateRows||''},
      timetable:rect(document.querySelector('#todayView .timetable-card')),
      meal:rect(document.querySelector('#todayView .meal-card')),
      upcoming:rect(document.querySelector('#todayView .upcoming-card')),
      mealBorders:{right:parseFloat(meal?.borderRightWidth||'0')||0,bottom:parseFloat(meal?.borderBottomWidth||'0')||0},
      headingFont:parseFloat(heading?.fontSize||'0')||0,
      periodHeight:parseFloat(period?.minHeight||'0')||0,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    };
  });
}

const cases=[
  {name:'tablet-portrait',width:768,height:1024,mobile:true},
  {name:'wide-tablet-portrait',width:960,height:1536,mobile:true},
  {name:'tablet-landscape',width:1024,height:768,mobile:false},
];

const browser=await chromium.launch({headless:true});
const report={};
for(const item of cases){
  const context=await browser.newContext({viewport:{width:item.width,height:item.height},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();
  const pageErrors=[],consoleErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  await fixture(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurfaceCleanup==='ready');
  await page.waitForFunction(()=>document.querySelectorAll('#todayView .period-button').length>=7);
  await page.waitForTimeout(80);
  const state=await composition(page);

  if(item.mobile){
    if(state.shell.desktopSidebar||!state.shell.mobileTopbar||!state.shell.bottomNav)throw new Error(`${item.name}: shell is not touch-first ${JSON.stringify(state.shell)}`);
    if(state.bottom.join('|')!=='오늘|일정|학교|설정')throw new Error(`${item.name}: bottom navigation mismatch ${JSON.stringify(state.bottom)}`);
    if(state.todayJump)throw new Error(`${item.name}: desktop Today jump leaked into portrait composition`);
    if(state.todayGrid.display!=='block'||state.rightStack.display!=='block')throw new Error(`${item.name}: content is still desktop/tablet split ${JSON.stringify({todayGrid:state.todayGrid,rightStack:state.rightStack})}`);
    if(!state.meal||!state.upcoming||state.upcoming.top<state.meal.bottom-1)throw new Error(`${item.name}: meal/upcoming are not vertically stacked ${JSON.stringify({meal:state.meal,upcoming:state.upcoming})}`);
    if(state.mealBorders.right>0.5||state.mealBorders.bottom<0.5)throw new Error(`${item.name}: desktop meal divider leaked into portrait composition ${JSON.stringify(state.mealBorders)}`);
    if(!state.hero||state.hero.height>132)throw new Error(`${item.name}: hero is still using wide desktop geometry ${JSON.stringify(state.hero)}`);
    if(state.headingFont>19.5||state.periodHeight>50)throw new Error(`${item.name}: timetable typography/rows are still wide-layout sized ${JSON.stringify({headingFont:state.headingFont,periodHeight:state.periodHeight})}`);
  }else{
    if(!state.shell.desktopSidebar||state.shell.mobileTopbar||state.shell.bottomNav)throw new Error(`${item.name}: landscape desktop shell regressed ${JSON.stringify(state.shell)}`);
    if(state.rightStack.display!=='grid')throw new Error(`${item.name}: landscape utility composition regressed ${JSON.stringify(state.rightStack)}`);
  }
  if(state.overflow>1)throw new Error(`${item.name}: horizontal overflow ${state.overflow}`);
  if(pageErrors.length||consoleErrors.length)throw new Error(`${item.name}: browser errors ${JSON.stringify({pageErrors,consoleErrors})}`);

  await page.screenshot({path:`${OUT}/${item.name}.png`,fullPage:false});
  await page.screenshot({path:`${OUT}/${item.name}-full.png`,fullPage:true});
  report[item.name]={state,pageErrors,consoleErrors};
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({ok:true,widePortrait:'full-mobile-composition',landscape:'desktop-preserved',viewports:Object.keys(report)},null,2));
