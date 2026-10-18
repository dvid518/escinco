// Modelo de Favorito (movimiento recurrente guardado por el usuario)
export class Favorito {
    constructor(datos) {
        this.nombre = datos.nombre || ''
        this.tipo = datos.tipo || 'gasto'
        this.cuenta = datos.cuenta || ''
        this.monto = datos.monto || 0
        this.divisa = datos.divisa || 'pen'
        this.concepto = datos.concepto || ''
        this.etiquetas = Array.isArray(datos.etiquetas) ? datos.etiquetas : []
        this.fechaCreacion = datos.fechaCreacion || null
        this.id = datos.id || null
    }

    static fromFirestore(id, data) {
        return new Favorito({
            id,
            nombre: data.nombre,
            tipo: data.tipo,
            cuenta: data.cuenta || '',
            monto: data.monto || 0,
            divisa: data.divisa || 'pen',
            concepto: data.concepto || '',
            etiquetas: Array.isArray(data.etiquetas) ? data.etiquetas : [],
            fechaCreacion: data.fechaCreacion?.toDate?.() || data.fechaCreacion || null
        })
    }
}
