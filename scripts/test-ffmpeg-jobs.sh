#!/bin/bash

SERVER="http://localhost:8080"
INPUT_URL="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
OUTPUT_URL="rtmp://localhost/live/test"

HEADERS='{
  "userAgent": "Mozilla/5.0 CustomAgent",
  "referer": "https://my-player.com"
}'

CUSTOM_OPTIONS='{
  "crf": 22,
  "fps": 30,
  "width": 640,
  "videoBitrate": "1200k",
  "audioBitrate": "128k",
  "maxrate": "1500k",
  "bufsize": "2000k"
}'

create_job() {
  METHOD=$1
  PRESET=$2
  NAME=$3

  echo "➡️  Creando job: $NAME"

  if [ "$PRESET" = "custom" ]; then
    JSON_PAYLOAD=$(jq -n \
      --arg input "$INPUT_URL" \
      --arg output "$OUTPUT_URL" \
      --arg method "$METHOD" \
      --arg preset "$PRESET" \
      --argjson headers "$HEADERS" \
      --argjson customOptions "$CUSTOM_OPTIONS" \
      '{
        input: $input,
        output: $output,
        method: $method,
        preset: $preset,
        headers: $headers,
        customOptions: $customOptions
      }')
  else
    JSON_PAYLOAD=$(jq -n \
      --arg input "$INPUT_URL" \
      --arg output "$OUTPUT_URL" \
      --arg method "$METHOD" \
      --arg preset "$PRESET" \
      --argjson headers "$HEADERS" \
      '{
        input: $input,
        output: $output,
        method: $method,
        preset: $preset,
        headers: $headers
      }')
  fi

  JOB_ID=$(curl -s -X POST "$SERVER/jobs" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD" | jq -r .id)

  if [[ -z "$JOB_ID" || "$JOB_ID" == "null" ]]; then
    echo "❌ Error al crear el job $NAME"
    return
  fi

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
create_job "copy" "low" "copy-mode"

# 2. ENCODE PRESET: low
create_job "encode" "low" "encode-low"

# 3. ENCODE PRESET: medium
create_job "encode" "medium" "encode-medium"

# 4. ENCODE PRESET: high
create_job "encode" "high" "encode-high"

# 5. CUSTOM ENCODE
create_job "encode" "custom" "custom-encode"

# Final list
echo "📋 Listado final de jobs:"
curl -s "$SERVER/jobs" | jq
