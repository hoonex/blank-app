import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-home-cleanup-audit/mobile-v5';
await fs.mkdir(OUT,{recursive:true});
const pad=v=>String(v).padStart(2,'0');
const now=new Date(Date.now()+9*60*60*1000);
const selected=`${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}`;
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199'},grade:2,className:'6'};
const monthEvents={
  '202609':[
    {date:'20260902',name:'9월 전국연합학력평가',content:'1·2학년 전국연합학력평가',grade2:'Y'},
    {date:'20260909',name:'2학기 전국 영어듣기능력평가',content:'2학년 영어듣기능력평가',grade2:'Y'},
    {date:'20260915',name:'2학기 중간고사 1일차',content:'국어·수학',grade2:'Y'},
    {date:'20260916',name:'2학기 중간고사 2일차',content:'영어·과학',grade2:'Y'},
    {date:'20260917',name:'2학기 중간고사 3일차',content:'사회·정보',grade2:'Y'},
    {date:'20260923',name:'교과 수행평가',content:'수행평가 주간',grade2:'Y'},
  ],
  '202610':[{date:'20261020',name:'10월 전국연합학력평가',content:'경기도교육청 주관',grade2:'Y'}],
  '202611':[{date:'20261124',name:'2학기 기말고사',content:'2학년 기말고사',grade2:'Y'}],
  '202612':[{date:'20261215',name:'학업성취도평가',content:'2학년 학업성취도평가',grade2:'Y'}],
  '202701':[{date:'20270122',name:'겨울방학 평가',content:'방학 중 평가',grade2:'Y'}],
  '202702':[{date:'20270205',name:'학년말 평가',content:'2학년 학년말 평가',grade2:'Y'}],
};
function assert(value,message){if(!value)throw new Error(message)}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function dashboard(date=selected){const key=String(date).replace(/\D/g,'').slice(0,8)||selected,month=key.slice(0,6);return{school:profile.school,selected:key,from:key,to:key,timetable:Array.from({length:7},(_,i)=>({date:key,period:i+1,subject:['문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육','자율'][i]})),meals:[{date:key,type:'중식',dishes:['현미밥','된장국','제육볶음'],calories:'812 Kcal'}],events:monthEvents[month]||[],scheduleMeta:{mode:'fixture',count:(monthEvents[month]||[]).length}}}
async function fixture(page,{delaySurface=0}={}){
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  if(delaySurface)await page.route('**/school-uiux-v2.js*',async route=>{await new Promise(resolve=>setTimeout(resolve,delaySurface));await route.continue()});
  await page.route('**/functions/v1/school-data*',route=>{const url=new URL(route.request().url()),action=url.searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard(url.searchParams.get('date')||selected));if(action==='media')return json(route,{media:{}});if(action==='place')return json(route,{provider:'fixture',place:{id:'school',name:profile.school.name,address:profile.school.address}});return json(route,{})});
  await page.addInitScript(({profile})=>{
    localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard');localStorage.setItem('flow-school-transit-lab-v1','off');localStorage.setItem('flow-motion-v1','on');localStorage.setItem('flow-ambient-v1','off');localStorage.setItem('flow-haptics-v1','off');window.__flowVibes=[];try{Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{window.__flowVibes.push(pattern);return true}})}catch{}
  },{profile});return errors;
}
function dayDelta(a,b){const A=new Date(`${a}T12:00:00`),B=new Date(`${b}T12:00:00`);return Math.round((B-A)/86400000)}
async function dateState(page){return page.evaluate(()=>{const rail=document.querySelector('#flowTodayDateDock .flow-date-rail'),dock=document.querySelector('#flowTodayDateDock'),preview=rail?.querySelector('[data-preview]');return{picker:document.querySelector('#datePicker')?.value||'',x:parseFloat(rail?.style.getPropertyValue('--flow-date-x')||'0')||0,preview:preview?.dataset.iso||'',dragging:dock?.dataset.kineticDragging||'',snap:dock?.dataset.kineticSnap||'',kinetic:dock?.dataset.flowKinetic||'',days:rail?.querySelectorAll('.flow-date-day-v5').length||0}})}
async function examState(page){return page.evaluate(()=>{const deck=document.querySelector('#flowExamDeckV5'),stage=deck?.querySelector('.flow-exam-stage-v5'),sr=stage?.getBoundingClientRect();const cards=[...(stage?.querySelectorAll('.flow-exam-card-v5')||[])].map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node),visible=Math.max(0,Math.min(r.bottom,sr?.bottom||r.bottom)-Math.max(r.top,sr?.top||r.top));return{index:Number(node.dataset.examIndex),active:node.hasAttribute('data-active'),display:s.display,height:r.height,top:r.top,visible,opacity:Number(s.opacity||1),title:node.querySelector('h3')?.textContent||''}});return{scrollTop:deck?.scrollTop||0,height:deck?.getBoundingClientRect().height||0,cards}})}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
const page=await context.newPage(),errors=await fixture(page);
await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});
await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready'&&document.documentElement.dataset.flowSchoolMobileV5==='ready',{timeout:12000});
await page.waitForFunction(()=>document.querySelectorAll('#flowTodayDateDock .flow-date-day-v5').length>=60&&document.querySelector('#flowExamDeckV5'),{timeout:10000});
await page.waitForTimeout(500);

// One fast flick must travel multiple days, coast after release, then snap once.
const viewport=page.locator('#flowTodayDateDock .flow-date-viewport'),vb=await viewport.boundingBox();assert(vb,'kinetic date viewport missing');
const before=await dateState(page),x=vb.x+vb.width*.68,y=vb.y+vb.height*.5;
await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-72,y,{steps:2});await page.mouse.move(x-192,y,{steps:2});
const held=await dateState(page);assert(held.picker===before.picker,`date committed while finger was still down ${before.picker} -> ${held.picker}`);assert(Math.abs(held.x)>50,`date rail did not track direct drag ${JSON.stringify(held)}`);
await page.mouse.up();const released=await dateState(page);await page.waitForTimeout(90);const coasting=await dateState(page);
assert(coasting.picker===before.picker,`fast flick committed before inertia finished ${before.picker} -> ${coasting.picker}`);
assert(coasting.preview!==released.preview||Math.abs(coasting.x-released.x)>5,`rail stopped immediately on pointer release ${JSON.stringify({released,coasting})}`);
await page.waitForFunction(previous=>document.querySelector('#datePicker')?.value!==previous,before.picker,{timeout:5000});const settled=await dateState(page),delta=dayDelta(before.picker,settled.picker);
assert(Math.abs(delta)>=2,`one flick is still clamped to a single day ${JSON.stringify({before:before.picker,after:settled.picker,delta})}`);assert(Math.abs(settled.x)<=1.5,`date did not magnetically settle to center ${JSON.stringify(settled)}`);assert(settled.days>=60&&settled.kinetic==='v5',`virtual date wheel lost its wide buffer ${JSON.stringify(settled)}`);
await page.screenshot({path:`${OUT}/phone-kinetic-date.png`,fullPage:false});

// The exam viewport must read as one hero + three compact cards + a rear peek.
await page.locator('#flowExamDeckV5').scrollTo({top:0});await page.waitForTimeout(100);let exams=await examState(page);const shown=exams.cards.filter(card=>card.display!=='none'&&card.visible>0),active=shown.filter(card=>card.active),compact=shown.filter(card=>!card.active&&card.visible>=44),peek=shown.filter(card=>!card.active&&card.visible>0&&card.visible<24);
assert(active.length===1&&active[0].index===0,`first exam is not the detailed active card ${JSON.stringify(exams)}`);assert(compact.length>=3,`fewer than three compact exams are readable ${JSON.stringify(shown)}`);assert(peek.length>=1,`rear stack peek is missing ${JSON.stringify(shown)}`);assert(active[0].height>=compact[0].height+45,`active exam is not clearly more detailed ${JSON.stringify({active:active[0],compact:compact[0]})}`);
await page.screenshot({path:`${OUT}/phone-exam-deck-initial.png`,fullPage:false});
await page.locator('#flowExamDeckV5').evaluate(node=>node.scrollTo({top:84,behavior:'auto'}));await page.waitForTimeout(130);exams=await examState(page);const activeAfter=exams.cards.find(card=>card.active);
assert(activeAfter?.index===1,`second exam did not become the detailed card after one smooth step ${JSON.stringify(exams)}`);assert(exams.cards.find(card=>card.index===0)?.visible<10,`old detailed card did not leave naturally ${JSON.stringify(exams.cards.find(card=>card.index===0))}`);
await page.screenshot({path:`${OUT}/phone-exam-deck-next.png`,fullPage:false});

// Settings must be a continuous surface under the floating nav, with working ambience and haptics.
await page.locator('#mobileSettingsBtn').click();await page.waitForSelector('#flowSchoolSettingsView:not(.hidden)',{timeout:5000});await page.waitForSelector('#flowSchoolSettingsView .flow-experience-settings',{timeout:5000});
let settings=await page.evaluate(()=>{const panel=document.querySelector('#flowSchoolSettingsView'),nav=document.querySelector('#bottomNav'),pr=panel?.getBoundingClientRect(),nr=nav?.getBoundingClientRect();return{panelBottom:pr?.bottom||0,navTop:nr?.top||0,navBottom:nr?.bottom||0,viewport:innerHeight,paddingBottom:parseFloat(getComputedStyle(panel).paddingBottom)||0}});
assert(settings.panelBottom>=settings.viewport-1,`Settings surface still ends above the viewport ${JSON.stringify(settings)}`);assert(settings.paddingBottom>=120,`Settings scroll content lacks bottom-nav clearance ${JSON.stringify(settings)}`);
const ambientButton=page.locator('#flowSchoolSettingsView [data-flow-experience-toggle="ambient"]'),hapticButton=page.locator('#flowSchoolSettingsView [data-flow-experience-toggle="haptics"]');
await ambientButton.click();await page.waitForFunction(()=>document.documentElement.dataset.flowAmbient==='on');const ambient=await page.evaluate(()=>({phase:document.documentElement.dataset.flowAmbientPhase||'',background:getComputedStyle(document.body,'::before').backgroundImage,stored:localStorage.getItem('flow-ambient-v1')}));
assert(ambient.stored==='on'&&ambient.phase&&ambient.background&&ambient.background!=='none',`time ambience is enabled but visually hidden ${JSON.stringify(ambient)}`);
await hapticButton.click();await page.waitForFunction(()=>localStorage.getItem('flow-haptics-v1')==='on');await page.locator('#mobileSettingsBtn').dispatchEvent('pointerdown',{pointerId:90,isPrimary:true,pointerType:'touch'});const vibes=await page.evaluate(()=>window.__flowVibes||[]);assert(vibes.length>0,`haptic feedback never reached navigator.vibrate ${JSON.stringify(vibes)}`);
await page.locator('#flowSchoolSettingsView').evaluate(node=>{node.scrollTop=node.scrollHeight});await page.waitForTimeout(100);const endState=await page.evaluate(()=>{const panel=document.querySelector('#flowSchoolSettingsView'),nav=document.querySelector('#bottomNav'),cards=[...panel.querySelectorAll('.flow-settings-card')].filter(node=>getComputedStyle(node).display!=='none'),last=cards.at(-1),lr=last?.getBoundingClientRect(),nr=nav?.getBoundingClientRect();return{lastBottom:lr?.bottom||0,navTop:nr?.top||0,scrollTop:panel.scrollTop,scrollHeight:panel.scrollHeight,clientHeight:panel.clientHeight}});
assert(endState.scrollTop>0&&endState.lastBottom<=endState.navTop-6,`last Settings content cannot clear the floating nav ${JSON.stringify(endState)}`);
await page.screenshot({path:`${OUT}/phone-settings-bottom.png`,fullPage:false});
assert(errors.length===0,`mobile v5 browser errors ${JSON.stringify(errors)}`);
await context.close();

// A stored profile must never expose the legacy dashboard while the v2 surface is still loading.
const bootContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'}),bootPage=await bootContext.newPage(),bootErrors=await fixture(bootPage,{delaySurface:900});
await bootPage.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});await bootPage.waitForSelector('#dashboard:not(.hidden)',{state:'attached',timeout:8000});await bootPage.waitForFunction(()=>!document.querySelector('#dashboard')?.classList.contains('hidden'),{timeout:5000});const gated=await bootPage.evaluate(()=>({surface:document.documentElement.dataset.flowSchoolSurface||'',visibility:getComputedStyle(document.querySelector('#dashboard')).visibility,pointer:getComputedStyle(document.querySelector('#dashboard')).pointerEvents}));
assert(gated.surface!=='ready'&&gated.visibility==='hidden'&&gated.pointer==='none',`legacy School shell is visible before v2 readiness ${JSON.stringify(gated)}`);await bootPage.screenshot({path:`${OUT}/reload-gated.png`,fullPage:false});await bootPage.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready',{timeout:12000});const readyVisibility=await bootPage.evaluate(()=>getComputedStyle(document.querySelector('#dashboard')).visibility);assert(readyVisibility==='visible',`dashboard stayed hidden after surface readiness ${readyVisibility}`);assert(bootErrors.length===0,`reload gate browser errors ${JSON.stringify(bootErrors)}`);await bootContext.close();
await browser.close();

console.log(JSON.stringify({ok:true,date:'multi-day kinetic inertia + magnetic snap',exams:'1 detailed + 3 compact + rear peek with scroll promotion',settings:'continuous surface + visible ambient + haptics',reload:'no legacy first-frame flash'},null,2));