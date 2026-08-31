# 시연 인서트 영상 제작 파이프라인

앱 화면녹화(실데이터) + 인포그래픽 합성으로 쇼츠용 시연 영상을 만드는 파이프라인.
시세 데이터가 바뀌어도 아래 절차로 같은 영상을 재생성할 수 있다.

## 산출물 (쇼츠 작업/ 바로 아래)

| 파일 | 내용 |
|---|---|
| `마이택시플랜_시연인서트_v15.mp4` | 39.2초 · 1080×1920 · 화이트 인 → 인트로 → 시연 → 화이트 아웃 |
| `마이택시플랜_아웃트로_v1.mp4` | 5초 · 로고 + KOLA/양수도센터/한국모빌리티연구소 |

**조립 순서**: 컷1 → 컷2 → 시연인서트 → 컷3 → 컷4 → 아웃트로 (BGM은 CapCut에서)

## 필요 도구 (이미 설치됨)

- Node 포터블: `C:\Users\komol\.local\node\node-v24.19.0-win-x64\node.exe`
- Playwright(Chromium 포함): 최초 1회 `npm install playwright` + `node node_modules/playwright/cli.js install chromium`
- ffmpeg: `C:\Users\komol\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_...\bin` (winget Gyan.FFmpeg)

## 파일 구성

| 파일 | 역할 |
|---|---|
| `record4.js` | 장면 녹화 ① — 커버·차량 등 (CDP 스크린캐스트, 손커서·탭리플·토스트숨김 주입) |
| `record6.js` | 장면 녹화 ② — 면허(지역 드롭다운 연출 포함) |
| `stills.js` | 완성 컷 4장 스틸 캡처 (보험 모달·작업비 모달·비교표·견적 페이지) |
| `comp14.html` | 최종 합성 정의 — 타임라인·캡션·페이드가 전부 여기 있음 (수정은 여기서) |
| `outro.html` | 아웃트로 합성 |
| `render.js` | 합성 페이지를 프레임 단위 렌더 → JPEG 시퀀스 |
| `scenes4/ scenes6/` | 녹화된 장면 mp4 (comp14가 상대경로로 참조) |
| `still_*.png` `kola_logo.png` | 스틸·로고 에셋 |

## 재렌더 (문구·타이밍만 수정할 때)

`comp14.html`을 고친 뒤:

```bash
cd "쇼츠 작업/시연영상_제작"
COMP_FILE=comp14.html "C:/Users/komol/.local/node/node-v24.19.0-win-x64/node.exe" render.js
ffmpeg -y -framerate 30 -i "comp_frames/f%05d.jpg" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart out.mp4
```

- 미리보기(2fps, 수 초 소요): `render.js --preview`
- 아웃트로: `COMP_FILE=outro.html` 로 동일하게

※ render.js의 playwright는 npm 설치 위치를 따라간다. 스크래치가 아닌 이 폴더에서 처음 돌린다면
`npm.cmd install playwright` 를 이 폴더에서 한 번 실행할 것.

## 재녹화 (시세 데이터가 바뀌었을 때)

```bash
node record4.js     # scenes4/ 생성 (s1_cover, s3_car 사용)
node record6.js     # scenes6/s2_license 생성
node stills.js      # still_*.png 4장 갱신
```

각 녹화 후 프레임 시퀀스 → mp4 변환은 record 스크립트가 남긴 `frames.json` 기반 concat
(이 저장소 히스토리의 커밋 메시지 참고, 또는 scenes4/ 안의 list.txt 방식 그대로).

## 주의 (시행착오)

- **CDP 스크린캐스트는 390×844(CSS px)로만 나온다.** deviceScaleFactor·scale 옵션 무시됨.
  합성에서 562px 폭으로 업스케일해 사용 중 — 화질이 더 필요하면 스틸(page.screenshot, 2배)로 대체.
- **네이티브 드롭다운은 헤드리스에서 안 보인다.** record6.js처럼 가짜 드롭다운을 그려서 연출.
- **모달 스크롤 위치가 재사용된다.** 완성 모달을 찍을 땐 반드시 scrollTop=0 리셋 (stills.js 참고).
- 쇼츠 UI 세이프존: 하단 ~350px·우측 ~150px. 폰 목업 위치(top 450)와 탭 좌표가 이를 피하도록 잡혀 있음.
- 바텀시트 모달의 저장 버튼(CSS y≈746)은 스크롤로 올릴 수 없다 — 폰 크기/위치로만 해결 가능.
