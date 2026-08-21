/**********************************************************************
 *  홈페이지 면허 시세 → '자금계산기 DB' 자동 반영
 *  ------------------------------------------------------------------
 *  현재는 홈페이지의 시세를 수기로 B3에 입력하고 있는데,
 *  이 스크립트가 홈페이지를 읽어 B3(면허시세)·B9(기준일)을 자동 갱신한다.
 *
 *  ▶ 설치
 *    스프레드시트 → 확장 프로그램 → Apps Script → 파일(+) → 스크립트
 *    → 이 내용을 붙여넣고 저장(Ctrl+S)
 *
 *  ▶ 사용 순서
 *    1) 아래 SITE_URL 에 '시세가 표시되는 페이지' 주소를 넣는다.
 *    2) [구조진단] 실행 → 페이지가 정적 HTML인지 / JS 렌더링인지 판별
 *    3) [시세후보_확인] 실행 → 금액 후보와 주변 문구 확인
 *    4) 결과에 따라 MARKER_ID · SELECTOR · ANCHOR 중 하나를 지정
 *    5) [시세_미리보기] 로 값이 제대로 뽑히는지 확인 (시트는 건드리지 않음)
 *    6) 값이 맞으면 [시세_자동갱신] 실행 → B3/B9 반영
 *    7) 트리거 등록: 시간 기반 → 일 단위(예: 매일 오전 6~7시) → 시세_자동갱신
 *
 *  ※ 함수 실행: 편집기 상단 함수 선택 드롭다운에서 고른 뒤 [실행]
 *     결과는 하단 '실행 로그'에서 확인
 *
 *  ▶ 안전장치
 *    - 파싱 실패 / 값이 허용 범위 밖이면 시트를 덮어쓰지 않는다.
 *    - 직전 값과 같으면 갱신하지 않는다.
 *    - 모든 실행 결과를 '시세수집로그' 시트에 남긴다.
 **********************************************************************/

// ── 설정 ─────────────────────────────────────────────────────────────
var SITE_URL   = 'http://www.tlxc.co.kr/';   // ★ 시세가 표시되는 페이지 주소로 교체

/* 추출 방식 — 위에서부터 우선 적용된다. 하나만 채우면 된다.
 *  (1) MARKER_ID  : 가장 안정적. 아임웹 HTML 위젯에 아래처럼 넣고 ID를 적는다.
 *                   <span id="kola-license-price">113,500,000</span>
 *  (2) SELECTOR    : 기존 요소의 id 또는 class 를 지정 (예: 'id:site_1234', 'class:price-text')
 *                   ※ 아임웹은 편집 시 자동 생성 클래스가 바뀔 수 있어 (1)보다 불안정
 *  (3) ANCHOR      : 시세 앞에 오는 고정 문구 (예: '서울 개인택시 면허 시세')
 *  세 값이 모두 비면 페이지에서 '조건에 맞는 첫 금액'을 사용한다(권장하지 않음).
 */
var MARKER_ID  = '';                          // 예: 'kola-license-price'
var SELECTOR   = '';                          // 예: 'class:price-text'
var ANCHOR     = '';                          // 예: '서울 개인택시 면허 시세'
var SISE_SS_ID = '16tTQilanjKsumRLmSHrbeBghgdMNF2p9FjemZq-9Qco';   // 자금계산기 DB 스프레드시트
var SHEET_NAME = '자금계산기 DB';
var CELL_PRICE = 'B3';    // 면허 시세
var CELL_DATE  = 'B9';    // 데이터 기준일
var MIN_PRICE  = 50000000;    // 타당성 검증 하한 (5천만원)
var MAX_PRICE  = 300000000;   // 타당성 검증 상한 (3억원)
var LOG_SHEET  = '시세수집로그';
// ─────────────────────────────────────────────────────────────────────


/** 홈페이지 HTML 가져오기 (EUC-KR 자동 대응) */
function fetchHtml_() {
  var res = UrlFetchApp.fetch(SITE_URL, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' }
  });
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('HTTP ' + code + ' — 페이지를 불러오지 못했습니다.');

  var html = '';
  try { html = res.getContentText('UTF-8'); } catch (e) {}
  // 한글이 깨졌으면 EUC-KR로 재시도 (구형 국내 사이트 대응)
  if (!/[가-힣]/.test(html)) {
    try { html = res.getContentText('EUC-KR'); } catch (e) {}
  }
  if (!html) throw new Error('본문을 읽지 못했습니다.');
  return html;
}


/** HTML → 순수 텍스트 */
function htmlToText_(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}


/** '1억 1,350만원' / '113,500,000' / '11,350만원' → 숫자 */
function parseKrw_(str) {
  if (!str) return 0;
  var s = String(str).replace(/\s/g, '');

  // 1) 억/만 표기
  var m = s.match(/(?:([0-9]+(?:\.[0-9]+)?)억)?\s*([0-9,]+)?만?원?/);
  if (/억/.test(s)) {
    var eok = m && m[1] ? parseFloat(m[1]) : 0;
    var man = m && m[2] ? Number(m[2].replace(/,/g, '')) : 0;
    return Math.round(eok * 100000000 + man * 10000);
  }
  if (/만원|만/.test(s)) {
    var only = s.replace(/[^0-9]/g, '');
    return Number(only) * 10000;
  }
  // 2) 콤마 포함 원 단위
  var n = Number(s.replace(/[^0-9]/g, ''));
  return isNaN(n) ? 0 : n;
}


/**
 * [1단계] 페이지에서 금액 후보를 모두 뽑아 로그로 보여준다.
 * 실행 후 상단 메뉴 '실행 로그(Executions/로그 보기)'에서 결과 확인.
 */
function 시세후보_확인() {
  var text = htmlToText_(fetchHtml_());
  var re = /([0-9]{1,3}(?:,[0-9]{3}){2,}원?|[0-9]+억\s*[0-9,]*\s*만?원?|[0-9,]{3,}\s*만원)/g;
  var out = [], m, i = 0;
  while ((m = re.exec(text)) !== null && i < 60) {
    out.push({
      번호: ++i,
      원문: m[1],
      숫자: parseKrw_(m[1]),
      앞뒤문맥: text.substring(Math.max(0, m.index - 45), m.index + m[1].length + 25)
    });
  }
  Logger.log('발견된 금액 후보 ' + out.length + '건');
  out.forEach(function (o) {
    Logger.log('[' + o.번호 + '] ' + o.원문 + '  →  ' + o.숫자 + '\n        …' + o.앞뒤문맥 + '…');
  });
  if (!out.length) {
    Logger.log('금액을 찾지 못했습니다. 페이지가 자바스크립트로 시세를 그리는 경우일 수 있습니다.');
  }
  return out;
}


/** id="..." 또는 class="..." 인 요소의 내부 텍스트를 뽑는다 */
function pickElementText_(html, kind, name) {
  // 여는 태그를 찾고, 거기서부터 같은 태그가 닫힐 때까지의 구간을 취한다(단순 스캔)
  var re = kind === 'id'
    ? new RegExp('<([a-zA-Z][\\w-]*)[^>]*\\sid\\s*=\\s*["\']' + name + '["\'][^>]*>', 'i')
    : new RegExp('<([a-zA-Z][\\w-]*)[^>]*\\sclass\\s*=\\s*["\'][^"\']*\\b' + name + '\\b[^"\']*["\'][^>]*>', 'i');
  var m = re.exec(html);
  if (!m) return null;

  var tag = m[1], start = m.index + m[0].length, depth = 1, i = start;
  var open = new RegExp('<' + tag + '\\b', 'ig');
  var close = new RegExp('</' + tag + '\\s*>', 'ig');
  open.lastIndex = start; close.lastIndex = start;

  var end = html.length, guard = 0;
  while (depth > 0 && guard++ < 500) {
    close.lastIndex = i; var c = close.exec(html);
    if (!c) break;
    open.lastIndex = i; var o = open.exec(html);
    if (o && o.index < c.index) { depth++; i = o.index + o[0].length; }
    else { depth--; i = c.index + c[0].length; end = c.index; }
  }
  return htmlToText_(html.substring(start, end));
}


/** 실제 시세 추출 (MARKER_ID → SELECTOR → ANCHOR → 첫 유효 금액) */
function extractPrice_() {
  var html = fetchHtml_();
  var text = htmlToText_(html);
  var scope = text;

  if (MARKER_ID) {
    scope = pickElementText_(html, 'id', MARKER_ID);
    if (scope === null) throw new Error('마커 ID를 찾지 못했습니다: #' + MARKER_ID);
  } else if (SELECTOR) {
    var parts = String(SELECTOR).split(':');
    var kind = (parts[0] || '').trim().toLowerCase();
    var name = (parts[1] || '').trim();
    if (kind !== 'id' && kind !== 'class') throw new Error("SELECTOR 형식은 'id:이름' 또는 'class:이름' 입니다.");
    scope = pickElementText_(html, kind, name);
    if (scope === null) throw new Error('선택자를 찾지 못했습니다: ' + SELECTOR);
  } else if (ANCHOR) {
    var idx = text.indexOf(ANCHOR);
    if (idx < 0) throw new Error('기준 문구(ANCHOR)를 페이지에서 찾지 못했습니다: ' + ANCHOR);
    scope = text.substring(idx, idx + 300);
  }

  var re = /([0-9]{1,3}(?:,[0-9]{3}){2,}원?|[0-9]+억\s*[0-9,]*\s*만?원?|[0-9,]{3,}\s*만원)/g;
  var m;
  while ((m = re.exec(scope)) !== null) {
    var v = parseKrw_(m[1]);
    if (v >= MIN_PRICE && v <= MAX_PRICE) return { value: v, raw: m[1] };
  }
  throw new Error('허용 범위(' + MIN_PRICE + '~' + MAX_PRICE + ') 안의 금액을 찾지 못했습니다.');
}


/**
 * [2단계] 시트를 건드리지 않고 결과만 확인한다.
 */
function 시세_미리보기() {
  try {
    var r = extractPrice_();
    Logger.log('추출 성공 → ' + r.value + '원  (원문: ' + r.raw + ')');
    return r.value;
  } catch (e) {
    Logger.log('추출 실패 → ' + e.message);
    throw e;
  }
}


/**
 * [3단계] 실제 반영. 트리거는 이 함수에 건다.
 */
function 시세_자동갱신() {
  var ss = SpreadsheetApp.openById(SISE_SS_ID);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { writeLog_('실패', 0, 0, SHEET_NAME + ' 시트를 찾을 수 없음'); return; }

  var before = Number(sh.getRange(CELL_PRICE).getValue()) || 0;
  var got;
  try {
    got = extractPrice_();
  } catch (e) {
    writeLog_('실패', before, 0, e.message);   // 실패 시 기존 값 유지
    return;
  }

  if (got.value === before) {
    writeLog_('변동없음', before, got.value, '동일 값');
    return;
  }

  sh.getRange(CELL_PRICE).setValue(got.value);
  sh.getRange(CELL_DATE).setValue(new Date());   // 기준일 = 수집일
  writeLog_('갱신', before, got.value, '원문: ' + got.raw);
}


/**
 * [0단계] 페이지 구조 진단.
 * 아임웹이 자바스크립트로 시세를 그리는지 / 정적 HTML에 들어있는지 판별한다.
 */
function 구조진단() {
  var html = fetchHtml_();
  var text = htmlToText_(html);
  var money = text.match(/[0-9]{1,3}(?:,[0-9]{3}){2,}|[0-9]+억|[0-9,]{3,}만원/g) || [];

  Logger.log('── 페이지 구조 진단 ──');
  Logger.log('HTML 길이      : ' + html.length.toLocaleString() + ' 자');
  Logger.log('본문 텍스트 길이: ' + text.length.toLocaleString() + ' 자');
  Logger.log('한글 포함 여부  : ' + (/[가-힣]/.test(text) ? '예' : '아니오 (인코딩 문제 가능)'));
  Logger.log('금액 패턴 개수  : ' + money.length + (money.length ? '  → ' + money.slice(0, 10).join(', ') : ''));

  if (MARKER_ID) {
    var mk = pickElementText_(html, 'id', MARKER_ID);
    Logger.log('마커(#' + MARKER_ID + ') : ' + (mk === null ? '찾지 못함' : '찾음 → "' + mk + '"'));
  }

  if (text.length < 500 || money.length === 0) {
    Logger.log('');
    Logger.log('※ 본문이 거의 비었거나 금액이 없습니다.');
    Logger.log('  아임웹이 자바스크립트로 내용을 그리는 경우일 수 있습니다.');
    Logger.log('  이 경우 아임웹 관리자에서 HTML 위젯으로 고정 마커를 삽입하는 방식이 필요합니다.');
    Logger.log('  예) <span id="kola-license-price">113,500,000</span>');
  }

  // 참고용: id/class 에 price·money·시세 가 들어간 요소 목록
  var cand = html.match(/<[a-zA-Z][^>]*(?:id|class)\s*=\s*["'][^"']*(?:price|money|cost|amount|sise)[^"']*["'][^>]*>/gi) || [];
  if (cand.length) {
    Logger.log('');
    Logger.log('가격 관련 선택자 후보 ' + cand.length + '건:');
    cand.slice(0, 15).forEach(function (c, i) { Logger.log('  [' + (i + 1) + '] ' + c.substring(0, 160)); });
  }
  return { htmlLen: html.length, textLen: text.length, moneyCount: money.length };
}


/** 실행 이력 기록 */
function writeLog_(status, before, after, memo) {
  var ss = SpreadsheetApp.openById(SISE_SS_ID);
  var lg = ss.getSheetByName(LOG_SHEET);
  if (!lg) {
    lg = ss.insertSheet(LOG_SHEET);
    lg.appendRow(['실행시각', '결과', '이전값', '수집값', '비고']);
  }
  lg.appendRow([new Date(), status, before, after, memo]);
  Logger.log(status + ' | ' + before + ' → ' + after + ' | ' + memo);
}
