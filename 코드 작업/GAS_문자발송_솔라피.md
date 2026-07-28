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
      if (shF.getLastRow() === 0)
        shF.appendRow(['접수시각','별점','평가','의견','성명','전화번호','유입경로']);
      shF.appendRow([d.createdAt||new Date(), d.rating||'', d.ratingLabel||'',
                     d.comment||'', d.name||'', d.phone||'', d.source||'']);
      return ContentService.createTextOutput('ok');
    }

    // ── 문자 견적 신청 → '자금계산기 응답' 탭 기록 + 솔라피 발송 ──
    if (d.requestType === 'taxi_quote_sms'){
      var sh = ss.getSheetByName('자금계산기 응답') || ss.insertSheet('자금계산기 응답');
      if (sh.getLastRow() === 0)
        sh.appendRow(['접수시각','성명','전화번호','유입경로','발송결과']);

      var sendResult = '';
      try {
        sendResult = sendSolapi(d.phone, d.smsText || '개인택시 준비자금 견적입니다.', d.image, d.imageName);
      } catch (sendErr) {
        sendResult = 'ERR: ' + sendErr;
      }
      sh.appendRow([d.createdAt||new Date(), d.name||'', d.phone||'', d.source||'', sendResult]);
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
  return res.getResponseCode() + ' ' + res.getContentText().slice(0, 300);
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
2. 스프레드시트 **'자금계산기 응답'** 탭에 행이 추가되는지 확인.
3. **발송결과** 열이 `200 {...}` 이면 성공, `ERR:` / `4xx` 면 사유 확인 (발신번호 미승인, 캐시 부족, 이미지 용량 등).
4. 입력한 번호로 **실제 MMS 수신** 확인.

## 6. 유의사항

- **`no-cors` POST**라 프런트는 서버 응답을 받지 못합니다(정상). 성공/실패는 **시트 '발송결과' 열**로 확인하세요.
- **MMS 이미지 제한**: JPG 권장, 대략 **200KB 이하 / 가로·세로 1500px 내외**. 견적표가 너무 길면 업로드가 거부될 수 있으니, 그럴 때는 프런트에서 이미지 압축률(현재 JPEG 0.85)이나 크기를 줄이면 됩니다.
- **개인정보**: 전화번호를 시트에 저장·문자 발송하므로, 사이트에 개인정보 수집·이용 동의(이미 체크박스 있음)와 처리방침 고지를 유지하세요.
- **doGet과 doPost는 한 프로젝트**에서 공존합니다. 코드 추가 후 반드시 **새 버전으로 재배포**해야 반영됩니다.
