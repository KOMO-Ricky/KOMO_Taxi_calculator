const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file:///' + path.join(__dirname, 'header.html').replace(/\\/g, '/'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'header.png', omitBackground: true });
  await browser.close();
  console.log('header.png OK');
})().catch(e => { console.error(e.message); process.exit(1); });
