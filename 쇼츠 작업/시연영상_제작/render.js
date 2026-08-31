// 합성 페이지를 프레임 단위로 렌더링 → JPEG 시퀀스
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FPS = 30;
const OUT = path.join(__dirname, 'comp_frames');
const args = process.argv.slice(2);              // 옵션: --preview (2fps 미리보기)
const PREVIEW = args.includes('--preview');

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
  await page.goto('file:///' + path.join(__dirname, process.env.COMP_FILE || 'comp.html').replace(/\\/g, '/'));
  const ready = await page.evaluate(() => window.READY);
  console.log('page:', ready);
  const total = await page.evaluate(() => window.TOTAL);

  const fps = PREVIEW ? 2 : FPS;
  const n = Math.ceil(total * fps);
  console.log(`rendering ${n} frames @ ${fps}fps (total ${total}s)`);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    await page.evaluate((tt) => window.SEEK(tt), t);
    await page.screenshot({
      path: path.join(OUT, 'f' + String(i).padStart(5, '0') + '.jpg'),
      type: 'jpeg', quality: 93,
    });
    if (i % 60 === 0) console.log(`  ${i}/${n}  (${((Date.now()-t0)/1000).toFixed(0)}s)`);
  }
  console.log(`done: ${n} frames in ${((Date.now()-t0)/1000).toFixed(0)}s`);
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
