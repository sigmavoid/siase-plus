// calificaciones.js — SIASE+
// Maneja dos páginas:
//   A) econcfs01.htm  → selector de periodo → auto-submit con 1ª opción válida
//   B) econcfs02.htm  → control → inyecta nav de periodos y estiliza tabla
//
// La URL de cada página contiene el identificador que usamos para detectarla.

(function calificacionesSIASE() {

    // ──────────────────────────────────────────────
    // UTILIDADES COMUNES
    // ──────────────────────────────────────────────

    // Aplica tema desde localStorage / postMessage
    const TEMA_KEY = 'siase-tema';

    function aplicarTema(valor) {
        const b = document.body;
        const h = document.documentElement;
        if (valor === 'dark') {
            b.classList.add('dark-mode');
            h.classList.add('dark-mode');
        } else {
            b.classList.remove('dark-mode');
            h.classList.remove('dark-mode');
        }
    }

    // Inicializar tema al cargar
    try {
        const saved = localStorage.getItem(TEMA_KEY);
        if (saved) aplicarTema(saved);
        else if (window.matchMedia('(prefers-color-scheme: dark)').matches) aplicarTema('dark');
    } catch (_) { }

    // Escuchar cambios de tema desde el coordinador (default.js)
    window.addEventListener('message', (e) => {
        if (e.data?.siaseTema) aplicarTema(e.data.siaseTema);
    });

    // ──────────────────────────────────────────────
    // DETECCIÓN DE PÁGINA
    // ──────────────────────────────────────────────

    const url = window.location.href;

    // econcfs01: selector de calificaciones (tiene <select name="HTMLPeriodo"> visible)
    // econcfs02/control.p de califs: se identifica por la clave de origen en sessionStorage
    const esSelector = url.includes('econcfs01') ||
        (document.querySelector('select[name="HTMLPeriodo"]') !== null &&
            !url.includes('echalm'));

    const origenControl = (() => { try { return sessionStorage.getItem('siase-control-origen'); } catch (_) { return null; } })();
    const esControl = url.includes('econcfs02') ||
        (url.includes('control.p') && origenControl === 'califs') ||
        (url.includes('control.p') && !origenControl &&
            document.querySelector('input[name="HTMLPeriodo"][type="hidden"]') !== null &&
            !document.querySelector('input[name="HTMLTrund"][value="echalm02"]'));

    // ──────────────────────────────────────────────
    // A) ECONCFS01 — SELECTOR DE PERIODO
    //    Auto-submit con la 1ª opción cuyo value ≠ "0"
    //    + UI moderna como fallback visual
    // ──────────────────────────────────────────────

    if (esSelector) {
        iniciarSelector();
        return;
    }

    // ──────────────────────────────────────────────
    // B) ECONCFS02 / CONTROL — TABLA DE CALIFICACIONES
    // ──────────────────────────────────────────────

    if (esControl) {
        iniciarControl();
        return;
    }

    // ══════════════════════════════════════════════
    // IMPLEMENTACIÓN A — SELECTOR
    // ══════════════════════════════════════════════

    function iniciarSelector() {
        if (document.getElementById('cfs-selector-wrap')) return; // ya montado
        const select = document.querySelector('select[name="HTMLPeriodo"]');
        const form = document.querySelector('form[name="mi_forma"]');
        if (!select || !form) return;

        // Recoger opciones válidas (value ≠ "0")
        const opciones = Array.from(select.options).filter(o => o.value && o.value !== '0');

        if (!opciones.length) return;

        // ── Auto-submit inmediato con la 1ª opción válida ──
        // Esto evita que el usuario vea la pantalla del selector en absoluto.
        // La UI moderna actúa como fallback visual mientras se hace el submit.
        const primeraOpcion = opciones[0];
        select.value = primeraOpcion.value;

        // Guardar lista completa de opciones en sessionStorage
        // para que control.js pueda leerlas y construir el nav
        try {
            const periodos = opciones.map(o => ({ value: o.value, label: o.text.trim() }));
            sessionStorage.setItem('siase-periodos', JSON.stringify(periodos));
            sessionStorage.setItem('siase-periodo-activo', primeraOpcion.value);
            sessionStorage.setItem('siase-control-origen', 'califs');
        } catch (_) { }

        // ── Construir UI moderna como feedback visual ──
        // (será visible sólo un instante antes del redirect)
        construirUISelector(opciones, primeraOpcion.value, select, form);

        // Submit automático
        form.HTMLTrund.value = 'econcfs02';
        //form.submit();
    }

    function construirUISelector(opciones, valorActivo, select, form) {
        // Ocultar body legacy
        document.body.style.backgroundImage = 'none';
        document.body.style.backgroundColor = '';
        Array.from(document.body.children).forEach(el => {
            if (!el.id?.startsWith('cfs-')) el.style.display = 'none';
        });

        const wrap = document.createElement('div');
        wrap.id = 'cfs-selector-wrap';

        const card = document.createElement('div');
        card.id = 'cfs-selector-card';

        const titulo = document.createElement('h2');
        titulo.textContent = 'Consulta de Calificaciones';
        card.appendChild(titulo);

        const lista = document.createElement('ul');
        lista.id = 'cfs-periodo-list';

        opciones.forEach(op => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = op.label;
            btn.dataset.value = op.value;
            if (op.value === valorActivo) btn.classList.add('activo');

            btn.addEventListener('click', () => {
                lista.querySelectorAll('button').forEach(b => b.classList.remove('activo'));
                btn.classList.add('activo');
                select.value = op.value;
                try {
                    sessionStorage.setItem('siase-periodo-activo', op.value);
                    const periodos = opciones.map(o => ({ value: o.value, label: o.text?.trim() || o.textContent?.trim() }));
                    sessionStorage.setItem('siase-periodos', JSON.stringify(periodos));
                    sessionStorage.setItem('siase-control-origen', 'califs');
                } catch (_) { }
                form.HTMLTrund.value = 'econcfs02';
                form.submit();
            });

            li.appendChild(btn);
            lista.appendChild(li);
        });

        card.appendChild(lista);

        wrap.appendChild(card);
        document.body.appendChild(wrap);
    }

    // ══════════════════════════════════════════════
    // IMPLEMENTACIÓN B — CONTROL (tabla califs)
    // ══════════════════════════════════════════════

    function iniciarControl() {
        if (document.getElementById('cfs-wrap')) return; // ya montado

        // ── 1. Recuperar datos de periodos guardados en el selector ──
        let periodos = [];
        let periodoActivo = '';

        try {
            const raw = sessionStorage.getItem('siase-periodos');
            if (raw) periodos = JSON.parse(raw);
            periodoActivo = sessionStorage.getItem('siase-periodo-activo') || '';
        } catch (_) { }

        // Si no hay datos en sessionStorage, leer el hidden HTMLPeriodo de la forma
        if (!periodoActivo) {
            const hiddenPeriodo = document.querySelector('input[name="HTMLPeriodo"]');
            if (hiddenPeriodo) periodoActivo = hiddenPeriodo.value;
        }

        // ── 2. Leer texto del periodo activo desde el encabezado legacy ──
        let textoPeriodoActivo = '';
        const tdPeriodo = document.querySelector('td.titulos font, td font[color="#000000"]');
        if (tdPeriodo) {
            textoPeriodoActivo = tdPeriodo.textContent.replace('Periodo :', '').replace('&nbsp;', '').trim();
        }
        // Si no encontramos texto, buscarlo en periodos guardados
        if (!textoPeriodoActivo && periodos.length) {
            const match = periodos.find(p => p.value === periodoActivo);
            if (match) textoPeriodoActivo = match.label;
        }

        // ── 3. Ocultar cuerpo legacy ──
        document.body.style.backgroundImage = 'none';
        ocultarLegacy();

        // ── 4. Construir UI moderna ──
        const wrap = document.createElement('div');
        wrap.id = 'cfs-wrap';

        // 4a. Nav de periodos (sólo si tenemos más de 1 periodo)
        if (periodos.length > 1) {
            wrap.appendChild(construirNavPeriodos(periodos, periodoActivo));
        }

        // 4b. Encabezado del periodo activo
        wrap.appendChild(construirHeader(textoPeriodoActivo));

        // 4c. Tabla de calificaciones
        const tablaLegacy = document.querySelector('table[width="94%"]');
        if (tablaLegacy) {
            wrap.appendChild(construirTabla(tablaLegacy));
        }

        document.body.appendChild(wrap);

        log('Control de calificaciones iniciado');
    }

    function ocultarLegacy() {
        // Ocultar todos los hijos directos del body excepto el form
        const selectores = [
            'table[width="97%"]',
            'table[width="70%"]',
        ];
        selectores.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
        });

        // Ocultar texto suelto y <br> del form
        const form = document.querySelector('form[name="mi_forma"]');
        if (form) {
            Array.from(form.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) return; // ignorar texto plano
                const tag = node.tagName?.toUpperCase();
                if (tag === 'B' || tag === 'BR' || tag === 'CENTER') {
                    node.style && (node.style.display = 'none');
                }
            });
        }
    }

    function construirNavPeriodos(periodos, valorActivo) {
        const nav = document.createElement('nav');
        nav.id = 'cfs-period-nav';

        const label = document.createElement('span');
        label.className = 'cfs-nav-label';
        label.textContent = 'Periodo:';
        nav.appendChild(label);

        const pillsWrap = document.createElement('div');
        pillsWrap.className = 'cfs-nav-pills';

        periodos.forEach(p => {
            const pill = document.createElement('button');
            pill.className = 'cfs-nav-pill';
            pill.type = 'button';
            // Corrección aquí: La función abreviarPeriodo ahora devolverá un guion estándar (-)
            pill.textContent = abreviarPeriodo(p.label);
            pill.title = p.label; // tooltip con nombre completo
            if (p.value === valorActivo) pill.classList.add('activo');

            pill.addEventListener('click', () => {
                // Cambiar el value del hidden input y hacer submit
                const form = document.querySelector('form[name="mi_forma"]');
                if (!form) return;

                // Guardar nuevo periodo activo
                try {
                    sessionStorage.setItem('siase-periodo-activo', p.value);
                } catch (_) { }

                // Actualizar o crear el hidden HTMLPeriodo
                let hiddenPeriodo = form.querySelector('input[name="HTMLPeriodo"]');
                if (!hiddenPeriodo) {
                    hiddenPeriodo = document.createElement('input');
                    hiddenPeriodo.type = 'hidden';
                    hiddenPeriodo.name = 'HTMLPeriodo';
                    form.appendChild(hiddenPeriodo);
                }
                hiddenPeriodo.value = p.value;
                form.HTMLTrund.value = 'econcfs02';
                form.submit();
            });

            pillsWrap.appendChild(pill);
        });

        nav.appendChild(pillsWrap);
        return nav;
    }

    function construirHeader(textoPeriodo) {
        const header = document.createElement('div');
        header.id = 'cfs-header';

        const titulo = document.createElement('div');
        titulo.className = 'cfs-titulo';
        titulo.textContent = 'Consulta de Calificaciones';
        header.appendChild(titulo);

        if (textoPeriodo) {
            const periodoEl = document.createElement('div');
            periodoEl.className = 'cfs-periodo-activo';
            periodoEl.innerHTML = 'Periodo activo: <span>' + limpiarTexto(textoPeriodo) + '</span>';
            header.appendChild(periodoEl);
        }

        return header;
    }

    function construirTabla(tablaLegacy) {
        const tableWrap = document.createElement('div');
        tableWrap.id = 'cfs-table-wrap';

        // Clonar la tabla legacy para no romper el DOM original
        const tabla = tablaLegacy.cloneNode(true);
        tabla.removeAttribute('width');
        tabla.removeAttribute('align');
        tabla.removeAttribute('border');
        tabla.removeAttribute('cellspacing');
        tabla.removeAttribute('cellpadding');

        // Limpiar celdas de datos: quitar <font> anidados, mantener texto
        Array.from(tabla.querySelectorAll('td')).forEach(td => {
            td.removeAttribute('bgcolor');
            td.removeAttribute('align');
            td.removeAttribute('width');
            td.removeAttribute('height');

            // Desenvolver <font> tags
            td.querySelectorAll('font').forEach(font => {
                const parent = font.parentNode;
                while (font.firstChild) parent.insertBefore(font.firstChild, font);
                parent.removeChild(font);
            });

            // Limpiar <div> y <p> anidados innecesarios
            td.querySelectorAll('div, p').forEach(el => {
                const parent = el.parentNode;
                while (el.firstChild) parent.insertBefore(el.firstChild, el);
                parent.removeChild(el);
            });
        });

        // Quitar &nbsp; sobrantes en texto
        Array.from(tabla.querySelectorAll('td')).forEach(td => {
            if (td.textContent.trim() === '\u00a0' || td.textContent.trim() === '') {
                // Corrección aquí: Reemplazado el em-dash (—) por un guion estándar (-)
                td.textContent = '-';
            }
        });

        // Añadir clases a filas alternas (las que tenían bgcolor)
        let altIndex = 0;
        Array.from(tabla.querySelectorAll('tr')).forEach((tr, i) => {
            if (i === 0) return; // encabezado
            tr.className = altIndex % 2 === 0 ? 'cfs-row-base' : 'cfs-row-alt';
            altIndex++;
        });

        tableWrap.appendChild(tabla);
        return tableWrap;
    }

    // ── Helpers ──

    function abreviarPeriodo(label) {
        // "Semestral Enero - Junio 2026" → "Ene-Jun 2026"
        // "Semestral Agosto-Diciembre 2025" → "Ago-Dic 2025"
        const meses = {
            'enero': 'Ene', 'febrero': 'Feb', 'marzo': 'Mar', 'abril': 'Abr',
            'mayo': 'May', 'junio': 'Jun', 'julio': 'Jul', 'agosto': 'Ago',
            'septiembre': 'Sep', 'octubre': 'Oct', 'noviembre': 'Nov', 'diciembre': 'Dic'
        };
        const anioMatch = label.match(/\d{4}/);
        const anio = anioMatch ? anioMatch[0] : '';
        const lower = label.toLowerCase();
        const encontrados = Object.entries(meses)
            .filter(([k]) => lower.includes(k))
            .map(([, v]) => v);

        // Corrección aquí: Reemplazado el en-dash (–) por un guion estándar (-)
        if (encontrados.length >= 2) return encontrados[0] + '-' + encontrados[1] + ' ' + anio;

        if (encontrados.length === 1) return encontrados[0] + ' ' + anio;
        return label.replace('Semestral ', '').trim();
    }

    function limpiarTexto(t) {
        return t.replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim();
    }

    function log(msg) {
        console.log(
            '%c✦ SIASE+ Calificaciones %c' + msg,
            'background:#007bff;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px',
            'background:#0b1121;color:#82b1ff;padding:2px 6px;border-radius:0 4px 4px 0'
        );
    }

})();