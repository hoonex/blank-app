import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_BASE||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_ADMIN_VISUAL_OUT||'admin-audit-artifacts/console-matrix';
const viewports=[
  ['mobile-portrait',390,844,true],
  ['mobile-landscape',844,390,true],
  ['tablet-portrait',768,1024,true],
  ['tablet-landscape',1024,768,true],
  ['desktop-1366',1366,768,false],
  ['desktop-1920',1920,1080,false],
];

const inventory=[
  {name:'NEIS 교육정보 API',group:'Runtime',type:'Public data API',via:'school-data',purpose:'학교정보 · 반 · 시간표 · 급식 · 학사일정',state:'configured'},
  {name:'Kakao REST APIs',group:'Runtime',type:'REST API',via:'school-data · university-campus',purpose:'주소 · 장소 · 이미지 · 경로',state:'configured'},
  {name:'대학 공시 공공데이터 API',group:'Runtime',type:'Public data API',via:'university-data',purpose:'대학 · 학과 · 등록금 · 교육여건',state:'configured'},
  {name:'Everytime 공개 시간표',group:'Runtime',type:'External API',via:'university-data',purpose:'공개 공유 시간표 import',state:'configured'},
  {name:'Supabase Auth',group:'Infrastructure',type:'Auth',via:'Flow accounts · Admin',purpose:'사용자/관리자 인증과 세션',state:'healthy'},
  {name:'Supabase Postgres / PostgREST',group:'Infrastructure',type:'Database API',via:'Flow backend',purpose:'프로필 · 이벤트 · 관리자 집계 · 설정',state:'healthy'},
  {name:'Supabase Edge Functions',group:'Infrastructure',type:'Serverless',via:'8 active functions',purpose:'Flow 서버리스 실행 계층',state:'healthy'},
  {name:'GitHub Actions',group:'Operations',type:'CI/CD',via:'.github/workflows',purpose:'브라우저 회귀 테스트 · 검증 · 배포 작업',state:'connected'},
  {name:'Google Fonts',group:'External',type:'CDN',via:'Flow UI',purpose:'Inter · Noto Sans KR 웹폰트',state:'connected'},
];
const overview={
  generatedAt:'2026-08-25T11:30:00Z',windowHours:24,
  activity:{
    totalEvents:284,uniqueAnonymous:61,registeredProfiles:18,
    sources:[{source:'school',count:166},{source:'university',count:102},{source:'quest',count:16}],
    topEvents:[{name:'school_page_view',count:118},{name:'university_tab_view',count:76},{name:'school_widget_open',count:41}],
    hourly:Array.from({length:12},(_,i)=>({hour:`2026-08-25T${String(i+1).padStart(2,'0')}:00:00Z`,count:[8,14,11,18,23,16,28,31,25,38,42,30][i]})),
  },
  inventory,
  probes:[
    {checkedAt:'2026-08-25T11:29:00Z',service:'school-data',action:'search',status:200,durationMs:82,ok:true},
    {checkedAt:'2026-08-25T11:29:00Z',service:'university-data',action:'search',status:200,durationMs:131,ok:true},
    {checkedAt:'2026-08-25T11:29:00Z',service:'university-campus',action:'campus',status:200,durationMs:226,ok:true},
  ],
};

await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={cases:[],failures:[]};

function assert(condition,message){if(!condition)throw new Error(message)}

for(const [name,width,height,touch] of viewports){
  const context=await browser.newContext({viewport:{width,height},locale:'ko-KR',timezoneId:'Asia/Seoul',hasTouch:touch,isMobile:width<=520});
  const page=await context.newPage();
  const consoleErrors=[];const pageErrors=[];
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
  page.on('pageerror',error=>pageErrors.push(error.message));
  try{
    await context.route('https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-admin**',async route=>{
      const url=new URL(route.request().url());
      const action=url.searchParams.get('action')||'overview';
      if(action==='login')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'visual-token',refresh_token:'visual-refresh',expires_in:3600,user:{id:'admin-id',email:'owner@example.com'},admin:{loginName:'flowadmin'}})});
      const auth=route.request().headers().authorization||'';
      if(auth!=='Bearer visual-token')throw new Error(`${name}: unexpected authorization ${auth}`);
      if(action==='probe')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[],overview})});
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({admin:{id:'admin-id',loginName:'flowadmin'},overview})});
    });

    await page.goto(`${BASE}/admin`,{waitUntil:'domcontentloaded'});
    await page.locator('#loginPanel:not(.hidden)').waitFor();
    await page.screenshot({path:`${OUT}/${name}-login.png`,fullPage:false,animations:'disabled'});
    await page.locator('#usernameInput').fill('flowadmin');
    await page.locator('#passwordInput').fill('visual-password');
    await page.locator('#passwordForm button[type="submit"]').click();
    await page.locator('#dashboard:not(.hidden)').waitFor({timeout:8000});

    assert(await page.locator('.architecture-stage').count()===4,`${name}: architecture must contain four layers`);
    const mapText=(await page.locator('#architecture').innerText()).replace(/\s+/g,' ');
    for(const required of ['Flow School','Flow University','Flow Admin','Supabase Auth','NEIS','Kakao','GitHub Actions','Cloudflare'])assert(mapText.includes(required),`${name}: structure map missing ${required}`);

    const geometry=await page.evaluate(()=>{
      const root=document.documentElement;
      const architecture=document.querySelector('#architecture')?.getBoundingClientRect();
      const targets=[...document.querySelectorAll('.section-nav a,.dashboard-actions button,.dashboard-actions select,#signOutBtn')].filter(node=>{
        const r=node.getBoundingClientRect(),s=getComputedStyle(node);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1;
      }).map(node=>({label:(node.textContent||node.getAttribute('aria-label')||node.tagName).trim(),width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height}));
      return{overflow:root.scrollWidth-root.clientWidth,architecture:architecture?{left:architecture.left,right:architecture.right,width:architecture.width}:null,targets};
    });
    assert(geometry.overflow<=2,`${name}: horizontal overflow ${geometry.overflow}px`);
    assert(geometry.architecture&&geometry.architecture.left>=-1&&geometry.architecture.right<=width+1,`${name}: architecture panel leaves viewport ${JSON.stringify(geometry.architecture)}`);
    for(const target of geometry.targets)assert(target.height>=43.5,`${name}: undersized target ${target.label} ${target.width.toFixed(1)}x${target.height.toFixed(1)}`);

    await page.screenshot({path:`${OUT}/${name}-dashboard.png`,fullPage:false,animations:'disabled'});
    await page.locator('#architecture').screenshot({path:`${OUT}/${name}-architecture.png`,animations:'disabled'});
    await page.screenshot({path:`${OUT}/${name}-full.png`,fullPage:true,animations:'disabled'});
    assert(consoleErrors.length===0,`${name}: console errors ${JSON.stringify(consoleErrors)}`);
    assert(pageErrors.length===0,`${name}: page errors ${JSON.stringify(pageErrors)}`);
    report.cases.push({name,viewport:{width,height},overflow:geometry.overflow,targets:geometry.targets,consoleErrors,pageErrors});
  }catch(error){
    report.failures.push(`${name}: ${error.message}`);
  }finally{
    await context.close();
  }
}

await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(report.failures.length){console.error(JSON.stringify(report,null,2));process.exit(1)}
console.log(JSON.stringify(report,null,2));
