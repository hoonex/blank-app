import {chromium} from 'playwright';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청'},grade:2,className:'6'};
const pad=value=>String(value).padStart(2,'0');
const now=new Date();
const key=`${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
function assert(value,message){if(!value)throw new Error(message)}
function json(route,body){return route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',userAgent:'Mozilla/5.0 (Linux; Android 16; SM-S931N) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36'});
const page=await context.newPage();
await page.route('**/functions/v1/school-data*',route=>{
  const url=new URL(route.request().url()),action=url.searchParams.get('action')||'';
  if(action==='dashboard')return json(route,{school:profile.school,timetable:Array.from({length:7},(_,i)=>({date:key,period:i+1,subject:['문학','영어Ⅱ','수학Ⅱ','정보','화학','체육','자율'][i]})),meals:[],events:[]});
  if(action==='media')return json(route,{media:{}});
  return json(route,{});
});
await page.route('https://t1.kakaocdn.net/kas/static/ba.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
await page.addInitScript(profile=>{
  localStorage.clear();sessionStorage.clear();
  localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
  localStorage.setItem('flow-school-theme-v3','light');
  localStorage.setItem('flow-glass-mode-v2','standard');
  localStorage.setItem('flow-school-transit-lab-v1','off');
},profile);
await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});
await page.locator('#dashboard:not(.hidden)').waitFor();
await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready'&&document.documentElement.dataset.flowSchoolRealDeviceRefine==='v1');
await page.locator('.timetable-mode-toggle').waitFor();

const state=await page.evaluate(()=>{
  const shape=(node,pseudo=null)=>{if(!node)return null;const s=getComputedStyle(node,pseudo);return{radius:s.borderTopLeftRadius,corner:s.getPropertyValue('corner-shape').trim(),height:node.getBoundingClientRect().height}};
  const nav=document.querySelector('#bottomNav.mobile-bottom-nav');
  const today=document.querySelector('.timetable-mode-toggle [data-timetable-mode="today"]');
  const week=document.querySelector('.timetable-mode-toggle [data-timetable-mode="week"]');
  const edit=document.querySelector('#editSubjectsBtn');
  const share=document.querySelector('#shareTimetableBtn');
  const lens=nav?.querySelector(':scope>.flow-refraction-copy-lens');
  return{
    toggle:shape(document.querySelector('.timetable-mode-toggle')),
    today:shape(today),week:shape(week),edit:shape(edit),share:shape(share),
    nav:shape(nav),tab:shape(nav?.querySelector(':scope>.mobile-tab')),activeLens:shape(nav,'::before'),lens:shape(lens)
  };
});
const noSquircle=(name,item)=>{assert(item,`${name}: missing`);assert(!String(item.corner||'').toLowerCase().includes('squircle'),`${name}: squircle leaked ${JSON.stringify(item)}`)};
for(const [name,item] of Object.entries(state))if(item)noSquircle(name,item);
assert(state.toggle.radius==='12px',`toggle wrapper radius drifted ${JSON.stringify(state.toggle)}`);
for(const name of ['today','week','edit','share'])assert(state[name]?.radius==='10px',`${name}: action radius is not 10px ${JSON.stringify(state[name])}`);
assert(state.today.radius===state.week.radius&&state.week.radius===state.edit.radius&&state.edit.radius===state.share.radius,`Today/Week/edit/share curvature diverged ${JSON.stringify(state)}`);
assert(state.nav.radius==='16px',`bottom nav outer radius drifted ${JSON.stringify(state.nav)}`);
assert(state.tab.radius==='12px'&&state.activeLens.radius==='12px',`bottom nav inner radii diverged ${JSON.stringify({tab:state.tab,activeLens:state.activeLens})}`);
if(state.lens)assert(state.lens.radius==='12px',`refraction lens radius diverged ${JSON.stringify(state.lens)}`);
await context.close();await browser.close();
console.log(JSON.stringify({ok:true,contract:'circular rounded rectangles only',state},null,2));
