import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE = process.env.FLOW_TEST_URL || 'http://127.0.0.1:4173/';
const OUT = process.env.FLOW_TEST_OUT || 'browser-audit-artifacts';
await fs.mkdir(OUT,{recursive:true});

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청'},grade:2,className:'6'};
const cases=[
  {name:'mobile',viewport:{width:412,height:915},mobile:true},
  {name:'tablet',viewport:{width:1024,height:768},mobile:false},
  {name:'desktop',viewport:{width:1536,height:960},mobile:false},
];
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),base:BASE,landing:[],cases:[]};
let failed=false;

function wireDiagnostics(page){
  const state={consoleErrors:[],pageErrors:[],dashboardRequests:[],failedRequests:[]};
  page.on('console',m=>{if(m.type()==='error')state.consoleErrors.push(m.text())});
  page.on('pageerror',e=>state.pageErrors.push(String(e)));
  page.on('request',req=>{if(req.url().includes('/functions/v1/school-data')&&req.url().includes('action=dashboard'))state.dashboardRequests.push(req.url())});
  page.on('requestfailed',req=>state.failedRequests.push({url:req.url(),error:req.failure()?.errorText||''}));
  return state;
}
function importantFailures(list){return list.filter(x=>!x.url.includes('fonts.googleapis.com')&&!x.url.includes('fonts.gstatic.com')&&!x.url.includes('/flow-quest-event'))}
async function writeReport(){await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2))}

/* Landing + real school search at every target width. */
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,deviceScaleFactor:1,isMobile:testCase.mobile,hasTouch:testCase.mobile,locale:'ko-KR',colorScheme:'light'});
  const page=await context.newPage();const diag=wireDiagnostics(page);const landing={name:testCase.name,viewport:testCase.viewport};
  try{
    await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('flow-school-theme-v3','light')});
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('#landing:not(.hidden)',{timeout:8000});
    await page.locator('#schoolSearch').fill('정동고');
    await page.waitForSelector('#schoolResults .result-btn',{timeout:10000});
    await page.waitForTimeout(250);
    landing.geometry=await page.evaluate(()=>{
      const search=document.querySelector('.search-box')?.getBoundingClientRect();
      const results=document.querySelector('#schoolResults')?.getBoundingClientRect();
      const copy=document.querySelector('.onboarding-copy')?.getBoundingClientRect();
      return {search:search&&{top:search.top,bottom:search.bottom,left:search.left,right:search.right},results:results&&{top:results.top,bottom:results.bottom,left:results.left,right:results.right},copy:copy&&{top:copy.top,bottom:copy.bottom}};
    });
    landing.resultOverlapsSearch=!!(landing.geometry.search&&landing.geometry.results&&landing.geometry.results.top<landing.geometry.search.bottom-1);
    await page.screenshot({path:`${OUT}/${testCase.name}-landing-search.png`,fullPage:true});
  }catch(error){landing.error=String(error);failed=true}
  landing.consoleErrors=diag.consoleErrors;landing.pageErrors=diag.pageErrors;landing.failedRequests=importantFailures(diag.failedRequests);
  if(landing.resultOverlapsSearch||landing.consoleErrors.length||landing.pageErrors.length)failed=true;
  report.landing.push(landing);await context.close();await writeReport();
}

for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,deviceScaleFactor:1,isMobile:testCase.mobile,hasTouch:testCase.mobile,locale:'ko-KR',colorScheme:'light',reducedMotion:'no-preference'});
  const page=await context.newPage();const diag=wireDiagnostics(page);const result={name:testCase.name,viewport:testCase.viewport,interactionErrors:[]};
  try{
    await page.addInitScript(({profile})=>{
      localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.removeItem('flow-school-profile-v2');
      window.__flowAudit={longTasks:[],mutations:0,unexpectedMutations:0};
      try{new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__flowAudit.longTasks.push({start:entry.startTime,duration:entry.duration})}).observe({type:'longtask',buffered:true})}catch{}
      addEventListener('DOMContentLoaded',()=>{
        const root=document.querySelector('#dashboard');
        if(!root)return;
        new MutationObserver(records=>{
          window.__flowAudit.mutations+=records.length;
          window.__flowAudit.unexpectedMutations+=records.filter(record=>{
            const target=record.target?.nodeType===1?record.target:record.target?.parentElement;
            return !target?.closest?.('.clock-card,#csatPill');
          }).length;
        }).observe(root,{childList:true,subtree:true,attributes:true});
      },{once:true});
    },{profile});

    const started=Date.now();await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});await page.waitForTimeout(2500);result.loadMs=Date.now()-started;

    const selectTab=async(view)=>{
      try{
        if(view==='week'){
          const inlineWeek=page.locator('.timetable-mode-toggle button:visible',{hasText:'주간'}).first();
          if(await inlineWeek.count()){
            await inlineWeek.click({trial:true,timeout:3000});
            const t0=Date.now();
            await inlineWeek.click({timeout:3000});
            await page.waitForFunction(()=>{
              const inline=document.querySelector('#inlineWeekTimetable');
              return document.body.classList.contains('flow-inline-week-active')&&!!inline&&!inline.classList.contains('hidden');
            },null,{timeout:3000});
            return Date.now()-t0;
          }
        }
        const tab=page.locator(`[data-view="${view}"]:visible`).first();
        await tab.click({trial:true,timeout:3000});
        const t0=Date.now();
        await tab.click({timeout:3000});
        await page.waitForFunction(v=>{const p=document.querySelector(`[data-view-panel="${v}"]`);return !!p&&!p.classList.contains('hidden')},view,{timeout:3000});
        return Date.now()-t0;
      }catch(error){result.interactionErrors.push(`tab:${view}:${String(error).split('\n')[0]}`);return null}
    };

    result.tabLatencies=[];for(const view of ['week','schedule','school','today','week','today'])result.tabLatencies.push({view,ms:await selectTab(view)});

    await selectTab('today');
    await page.evaluate(()=>window.scrollTo(0,Math.max(0,Math.min(900,document.documentElement.scrollHeight-innerHeight-10))));await page.waitForTimeout(120);result.scrollBefore=await page.evaluate(()=>scrollY);await page.waitForTimeout(1200);result.scrollAfter=await page.evaluate(()=>scrollY);result.autoScrollDelta=Math.round(result.scrollAfter-result.scrollBefore);

    await selectTab('week');
    result.weekScroll=await page.evaluate(()=>{const el=document.querySelector('.week-table-wrap');if(!el)return null;el.scrollLeft=Math.max(0,Math.min(420,el.scrollWidth-el.clientWidth));return{left:el.scrollLeft,width:el.clientWidth,scrollWidth:el.scrollWidth}});
    const y0=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,500);await page.waitForTimeout(250);const y1=await page.evaluate(()=>scrollY);result.weekVerticalScrollDelta=Math.round(y1-y0);

    await selectTab('schedule');
    const dotted=page.locator('.calendar-day[data-calendar-date]').filter({has:page.locator('.calendar-dot')}).first();
    if(await dotted.count()){await dotted.click();await page.waitForTimeout(350)}
    result.scheduleState=await page.evaluate(()=>({path:location.pathname,selectedDays:document.querySelectorAll('.calendar-day.selected').length,selectedPanel:document.querySelector('#selectedDayPanel')?.textContent?.trim()||'',scheduleVisible:!document.querySelector('[data-view-panel="schedule"]')?.classList.contains('hidden')}));

    await selectTab('today');const idleStart=await page.evaluate(()=>window.__flowAudit?.unexpectedMutations||0);await page.waitForTimeout(2000);const idleEnd=await page.evaluate(()=>window.__flowAudit?.unexpectedMutations||0);result.idleMutations2s=idleEnd-idleStart;

    result.metrics=await page.evaluate(()=>({scrollHeight:document.documentElement.scrollHeight,domNodes:document.getElementsByTagName('*').length,stylesheets:document.styleSheets.length,scripts:document.scripts.length,longTasks:window.__flowAudit?.longTasks||[],mutationCount:window.__flowAudit?.mutations||0,unexpectedMutationCount:window.__flowAudit?.unexpectedMutations||0,navCount:document.querySelectorAll('[data-view]').length}));
    await page.screenshot({path:`${OUT}/${testCase.name}-today.png`,fullPage:true});await selectTab('week');await page.screenshot({path:`${OUT}/${testCase.name}-week.png`,fullPage:true});await selectTab('schedule');await page.screenshot({path:`${OUT}/${testCase.name}-schedule.png`,fullPage:true});

    const latencies=result.tabLatencies.map(x=>x.ms).filter(Number.isFinite).sort((a,b)=>a-b);result.tabP95Ms=latencies.length?latencies[Math.max(0,Math.ceil(latencies.length*.95)-1)]:null;
  }catch(error){result.fatalError=String(error);failed=true}

  result.dashboardRequestCount=diag.dashboardRequests.length;result.dashboardRequests=diag.dashboardRequests;result.consoleErrors=diag.consoleErrors;result.pageErrors=diag.pageErrors;result.failedRequests=importantFailures(diag.failedRequests);
  if(result.interactionErrors.length||result.consoleErrors.length||result.pageErrors.length)failed=true;
  if(Number.isFinite(result.autoScrollDelta)&&Math.abs(result.autoScrollDelta)>8)failed=true;
  if(Number.isFinite(result.idleMutations2s)&&result.idleMutations2s>8)failed=true;
  if(result.scheduleState&&!result.scheduleState.scheduleVisible)failed=true;
  if(Number.isFinite(result.tabP95Ms)&&result.tabP95Ms>500)failed=true;
  if(result.dashboardRequestCount>1)failed=true;
  report.cases.push(result);await context.close();await writeReport();
}

await browser.close();await writeReport();console.log(JSON.stringify(report,null,2));if(failed)process.exitCode=1;