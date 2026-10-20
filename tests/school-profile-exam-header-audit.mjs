import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'/tmp/flow-school-profile-exam-header';
await mkdir(OUT,{recursive:true});
const school={officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',officeName:'대구광역시교육청',kind:'고등학교',homepage:'https://school.example',type:'공립',highSchoolType:'일반고',coed:'남녀공학',dayNight:'주간',founded:'19860301',anniversary:'19860301',jurisdiction:'대구광역시교육청',location:'대구광역시',address:'대구광역시 동구 테스트로 1',phone:'053-000-0000',highSchoolTrack:'일반계'};
const now=new Date(Date.now()+9*3600000);
const dateKey=(offset,day)=>{const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+offset,day));return String(d.getUTCFullYear())+String(d.getUTCMonth()+1).padStart(2,'0')+String(d.getUTCDate()).padStart(2,'0')};
const monthKey=offset=>dateKey(offset,1).slice(0,6);
const todayKey=dateKey(0,now.getUTCDate());
const exam=(date,name)=>({date,name,content:'시험 일정',grade2:'Y'});
const exams={
 [monthKey(0)]:[exam(dateKey(0,Math.min(now.getUTCDate()+1,28)),'이번 달 평가')],
 [monthKey(1)]:[exam(dateKey(1,7),'다음 달 시험'),exam(dateKey(1,19),'다음 달 학력평가')],
 [monthKey(2)]:[exam(dateKey(2,7),'기말시험'),exam(dateKey(2,8),'기말시험 2일차')]
};
const responses=[];
const b=await chromium.launch({headless:true});
for(const [name,w,h] of [['phone',390,844],['tablet',768,1024],['desktop',1366,768]]){
 const c=await b.newContext({viewport:{width:w,height:h},isMobile:w===390,hasTouch:w<=768,locale:'ko-KR',timezoneId:'Asia/Seoul'});
 const p=await c.newPage();
 await p.addInitScript(s=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school:s,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-ambient-v1','off')},school);
 await p.route('**/functions/v1/school-data**',r=>{const u=new URL(r.request().url()),action=u.searchParams.get('action'),date=String(u.searchParams.get('date')||todayKey).replace(/\D/g,'');if(action==='dashboard')responses.push(date.slice(0,6));const payload=action==='dashboard'?{school,selected:date,from:date,to:date,timetable:[],meals:[],events:exams[date.slice(0,6)]||[],scheduleMeta:{mode:'fixture',count:1}}:action==='media'?{media:{hero:'',logo:''},homepage:'https://school.example'}:{classes:['1','2','3','4','5','6']};return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)})});
 await p.route('**/functions/v1/school-logo**',r=>r.fulfill({status:204,body:''}));
 await p.goto(BASE,{waitUntil:'domcontentloaded'});
 await p.locator('#dashboard:not(.hidden)').waitFor();
 if(w===390){
   await p.waitForFunction(()=>document.querySelectorAll('#flowExamDeckV5 .flow-exam-card-v5').length>=4,null,{timeout:12000});
   const preview=await p.evaluate(()=>{const deck=document.getElementById('flowExamDeckV5'),stage=deck.querySelector('.flow-exam-stage-v5'),rect=stage.getBoundingClientRect();return{count:stage.querySelectorAll('.flow-exam-card-v5').length,scrollTop:deck.scrollTop,top:rect.top,cards:[...stage.querySelectorAll('.flow-exam-card-v5')].map(n=>({name:n.querySelector('h3')?.textContent,active:n.hasAttribute('data-active'),visible:n.getBoundingClientRect().top<rect.bottom})),width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}});
   if(preview.count<4||preview.scrollTop!==0||preview.width>preview.client+2)throw new Error('Initial exam preview incomplete: '+JSON.stringify(preview));
   await p.locator('#flowExamDeckV5').scrollIntoViewIfNeeded();await p.screenshot({path:OUT+'/phone-exams.png',animations:'disabled'});
 }
 const nav=p.locator('[data-view="school"]:visible').first();await nav.click();
 await p.locator('#schoolView:not(.hidden)').waitFor();
 const state=await p.evaluate(()=>{const g=document.querySelector('#schoolInfoGrid'),groups=[...g.querySelectorAll(':scope > .info-group')],fields=[...g.querySelectorAll('.info-tile')],brand=document.querySelector('#dashboard .mobile-topbar .flow-logo'),s=brand?.getBoundingClientRect();return {groups:groups.map(x=>({title:x.querySelector('h3').textContent,top:x.getBoundingClientRect().top,left:x.getBoundingClientRect().left,width:x.getBoundingClientRect().width})),fields:fields.length,brandLeft:s?.left,identity:document.querySelector('#profileFacts')?.textContent,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}});
 const schoolHeader=await p.locator('#schoolView>.view-header').boundingBox();
 if(!schoolHeader||schoolHeader.y<0||schoolHeader.y>=h)throw new Error('School tab failed to reset scroll: '+JSON.stringify({schoolHeader,state}));
 if(state.groups.length!==2||state.fields<9||state.overflow>2)throw new Error('School overview regression: '+JSON.stringify(state));
 if(w===390){const geometry=await p.evaluate(()=>{const h=document.querySelector('#dashboard .mobile-topbar'),b=h?.querySelector('.flow-logo'),r=n=>{const v=n.getBoundingClientRect();return [v.left,v.right,v.width]};return{header:r(h),brand:r(b),pad:getComputedStyle(h).paddingLeft,display:getComputedStyle(h).display,grid:getComputedStyle(h).gridTemplateColumns,brandTransform:getComputedStyle(b).transform,brandMargin:getComputedStyle(b).marginLeft,hasOurCSS:document.querySelector('#flow-school-mobile-v5-style')?.textContent.includes('group public NEIS')||false}});console.log('HEADER GEOMETRY',JSON.stringify(geometry));if(state.brandLeft<12)throw new Error('Brand sticks to left edge: '+JSON.stringify({state,geometry}));}
 if(w===390){await p.screenshot({path:OUT+'/phone-profile.png',animations:'disabled'})}
 if(w===768){await p.screenshot({path:OUT+'/tablet-profile.png',animations:'disabled'})}
 if(w===1366){await p.screenshot({path:OUT+'/desktop-profile.png',animations:'disabled'})}
 await c.close();
}
await b.close();
await writeFile(OUT+'/report.json',JSON.stringify({results:'PASS',requestedMonths:responses},null,2));
console.log('School profile/exam/header PASS: 3 viewports, first-paint exam prefill without interaction');
