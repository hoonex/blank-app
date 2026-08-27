import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173';
const OUT='campus-route-editor-audit';
await mkdir(OUT,{recursive:true});

const campusFixture={
  center:{x:'128.6105',y:'35.8890'},
  places:Array.from({length:8},(_,index)=>({
    raw:`건물${index+1}`,
    resolved:true,
    confidence:90-index,
    place:{id:`p${index+1}`,name:`건물${index+1}`,url:`https://place.map.kakao.com/p${index+1}`,x:(128.6100+index*.0003).toFixed(4),y:(35.8886+index*.00025).toFixed(4),roadAddress:'대구 북구 대학로 80'}
  })),
  nearby:{dining:[],stores:[],cafes:[],food:[]}
};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR',isMobile:true,hasTouch:true,colorScheme:'light'});
const page=await context.newPage();
page.setDefaultTimeout(10000);
const consoleErrors=[],pageErrors=[];
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
page.on('pageerror',error=>pageErrors.push(String(error)));

await page.route('**/functions/v1/university-campus**',async route=>{
  const request=route.request(),url=new URL(request.url()),action=url.searchParams.get('action')||'campus';
  if(action==='campus')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(campusFixture)});
  if(action==='route'){
    const payload=request.postDataJSON?.()||{},start=payload.start||{},end=payload.end||{};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({route:{status:'OK',distance:240,time:210,landingUrl:'https://map.kakao.com/test',points:[[String(start.x||'128.6100'),String(start.y||'35.8886')],[String(end.x||'128.6110'),String(end.y||'35.8892')]]}})});
  }
  if(action==='static-map')return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4z8AAAAASUVORK5CYII=','base64')});
  return route.fulfill({status:404,contentType:'application/json',body:'{}'});
});

await page.addInitScript(()=>{
  const profile={id:'fixture-long-route',name:'경북대학교',address:'대구광역시 북구 대학로 80',campus:'대구캠퍼스'};
  const subjects=Array.from({length:8},(_,index)=>{
    const start=540+index*80,end=start+60,hhmm=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
    return{id:`s${index+1}`,name:`과목${index+1}`,place:`건물${index+1}`,times:[{day:0,startMinutes:start,endMinutes:end,start:hhmm(start),end:hhmm(end),place:`건물${index+1}`}]};
  });
  localStorage.setItem('flow-university-profile-v1',JSON.stringify(profile));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify({source:'long-route-audit',year:2026,semester:'2학기',subjects}));
  localStorage.setItem('flow-university-theme-v1','light');

  class LatLng{constructor(lat,lng){this.lat=Number(lat);this.lng=Number(lng)}getLat(){return this.lat}getLng(){return this.lng}}
  class LatLngBounds{constructor(){this.points=[]}extend(point){if(point)this.points.push(point)}}
  class Map{constructor(container){this.container=container}setZoomable(){}setDraggable(){}setBounds(){}relayout(){}}
  class CustomOverlay{constructor({map,content}){this.content=content;this.setMap(map)}setMap(next){if(this.content?.isConnected)this.content.remove();if(next?.container&&this.content instanceof Element)next.container.append(this.content)}}
  class Polyline{constructor({map}){this.map=map}setMap(next){this.map=next}}
  const event={addListener(target,name,fn){if(name==='tilesloaded')setTimeout(fn,0)}};
  class Places{keywordSearch(query,callback){setTimeout(()=>callback([],'ZERO_RESULT'),0)}}
  window.kakao={maps:{Map,LatLng,LatLngBounds,CustomOverlay,Polyline,event,load:fn=>fn(),services:{Places,Status:{OK:'OK'},SortBy:{DISTANCE:'DISTANCE'}}}};
});

await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded',timeout:30000});
await page.locator('#appView:not(.hidden)').waitFor();
await page.locator('.bottom-nav [data-view="campus"]').click();
await page.locator('#campusView:not(.hidden)').waitFor();
await page.waitForFunction(()=>document.querySelectorAll('#campusRouteEditorList .campus-route-stop').length===8);
await page.locator('#campusRouteEditor').evaluate(element=>{element.open=true;element.scrollIntoView({block:'start'})});
await page.waitForTimeout(80);

const firstRow=page.locator('#campusRouteEditorList [data-route-index="0"]'),grip=firstRow.locator('[data-route-grip]');
const rowBox=await firstRow.boundingBox(),gripBox=await grip.boundingBox(),navBox=await page.locator('.bottom-nav').boundingBox();
if(!rowBox||!gripBox||!navBox)throw new Error('Long-route autoscroll geometry missing');
const start={x:gripBox.x+gripBox.width/2,y:gripBox.y+gripBox.height/2},activate={x:start.x,y:start.y+30},edge={x:start.x,y:navBox.y-10};
const before=await page.evaluate(()=>({scrollY,order:[...document.querySelectorAll('#campusRouteEditorList .campus-route-stop strong')].map(node=>node.textContent.trim())}));
if(before.order.length!==8||before.order[0]!=='과목1')throw new Error(`Long-route fixture mismatch: ${JSON.stringify(before)}`);

await grip.dispatchEvent('pointerdown',{pointerId:81,pointerType:'touch',isPrimary:true,clientX:start.x,clientY:start.y,button:0,buttons:1,bubbles:true,cancelable:true});
await page.evaluate(({x,y})=>document.dispatchEvent(new PointerEvent('pointermove',{pointerId:81,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons:1,bubbles:true,cancelable:true})),activate);
await page.waitForTimeout(20);
await page.evaluate(({x,y})=>document.dispatchEvent(new PointerEvent('pointermove',{pointerId:81,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons:1,bubbles:true,cancelable:true})),edge);
await page.waitForTimeout(460);

const during=await page.evaluate(()=>{
  const floating=document.querySelector('.campus-route-touch-floating'),placeholder=document.querySelector('.campus-route-touch-placeholder'),list=document.querySelector('#campusRouteEditorList'),nav=document.querySelector('.bottom-nav'),r=floating?.getBoundingClientRect(),nr=nav?.getBoundingClientRect(),children=list?[...list.children]:[],pi=children.indexOf(placeholder),slot=pi<0?-1:children.slice(0,pi).filter(node=>node.classList.contains('campus-route-stop')).length;
  return{scrollY,auto:document.documentElement.dataset.campusRouteAutoScroll||'',slot,floating:document.querySelectorAll('.campus-route-touch-floating').length,placeholder:document.querySelectorAll('.campus-route-touch-placeholder').length,rect:r&&{top:r.top,bottom:r.bottom,left:r.left,right:r.right},navTop:nr?.top??null,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
});
if(during.scrollY-before.scrollY<80)throw new Error(`Long route did not auto-scroll enough: ${JSON.stringify({before,during})}`);
if(during.slot<4)throw new Error(`Placeholder did not advance with auto-scroll: ${JSON.stringify(during)}`);
if(during.floating!==1||during.placeholder!==1)throw new Error(`Auto-scroll lost direct manipulation state: ${JSON.stringify(during)}`);
if(!Number.isFinite(during.rect?.bottom)||!Number.isFinite(during.navTop)||during.rect.bottom>during.navTop+9)throw new Error(`Floating route escaped beneath mobile nav during auto-scroll: ${JSON.stringify(during)}`);
if(during.overflow>1)throw new Error(`Auto-scroll caused horizontal overflow: ${during.overflow}`);
await page.screenshot({path:`${OUT}/mobile-campus-route-autoscroll.png`,fullPage:false});

await page.evaluate(({x,y})=>document.dispatchEvent(new PointerEvent('pointerup',{pointerId:81,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons:0,bubbles:true,cancelable:true})),edge);
await page.waitForTimeout(40);
const released=await page.evaluate(()=>({scrollY,auto:document.documentElement.dataset.campusRouteAutoScroll||'',order:[...document.querySelectorAll('#campusRouteEditorList .campus-route-stop strong')].map(node=>node.textContent.trim()),floating:document.querySelectorAll('.campus-route-touch-floating').length,placeholder:document.querySelectorAll('.campus-route-touch-placeholder').length,status:document.querySelector('#campusRouteEditorStatus')?.dataset.state||''}));
const movedIndex=released.order.indexOf('과목1');
if(movedIndex<4||released.floating||released.placeholder||released.auto||released.status!=='dirty')throw new Error(`Auto-scrolled reorder did not commit/clean up: ${JSON.stringify({movedIndex,released})}`);
await page.waitForTimeout(160);
const stopped=await page.evaluate(()=>({scrollY,auto:document.documentElement.dataset.campusRouteAutoScroll||''}));
if(Math.abs(stopped.scrollY-released.scrollY)>1||stopped.auto)throw new Error(`Route auto-scroll continued after release: ${JSON.stringify({released,stopped})}`);
if(consoleErrors.length||pageErrors.length)throw new Error(`Long-route browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);

const report={before,during,released,movedIndex,stopped,consoleErrors,pageErrors};
await writeFile(`${OUT}/autoscroll-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await context.close();await browser.close();
