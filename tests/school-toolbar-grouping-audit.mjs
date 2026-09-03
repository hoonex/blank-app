import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-toolbar-grouping-audit';
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199'},grade:2,className:'6'};
const subjects=['문학','영어Ⅱ','선택과목','선택과목','스포츠 생활2','정보','진로활동'];
const pad=value=>String(value).padStart(2,'0');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const ymd=date=>`${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}`;
function parse(value){const raw=String(value||'').replace(/\D/g,'').slice(0,8);return raw.length===8?new Date(+raw.slice(0,4),+raw.slice(4,6)-1,+raw.slice(6,8),12):new Date()}
function weekDates(value){const d=parse(value),day=d.getDay(),monday=new Date(d);monday.setDate(d.getDate()+(day===0?-6:1-day));return Array.from({length:5},(_,i)=>{const next=new Date(monday);next.setDate(monday.getDate()+i);return next})}
function dashboard(value){const selected=parse(value),days=weekDates(value),rows=[];for(const [dayIndex,day] of days.entries())for(let period=1;period<=7;period++)rows.push({date:ymd(day),period,subject:subjects[(period-1+dayIndex)%subjects.length]});const key=ymd(selected);return{school:profile.school,selected:key,from:ymd(days[0]),to:ymd(days[4]),timetable:rows,meals:[{date:key,type:'중식',dishes:['현미밥','미역국'],calories:'720 Kcal'}],events:[],scheduleMeta:{mode:'fixture',count:0}}}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function install(page){
  const errors=[];page.on('pageerror',error=>errors.push(`page:${error.message}`));page.on('console',message=>{if(message.type()==='error')errors.push(`console:${message.text()}`)});
  await page.route('**/functions/v1/school-data*',route=>{const url=new URL(route.request().url()),action=url.searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard(url.searchParams.get('date')));if(action==='media')return json(route,{media:{}});if(action==='place')return json(route,{provider:'kakao',place:{id:'school',name:profile.school.name,address:profile.school.address}});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});return json(route,{})});
  await page.route('**/functions/v1/school-logo*',route=>route.fulfill({status:204,body:''}));
  await page.route('https://t1.kakaocdn.net/kas/static/ba.min.js',route=>route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:'document.querySelectorAll(".kakao_ad_area").forEach(el=>el.style.display="none")'}));
  await page.addInitScript(profile=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard');localStorage.setItem('flow-school-transit-lab-v1','off');},profile);
  return errors;
}
async function ready(page){await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});await page.locator('#dashboard:not(.hidden)').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready'&&document.documentElement.dataset.flowSchoolToolbarGrouping==='v1');await page.locator('#timetable .period-button').first().waitFor();await page.waitForTimeout(160)}
async function measure(page){return page.evaluate(()=>{
  const rect=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null};
  const shown=node=>{if(!node)return false;const r=node.getBoundingClientRect(),s=getComputedStyle(node);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
  const topbar=document.querySelector('.mobile-topbar');
  const actions=document.querySelector('#todayView .timetable-actions');
  const toggle=document.querySelector('#todayView .timetable-mode-toggle');
  const edit=document.querySelector('#editSubjectsBtn');
  const share=document.querySelector('#shareTimetableBtn');
  const help=document.querySelector('.neis-timetable-help summary');
  const buttons=[document.querySelector('#prevWeek'),document.querySelector('#thisWeekBtn'),document.querySelector('#nextWeek')];
  const cs=node=>node?getComputedStyle(node):null;
  return{
    viewport:innerWidth,
    topbar:rect(topbar),actions:rect(actions),toggle:rect(toggle),edit:rect(edit),share:rect(share),
    visible:{edit:shown(edit),share:shown(share)},
    help:{rect:rect(help),color:cs(help)?.color,background:cs(help)?.backgroundColor,border:cs(help)?.borderTopWidth,editColor:cs(edit)?.color},
    weekButtons:buttons.map(rect),
    weekActive:document.body.classList.contains('flow-inline-week-active')
  };
})}
function assertActionGrouping(name,s){
  assert(s.actions&&s.toggle&&s.edit&&s.share,`${name}: action geometry missing ${JSON.stringify(s)}`);
  assert(s.edit.left-s.toggle.right>=12,`${name}: edit action still hugs Today/Week toggle ${JSON.stringify({toggle:s.toggle,edit:s.edit})}`);
  assert(Math.abs(s.actions.right-s.share.right)<=2.5,`${name}: share action is not docked to the right edge ${JSON.stringify({actions:s.actions,share:s.share})}`);
  assert(s.edit.right<=s.share.left+1,`${name}: edit/share ordering broke ${JSON.stringify({edit:s.edit,share:s.share})}`);
}
function assertConnectedWeek(name,s){
  const [prev,current,next]=s.weekButtons;
  assert(prev&&current&&next,`${name}: Week navigation geometry missing ${JSON.stringify(s.weekButtons)}`);
  assert(prev.height>=44&&current.height>=44&&next.height>=44,`${name}: Week navigation hit target shrank ${JSON.stringify(s.weekButtons)}`);
  assert(Math.abs(prev.right-current.left)<=1.5&&Math.abs(current.right-next.left)<=1.5,`${name}: Week navigation is still three detached buttons ${JSON.stringify(s.weekButtons)}`);
}

await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
for(const viewport of [{name:'phone-360',width:360,height:800},{name:'phone-412',width:412,height:915}]){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:true,hasTouch:true,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',userAgent:'Mozilla/5.0 (Linux; Android 16; SM-S931N) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36'});const page=await context.newPage();page.setDefaultTimeout(12000);const errors=await install(page);
  try{
    await ready(page);let s=await measure(page);
    assert(s.topbar&&s.topbar.left>=-1&&s.topbar.left<=1&&Math.abs(s.topbar.right-viewport.width)<=1,`${viewport.name}: top bar still has side gutters ${JSON.stringify(s.topbar)}`);
    assertActionGrouping(`${viewport.name} Today`,s);
    assert(s.help.background==='rgba(0, 0, 0, 0)'&&s.help.border==='0px'&&s.help.color!==s.help.editColor&&s.help.rect?.height>=44,`${viewport.name}: timetable help is not muted supporting copy ${JSON.stringify(s.help)}`);
    await page.screenshot({path:`${OUT}/${viewport.name}-today.png`,fullPage:false,animations:'disabled'});
    await page.locator('.timetable-mode-toggle [data-timetable-mode="week"]').click();await page.waitForFunction(()=>document.body.classList.contains('flow-inline-week-active'));await page.waitForTimeout(90);s=await measure(page);
    assert(s.weekActive&&s.visible.edit&&s.visible.share,`${viewport.name}: Week edit/share actions disappeared ${JSON.stringify(s.visible)}`);
    assertActionGrouping(`${viewport.name} Week`,s);assertConnectedWeek(`${viewport.name} Week`,s);
    await page.screenshot({path:`${OUT}/${viewport.name}-week.png`,fullPage:false,animations:'disabled'});
    await page.locator('#editSubjectsBtn').click();await page.waitForFunction(()=>!document.body.classList.contains('flow-inline-week-active'));
    assert(errors.length===0,`${viewport.name}: browser errors ${JSON.stringify(errors)}`);
  }finally{await context.close()}
}
{
  const context=await browser.newContext({viewport:{width:1280,height:800},locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});const page=await context.newPage();page.setDefaultTimeout(12000);const errors=await install(page);
  try{await ready(page);let s=await measure(page);assertActionGrouping('desktop Today',s);await page.locator('.timetable-mode-toggle [data-timetable-mode="week"]').click();await page.waitForFunction(()=>document.body.classList.contains('flow-inline-week-active'));await page.waitForTimeout(90);s=await measure(page);assert(s.visible.edit&&s.visible.share,`desktop Week: utilities disappeared ${JSON.stringify(s.visible)}`);assertActionGrouping('desktop Week',s);assertConnectedWeek('desktop Week',s);await page.screenshot({path:`${OUT}/desktop-1280-week.png`,fullPage:false,animations:'disabled'});assert(errors.length===0,`desktop: browser errors ${JSON.stringify(errors)}`)}finally{await context.close()}
}
await browser.close();
console.log(JSON.stringify({ok:true,coverage:['viewport-edge mobile header','left mode / right utility grouping','Week edit/share persistence','muted timetable disclosure','connected Week navigation','Week edit bridge','desktop parity']},null,2));