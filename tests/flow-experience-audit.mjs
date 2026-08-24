import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_EXPERIENCE_OUT||'flow-experience-audit';
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',location:'대구광역시',type:'사립',address:'대구광역시 동구 반야월북로 199',phone:'053-000-0000',homepage:'https://jungdong.dge.hs.kr',highSchoolType:'일반고',highSchoolTrack:'일반계',coed:'남녀공학',dayNight:'주간'};
const UNIVERSITY={id:'knu',name:'경북대학교',englishName:'Kyungpook National University',kind:'대학교',division:'대학',foundation:'국립',campus:'본교',region:'대구',address:'대구광역시 북구 대학로 80',phone:'053-950-5114',homepage:'https://www.knu.ac.kr'};

await mkdir(OUT,{recursive:true});
const source=await readFile('flow-experience.js','utf8'),css=await readFile('flow-experience.css','utf8');
if(source.includes('MutationObserver'))throw new Error('Flow experience must stay event-driven; MutationObserver found');
if(!source.includes('flow-haptics-v1')||!source.includes('flow-ambient-v1'))throw new Error('Flow experience preference keys missing');
if(css.includes('container-type')||css.includes('@container'))throw new Error('Experience CSS must not establish containment around direct-manipulation widgets');
if(!css.includes('repeat(auto-fit'))throw new Error('Intrinsic auto-fit adaptation is missing');
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};

const ymd=(date=new Date())=>`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function schoolDashboard(){const selected=ymd();return{school:SCHOOL,selected,from:selected,to:selected,timetable:[{date:selected,period:1,subject:'문학',grade:'2',className:'6'},{date:selected,period:2,subject:'미적분',grade:'2',className:'6'}],meals:[{date:selected,type:'중식',dishes:['현미밥','닭갈비'],calories:'720 Kcal',nutrition:'',origin:''}],events:[{date:selected,name:'Flow 감각 검수',content:'fixture',grade1:'N',grade2:'Y',grade3:'N',holidayType:''}],scheduleMeta:{mode:'fixture',count:1}}}
function timetable(){const today=(new Date().getDay()+6)%7;return{source:'experience-fixture',year:2026,semester:'2학기',subjects:[{id:'u1',name:'자료구조',professor:'김교수',credit:3,place:'IT대학 1호관',times:[{day:today,start:'09:00',end:'10:15',startMinutes:540,endMinutes:615,place:'IT대학 1호관'}]},{id:'u2',name:'운영체제',professor:'박교수',credit:3,place:'공대9호관',times:[{day:Math.min(4,today+1),start:'11:00',end:'12:15',startMinutes:660,endMinutes:735,place:'공대9호관'}]}]}}
async function installHaptics(page){await page.addInitScript(()=>{window.__flowHaptics=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{window.__flowHaptics.push(pattern);return true}})})}
function watch(page){const consoleErrors=[],pageErrors=[],failedRequests=[];page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});page.on('pageerror',e=>pageErrors.push(String(e)));page.on('requestfailed',r=>{if(!/fonts\.googleapis|fonts\.gstatic/.test(r.url()))failedRequests.push({url:r.url(),error:r.failure()?.errorText||''})});return{consoleErrors,pageErrors,failedRequests}}
function clean(label,errors){if(errors.consoleErrors.length||errors.pageErrors.length||errors.failedRequests.length)throw new Error(`${label} browser errors: ${JSON.stringify(errors)}`)}
async function schoolRoutes(page,counter){
  await page.route('**/functions/v1/school-data**',async route=>{const u=new URL(route.request().url()),action=u.searchParams.get('action')||'';if(action==='dashboard'){counter.count++;return json(route,schoolDashboard())}if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});if(action==='place')return json(route,{provider:'kakao',place:{id:'fixture',name:SCHOOL.name,url:'https://place.map.kakao.com/fixture',address:SCHOOL.address,roadAddress:SCHOOL.address,x:'128.687',y:'35.875'}});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
}
async function universityRoutes(page){
  await page.route('**/functions/v1/university-data**',async route=>{const u=new URL(route.request().url()),action=u.searchParams.get('action')||'';if(action==='profile')return json(route,{school:UNIVERSITY,metrics:{tuition:{year:'2025',value:4500000},scholarship:{year:'2025',value:2900000}},partial:false,unavailable:[]});if(action==='majors')return json(route,{surveyYear:'2025',total:1,majors:[]});if(action==='search')return json(route,{surveyYear:'2025',total:1,schools:[UNIVERSITY]});return json(route,{})});
  await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
}
async function experienceState(page){return page.evaluate(()=>{const root=document.documentElement,style=getComputedStyle(root),main=document.querySelector('.product-main,.main');return{ready:root.dataset.flowExperience||'',ambient:root.dataset.flowAmbient||'',phase:root.dataset.flowAmbientPhase||'',ambientA:style.getPropertyValue('--flow-ambient-a').trim(),containerType:main?getComputedStyle(main).containerType:'',experienceCss:[...document.styleSheets].some(s=>{try{return new URL(s.href,location.href).pathname==='/flow-experience.css'}catch{return false}})}})}

async function runSchool({reducedMotion='no-preference'}={}){
  const label=`school-${reducedMotion}`;const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',reducedMotion});const page=await context.newPage();page.setDefaultTimeout(9000);const errors=watch(page),counter={count:0};await installHaptics(page);await schoolRoutes(page,counter);
  try{
    await page.addInitScript(({school})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light')},{school:SCHOOL});
    await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowExperience==='ready');
    const state=await experienceState(page);if(state.ready!=='ready'||state.ambient!=='on'||!state.phase||!state.ambientA||!state.experienceCss||state.containerType!=='normal')throw new Error(`${label} experience bootstrap invalid: ${JSON.stringify(state)}`);
    if(reducedMotion==='reduce'){
      const animation=await page.locator('.status-grid').evaluate(node=>getComputedStyle(node).animationName);if(animation!=='none')throw new Error(`${label} content settle motion not reduced: ${animation}`);await page.screenshot({path:`${OUT}/${label}.png`,fullPage:false});clean(label,errors);return{label,state,reducedAnimation:animation,errors}
    }
    await page.locator('#datePicker').evaluate(input=>{input.value='2026-08-24';window.__flowDateChanges=0;input.addEventListener('change',()=>{window.__flowDateChanges++},{capture:true})});counter.count=0;await page.evaluate(()=>{window.__flowHaptics=[]});
    const dial=page.locator('.date-label'),box=await dial.boundingBox();if(!box)throw new Error('School date dial missing');const x=box.x+box.width/2,y=box.y+box.height/2;
    await dial.dispatchEvent('pointerdown',{pointerId:71,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons:1,bubbles:true,cancelable:true});
    await dial.dispatchEvent('pointermove',{pointerId:71,pointerType:'touch',isPrimary:true,clientX:x+76,clientY:y,button:0,buttons:1,bubbles:true,cancelable:true});
    const during=await page.evaluate(()=>({date:document.querySelector('#datePicker')?.value||'',changes:window.__flowDateChanges||0}));if(during.date!=='2026-08-24'||during.changes!==0||counter.count!==0)throw new Error(`${label} tactile date dial committed during drag: ${JSON.stringify({during,dashboardRequests:counter.count})}`);
    await dial.dispatchEvent('pointerup',{pointerId:71,pointerType:'touch',isPrimary:true,clientX:x+76,clientY:y,button:0,buttons:0,bubbles:true,cancelable:true});
    await page.waitForTimeout(180);const finalState=await page.evaluate(()=>({date:document.querySelector('#datePicker')?.value||'',changes:window.__flowDateChanges||0,haptics:window.__flowHaptics.slice()}));if(finalState.date!=='2026-08-26')throw new Error(`${label} tactile date dial expected 2026-08-26, got ${finalState.date}`);if(finalState.changes!==1)throw new Error(`${label} tactile date dial emitted ${finalState.changes} change events; expected exactly 1 final commit`);if(counter.count>1)throw new Error(`${label} tactile date dial caused ${counter.count} dashboard requests; expected at most 1 after release`);if(finalState.haptics.length<2)throw new Error(`${label} tactile dial haptics missing: ${JSON.stringify(finalState.haptics)}`);
    await page.locator('#mobileSettingsBtn:visible').tap();await page.locator('#flowSchoolSettingsView:not(.hidden)').waitFor();const card=page.locator('.flow-experience-settings');await card.waitFor();const ambient=card.locator('[data-flow-experience-toggle="ambient"]');if(await ambient.getAttribute('aria-pressed')!=='true')throw new Error(`${label} ambient preference did not default on`);await ambient.tap();if(await page.locator('html').getAttribute('data-flow-ambient')!=='off')throw new Error(`${label} ambient preference did not disable`);await ambient.tap();if(await page.locator('html').getAttribute('data-flow-ambient')!=='on')throw new Error(`${label} ambient preference did not restore`);
    await page.screenshot({path:`${OUT}/${label}.png`,fullPage:false});clean(label,errors);return{label,state,dateValue:finalState.date,dateChanges:finalState.changes,dashboardRequests:counter.count,haptics:finalState.haptics,errors}
  }finally{await context.close()}
}

async function runUniversity(){
  const label='university-touch';const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});const page=await context.newPage();page.setDefaultTimeout(9000);const errors=watch(page);await installHaptics(page);await universityRoutes(page);
  try{
    await page.addInitScript(({university,tt})=>{localStorage.clear();localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));localStorage.setItem('flow-university-timetable-v1',JSON.stringify(tt));localStorage.setItem('flow-university-theme-v1','light')},{university:UNIVERSITY,tt:timetable()});
    await page.goto(new URL('/university/',BASE).href,{waitUntil:'domcontentloaded'});await page.locator('#appView:not(.hidden)').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowExperience==='ready');const state=await experienceState(page);if(state.ambient!=='on'||!state.experienceCss||state.containerType!=='normal')throw new Error(`${label} experience bootstrap invalid: ${JSON.stringify(state)}`);
    await page.evaluate(()=>{window.__flowHaptics=[]});await page.locator('.bottom-item[data-view="timetable"]:visible').tap();await page.locator('#timetableView:not(.hidden)').waitFor();const haptics=await page.evaluate(()=>window.__flowHaptics.slice());if(!haptics.length)throw new Error(`${label} navigation selection haptic missing`);
    await page.locator('.flow-mobile-settings:visible').tap();await page.locator('#flowUniversitySettingsView:not(.hidden)').waitFor();if(await page.locator('.flow-experience-settings').count()!==1)throw new Error(`${label} sensory settings card missing`);
    await page.screenshot({path:`${OUT}/${label}.png`,fullPage:false});clean(label,errors);return{label,state,haptics,errors}
  }finally{await context.close()}
}

for(const run of [()=>runSchool(),()=>runSchool({reducedMotion:'reduce'}),runUniversity]){try{report.cases.push(await run())}catch(error){report.failures.push(String(error?.stack||error));break}}
await browser.close();await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
if(report.failures.length){console.error(report.failures.join('\n'));process.exit(1)}
console.log(JSON.stringify(report,null,2));
