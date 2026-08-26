import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='native-feel-audit';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function matrix(transform='none'){
  if(transform==='none')return{x:0,scaleX:1,scaleY:1};
  const m=transform.match(/matrix(?:3d)?\(([^)]+)\)/);if(!m)return{x:NaN,scaleX:NaN,scaleY:NaN};
  const values=m[1].split(',').map(Number);
  return values.length===16?{x:values[12],scaleX:values[0],scaleY:values[5]}:{x:values[4],scaleX:values[0],scaleY:values[3]};
}
async function lens(page,navSelector,itemSelector){
  return page.evaluate(({navSelector,itemSelector})=>{
    const nav=document.querySelector(navSelector),item=document.querySelector(itemSelector);
    const lens=nav?getComputedStyle(nav,'::before'):null,old=item?getComputedStyle(item,'::before'):null;
    const rect=nav?.getBoundingClientRect();
    return{
      content:lens?.content||'',transform:lens?.transform||'none',width:lens?.width||'',left:lens?.left||'',right:lens?.right||'',
      transitionDuration:lens?.transitionDuration||'',transitionTimingFunction:lens?.transitionTimingFunction||'',backdrop:lens?.backdropFilter||lens?.webkitBackdropFilter||'',
      oldItemContent:old?.content||'',navRect:rect&&{left:rect.left,right:rect.right,width:rect.width},
      pressed:nav?.dataset.flowLensPressed||'',dragging:nav?.dataset.flowLensDragging||'',settling:nav?.dataset.flowLensSettling||'',
      inlineX:nav?.style.getPropertyValue('--flow-lens-x')||'',inlineDuration:nav?.style.getPropertyValue('--flow-lens-duration')||'',inlineEase:nav?.style.getPropertyValue('--flow-lens-ease')||'',
      root:{clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}
    };
  },{navSelector,itemSelector});
}
async function overflowDiagnosis(page,navSelector){
  return page.evaluate(navSelector=>{
    const nav=document.querySelector(navSelector);
    const measure=label=>{
      void document.documentElement.offsetWidth;
      const nr=nav?.getBoundingClientRect(),ps=nav?getComputedStyle(nav,'::before'):null,ns=nav?getComputedStyle(nav):null;
      return{label,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,innerWidth,
        nav:nr&&{left:nr.left,right:nr.right,width:nr.width,position:ns?.position,leftCss:ns?.left,rightCss:ns?.right,overflow:ns?.overflow},
        pseudo:ps&&{content:ps.content,width:ps.width,left:ps.left,right:ps.right,transform:ps.transform,filter:ps.backdropFilter||ps.webkitBackdropFilter||'',boxShadow:ps.boxShadow}};
    };
    const rows=[measure('initial')];
    const style=document.createElement('style');document.head.append(style);
    const probe=(label,rule)=>{style.textContent=`${navSelector}::before{${rule}}`;rows.push(measure(label))};
    probe('no-pseudo','content:none!important');
    probe('no-transform','transform:none!important;transition:none!important');
    probe('no-filter','backdrop-filter:none!important;-webkit-backdrop-filter:none!important');
    probe('no-shadow','box-shadow:none!important');
    probe('zero-width','width:0!important;border:0!important');
    style.remove();
    const oldDisplay=nav?.style.display;if(nav)nav.style.setProperty('display','none','important');rows.push(measure('nav-hidden'));if(nav){nav.style.display=oldDisplay||''}
    return rows;
  },navSelector);
}
async function assertTravel(page,{nav,item,tabs,label}){
  const diagnosis=await overflowDiagnosis(page,nav);
  console.log(`${label} overflow diagnosis: ${JSON.stringify(diagnosis)}`);
  const states=[];
  for(let i=0;i<tabs.length;i++){
    const target=page.locator(tabs[i]);
    await target.waitFor({state:'visible'});
    if(i)await target.click();
    if(!await target.evaluate(el=>el.classList.contains('active')))throw new Error(`${label}: tab did not become active: ${tabs[i]}`);
    await page.waitForTimeout(480);
    states.push(await lens(page,nav,`${item}.active`));
  }
  const xs=states.map(s=>matrix(s.transform).x);
  if(states.some(s=>s.root.scrollWidth>s.root.clientWidth+3))throw new Error(`${label}: tab lens caused horizontal overflow ${JSON.stringify(states)}`);
  if(states.some(s=>s.content==='none'||s.content==='normal'||!s.backdrop.includes('blur')))throw new Error(`${label}: shared glass lens missing ${JSON.stringify(states)}`);
  if(states.some(s=>s.oldItemContent!=='none'))throw new Error(`${label}: per-button pill still exists ${JSON.stringify(states)}`);
  for(let i=1;i<xs.length;i++)if(!(xs[i]>xs[i-1]+8))throw new Error(`${label}: lens did not travel forward ${JSON.stringify({xs,states})}`);
  return{diagnosis,xs,states};
}
async function interruptLens(page,{nav,item,activeTarget,label}){
  const before=await lens(page,nav,`${item}.active`),beforeX=matrix(before.transform).x;
  if(before.settling!=='true')throw new Error(`${label}: lens settle ended before interruption probe ${JSON.stringify(before)}`);
  const box=await page.locator(activeTarget).boundingBox();if(!box)throw new Error(`${label}: active target geometry missing during interruption`);
  const point={x:box.x+box.width/2,y:box.y+box.height/2};
  await page.mouse.move(point.x,point.y);
  const preGrab=await lens(page,nav,`${item}.active`),preGrabX=matrix(preGrab.transform).x;
  await page.mouse.down();await page.waitForTimeout(18);
  const grabbed=await lens(page,nav,`${item}.active`),grabbedX=matrix(grabbed.transform).x;
  if(grabbed.pressed!=='true'||grabbed.settling||Math.abs(grabbedX-preGrabX)>6)throw new Error(`${label}: mid-settle lens re-grab jumped away from presentation state ${JSON.stringify({beforeX,preGrabX,grabbedX,before,preGrab,grabbed})}`);

  await page.mouse.move(point.x-30,point.y,{steps:4});await page.waitForTimeout(24);
  const reversed=await lens(page,nav,`${item}.active`),reversedX=matrix(reversed.transform).x;
  if(reversed.dragging!=='true'||!(reversedX<grabbedX-8))throw new Error(`${label}: interrupted lens could not reverse immediately ${JSON.stringify({grabbedX,reversedX,reversed})}`);
  await page.mouse.up();await page.waitForTimeout(470);
  const settled=await lens(page,nav,`${item}.active`);
  if(settled.pressed||settled.dragging||settled.settling||settled.root.scrollWidth>settled.root.clientWidth+3)throw new Error(`${label}: interrupted lens failed to settle cleanly ${JSON.stringify(settled)}`);
  return{beforeX,preGrabX,grabbedX,reversedX,settled};
}
async function assertDirectDrag(page,{nav,item,from,target,label}){
  const source=page.locator(from),destination=page.locator(target);
  await source.click();await page.waitForTimeout(460);
  const a=await source.boundingBox(),b=await destination.boundingBox();
  if(!a||!b)throw new Error(`${label}: drag target geometry missing`);
  const start={x:a.x+a.width/2,y:a.y+a.height/2},end={x:b.x+b.width/2,y:b.y+b.height/2};
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.waitForTimeout(90);
  const pressed=await lens(page,nav,`${item}.active`),pm=matrix(pressed.transform);
  if(pressed.pressed!=='true'||pm.scaleX<1.035||pm.scaleY<1.045)throw new Error(`${label}: press did not inflate glass ${JSON.stringify({pressed,pm})}`);
  await page.mouse.move(end.x,end.y,{steps:8});await page.waitForTimeout(35);
  const dragging=await lens(page,nav,`${item}.active`),dm=matrix(dragging.transform);
  if(dragging.dragging!=='true'||!dragging.inlineX||dm.scaleX<1.055)throw new Error(`${label}: lens did not directly follow drag ${JSON.stringify({dragging,dm})}`);
  if(dragging.root.scrollWidth>dragging.root.clientWidth+3)throw new Error(`${label}: drag created page overflow ${JSON.stringify(dragging)}`);
  await page.mouse.up();await page.waitForTimeout(35);
  const settling=await lens(page,nav,`${item}.active`);
  if(settling.settling!=='true'||!settling.inlineDuration||!settling.inlineEase.includes('1.18'))throw new Error(`${label}: momentum settle state missing ${JSON.stringify(settling)}`);
  if(!await destination.evaluate(el=>el.classList.contains('active')))throw new Error(`${label}: drag release did not select destination before settle interruption`);
  const interruption=await interruptLens(page,{nav,item,activeTarget:target,label});
  const settled=await lens(page,nav,`${item}.active`),sm=matrix(settled.transform);
  if(settled.pressed||settled.dragging||settled.root.scrollWidth>settled.root.clientWidth+3)throw new Error(`${label}: lens failed to settle cleanly ${JSON.stringify(settled)}`);
  return{pressed:{...pressed,matrix:pm},dragging:{...dragging,matrix:dm},settling,interruption,settled:{...settled,matrix:sm}};
}

async function school(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});const page=await context.newPage();
  const school={officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
  await page.route('**/functions/v1/school-data**',async route=>{const action=new URL(route.request().url()).searchParams.get('action');if(action==='dashboard')return json(route,{school,selected:'20260823',from:'20260823',to:'20260823',timetable:[],meals:[],events:[],scheduleMeta:{mode:'fixture',count:0}});if(action==='media')return json(route,{media:{},homepage:school.homepage});if(action==='place')return json(route,{provider:'kakao',place:null});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({school})=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light')},{school});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();
  const travel=await assertTravel(page,{nav:'#bottomNav',item:'.mobile-tab',tabs:['#bottomNav>.mobile-tab[data-view="today"]:visible','#bottomNav>.mobile-tab[data-view="schedule"]:visible','#bottomNav>.mobile-tab[data-view="school"]:visible','#mobileSettingsBtn:visible'],label:'school'});
  const drag=await assertDirectDrag(page,{nav:'#bottomNav',item:'.mobile-tab',from:'#bottomNav>.mobile-tab[data-view="today"]:visible',target:'#bottomNav>.mobile-tab[data-view="schedule"]:visible',label:'school'});
  await page.screenshot({path:`${OUT}/liquid-lens-school.png`,fullPage:false});await context.close();return{travel,drag};
}
async function university(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});const page=await context.newPage();
  const university={id:'knu',name:'경북대학교',kind:'대학교',address:'대구광역시 북구 대학로 80',homepage:'https://www.knu.ac.kr'};
  await page.route('**/functions/v1/university-data**',route=>json(route,{school:university,metrics:{},partial:false,unavailable:[]}));
  await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
  await page.addInitScript(({university})=>{localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[]}));localStorage.setItem('flow-university-theme-v1',JSON.stringify('light'))},{university});
  await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#appView:not(.hidden)').waitFor();
  const travel=await assertTravel(page,{nav:'.bottom-nav',item:'.bottom-item',tabs:['.bottom-item[data-view="today"]:visible','.bottom-item[data-view="timetable"]:visible','.bottom-item[data-view="school"]:visible'],label:'university'});
  const drag=await assertDirectDrag(page,{nav:'.bottom-nav',item:'.bottom-item',from:'.bottom-item[data-view="today"]:visible',target:'.bottom-item[data-view="school"]:visible',label:'university'});
  await page.screenshot({path:`${OUT}/liquid-lens-university.png`,fullPage:false});await context.close();return{travel,drag};
}

const result={school:await school(),university:await university()};
await browser.close();
console.log(JSON.stringify(result,null,2));