import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.FLOW_BASE_URL || 'http://127.0.0.1:4173';
const sample = process.env.EVERYTIME_SAMPLE || 'https://everytime.kr/@de9YHaTAnl47JtxH0muz';
await mkdir('university-audit', { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  locale: 'ko-KR',
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => pageErrors.push(String(err)));

await page.goto(`${base}/university/`, { waitUntil: 'domcontentloaded' });
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

const imported = await page.evaluate(() => JSON.parse(localStorage.getItem('flow-university-timetable-v1') || 'null'));
if (!imported?.subjects?.length) throw new Error('Everytime import did not persist timetable subjects.');
if (!imported.subjects.some((s) => s.times?.length)) throw new Error('Imported timetable has no timed blocks.');

await page.locator('[data-view="timetable"]').last().click();
await page.locator('.course-block').first().waitFor({ timeout: 10000 });
const mobileBlocks = await page.locator('.course-block').count();
if (mobileBlocks < 1) throw new Error('No mobile timetable blocks rendered.');
await page.screenshot({ path: 'university-audit/mobile-timetable.png', fullPage: true });

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
await page.waitForTimeout(250);
const desktopBlocks = await page.locator('.course-block').count();
if (desktopBlocks < mobileBlocks) throw new Error('Desktop timetable lost blocks.');
await page.screenshot({ path: 'university-audit/desktop-timetable.png', fullPage: true });
await page.locator('[data-view="school"]').first().click();
await page.waitForTimeout(250);
await page.screenshot({ path: 'university-audit/desktop-school.png', fullPage: true });

const report = {
  firstSchool,
  importedSubjectCount: imported.subjects.length,
  importedTimedBlockCount: imported.subjects.flatMap((s) => s.times || []).length,
  mobileBlocks,
  desktopBlocks,
  majorCount,
  consoleErrors,
  pageErrors,
  currentPath: new URL(page.url()).pathname,
};
await writeFile('university-audit/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (consoleErrors.length || pageErrors.length) throw new Error(`Browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
await browser.close();
