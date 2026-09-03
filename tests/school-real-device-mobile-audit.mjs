import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-real-device-mobile-audit';
await fs.mkdir(OUT,{recursive:true});
const pad=value=>String(value).padStart(2,'0');
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199'},grade:2,className:'6'};
const subjects=['문학','영어Ⅱ','선택과목','선택과목','스포츠 생활2','정보','자율'];
function assert(value,message){if(!value)throw new Error(message)}
function ymd(date){return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}`}
function parse(value){const raw=String(value||'').replace(/\D/g,'').slice(0,8),now=new Date();return raw.length===8?new Date(+raw.slice(0,4),+raw.slice(4,6)-1,+raw.slice(6,8),12):new Date(now.getFullYear(),now.getMonth(),now.getDate(),12)}
function weekDates(value){const d=parse(value),day=d.getDay(),monday=new Date(d);monday.setDate(d.getDate()+(day===0?-6:1-day));return Array.from({length:5},(_,index)=>{const next=new Date(monday);next.setDate(monday.getDate()+index);return next})}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function dashboard(value){
  const selected=parse(value),days=weekDates(value),rows=[];
  for(const [dayIndex,day] of days.entries())for(let period=1;period<=7;period++)rows.push({date:ymd(day),period,subject:subjects[(period-1+dayIndex)%subjects.length]});
  const key=ymd(selected);
  return{school:profile.school,selected:key,from:ymd(days[0]),to:ymd(days[4]),timetable:rows,meals:[{date:key,type:'중식',dishes:['현미밥','미역국','닭갈비'],calories:'720 Kcal'}],events:[{date:key,name:'학급 활동',content:'정상 수업',grade2:'Y'}],scheduleMeta:{mode:'fixture',count:1}};
}
async function installFixture(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(`page:${error.message}`));
  page.on('console',message=>{if(message.type()==='error')errors.push(`console:${message.text()}`)});
  await page.route('**/functions/v1/school-data*',route=>{
    const url=new URL(route.request().url()),action=url.searchParams.get('action')||'';
    if(action==='dashboard')return json(route,dashboard(url.searchParams.get('date')));
    if(action==='media')return json(route,{media:{}});
    if(action==='place')return json(route,{provider:'kakao',place:{id:'school',name:profile.school.name,address:profile.school.address}});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo*',route=>route.fulfill({status:204,body:''}));
  /* The old AdFit audit used a span. Use an actual iframe-shaped compositor child
     so phone layout/clipping rules exercise the same CSS path as the provider. */
  await page.route('https://t1.kakaocdn.net/kas/static/ba.min.js',route=>route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:`document.querySelectorAll('.kakao_ad_area').forEach(function(el){el.style.display='block';var frame=document.createElement('iframe');frame.className='flow-adfit-fixture-frame';frame.width='320';frame.height='100';frame.setAttribute('title','AdFit fixture');frame.srcdoc='<style>html,body{margin:0;width:320px;height:100px;background:#7f878d;color:white;font:700 18px sans-serif}div{display:grid;place-items:center;width:320px;height:100px}</style><div>AdFit iframe fixture</div>';el.append(frame);});`}));
  await page.addInitScript(profile=>{
    localStorage.clear();sessionStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
    localStorage.setItem('flow-school-transit-lab-v1','off');
  },profile);
  return errors;
}
async function snapshot(page){return page.evaluate(()=>{
  const box=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
  const shown=node=>{if(!node)return false;const r=node.getBoundingClientRect(),s=getComputedStyle(node);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
  const heading=document.querySelector('#todayView .timetable-card .card-heading h2');
  const actions=document.querySelector('#todayView .timetable-actions');
  const rows=[...document.querySelectorAll('#todayView #timetable .period-button')];
  const nav=document.querySelector('#bottomNav.mobile-bottom-nav');
  const tabs=[...(nav?.querySelectorAll(':scope>.mobile-tab')||[])];
  const rail=document.querySelector('.flow-adfit-rail--school-top');
  const slot=rail?.querySelector('.flow-adfit-slot');
  const frame=slot?.querySelector('iframe');
  const week=document.querySelector('#inlineWeekTimetable');
  const weekTable=document.querySelector('#weekTable');
  const weekCells=[...(weekTable?.querySelectorAll('.week-cell')||[])];
  const weekSubjects=[...(weekTable?.querySelectorAll('.week-subject')||[])].map(node=>node.textContent.trim()).filter(Boolean);
  return{
    realDevice:document.documentElement.dataset.flowSchoolRealDevice||'',
    weekRendered:document.documentElement.dataset.flowInlineWeekRendered||'',
    heading:box(heading),actions:box(actions),
    rows:rows.map(box),
    nav:box(nav),tabs:tabs.map(box),
    ad:{rail:box(rail),slot:box(slot),frame:box(frame),visible:shown(frame)},
    mode:{weekly:document.body.classList.contains('flow-inline-week-active'),daily:document.querySelector('#timetable')?getComputedStyle(document.querySelector('#timetable')).display:'',week:week?getComputedStyle(week).display:'',path:location.pathname},
    week:{box:box(weekTable),cells:weekCells.length,visibleCells:weekCells.filter(shown).length,subjects:weekSubjects.slice(0,12),range:document.querySelector('#weekRangeText')?.textContent?.trim()||'',prev:document.querySelector('#prevWeek')?.textContent?.trim()||'',next:document.querySelector('#nextWeek')?.textContent?.trim()||''},
    weekUtilities:{edit:shown(document.querySelector('#editSubjectsBtn')),share:shown(document.querySelector('#shareTimetableBtn'))}
  };
})}

const browser=await chromium.launch({headless:true});
for(const viewport of [{name:'phone-360',width:360,height:800},{name:'phone-412',width:412,height:915}]){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:true,hasTouch:true,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',userAgent:'Mozilla/5.0 (Linux; Android 16; SM-S931N) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36'});
  const page=await context.newPage();page.setDefaultTimeout(12000);const errors=await installFixture(page);
  try{
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});
    await page.locator('#dashboard:not(.hidden)').waitFor();
    await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready'&&document.documentElement.dataset.flowSchoolRealDevice==='v1');
    await page.locator('#timetable .period-button').first().waitFor();
    await page.locator('.flow-adfit-rail--school-top iframe').waitFor({state:'visible'});
    await page.waitForTimeout(180);
    let state=await snapshot(page);
    assert(state.realDevice==='v1',`${viewport.name}: real-device pass missing ${JSON.stringify(state)}`);
    assert(state.heading&&state.actions&&state.heading.bottom<=state.actions.top+1,`${viewport.name}: timetable title/actions still collide ${JSON.stringify({heading:state.heading,actions:state.actions})}`);
    assert(state.rows.length===7&&state.rows.every(row=>row.height>=44&&row.height<=52),`${viewport.name}: timetable density outside 44–52px ${JSON.stringify(state.rows)}`);
    assert(state.nav&&state.nav.height<=56,`${viewport.name}: bottom nav still oversized ${JSON.stringify(state.nav)}`);
    assert(state.tabs.length>=4&&state.tabs.every(tab=>tab.height>=44),`${viewport.name}: bottom-nav hit target shrank ${JSON.stringify(state.tabs)}`);
    assert(state.ad.visible&&state.ad.frame?.height===100&&state.ad.rail?.height<=120&&state.ad.slot?.height<=102,`${viewport.name}: AdFit iframe rail is oversized/clipped ${JSON.stringify(state.ad)}`);
    await page.screenshot({path:`${OUT}/${viewport.name}-today.png`,fullPage:false,animations:'disabled'});

    await page.locator('.timetable-mode-toggle [data-timetable-mode="week"]').click();
    await page.waitForFunction(()=>document.body.classList.contains('flow-inline-week-active')&&document.documentElement.dataset.flowInlineWeekRendered==='true');
    await page.waitForTimeout(80);state=await snapshot(page);
    assert(state.mode.weekly&&state.mode.daily==='none'&&state.mode.week!=='none'&&state.mode.path!=='/week',`${viewport.name}: Week shell state wrong ${JSON.stringify(state.mode)}`);
    assert(state.week.cells>=36&&state.week.visibleCells>=36&&state.week.subjects.some(text=>text&&text!=='—'),`${viewport.name}: Week shell visible but real grid is empty ${JSON.stringify(state.week)}`);
    assert(state.week.prev==='‹'&&state.week.next==='›',`${viewport.name}: phone week navigation still consumes full-width labels ${JSON.stringify(state.week)}`);
    assert(state.weekUtilities.edit&&state.weekUtilities.share,`${viewport.name}: Week utilities disappeared ${JSON.stringify(state.weekUtilities)}`);
    await page.screenshot({path:`${OUT}/${viewport.name}-week.png`,fullPage:false,animations:'disabled'});

    const before=state.week.range;
    await page.locator('#nextWeek').click();
    await page.waitForFunction(previous=>document.querySelector('#weekRangeText')?.textContent?.trim()!==previous,before);
    await page.waitForTimeout(100);state=await snapshot(page);
    assert(state.weekRendered==='true'&&state.week.cells>=36,`${viewport.name}: next-week refresh blanked the grid ${JSON.stringify(state.week)}`);

    await page.locator('.timetable-mode-toggle [data-timetable-mode="today"]').click();
    await page.waitForFunction(()=>!document.body.classList.contains('flow-inline-week-active'));
    const last=page.locator('#timetable .period-button').last();await last.scrollIntoViewIfNeeded();await page.waitForTimeout(60);
    const clearance=await page.evaluate(()=>{const row=document.querySelector('#timetable .period-button:last-child')?.getBoundingClientRect(),nav=document.querySelector('#bottomNav')?.getBoundingClientRect();return row&&nav?nav.top-row.bottom:null});
    assert(clearance===null||clearance>=8,`${viewport.name}: final timetable row cannot clear floating nav (${clearance}px)`);
    assert(errors.length===0,`${viewport.name}: browser errors ${JSON.stringify(errors)}`);
  }finally{await context.close()}
}
await browser.close();
console.log(JSON.stringify({ok:true,coverage:['visible weekly cells + next-week refresh','Week edit/share utilities','phone heading/action separation','44–52px timetable density','compact 44px bottom-nav targets','iframe-shaped AdFit rail','scroll-end nav clearance']},null,2));