import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const out='university-audit';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR',timezoneId:'Asia/Seoul',isMobile:true,hasTouch:true,colorScheme:'light'});
const page=await context.newPage();
const cdp=await context.newCDPSession(page);
const consoleErrors=[],pageErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>pageErrors.push(String(e)));

await page.addInitScript(()=>{
  const audit=window.__flowMapAudit={relayouts:0,setCenters:0,setLevels:0,setBounds:0,zoomable:null,draggable:null,touchStarts:0,touchMoves:0,maxTouches:0};
  class LatLng{
    constructor(lat,lng){this.lat=Number(lat);this.lng=Number(lng)}
    getLat(){return this.lat}
    getLng(){return this.lng}
  }
  class LatLngBounds{
    constructor(){this.points=[]}
    extend(p){if(p)this.points.push(p);return this}
  }
  class Map{
    constructor(container,{center,level}){
      this.container=container;this.center=center;this.level=Number(level)||3;this.bounds=new LatLngBounds();
      container.dataset.stubMap='1';
      container.addEventListener('touchstart',e=>{audit.touchStarts++;audit.maxTouches=Math.max(audit.maxTouches,e.touches.length)},{passive:true});
      container.addEventListener('touchmove',e=>{audit.touchMoves++;audit.maxTouches=Math.max(audit.maxTouches,e.touches.length)},{passive:true});
      window.__flowMapInstance=this;
    }
    setZoomable(v){audit.zoomable=Boolean(v)}
    setDraggable(v){audit.draggable=Boolean(v)}
    relayout(){audit.relayouts++}
    getCenter(){return this.center}
    setCenter(v){this.center=v;audit.setCenters++}
    getLevel(){return this.level}
    setLevel(v){this.level=Number(v);audit.setLevels++}
    setBounds(v){this.bounds=v;audit.setBounds++;if(v?.points?.length){const p=v.points[0];this.center=new LatLng(p.getLat(),p.getLng())}}
  }
  class CustomOverlay{constructor(opts={}){this.map=opts.map||null}setMap(v){this.map=v}}
  class Polyline{constructor(opts={}){this.map=opts.map||null}setMap(v){this.map=v}}
  const event={addListener(target,name,fn){if(name==='tilesloaded')setTimeout(fn,0)}};
  const services={Places:class{},Status:{OK:'OK'},SortBy:{DISTANCE:'DISTANCE'}};
  window.kakao={maps:{Map,LatLng,LatLngBounds,CustomOverlay,Polyline,event,services}};

  const d=(new Date().getDay()+6)%7;
  const make=(name,start,end,place)=>({name,professor:'테스트',credit:3,times:[{day:d,start,end,startMinutes:Number(start.slice(0,2))*60+Number(start.slice(3)),endMinutes:Number(end.slice(0,2))*60+Number(end.slice(3)),place}]});
  localStorage.setItem('flow-university-profile-v1',JSON.stringify({id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80',campus:'대구캠퍼스'}));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[make('한국사','09:00','10:15','제1과학관'),make('자료구조','10:30','11:45','IT대학5호관')]}));
  localStorage.setItem('flow-university-theme-v1','light');
});

const fixture={
  center:{x:'128.6105',y:'35.8890'},
  places:[
    {raw:'제1과학관',resolved:true,confidence:90,place:{id:'1',name:'제1과학관',url:'https://place.map.kakao.com/1',x:'128.6100',y:'35.8886',distance:400}},
    {raw:'IT대학5호관',resolved:true,confidence:90,place:{id:'2',name:'IT대학5호관',url:'https://place.map.kakao.com/2',x:'128.6110',y:'35.8892',distance:290}},
  ],
  nearby:{dining:[],stores:[{id:'s1',name:'GS25',url:'https://place.map.kakao.com/s1',x:'128.6107',y:'35.8891',distance:120}],cafes:[],food:[]}
};
await page.route('**/functions/v1/university-data**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
await page.route('**/functions/v1/flow-quest-event**',r=>r.fulfill({status:204,body:''}));
await page.route('**/functions/v1/university-campus**',async route=>{
  const url=new URL(route.request().url()),action=url.searchParams.get('action')||'campus';
  if(action==='static-map')return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4z8AAAAASUVORK5CYII=','base64')});
  if(action==='route')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({route:{status:'OK',distance:570,time:600,points:[['128.6100','35.8886'],['128.6110','35.8892']]}})});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)});
});

await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded',timeout:30000});
await page.locator('.bottom-nav [data-view="campus"]').waitFor({timeout:10000});
await page.locator('.bottom-nav [data-view="campus"]').click();
await page.locator('#campusView:not(.hidden)').waitFor({timeout:10000});
await page.locator('.campus-interactive-map').waitFor({timeout:10000});
await page.waitForFunction(()=>document.querySelector('#campusMapWrap')?.dataset.interactiveMap==='ready',{timeout:10000});
await page.waitForTimeout(180);

const initial=await page.evaluate(()=>({
  audit:{...window.__flowMapAudit},
  mapTouch:getComputedStyle(document.querySelector('.campus-interactive-map')).touchAction,
  wrapTouch:getComputedStyle(document.querySelector('#campusMapWrap')).touchAction,
  width:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth,
  mapRect:(()=>{const r=document.querySelector('.campus-interactive-map').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})(),
}));
if(initial.audit.zoomable!==true||initial.audit.draggable!==true)throw new Error(`Kakao map interaction flags missing: ${JSON.stringify(initial)}`);
if(initial.mapTouch!=='none'||initial.wrapTouch!=='none')throw new Error(`Browser still owns campus map gestures: ${JSON.stringify(initial)}`);
if(initial.scrollWidth>initial.width+2)throw new Error(`Portrait campus overflow: ${JSON.stringify(initial)}`);

const r=initial.mapRect,cx=Math.round(r.x+r.width*.5),cy=Math.round(r.y+r.height*.5);
const touch=(x,y,id)=>({x:Math.round(x),y:Math.round(y),id,radiusX:8,radiusY:8,force:.6});
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(cx-28,cy,1),touch(cx+28,cy,2)]});
await page.waitForTimeout(40);
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(cx-52,cy,1),touch(cx+52,cy,2)]});
await page.waitForTimeout(50);
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
const pinch=await page.evaluate(()=>({audit:{...window.__flowMapAudit},scale:visualViewport?.scale||1}));
if(pinch.audit.touchStarts<1||pinch.audit.touchMoves<1||pinch.audit.maxTouches<2)throw new Error(`Two-finger gesture did not stay on map: ${JSON.stringify(pinch)}`);
if(Math.abs(pinch.scale-1)>.01)throw new Error(`Page zoom stole map pinch: ${JSON.stringify(pinch)}`);

await page.screenshot({path:`${out}/campus-interactive-portrait.png`,fullPage:false});
const beforeLandscape=await page.evaluate(()=>({...window.__flowMapAudit}));
await page.setViewportSize({width:844,height:390});
await page.waitForTimeout(360);
const landscape=await page.evaluate(()=>({
  audit:{...window.__flowMapAudit},
  width:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth,
  visible:!document.querySelector('#campusView')?.classList.contains('hidden'),
  mapWidth:document.querySelector('.campus-interactive-map')?.getBoundingClientRect().width||0,
}));
if(landscape.audit.relayouts<=beforeLandscape.relayouts||landscape.audit.setCenters<=beforeLandscape.setCenters||landscape.audit.setLevels<=beforeLandscape.setLevels)throw new Error(`Landscape resize did not relayout and restore viewport: ${JSON.stringify({beforeLandscape,landscape})}`);
if(!landscape.visible||landscape.mapWidth<200||landscape.scrollWidth>landscape.width+2)throw new Error(`Landscape campus geometry broke: ${JSON.stringify(landscape)}`);
await page.screenshot({path:`${out}/campus-interactive-landscape.png`,fullPage:false});

const beforePortrait=landscape.audit;
await page.setViewportSize({width:390,height:844});
await page.waitForTimeout(360);
const portraitAgain=await page.evaluate(()=>({audit:{...window.__flowMapAudit},width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,mapWidth:document.querySelector('.campus-interactive-map')?.getBoundingClientRect().width||0}));
if(portraitAgain.audit.relayouts<=beforePortrait.relayouts||portraitAgain.audit.setCenters<=beforePortrait.setCenters||portraitAgain.audit.setLevels<=beforePortrait.setLevels)throw new Error(`Portrait restore did not relayout map: ${JSON.stringify({beforePortrait,portraitAgain})}`);
if(portraitAgain.mapWidth<200||portraitAgain.scrollWidth>portraitAgain.width+2)throw new Error(`Portrait campus geometry broke after rotation: ${JSON.stringify(portraitAgain)}`);
if(consoleErrors.length||pageErrors.length)throw new Error(`Campus interaction browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);

const report={initial,pinch,landscape,portraitAgain,consoleErrors,pageErrors};
await writeFile(`${out}/campus-interaction-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
