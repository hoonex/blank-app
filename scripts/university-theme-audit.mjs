import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
await mkdir('university-audit',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--force-dark-mode','--enable-features=WebContentsForceDark']});
const results=[];

function rgb(value=''){
  const m=String(value).match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/i);
  return m?m.slice(1,4).map(Number):[NaN,NaN,NaN];
}
function bright([r,g,b]){return (r+g+b)/3}
function isOnlyLight(value){return String(value).trim().split(/\s+/).sort().join(' ')==='light only'}

for(const pref of ['light','dark','system']){
  const context=await browser.newContext({viewport:{width:1280,height:800},locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'dark'});
  const page=await context.newPage();
  const consoleErrors=[],pageErrors=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded'});
  await page.evaluate(pref=>localStorage.setItem('flow-university-theme-v1',pref),pref);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#setupView:not(.hidden)').waitFor({timeout:10000});
  await page.locator('.setup-header .flow-theme-cycle').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>document.querySelector('link[href*="ui-unify-v2.css"]'),{timeout:10000});
  await page.evaluate(()=>{
    let sample=document.querySelector('#themeSurfaceSample');
    if(sample)return;
    sample=document.createElement('article');sample.id='themeSurfaceSample';sample.className='panel campus-section';sample.textContent='Theme surface sample';
    sample.style.cssText='position:fixed;right:20px;bottom:20px;width:220px;height:90px;padding:20px;z-index:9999';document.body.append(sample);
  });
  await page.waitForTimeout(250);
  const state=await page.evaluate(()=>{
    const root=document.documentElement,body=document.body,card=document.querySelector('.search-card'),sample=document.querySelector('#themeSurfaceSample'),cycle=document.querySelector('.setup-header .flow-theme-cycle');
    const cs=getComputedStyle(root);
    return{
      theme:root.dataset.theme||'',mode:root.dataset.themeMode||'',colorScheme:cs.colorScheme,
      bg:getComputedStyle(body).backgroundColor,cardBg:getComputedStyle(card).backgroundColor,sampleBg:getComputedStyle(sample).backgroundColor,
      text:getComputedStyle(body).color,surface:cs.getPropertyValue('--surface').trim(),cycleText:cycle?.textContent?.trim()||'',
      metaColorScheme:document.querySelector('meta[name="color-scheme"]')?.content||''
    }
  });
  const expected=pref==='system'?'dark':pref,expectedLabel=pref==='system'?'System':pref==='dark'?'Dark':'Light';
  if(state.theme!==expected||state.mode!==pref||state.cycleText!==expectedLabel)throw new Error(`Theme state mismatch for ${pref}: ${JSON.stringify(state)}`);
  const expectedColorScheme=expected==='dark'?'dark':'only light';
  if(state.metaColorScheme!==expectedColorScheme)throw new Error(`University color-scheme metadata was not synchronized: ${JSON.stringify({expectedColorScheme,state})}`);
  if(expected==='light'&&!state.colorScheme.includes('light'))throw new Error(`Explicit Light did not force a light color scheme: ${JSON.stringify(state)}`);
  if(expected==='dark'&&!state.colorScheme.includes('dark'))throw new Error(`Dark/System did not expose a dark color scheme: ${JSON.stringify(state)}`);
  const b=bright(rgb(state.bg)),c=bright(rgb(state.cardBg)),p=bright(rgb(state.sampleBg)),t=bright(rgb(state.text));
  if(expected==='light'&&(b<225||c<220||p<220||t>100))throw new Error(`Flow Light was auto-darkened under OS dark/forced dark: ${JSON.stringify({state,b,c,p,t})}`);
  if(expected==='dark'&&(b>90||c>110||p>110||t<180))throw new Error(`Flow Dark palette is inconsistent: ${JSON.stringify({state,b,c,p,t})}`);
  if(consoleErrors.length||pageErrors.length)throw new Error(`Browser errors for ${pref}: ${JSON.stringify({consoleErrors,pageErrors})}`);
  await page.screenshot({path:`university-audit/theme-${pref}.png`,fullPage:true});
  const result={pref,expected,state,brightness:{body:b,card:c,panel:p,text:t}};
  if(pref==='dark'){
    await page.locator('.setup-header .flow-theme-cycle').click();
    await page.waitForTimeout(120);
    const live=await page.evaluate(()=>{
      const root=document.documentElement,body=document.body,card=document.querySelector('.search-card'),cycle=document.querySelector('.setup-header .flow-theme-cycle'),cs=getComputedStyle(root);
      return{theme:root.dataset.theme||'',mode:root.dataset.themeMode||'',saved:localStorage.getItem('flow-university-theme-v1')||'',colorScheme:cs.colorScheme,inlineColorScheme:root.style.colorScheme,metaColorScheme:document.querySelector('meta[name="color-scheme"]')?.content||'',bg:getComputedStyle(body).backgroundColor,cardBg:getComputedStyle(card).backgroundColor,cycleText:cycle?.textContent?.trim()||''};
    });
    if(live.theme!=='light'||live.mode!=='light'||live.saved!=='light'||!isOnlyLight(live.inlineColorScheme)||live.metaColorScheme!=='only light'||!live.colorScheme.includes('light')||bright(rgb(live.bg))<225||bright(rgb(live.cardBg))<220)throw new Error(`University Dark -> Light live transition stayed dark: ${JSON.stringify(live)}`);
    await page.screenshot({path:'university-audit/theme-dark-to-light-live.png',fullPage:true});
    result.liveDarkToLight=live;
  }
  results.push(result);
  await context.close();
}
await browser.close();
await writeFile('university-audit/theme-report.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
