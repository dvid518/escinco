// escinco Pitch — engine.js
// Dark Tech Keynote style engine (Canvas 2D) adapted for escinco
// Real dashboard rendered via captured DOM textures, not redrawn

import { buf, rr, font, rgba, mix } from './lib.js';

export let ACCENT = '#00a269'; // escinco tropicalMint/verdigris
export let ACCENT_GLOW = 'rgba(0, 162, 105, 0.35)';

export const STAGE_BASE = '#0A0B0F';
export const STAGE_LIFT = '#151822';
export const STAGE_GLOW = '#3B4CCA';
export const TEXT_PRIMARY = '#E8EAF0';
export const TEXT_SECONDARY = '#8A90A0';
export const TEXT_LABEL = '#5C6272';
export const SURFACE_1 = '#12151C';
export const SURFACE_2 = '#1A1E28';
export const SURFACE_3 = '#222734';
export const BORDER = 'rgba(255,255,255,0.08)';
export const GRID_ALPHA = 0.032;
export const GRID_MODULE = 48;
export const VIGNETTE_ALPHA = 0.55;

let W = 1920;
let H = 1080;

// Dashboard textures (loaded at runtime)
let dashboardTex = null;
let patrimonioTex = null;
let graficoTex = null;
let logoTex = null;

export function getDashboardTex() { return dashboardTex; }
export function getPatrimonioTex() { return patrimonioTex; }
export function getGraficoTex() { return graficoTex; }
export function getLogoTex() { return logoTex; }

// ---- Public API ----

export function setAccent(hex) {
    ACCENT = hex;
    ACCENT_GLOW = hex.replace('#', '').replace(/^([0-9a-f]{6})$/i, (_, h) =>
        `rgba(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)}, 0.35)`
    );
}

export function setSize(w, h) {
    W = w; H = h;
}

export async function loadAssets(basePath = '') {
    const isNode = typeof process !== 'undefined' && process.versions?.node;
    
    async function loadImg(url) {
        if (isNode) {
            const { loadImage } = await import('canvas');
            return loadImage(url);
        } else {
            // Browser: use fetch + createImageBitmap
            const response = await fetch(url);
            const blob = await response.blob();
            return createImageBitmap(blob);
        }
    }
    
    dashboardTex = await loadImg(`${basePath}/dashboard-only.png`);
    patrimonioTex = await loadImg(`${basePath}/patrimonio-card.png`);
    graficoTex = await loadImg(`${basePath}/grafico-card.png`);
    
    // Generate logo texture
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 400;
    logoCanvas.height = 400;
    const lg = logoCanvas.getContext('2d');
    lg.fillStyle = TEXT_PRIMARY;
    lg.beginPath();
    const spikes = 5, outerR = 160, innerR = 64;
    for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI * i) / spikes - Math.PI / 2;
        const x = 200 + Math.cos(angle) * r;
        const y = 200 + Math.sin(angle) * r;
        if (i === 0) lg.moveTo(x, y); else lg.lineTo(x, y);
    }
    lg.closePath();
    lg.fill();
    logoTex = logoCanvas;
}

export function bg(g, { lift = true, cool = true, dark = true } = {}) {
    g.fillStyle = STAGE_BASE;
    g.fillRect(0, 0, W, H);

    if (lift) {
        const grd = g.createRadialGradient(W * 0.5, H * 0.15, 0, W * 0.5, H * 0.15, Math.max(W, H) * 0.8);
        grd.addColorStop(0, STAGE_LIFT);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, W, H);
    }

    if (cool) {
        const grd = g.createRadialGradient(W * 0.85, H * 0.15, 0, W * 0.85, H * 0.15, W * 0.6);
        grd.addColorStop(0, 'rgba(59, 76, 202, 0.08)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, W, H);
    }
}

export function grid(g, { ox = W/2, oy = H/2, scale = 1, module = GRID_MODULE, alpha = GRID_ALPHA, rect } = {}) {
    const x0 = rect ? rect.x : 0;
    const y0 = rect ? rect.y : 0;
    const x1 = rect ? rect.x + rect.w : W;
    const y1 = rect ? rect.y + rect.h : H;

    g.save();
    g.translate(ox, oy);
    g.scale(scale, scale);
    g.translate(-ox, -oy);

    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = 1 / scale;

    for (let x = Math.floor(x0 / module) * module; x <= x1; x += module) {
        g.beginPath();
        g.moveTo(x, y0);
        g.lineTo(x, y1);
        const isMajor = x % (module * 4) === 0;
        g.strokeStyle = `rgba(255,255,255,${isMajor ? alpha * 2 : alpha})`;
        g.stroke();
    }
    for (let y = Math.floor(y0 / module) * module; y <= y1; y += module) {
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x1, y);
        const isMajor = y % (module * 4) === 0;
        g.strokeStyle = `rgba(255,255,255,${isMajor ? alpha * 2 : alpha})`;
        g.stroke();
    }
    g.restore();
}

export function glow(g, x, y, r, color, a) {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, color.replace(/[\d.]+\)$/, `${a})`));
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
}

export function vignette(g, a = VIGNETTE_ALPHA) {
    const grd = g.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0)');
    grd.addColorStop(1, `rgba(0,0,0,${a})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
}

// Rounded UI surface: soft shadow, top-lit fill, 1px border, inner highlight
export function panel(g, x, y, w, h, { r = 14, fill = SURFACE_1, shadow = true, cheap = false } = {}) {
    g.save();
    g.translate(x, y);

    if (shadow && !cheap) {
        g.shadowColor = 'rgba(0,0,0,0.4)';
        g.shadowBlur = 24;
        g.shadowOffsetY = 8;
    } else if (shadow && cheap) {
        g.shadowColor = 'rgba(0,0,0,0.25)';
        g.shadowBlur = 8;
        g.shadowOffsetY = 4;
    }

    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, mix(fill, TEXT_PRIMARY, 0.03));
    grd.addColorStop(1, fill);
    g.fillStyle = grd;

    rr(g, 0, 0, w, h, r);
    g.fill();

    if (shadow) {
        g.shadowColor = 'transparent';
        g.shadowBlur = 0;
        g.shadowOffsetY = 0;
    }

    // 1px border
    g.strokeStyle = BORDER;
    g.lineWidth = 1;
    g.stroke();

    // Inner top highlight (1px)
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.beginPath();
    g.moveTo(r, 0);
    g.lineTo(w - r, 0);
    g.stroke();

    g.restore();
}

// Draw any shape in this style: dark lit surface with rim light, or accent glowing fill
export function litShape(g, path2d, { accent = false, color, glowR = 0, sweep = 0, bbox } = {}) {
    if (!bbox) {
        // Compute bbox from path if not given
        bbox = [0, 0, W, H];
    }
    const [bx, by, bw, bh] = bbox;

    if (accent) {
        // Accent glowing fill
        const grd = g.createRadialGradient(bx + bw/2, by + bh/2, 0, bx + bw/2, by + bh/2, Math.max(bw, bh) * 0.6);
        grd.addColorStop(0, ACCENT);
        grd.addColorStop(0.5, ACCENT.replace(/[\d.]+\)$/, '0.4)'));
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fill(path2d);

        // Rim glow
        g.strokeStyle = ACCENT_GLOW;
        g.lineWidth = 2;
        g.stroke(path2d);

        if (glowR) {
            const grd2 = g.createRadialGradient(bx + bw/2, by + bh/2, 0, bx + bw/2, by + bh/2, glowR);
            grd2.addColorStop(0, ACCENT_GLOW);
            grd2.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grd2;
            g.fillRect(bx - glowR, by - glowR, bw + glowR*2, bh + glowR*2);
        }
    } else {
        // Normal dark lit surface
        const baseColor = color || SURFACE_1;
        const grd = g.createLinearGradient(bx, by, bx, by + bh);
        grd.addColorStop(0, mix(baseColor, TEXT_PRIMARY, 0.02));
        grd.addColorStop(1, baseColor);
        g.fillStyle = grd;
        g.fill(path2d);

        // 1px border
        g.strokeStyle = BORDER;
        g.lineWidth = 1;
        g.stroke(path2d);

        // Inner top highlight
        g.strokeStyle = 'rgba(255,255,255,0.07)';
        g.beginPath();
        g.moveTo(bx + 8, by);
        g.lineTo(bx + bw - 8, by);
        g.stroke();
    }

    if (sweep > 0) {
        // Moving light band (light reveal)
        const sweepX = bx + bw * sweep;
        const grd = g.createLinearGradient(sweepX - 200, 0, sweepX + 200, 0);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(0.3, 'rgba(59,76,202,0.08)');
        grd.addColorStop(0.5, 'rgba(255,255,255,0.15)');
        grd.addColorStop(0.7, 'rgba(59,76,202,0.08)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fill(path2d);
    }
}

export function sparklePath(cx, cy, r, k, rot) {
    const p = new Path2D();
    for (let i = 0; i < 4; i++) {
        const angle = rot + (Math.PI * i) / 2;
        const r1 = r * (1 + k);
        const r2 = r * (1 - k);
        const x1 = cx + Math.cos(angle) * r1;
        const y1 = cy + Math.sin(angle) * r1;
        const x2 = cx + Math.cos(angle + Math.PI/4) * r2;
        const y2 = cy + Math.sin(angle + Math.PI/4) * r2;
        if (i === 0) p.moveTo(x1, y1);
        else p.lineTo(x1, y1);
        p.lineTo(x2, y2);
    }
    p.closePath();
    return p;
}

// Fading light trail along points, optionally ending in a cursor
export function trail(g, pts, { color = ACCENT, width = 8, caretH = 0 } = {}) {
    if (pts.length < 2) return;

    for (let i = 1; i < pts.length; i++) {
        const t = i / pts.length;
        const a = 0.05 + 0.35 * t * t;
        const w = width * (0.3 + 0.7 * t);
        g.strokeStyle = color.replace(/[\d.]+\)$/, `${a})`);
        g.lineWidth = w;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(pts[i-1][0], pts[i-1][1]);
        g.lineTo(pts[i][0], pts[i][1]);
        g.stroke();
    }
}

// Cursor with squash/stretch and blink
export function caret(g, x, y, h, { sx = 1, sy = 1, on = true, glow = true, color = ACCENT } = {}) {
    if (!on) return;

    g.save();
    g.translate(x, y);
    g.scale(sx, sy);

    if (glow) {
        g.shadowColor = color;
        g.shadowBlur = 12;
    }

    g.fillStyle = color;
    g.fillRect(-1.5, -h/2, 3, h);

    if (glow) {
        g.shadowColor = 'transparent';
        g.shadowBlur = 0;
    }
    g.restore();
}

export function tidyMark(g, x, y, s) {
    // escinco asterisk
    g.fillStyle = TEXT_PRIMARY;
    g.save();
    g.translate(x, y);
    g.scale(s / 200, s / 200);
    g.beginPath();
    const spikes = 5, outerR = 160, innerR = 64;
    for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI * i) / spikes - Math.PI / 2;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.restore();
}

export function wordmark(g, x, y, px) {
    g.fillStyle = TEXT_PRIMARY;
    g.font = `600 ${px}px Inter, Arial, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('escinco', x, y);
}

// UI Kit - using captured dashboard textures
export const windowBox = (g, x, y, w, h, { r = 14, title = '', rotY = 0 } = {}) => {
    if (dashboardTex) {
        g.save();
        g.translate(x + w/2, y + h/2);
        if (rotY) {
            // Simulate rotY via scaleX (cheap approximation)
            g.scale(Math.cos(rotY), 1);
        }
        g.drawImage(dashboardTex, -w/2, -h/2, w, h);
        g.restore();
    } else {
        panel(g, x, y, w, h, { r });
    }
};

export function windowContent(kind, g, x, y, w, h) {
    // Placeholder for different window content types
    panel(g, x, y, w, h, { r: 8, fill: SURFACE_2, cheap: true });
}

export function notif(g, x, y, w, h, { time = 'now', read = false } = {}) {
    panel(g, x, y, w, h, { r: 8, fill: read ? SURFACE_1 : SURFACE_2 });
    g.fillStyle = read ? TEXT_SECONDARY : TEXT_PRIMARY;
    g.font = '400 14px Inter';
    g.fillText(time, x + 12, y + 20);
    if (!read) {
        g.fillStyle = ACCENT;
        g.beginPath(); g.arc(x + w - 12, y + 12, 4, 0, Math.PI*2); g.fill();
    }
}

export function fileIcon(g, x, y, w, h, { name = 'file.txt' } = {}) {
    panel(g, x, y, w, h, { r: 8, fill: SURFACE_2 });
    g.fillStyle = TEXT_LABEL;
    g.font = '11px "Roboto Mono"';
    g.fillText(name, x + 8, y + h/2 + 4);
    // Folded corner
    g.fillStyle = mix(SURFACE_2, TEXT_PRIMARY, 0.05);
    g.beginPath();
    g.moveTo(x + w - 16, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + 16);
    g.closePath(); g.fill();
}

export function photo(g, x, y, w, h) {
    // Procedural landscape thumbnail
    const grd = g.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, '#1a2a3a');
    grd.addColorStop(0.5, '#2a3a2a');
    grd.addColorStop(1, '#3a2a1a');
    g.fillStyle = grd;
    g.fillRect(x, y, w, h);
    panel(g, x, y, w, h, { r: 8, fill: 'rgba(0,0,0,0)', shadow: false });
}

export function badge(g, x, y, w, h, { text = '999+', color = '#FF5A5F' } = {}) {
    g.fillStyle = color;
    rr(g, x, y, w, h, h/2);
    g.fill();
    g.fillStyle = '#0A0B0F';
    g.font = `700 ${h * 0.6}px Inter`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x + w/2, y + h/2);
}

export function storageBar(g, x, y, w, h, { fill = 0.94, color = '#FF5A5F' } = {}) {
    panel(g, x, y, w, h, { r: h/2, fill: SURFACE_2 });
    const fw = w * fill;
    const grd = g.createLinearGradient(x, y, x + fw, y);
    grd.addColorStop(0, color);
    grd.addColorStop(1, mix(color, '#000', 0.3));
    g.fillStyle = grd;
    rr(g, x, y, fw, h, h/2);
    g.fill();
}

export const appIcon = (g, x, y, s) => {
    tidyMark(g, x + s/2, y + s/2, s * 0.7);
};

// Snap flight with overshoot, spring rotation and morph
export function flyPose(from, to, p) {
    // p: 0..1 progress
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const overshoot = 1 + 0.15 * Math.sin(ease * Math.PI);
    const x = from[0] + (to[0] - from[0]) * ease * overshoot;
    const y = from[1] + (to[1] - from[1]) * ease * overshoot;
    const rot = (to[2] || 0) * ease;
    const scale = 0.95 + 0.05 * ease;
    return [x, y, rot, scale];
}

// Multi-sample motion blur
export function motionBlur(p, span, n, draw) {
    for (let i = 0; i < n; i++) {
        const t = p + (i / (n - 1) - 0.5) * span;
        if (t >= 0 && t <= 1) {
            draw(t, 1 / n);
        }
    }
}

// Light-sweep reveal of any canvas
export function lightReveal(g, src, x, y, w, h, p, { base = 0.07, soft = 0.3, band = 1.0, glint = 0.2, angle = 0 } = {}) {
    g.save();
    g.translate(x + w/2, y + h/2);
    g.rotate(angle);
    g.translate(-w/2, -h/2);

    // Draw base (unlit)
    g.globalAlpha = base;
    g.drawImage(src, 0, 0, w, h);

    // Lit area: sweep from left to right
    const litW = w * p;
    if (litW > 0) {
        g.globalAlpha = 1;
        g.drawImage(src, 0, 0, litW, h, 0, 0, litW, h);

        // Soft front
        const grd = g.createLinearGradient(litW - soft * w, 0, litW, 0);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(1, 'rgba(0,0,0,0.3)');
        g.fillStyle = grd;
        g.fillRect(litW - soft * w, 0, soft * w, h);

        // Glint at front
        if (glint > 0) {
            const grd2 = g.createLinearGradient(litW - 50, 0, litW + 50, 0);
            grd2.addColorStop(0, 'rgba(255,255,255,0)');
            grd2.addColorStop(0.5, `rgba(255,255,255,${glint})`);
            grd2.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = grd2;
            g.fillRect(litW - 50, 0, 100, h);
        }
    }

    g.restore();
}

// Strip-rendered Y-rotation of a flat canvas
export function perspective(g, src, cx, cy, w, h, rotY, { slices = 32 } = {}) {
    const map = (u, v) => {
        // u, v in 0..1
        const x = -w/2 + u * w;
        const z = x * Math.sin(rotY);
        const scale = 1 / (1 - z / 500); // simple perspective
        const sx = cx + x * scale * Math.cos(rotY);
        const sy = cy + (-h/2 + v * h) * scale;
        return [sx, sy, scale];
    };
    return map;
}

// Glyph-noise-to-number roll with per-character lock times
export function scramble(g, text, x, y, t, locks, { px = 120, fam = '"Roboto Mono"', color = TEXT_PRIMARY, tracking = -0.045 } = {}) {
    g.font = `700 ${px}px ${fam}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.letterSpacing = `${tracking * px}px`;

    const chars = text.split('');
    const totalW = chars.reduce((sum, ch) => sum + g.measureText(ch).width, 0) + (chars.length - 1) * tracking * px;
    let cx = x - totalW / 2;

    chars.forEach((ch, i) => {
        const lockTime = locks[i] || 0;
        if (t >= lockTime) {
            // Locked
            g.fillStyle = color;
            g.fillText(ch, cx, y);
        } else {
            // Scrambling
            const scrambleChars = '0123456789.,/$€£¥%';
            const scrambleCh = scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
            g.fillStyle = mix(color, TEXT_LABEL, 0.5);
            g.fillText(scrambleCh, cx, y);
            // Vertical smear (3 copies)
            g.globalAlpha = 0.3;
            g.fillText(scrambleCh, cx, y - px * 0.15);
            g.fillText(scrambleCh, cx, y + px * 0.15);
            g.globalAlpha = 1;
        }
        cx += g.measureText(ch).width + tracking * px;
    });
}

// Caption toast component
export function toast(g, text, a, { dense = false } = {}) {
    const pillH = 64;
    const padding = 40;
    const dotR = 4;
    const tw = g.measureText(text).width;
    const pw = Math.min(W * 0.85, tw + padding * 2 + 24);
    const px = (W - pw) / 2;
    const py = H - a - pillH / 2;

    g.globalAlpha = a / 255; // a is 0-255 alpha

    // Pill background
    g.fillStyle = dense ? 'rgba(12,14,19,0.88)' : 'rgba(12,14,19,0.72)';
    rr(g, px, py, pw, pillH, 32);
    g.fill();

    // Border
    g.strokeStyle = 'rgba(255,255,255,0.09)';
    g.lineWidth = 1;
    g.stroke();

    // Accent dot
    g.fillStyle = ACCENT;
    g.beginPath(); g.arc(px + 20, py + pillH/2, dotR, 0, Math.PI*2); g.fill();

    // Text
    g.fillStyle = TEXT_PRIMARY;
    g.font = '500 40px Inter, Arial, sans-serif';
    g.textBaseline = 'middle';
    g.fillText(text, px + 40, py + pillH/2);

    g.globalAlpha = 1;
}

// 2.5D Camera
export function camera({ x = 0, y = 0, zoom = 1, rot = 0, sx = 0, sy = 0 } = {}) {
    return {
        x, y, zoom, rot, sx, sy,
        apply(g, z = 0) {
            g.save();
            g.translate(W/2 + sx, H/2 + sy);
            g.scale(zoom, zoom);
            g.rotate(rot);
            g.translate(-W/2 - x, -H/2 - y);
            if (z !== 0) {
                const s = 1 / (1 - z / 500);
                g.scale(s, s);
            }
        },
        proj(x, y, z = 0) {
            const s = 1 / (1 - z / 500);
            const px = (x - W/2 - this.x) * this.zoom * s + W/2 + this.sx;
            const py = (y - H/2 - this.y) * this.zoom * s + H/2 + this.sy;
            return { x: px, y: py, scale: this.zoom * s };
        }
    };
}

// Helpers re-exported from lib.js
export { buf, rr, font, rgba, mix } from './lib.js';

// Draw captured dashboard texture
export function drawDashboard(g, x, y, w, h, { scale = 1, rotY = 0, alpha = 1 } = {}) {
    if (!dashboardTex) return;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x + w/2, y + h/2);
    if (rotY) g.scale(Math.cos(rotY), 1);
    g.scale(scale, scale);
    g.drawImage(dashboardTex, -dashboardTex.width/2, -dashboardTex.height/2);
    g.restore();
}

export function drawPatrimonioCard(g, x, y, w, h, { scale = 1, alpha = 1 } = {}) {
    if (!patrimonioTex) return;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.scale(scale, scale);
    g.drawImage(patrimonioTex, 0, 0);
    g.restore();
}

export function drawGraficoCard(g, x, y, w, h, { scale = 1, alpha = 1 } = {}) {
    if (!graficoTex) return;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.scale(scale, scale);
    g.drawImage(graficoTex, 0, 0);
    g.restore();
}

export function drawLogo(g, x, y, size) {
    if (!logoTex) return;
    g.save();
    g.translate(x, y);
    const s = size / 400;
    g.scale(s, s);
    g.drawImage(logoTex, -200, -200);
    g.restore();
}