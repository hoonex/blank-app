import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const out='school-calendar-audit';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768}});

const days=Array.from({length:42},(_,i)=>{
  const n=i+1,selected=n===9,event=n===10?'2학기 전국 영어듣기능력평가 및 매우 긴 일정 이름':'';
  return `<button class="calendar-day${selected?' selected':''}" type="button"><strong>${n}</strong>${event?'<span class="calendar-dot"></span><span class="calendar-event-label">'+event+'</span>':''}</button>`;
}).join('');
await page.setContent(`<!doctype html><html lang="ko" data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${base}/school.css"><link rel="stylesheet" href="${base}/school-v5.css"><style>body{padding:20px}.fixture{width:min(820px,100%);margin:0 auto}.calendar-card{padding:19px}</style></head><body><article class="calendar-card content-card"><div class="calendar-grid">${['일','월','화','수','목','금','토'].map(x=>`<div class="calendar-weekday">${x}</div>`).join('')}${days}</div></article></body></html>`,{waitUntil:'load'});

async function measure(width,height,expected,label){
  await page.setViewportSize({width,height});
  await page.waitForTimeout(80);
  const state=await page.evaluate(()=>{
    const cells=[...document.querySelectorAll('.calendar-day')];
    const selected=document.querySelector('.calendar-day.selected'),longLabel=[...cells].find(x=>x.querySelector('.calendar-event-label'));
    const heights=cells.map(x=>x.getBoundingClientRect().height);
    const rows=[...new Set(cells.map(x=>Math.round(x.getBoundingClientRect().top)))];
    return{
      selectedHeight:selected?.getBoundingClientRect().height||0,
      longHeight:longLabel?.getBoundingClientRect().height||0,
      min:Math.min(...heights),max:Math.max(...heights),rows:rows.length,
      width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
      selectedText:selected?.textContent?.trim()||'',longText:longLabel?.textContent?.trim()||''
    };
  });
  if(Math.abs(state.selectedHeight-expected)>.6||Math.abs(state.longHeight-expected)>.6||Math.abs(state.max-state.min)>.6||state.rows!==6){
    throw new Error(`${label} calendar rows are content-sized: ${JSON.stringify({expected,state})}`);
  }
  if(state.scrollWidth>state.width+2)throw new Error(`${label} calendar overflow: ${JSON.stringify(state)}`);
  return state;
}

const desktop=await measure(1366,768,82,'desktop');
const landscape=await measure(844,390,82,'landscape');
await page.screenshot({path:`${out}/school-calendar-landscape.png`,fullPage:false});
const tablet=await measure(768,1024,66,'tablet');
const mobile=await measure(390,844,54,'mobile');
await page.screenshot({path:`${out}/school-calendar-mobile.png`,fullPage:false});
const report={desktop,landscape,tablet,mobile};
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
