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
    await page.locator(".today-heading h1").waitFor({state:"visible",timeout:20000});
    const h1 = await page.locator(".today-heading h1").innerText();
    if(!/\d{2}\.\d{2}/.test(h1))throw Error("Unexpected kinetic date heading "+h1);
    if(await page.locator(".day-strip button").count()!==7)throw Error("Seven-day selector missing");
    if(await page.locator(".class-row").count()!==7)throw Error("Fixture timetable not fully visible");
    if(await page.locator(".hero-shape,.class-arrow,.class-type,.curtain-copy").count()!==0)
      throw Error("Superfluous ornament or false click affordance remains");
    const geometry=await page.evaluate(()=>{
      const radius=s=>parseFloat(getComputedStyle(document.querySelector(s)).borderTopLeftRadius);
      return {hero:radius(".today-heading"),meal:radius(".meal-sheet"),item:radius(".class-row"),control:radius(".today-reset")};
    });
    if(geometry.hero<22||geometry.meal<22||geometry.item<12||geometry.control<15)
      throw Error("Inconsistent rounded geometry: "+JSON.stringify(geometry));
    if(width===390){
      const last=await page.locator(".class-row").last().boundingBox();
      if(!last||last.y+last.height>770)
        throw Error("Seven class periods hidden behind navigation: "+JSON.stringify(last));
    }
    if(width===390) {
      const bounds=await page.locator(".timetable-sheet").boundingBox();
      if(!bounds || bounds.y>500)throw Error("Timetable not visible in mobile first fold: "+JSON.stringify(bounds));
    }
    await page.getByRole("button",{name:"주간",exact:true}).click();
    if(await page.locator(".week-lessons span").count()<5)throw Error("Week view lacks subject detail");
    if(width===390) {
      const chosen=await page.locator(".week-sheet>button.today").boundingBox();
      if(!chosen || chosen.y+chosen.height>844-58)throw Error("Selected day is not discoverable in week view without scrolling");
    }
    await page.evaluate(() => window.scrollTo(0,0));
    await settleMotion(page);
    await page.screenshot({path:shots+"/week-"+width+"x"+height+".png",fullPage:true});
    await page.getByRole("button",{name:"하루",exact:true}).click();
    const activeBefore=await page.locator(".day-strip button.active").count();
    if(activeBefore!==1)throw Error("Date selector must have one active day");
    const oldActive=await page.locator(".day-strip button.active").innerText();
    const targetDay=page.locator(".day-strip button").nth(0);
    await targetDay.click();
    const after=await page.locator(".day-strip button.active").innerText();
    if(after!==(await targetDay.innerText()))throw Error("Date selector did not update");
    if(oldActive!==after)await page.locator(".today-reset").click();
    await page.evaluate(() => window.scrollTo(0,0));
    await settleMotion(page);
    await page.screenshot({path:shots+"/today-fold-"+width+"x"+height+".png"});
    await page.screenshot({path:shots+"/today-"+width+"x"+height+".png",fullPage:true});
    const borderCount=await page.evaluate(()=>{
      const targets=[...document.querySelectorAll(".today-heading,.class-row,.meal-sheet,.day-strip,.week-sheet")];
      return targets.filter(node=>{
        const style=getComputedStyle(node);
        return [style.borderTopWidth,style.borderRightWidth,style.borderBottomWidth,style.borderLeftWidth].some(v=>parseFloat(v)>0);
      }).length;
    });
    if(borderCount)throw Error("Visible structural borders detected: "+borderCount);
    const nav = width<=870 ? ".mobile-bottom button" : ".rail-navigation button";
    await page.locator(nav).nth(1).click();
    await page.locator(".transition-curtain").waitFor({state:"attached",timeout:3000});
    if(await page.locator(".curtain-label").count()!==1)throw Error("No semantic route transition label");
    if((await page.locator(".curtain-label").innerText()).trim()!=="일정")
      throw Error("Transition should announce destination, not decorative branding");
    await page.waitForTimeout(300);
    if(width===390)await page.screenshot({path:shots+"/page-transition-"+width+"x"+height+".png"});
    await page.locator(".calendar-grid").waitFor();
    await page.evaluate(() => window.scrollTo(0,0));
    await settleMotion(page);
    await page.screenshot({path:shots+"/schedule-"+width+"x"+height+".png",fullPage:true});
    await page.locator(nav).nth(3).click();
    await page.locator(".setting-row").first().waitFor();
    await page.locator(".setting-toggle").first().click();
    if ((await page.locator("html").getAttribute("data-theme"))!=="dark")throw Error("Dark-mode toggle broken");
    await page.evaluate(() => window.scrollTo(0,0));
    await settleMotion(page);
    await page.screenshot({path:shots+"/dark-"+width+"x"+height+".png",fullPage:true});
    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    if(overflow)throw Error("Horizontal overflow detected");
    if(errors.length)throw Error("JS errors: "+errors.join("; "));
    await page.emulateMedia({ reducedMotion:"reduce" });
    const duration=await page.locator(".scene").evaluate(el=>getComputedStyle(el).animationDuration);
    if(parseFloat(duration)>0.01)throw Error("Reduced motion ignored: "+duration);
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
