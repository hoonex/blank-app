import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const out='university-audit/selection-chrome';
await mkdir(out,{recursive:true});
const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},mobile:true,touch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},mobile:true,touch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},mobile:false,touch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},mobile:false,touch:true},
  {name:'desktop',viewport:{width:1366,height:768},mobile:false,touch:false},
  {name:'desktop-wide',viewport:{width:1920,height:1080},mobile:false,touch:false},
];
const browser=await chromium.launch({headless:true});
const report={cases:[]};let failed=false;
for(const c of cases){
  const context=await browser.newContext({viewport:c.viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',isMobile:c.mobile,hasTouch:c.touch,colorScheme:'light'});
  const page=await context.newPage(),consoleErrors=[],pageErrors=[];page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.addInitScript(()=>{localStorage.setItem('flow-university-profile-v1',JSON.stringify({id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80'}));localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[
    {name:'운영체제',professor:'김교수',place:'공대9호관',times:[{day:0,start:'09:00',end:'10:30',startMinutes:540,endMinutes:630,place:'공대9호관'}]},
    {name:'컴퓨터네트워크및보안',professor:'이교수',place:'IT융합산업빌딩',times:[{day:1,start:'10:00',end:'11:30',startMinutes:600,endMinutes:690,place:'IT융합산업빌딩'}]},
    {name:'자료구조',professor:'박교수',place:'IT대학2호관',times:[{day:2,start:'13:00',end:'14:15',startMinutes:780,endMinutes:855,place:'IT대학2호관'}]},
    {name:'소프트웨어설계',professor:'최교수',place:'IT대학1호관',times:[{day:3,start:'14:00',end:'15:30',startMinutes:840,endMinutes:930,place:'IT대학1호관'}]},
    {name:'인공지능개론',professor:'정교수',place:'공대9호관',times:[{day:4,start:'11:00',end:'12:15',startMinutes:660,endMinutes:735,place:'공대9호관'}]}
  ]}));localStorage.removeItem('flow-university-time-overrides-v1')});
  const row={name:c.name,viewport:c.viewport};
  try{
    await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('[data-view="timetable"]:visible').first().click();
    const target=page.locator('#timeGrid .flow-editable-class').filter({hasText:'운영체제'}).first();await target.waitFor({timeout:10000});await page.waitForTimeout(150);await target.click();await page.waitForTimeout(40);
    row.geometry=await page.evaluate(()=>{const block=[...document.querySelectorAll('#timeGrid .flow-editable-class')].find(x=>x.textContent.includes('운영체제')),rail=block?.querySelector('[data-time-selection-rail]'),strong=block?.querySelector('strong');if(!block||!rail||!strong)return null;const b=block.getBoundingClientRect(),r=rail.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(strong);const t=range.getBoundingClientRect(),pseudo=getComputedStyle(rail,'::before'),knobW=parseFloat(pseudo.width)||0,knobRight=parseFloat(pseudo.right)||0,knobLeft=r.right-knobRight-knobW;return{block:{left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height},rail:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},title:{left:t.left,right:t.right,top:t.top,bottom:t.bottom},knobLeft,intrusion:b.right-knobLeft,knobGap:knobLeft-t.right,selected:block.dataset.timeSelected||'',pressed:block.getAttribute('aria-pressed')||'',dialogOpen:Boolean(document.querySelector('#classTimeDialog')?.open),scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight}});
    if(!row.geometry)throw new Error('Selected timetable chrome missing.');
    if(row.geometry.selected!=='true'||row.geometry.pressed!=='true'||row.geometry.dialogOpen)throw new Error(`Selection state invalid: ${JSON.stringify(row.geometry)}`);
    if(row.geometry.scrollWidth>row.geometry.clientWidth+3)throw new Error(`Horizontal overflow: ${JSON.stringify(row.geometry)}`);
    if(row.geometry.intrusion>8||row.geometry.knobGap<1)throw new Error(`Selection knob overlaps title: ${JSON.stringify(row.geometry)}`);
    await page.screenshot({path:`${out}/${c.name}-viewport.png`,fullPage:false});
    await page.screenshot({path:`${out}/${c.name}-full.png`,fullPage:true});
  }catch(error){row.error=String(error);failed=true}
  row.consoleErrors=consoleErrors;row.pageErrors=pageErrors;if(consoleErrors.length||pageErrors.length)failed=true;report.cases.push(row);await context.close()
}
await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failed)process.exitCode=1;
