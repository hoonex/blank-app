import { chromium } from 'playwright';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199'},grade:2,className:'6'};
const pad=n=>String(n).padStart(2,'0');
const now=new Date(),today=`${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
const dashboard={school:profile.school,selected:today,from:today,to:today,timetable:Array.from({length:7},(_,i)=>({date:today,period:i+1,subject:`과목 ${i+1}`})),meals:[{date:today,type:'중식',dishes:['현미밥','국'],calories:'700 Kcal'}],events:[{date:today,name:'평가',content:'일정'}],scheduleMeta:{mode:'fixture',count:1}};
const json=(route,body)=>route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:768,height:1024},hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul'});
const page=await context.newPage();
await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});return json(route,{})});
await page.route('**/functions/v1/school-logo*',route=>route.fulfill({status:204,body:''}));
await page.addInitScript(profile=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard');localStorage.setItem('flow-school-transit-lab-v1','off')},profile);
await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForSelector('#dashboard:not(.hidden)',{timeout:12000});
await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready'&&document.documentElement.dataset.flowTodayTopbar==='ready');
await page.waitForTimeout(220);

const report=await page.evaluate(()=>{
  const targets={grid:document.querySelector('#todayView .today-grid'),tt:document.querySelector('#todayView .timetable-card'),right:document.querySelector('#todayView .right-stack')};
  const box=n=>{const r=n.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const matched=[];
  const walk=(rules,source)=>{
    for(const rule of [...(rules||[])]){
      if(rule.cssRules){walk(rule.cssRules,source);continue}
      if(!rule.selectorText)continue;
      for(const [name,node] of Object.entries(targets)){
        let match=false;try{match=node.matches(rule.selectorText)}catch{}
        if(!match)continue;
        const css=rule.style;
        if(css?.gridTemplateColumns||css?.gridColumn||css?.display||css?.gap){matched.push({target:name,source,selector:rule.selectorText,gridTemplateColumns:css.gridTemplateColumns||'',gridColumn:css.gridColumn||'',display:css.display||'',gap:css.gap||'',priority:{gridTemplateColumns:css.getPropertyPriority('grid-template-columns'),gridColumn:css.getPropertyPriority('grid-column')}})}
      }
    }
  };
  for(const sheet of [...document.styleSheets]){
    const source=sheet.href||sheet.ownerNode?.id||sheet.ownerNode?.getAttribute?.('data-flow-school-style')||sheet.ownerNode?.tagName||'inline';
    try{walk(sheet.cssRules,source)}catch{}
  }
  const computed=Object.fromEntries(Object.entries(targets).map(([k,n])=>{const s=getComputedStyle(n);return[k,{box:box(n),gridTemplateColumns:s.gridTemplateColumns,gridColumn:s.gridColumn,display:s.display,gap:s.gap}]}));
  return{layout:document.documentElement.dataset.flowSchoolLayout,ratioReady:document.documentElement.dataset.flowSchoolContentRatio||'',contract:Boolean(document.getElementById('flow-school-layout-contract-style')),computed,matched};
});
console.log(JSON.stringify(report,null,2));
const ratio=report.computed.tt.box.width/report.computed.right.box.width;
const target=1.42/.72;
await browser.close();
if(Math.abs(report.computed.tt.box.top-report.computed.right.box.top)>3||Math.abs(ratio-target)>.12)throw new Error(`tablet ratio cascade unresolved: actual=${ratio.toFixed(3)} target=${target.toFixed(3)}`);
