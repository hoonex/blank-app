import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='settings-wide-composition-audit';
const CASES=[
  {name:'mobile-portrait',viewport:{width:390,height:844},mobile:true,touch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},mobile:true,touch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},mobile:true,touch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},mobile:true,touch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},mobile:false,touch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},mobile:false,touch:false},
];
const profile={id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80',englishName:'Kyungpook National University'};
const timetable={year:2026,semester:'2학기',subjects:[]};

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={cases:[],failures:[]};

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixtures(page){
  await page.route('**/functions/v1/university-data**',route=>json(route,{}));
  await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
  await page.addInitScript(({profile,timetable})=>{
    localStorage.clear();
    localStorage.setItem('flow-university-profile-v1',JSON.stringify(profile));
    localStorage.setItem('flow-university-timetable-v1',JSON.stringify(timetable));
    localStorage.setItem('flow-university-theme-v1','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
  },{profile,timetable});
}

for(const c of CASES){
  const context=await browser.newContext({viewport:c.viewport,isMobile:c.mobile,hasTouch:c.touch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();
  const consoleErrors=[],pageErrors=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));
  try{
    await fixtures(page);
    await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('#appView:not(.hidden)').waitFor({timeout:10000});
    const trigger=page.locator('.flow-university-settings-button:visible,.flow-mobile-settings:visible').first();
    await trigger.waitFor({timeout:10000});
    await trigger.click();
    await page.locator('#flowUniversitySettingsView:not(.hidden)').waitFor({timeout:8000});
    await page.waitForTimeout(100);
    const state=await page.evaluate(()=>{
      const panel=document.querySelector('#flowUniversitySettingsView');
      const stack=panel?.querySelector('.flow-settings-stack');
      const cards=[...(stack?.querySelectorAll(':scope > .flow-settings-card')||[])];
      const rect=el=>{const r=el?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null};
      const style=stack?getComputedStyle(stack):null;
      return{
        panel:rect(panel),stack:rect(stack),cards:cards.map(rect),gridTemplateColumns:style?.gridTemplateColumns||'',
        width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
      };
    });
    if(state.scrollWidth>state.width+2)throw new Error(`${c.name}: horizontal overflow ${JSON.stringify(state)}`);
    if(!state.panel||!state.stack||state.cards.length!==3)throw new Error(`${c.name}: settings geometry missing ${JSON.stringify(state)}`);
    const columnCount=state.gridTemplateColumns.split(' ').filter(Boolean).length;
    if(c.viewport.width>=1100){
      if(columnCount!==3)throw new Error(`${c.name}: wide settings did not become three columns ${JSON.stringify(state)}`);
      if(state.stack.width<state.panel.width*.9)throw new Error(`${c.name}: settings still leaves a large unused canvas ${JSON.stringify(state)}`);
      const tops=state.cards.map(x=>x.top),widths=state.cards.map(x=>x.width);
      if(Math.max(...tops)-Math.min(...tops)>2)throw new Error(`${c.name}: wide settings cards are not one aligned row ${JSON.stringify(state)}`);
      if(Math.max(...widths)-Math.min(...widths)>3)throw new Error(`${c.name}: wide settings columns are unbalanced ${JSON.stringify(state)}`);
    }else if(columnCount!==1){
      throw new Error(`${c.name}: tablet/mobile settings should remain a single column ${JSON.stringify(state)}`);
    }
    if(consoleErrors.length||pageErrors.length)throw new Error(`${c.name}: browser errors ${JSON.stringify({consoleErrors,pageErrors})}`);
    await page.screenshot({path:`${OUT}/${c.name}-university-settings.png`,fullPage:false,animations:'disabled'});
    report.cases.push({name:c.name,...state});
    console.log(`${c.name}: PASS`);
  }catch(error){
    report.failures.push({name:c.name,message:error?.stack||String(error)});
    console.error(`${c.name}: FAIL\n${error?.stack||error}`);
  }finally{await context.close()}
}

await browser.close();
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
if(report.failures.length)throw new Error(`Settings wide composition audit found ${report.failures.length} failure(s)`);
