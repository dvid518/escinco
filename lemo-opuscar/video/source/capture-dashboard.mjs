import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { createReadStream } from 'fs';
import { extname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEMO_DIR = __dirname;
const PORT = 34567;

function startServer() {
    return new Promise((resolve) => {
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.mjs': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.webmanifest': 'application/manifest+json'
        };

        const server = http.createServer((req, res) => {
            let urlPath = req.url.split('?')[0];
            if (urlPath === '/demo/' || urlPath === '/demo') {
                urlPath = '/demo.html';
            } else if (urlPath.startsWith('/demo/')) {
                urlPath = urlPath.replace('/demo/', '/');
            }
            let filePath = path.join(DEMO_DIR, urlPath);
            const ext = extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) { res.writeHead(404); res.end('Not found'); return; }
                res.writeHead(200, { 'Content-Type': contentType });
                createReadStream(filePath).pipe(res);
            });
        });
        server.listen(PORT, () => { console.log(`[server] Running at http://localhost:${PORT}`); resolve(server); });
    });
}

async function captureDashboard() {
    const server = await startServer();
    console.log('[capture] Launching browser...');
    const browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--force-color-profile=srgb'] });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('console', msg => { const t = msg.text(); if (msg.type() === 'error' || t.includes('[INFO]') || t.includes('[DEMO]') || t.includes('dashboard')) console.log(`[page] ${msg.type()}: ${t}`); });
    page.on('pageerror', err => console.error('[pageerror]', err.message));
    console.log('[capture] Loading demo at /demo/...');
    await page.goto(`http://localhost:${PORT}/demo/`, { waitUntil: 'networkidle' });
    console.log('[capture] Waiting for dashboard initialization...');
    await page.waitForFunction(() => { const d = document.querySelector('.dashboard'); return d && d.classList.contains('dashboard-estilos-listos'); }, { timeout: 30000 });
    console.log('[capture] Styles applied');
    await page.waitForFunction(() => { const d = document.querySelector('.dashboard'); return d && !d.classList.contains('dashboard-cargando'); }, { timeout: 60000 });
    console.log('[capture] Data loaded');
    await page.waitForFunction(() => { const c = document.querySelector('#grafico-patrimonio'); if (!c) return false; const ctx = c.getContext('2d'); if (!ctx) return false; const id = ctx.getImageData(0, 0, c.width, c.height); for (let i = 3; i < id.data.length; i += 4) if (id.data[i] > 0) return true; return false; }, { timeout: 30000 });
    console.log('[capture] Chart rendered');
    await page.waitForTimeout(1000);
    console.log('[capture] Taking screenshot...');
    await page.screenshot({ path: path.join(__dirname, 'dashboard-capture.png'), fullPage: true });
    const dashboard = await page.$('.dashboard');
    if (dashboard) { await dashboard.screenshot({ path: path.join(__dirname, 'dashboard-only.png') }); console.log('[capture] Dashboard-only screenshot saved'); }
    const patrimonioCard = await page.$('[data-dashboard-card="patrimonio"]');
    if (patrimonioCard) { await patrimonioCard.screenshot({ path: path.join(__dirname, 'patrimonio-card.png') }); console.log('[capture] Patrimonio card screenshot saved'); }
    const graficoCard = await page.$('[data-dashboard-card="grafico"]');
    if (graficoCard) { await graficoCard.screenshot({ path: path.join(__dirname, 'grafico-card.png') }); console.log('[capture] Grafico card screenshot saved'); }
    const styles = await page.evaluate(() => { const gs = (s) => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el); return { backgroundColor: cs.backgroundColor, color: cs.color, fontFamily: cs.fontFamily, fontSize: cs.fontSize, borderRadius: cs.borderRadius, borderColor: cs.borderColor, borderWidth: cs.borderWidth, boxShadow: cs.boxShadow, padding: cs.padding, gap: cs.gap, width: cs.width, height: cs.height }; }; return { body: gs('body'), dashboard: gs('.dashboard'), patrimonioCard: gs('[data-dashboard-card="patrimonio"]'), graficoCard: gs('[data-dashboard-card="grafico"]'), cardValue: gs('#patrimonio-valor'), cardTitle: gs('.patrimonio-card .card-title'), navBar: gs('.nav-section') }; });
    fs.writeFileSync(path.join(__dirname, 'dashboard-styles.json'), JSON.stringify(styles, null, 2));
    console.log('[capture] Computed styles saved');
    const dashboardHTML = await page.evaluate(() => { const d = document.querySelector('.dashboard'); return d ? d.outerHTML : null; });
    fs.writeFileSync(path.join(__dirname, 'dashboard-html.html'), dashboardHTML || '');
    console.log('[capture] Dashboard HTML saved');
    await browser.close(); server.close(); console.log('[capture] Done!');
}
captureDashboard().catch(err => { console.error('[capture] Error:', err); process.exit(1); });