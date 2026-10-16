const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {mkdir}=require('node:fs/promises');
const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4175';
const OUT=process.env.FLOW_TEST_OUT||'school-resource-integration-audit';
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교'},grade:2,className:'6'};
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replaceAll('-','');
function fixture(action){
  if(action==='school-info')return {school:profile.school};
  if(action==='timetable')return {timetable:[{date,period:1,subject:'수학'},{date,period:2,subject:'영어'}]};
  if(action==='meals')return {meals:[{date,type:'중식',dishes:['잡곡밥','국','김치']}]};
  if(action==='events')return {events:[{date,name:'학급 활동'}],scheduleMeta:{mode:'month',count:1}};
  if(action==='dashboard')return {school:profile.school,timetable:fixture('timetable').timetable,meals:fixture('meals').meals,events:fixture('events').events};
  if(action==='media')return {media:{}};
  return {};
}
const kinds=['school-info','timetable','meals','events'];
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.FLOW_CHROMIUM_PATH?{executablePath:process.env.FLOW_CHROMIUM_PATH}: {})}),report=[];
  try{
    await mkdir(OUT,{recursive:true});
    for(const [label,width,height] of [['mobile',390,844],['desktop',1366,768]]){
      const context=await browser.newContext({viewport:{width,height},locale:'ko-KR',timezoneId:'Asia/Seoul'});
      const page=await context.newPage(),errors=[],requests=[];
      page.on('pageerror',e=>errors.push(String(e)));
      await page.addInitScript(({profile})=>{
        localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
        localStorage.setItem('flow-school-theme-v3','light');
        localStorage.setItem('flow-school-transit-lab-v1','off');
      },{profile});
      await page.route('**/functions/v1/school-data*',route=>{
        const action=new URL(route.request().url()).searchParams.get('action')||'';
        if(kinds.includes(action)||action==='dashboard')requests.push(action);
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture(action))});
      });
      await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
      await page.locator('#dashboard:not(.hidden)').waitFor({timeout:12000});
      await page.waitForFunction(()=>document.querySelector('#loadingLine')?.classList.contains('active')===false);
      assert.deepEqual([...requests].sort(),[...kinds].sort(),label+' should request four resources once');
      const initial=await page.evaluate(()=>({
        cacheKeys:Object.keys(localStorage).filter(k=>k.startsWith('flow-school-resource-v1:')).length,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        lessons:document.querySelector('#todayView')?.textContent?.includes('수학'),
      }));
      assert.equal(initial.cacheKeys,4);
      assert.ok(initial.lessons,label+' did not render class data');
      assert.ok(initial.overflow<=2,label+' overflows horizontally');
      await page.screenshot({path:OUT+'/'+label+'-today.png',animations:'disabled'});
      requests.length=0;
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('#dashboard:not(.hidden)').waitFor();
      await page.waitForTimeout(150);
      assert.equal(requests.length,0,label+' reload should not refetch fresh resources');
      await page.evaluate(()=>{
        const key=Object.keys(localStorage).find(k=>k.startsWith('flow-school-resource-v1:meals:'));
        const entry=JSON.parse(localStorage.getItem(key));entry.at=Date.now()-25*3600000;
        localStorage.setItem(key,JSON.stringify(entry));
      });
      requests.length=0;
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelector('#loadingLine')?.classList.contains('active')===false);
      assert.deepEqual(requests,['meals'],label+' should refresh only expired meals');
      requests.length=0;
      await page.evaluate(()=>document.querySelector('#todayBtn')?.click());
      await page.waitForFunction(()=>document.querySelector('#loadingLine')?.classList.contains('active')===false);
      assert.deepEqual([...requests].sort(),[...kinds].sort(),label+' forced Today refresh should reload all');
      assert.equal(errors.length,0,JSON.stringify(errors));
      report.push({label,initial,requestsFromForce:requests.length,errors});
      await context.close();
    }
  }finally{await browser.close();}
  console.log('PASS: School resource integration',JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1});
