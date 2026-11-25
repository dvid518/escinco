#!/usr/bin/env python3
# escinco Pitch — tools/cuecheck.py
# Checks that key visual cues land on score notes

import argparse
import json
import sys

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--timeline', required=True)
    parser.add_argument('--events', required=True)
    parser.add_argument('--cues', required=True)
    parser.add_argument('--tolerance', type=float, default=0.02)
    args = parser.parse_args()

    with open(args.timeline) as f:
        timeline = json.load(f)
    with open(args.events) as f:
        events = json.load(f)
    cues = json.loads(args.cues)

    # Build note time index for each voice
    note_times = {}
    for voice_name, notes in timeline.get('noteTables', {}).items():
        note_times[voice_name] = [n['time'] for n in notes]

    print(f"Checking {len(cues)} cues...")
    passed = 0
    failed = 0

    for cue in cues:
        cue_time = cue['time']
        label = cue['label']
        tolerance = cue.get('tolerance', args.tolerance)

        # Find nearest note across all voices
        nearest = None
        nearest_dist = float('inf')
        for voice, times in note_times.items():
            for t in times:
                dist = abs(t - cue_time)
                if dist < nearest_dist:
                    nearest_dist = dist
                    nearest = (voice, t)

        if nearest_dist <= tolerance:
            print(f"  ✓ {label}: {cue_time:.3f}s → {nearest[0]} @ {nearest[1]:.3f}s (Δ={nearest_dist*1000:.1f}ms)")
            passed += 1
        else:
            print(f"  ✗ {label}: {cue_time:.3f}s → nearest {nearest[0]} @ {nearest[1]:.3f}s (Δ={nearest_dist*1000:.1f}ms > {tolerance*1000:.1f}ms)")
            failed += 1

    print(f"\nResult: {passed} passed, {failed} failed")
    if failed > 0:
        sys.exit(1)

if __name__ == '__main__':
    main()