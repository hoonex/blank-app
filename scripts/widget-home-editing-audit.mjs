import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const out='university-audit';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR',timezoneId:'Asia/Seoul',isMobile:true,hasTouch:true,colorScheme:'light'});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>pageErrors.push(String(e)));

const campusFixture={
  center:{x:'128.6105',y:'35.8890'},
  places:[
    {raw:'IT대학1호관',resolved:true,place:{id:'1',name:'IT대학1호관',url:'https://place.map.kakao.com/1',x:'128.6100',y:'35.8886',roadAddress:'대구 북구 대학로 80'}},
    {raw:'공대9호관',resolved:true,place:{id:'2',name:'공대9호관',url:'https://place.map.kakao.com/2',x:'128.6110',y:'35.8892',roadAddress:'대구 북구 대학로 80'}},
    {raw:'IT융합산업빌딩',resolved:true,place:{id:'3',name:'IT융합산업빌딩',url:'https://place.map.kakao.com/3',x:'128.6120',y:'35.8898',roadAddress:'대구 북구 대학로 80'}},
  ],
  nearby:{
    dining:[{id:'d1',name:'학생식당',url:'https://place.map.kakao.com/d1',category:'음식점 > 구내식당',x:'128.6107',y:'35.8891',distance:120}],
    stores:[{id:'s1',name:'GS25 경북대점',url:'https://place.map.kakao.com/s1',category:'편의점',x:'128.6108',y:'35.8893',distance:180}],
    cafes:[{id:'c1',name:'카페 캠퍼스',url:'https://place.map.kakao.com/c1',category:'카페',x:'128.6112',y:'35.8894',distance:220}],
    food:[{id:'f1',name:'캠퍼스 식당',url:'https://place.map.kakao.com/f1',category:'음식점',x:'128.6115',y:'35.8895',distance:260}],
  }
};

await page.route('**/functions/v1/university-data**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({})}));
await page.route('**/functions/v1/flow-quest-event**',route=>route.fulfill({status:204,body:''}));
await page.route('**/functions/v1/university-campus**',async route=>{
  const request=route.request(),url=new URL(request.url()),action=url.searchParams.get('action')||'campus';
  if(action==='campus')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(campusFixture)});
  if(action==='route')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({route:{status:'OK',distance:430,time:420,landingUrl:'https://map.kakao.com/test',points:[['128.6100','35.8886'],['128.6110','35.8892']]}})});
  if(action==='static-map')return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4z8AAAAASUVORK5CYII=','base64')});
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
});

await page.addInitScript(()=>{
  if(sessionStorage.getItem('flow-widget-home-fixture-ready'))return;
  sessionStorage.setItem('flow-widget-home-fixture-ready','1');
  const d=(new Date().getDay()+6)%7;
  const make=(name,start,end,place,credit=3)=>({name,professor:'테스트',credit,times:[{day:d,start,end,startMinutes:Number(start.slice(0,2))*60+Number(start.slice(3)),endMinutes:Number(end.slice(0,2))*60+Number(end.slice(3)),place}]});
  localStorage.setItem('flow-university-profile-v1',JSON.stringify({id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80',campus:'대구캠퍼스'}));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[make('자료구조','08:00','09:30','IT대학1호관'),make('운영체제','11:00','12:15','공대9호관'),make('네트워크','14:00','15:30','IT융합산업빌딩')]}));
  localStorage.removeItem('flow-university-dashboard-layout-v2');
  localStorage.removeItem('flow-university-dashboard-v1');
  localStorage.setItem('flow-university-theme-v1','light');
});

await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded',timeout:30000});
await page.locator('#widgetDashboard').waitFor({timeout:10000});
await page.locator('[data-widget-id="memo"]').waitFor({timeout:10000});
await page.waitForTimeout(250);

const initial=await page.evaluate(()=>{
  const card=document.querySelector('#widgetDashboard [data-widget-id="campus"]');
  return{
    editButtonDisplay:getComputedStyle(document.querySelector('#dashboardEditBtn')).display,
    touchAction:getComputedStyle(card).touchAction,
    width:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    scrollHeight:document.documentElement.scrollHeight,
  }
});
if(initial.editButtonDisplay==='none')throw new Error(`Edit fallback button unexpectedly disappeared: ${JSON.stringify(initial)}`);
if(initial.scrollWidth>initial.width+2)throw new Error(`Initial horizontal overflow: ${JSON.stringify(initial)}`);

const touch=async(type,selector,xRatio=.5,yRatio=.5,id=31)=>page.evaluate(({type,selector,xRatio,yRatio,id})=>{
  const el=document.querySelector(selector);if(!el)throw new Error(`Missing touch target ${selector}`);
  const r=el.getBoundingClientRect(),x=r.left+r.width*xRatio,y=r.top+r.height*yRatio;
  const t=new Touch({identifier:id,target:el,clientX:x,clientY:y,pageX:x+scrollX,pageY:y+scrollY,screenX:x,screenY:y,radiusX:8,radiusY:8,force:.6});
  const ev=new TouchEvent(type,{bubbles:true,cancelable:true,composed:true,touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t],changedTouches:[t]});
  el.dispatchEvent(ev);return{x,y};
},{type,selector,xRatio,yRatio,id});

await touch('touchstart','[data-widget-id="campus"]',.5,.45,41);
await page.evaluate(()=>{
  const el=document.querySelector('[data-widget-id="campus"]'),r=el.getBoundingClientRect(),x=r.left+r.width*.5,y=r.top+r.height*.45+36;
  const t=new Touch({identifier:41,target:el,clientX:x,clientY:y,pageX:x+scrollX,pageY:y+scrollY,screenX:x,screenY:y,radiusX:8,radiusY:8,force:.6});
  el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,composed:true,touches:[t],targetTouches:[t],changedTouches:[t]}));
});
await page.waitForTimeout(470);
const scrollIntent=await page.evaluate(()=>({floating:document.querySelectorAll('.widget-direct-floating').length,arming:document.querySelector('[data-widget-id="campus"]')?.classList.contains('widget-longpress-arming'),editing:document.querySelector('#todayView')?.classList.contains('dashboard-editing')}));
if(scrollIntent.floating||scrollIntent.arming||scrollIntent.editing)throw new Error(`Scroll intent was captured as a widget hold: ${JSON.stringify(scrollIntent)}`);
await touch('touchend','[data-widget-id="campus"]',.5,.45,41);

await touch('touchstart','[data-widget-id="campus"]',.5,.5,42);
await page.waitForTimeout(470);
let held=await page.evaluate(()=>({editing:document.querySelector('#todayView')?.classList.contains('dashboard-editing'),floating:document.querySelectorAll('.widget-direct-floating').length,placeholder:document.querySelectorAll('.widget-drag-placeholder').length,touchAction:getComputedStyle(document.querySelector('.widget-direct-floating')).touchAction}));
if(!held.editing||held.floating!==1||held.placeholder!==1)throw new Error(`Long touch did not lift widget: ${JSON.stringify(held)}`);
await touch('touchend','.widget-direct-floating',.5,.5,42);
await page.waitForTimeout(330);
const editTouchAction=await page.evaluate(()=>getComputedStyle(document.querySelector('#widgetDashboard [data-widget-id="campus"]')).touchAction);
if(!editTouchAction.includes('pan-y')||editTouchAction==='none')throw new Error(`Edit-mode touch scrolling is blocked: ${editTouchAction}`);

const source=page.locator('[data-widget-id="campus"]'),target=page.locator('[data-widget-id="next"]');
let sb=await source.boundingBox(),tb=await target.boundingBox();if(!sb||!tb)throw new Error('Widget geometry missing for dwell test.');
await page.mouse.move(sb.x+sb.width*.5,sb.y+sb.height*.5);await page.mouse.down();
await page.waitForTimeout(230);
await page.mouse.move(tb.x+tb.width*.2,tb.y+tb.height*.2,{steps:8});
const placementBefore=await page.evaluate(()=>[...document.querySelector('#widgetDashboard').children].indexOf(document.querySelector('.widget-drag-placeholder')));
await page.waitForTimeout(90);
const placementEarly=await page.evaluate(()=>[...document.querySelector('#widgetDashboard').children].indexOf(document.querySelector('.widget-drag-placeholder')));
if(placementEarly!==placementBefore)throw new Error(`Dwell placement moved too early: ${placementBefore} -> ${placementEarly}`);
await page.waitForTimeout(150);
const dwell=await page.evaluate(()=>({placeholderIndex:[...document.querySelector('#widgetDashboard').children].indexOf(document.querySelector('.widget-drag-placeholder')),animations:[...document.querySelectorAll('#widgetDashboard [data-widget-id]')].reduce((n,el)=>n+el.getAnimations().length,0),pending:document.querySelector('.widget-drag-placeholder')?.dataset.dropPending||''}));
if(dwell.placeholderIndex===placementBefore)throw new Error(`Dwell did not commit target placement: ${JSON.stringify({placementBefore,dwell})}`);
if(dwell.animations<1)throw new Error(`Dwell reflow did not animate siblings: ${JSON.stringify(dwell)}`);
await page.screenshot({path:`${out}/widget-dwell-reflow.png`,fullPage:false});

const beforeEdge=await page.evaluate(()=>scrollY);
await page.mouse.move(195,838,{steps:5});await page.waitForTimeout(260);
const edge=await page.evaluate(()=>({before:0,after:scrollY,direction:document.documentElement.dataset.widgetAutoScroll||''}));
if(edge.after<=beforeEdge+1||edge.direction!=='down')throw new Error(`Bottom edge auto-scroll failed: ${JSON.stringify({beforeEdge,edge})}`);
await page.mouse.up();await page.waitForTimeout(330);
const settled=await page.evaluate(()=>({floating:document.querySelectorAll('.widget-direct-floating').length,placeholder:document.querySelectorAll('.widget-drag-placeholder').length,stored:JSON.parse(localStorage.getItem('flow-university-dashboard-layout-v2')||'null')}));
if(settled.floating||settled.placeholder||!settled.stored?.widgets?.campus)throw new Error(`Drag did not settle/persist: ${JSON.stringify(settled)}`);

await page.locator('#widgetAddBtn').click();await page.locator('#widgetPicker').waitFor({state:'visible'});await page.locator('.widget-picker-live-preview').first().waitFor();
const gallery=await page.evaluate(()=>({title:document.querySelector('#widgetPicker h2')?.textContent?.trim(),previews:document.querySelectorAll('#widgetPicker .widget-picker-live-preview').length,items:document.querySelectorAll('#widgetPicker [data-picker-id]').length,search:Boolean(document.querySelector('#widgetPickerSearch')),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
if(gallery.title!=='위젯 갤러리'||gallery.previews<10||gallery.items<15||!gallery.search||gallery.overflow>2)throw new Error(`Widget gallery regression: ${JSON.stringify(gallery)}`);
await page.screenshot({path:`${out}/widget-gallery-mobile.png`,fullPage:false});
const clockButton=page.locator('#widgetPicker [data-picker-id="clock"]');await clockButton.scrollIntoViewIfNeeded();const gb=await clockButton.boundingBox();if(!gb)throw new Error('Clock gallery item missing.');
await page.mouse.move(gb.x+gb.width*.5,gb.y+Math.min(55,gb.height*.35));await page.mouse.down();await page.waitForTimeout(380);
const galleryLift=await page.evaluate(()=>{const el=document.querySelector('.widget-direct-floating');const r=el?.getBoundingClientRect();return{dialogOpen:document.querySelector('#widgetPicker')?.open,editing:document.querySelector('#todayView')?.classList.contains('dashboard-editing'),id:el?.dataset.widgetId||'',lifted:el?.dataset.pickerLifted||'',rect:r?{left:r.left,top:r.top,width:r.width,height:r.height}:null}});
if(galleryLift.dialogOpen||!galleryLift.editing||galleryLift.id!=='clock'||galleryLift.lifted!=='1'||!galleryLift.rect)throw new Error(`Gallery hold did not lift real widget: ${JSON.stringify(galleryLift)}`);
await page.screenshot({path:`${out}/widget-gallery-lift.png`,fullPage:false});
await page.mouse.move(190,Math.min(700,(page.viewportSize()?.height||844)-120),{steps:8});await page.mouse.up();await page.waitForTimeout(330);
if(await page.locator('[data-widget-id="clock"].widget-hidden').count())throw new Error('Gallery-held widget stayed hidden after placement.');

const orderBeforeReload=await page.evaluate(()=>[...document.querySelectorAll('#widgetDashboard [data-widget-id]')].map(x=>x.dataset.widgetId));
await page.reload({waitUntil:'domcontentloaded'});await page.locator('#widgetDashboard').waitFor();await page.locator('[data-widget-id="memo"]').waitFor({timeout:10000});await page.waitForTimeout(300);
const reload=await page.evaluate(()=>({order:[...document.querySelectorAll('#widgetDashboard [data-widget-id]')].map(x=>x.dataset.widgetId),clockVisible:!document.querySelector('[data-widget-id="clock"]')?.classList.contains('widget-hidden'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
if(orderBeforeReload.join('|')!==reload.order.join('|')||!reload.clockVisible||reload.overflow>2)throw new Error(`Widget placement was not persisted cleanly: ${JSON.stringify(reload)}`);

await page.setViewportSize({width:768,height:1024});
await page.locator('.bottom-nav [data-view="campus"]').click();await page.locator('#campusView:not(.hidden)').waitFor({timeout:10000});await page.locator('#campusHeaderTools').waitFor({timeout:10000});await page.waitForTimeout(250);
const campusTablet=await page.evaluate(()=>{
  const view=document.querySelector('#campusView'),header=view?.querySelector(':scope>.view-header'),title=header?.querySelector('h1'),tools=document.querySelector('#campusHeaderTools'),side=document.querySelector('.campus-side'),place=document.querySelector('.campus-side>.campus-section'),content=document.querySelector('#campusView>.content-grid');
  const vr=view?.getBoundingClientRect(),pr=place?.getBoundingClientRect(),tr=title?.getBoundingClientRect();
  return{headerDisplay:header?getComputedStyle(header).display:'',headerColumns:header?getComputedStyle(header).gridTemplateColumns:'',titleLines:tr?Math.round(tr.height/parseFloat(getComputedStyle(title).lineHeight||'1')):99,toolsWidth:tools?.getBoundingClientRect().width||0,sideColumns:side?getComputedStyle(side).gridTemplateColumns:'',placeRatio:vr&&pr?pr.width/vr.width:0,contentColumns:content?getComputedStyle(content).gridTemplateColumns:'',overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
});
if(campusTablet.headerDisplay!=='grid'||campusTablet.titleLines>2||campusTablet.placeRatio<.9||campusTablet.overflow>2)throw new Error(`Tablet Campus composition regression: ${JSON.stringify(campusTablet)}`);
await page.screenshot({path:`${out}/campus-tablet-polished.png`,fullPage:true});

await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);
const campusMobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,title:document.querySelector('#campusView h1')?.getBoundingClientRect().height||0,tools:document.querySelector('#campusHeaderTools')?.getBoundingClientRect().width||0}));
if(campusMobile.overflow>2||!campusMobile.title||!campusMobile.tools)throw new Error(`Mobile Campus composition regression: ${JSON.stringify(campusMobile)}`);
await page.screenshot({path:`${out}/campus-mobile-polished.png`,fullPage:true});

const report={initial,scrollIntent,held,editTouchAction,placementBefore,placementEarly,dwell,beforeEdge,edge,settled,gallery,galleryLift,reload,campusTablet,campusMobile,consoleErrors,pageErrors};
await writeFile(`${out}/widget-home-editing-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(consoleErrors.length||pageErrors.length)throw new Error(`Browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
await browser.close();