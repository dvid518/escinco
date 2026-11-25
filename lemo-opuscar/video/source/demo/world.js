// escinco Pitch — world.js
// The mess: generated financial noise elements from note tables
// Spawn poses, freeze state, type-row snap targets for collapse

import { SeededRandom, lerp, EASE, dist, angle } from './lib.js';

export const GRID_ROWS = {
    accounts: { y: 0.22, slots: 4, labels: ['Efectivo', 'BCP', 'Interbank', 'Binance'] },
    currencies: { y: 0.38, slots: 4, labels: ['PEN', 'USD', 'EUR', 'USDT'] },
    transactions: { y: 0.54, slots: 4, labels: ['Ingresos', 'Egresos', 'Transferencias', 'Cambios'] },
    investments: { y: 0.70, slots: 2, labels: ['BTC', 'VOO'] },
};

export const MESS_TYPES = [
    { id: 'account', label: 'Cuentas', color: '#96FFA1', count: 12, rows: 'accounts' },
    { id: 'currency', label: 'Divisas', color: '#FECA6F', count: 8, rows: 'currencies' },
    { id: 'transaction', label: 'Movimientos', color: '#FE8F8F', count: 16, rows: 'transactions' },
    { id: 'investment', label: 'Inversiones', color: '#DFA3FF', count: 10, rows: 'investments' },
];

const W = 1920;
const H = 1080;

export class MessElement {
    constructor(type, index, rng) {
        this.type = type;
        this.index = index;
        this.rng = rng;

        // Initial spawn position (off-screen or scattered)
        this.spawnX = rng.float(-200, W + 200);
        this.spawnY = rng.float(-200, H + 200);
        this.spawnRot = rng.float(-Math.PI, Math.PI);
        this.spawnScale = rng.float(0.8, 1.2);

        // Target grid position (assigned during collapse)
        this.targetX = 0;
        this.targetY = 0;
        this.targetRot = 0;
        this.targetScale = 1;

        // Current animated state
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.rot = this.spawnRot;
        this.scale = this.spawnScale;
        this.alpha = 1;

        // Animation timing
        this.spawnDelay = 0;
        this.spawnDuration = 0.3;
        this.freezeTime = 0;
        this.collapseStart = 0;
        this.collapseDuration = 0.4;
    }

    assignGridTarget(gridCols = 4) {
        const row = GRID_ROWS[this.type.rows];
        if (!row) return;

        const slot = this.index % row.slots;
        const col = slot;
        this.targetX = W * 0.12 + col * (W * 0.19);
        this.targetY = H * row.y;
        this.targetRot = 0;
        this.targetScale = 1;
    }

    update(t, freezeT, collapseT) {
        // Spawn animation
        if (t < this.spawnDelay) {
            this.alpha = 0;
            return;
        }
        const spawnT = Math.min(1, (t - this.spawnDelay) / this.spawnDuration);
        const eased = EASE.backOut(spawnT);
        this.x = lerp(this.spawnX, this.targetX || this.spawnX, eased);
        this.y = lerp(this.spawnY, this.targetY || this.spawnY, eased);
        this.rot = lerp(this.spawnRot, 0, eased);
        this.scale = lerp(this.spawnScale, 1, eased);
        this.alpha = spawnT;

        // Freeze: tremble
        if (freezeT > 0 && t >= freezeT) {
            const freezeProgress = Math.min(1, (t - freezeT) / 0.5);
            if (freezeProgress < 1) {
                const tremble = 2.4 * Math.sin(t * 40) * (1 - freezeProgress);
                this.x += tremble;
                this.y += tremble * 0.5;
                this.rot += tremble * 0.01;
            }
        }

        // Collapse: fly to grid
        if (collapseT > 0 && t >= collapseT) {
            const collapseProgress = Math.min(1, (t - collapseT) / this.collapseDuration);
            const eased = EASE.easeOut(collapseProgress);
            this.x = lerp(this.x, this.targetX, eased);
            this.y = lerp(this.y, this.targetY, eased);
            this.rot = lerp(this.rot, 0, eased);
            this.scale = lerp(this.scale, 1, eased);

            // Morph into uniform tile in first third
            if (collapseProgress < 0.33) {
                this.scale = lerp(this.scale, 0.9, collapseProgress * 3);
            }
        }
    }
}

export function generateMess(noteTables, seed = 0xE5C0) {
    const rng = new SeededRandom(seed);
    const elements = [];

    // Generate elements for each type, distributed across bars
    MESS_TYPES.forEach((type, typeIdx) => {
        const voice = typeIdx === 0 ? 'marimba' :
                      typeIdx === 1 ? 'vibraphone-hard' :
                      typeIdx === 2 ? 'glockenspiel' : 'marimba';
        const notes = noteTables[voice] || [];

        for (let i = 0; i < type.count; i++) {
            const el = new MessElement(type.id, i, rng);
            // Assign spawn delay based on note timing
            const noteIdx = Math.floor(i * notes.length / type.count) % notes.length;
            el.spawnDelay = notes[noteIdx]?.time || (1 + typeIdx * 2 + i * 0.1);
            el.spawnDuration = type.id === 'currency' ? 0.3 : 0.22;
            elements.push(el);
        }
    });

    // Assign grid targets
    elements.forEach(el => el.assignGridTarget());

    // Sort by spawn delay for rendering order
    elements.sort((a, b) => a.spawnDelay - b.spawnDelay);

    return { elements, rng };
}

export function getFreezeState(elements, t) {
    return elements.map(el => ({
        x: el.x, y: el.y, rot: el.rot, scale: el.scale, alpha: el.alpha,
        type: el.type, index: el.index
    }));
}

export function getCollapseState(elements, t, collapseT) {
    return elements.map(el => {
        const progress = Math.min(1, Math.max(0, (t - collapseT) / el.collapseDuration));
        const eased = EASE.easeOut(progress);
        return {
            x: lerp(el.x, el.targetX, eased),
            y: lerp(el.y, el.targetY, eased),
            rot: lerp(el.rot, 0, eased),
            scale: lerp(el.scale, 1, eased),
            alpha: el.alpha,
            type: el.type,
            index: el.index,
            morphed: progress > 0.33
        };
    });
}

// Insert elements (overload)
export const INSERTS = [
    { id: 'badge-999', label: '999+', type: 'badge', time: 15.5, duration: 0.5, x: 0.5, y: 0.15 },
    { id: 'tabs-148', label: '148 tabs', type: 'tabs', time: 16.0, duration: 0.5, x: 0.5, y: 0.5 },
    { id: 'storage-bar', label: 'Storage 94%', type: 'storage', time: 16.5, duration: 0.5, x: 0.5, y: 0.85 },
];

export function getInsertState(t) {
    return INSERTS.map(ins => {
        const progress = Math.min(1, Math.max(0, (t - ins.time) / ins.duration));
        const eased = EASE.backOut(progress);
        return {
            ...ins,
            progress: eased,
            scale: 0.1 + 0.9 * eased,
            alpha: eased
        };
    }).filter(s => s.progress > 0);
}