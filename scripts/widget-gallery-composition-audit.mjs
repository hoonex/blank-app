import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const out='university-audit';
const cases=[
  ['mobile-portrait',390,844],
  ['mobile-landscape',844,390],
  ['tablet-portrait',768,1024],
  ['tablet-landscape',1024,768],
  ['desktop-1366',1366,768],
  ['desktop-1920',1920,1080],
];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const report=[];

for(const[name,width,height]of cases){
  const context=await browser.newContext({viewport:{width,height},locale:'ko-KR',timezoneId:'Asia/Seoul',hasTouch:width<=1024,colorScheme:'light'});
  const page=await context.newPage();
  const consoleErrors=[],pageErrors=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.route('**/functions/v1/university-data**',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.route('**/functions/v1/flow-quest-event**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(()=>{
    const d=(new Date().getDay()+6)%7;
    const make=(name,start,end,place)=>({name,professor:'테스트',credit:3,times:[{day:d,start,end,startMinutes:Number(start.slice(0,2))*60+Number(start.slice(3)),endMinutes:Number(end.slice(0,2))*60+Number(end.slice(3)),place}]});
    localStorage.setItem('flow-university-profile-v1',JSON.stringify({id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80'}));
    localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[make('자료구조','08:00','09:30','IT대학1호관'),make('운영체제','11:00','12:15','공대9호관'),make('네트워크','14:00','15:30','IT융합산업빌딩')]}));
    localStorage.removeItem('flow-university-dashboard-layout-v2');
    localStorage.removeItem('flow-university-dashboard-v1');
    localStorage.setItem('flow-university-theme-v1','light');
  });
  await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#widgetDashboard').waitFor({timeout:10000});
  await page.locator('#dashboardEditBtn').click();
  await page.locator('#widgetAddBtn').click();
  await page.locator('#widgetPicker').waitFor({state:'visible'});
  const next=page.locator('#widgetPicker .widget-picker-live-preview.next-card').first();
  await next.waitFor({timeout:5000});
  const result=await page.evaluate(()=>{
    const live=document.querySelector('#widgetPicker .widget-picker-live-preview.next-card');
    const shell=live?.closest('.widget-picker-preview');
    const detail=live?.querySelector(':scope>.widget-variant-detail');
    const lr=live?.getBoundingClientRect(),sr=shell?.getBoundingClientRect();
    return{
      rows:live?.dataset.widgetRows||'',
      cols:live?.dataset.widgetCols||'',
      liveText:live?.innerText?.replace(/\s+/g,' ').trim()||'',
      detailDisplay:detail?getComputedStyle(detail).display:'missing',
      liveRect:lr?{left:lr.left,top:lr.top,right:lr.right,bottom:lr.bottom,width:lr.width,height:lr.height}:null,
      shellRect:sr?{left:sr.left,top:sr.top,right:sr.right,bottom:sr.bottom,width:sr.width,height:sr.height}:null,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    };
  });
  if(result.rows!=='1')throw new Error(`${name}: next preview lost one-row semantics: ${JSON.stringify(result)}`);
  if(result.detailDisplay!=='none')throw new Error(`${name}: next preview exposed row-only detail: ${JSON.stringify(result)}`);
  if(/시작\s*14:00/.test(result.liveText))throw new Error(`${name}: next preview still shows clipped start detail: ${JSON.stringify(result)}`);
  if(!result.liveRect||!result.shellRect||result.liveRect.left<result.shellRect.left-1||result.liveRect.right>result.shellRect.right+1||result.liveRect.top<result.shellRect.top-1||result.liveRect.bottom>result.shellRect.bottom+1)throw new Error(`${name}: live preview escaped its gallery shell: ${JSON.stringify(result)}`);
  if(result.overflow>2)throw new Error(`${name}: gallery caused horizontal overflow: ${JSON.stringify(result)}`);
  if(consoleErrors.length||pageErrors.length)throw new Error(`${name}: browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
  await page.screenshot({path:`${out}/widget-gallery-${name}.png`,fullPage:false});
  report.push({name,viewport:{width,height},...result,consoleErrors,pageErrors});
  await context.close();
}

await writeFile(`${out}/widget-gallery-composition-report.json`,JSON.stringify({generatedAt:new Date().toISOString(),cases:report},null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
