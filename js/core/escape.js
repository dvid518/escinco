export function escapeHtml(texto) {
    if (texto === null || texto === undefined) return ""
    return String(texto)
        .replaceAll("&", "&")
        .replaceAll("<", "<")
        .replaceAll(">", ">")
        .replaceAll('"', '')
        .replaceAll("'", "'")
}