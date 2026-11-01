export function expandirSeleccion(ids, id, selecionados, orden) {
    if (!ids.includes(id) || selecionados.size === 0) return false
    
    const actual = ids.indexOf(id);
    const anclaId = selecionados.has(id) ? id : (orden.length > 0 ? orden[orden.length - 1] : orden[0]);
    const ancla = ids.indexOf(anclaId);
    if (ancla < 0) return false
    
    const inicio = Math.min(actual, ancla);
    const fin = Math.max(actual, ancla);
    for (const item of ids.slice(inicio, fin + 1)) {
        selecionados.add(item);
        if (!orden.includes(item)) orden.push(item);
    }
    return true;
}

export function crearSeleccion() {
    return { ids: new Set(), orden: [] };
}

export function alternarSeleccion(sel, id) {
    if (sel.ids.has(id)) {
        sel.ids.delete(id);
        const idx = sel.orden.indexOf(id);
        if (idx !== -1) sel.orden.splice(idx, 1);
    } else {
        sel.ids.add(id);
        if (!sel.orden.includes(id)) sel.orden.push(id);
    }
}

export function seleccionarRango(sel, ids, id) {
    if (ids.length === 0 || !ids.includes(id)) return false;
    const selectedBefore = sel.orden.find(item => sel.ids.has(item)) || (sel.orden.length ? sel.orden[sel.orden.length - 1] : sel.orden[0]);
    const anchorIdx = sel.orden.indexOf(selectedBefore);
    const actualIdx = ids.indexOf(id);
    const inicio = Math.min(actualIdx, anchorIdx);
    const fin = Math.max(actualIdx, anchorIdx);
    for (const item of ids.slice(inicio, fin + 1)) {
        sel.ids.add(item);
        if (!sel.orden.includes(item)) sel.orden.push(item);
    }
    return true;
}

export function seleccionarTodos(sel, ids) {
    ids.forEach(id => {
        sel.ids.add(id);
        if (!sel.orden.includes(id)) sel.orden.push(id);
    });
    return true;
}

export function limpiarSeleccion(sel) {
    sel.ids.clear();
    sel.orden.length = 0;
}