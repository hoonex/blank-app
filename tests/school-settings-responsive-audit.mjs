import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-settings-responsive-audit';
const CASES=[
  {name:'phone-360',viewport:{width:360,height:800},isMobile:true,hasTouch:true},
  {name:'phone-390',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'phone-412',viewport:{width:412,height:915},isMobile:true,hasTouch:true},
  {name:'phone-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:false,hasTouch:true},
  {name:'wide-portrait',viewport:{width:960,height:1536},isMobile:false,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:false,hasTouch:true},
  {name:'compact-1180',viewport:{width:1180,height:820},isMobile:false,hasTouch:true},
  {name:'desktop-1280',viewport:{width:1280,height:800},isMobile:false,hasTouch:false},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',location:'대구광역시',type:'사립',address:'대구광역시 동구 반야월북로 199',phone:'053-000-0000',homepage:'https://jungdong.dge.hs.kr',highSchoolType:'일반고',highSchoolTrack:'일반계',coed:'남녀공학',dayNight:'주간'};

const pad=n=>String(n).padStart(2,'0');
const ymd=(d=new Date())=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)});
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
const rect=r=>r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null;

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};

for(const c of CASES){
  const context=await browser.newContext({viewport:c.viewport,isMobile:c.isMobile,hasTouch:c.hasTouch,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();
  page.setDefaultTimeout(12000);
  const consoleErrors=[],pageErrors=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));
  try{
    await fixtures(page);
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('#dashboard:not(.hidden)').waitFor();
    await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSpacingSystem==='v1');
    const trigger=page.locator('#settingsBtn:visible,#mobileSettingsBtn:visible').first();
    await trigger.waitFor();
    await trigger.click();
    const panel=page.locator('#flowSchoolSettingsView:not(.hidden)');
    await panel.waitFor();
    await page.waitForTimeout(120);

    const first=await page.evaluate(()=>{
      const panel=document.querySelector('#flowSchoolSettingsView');
      const stack=panel?.querySelector('.flow-settings-stack');
      const header=panel?.querySelector('.flow-settings-header');
      const cards=[...(stack?.querySelectorAll(':scope > .flow-settings-card')||[])];
      const save=stack?.querySelector(':scope > .flow-settings-save');
      const nav=document.querySelector('#bottomNav.mobile-bottom-nav');
      const topbar=document.querySelector('.mobile-topbar');
      const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
      const R=e=>{const r=e?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null};
      const style=stack?getComputedStyle(stack):null;
      const children=[...(stack?.children||[])].filter(visible);
      return{
        panel:R(panel),stack:R(stack),header:R(header),cards:cards.map(R),save:R(save),children:children.map(R),
        columns:style?.gridTemplateColumns?.split(' ').filter(Boolean).length||0,
        columnTemplate:style?.gridTemplateColumns||'',gap:parseFloat(style?.gap||'0'),
        navVisible:visible(nav),nav:R(nav),topbarVisible:visible(topbar),topbar:R(topbar),
        panelScrollTop:panel?.scrollTop||0,panelScrollHeight:panel?.scrollHeight||0,panelClientHeight:panel?.clientHeight||0,
        clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
      };
    });
    if(!first.panel||!first.stack||!first.header||!first.save||first.cards.length<5)throw new Error(`${c.name}: settings geometry missing ${JSON.stringify(first)}`);
    if(first.scrollWidth>first.clientWidth+2)throw new Error(`${c.name}: horizontal overflow ${JSON.stringify(first)}`);
    if(first.header.top<0||first.header.left<0||first.stack.left<0||first.stack.right>c.viewport.width+2)throw new Error(`${c.name}: settings escaped viewport ${JSON.stringify(first)}`);
    const expectedColumns=c.viewport.width<640?1:c.viewport.width<1100?2:6;
    if(first.columns!==expectedColumns)throw new Error(`${c.name}: expected ${expectedColumns} settings columns, got ${first.columns} ${JSON.stringify(first)}`);
    for(const card of first.cards){if(card.left<first.stack.left-2||card.right>first.stack.right+2||card.width<140)throw new Error(`${c.name}: card clipped or undersized ${JSON.stringify({card,stack:first.stack})}`)}
    if(c.viewport.width<1181&&!first.navVisible)throw new Error(`${c.name}: compact settings lost bottom navigation`);
    if(c.viewport.width>=1181&&first.navVisible)throw new Error(`${c.name}: desktop settings leaked compact navigation`);
    await page.screenshot({path:`${OUT}/${c.name}-settings-top.png`,fullPage:false,animations:'disabled'});

    await page.evaluate(()=>{
      const panel=document.querySelector('#flowSchoolSettingsView');
      if(panel)panel.scrollTop=panel.scrollHeight;
      window.scrollTo(0,document.documentElement.scrollHeight);
    });
    await page.waitForTimeout(80);
    const bottom=await page.evaluate(()=>{
      const panel=document.querySelector('#flowSchoolSettingsView');
      const stack=panel?.querySelector('.flow-settings-stack');
      const nav=document.querySelector('#bottomNav.mobile-bottom-nav');
      const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
      const R=e=>{const r=e?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null};
      const visual=[...(stack?.children||[])].filter(visible).map(R);
      return{
        navVisible:visible(nav),nav:R(nav),visual,
        visualBottom:Math.max(0,...visual.map(r=>r.bottom)),
        panelScrollTop:panel?.scrollTop||0,panelScrollHeight:panel?.scrollHeight||0,panelClientHeight:panel?.clientHeight||0,
        viewportHeight:innerHeight,windowY:scrollY,documentHeight:document.documentElement.scrollHeight,
      };
    });
    const ceiling=bottom.navVisible&&bottom.nav?bottom.nav.top-8:bottom.viewportHeight-8;
    if(bottom.visualBottom>ceiling+2)throw new Error(`${c.name}: settings bottom remains hidden behind chrome ${JSON.stringify(bottom)}`);
    await page.screenshot({path:`${OUT}/${c.name}-settings-bottom.png`,fullPage:false,animations:'disabled'});

    if(consoleErrors.length||pageErrors.length)throw new Error(`${c.name}: browser errors ${JSON.stringify({consoleErrors,pageErrors})}`);
    report.cases.push({name:c.name,viewport:c.viewport,first,bottom});
    console.log(`${c.name}: PASS`);
  }catch(error){
    report.failures.push({name:c.name,message:error?.stack||String(error)});
    console.error(`${c.name}: FAIL\n${error?.stack||error}`);
  }finally{await context.close()}
}

await browser.close();
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
if(report.failures.length)throw new Error(`School settings responsive audit found ${report.failures.length} failure(s)`);
