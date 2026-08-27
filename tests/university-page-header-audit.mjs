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
  await page.evaluate(v=>document.querySelector(`.bottom-nav [data-view="${v}"]`)?.click(),view);
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
    const tools=v==='campus'?panel.querySelector('#campusHeaderTools'):null;
    const nearby=v==='campus'?panel.querySelector('.campus-nearby-quick'):null;
    const filter=v==='campus'?panel.querySelector('#campusFilter'):null;
    const filterButtons=filter?[...filter.querySelectorAll('button')].filter(node=>getComputedStyle(node).display!=='none').map(rect):[];
    const bottomNav=document.querySelector('.bottom-nav'),brand=mobileHeader?.querySelector('.brand'),mobileSchool=mobileHeader?.querySelector('.mobile-school');
    const navItems=bottomNav?[...bottomNav.querySelectorAll('.bottom-item')].filter(node=>getComputedStyle(node).display!=='none').map(rect):[];
    return{
      view:v,
      title:title?.textContent?.trim()||'',
      titleRect:rect(title),
      headerRect:rect(header),
      mobileHeaderRect:rect(mobileHeader),
      bottomNavRect:rect(bottomNav),
      brandRect:rect(brand),
      mobileSchoolRect:rect(mobileSchool),
      navItems,
      actionRect:rect(action),
      buttonRects:visibleButtons.map(rect),
      visibleEnglishLabels,
      toolsRect:rect(tools),
      nearbyRect:rect(nearby),
      filterRect:rect(filter),
      filterButtons,
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
    if(name==='mobile-landscape'){
      if(!state.mobileHeaderRect||!state.bottomNavRect||!state.brandRect||!state.mobileSchoolRect)throw new Error(`${name}/${state.view}: landscape command bar geometry missing ${JSON.stringify(state)}`);
      if(state.bottomNavRect.top<state.mobileHeaderRect.top-1||state.bottomNavRect.bottom>state.mobileHeaderRect.bottom+1)throw new Error(`${name}/${state.view}: navigation is not contained by the mobile header ${JSON.stringify({header:state.mobileHeaderRect,nav:state.bottomNavRect})}`);
      if(state.bottomNavRect.left<state.brandRect.right+8)throw new Error(`${name}/${state.view}: navigation overlaps the Flow brand ${JSON.stringify({brand:state.brandRect,nav:state.bottomNavRect})}`);
      if(state.bottomNavRect.right>state.mobileSchoolRect.left-8)throw new Error(`${name}/${state.view}: navigation overlaps university identity ${JSON.stringify({school:state.mobileSchoolRect,nav:state.bottomNavRect})}`);
      if(state.bottomNavRect.bottom>state.titleRect.top-5)throw new Error(`${name}/${state.view}: landscape navigation still covers page content ${JSON.stringify({nav:state.bottomNavRect,title:state.titleRect})}`);
      if(state.navItems.length<3||state.navItems.some(r=>r.height<30||r.width<44))throw new Error(`${name}/${state.view}: landscape navigation targets are clipped/undersized ${JSON.stringify(state.navItems)}`);
    }
    if(state.view==='campus'){
      if(!state.toolsRect||!state.nearbyRect||!state.filterRect||state.filterButtons.length!==4)throw new Error(`${name}/campus: contextual toolbar is missing ${JSON.stringify(state)}`);
      const widths=state.filterButtons.map(r=>r.width),widthSpread=Math.max(...widths)-Math.min(...widths);
      if(name==='mobile-portrait'){
        const leftGap=state.filterButtons[0].left-state.filterRect.left,rightGap=state.filterRect.right-state.filterButtons.at(-1).right;
        if(state.filterRect.width<state.nearbyRect.width*.94)throw new Error(`${name}/campus: filter does not fill the portrait Nearby control ${JSON.stringify({nearby:state.nearbyRect,filter:state.filterRect})}`);
        if(widthSpread>3)throw new Error(`${name}/campus: portrait filter cells are not equal width ${JSON.stringify(widths)}`);
        if(leftGap>2||rightGap>2)throw new Error(`${name}/campus: ghost space remains around portrait filter cells ${JSON.stringify({leftGap,rightGap,filter:state.filterRect,buttons:state.filterButtons})}`);
      }else{
        const railGap=state.actionRect.left-state.nearbyRect.right;
        const topDelta=Math.abs(state.actionRect.top-state.nearbyRect.top);
        const heightDelta=Math.abs(state.actionRect.height-state.nearbyRect.height);
        if(railGap<4||railGap>18)throw new Error(`${name}/campus: related toolbar controls are visually disconnected ${JSON.stringify({railGap,nearby:state.nearbyRect,refresh:state.actionRect})}`);
        if(topDelta>3||heightDelta>5)throw new Error(`${name}/campus: Nearby and refresh do not read as one command rail ${JSON.stringify({topDelta,heightDelta,nearby:state.nearbyRect,refresh:state.actionRect})}`);
        if(state.nearbyRect.width>Math.min(470,state.headerRect.width*.65))throw new Error(`${name}/campus: Nearby surface is oversized relative to its content ${JSON.stringify({nearby:state.nearbyRect,header:state.headerRect})}`);
        if(Math.min(...widths)<60||Math.max(...widths)>92||widthSpread>3)throw new Error(`${name}/campus: filter choices are stretched instead of content-sized ${JSON.stringify(widths)}`);
        if(Math.abs(state.nearbyRect.left-state.titleRect.left)>3)throw new Error(`${name}/campus: contextual toolbar does not align with page copy ${JSON.stringify({title:state.titleRect,nearby:state.nearbyRect})}`);
      }
    }
  }
  const titleLefts=states.map(x=>x.titleRect.left),titleTops=states.map(x=>x.titleRect.top);
  const standardActions=states.filter(x=>x.view!=='campus').map(x=>x.actionRect.right);
  const spread=values=>Math.max(...values)-Math.min(...values);
  if(spread(titleLefts)>3)throw new Error(`${name}: title left edge drift ${JSON.stringify(titleLefts)}`);
  if(spread(titleTops)>4)throw new Error(`${name}: title top baseline drift ${JSON.stringify(titleTops)}`);
  if(standardActions.length>1&&spread(standardActions)>4)throw new Error(`${name}: global page actions do not share the same right edge ${JSON.stringify(standardActions)}`);
}

const browser=await chromium.launch({headless:true});
const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
];
const report={};
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,isMobile:testCase.isMobile,hasTouch:testCase.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();await fixtures(page);
  await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#appView:not(.hidden)');
  await page.waitForSelector('link[href*="/university/page-header.css"]',{state:'attached'});
  await page.waitForSelector('link[href*="/university/landscape-toolbar.css"]',{state:'attached'});
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
