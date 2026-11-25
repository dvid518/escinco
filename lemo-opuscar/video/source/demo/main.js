// escinco Pitch — main.js
// Entry point for rendering. Called by video.mjs / still.mjs

import { loadAssets, setAccent, setSize, drawDashboard, drawPatrimonioCard, drawGraficoCard, drawLogo } from './engine.js';
import { render } from './film.js';

let canvas = null;
let ctx = null;
let assetsLoaded = false;

export async function init({ width = 1920, height = 1080 } = {}) {
    canvas = document.getElementById('canvas') || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.id = 'canvas';
    if (!document.getElementById('canvas')) document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');

    setSize(width, height);
    setAccent('#00a269'); // escinco tropicalMint

    // Load assets - demo directory mounted at /@film/
    await loadAssets('/@film');
    assetsLoaded = true;

    // Duration for video.mjs
    window.DUR = 36;
}

// Main render function called per frame
export function renderFrame(t) {
    if (!assetsLoaded || !ctx) return;
    render(ctx, t);
}

// For still.mjs: render a single frame at time t
export async function renderStill(t, outputPath) {
    if (!assetsLoaded) await init();
    renderFrame(t);
    // video.mjs handles saving via canvas.toBuffer()
}

// Expose for video.mjs
window.render = renderFrame;
window.READY = true;