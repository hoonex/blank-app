import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='university-page-header-audit';
await mkdir(OUT,{recursive:true});

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixtures(page){
  const university={id:'knu',name:'경북대학교',kind:'대학교',address:'대구광역시 북구 대학로 80',homepage:'https://www.knu.ac.kr'};
  const subjects=[
    {name:'자료구조',professor:'김교수',credit:3,place:'IT대학 1호관',times:[{day:0,start:'09:00',end:'10:15',startMinutes:540,endMinutes:615,place:'IT대학 1호관'}]},
    {name:'운영체제',professor:'박교수',credit:3,place:'공대9호관',times:[{day:0,start:'11:00',end:'12:15',startMinutes:660,endMinutes:735,place:'공대9호관'}]},
    {name:'네트워크',professor:'이교수',credit:3,place:'법과대학',times:[{day:0,start:'14:00',end:'15:15',startMinutes:840,endMinutes:915,place:'법과대학'}]},
  ];
  const places=[
    {raw:'IT대학 1호관',resolved:true,confidence:95,place:{name:'IT대학 1호관',x:'128.6101',y:'35.8891',distance:450,url:'https://map.kakao.com/'}},
    {raw:'공대9호관',resolved:true,confidence:95,place:{name:'공대9호관',x:'128.6110',y:'35.8887',distance:210,url:'https://map.kakao.com/'}},
    {raw:'법과대학',resolved:true,confidence:95,place:{name:'법과대학',x:'128.6120',y:'35.8894',distance:330,url:'https://map.kakao.com/'}},
  ];
  await page.route('**/functions/v1/university-data**',route=>json(route,{school:university,metrics:{},partial:false,unavailable:[]}));
  await page.route('**/functions/v1/university-campus**',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='static-map')return route.fulfill({status:204,body:''});
    if(action==='route')return json(route,{route:{status:'OK',distance:420,time:360,points:[],landingUrl:'https://map.kakao.com/'}});
    return json(route,{center:{x:'128.6110',y:'35.8890'},places,nearby:{dining:[],stores:[],cafes:[],food:[]}});
  });
  await page.addInitScript(({university,subjects})=>{
    localStorage.clear();
    localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));
    localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects}));
    localStorage.setItem('flow-university-theme-v1','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
  },{university,subjects});
}

async function switchView(page,view){
  if(view==='today'){
    await page.evaluate(()=>document.querySelector('.bottom-nav [data-view="today"]')?.click());
  }else{
    await page.evaluate(v=>document.querySelector(`.bottom-nav [data-view="${v}"]`)?.click(),view);
  }
  await page.waitForFunction(v=>{const panel=document.querySelector(`[data-panel="${v}"]`);return panel&&!panel.classList.contains('hidden')},view);
  if(view==='campus')await page.waitForSelector('#campusHeaderTools');
  await page.waitForTimeout(120);
}

async function inspect(page,view){
  return page.evaluate(v=>{
    const panel=document.querySelector(`[data-panel="${v}"]`),header=panel?.querySelector(':scope > .view-header'),title=header?.querySelector('h1'),mobileHeader=document.querySelector('.mobile-header');
    const action=v==='today'?header?.querySelector('.dashboard-top-actions'):v==='timetable'?header?.querySelector('.schedule-actions'):header?.querySelector('#campusRefreshBtn');
    const visibleButtons=[...(action?.matches?.('button')?[action]:action?.querySelectorAll?.('button')||[])].filter(node=>getComputedStyle(node).display!=='none');
    const labelNodes=[...panel.querySelectorAll('.kicker,.campus-section-label,.campus-nearby-quick-copy > span')];
    const visibleEnglishLabels=labelNodes.filter(node=>getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0).map(node=>node.textContent.trim()).filter(Boolean);
    const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    return{
      view:v,
      title:title?.textContent?.trim()||'',
      titleRect:rect(title),
      headerRect:rect(header),
      mobileHeaderRect:rect(mobileHeader),
      actionRect:rect(action),
      buttonRects:visibleButtons.map(rect),
      visibleEnglishLabels,
      clientWidth:document.documentElement.clientWidth,
      scrollWidth:document.documentElement.scrollWidth,
    };
  },view);
}

function validateViewport(name,states){
  for(const state of states){
    if(!state.titleRect||!state.headerRect)throw new Error(`${name}/${state.view}: missing page header ${JSON.stringify(state)}`);
    if(state.visibleEnglishLabels.length)throw new Error(`${name}/${state.view}: English kicker residue is still visible ${JSON.stringify(state.visibleEnglishLabels)}`);
    if(state.scrollWidth>state.clientWidth+1)throw new Error(`${name}/${state.view}: horizontal overflow ${JSON.stringify({clientWidth:state.clientWidth,scrollWidth:state.scrollWidth})}`);
    if(state.mobileHeaderRect&&state.titleRect.top<state.mobileHeaderRect.bottom+5)throw new Error(`${name}/${state.view}: title is clipped by mobile header ${JSON.stringify(state)}`);
    if(!state.actionRect)throw new Error(`${name}/${state.view}: missing canonical page action ${JSON.stringify(state)}`);
    if(state.actionRect.right>state.clientWidth+1)throw new Error(`${name}/${state.view}: action escapes viewport ${JSON.stringify(state)}`);
    if(state.buttonRects.some(r=>r.height<39))throw new Error(`${name}/${state.view}: page action height is inconsistent/undersized ${JSON.stringify(state.buttonRects)}`);
  }
  const titleLefts=states.map(x=>x.titleRect.left),titleTops=states.map(x=>x.titleRect.top),actionRights=states.map(x=>x.actionRect.right);
  const spread=values=>Math.max(...values)-Math.min(...values);
  if(spread(titleLefts)>3)throw new Error(`${name}: title left edge drift ${JSON.stringify(titleLefts)}`);
  if(spread(titleTops)>4)throw new Error(`${name}: title top baseline drift ${JSON.stringify(titleTops)}`);
  if(spread(actionRights)>4)throw new Error(`${name}: page actions do not share the same right edge ${JSON.stringify(actionRights)}`);
}

const browser=await chromium.launch({headless:true});
const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844}},
  {name:'mobile-landscape',viewport:{width:844,height:390}},
];
const report={};
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();await fixtures(page);
  await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#appView:not(.hidden)');
  await page.waitForSelector('link[href*="/university/page-header.css"]');
  await page.waitForSelector('#dashboardEditBtn');
  const states=[];
  for(const view of ['today','timetable','campus']){
    await switchView(page,view);
    states.push(await inspect(page,view));
    await page.screenshot({path:`${OUT}/${testCase.name}-${view}.png`,fullPage:false});
  }
  validateViewport(testCase.name,states);
  report[testCase.name]=states;
  await context.close();
}
await browser.close();
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
