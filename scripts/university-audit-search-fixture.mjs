import { chromium } from 'playwright';

const SEARCH_EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/university-data';
const SEARCH_FIXTURE=Object.freeze({
  surveyYear:'2025',
  total:1,
  schools:[{
    id:'0000005',
    name:'경북대학교',
    englishName:'Kyungpook National University',
    kind:'대학교',
    division:'대학',
    foundation:'국립',
    founded:'1946-05-28',
    campus:'본교',
    region:'대구광역시',
    address:'대구광역시 북구 대학로 80 (산격동, 경북대학교)',
    postalCode:'41566',
    phone:'053-950-5114',
    fax:'053-950-2149',
    homepage:'https://www.knu.ac.kr',
    surveyYear:'2025'
  }]
});

const nativeLaunch=chromium.launch.bind(chromium);
chromium.launch=async(...launchArgs)=>{
  const browser=await nativeLaunch(...launchArgs);
  const nativeNewContext=browser.newContext.bind(browser);
  browser.newContext=async(...contextArgs)=>{
    const context=await nativeNewContext(...contextArgs);
    const nativeNewPage=context.newPage.bind(context);
    context.newPage=async(...pageArgs)=>{
      const page=await nativeNewPage(...pageArgs);
      await page.route(`${SEARCH_EDGE}?*`,async route=>{
        const url=new URL(route.request().url());
        if(url.searchParams.get('action')!=='search')return route.continue();
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SEARCH_FIXTURE)});
      });
      return page;
    };
    return context;
  };
  return browser;
};
