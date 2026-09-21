/**
 * ═══════════════════════════════════════════════════════════════
 *  '자금계산기 DB의 사본' 탭 구성 스크립트 v2.1 (재실행 안전)
 * ═══════════════════════════════════════════════════════════════
 *
 *  v2 변경: 할부율을 하단 블록이 아니라 "차량 행 옆 열(Q~Y)"에 배치.
 *  차량별 정보는 전부 D3~Y 행렬에 모으고(차량 추가 = 행 추가),
 *  차량과 무관한 전역 데이터는 하단으로 이동:
 *
 *   차량 행렬  D~P(기존 구조 그대로) + Q~T 기본할부율(24/36/48/60)
 *              + U~X 프로모션할부율(24/36/48/60) + Y 프로모션 적용 조건
 *   23행~     [이동됨] 필수 작업항목 단가(구 S3:S6) · 선택 작업항목 단가(구 W3:W9)
 *              · 대출 은행표(구 Y3:AA — 기존 값을 읽어 그대로 옮김)
 *   46행~     차량 옵션 블록 (개별 선택용 롱 포맷)
 *
 *  ※ 이 배치를 라이브에 채택할 때 GAS doGet의 범위 수정 필요:
 *     reqItems S3:S6 → C25:C28 / selItems W3:W9 → F25:F31 / 대출 Y3:AA → H25:J
 *  ※ 라이브 '자금계산기 DB' 탭은 절대 건드리지 않습니다.
 */

var SABON_SS_ID = ['16tTQilanjKsum', 'RLmSHrbeBghgd', 'MNF2p9FjemZq-9Qco'].join('');
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

// 전역 단가 (현행 doGet이 읽던 값과 동일)
var REQ_ITEMS = [['갓등',70000],['경광벨(경고등)',5000],['미터기 거치대',20000],['빈차등',100000]];
var SEL_ITEMS = [['블랙박스 2채널',200000],['블랙박스 3채널',350000],['블랙박스 4채널',550000],
                 ['블랙박스 5채널',650000],['미터기 연동형 하이패스',100000],
                 ['블랙박스 페달 추가',100000],['블루투스(자석) 갓등',500000]];

var GLOBAL_START_ROW = 23;   // 전역 단가·대출 블록
var OPT_START_ROW    = 46;   // 옵션 블록

function 사본구성_실행() {
  var ss = SpreadsheetApp.openById(SABON_SS_ID);

  var sh = ss.getSheetByName(SABON_NAME);
  if (!sh) {
    var origin = ss.getSheetByName(ORIGIN_NAME);
    if (!origin) throw new Error("'" + ORIGIN_NAME + "' 탭을 찾을 수 없습니다.");
    sh = origin.copyTo(ss).setName(SABON_NAME);
    Logger.log('사본 탭을 새로 생성했습니다.');
  }

  // 0) 대출표 확보: 재실행이면 새 위치(H25:J), 첫 실행이면 구 위치(Y3:AA)에서 읽는다
  var loanRows = sh.getRange('H25:J40').getValues().filter(function (r) {
    var name = String(r[0]).trim();
    return name !== '' && name !== '은행/기관';
  });
  if (!loanRows.length) {
    loanRows = sh.getRange('Y3:AA20').getValues().filter(function (r) {
      var name = String(r[0]).trim();
      return name !== '' && !(Number(name) > 0 && Number(name) < 1);
    });
  }

  // 1) 기존 사보험 min/max 보존 (차량명 → [O, P])
  var keep = {};
  var last = sh.getLastRow();
  for (var r = 3; r <= Math.min(last, 22); r++) {
    var nm = String(sh.getRange('F' + r).getValue() || '').trim();
    if (nm) keep[nm] = [sh.getRange('O' + r).getValue(), sh.getRange('P' + r).getValue()];
  }

  // 2) 차량 행렬 D3:Y22 갱신 — 전역 스택(R~S, V~W 라벨·단가, Y~AA 대출)은 하단으로 이동되므로 함께 비운다
  sh.getRange('D3:AA22').clearContent();

  var carRows = CAR_DATA.map(function (c) {
    var kept = keep[c[2]] || ['', ''];
    return [c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10],   // D~N
            kept[0], kept[1],                                                    // O, P
            c[11], c[12], c[13], c[14],                                          // Q~T 기본
            c[15], c[16], c[17], c[18],                                          // U~X 프로모션
            c[19]];                                                              // Y 조건
  });
  sh.getRange(3, 4, carRows.length, 22).setValues(carRows);   // D3 ~ Y

  // 할부율 헤더 (1~2행) + % 서식
  try { sh.getRange('Q1:T1').merge(); } catch (e) {}
  try { sh.getRange('U1:X1').merge(); } catch (e) {}
  sh.getRange('Q1').setValue('기본 할부율 (연)');
  sh.getRange('U1').setValue('프로모션 할부율 (연)');
  sh.getRange('Y1').setValue('프로모션');
  sh.getRange('Q2:Y2').setValues([['24개월', '36개월', '48개월', '60개월', '24개월', '36개월', '48개월', '60개월', '적용 조건']]);
  sh.getRange('Q1:Y2').setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(3, 17, carRows.length, 8).setNumberFormat('0.0%');   // Q~X

  // 3) 하단: 전역 단가·대출 블록 (구 S열·W열·Y~AA에서 이동)
  buildGlobalBlock_(sh, loanRows);

  // 4) 차량 옵션 블록
  buildOptionBlock_(sh);

  Logger.log('완료: 차량 ' + carRows.length + '종 (할부율 Q~Y열) / 전역 블록 ' + GLOBAL_START_ROW + '행~ / 옵션 블록 ' + OPT_START_ROW + '행~');
}

// ── 전역 단가·대출 블록: 필수 작업항목 | 선택 작업항목 | 대출 은행표 ──
function buildGlobalBlock_(sh, loanRows) {
  var G = GLOBAL_START_ROW;
  sh.getRange(G, 2, OPT_START_ROW - G - 1, 11).clearContent().clearFormat();   // 잔여 % 서식까지 제거

  sh.getRange(G, 2).setValue('■ 전역 단가·대출 (차량 무관 데이터 — 상단 행렬에서 이동됨)').setFontWeight('bold');

  // 필수 작업항목 (구 S3:S6) → B25:C28
  sh.getRange(G + 1, 2, 1, 2).setValues([['필수 작업항목', '단가(원)']]).setFontWeight('bold');
  sh.getRange(G + 2, 2, REQ_ITEMS.length, 2).setValues(REQ_ITEMS);
  sh.getRange(G + 2, 3, REQ_ITEMS.length, 1).setNumberFormat('#,##0');

  // 선택 작업항목 (구 W3:W9) → E25:F31
  sh.getRange(G + 1, 5, 1, 2).setValues([['선택 작업항목', '단가(원)']]).setFontWeight('bold');
  sh.getRange(G + 2, 5, SEL_ITEMS.length, 2).setValues(SEL_ITEMS);
  sh.getRange(G + 2, 6, SEL_ITEMS.length, 1).setNumberFormat('#,##0');

  // 대출 은행표 (구 Y3:AA) → H25:J
  sh.getRange(G + 1, 8, 1, 3).setValues([['은행/기관', '한도(원)', '최저이율']]).setFontWeight('bold');
  if (loanRows.length) {
    sh.getRange(G + 2, 8, loanRows.length, 3).setValues(loanRows);
    sh.getRange(G + 2, 9, loanRows.length, 1).setNumberFormat('#,##0');
  }
}

// ── 옵션 블록: 차량명 | 옵션명 | 금액(직접기입) | 추천세트 | 합계검증 | 비고 ──
function buildOptionBlock_(sh) {
  sh.getRange(OPT_START_ROW, 2, 60, 6).clearContent();

  sh.getRange(OPT_START_ROW, 2).setValue('■ 차량 옵션 (계산기 개별 선택용) — 금액(D열)을 채워 주세요. 합계검증이 추천옵션금액과 대조합니다.')
    .setFontWeight('bold');
  var hdr = OPT_START_ROW + 1;
  sh.getRange(hdr, 2, 1, 6).setValues([['차량', '옵션명', '옵션금액(원)', '추천세트', '합계검증', '비고']])
    .setFontWeight('bold').setHorizontalAlignment('center');

  var rows = [], checks = [];
  CAR_DATA.forEach(function (c, idx) {
    var name = c[2], desc = String(c[5] || '').trim(), amt = c[4];
    if (desc === '' || desc === '-') return;

    var trim = '';
    var m = desc.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (m) { trim = m[1]; desc = m[2]; }
    if (/트림$/.test(desc.replace(/\s+/g, ''))) { trim = trim || desc; desc = ''; }

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
    // 합계검증: "추천세트에 체크된" 옵션 금액 합 = 차량표 H열(추천옵션 금액) 인지 대조
    var endRow = start + rows.length - 1;
    checks.forEach(function (ck) {
      var r = start + ck[0], carRow = ck[1];
      var B = '$B$' + start + ':$B$' + endRow, D = '$D$' + start + ':$D$' + endRow, E = '$E$' + start + ':$E$' + endRow;
      sh.getRange(r, 6).setFormula(
        '=IF(SUMIFS(' + D + ',' + B + ',B' + r + ',' + E + ',TRUE)=$H$' + carRow +
        ',"✓ 일치","Δ "&TEXT($H$' + carRow + '-SUMIFS(' + D + ',' + B + ',B' + r + ',' + E + ',TRUE),"#,##0"))');
    });
    sh.getRange(start, 5, rows.length, 1).insertCheckboxes();
  }
}


// ═══ 차량 옵션 전용 탭 구성 ═══════════════════════════════════
// - 새 탭 '차량옵션': 차량(세로 병합) | 옵션명 | 옵션금액(직접 기입) | 추천세트(V 표기) | 비고
// - 사본 탭의 옵션 블록(46행~)은 제거 (체크박스 유효성 검사 포함)
// - 미래 doGet 파싱 규칙: A열이 비어 있으면 직전 차량명을 계승 (병합 셀)
function 옵션탭_구성() {
  var ss = SpreadsheetApp.openById(SABON_SS_ID);
  var sh = ss.getSheetByName('차량옵션');
  if (!sh) sh = ss.insertSheet('차량옵션');
  sh.clear();
  try { sh.getRange(1, 1, Math.max(sh.getMaxRows(), 2), 5).breakApart(); } catch (e) {}

  sh.getRange(1, 1, 1, 5).setValues([['차량', '옵션명', '옵션금액(원)', '추천세트', '비고']])
    .setFontWeight('bold').setHorizontalAlignment('center');

  var rows = [], groups = [];   // groups: [데이터 내 시작 인덱스, 행 수]
  CAR_DATA.forEach(function (c) {
    var name = c[2], desc = String(c[5] || '').trim();
    if (desc === '' || desc === '-') return;

    var trim = '';
    var m = desc.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (m) { trim = m[1]; desc = m[2]; }
    if (/트림$/.test(desc.replace(/\s+/g, ''))) { trim = trim || desc; desc = ''; }

    var opts = desc ? desc.split('/').map(function (t) { return t.trim(); }).filter(String) : [];
    var startIdx = rows.length, first = true;
    opts.forEach(function (op) {
      rows.push([first ? name : '', op, '', 'V', first && trim ? '기준 트림: ' + trim : '']);
      first = false;
    });
    if (opts.length === 0 && trim) rows.push([name, '(옵션 없음)', '', '', '기준 트림: ' + trim]);
    if (rows.length > startIdx) groups.push([startIdx, rows.length - startIdx]);
  });

  if (rows.length) {
    sh.getRange(2, 1, rows.length, 5).setValues(rows);
    groups.forEach(function (g) {
      if (g[1] > 1) sh.getRange(2 + g[0], 1, g[1], 1).merge();
    });
    sh.getRange(2, 1, rows.length, 1).setVerticalAlignment('middle');
    sh.getRange(2, 3, rows.length, 1).setNumberFormat('#,##0');
    sh.getRange(2, 4, rows.length, 1).setHorizontalAlignment('center');
  }
  sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 220); sh.setColumnWidth(3, 110);
  sh.setColumnWidth(4, 80);  sh.setColumnWidth(5, 180);

  // 사본 탭의 옵션 블록 제거
  var sab = ss.getSheetByName(SABON_NAME);
  if (sab) sab.getRange(OPT_START_ROW, 2, 60, 6).clearContent().clearFormat().clearDataValidations();

  Logger.log('차량옵션 탭 구성 완료: 옵션 ' + rows.length + '행 / 사본 옵션 블록 제거');
}
