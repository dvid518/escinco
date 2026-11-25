# escinco Pitch Video — Dark Tech Keynote

## Overview
30-second pitch video for escinco financial dashboard, rendered in the **Dark Tech Keynote** style from Lemo-Opuscar.

## Structure
- source/ — Production code (engine, timeline, world, film scenes, build scripts)
- ssets/ — Real dashboard DOM captures (dashboard, patrimonio card, grafico card)
- storyboard/ — 6 key frames + contact sheet
- ender/ — Final MP4 output
- docs/ — Treatment, technical notes

## Key Specs
- Duration: 36s (trim to 30s)
- Resolution: 1920×1080 @ 24 fps
- Style: Dark Tech Keynote (Lemo-Opuscar)
- Fidelity: 100% real escinco dashboard DOM via Playwright
- Brand accent: #00a269 (tropicalMint/verdigris)
- Language: Español latinoamericano neutro
- Voice: Female, professional, warm (edge-tts es-MX-GuadalupeNeural)

## Pipeline
1. capture-dashboard.mjs — Playwright capture of real demo.html
2. 	imeline.js — Master timeline (120 BPM, note tables, key times)
3. engine.js — Dark Tech Keynote engine (browser + Node)
4. world.js — Mess generator, freeze, collapse, snap grid
5. ilm.js — 9 scene orchestration
6. uild.sh — End-to-end: TTS → whisper → score → mix → render → mux

## Build
`ash
cd source
chmod +x build.sh
./build.sh
# Requires: ffmpeg, node, python3 (edge-tts, faster-whisper, pyloudnorm, numpy, scipy, soundfile)
`

## Output
ender/video.mp4 — 36s, 1920×1080, H.264, ~4.9 MB
