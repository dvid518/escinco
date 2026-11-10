const html = document.documentElement;
const selectFondo = document.getElementById('selectFondo');
const fondo = document.getElementById('fondo-css');
let transicionando = false;

function aplicarEstadoFondo(estado) {
    html.classList.remove('fondo-animado', 'fondo-apagado');
    html.classList.add('fondo-' + estado);
    if (estado === 'apagado') {
        transicionando = true;
        fondo.classList.add('saliente');
        setTimeout(() => {
            fondo.style.display = 'none';
            transicionando = false;
        }, 750);
    } else {
        fondo.style.display = '';
        fondo.classList.remove('saliente');
        transicionando = false;
    }
}

const estadoGuardado = localStorage.getItem('esc-fondo-estado') || 'animado';
selectFondo.value = estadoGuardado;
aplicarEstadoFondo(estadoGuardado);

selectFondo.addEventListener('change', (e) => {
    if (transicionando) return;
    const estado = e.target.value;
    aplicarEstadoFondo(estado);
    localStorage.setItem('esc-fondo-estado', estado);
});

const themeToggle = document.getElementById('themeToggle');
const themeTexto = document.getElementById('themeTexto');

function setTheme(tema) {
    if (tema === 'light') {
        html.setAttribute('data-theme', 'light');
        themeTexto.textContent = 'Modo oscuro';
    } else {
        html.removeAttribute('data-theme');
        themeTexto.textContent = 'Modo claro';
    }
}

themeToggle.addEventListener('click', () => {
    const actual = html.getAttribute('data-theme');
    setTheme(actual === 'light' ? 'dark' : 'light');
});

const cursorGlow = document.getElementById('cursorGlow');
document.addEventListener('mousemove', (e) => {
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
});
