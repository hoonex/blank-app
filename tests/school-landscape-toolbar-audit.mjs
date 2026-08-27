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
  const header=document.querySelector('.mobile-topbar'),nav=document.querySelector('#bottomNav'),brand=header?.querySelector('.flow-logo'),school=document.querySelector('#mobileSchoolBtn'),content=document.querySelector(contentSelector);
  const items=nav?[...nav.children].filter(node=>node.matches('.mobile-tab,.flow-mobile-settings')&&visible(node)).map(node=>({text:node.textContent?.trim()||'',view:node.dataset.view||'',settings:node.classList.contains('flow-mobile-settings'),rect:r(node)})):[];
  return{header:r(header),nav:r(nav),brand:r(brand),school:r(school),content:r(content),items,weekInNav:!!nav?.querySelector(':scope>[data-view="week"]'),position:nav?getComputedStyle(nav).position:'',clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,glassMode:document.documentElement.dataset.flowGlassMode||'',refraction:document.documentElement.dataset.flowGlassRefraction||'',productPaddingBottom:parseFloat(getComputedStyle(document.querySelector('.product-shell')).paddingBottom)||0};
},{contentSelector})}
function validate(label,state){
  if(!state.header||!state.nav||!state.brand||!state.school||!state.content)throw new Error(`${label}: required landscape geometry missing ${JSON.stringify(state)}`);
  if(state.position!=='fixed')throw new Error(`${label}: nav is not fixed into the header ${JSON.stringify(state)}`);
  if(state.nav.top<state.header.top-1||state.nav.bottom>state.header.bottom+1)throw new Error(`${label}: nav is not contained by the mobile header ${JSON.stringify({header:state.header,nav:state.nav})}`);
  if(state.nav.left<state.brand.right+8)throw new Error(`${label}: nav overlaps Flow brand ${JSON.stringify({brand:state.brand,nav:state.nav})}`);
  if(state.nav.right>state.school.left-8)throw new Error(`${label}: nav overlaps School identity ${JSON.stringify({school:state.school,nav:state.nav})}`);
  if(state.nav.bottom>state.content.top-5)throw new Error(`${label}: nav still covers page content ${JSON.stringify({nav:state.nav,content:state.content})}`);
  if(state.weekInNav)throw new Error(`${label}: Week control unexpectedly remained in destination nav`);
  if(state.items.length!==4||state.items.filter(item=>item.settings).length!==1)throw new Error(`${label}: expected four School destinations ${JSON.stringify(state.items)}`);
  if(state.items.some(item=>item.rect.width<44||item.rect.height<30))throw new Error(`${label}: compact landscape target is clipped/undersized ${JSON.stringify(state.items)}`);
  if(state.scrollWidth>state.clientWidth+2)throw new Error(`${label}: horizontal overflow ${JSON.stringify({clientWidth:state.clientWidth,scrollWidth:state.scrollWidth})}`);
  if(state.productPaddingBottom>30)throw new Error(`${label}: obsolete bottom-nav reserve remains ${state.productPaddingBottom}px`);
}

for(const glassMode of ['standard','optical']){
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(10000);const consoleErrors=[],pageErrors=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});page.on('pageerror',error=>pageErrors.push(String(error)));
  try{
    await routes(page);
    await page.addInitScript(({school,glassMode})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2',glassMode)},{school:SCHOOL,glassMode});
    await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await page.locator('link[data-flow-school-landscape-toolbar]').waitFor({state:'attached'});await page.waitForFunction(()=>document.querySelector('#bottomNav')?.children.length>=4);
    await page.waitForTimeout(180);

    const today=await inspect(page,'#schoolHero');validate(`${glassMode}/today`,today);
    await page.screenshot({path:`${OUT}/${glassMode}-today.png`,fullPage:false});

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
