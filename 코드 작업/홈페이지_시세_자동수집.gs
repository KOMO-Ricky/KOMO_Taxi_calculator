/**********************************************************************
 *  홈페이지 면허 시세 → '자금계산기 DB' 자동 반영
 *  ------------------------------------------------------------------
 *  현재는 홈페이지의 시세를 수기로 B3에 입력하고 있는데,
 *  이 스크립트가 홈페이지를 읽어 B3(면허시세)·B9(기준일)을 자동 갱신한다.
 *
 *  ▶ 사용 순서
 *    1) 아래 SITE_URL 에 '시세가 표시되는 페이지' 주소를 넣는다.
 *    2) [시세후보_확인] 을 먼저 실행한다.  (실행 → 로그 보기)
 *       → 페이지에서 찾은 금액 후보들이 주변 문구와 함께 출력된다.
 *    3) 로그를 보고 ANCHOR(시세 앞에 붙는 고정 문구)를 정확히 지정한다.
 *    4) [시세_미리보기] 로 값이 제대로 뽑히는지 확인한다. (시트는 건드리지 않음)
 *    5) 값이 맞으면 [시세_자동갱신] 실행 → B3/B9 반영
 *    6) 트리거 등록: 시간 기반 → 일 단위(예: 매일 오전 6~7시) → 시세_자동갱신
 *
 *  ▶ 안전장치
 *    - 파싱 실패 / 값이 허용 범위 밖이면 시트를 덮어쓰지 않는다.
 *    - 직전 값과 같으면 갱신하지 않는다.
 *    - 모든 실행 결과를 '시세수집로그' 시트에 남긴다.
 **********************************************************************/

// ── 설정 ─────────────────────────────────────────────────────────────
var SITE_URL   = 'http://www.tlxc.co.kr/';   // ★ 시세가 표시되는 페이지 주소로 교체
var ANCHOR     = '';                          // ★ 시세 바로 앞에 오는 문구 (예: '서울 개인택시 면허 시세')
                                              //    비워두면 페이지에서 '조건에 맞는 첫 금액'을 사용
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


/** 실제 시세 추출 (ANCHOR 우선, 없으면 첫 유효 금액) */
function extractPrice_() {
  var text = htmlToText_(fetchHtml_());

  // ANCHOR가 지정되면 그 문구 뒤쪽에서 첫 금액을 찾는다
  var scope = text;
  if (ANCHOR) {
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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


/** 실행 이력 기록 */
function writeLog_(status, before, after, memo) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lg = ss.getSheetByName(LOG_SHEET);
  if (!lg) {
    lg = ss.insertSheet(LOG_SHEET);
    lg.appendRow(['실행시각', '결과', '이전값', '수집값', '비고']);
  }
  lg.appendRow([new Date(), status, before, after, memo]);
  Logger.log(status + ' | ' + before + ' → ' + after + ' | ' + memo);
}
