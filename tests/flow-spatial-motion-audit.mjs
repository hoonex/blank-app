import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_SPATIAL_OUT||'flow-spatial-motion-audit';
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',location:'대구광역시',type:'사립',address:'대구광역시 동구 반야월북로 199',phone:'053-000-0000',homepage:'https://jungdong.dge.hs.kr',highSchoolType:'일반고',highSchoolTrack:'일반계',coed:'남녀공학',dayNight:'주간'};

await mkdir(OUT,{recursive:true});
const source=await readFile('flow-experience.js','utf8');
const css=await readFile('flow-experience.css','utf8');
if(source.includes('MutationObserver'))throw new Error('Spatial motion must stay event-driven');
for(const token of ['flow-motion-v1','MAGNET_SELECTOR','flowNavField','flow-motion-demo','DeviceOrientationEvent'])if(!source.includes(token))throw new Error(`Spatial motion source token missing: ${token}`);
for(const token of ['--flow-spring-out:cubic-bezier(.16,1,.3,1)','data-flow-nav-field="ready"','.flow-motion-demo','html[data-flow-motion="on"] .flow-magnetic','prefers-reduced-motion:reduce'])if(!css.includes(token))throw new Error(`Spatial motion CSS token missing: ${token}`);

const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};
const ymd=(date=new Date())=>`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function dashboard(){const selected=ymd();return{school:SCHOOL,selected,from:selected,to:selected,timetable:[{date:selected,period:1,subject:'문학',grade:'2',className:'6'},{date:selected,period:2,subject:'미적분',grade:'2',className:'6'}],meals:[{date:selected,type:'중식',dishes:['현미밥','닭갈비'],calories:'720 Kcal',nutrition:'',origin:''}],events:[{date:selected,name:'Spatial Motion 검수',content:'fixture',grade1:'N',grade2:'Y',grade3:'N',holidayType:''}],scheduleMeta:{mode:'fixture',count:1}}}
async function routes(page){
  await page.route('**/functions/v1/school-data**',async route=>{const u=new URL(route.request().url()),action=u.searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard());if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});if(action==='place')return json(route,{provider:'kakao',place:{id:'fixture',name:SCHOOL.name,url:'https://place.map.kakao.com/fixture',address:SCHOOL.address,roadAddress:SCHOOL.address,x:'128.687',y:'35.875'}});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
}
function watch(page){const consoleErrors=[],pageErrors=[],failedRequests=[];page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});page.on('pageerror',e=>pageErrors.push(String(e)));page.on('requestfailed',r=>{if(!/fonts\.googleapis|fonts\.gstatic/.test(r.url()))failedRequests.push({url:r.url(),error:r.failure()?.errorText||''})});return{consoleErrors,pageErrors,failedRequests}}
function clean(label,errors){if(errors.consoleErrors.length||errors.pageErrors.length||errors.failedRequests.length)throw new Error(`${label} browser errors: ${JSON.stringify(errors)}`)}
async function boot(reducedMotion='no-preference'){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',reducedMotion});
  const page=await context.newPage();page.setDefaultTimeout(9000);const errors=watch(page);await routes(page);
  await page.addInitScript(({school})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');window.__flowHaptics=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{window.__flowHaptics.push(pattern);return true}})},{school:SCHOOL});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowExperience==='ready');return{context,page,errors}
}

async function runMotion(){
  const label='school-spatial-motion';const {context,page,errors}=await boot();
  try{
    const root=page.locator('html');if(await root.getAttribute('data-flow-motion')!=='on')throw new Error('Spatial motion did not default on');if(await root.getAttribute('data-flow-haptics-supported')!=='true')throw new Error('Haptic capability was not detected');
    const nav=page.locator('#bottomNav');await page.waitForFunction(()=>document.querySelector('#bottomNav')?.dataset.flowNavField==='ready');
    const navMaterial=await nav.evaluate(node=>{const style=getComputedStyle(node),pseudo=getComputedStyle(node,'::before');return{width:parseFloat(style.getPropertyValue('--flow-nav-w'))||0,x:parseFloat(style.getPropertyValue('--flow-nav-x'))||0,content:pseudo.content,display:pseudo.display,position:pseudo.position}});
    if(navMaterial.width<40||navMaterial.content==='none'||navMaterial.display==='none'||navMaterial.position!=='absolute')throw new Error(`Navigation pseudo material invalid: ${JSON.stringify(navMaterial)}`);
    const navChildren=await nav.locator(':scope > *').evaluateAll(nodes=>nodes.map(node=>node.textContent?.trim()||''));if(navChildren.join('|')!=='오늘|일정|학교|설정')throw new Error(`Navigation material polluted destination DOM: ${JSON.stringify(navChildren)}`);

    const tab=page.locator('.mobile-tab[data-view="schedule"]:visible'),box=await tab.boundingBox();if(!box)throw new Error('Schedule tab missing');const px=box.x+box.width*.82,py=box.y+box.height*.45;
    await tab.dispatchEvent('pointerdown',{pointerId:91,pointerType:'touch',isPrimary:true,clientX:px,clientY:py,button:0,buttons:1,bubbles:true,cancelable:true});await page.waitForTimeout(90);
    const during=await tab.evaluate(node=>({x:parseFloat(node.style.getPropertyValue('--flow-magnet-x'))||0,y:parseFloat(node.style.getPropertyValue('--flow-magnet-y'))||0,pressing:node.classList.contains('flow-pressing')}));
    if(!during.pressing||during.x<.35)throw new Error(`Magnetic attraction did not engage: ${JSON.stringify(during)}`);
    await tab.dispatchEvent('pointerup',{pointerId:91,pointerType:'touch',isPrimary:true,clientX:px,clientY:py,button:0,buttons:0,bubbles:true,cancelable:true});await page.waitForTimeout(180);
    const release=await tab.evaluate(node=>({x:Math.abs(parseFloat(node.style.getPropertyValue('--flow-magnet-x'))||0),pressing:node.classList.contains('flow-pressing')}));
    if(release.pressing||release.x>=Math.abs(during.x))throw new Error(`Magnetic release did not decay toward rest: ${JSON.stringify({during,release})}`);

    const navBox=await nav.boundingBox();if(!navBox)throw new Error('Bottom nav geometry missing');const fieldStart=parseFloat(await nav.evaluate(node=>getComputedStyle(node).getPropertyValue('--flow-nav-x')))||0;
    const today=page.locator('.mobile-tab[data-view="today"]:visible'),todayBox=await today.boundingBox();if(!todayBox)throw new Error('Today tab missing');
    await today.dispatchEvent('pointerdown',{pointerId:92,pointerType:'touch',isPrimary:true,clientX:todayBox.x+todayBox.width/2,clientY:todayBox.y+todayBox.height/2,button:0,buttons:1,bubbles:true,cancelable:true});
    await nav.dispatchEvent('pointermove',{pointerId:92,pointerType:'touch',isPrimary:true,clientX:navBox.x+navBox.width*.78,clientY:navBox.y+navBox.height/2,button:0,buttons:1,bubbles:true,cancelable:true});await page.waitForTimeout(40);
    const fieldDragged=parseFloat(await nav.evaluate(node=>getComputedStyle(node).getPropertyValue('--flow-nav-x')))||0;if(Math.abs(fieldDragged-fieldStart)<45)throw new Error(`Navigation field did not follow drag: ${JSON.stringify({fieldStart,fieldDragged})}`);
    await today.dispatchEvent('pointerup',{pointerId:92,pointerType:'touch',isPrimary:true,clientX:navBox.x+navBox.width*.78,clientY:navBox.y+navBox.height/2,button:0,buttons:0,bubbles:true,cancelable:true});await page.waitForTimeout(230);

    await page.locator('#mobileSettingsBtn:visible').tap();await page.locator('#flowSchoolSettingsView:not(.hidden)').waitFor();const card=page.locator('.flow-experience-settings');await card.waitFor();
    const motion=card.locator('[data-flow-experience-toggle="motion"]');if(await motion.getAttribute('aria-pressed')!=='true')throw new Error('Motion preference UI is not on');
    const demo=card.locator('.flow-motion-demo'),orb=demo.locator('.flow-motion-orb'),demoBox=await demo.boundingBox();if(!demoBox)throw new Error('Motion playground missing');
    await demo.dispatchEvent('pointerdown',{pointerId:93,pointerType:'touch',isPrimary:true,clientX:demoBox.x+52,clientY:demoBox.y+demoBox.height/2,button:0,buttons:1,bubbles:true,cancelable:true});
    await demo.dispatchEvent('pointermove',{pointerId:93,pointerType:'touch',isPrimary:true,clientX:demoBox.x+94,clientY:demoBox.y+demoBox.height/2+8,button:0,buttons:1,bubbles:true,cancelable:true});
    const demoDuring=await orb.evaluate(node=>({x:parseFloat(node.style.getPropertyValue('--flow-demo-x'))||0,y:parseFloat(node.style.getPropertyValue('--flow-demo-y'))||0}));if(demoDuring.x<35)throw new Error(`Motion playground did not track drag: ${JSON.stringify(demoDuring)}`);
    await demo.dispatchEvent('pointerup',{pointerId:93,pointerType:'touch',isPrimary:true,clientX:demoBox.x+94,clientY:demoBox.y+demoBox.height/2+8,button:0,buttons:0,bubbles:true,cancelable:true});
    const demoRelease=await orb.evaluate(node=>node.style.getPropertyValue('--flow-demo-x'));if(demoRelease!=='0px')throw new Error(`Motion playground did not spring home: ${demoRelease}`);

    await motion.tap();if(await root.getAttribute('data-flow-motion')!=='off')throw new Error('Motion preference did not disable');await motion.tap();if(await root.getAttribute('data-flow-motion')!=='on')throw new Error('Motion preference did not restore');
    const haptic=card.locator('[data-flow-experience-toggle="haptics"]');if(await haptic.textContent()==='미지원'||await haptic.isDisabled())throw new Error('Supported haptics were incorrectly marked unavailable');
    await page.screenshot({path:`${OUT}/${label}.png`,fullPage:false});clean(label,errors);return{label,during,release,navMaterial,navChildren,fieldStart,fieldDragged,demoDuring,errors}
  }finally{await context.close()}
}

async function runReduced(){
  const label='school-reduced-motion';const {context,page,errors}=await boot('reduce');
  try{
    if(await page.locator('html').getAttribute('data-flow-motion')!=='reduced')throw new Error('Reduced-motion did not suppress spatial motion');const fieldDisplay=await page.locator('#bottomNav').evaluate(node=>getComputedStyle(node,'::before').display);if(fieldDisplay!=='none')throw new Error(`Navigation field remains visible in reduced motion: ${fieldDisplay}`);const animation=await page.locator('.status-grid').evaluate(node=>getComputedStyle(node).animationName);if(animation!=='none')throw new Error(`Content motion remains active in reduced motion: ${animation}`);clean(label,errors);return{label,fieldDisplay,animation,errors}
  }finally{await context.close()}
}

for(const run of [runMotion,runReduced]){try{report.cases.push(await run())}catch(error){report.failures.push(String(error?.stack||error));break}}
await browser.close();await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
if(report.failures.length){console.error(report.failures.join('\n'));process.exit(1)}
console.log(JSON.stringify(report,null,2));