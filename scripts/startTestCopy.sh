#!/usr/bin/env bash
# Demo: copy input MP4 a HLS out con -c copy
INPUT=${1:-sample.mp4}
OUTDIR=${2:-out}
mkdir -p "$OUTDIR"

ffmpeg -y -i "$INPUT" -c copy -f hls -hls_time 4 -hls_list_size 5 "$OUTDIR/index.m3u8"
