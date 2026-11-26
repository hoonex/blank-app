// Real APIs, fixed browser clock for historical timetable phase checks.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.FLOW_PLAYWRIGHT?pathToFileURL(process.env.FLOW_PLAYWRIGHT).href:'playwright');
const live=process.argv.includes('--live'),origin='https://blank-app.agfvrd.workers.dev';
const dir=resolve(process.env.FLOW_QA_DIR||'qa-flow-browser-output',live?'arrival-today-live':'arrival-today-candidate');
mkdirSync(dir,{recursive:true});
const names=['index.html','flow-bus-auto-v1.css','flow-bus-auto-v2.js','flow-current-period-v3.js','flow-editorial-refine-v2.css'];
const files=new Map(names.map(n=>[n,readFileSync(new URL('../'+n,import.meta.url))]));
const b=await chromium.launch({headless:true,executablePath:process.env.FLOW_CHROME||undefined,args:['--no-sandbox']});
const results=[];
async function run(w,theme){
 const c=await b.newContext({viewport:{width:w,height:w<871?844:900},isMobile:w<871,hasTouch:w<871});
 const p=await c.newPage(),o={w,theme,checks:[],errors:[],assetErrors:[]};
 const check=(name,v)=>{assert.ok(v,name);o.checks.push(name)};
 const requests=[];
 p.on('request',r=>requests.push(r.url()));
 p.on('pageerror',e=>o.errors.push(e.message));
 p.on('response',r=>{if(r.url().includes('/flow-v2/frontend-rust/dist/')&&r.status()>=400)o.assetErrors.push(r.url())});
 await c.addInitScript(()=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify({school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교'},grade:2,className:'6'}));localStorage.setItem('flow-school-guide-v1','done');});
 if(!live)await p.route(origin+'/**',r=>{const u=new URL(r.request().url()),n=u.pathname==='/'?'index.html':u.pathname.split('/').pop();if(!files.has(n))return r.continue();return r.fulfill({status:200,contentType:n.endsWith('.html')?'text/html; charset=utf-8':n.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:files.get(n)});});
 const nav=w<871?'.mobile-bottom':'.rail-navigation';
 const tab=async name=>{await p.locator(nav+'>button').filter({hasText:name}).first().click();await p.waitForTimeout(250)};
 const at=async h=>{await p.clock.setFixedTime(new Date('2026-11-26T'+h+'+09:00'));await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));};
 const save=async name=>{check(name+' no overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:resolve(dir,w+'-'+theme+'-'+name+'.png')});};
 try{
  await p.clock.setFixedTime(new Date('2026-11-26T09:30:00+09:00'));
  await p.goto(origin+'/?arrival-today-qa=1',{waitUntil:'domcontentloaded'});
  await p.waitForSelector('.class-row.flow-period-active',{timeout:25000});
  if(theme==='dark'){await tab('설정');await p.locator('.setting-toggle').filter({hasText:'라이트 모드'}).click();await tab('오늘');}
  const status=p.locator('.flow-live-period'),title=status.locator('.flow-live-period-title');
  const active=p.locator('.class-row.flow-period-active'),next=p.locator('.class-row.flow-period-next');
  await active.waitFor();
  const actual=await active.locator('strong').innerText(),upcoming=await next.locator('strong').innerText();
  check('current subject sourced from actual row',(await title.innerText()).includes(actual));
  check('next subject sourced from actual row',(await status.locator('.flow-live-period-next').innerText()).includes(upcoming));
  check('reference label visible',(await status.locator('.flow-live-period-caution').innerText()).includes('타종 미확인'));
  const box=await status.boundingBox(),sheet=await p.locator('.timetable-sheet').boundingBox();
  check('status full width',box.width>=sheet.width-12);
  await save('during');
  await at('08:00:00');await p.waitForFunction(()=>document.querySelector('.flow-live-period')?.dataset.phase==='break');
  check('before school no current lesson',await active.count()===0);
  check('before school next real class',(await title.innerText()).includes('다음'));
  await at('09:30:00');await active.waitFor();
  await p.locator('.switch-track button').filter({hasText:'주간'}).click();
  await p.waitForSelector('.week-grid');
  await p.waitForSelector('.week-cell.today.flow-period-active',{timeout:15000});
  check('week highlight only today cell',await p.locator('.week-grid-row.flow-period-active,.week-cell:not(.today).flow-period-active').count()===0);
  await p.locator('.switch-track button').filter({hasText:'하루'}).click();
  await at('18:00:00');await status.waitFor({state:'hidden'});
  check('after school no false active lesson',await active.count()===0);
  await at('09:30:00');await active.waitFor();
  await p.locator('.flow-date-day:not(.is-selected):not(:disabled)').first().click();await status.waitFor({state:'hidden'});
  check('other date no current status',true);
  await tab('버스');await p.locator('#bus-stop-query').fill('동대구역');await p.locator('.bus-search button').click();
  await p.waitForSelector('.bus-stop-option',{timeout:25000});await p.locator('.bus-stop-option').filter({hasText:'정류장 09060'}).first().click();
  const toggle=p.locator('.bus-map-toggle'),refresh=p.locator('.bus-refresh');
  await toggle.waitFor();await p.waitForFunction(()=>document.querySelector('.bus-map-toggle')?.getAttribute('aria-expanded')==='false');
  check('map closed by default',await p.locator('#flow-bus-map').count()===0);
  check('map SDK not requested before opt-in',!requests.some(u=>/dapi\.kakao\.com\/v2\/maps\/sdk\.js/.test(u)));
  await p.waitForFunction(()=>!document.querySelector('.bus-refresh')?.disabled&&!!document.querySelector('.bus-selected'),null,{timeout:30000});
  await save('arrivals-closed');
  const apiBefore=requests.filter(u=>u.includes('/api/bus/')&&!u.includes('/search')).length;
  await refresh.click();await p.waitForFunction(()=>!document.querySelector('.bus-refresh')?.disabled);
  check('refresh without map performs actual request',requests.filter(u=>u.includes('/api/bus/')&&!u.includes('/search')).length>apiBefore);
  await toggle.click();await p.waitForSelector('#flow-bus-map');
  await p.waitForFunction(()=>document.querySelector('.bus-map-toggle')?.getAttribute('aria-expanded')==='true');
  const layout=await p.evaluate(()=>{const map=document.querySelector('#flow-bus-map'),a=document.querySelector('.bus-arrivals,.bus-selected .bus-meta,.bus-selected .bus-message,.bus-selected .bus-empty');return {order:getComputedStyle(map).order,mapTop:map.getBoundingClientRect().top,infoBottom:a?.getBoundingClientRect().bottom}});
  check('map visually follows arrival information',layout.order==='1'&&(!layout.infoBottom||layout.mapTop>=layout.infoBottom-1));
  await p.waitForFunction(()=>document.activeElement?.classList.contains('bus-map-heading'));
  check('opening map focuses and reveals heading',true);
  await p.locator('.flow-map-dismiss').click();await p.waitForSelector('#flow-bus-map',{state:'detached'});
  await p.waitForFunction(()=>document.querySelector('.bus-map-toggle')?.getAttribute('aria-expanded')==='false');
  check('map closes and remains closed',true);
  check('map close restores focus to native toggle',await toggle.evaluate(e=>e===document.activeElement));
  check('no JS errors',o.errors.length===0);check('no static HTTP errors',o.assetErrors.length===0);o.pass=true;
 }catch(e){o.pass=false;o.error=String(e);await p.screenshot({path:resolve(dir,w+'-'+theme+'-failure.png')}).catch(()=>{});}
 finally{await c.close()}
 console.log(JSON.stringify(o));return o;
}
try{results.push(...await Promise.all([[320,'light'],[390,'dark'],[1366,'light']].map(([w,t])=>run(w,t))));}finally{await b.close()}
writeFileSync(resolve(dir,'result.json'),JSON.stringify(results,null,2));if(results.some(r=>!r.pass))process.exitCode=1;
