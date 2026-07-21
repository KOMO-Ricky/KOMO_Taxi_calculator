# Apps Script 추가 코드 (조합가입비·기준일·대출 데이터 연동)

계산기 프런트가 아래 키들을 읽도록 준비되어 있습니다.
스프레드시트 **`자금계산기 DB`** 시트 기준, 기존 Apps Script `doGet`의 `data` 객체에 아래 항목을 추가하세요.

## 1. doGet 함수 상단에 헬퍼 추가

```javascript
function doGet(e) {
  const ss = SpreadsheetApp.openById('16tTQilanjKsumRLmSHrbeBghgdMNF2p9FjemZq-9Qco');
  const sheet = ss.getSheetByName('자금계산기 DB');

  // 날짜 셀 → 'YYYY-MM-DD' 문자열 변환 헬퍼
  const tz = Session.getScriptTimeZone();
  const fmtDate = v => (v instanceof Date)
    ? Utilities.formatDate(v, tz, 'yyyy-MM-dd')
    : String(v || '').trim();

  // 대출 은행 표: Y3:AA 를 한 번에 읽고, 은행명이 빈 행은 제외
  const bankRows = sheet.getRange('Y3:AA').getValues()
    .filter(r => String(r[0]).trim() !== '');
```

## 2. data 객체에 추가할 항목

기존 `const data = { ... }` 안에 아래 7줄을 추가:

```javascript
    // ── 기준일 ──
    dataDate:      fmtDate(sheet.getRange('B9').getValue()),   // 데이터 기준일
    evSubsidyDate: fmtDate(sheet.getRange('B12').getValue()),  // 전기차 보조금 기준일
    dateLoan:      fmtDate(sheet.getRange('B15').getValue()),  // 대출 데이터 기준일

    // ── 조합 가입비 ──
    combineFee:    sheet.getRange('B18').getValue(),           // 서울개인택시조합 가입비

    // ── 대출 은행 표 (Y=은행명, Z=한도, AA=최저이율) ──
    loanBanks:     bankRows.map(r => String(r[0]).trim()),
    loanLimits:    bankRows.map(r => Number(r[1]) || 0),
    loanRates:     bankRows.map(r => Number(r[2]) || 0),
```

## 3. 참고

- **이율 표기**: AA열 값이 `5.2`(퍼센트)든 `0.052`(소수)든 프런트가 자동 인식합니다.
- **한도**: Z열은 원 단위 숫자 (예: `130000000`).
- **은행 추가/삭제**: Y열에 행을 추가·삭제하면 자동 반영됩니다 (은행명 빈 행은 무시).
- 수정 후 **배포 → 배포 관리 → 새 버전으로 배포**를 해야 반영됩니다.

## 4. 프런트가 표시하는 위치

| 스프레드시트 | 계산기 표시 위치 |
|---|---|
| B9 데이터 기준일 | 첫 페이지 상단 헤더 "🗓 데이터 기준일" |
| B12 전기차보조금 기준일 | 차량 모달 > 전기차 보조금 행 아래 |
| B15 대출 기준일 | 비교 페이지 > 대출 계산기 > 은행표 우측 배지 |
| B18 조합 가입비 | 보험/조합 모달 가입비 + 총액 계산 |
| Y/Z/AA 대출 은행표 | 비교 페이지 > 대출 계산기 은행 목록 |

## 5. 아직 연동 대기 중인 키 (셀 정해지면 알려주세요)

- `carRate` (차량별 할부율 배열, 연% — 월 납입 원리금균등 계산에 사용)
- `dateLicense` / `dateCar` / `dateCombine` (면허·차량·조합 항목별 기준일)
