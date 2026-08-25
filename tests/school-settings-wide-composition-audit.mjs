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
const SCHOOL={
  officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',
  kind:'고등학교',location:'대구광역시',type:'사립',address:'대구광역시 동구 반야월북로 199',phone:'053-000-0000',
  homepage:'https://jungdong.dge.hs.kr',highSchoolType:'일반고',highSchoolTrack:'일반계',coed:'남녀공학',dayNight:'주간',
};

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={cases:[],failures:[]};

function ymd(d=new Date()){return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function dashboard(){const selected=ymd();return{school:SCHOOL,selected,from:selected,to:selected,timetable:[],meals:[],events:[],scheduleMeta:{mode:'fixture',count:0}}}
async function fixtures(page){
  await page.route('**/functions/v1/school-data**',async route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='dashboard')return json(route,dashboard());
    if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});
    if(action==='place')return json(route,{provider:'kakao',place:null});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({school})=>{
    localStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
  },{school:SCHOOL});
}

for(const c of CASES){
  const context=await browser.newContext({viewport:c.viewport,isMobile:c.mobile,hasTouch:c.touch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();
  const consoleErrors=[],pageErrors=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));
  try{
    await fixtures(page);
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('#dashboard:not(.hidden)').waitFor({timeout:10000});
    const trigger=page.locator('#settingsBtn:visible,#mobileSettingsBtn:visible').first();
    await trigger.waitFor({timeout:10000});
    await trigger.click();
    await page.locator('#flowSchoolSettingsView:not(.hidden)').waitFor({timeout:8000});
    await page.waitForTimeout(120);
    const state=await page.evaluate(()=>{
      const panel=document.querySelector('#flowSchoolSettingsView');
      const stack=panel?.querySelector('.flow-settings-stack');
      const cards=[...(stack?.querySelectorAll(':scope > .flow-settings-card')||[])];
      const save=stack?.querySelector(':scope > .flow-settings-save');
      const rect=el=>{const r=el?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null};
      const style=stack?getComputedStyle(stack):null;
      const wideStyleLoaded=[...document.styleSheets].some(s=>{try{return new URL(s.href||'',location.href).pathname==='/school-settings-wide.css'}catch{return false}});
      return{
        panel:rect(panel),stack:rect(stack),cards:cards.map(rect),save:rect(save),gridTemplateColumns:style?.gridTemplateColumns||'',wideStyleLoaded,
        width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
      };
    });
    if(!state.wideStyleLoaded)throw new Error(`${c.name}: School wide settings stylesheet was not loaded`);
    if(state.scrollWidth>state.width+2)throw new Error(`${c.name}: horizontal overflow ${JSON.stringify(state)}`);
    if(!state.panel||!state.stack||!state.save||state.cards.length!==5)throw new Error(`${c.name}: settings geometry missing ${JSON.stringify(state)}`);
    const columnCount=state.gridTemplateColumns.split(' ').filter(Boolean).length;
    const same=(x,y,t=2)=>Math.abs(x-y)<=t;
    if(c.viewport.width>=1100){
      if(columnCount!==6)throw new Error(`${c.name}: wide School settings did not become six grid tracks ${JSON.stringify(state)}`);
      if(state.stack.width<state.panel.width*.9)throw new Error(`${c.name}: School settings still leaves a large unused canvas ${JSON.stringify(state)}`);
      const [screen,bell,meal,glass,install]=state.cards;
      if(!same(screen.top,bell.top)||meal.top<=screen.top+2||!same(meal.top,glass.top)||!same(meal.top,install.top))throw new Error(`${c.name}: School settings rows are not 2 + 3 ${JSON.stringify(state)}`);
      if(!same(screen.width,bell.width,3))throw new Error(`${c.name}: first School settings row is unbalanced ${JSON.stringify(state)}`);
      if(!same(meal.width,glass.width,3)||!same(glass.width,install.width,3))throw new Error(`${c.name}: second School settings row is unbalanced ${JSON.stringify(state)}`);
      if(!(screen.left<bell.left&&meal.left<glass.left&&glass.left<install.left))throw new Error(`${c.name}: School settings column order is wrong ${JSON.stringify(state)}`);
      if(!same(state.save.left,state.stack.left,3)||!same(state.save.right,state.stack.right,3)||state.save.top<=meal.top+2)throw new Error(`${c.name}: save action does not span the wide grid ${JSON.stringify(state)}`);
    }else if(columnCount!==1){
      throw new Error(`${c.name}: School tablet/mobile settings should remain a single column ${JSON.stringify(state)}`);
    }
    if(consoleErrors.length||pageErrors.length)throw new Error(`${c.name}: browser errors ${JSON.stringify({consoleErrors,pageErrors})}`);
    await page.screenshot({path:`${OUT}/${c.name}-school-settings.png`,fullPage:false,animations:'disabled'});
    report.cases.push({name:c.name,...state});
    console.log(`school ${c.name}: PASS`);
  }catch(error){
    report.failures.push({name:c.name,message:error?.stack||String(error)});
    console.error(`school ${c.name}: FAIL\n${error?.stack||error}`);
  }finally{await context.close()}
}

await browser.close();
await writeFile(`${OUT}/school-report.json`,JSON.stringify(report,null,2));
if(report.failures.length)throw new Error(`School settings wide composition audit found ${report.failures.length} failure(s)`);
