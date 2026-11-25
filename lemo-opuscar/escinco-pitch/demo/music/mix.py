#!/usr/bin/env python3
# escinco Pitch — music/mix.py
# Mix stems: foley + voices + ducking + silences → final mix at -14 LUFS

import argparse
import json
import numpy as np
import soundfile as sf
import os
import pyloudnorm as pyln

SAMPLE_RATE = 48000
TARGET_LUFS = -14.0

def load_stem(path):
    if not os.path.exists(path):
        return None
    audio, sr = sf.read(path)
    if sr != SAMPLE_RATE:
        raise ValueError(f"Sample rate mismatch: {sr} != {SAMPLE_RATE}")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)  # mono
    return audio

def normalize_lufs(audio, target_lufs=TARGET_LUFS):
    meter = pyln.Meter(SAMPLE_RATE)
    loudness = meter.integrated_loudness(audio)
    gain_db = target_lufs - loudness
    gain = 10**(gain_db / 20)
    return audio * gain

def apply_ducking(music, voice, duck_db=-8, attack=0.01, release=0.2):
    """Duck music under voice using sidechain envelope"""
    sr = SAMPLE_RATE
    # Voice envelope
    env = np.abs(voice)
    # Smooth
    from scipy.ndimage import gaussian_filter1d
    env = gaussian_filter1d(env, sigma=sr * attack)
    # Threshold
    threshold = np.max(env) * 0.1
    env = np.maximum(env, threshold)
    # Normalize
    env = env / np.max(env) if np.max(env) > 0 else env
    # Ducking curve
    duck_factor = 10**(duck_db / 20)
    gain = 1 - (1 - duck_factor) * env
    # Smooth gain changes
    from scipy.signal import filtfilt, butter
    b, a = butter(2, 2 * release / (sr/2), btype='low')
    gain = filtfilt(b, a, gain)
    return music * gain

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stems', required=True)
    parser.add_argument('--voice', required=True)
    parser.add_argument('--events', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--lufs', type=float, default=-14)
    args = parser.parse_args()

    with open(args.events) as f:
        events = json.load(f)

    # Load music stems
    music_stems = {}
    for name in ['marimba', 'vibraphone-hard', 'glockenspiel', 'pad', 'sine-pulse', 'shaker']:
        path = os.path.join(args.stems, f'{name}.wav')
        audio = load_stem(path)
        if audio is not None:
            music_stems[name] = audio

    # Load foley stems
    foley_stems = {}
    for name in ['cursor', 'keys', 'notification', 'whoosh', 'press', 'grid', 'light', 'crt', 'digit']:
        path = os.path.join(args.stems, f'foley_{name}.wav')
        audio = load_stem(path)
        if audio is not None:
            foley_stems[name] = audio

    # Load voice
    voice = load_stem(args.voice)
    if voice is None:
        raise ValueError("Voice audio not found")

    # Ensure all same length
    max_len = max(len(voice), max(len(a) for a in music_stems.values()), max(len(a) for a in foley_stems.values()))
    for d in [music_stems, foley_stems]:
        for k, v in d.items():
            if len(v) < max_len:
                d[k] = np.pad(v, (0, max_len - len(v)))
    if len(voice) < max_len:
        voice = np.pad(voice, (0, max_len - len(voice)))

    # Mix music stems
    music_mix = np.zeros(max_len)
    for name, audio in music_stems.items():
        gain = {'marimba': 1.0, 'vibraphone-hard': 0.8, 'glockenspiel': 0.6, 'pad': 0.4, 'sine-pulse': 0.3, 'shaker': 0.2}[name]
        music_mix += audio * gain

    # Apply subtractive process in breath (29-36s): remove notes bar by bar
    # This is a simplified version - in reality the score.py generates the subtractive pattern
    # Here we just apply a fade on the pattern
    breath_start = 29.0 * SAMPLE_RATE
    breath_end = 36.0 * SAMPLE_RATE
    if breath_end <= max_len:
        fade = np.linspace(1.0, 0.0, breath_end - breath_start)
        music_mix[breath_start:breath_end] *= fade

    # Duck music under voice
    music_mix = apply_ducking(music_mix, voice, duck_db=-8)

    # Mix foley
    foley_mix = np.zeros(max_len)
    foley_gains = {
        'cursor': 0.5, 'keys': 0.4, 'notification': 0.6,
        'whoosh': 0.5, 'press': 0.8, 'grid': 0.4,
        'light': 0.3, 'crt': 0.5, 'digit': 0.4
    }
    for name, audio in foley_stems.items():
        foley_mix += audio * foley_gains.get(name, 0.5)

    # Duck foley under voice (-4 dB)
    foley_mix = apply_ducking(foley_mix, voice, duck_db=-4)

    # Apply silences (digital zero)
    with open(args.events) as f:
        events = json.load(f)
    # Find silence events
    silences = []
    for ev in events.get('events', []):
        if ev.get('type') == 'silence':
            silences.append((ev['start'], ev['end']))

    # Also from timeline
    silence_windows = [
        (17.0, 17.5),  # freeze
        (35.5, 36.0),  # final
    ]
    for start, end in silence_windows:
        s = int(start * SAMPLE_RATE)
        e = int(end * SAMPLE_RATE)
        if e <= max_len:
            music_mix[s:e] = 0
            foley_mix[s:e] = 0
            voice[s:e] = 0

    # J/L cuts: voice comes in early/late relative to music
    # Handled by voice timing in events.json

    # Final mix
    final = music_mix + foley_mix + voice

    # Normalize to target LUFS
    final = normalize_lufs(final, args.lufs)

    # Save
    sf.write(args.output, final, SAMPLE_RATE)
    print(f"Mixed to {args.output} at {args.lufs} LUFS")

if __name__ == '__main__':
    main()