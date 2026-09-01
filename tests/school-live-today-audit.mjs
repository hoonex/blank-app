import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-live-today-audit';
await fs.mkdir(OUT,{recursive:true});
const pad=v=>String(v).padStart(2,'0');
const kst=new Date(Date.now()+9*60*60*1000);
const selected=`${kst.getUTCFullYear()}${pad(kst.getUTCMonth()+1)}${pad(kst.getUTCDate())}`;
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199'},grade:2,className:'6'};
const dashboard={school:profile.school,selected,from:selected,to:selected,timetable:Array.from({length:7},(_,i)=>({date:selected,period:i+1,subject:['국어','문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육'][i]})),meals:[{date:selected,type:'중식',dishes:['현미밥','된장국'],calories:'812 Kcal'}],events:[{date:'20260902',name:'전국연합학력평가',content:'1,2학년 전국연합학력평가'},{date:'20260905',name:'토요휴업일',content:''},{date:'20260909',name:'영어듣기평가',content:'2학년 영어듣기평가'},{date:'20260912',name:'토요휴업일',content:''}],scheduleMeta:{mode:'fixture',count:4}};
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function assert(value,message){if(!value)throw new Error(message)}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:768,height:1024},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',userAgent:'Mozilla/5.0 (Linux; Android 14; SM-T735N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'});
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});if(action==='place')return json(route,{provider:'fixture',place:{id:'school',name:profile.school.name,address:profile.school.address}});return json(route,{})});
await page.addInitScript(({profile})=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','optical');localStorage.setItem('flow-school-transit-lab-v1','off');const now=new Date(),start=new Date(now.getTime()-65*60000),pad=v=>String(v).padStart(2,'0');localStorage.setItem('flow-school-bell-v1',JSON.stringify({start:`${pad(start.getHours())}:${pad(start.getMinutes())}`,lesson:50,break:10,meal:'12:20',mealEnd:'13:10'}))},{profile});
await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:15000});
await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolUiStyles==='ready');
await page.waitForFunction(()=>document.querySelector('#timetable')?.querySelectorAll('.flow-period-time').length===7,{timeout:10000});
await page.waitForFunction(()=>document.querySelector('.upcoming-card .card-heading h2')?.textContent==='다가오는 시험',{timeout:10000});
await page.waitForTimeout(300);
const state=await page.evaluate(()=>{const timetable=document.querySelector('#timetable'),eventList=document.querySelector('#eventList');return{android:document.documentElement.dataset.flowAndroidStableGlass,times:[...(timetable?.querySelectorAll('.flow-period-time')||[])].map(node=>node.textContent),current:[...(timetable?.querySelectorAll('.flow-period-current')||[])].map(node=>node.dataset.period),periodShapes:[...(timetable?.querySelectorAll('.period-no')||[])].map(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return{clip:s.clipPath,width:r.width,height:r.height}}),examTitle:document.querySelector('.upcoming-card .card-heading h2')?.textContent,exams:[...(eventList?.querySelectorAll(':scope > .flow-exam-card h3')||[])].map(node=>node.textContent),examText:eventList?.textContent||'',lens:document.querySelector('.mobile-bottom-nav>.flow-refraction-copy-lens')?getComputedStyle(document.querySelector('.mobile-bottom-nav>.flow-refraction-copy-lens')).display:null,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}});
assert(state.android==='true',`Android stable glass flag missing ${JSON.stringify(state)}`);
assert(state.times.length===7&&state.times.every(text=>/^\d{2}:\d{2}–\d{2}:\d{2}/.test(text)),`period times missing ${JSON.stringify(state.times)}`);
assert(state.current.length===1&&state.current[0]==='2',`current period highlight incorrect ${JSON.stringify(state.current)}`);
assert(state.periodShapes.every(item=>String(item.clip||'').startsWith('circle(')&&Math.abs(item.width-item.height)<=1),`period number badges regressed ${JSON.stringify(state.periodShapes)}`);
assert(state.examTitle==='다가오는 시험',`exam heading missing ${state.examTitle}`);
assert(state.exams.length===3,`expected three visible exam cards ${JSON.stringify(state.exams)}`);
assert(!state.examText.includes('토요휴업일'),`holiday leaked into exam stack ${state.examText}`);
assert(state.exams[0].includes('전국연합'),`first exam is not the nearest meaningful exam ${JSON.stringify(state.exams)}`);
assert(state.lens===null||state.lens==='none',`Android live refraction copy is still visible ${state.lens}`);
assert(state.overflow<=1,`horizontal overflow ${state.overflow}`);
assert(errors.length===0,`browser errors ${JSON.stringify(errors)}`);
await page.screenshot({path:`${OUT}/initial.png`,fullPage:true});
const stack=page.locator('#eventList').first();await stack.scrollIntoViewIfNeeded();await page.waitForTimeout(80);const box=await stack.boundingBox();assert(box,'exam stack missing geometry');
await page.mouse.move(box.x+box.width/2,box.y+70);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y-10,{steps:8});await page.mouse.up();await page.waitForTimeout(260);
const after=await page.locator('#eventList').first().locator(':scope > .flow-exam-card[data-depth="0"] h3').textContent();assert(after&&after!==state.exams[0],`exam stack did not magnet-snap to next item: ${after}`);
await page.waitForTimeout(5000);await page.screenshot({path:`${OUT}/after-5s.png`,fullPage:true});
await fs.writeFile(`${OUT}/report.json`,JSON.stringify({state,after,errors},null,2));
await context.close();await browser.close();console.log(JSON.stringify({ok:true,currentPeriod:state.current[0],exams:state.exams,after,lens:state.lens},null,2));
