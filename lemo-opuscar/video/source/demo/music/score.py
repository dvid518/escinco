#!/usr/bin/env python3
# escinco Pitch — music/score.py
# Original minimalist score for Dark Tech Keynote style
# Generates stems: marimba, vibraphone, glockenspiel, pad, sine-pulse, shaker, foley

import argparse
import json
import numpy as np
import soundfile as sf
import os
from scipy import signal

SAMPLE_RATE = 48000

# --- Synthesis helpers ---

def adsr(duration, attack=0.01, decay=0.1, sustain=0.7, release=0.2, sr=SAMPLE_RATE):
    n = int(duration * sr)
    a = int(attack * sr)
    d = int(decay * sr)
    r = int(release * sr)
    s = max(0, n - a - d - r)
    env = np.zeros(n)
    if a > 0: env[:a] = np.linspace(0, 1, a)
    if d > 0: env[a:a+d] = np.linspace(1, sustain, d)
    if s > 0: env[a+d:a+d+s] = sustain
    if r > 0: env[-r:] = np.linspace(sustain, 0, r)
    return env

def marimba_tone(freq, duration, velocity=1.0, sr=SAMPLE_RATE):
    """Marimba: sine + odd harmonics, fast attack, exponential decay"""
    t = np.arange(int(duration * sr)) / sr
    # Fundamental + 3rd + 5th harmonics (marimba-like)
    wave = (np.sin(2*np.pi*freq*t) +
            0.3*np.sin(2*np.pi*freq*3*t) +
            0.1*np.sin(2*np.pi*freq*5*t))
    env = adsr(duration, attack=0.002, decay=0.08, sustain=0.0, release=0.3, sr=sr)
    return wave * env * velocity

def vibraphone_tone(freq, duration, velocity=1.0, hard=True, sr=SAMPLE_RATE):
    """Vibraphone: sine + even harmonics, softer attack"""
    t = np.arange(int(duration * sr)) / sr
    if hard:
        # Hard mallet: more high harmonics
        wave = (np.sin(2*np.pi*freq*t) +
                0.4*np.sin(2*np.pi*freq*2*t) +
                0.2*np.sin(2*np.pi*freq*4*t) +
                0.1*np.sin(2*np.pi*freq*6*t))
        env = adsr(duration, attack=0.003, decay=0.15, sustain=0.3, release=0.8, sr=sr)
    else:
        # Bowed: slow attack, sustained
        wave = np.sin(2*np.pi*freq*t) + 0.2*np.sin(2*np.pi*freq*2*t)
        env = adsr(duration, attack=0.5, decay=0.2, sustain=0.8, release=1.0, sr=sr)
    return wave * env * velocity

def glockenspiel_tone(freq, duration, velocity=1.0, sr=SAMPLE_RATE):
    """Glockenspiel: pure sine + 2nd harmonic, very fast decay"""
    t = np.arange(int(duration * sr)) / sr
    wave = np.sin(2*np.pi*freq*t) + 0.5*np.sin(2*np.pi*freq*2*t)
    env = adsr(duration, attack=0.001, decay=0.05, sustain=0.0, release=0.4, sr=sr)
    return wave * env * velocity

def pad_tone(freq, duration, velocity=1.0, sr=SAMPLE_RATE):
    """Detuned saw pad: multiple detuned oscillators"""
    t = np.arange(int(duration * sr)) / sr
    # 5 detuned saw waves
    wave = np.zeros_like(t)
    for detune in [-0.02, -0.01, 0, 0.01, 0.02]:
        f = freq * (1 + detune)
        wave += signal.sawtooth(2*np.pi*f*t)
    wave *= 0.2
    env = adsr(duration, attack=2.0, decay=0.5, sustain=0.7, release=3.0, sr=sr)
    return wave * env * velocity

def sine_pulse(freq, duration, velocity=1.0, sr=SAMPLE_RATE):
    """Low sine pulse for tempo"""
    t = np.arange(int(duration * sr)) / sr
    wave = np.sin(2*np.pi*freq*t)
    env = adsr(duration, attack=0.01, decay=0.05, sustain=0.0, release=0.1, sr=sr)
    return wave * env * velocity

def shaker_noise(duration, velocity=1.0, sr=SAMPLE_RATE):
    """Filtered noise for shaker"""
    n = int(duration * sr)
    noise = np.random.randn(n)
    # Bandpass 4-8 kHz
    sos = signal.butter(4, [4000, 8000], btype='bandpass', fs=sr, output='sos')
    noise = signal.sosfilt(sos, noise)
    env = adsr(duration, attack=0.001, decay=0.03, sustain=0.0, release=0.05, sr=sr)
    return noise * env * velocity * 0.1

def midi_to_freq(midi):
    return 440 * 2**((midi - 69) / 12)

def cents_to_ratio(cents):
    return 2**(cents / 1200)

# --- Main generation ---

def generate_stems(timeline_path, events_path, output_dir):
    with open(timeline_path) as f:
        timeline = json.load(f)
    with open(events_path) as f:
        events = json.load(f)

    os.makedirs(output_dir, exist_ok=True)

    TEMPO = timeline['meta']['tempo']
    BEAT = timeline['meta']['beat']
    SIXTEENTH = timeline['meta']['sixteenth']
    TOTAL_DURATION = timeline['meta']['totalDuration']

    n_samples = int(TOTAL_DURATION * SAMPLE_RATE)
    stems = {name: np.zeros(n_samples) for name in ['marimba', 'vibraphone-hard', 'glockenspiel', 'pad', 'sine-pulse', 'shaker']}

    # Generate note tables from timeline
    note_tables_path = os.path.join(os.path.dirname(timeline_path), 'note-tables.json')
    with open(note_tables_path) as f:
        note_tables = json.load(f)

    print(f"Generating stems for {TOTAL_DURATION}s at {TEMPO} BPM...")

    # Process each voice
    for voice_name, notes in note_tables.items():
        print(f"  {voice_name}: {len(notes)} notes")
        for note in notes:
            time = note['t']
            midi = note['m']
            vel = note['v']
            timbre = note['tm']
            pan = note['p']

            start_sample = int(time * SAMPLE_RATE)
            freq = midi_to_freq(midi)

            if voice_name == 'marimba':
                tone = marimba_tone(freq, 1.0, vel)
            elif voice_name == 'vibraphone-hard':
                tone = vibraphone_tone(freq, 1.5, vel, hard=True)
            elif voice_name == 'glockenspiel':
                tone = glockenspiel_tone(freq, 0.8, vel)
            elif voice_name == 'pad':
                tone = pad_tone(freq, 4.0, vel)
            elif voice_name == 'sine-pulse':
                tone = sine_pulse(freq, 0.3, vel)
            elif voice_name == 'shaker':
                tone = shaker_noise(0.2, vel)
            else:
                continue

            end_sample = min(start_sample + len(tone), n_samples)
            tone = tone[:end_sample - start_sample]

            # Pan
            if pan != 0:
                left_gain = np.cos((pan + 1) * np.pi / 4)
                right_gain = np.sin((pan + 1) * np.pi / 4)
                # For mono stems, just apply gain
                tone *= (left_gain + right_gain) / 2

            stems[voice_name][start_sample:end_sample] += tone

    # Pad: add harmonic progression (A minor -> F -> C -> G)
    # This creates the "pad that gains G#/D# dissonance and rises"
    pad_chords = [
        (0, [57, 60, 64]),      # Am
        (9, [53, 57, 60]),      # F
        (18, [60, 64, 67]),     # C
        (27, [67, 71, 74]),     # G
        (36, [57, 61, 64]),     # Am + G# (dissonance)
    ]
    for bar_time, chord in pad_chords:
        t_start = bar_time * 2.0  # 2s per bar at 120 BPM
        for midi in chord:
            freq = midi_to_freq(midi)
            tone = pad_tone(freq, 8.0, 0.3)
            start = int(t_start * SAMPLE_RATE)
            end = min(start + len(tone), n_samples)
            stems['pad'][start:end] += tone[:end-start]

    # Sine pulse: eighths -> sixteenths acceleration
    for bar in range(int(TOTAL_DURATION / 2)):
        bar_start = bar * 2.0
        if bar < 16:  # first 32s
            # Eighth notes
            for i in range(4):
                t = bar_start + i * 0.5
                tone = sine_pulse(55, 0.2, 0.3)
                start = int(t * SAMPLE_RATE)
                end = min(start + len(tone), n_samples)
                stems['sine-pulse'][start:end] += tone[:end-start]
        else:
            # Sixteenth notes
            for i in range(8):
                t = bar_start + i * 0.25
                tone = sine_pulse(55, 0.15, 0.2)
                start = int(t * SAMPLE_RATE)
                end = min(start + len(tone), n_samples)
                stems['sine-pulse'][start:end] += tone[:end-start]

    # Shaker: continuous texture
    shaker_dur = 0.5
    for i in range(int(TOTAL_DURATION / shaker_dur)):
        t = i * shaker_dur
        tone = shaker_noise(shaker_dur, 0.15)
        start = int(t * SAMPLE_RATE)
        end = min(start + len(tone), n_samples)
        stems['shaker'][start:end] += tone[:end-start]

    # Press chord at 17.5s: all voices land on A major 9
    press_time = 17.5
    press_chord = [69, 73, 76, 80, 84]  # A C# E G# B
    for voice in ['marimba', 'vibraphone-hard', 'glockenspiel']:
        for midi in press_chord:
            freq = midi_to_freq(midi)
            if voice == 'marimba':
                tone = marimba_tone(freq, 2.0, 0.8)
            elif voice == 'vibraphone-hard':
                tone = vibraphone_tone(freq, 3.0, 0.7, hard=True)
            else:
                tone = glockenspiel_tone(freq, 1.5, 0.5)
            start = int(press_time * SAMPLE_RATE)
            end = min(start + len(tone), n_samples)
            stems[voice][start:end] += tone[:end-start]

    # Bowed vibraphone carries chord into reveal (L-cut)
    for midi in press_chord:
        freq = midi_to_freq(midi)
        tone = vibraphone_tone(freq, 4.0, 0.5, hard=False)
        start = int(press_time * SAMPLE_RATE)
        end = min(start + len(tone), n_samples)
        stems['vibraphone-hard'][start:end] += tone[:end-start]

    # Subtractive process in breath (29-36s): remove one note per bar
    # Implemented in mix.py

    # Save stems
    for name, audio in stems.items():
        # Normalize to prevent clipping
        peak = np.max(np.abs(audio))
        if peak > 0:
            audio = audio / peak * 0.9
        sf.write(os.path.join(output_dir, f'{name}.wav'), audio, SAMPLE_RATE)
        print(f"  Saved {name}.wav ({len(audio)/SAMPLE_RATE:.1f}s)")

    # Generate foley stems
    generate_foley(output_dir, timeline, events)

    print("All stems generated.")

def generate_foley(output_dir, timeline, events):
    """Generate foley stems: cursor tick, keys, notifications, whoosh, press, grid, light, CRT-off"""
    SR = SAMPLE_RATE
    TOTAL = timeline['meta']['totalDuration']
    n = int(TOTAL * SR)

    foley = {
        'cursor': np.zeros(n),
        'keys': np.zeros(n),
        'notification': np.zeros(n),
        'whoosh': np.zeros(n),
        'press': np.zeros(n),
        'grid': np.zeros(n),
        'light': np.zeros(n),
        'crt': np.zeros(n),
        'digit': np.zeros(n),
    }

    def click(time, duration=0.02, freq=2000, gain=0.3):
        t = np.arange(int(duration * SR)) / SR
        wave = np.sin(2*np.pi*freq*t) * np.exp(-t * 50)
        start = int(time * SR)
        end = min(start + len(wave), n)
        for stem in ['cursor', 'keys', 'grid']:
            foley[stem][start:end] += wave[:end-start] * gain

    def glass(time, gain=0.4):
        t = np.arange(int(0.15 * SR)) / SR
        wave = np.sin(2*np.pi*3000*t) * np.exp(-t * 30) + 0.5*np.sin(2*np.pi*6000*t)*np.exp(-t*40)
        start = int(time * SR)
        end = min(start + len(wave), n)
        foley['notification'][start:end] += wave[:end-start] * gain

    def whoosh_sound(time, gain=0.3):
        t = np.arange(int(0.5 * SR)) / SR
        noise = np.random.randn(len(t))
        sos = signal.butter(4, [200, 4000], btype='bandpass', fs=SR, output='sos')
        noise = signal.sosfilt(sos, noise)
        env = np.exp(-t * 3)
        start = int(time * SR)
        end = min(start + len(noise), n)
        foley['whoosh'][start:end] += noise[:end-start] * env * gain

    def press_sound(time):
        # Felt mallet + 55->40 Hz sine drop
        t = np.arange(int(1.0 * SR)) / SR
        # Felt mallet
        click_wave = np.sin(2*np.pi*150*t) * np.exp(-t * 80)
        # Sine drop 55->40 Hz
        freq = 55 * (1 - t/1.0) + 40 * (t/1.0)
        sine_wave = np.sin(2*np.pi*freq*t) * np.exp(-t * 2)
        wave = click_wave + sine_wave
        start = int(time * SR)
        end = min(start + len(wave), n)
        foley['press'][start:end] += wave[:end-start] * 0.5

    def grid_tick(time, gain=0.2):
        t = np.arange(int(0.05 * SR)) / SR
        wave = np.sin(2*np.pi*800*t) * np.exp(-t * 100)
        start = int(time * SR)
        end = min(start + len(wave), n)
        foley['grid'][start:end] += wave[:end-start] * gain

    def light_shimmer(time, gain=0.2):
        t = np.arange(int(1.3 * SR)) / SR
        # Rising shimmer
        wave = np.sin(2*np.pi*1000*t) * (t/1.3) * np.exp(-t * 0.5)
        start = int(time * SR)
        end = min(start + len(wave), n)
        foley['light'][start:end] += wave[:end-start] * gain

    def crt_off(time):
        t = np.arange(int(0.22 * SR)) / SR
        # Vertical squash sound: descending pitch
        freq = 200 * (1 - t/0.22) + 50 * (t/0.22)
        wave = np.sin(2*np.pi*freq*t) * np.exp(-t * 10)
        start = int(time * SR)
        end = min(start + len(wave), n)
        foley['crt'][start:end] += wave[:end-start] * 0.4

    def digit_grain(time):
        t = np.arange(int(0.05 * SR)) / SR
        wave = np.sin(2*np.pi*1200*t) * np.exp(-t * 80)
        start = int(time * SR)
        end = min(start + len(wave), n)
        foley['digit'][start:end] += wave[:end-start] * 0.3

    # Cursor ticks: every beat during hook, then during mess
    for bar in range(2):
        for beat in range(4):
            click(bar * 2.0 + beat * 0.5)

    # Mess foley: files plop, photo flick, window whoosh
    for i in range(12):
        click(1.0 + i * 0.15, freq=300, gain=0.2)  # files plop
    for i in range(8):
        whoosh_sound(3.0 + i * 0.2, gain=0.2)  # currencies fling
    for i in range(16):
        glass(5.0 + i * 0.1, gain=0.15)  # notifications
    for i in range(10):
        whoosh_sound(7.0 + i * 0.1, gain=0.15)  # investments

    # Insert foley
    glass(15.5, gain=0.4)  # 999+ badge
    whoosh_sound(16.0, gain=0.3)  # tabs
    whoosh_sound(16.5, gain=0.4)  # storage bar

    # Freeze: silence (handled in mix)

    # Press
    press_sound(17.5)
    for i in range(12):
        grid_tick(17.5 + i * 0.03)

    # Light sweep
    light_shimmer(17.9)

    # Counter digit locks
    for i in range(16):
        digit_grain(20.5 + i * 0.125)

    # Chart axis ruler hiss
    for i in range(14):
        t = np.arange(int(0.03 * SR)) / SR
        noise = np.random.randn(len(t)) * 0.01
        sos = signal.butter(4, [2000, 8000], btype='bandpass', fs=SR, output='sos')
        noise = signal.sosfilt(sos, noise)
        start = int((23.0 + i * 0.25) * SR)
        end = min(start + len(noise), n)
        foley['grid'][start:end] += noise * 0.2

    # Indicator spawns
    for t in [26.5, 27.0, 27.5, 28.0, 28.5]:
        click(t, freq=1000, gain=0.25)
        glass(t + 0.05, gain=0.2)

    # CRT-off
    crt_off(31.0)

    # Final cursor ticks
    click(32.0)
    click(33.0)

    # Save
    for name, audio in foley.items():
        peak = np.max(np.abs(audio))
        if peak > 0:
            audio = audio / peak * 0.8
        sf.write(os.path.join(output_dir, f'foley_{name}.wav'), audio, SR)
        print(f"  Saved foley_{name}.wav")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--timeline', required=True)
    parser.add_argument('--events', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    generate_stems(args.timeline, args.events, args.output)