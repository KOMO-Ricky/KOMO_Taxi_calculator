#!/bin/bash
# 쇼츠 풀버전 조립: 컷1(6.45s컷) → 컷2 → 시연인서트 → 컷3(줌아웃) → 컷4 → 아웃트로v2
# 전환: 컷 크로스페이드 / 인서트 앞뒤 fadewhite. 자막: subs.ass (Pretendard, fonts/)
# 실행 위치: 쇼츠 작업/시연영상_제작
BIN="C:/Users/komol/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin"
CUT="../컷 영상"
"$BIN/ffmpeg" -v warning -y \
  -i "$CUT/New_cut1_1080p_202609041535.mp4" \
  -i "$CUT/New_cut_2_1080p_202609041551.mp4" \
  -i "../마이택시플랜_시연인서트_v15.mp4" \
  -i "$CUT/New_cut3_1080p_202609041551.mp4" \
  -i "$CUT/New_cut4_1080p_202609041552.mp4" \
  -i "../마이택시플랜_아웃트로_v2.mp4" \
  -filter_complex "
[0:v]trim=0:6.45,setpts=PTS-STARTPTS,fps=30,settb=AVTB[v0];
[1:v]trim=0:6.8,setpts=PTS-STARTPTS,fps=30,settb=AVTB[v1];
[2:v]fps=30,settb=AVTB[v2];
[3:v]fps=30,zoompan=z='if(lte(it,0.7),1.12-0.12*(it/0.7),1)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:fps=30:s=1080x1920,settb=AVTB[v3];
[4:v]fps=30,settb=AVTB[v4];
[5:v]fps=30,settb=AVTB[v5];
[v0][v1]xfade=transition=fade:duration=0.3:offset=6.15[x1];
[x1][v2]xfade=transition=fadewhite:duration=0.5:offset=12.45[x2];
[x2][v3]xfade=transition=fadewhite:duration=0.5:offset=51.15[x3];
[x3][v4]xfade=transition=fade:duration=0.3:offset=58.85[x4];
[x4][v5]xfade=transition=fade:duration=0.5:offset=66.35[x5];
[x5]ass=subs.ass:fontsdir=fonts[vout];
[0:a]atrim=0:6.45,asetpts=PTS-STARTPTS,aresample=48000,afade=t=out:st=6.15:d=0.3[a0];
[1:a]atrim=0:6.8,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.2,afade=t=out:st=6.3:d=0.5,adelay=6150|6150[a1];
[3:a]atrim=0:8,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.4,afade=t=out:st=7.7:d=0.3,adelay=51150|51150[a3];
[4:a]atrim=0:8,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.3,afade=t=out:st=7.4:d=0.6,adelay=58850|58850[a4];
[a0][a1][a3][a4]amix=inputs=4:normalize=0,apad,atrim=0:71.35[aout]
" -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart \
  "../마이택시플랜_쇼츠_풀버전_v1.mp4"
# 타임라인 (global): 컷1 0~ / 컷2 6.15~ / 인서트 12.45~ / 컷3 51.15~ / 컷4 58.85~ / 아웃트로 66.35~ / 총 71.35s
# 자막 시각을 바꿀 땐 subs.ass의 global 타임 기준으로 수정
