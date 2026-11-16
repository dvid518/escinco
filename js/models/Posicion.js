// Modelo de Posición (por usuario)
export class Posicion {
    constructor(datos) {
        this.id = datos.id || null
        this.activoId = datos.activoId || ''
        this.custodioId = datos.custodioId || null // null = legacy, pendiente_asignacion (M5)
        this.cantidad = datos.cantidad || 0
        this.divisa = datos.divisa || 'usd'
        this.precioPromedio = datos.precioPromedio || 0
        this.ultimaActualizacion = datos.ultimaActualizacion || new Date()
        this.activo = datos.activo || null // Datos del activo (populate)
    }

    validar() {
        if (!this.activoId) {
            throw new Error('El ID del activo es obligatorio')
        }
        // custodioId nulo es válido: posición legacy pendiente_asignacion (M5)
        // solo es error si está undefined (campo ausente, error de programación)
        if (this.custodioId !== undefined && this.custodioId === null) {
            // está explícitamente en null → permitido (legacy)
        } else if (this.custodioId === undefined) {
            throw new Error('El custodio de la posición es obligatorio (o debe ser null para legacy)')
        }
        if (this.cantidad < 0) {
            throw new Error('La cantidad no puede ser negativa')
        }
        if (this.precioPromedio < 0) {
            throw new Error('El precio promedio no puede ser negativo')
        }
        return true
    }

    estaAsignada() {
        // Devuelve true si tiene custodio definido (no es legacy/null)
        return this.custodioId !== null && this.custodioId !== undefined
    }

    toFirestore() {
        return {
            activoId: this.activoId,
            // omitir custodioId si es null (legacy)
            ...(this.custodioId !== null && this.custodioId !== undefined ? { custodioId: this.custodioId } : {}),
            cantidad: this.cantidad,
            divisa: this.divisa,
            precioPromedio: this.precioPromedio,
            ultimaActualizacion: this.ultimaActualizacion
        }
    }

    static fromFirestore(id, data) {
        return new Posicion({
            id,
            activoId: data.activoId,
            custodioId: data.custodioId, // puede ser null (legacy) o string (asignada)
            cantidad: data.cantidad || 0,
            divisa: data.divisa || 'usd',
            precioPromedio: data.precioPromedio || 0,
            ultimaActualizacion: data.ultimaActualizacion?.toDate?.() || data.ultimaActualizacion
        })
    }
}