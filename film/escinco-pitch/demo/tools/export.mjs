// escinco Pitch — tools/export.mjs
// Export timeline and events for external tools

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TEMPO, BEAT, BAR, SIXTEENTH, FPS, KEY_TIMES, SILENCES, CUES, NOTE_TABLES, VOICES, PATTERN, SPAWN_MAP, CROSSCUTS, s2f, s2grid } from '../../timeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..');

const exportData = {
    meta: {
        tempo: TEMPO,
        beat: BEAT,
        bar: BAR,
        sixteenth: SIXTEENTH,
        fps: FPS,
        frameDuration: 1/FPS,
        totalDuration: 36,
        targetDuration: 30,
    },
    pattern: PATTERN,
    voices: VOICES,
    keyTimes: KEY_TIMES,
    silences: SILENCES,
    cues: CUES,
    spawnMap: SPAWN_MAP,
    crossCuts: CROSSCUTS,
    helpers: {
        s2f: 'seconds * 24',
        s2grid: 'returns {bars, beatInBar, sixteenthInBeat, totalSixteenths}'
    }
};

// Write JSON
fs.writeFileSync(path.join(outDir, 'export.json'), JSON.stringify(exportData, null, 2));

// Write CSV for key times
let csv = 'label,time_seconds,frame,bar,beat,sixteenth\n';
for (const [label, time] of Object.entries(KEY_TIMES)) {
    const grid = s2grid(time);
    const frame = s2f(time);
    csv += `${label},${time.toFixed(3)},${frame},${grid.bars},${grid.beatInBar},${grid.sixteenthInBeat}\n`;
}
fs.writeFileSync(path.join(outDir, 'key_times.csv'), csv);

// Write CSV for cues
csv = 'label,time_seconds,frame,tolerance\n';
for (const cue of CUES) {
    const frame = s2f(cue.time);
    csv += `${cue.label},${cue.time.toFixed(3)},${frame},${cue.tolerance.toFixed(3)}\n`;
}
fs.writeFileSync(path.join(outDir, 'cues.csv'), csv);

console.log('Exported: export.json, key_times.csv, cues.csv');