import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
await mkdir('university-audit',{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},locale:'ko-KR',timezoneId:'Asia/Seoul',isMobile:true,hasTouch:true,colorScheme:'light'});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>pageErrors.push(String(e)));
await page.addInitScript(()=>{
  const day=(new Date().getDay()+6)%7;
  const mk=(name,start,end,place)=>({name,professor:'테스트',credit:3,times:[{day,start,end,startMinutes:Number(start.slice(0,2))*60+Number(start.slice(3)),endMinutes:Number(end.slice(0,2))*60+Number(end.slice(3)),place}]});
  localStorage.setItem('flow-university-profile-v1',JSON.stringify({id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80'}));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[mk('자료구조','09:00','10:15','IT대학1호관'),mk('운영체제','11:00','12:15','공대9호관'),mk('네트워크','14:00','15:30','IT융합산업빌딩')]}));
  localStorage.removeItem('flow-university-dashboard-layout-v2');
  localStorage.removeItem('flow-university-dashboard-v1');
});
await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded'});
await page.locator('#widgetDashboard').waitFor({timeout:10000});
await page.waitForTimeout(300);

const nav=await page.evaluate(()=>{
  const bar=document.querySelector('.bottom-nav'),items=[...document.querySelectorAll('.bottom-nav .bottom-item')],r=bar?.getBoundingClientRect();
  const rects=items.map(el=>{const q=el.getBoundingClientRect();return{left:q.left,top:q.top,width:q.width,height:q.height,right:q.right,bottom:q.bottom,text:el.textContent.trim()}});
  return{count:items.length,height:r?.height||0,width:r?.width||0,grid:getComputedStyle(bar).gridTemplateColumns,rows:getComputedStyle(bar).gridTemplateRows,rects};
});
if(nav.count!==5||nav.rects.at(-1)?.text!=='설정')throw new Error(`Expected five mobile nav items ending in Settings: ${JSON.stringify(nav)}`);
if(nav.height>58||nav.height<50)throw new Error(`Mobile nav height regressed: ${JSON.stringify(nav)}`);
if(new Set(nav.rects.map(x=>Math.round(x.top))).size!==1)throw new Error(`Mobile nav wrapped to multiple rows: ${JSON.stringify(nav)}`);
if(nav.rects.some(x=>x.width<70||x.height<40))throw new Error(`Mobile nav items collapsed: ${JSON.stringify(nav)}`);

const flow=await page.locator('#widgetDashboard').evaluate(el=>getComputedStyle(el).gridAutoFlow);
if(flow!=='row')throw new Error(`Dashboard still uses unstable dense packing: ${flow}`);

await page.locator('#dashboardEditBtn').click();
const campus=page.locator('[data-widget-id="campus"]');
const last=page.locator('#widgetDashboard [data-widget-id]:not(.widget-hidden)').last();
const cb=await campus.boundingBox(),lb=await last.boundingBox();
if(!cb||!lb)throw new Error('Missing widget geometry for drag stability test.');
const sx=cb.x+cb.width*.5,sy=cb.y+cb.height*.5,ex=lb.x+lb.width*.5,ey=lb.y+lb.height*.7;
await page.mouse.move(sx,sy);await page.mouse.down();
const placeholderPath=[];
for(let i=1;i<=18;i++){
  const t=i/18,x=sx+(ex-sx)*t,y=sy+(ey-sy)*t;
  await page.mouse.move(x,y);
  await page.waitForTimeout(12);
  const p=await page.evaluate(()=>{const e=document.querySelector('.widget-drag-placeholder');if(!e)return null;const r=e.getBoundingClientRect();return{left:Math.round(r.left),top:Math.round(r.top+scrollY)}});
  if(p)placeholderPath.push(p);
}
await page.mouse.up();await page.waitForTimeout(260);
const visual=await page.evaluate(()=>{
  const rows=[...document.querySelectorAll('#widgetDashboard [data-widget-id]:not(.widget-hidden)')].map(el=>{const r=el.getBoundingClientRect();return{id:el.dataset.widgetId,left:r.left,top:r.top,right:r.right,bottom:r.bottom}});
  let backwards=0;
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i];
    if(b.top<a.top-1)backwards++;
    else if(Math.abs(b.top-a.top)<1&&b.left<a.left-1)backwards++;
  }
  return{rows,backwards,placeholders:document.querySelectorAll('.widget-drag-placeholder').length,floating:document.querySelectorAll('.widget-direct-floating').length};
});
if(visual.backwards)throw new Error(`DOM order and visual widget order diverged: ${JSON.stringify(visual)}`);
if(visual.placeholders||visual.floating)throw new Error(`Drag cleanup failed: ${JSON.stringify(visual)}`);

let reversals=0,lastDelta=0;
for(let i=1;i<placeholderPath.length;i++){
  const d=placeholderPath[i].top-placeholderPath[i-1].top;
  if(Math.abs(d)>2&&lastDelta&&Math.sign(d)!==Math.sign(lastDelta))reversals++;
  if(Math.abs(d)>2)lastDelta=d;
}
if(reversals>1)throw new Error(`Placeholder ping-ponged during one-way drag: ${JSON.stringify({reversals,placeholderPath})}`);

/* A long dashboard must scroll while the user keeps a lifted widget near the screen edge. */
await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(80);
const edgeWidget=page.locator('#widgetDashboard [data-widget-id]:not(.widget-hidden)').first();
const eb=await edgeWidget.boundingBox();if(!eb)throw new Error('Missing edge-scroll widget geometry.');
const edgeStart={x:eb.x+eb.width*.5,y:eb.y+Math.min(eb.height*.5,60)};
const beforeScroll=await page.evaluate(()=>scrollY);
await page.mouse.move(edgeStart.x,edgeStart.y);await page.mouse.down();
await page.mouse.move(Math.min(390,edgeStart.x+20),895,{steps:12});await page.waitForTimeout(420);
const autoScroll=await page.evaluate(()=>({before:0,after:scrollY,direction:document.documentElement.dataset.widgetAutoScroll||'',dragActive:document.body.classList.contains('widget-drag-active')}));
await page.mouse.up();await page.waitForTimeout(180);
const edgeCleanup=await page.evaluate(()=>({placeholder:document.querySelectorAll('.widget-drag-placeholder').length,floating:document.querySelectorAll('.widget-direct-floating').length,marker:document.documentElement.dataset.widgetAutoScroll||''}));
if(autoScroll.after<beforeScroll+24||autoScroll.direction!=='down'||!autoScroll.dragActive)throw new Error(`Widget edge auto-scroll did not engage: ${JSON.stringify({beforeScroll,autoScroll})}`);
if(edgeCleanup.placeholder||edgeCleanup.floating||edgeCleanup.marker)throw new Error(`Edge-scroll drag cleanup failed: ${JSON.stringify(edgeCleanup)}`);

await page.screenshot({path:'university-audit/mobile-nav-widget-stability.png',fullPage:true});
const report={nav,flow,placeholderPath,reversals,visual,beforeScroll,autoScroll,edgeCleanup,consoleErrors,pageErrors};
await writeFile('university-audit/mobile-stability-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(consoleErrors.length||pageErrors.length)throw new Error(`Browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
await browser.close();
