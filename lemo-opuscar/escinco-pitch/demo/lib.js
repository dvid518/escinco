// escinco Pitch — lib.js
// Shared helpers for engine.js, world.js, film.js

export function buf(name, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { canvas: c, ctx: c.getContext('2d') };
}

export function rr(g, x, y, w, h, r) {
    if (r <= 0) { g.rect(x, y, w, h); return; }
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
}

export function font(px, wt = 400, fam = 'Inter') {
    return `${wt} ${px}px ${fam}, Arial, sans-serif`;
}

export function rgba(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    return `rgba(${r},${g},${b},${a})`;
}

export function mix(c1, c2, t) {
    // Handle rgba() input and 3/6/8-char hex
    const parseColor = (c) => {
        if (c.startsWith('rgba') || c.startsWith('rgb')) {
            const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/);
            if (m) return { r: +m[1], g: +m[2], b: +m[3] };
            console.error('[mix] Failed to parse rgba:', c);
            return { r: 0, g: 0, b: 0 };
        }
        const h = c.replace('#', '');
        // Handle 3-char hex (#rgb -> #rrggbb)
        if (h.length === 3) {
            return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
        }
        // Handle 8-char hex (#rrggbbaa -> ignore alpha)
        if (h.length === 8) {
            h = h.slice(0, 6);
        }
        if (h.length !== 6) {
            console.error('[mix] Invalid hex length:', c, '->', h);
            return { r: 0, g: 0, b: 0 };
        }
        return { r: parseInt(h.slice(0,2), 16), g: parseInt(h.slice(2,4), 16), b: parseInt(h.slice(4,6), 16) };
    };
    const { r: r1, g: g1, b: b1 } = parseColor(c1);
    const { r: r2, g: g2, b: b2 } = parseColor(c2);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
        console.error('[mix] NaN result:', { c1, c2, t, r1, g1, b1, r2, g2, b2, r, g, b });
    }
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// Simple PRNG for reproducible generation
export class SeededRandom {
    constructor(seed = 0xC0FFEE) {
        this.state = seed >>> 0;
    }
    next() {
        this.state = (this.state * 1664525 + 1013904223) >>> 0;
        return this.state / 0x100000000;
    }
    int(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }
    float(min, max) {
        return min + this.next() * (max - min);
    }
    bool(p = 0.5) { return this.next() < p; }
    pick(arr) { return arr[this.int(0, arr.length - 1)]; }
}

// Easing functions
export const EASE = {
    linear: t => t,
    easeOut: t => 1 - Math.pow(1 - t, 3),
    easeIn: t => t * t * t,
    easeInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    backOut: t => { const s = 1.3; return 1 + s * Math.pow(t - 1, 3) + Math.pow(t - 1, 2); },
    backIn: t => { const s = 1.3; return t * t * ((s + 1) * t - s); },
    elasticOut: t => {
        if (t === 0) return 0;
        if (t === 1) return 1;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 0.75) + 1;
    },
};

// Interpolation
export function lerp(a, b, t) { return a + (b - a) * t; }
export function lerpAngle(a, b, t) {
    let d = b - a;
    d = ((d + Math.PI) % (2 * Math.PI)) - Math.PI;
    return a + d * t;
}

// Color helpers
export function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
export function rgbToHex(r, g, b) {
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
export function lerpColor(c1, c2, t) {
    const a = hexToRgb(c1), b = hexToRgb(c2);
    return rgbToHex(
        Math.round(lerp(a.r, b.r, t)),
        Math.round(lerp(a.g, b.g, t)),
        Math.round(lerp(a.b, b.b, t))
    );
}

// Geometry
export function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}
export function angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}
export function rotatePoint(x, y, cx, cy, a) {
    const dx = x - cx, dy = y - cy;
    return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
}

// Path helpers
export function pathRoundRect(x, y, w, h, r) {
    const p = new Path2D();
    rr(p, x, y, w, h, r);
    return p;
}

// Time formatting
export function fmtTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m}:${s.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}`;
}

// Frame helpers
export function framesAtFPS(seconds, fps = 24) {
    return Math.round(seconds * fps);
}
export function timeAtFrame(frame, fps = 24) {
    return frame / fps;
}

// Export all as a namespace for easy importing
export const lib = {
    buf, rr, font, rgba, mix,
    SeededRandom, EASE, lerp, lerpAngle,
    hexToRgb, rgbToHex, lerpColor,
    dist, angle, rotatePoint,
    pathRoundRect, fmtTime, framesAtFPS, timeAtFrame,
};