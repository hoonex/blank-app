import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_SCHOOL_LANDSCAPE_OUT||'school-landscape-toolbar-audit';
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',location:'대구광역시',type:'사립',address:'대구광역시 동구 반야월북로 199',phone:'053-000-0000',homepage:'https://jungdong.dge.hs.kr',highSchoolType:'일반고',highSchoolTrack:'일반계',coed:'남녀공학',dayNight:'주간'};

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};
const ymd=(date=new Date())=>`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)});
function dashboard(){const selected=ymd();return{school:SCHOOL,selected,from:selected,to:selected,timetable:[{date:selected,period:1,subject:'문학',grade:'2',className:'6'},{date:selected,period:2,subject:'미적분',grade:'2',className:'6'},{date:selected,period:3,subject:'영어Ⅱ',grade:'2',className:'6'},{date:selected,period:4,subject:'정보',grade:'2',className:'6'}],meals:[{date:selected,type:'중식',dishes:['현미밥','닭갈비'],calories:'742 Kcal',nutrition:'',origin:''}],events:[{date:selected,name:'2학기 학급 행사',content:'fixture',grade1:'N',grade2:'Y',grade3:'N',holidayType:''}],scheduleMeta:{mode:'fixture',count:1}}}
async function routes(page){
  await page.route('**/functions/v1/school-data**',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard());if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});if(action==='place')return json(route,{provider:'kakao',place:{id:'fixture',name:SCHOOL.name,url:'https://place.map.kakao.com/fixture',address:SCHOOL.address,roadAddress:SCHOOL.address,x:'128.687',y:'35.875'}});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
}
async function inspect(page,contentSelector){return page.evaluate(({contentSelector})=>{
  const r=node=>{if(!node)return null;const x=node.getBoundingClientRect();return{left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height}};
  const visible=node=>{if(!node)return false;const s=getComputedStyle(node),x=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&x.width>0&&x.height>0};
  const header=document.querySelector('.mobile-topbar'),nav=document.querySelector('#bottomNav'),brand=header?.querySelector('.flow-logo'),school=document.querySelector('#mobileSchoolBtn'),content=document.querySelector(contentSelector),hero=document.querySelector('#schoolHero'),sidebar=document.querySelector('#desktopSidebar');
  const items=nav?[...nav.children].filter(node=>node.matches('.mobile-tab,.flow-mobile-settings')&&visible(node)).map(node=>({text:node.textContent?.trim()||'',view:node.dataset.view||'',settings:node.id==='mobileSettingsBtn'||node.classList.contains('flow-mobile-settings'),rect:r(node)})):[];
  const navStyle=nav?getComputedStyle(nav):null,before=nav?getComputedStyle(nav,'::before'):null;
  return{header:r(header),nav:r(nav),brand:r(brand),school:r(school),content:r(content),items,weekInNav:!!nav?.querySelector(':scope>[data-view="week"]'),position:navStyle?.position||'',navRadius:parseFloat(navStyle?.borderRadius)||0,navCorner:navStyle?.getPropertyValue('corner-shape')||'',lensRadius:parseFloat(before?.borderRadius)||0,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,viewportHeight:innerHeight,bodyPaddingBottom:parseFloat(getComputedStyle(document.body).paddingBottom)||0,heroVisible:visible(hero),sidebarVisible:visible(sidebar),glassMode:document.documentElement.dataset.flowGlassMode||'',refraction:document.documentElement.dataset.flowGlassRefraction||''};
},{contentSelector})}
function validate(label,state){
  if(!state.header||!state.nav||!state.brand||!state.school||!state.content||state.content.width<=0||state.content.height<=0)throw new Error(`${label}: required landscape geometry missing ${JSON.stringify(state)}`);
  if(state.position!=='fixed')throw new Error(`${label}: bottom nav is not fixed ${JSON.stringify(state)}`);
  if(state.nav.bottom>state.viewportHeight+1||state.nav.bottom<state.viewportHeight-24)throw new Error(`${label}: bottom nav is not anchored to viewport bottom ${JSON.stringify({nav:state.nav,viewportHeight:state.viewportHeight})}`);
  if(state.nav.top<=state.header.bottom+8)throw new Error(`${label}: bottom nav unexpectedly occupies the top header ${JSON.stringify({header:state.header,nav:state.nav})}`);
  if(state.content.top<state.header.bottom-3)throw new Error(`${label}: content slides under compact mobile header ${JSON.stringify({header:state.header,content:state.content})}`);
  if(state.weekInNav)throw new Error(`${label}: Week control unexpectedly remained in destination nav`);
  if(state.items.length!==5||state.items.filter(item=>item.settings).length!==1||!state.items.some(item=>item.view==='transit'))throw new Error(`${label}: expected five localhost destinations including Transit ${JSON.stringify(state.items)}`);
  if(state.items.some(item=>item.rect.width<44||item.rect.height<44))throw new Error(`${label}: landscape bottom target is clipped/undersized ${JSON.stringify(state.items)}`);
  if(state.navRadius<state.nav.height/2||state.lensRadius<Math.min(20,state.nav.height/2-5)||/squircle|superellipse/i.test(state.navCorner))throw new Error(`${label}: bottom nav/follower lost maximum circular pill geometry ${JSON.stringify({navRadius:state.navRadius,lensRadius:state.lensRadius,navHeight:state.nav.height,corner:state.navCorner})}`);
  if(state.scrollWidth>state.clientWidth+2)throw new Error(`${label}: horizontal overflow ${JSON.stringify({clientWidth:state.clientWidth,scrollWidth:state.scrollWidth})}`);
  if(state.bodyPaddingBottom<58)throw new Error(`${label}: fixed bottom nav has no content reserve ${state.bodyPaddingBottom}px`);
  if(state.sidebarVisible)throw new Error(`${label}: desktop sidebar survived on touch landscape`);
  if(state.heroVisible)throw new Error(`${label}: large School hero survived on touch landscape`);
  if(state.header.height>72)throw new Error(`${label}: landscape header is no longer compact ${JSON.stringify(state.header)}`);
}

for(const glassMode of ['standard','optical']){
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(10000);const consoleErrors=[],pageErrors=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});page.on('pageerror',error=>pageErrors.push(String(error)));
  try{
    await routes(page);
    await page.addInitScript(({school,glassMode})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2',glassMode)},{school:SCHOOL,glassMode});
    await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready'&&document.documentElement.dataset.flowSchoolRuntimeV6==='ready');await page.waitForFunction(()=>document.querySelector('#bottomNav')?.children.length>=5&&document.querySelector('#bottomNav>[data-view="transit"]'));await page.waitForTimeout(120);

    const today=await inspect(page,'#todayView .status-grid');validate(`${glassMode}/today`,today);await page.screenshot({path:`${OUT}/${glassMode}-today.png`,fullPage:false});
    await page.locator('#bottomNav>[data-view="schedule"]').click();await page.locator('#scheduleView:not(.hidden)').waitFor();const schedule=await inspect(page,'#scheduleView>.view-header');validate(`${glassMode}/schedule`,schedule);
    await page.locator('#bottomNav>[data-view="school"]').click();await page.locator('#schoolView:not(.hidden)').waitFor();const school=await inspect(page,'#schoolView>.view-header');validate(`${glassMode}/school`,school);
    await page.locator('#mobileSettingsBtn').click();await page.locator('#flowSchoolSettingsView:not(.hidden)').waitFor();const settings=await inspect(page,'#flowSchoolSettingsView .flow-settings-header');validate(`${glassMode}/settings`,settings);await page.screenshot({path:`${OUT}/${glassMode}-settings.png`,fullPage:false});

    if(glassMode==='optical'&&settings.glassMode!=='optical')throw new Error(`optical mode did not stay active: ${JSON.stringify(settings)}`);
    if(consoleErrors.length||pageErrors.length)throw new Error(`${glassMode}: browser errors ${JSON.stringify({consoleErrors,pageErrors})}`);
    report.cases.push({glassMode,today,schedule,school,settings,consoleErrors,pageErrors});
  }catch(error){report.failures.push(String(error?.stack||error));await context.close();break}
  await context.close();
}

await browser.close();await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
if(report.failures.length){console.error(report.failures.join('\n'));process.exit(1)}
console.log(JSON.stringify(report,null,2));
