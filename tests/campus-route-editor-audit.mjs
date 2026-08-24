import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173';
const out='campus-route-editor-audit';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR',isMobile:true,hasTouch:true,colorScheme:'light'});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[];
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
page.on('pageerror',error=>pageErrors.push(String(error)));

const campusFixture={
  center:{x:'128.6105',y:'35.8890'},
  places:[
    {raw:'IT대학 2호관',resolved:true,confidence:92,place:{id:'1',name:'IT대학 2호관',url:'https://place.map.kakao.com/1',x:'128.6100',y:'35.8886',roadAddress:'대구 북구 대학로 80'}},
    {raw:'공대9호관',resolved:true,confidence:90,place:{id:'2',name:'공대9호관',url:'https://place.map.kakao.com/2',x:'128.6110',y:'35.8892',roadAddress:'대구 북구 대학로 80'}},
    {raw:'법과대학',resolved:true,confidence:88,place:{id:'3',name:'법과대학',url:'https://place.map.kakao.com/3',x:'128.6120',y:'35.8898',roadAddress:'대구 북구 대학로 80'}},
  ],
  nearby:{
    dining:[{id:'d1',name:'학생식당',url:'https://place.map.kakao.com/d1',category:'음식점 > 구내식당',x:'128.6107',y:'35.8891',distance:120}],
    stores:[{id:'s1',name:'CU 경북대점',url:'https://place.map.kakao.com/s1',category:'편의점',x:'128.6108',y:'35.8893',distance:180}],
    cafes:[{id:'c1',name:'카페 캠퍼스',url:'https://place.map.kakao.com/c1',category:'카페',x:'128.6112',y:'35.8894',distance:220}],
    food:[{id:'f1',name:'캠퍼스 식당',url:'https://place.map.kakao.com/f1',category:'음식점',x:'128.6115',y:'35.8895',distance:260}],
  }
};

await page.route('**/functions/v1/university-campus**',async route=>{
  const request=route.request(),url=new URL(request.url()),action=url.searchParams.get('action')||'campus';
  if(action==='campus')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(campusFixture)});
  if(action==='route'){
    const payload=request.postDataJSON?.()||{},start=payload.start||{},end=payload.end||{};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({route:{status:'OK',distance:430,time:420,landingUrl:'https://map.kakao.com/test',points:[[String(start.x||'128.6100'),String(start.y||'35.8886')],[String(end.x||'128.6110'),String(end.y||'35.8892')]]}})});
  }
  if(action==='static-map')return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4z8AAAAASUVORK5CYII=','base64')});
  return route.fulfill({status:404,contentType:'application/json',body:'{}'});
});

await page.addInitScript(()=>{
  const profile={id:'fixture-knu',name:'경북대학교',address:'대구광역시 북구 대학로 80',campus:'대구캠퍼스'};
  const timetable={source:'route-editor-audit',year:2026,semester:'2학기',subjects:[
    {id:'a',name:'소프트웨어설계',place:'IT대학 2호관',times:[{day:0,startMinutes:540,endMinutes:615,start:'09:00',end:'10:15',place:'IT대학 2호관'}]},
    {id:'b',name:'자료구조',place:'공대9호관',times:[{day:0,startMinutes:630,endMinutes:705,start:'10:30',end:'11:45',place:'공대9호관'}]},
    {id:'c',name:'교양세미나',place:'법과대학',times:[{day:0,startMinutes:780,endMinutes:855,start:'13:00',end:'14:15',place:'법과대학'}]},
  ]};
  localStorage.setItem('flow-university-profile-v1',JSON.stringify(profile));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify(timetable));
  localStorage.setItem('flow-university-theme-v1','light');

  class LatLng{constructor(lat,lng){this.lat=Number(lat);this.lng=Number(lng)}getLat(){return this.lat}getLng(){return this.lng}}
  class LatLngBounds{constructor(){this.points=[]}extend(p){if(p)this.points.push(p)}}
  class Map{constructor(container){this.container=container}setZoomable(){}setDraggable(){}setBounds(){}relayout(){}}
  class CustomOverlay{constructor({map,content}){this.content=content;this.setMap(map)}setMap(next){if(this.content?.isConnected)this.content.remove();if(next?.container&&this.content instanceof Element)next.container.append(this.content)}}
  class Polyline{constructor({map}){this.map=map}setMap(next){this.map=next}}
  const event={addListener(target,name,fn){if(name==='tilesloaded')setTimeout(fn,0)}};
  class Places{keywordSearch(query,callback){const fixture=query.includes('학생회관')?{id:'x2',place_name:'학생회관',place_url:'https://place.map.kakao.com/x2',category_name:'학교 > 학생회관',address_name:'대구 북구',road_address_name:'대구 북구 대학로',x:'128.6130',y:'35.8901'}:{id:'x1',place_name:'중앙도서관',place_url:'https://place.map.kakao.com/x1',category_name:'학교 > 도서관',address_name:'대구 북구',road_address_name:'대구 북구 대학로',x:'128.6125',y:'35.8900'};setTimeout(()=>callback([fixture],'OK'),0)}}
  window.kakao={maps:{Map,LatLng,LatLngBounds,CustomOverlay,Polyline,event,load:fn=>fn(),services:{Places,Status:{OK:'OK'},SortBy:{DISTANCE:'DISTANCE'}}}};
});

await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded',timeout:30000});
await page.locator('#appView:not(.hidden)').waitFor({timeout:10000});
await page.locator('.bottom-nav [data-view="campus"]').click();
await page.locator('#campusView:not(.hidden)').waitFor({timeout:10000});
await page.locator('#campusHeaderTools').waitFor({timeout:10000});
await page.waitForFunction(()=>document.querySelectorAll('#campusRouteEditorList .campus-route-stop').length===3,{timeout:10000});
await page.locator('#campusFilter [data-nearby="stores"]').click();
await page.waitForFunction(()=>document.querySelectorAll('#campusNearbyList .campus-nearby').length>=1,{timeout:5000});

const initial=await page.evaluate(()=>({
  nearbyInHeader:Boolean(document.querySelector('#campusHeaderTools #campusFilter')),
  nearbyButtons:document.querySelectorAll('#campusHeaderTools #campusFilter [data-nearby]').length,
  lowerDistanceDisplay:getComputedStyle(document.querySelector('#campusNearbyList .campus-distance')).display,
  routeStops:[...document.querySelectorAll('#campusRouteEditorList .campus-route-stop strong')].map(x=>x.textContent.trim()),
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
}));
if(!initial.nearbyInHeader||initial.nearbyButtons!==4)throw new Error(`Nearby quick access missing: ${JSON.stringify(initial)}`);
if(initial.lowerDistanceDisplay!=='none')throw new Error(`Nearby distance is still visible: ${initial.lowerDistanceDisplay}`);
if(initial.routeStops.length!==3)throw new Error(`Default route editor stops mismatch: ${JSON.stringify(initial.routeStops)}`);
if(initial.overflow>1)throw new Error(`Mobile horizontal overflow: ${initial.overflow}`);

await page.locator('#campusRouteEditor').evaluate(el=>el.open=true);
await page.locator('#campusRouteEditorList [data-route-index="0"] [data-route-down]').click();
await page.locator('#campusRouteApplyBtn').click();
await page.waitForTimeout(80);
let saved=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('flow-university-campus-route-v1:'));return{key,value:key?JSON.parse(localStorage.getItem(key)):null,labels:[...document.querySelectorAll('.flow-campus-course-label')].map(x=>x.textContent.trim())}});
if(!saved.key||saved.value?.stops?.[0]?.label!=='자료구조')throw new Error(`Route reorder was not persisted: ${JSON.stringify(saved)}`);
if(!saved.labels.includes('자료구조'))throw new Error(`Custom route was not reflected on map markers: ${JSON.stringify(saved.labels)}`);

await page.locator('#campusRouteAddBtn').click();
await page.locator('#campusRouteSearchInput').fill('중앙도서관');
await page.locator('#campusRouteSearchBtn').click();
await page.locator('#campusRouteSearchResults [data-place-index="0"]').click();
await page.locator('#campusRouteApplyBtn').click();
await page.waitForTimeout(80);
saved=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('flow-university-campus-route-v1:'));return JSON.parse(localStorage.getItem(key))});
if(saved?.stops?.length!==4||saved.stops.at(-1)?.name!=='중앙도서관')throw new Error(`Custom place add failed: ${JSON.stringify(saved)}`);

await page.locator('#campusRouteEditorList [data-route-index="3"] [data-route-edit]').click();
await page.locator('#campusRouteSearchInput').fill('학생회관');
await page.locator('#campusRouteSearchBtn').click();
await page.locator('#campusRouteSearchResults [data-place-index="0"]').click();
await page.locator('#campusRouteApplyBtn').click();
await page.waitForTimeout(80);
saved=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('flow-university-campus-route-v1:'));return JSON.parse(localStorage.getItem(key))});
if(saved?.stops?.at(-1)?.name!=='학생회관')throw new Error(`Custom place edit failed: ${JSON.stringify(saved)}`);

await page.locator('#campusRouteEditorList [data-route-index="3"] [data-route-delete]').click();
await page.locator('#campusRouteApplyBtn').click();
await page.waitForTimeout(80);
saved=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('flow-university-campus-route-v1:'));return JSON.parse(localStorage.getItem(key))});
if(saved?.stops?.length!==3)throw new Error(`Custom place delete failed: ${JSON.stringify(saved)}`);

await page.screenshot({path:`${out}/mobile-campus-route-editor.png`,fullPage:true});
await page.setViewportSize({width:1366,height:768});
await page.waitForTimeout(100);
const desktopOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
if(desktopOverflow>1)throw new Error(`Desktop horizontal overflow: ${desktopOverflow}`);
await page.screenshot({path:`${out}/desktop-campus-route-editor.png`,fullPage:true});

const report={initial,reordered:saved?.stops?.map(x=>x.name)||[],consoleErrors,pageErrors};
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(consoleErrors.length||pageErrors.length)throw new Error(`Browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
await browser.close();
