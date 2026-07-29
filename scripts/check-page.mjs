import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:8080/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`PAGE: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`);
});
await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(3000);
const html = await page.innerHTML('#root');
console.log('URL:', url);
console.log('ROOT_HTML_LEN:', html.length);
console.log('HAS_MTTR:', html.includes('MTTR'));
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();