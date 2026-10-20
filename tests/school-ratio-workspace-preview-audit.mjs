import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
const viewports = [[390,844],[844,390],[768,1024],[1024,768],[1280,800],[1440,900],[1920,1080]];
const measurements = [];
try {
  for(const [width,height] of viewports) {
    const page = await browser.newPage({viewport:{width,height}});
    await page.goto(process.env.FLOW_TEST_URL || 'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
    await page.evaluate(async () => {
      document.documentElement.dataset.flowRatioWorkspace='preview';
      const style=document.createElement('link');
      style.rel='stylesheet';style.href='/school-ratio-workspace-preview.css';
      document.head.append(style);
      await new Promise(resolve=>{style.onload=resolve;style.onerror=resolve;setTimeout(resolve,1500)});
      document.querySelector('#dashboard')?.classList.remove('hidden');
      document.querySelector('#landing')?.classList.add('hidden');
      document.querySelector('#todayView')?.classList.remove('hidden');
    });
    await page.waitForTimeout(250);
    const result=await page.evaluate(()=>{
      const root=document.documentElement;
      const grid=document.querySelector('.today-grid');
      const nav=document.querySelector('#bottomNav');
      const side=document.querySelector('#desktopSidebar');
      return {
        overflow:root.scrollWidth-root.clientWidth,
        columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        navVisible:getComputedStyle(nav).display!=='none',
        sideVisible:getComputedStyle(side).display!=='none',
      };
    });
    if(result.overflow>1)throw new Error('Horizontal overflow '+width+'x'+height+': '+JSON.stringify(result));
    if(result.navVisible===result.sideVisible)throw new Error('Ambiguous navigation '+width+'x'+height+': '+JSON.stringify(result));
    measurements.push({width,height,...result});
    await page.close();
  }
  console.log(JSON.stringify({status:'PASS',measurements},null,2));
} finally {await browser.close();}
