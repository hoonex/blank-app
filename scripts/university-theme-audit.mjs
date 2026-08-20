import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const edge='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/university-data';
await mkdir('university-audit',{recursive:true});

const search=await fetch(`${edge}?action=search&q=${encodeURIComponent('경북대학교')}&v=6`).then(r=>r.json());
const profile=(search.schools||[]).find(x=>x.name==='경북대학교')||search.schools?.[0];
if(!profile?.id)throw new Error(`Missing real university profile fixture: ${JSON.stringify(search)}`);

const browser=await chromium.launch({headless:true,args:['--force-dark-mode','--enable-features=WebContentsForceDark']});
const results=[];

function rgb(value=''){
  const m=String(value).match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/i);
  return m?m.slice(1,4).map(Number):[NaN,NaN,NaN];
}
function bright([r,g,b]){return (r+g+b)/3}

for(const pref of ['light','dark','system']){
  const context=await browser.newContext({viewport:{width:1280,height:800},locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'dark'});
  await context.addInitScript(({profile,pref})=>{
    const day=(new Date().getDay()+6)%7;
    localStorage.setItem('flow-university-profile-v1',JSON.stringify(profile));
    localStorage.setItem('flow-university-theme-v1',pref);
    localStorage.setItem('flow-university-timetable-v1',JSON.stringify({source:'theme-audit',year:2026,semester:'2학기',subjects:[
      {id:'a',name:'C프로그래밍과실습',professor:'테스트',credit:3,times:[{day,start:'09:00',end:'10:15',startMinutes:540,endMinutes:615,place:'산격동 캠퍼스 IT대학2호관(공대5호관)-210'}]},
      {id:'b',name:'한국사',professor:'테스트',credit:3,times:[{day,start:'16:30',end:'17:45',startMinutes:990,endMinutes:1065,place:'산격동 캠퍼스 제1과학관-120'}]}
    ]}));
  },{profile,pref});
  const page=await context.newPage();
  const consoleErrors=[],pageErrors=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded'});
  await page.locator('.bottom-nav [data-view="campus"]').waitFor({timeout:12000});
  await page.locator('.bottom-nav [data-view="campus"]').click();
  await page.locator('#campusView:not(.hidden)').waitFor({timeout:12000});
  await page.waitForFunction(()=>document.querySelector('link[href*="ui-unify-v2.css"]')&&document.querySelector('link[href*="campus.css"]'),{timeout:10000});
  await page.waitForTimeout(250);
  const state=await page.evaluate(()=>{
    const root=document.documentElement,body=document.body,sidebar=document.querySelector('.sidebar'),main=document.querySelector('.main'),panel=document.querySelector('.campus-next,.campus-section,.campus-map-card'),active=document.querySelector('.flow-theme-segment button.active');
    const cs=getComputedStyle(root);
    return{
      theme:root.dataset.theme||'',mode:root.dataset.themeMode||'',colorScheme:cs.colorScheme,
      bg:getComputedStyle(body).backgroundColor,mainBg:getComputedStyle(main).backgroundColor,
      sidebarBg:getComputedStyle(sidebar).backgroundColor,panelBg:panel?getComputedStyle(panel).backgroundColor:'',
      text:getComputedStyle(body).color,surface:cs.getPropertyValue('--surface').trim(),active:active?.dataset.universityTheme||'',
      metaColorScheme:document.querySelector('meta[name="color-scheme"]')?.content||''
    }
  });
  const expected=pref==='system'?'dark':pref;
  if(state.theme!==expected||state.mode!==pref||state.active!==pref)throw new Error(`Theme state mismatch for ${pref}: ${JSON.stringify(state)}`);
  const b=bright(rgb(state.bg)),s=bright(rgb(state.sidebarBg)),p=bright(rgb(state.panelBg)),t=bright(rgb(state.text));
  if(expected==='light'&&(b<225||s<225||p<225||t>100))throw new Error(`Flow Light was auto-darkened under OS dark/forced dark: ${JSON.stringify({state,b,s,p,t})}`);
  if(expected==='dark'&&(b>90||s>100||p>110||t<180))throw new Error(`Flow Dark palette is inconsistent: ${JSON.stringify({state,b,s,p,t})}`);
  if(consoleErrors.length||pageErrors.length)throw new Error(`Browser errors for ${pref}: ${JSON.stringify({consoleErrors,pageErrors})}`);
  await page.screenshot({path:`university-audit/theme-${pref}.png`,fullPage:true});
  results.push({pref,expected,state,brightness:{body:b,sidebar:s,panel:p,text:t}});
  await context.close();
}
await browser.close();
await writeFile('university-audit/theme-report.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
