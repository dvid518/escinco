// escinco Pitch — timeline.js
// Tempo grid, pattern, voice note tables, key times
// Source of truth for picture and sound. Write this first.

export const TEMPO = 120;                    // BPM
export const BEAT = 60 / TEMPO;              // 0.5 s
export const BAR = BEAT * 4;                 // 2.0 s
export const SIXTEENTH = BEAT / 4;           // 0.125 s (3 frames @ 24 fps)
export const FPS = 24;
export const FRAME = 1 / FPS;                // ~0.04167 s

// 12-note pattern (marimba voice 1) — minimal, hypnotic, in A minor pentatonic
// MIDI note numbers relative to A3 (57): A C D E G A C D E G A C
// Pattern length: 12 sixteenths = 3 beats = 0.75 s
export const PATTERN = [
    { n: 57, v: 0.9 },  // A3
    { n: 60, v: 0.7 },  // C4
    { n: 62, v: 0.8 },  // D4
    { n: 64, v: 0.6 },  // E4
    { n: 67, v: 0.7 },  // G4
    { n: 69, v: 0.5 },  // A4
    { n: 72, v: 0.6 },  // C5
    { n: 74, v: 0.5 },  // D5
    { n: 76, v: 0.4 },  // E5
    { n: 79, v: 0.5 },  // G5
    { n: 81, v: 0.3 },  // A5
    { n: 84, v: 0.3 },  // C6
];

// Voice definitions
// Each voice: { name, patternOffset (in sixteenths), drift (cents per bar), timbre, pan, gain }
export const VOICES = [
    // Voice 1: Marimba (on grid) — the ordered family
    { name: 'marimba', offset: 0, drift: 0, timbre: 'marimba', pan: 0, gain: 1.0 },
    // Voice 2: Vibraphone hard mallet (unison, then phases ahead) — the product family
    { name: 'vibraphone-hard', offset: 0, drift: +8, timbre: 'vibraphone-hard', pan: 0, gain: 0.8 },
    // Voice 3: Glockenspiel (drifts the other way) — the human scale
    { name: 'glockenspiel', offset: 0, drift: -6, timbre: 'glockenspiel', pan: 0, gain: 0.6 },
    // Voice 4: Pad (numpy saw, detuned) — harmony bed
    { name: 'pad', offset: 0, drift: 0, timbre: 'pad', pan: 0, gain: 0.4 },
    // Voice 5: Low sine pulse (eighths -> sixteenths) — tempo accelerator
    { name: 'sine-pulse', offset: 0, drift: 0, timbre: 'sine', pan: 0, gain: 0.3 },
    // Voice 6: Noise shaker — texture
    { name: 'shaker', offset: 0, drift: 0, timbre: 'shaker', pan: 0, gain: 0.2 },
];

// Key times (in seconds) — every visual beat hangs on a spoken word or score event
export const KEY_TIMES = {
    // Hook
    hookStart: 0.0,
    hookEnd: 1.0,

    // Accumulation (8 bars = 16 s)
    accBar1: 1.0,   // Accounts drop
    accBar2: 3.0,   // Currencies fling
    accBar3: 5.0,   // Transactions slide
    accBar4: 7.0,   // Investments/debts/pending
    accBar5: 9.0,   // Tremble intensifies
    accBar6: 11.0,
    accBar7: 13.0,
    accBar8: 15.0,  // Mess peak

    // Overload inserts (3 half-second inserts)
    insert1: 15.5,  // 999+ badge
    insert2: 16.0,  // 148 tabs
    insert3: 16.5,  // Red storage bar

    // Freeze + Silence (0.5 s)
    freezeStart: 17.0,
    freezeEnd: 17.5,

    // Press + Collapse (1 beat = 0.5 s)
    press: 17.5,
    collapseEnd: 18.0,

    // Light Reveal (2 s = 4 beats)
    revealStart: 18.0,
    revealEnd: 20.0,

    // Patrimonio Counter (2 s)
    counterDive: 20.0,
    counterScrambleStart: 20.5,
    counterScrambleEnd: 22.5,
    counterHold: 22.5,

    // Chart Draw (4 s)
    chartPullback: 22.5,
    chartAxisGrow: 23.0,
    chartPointsStart: 23.5,
    chartPointsEnd: 26.5,

    // Secondary Indicators (6 s, one per beat = 12 spawns but we have 5 groups)
    indCuentas: 26.5,
    indIngresos: 27.0,
    indDistribucion: 27.5,
    indInversiones: 28.0,
    indMetas: 28.5,
    indHold: 29.0,

    // Breath / Put-away (2 s = 4 beats)
    breathStart: 29.0,
    breathSidebar: 29.5,
    breathStatus: 30.0,
    breathHeaders: 30.5,
    breathCRTOff: 31.0,
    breathEnd: 31.0,

    // Close (5 s)
    closeAsterisk: 31.0,
    closeTypingEscinco: 32.0,
    closeTypingURL: 33.0,
    closeQuestion: 34.0,
    closeBlinkOut: 35.5,
    filmEnd: 36.0,
};

// Total duration: 36 s (we'll trim to 30 s in final edit by tightening gaps)
// For now, keep generous for storyboard alignment.

// Silence windows (digital zero on all tracks)
export const SILENCES = [
    { start: KEY_TIMES.freezeStart, end: KEY_TIMES.freezeEnd, label: 'freeze' },
    { start: KEY_TIMES.filmEnd - 0.5, end: KEY_TIMES.filmEnd, label: 'final' },
];

// J/L cuts
export const CROSSCUTS = [
    // J: light shimmer starts 0.4 s before light sweep
    { type: 'J', sound: 'light-shimmer', visual: 'light-sweep', offset: -0.4 },
    // L: press chord rings into reveal (bowed vibraphone)
    { type: 'L', sound: 'press-chord', visual: 'reveal', offset: 0 },
    // L: number chord rings into chart
    { type: 'L', sound: 'number-chord', visual: 'chart', offset: 0 },
    // J: subtractive pattern starts under last indicator
    { type: 'J', sound: 'subtractive-start', visual: 'indMetas', offset: -0.5 },
];

// Spawn events: each UI element spawns ON a score note
// Generated from note tables in music/score.py; here we define the mapping
export const SPAWN_MAP = {
    // Accumulation mess
    accounts: { voice: 'marimba', bars: [1, 2, 3, 4], count: 12 },
    currencies: { voice: 'vibraphone-hard', bars: [2, 3], count: 8 },
    transactions: { voice: 'glockenspiel', bars: [3, 4], count: 16 },
    investments: { voice: 'marimba', bars: [4, 5], count: 10 },

    // Collapse: each type flies to its row on press chord
    collapse: { voice: 'all', beat: KEY_TIMES.press },

    // Counter digits: one per sixteenth
    counterDigits: { voice: 'sine-pulse', sixteenths: 16 },

    // Chart points: one per beat
    chartPoints: { voice: 'marimba', beats: 14 },

    // Indicators: one per beat
    indicators: { voice: 'vibraphone-hard', beats: 5 },
};

// Cue check: key visual events that MUST land on a score note
export const CUES = [
    { time: KEY_TIMES.accBar1, label: 'accounts-drop', tolerance: 0.02 },
    { time: KEY_TIMES.accBar2, label: 'currencies-fling', tolerance: 0.02 },
    { time: KEY_TIMES.accBar3, label: 'transactions-slide', tolerance: 0.02 },
    { time: KEY_TIMES.accBar4, label: 'investments-spawn', tolerance: 0.02 },
    { time: KEY_TIMES.insert1, label: 'insert-999', tolerance: 0.02 },
    { time: KEY_TIMES.insert2, label: 'insert-tabs', tolerance: 0.02 },
    { time: KEY_TIMES.insert3, label: 'insert-storage', tolerance: 0.02 },
    { time: KEY_TIMES.freezeStart, label: 'silence-start', tolerance: 0.01 },
    { time: KEY_TIMES.press, label: 'press-chord', tolerance: 0.01 },
    { time: KEY_TIMES.revealStart, label: 'light-sweep', tolerance: 0.02 },
    { time: KEY_TIMES.counterScrambleStart, label: 'digit-lock-1', tolerance: 0.02 },
    { time: KEY_TIMES.chartAxisGrow, label: 'axis-grow', tolerance: 0.02 },
    { time: KEY_TIMES.chartPointsStart, label: 'chart-point-1', tolerance: 0.02 },
    { time: KEY_TIMES.indCuentas, label: 'ind-cuentas', tolerance: 0.02 },
    { time: KEY_TIMES.indIngresos, label: 'ind-ingresos', tolerance: 0.02 },
    { time: KEY_TIMES.indDistribucion, label: 'ind-distribucion', tolerance: 0.02 },
    { time: KEY_TIMES.indInversiones, label: 'ind-inversiones', tolerance: 0.02 },
    { time: KEY_TIMES.indMetas, label: 'ind-metas', tolerance: 0.02 },
    { time: KEY_TIMES.breathCRTOff, label: 'crt-off', tolerance: 0.02 },
    { time: KEY_TIMES.closeQuestion, label: 'final-question', tolerance: 0.02 },
];

// Export helper: convert seconds to frames
export function s2f(seconds) {
    return Math.round(seconds * FPS);
}

// Export helper: convert seconds to bars/beats/sixteenths
export function s2grid(seconds) {
    const bars = Math.floor(seconds / BAR);
    const beatInBar = Math.floor((seconds % BAR) / BEAT);
    const sixteenthInBeat = Math.floor(((seconds % BEAT) / SIXTEENTH));
    return { bars, beatInBar, sixteenthInBeat, totalSixteenths: Math.round(seconds / SIXTEENTH) };
}

// Generate note tables for each voice (used by picture and music)
export function generateNoteTables() {
    const tables = {};
    const totalSixteenths = Math.ceil(KEY_TIMES.filmEnd / SIXTEENTH);

    for (const voice of VOICES) {
        const notes = [];
        for (let i = 0; i < totalSixteenths; i++) {
            const patternIdx = (i + voice.offset) % PATTERN.length;
            const baseNote = PATTERN[patternIdx];
            // Apply drift: cents per bar
            const bar = Math.floor(i * SIXTEENTH / BAR);
            const driftCents = voice.drift * bar;
            const detune = driftCents / 100; // semitones
            notes.push({
                time: i * SIXTEENTH,
                midi: baseNote.n + detune,
                velocity: baseNote.v * voice.gain,
                timbre: voice.timbre,
                pan: voice.pan,
            });
        }
        tables[voice.name] = notes;
    }
    return tables;
}

export const NOTE_TABLES = generateNoteTables();