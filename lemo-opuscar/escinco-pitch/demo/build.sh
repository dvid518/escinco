#!/bin/bash
# escinco Pitch — build.sh
# Rebuilds everything: TTS → whisper → score → events → cue check → mix → srt → render → mux

set -euo pipefail

FILM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$(cd "$FILM_DIR/../../.." && pwd)"  # lemo-opuscar root
PROJECT_DIR="$(cd "$FILM_DIR/../.." && pwd)"  # escinco repo root

cd "$FILM_DIR"

echo "=== escinco Pitch Build ==="
echo "Film dir: $FILM_DIR"
echo "Library: $LIB_DIR"
echo "Project: $PROJECT_DIR"

# 1. Generate timeline dump for music sub-agent
echo "→ Generating timeline.json..."
node tools/dump_timeline.mjs > timeline.json
echo "  timeline.json written ($(jq '.key_times | length' timeline.json) key times)"

# 2. Generate TTS (edge-tts) for Spanish Latin American
echo "→ Generating TTS (edge-tts)..."
python3 tools/tts_edge.py \
    --voice es-MX-GuadalupeNeural \
    --rate +0% \
    --pitch +0Hz \
    --output voice.wav \
    --text "$(cat scripts/voiceover.txt)"

# 3. Align with whisper for word timestamps
echo "→ Aligning with faster-whisper..."
python3 tools/align_whisper.py \
    --audio voice.wav \
    --language es \
    --output events.json

# 4. Generate score stems from events.json + timeline.json
echo "→ Generating score stems..."
cd "$LIB_DIR"
python3 styles/dark-keynote/demo/music/score.py \
    --timeline "$FILM_DIR/timeline.json" \
    --events "$FILM_DIR/events.json" \
    --output "$FILM_DIR/music/stems/"

# 5. Mix: foley + voices + ducking + silences
echo "→ Mixing audio..."
python3 "$LIB_DIR/styles/dark-keynote/demo/music/mix.py" \
    --stems "$FILM_DIR/music/stems/" \
    --voice "$FILM_DIR/voice.wav" \
    --events "$FILM_DIR/events.json" \
    --output "$FILM_DIR/mix.wav" \
    --lufs -14

# 6. Generate SRT from events.json
echo "→ Generating subtitles..."
python3 "$LIB_DIR/core/render/srt.py" \
    --events "$FILM_DIR/events.json" \
    --output "$FILM_DIR/subtitles.srt"

# 7. Cue check
echo "→ Checking cues..."
python3 "$LIB_DIR/styles/dark-keynote/demo/tools/cuecheck.py" \
    --timeline "$FILM_DIR/timeline.json" \
    --events "$FILM_DIR/events.json" \
    --cues "$(node -e \"const c=require('./timeline.js'); console.log(JSON.stringify(c.CUES))\")"

# 8. Render frames
echo "→ Rendering frames..."
cd "$LIB_DIR"
node core/render/video.mjs escinco-pitch --size 1920x1080 --fps 24 --output "$FILM_DIR/render/"

# 9. Mux video + audio
echo "→ Muxing final video..."
"$LIB_DIR/core/render/mux.sh" \
    -i "$FILM_DIR/render/%06d.png" \
    -a "$FILM_DIR/mix.wav" \
    -o "$FILM_DIR/escinco-pitch.mp4" \
    -r 24 \
    -grain 0 \
    -lufs -14

echo "=== Build complete ==="
echo "Output: $FILM_DIR/escinco-pitch.mp4"