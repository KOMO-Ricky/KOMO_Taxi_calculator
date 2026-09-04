#!/bin/bash
# 쇼츠 풀버전 v2 조립
# 컷1(6.45컷+0.45홀드) → 컷2(0.35리드) → 전환클립(줌+슈욱, 기존 차용) → 시연인서트
# → (fadewhite 0.9 + 슈욱) 컷3(줌아웃) → 컷4 → 아웃트로v2
# 헤더 오버레이(header.png)는 AI 컷 4개에 적용. BGM: Carefree, 인서트 시작부터 (대화 구간 40% 덕킹)
# 타임라인(global): 컷1 0 / 컷2 6.60 / 전환 13.55 / 인서트 14.34 / 컷3 52.64 / 컷4 60.34 / 아웃트로 67.84 / 총 72.84s
# 실행 위치: 쇼츠 작업/시연영상_제작
BIN="C:/Users/komol/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin"
CUT="../컷 영상"
"$BIN/ffmpeg" -v warning -y \
  -i "$CUT/New_cut1_1080p_202609041535.mp4" \
  -i "$CUT/New_cut_2_1080p_202609041551.mp4" \
  -i "../자막 적용/전환_앱시연진입.mp4" \
  -i "../마이택시플랜_시연인서트_v15.mp4" \
  -i "$CUT/New_cut3_1080p_202609041551.mp4" \
  -i "$CUT/New_cut4_1080p_202609041552.mp4" \
  -i "../마이택시플랜_아웃트로_v2.mp4" \
  -loop 1 -i "header.png" \
  -i "whoosh.wav" \
  -i "../음원/Carefree - Kevin MacLeod.mp3" \
  -filter_complex "
[0:v]trim=0:6.45,setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=0.45,settb=AVTB[c1];
[1:v]trim=0:6.8,setpts=PTS-STARTPTS,fps=30,tpad=start_mode=clone:start_duration=0.35,settb=AVTB[c2];
[2:v]scale=1080:1920:flags=lanczos,fps=30,settb=AVTB[tr];
[3:v]fps=30,settb=AVTB[ins];
[4:v]fps=30,zoompan=z='if(lte(it,0.7),1.12-0.12*(it/0.7),1)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:fps=30:s=1080x1920,settb=AVTB[c3];
[5:v]fps=30,settb=AVTB[c4];
[6:v]fps=30,settb=AVTB[outr];
[7:v]format=rgba,split=4[h1][h2][h3][h4];
[c1][h1]overlay=0:0:shortest=1[c1h];
[c2][h2]overlay=0:0:shortest=1[c2h];
[c3][h3]overlay=0:0:shortest=1[c3h];
[c4][h4]overlay=0:0:shortest=1[c4h];
[c1h][c2h]xfade=transition=fade:duration=0.3:offset=6.6[x1];
[x1][tr]xfade=transition=fade:duration=0.2:offset=13.55[x2];
[x2][ins]xfade=transition=fade:duration=0.12:offset=14.34[x3];
[x3][c3h]xfade=transition=fadewhite:duration=0.9:offset=52.64[x4];
[x4][c4h]xfade=transition=fade:duration=0.3:offset=60.34[x5];
[x5][outr]xfade=transition=fade:duration=0.5:offset=67.84[x6];
[x6]ass=subs.ass:fontsdir=fonts[vout];
[0:a]atrim=0:6.45,asetpts=PTS-STARTPTS,aresample=48000,afade=t=out:st=6.2:d=0.25[a0];
[1:a]atrim=0:6.8,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.2,afade=t=out:st=6.3:d=0.5,adelay=6950|6950[a1];
[2:a]aresample=48000,adelay=13550|13550[aT];
[8:a]aresample=48000,volume=1.1,adelay=52640|52640[wh2];
[4:a]atrim=0:8,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.4,afade=t=out:st=7.7:d=0.3,adelay=52640|52640[a3];
[5:a]atrim=0:8,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.3,afade=t=out:st=7.4:d=0.6,adelay=60340|60340[a4];
[9:a]atrim=0:58.6,asetpts=PTS-STARTPTS,aresample=48000,volume='if(between(t,38.30,53.50),0.4,if(gt(t,53.50),0.75,1))':eval=frame,afade=t=in:st=0:d=0.6,afade=t=out:st=56.1:d=2.4,adelay=14340|14340[bgm];
[a0][a1][aT][wh2][a3][a4][bgm]amix=inputs=7:normalize=0,apad,atrim=0:72.84[aout]
" -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart \
  "../마이택시플랜_쇼츠_풀버전_v2.mp4"
# 자막(subs.ass)은 global 타임 기준. BGM 덕킹 구간은 bgm 로컬시간(=global-14.34) 기준.
