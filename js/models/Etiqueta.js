// Modelo de Etiqueta (catálogo de etiquetas del usuario)
export class Etiqueta {
    constructor(datos) {
        this.nombre = datos.nombre || ''
        this.color = datos.color || null
        this.esPrincipal = datos.esPrincipal === true
        this.fechaCreacion = datos.fechaCreacion || null
        this.id = datos.id || null
    }

    static fromFirestore(id, data) {
        return new Etiqueta({
            id,
            nombre: data.nombre,
            color: data.color || null,
            esPrincipal: data.esPrincipal === true,
            fechaCreacion: data.fechaCreacion?.toDate?.() || data.fechaCreacion || null
        })
    }
}
