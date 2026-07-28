/*  개인택시 준비자금 계산기 — Apps Script (doGet + doPost/솔라피)
 *  ┌ 아래 3개만 본인 값으로 교체 ┐
 *  SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER
 */
var SS_ID             = '16tTQilanjKsumRLmSHrbeBghgdMNF2p9FjemZq-9Qco'; // 자금계산기 DB
var SOLAPI_API_KEY    = '여기에_솔라피_API_KEY';        // ← 솔라피 콘솔에서 발급
var SOLAPI_API_SECRET = '여기에_솔라피_API_SECRET';     // ← 생성 시 1회만 표시됨
var SOLAPI_SENDER     = '025551234';                   // ← 승인받은 발신번호(숫자만)


// ==========================================================================
//  doGet — 계산기 데이터 제공 (기존 코드 그대로)
// ==========================================================================
function doGet(e) {
  var ss = SpreadsheetApp.openById('16tTQilanjKsumRLmSHrbeBghgdMNF2p9FjemZq-9Qco');
  var s = ss.getSheetByName('자금계산기 DB');

  var tz = Session.getScriptTimeZone();
  function fmtDate(v) {
    if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    return String(v || '').trim();
  }

  var lastRow = s.getLastRow();

  var carFuels=[],carMakers=[],carNames=[];
  var carPrice=[],carOptAmt=[],carOptDesc=[],evSubsidy=[],taxFee=[],meterWork=[],insurance=[],saInsMin=[],saInsMax=[];
  for(var r=3;r<=lastRow;r++){
    var fuel=s.getRange('D'+r).getValue();
    if(fuel==='')continue;
    carFuels.push(String(fuel));
    carMakers.push(String(s.getRange('E'+r).getValue()));
    carNames.push(String(s.getRange('F'+r).getValue()));
    carPrice.push(s.getRange('G'+r).getValue());
    carOptAmt.push(s.getRange('H'+r).getValue());
    carOptDesc.push(s.getRange('I'+r).getValue());
    evSubsidy.push(s.getRange('J'+r).getValue());
    taxFee.push(s.getRange('K'+r).getValue());
    meterWork.push(s.getRange('L'+r).getValue());
    insurance.push(s.getRange('N'+r).getValue());
    saInsMin.push(s.getRange('O'+r).getValue());
    saInsMax.push(s.getRange('P'+r).getValue());
  }

  var loanBanks=[],loanLimits=[],loanRates=[];
  for(var r2=3;r2<=lastRow;r2++){
    var bank=s.getRange('Y'+r2).getValue();
    if(!bank)continue;
    loanBanks.push(String(bank));
    loanLimits.push(Number(s.getRange('Z'+r2).getValue())||0);
    loanRates.push(Number(s.getRange('AA'+r2).getValue())||0);
  }

  var data = {
    licensePrice:   s.getRange('B3').getValue(),
    commission:     s.getRange('B6').getValue(),
    dataDate:       fmtDate(s.getRange('B9').getValue()),
    evSubsidyDate:  fmtDate(s.getRange('B12').getValue()),
    dateLoan:       fmtDate(s.getRange('B15').getValue()),
    combineFee:     s.getRange('B18').getValue(),
    carFuels:   carFuels,
    carMakers:  carMakers,
    carNames:   carNames,
    carPrice:   carPrice,
    carOptAmt:  carOptAmt,
    carOptDesc: carOptDesc,
    evSubsidy:  evSubsidy,
    taxFee:     taxFee,
    meterWork:  meterWork,
    insurance:  insurance,
    saInsMin:   saInsMin,
    saInsMax:   saInsMax,
    selItems: (function(){
      var result=[];
      for(var r3=3;r3<=7;r3++){ result.push(s.getRange(r3,23).getValue()); }
      return result;
    })(),
    reqItems: (function(){
      var result=[];
      for(var r4=3;r4<=6;r4++){ result.push(s.getRange(r4,19).getValue()); }
      return result;
    })(),
    loanBanks:  loanBanks,
    loanLimits: loanLimits,
    loanRates:  loanRates
  };

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ==========================================================================
//  doPost — 문자 견적 신청 / 의견 접수  (DB 기록 + 솔라피 발송)
// ==========================================================================
function doPost(e){
  try{
    var d  = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SS_ID);

    if (d.requestType === 'calc_feedback'){
      var fName = d.sheet || '자금계산기 의견수집';
      var shF = ss.getSheetByName(fName) || ss.insertSheet(fName);
      var fHeader = ['접수시각','평가(별점)','의견','성명','전화번호','유입경로'];
      if (shF.getLastRow() === 0){
        shF.appendRow(fHeader);
      } else {
        var fhr = shF.getRange(1,1,1,shF.getLastColumn()).getValues()[0];
        if (fhr.indexOf('평가(별점)') === -1){        // 옛 헤더(별점·평가 분리) → 새 헤더로 치유
          shF.getRange(1,1,1,shF.getLastColumn()).clearContent();
          shF.getRange(1,1,1,fHeader.length).setValues([fHeader]);
        }
      }
      shF.appendRow([d.createdAt||new Date(), d.rating||'', d.comment||'', d.name||'', d.phone||'', d.source||'']);
      return ContentService.createTextOutput('ok');
    }

    if (d.requestType === 'taxi_quote_sms'){
      var TAB = '자금계산기 응답DB';
      var sh  = ss.getSheetByName(TAB) || ss.insertSheet(TAB);

      // 프런트가 보내온 항목별 컬럼/값 (1구성·2구성 대항목/소항목 전체)
      var cols = d.columns || [];
      var vals = d.values  || [];

      // 고정 앞/뒤 컬럼 + 답변 항목들로 헤더 구성 (메시지ID는 발송결과 자동 갱신용)
      var header = ['접수일시','이름','연락처','유입경로']
                     .concat(cols)
                     .concat(['개인정보 동의','문자 발송 결과','문자 발송 결과(상세)','메시지ID']);

      // 헤더 자동 생성/치유: 비어있거나 옛 헤더(항목 컬럼 없음)면 새 헤더로 교체
      if (sh.getLastRow() === 0){
        sh.appendRow(header);
      } else {
        var hr = sh.getRange(1,1,1,Math.max(header.length, sh.getLastColumn())).getValues()[0];
        if (hr.indexOf('개인정보 동의') === -1){          // 옛 5칸 헤더 → 새 헤더로 갱신
          sh.getRange(1,1,1,header.length).setValues([header]);
        }
      }

      // 솔라피 발송 + 결과 해석(성공 / 실패(사유))
      var result = '실패 (전송 오류)', detail = '', messageId = '';
      try {
        var r  = sendSolapi(d.phone, d.smsText || '개인택시 준비자금 견적입니다.', d.image, d.imageName);
        result    = r.result;      // '성공' 또는 '실패 (사유)'
        detail    = r.detail;      // HTTP/코드/원문 등 상세
        messageId = r.messageId || '';
      } catch (sendErr) {
        result = '실패 (전송 오류)';
        detail = String(sendErr);
      }

      var row = [d.createdAt||new Date(), d.name||'', d.phone||'', d.source||'']
                  .concat(vals)
                  .concat([ d.privacyLabel || (d.privacyAgreed ? '동의' : '미동의'), result, detail, messageId ]);
      sh.appendRow(row);
      return ContentService.createTextOutput('ok');
    }

    return ContentService.createTextOutput('unknown requestType');
  } catch(err){
    return ContentService.createTextOutput('error: ' + err);
  }
}


// ==========================================================================
//  솔라피(Solapi) 발송 함수
// ==========================================================================
function solapiAuthHeader_(){
  var date = new Date().toISOString();
  var salt = Utilities.getUuid().replace(/-/g,'');
  var raw  = Utilities.computeHmacSha256Signature(date + salt, SOLAPI_API_SECRET);
  var sig  = raw.map(function(b){ return ('0'+(b & 0xFF).toString(16)).slice(-2); }).join('');
  return 'HMAC-SHA256 apiKey=' + SOLAPI_API_KEY + ', date=' + date + ', salt=' + salt + ', signature=' + sig;
}

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
  if (imageBase64){
    message.type    = 'MMS';
    message.subject = '개인택시 준비자금 견적';
    message.imageId = solapiUploadImage_(imageBase64);
  } else {
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

// ==========================================================================
//  솔라피 응답 → '성공 / 실패(사유)' 로 해석
//  · 접수 성공(statusCode 2000)은 '성공'(이통사로 접수, 리포트 대기 중)으로 기록
//  · 결번/미가입자 등 '최종 전달 실패'는 발송 직후가 아니라 이통사 리포트에
//    반영되므로, 그 사유는 리포트 조회/웹훅으로 갱신해야 정확합니다.
// ==========================================================================
function classifySolapi_(httpCode, body){
  var code='', msg='', mid='', j=null;
  try { j = JSON.parse(body); } catch(e){}
  if (j){
    code = String(j.statusCode || j.errorCode || (j.groupInfo && j.groupInfo.statusMessage) || '');
    msg  = String(j.statusMessage || j.errorMessage || '');
    mid  = String(j.messageId || (j.groupInfo && j.groupInfo.groupId) || '');
  }
  var raw    = 'HTTP ' + httpCode + ' · code:' + code + ' · ' + (msg || String(body).slice(0,200));
  var reason = solapiReason_(code, msg);
  if (reason) return { result: '실패 (' + reason + ')', detail: raw, messageId: mid };

  var accepted = (httpCode >= 200 && httpCode < 300) &&
                 (code === '2000' || code.charAt(0) === '2' || (j && !j.errorCode));
  if (accepted) return { result: '성공 (이통사로 접수, 리포트 대기 중)', detail: raw, messageId: mid };
  return { result: '실패 (사유 미상)', detail: raw, messageId: mid };
}


// ==========================================================================
//  발송결과 자동 갱신 — 솔라피 리포트 조회 (결번/미가입자 등 최종 전달 결과)
//  · Apps Script → 트리거 → updateSmsReports 를 '시간 기반 · 5~10분마다'로 등록하세요.
//  · '메시지ID'가 있고 아직 확정(전달완료/실패)되지 않은 행만 갱신합니다.
// ==========================================================================
function updateSmsReports(){
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName('자금계산기 응답DB');
  if (!sh || sh.getLastRow() < 2) return;

  var header  = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var cResult = header.indexOf('문자 발송 결과') + 1;
  var cDetail = header.indexOf('문자 발송 결과(상세)') + 1;
  var cMid    = header.indexOf('메시지ID') + 1;
  if (!cResult || !cMid) return;

  var last = sh.getLastRow();
  for (var r = 2; r <= last; r++){
    var mid = String(sh.getRange(r, cMid).getValue()).trim();
    if (!mid) continue;
    var cur = String(sh.getRange(r, cResult).getValue());
    if (cur.indexOf('전달완료') >= 0 || cur.indexOf('실패 (') === 0) continue;  // 이미 확정된 행은 건너뜀

    var st = solapiMessageStatus_(mid);
    if (st){
      sh.getRange(r, cResult).setValue(st.result);
      if (cDetail) sh.getRange(r, cDetail).setValue(st.detail);
    }
  }
}

// 메시지ID 하나의 최종 상태 조회
function solapiMessageStatus_(messageId){
  var res = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/list?messageId=' + encodeURIComponent(messageId), {
    method:'get', headers:{ Authorization: solapiAuthHeader_() }, muteHttpExceptions: true
  });
  try {
    var j = JSON.parse(res.getContentText());
    var list = j.messageList || {};
    var keys = Object.keys(list);
    if (!keys.length) return null;
    var m      = list[keys[0]];
    var status = String(m.status || '');            // PENDING / SENDING / COMPLETE / FAILED
    var code   = String(m.statusCode || '');
    var msg    = String(m.statusMessage || '');
    var raw    = 'status:' + status + ' · code:' + code + ' · ' + msg;

    var reason = solapiReason_(code, msg);
    if (reason)                          return { result: '실패 (' + reason + ')', detail: raw };
    if (status === 'COMPLETE')           return { result: '성공 (전달완료)',        detail: raw };
    if (status === 'FAILED')             return { result: '실패 (' + (msg || '전달 실패') + ')', detail: raw };
    if (status === 'PENDING' || status === 'SENDING')
                                         return { result: '성공 (이통사로 접수, 리포트 대기 중)', detail: raw };
    return null;
  } catch(e){ return null; }
}

// 상태 메시지/코드 → 실패 사유 분류 (해당 없으면 '' = 성공/접수)
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
  return '';   // 정상 접수/대기 → 성공 처리
}
