#!/usr/bin/env bash
# Demo: genera testsrc y encodea H.264 + AAC a HLS
OUTDIR=${1:-out-encode}
mkdir -p "$OUTDIR"

ffmpeg -y -f lavfi -i testsrc=size=1280x720:rate=30 -f lavfi -i sine=frequency=1000:sample_rate=48000   -c:v libx264 -tune zerolatency -preset veryfast -crf 23   -c:a aac -b:a 128k -shortest   -f hls -hls_time 4 -hls_list_size 6 "$OUTDIR/index.m3u8"
