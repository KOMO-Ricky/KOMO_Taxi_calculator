// 재녹화 v3: 흰색 SVG 손 커서(축소) + 탭 전 중앙 스크롤
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'scenes4');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  });

  await ctx.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `
        #toast{display:none!important}
        ::-webkit-scrollbar{display:none!important}
        .__tap{position:fixed;width:56px;height:56px;border-radius:50%;pointer-events:none;z-index:999997;
          background:radial-gradient(circle, rgba(21,32,61,.32) 0%, rgba(21,32,61,.14) 55%, transparent 70%);
          border:2px solid rgba(21,32,61,.5);
          transform:translate(-50%,-50%) scale(.4);opacity:1;animation:__tapAni .5s ease-out forwards}
        @keyframes __tapAni{to{transform:translate(-50%,-50%) scale(1.35);opacity:0}}
        #__hand{position:fixed;z-index:999998;width:52px;height:52px;pointer-events:none;opacity:0;left:0;top:0;
          filter:drop-shadow(0 4px 9px rgba(0,0,0,.38));
          transition:left .5s cubic-bezier(.3,.7,.3,1), top .5s cubic-bezier(.3,.7,.3,1), opacity .3s, transform .12s ease;
          transform:translate(-45%,-9%);}
        #__hand.press{transform:translate(-45%,-9%) scale(.8);}`;
      document.head.appendChild(st);
      const h = document.createElement('div');
      h.id = '__hand';
      h.innerHTML = '<svg viewBox="0 0 24 24" width="52" height="52">' +
        '<path paint-order="stroke" stroke="#15203D" stroke-width="1.5" fill="#FFFFFF" ' +
        'd="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z"/></svg>';
      document.body.appendChild(h);
      window.__hand = {
        moveTo(x, y) { h.style.opacity = '1'; h.style.left = x + 'px'; h.style.top = y + 'px'; },
        press() { h.classList.add('press'); },
        release() { h.classList.remove('press'); },
        hide() { h.style.opacity = '0'; },
      };
      addEventListener('pointerdown', (e) => {
        const d = document.createElement('div');
        d.className = '__tap';
        d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 650);
      }, true);
    });
  });

  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const W = (ms) => page.waitForTimeout(ms);

  let frames = null;
  cdp.on('Page.screencastFrame', async (ev) => {
    try {
      if (frames) {
        const name = 'f' + String(frames.i++).padStart(5, '0') + '.jpg';
        fs.writeFileSync(path.join(frames.dir, name), Buffer.from(ev.data, 'base64'));
        frames.list.push({ f: name, ts: ev.metadata.timestamp });
      }
      await cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId });
    } catch (e) {}
  });
  const startRec = async (scene) => {
    const dir = path.join(OUT, scene);
    fs.mkdirSync(dir, { recursive: true });
    frames = { dir, list: [], i: 0 };
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  };
  const stopRec = async () => {
    await cdp.send('Page.stopScreencast');
    await new Promise(r => setTimeout(r, 300));
    const meta = frames; frames = null;
    fs.writeFileSync(path.join(meta.dir, 'frames.json'), JSON.stringify(meta.list));
    console.log('[rec]', path.basename(meta.dir), meta.list.length, 'frames',
      meta.list.length ? (meta.list[meta.list.length - 1].ts - meta.list[0].ts).toFixed(2) + 's' : '');
  };

  // ── 탭: 대상을 화면 중앙으로 스크롤 → 커서 이동 → 프레스 → 클릭
  const tap = async (sel, holdAfter = 500) => {
    const h = typeof sel === 'string' ? await page.waitForSelector(sel, { timeout: 8000 }) : sel;
    await h.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await W(800);
    const box = await h.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.evaluate(([x, y]) => window.__hand.moveTo(x, y), [x, y]);
    await W(600);
    await page.evaluate(() => window.__hand.press());
    await W(120);
    await h.click();
    await W(80);
    await page.evaluate(() => window.__hand.release());
    await W(holdAfter);
  };
  const handHide = async () => { await page.evaluate(() => window.__hand.hide()); await W(350); };
  const tapSelect = async (sel, value, holdAfter = 600) => {
    const h = await page.waitForSelector(sel, { timeout: 8000 });
    await h.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await W(800);
    const box = await h.boundingBox();
    await page.evaluate(([x, y]) => window.__hand.moveTo(x, y), [box.x + box.width / 2, box.y + box.height / 2]);
    await W(600);
    await page.evaluate(() => window.__hand.press());
    await W(140);
    await page.evaluate(() => window.__hand.release());
    await page.selectOption(sel, value);
    await W(holdAfter);
  };
  const q = async (sel) => { await page.click(sel); await W(350); };

  // ══ 로드
  await page.goto('https://calculator.licen.co.kr', { waitUntil: 'networkidle' });
  await W(2000);

  // ══ S1: 커버 → 시작
  await startRec('s1_cover');
  await W(1100);
  await tap('text=개인택시 준비자금 계산하기', 900);
  await handHide();
  await W(700);
  await stopRec();

  // ══ S2: 면허
  await startRec('s2_license');
  await W(300);
  await tap('#item_license', 800);
  await tapSelect('#licRegion', '서울특별시', 1500);
  await tap('button.modal-save', 800);
  await handHide();
  await W(600);
  await stopRec();

  // ══ S3: 차량 — 전액할부 36개월
  await startRec('s3_car');
  await W(300);
  await tap('#item_car', 700);
  await tap('#modalContent button:has-text("LPG")', 500);
  await tap("#modalContent [onclick*=\"selMaker('현대')\"]", 500);
  await tap('#modalContent [onclick*="selCar"]', 800);
  await tapSelect('#payType', '전액할부', 900);
  await tap('#modalContent [onclick*="selMonths"] >> nth=2', 1100);   // 36개월
  await tap('#modalContent button.modal-save', 700);
  await handHide();
  await W(500);
  await stopRec();

  // ── (녹화 밖) 보험 공제 저장 → 상태만 남기고 목록은 미입력 상태로 되돌림
  await page.click('#item_ins'); await W(500);
  await page.click('#modalContent button:has-text("공제보험")'); await W(500);
  await page.click('#modalContent button.modal-save'); await W(700);
  const insVal = await page.evaluate(() => JSON.stringify(S.ins));
  await page.evaluate(() => { S.ins = null; renderAll(); });          // 목록: 보험 미입력 표시
  await page.evaluate((v) => { S.ins = JSON.parse(v); }, insVal);     // 상태만 복원 (렌더 안 함)
  await W(600);

  // ══ S4: 보험 — 클릭 → 완성 모달 → 스크롤 → 저장 → 금액 반영된 목록
  await startRec('s4_ins');
  await W(300);
  await tap('#item_ins', 900);
  await handHide();
  await page.$eval('#modalContent', el => {
    const sc = el.scrollHeight > el.clientHeight ? el : el.parentElement;
    sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
  });
  await W(1900);
  await tap('#modalContent button.modal-save', 600);
  await handHide();
  await W(900);                                                        // 합계 반영된 목록 노출
  await stopRec();

  // ══ S5: 작업비 — 블랙박스 5채널 + 연동형 하이패스 체크
  await startRec('s5_work');
  await W(300);
  await tap('#item_work', 900);
  await tap('#w_bb', 600);                                             // 블랙박스 체크
  await tap('#modalContent .tog-btn:has-text("5채널")', 700);          // 5채널
  await tap('#w_hi', 900);                                             // 연동형 하이패스
  await tap('#modalContent button.modal-save', 600);
  await handHide();
  await W(700);
  await stopRec();

  // ── (녹화 밖) 2번 구성 채우기
  await page.$eval('#cfgRow', el => el.scrollIntoView({ block: 'center' })); await W(400);
  await q('#cfgRow .cfg-tab:nth-child(2)');
  await q('#item_license');
  await page.selectOption('#licRegion', '서울특별시'); await W(350);
  await q('button.modal-save');
  await q('#item_car');
  await q('#modalContent button:has-text("전기")');
  await q("#modalContent [onclick*=\"selMaker('현대')\"]");
  await q('#modalContent [onclick*="selCar"]');
  await page.selectOption('#payType', '전액할부'); await W(400);
  const mb = await page.$$('#modalContent [onclick*="selMonths"]');
  if (mb.length) { await mb[mb.length - 1].click(); await W(400); }
  await q('#modalContent button.modal-save');
  await q('#item_ins');
  await q('#modalContent button:has-text("공제보험")');
  await q('#modalContent button.modal-save');
  await q('#item_work');
  await q('#modalContent button.modal-save');
  await q('#cfgRow .cfg-tab:nth-child(1)');
  await page.$eval('#cfgBox', el => el.scrollIntoView({ block: 'start' })); await W(700);

  // ══ S6: 비교 버튼 탭 → 비교표 스크롤
  await startRec('s6_compare');
  await W(400);
  await tap('#compareBtn', 900);
  await handHide();
  await W(1400);
  await page.$eval('#cmpPage', el => {
    // '← 이전' 버튼이 화면 하단에 보일 만큼만 스크롤
    const t = [...el.querySelectorAll('button, a, div')].find(n =>
      n.childElementCount === 0 && /^←?\s*이전$/.test((n.textContent || '').trim()));
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'end' });
    else el.scrollTo({ top: el.scrollHeight * 0.4, behavior: 'smooth' });
  });
  await W(2500);
  await stopRec();

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
