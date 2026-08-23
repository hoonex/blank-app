import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='native-feel-audit';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function xOf(transform='none'){
  if(transform==='none')return 0;
  const m=transform.match(/matrix(?:3d)?\(([^)]+)\)/);if(!m)return NaN;
  const values=m[1].split(',').map(Number);return values.length===16?values[12]:values[4];
}
async function lens(page,navSelector,itemSelector){
  return page.evaluate(({navSelector,itemSelector})=>{
    const nav=document.querySelector(navSelector),item=document.querySelector(itemSelector);
    const lens=nav?getComputedStyle(nav,'::before'):null,old=item?getComputedStyle(item,'::before'):null;
    return{
      content:lens?.content||'',transform:lens?.transform||'none',width:lens?.width||'',
      transitionDuration:lens?.transitionDuration||'',backdrop:lens?.backdropFilter||lens?.webkitBackdropFilter||'',
      oldItemContent:old?.content||''
    };
  },{navSelector,itemSelector});
}
async function assertTravel(page,{nav,item,tabs,label}){
  const states=[];
  for(let i=0;i<tabs.length;i++){
    const selector=tabs[i];
    if(i)await page.locator(selector).click();
    await page.waitForFunction(sel=>document.querySelector(sel)?.classList.contains('active'),selector);
    await page.waitForTimeout(480);
    states.push(await lens(page,nav,`${item}.active`));
  }
  const xs=states.map(s=>xOf(s.transform));
  if(states.some(s=>s.content==='none'||s.content==='normal'||!s.backdrop.includes('blur')))throw new Error(`${label}: shared glass lens missing ${JSON.stringify(states)}`);
  if(states.some(s=>s.oldItemContent!=='none'))throw new Error(`${label}: per-button pill still exists ${JSON.stringify(states)}`);
  for(let i=1;i<xs.length;i++)if(!(xs[i]>xs[i-1]+8))throw new Error(`${label}: lens did not travel forward ${JSON.stringify({xs,states})}`);
  return{xs,states};
}

async function school(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});const page=await context.newPage();
  const school={officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
  await page.route('**/functions/v1/school-data**',async route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='dashboard')return json(route,{school,selected:'20260823',from:'20260823',to:'20260823',timetable:[],meals:[],events:[],scheduleMeta:{mode:'fixture',count:0}});if(action==='media')return json(route,{media:{},homepage:school.homepage});if(action==='place')return json(route,{provider:'kakao',place:null});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({school})=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light')},{school});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();
  const result=await assertTravel(page,{nav:'#bottomNav',item:'.mobile-tab',tabs:['.mobile-tab[data-view="today"]:visible','.mobile-tab[data-view="week"]:visible','.mobile-tab[data-view="schedule"]:visible','.mobile-tab[data-view="school"]:visible'],label:'school'});
  await page.screenshot({path:`${OUT}/liquid-lens-school.png`,fullPage:false});await context.close();return result;
}
async function university(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});const page=await context.newPage();
  const university={id:'knu',name:'경북대학교',kind:'대학교',address:'대구광역시 북구 대학로 80',homepage:'https://www.knu.ac.kr'};
  await page.route('**/functions/v1/university-data**',route=>json(route,{school:university,metrics:{},partial:false,unavailable:[]}));
  await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
  await page.addInitScript(({university})=>{localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[]}));localStorage.setItem('flow-university-theme-v1',JSON.stringify('light'))},{university});
  await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#appView:not(.hidden)').waitFor();
  const result=await assertTravel(page,{nav:'.bottom-nav',item:'.bottom-item',tabs:['.bottom-item[data-view="today"]:visible','.bottom-item[data-view="timetable"]:visible','.bottom-item[data-view="school"]:visible'],label:'university'});
  await page.screenshot({path:`${OUT}/liquid-lens-university.png`,fullPage:false});await context.close();return result;
}

const result={school:await school(),university:await university()};
await browser.close();
console.log(JSON.stringify(result,null,2));
