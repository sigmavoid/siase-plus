// kardex.js — SIASE+ Kardex
// Responsabilidades:
//   1. Sincronizar tema claro/oscuro con canal compartido (igual que maincenter).
//   2. Centrar y modernizar la tabla del kardex.
//   3. Calcular e insertar indicadores de Promedio Normal y General.
//   4. Insertar barra de progreso de créditos debajo del bloque TOTAL.
//
// CORRECCIONES v2:
//   - FIX: reparación de encoding latin-1→UTF-8 en textos extraídos del DOM.
//   - FIX: dark mode completo — variables CSS en cascada correcta.
//   - FIX: sección de totales visible con scroll (padding-bottom en wrap).

(function refactorKardex() {

    document.title = 'SIASE+ | Kardex';

    // ══════════════════════════════════════════════════════════════
    // 0. TEMA — mismo canal que maincenter
    // ══════════════════════════════════════════════════════════════
    const TEMA_KEY = 'siase-tema';

    function leerTema() {
        try { return localStorage.getItem(TEMA_KEY); } catch (_) { return null; }
    }

    function aplicarTema(esOscuro) {
        document.documentElement.classList.toggle('dark-mode', esOscuro);
        document.body.classList.toggle('dark-mode', esOscuro);
    }

    const initEsOscuro = (() => {
        const g = leerTema();
        if (g) return g === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    })();
    aplicarTema(initEsOscuro);

    window.addEventListener('message', (e) => {
        if (e.data?.siaseTema) aplicarTema(e.data.siaseTema === 'dark');
    });
    window.addEventListener('storage', (e) => {
        if (e.key !== TEMA_KEY || !e.newValue) return;
        aplicarTema(e.newValue === 'dark');
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!leerTema()) aplicarTema(e.matches);
    });

    // ══════════════════════════════════════════════════════════════
    // UTIL: Reparar encoding latin-1 interpretado como UTF-8
    // SIASE devuelve páginas en ISO-8859-1; cuando el navegador las
    // trata como UTF-8 los caracteres especiales aparecen mojibake
    // (ej. "é" → "Ã©", "ó" → "Ã³", "ú" → "Ãº").
    // Esta función decodifica ese mojibake de vuelta a UTF-8 correcto.
    // ══════════════════════════════════════════════════════════════
    function fixEncoding(str) {
        if (!str) return str;
        try {
            // Convertir la cadena mojibake (latin-1 bytes leídos como UTF-8)
            // de vuelta a los bytes originales y luego a UTF-8 real.
            return decodeURIComponent(
                Array.from(str).map(c => {
                    const code = c.charCodeAt(0);
                    // Solo los caracteres en rango latin-1 extendido necesitan fix
                    if (code > 127 && code < 256) {
                        return '%' + code.toString(16).toUpperCase().padStart(2, '0');
                    }
                    return encodeURIComponent(c);
                }).join('')
            );
        } catch (_) {
            // Si falla el decode, devolver la cadena original sin romper
            return str;
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 1. INIT — esperar DOM
    // ══════════════════════════════════════════════════════════════
    function init() {
        // Guard: el observer puede llamar init() milisegundos después de que
        // el frame se descarte; abortar silenciosamente si el contexto murió.
        if (!contextoValido()) return;

        // ── 1a. Extraer datos del encabezado ──
        let alumno = '', carrera = '', plan = '';

        // parseHeader: extrae los tres campos de cualquier bloque de texto
        // usando anchors entre etiquetas para no depender de saltos de línea.
        // Funciona tanto si vienen en un texto continuo como separados.
        function parseHeader(t) {
            t = fixEncoding(t || '');
            // Alumno: todo entre "Alumno :" y la siguiente etiqueta conocida
            if (!alumno) {
                const m = t.match(/Alumno\s*:\s*(.+?)(?=Carrera\s*:|Plan de Estudio\s*:|Consulta|$)/i);
                if (m) alumno = m[1].trim();
            }
            // Carrera: todo entre "Carrera :" y la siguiente etiqueta
            if (!carrera) {
                const m = t.match(/Carrera\s*:\s*(.+?)(?=Plan de Estudio\s*:|Alumno\s*:|Consulta|$)/i);
                if (m) carrera = m[1].trim();
            }
            // Plan: dígitos tras "Plan de Estudio :"
            if (!plan) {
                const m = t.match(/Plan de Estudio\s*:\s*(\S+)/i);
                if (m) plan = m[1].trim();
            }
        }

        // Paso 1 — selector original
        document.querySelectorAll('font[color="#000000"]').forEach(f => parseHeader(f.textContent));

        // Paso 2 — fallback ampliado si algún campo faltó
        if (!alumno || !carrera || !plan) {
            const candidatos = document.querySelectorAll('font[size="2"], font, td, div, p');
            for (const el of candidatos) {
                parseHeader(el.textContent);
                if (alumno && carrera && plan) break;
            }
        }

        // ── 1b. Identificar la tabla del kardex (≥ 11 columnas) ──
        let kardexTable = null;
        document.querySelectorAll('table').forEach(tbl => {
            const firstDataRow = tbl.querySelector('tr:nth-child(2)');
            if (firstDataRow && firstDataRow.querySelectorAll('td').length >= 11) {
                kardexTable = tbl;
            }
        });

        if (!kardexTable) {
            console.warn('SIASE+ Kardex: no se encontró la tabla del kardex');
            return;
        }

        // ── 1c. Calcular promedios ──
        // Col 5  → 1ª oportunidad  (índice 4)  — Promedio NORMAL (aprobadas ≥ 70)
        // Col 6–10 → 2ª–6ª oportunidad (índices 5–9)
        // Col 11 → Labs (índice 10)             — incluida en AMBOS promedios
        const rows = Array.from(kardexTable.querySelectorAll('tr')).slice(1);

        let sumaNormal = 0, countNormal = 0;
        let sumaGeneral = 0, countGeneral = 0;

        rows.forEach(row => {
            const tds = row.querySelectorAll('td');
            if (tds.length < 11) return;

            function val(td) {
                const t = td.textContent.replace(/\u00a0/g, '').trim();
                const n = parseFloat(t);
                return isNaN(n) ? null : n;
            }

            const c5 = val(tds[4]);   // 1ª oportunidad
            const c11 = val(tds[10]);  // Labs

            // Promedio NORMAL: 1ª opo aprobada + labs aprobados
            if (c5 !== null && c5 >= 70) { sumaNormal += c5; countNormal++; }
            if (c11 !== null && c11 >= 70) { sumaNormal += c11; countNormal++; }

            // Promedio GENERAL: todas las oportunidades (cols 5–10) + labs
            for (let i = 4; i <= 9; i++) {
                const cv = val(tds[i]);
                if (cv !== null) { sumaGeneral += cv; countGeneral++; }
            }
            if (c11 !== null) { sumaGeneral += c11; countGeneral++; }
        });

        const promNormal = countNormal > 0 ? (sumaNormal / countNormal).toFixed(2) : '—';
        const promGeneral = countGeneral > 0 ? (sumaGeneral / countGeneral).toFixed(2) : '—';

        // ── 1d. Extraer créditos del bloque TOTAL ──
        // Buscamos font[size="3"] en TODO el documento EXCEPTO dentro de
        // kardexTable, para evitar falsos positivos de la tabla de calificaciones.
        // También incluimos los que sí están en kardexTable por si SIASE
        // los mezcla ahí, pero filtrando por patrón "X de Y".
        const creditoLines = [];
        let creditoCompletado = 0, creditoTotal = 0;

        document.querySelectorAll('font[size="3"]').forEach(f => {
            const txt = fixEncoding(f.textContent.trim());
            // El patrón "Label : N de M" identifica líneas de créditos
            const match = txt.match(/(.+?)\s*:\s*(\d+)\s*de\s*(\d+)/);
            if (match) {
                const label = match[1].trim().replace(/\s+/g, ' ');
                const obt = parseInt(match[2]);
                const tot = parseInt(match[3]);
                const isTotal = /^TOTAL/i.test(label.replace(/[.\s]/g, ''));
                creditoLines.push({ label, obtenidos: obt, total: tot, isTotal });
                if (isTotal) { creditoCompletado = obt; creditoTotal = tot; }
            }
        });

        // Si el selector font[size] no encontró nada (SIASE cambia el markup),
        // intentar extraer desde texto plano de divs que contengan 'de'
        if (creditoLines.length === 0) {
            document.querySelectorAll('div, td, p').forEach(el => {
                // Saltar si el elemento es parte de la tabla de calificaciones
                if (kardexTable && kardexTable.contains(el)) return;
                const txt = fixEncoding(el.textContent.trim());
                const match = txt.match(/^(.+?)\s*:\s*(\d+)\s*de\s*(\d+)\s*$/);
                if (match) {
                    const label = match[1].trim().replace(/\s+/g, ' ');
                    const obt = parseInt(match[2]);
                    const tot = parseInt(match[3]);
                    const isTotal = /^TOTAL/i.test(label.replace(/[.\s]/g, ''));
                    creditoLines.push({ label, obtenidos: obt, total: tot, isTotal });
                    if (isTotal) { creditoCompletado = obt; creditoTotal = tot; }
                }
            });
        }

        const pctCreditos = creditoTotal > 0
            ? Math.round((creditoCompletado / creditoTotal) * 100)
            : 0;

        // ── 1e. Nota al pie — texto fijo ──
        const notaFooter = 'NOTA: Si cursas una materia de LE con laboratorio, este es obligatorio aunque ya estes cumpliendo con los 220 créditos.';

        // ── 1f. Preservar hidden inputs ──
        const form = document.querySelector('form');
        const hiddenInputs = form
            ? Array.from(form.querySelectorAll('input[type="hidden"]'))
            : [];

        // ══════════════════════════════════════════════════════════
        // 2. RECONSTRUIR EL BODY
        // ══════════════════════════════════════════════════════════
        document.body.innerHTML = '';
        document.querySelector("body").setAttribute("background", "");

        // Hidden inputs
        const fakeForm = mk('div', { style: 'display:none' });
        hiddenInputs.forEach(i => fakeForm.appendChild(i.cloneNode()));
        document.body.appendChild(fakeForm);

        const wrap = mk('div', { id: 'kdx-wrap' });

        // ── 2a. Encabezado del alumno ──
        if (alumno || carrera) {
            const hdr = mk('div', { id: 'kdx-header' });
            if (alumno) {
                const a = mk('div', { className: 'kdx-alumno' });
                a.textContent = alumno;
                hdr.appendChild(a);
            }
            const meta = mk('div', { className: 'kdx-meta' });
            if (carrera) {
                const c = mk('span');
                c.innerHTML = `<b>Carrera:</b> ${carrera}`;
                meta.appendChild(c);
            }
            if (plan) {
                const p = mk('span');
                p.innerHTML = `<b>Plan:</b> ${plan}`;
                meta.appendChild(p);
            }
            hdr.appendChild(meta);
            wrap.appendChild(hdr);
        }

        // ── 2b. Título de sección ──
        const sectionTitle = mk('h2', { className: 'kdx-section-title' });
        sectionTitle.textContent = 'Consulta de Kardex';
        wrap.appendChild(sectionTitle);

        // ── 2c. Indicadores de promedio ──
        const promGrid = mk('div', { id: 'kdx-promedios' });

        const cardNormal = mk('div', { className: 'kdx-prom-card kdx-prom-card--normal' });
        const lblN = mk('div', { className: 'kdx-prom-label' }); lblN.textContent = 'Promedio Normal';
        const valN = mk('div', { className: 'kdx-prom-value' }); valN.textContent = promNormal;
        const subN = mk('div', { className: 'kdx-prom-sub' });
        subN.textContent = `1\u00aa oportunidad + laboratorios aprobados \u00b7 ${countNormal} calificaciones`;
        cardNormal.append(lblN, valN, subN);

        const cardGeneral = mk('div', { className: 'kdx-prom-card kdx-prom-card--general' });
        const lblG = mk('div', { className: 'kdx-prom-label' }); lblG.textContent = 'Promedio General';
        const valG = mk('div', { className: 'kdx-prom-value' }); valG.textContent = promGeneral;
        const subG = mk('div', { className: 'kdx-prom-sub' });
        subG.textContent = `Todas las oportunidades incluyendo reprobatorias \u00b7 ${countGeneral} registros`;
        cardGeneral.append(lblG, valG, subG);

        promGrid.append(cardNormal, cardGeneral);
        wrap.appendChild(promGrid);

        // ── 2d. Tabla del kardex ──
        const tableWrap = mk('div', { id: 'kdx-table-wrap' });
        kardexTable.removeAttribute('width');
        kardexTable.removeAttribute('align');
        kardexTable.removeAttribute('cellspacing');
        kardexTable.removeAttribute('cellpadding');
        kardexTable.removeAttribute('border');

        // Eliminar atributos inline color/face de <font> de SIASE.
        // Son atributos de presentación que pisan cualquier CSS;
        // al quitarlos, las clases que añadimos abajo toman el control.
        kardexTable.querySelectorAll('font').forEach(f => {
            f.removeAttribute('color');
            f.removeAttribute('face');
            f.style.fontFamily = '"Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif';
        });

        // Fila de encabezado (tr:first-child, td 1-11): siempre blanco
        const headerRow = kardexTable.querySelector('tr:first-child');
        if (headerRow) {
            headerRow.querySelectorAll('td font, th font').forEach(f => {
                f.classList.add('kdx-font-header');
            });
        }

        // Filas de datos: clase para color controlado por tema vía CSS
        Array.from(kardexTable.querySelectorAll('tr')).slice(1).forEach(row => {
            row.querySelectorAll('td font, th font').forEach(f => {
                f.classList.add('kdx-font-data');
            });
        });

        tableWrap.appendChild(kardexTable);
        wrap.appendChild(tableWrap);

        // ── 2e. Bloque de totales + barra de créditos ──
        const totalesCard = mk('div', { id: 'kdx-totales' });

        const totTitle = mk('div', { className: 'kdx-totales-title' });
        // FIX: texto hardcodeado en JS para evitar mojibake del DOM
        totTitle.textContent = 'Total de Cr\u00e9ditos por Formaci\u00f3n Curricular';
        totalesCard.appendChild(totTitle);

        creditoLines.forEach(({ label, obtenidos, total, isTotal }) => {
            const row = mk('div', {
                className: 'kdx-credito-row' + (isTotal ? ' kdx-credito-row--total' : '')
            });
            const lbl = mk('span', { className: 'kdx-cr-label' });
            // FIX: limpiar puntos de relleno y aplicar encoding fix
            lbl.textContent = label.replace(/\s*\.+\s*/g, ' ').trim();
            const val = mk('span', { className: 'kdx-cr-val' });
            val.textContent = `${obtenidos} / ${total}`;
            row.append(lbl, val);
            totalesCard.appendChild(row);
        });

        // Barra de progreso de créditos
        if (creditoTotal > 0) {
            const progWrap = mk('div', { id: 'kdx-progress-wrap' });

            const progHeader = mk('div', { id: 'kdx-progress-header' });
            const progLabel = mk('span', { className: 'kdx-prog-label' });
            progLabel.textContent = 'Progreso de cr\u00e9ditos';
            const progPct = mk('span', { className: 'kdx-prog-pct' });
            progPct.textContent = `${pctCreditos}%`;
            progHeader.append(progLabel, progPct);

            const track = mk('div', { id: 'kdx-progress-track' });
            const fill = mk('div', { id: 'kdx-progress-fill' });
            track.appendChild(fill);

            const sub = mk('div', { id: 'kdx-progress-sub' });
            sub.textContent = `${creditoCompletado} de ${creditoTotal} cr\u00e9ditos completados`;

            progWrap.append(progHeader, track, sub);
            totalesCard.appendChild(progWrap);

            // Animar la barra al cargar
            requestAnimationFrame(() => {
                setTimeout(() => { fill.style.width = pctCreditos + '%'; }, 120);
                try {
                    console.log(`SIASE+ Kardex: barra de progreso animada a ${pctCreditos}%`);
                } catch (e) {
                    console.error('SIASE+ Kardex: Error al registrar la animación de la barra de progreso');
                }
            });
        }

        if (notaFooter.trim()) {
            const nota = mk('p', { style: 'margin-top:14px;font-size:11.5px;color:var(--texto-terciario)' });
            nota.textContent = notaFooter.trim();
            totalesCard.appendChild(nota);
        }

        wrap.appendChild(totalesCard);
        document.body.appendChild(wrap);

        console.log(
            '%c\u2756 SIASE+ Kardex %cactivo',
            'background:#007bff;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px',
            'background:#0b1121;color:#82b1ff;padding:2px 6px;border-radius:0 4px 4px 0'
        );
    }

    // ══════════════════════════════════════════════════════════════
    // UTIL — createElement helper
    // ══════════════════════════════════════════════════════════════
    function mk(tag, attrs = {}) {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'className') node.className = v;
            else if (k === 'style') node.style.cssText = v;
            else node.setAttribute(k, v);
        }
        return node;
    }

    // ══════════════════════════════════════════════════════════════
    // GUARD: verificar que el contexto de extensión sigue vivo
    // Cuando el frame se recarga y el service worker aún no se
    // reinicializó, chrome.runtime puede estar indefinido o lanzar.
    // ══════════════════════════════════════════════════════════════
    function contextoValido() {
        try {
            // Acceder a chrome.runtime.id lanza si el contexto expiró
            return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
        } catch (_) {
            return false;
        }
    }

    if (!contextoValido()) {
        // No logear el error — el contexto ya murió, cualquier API de extensión falla
        return;
    }

    // ══════════════════════════════════════════════════════════════
    // WAIT: esperar la tabla del kardex con MutationObserver + timeout
    // DOMContentLoaded no es suficiente en framesets de SIASE porque
    // el contenido real se inyecta dinámicamente después del parse.
    // ══════════════════════════════════════════════════════════════
    function tablaLista() {
        const tbls = document.querySelectorAll('table');
        for (const tbl of tbls) {
            const fila = tbl.querySelector('tr:nth-child(2)');
            if (fila && fila.querySelectorAll('td').length >= 11) return true;
        }
        return false;
    }

    function encabezadoListo() {
        // Considera listo cuando hay al menos un font con "Alumno"
        return !!Array.from(document.querySelectorAll('font, td'))
            .find(el => /Alumno\s*:/i.test(el.textContent));
    }

    function esperarContenido(callback, maxMs = 8000) {
        // Si ya está todo — ejecutar de inmediato
        if (tablaLista() && encabezadoListo()) {
            callback();
            return;
        }

        let resuelto = false;

        const observer = new MutationObserver(() => {
            if (resuelto) return;
            if (!contextoValido()) {
                observer.disconnect();
                resuelto = true;
                return;
            }
            if (tablaLista() && encabezadoListo()) {
                observer.disconnect();
                resuelto = true;
                clearTimeout(timer);
                callback();
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });

        // Fallback: si el observer nunca dispara (SIASE cargó sin mutaciones
        // visibles porque el HTML ya estaba ahí pero el script corrió primero),
        // reintentar cada 200 ms hasta maxMs.
        const inicio = Date.now();
        function poll() {
            if (resuelto) return;
            if (!contextoValido()) { resuelto = true; return; }
            if (tablaLista() && encabezadoListo()) {
                observer.disconnect();
                resuelto = true;
                clearTimeout(timer);
                callback();
                return;
            }
            if (Date.now() - inicio < maxMs) {
                setTimeout(poll, 200);
            } else {
                // Timeout: intentar con lo que haya (puede que falte el nombre
                // pero al menos se muestra la tabla si ya está)
                observer.disconnect();
                resuelto = true;
                if (tablaLista()) {
                    callback();
                } else {
                    console.warn('SIASE+ Kardex: no se encontró la tabla del kardex tras esperar', maxMs, 'ms');
                }
            }
        }

        // Arrancar polling en paralelo al observer
        const timer = setTimeout(poll, 300);
    }

    // Punto de entrada — espera DOM y luego contenido real
    function arrancar() {
        if (!contextoValido()) return;
        esperarContenido(init);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }

    console.log('SIASE+ Kardex: script inyectado, esperando contenido.');

})();