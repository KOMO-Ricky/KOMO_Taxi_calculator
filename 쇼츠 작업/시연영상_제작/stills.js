// 완성 컷 4장 스틸 캡처 (780x1688 @DSF2)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await ctx.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = '#toast{display:none!important} ::-webkit-scrollbar{display:none!important}';
      document.head.appendChild(st);
    });
  });
  const page = await ctx.newPage();
  const W = (ms) => page.waitForTimeout(ms);
  const q = async (sel) => { await page.click(sel); await W(320); };
  const shot = (n) => page.screenshot({ path: path.join(__dirname, n + '.png') });

  await page.goto('https://calculator.licen.co.kr', { waitUntil: 'networkidle' });
  await W(1500);
  await q('text=개인택시 준비자금 계산하기');

  const fillCfg = async (fuel, pay, monthsIdx) => {
    await q('#item_license');
    await page.selectOption('#licRegion', '서울특별시'); await W(300);
    await q('button.modal-save');
    await q('#item_car');
    await q(`#modalContent button:has-text("${fuel}")`);
    await q("#modalContent [onclick*=\"selMaker('현대')\"]");
    await q('#modalContent [onclick*="selCar"]');
    await page.selectOption('#payType', pay); await W(350);
    if (monthsIdx >= 0) {
      const mb = await page.$$('#modalContent [onclick*="selMonths"]');
      await mb[monthsIdx].click(); await W(350);
    }
    await q('#modalContent button.modal-save');
    await q('#item_ins');
    await q('#modalContent button:has-text("공제보험")');
    await q('#modalContent button.modal-save');
    await q('#item_work');
    await q('#w_bb');
    await q('#modalContent .tog-btn:has-text("5채널")');
    await q('#w_hi');
    await q('#modalContent button.modal-save');
  };

  // 1번 구성: LPG 쏘나타 전액할부 36개월 + 공제 + 작업(5채널·하이패스)
  await fillCfg('LPG', '전액할부', 2);
  // 2번 구성: 전기 아이오닉5 전액할부 60개월
  await page.$eval('#cfgRow', el => el.scrollIntoView({ block: 'center' })); await W(300);
  await q('#cfgRow .cfg-tab:nth-child(2)');
  await fillCfg('전기', '전액할부', 4);
  await q('#cfgRow .cfg-tab:nth-child(1)');
  await W(500);

  // ── 컷A: 완성된 보험/조합 모달 (상단 그대로)
  await page.$eval('#item_ins', el => el.scrollIntoView({ block: 'center' })); await W(300);
  await q('#item_ins');
  await page.evaluate(() => { const el = document.querySelector("#modalContent"); const sc = el.scrollHeight > el.clientHeight ? el : el.parentElement; sc.scrollTop = 0; el.scrollTop = 0; });
  await W(600);
  await shot('still_ins');
  await q('#modalContent button.modal-close');

  // ── 컷B: 완성된 작업비 모달 (상단 그대로)
  await q('#item_work');
  await page.evaluate(() => { const el = document.querySelector("#modalContent"); const sc = el.scrollHeight > el.clientHeight ? el : el.parentElement; sc.scrollTop = 0; el.scrollTop = 0; });
  await W(600);
  await shot('still_work');
  await q('#modalContent button.modal-close');

  // ── 컷C: 완성된 비교표 (헤더 상단)
  await page.$eval('#compareBtn', el => el.scrollIntoView({ block: 'center' })); await W(300);
  await q('#compareBtn');
  await W(1200);
  await page.$eval('#cmpPage', el => {
    const head = el.querySelector('.c2row.head');
    if (head) head.scrollIntoView({ behavior: 'instant', block: 'start' });
    el.scrollTop = Math.max(0, el.scrollTop - 48);
  });
  await W(500);
  await shot('still_cmp');
  await page.evaluate(() => closeCompare()); await W(600);

  // ── 컷D: 견적 구성 페이지 (상단 구성 탭, 하단 남색 총액표)
  await page.$eval('#cfgRow', el => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -18));
  await W(500);
  await shot('still_cfg');

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
