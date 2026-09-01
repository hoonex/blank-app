import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-home-cleanup-audit/today-actions';
await fs.mkdir(OUT,{recursive:true});

const pad=value=>String(value).padStart(2,'0');
const now=new Date(Date.now()+9*60*60*1000);
const selected=`${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}`;
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199'},grade:2,className:'6'};
const dashboard={
  school:profile.school,selected,from:selected,to:selected,
  timetable:Array.from({length:7},(_,i)=>({date:selected,period:i+1,subject:['자율·자치활동','문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육'][i]})),
  meals:[{date:selected,type:'중식',dishes:['현미밥','된장국','제육볶음'],calories:'812.4 Kcal',nutrition:'단백질 32g',origin:'쌀 국내산'}],
  events:[{date:selected,name:'다가오는 행사',content:'행사'}],scheduleMeta:{mode:'fixture',count:1},
};
const cases=[
  ['mobile-portrait',390,844,true],
  ['mobile-landscape',844,390,true],
  ['tablet-portrait',768,1024,true],
  ['tablet-landscape',1024,768,true],
  ['desktop-1366',1366,768,false],
  ['desktop-1920',1920,1080,false],
];
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixture(page){
  await page.route('**/functions/v1/school-data*',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='dashboard')return json(route,dashboard);
    if(action==='media')return json(route,{media:{}});
    if(action==='place')return json(route,{provider:'fixture',place:{id:'school',name:profile.school.name,url:'https://place.map.kakao.com/1',address:profile.school.address,roadAddress:profile.school.address,x:'128.68',y:'35.87'}});
    return json(route,{});
  });
  await page.addInitScript(({profile})=>{
    localStorage.clear();sessionStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
    localStorage.setItem('flow-school-transit-lab-v1','off');
  },{profile});
}
function assert(condition,message){if(!condition)throw new Error(message)}
async function renderedState(page){
  return page.evaluate(()=>{
    const style=node=>node?getComputedStyle(node):null;
    const metric=node=>{if(!node)return null;const s=style(node),r=node.getBoundingClientRect();return{border:s.borderTopWidth,radius:s.borderTopLeftRadius,width:r.width,height:r.height,background:s.backgroundColor,color:s.color}};
    const actions=document.querySelector('.timetable-actions');
    const order=actions?[...actions.children].map(node=>node.classList.contains('timetable-mode-toggle')?'mode':node.id==='editSubjectsBtn'?'edit':node.id==='shareTimetableBtn'?'share':node.id||node.className):[];
    const periods=[...document.querySelectorAll('#timetable .period-no')].map(metric);
    return{
      order,
      mode:metric(document.querySelector('.timetable-mode-toggle')),
      edit:metric(document.querySelector('#editSubjectsBtn')),
      share:metric(document.querySelector('#shareTimetableBtn')),
      allergy:metric(document.querySelector('#allergyBtn')),
      editClass:document.querySelector('#editSubjectsBtn')?.classList.contains('flow-school-utility-action')||false,
      shareClass:document.querySelector('#shareTimetableBtn')?.classList.contains('flow-school-utility-action')||false,
      allergyClass:document.querySelector('#allergyBtn')?.classList.contains('flow-school-utility-action')||false,
      periods,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    };
  });
}

const browser=await chromium.launch({headless:true});
const report={};
for(const [name,width,height,isMobile] of cases){
  const context=await browser.newContext({viewport:{width,height},isMobile,hasTouch:isMobile,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await fixture(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolUiStyles==='ready');
  await page.waitForFunction(()=>document.querySelector('.timetable-mode-toggle')&&document.querySelector('#shareTimetableBtn')&&document.querySelectorAll('#timetable .period-no').length>=4);
  const state=await renderedState(page);
  assert(state.order.join('|')==='mode|edit|share',`${name}: action order regressed ${JSON.stringify(state.order)}`);
  assert(state.mode?.border==='0px',`${name}: mode switch has a visible border ${JSON.stringify(state.mode)}`);
  for(const [key,value] of [['edit',state.edit],['share',state.share],['allergy',state.allergy]]){
    assert(value?.border==='0px',`${name}: ${key} action has a visible border ${JSON.stringify(value)}`);
    assert(Number.parseFloat(value?.radius||'0')>=Number(value?.height||0)/2-1,`${name}: ${key} action is not pill-shaped ${JSON.stringify(value)}`);
  }
  assert(state.editClass&&state.shareClass&&state.allergyClass,`${name}: utility action classes missing ${JSON.stringify(state)}`);
  assert(state.periods.length>=4,`${name}: timetable period badges missing`);
  assert(state.periods.every(period=>period.radius==='50%'&&Math.abs(period.width-period.height)<=1),`${name}: period badges are not circles ${JSON.stringify(state.periods)}`);
  assert(state.overflow<=1,`${name}: horizontal overflow ${state.overflow}`);
  assert(errors.length===0,`${name}: browser errors ${JSON.stringify(errors)}`);
  report[name]={state,errors};
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({ok:true,order:['mode','edit','share'],periodShape:'circle',viewports:Object.keys(report)},null,2));
