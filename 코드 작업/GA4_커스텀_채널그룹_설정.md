# GA4 사용자 지정 채널 그룹 설정 가이드

마이택시플랜(개인택시 준비자금 계산기) 홍보 경로를 GA4 보고서에서
원하는 이름으로 묶어 보기 위한 설정 문서입니다.

- 대상 속성: 측정 ID `G-GHT8R1LSBK`
- 목적: 기본 채널 그룹에서 "Unassigned"로 빠지는 커스텀 매체들을
  홍보 경로 이름 그대로 분류

---

## 1. 현재 배포 경로 · UTM 값

| # | 배포 위치 | 홍보 링크 | utm_source | utm_medium |
|---|---|---|---|---|
| 1 | 홈페이지 | `calculator.licen.co.kr/home` | `homepage` | `referral` |
| 2 | 네이버 대표카페 | `calculator.licen.co.kr/cafe` | `naver_cafe_official` | `cafe_official` |
| 3 | 네이버 타카페(전국택시연합모임) | `calculator.licen.co.kr/cafe_2` | `naver_cafe_taxiunion` | `cafe_union` |
| 4 | 카카오톡 오픈채팅 | `calculator.licen.co.kr/kakao_open_1` | `kakao_openchat` | `kakao_open_1` |
| 5 | 유튜브 | `calculator.licen.co.kr/youtube` | `youtube` | `youtube` |
| 6 | 유튜브(에반스) | `calculator.licen.co.kr/youtube_evans` | `youtube_evans` | `youtube_evans` |
| 7 | 문자(SMS) | `calculator.licen.co.kr/sms` | `sms` | `sms` |

공통: `utm_campaign=calculator_launch`

> 경로 구분의 기준은 **utm_source** 입니다(값이 모두 고유).
> utm_medium 은 보고서 가독성과 채널 그룹 분류용입니다.

---

## 2. 설정 위치

GA4 → **관리(⚙️)** → **데이터 표시** → **채널 그룹** → **새 채널 그룹 만들기**

- 채널 그룹 이름: `마이택시플랜 홍보채널`
- 설명(선택): `계산기 홍보 경로별 유입 분류`

> GA4는 메뉴 명칭이 자주 바뀝니다. "채널 그룹"과 유사한 항목을 찾으면 됩니다.
> 표준(무료) 속성은 만들 수 있는 커스텀 채널 그룹 수에 제한이 있으니 하나만 만들어 사용합니다.

---

## 3. 채널 구성

### 먼저 알아둘 것

새 채널 그룹을 만들면 **기본 채널 목록(Direct, Organic Search, Referral 등)이
미리 채워진 상태**로 시작합니다.

- **기본 채널을 지우지 말 것** — 홍보 링크 외 트래픽(검색·직접·기타 유입)의
  분류를 담당하는 안전망입니다. 지우면 전부 Unassigned로 빠집니다.
- 아래 7개를 **[새 채널 추가]** 로 만든 뒤, **[재정렬]** 로 **목록 맨 위(1~7번)** 에 배치합니다.
- `Direct`, `기타 유입` 등은 기본 채널이 이미 처리하므로 따로 만들지 않습니다.

### 순서가 중요한 이유

규칙은 **위에서부터 먼저 매칭**됩니다. 기본 채널 중 일부가 우리 트래픽을 가져갑니다.

- `Organic Video` : 소스가 `youtube` 이면 자동으로 매칭
- `Organic Social` : 카카오 등 소셜 소스를 매칭
- `Referral` : 나머지를 폭넓게 매칭

따라서 커스텀 채널 7개가 **반드시 기본 채널보다 위**에 있어야 합니다.

### 추가할 채널 (모두 `세션 소스` **정확히 일치**)

| 순서 | 채널 이름 | 세션 소스 |
|---|---|---|
| 1 | 네이버 대표카페 | `naver_cafe_official` |
| 2 | 택시연합 카페 | `naver_cafe_taxiunion` |
| 3 | 카카오 오픈채팅 | `kakao_openchat` |
| 4 | 홈페이지 | `homepage` |
| 5 | 유튜브 | `youtube` |
| 6 | 유튜브(에반스) | `youtube_evans` |
| 7 | 문자(SMS) | `sms` |

8번 이하는 기본 채널(Direct, Cross-network, … Organic Search, Referral 등) 그대로 유지

> 유튜브 채널을 하나로 합쳐 보고 싶다면 5·6번을 하나로 만들고
> 조건을 `세션 소스` **시작값** `youtube` 으로 지정하면 됩니다.
> (단, 이 경우 두 채널이 구분되지 않으므로 소스별로 나눠 보려면 위 표대로 분리해 두세요.)

### 매체(medium) 기준으로 걸고 싶을 때

동일한 결과를 매체로도 만들 수 있습니다. 위 1~3번을 아래로 대체하면 됩니다.

| 채널 이름 | 조건 |
|---|---|
| 네이버 대표카페 | `세션 매체` **정확히 일치** `cafe_official` |
| 택시연합 카페 | `세션 매체` **정확히 일치** `cafe_union` |
| 카카오 오픈채팅 | `세션 매체` **정확히 일치** `kakao_open_1` |

---

## 4. 확인 방법

1. **실시간 검증**: 보고서 → 실시간 → 각 홍보 링크를 클릭해 소스가 잡히는지 확인
2. **채널 그룹 적용 확인**: 보고서(트래픽 획득) 또는 탐색에서
   기본 채널 그룹 대신 `마이택시플랜 홍보채널` 선택
3. 표준 보고서 반영에는 수 시간~24시간이 걸릴 수 있습니다

---

## 5. 참고

- 커스텀 채널 그룹은 **과거 데이터에도 소급 적용**됩니다.
- 반드시 단축 링크(`/cafe`, `/cafe_2` 등)로 홍보해야 UTM이 붙습니다.
  맨 주소(`calculator.licen.co.kr`)로 공유하면 `(direct)`로 잡혀 경로 구분이 되지 않습니다.
- 채널을 추가할 때는 리다이렉트 폴더를 하나 더 만들고(예: `/blog`),
  이 문서의 표와 GA4 채널 규칙에 같은 방식으로 한 줄씩 추가하면 됩니다.

---

## 6. 변경 이력

- utm_medium 변경: `community`/`community`/`messenger`
  → `cafe_official`/`cafe_union`/`kakao_open_1`
- 경로명 변경: `/union` → `/cafe_2`
- 경로 추가: `/youtube_evans` (source·medium 모두 `youtube_evans`)
- utm_medium 변경: `/youtube` `video` → `youtube`
