// ============================================
// SERVICIO DE VOZ · WEB SPEECH API
// ============================================
// Envoltura sobre SpeechRecognition (Chrome/Edge) para el asistente Drov.
// Es gratuita, no requiere claves y degrada graceful si el navegador no la
// soporta (p. ej. Firefox).

export class VozServicio {
    constructor() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

        if (!SpeechRecognition) {
            this.soportado = false
            this.recognition = null
            return
        }

        this.soportado = true
        this.recognition = new SpeechRecognition()
        this.recognition.lang = "es-PE"
        this.recognition.continuous = false
        this.recognition.interimResults = true
        this.escuchando = false
    }

    /**
     * Inicia el reconocimiento de voz.
     *
     * @param {Function} onResultado - Se llama con el transcript (interino/final).
     * @param {Function} onError - Se llama con el código de error o un mensaje legible.
     */
    iniciar(onResultado, onError) {
        if (!this.soportado || !this.recognition) {
            onError?.("El navegador no soporta reconocimiento de voz")
            return
        }

        if (this.escuchando) return

        this.recognition.onresult = evento => {
            const transcript = Array.from(evento.results)
                .map(resultado => resultado[0].transcript)
                .join("")
            onResultado?.(transcript)
        }

        this.recognition.onerror = evento => {
            this.escuchando = false
            const mensaje = this.mensajeDeError(evento.error)
            onError?.(mensaje)
        }

        this.recognition.onend = () => {
            this.escuchando = false
        }

        this.escuchando = true
        this.recognition.start()
    }

    detener() {
        if (!this.soportado || !this.recognition) return

        this.escuchando = false
        this.recognition.stop()
    }

    mensajeDeError(codigo) {
        const mensajes = {
            "not-allowed": "Permiso de micrófono denegado. Permite el acceso al micrófono para usar la voz.",
            "audio-capture": "No se pudo capturar el audio del micrófono.",
            "no-speech": "No se detectó voz. Inténtalo de nuevo.",
            "aborted": "El reconocimiento se interrumpió.",
            "language-not-supported": "El idioma no es compatible con el reconocimiento de voz.",
            "network": "Error de red al contactar con el servicio de reconocimiento.",
            "service-not-allowed": "El servicio de reconocimiento no está disponible.",
            "bad-grammar": "Error en la configuración del reconocimiento."
        }

        return mensajes[codigo] || `Error de reconocimiento de voz: ${codigo}`
    }
}
