import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='university-audit';
const STATE_KEY='flow-university-dashboard-layout-v2';
await mkdir(OUT,{recursive:true});

const profile={id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80'};
function timetable(){
  const day=(new Date().getDay()+6)%7;
  const make=(name,start,end,place)=>({name,professor:'테스트',credit:3,times:[{day,start,end,startMinutes:Number(start.slice(0,2))*60+Number(start.slice(3)),endMinutes:Number(end.slice(0,2))*60+Number(end.slice(3)),place}]});
  return{year:2026,semester:'2학기',subjects:[make('자료구조','09:00','10:15','IT대학1호관'),make('운영체제','11:00','12:15','공대9호관'),make('네트워크','14:00','15:15','IT융합산업빌딩')]};
}

async function seed(page){
  await page.route('**/functions/v1/university-data**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({})}));
  await page.route('**/functions/v1/university-campus**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}})}));
  await page.addInitScript(({profile,tt})=>{
    if(sessionStorage.getItem('flow-dashboard-default-fixture-ready'))return;
    sessionStorage.setItem('flow-dashboard-default-fixture-ready','1');
    localStorage.clear();
    localStorage.setItem('flow-university-profile-v1',JSON.stringify(profile));
    localStorage.setItem('flow-university-timetable-v1',JSON.stringify(tt));
    localStorage.setItem('flow-university-theme-v1','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
    localStorage.removeItem('flow-university-dashboard-layout-v2');
    localStorage.removeItem('flow-university-dashboard-v1');
  },{profile,tt:timetable()});
}

async function snapshot(page){
  return page.evaluate(()=>{
    const grid=document.querySelector('#widgetDashboard');
    const memo=grid?.querySelector('[data-widget-id="memo"]');
    const schedule=grid?.querySelector('[data-widget-id="schedule"]');
    const scheduleList=schedule?.querySelector('.today-list');
    const rect=el=>{const r=el?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null};
    const gr=rect(grid),mr=rect(memo),sr=rect(schedule),style=grid?getComputedStyle(grid):null;
    return{
      columns:grid?.dataset.columns||'',memoSize:memo?.dataset.size||'',memoCols:memo?.dataset.widgetCols||'',
      grid:gr,memo:mr,schedule:sr,
      rowHeight:parseFloat(style?.gridAutoRows||'0')||0,
      scheduleListClientHeight:scheduleList?.clientHeight||0,
      scheduleListScrollHeight:scheduleList?.scrollHeight||0,
      visible:[...grid.querySelectorAll('[data-widget-id]:not(.widget-hidden)')].map(el=>({id:el.dataset.widgetId,size:el.dataset.size||''})),
      clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,viewportHeight:innerHeight,
    };
  });
}

function validateFresh(name,width,state){
  if(state.scrollWidth>state.clientWidth+2)throw new Error(`${name}: horizontal overflow ${JSON.stringify(state)}`);
  if(state.memoSize!=='2x1'||state.memoCols!=='2')throw new Error(`${name}: fresh memo did not use the declared 2x1 default ${JSON.stringify(state)}`);
  if(!state.grid||!state.memo||!state.schedule)throw new Error(`${name}: dashboard geometry missing ${JSON.stringify(state)}`);
  const ratio=state.memo.width/state.grid.width;
  if(width<=820){
    if(state.columns!=='2'||ratio<.96)throw new Error(`${name}: fresh mobile memo should finish as a full-width row ${JSON.stringify(state)}`);
  }else{
    if(state.columns!=='4'||ratio<.47||ratio>.53)throw new Error(`${name}: fresh desktop memo should occupy two of four columns ${JSON.stringify(state)}`);
    if(Math.abs(state.memo.right-state.grid.right)>3)throw new Error(`${name}: fresh desktop memo leaves an orphan slot on the right ${JSON.stringify(state)}`);
    if(state.memo.left<state.schedule.right-3)throw new Error(`${name}: memo overlaps the schedule half instead of completing the lower-right composition ${JSON.stringify(state)}`);
  }
  if(width===1920){
    if(state.rowHeight<150)throw new Error(`${name}: wide dashboard rows are still phone-like and undersized ${JSON.stringify(state)}`);
    if(state.schedule.height<315)throw new Error(`${name}: wide schedule card did not gain enough vertical reading room ${JSON.stringify(state)}`);
    if(state.grid.bottom<620)throw new Error(`${name}: dashboard still ends too early in the first fold ${JSON.stringify(state)}`);
    if(state.scheduleListScrollHeight>state.scheduleListClientHeight+1)throw new Error(`${name}: schedule list still requires internal scrolling on the wide canvas ${JSON.stringify(state)}`);
  }
}

const browser=await chromium.launch({headless:true});
const cases=[
  {name:'mobile-390',viewport:{width:390,height:844},mobile:true,touch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},mobile:false,touch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},mobile:false,touch:false},
];
const report={fresh:{},persisted:null};

for(const c of cases){
  const context=await browser.newContext({viewport:c.viewport,isMobile:c.mobile,hasTouch:c.touch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();
  await seed(page);
  await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#widgetDashboard').waitFor({timeout:10000});
  await page.locator('[data-widget-id="memo"]').waitFor({timeout:10000});
  await page.waitForTimeout(220);
  const state=await snapshot(page);
  validateFresh(c.name,c.viewport.width,state);
  report.fresh[c.name]=state;
  await page.screenshot({path:`${OUT}/dashboard-default-${c.name}.png`,fullPage:true});
  await context.close();
}

if(report.fresh['desktop-1920'].rowHeight<report.fresh['desktop-1366'].rowHeight+24)throw new Error(`wide adaptive row height did not materially exceed 1366 density: ${JSON.stringify(report.fresh)}`);

/* A user-chosen 1x1 memo must remain 1x1. This change is a fresh-state default, not a migration. */
{
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();
  await seed(page);
  await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-widget-id="memo"]').waitFor({timeout:10000});
  await page.evaluate(key=>{
    const grid=document.querySelector('#widgetDashboard'),widgets={};
    [...grid.querySelectorAll('[data-widget-id]')].forEach((el,order)=>widgets[el.dataset.widgetId]={size:el.dataset.size||'1x1',visible:!el.classList.contains('widget-hidden'),order});
    widgets.memo.size='1x1';
    localStorage.setItem(key,JSON.stringify({columns:4,widgets}));
  },STATE_KEY);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-widget-id="memo"]').waitFor({timeout:10000});
  await page.waitForTimeout(180);
  const state=await snapshot(page);
  if(state.memoSize!=='1x1'||state.memoCols!=='1')throw new Error(`persisted custom memo size was overwritten: ${JSON.stringify(state)}`);
  const ratio=state.memo.width/state.grid.width;
  if(ratio<.22||ratio>.28)throw new Error(`persisted custom 1x1 geometry changed: ${JSON.stringify(state)}`);
  report.persisted=state;
  await page.screenshot({path:`${OUT}/dashboard-persisted-memo-1x1.png`,fullPage:true});
  await context.close();
}

await browser.close();
await writeFile(`${OUT}/dashboard-default-composition-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
