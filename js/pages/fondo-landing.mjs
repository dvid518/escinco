import { NeatGradient } from "/node_modules/@firecms/neat/dist/index.es.js";

const html = document.documentElement;
const canvas = document.getElementById("gradient");
let instancia = null;
let transicionando = false;

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
        colorBrightness: 0.7,
        colorSaturation: 4,
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
        renderScale: 1.15,
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

function destruirInstancia() {
    if (instancia) {
        try { instancia.destroy(); } catch { }
    }
    instancia = null;
}

function aplicarEstadoFondo(estado) {
    html.classList.remove("fondo-animado", "fondo-apagado");
    html.classList.add("fondo-" + estado);

    if (estado === "apagado") {
        transicionando = true;
        canvas.classList.add("saliente");
        setTimeout(() => {
            destruirInstancia();
            canvas.style.display = "none";
            transicionando = false;
        }, 750);
    } else {
        canvas.style.display = "";
        canvas.classList.remove("saliente");
        if (!instancia) {
            crearInstancia();
        }
        transicionando = false;
    }
}

// Reaccionar al cambio de tema de la aplicación (disparado por js/core/tema.js)
window.addEventListener("tema-cambiado", (evento) => {
    if (transicionando) return;
    transicionando = true;
    canvas.classList.add("saliente");
    setTimeout(() => {
        destruirInstancia();
        crearInstancia();
        canvas.classList.remove("saliente");
        transicionando = false;
    }, 750);
});

// Inicializar
const estadoInicial = html.classList.contains("fondo-apagado") ? "apagado" : "animado";
aplicarEstadoFondo(estadoInicial);

// Ajustar canvas al redimensionar
window.addEventListener("resize", () => {
    ajustarTamanoCanvas();
    if (instancia) {
        try { instancia.resize(); } catch { }
    }
});
