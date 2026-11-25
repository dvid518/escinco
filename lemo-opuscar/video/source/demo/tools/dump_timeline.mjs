// escinco Pitch — dump_timeline.mjs
// Exports timeline.js as JSON for music sub-agent and cue checking

import { TEMPO, BEAT, BAR, SIXTEENTH, FPS, KEY_TIMES, SILENCES, CUES, NOTE_TABLES, VOICES, PATTERN, SPAWN_MAP, CROSSCUTS, s2f, s2grid } from '../../timeline.js';

const output = {
    meta: {
        tempo: TEMPO,
        beat: BEAT,
        bar: BAR,
        sixteenth: SIXTEENTH,
        fps: FPS,
        totalDuration: 36,
        targetDuration: 30,
    },
    pattern: PATTERN,
    voices: VOICES.map(v => ({ name: v.name, offset: v.offset, drift: v.drift, timbre: v.timbre, pan: v.pan, gain: v.gain })),
    keyTimes: KEY_TIMES,
    silences: SILENCES,
    cues: CUES,
    spawnMap: SPAWN_MAP,
    crossCuts: CROSSCUTS,
    noteTables: {},
};

// Note tables are large; export summary
for (const [name, notes] of Object.entries(NOTE_TABLES)) {
    output.noteTables[name] = {
        count: notes.length,
        duration: notes.length * SIXTEENTH,
        firstNote: notes[0] ? { time: notes[0].time, midi: notes[0].midi } : null,
        lastNote: notes[notes.length - 1] ? { time: notes[notes.length - 1].time, midi: notes[notes.length - 1].midi } : null,
    };
}

// Full note tables for music generation (write separate file)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, '..');
fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify(output, null, 2));

// Also write full note tables
const fullTables = {};
for (const [name, notes] of Object.entries(NOTE_TABLES)) {
    fullTables[name] = notes.map(n => ({ t: n.time, m: n.midi, v: n.velocity, tm: n.timbre, p: n.pan }));
}
fs.writeFileSync(path.join(outDir, 'note-tables.json'), JSON.stringify(fullTables));

console.log('Timeline dumped to timeline.json and note-tables.json');