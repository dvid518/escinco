import { NeatGradient } from "/node_modules/@firecms/neat/dist/index.es.js";

const html = document.documentElement;
const selectFondo = document.getElementById('selectFondo');
const canvas = document.getElementById("gradient");
let instancia = null;

function colorComputado(variable) {
    return getComputedStyle(html).getPropertyValue(variable).trim() || "#141414";
}

function ajustarTamanoCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function construirConfig() {
    const bg = colorComputado("--background");
    const bd = colorComputado("--border");
    return {
        colors: [
            { color: bg, enabled: true },
            { color: bg, enabled: true },
            { color: bd, enabled: true },
            { color: bg, enabled: true },
            { color: bg, enabled: true },
            { color: "#A8E6CF", enabled: false },
        ],
        speed: 4,
        horizontalPressure: 4,
        verticalPressure: 3,
        waveFrequencyX: 0,
        waveFrequencyY: 0,
        waveAmplitude: 0,
        secondaryWaveEnabled: false,
        secondaryWaveFrequencyX: 3,
        secondaryWaveFrequencyY: 3,
        secondaryWaveAmplitude: 5,
        secondaryWaveSpeed: 0.6,
        secondaryWaveAngle: 1,
        shadows: 2,
        highlights: 7,
        colorBrightness: 1,
        colorSaturation: 8,
        wireframe: false,
        antialias: false,
        colorBlending: 5,
        backgroundColor: bg,
        backgroundAlpha: 1,
        grainScale: 0,
        grainSparsity: 0,
        grainIntensity: 0,
        grainSpeed: 0,
        resolution: 0.5,
        yOffset: 0,
        yOffsetWaveMultiplier: 1.5,
        yOffsetColorMultiplier: 1.8,
        yOffsetFlowMultiplier: 2,
        flowDistortionA: 5,
        flowDistortionB: 7.7,
        flowScale: 2.6,
        flowEase: 0.36,
        flowEnabled: false,
        enableProceduralTexture: false,
        transparentTextureVoid: false,
        textureMode: "bitmap",
        bakeEdgeSoftness: 1,
        textureVoidLikelihood: 0.22,
        textureVoidWidthMin: 120,
        textureVoidWidthMax: 150,
        textureBandDensity: 1.9,
        textureColorBlending: 0.12,
        textureSeed: 333,
        textureEase: 0.75,
        proceduralBackgroundColor: "#D0DBFB",
        textureShapeTriangles: 20,
        textureShapeCircles: 15,
        textureShapeBars: 15,
        textureShapeSquiggles: 10,
        domainWarpEnabled: false,
        domainWarpIntensity: 0,
        domainWarpScale: 3,
        vignetteIntensity: 0,
        vignetteRadius: 0.8,
        fresnelEnabled: false,
        fresnelPower: 2,
        fresnelIntensity: 0.5,
        fresnelColor: "#FFFFFF",
        iridescenceEnabled: false,
        iridescenceIntensity: 0.5,
        iridescenceSpeed: 1,
        prismEdgeEnabled: false,
        prismEdgeIntensity: 0.5,
        prismEdgeThinness: 3,
        prismEdgeSpread: 1,
        prismEdgeSpeed: 0.5,
        prismEdgeRipple: 1,
        bloomIntensity: 0,
        bloomThreshold: 0.7,
        chromaticAberration: 0,
        shapeType: "plane",
        shapeRotationX: 0,
        shapeRotationY: 0,
        shapeRotationZ: 0,
        shapeAutoRotateSpeedX: 0,
        shapeAutoRotateSpeedY: 0,
        sphereRadius: 15,
        torusRadius: 15,
        torusTube: 5,
        cylinderRadius: 10,
        cylinderHeight: 40,
        planeBend: 0,
        planeTwist: 0,
        silhouetteFade: 0.25,
        cylinderFade: 0.08,
        ribbonFade: 0.05,
        flatShading: true,
        cameraLock: true,
        cameraX: 0,
        cameraY: 0,
        cameraZ: 0,
        cameraRotationX: 0,
        cameraRotationY: 0,
        cameraRotationZ: 0,
        cameraZoom: 1,
    };
}

function crearInstancia() {
    if (instancia) {
        try { instancia.destroy(); } catch { }
        instancia = null;
    }
    ajustarTamanoCanvas();
    instancia = new NeatGradient({
        ref: canvas,
        ...construirConfig(),
    });
}

function aplicarEstadoFondo(estado) {
    html.classList.remove('fondo-animado', 'fondo-apagado');
    html.classList.add('fondo-' + estado);
    if (estado === 'apagado') {
        canvas.style.display = 'none';
        if (instancia) {
            try { instancia.destroy(); } catch { }
            instancia = null;
        }
    } else {
        canvas.style.display = '';
        if (!instancia) {
            crearInstancia();
        }
    }
}

const estadoGuardado = localStorage.getItem('esc-fondo-estado') || 'animado';
selectFondo.value = estadoGuardado;
aplicarEstadoFondo(estadoGuardado);

selectFondo.addEventListener('change', (e) => {
    const estado = e.target.value;
    aplicarEstadoFondo(estado);
    localStorage.setItem('esc-fondo-estado', estado);
});

const themeToggle = document.getElementById('themeToggle');
const themeTexto = document.getElementById('themeTexto');

function setTheme(tema) {
    if (tema === 'light') {
        html.setAttribute('data-theme', 'light');
        themeTexto.textContent = 'Modo oscuro';
    } else {
        html.removeAttribute('data-theme');
        themeTexto.textContent = 'Modo claro';
    }
}

themeToggle.addEventListener('click', () => {
    const actual = html.getAttribute('data-theme');
    setTheme(actual === 'light' ? 'dark' : 'light');
    crearInstancia();
});

const cursorGlow = document.getElementById('cursorGlow');
document.addEventListener('mousemove', (e) => {
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
});

window.addEventListener("resize", () => {
    ajustarTamanoCanvas();
    if (instancia) {
        try { instancia.resize(); } catch { }
    }
});

crearInstancia();
