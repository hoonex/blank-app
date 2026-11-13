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
  let busSearchCalls=0,busArrivalCalls=0;
  await page.route("**/api/bus/search?*",route=>{
    busSearchCalls++;
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
      ok:true,stops:[{id:"7011007300",name:"동대구역건너",number:"02094"},
                     {id:"7011007200",name:"동대구역앞",number:"20669"}]
    })});
  });
  await page.route("**/api/bus/arrivals?*",route=>{
    busArrivalCalls++;
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
      ok:true,blocked:false,fetchedAt:"2026-11-12T16:30:00.000Z",
      buses:[{route:"413",state:"운행종료",previousStop:"운행종료",remainingStops:null,note:""},
             {route:"618",state:"4분 후 도착",previousStop:"정류장 앞",remainingStops:2,note:""}]
    })});
  });
  try {
    await page.goto(base,{waitUntil:"networkidle",timeout:30000});
    await page.locator(".today-heading h1").waitFor({state:"visible",timeout:20000});
    const h1 = await page.locator(".today-heading h1").innerText();
    if(!/\d{2}\.\d{2}/.test(h1))throw Error("Unexpected kinetic date heading "+h1);
    if(await page.locator(".day-strip button").count()!==5)throw Error("Five-day centered date selector missing");
    if(await page.locator(".today-heading .date-actions").count()!==0)
      throw Error("Unnecessary previous/today/next buttons remain in Today");
    if(await page.locator(".class-row").count()!==7)throw Error("Fixture timetable not fully visible");
    if(await page.locator(".hero-shape,.class-arrow,.class-type,.curtain-copy").count()!==0)
      throw Error("Superfluous ornament or false click affordance remains");
    if(width===390){
      if(await page.locator('a[href="/legacy"],a[href="/transit"],a[href*="schoolinfo.go.kr"]').count())
        throw Error("Old Flow or external school links remain in the native app");
      await page.getByRole("button",{name:"과목 수정"}).click();
      await page.locator(".editor-periods button").nth(1).click();
      await page.locator("#subject-draft").fill("인공지능 실습");
      await page.locator(".editor-save").click();
      if(await page.locator(".class-row").filter({hasText:"인공지능 실습"}).count()!==1)
        throw Error("Native timetable edit did not update Today");
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("flow-school-timetable-overrides-v1")||"[]"));
      if(!saved.some(x=>x.subject==="인공지능 실습"))
        throw Error("Timetable editing did not persist to local storage");
      await page.reload({waitUntil:"networkidle"});
      await page.locator(".class-row").filter({hasText:"인공지능 실습"}).waitFor();
      await page.getByRole("button",{name:"과목 수정"}).click();
      await page.locator(".editor-periods button").nth(1).click();
      if((await page.locator("#subject-draft").inputValue())!=="인공지능 실습")
        throw Error("Timetable editing was lost after reload");
      await page.locator(".editor-reset").click();
      if(await page.locator(".class-row").filter({hasText:"인공지능 실습"}).count())
        throw Error("Restore did not recover provider's original lesson");
      const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem("flow-school-timetable-overrides-v1")||"[]"));
      if(restored.some(x=>x.subject==="인공지능 실습"))
        throw Error("Reset left override in localStorage");
      await page.locator(".editor-close").click();
    }
    const geometry=await page.evaluate(()=>{
      const radius=s=>parseFloat(getComputedStyle(document.querySelector(s)).borderTopLeftRadius);
      return {hero:radius(".today-heading"),meal:radius(".meal-sheet"),item:radius(".class-row"),control:radius(".day-strip button.active")};
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
    if(await page.locator(".week-grid-header button").count()!==5)
      throw Error("Week view must show five weekday column headers");
    if(await page.locator(".week-grid-row:not(.week-grid-header)").count()<7)
      throw Error("Week grid needs seven or more periods");
    if(await page.locator(".week-cell:not(.empty)").count()<7)
      throw Error("Week grid lost real fixture subjects");
    const weekGeometry=await page.locator(".week-grid-row:not(.week-grid-header)").first().evaluate(el=>{
      const cells=[...el.querySelectorAll("button")];
      return {count:cells.length,widths:cells.map(x=>x.getBoundingClientRect().width),
        bodyWidth:document.documentElement.scrollWidth,viewport:window.innerWidth};
    });
    if(weekGeometry.count!==5 || Math.max(...weekGeometry.widths)-Math.min(...weekGeometry.widths)>3)
      throw Error("Five-day calendar columns are inconsistent: "+JSON.stringify(weekGeometry));
    if(width===390) {
      const chosen=await page.locator(".week-grid-header button.today").boundingBox();
      if(!chosen || chosen.y+chosen.height>844-58)throw Error("Selected day is not discoverable in week view without scrolling");
    }
    await page.evaluate(() => {
      window.scrollTo(0,0);
    });
    await settleMotion(page);
    await page.screenshot({path:shots+"/week-"+width+"x"+height+".png",fullPage:true});
    await page.getByRole("button",{name:"하루",exact:true}).click();
    if(await page.locator(".day-strip button.active").count()!==1)
      throw Error("Date selector must have one active day");
    const oldActive=await page.locator(".day-strip button.active").innerText();
    const targetDay=page.locator(".day-strip button").nth(0);
    const desired=await targetDay.innerText();
    await targetDay.click();
    const after=await page.locator(".day-strip button.active").innerText();
    if(after!==desired||after===oldActive)
      throw Error("Carousel tap did not recenter clicked day: "+oldActive+" => "+after);
    // The old center day is now the rightmost visible day after moving -2.
    await page.locator(".day-strip button").nth(4).click();
    const restored=await page.locator(".day-strip button.active").innerText();
    if(restored!==oldActive)throw Error("Date carousel did not allow returning via touch-sized items");
    await page.evaluate(() => {
      window.scrollTo(0,0);
    });
    await settleMotion(page);
    await page.screenshot({path:shots+"/today-fold-"+width+"x"+height+".png"});
    await page.screenshot({path:shots+"/today-"+width+"x"+height+".png",fullPage:true});

    if(width===768||width===844){
      const align=await page.evaluate(()=>{
        const a=document.querySelector(".timetable-sheet").getBoundingClientRect();
        const b=document.querySelector(".meal-sheet").getBoundingClientRect();
        return {sameRow:Math.abs(a.top-b.top)<70,ratio:b.width/window.innerWidth};
      });
      if(!align.sameRow || align.ratio<.27)throw Error("Tablet information columns are not balanced: "+JSON.stringify(align));
    }
    if(width===390){
      const mealBullet=await page.locator(".meal-list li").first().evaluate(el=>getComputedStyle(el,"::before").content);
      if(mealBullet!=="none"&&mealBullet!=="normal")
        throw Error("Meal bullet pseudo-element remained: "+mealBullet);
      const accent=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase());
      if(accent!=="#d98570")throw Error("Muted terracotta accent not applied: "+accent);
      const navBar=page.locator(".mobile-bottom");
      const base=await navBar.boundingBox();
      const initial=await navBar.evaluate(el=>getComputedStyle(el).position);
      if(initial!=="fixed")throw Error("Mobile dock must float, not occupy a layout row: "+initial);
      await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"}));
      await page.waitForTimeout(200);
      const scrolled=await navBar.boundingBox();
      const metric=await page.evaluate(()=>({
        height:window.innerHeight,scrollTop:window.scrollY,
        contentBottom:document.querySelector(".today-aside").getBoundingClientRect().bottom,
        bottomPadding:parseFloat(getComputedStyle(document.querySelector(".flow-main")).paddingBottom)
      }));
      if(!scrolled||!base||metric.scrollTop<100||Math.abs(scrolled.y-base.y)>3||
          Math.abs(scrolled.y+scrolled.height-(metric.height-10))>11||
          scrolled.x<10||scrolled.x+scrolled.width>width+1||
          metric.contentBottom>scrolled.y-6||metric.bottomPadding<80)
        throw Error("Floating nav covers content or drifts: "+JSON.stringify({base,scrolled,metric}));
      await page.screenshot({path:shots+"/nav-at-content-bottom-390x844.png"});
      await page.setViewportSize({width:390,height:752});
      await page.waitForTimeout(200);
      const smaller=await navBar.boundingBox();
      if(!smaller||Math.abs(smaller.y+smaller.height-(752-10))>12)
        throw Error("Floating dock drifted after viewport resize: "+JSON.stringify(smaller));
      await page.setViewportSize({width,height});
      await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
      const buttons=await page.locator(".day-strip button").evaluateAll(nodes=>
        nodes.map(el=>el.getBoundingClientRect().width));
      if(buttons.length!==5||Math.min(...buttons)<52)
        throw Error("Date buttons still too cramped on 390px: "+JSON.stringify(buttons));
      await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
    }
    const borderCount=await page.evaluate(()=>{
      const targets=[...document.querySelectorAll(".today-heading,.class-row,.meal-sheet,.day-strip,.week-sheet")];
      return targets.filter(node=>{
        const style=getComputedStyle(node);
        return [style.borderTopWidth,style.borderRightWidth,style.borderBottomWidth,style.borderLeftWidth].some(v=>parseFloat(v)>0);
      }).length;
    });
    if(borderCount)throw Error("Visible structural borders detected: "+borderCount);
    const nav = width<=870 ? ".mobile-bottom button" : ".rail-navigation button";
    if(width===390)await page.evaluate(()=>window.scrollTo({top:150,behavior:"instant"}));
    await page.locator(nav).nth(1).click();
    if(width===390){
      await page.waitForFunction(()=>window.scrollY===0,{timeout:1800});
      const top=await page.evaluate(()=>window.scrollY);
      if(top!==0)throw Error("Tab switch inherited the previous scroll offset: "+top);
    }
    await page.locator(".scene[data-scene='calendar']").waitFor({state:"visible",timeout:3000});
    if(await page.locator(".transition-curtain").count()!==0)
      throw Error("Old full-screen transition curtain still blocks page");
    const transitionName=await page.locator(".scene").evaluate(el=>getComputedStyle(el).animationName);
    if(!transitionName.includes("scene-reveal"))
      throw Error("Page transition is missing its direct spatial entrance: "+transitionName);
    await page.waitForTimeout(135);
    if(width===390)await page.screenshot({path:shots+"/page-transition-"+width+"x"+height+".png"});
    await page.locator(".calendar-grid").waitFor();
    if(width===390){
      const logo=await page.locator(".brand-lockup").boundingBox();
      const header=await page.locator(".global-header").boundingBox();
      if(!logo||!header||logo.x>35||logo.y<header.y-1)
        throw Error("Mobile logo clipped or centered: "+JSON.stringify({logo,header}));
    }
    if(width===390){
      const summary=await page.locator(".calendar-event-text").filter({hasText:"시험 일정"}).first();
      const dot=await summary.evaluate(el=>{
        const cs=getComputedStyle(el);return {width:el.getBoundingClientRect().width,
          height:el.getBoundingClientRect().height,bg:cs.backgroundColor, fontSize:cs.fontSize};
      });
      if(dot.width>9||dot.height>9||parseFloat(dot.fontSize)>1)
        throw Error("Small-screen calendar event marker should be a restrained dot: "+JSON.stringify(dot));
    }
    const initialDate=await page.locator(".picked-date h2").innerText();
    const alternative=page.locator(".calendar-grid button:not(.selected):not(.out-month)").first();
    const day=(await alternative.locator(".calendar-num").innerText()).trim();
    await alternative.click();
    const selectedDate=await page.locator(".picked-date h2").innerText();
    if(selectedDate===initialDate||!selectedDate.endsWith(day))
      throw Error("Calendar detail did not follow selection: "+initialDate+" -> "+selectedDate);
    if(await page.locator(".calendar-grid button.selected").count()!==1)
      throw Error("Calendar must show one selected date");
    if(!(await page.locator(".event-lines").innerText()).trim())
      throw Error("Calendar selection must give contextual event feedback");
    const initialMonth=await page.locator(".calendar-toolbar h2").innerText();
    await page.locator(".calendar-grid button.out-month").last().click();
    if((await page.locator(".calendar-toolbar h2").innerText())===initialMonth)
      throw Error("Calendar next month not selected");
    await page.getByRole("button",{name:"이번 달",exact:true}).click();
    if((await page.locator(".calendar-toolbar h2").innerText())!==initialMonth)
      throw Error("Month reset failed");
    const monthControl=await page.locator(".month-actions .month-chevron").first().evaluate(el=>{
      const r=el.getBoundingClientRect(),style=getComputedStyle(el);
      return {display:style.display,radius:parseFloat(style.borderRadius),width:r.width};
    });
    if(width<=870&&monthControl.display!=="none")
      throw Error("Mobile month buttons still show sticky black background");
    if(width>870&&monthControl.radius<16)
      throw Error("Desktop month controls are not round");
    await page.evaluate(() => {
      window.scrollTo(0,0);
    });
    await settleMotion(page);
    await page.screenshot({path:shots+"/schedule-"+width+"x"+height+".png",fullPage:true});
    await page.locator(nav).nth(2).click();
    await page.locator("#bus-stop-query").waitFor();
    if(await page.locator('a[href*="businfo.daegu.go.kr"]').count()!==0)
      throw Error("Bus control still sends users outside Flow");
    await page.locator("#bus-stop-query").fill("동대구");
    await page.locator(".bus-search button").click();
    await page.locator(".bus-stop-option").first().waitFor();
    if(busSearchCalls!==1)throw Error("Bus search requested multiple times");
    await page.locator(".bus-stop-option").first().click();
    await page.locator(".bus-arrival").first().waitFor();
    const busText=await page.locator(".bus-arrivals").innerText();
    if(!busText.includes("413")||!busText.includes("운행종료")||
       !busText.includes("618")||busArrivalCalls!==1)
      throw Error("Bus arrivals UI did not render real response schema: "+busText);
    if(width===390)await page.screenshot({path:shots+"/bus-390x844.png"});
    await page.locator(nav).nth(3).click();
    await page.locator(".setting-row").first().waitFor();
    const links=await page.locator(".scene[data-scene='settings'] a[href]")
      .evaluateAll(items=>items.map(el=>el.getAttribute("href")));
    if(links.length!==1||links[0]!=="/university")
      throw Error("Only Flow University may link outside School: "+JSON.stringify(links));
    await page.locator(".setting-toggle").first().click();
    if ((await page.locator("html").getAttribute("data-theme"))!=="dark")throw Error("Dark-mode toggle broken");
    await page.evaluate(() => {
      window.scrollTo(0,0);
    });
    await settleMotion(page);
    await page.screenshot({path:shots+"/dark-"+width+"x"+height+".png",fullPage:true});
    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    if(overflow)throw Error("Horizontal overflow detected");
    if(errors.length)throw Error("JS errors: "+errors.join("; "));
    // Touch-only regression: the drag thumb follows a finger, and a horizontal
    // page gesture changes a tab without replacing vertical scroll.
    if(width===390){
      const cdp=await page.context().newCDPSession(page);
      await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
      async function touchSlide(x1,y1,x2,y2){
        const id=7;
        await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:x1,y:y1,id}]});
        for(let n=1;n<=6;n++){
          const p=n/6;
          await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{
            x:x1+(x2-x1)*p,y:y1+(y2-y1)*p,id
          }]});
        }
        await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
        await page.waitForTimeout(80);
      }
      // Settings was active after theme test. Drag the nav indicator to Schedule.
      let navRect=await page.locator(".mobile-bottom").boundingBox();
      await touchSlide(navRect.x+navRect.width*.875,navRect.y+navRect.height*.5,
                      navRect.x+navRect.width*.375,navRect.y+navRect.height*.5);
      if((await page.locator(".mobile-bottom button.active").innerText())!=="일정")
        throw Error("Finger drag of bottom navigation failed");
      if(await page.locator(".mobile-bottom").getAttribute("data-dragging")!=="false")
        throw Error("Navigation thumb remains in dragging state");
      // Swipe horizontally on the actual schedule page, not a control.
      const scene=await page.locator(".scene-head").boundingBox();
      const sy=scene.y+Math.min(scene.height*.6,45);
      await touchSlide(325,sy,75,sy+3);
      if((await page.locator(".mobile-bottom button.active").innerText())!=="학교")
        throw Error("Page swipe did not navigate to the adjacent tab");
      navRect=await page.locator(".mobile-bottom").boundingBox();
      await touchSlide(navRect.x+navRect.width*.625,navRect.y+navRect.height*.5,
                      navRect.x+navRect.width*.125,navRect.y+navRect.height*.5);
      if((await page.locator(".mobile-bottom button.active").innerText())!=="오늘")
        throw Error("Cannot drag back to Today");
      // The five-day strip accepts a genuine horizontal swipe without stealing tab swipes.
      const beforeDate=await page.locator(".hero-numeral").innerText();
      const strip=await page.locator(".day-carousel").boundingBox();
      await touchSlide(strip.x+strip.width*.79,strip.y+strip.height*.5,
                      strip.x+strip.width*.24,strip.y+strip.height*.5);
      const advanced=await page.locator(".hero-numeral").innerText();
      if(advanced===beforeDate)throw Error("Swiping left on date rail did not advance day");
      if((await page.locator(".mobile-bottom button.active").innerText())!=="오늘")
        throw Error("Date swipe incorrectly switched top-level tabs");
      await touchSlide(strip.x+strip.width*.22,strip.y+strip.height*.5,
                      strip.x+strip.width*.8,strip.y+strip.height*.5);
      if((await page.locator(".hero-numeral").innerText())!==beforeDate)
        throw Error("Date rail could not swipe right to previous day");
      // The Day/Week pill also accepts physical dragging.
      const toggle=await page.locator(".switch-track").boundingBox();
      await touchSlide(toggle.x+toggle.width*.25,toggle.y+toggle.height*.5,
                      toggle.x+toggle.width*.75,toggle.y+toggle.height*.5);
      if(!(await page.locator(".week-grid").isVisible()))
        throw Error("Day/Week segmented drag did not switch to Week");
      if(await page.locator(".switch-track").getAttribute("data-dragging")!=="false")
        throw Error("Segmented control never released drag");
      const tap=await page.locator(".mobile-bottom button").first().evaluate(el=>
        getComputedStyle(el).getPropertyValue("-webkit-tap-highlight-color"));
      if(!/rgba?\(0, 0, 0, 0\)|transparent/.test(tap))
        throw Error("Mobile tap flash is still visible: "+tap);
      const suppress=await page.locator(".flow-shell").evaluate(el=>{
        const event=new MouseEvent("contextmenu",{bubbles:true,cancelable:true});
        el.dispatchEvent(event);return event.defaultPrevented;
      });
      if(!suppress)throw Error("Mobile long press still opens native context menu");
      await cdp.detach();
    }
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
