import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
await mkdir('university-audit',{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},locale:'ko-KR',timezoneId:'Asia/Seoul',isMobile:true,hasTouch:true,colorScheme:'light'});

/* School branding must be correct before the late polish loader runs. */
const school=await context.newPage();
await school.route('**/school-metrics.js',route=>route.abort());
await school.goto(`${base}/`,{waitUntil:'domcontentloaded'});
const schoolFirstPaint=await school.evaluate(()=>({
  markDisplay:getComputedStyle(document.querySelector('.landing-header .flow-logo-mark')).display,
  brand:document.querySelector('.landing-header .flow-logo-copy')?.textContent?.replace(/\s+/g,' ').trim()||'',
  critical:Boolean(document.querySelector('#flow-school-brand-critical')),
}));
if(schoolFirstPaint.markDisplay!=='none'||!schoolFirstPaint.critical||!schoolFirstPaint.brand.includes('Flow'))throw new Error(`School first-paint logo flash regression: ${JSON.stringify(schoolFirstPaint)}`);
await school.close();

const page=await context.newPage();
const consoleErrors=[],pageErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});page.on('pageerror',e=>pageErrors.push(String(e)));
await page.addInitScript(()=>{
  if(sessionStorage.getItem('flow-widget-v2-fixture-ready'))return;
  sessionStorage.setItem('flow-widget-v2-fixture-ready','1');
  const d=(new Date().getDay()+6)%7;
  const make=(name,start,end,place,credit=3)=>({name,professor:'테스트',credit,times:[{day:d,start,end,startMinutes:Number(start.slice(0,2))*60+Number(start.slice(3)),endMinutes:Number(end.slice(0,2))*60+Number(end.slice(3)),place}]});
  const tomorrow=(d+1)%7;
  const tomorrowSubject={name:'내일첫수업',professor:'테스트',credit:2,times:[{day:tomorrow,start:'09:00',end:'10:15',startMinutes:540,endMinutes:615,place:'미래융합과학관'}]};
  localStorage.setItem('flow-university-profile-v1',JSON.stringify({id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80'}));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[make('자료구조','08:00','09:30','IT대학1호관'),make('운영체제','11:00','12:15','공대9호관'),make('네트워크','14:00','15:30','IT융합산업빌딩'),tomorrowSubject]}));
  localStorage.removeItem('flow-university-dashboard-layout-v2');
  localStorage.removeItem('flow-university-dashboard-v1');
  localStorage.removeItem('flow-university-memo-v1');
});
await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded'});
await page.locator('#widgetDashboard').waitFor({timeout:10000});
await page.locator('[data-widget-id="memo"]').waitFor({timeout:10000});
await page.waitForTimeout(250);
const initial=await page.evaluate(()=>({
  columns:document.querySelector('#widgetDashboard')?.dataset.columns,
  memoSize:document.querySelector('[data-widget-id="memo"]')?.dataset.size,
  oldControls:document.querySelectorAll('.widget-controls').length,
  v2Controls:document.querySelectorAll('.widget-v2-controls').length,
  widgetIds:[...document.querySelectorAll('#widgetDashboard [data-widget-id]')].map(x=>x.dataset.widgetId),
  width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth
}));
const expectedNew=['clock','progress','remaining','tomorrow','credits','shortcuts'];
if(initial.columns!=='2')throw new Error(`Expected 2-column mobile default: ${JSON.stringify(initial)}`);
if(initial.oldControls!==0||initial.v2Controls<15)throw new Error(`Editor controls not upgraded for all widgets: ${JSON.stringify(initial)}`);
if(expectedNew.some(id=>!initial.widgetIds.includes(id))||initial.widgetIds.length<15)throw new Error(`Widget variety is incomplete: ${JSON.stringify(initial.widgetIds)}`);
if(initial.scrollWidth>initial.width+3)throw new Error(`Initial overflow: ${JSON.stringify(initial)}`);

await page.locator('#dashboardEditBtn').click();
await page.locator('[data-dashboard-columns="3"]').click();
if(await page.locator('#widgetDashboard').getAttribute('data-columns')!=='3')throw new Error('3-column layout did not apply.');
const memo=page.locator('[data-widget-id="memo"]');
const input=page.locator('#widgetMemoInput');
await input.fill('알고리즘 과제 제출\n학생식당 12:30\n우산 챙기기');
await page.waitForTimeout(180);

/* Resize must follow the pointer continuously, and snap only after release. */
const beforeSize=await memo.getAttribute('data-size');
const beforeRect=await memo.boundingBox();
const handle=page.locator('[data-widget-id="memo"] .widget-v2-resize'),hb=await handle.boundingBox();
if(!hb||!beforeRect)throw new Error('Resize handle or memo geometry is missing.');
await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();
await page.mouse.move(hb.x+hb.width/2+74,hb.y+hb.height/2+46,{steps:8});
const duringResize=await page.evaluate(id=>{const e=document.querySelector(`[data-widget-id="${id}"]`);const r=e?.getBoundingClientRect();return{size:e?.dataset.size||'',position:e?getComputedStyle(e).position:'',width:r?.width||0,height:r?.height||0,placeholder:document.querySelectorAll('.widget-resize-placeholder').length,target:e?.querySelector('.widget-v2-size-label')?.textContent||''}},'memo');
if(duringResize.size!==beforeSize||duringResize.position!=='fixed'||duringResize.placeholder!==1)throw new Error(`Resize snapped before pointer release: ${JSON.stringify({beforeSize,duringResize})}`);
if(Math.abs(duringResize.width-beforeRect.width)<20&&Math.abs(duringResize.height-beforeRect.height)<20)throw new Error(`Widget did not physically follow resize drag: ${JSON.stringify({beforeRect,duringResize})}`);
await page.mouse.move(hb.x+hb.width/2+150,hb.y+hb.height/2+125,{steps:8});await page.mouse.up();await page.waitForTimeout(260);
const afterSize=await memo.getAttribute('data-size');
const resized=await page.evaluate(()=>{const e=document.querySelector('[data-widget-id="memo"]'),r=e?.getBoundingClientRect();return{size:e?.dataset.size,cols:e?.dataset.widgetCols,rows:e?.dataset.widgetRows,width:r?.width,height:r?.height,position:e?getComputedStyle(e).position:'',placeholder:document.querySelectorAll('.widget-resize-placeholder').length}});
if(beforeSize===afterSize||Number(resized.rows)<2||resized.position==='fixed'||resized.placeholder!==0)throw new Error(`Resize did not snap cleanly on release: ${JSON.stringify({beforeSize,afterSize,resized})}`);

/* Long press from normal mode should enter edit mode and keep the same card under the pointer. */
await page.locator('#widgetDoneBtn').click();
if(await page.locator('#todayView').evaluate(el=>el.classList.contains('dashboard-editing')))throw new Error('Editor did not close before long-press test.');
const orderBefore=await page.evaluate(()=>[...document.querySelectorAll('#widgetDashboard [data-widget-id]:not(.widget-hidden)')].map(x=>x.dataset.widgetId));
const campus=page.locator('[data-widget-id="campus"]'),target=page.locator('[data-widget-id="next"]'),cb=await campus.boundingBox(),tb=await target.boundingBox();
if(!cb||!tb)throw new Error('Drag test widgets are not visible.');
const start={x:cb.x+cb.width*.48,y:cb.y+cb.height*.48};
await page.mouse.move(start.x,start.y);await page.mouse.down();await page.waitForTimeout(470);
const longPressState=await page.evaluate(()=>({editing:document.querySelector('#todayView')?.classList.contains('dashboard-editing'),floating:document.querySelector('[data-widget-id="campus"]')?.classList.contains('widget-direct-drag'),placeholder:document.querySelectorAll('.widget-drag-placeholder').length,position:getComputedStyle(document.querySelector('[data-widget-id="campus"]')).position}));
if(!longPressState.editing||!longPressState.floating||longPressState.placeholder!==1||longPressState.position!=='fixed')throw new Error(`Long press did not lift widget: ${JSON.stringify(longPressState)}`);
await page.mouse.move(start.x+44,start.y+36,{steps:6});
const dragFollow=await page.evaluate(()=>{const e=document.querySelector('[data-widget-id="campus"]'),r=e.getBoundingClientRect();return{left:r.left,top:r.top,placeholder:document.querySelectorAll('.widget-drag-placeholder').length}});
if(Math.abs(dragFollow.left-cb.x)<15&&Math.abs(dragFollow.top-cb.y)<15)throw new Error(`Floating widget did not follow pointer: ${JSON.stringify({cb,dragFollow})}`);
await page.mouse.move(tb.x+12,tb.y+12,{steps:12});await page.mouse.up();await page.waitForTimeout(260);
const orderAfter=await page.evaluate(()=>[...document.querySelectorAll('#widgetDashboard [data-widget-id]:not(.widget-hidden)')].map(x=>x.dataset.widgetId));
const dragSettled=await page.evaluate(()=>({floating:document.querySelectorAll('.widget-direct-floating').length,placeholder:document.querySelectorAll('.widget-drag-placeholder').length}));
if(orderBefore.join('|')===orderAfter.join('|')||dragSettled.floating||dragSettled.placeholder)throw new Error(`Long-press drag did not reorder and settle: ${JSON.stringify({orderBefore,orderAfter,dragSettled})}`);

/* Picker should expose the expanded widget library with meaningful options. */
await page.locator('#widgetAddBtn').click();await page.locator('#widgetPicker').waitFor({state:'visible'});await page.locator('[data-v2-picker-id="memo"]').waitFor({timeout:3000});
const picker=await page.evaluate(()=>({count:document.querySelectorAll('#widgetPickerList .widget-picker-item').length,labels:[...document.querySelectorAll('#widgetPickerList .widget-picker-item strong')].map(x=>x.textContent.trim())}));
for(const label of ['현재 시각','수업 진행률','남은 수업','내일 첫 수업','이번 학기 학점','바로가기','메모'])if(!picker.labels.includes(label))throw new Error(`Widget picker missing ${label}: ${JSON.stringify(picker)}`);
if(picker.count<15)throw new Error(`Too few widget choices: ${JSON.stringify(picker)}`);
for(const id of ['clock','progress','shortcuts']){const b=page.locator(`[data-picker-id="${id}"]`);if(await b.count())await b.click()}
await page.locator('[data-widget-picker-close]').click();
for(const id of ['clock','progress','shortcuts'])if(await page.locator(`[data-widget-id="${id}"].widget-hidden`).count())throw new Error(`Added widget stayed hidden: ${id}`);
const utilityState=await page.evaluate(()=>({clock:document.querySelector('#widgetClockTitle')?.textContent||'',progress:document.querySelector('#widgetProgressTitle')?.textContent||'',shortcuts:document.querySelectorAll('.widget-shortcut-grid button').length}));
if(!/:/.test(utilityState.clock)||!utilityState.progress||utilityState.shortcuts!==4)throw new Error(`Expanded widgets did not render useful content: ${JSON.stringify(utilityState)}`);

/* Memo removal/restoration remains supported. */
await page.locator('[data-widget-id="memo"] .widget-v2-remove').click();
if(!await page.locator('[data-widget-id="memo"].widget-hidden').count())throw new Error('Memo remove failed.');
await page.locator('#widgetAddBtn').click();await page.locator('#widgetPicker').waitFor({state:'visible'});await page.locator('[data-v2-picker-id="memo"]').waitFor({timeout:3000});await page.locator('[data-v2-picker-id="memo"]').click();await page.locator('[data-widget-picker-close]').click();
if(await page.locator('[data-widget-id="memo"].widget-hidden').count())throw new Error('Memo restore failed.');
await page.locator('#widgetDoneBtn').click();
const saved=await page.evaluate(()=>({layout:JSON.parse(localStorage.getItem('flow-university-dashboard-layout-v2')||'null'),memo:localStorage.getItem('flow-university-memo-v1')}));
if(saved.layout?.columns!==3)throw new Error(`Column count not persisted: ${JSON.stringify(saved)}`);
if(!saved.memo?.includes('알고리즘 과제 제출'))throw new Error(`Memo not persisted: ${JSON.stringify(saved)}`);
await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-widget-id="memo"]').waitFor();await page.waitForTimeout(300);
const reloaded=await page.evaluate(()=>({columns:document.querySelector('#widgetDashboard')?.dataset.columns,size:document.querySelector('[data-widget-id="memo"]')?.dataset.size,memo:document.querySelector('#widgetMemoInput')?.value,clockVisible:!document.querySelector('[data-widget-id="clock"]')?.classList.contains('widget-hidden'),width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
if(reloaded.columns!=='3'||reloaded.size!==afterSize||!reloaded.memo?.includes('우산 챙기기')||!reloaded.clockVisible)throw new Error(`Reload lost editor state: ${JSON.stringify(reloaded)}`);
if(reloaded.scrollWidth>reloaded.width+3)throw new Error(`Mobile overflow after 3-column layout: ${JSON.stringify(reloaded)}`);
await page.screenshot({path:'university-audit/mobile-widget-editor-v2.png',fullPage:true});
await page.waitForTimeout(450);
const idleMutations=await page.evaluate(async()=>{let count=0;const root=document.querySelector('#todayView');const o=new MutationObserver(m=>count+=m.length);o.observe(root,{subtree:true,childList:true,characterData:true,attributes:true});await new Promise(r=>setTimeout(r,1200));o.disconnect();return count});
if(idleMutations!==0)throw new Error(`Widget editor mutates while idle: ${idleMutations}`);
await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(220);
const desktop=await page.evaluate(()=>({columns:document.querySelector('#widgetDashboard')?.dataset.columns,width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
if(desktop.columns!=='3'||desktop.scrollWidth>desktop.width+3)throw new Error(`Desktop layout regression: ${JSON.stringify(desktop)}`);
await page.screenshot({path:'university-audit/desktop-widget-editor-v2.png',fullPage:true});
const report={schoolFirstPaint,initial,beforeSize,beforeRect,duringResize,afterSize,resized,longPressState,dragFollow,orderBefore,orderAfter,picker,utilityState,reloaded,desktop,idleMutations,consoleErrors,pageErrors};
await writeFile('university-audit/widget-editor-v2-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(consoleErrors.length||pageErrors.length)throw new Error(`Browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
await browser.close();
