#!/bin/bash

SERVER="http://localhost:8080"
INPUT_URL="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
OUTPUT_URL="rtmp://localhost/live/test"

HEADERS='{
  "userAgent": "Mozilla/5.0 CustomAgent",
  "referer": "https://my-player.com"
}'

function create_job() {
  METHOD=$1
  PRESET=$2
  OPTIONS=$3
  NAME=$4

  echo "➡️  Creando job: $NAME"

  JOB_ID=$(curl -s -X POST "$SERVER/jobs" \
    -H "Content-Type: application/json" \
    -d '{
      "input": "'"$INPUT_URL"'",
      "output": "'"$OUTPUT_URL"'",
      "method": "'"$METHOD"'",
      "preset": "'"$PRESET"'",
      "headers": '"$HEADERS"',
      '"$OPTIONS"'
    }' | jq -r .id)

  echo "✅ [$NAME] ID: $JOB_ID"

  echo "⏸ Pausando..."
  curl -s -X POST "$SERVER/jobs/$JOB_ID/pause"

  sleep 1

  echo "▶️ Reanudando..."
  curl -s -X POST "$SERVER/jobs/$JOB_ID/resume"

  echo "🔄 Reiniciando..."
  curl -s -X POST "$SERVER/jobs/$JOB_ID/restart"

  sleep 2

  echo "🗑 Eliminando job..."
  curl -s -X DELETE "$SERVER/jobs/$JOB_ID"

  echo "———"
}

# 1. COPY MODE
create_job "copy" "low" "" "copy-mode"

# 2. ENCODE PRESET: low
create_job "encode" "low" "" "encode-low"

# 3. ENCODE PRESET: medium
create_job "encode" "medium" "" "encode-medium"

# 4. ENCODE PRESET: high
create_job "encode" "high" "" "encode-high"

# 5. CUSTOM preset
CUSTOM_OPTIONS='"customOptions": {
  "crf": 22,
  "fps": 30,
  "width": 640,
  "videoBitrate": "1200k",
  "audioBitrate": "128k",
  "maxrate": "1500k",
  "bufsize": "2000k"
}'
create_job "encode" "custom" "$CUSTOM_OPTIONS" "custom-encode"

# Final
echo "📋 Listado final de jobs:"
curl -s "$SERVER/jobs" | jq