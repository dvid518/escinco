// Smoke test de las reglas de snapshots contra el emulador de Firestore.
// Necesita el emulador en marcha (npm run test:rules lo arranca solo). Si no
// hay emulador escuchando, el test se SALTA sin fallar: asi `npm test` sigue
// siendo offline-friendly.
const PROJECT = process.env.PROJECT_ID || process.env.GCLOUD_PROJECT || "cinco-96064"
const HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080"
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`
const UID = "test-uid"
const FECHA = "2026-10-08"

function encode(v) {
    if (v === null || v === undefined) return { nullValue: null }
    if (typeof v === "boolean") return { booleanValue: v }
    if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
    if (v instanceof Date) return { timestampValue: v.toISOString() }
    if (typeof v === "string") return { stringValue: v }
    if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } }
    if (typeof v === "object") {
        const fields = {}
        for (const [k, val] of Object.entries(v)) if (val !== undefined) fields[k] = encode(val)
        return { mapValue: { fields } }
    }
    throw new Error("tipo no soportado: " + typeof v)
}

async function escribir(authHeader, body, docPath) {
    const url = `${BASE}/${docPath}?documentId=${encodeURIComponent(FECHA)}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 1500)
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader },
            body: JSON.stringify(body),
            signal: ctrl.signal
        })
        return { status: res.status }
    } finally {
        clearTimeout(timer)
    }
}

export default async function ejecutar(t) {
    try {
        await fetch(`http://${HOST}/`, { signal: AbortSignal.timeout(1000) })
    } catch {
        console.log(`  -- SKIP: no hay emulador de Firestore en ${HOST}`)
        return t
    }

    const snapshot = { patrimonioPEN: 1500.5, patrimonioUSD: 400.25, cerrado: false, actualizacion: new Date("2026-10-08T12:00:00Z") }

    console.log(`  Emulador detectado en ${HOST} (proyecto ${PROJECT})`)
    const a = await escribir("Bearer owner", { fields: encode(snapshot) }, `usuarios/${UID}/snapshots`)
    t.check("create con los campos reales es aceptado", a.status === 200 || a.status === 201, `HTTP ${a.status}`)

    const b = await escribir("", { fields: encode(snapshot) }, `usuarios/${UID}/snapshots`)
    t.check("sin token se rechaza (las reglas evaluan auth)", b.status === 401 || b.status === 403, `HTTP ${b.status}`)

    const d = await escribir("Bearer owner", { fields: encode({ ...snapshot, campoInventado: 1 }) }, `usuarios/${UID}/snapshots`)
    t.check("un campo extra no permitido se rechaza (hasOnly)", d.status === 401 || d.status === 403, `HTTP ${d.status}`)

    return t
}
