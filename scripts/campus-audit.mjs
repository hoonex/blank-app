import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
await mkdir('university-audit',{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},locale:'ko-KR',isMobile:true,hasTouch:true,colorScheme:'dark'});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[],failed=[];
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
page.on('pageerror',err=>pageErrors.push(String(err)));
page.on('requestfailed',req=>failed.push({url:req.url(),error:req.failure()?.errorText||''}));

await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded'});
await page.locator('#universitySearch').fill('경북대학교');
await page.locator('#searchBtn').click();
await page.locator('#searchResults .result-button').first().waitFor({timeout:15000});
await page.locator('#searchResults .result-button').first().click();
await page.locator('#importDialog').waitFor({state:'visible'});
await page.locator('#importDialog [data-close-dialog]').click();
await page.waitForTimeout(240);
if(await page.locator('#importDialog').evaluate(dialog=>dialog.open))await page.locator('#importDialog [data-close-dialog]').click();
await page.locator('#importDialog').waitFor({state:'hidden'});

await page.evaluate(()=>{
  const timetable={source:'campus-audit',year:2026,semester:'2학기',subjects:[
    {id:'a',name:'소프트웨어설계',professor:'테스트',credit:3,place:'IT대학 2호관',times:[{day:0,startMinutes:540,endMinutes:615,start:'09:00',end:'10:15',place:'IT대학 2호관'}]},
    {id:'b',name:'자료구조',professor:'테스트',credit:3,place:'공대9호관',times:[{day:0,startMinutes:630,endMinutes:705,start:'10:30',end:'11:45',place:'공대9호관'}]},
    {id:'c',name:'교양세미나',professor:'테스트',credit:2,place:'법과대학',times:[{day:0,startMinutes:780,endMinutes:855,start:'13:00',end:'14:15',place:'법과대학'}]}
  ]};
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify(timetable));
});
await page.locator('.bottom-nav [data-view="campus"]').click();
await page.locator('#campusView:not(.hidden)').waitFor({timeout:10000});
await page.locator('#campusMapWrap img').waitFor({timeout:25000});
await page.waitForFunction(()=>{const img=document.querySelector('#campusMapWrap img');return img&&img.complete&&img.naturalWidth>100},{timeout:15000});
await page.locator('#campusPlaceList .campus-place').first().waitFor({timeout:20000});
await page.locator('#campusRouteList .campus-route').first().waitFor({timeout:25000});

const result=await page.evaluate(()=>({
  path:location.pathname,
  theme:document.documentElement.dataset.theme,
  bodyBackground:getComputedStyle(document.body).backgroundColor,
  mapWidth:document.querySelector('#campusMapWrap img')?.naturalWidth||0,
  placeCount:document.querySelectorAll('#campusPlaceList .campus-place').length,
  resolvedPlaceLinks:[...document.querySelectorAll('#campusPlaceList a.campus-place')].map(a=>a.href),
  routeCount:document.querySelectorAll('#campusRouteList .campus-route').length,
  routeTexts:[...document.querySelectorAll('#campusRouteList .campus-route')].map(x=>x.textContent.replace(/\s+/g,' ').trim()),
  nextEta:document.querySelector('#campusNextEta')?.textContent?.trim()||'',
  nearbyActive:document.querySelectorAll('#campusFilter [data-nearby].active').length,
  nearbyCount:document.querySelectorAll('#campusNearbyList .campus-nearby').length,
  navCount:document.querySelectorAll('.bottom-nav [data-view]').length,
}));
if(result.path!=='/university/campus')throw new Error(`Campus route did not stay active: ${result.path}`);
if(result.mapWidth<100)throw new Error('Kakao static campus map did not render.');
if(result.placeCount<3)throw new Error(`Too few campus place rows: ${result.placeCount}`);
if(result.resolvedPlaceLinks.filter(x=>x.includes('place.map.kakao.com')).length<2)throw new Error(`Too few resolved Kakao places: ${JSON.stringify(result.resolvedPlaceLinks)}`);
if(result.routeCount<1)throw new Error('No walking route between class buildings was rendered.');
if(result.navCount!==4)throw new Error(`Mobile university navigation should have 4 items, got ${result.navCount}`);
if(result.nearbyActive!==0||result.nearbyCount!==0)throw new Error(`Nearby filter should start unselected: ${JSON.stringify({nearbyActive:result.nearbyActive,nearbyCount:result.nearbyCount})}`);

await page.locator('#campusFilter [data-nearby="stores"]').click();
await page.waitForTimeout(150);
const storeCount=await page.locator('#campusNearbyList .campus-nearby').count();
if(storeCount<1)throw new Error('No nearby convenience stores rendered.');
await page.screenshot({path:'university-audit/mobile-campus.png',fullPage:true});

await page.setViewportSize({width:1440,height:900});
await page.waitForTimeout(200);
await page.screenshot({path:'university-audit/desktop-campus.png',fullPage:true});
const desktopVisible=await page.locator('#campusView:not(.hidden)').count();
if(desktopVisible!==1)throw new Error('Campus view disappeared after desktop resize.');

const report={...result,storeCount,consoleErrors,pageErrors,failed:failed.filter(x=>!x.url.includes('dge.hs.kr'))};
await writeFile('university-audit/campus-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(consoleErrors.length||pageErrors.length)throw new Error(`Campus browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
await browser.close();
