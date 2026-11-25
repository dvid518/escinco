#!/usr/bin/env python3
# escinco Pitch — tts_edge.py
# Generate TTS using Microsoft edge-tts (requires: pip install edge-tts)

import argparse
import asyncio
import edge_tts
import sys

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--voice', default='es-MX-GuadalupeNeural')
    parser.add_argument('--rate', default='+0%')
    parser.add_argument('--pitch', default='+0Hz')
    parser.add_argument('--output', default='voice.wav')
    parser.add_argument('--text', default='')
    parser.add_argument('--text-file', default='')
    args = parser.parse_args()

    if args.text_file:
        with open(args.text_file, 'r', encoding='utf-8') as f:
            text = f.read().strip()
    else:
        text = args.text

    if not text:
        print("Error: no text provided", file=sys.stderr)
        sys.exit(1)

    communicate = edge_tts.Communicate(text, args.voice, rate=args.rate, pitch=args.pitch)
    await communicate.save(args.output)
    print(f"Saved TTS to {args.output}")

if __name__ == '__main__':
    asyncio.run(main())