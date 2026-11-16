// Mock de firebaseClient.js para tests F7.3
// La app en navegador continúa usando el archivo real desde CDN.
// Este mock solo evita que Node.js intente procesar URLs https:// en tiempo de módulo.
//
// Este módulo exporta objetos vacíos para satisfacer las importaciones
// que la cadena de dependencias de F7.3 espera, sin cargar ningún SDK real.