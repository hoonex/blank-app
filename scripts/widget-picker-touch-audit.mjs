import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';

const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const out='university-audit';
await mkdir(out,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  viewport:{width:390,height:844},
  locale:'ko-KR',
  timezoneId:'Asia/Seoul',
  isMobile:true,
  hasTouch:true,
  colorScheme:'light'
});
const page=await context.newPage();
const cdp=await context.newCDPSession(page);
const consoleErrors=[],pageErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>pageErrors.push(String(e)));

await page.route('**/functions/v1/university-data**',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
await page.route('**/functions/v1/flow-quest-event**',route=>route.fulfill({status:204,body:''}));
await page.route('**/functions/v1/university-campus**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({center:{x:'128.6105',y:'35.8890'},places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}})}));

await page.addInitScript(()=>{
  const d=(new Date().getDay()+6)%7;
  const make=(name,start,end,place)=>({name,professor:'테스트',credit:3,times:[{day:d,start,end,startMinutes:Number(start.slice(0,2))*60+Number(start.slice(3)),endMinutes:Number(end.slice(0,2))*60+Number(end.slice(3)),place}]});
  localStorage.setItem('flow-university-profile-v1',JSON.stringify({id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80',campus:'대구캠퍼스'}));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[make('자료구조','08:00','09:30','IT대학1호관'),make('운영체제','11:00','12:15','공대9호관')]}));
  localStorage.removeItem('flow-university-dashboard-layout-v2');
  localStorage.removeItem('flow-university-dashboard-v1');
  localStorage.setItem('flow-university-theme-v1','light');
});

await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded',timeout:30000});
await page.locator('#widgetDashboard').waitFor({timeout:10000});
await page.locator('#dashboardEditBtn').click();
await page.locator('#todayView.dashboard-editing').waitFor({timeout:5000});
await page.locator('#widgetAddBtn').click();
await page.locator('#widgetPicker').waitFor({state:'visible',timeout:5000});
await page.locator('#widgetPicker .widget-picker-live-preview').first().waitFor({timeout:5000});
await page.waitForTimeout(120);

await page.evaluate(()=>{
  const el=document.querySelector('#widgetPicker [data-picker-id="clock"]');
  if(!el)throw new Error('Clock picker item missing after gallery render.');
  el.scrollIntoView({block:'center',inline:'nearest'});
});
await page.waitForTimeout(80);
const box=await page.evaluate(()=>{
  const el=document.querySelector('#widgetPicker [data-picker-id="clock"]');
  if(!el)return null;
  const r=el.getBoundingClientRect();
  return{x:r.x,y:r.y,width:r.width,height:r.height};
});
if(!box||!box.width||!box.height)throw new Error('Clock picker item has no geometry.');
const x=Math.round(box.x+box.width*.5),y=Math.round(box.y+Math.min(52,box.height*.34));
const point=(px,py)=>({x:Math.round(px),y:Math.round(py),id:17,radiusX:8,radiusY:8,force:.6});

await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(x,y)]});
await page.waitForTimeout(390);

const lifted=await page.evaluate(()=>{
  const floating=document.querySelector('.widget-direct-floating');
  const r=floating?.getBoundingClientRect();
  return{
    pickerOpen:Boolean(document.querySelector('#widgetPicker')?.open),
    editing:document.querySelector('#todayView')?.classList.contains('dashboard-editing'),
    id:floating?.dataset.widgetId||'',
    lifted:floating?.dataset.pickerLifted||'',
    rect:r?{left:r.left,top:r.top,width:r.width,height:r.height}:null,
    placeholder:document.querySelectorAll('.widget-drag-placeholder').length,
  };
});
if(lifted.pickerOpen||!lifted.editing||lifted.id!=='clock'||lifted.lifted!=='1'||!lifted.rect||lifted.placeholder!==1){
  throw new Error(`Real touch hold did not lift gallery widget: ${JSON.stringify(lifted)}`);
}

const target=await page.locator('#widgetDashboard [data-widget-id="next"]').boundingBox();
if(!target)throw new Error('Canvas target has no geometry.');
const tx=Math.round(target.x+target.width*.5);
const ty=Math.max(110,Math.min(730,Math.round(target.y+target.height*.5)));
const scrollBefore=await page.evaluate(()=>scrollY);

for(let i=1;i<=7;i++){
  const mx=x+(tx-x)*(i/7),my=y+(ty-y)*(i/7);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(mx,my)]});
  await page.waitForTimeout(32);
}
await page.waitForTimeout(220);

const moving=await page.evaluate(()=>{
  const floating=document.querySelector('.widget-direct-floating');
  const r=floating?.getBoundingClientRect();
  const p=document.querySelector('.widget-drag-placeholder');
  return{
    pickerOpen:Boolean(document.querySelector('#widgetPicker')?.open),
    id:floating?.dataset.widgetId||'',
    rect:r?{left:r.left,top:r.top,width:r.width,height:r.height}:null,
    pending:p?.dataset.dropPending||'',
    scrollY,
  };
});
if(moving.pickerOpen||moving.id!=='clock'||!moving.rect){
  throw new Error(`Touch continuity was lost after leaving gallery: ${JSON.stringify(moving)}`);
}
if(Math.abs((moving.rect.left+moving.rect.width*.5)-tx)>85||Math.abs((moving.rect.top+Math.min(moving.rect.height*.34,62))-ty)>110){
  throw new Error(`Floating widget did not follow active finger: ${JSON.stringify({tx,ty,moving})}`);
}
if(Math.abs(moving.scrollY-scrollBefore)>90){
  throw new Error(`Native page pan stole the held gallery gesture: ${JSON.stringify({scrollBefore,moving})}`);
}

await page.screenshot({path:`${out}/widget-gallery-real-touch-drag.png`,fullPage:false});
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await page.waitForTimeout(360);

const settled=await page.evaluate(()=>({
  floating:document.querySelectorAll('.widget-direct-floating').length,
  placeholder:document.querySelectorAll('.widget-drag-placeholder').length,
  clockVisible:!document.querySelector('[data-widget-id="clock"]')?.classList.contains('widget-hidden'),
  stored:JSON.parse(localStorage.getItem('flow-university-dashboard-layout-v2')||'null'),
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
}));
if(settled.floating||settled.placeholder||!settled.clockVisible||!settled.stored?.widgets?.clock||settled.overflow>2){
  throw new Error(`Real touch gallery drag did not settle cleanly: ${JSON.stringify(settled)}`);
}
if(consoleErrors.length||pageErrors.length){
  throw new Error(`Browser errors during touch gallery drag: ${JSON.stringify({consoleErrors,pageErrors})}`);
}

console.log(JSON.stringify({ok:true,lifted,moving,settled:{clockVisible:settled.clockVisible,overflow:settled.overflow}},null,2));
await browser.close();
