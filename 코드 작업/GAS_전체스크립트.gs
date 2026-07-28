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
      if (shF.getLastRow() === 0)
        shF.appendRow(['접수시각','별점','평가','의견','성명','전화번호','유입경로']);
      shF.appendRow([d.createdAt||new Date(), d.rating||'', d.ratingLabel||'',
                     d.comment||'', d.name||'', d.phone||'', d.source||'']);
      return ContentService.createTextOutput('ok');
    }

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
  return res.getResponseCode() + ' ' + res.getContentText().slice(0, 300);
}
