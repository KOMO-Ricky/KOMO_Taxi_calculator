/**
 * ═══════════════════════════════════════════════════════════════
 *  '자금계산기 DB의 사본' 탭 구성 스크립트 (1회 실행용)
 * ═══════════════════════════════════════════════════════════════
 *
 *  하는 일
 *   1. '자금계산기 DB의 사본' 탭이 없으면 '자금계산기 DB'를 복제해 생성
 *   2. 차량 표(D3~P20)를 「차량 할부율 표.xlsx」 내용으로 갱신 (18종)
 *      - 열 구조는 현행 탭 그대로: D연료 E제조사 F차량 G가격 H추천옵션금액
 *        I추천옵션내용 J보조금 K취등록세 L미터기 M OBD N공제 O사보min P사보max
 *      - 사보험 min/max(O·P)는 기존 사본 값이 있으면 보존
 *   3. 할부율 블록(23행~): 차량명 | 기본 24/36/48/60 | 프로모션 24/36/48/60 | 조건
 *      ※ S열(필수 작업항목)·W열(선택 작업항목)·Y~AA(대출표)·AC4:AI4(추천구성)와
 *        충돌하지 않도록 열이 아니라 "하단 블록"으로 배치 (차량명 매칭으로 연동)
 *   4. 하단(46행~)에 「차량 옵션」 블록 생성 — 옵션 개별 선택용 롱 포맷
 *      - 옵션명은 기존 '추천옵션 내용'을 / 기준으로 분해해 시딩
 *      - 옵션 금액은 빈칸 (직접 기입) · 합계검증 열이 추천옵션금액과 대조
 *
 *  사용법: Apps Script 편집기에 붙여넣고 → 사본구성_실행() 실행
 *  ※ 라이브 '자금계산기 DB' 탭은 절대 건드리지 않습니다.
 */

var SABON_SS_ID = '16tTQilanjKsumRLmSHrbeBghgdMNF2p9FjemZq-9Qco';
var SABON_NAME  = '자금계산기 DB의 사본';
var ORIGIN_NAME = '자금계산기 DB';

// ── 차량 데이터 (차량 할부율 표.xlsx 기준) ──────────────────────
// [연료, 제조사, 차량, 가격, 추천옵션금액, 추천옵션내용, 보조금, 취등록세,
//  미터기, OBD, 공제보험료, 기본24,36,48,60, 프로모24,36,48,60, 프로모션조건]
var CAR_DATA = [
 ['LPG','현대','쏘나타',25950000,1020000,'현대 스마트센스 / 1열 통풍시트','-',700000,300000,'-',2900000,
   0.062,0.062,0.063,0.064, 0.054,0.054,0.055,0.056,'현대카드: 3년간 1800만원 이상 소비 (월 50만원 이상)'],
 ['LPG','현대','그랜저',37120000,1450000,'VIP패키지 / 동승석 컴포트','-',1100000,400000,'-',2900000,
   0.062,0.062,0.063,0.064, 0.054,0.054,0.055,0.056,'현대카드: 3년간 1800만원 이상 소비 (월 50만원 이상)'],
 ['LPG','현대','스타리아(LPG 7인승)',44690000,2710000,'스마트 / 컴포트 / 테크','-',1300000,400000,100000,3480000,
   '','','','', '','','','',''],
 ['LPG','기아','K5',27740000,2130000,'[프레스티지] 애프터마켓용 컬렉션 / SBW팩 / 드라이브 와이즈 / 12.3인치 클러스터팩','-',800000,300000,'-',2900000,
   0.062,0.062,0.063,0.064, 0.029,0.029,0.029,0.039,'M할부(선수율 20%)'],
 ['LPG','기아','K8',35290000,1220000,'스마트 파워 트렁크 / 드라이브 와이즈','-',1100000,400000,'-',2900000,
   0.062,0.062,0.063,0.064, 0.029,0.029,0.029,0.039,'M할부(선수율 20%)'],
 ['LPG','기아','스포티지',33110000,2870000,'[노블레스] 컴포트 / 드라이브와이즈 / 모니터링','-',1000000,300000,'-',2900000,
   0.062,0.062,0.063,0.064, 0.054,0.054,0.055,0.056,'M할부(선수율 1% 이상)'],
 ['전기','현대','아이오닉5',53800000,1090000,'컴포트 / 20인치 휠',10330000,0,400000,100000,2900000,
   '',0.035,0.036,0.037, '',0.027,0.028,0.029,'현대카드: 3년간 1800만원 이상 소비 (월 50만원 이상)'],
 ['전기','기아','EV3',50660000,2580000,'[어스-롱레인지] 모니터링 / 드라이브와이즈 / 빌트인캠2 플러스',9710000,0,400000,100000,2900000,
   '','','','', 0.008,0.008,'','','M할부(선수율 20% / 최대 36개월)'],
 ['전기','기아','EV4',51830000,1730000,'[어스-롱레인지] 드라이브와이즈 / 빌트인캠2 플러스',9710000,0,400000,100000,2900000,
   '','','','', 0.008,0.008,'','','M할부(선수율 20% / 최대 36개월)'],
 ['전기','기아','EV5',52140000,3910000,'[어스-롱레인지] 스마트 커넥트 / 모니터링 / 드라이브와이즈 / 빌트인캠2 플러스',9670000,0,400000,100000,2900000,
   0.054,0.054,0.055,0.056, 0.046,0.046,0.047,0.048,'M할부(선수율 1% 이상)'],
 ['전기','기아','EV6',55190000,1100000,'[어스-롱레인지] 드라이브 와이즈 / 빌트인캠2',9910000,0,400000,100000,2900000,
   0.054,0.054,0.055,0.056, 0.046,0.046,0.047,0.048,'M할부(선수율 1% 이상)'],
 ['전기','KGM','토레스EVX',47970000,1100000,'컨비니언스 패키지 II',7190000,0,400000,100000,2900000,
   '','','','', '','','','',''],
 ['전기','BYD','돌핀',29200000,'-','액티브 트림',3910000,0,400000,100000,2900000,
   '','','','', '','','','',''],
 ['전기','BYD','아토3',33500000,'-','-',4130000,0,400000,100000,2900000,
   '','','','', '','','','',''],
 ['전기','BYD','씰',41900000,'-','플러스 트림',4690000,0,400000,100000,2900000,
   '','','','', '','','','',''],
 ['전기','BYD','씨라이언7',46900000,'-','플러스 트림',4470000,0,400000,100000,2900000,
   '','','','', '','','','',''],
 ['하이브리드','기아','카니발 하이브리드',51580000,3250000,'[시그니처] 컴포트 / 드라이브 와이즈 / 모니터링 팩','-',1550000,400000,100000,3430000,
   0.062,0.062,0.063,0.064, 0.054,0.054,0.055,0.056,'M할부(선수율 1% 이상)'],
 ['기타','수입차','수입차','-','-','-','-','차량별 상이',500000,100000,'차량별 상이',
   '','','','', '','','','','']
];

var RATE_START_ROW = 23;  // 할부율 블록 시작 행
var OPT_START_ROW  = 46;  // 옵션 블록 시작 행

function 사본구성_실행() {
  var ss = SpreadsheetApp.openById(SABON_SS_ID);

  // 1) 사본 탭 확보
  var sh = ss.getSheetByName(SABON_NAME);
  if (!sh) {
    var origin = ss.getSheetByName(ORIGIN_NAME);
    if (!origin) throw new Error("'" + ORIGIN_NAME + "' 탭을 찾을 수 없습니다.");
    sh = origin.copyTo(ss).setName(SABON_NAME);
    Logger.log('사본 탭을 새로 생성했습니다.');
  }

  // 2) 기존 사보험 min/max 보존용 맵 (차량명 → [O, P])
  var keep = {};
  var last = sh.getLastRow();
  for (var r = 3; r <= Math.min(last, 28); r++) {
    var nm = String(sh.getRange('F' + r).getValue() || '').trim();
    if (nm) keep[nm] = [sh.getRange('O' + r).getValue(), sh.getRange('P' + r).getValue()];
  }

  // 3) 차량 표 갱신 (D3:P20) — S·W열(작업항목 단가)은 건드리지 않음
  sh.getRange("D3:P28").clearContent();

  var carRows = [];
  CAR_DATA.forEach(function (c) {
    var kept = keep[c[2]] || ["", ""];
    carRows.push([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10], kept[0], kept[1]]);
  });
  var n = CAR_DATA.length;
  sh.getRange(3, 4, n, 13).setValues(carRows);       // D3 ~ P

  // 주의: 위 clearContent가 S3:S6(필수 작업항목)·W3:W9(선택 작업항목)를 지우지 않도록
  //       D~P만 지웠다. (기존 탭에서 두 스택은 그대로 복제되어 있음)

  // 3-1) 할부율 블록
  buildRateBlock_(sh);

  // 4) 차량 옵션 블록 (개별 선택용)
  buildOptionBlock_(sh);

  Logger.log("완료: 차량 " + n + "종 / 할부율 블록 " + RATE_START_ROW + "행~ / 옵션 블록 " + OPT_START_ROW + "행~");
}

// ── 할부율 블록: 차량 | 기본(24~60개월) | 프로모션(24~60개월) | 프로모션 조건 ──
function buildRateBlock_(sh) {
  var R = RATE_START_ROW;
  sh.getRange(R, 2, OPT_START_ROW - R - 1, 11).clearContent();   // B23:L44

  sh.getRange(R, 2).setValue("■ 차량별 할부율 (연이율) — 빈칸 = 할부 조건 정보 없음").setFontWeight("bold");
  try { sh.getRange(R + 1, 3, 1, 4).merge(); } catch (e) {}
  try { sh.getRange(R + 1, 7, 1, 4).merge(); } catch (e) {}
  sh.getRange(R + 1, 3).setValue("기본 할부율");
  sh.getRange(R + 1, 7).setValue("프로모션 할부율");
  sh.getRange(R + 2, 2, 1, 10).setValues([[
    "차량", "24개월", "36개월", "48개월", "60개월", "24개월", "36개월", "48개월", "60개월", "프로모션 적용 조건"
  ]]);
  sh.getRange(R + 1, 2, 2, 10).setFontWeight("bold").setHorizontalAlignment("center");

  var rows = CAR_DATA.map(function (c) {
    return [c[2], c[11], c[12], c[13], c[14], c[15], c[16], c[17], c[18], c[19]];
  });
  sh.getRange(R + 3, 2, rows.length, 10).setValues(rows);
  sh.getRange(R + 3, 3, rows.length, 8).setNumberFormat("0.0%");
}

// ── 옵션 블록: 차량명 | 옵션명 | 금액(직접기입) | 추천세트 | 합계검증 | 비고 ──
function buildOptionBlock_(sh) {
  sh.getRange(OPT_START_ROW, 2, 60, 6).clearContent();   // B29:G88 초기화

  sh.getRange(OPT_START_ROW, 2).setValue('■ 차량 옵션 (계산기 개별 선택용) — 금액(D열)을 채워 주세요. 합계검증이 추천옵션금액과 대조합니다.')
    .setFontWeight('bold');
  var hdr = OPT_START_ROW + 1;
  sh.getRange(hdr, 2, 1, 6).setValues([['차량', '옵션명', '옵션금액(원)', '추천세트', '합계검증', '비고']])
    .setFontWeight('bold').setHorizontalAlignment('center');

  var rows = [], checks = [];   // checks: [행offset, 차량표의 행번호]
  CAR_DATA.forEach(function (c, idx) {
    var name = c[2], desc = String(c[5] || '').trim(), amt = c[4];
    if (desc === '' || desc === '-') return;

    var trim = '';
    var m = desc.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (m) { trim = m[1]; desc = m[2]; }
    if (/트림$/.test(desc.replace(/\s+/g, ''))) { trim = trim || desc; desc = ''; }   // "액티브 트림" 등

    var opts = desc ? desc.split('/').map(function (s) { return s.trim(); }).filter(String) : [];
    if (opts.length === 0 && !trim) return;

    var first = true;
    opts.forEach(function (op) {
      rows.push([name, op, '', true, '', first && trim ? '기준 트림: ' + trim : '']);
      if (first && typeof amt === 'number') checks.push([rows.length - 1, 3 + idx]);
      first = false;
    });
    if (opts.length === 0 && trim) rows.push([name, '(옵션 없음)', '', '', '', '기준 트림: ' + trim]);
  });

  if (rows.length) {
    var start = hdr + 1;
    sh.getRange(start, 2, rows.length, 6).setValues(rows);
    // 합계검증: 차량별 첫 옵션 행에 SUMIF vs 차량표 H열(추천옵션금액)
    var endRow = start + rows.length - 1;
    checks.forEach(function (ck) {
      var r = start + ck[0], carRow = ck[1];
      sh.getRange(r, 6).setFormula(
        '=IF(SUMIF($B$' + start + ':$B$' + endRow + ',B' + r + ',$D$' + start + ':$D$' + endRow + ')=$H$' + carRow +
        ',"✓ 일치","Δ "&TEXT($H$' + carRow + '-SUMIF($B$' + start + ':$B$' + endRow + ',B' + r + ',$D$' + start + ':$D$' + endRow + '),"#,##0"))');
    });
    sh.getRange(start, 5, rows.length, 1).insertCheckboxes();   // 추천세트 체크박스
  }
}
