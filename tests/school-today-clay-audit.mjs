import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-today-clay-audit';
await fs.mkdir(OUT,{recursive:true});

const pad=value=>String(value).padStart(2,'0');
const seoulYmd=()=>{const d=new Date(Date.now()+9*60*60*1000);return`${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}`};
const today=seoulYmd();
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const dashboard={
  school:profile.school,selected:today,from:today,to:today,
  timetable:Array.from({length:7},(_,i)=>({date:today,period:i+1,subject:['자율·자치활동','문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육'][i]})),
  meals:[{date:today,type:'중식',dishes:['현미밥','된장국'],calories:'812.4 Kcal',nutrition:'',origin:''}],
  events:[{date:today,name:'전국연합학력평가',content:'fixture',grade1:'N',grade2:'Y',grade3:'N',holidayType:''}],
  scheduleMeta:{mode:'fixture',count:1},
};
const cases=[
  {name:'compact-390',width:390,height:844},
  {name:'galaxy-412',width:412,height:915},
];

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function installFixture(page,glassMode){
  await page.route('**/functions/v1/school-data*',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='dashboard')return json(route,dashboard);
    if(action==='media')return json(route,{media:{}});
    if(action==='place')return json(route,{provider:'kakao',place:null});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({profile,glassMode})=>{
    localStorage.clear();sessionStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2',glassMode);
    localStorage.setItem('flow-school-transit-lab-v1','off');
  },{profile,glassMode});
}

async function snapshot(page){
  return page.evaluate(()=>{
    const styleOf=(selector,pseudo=null)=>{const el=document.querySelector(selector);if(!el)return null;const s=getComputedStyle(el,pseudo);const r=el.getBoundingClientRect();return{
      display:s.display,visibility:s.visibility,opacity:Number(s.opacity||1),
      borderTopWidth:s.borderTopWidth,borderRightWidth:s.borderRightWidth,borderBottomWidth:s.borderBottomWidth,borderLeftWidth:s.borderLeftWidth,
      outlineWidth:s.outlineWidth,background:s.backgroundColor,boxShadow:s.boxShadow,borderRadius:s.borderRadius,
      rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
    }};
    const cards=[...document.querySelectorAll('#todayView .status-card')].filter(el=>getComputedStyle(el).display!=='none').map(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();return{border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],boxShadow:s.boxShadow,background:s.backgroundColor,rect:{left:r.left,top:r.top,width:r.width,height:r.height}};
    });
    return{
      mode:document.documentElement.dataset.flowGlassMode||'',
      claySheet:Boolean(document.querySelector('link[data-flow-school-today-clay]')),
      mobileSchool:styleOf('.mobile-school-button'),
      hero:styleOf('#todayView .school-hero'),
      heroDuplicateName:styleOf('#todayView .school-hero-copy h1'),
      heroDuplicateMeta:styleOf('#todayView .school-hero-copy p'),
      date:styleOf('#todayView .date-controller'),
      prev:styleOf('#todayView #prevDay'),
      next:styleOf('#todayView #nextDay'),
      statusGrid:styleOf('#todayView .status-grid'),
      statusCards:cards,
      topbar:styleOf('.mobile-topbar'),
      viewport:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth},
    };
  });
}
function px0(value){return Number.parseFloat(value||'0')===0}
function borderless(name,node){
  if(!node)throw new Error(`${name}: missing element`);
  for(const key of ['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'])if(!px0(node[key]))throw new Error(`${name}: visible border remains ${JSON.stringify(node)}`);
}
function clay(name,node){
  if(!node)throw new Error(`${name}: missing element`);
  if(!node.boxShadow||node.boxShadow==='none'||!node.boxShadow.includes('inset'))throw new Error(`${name}: soft-clay depth missing ${JSON.stringify(node)}`);
}
function assertState(name,state){
  if(!state.claySheet)throw new Error(`${name}: Today clay stylesheet did not load`);
  borderless(`${name}/mobileSchool`,state.mobileSchool);
  borderless(`${name}/hero`,state.hero);
  borderless(`${name}/date`,state.date);
  borderless(`${name}/prev`,state.prev);
  borderless(`${name}/next`,state.next);
  borderless(`${name}/statusGrid`,state.statusGrid);
  state.statusCards.forEach((card,index)=>{
    if(card.border.some(v=>!px0(v)))throw new Error(`${name}/statusCard${index}: visible border remains ${JSON.stringify(card)}`);
    clay(`${name}/statusCard${index}`,card);
  });
  clay(`${name}/mobileSchool`,state.mobileSchool);
  clay(`${name}/date`,state.date);
  clay(`${name}/prev`,state.prev);
  clay(`${name}/next`,state.next);
  if(state.heroDuplicateName?.display!=='none'||state.heroDuplicateMeta?.display!=='none')throw new Error(`${name}: duplicate school identity is still visible inside mobile Hero ${JSON.stringify({name:state.heroDuplicateName,meta:state.heroDuplicateMeta})}`);
  if(state.hero.rect.height>114||state.hero.rect.height<90)throw new Error(`${name}: compact Hero height escaped cycle-2 range ${JSON.stringify(state.hero.rect)}`);
  if(state.date.rect.left<state.hero.rect.left-1||state.date.rect.right>state.hero.rect.right+1||state.date.rect.bottom>state.hero.rect.bottom+1)throw new Error(`${name}: date control escaped Hero ${JSON.stringify({hero:state.hero.rect,date:state.date.rect})}`);
  if(!state.statusCards.length)throw new Error(`${name}: no visible status cards`);
  if(state.statusGrid.background!=='rgba(0, 0, 0, 0)')throw new Error(`${name}: status tray still has a visible container fill ${JSON.stringify(state.statusGrid)}`);
  if(state.viewport.scrollWidth>state.viewport.width+2)throw new Error(`${name}: horizontal overflow ${JSON.stringify(state.viewport)}`);
}
function stableGeometry(name,a,b){
  for(const key of ['hero','date','statusGrid']){
    const ar=a[key]?.rect,br=b[key]?.rect;if(!ar||!br)continue;
    const max=Math.max(Math.abs(ar.left-br.left),Math.abs(ar.top-br.top),Math.abs(ar.width-br.width),Math.abs(ar.height-br.height));
    if(max>1.5)throw new Error(`${name}: ${key} drifted after 5s ${JSON.stringify({before:ar,after:br,max})}`);
  }
}

const browser=await chromium.launch({headless:true});
const report={};
for(const c of cases){
  for(const mode of ['standard','optical']){
    const name=`${c.name}-${mode}`;
    const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
    const page=await context.newPage();page.setDefaultTimeout(10000);await installFixture(page,mode);
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.locator('#dashboard:not(.hidden)').waitFor();
    await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurfaceCleanup==='ready');
    await page.waitForFunction(()=>document.querySelector('link[data-flow-school-today-clay]')&&getComputedStyle(document.querySelector('#todayView .school-hero')).borderTopWidth==='0px');
    await page.waitForTimeout(400);
    const initial=await snapshot(page);assertState(`${name}/initial`,initial);
    await page.screenshot({path:`${OUT}/${name}-initial.png`,fullPage:false});
    await page.waitForTimeout(5000);
    const delayed=await snapshot(page);assertState(`${name}/5s`,delayed);stableGeometry(name,initial,delayed);
    await page.screenshot({path:`${OUT}/${name}-5s.png`,fullPage:false});
    report[name]={initial,delayed};
    await context.close();
  }
}
await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({ok:true,cases:Object.keys(report),contract:'mobile Today top stays borderless, deduplicated and soft-clay after 5 seconds'},null,2));
