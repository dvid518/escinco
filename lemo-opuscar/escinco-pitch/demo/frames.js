// escinco Pitch — frames.js
// Engine demo scene and main render loop

import { bg, grid, vignette, panel, litShape, trail, caret, tidyMark, wordmark, sparklePath, camera, drawDashboard, drawPatrimonioCard, drawGraficoCard, drawLogo, setAccent } from './engine.js';
import { EASE, lerp } from './lib.js';

const W = 1920;
const H = 1080;

let demoCam = null;
let demoStart = 0;

export function engineDemo(g, t) {
    if (!demoCam) {
        demoCam = camera({ zoom: 1 });
        demoStart = t;
    }
    const dt = t - demoStart;

    bg(g);
    grid(g);
    vignette(g);

    // Demo: rotating dashboard with light sweep
    demoCam.zoom = 0.9;
    demoCam.rot = dt * 0.02;
    demoCam.apply(g, 0);

    // Dashboard
    drawDashboard(g, W/2, H/2, 1584, 512, { scale: 0.9 });

    // Light sweep
    const sweep = (Math.sin(dt * 0.5) + 1) / 2;
    // lightReveal would need the offscreen canvas - simplified here

    // Asterisk
    drawLogo(g, W/2, 100, 120);

    // Accent sparkle
    const pts = [];
    for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        pts.push([360 + u * 1100, 640 - Math.sin(u * Math.PI) * 260]);
    }
    trail(g, pts, { width: 8 });
    litShape(g, sparklePath(1480, 380, 90, 0.2), { accent: true, glowR: 40, bbox: [1390, 290, 180, 180] });
    caret(g, 1560, 380, 120);

    g.restore();

    // UI panel
    const card = new Path2D();
    card.roundRect(300, 200, 420, 160, 28);
    litShape(g, card, { sweep: 0.5, bbox: [300, 200, 420, 160] });
}

// For video.mjs: render function that returns frame
export async function render(t) {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    engineDemo(ctx, t);
}

// Scene getter for video.mjs ?scene=engineDemo
window.engineDemo = engineDemo;
window.READY = true;