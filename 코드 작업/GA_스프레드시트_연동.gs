/*  GA4 → 구글 스프레드시트  일일 트래픽 집계
 *  매일 새벽, 전날(어제) 데이터를 채널(소스/매체)별로 '트래픽 통계' 시트에 1행씩 기록합니다.
 *  기존 doGet/doPost 프로젝트의 같은 코드.gs 안(또는 새 파일)에 붙여넣으면 됩니다.
 *  ─────────────────────────────────────────────
 *  [설정 3단계]
 *   1) Apps Script 편집기 왼쪽 '서비스(Services)' + 클릭
 *        → 'Google Analytics Data API' 검색 → 추가 (식별자: AnalyticsData)
 *   2) 아래 GA4_PROPERTY_ID 에 숫자형 '속성 ID' 입력
 *        (GA4 → 관리 → 속성 설정 → '속성 ID', 예: 501234567  ← 측정ID G-... 아님)
 *   3) 트리거(시계 아이콘) → 트리거 추가
 *        함수: ga4DailyToSheet · 이벤트: 시간 기반 · 일 단위 타이머 · 새벽 4~5시
 *   ※ 최초 실행 시 권한 승인 필요 (Analytics 읽기 + 스프레드시트)
 */

var GA4_PROPERTY_ID = '여기에_GA4_숫자_속성ID';   // 예: '501234567'

function ga4DailyToSheet(){
  var ss = SpreadsheetApp.openById(SS_ID);                 // SS_ID: 기존 상단 상수(자금계산기 DB) 재사용
  var sh = ss.getSheetByName('트래픽 통계') || ss.insertSheet('트래픽 통계');
  if (sh.getLastRow() === 0){
    sh.appendRow(['수집일시','날짜','소스','매체','캠페인',
                  '세션','활성사용자(UV)','신규사용자','조회수(PV)',
                  '참여율(%)','이탈률(%)','평균세션시간(초)']);
  }

  var tz  = Session.getScriptTimeZone();
  var day = Utilities.formatDate(new Date(Date.now() - 24*3600*1000), tz, 'yyyy-MM-dd');   // 어제

  var request = {
    dateRanges: [{ startDate: day, endDate: day }],
    dimensions: [{name:'date'},{name:'sessionSource'},{name:'sessionMedium'},{name:'sessionCampaignName'}],
    metrics: [{name:'sessions'},{name:'activeUsers'},{name:'newUsers'},{name:'screenPageViews'},
              {name:'engagementRate'},{name:'bounceRate'},{name:'averageSessionDuration'}],
    orderBys: [{ metric:{ metricName:'sessions' }, desc:true }],
    limit: 1000
  };

  var report = AnalyticsData.Properties.runReport(request, 'properties/' + GA4_PROPERTY_ID);
  var now  = new Date();
  var rows = report.rows || [];

  if (!rows.length){
    sh.appendRow([now, day, '(데이터 없음)', '', '', 0,0,0,0, 0,0,0]);
    return;
  }

  var pct = function(v){ return Math.round((parseFloat(v)||0)*1000)/10; };   // 0~1 → % (소수1자리)
  var out = rows.map(function(r){
    var d = r.dimensionValues, m = r.metricValues;
    return [
      now,
      String(d[0].value).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
      d[1].value, d[2].value, d[3].value,
      Number(m[0].value), Number(m[1].value), Number(m[2].value), Number(m[3].value),
      pct(m[4].value), pct(m[5].value),
      Math.round(parseFloat(m[6].value)||0)
    ];
  });
  // 한 번에 기록 (append 반복보다 빠름)
  sh.getRange(sh.getLastRow()+1, 1, out.length, out[0].length).setValues(out);
}

/* (선택) 특정 기간을 한 번에 채우고 싶을 때 — 실행 전 start/end 날짜만 바꿔서 수동 실행 */
function ga4BackfillRange(){
  var START = '2026-07-01';   // 시작일
  var END   = '2026-07-28';   // 종료일
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName('트래픽 통계') || ss.insertSheet('트래픽 통계');
  if (sh.getLastRow() === 0){
    sh.appendRow(['수집일시','날짜','소스','매체','캠페인',
                  '세션','활성사용자(UV)','신규사용자','조회수(PV)',
                  '참여율(%)','이탈률(%)','평균세션시간(초)']);
  }
  var request = {
    dateRanges: [{ startDate: START, endDate: END }],
    dimensions: [{name:'date'},{name:'sessionSource'},{name:'sessionMedium'},{name:'sessionCampaignName'}],
    metrics: [{name:'sessions'},{name:'activeUsers'},{name:'newUsers'},{name:'screenPageViews'},
              {name:'engagementRate'},{name:'bounceRate'},{name:'averageSessionDuration'}],
    orderBys: [{ dimension:{ dimensionName:'date' } }],
    limit: 100000
  };
  var report = AnalyticsData.Properties.runReport(request, 'properties/' + GA4_PROPERTY_ID);
  var now = new Date(), rows = report.rows || [];
  var pct = function(v){ return Math.round((parseFloat(v)||0)*1000)/10; };
  var out = rows.map(function(r){
    var d = r.dimensionValues, m = r.metricValues;
    return [ now, String(d[0].value).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
             d[1].value, d[2].value, d[3].value,
             Number(m[0].value), Number(m[1].value), Number(m[2].value), Number(m[3].value),
             pct(m[4].value), pct(m[5].value), Math.round(parseFloat(m[6].value)||0) ];
  });
  if (out.length) sh.getRange(sh.getLastRow()+1, 1, out.length, out[0].length).setValues(out);
}
