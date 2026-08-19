import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.FLOW_BASE_URL || 'http://127.0.0.1:4173';
const sample = process.env.EVERYTIME_SAMPLE || 'https://everytime.kr/@de9YHaTAnl47JtxH0muz';
await mkdir('university-audit', { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'ko-KR', isMobile: true, hasTouch: true, colorScheme: 'dark' });
const page = await context.newPage();
const consoleErrors = [], pageErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => pageErrors.push(String(err)));

await page.goto(`${base}/university/`, { waitUntil: 'domcontentloaded' });
const landingTheme = await page.evaluate(() => ({
  dataTheme: document.documentElement.dataset.theme,
  bgVar: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  bodyBackground: getComputedStyle(document.body).backgroundColor,
  colorScheme: getComputedStyle(document.documentElement).colorScheme,
  brand: document.querySelector('.brand-word')?.textContent?.trim() || '',
  brandMarks: document.querySelectorAll('.brand-mark').length,
}));
if (landingTheme.dataTheme !== 'light' || landingTheme.bgVar.toLowerCase() !== '#f5f6f8') throw new Error(`University light theme was overridden: ${JSON.stringify(landingTheme)}`);
if (landingTheme.brand !== 'Flow' || landingTheme.brandMarks !== 0) throw new Error(`Flow branding was not simplified: ${JSON.stringify(landingTheme)}`);

await page.locator('#universitySearch').fill('경북대학교');
await page.locator('#searchBtn').click();
await page.locator('#searchResults .result-button').first().waitFor({ timeout: 15000 });
const firstSchool = await page.locator('#searchResults .result-button strong').first().textContent();
if (firstSchool?.trim() !== '경북대학교') throw new Error(`Unexpected first university result: ${firstSchool}`);
await page.locator('#searchResults .result-button').first().click();
await page.locator('#importDialog').waitFor({ state: 'visible' });
await page.locator('#everytimeUrl').fill(sample);
await page.locator('#runImportBtn').click();
await page.locator('#importDialog').waitFor({ state: 'hidden', timeout: 20000 });

let imported = await page.evaluate(() => JSON.parse(localStorage.getItem('flow-university-timetable-v1') || 'null'));
if (!imported?.subjects?.length) throw new Error('Everytime import did not persist timetable subjects.');
if (!imported.subjects.some((s) => s.times?.length)) throw new Error('Imported timetable has no timed blocks.');
if (imported.semester && !String(imported.semester).includes('학기')) throw new Error(`Semester was not normalized: ${imported.semester}`);

const appTheme = await page.evaluate(() => ({
  bodyBackground: getComputedStyle(document.body).backgroundColor,
  headerBackground: getComputedStyle(document.querySelector('.mobile-header')).backgroundColor,
  navBackground: getComputedStyle(document.querySelector('.bottom-nav')).backgroundColor,
  colorScheme: getComputedStyle(document.documentElement).colorScheme,
}));
const rgbLuma=(value)=>{const n=(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);return n.length<3?0:.2126*n[0]+.7152*n[1]+.0722*n[2]};
if (rgbLuma(appTheme.bodyBackground) < 220 || rgbLuma(appTheme.headerBackground) < 215 || rgbLuma(appTheme.navBackground) < 215) throw new Error(`University mobile Light mode is visually dark: ${JSON.stringify(appTheme)}`);

await page.locator('[data-view="timetable"]').last().click();
await page.locator('.course-block').first().waitFor({ timeout: 10000 });
const mobileWeek = await page.evaluate(() => {
  const blocks=[...document.querySelectorAll('.course-block')];
  const columns=[...document.querySelectorAll('.day-column')];
  const visibleColumns=columns.filter(x=>getComputedStyle(x).display!=='none'&&x.getBoundingClientRect().width>0);
  const visibleBlocks=blocks.filter(x=>getComputedStyle(x).display!=='none'&&x.getBoundingClientRect().width>0);
  const scroll=document.querySelector('#timetableScroll');
  const body=document.querySelector('.grid-body');
  const blockGeometry=visibleBlocks.map(block=>{
    const r=block.getBoundingClientRect(),p=block.parentElement?.getBoundingClientRect();
    return {width:r.width,parentWidth:p?.width||0,left:r.left,right:r.right,parentLeft:p?.left||0,parentRight:p?.right||0};
  });
  return {
    allBlocks:blocks.length,
    visibleBlocks:visibleBlocks.length,
    columns:columns.length,
    visibleColumns:visibleColumns.length,
    columnWidths:visibleColumns.map(x=>Math.round(x.getBoundingClientRect().width*10)/10),
    columnLefts:visibleColumns.map(x=>Math.round(x.getBoundingClientRect().left)),
    maxBlockWidth:Math.max(0,...blockGeometry.map(x=>x.width)),
    maxParentWidth:Math.max(0,...blockGeometry.map(x=>x.parentWidth)),
    blocksOutsideColumn:blockGeometry.filter(x=>x.width>x.parentWidth+1||x.left<x.parentLeft-1||x.right>x.parentRight+1).length,
    gridTemplate:getComputedStyle(body).gridTemplateColumns,
    scrollWidth:scroll?.scrollWidth||0,
    clientWidth:scroll?.clientWidth||0,
    semesterLabel:document.querySelector('#timetableMeta')?.textContent||'',
  };
});
if (mobileWeek.allBlocks < 1 || mobileWeek.visibleBlocks !== mobileWeek.allBlocks) throw new Error(`Mobile timetable hides blocks: ${JSON.stringify(mobileWeek)}`);
if (mobileWeek.columns < 5 || mobileWeek.visibleColumns !== mobileWeek.columns) throw new Error(`Mobile timetable is not a full week: ${JSON.stringify(mobileWeek)}`);
if (new Set(mobileWeek.columnLefts).size !== mobileWeek.columns) throw new Error(`Weekday columns overlap each other: ${JSON.stringify(mobileWeek)}`);
if (mobileWeek.blocksOutsideColumn !== 0 || mobileWeek.maxBlockWidth > mobileWeek.maxParentWidth + 1) throw new Error(`Course blocks escape their weekday columns: ${JSON.stringify(mobileWeek)}`);
if (Math.max(...mobileWeek.columnWidths) > 90) throw new Error(`Mobile weekday columns are suspiciously wide: ${JSON.stringify(mobileWeek)}`);
if (mobileWeek.scrollWidth > mobileWeek.clientWidth + 3) throw new Error(`Mobile timetable still requires horizontal scrolling: ${JSON.stringify(mobileWeek)}`);
if (!mobileWeek.semesterLabel.includes('학기')) throw new Error(`Timetable semester label is malformed: ${mobileWeek.semesterLabel}`);
await page.screenshot({ path: 'university-audit/mobile-timetable.png', fullPage: true });

await page.locator('#addPersonalBtn').click();
await page.locator('#personalDialog').waitFor({state:'visible'});
await page.locator('#personalName').fill('Flow 테스트 일정');
await page.locator('#personalDay').selectOption('0');
await page.locator('#personalStart').fill('17:00');
await page.locator('#personalEnd').fill('18:00');
await page.locator('#personalPlace').fill('학생회관');
await page.locator('#personalForm button[type="submit"]').click();
await page.locator('#personalDialog').waitFor({state:'hidden'});
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('flow-university-timetable-v1')||'{}').subjects?.some(x=>x.name==='Flow 테스트 일정'));
let personalId=await page.evaluate(()=>JSON.parse(localStorage.getItem('flow-university-timetable-v1')).subjects.find(x=>x.name==='Flow 테스트 일정')?.id||'');
if(!personalId)throw new Error('Personal schedule was not added.');
await page.locator(`[data-custom-id="${personalId}"]`).first().click();
await page.locator('#personalName').fill('Flow 테스트 일정 수정');
await page.locator('#personalForm button[type="submit"]').click();
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('flow-university-timetable-v1')||'{}').subjects?.some(x=>x.name==='Flow 테스트 일정 수정'));
await page.locator(`[data-custom-id="${personalId}"]`).first().click();
await page.locator('#deletePersonalBtn').click();
const personalExists=await page.evaluate(id=>JSON.parse(localStorage.getItem('flow-university-timetable-v1')||'{}').subjects?.some(x=>x.id===id),personalId);
if(personalExists)throw new Error('Personal schedule was not deleted.');
if(await page.locator('#exportBackupBtn').count()!==1||await page.locator('#importBackupBtn').count()!==1)throw new Error('Backup controls are missing.');

await page.locator('[data-view="school"]').last().click();
await page.locator('.metric-card').first().waitFor({ timeout: 15000 });
if (await page.locator('.metric-card').count() !== 4) throw new Error('University metric cards are incomplete.');
await page.locator('#chooseMajorBtn').click();
await page.locator('#majorResults .major-button').first().waitFor({ timeout: 20000 });
const majorCount = await page.locator('#majorResults .major-button').count();
if (majorCount < 20) throw new Error(`Too few major results: ${majorCount}`);
await page.locator('#majorResults .major-button').first().click();
await page.screenshot({ path: 'university-audit/mobile-school.png', fullPage: true });

await page.setViewportSize({ width: 1440, height: 900 });
await page.locator('[data-view="timetable"]').first().click();
await page.locator('.course-block').first().waitFor({ timeout: 10000 });
const desktopVisibleBlocks = await page.locator('.course-block:visible').count();
const desktopAllBlocks = await page.locator('.course-block').count();
if (desktopVisibleBlocks !== desktopAllBlocks) throw new Error('Desktop timetable block count is inconsistent.');
await page.screenshot({ path: 'university-audit/desktop-timetable.png', fullPage: true });

imported = await page.evaluate(() => JSON.parse(localStorage.getItem('flow-university-timetable-v1') || 'null'));
const report = {
  firstSchool,
  importedSubjectCount: imported.subjects.length,
  importedTimedBlockCount: imported.subjects.flatMap((s) => s.times || []).length,
  mobileWeek, desktopVisibleBlocks, desktopAllBlocks,
  personalAddEditDelete:true, majorCount, landingTheme, appTheme, consoleErrors, pageErrors, currentPath: new URL(page.url()).pathname,
};
await writeFile('university-audit/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (consoleErrors.length || pageErrors.length) throw new Error(`Browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
await browser.close();
