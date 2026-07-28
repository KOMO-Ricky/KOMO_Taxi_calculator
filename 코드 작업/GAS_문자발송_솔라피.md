# 문자 견적 발송 + DB 저장 — Apps Script(doPost) & 솔라피 연동 가이드

계산기 프런트(`index.html`)는 **자격진단 사이트와 동일한 방식**으로, "문자로 견적 받기 → 신청"을 누르면
아래 데이터를 **같은 Apps Script 웹앱 URL**로 `no-cors` POST 합니다.

```
requestType : 'taxi_quote_sms'
createdAt   : 접수시각(KST)
name, phone : 신청자 이름 / 연락처
smsText     : 발송할 문자 본문(구성 비교 요약 + 대출 참고정보)
image       : 견적표 이미지(JPG) base64 (data: 접두어 제외)
imageName   : '개인택시_견적비교.jpg'
source      : 접속 URL
```
그리고 '의견 보내기'는 `requestType:'calc_feedback'` 로 별점·의견을 함께 보냅니다.

이 두 가지를 받아 **① 시트에 기록**하고 **② 솔라피로 실제 문자 발송**하도록, 기존 doGet과 **같은 Apps Script 프로젝트**에 아래를 추가하면 됩니다.

---

## 1. 준비 — 솔라피(Solapi) 설정 절차

1. **회원가입/로그인** — https://solapi.com
2. **발신번호 등록** (필수·승인 시간 소요)
   - 콘솔 → *발신번호 관리* → 발신번호 등록 → 사업자/통신 서류 인증.
   - 승인 완료된 번호만 발신 `from` 으로 쓸 수 있습니다. (예: `025551234`)
3. **API Key 발급**
   - 콘솔 → *개발/연동* → *API Key 관리* → **새 API Key 생성**
   - **API Key** 와 **API Secret** 을 복사 (Secret은 생성 시 1회만 표시 → 안전하게 보관).
   - ※ 자격진단에서 쓰던 것과 **별개의 새 키**를 발급받아 이 프로젝트에 넣으면 됩니다.
4. **캐시 충전** — 문자 발송은 유료(SMS/LMS/MMS 건당 과금). 콘솔에서 캐시 충전.

## 2. 준비 — Apps Script 상단 설정값

기존 doGet이 있는 스크립트 **맨 위**에 상수 4개를 추가/수정합니다.

```javascript
var SS_ID          = '16tTQilanjKsumRLmSHrbeBghgdMNF2p9FjemZq-9Qco'; // 자금계산기 DB 스프레드시트
var SOLAPI_API_KEY    = '여기에_새_API_KEY';
var SOLAPI_API_SECRET = '여기에_새_API_SECRET';
var SOLAPI_SENDER     = '025551234';   // 솔라피에 등록·승인된 발신번호 (숫자만)
```

## 2-1. 어디에 넣나 — 기존 doGet 코드와 같은 파일

지금 GAS에 있는 `function doGet(e) {...}` 는 **그대로 두시고**, **같은 `코드.gs` 파일 안**에 아래를 추가하면 됩니다.
(한 프로젝트에 doGet · doPost · 기타 함수가 함께 있어도 됩니다.)

```
[코드.gs 파일 구성 — 위에서 아래로]

  var SS_ID = '16tTQila...';                 ← ① 맨 위에 설정값 4줄 추가
  var SOLAPI_API_KEY    = '...';                (API 키는 바로 여기!)
  var SOLAPI_API_SECRET = '...';
  var SOLAPI_SENDER     = '025551234';

  function doGet(e) { ... }                   ← ② 지금 있는 코드 그대로 (수정 X)

  function doPost(e) { ... }                  ← ③ 아래 3번 코드 전체를 doGet 뒤에 붙여넣기
  function sendSolapi(...) { ... }
  function solapiAuthHeader_() { ... }
  function solapiUploadImage_(base64) { ... }
```

즉 **솔라피 API 키는 파일 맨 위 `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` 두 변수**에 넣습니다.
`SOLAPI_SENDER` 에는 솔라피에 등록·승인된 발신번호(숫자만)를 넣습니다.
(현재 doGet이 스프레드시트 ID를 코드 안에 직접 쓰고 있는데, `SS_ID` 상수를 새로 두는 것이라 서로 충돌하지 않습니다.)

## 3. 붙여넣을 코드 (doPost + 솔라피 발송)

```javascript
function doPost(e){
  try{
    var d  = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SS_ID);

    // ── 의견 보내기 → '자금계산기 의견수집' 탭 ──
    if (d.requestType === 'calc_feedback'){
      var fName = d.sheet || '자금계산기 의견수집';
      var shF = ss.getSheetByName(fName) || ss.insertSheet(fName);
      var fHeader = ['접수시각','평가(별점)','의견','성명','전화번호','유입경로'];
      if (shF.getLastRow() === 0){
        shF.appendRow(fHeader);
      } else {
        var fhr = shF.getRange(1,1,1,shF.getLastColumn()).getValues()[0];
        if (fhr.indexOf('평가(별점)') === -1){
          shF.getRange(1,1,1,shF.getLastColumn()).clearContent();
          shF.getRange(1,1,1,fHeader.length).setValues([fHeader]);
        }
      }
      shF.appendRow([d.createdAt||new Date(), d.rating||'', d.comment||'', d.name||'', d.phone||'', d.source||'']);
      return ContentService.createTextOutput('ok');
    }

    // ── 문자 견적 신청 → '자금계산기 응답DB' 탭 기록 + 솔라피 발송 ──
    // 프런트가 columns/values 로 1·2구성 항목별 답변을 함께 보냅니다.
    if (d.requestType === 'taxi_quote_sms'){
      var sh = ss.getSheetByName('자금계산기 응답DB') || ss.insertSheet('자금계산기 응답DB');
      var cols = d.columns || [], vals = d.values || [];
      var header = ['접수일시','이름','연락처','유입경로']
                     .concat(cols)
                     .concat(['개인정보 동의','문자 발송 결과','문자 발송 결과(상세)']);
      if (sh.getLastRow() === 0) sh.appendRow(header);

      var result = '실패 (전송 오류)', detail = '';
      try {
        var r  = sendSolapi(d.phone, d.smsText || '개인택시 준비자금 견적입니다.', d.image, d.imageName);
        result = r.result; detail = r.detail;
      } catch (sendErr) {
        result = '실패 (전송 오류)'; detail = String(sendErr);
      }
      var row = [d.createdAt||new Date(), d.name||'', d.phone||'', d.source||'']
                  .concat(vals)
                  .concat([ d.privacyLabel || (d.privacyAgreed ? '동의' : '미동의'), result, detail ]);
      sh.appendRow(row);
      return ContentService.createTextOutput('ok');
    }

    return ContentService.createTextOutput('unknown requestType');
  } catch(err){
    return ContentService.createTextOutput('error: ' + err);
  }
}

// ===== 솔라피(Solapi) 발송 =====
function solapiAuthHeader_(){
  var date = new Date().toISOString();
  var salt = Utilities.getUuid().replace(/-/g,'');          // 32자
  var raw  = Utilities.computeHmacSha256Signature(date + salt, SOLAPI_API_SECRET);
  var sig  = raw.map(function(b){ return ('0'+(b & 0xFF).toString(16)).slice(-2); }).join('');
  return 'HMAC-SHA256 apiKey=' + SOLAPI_API_KEY + ', date=' + date + ', salt=' + salt + ', signature=' + sig;
}

// 이미지 base64 → 솔라피 스토리지 업로드 → fileId 반환 (MMS용)
function solapiUploadImage_(base64){
  var res = UrlFetchApp.fetch('https://api.solapi.com/storage/v1/files', {
    method:'post', contentType:'application/json',
    headers:{ Authorization: solapiAuthHeader_() },
    payload: JSON.stringify({ file: base64, name: 'quote.jpg', type: 'MMS' }),
    muteHttpExceptions: true
  });
  var j = JSON.parse(res.getContentText());
  if (!j.fileId) throw new Error('이미지 업로드 실패: ' + res.getContentText());
  return j.fileId;
}

function sendSolapi(to, text, imageBase64, imageName){
  to = String(to || '').replace(/[^0-9]/g, '');
  if (to.length < 10) throw new Error('수신번호 오류');

  var message = { to: to, from: SOLAPI_SENDER, text: text };

  if (imageBase64){                    // 이미지 있으면 MMS
    message.type    = 'MMS';
    message.subject = '개인택시 준비자금 견적';
    message.imageId = solapiUploadImage_(imageBase64);
  } else {                             // 없으면 길이에 따라 SMS/LMS
    if (text.length > 45){ message.type = 'LMS'; message.subject = '개인택시 준비자금 견적'; }
    else message.type = 'SMS';
  }

  var res = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send', {
    method:'post', contentType:'application/json',
    headers:{ Authorization: solapiAuthHeader_() },
    payload: JSON.stringify({ message: message }),
    muteHttpExceptions: true
  });
  return classifySolapi_(res.getResponseCode(), res.getContentText());
}

// 솔라피 응답 → '성공 / 실패(사유)' 해석
function classifySolapi_(httpCode, body){
  var code='', msg='', j=null;
  try { j = JSON.parse(body); } catch(e){}
  if (j){
    code = String(j.statusCode || j.errorCode || (j.groupInfo && j.groupInfo.statusMessage) || '');
    msg  = String(j.statusMessage || j.errorMessage || '');
  }
  var raw    = 'HTTP ' + httpCode + ' · code:' + code + ' · ' + (msg || String(body).slice(0,200));
  var reason = solapiReason_(code, msg);
  if (reason) return { result: '실패 (' + reason + ')', detail: raw };
  var accepted = (httpCode >= 200 && httpCode < 300) &&
                 (code === '2000' || code.charAt(0) === '2' || (j && !j.errorCode));
  if (accepted) return { result: '성공', detail: '이통사로 접수(리포트를 기다리는 중) · ' + raw };
  return { result: '실패 (사유 미상)', detail: raw };
}
function solapiReason_(code, msg){
  var m = String(msg || '');
  var table = [
    [/결번|없는\s*번호|잘못된\s*(수신)?\s*번호|유효하지\s*않은\s*번호|수신번호\s*오류/, '없는 번호 / 결번'],
    [/미가입|가입되지\s*않|해지|없는\s*가입자|서비스\s*미가입/,                   '미가입자'],
    [/전송\s*경로|라우팅|경로가?\s*없/,                                          '전송경로 없음'],
    [/발신번호|미승인|미등록/,                                                   '발신번호 미승인/미등록'],
    [/잔액|캐시|충전|포인트\s*부족|balance/i,                                     '캐시(잔액) 부족'],
    [/스팸|수신\s*거부|차단/,                                                     '수신거부/차단'],
    [/한도|초과|limit/i,                                                          '발송 한도 초과'],
    [/용량|사이즈|크기|size|too\s*large/i,                                        '이미지 용량 초과'],
    [/타임아웃|timeout/i,                                                         '통신 지연/타임아웃']
  ];
  for (var i=0;i<table.length;i++){ if (table[i][0].test(m)) return table[i][1]; }
  return '';
}
```

## 4. 배포 절차 (Apps Script)

1. 스프레드시트 → **확장 프로그램 → Apps Script** (기존 doGet 있는 그 프로젝트).
2. 위 **설정값 4개**를 맨 위에 넣고, **doPost + 솔라피 함수들**을 붙여넣기 (기존 doGet은 그대로 둠).
3. 상단 **배포 → 배포 관리 → 편집(연필) → 버전: 새 버전 → 배포**
   - (또는 *새 배포* → 유형 **웹 앱** → 실행: **나(본인)** → 액세스: **모든 사용자** → 배포)
   - **웹 앱 URL이 계산기 프런트의 `API` 값과 동일**해야 합니다. 같은 프로젝트를 새 버전으로 배포하면 URL은 유지됩니다.
4. 최초 실행 시 **권한 승인** (외부 요청 `UrlFetchApp` + 스프레드시트 접근).

## 5. 테스트

1. 계산기에서 두 구성 채우고 → **문자로 견적 받기 → 이름·번호 입력 → 신청**.
2. 스프레드시트 **'자금계산기 응답DB'** 탭에 행이 추가되는지 확인.
   - 컬럼: `접수일시 / 이름 / 연락처 / 유입경로 / (1·2구성 항목별 답변…) / 개인정보 동의 / 문자 발송 결과 / 문자 발송 결과(상세)`
   - 답변 항목은 프런트가 `columns/values`로 함께 전송하므로, 헤더는 **첫 접수 시 자동 생성**됩니다. (항목 구성을 바꾼 뒤에는 기존 헤더 행을 지우면 새 헤더로 다시 생성됩니다.)
3. **문자 발송 결과** 열: 접수 성공이면 `성공`, 실패면 `실패 (사유)` 형태. 상세 원문은 **문자 발송 결과(상세)** 열에 기록.
4. 입력한 번호로 **실제 MMS 수신** 확인.

> ⚠️ **최종 전달 실패 사유(없는 번호·미가입자 등)는 발송 직후 응답이 아니라 이통사 리포트에 나중에 반영**됩니다. 발송 직후 값은 대부분 `성공`(이통사로 접수, 리포트 대기 중)으로 기록되며, 검증 단계에서 걸러지는 오류(발신번호 미승인/캐시 부족/이미지 용량 등)만 즉시 `실패 (사유)`로 잡힙니다. 결번·미가입자까지 시트에 자동 반영하려면 **솔라피 리포트 웹훅 또는 메시지 상태 조회**를 추가해야 합니다(원하시면 코드 제공).

## 6. 유의사항

- **`no-cors` POST**라 프런트는 서버 응답을 받지 못합니다(정상). 성공/실패는 **시트 '발송결과' 열**로 확인하세요.
- **MMS 이미지 제한**: JPG 권장, 대략 **200KB 이하 / 가로·세로 1500px 내외**. 견적표가 너무 길면 업로드가 거부될 수 있으니, 그럴 때는 프런트에서 이미지 압축률(현재 JPEG 0.85)이나 크기를 줄이면 됩니다.
- **개인정보**: 전화번호를 시트에 저장·문자 발송하므로, 사이트에 개인정보 수집·이용 동의(이미 체크박스 있음)와 처리방침 고지를 유지하세요.
- **doGet과 doPost는 한 프로젝트**에서 공존합니다. 코드 추가 후 반드시 **새 버전으로 재배포**해야 반영됩니다.
