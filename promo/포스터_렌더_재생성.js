const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  await page.goto('file:///C:/Users/komol/Desktop/Github/KOMO_Taxi_calculator/promo/2026-10_커피쿠폰_이벤트_포스터.html');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'C:/Users/komol/Desktop/Github/KOMO_Taxi_calculator/promo/2026-10_커피쿠폰_이벤트_포스터.png' });
  await browser.close();
  console.log('렌더 완료');
})().catch(e => { console.error(e.message); process.exit(1); });
