// default.js — SIASE+ Frame Coordinator
// Se inyecta en la página raíz (default.htm / el frameset).
//
// Responsabilidades:
//   1. Expandir la fila del header en el <frameset> para que el menú
//      sea completamente visible (110px → altura dinámica real).
//   2. Propagar el tema (claro/oscuro) a todos los frames hijos
//      cuando cambia en cualquiera de ellos.
//   3. Aplicar el tema guardado al cargar la página.
//   4. Detectar cuando el frame center navega al kardex e inyectar
//      kardex.css + kardex.js manualmente.

document.title = "SIASE+";

// Eliminar favicons existentes
document.querySelectorAll('link[rel*="icon"]').forEach(el => el.remove());

// Crear nuevo favicon
const favicon = document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/png";
favicon.href = chrome.runtime.getURL("media/img/siase.png");
document.head.appendChild(favicon);

(function coordinadorDefault() {

    const TEMA_KEY = 'siase-tema';

    // ══════════════════════════════════════════════════════════════
    // 1. AJUSTAR ALTURA DEL FRAMESET (header row)
    // ══════════════════════════════════════════════════════════════
    const ALTURA_HEADER_FALLBACK = 97;

    function ajustarAlturaHeader() {
        const frameset = document.querySelector('frameset[rows], FRAMESET[rows]');
        if (!frameset) return;

        const frameHeader = document.querySelector('frame[name="top"], FRAME[name="top"]');
        if (!frameHeader) {
            setAltura(frameset, ALTURA_HEADER_FALLBACK);
            return;
        }

        try {
            const innerDoc = frameHeader.contentDocument || frameHeader.contentWindow?.document;
            if (!innerDoc) { setAltura(frameset, ALTURA_HEADER_FALLBACK); return; }

            const headerEl = innerDoc.getElementById('siase-header');
            if (headerEl) {
                const altura = headerEl.scrollHeight || headerEl.offsetHeight;
                setAltura(frameset, Math.max(altura, ALTURA_HEADER_FALLBACK));
            } else {
                setAltura(frameset, ALTURA_HEADER_FALLBACK);
            }
        } catch (_) {
            setAltura(frameset, ALTURA_HEADER_FALLBACK);
        }
    }

    function setAltura(frameset, px) {
        const rows = frameset.getAttribute('rows') || '';
        const partes = rows.split(',');
        partes[0] = px + 'px';
        frameset.setAttribute('rows', partes.join(','));
    }

    ajustarAlturaHeader();

    window.addEventListener('load', () => {
        ajustarAlturaHeader();
        setTimeout(ajustarAlturaHeader, 300);
        setTimeout(ajustarAlturaHeader, 800);
    });

    // ══════════════════════════════════════════════════════════════
    // 1b. AJUSTAR ANCHO DEL FRAMESET INTERNO (columna del menú)
    // ══════════════════════════════════════════════════════════════
    const ANCHO_MENU_ORIGINAL = 184;
    const ANCHO_MENU_FACTOR = 1.25;
    const ANCHO_MENU = Math.round(ANCHO_MENU_ORIGINAL * ANCHO_MENU_FACTOR);

    function ajustarAnchoMenu() {
        const framesetCols = document.querySelector('frameset[cols], FRAMESET[cols]');
        if (!framesetCols) return;

        const cols = framesetCols.getAttribute('cols') || '';
        const partes = cols.split(',');
        if (parseInt(partes[0], 10) === ANCHO_MENU) return;
        partes[0] = ANCHO_MENU + 'px';
        framesetCols.setAttribute('cols', partes.join(','));
    }

    ajustarAnchoMenu();

    window.addEventListener('load', () => {
        ajustarAnchoMenu();
        setTimeout(ajustarAnchoMenu, 300);
    });

    // ══════════════════════════════════════════════════════════════
    // 2. PROPAGACIÓN DEL TEMA ENTRE FRAMES
    // ══════════════════════════════════════════════════════════════

    function obtenerFrames() {
        return Array.from(document.querySelectorAll('frame, FRAME'))
            .map(f => { try { return f.contentWindow; } catch (_) { return null; } })
            .filter(Boolean);
    }

    function propagarTema(valor) {
        obtenerFrames().forEach(fw => {
            try { fw.postMessage({ siaseTema: valor }, '*'); } catch (_) { }
        });
    }

    function propagarUserData(userData) {
        obtenerFrames().forEach(fw => {
            try { fw.postMessage({ siaseUserData: userData }, '*'); } catch (_) { }
        });
    }

    window.addEventListener('message', (e) => {
        if (e.data?.siaseTema) {
            const valor = e.data.siaseTema;
            try { localStorage.setItem(TEMA_KEY, valor); } catch (_) { }
            propagarTema(valor);
        }
        if (e.data?.siaseUserData) {
            try { localStorage.setItem('siase-user-data', JSON.stringify(e.data.siaseUserData)); } catch (_) { }
            propagarUserData(e.data.siaseUserData);
        }
    });

    window.addEventListener('storage', (e) => {
        if (e.key !== TEMA_KEY || !e.newValue) return;
        propagarTema(e.newValue);
    });

    window.addEventListener('load', () => {
        let temaGuardado = null;
        try { temaGuardado = localStorage.getItem(TEMA_KEY); } catch (_) { }

        if (!temaGuardado) {
            temaGuardado = window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark' : 'light';
        }

        setTimeout(() => propagarTema(temaGuardado), 500);
        setTimeout(() => propagarTema(temaGuardado), 1200);

        const rawUser = (() => { try { return localStorage.getItem('siase-user-data'); } catch (_) { return null; } })();
        if (rawUser) {
            try {
                const parsed = JSON.parse(rawUser);
                [400, 1200].forEach(ms => setTimeout(() => propagarUserData(parsed), ms));
            } catch (_) { }
        }
    });

    // ══════════════════════════════════════════════════════════════
    // 3. INYECCIÓN DE MÓDULOS EN EL FRAME CENTER
    // Chrome no inyecta content scripts en frames de frameset.
    // Se detecta la URL y se inyectan CSS + JS manualmente.
    // ══════════════════════════════════════════════════════════════

    // ── Detectores de URL ──
    function esKardex(url) {
        return url && url.includes('econkdx01');
    }

    function esCalificaciones(url, frameWin) {
        if (url.includes('econcfs01') || url.includes('econcfs02')) return true;
        if (!url.includes('control.p')) return false;
        try {
            const origen = frameWin.sessionStorage.getItem('siase-control-origen');
            if (origen === 'horario') return false;
            if (origen === 'califs') return true;
        } catch (_) { }
        return true;
    }

    function esHorario(url, frameWin) {
        if (url.includes('echalm01') || url.includes('echalm02')) return true;
        if (!url.includes('control.p')) return false;
        try {
            const origen = frameWin.sessionStorage.getItem('siase-control-origen');
            return origen === 'horario';
        } catch (_) { }
        return false;
    }

    function esIaFoto01(url) {
        return url && url.includes('iaFoto01');
    }


    function obtenerFrameCenter() {
        return document.querySelector(
            'html > frameset > frameset > frame:nth-child(2), ' +
            'HTML > FRAMESET > FRAMESET > FRAME:nth-child(2)'
        );
    }

    // ── Inyección con espera a readyState ──
    // Problema raíz: cuando el polling detecta el cambio de URL el documento
    // del frame puede estar todavía en 'loading' → doc.head es null y el
    // appendChild falla silenciosamente. Esperamos a 'interactive' o 'complete'
    // antes de tocar el DOM del frame.
    // La guardia contra doble inyección usa el propio objeto `document` como
    // clave (WeakSet), porque los flags en el doc anterior no sirven: cada
    // navegación crea un nuevo objeto document.

    const _docsInyectados = new WeakSet();

    function inyectarEnDocumento(doc, cssUrl, jsUrl, nombre) {
        if (!doc || _docsInyectados.has(doc)) return;
        _docsInyectados.add(doc);

        const insertarEn = doc.head || doc.documentElement;
        if (!insertarEn) return; // doc todavía no tiene estructura

        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssUrl;
        insertarEn.appendChild(link);

        const script = doc.createElement('script');
        script.src = jsUrl;
        insertarEn.appendChild(script);

        console.log(
            `%c✦ SIASE+ ${nombre} %cinyectado desde default.js`,
            'background:#007bff;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px',
            'background:#0b1121;color:#82b1ff;padding:2px 6px;border-radius:0 4px 4px 0'
        );
    }

    function esperarYInyectar(frameCenter, inyectarFn, maxMs = 6000) {
        // Si el documento ya está listo, inyectar de inmediato.
        try {
            const doc = frameCenter.contentDocument;
            const rs = doc?.readyState;
            if (rs === 'interactive' || rs === 'complete') {
                inyectarFn(doc);
                return;
            }
        } catch (_) { }

        // Si aún está cargando, escuchar DOMContentLoaded del contentWindow.
        const inicio = Date.now();
        const timer = setInterval(() => {
            try {
                const doc = frameCenter.contentDocument;
                const rs = doc?.readyState;
                if (rs === 'interactive' || rs === 'complete') {
                    clearInterval(timer);
                    inyectarFn(doc);
                }
            } catch (_) { clearInterval(timer); }
            if (Date.now() - inicio > maxMs) clearInterval(timer);
        }, 80);
    }

    // ── Dispatcher: decide qué módulo inyectar según la URL ──
    function despacharInyeccion(frameCenter) {
        try {
            const frameWin = frameCenter.contentWindow;
            const url = frameWin?.location?.href || '';

            if (esKardex(url)) {
                esperarYInyectar(frameCenter, doc => inyectarEnDocumento(
                    doc,
                    chrome.runtime.getURL('pages/default/content/kardex/kardex.css'),
                    chrome.runtime.getURL('pages/default/content/kardex/kardex.js'),
                    'Kardex'
                ));
            } else if (esIaFoto01(url)) {
                esperarYInyectar(frameCenter, doc => inyectarEnDocumento(
                    doc,
                    chrome.runtime.getURL('pages/default/content/iafoto01/iafoto01.css'),
                    chrome.runtime.getURL('pages/default/content/iafoto01/iafoto01.js'),
                    'iaFoto01'
                ));
            } else if (esHorario(url, frameWin)) {
                esperarYInyectar(frameCenter, doc => inyectarEnDocumento(
                    doc,
                    chrome.runtime.getURL('pages/default/content/horario/horario.css'),
                    chrome.runtime.getURL('pages/default/content/horario/horario.js'),
                    'Horario'
                ));
            } else if (esCalificaciones(url, frameWin)) {
                esperarYInyectar(frameCenter, doc => inyectarEnDocumento(
                    doc,
                    chrome.runtime.getURL('pages/default/content/calificaciones/califs.css'),
                    chrome.runtime.getURL('pages/default/content/calificaciones/califs.js'),
                    'Calificaciones'
                ));
            }
        } catch (_) { }
    }

    // ── Vigilancia del frame center ──
    // Combinamos polling de URL (detecta same-document navigations como el
    // iaFoto01 que ves como Doc en Network) + evento load del <frame>
    // (cubre navegaciones clásicas).

    let _urlAnterior = '';
    let _pollingTimer = null;

    function iniciarPolling() {
        if (_pollingTimer) return;
        _pollingTimer = setInterval(() => {
            const frameCenter = obtenerFrameCenter();
            if (!frameCenter) return;
            try {
                const url = frameCenter.contentWindow?.location?.href || '';
                if (url && url !== _urlAnterior) {
                    _urlAnterior = url;
                    despacharInyeccion(frameCenter);
                }
            } catch (_) { }
        }, 300);
    }

    function vigilarFrameCenter() {
        const frameCenter = obtenerFrameCenter();
        if (!frameCenter) return;

        if (!frameCenter._siaseVigilado) {
            frameCenter._siaseVigilado = true;
            frameCenter.addEventListener('load', () => {
                despacharInyeccion(frameCenter);
            });
        }

        iniciarPolling();
        despacharInyeccion(frameCenter);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', vigilarFrameCenter);
    } else {
        vigilarFrameCenter();
    }

    window.addEventListener('load', vigilarFrameCenter);


    console.log('%c✦ SIASE+ Default %ccoordinador activo',
        'background:#007bff;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px',
        'background:#0b1121;color:#82b1ff;padding:2px 6px;border-radius:0 4px 4px 0'
    );

})(); ñ