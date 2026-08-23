import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='native-feel-audit';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function rgbMax(value=''){
  const m=value.match(/rgba?\(([^)]+)\)/i);if(!m)return 999;
  return Math.max(...m[1].split(/[ ,/]+/).slice(0,3).map(Number).filter(Number.isFinite));
}
async function waitMaterial(page){
  await page.waitForFunction(()=>[...document.styleSheets].some(s=>{try{return new URL(s.href||'',location.href).pathname==='/flow-material.css'}catch{return false}}),null,{timeout:10000});
  await page.waitForTimeout(120);
}
async function computed(page,selector,pseudo=null){
  return page.evaluate(({selector,pseudo})=>{
    const el=document.querySelector(selector);if(!el)return null;
    const s=getComputedStyle(el,pseudo||null);
    return{background:s.backgroundColor,backdrop:s.backdropFilter||s.webkitBackdropFilter||'none',radius:s.borderRadius,corner:s.getPropertyValue('corner-shape')||'',shadow:s.boxShadow,border:s.borderColor};
  },{selector,pseudo});
}
function noSquircle(label,style){if(style?.corner&&/squircle|superellipse\(2\)/i.test(style.corner))throw new Error(`${label}: squircle still active ${JSON.stringify(style)}`)}
function noBackdrop(label,style){if(style&&style.backdrop!=='none'&&style.backdrop!=='')throw new Error(`${label}: content incorrectly uses glass ${JSON.stringify(style)}`)}

async function schoolLanding(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',colorScheme:'dark'});const page=await context.newPage();
  await page.addInitScript(()=>{localStorage.removeItem('flow-school-profile-v3');localStorage.setItem('flow-school-theme-v3','dark')});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#landing:not(.hidden)').waitFor();await waitMaterial(page);
  const card=await computed(page,'.school-search-panel'),field=await computed(page,'.search-box'),mode=await computed(page,'.landing-mode-switch');
  noSquircle('school search card',card);noSquircle('school search field',field);noBackdrop('school search card',card);
  if(rgbMax(card.background)>80)throw new Error(`school dark search card is too bright ${JSON.stringify(card)}`);
  if(parseFloat(card.radius)>=24||parseFloat(field.radius)>=20)throw new Error(`school landing radii remain oversized ${JSON.stringify({card,field})}`);
  if(mode?.shadow!=='none')throw new Error(`school landing utility still glows ${JSON.stringify(mode)}`);
  await page.screenshot({path:`${OUT}/apple-material-school-landing-dark.png`,fullPage:true});await context.close();
  return{card,field,mode};
}

async function universityLanding(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',colorScheme:'dark'});const page=await context.newPage();
  await page.addInitScript(()=>{localStorage.removeItem('flow-university-profile-v1');localStorage.setItem('flow-university-theme-v1','dark')});
  await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#setupView:not(.hidden)').waitFor();await waitMaterial(page);
  const card=await computed(page,'.search-card'),field=await computed(page,'.search-field'),mode=await computed(page,'.setup-header .quiet-link'),theme=await computed(page,'.setup-header .flow-theme-cycle');
  noSquircle('university search card',card);noSquircle('university search field',field);noBackdrop('university search card',card);
  if(rgbMax(card.background)>80)throw new Error(`university dark search card is too bright ${JSON.stringify(card)}`);
  if(parseFloat(card.radius)>=24||parseFloat(field.radius)>=20)throw new Error(`university landing radii remain oversized ${JSON.stringify({card,field})}`);
  if(mode?.shadow!=='none'||theme?.shadow!=='none')throw new Error(`university landing utilities still glow ${JSON.stringify({mode,theme})}`);
  await page.screenshot({path:`${OUT}/apple-material-university-landing-dark.png`,fullPage:true});await context.close();
  return{card,field,mode,theme};
}

async function universityApp(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',colorScheme:'dark'});const page=await context.newPage();
  const university={id:'knu',name:'경북대학교',kind:'대학교',address:'대구광역시 북구 대학로 80',homepage:'https://www.knu.ac.kr'};
  await page.route('**/functions/v1/university-data**',route=>json(route,{school:university,metrics:{},partial:false,unavailable:[]}));
  await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
  await page.addInitScript(({university})=>{localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[]}));localStorage.setItem('flow-university-theme-v1','dark')},{university});
  await page.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await page.locator('#appView:not(.hidden)').waitFor();await waitMaterial(page);
  const nav=await computed(page,'.bottom-nav'),lens=await computed(page,'.bottom-nav','::before'),card=await computed(page,'.summary-card:not(.next-card)');
  const optics=await page.evaluate(()=>{
    const sheets=[...document.querySelectorAll('link[rel="stylesheet"]')].map(node=>{try{return new URL(node.href,location.href).pathname}catch{return''}});
    return{mode:document.documentElement.dataset.flowGlassRefraction||'',filter:Boolean(document.querySelector('#flow-liquid-refraction')),sheets,materialIndex:sheets.lastIndexOf('/flow-material.css'),globalThemeIndex:sheets.lastIndexOf('/university/ui-unify-v2.css')};
  });
  noSquircle('university summary card',card);noBackdrop('university summary card',card);
  if(nav?.backdrop==='none'||!nav?.backdrop.includes('blur'))throw new Error(`tab bar is not glass ${JSON.stringify(nav)}`);
  if(lens?.backdrop==='none'||!lens?.backdrop.includes('blur'))throw new Error(`selection lens is not optical glass ${JSON.stringify(lens)}`);
  if(!optics.filter)throw new Error(`SVG refraction filter missing ${JSON.stringify(optics)}`);
  if(optics.mode==='true'&&!/url\(/i.test(lens.backdrop))throw new Error(`refraction capability enabled without URL filter ${JSON.stringify({optics,lens})}`);
  if(optics.materialIndex<0||optics.materialIndex<optics.globalThemeIndex)throw new Error(`material stylesheet does not override global theme styles ${JSON.stringify(optics)}`);
  if(parseFloat(nav.radius)<30)throw new Error(`tab bar is not capsule-shaped ${JSON.stringify(nav)}`);
  await page.screenshot({path:`${OUT}/apple-material-university-dashboard-dark.png`,fullPage:false});

  await page.locator('#importTopBtn').click();await page.locator('#importDialog[open]').waitFor();await page.waitForTimeout(120);
  const sheet=await computed(page,'#importDialog .dialog-sheet'),privacy=await computed(page,'#importDialog .privacy-note'),input=await computed(page,'#importDialog .dialog-field input');
  noSquircle('university import sheet',sheet);noSquircle('university import input',input);
  if(sheet?.backdrop==='none'||!sheet?.backdrop.includes('blur'))throw new Error(`dialog sheet is not regular glass ${JSON.stringify(sheet)}`);
  if(rgbMax(privacy.background)>90)throw new Error(`dark privacy note is glaringly bright ${JSON.stringify(privacy)}`);
  if(!(parseFloat(sheet.radius)>parseFloat(input.radius)))throw new Error(`shape hierarchy missing between sheet and input ${JSON.stringify({sheet,input})}`);
  await page.screenshot({path:`${OUT}/apple-material-university-import-dark.png`,fullPage:false});await context.close();
  return{nav,lens,card,optics,sheet,privacy,input};
}

const result={schoolLanding:await schoolLanding(),universityLanding:await universityLanding(),universityApp:await universityApp()};
await browser.close();console.log(JSON.stringify(result,null,2));
