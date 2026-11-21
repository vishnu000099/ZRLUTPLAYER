#!/usr/bin/env bash
# Verifies exported MP4 files: stream layout, durations, full decode, and audio level.
# Usage: scripts/verify-mp4.sh file1.mp4 [file2.mp4 ...]
status=0
for f in "$@"; do
  echo "== $(basename "$f")  ($(( $(stat -c %s "$f") / 1048576 )) MB)"
  ffprobe -v error -show_entries stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames,duration:format=duration \
    -of compact=p=0:nk=0 "$f" | sed 's/^/   /'
  vdur=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$f")
  adur=$(ffprobe -v error -select_streams a:0 -show_entries stream=duration -of csv=p=0 "$f")
  # Full decode of every video frame and audio sample = playback check
  errs=$(ffmpeg -v error -xerror -i "$f" -f null - 2>&1 | head -5)
  frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f")
  vol=$(ffmpeg -hide_banner -i "$f" -map 0:a:0 -af volumedetect -f null - 2>&1 | grep -oE "mean_volume: [-0-9.]+ dB")
  ok=1
  [ -z "$vdur" ] && ok=0
  [ -z "$adur" ] && ok=0
  [ -n "$errs" ] && ok=0
  if [ -n "$vdur" ] && [ -n "$adur" ]; then
    drift=$(awk -v a="$vdur" -v b="$adur" 'BEGIN{d=a-b; if(d<0)d=-d; print d}')
    awk -v d="$drift" 'BEGIN{exit !(d>0.1)}' && ok=0
  fi
  echo "   video ${vdur:-MISSING}s · audio ${adur:-MISSING}s · decoded frames ${frames} · ${vol:-no audio level} · decode errors: ${errs:-none}"
  if [ $ok = 1 ]; then echo "   RESULT: PASS"; else echo "   RESULT: FAIL"; status=1; fi
done
exit $status
