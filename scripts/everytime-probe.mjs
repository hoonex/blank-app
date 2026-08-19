import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const target = process.env.EVERYTIME_SAMPLE || 'https://everytime.kr/@de9YHaTAnl47JtxH0muz';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: 'ko-KR',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138 Safari/537.36',
});
const page = await context.newPage();
const requests = [];
const responses = [];
const consoleMessages = [];

page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
page.on('request', (req) => {
  const url = req.url();
  if (!url.includes('everytime.kr')) return;
  requests.push({
    method: req.method(),
    url,
    resourceType: req.resourceType(),
    postData: req.postData() || null,
  });
});
page.on('response', async (res) => {
  const url = res.url();
  if (!url.includes('everytime.kr')) return;
  const headers = await res.allHeaders().catch(() => ({}));
  const type = headers['content-type'] || '';
  const item = { status: res.status(), url, contentType: type, bodyPreview: null };
  if (/json|xml|text|javascript/.test(type)) {
    try {
      const text = await res.text();
      item.bodyPreview = text.slice(0, 5000);
    } catch {}
  }
  responses.push(item);
});

await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: 'everytime-rendered.png', fullPage: true });

const dom = await page.evaluate(() => {
  const body = document.querySelector('.tablebody');
  const all = body ? [...body.querySelectorAll('*')] : [];
  return {
    title: document.title,
    url: location.href,
    bodyClass: document.body.className,
    tablebodyHTML: body?.innerHTML || '',
    tablebodyText: body?.innerText || '',
    descendants: all.map((el) => ({
      tag: el.tagName,
      className: el.className || '',
      id: el.id || '',
      style: el.getAttribute('style') || '',
      text: (el.textContent || '').trim().slice(0, 500),
      dataset: { ...el.dataset },
    })).filter((x) => x.style || x.text || x.className),
    resourceUrls: performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.includes('everytime.kr')),
    scripts: [...document.scripts].map((s) => s.src || '[inline]').filter(Boolean),
  };
});

const report = { target, dom, requests, responses, consoleMessages };
await writeFile('everytime-rendered.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  title: dom.title,
  tableText: dom.tablebodyText,
  descendants: dom.descendants.slice(0, 40),
  requests: requests.filter((x) => ['xhr','fetch'].includes(x.resourceType)),
  responsePreviews: responses.filter((x) => x.bodyPreview && !x.url.endsWith('.js')).slice(-12),
  consoleMessages,
}, null, 2));

await browser.close();
