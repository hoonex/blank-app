// Browser regression: local candidate intercepts changed static assets only;
// --live checks the public origin with no interception. NEIS requests are real.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.FLOW_PLAYWRIGHT?pathToFileURL(process.env.FLOW_PLAYWRIGHT).href:'playwright');
const live=process.argv.includes('--live');
const widths=[320,360,390,590,768,871,1366,1920];
const matrix=widths.flatMap(w=>['light','dark'].map(theme=>({w,theme})));
const root=new URL('../',import.meta.url);
const dest=resolve(process.env.FLOW_QA_DIR||'qa-flow-browser-output',live?'live':'candidate');
mkdirSync(dest,{recursive:true});
const names=['flow-icons-handdrawn-v1.js','flow-feature-guide-v1.js','flow-feature-guide-v1.css','style-f2805f3fda656187.css','flow-editorial-refine-v2.css','flow-bus-nearby-v1.css','flow-bus-flat-mobile-v1.css','flow-date-ribbon-v3.css','flow-meal-single-v2.css','flow-current-period-v3.js','flow-month-events-v1.css','flow-bus-nearby-v2.js','flow-school-shortcuts-v1.js','flow-school-shortcuts-v1.css','flow-onboarding-v2.js','flow-ux-compact-v2.css','flow-ux-quick-actions-v1.js','flow-bus-auto-v1.css','flow-bus-auto-v2.js'];
const files=new Map(names.map(n=>[n,n==='style-f2805f3fda656187.css'?execFileSync('git',['show',':'+n],{cwd:root}):readFileSync(new URL(n,root))]));
const html=readFileSync(new URL('index.html',root));
const origin='https://blank-app.agfvrd.workers.dev';
const browser=await chromium.launch({headless:true,executablePath:process.env.FLOW_CHROME||undefined,args:['--no-sandbox']});
const results=[];
async function probe({w,theme}){
 const context=await browser.newContext({viewport:{width:w,height:w<871?844:900},isMobile:w<871,hasTouch:w<871,reducedMotion:'no-preference'});
 const p=await context.newPage(),errors=[],failedAssets=[],screens=[],served=new Set();
 const o={w,theme,checks:[],errors,failedAssets,screens};
 const check=(name,condition)=>{assert.ok(condition,name);o.checks.push(name)};
 p.on('pageerror',e=>errors.push(e.message));
 p.on('response',r=>{if(r.url().includes('/flow-v2/frontend-rust/dist/')&&r.status()>=400)failedAssets.push({url:r.url(),status:r.status()})});
 await context.addInitScript(()=>{
   localStorage.setItem('flow-school-profile-v3',JSON.stringify({school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교'},grade:2,className:'6'}));
   localStorage.setItem('flow-school-guide-v1','done');
 });
 if(!live)await p.route(origin+'/**',route=>{
   const u=new URL(route.request().url()),n=u.pathname.split('/').pop();
   if(u.pathname==='/')return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
   if(files.has(n)){served.add(n);return route.fulfill({status:200,contentType:n.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:files.get(n)});}
   return route.continue();
 });
 const nav=w<871?'.mobile-bottom':'.rail-navigation';
 const tab=async name=>{await p.locator(nav+'>button').filter({hasText:name}).first().click();await p.waitForTimeout(300)};
 const scan=async name=>{
   const info=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
     theme:document.documentElement.dataset.theme||'light',
     glyphs:[...document.querySelectorAll('button,a,[role=button]')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden').filter(e=>/^(?:[vV<>×⌄‹›↗○●?]|[←→])$|[⌄‹›↗×○●]$/u.test(e.textContent.trim())).map(e=>({class:e.className,text:e.textContent.trim().slice(0,100)}))}));
   check(name+' no horizontal overflow',!info.overflow);
   check(name+' no glyph controls '+JSON.stringify(info.glyphs),info.glyphs.length===0);
   if(w===390||w===1366){const file=w+'-'+theme+'-'+name+'.png';await p.screenshot({path:resolve(dest,file)});screens.push(file);}
   return info;
 };
 try{
   await p.goto(origin+'/?flow-regression=vector-2',{waitUntil:'domcontentloaded',timeout:40000});
   await p.waitForSelector('.flow-date-month-icon svg[data-flow-action=calendar]',{timeout:25000});
   if(theme==='dark'){
     await tab('설정');const toggle=p.locator('.settings-sheet .setting-toggle').filter({hasText:'모드'}).filter({hasNotText:'대학교'}).first();
     await toggle.waitFor();if((await p.evaluate(()=>document.documentElement.dataset.theme))!=='dark')await toggle.click();
     await p.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await tab('오늘');
   }else if((await p.evaluate(()=>document.documentElement.dataset.theme))==='dark'){
     await tab('설정');await p.locator('.settings-sheet .setting-toggle').filter({hasText:'모드'}).filter({hasNotText:'대학교'}).first().click();await tab('오늘');
   }
   await p.waitForSelector('.flow-meal-arrow svg',{timeout:20000});
   const t=await scan('today');check('requested theme',t.theme===theme);
   check('integrity-checked core CSS loaded',await p.evaluate(()=>[...document.styleSheets].some(s=>s.href?.includes('style-f2805f3fda656187.css')&&s.cssRules.length>50)));
   await p.locator('.flow-date-month-button').click();
   await p.waitForSelector('.flow-date-month-dialog[open] .flow-date-picker-arrow svg');
   check('picker expanded',(await p.locator('.flow-date-month-button').getAttribute('aria-expanded'))==='true');
   await p.locator('.flow-date-picker-close').click();
   await p.waitForFunction(()=>document.querySelector('.flow-date-month-button')?.getAttribute('aria-expanded')==='false'&&!document.querySelector('.flow-date-month-dialog[open]'));
   check('picker collapsed',(await p.locator('.flow-date-month-button').getAttribute('aria-expanded'))==='false');
   const date=p.locator('.flow-date-day:not(.is-selected):not(:disabled)').first();const expected=await date.getAttribute('aria-label');await date.click();
   await p.waitForTimeout(180);check('date selected',(await p.locator('.flow-date-day.is-selected').getAttribute('aria-label'))===expected);
   for(const view of ['month','week']){await p.locator('.flow-meal-segment [data-view='+view+']').click();await p.waitForTimeout(150);check('meal '+view,(await p.locator('.flow-meal-single').getAttribute('data-view'))===view);}
   await tab('일정');await p.waitForSelector('.flow-month-event-arrow svg',{timeout:18000});await scan('calendar');
   const monthTitle=p.locator('.calendar-toolbar h2'),oldMonth=await monthTitle.textContent();
   if(w>590){
     const next=p.locator('.month-actions .month-chevron').last();
     check('tablet/desktop month button accessible',await next.isVisible()&&!!(await next.getAttribute('aria-label'))&&await next.locator('svg').count()===1);
     await next.focus();await p.keyboard.press('Enter');
   }else{
     const next=p.locator('.flow-wheel-neighbor[role=button]').last();
     await next.focus();await p.keyboard.press('Enter');
   }
   await p.waitForFunction(old=>document.querySelector('.calendar-toolbar h2')?.textContent!==old,oldMonth,{timeout:12000});
   check('calendar keyboard month navigation',true);
   await tab('학교');await p.waitForSelector('.flow-school-shortcut svg',{timeout:12000});await scan('school');
   const tiles=await p.evaluate(()=>{const g=document.querySelector('.flow-school-shortcut-grid'),tile=g.firstElementChild,s=getComputedStyle(tile);return {gap:parseFloat(getComputedStyle(g).gap),padding:parseFloat(s.paddingLeft),radius:parseFloat(s.borderRadius),shadow:s.boxShadow,border:parseFloat(s.borderLeftWidth)}});
   check('school tile padding, gap and role '+JSON.stringify(tiles),tiles.gap>=8&&tiles.padding>=12&&tiles.radius===14&&tiles.shadow==='none'&&tiles.border>=1);
   await tab('버스');await p.waitForSelector('.bus-search');await scan('bus');
   if(w<871)check('selected bus tab dark foreground',await p.locator('.mobile-bottom>button.flow-selected').evaluate(e=>getComputedStyle(e).color==='rgb(23, 25, 23)'));
   await tab('설정');await p.waitForSelector('.setting-toggle svg[data-flow-action]');await scan('settings');
   const toggle=p.locator('.settings-sheet .setting-toggle').filter({hasText:'모드'}).filter({hasNotText:'대학교'}).first();
   const firstIcon=await toggle.locator('svg').getAttribute('data-flow-action');
   check('theme icon present',['sun','moon'].includes(firstIcon));
   await toggle.click();await p.waitForFunction(old=>document.querySelector('.settings-sheet .setting-toggle svg')?.dataset.flowAction!==old,firstIcon);
   const secondIcon=await toggle.locator('svg').getAttribute('data-flow-action');
   check('reactive theme icon changes',secondIcon!==firstIcon&&['sun','moon'].includes(secondIcon));
   await toggle.click();await p.waitForFunction(old=>document.querySelector('.settings-sheet .setting-toggle svg')?.dataset.flowAction===old,firstIcon);
   const launch=p.getByRole('button',{name:'가이드 보기'});await launch.click();
   const close=p.getByRole('button',{name:'가이드 닫기'});await close.waitFor();
   check('guide SVG',(await close.locator('svg').getAttribute('data-flow-action'))==='close');
   const rect=await close.boundingBox();check('guide touch target',rect.width>=44&&rect.height>=44);
   await scan('guide');await p.keyboard.press('Tab');check('guide focus stays inside',await p.evaluate(()=>!!document.activeElement.closest('.flow-guide')));
   await p.keyboard.press('Escape');await close.waitFor({state:'detached'});check('guide focus restored',await launch.evaluate(e=>document.activeElement===e));
   await tab('오늘');await p.waitForSelector('.flow-date-month-button');
   check('return to today',await p.locator('.flow-date-month-button').isVisible());
   check('no JS exceptions',errors.length===0);check('no asset HTTP errors',failedAssets.length===0);
   if(!live)check('all candidate assets served',names.every(n=>served.has(n)));
   o.pass=true;
 }catch(e){o.error=String(e);o.pass=false;try{await p.screenshot({path:resolve(dest,w+'-'+theme+'-failure.png')})}catch{}}
 finally{await context.close();}
 console.log(JSON.stringify({w,theme,pass:o.pass,checks:o.checks.length,error:o.error,errors,failedAssets}));
 return o;
}
try{for(let i=0;i<matrix.length;i+=4){results.push(...await Promise.all(matrix.slice(i,i+4).map(probe)));}}finally{await browser.close();}
writeFileSync(resolve(dest,'result.json'),JSON.stringify(results,null,2));
console.log('Browser matrix '+results.filter(o=>o.pass).length+'/'+results.length);
if(results.some(o=>!o.pass))process.exitCode=1;
