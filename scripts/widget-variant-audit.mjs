import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
await mkdir('university-audit',{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul'});
const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(()=>{
  const today=(new Date().getDay()+6)%7,tomorrow=(today+1)%7;
  const block=(name,day,start,end,place)=>({name,professor:'테스트 교수',credit:3,times:[{day,start,end,startMinutes:Number(start.slice(0,2))*60+Number(start.slice(3)),endMinutes:Number(end.slice(0,2))*60+Number(end.slice(3)),place}]});
  localStorage.setItem('flow-university-profile-v1',JSON.stringify({id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80'}));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[block('자료구조',today,'08:30','09:45','IT대학1호관'),block('운영체제',today,'11:00','12:15','공대9호관'),block('네트워크',today,'14:00','15:15','IT융합산업빌딩'),block('알고리즘',tomorrow,'09:00','10:15','IT대학2호관')]}));
  localStorage.removeItem('flow-university-dashboard-v1');localStorage.removeItem('flow-university-dashboard-layout-v2');
});
await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#widgetDashboard').waitFor();await page.locator('[data-widget-id="memo"]').waitFor();await page.waitForTimeout(250);
await page.locator('#dashboardEditBtn').click();await page.locator('#widgetAddBtn').click();await page.locator('#widgetPicker').waitFor({state:'visible'});
for(const id of ['dayflow','weekload']){const button=page.locator(`[data-picker-id="${id}"]`);if(await button.count()!==1)throw new Error(`Missing picker entry ${id}`);await button.click()}
await page.locator('[data-widget-picker-close]').click();
const semantic=await page.evaluate(()=>{
  const day=document.querySelector('[data-widget-id="dayflow"]'),week=document.querySelector('[data-widget-id="weekload"]');
  const visible=e=>e&&getComputedStyle(e).display!=='none';
  const result={
    day:{size:day?.dataset.size,cols:day?.dataset.widgetCols,rows:day?.dataset.widgetRows,title:day?.querySelector('#widgetDayflowTitle')?.textContent,listVisible:visible(day?.querySelector('#widgetDayflowList')),rowsCount:day?.querySelectorAll('.widget-mini-row').length},
    week:{size:week?.dataset.size,cols:week?.dataset.widgetCols,rows:week?.dataset.widgetRows,title:week?.querySelector('#widgetWeekloadTitle')?.textContent,barsVisible:visible(week?.querySelector('#widgetWeekloadBars')),largeVisible:visible(week?.querySelector('#widgetWeekloadDetail'))},
    pickerLabels:[...document.querySelectorAll('#widgetPickerList strong')].map(x=>x.textContent?.trim()),
  };
  day.dataset.widgetCols='1';day.dataset.widgetRows='1';result.compactListDisplay=getComputedStyle(day.querySelector('#widgetDayflowList')).display;
  day.dataset.widgetCols='2';day.dataset.widgetRows='1';result.wideListDisplay=getComputedStyle(day.querySelector('#widgetDayflowList')).display;
  return result;
});
if(semantic.day.cols!=='2'||semantic.day.rows!=='1'||!semantic.day.listVisible||semantic.day.rowsCount<1)throw new Error(`Day-flow wide variant failed: ${JSON.stringify(semantic)}`);
if(semantic.week.cols!=='2'||semantic.week.rows!=='2'||!semantic.week.barsVisible||!semantic.week.largeVisible)throw new Error(`Week-load large variant failed: ${JSON.stringify(semantic)}`);
if(semantic.compactListDisplay!=='none'||semantic.wideListDisplay==='none')throw new Error(`Compact/wide semantic switch failed: ${JSON.stringify(semantic)}`);
if(!semantic.pickerLabels.includes('오늘 흐름')||!semantic.pickerLabels.includes('주간 밀도'))throw new Error(`Picker labels missing: ${JSON.stringify(semantic.pickerLabels)}`);
await page.locator('#widgetDoneBtn').click();await page.screenshot({path:'university-audit/mobile-widget-variants.png',fullPage:true});
await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(180);await page.screenshot({path:'university-audit/desktop-widget-variants.png',fullPage:true});
const geometry=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,widgetCount:document.querySelectorAll('#widgetDashboard [data-widget-id]').length}));
if(geometry.scrollWidth>geometry.width+3||geometry.widgetCount<17)throw new Error(`Variant geometry regression: ${JSON.stringify(geometry)}`);
if(errors.length)throw new Error(`Browser errors: ${JSON.stringify(errors)}`);
const report={semantic,geometry,errors};await writeFile('university-audit/widget-variant-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
