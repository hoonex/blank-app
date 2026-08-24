import {chromium} from 'playwright';
const base=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];page.on('pageerror',error=>errors.push(String(error)));
await page.goto(`${base}/`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>document.querySelector('#neisTimetableHelp')&&document.querySelector('#inlineWeekTimetable'));
const result=await page.evaluate(()=>{
  const card=document.querySelector('.timetable-card'),help=document.querySelector('#neisTimetableHelp'),week=document.querySelector('#inlineWeekTimetable'),style=document.querySelector('#flow-school-timetable-polish-style');
  const children=[...card.children];
  return{lastId:card.lastElementChild?.id||'',helpIndex:children.indexOf(help),weekIndex:children.indexOf(week),hasPolishStyle:Boolean(style),styleText:style?.textContent||''};
});
if(result.lastId!=='neisTimetableHelp'||result.helpIndex<=result.weekIndex)throw new Error(`NEIS timetable help must remain below the weekly table: ${JSON.stringify(result)}`);
if(!result.hasPolishStyle||!result.styleText.includes('min-height:42px'))throw new Error('Unified timetable control style is missing.');
if(errors.length)throw new Error(`Page errors: ${JSON.stringify(errors)}`);
console.log(JSON.stringify(result,null,2));
await browser.close();
