// ============================================
// MODELO DE PRESUPUESTO
// ============================================
// Un presupuesto asigna un monto a gastar en un periodo (mensual o anual)
// sobre una categoría del sistema (nivel 1) o sobre etiquetas del usuario
// (nivel 2). Los movimientos se leen por etiqueta: un gasto con varias tags
// reparte su monto por partes iguales entre ellas.
//
import { CATEGORIAS_SISTEMA, esCategoriaSistema } from "../core/etiquetas.js"

export const PERIODOS_PRESUPUESTO = Object.freeze(["mensual", "anual"])

// Niveles de alerta por porcentaje del presupuesto consumido.
export const ALERTA_50 = 50
export const ALERTA_75 = 75
export const ALERTA_90 = 90

export class Presupuesto {
    constructor(datos) {
        this.id = datos.id || null
        this.nombre = String(datos.nombre || "").trim()
        this.monto = Number(datos.monto) || 0
        this.divisa = (datos.divisa || "pen").toLowerCase()
        this.periodo = datos.periodo || "mensual"
        this.fechaInicio = datos.fechaInicio || null
        // Nivel 1: una de las 5 categorías del sistema, o null si es por etiquetas.
        this.categoria = datos.categoria || null
        // Nivel 2: etiquetas del usuario (vacía si usa categoría).
        this.etiquetas = Array.isArray(datos.etiquetas) ? datos.etiquetas : []
        this.activa = datos.activa !== undefined ? datos.activa : true
        this.fechaCreacion = datos.fechaCreacion || new Date()
    }

    validar() {
        if (!this.nombre) {
            throw new Error("El nombre del presupuesto es obligatorio")
        }
        if (!PERIODOS_PRESUPUESTO.includes(this.periodo)) {
            throw new Error('El periodo debe ser "mensual" o "anual"')
        }
        if (!this.monto || this.monto <= 0) {
            throw new Error("El monto del presupuesto debe ser mayor a 0")
        }
        if (!this.fechaInicio) {
            throw new Error("La fecha de inicio es obligatoria")
        }
        if (this.categoria && !esCategoriaSistema(this.categoria)) {
            throw new Error(`La categoría "${this.categoria}" no es del sistema`)
        }
        // Nivel 1 o nivel 2, no los dos a la vez.
        if (this.categoria && this.etiquetas.length > 0) {
            throw new Error("Elige una categoría del sistema o etiquetas, no ambas")
        }
        if (!this.categoria && this.etiquetas.length === 0) {
            throw new Error("Elige una categoría del sistema o al menos una etiqueta")
        }
        return true
    }

    toFirestore() {
        return {
            nombre: this.nombre,
            monto: this.monto,
            divisa: this.divisa,
            periodo: this.periodo,
            fechaInicio: this.fechaInicio,
            categoria: this.categoria,
            etiquetas: this.etiquetas,
            activa: this.activa,
            fechaCreacion: this.fechaCreacion
        }
    }

    static fromFirestore(id, data) {
        return new Presupuesto({
            id,
            nombre: data.nombre,
            monto: data.monto,
            divisa: data.divisa,
            periodo: data.periodo,
            fechaInicio: data.fechaInicio?.toDate?.() || data.fechaInicio || null,
            categoria: data.categoria,
            etiquetas: Array.isArray(data.etiquetas) ? data.etiquetas : [],
            activa: data.activa,
            fechaCreacion: data.fechaCreacion?.toDate?.() || data.fechaCreacion
        })
    }

    /** Fecha fin del periodo (exclusiva). */
    get periodoFin() {
        if (!this.fechaInicio) return null
        const inicio = new Date(this.fechaInicio)
        const fin = new Date(inicio)
        if (this.periodo === "anual") {
            fin.setFullYear(fin.getFullYear() + 1)
        } else {
            fin.setMonth(fin.getMonth() + 1)
        }
        return fin
    }

    /** ¿La fecha dada cae dentro del periodo de este presupuesto? */
    estaVigente(fecha = new Date()) {
        const f = new Date(fecha)
        return f >= this.fechaInicio && f < this.periodoFin
    }

    /** Porcentaje consumido: gastoReal / monto * 100 (0 si no hay gasto). */
    porcentaje(gastoReal) {
        if (!this.monto || this.monto <= 0) return 0
        return Math.min(100, (gastoReal / this.monto) * 100)
    }

    /** Estado del presupuesto: dentro | alerta | critico | superado. */
    estado(gastoReal) {
        const p = this.porcentaje(gastoReal)
        if (p >= 100) return "superado"
        if (p >= ALERTA_90) return "critico"
        if (p >= ALERTA_75) return "alerta"
        if (p >= ALERTA_50) return "atencion"
        return "dentro"
    }

    /** Texto legible del estado. */
    estadoTexto(gastoReal) {
        const map = {
            dentro: "Dentro del presupuesto",
            atencion: "Atención (50 %)",
            alerta: "Alerta (75 %)",
            critico: "Crítico (90 %)",
            superado: "Superado"
        }
        return map[this.estado(gastoReal)] || "Desconocido"
    }
}
