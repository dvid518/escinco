#!/usr/bin/env python3
# escinco Pitch — align_whisper.py
# Align TTS audio with text using faster-whisper for word timestamps

import argparse
import json
import sys
from faster_whisper import WhisperModel

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--audio', required=True)
    parser.add_argument('--language', default='es')
    parser.add_argument('--output', required=True)
    parser.add_argument('--model', default='base')
    args = parser.parse_args()

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(args.audio, language=args.language, word_timestamps=True)

    events = []
    for segment in segments:
        for word in segment.words:
            events.append({
                "time": word.start,
                "word": word.word.strip(),
                "confidence": word.probability
            })

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump({
            "language": info.language,
            "duration": info.duration,
            "events": events
        }, f, ensure_ascii=False, indent=2)

    print(f"Aligned {len(events)} words to {args.output}")

if __name__ == '__main__':
    main()