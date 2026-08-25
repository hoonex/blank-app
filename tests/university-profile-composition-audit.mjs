import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'browser-audit-artifacts';
await fs.mkdir(OUT,{recursive:true});

const university={
  id:'knu',name:'경북대학교',englishName:'Kyungpook National University',foundation:'국립',kind:'대학교',division:'대학',
  founded:'19461015',region:'대구광역시',campus:'본교',address:'대구광역시 북구 대학로 80',postalCode:'41566',
  phone:'053-950-5114',fax:'053-950-2149',homepage:'https://www.knu.ac.kr',
};
const profilePayload={school:university,metrics:{},unavailable:[],partial:false};
const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixtures(page){
  await page.route('**/functions/v1/university-data**',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='profile')return json(route,profilePayload);
    if(action==='majors')return json(route,{majors:[]});
    return json(route,{});
  });
  await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
  await page.addInitScript(({university})=>{
    localStorage.clear();
    localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));
    localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[]}));
    localStorage.setItem('flow-university-theme-v1','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
  },{university});
}

function validate(name,width,state){
  if(state.scrollWidth>state.clientWidth+1)throw new Error(`${name}: horizontal overflow ${JSON.stringify(state)}`);
  if(state.count!==9)throw new Error(`${name}: expected nine basic information cards ${JSON.stringify(state)}`);
  if(!state.sheetLoaded)throw new Error(`${name}: profile composition stylesheet did not load`);
  if(Math.abs(state.lastRowCenter-state.gridCenter)>4)throw new Error(`${name}: final basic-info row is not centered ${JSON.stringify(state)}`);
  const ratio=state.firstWidth/state.gridWidth;
  if(width<=430){
    if(state.lastRowCount!==1||ratio<.94||state.lastWidth/state.gridWidth<.94)throw new Error(`${name}: phone profile should be one full-width column ${JSON.stringify(state)}`);
  }else if(width<=820){
    if(state.lastRowCount!==1||ratio<.44||ratio>.53||state.lastWidth/state.gridWidth<.44)throw new Error(`${name}: portrait profile should use balanced two-column geometry ${JSON.stringify(state)}`);
  }else if(width<=1199){
    if(state.lastRowCount!==3||ratio<.29||ratio>.36||state.lastRowCoverage<.94)throw new Error(`${name}: compact-wide profile should finish as a full three-column row ${JSON.stringify(state)}`);
  }else{
    if(state.lastRowCount!==1||ratio<.21||ratio>.28||state.lastWidth/state.gridWidth<.30||state.lastWidth/state.gridWidth>.37)throw new Error(`${name}: desktop profile should use readable four-column cards with a centered final fact ${JSON.stringify(state)}`);
  }
}

const browser=await chromium.launch({headless:true});
const report={};
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,isMobile:testCase.isMobile,hasTouch:testCase.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
  await fixtures(page);
  await page.goto(new URL('/university/',BASE).toString(),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#appView:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>[...document.styleSheets].some(sheet=>String(sheet.href||'').includes('/university/profile-composition.css')));
  await page.locator('[data-view="school"]:visible').first().click();
  await page.waitForSelector('#basicGrid > .basic-item');
  await page.waitForFunction(()=>document.querySelectorAll('#basicGrid > .basic-item').length===9);
  await page.waitForTimeout(120);
  const state=await page.evaluate(()=>{
    const grid=document.querySelector('#basicGrid'),items=[...grid.children];
    const rect=node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,cx:r.left+r.width/2}};
    const gr=rect(grid),rs=items.map(rect),maxTop=Math.max(...rs.map(r=>r.top)),lastRow=rs.filter(r=>Math.abs(r.top-maxTop)<2);
    const rowLeft=Math.min(...lastRow.map(r=>r.left)),rowRight=Math.max(...lastRow.map(r=>r.right));
    return{
      sheetLoaded:[...document.styleSheets].some(sheet=>String(sheet.href||'').includes('/university/profile-composition.css')),
      count:items.length,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
      gridWidth:gr.width,gridCenter:gr.cx,firstWidth:rs[0].width,lastWidth:rs.at(-1).width,
      lastRowCount:lastRow.length,lastRowCenter:(rowLeft+rowRight)/2,lastRowCoverage:(rowRight-rowLeft)/gr.width,
      labels:items.map(item=>item.querySelector('span')?.textContent?.trim()||''),
    };
  });
  validate(testCase.name,testCase.viewport.width,state);
  if(pageErrors.length)throw new Error(`${testCase.name}: page errors ${JSON.stringify(pageErrors)}`);
  await page.screenshot({path:`${OUT}/university-profile-composition-${testCase.name}.png`,fullPage:true});
  report[testCase.name]={...state,pageErrors};
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/university-profile-composition-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
