// v6 재녹화: s2 면허 — 드롭다운에서 지역을 고르는 장면 포함
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'scenes6');
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
        #__hand.press{transform:translate(-45%,-9%) scale(.8);}
        #__dd{position:fixed;z-index:999996;background:#fff;border:1px solid #D7DEEA;border-radius:14px;
          box-shadow:0 14px 34px rgba(12,27,61,.22);overflow:hidden;}
        #__dd .op{padding:13px 18px;color:#1F2A44;border-bottom:1px solid #F0F3F8;font-weight:600;font-size:15px;}
        #__dd .op:last-child{border-bottom:none;}
        #__dd .op.sel{background:#EEF3FF;color:#0C1B3D;font-weight:800;}`;
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

  // ══ 로드 + s1 상태 재현 (녹화 없음)
  await page.goto('https://calculator.licen.co.kr', { waitUntil: 'networkidle' });
  await W(1500);
  await page.click('text=개인택시 준비자금 계산하기');
  await W(800);

  // ══ S2: 면허 — 드롭다운 열고 서울특별시 선택
  await startRec('s2_license');
  await W(300);
  await tap('#item_license', 800);

  // 셀렉트 박스 탭 → 가짜 드롭다운 표시
  const selH = await page.waitForSelector('#licRegion');
  await selH.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await W(800);
  const sb = await selH.boundingBox();
  await page.evaluate(([x, y]) => window.__hand.moveTo(x, y), [sb.x + sb.width/2, sb.y + sb.height/2]);
  await W(600);
  await page.evaluate(() => window.__hand.press());
  await W(140);
  await page.evaluate(() => window.__hand.release());
  // 드롭다운 생성 (셀렉트 위쪽으로 펼침)
  await page.evaluate(() => {
    const sel = document.querySelector('#licRegion');
    const r = sel.getBoundingClientRect();
    const regions = ['서울특별시','경기도','인천광역시','부산광역시','대구광역시','대전광역시'];
    const dd = document.createElement('div');
    dd.id = '__dd';
    regions.forEach((n) => {
      const o = document.createElement('div');
      o.className = 'op'; o.dataset.rg = n; o.textContent = n;
      dd.appendChild(o);
    });
    document.body.appendChild(dd);
    const h = dd.getBoundingClientRect().height;
    dd.style.left = r.left + 'px';
    dd.style.width = r.width + 'px';
    const below = r.bottom + 6 + h <= innerHeight - 8;
    dd.style.top = (below ? r.bottom + 6 : r.top - h - 6) + 'px';
  });
  await W(900);                                       // 드롭다운 읽는 시간

  // 서울특별시 항목 탭
  const optBox = await page.evaluate(() => {
    const o = document.querySelector('#__dd .op[data-rg="서울특별시"]');
    const r = o.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  });
  await page.evaluate(([x, y]) => window.__hand.moveTo(x, y), [optBox.x, optBox.y]);
  await W(600);
  await page.evaluate(() => {
    window.__hand.press();
    const o = document.querySelector('#__dd .op[data-rg="서울특별시"]');
    o.classList.add('sel');
  });
  await W(200);
  await page.evaluate(() => window.__hand.release());
  await W(150);
  await page.evaluate(() => { const d = document.querySelector('#__dd'); if (d) d.remove(); });
  await page.selectOption('#licRegion', '서울특별시');
  await W(1500);                                      // 시세·소계 노출

  await tap('button.modal-save', 800);
  await handHide();
  await W(600);
  await stopRec();

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
