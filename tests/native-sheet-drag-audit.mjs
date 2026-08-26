import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='native-feel-audit';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});

function matrixY(transform='none'){
  if(transform==='none')return 0;
  const m=transform.match(/matrix(?:3d)?\(([^)]+)\)/);if(!m)return NaN;
  const values=m[1].split(',').map(Number);
  return values.length===16?values[13]:values[5];
}
async function openDialog(page,selector){
  await page.evaluate(selector=>{const d=document.querySelector(selector);if(d&&!d.open)d.showModal()},selector);
  await page.locator(`${selector}[open]`).waitFor();
  await page.locator(`${selector} .flow-sheet-grab-handle`).waitFor({state:'visible'});
  await page.waitForTimeout(340);
}
async function state(page,dialog,sheet){
  return page.evaluate(({dialog,sheet})=>{
    const d=document.querySelector(dialog),s=document.querySelector(sheet),h=d?.querySelector('.flow-sheet-grab-handle'),close=d?.querySelector('.dialog-close');
    const ss=s?getComputedStyle(s):null,hs=h?getComputedStyle(h):null,cs=close?getComputedStyle(close):null,bs=d?getComputedStyle(d,'::backdrop'):null;
    return{open:Boolean(d?.open),grabbed:d?.dataset.flowSheetGrabbed||'',dragging:d?.dataset.flowSheetDragging||'',settling:d?.dataset.flowSheetSettling||'',dismissing:d?.dataset.flowSheetDismissing||'',resting:d?.dataset.flowSheetResting||'',transform:ss?.transform||'none',opacity:ss?.opacity||'',handleDisplay:hs?.display||'',handleWidth:hs?.width||'',handleHeight:hs?.height||'',closeWidth:cs?.width||'',closeHeight:cs?.height||'',backdropOpacity:bs?.opacity||'',root:{clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}};
  },{dialog,sheet});
}
async function handlePoint(page,selector){
  const box=await page.locator(`${selector} .flow-sheet-grab-handle`).boundingBox();if(!box)throw new Error(`${selector}: grab handle geometry missing`);
  return{x:box.x+box.width/2,y:box.y+Math.min(16,box.height/2)};
}
async function drag(page,selector,delta,{hold=0,steps=8}={}){
  const {x,y}=await handlePoint(page,selector);
  await page.mouse.move(x,y);await page.mouse.down();if(hold)await page.waitForTimeout(hold);
  await page.mouse.move(x,y+delta,{steps});
}
async function interruptReturn(page,dialog,sheet,label){
  await drag(page,dialog,118,{hold:12,steps:8});await page.waitForTimeout(12);await page.mouse.up();await page.waitForTimeout(25);
  const before=await state(page,dialog,sheet),beforeY=matrixY(before.transform);
  if(before.settling!=='true'||!(beforeY>8))throw new Error(`${label}: return settle was not in flight before interruption ${JSON.stringify({before,beforeY})}`);

  const point=await handlePoint(page,dialog);
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.waitForTimeout(18);
  const grabbed=await state(page,dialog,sheet),grabbedY=matrixY(grabbed.transform);
  if(grabbed.grabbed!=='true'||grabbed.settling||Math.abs(grabbedY-beforeY)>6)throw new Error(`${label}: mid-settle re-grab jumped away from presentation state ${JSON.stringify({beforeY,grabbedY,before,grabbed})}`);

  await page.mouse.move(point.x,point.y-30,{steps:4});await page.waitForTimeout(24);
  const reversed=await state(page,dialog,sheet),reversedY=matrixY(reversed.transform);
  if(reversed.dragging!=='true'||!(reversedY<grabbedY-8))throw new Error(`${label}: interrupted sheet could not reverse immediately ${JSON.stringify({grabbedY,reversedY,reversed})}`);
  await page.mouse.up();await page.waitForTimeout(330);
  const settled=await state(page,dialog,sheet);
  if(!settled.open||settled.resting!=='true'||Math.abs(matrixY(settled.transform))>1)throw new Error(`${label}: interrupted sheet failed to return to rest ${JSON.stringify(settled)}`);
  return{beforeY,grabbedY,reversedY};
}
async function assertSheet(page,{dialog,sheet,label,screenshot}){
  await openDialog(page,dialog);
  let s=await state(page,dialog,sheet);
  if(s.handleDisplay==='none'||parseFloat(s.handleWidth)<80||parseFloat(s.handleHeight)<40)throw new Error(`${label}: grab region is not a touch-sized target ${JSON.stringify(s)}`);
  if(parseFloat(s.closeWidth)<40||parseFloat(s.closeHeight)<40)throw new Error(`${label}: close target is too small ${JSON.stringify(s)}`);

  await drag(page,dialog,64,{hold:55,steps:7});await page.waitForTimeout(35);
  s=await state(page,dialog,sheet);const y=matrixY(s.transform);
  if(s.dragging!=='true'||!(y>42)||Number(s.backdropOpacity)>.93)throw new Error(`${label}: sheet did not directly follow a short pull ${JSON.stringify({s,y})}`);
  if(s.root.scrollWidth>s.root.clientWidth+3)throw new Error(`${label}: drag created horizontal overflow ${JSON.stringify(s.root)}`);
  await page.screenshot({path:`${OUT}/${screenshot}`,fullPage:false});
  await page.mouse.up();await page.waitForTimeout(330);
  s=await state(page,dialog,sheet);
  if(!s.open||s.resting!=='true'||Math.abs(matrixY(s.transform))>1)throw new Error(`${label}: short pull did not spring back ${JSON.stringify(s)}`);

  const interruption=await interruptReturn(page,dialog,sheet,label);

  const before=await state(page,dialog,sheet);
  const target=page.locator(`${dialog} input:visible`).first();
  if(await target.count()){
    const box=await target.boundingBox();if(box){await page.mouse.move(box.x+Math.min(30,box.width/2),box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+Math.min(30,box.width/2),box.y+box.height/2+52,{steps:5});await page.mouse.up();await page.waitForTimeout(60)}
  }
  const after=await state(page,dialog,sheet);
  if(!after.open||after.dragging||after.dismissing||before.open!==after.open)throw new Error(`${label}: body control gesture incorrectly became a sheet drag ${JSON.stringify({before,after})}`);

  await drag(page,dialog,226,{hold:18,steps:9});await page.waitForTimeout(20);await page.mouse.up();await page.waitForTimeout(310);
  s=await state(page,dialog,sheet);
  if(s.open)throw new Error(`${label}: decisive downward pull did not dismiss sheet ${JSON.stringify(s)}`);
  return{state:s,interruption};
}
async function pageFor(path,reducedMotion='no-preference'){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',reducedMotion});
  const page=await context.newPage();
  await page.goto(`${BASE}${path}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('.flow-sheet-grab-handle').length>0,null,{timeout:10000});
  return{context,page};
}

async function school(){
  const {context,page}=await pageFor('/');
  const result=await assertSheet(page,{dialog:'#settingsDialog',sheet:'#settingsDialog .sheet',label:'school settings',screenshot:'native-sheet-school-drag.png'});
  await context.close();return result;
}
async function university(){
  const {context,page}=await pageFor('/university/');
  const result=await assertSheet(page,{dialog:'#importDialog',sheet:'#importDialog .dialog-sheet',label:'university import',screenshot:'native-sheet-university-drag.png'});
  await context.close();return result;
}
async function reduced(){
  const {context,page}=await pageFor('/', 'reduce');
  await page.evaluate(()=>document.querySelector('#settingsDialog')?.showModal());await page.locator('#settingsDialog[open]').waitFor();
  const s=await state(page,'#settingsDialog','#settingsDialog .sheet');
  if(s.handleDisplay!=='none')throw new Error(`reduced motion must disable direct sheet drag ${JSON.stringify(s)}`);
  await context.close();return s;
}

const result={school:await school(),university:await university(),reduced:await reduced()};
await browser.close();
console.log(JSON.stringify(result,null,2));