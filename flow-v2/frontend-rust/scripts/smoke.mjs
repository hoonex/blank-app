import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const base = "http://127.0.0.1:4173/flow-v2/frontend-rust/dist/index.html";
const shots = "flow-v2/frontend-rust/screenshots";
await mkdir(shots, { recursive: true });

const sizes = [
  [390,844],[844,390],[768,1024],[1024,768],[1366,768],[1920,1080]
];
let failures = 0;
async function settleMotion(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (let attempt = 0; attempt < 3; attempt++) {
      const active = document.getAnimations().filter(a => a.playState === "running");
      if (!active.length) break;
      await Promise.all(active.map(a => a.finished.catch(() => {})));
    }
  });
}
for (const [width,height] of sizes) {
  const options = { viewport: { width, height }, deviceScaleFactor: 1 };
  if (width === 390) options.recordVideo = { dir:shots, size:{ width,height } };
  const page = await browser.newPage(options);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const fixture = {
    officeCode:"D10",schoolCode:"7240293",
    name:"정동고등학교",kind:"고등학교",address:"대구광역시",phone:"053-000-0000"
  };
  await page.addInitScript(school => {
    localStorage.setItem("flow-school-profile-v3", JSON.stringify({school,grade:2,className:"6"}));
  },fixture);
  await page.route("**/functions/v1/school-data*",async route => {
    const day = new Date(),p=x=>String(x).padStart(2,"0");
    const date = day.getFullYear()+p(day.getMonth()+1)+p(day.getDate());
    const data = {
      timetable:Array.from({length:7},(_,i)=>({date,period:i+1,subject:["국어","수학","물리학","영어","화학","정보","체육"][i]})),
      meals:[{date,type:"중식",dishes:["현미밥","콩나물국","닭고기구이","배추김치"],calories:"750 Kcal"}],
      events:[{date,name:"시험 일정",grade2:"Y"}],
      school:fixture
    };
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
  });
  try {
    await page.goto(base,{waitUntil:"networkidle",timeout:30000});
    await page.locator(".scene-head h1").waitFor({state:"visible",timeout:20000});
    const h1 = await page.locator(".scene-head h1").innerText();
    if(!h1.includes("오늘의 흐름"))throw Error("Unexpected today title "+h1);
    await settleMotion(page);
    await page.screenshot({path:shots+"/today-"+width+"x"+height+".png",fullPage:true});
    const nav = width<=800 ? ".mobile-bottom button" : ".rail-navigation button";
    await page.locator(nav).nth(1).click();
    await page.locator(".calendar-grid").waitFor();
    await settleMotion(page);
    await page.screenshot({path:shots+"/schedule-"+width+"x"+height+".png",fullPage:true});
    await page.locator(nav).nth(3).click();
    await page.locator(".setting-row").first().waitFor();
    await page.locator(".setting-toggle").first().click();
    if ((await page.locator("html").getAttribute("data-theme"))!=="dark")throw Error("Dark-mode toggle broken");
    await settleMotion(page);
    await page.screenshot({path:shots+"/dark-"+width+"x"+height+".png",fullPage:true});
    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    if(overflow)throw Error("Horizontal overflow detected");
    if(errors.length)throw Error("JS errors: "+errors.join("; "));
    console.log("PASS "+width+"x"+height);
  }catch(e){
    failures++;
    console.error("FAIL "+width+"x"+height+": "+e.message);
    await page.screenshot({path:shots+"/failed-"+width+"x"+height+".png",fullPage:true}).catch(()=>{});
  }
  await page.close();
  if(width===390) await page.video()?.saveAs(shots+"/motion-390x844.webm");
}
await browser.close();
if(failures) process.exit(1);
