// escinco Pitch — film.js
// Scene orchestration: mess / inserts / collapse / reveal / counter / chart / indicators / breath / close
// Reads from timeline.js, uses engine.js, world.js

import { TEMPO, BEAT, BAR, SIXTEENTH, FPS, KEY_TIMES, SILENCES, CUES, NOTE_TABLES } from './timeline.js';
import { bg, grid, vignette, panel, litShape, trail, caret, tidyMark, wordmark, toast, camera, drawDashboard, drawPatrimonioCard, drawGraficoCard, drawLogo, setAccent, lightReveal, getDashboardTex, getPatrimonioTex, getGraficoTex, getLogoTex, scramble, TEXT_PRIMARY, ACCENT, TEXT_SECONDARY, TEXT_LABEL, BORDER, SURFACE_2, badge, rr, storageBar } from './engine.js';
import { generateMess, getFreezeState, getCollapseState, getInsertState, INSERTS, MESS_TYPES, GRID_ROWS } from './world.js';
import { EASE, lerp, lerpAngle } from './lib.js';

const W = 1920;
const H = 1080;

let mess = null;
let cam = null;
let dashboardCam = null;

// Captions (voice-over lines with timestamps)
export const CAPTIONS = [
    { start: 18.5, end: 21.0, text: 'escinco reúne tus cuentas, inversiones y deudas en un solo lugar' },
    { start: 21.5, end: 23.5, text: 'Tu patrimonio total: trece mil cuatrocientos soles' },
    { start: 23.5, end: 25.0, text: 'En los últimos catorce días, la tendencia es ascendente' },
    { start: 26.5, end: 27.5, text: 'Cuentas en soles, dólares, euros' },
    { start: 27.5, end: 28.5, text: 'Ingresos y egresos separados' },
    { start: 28.5, end: 29.5, text: 'Distribución: liquidez, inversiones, inmovilizado, deudas' },
    { start: 29.5, end: 30.5, text: 'Bitcoin y VOO con valor actual' },
    { start: 30.5, end: 31.5, text: 'Metas de ahorro con progreso real' },
    { start: 34.0, end: 35.5, text: '¿Cuánto dinero te pertenece realmente?' },
];

// Events for cue checking
export const EVENTS = [
    // Mess spawns
    ...MESS_TYPES.flatMap(type => 
        Array.from({ length: type.count }, (_, i) => ({
            time: KEY_TIMES.accBar1 + typeIdxOffset(type) * 2 + i * 0.1,
            type: 'spawn',
            element: type.id,
            index: i
        }))
    ),
    // Inserts
    ...INSERTS.map(ins => ({ time: ins.time, type: 'insert', element: ins.id })),
    // Key moments
    { time: KEY_TIMES.freezeStart, type: 'silence', label: 'freeze-start' },
    { time: KEY_TIMES.press, type: 'press', label: 'press-chord' },
    { time: KEY_TIMES.revealStart, type: 'reveal', label: 'light-sweep-start' },
    { time: KEY_TIMES.counterScrambleStart, type: 'counter', label: 'digit-lock-start' },
    { time: KEY_TIMES.chartAxisGrow, type: 'chart', label: 'axis-grow' },
    { time: KEY_TIMES.chartPointsStart, type: 'chart', label: 'chart-point-1' },
    { time: KEY_TIMES.indCuentas, type: 'indicator', label: 'ind-cuentas' },
    { time: KEY_TIMES.indIngresos, type: 'indicator', label: 'ind-ingresos' },
    { time: KEY_TIMES.indDistribucion, type: 'indicator', label: 'ind-distribucion' },
    { time: KEY_TIMES.indInversiones, type: 'indicator', label: 'ind-inversiones' },
    { time: KEY_TIMES.indMetas, type: 'indicator', label: 'ind-metas' },
    { time: KEY_TIMES.breathCRTOff, type: 'crt-off', label: 'crt-off' },
    { time: KEY_TIMES.closeQuestion, type: 'voice', label: 'final-question' },
];

function typeIdxOffset(type) {
    const idx = MESS_TYPES.findIndex(t => t.id === type);
    return idx >= 0 ? idx : 0;
}

// Main render function called from main.js
export function render(g, t) {
    if (!mess) {
        mess = generateMess(NOTE_TABLES);
        cam = camera({ zoom: 1 });
        dashboardCam = camera({ zoom: 1 });
    }

    // Clear
    bg(g);
    grid(g);
    vignette(g);

    // ---- SCENE: MESS ACCUMULATION (1–17s) ----
    if (t < KEY_TIMES.freezeStart) {
        renderMess(g, t);
        return;
    }

    // ---- SCENE: FREEZE + SILENCE (17–17.5s) ----
    if (t < KEY_TIMES.press) {
        renderFreeze(g, t);
        return;
    }

    // ---- SCENE: PRESS + COLLAPSE (17.5–18s) ----
    if (t < KEY_TIMES.revealStart) {
        renderCollapse(g, t);
        return;
    }

    // ---- SCENE: LIGHT REVEAL (18–20s) ----
    if (t < KEY_TIMES.counterDive) {
        renderReveal(g, t);
        return;
    }

    // ---- SCENE: PATRIMONIO COUNTER (20–22.5s) ----
    if (t < KEY_TIMES.chartPullback) {
        renderCounter(g, t);
        return;
    }

    // ---- SCENE: CHART DRAW (22.5–26.5s) ----
    if (t < KEY_TIMES.indCuentas) {
        renderChart(g, t);
        return;
    }

    // ---- SCENE: SECONDARY INDICATORS (26.5–31s) ----
    if (t < KEY_TIMES.breathEnd) {
        renderIndicators(g, t);
        return;
    }

    // ---- SCENE: BREATH / PUT-AWAY (31–36s) ----
    renderBreath(g, t);
}

function renderMess(g, t) {
    // Camera: continuous pull-back from ×4 to ×1 over 16s (8 bars)
    // Keyed per bar in log space with monotone interpolation
    const pullbackStart = KEY_TIMES.hookEnd;
    const pullbackEnd = KEY_TIMES.freezeStart;
    const progress = Math.min(1, Math.max(0, (t - pullbackStart) / (pullbackEnd - pullbackStart)));
    // Log-space interpolation: zoom = 4 * (1/4)^progress = 4^(1-progress)
    const zoom = Math.pow(4, 1 - progress);

    // Dutch angle + wobble building from bar 5 (t ~ 9s)
    let dutch = 0;
    let wobble = 0;
    if (t > 9) {
        const wobbleProgress = Math.min(1, (t - 9) / 8);
        dutch = wobbleProgress * Math.PI / 90; // 2° max
        wobble = wobbleProgress * 0.008; // subtle
    }

    cam.zoom = zoom;
    cam.rot = dutch + wobble * Math.sin(t * 12);
    cam.sx = wobble * 50 * Math.sin(t * 7);
    cam.sy = wobble * 30 * Math.cos(t * 11);

    cam.apply(g, 0);

    // Draw mess elements
    mess.elements.forEach(el => {
        el.update(t, 0, 0);
        if (el.alpha > 0) {
            drawMessElement(g, el);
        }
    });

    // Draw inserts (overload)
    if (t >= INSERTS[0].time) {
        getInsertState(t).forEach(ins => {
            if (ins.progress > 0) {
                drawInsert(g, ins);
            }
        });
    }

    g.restore();

    // Captions (dense during mess)
    const caption = CAPTIONS.find(c => t >= c.start && t <= c.end);
    if (caption) {
        toast(g, caption.text, 225, { dense: true });
    }
}

function drawMessElement(g, el) {
    const typeDef = MESS_TYPES.find(t => t.id === el.type);
    if (!typeDef) return;

    g.save();
    g.translate(el.x, el.y);
    g.rotate(el.rot);
    g.scale(el.scale, el.scale);
    g.globalAlpha = el.alpha;

    // Draw based on type
    switch (el.type) {
        case 'account':
            drawAccountCard(g, el.index);
            break;
        case 'currency':
            drawCurrencySymbol(g, el.index);
            break;
        case 'transaction':
            drawTransactionRow(g, el.index);
            break;
        case 'investment':
            drawInvestmentTicker(g, el.index);
            break;
    }

    g.restore();
}

function drawAccountCard(g, index) {
    // Small card
    const w = 120, h = 80, r = 8;
    panel(g, -w/2, -h/2, w, h, { r, fill: '#1A1E28', cheap: true });
    g.fillStyle = '#E8EAF0';
    g.font = '500 11px Inter';
    g.textAlign = 'center';
    const names = ['Efectivo', 'BCP VISA', 'Interbank', 'Binance', 'Otro'];
    g.fillText(names[index % names.length], 0, -10);
    g.fillStyle = '#96FFA1';
    g.font = '700 16px "Roboto Mono"';
    g.fillText(`S/ ${(Math.random()*5000).toFixed(0)}`, 0, 15);
}

function drawCurrencySymbol(g, index) {
    const symbols = ['PEN', 'USD', 'EUR', 'USDT'];
    const sym = symbols[index % symbols.length];
    g.fillStyle = '#FECA6F';
    g.font = '700 28px Inter';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(sym, 0, 0);
}

function drawTransactionRow(g, index) {
    const w = 200, h = 24;
    const isIncome = index % 2 === 0;
    g.fillStyle = isIncome ? '#96FFA1' : '#FE8F8F';
    g.fillRect(-w/2, -h/2, w, h);
    g.fillStyle = '#0A0B0F';
    g.font = '400 11px Inter';
    g.textAlign = 'left';
    g.fillText(isIncome ? '+ Ingreso' : '- Gasto', -w/2 + 8, 4);
}

function drawInvestmentTicker(g, index) {
    const tickers = ['BTC', 'VOO', 'ETH', 'AAPL'];
    const ticker = tickers[index % tickers.length];
    g.fillStyle = '#DFA3FF';
    g.font = '600 14px "Roboto Mono"';
    g.textAlign = 'center';
    g.fillText(ticker, 0, 0);
}

function drawInsert(g, ins) {
    g.save();
    g.translate(W * ins.x, H * ins.y);
    g.scale(ins.scale, ins.scale);
    g.globalAlpha = ins.alpha;
    g.rotate((1 - ins.progress) * 0.1); // slight rotation on expand

    switch (ins.type) {
        case 'badge':
            badge(g, -80, -20, 160, 40, { text: ins.label, color: '#FF5A5F' });
            break;
        case 'tabs':
            // Tab strip
            for (let i = 0; i < 12; i++) {
                const tx = -300 + i * 50;
                g.fillStyle = '#1A1E28';
                rr(g, tx, -10, 44, 20, 4);
                g.fill();
                g.strokeStyle = BORDER;
                g.stroke();
            }
            break;
        case 'storage':
            storageBar(g, -200, -10, 400, 20, { fill: 0.94, color: '#FF5A5F' });
            break;
    }
    g.restore();
}

function renderFreeze(g, t) {
    // Push-in through frozen mess onto asterisk
    const progress = (t - KEY_TIMES.freezeStart) / (KEY_TIMES.press - KEY_TIMES.freezeStart);
    const zoom = lerp(0.8, 2.5, EASE.easeInOut(progress));

    cam.zoom = zoom;
    cam.rot = 0;
    cam.sx = cam.sy = 0;
    cam.apply(g, 0);

    // Draw frozen mess at low alpha
    mess.elements.forEach(el => {
        el.update(KEY_TIMES.freezeStart, KEY_TIMES.freezeStart, 0);
        if (el.alpha > 0) {
            g.globalAlpha = 0.15;
            drawMessElement(g, el);
            g.globalAlpha = 1;
        }
    });

    // Asterisk large in center
    g.save();
    g.translate(W/2, H/2);
    tidyMark(g, 0, 0, 240);
    g.restore();

    g.restore();
}

function renderCollapse(g, t) {
    // Whip pull-out in one beat: ×2.5 → ×0.78
    const progress = (t - KEY_TIMES.press) / (KEY_TIMES.revealStart - KEY_TIMES.press);
    const zoom = lerp(2.5, 0.78, EASE.easeOut(progress));

    cam.zoom = zoom;
    cam.apply(g, 0);

    // Draw collapsing elements
    const collapseState = getCollapseState(mess.elements, t, KEY_TIMES.press);
    collapseState.forEach(state => {
        g.save();
        g.translate(state.x, state.y);
        g.rotate(state.rot);
        g.scale(state.scale, state.scale);
        g.globalAlpha = state.alpha;
        drawMessElement(g, { type: state.type, index: state.index });
        g.restore();
    });

    // Grid slot outlines in accent
    if (progress > 0.3) {
        drawGridOutlines(g, progress);
    }

    // Asterisk press (2-frame squash at start)
    if (progress < 0.1) {
        g.save();
        g.translate(W/2, H/2);
        g.scale(2.4, 0.3); // squash
        tidyMark(g, 0, 0, 120);
        g.restore();
    }

    g.restore();
}

function drawGridOutlines(g, progress) {
    g.strokeStyle = `rgba(0, 162, 105, ${progress * 0.6})`;
    g.lineWidth = 2;
    g.setLineDash([8, 4]);

    Object.values(GRID_ROWS).forEach(row => {
        for (let col = 0; col < row.slots; col++) {
            const x = W * 0.12 + col * (W * 0.19);
            const y = H * row.y;
            g.strokeRect(x, y - 40, W * 0.16, 80);
        }
    });
    g.setLineDash([]);
}

function renderReveal(g, t) {
    // Window rotates in from -24° to 0° over 2s
    // Light sweep across (1.3s)
    const progress = (t - KEY_TIMES.revealStart) / (KEY_TIMES.counterDive - KEY_TIMES.revealStart);
    const rotY = lerp(-24 * Math.PI/180, 0, EASE.easeOut(progress));
    const sweep = Math.min(1, progress / 0.65); // sweep completes at 65% of reveal

    cam.zoom = 0.95;
    cam.apply(g, 0);

    // Draw dashboard with light reveal
    g.save();
    g.translate(W/2, H/2);
    const dTex = getDashboardTex();
    lightReveal(g, dTex, -dTex.width/2 * 0.95, -dTex.height/2 * 0.95, 
                dTex.width * 0.95, dTex.height * 0.95, sweep, { rotY });
    g.restore();

    g.restore();

    // Caption
    const caption = CAPTIONS.find(c => t >= c.start && t <= c.end);
    if (caption) toast(g, caption.text, 225);
}

function renderCounter(g, t) {
    // Log-zoom dive to patrimonio card, then match cut to full-screen number
    const counterProgress = (t - KEY_TIMES.counterDive) / (KEY_TIMES.chartPullback - KEY_TIMES.counterDive);
    const scrambleProgress = Math.max(0, (t - KEY_TIMES.counterScrambleStart) / (KEY_TIMES.counterScrambleEnd - KEY_TIMES.counterScrambleStart));

    if (counterProgress < 0.3) {
        // Dive phase: zoom into patrimonio card
        const zoom = lerp(0.95, 12, EASE.easeIn(counterProgress / 0.3));
        dashboardCam.zoom = zoom;
        dashboardCam.apply(g, 0);
        drawPatrimonioCard(g, W/2, H/2, 304, 160, { scale: 3.5 });
    } else {
        // Match cut: full-screen giant number scrambling
        cam.zoom = 1;
        cam.apply(g, 0);

        // Scramble digits
        const locks = Array.from({ length: 11 }, (_, i) => KEY_TIMES.counterScrambleStart + i * SIXTEENTH);
        scramble(g, 'S/ 13,400.00', W/2, H/2, t, locks, { px: 120, color: TEXT_PRIMARY });

        // Accent underline
        g.fillStyle = ACCENT;
        g.fillRect(W/2 - 200, H/2 + 70, 400, 4);
    }

    g.restore();

    // Caption
    const caption = CAPTIONS.find(c => t >= c.start && t <= c.end);
    if (caption) toast(g, caption.text, 225);
}

function renderChart(g, t) {
    // Pull back to dashboard, chart draws progressively
    const progress = (t - KEY_TIMES.chartPullback) / (KEY_TIMES.indCuentas - KEY_TIMES.chartPullback);

    cam.zoom = 0.9;
    cam.apply(g, 0);

    drawDashboard(g, W/2, H/2, 1584, 512, { scale: 0.9 });

    // Chart progressive draw overlay
    if (t > KEY_TIMES.chartAxisGrow) {
        const axisProgress = Math.min(1, (t - KEY_TIMES.chartAxisGrow) / 1.0);
        drawChartAxis(g, axisProgress);
    }
    if (t > KEY_TIMES.chartPointsStart) {
        const pointsProgress = Math.min(1, (t - KEY_TIMES.chartPointsStart) / 3.5);
        drawChartPoints(g, pointsProgress);
    }

    g.restore();

    const caption = CAPTIONS.find(c => t >= c.start && t <= c.end);
    if (caption) toast(g, caption.text, 225);
}

function drawChartAxis(g, progress) {
    // Draw Y-axis growing from bottom
    const chartX = W * 0.22;
    const chartY = H * 0.38;
    const chartW = 624 * 0.9;
    const chartH = 336 * 0.9;

    g.strokeStyle = BORDER;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(chartX, chartY + chartH);
    g.lineTo(chartX, chartY + chartH * (1 - progress));
    g.stroke();
}

function drawChartPoints(g, progress) {
    // 14 data points from real fixture
    const points = 14;
    const drawn = Math.floor(points * progress);
    const chartX = W * 0.22;
    const chartY = H * 0.38;
    const chartW = 624 * 0.9;
    const chartH = 336 * 0.9;

    // Real snapshot values (normalized)
    const values = [11368, 11420, 11480, 11550, 11620, 11680, 11750, 11820, 11900, 11980, 12050, 12120, 12200, 12350];
    const minV = Math.min(...values);
    const maxV = Math.max(...values);

    g.strokeStyle = ACCENT;
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    g.beginPath();
    for (let i = 0; i <= drawn; i++) {
        const x = chartX + (i / (points - 1)) * chartW;
        const y = chartY + chartH - ((values[i] - minV) / (maxV - minV)) * chartH;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
    }
    g.stroke();

    // Points pop in
    for (let i = 0; i <= drawn; i++) {
        const x = chartX + (i / (points - 1)) * chartW;
        const y = chartY + chartH - ((values[i] - minV) / (maxV - minV)) * chartH;
        g.fillStyle = ACCENT;
        g.beginPath(); g.arc(x, y, 4, 0, Math.PI*2); g.fill();

        // Ripple
        const rippleProgress = progress - i * 0.05;
        if (rippleProgress > 0 && rippleProgress < 1) {
            g.strokeStyle = `rgba(0, 162, 105, ${1 - rippleProgress})`;
            g.lineWidth = 1 + rippleProgress * 8;
            g.beginPath(); g.arc(x, y, rippleProgress * 20, 0, Math.PI*2); g.stroke();
        }
    }
}

function renderIndicators(g, t) {
    cam.zoom = 0.9;
    cam.apply(g, 0);
    drawDashboard(g, W/2, H/2, 1584, 512, { scale: 0.9 });

    // Sequential indicator highlights
    const indicators = [
        { time: KEY_TIMES.indCuentas, label: 'Cuentas / Divisas', cards: ['patrimonio', 'cuentas'] },
        { time: KEY_TIMES.indIngresos, label: 'Ingresos / Egresos', cards: ['movimientos'] },
        { time: KEY_TIMES.indDistribucion, label: 'Distribución', cards: ['distribucion'] },
        { time: KEY_TIMES.indInversiones, label: 'Inversiones', cards: ['inversiones'] },
        { time: KEY_TIMES.indMetas, label: 'Metas', cards: ['metas'] },
    ];

    indicators.forEach((ind, i) => {
        if (t >= ind.time) {
            const p = Math.min(1, (t - ind.time) / 0.5);
            const eased = EASE.backOut(p);
            // Highlight cards with accent glow
            ind.cards.forEach(cardId => {
                highlightCard(g, cardId, eased);
            });
        }
    });

    g.restore();

    const caption = CAPTIONS.find(c => t >= c.start && t <= c.end);
    if (caption) toast(g, caption.text, 225);
}

function highlightCard(g, cardId, intensity) {
    // Find card position in dashboard (approximate)
    const positions = {
        patrimonio: { x: W*0.12, y: H*0.18, w: 304, h: 160 },
        cuentas: { x: W*0.31, y: H*0.18, w: 304, h: 160 },
        movimientos: { x: W*0.50, y: H*0.18, w: 304, h: 336 },
        distribucion: { x: W*0.69, y: H*0.18, w: 304, h: 336 },
        inversiones: { x: W*0.12, y: H*0.50, w: 304, h: 160 },
        metas: { x: W*0.31, y: H*0.50, w: 304, h: 160 },
    };
    const pos = positions[cardId];
    if (!pos) return;

    g.save();
    g.strokeStyle = `rgba(0, 162, 105, ${intensity * 0.8})`;
    g.lineWidth = 3 * intensity;
    g.strokeRect(pos.x - 4, pos.y - 4, pos.w + 8, pos.h + 8);
    g.restore();
}

function renderBreath(g, t) {
    // Slow push while UI puts itself away
    const progress = Math.min(1, (t - KEY_TIMES.breathStart) / (KEY_TIMES.filmEnd - KEY_TIMES.breathStart));
    const zoom = lerp(0.9, 1.08, progress);

    cam.zoom = zoom;
    cam.apply(g, 0);

    // UI retracting: sidebar, status bar, headers, then CRT-off collapse into asterisk
    const crtProgress = Math.max(0, (t - KEY_TIMES.breathCRTOff) / (KEY_TIMES.closeAsterisk - KEY_TIMES.breathCRTOff));

    if (crtProgress < 1) {
        // CRT-off vertical squash
        const squashY = lerp(1, 0.05, EASE.easeIn(crtProgress));
        g.save();
        g.translate(W/2, H/2);
        g.scale(0.3, squashY * 0.3);
        const dTex = getDashboardTex();
        g.translate(-dTex.width/2, -dTex.height/2);
        g.globalAlpha = lerp(1, 0, crtProgress);
        g.drawImage(dTex, 0, 0);
        g.restore();
    } else {
        // Empty grid, asterisk with accent rim
        g.save();
        g.translate(W/2, H/2);
        g.strokeStyle = ACCENT;
        g.lineWidth = 4;
        g.beginPath();
        const spikes = 5, outerR = 100, innerR = 40;
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (Math.PI * i) / spikes - Math.PI / 2;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.closePath(); g.stroke();

        // Brand text
        g.fillStyle = TEXT_PRIMARY;
        g.font = '600 56px Inter';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('escinco', 0, 180);
        g.font = '400 28px Inter';
        g.fillStyle = TEXT_SECONDARY;
        g.fillText('escinco.com', 0, 240);
        g.restore();

        // Final question (voice only, no caption in style, but show for storyboard)
        if (t >= KEY_TIMES.closeQuestion) {
            toast(g, '¿Cuánto dinero te pertenece realmente?', 225);
        }

        // Asterisk blinks out
        if (t > KEY_TIMES.closeBlinkOut) {
            // Fade out
        }
    }

    g.restore();
}