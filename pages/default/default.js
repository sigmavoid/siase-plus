// default.js — SIASE+ Frame Coordinator
// Se inyecta en la página raíz (default.htm / el frameset).
//
// Responsabilidades:
//   1. Expandir la fila del header en el <frameset> para que el menú
//      sea completamente visible (110px → altura dinámica real).
//   2. Propagar el tema (claro/oscuro) a todos los frames hijos
//      cuando cambia en cualquiera de ellos.
//   3. Aplicar el tema guardado al cargar la página.

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
    // El frameset original tiene rows="110,*".
    // El header refactorizado necesita más espacio (fila superior +
    // barra de menú). Se fija un valor generoso y luego se ajusta
    // dinámicamente una vez que el frame del header cargue.
    const ALTURA_HEADER_FALLBACK = 113; // px, si no se puede medir

    function ajustarAlturaHeader() {
        const frameset = document.querySelector('frameset[rows], FRAMESET[rows]');
        if (!frameset) return;

        const frameHeader = document.querySelector('frame[name="top"], FRAME[name="top"]');
        if (!frameHeader) {
            // Frame aún no disponible: aplica el valor de fallback
            setAltura(frameset, ALTURA_HEADER_FALLBACK);
            return;
        }

        try {
            const innerDoc = frameHeader.contentDocument || frameHeader.contentWindow?.document;
            if (!innerDoc) {
                setAltura(frameset, ALTURA_HEADER_FALLBACK);
                return;
            }

            const headerEl = innerDoc.getElementById('siase-header');
            if (headerEl) {
                // Mide la altura real del header refactorizado
                const altura = headerEl.scrollHeight || headerEl.offsetHeight;
                setAltura(frameset, Math.max(altura, ALTURA_HEADER_FALLBACK));
            } else {
                // Header aún no refactorizado: usa el fallback
                setAltura(frameset, ALTURA_HEADER_FALLBACK);
            }
        } catch (_) {
            // Cross-origin u otro error: aplica fallback
            setAltura(frameset, ALTURA_HEADER_FALLBACK);
        }
    }

    function setAltura(frameset, px) {
        // rows="Npx,*"  →  actualiza solo el primer valor
        const rows = frameset.getAttribute('rows') || '';
        const partes = rows.split(',');
        partes[0] = px + 'px';
        frameset.setAttribute('rows', partes.join(','));
    }

    // Aplica inmediatamente con fallback y reintenta cuando carguen los frames
    ajustarAlturaHeader();

    window.addEventListener('load', () => {
        ajustarAlturaHeader();

        // Reintento tras un tick para que el JS del frame termine de correr
        setTimeout(ajustarAlturaHeader, 300);
        setTimeout(ajustarAlturaHeader, 800);
    });

    // ══════════════════════════════════════════════════════════════
    // 1b. AJUSTAR ANCHO DEL FRAMESET INTERNO (columna del menú)
    // ══════════════════════════════════════════════════════════════
    // El frameset anidado tiene cols="184,*".
    // Se amplía la columna del menú al 125 % del valor original
    // (184 px × 1.25 = 230 px).
    const ANCHO_MENU_ORIGINAL = 184; // px definidos en el HTML original
    const ANCHO_MENU_FACTOR = 1.25;
    const ANCHO_MENU = Math.round(ANCHO_MENU_ORIGINAL * ANCHO_MENU_FACTOR); // 230 px

    function ajustarAnchoMenu() {
        // El frameset interno es el que tiene el atributo cols (no rows)
        const framesetCols = document.querySelector('frameset[cols], FRAMESET[cols]');
        if (!framesetCols) return;

        const cols = framesetCols.getAttribute('cols') || '';
        const partes = cols.split(',');
        // Solo actualiza si el primer valor todavía no fue modificado
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

    // Devuelve todos los frames hijos (top, left, center)
    function obtenerFrames() {
        return Array.from(document.querySelectorAll('frame, FRAME'))
            .map(f => {
                try { return f.contentWindow; } catch (_) { return null; }
            })
            .filter(Boolean);
    }

    // Envía el tema a todos los frames vía postMessage
    function propagarTema(valor) {
        obtenerFrames().forEach(fw => {
            try { fw.postMessage({ siaseTema: valor }, '*'); } catch (_) { }
        });
    }

    // Reenvía siaseUserData a todos los frames cuando header.js lo emite
    function propagarUserData(userData) {
        obtenerFrames().forEach(fw => {
            try { fw.postMessage({ siaseUserData: userData }, '*'); } catch (_) { }
        });
    }

    // Escucha mensajes de cualquier frame
    window.addEventListener('message', (e) => {
        // Canal de tema
        if (e.data?.siaseTema) {
            const valor = e.data.siaseTema;
            try { localStorage.setItem(TEMA_KEY, valor); } catch (_) { }
            propagarTema(valor);
        }
        // Canal de datos de usuario — header.js lo emite al terminar
        if (e.data?.siaseUserData) {
            try { localStorage.setItem('siase-user-data', JSON.stringify(e.data.siaseUserData)); } catch (_) { }
            propagarUserData(e.data.siaseUserData);
        }
    });

    // Escucha cambios en localStorage hechos por otras pestañas/ventanas
    window.addEventListener('storage', (e) => {
        if (e.key !== TEMA_KEY || !e.newValue) return;
        propagarTema(e.newValue);
    });

    // Al cargar: aplica el tema guardado a todos los frames
    window.addEventListener('load', () => {
        let temaGuardado = null;
        try { temaGuardado = localStorage.getItem(TEMA_KEY); } catch (_) { }

        if (!temaGuardado) {
            // Sin preferencia guardada: detecta la del sistema
            temaGuardado = window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';
        }

        // Pequeño retraso para que los frames terminen de cargar su JS
        setTimeout(() => propagarTema(temaGuardado), 500);
        setTimeout(() => propagarTema(temaGuardado), 1200);

        // Si siase-user-data ya existe en localStorage (sesión previa o
        // header cargó antes), lo reenvía al frame del menú
        const rawUser = (() => { try { return localStorage.getItem('siase-user-data'); } catch (_) { return null; } })();
        if (rawUser) {
            try {
                const parsed = JSON.parse(rawUser);
                [400, 1200].forEach(ms => setTimeout(() => propagarUserData(parsed), ms));
            } catch (_) { }
        }
    });

    console.log('%c✦ SIASE+ Default %ccoordinador activo',
        'background:#007bff;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px',
        'background:#0b1121;color:#82b1ff;padding:2px 6px;border-radius:0 4px 4px 0'
    );

})();