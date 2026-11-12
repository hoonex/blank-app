// Verify first-fold density and overflow with deterministic, non-production fixtures.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.env.FLOW_V2_BASE || "http://127.0.0.1:4173/flow-v2/index.html";
const out = process.env.FLOW_V2_SHOTS || "flow-v2/screenshots";
await mkdir(out, {recursive:true});
const browser = await chromium.launch({headless:true});
const sizes = [[390,844],[844,390],[768,1024],[1024,768],[1366,768],[1920,1080]];
let failed = 0;
for (const [width,height] of sizes) {
  const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const pageErrors = [];
  page.on("pageerror",error => pageErrors.push(String(error)));
  await page.addInitScript(() => {
    const pad = n => String(n).padStart(2,"0");
    const now = new Date(), noon = new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
    const key = d => String(d.getFullYear()) + pad(d.getMonth()+1) + pad(d.getDate());
    const monday = new Date(noon);
    monday.setDate(noon.getDate() + (noon.getDay()===0?-6:1-noon.getDay()));
    const fmtMonth = String(noon.getFullYear())+"-"+pad(noon.getMonth()+1);
    const profile = {school:{schoolCode:"123",officeCode:"D10",name:"테스트 고등학교",kind:"고등학교",address:"대구광역시"},grade:2,className:"6"};
    const timetable = Array.from({length:5},(_,i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate()+i);
      return Array.from({length:7},(_,p) => ({date:key(day),period:p+1,subject:["국어","수학","영어","물리","정보","체육","화학"][p]}));
    }).flat();
    const payload = {school:profile.school,timetable,
      meals:[{date:key(noon),type:"중식",dishes:["쌀밥","된장국","닭고기구이","배추김치"],calories:"730 Kcal"}],
      events:[{date:key(noon),name:"학교 행사"}]};
    const cache = "flow-school-cache-v4:123:2:6:"+key(monday)+":"+fmtMonth+":"+key(noon);
    localStorage.setItem("flow-school-profile-v3",JSON.stringify(profile));
    localStorage.setItem(cache,JSON.stringify({at:Date.now(),payload}));
  });
  await page.goto(base,{waitUntil:"domcontentloaded"});
  await page.locator(".page-heading h1").waitFor({timeout:10000});
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const file = out+"/today-"+width+"x"+height+".png";
  await page.screenshot({path:file,fullPage:true});
  if (overflow || pageErrors.length) {
    failed++;
    console.error(width+"x"+height+" overflow="+overflow+" errors="+pageErrors.join(";"));
  }
  await page.getByRole("button",{name:"일정",exact:true}).first().click();
  await page.locator(".calendar-grid").waitFor({timeout:5000});
  await page.screenshot({path:out+"/schedule-"+width+"x"+height+".png",fullPage:true});
  await page.close();
}
await browser.close();
if (failed) process.exit(1);
console.log("Flow V2 visual matrix passed (DOM overflow + uncaught errors). Screenshots still require human review.");
