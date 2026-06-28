// horario.js — SIASE+
// Maneja: echalm01.htm → selector de periodo de horario
//
// Patrón idéntico a califs.js (iniciarSelector):
//  · Lee opciones del <select name="HTMLPeriodo">
//  · Guarda lista en sessionStorage para echalm02
//  · Auto-submit con la 1ª opción válida
//  · UI moderna como feedback visual durante el redirect

(function horarioSIASE() {

    // ──────────────────────────────────────────────
    // TEMA — mismo mecanismo que califs.js
    // ──────────────────────────────────────────────

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
    // DETECCIÓN — echalm01 tiene select[name="HTMLPeriodo"]
    // y el form hace submit a echalm02
    // ──────────────────────────────────────────────

    const url = window.location.href;
    const origenControl = (() => { try { return sessionStorage.getItem('siase-control-origen'); } catch (_) { return null; } })();

    const esSelector =
        url.includes('echalm01') ||
        (document.querySelector('select[name="HTMLPeriodo"]') !== null &&
            !url.includes('econcfs'));

    const esControl =
        url.includes('echalm02') ||
        url.includes('control.p') ||
        (origenControl === 'horario' && !url.includes('echalm01'));

    if (!esSelector && !esControl) return;

    if (esControl) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', iniciarControl);
        } else {
            iniciarControl();
        }
        return;
    }

    // Esperar a que el DOM esté listo (selector)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarSelector);
    } else {
        iniciarSelector();
    }

    // ══════════════════════════════════════════════
    // SELECTOR DE PERIODO
    // ══════════════════════════════════════════════

    function iniciarSelector() {
        if (document.getElementById('hrr-selector-wrap')) return; // ya montado

        const select = document.querySelector('select[name="HTMLPeriodo"]');
        const form = document.querySelector('form[name="mi_forma"]');
        if (!select || !form) return;

        // Opciones válidas (descartar value "0" / "Selecciona")
        const opciones = Array.from(select.options).filter(o => o.value && o.value !== '0');
        if (!opciones.length) return;

        // ── Guardar periodos en sessionStorage para echalm02 ──
        const primeraOpcion = opciones[0];
        select.value = primeraOpcion.value;

        try {
            const periodos = opciones.map(o => ({
                value: o.value,
                label: o.text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
            }));
            sessionStorage.setItem('siase-hrr-periodos', JSON.stringify(periodos));
            sessionStorage.setItem('siase-hrr-periodo-activo', primeraOpcion.value);
            sessionStorage.setItem('siase-control-origen', 'horario');
        } catch (_) { }

        // ── Construir UI moderna ──
        construirUI(opciones, primeraOpcion.value, select, form);

        // ── Auto-submit con la 1ª opción válida ──
        form.HTMLTrund.value = 'echalm02';
        // form.submit(); // descomentar para activar auto-submit
    }

    function construirUI(opciones, valorActivo, select, form) {
        // Ocultar contenido legacy del body
        document.body.style.backgroundImage = 'none';
        Array.from(document.body.children).forEach(el => {
            if (!el.id?.startsWith('hrr-')) el.style.display = 'none';
        });

        // ── Contenedor raíz ──
        const wrap = document.createElement('div');
        wrap.id = 'hrr-selector-wrap';

        // ── Tarjeta ──
        const card = document.createElement('div');
        card.id = 'hrr-selector-card';

        const titulo = document.createElement('h2');
        titulo.textContent = 'Consulta de Horario';
        card.appendChild(titulo);

        // ── Lista de periodos ──
        const lista = document.createElement('ul');
        lista.id = 'hrr-periodo-list';

        opciones.forEach(op => {
            const etiqueta = op.text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = etiqueta;
            btn.dataset.value = op.value;
            if (op.value === valorActivo) btn.classList.add('activo');

            btn.addEventListener('click', () => {
                // Marcar activo visualmente
                lista.querySelectorAll('button').forEach(b => b.classList.remove('activo'));
                btn.classList.add('activo');

                // Actualizar select subyacente
                select.value = op.value;

                // Persistir selección
                try {
                    sessionStorage.setItem('siase-hrr-periodo-activo', op.value);
                    const periodos = opciones.map(o => ({
                        value: o.value,
                        label: o.text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
                    }));
                    sessionStorage.setItem('siase-hrr-periodos', JSON.stringify(periodos));
                    sessionStorage.setItem('siase-control-origen', 'horario');
                } catch (_) { }

                // Submit hacia echalm02
                form.HTMLTrund.value = 'echalm02';
                form.submit();
            });

            li.appendChild(btn);
            lista.appendChild(li);
        });

        card.appendChild(lista);

        // ── Botón Aceptar explícito ──
        // const btnAceptar = document.createElement('button');
        // btnAceptar.id = 'hrr-btn-aceptar';
        // btnAceptar.type = 'button';
        // btnAceptar.textContent = 'Aceptar';

        // btnAceptar.addEventListener('click', () => {
        //     const activo = lista.querySelector('button.activo');
        //     if (!activo) return;

        //     select.value = activo.dataset.value;
        //     try {
        //         sessionStorage.setItem('siase-hrr-periodo-activo', activo.dataset.value);
        //     } catch (_) { }

        //     form.HTMLTrund.value = 'echalm02';
        //     form.submit();
        // });

        // card.appendChild(btnAceptar);
        wrap.appendChild(card);
        document.body.appendChild(wrap);
    }

    // ══════════════════════════════════════════════
    // IMPLEMENTACIÓN B — CONTROL (tabla de horario, echalm02 / control.p)
    // ══════════════════════════════════════════════

    function iniciarControl() {
        if (document.getElementById('hrr-wrap')) return;

        const mainContainer = document.getElementById('main-container');
        if (!mainContainer) return;

        log('Control de horario detectado');

        // ── 1. Estilos ── definidos en horario.css (migrados)

        // ── 2. Ocultar todo el contenido legacy ─────────────────────────
        Array.from(mainContainer.children).forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });

        // ── 3. Extraer datos del DOM legacy ─────────────────────────────

        // 3a. Info del alumno (encabezado)
        const infoRows = [];
        mainContainer.querySelectorAll('.container-fluid .row .col-12.col-sm-8 div').forEach(d => {
            const t = d.innerHTML.trim();
            if (t) infoRows.push(t);
        });
        const fechaEl = mainContainer.querySelector('.col-12.col-sm-4 .text-end b');
        const fechaStr = fechaEl ? fechaEl.textContent.trim() : '';

        // 3b. Tabla de horario semanal
        const tablaHorario = mainContainer.querySelector('table:first-of-type');

        // 3c. Tabla de materias (Nomenclatura de Materias)
        const tablasMaterias = mainContainer.querySelectorAll('table');
        let tablaMaterias = null, tablaHoras = null;
        tablasMaterias.forEach(t => {
            const headers = Array.from(t.querySelectorAll('th')).map(th => th.textContent.trim());
            if (headers.some(h => h.includes('Materia') && h.length < 15)) tablaMaterias = t;
            if (headers.some(h => h.includes('Presenciales'))) tablaHoras = t;
        });

        // 3d. Alertas
        const alertaEls = mainContainer.querySelectorAll('.msg.alert');
        const alertas = Array.from(alertaEls).map(a => {
            const clone = a.cloneNode(true);
            // Quitar icono FA legacy
            clone.querySelectorAll('i').forEach(i => i.remove());
            return clone.textContent.trim();
        }).filter(Boolean);

        // 3e. Periodos desde sessionStorage
        let periodos = [];
        let periodoActivo = '';
        try {
            const raw = sessionStorage.getItem('siase-hrr-periodos');
            if (raw) periodos = JSON.parse(raw);
            periodoActivo = sessionStorage.getItem('siase-hrr-periodo-activo') || '';
        } catch (_) { }

        // ── 4. Construir la UI ───────────────────────────────────────────
        const wrap = document.createElement('div');
        wrap.id = 'hrr-wrap';

        // ── 4a. Nav de periodos ──────────────────────────────────────────
        if (periodos.length > 1) {
            const nav = document.createElement('div');
            nav.id = 'hrr-periodo-nav';

            const label = document.createElement('span');
            label.textContent = 'Periodo:';
            nav.appendChild(label);

            const form = mainContainer.querySelector('form[name="mi_forma"]');

            periodos.forEach(p => {
                const btn = document.createElement('button');
                btn.className = 'hrr-nav-btn' + (p.value === periodoActivo ? ' activo' : '');
                btn.type = 'button';
                btn.textContent = p.label;
                btn.addEventListener('click', () => {
                    try {
                        sessionStorage.setItem('siase-hrr-periodo-activo', p.value);
                    } catch (_) { }
                    if (form) {
                        const inputPeriodo = form.querySelector('input[name="HTMLPeriodo"]');
                        if (inputPeriodo) inputPeriodo.value = p.value;
                        form.HTMLTrund.value = 'echalm02';
                        form.submit();
                    }
                });
                nav.appendChild(btn);
            });

            wrap.appendChild(nav);
        }

        // ── 4b. Tarjeta encabezado ───────────────────────────────────────
        const headerCard = document.createElement('div');
        headerCard.id = 'hrr-header-card';
        headerCard.className = 'hrr-card';

        // Info lado izquierdo
        const headerInfo = document.createElement('div');
        headerInfo.id = 'hrr-header-info';

        const titleWrap = document.createElement('div');
        titleWrap.id = 'hrr-header-title';
        const h2 = document.createElement('h2');
        h2.textContent = 'Consulta de Horario';
        titleWrap.appendChild(h2);
        headerInfo.appendChild(titleWrap);

        infoRows.forEach(html => {
            const row = document.createElement('div');
            row.className = 'hrr-info-row';

            // Limpiar estilos legacy que centren o desalineen el texto
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            tmp.querySelectorAll('[style]').forEach(el => {
                el.style.textAlign = 'left';
                el.style.display = 'inline';
            });
            tmp.querySelectorAll('[class*="text-center"], [class*="text-end"]').forEach(el => {
                el.classList.remove('text-center', 'text-end');
            });
            row.innerHTML = tmp.innerHTML;
            row.id = 'hrr-periodo-actual';
            headerInfo.appendChild(row);
        });

        headerCard.appendChild(headerInfo);

        // Acciones lado derecho
        const actions = document.createElement('div');
        actions.id = 'hrr-header-actions';

        if (fechaStr) {
            const dateSpan = document.createElement('span');
            dateSpan.style.cssText = 'font-size:12px;color:var(--texto-terciario);align-self:center;';
            dateSpan.textContent = fechaStr;
            actions.appendChild(dateSpan);
        }

        // Botón Guardar imagen
        const btnImprimir = document.createElement('button');
        btnImprimir.className = 'hrr-action-btn primary';
        btnImprimir.type = 'button';
        btnImprimir.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Guardar imagen`;

        btnImprimir.addEventListener('click', async () => {
            // Cargar html2canvas dinámicamente si aún no está disponible
            if (!window.html2canvas) {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    s.onload = resolve;
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            }

            // Nombre del archivo con el periodo activo
            let nombrePeriodo = 'horario';
            try {
                const pActivo = sessionStorage.getItem('siase-hrr-periodo-activo');
                const pRaw = sessionStorage.getItem('siase-hrr-periodos');
                if (pRaw && pActivo) {
                    const lista = JSON.parse(pRaw);
                    const match = lista.find(p => p.value === pActivo);
                    if (match) nombrePeriodo = match.label.replace(/[\s-]+/g, '-').toLowerCase();
                }
            } catch (_) { }
            const nombreArchivo = `horario-${nombrePeriodo}.jpg`;

            // Elemento a capturar
            const objetivo = document.querySelector("#hrr-wrap > div:nth-child(3)")
            if (!objetivo) return;

            // Estado visual del botón durante la captura
            const textoOriginal = btnImprimir.innerHTML;
            btnImprimir.disabled = true;
            btnImprimir.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Generando\u2026`;

            try {
                const canvas = await html2canvas(objetivo, {
                    scale: 2,                          // mayor resolución
                    useCORS: true,
                    backgroundColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--bg-surface-2').trim() || '#f8fafc',
                    logging: false,
                    scrollX: 0,
                    scrollY: -window.scrollY
                });

                // Convertir a JPEG y descargar
                canvas.toBlob(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = nombreArchivo;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                }, 'image/jpeg', 0.92);

            } catch (err) {
                console.error('SIASE+ error al generar imagen:', err);
                alert('No se pudo generar la imagen. Intenta de nuevo.');
            } finally {
                btnImprimir.disabled = false;
                btnImprimir.innerHTML = textoOriginal;
            }
        });
        actions.appendChild(btnImprimir);

        const btnPrint = document.createElement('button');
        btnPrint.className = 'hrr-action-btn primary';
        btnPrint.type = 'button';
        btnPrint.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Guardar PDF`;

        btnPrint.addEventListener('click', async () => {
            // Cargar html2canvas
            if (!window.html2canvas) {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    s.onload = resolve; s.onerror = reject;
                    document.head.appendChild(s);
                });
            }
            // Cargar jsPDF
            if (!window.jspdf) {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                    s.onload = resolve; s.onerror = reject;
                    document.head.appendChild(s);
                });
            }

            const textoOriginal = btnPrint.innerHTML;
            btnPrint.disabled = true;
            btnPrint.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Generando\u2026`;

            try {
                const { jsPDF } = window.jspdf;
                const bgColor = document.body.classList.contains('dark-mode') ? '#0f1829' : '#f8fafc';
                const cards = [
                    wrap.querySelector(':scope > div:nth-child(3)'),
                    wrap.querySelector(':scope > div:nth-child(4)')
                ].filter(Boolean);

                // Capturar cada card
                const capturas = await Promise.all(
                    Array.from(cards).map(card =>
                        html2canvas(card, {
                            scale: 2,
                            useCORS: true,
                            backgroundColor: bgColor,
                            logging: false,
                            scrollX: 0,
                            scrollY: -window.scrollY
                        })
                    )
                );

                // Nombre del archivo con periodo activo
                let nombrePeriodo = 'horario';
                try {
                    const pActivo = sessionStorage.getItem('siase-hrr-periodo-activo');
                    const pRaw = sessionStorage.getItem('siase-hrr-periodos');
                    if (pRaw && pActivo) {
                        const lista = JSON.parse(pRaw);
                        const match = lista.find(p => p.value === pActivo);
                        if (match) nombrePeriodo = match.label.replace(/[\s-]+/g, '-').toLowerCase();
                    }
                } catch (_) { }

                // Crear PDF en orientación landscape para que la tabla de horario quepa mejor
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                const pdfW = pdf.internal.pageSize.getWidth();
                const pdfH = pdf.internal.pageSize.getHeight();
                const margin = 10;

                capturas.forEach((canvas, i) => {
                    if (i > 0) pdf.addPage();

                    const imgData = canvas.toDataURL('image/jpeg', 0.92);
                    const imgW = pdfW - margin * 2;
                    const imgH = (canvas.height / canvas.width) * imgW;

                    // Si la imagen es más alta que la página, escalarla para que entre
                    const maxH = pdfH - margin * 2;
                    const finalH = Math.min(imgH, maxH);
                    const finalW = imgH > maxH ? (canvas.width / canvas.height) * maxH : imgW;
                    const offsetX = margin + (imgW - finalW) / 2;

                    pdf.addImage(imgData, 'JPEG', offsetX, margin, finalW, finalH);
                });

                pdf.save(`${nombrePeriodo}.pdf`);

            } catch (err) {
                console.error('SIASE+ error al generar PDF:', err);
                alert('No se pudo generar el PDF. Intenta de nuevo.');
            } finally {
                btnPrint.disabled = false;
                btnPrint.innerHTML = textoOriginal;
            }
        });
        actions.appendChild(btnPrint);

        headerCard.appendChild(actions);
        wrap.appendChild(headerCard);

        // ── 4c. Tabla de horario semanal ────────────────────────────────

        // Construir mapa abrev → nombre completo desde la tabla de materias
        // Columna 2 = nombre, columna 3 = abreviación
        const mapaMateria = {};
        if (tablaMaterias) {
            tablaMaterias.querySelectorAll('tbody tr, tr').forEach((fila, idx) => {
                if (idx === 0) return;
                const celdas = fila.querySelectorAll('td');
                if (celdas.length >= 4) {
                    const nombre = celdas[2].textContent.trim();
                    const abrevKey = celdas[3].textContent.trim().toUpperCase();
                    if (abrevKey && nombre) mapaMateria[abrevKey] = nombre;
                }
            });
        }



        if (tablaHorario) {
            const tableCard = document.createElement('div');
            tableCard.className = 'hrr-card';

            const tableTitle = document.createElement('p');
            tableTitle.className = 'hrr-section-title';
            tableTitle.textContent = `Horario`;
            tableCard.appendChild(tableTitle);

            const tableWrap = document.createElement('div');
            tableWrap.className = 'hrr-table-wrap';

            // Reconstruir tabla moderna a partir de la original
            const nuevaTabla = document.createElement('table');
            nuevaTabla.className = 'hrr-table';

            // Encabezados — strings literales con acentos correctos
            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');
            const dias = ['Hora', 'Lunes', 'Martes', 'Mi\u00e9rcoles', 'Jueves', 'Viernes', 'S\u00e1bado'];
            dias.forEach(d => {
                const th = document.createElement('th');
                th.textContent = d;
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);
            nuevaTabla.appendChild(thead);

            // Helper: parsea el innerHTML de una celda de materia
            // Formato real: <b>F-01</b> / LB<br>VISIO<br>207<B> / </B>4111
            function parsearCeldaMateria(celda) {
                // Clonar para manipular sin tocar el DOM original
                const clone = celda.cloneNode(true);

                // Reemplazar <br> con separador de línea antes de extraer texto
                clone.querySelectorAll('br').forEach(br => {
                    br.replaceWith('\n');
                });

                // Obtener texto limpio usando textContent (preserva caracteres Unicode del DOM)
                const raw = clone.textContent
                    .replace(/\u00a0/g, ' ')   // nbsp → espacio
                    .replace(/[ \t]+/g, ' ')    // colapsar espacios/tabs
                    .trim();

                if (!raw || raw === '\u00a0' || raw === '-') return null;

                // Dividir por líneas
                const lineas = raw.split('\n').map(l => l.trim()).filter(Boolean);
                if (!lineas.length) return null;

                // Línea 0: "F-01 / LB"  o  "F-01 / CO"
                const lineaUno = lineas[0];
                const faseMatch = lineaUno.match(/F-\d+/);
                const tipoMatch = lineaUno.match(/\/\s*([A-Z0-9]+)\s*$/);

                // Línea 1: abreviación de materia (ej. "VISIO")
                const abrev = lineas[1] ? lineas[1].replace(/\s*\/\s*/g, '').trim() : '';

                // Línea 2: "207 / 4111" → grupo / salón
                const grupoSalon = lineas[2]
                    ? lineas[2].replace(/\s+/g, ' ').trim()
                    : '';

                return {
                    fase: faseMatch ? faseMatch[0] : '',
                    tipo: tipoMatch ? tipoMatch[1] : '',
                    abrev: abrev.toUpperCase(),
                    grupoSalon
                };
            }

            // Filas de datos
            const tbody = document.createElement('tbody');
            const filas = tablaHorario.querySelectorAll('tr');
            filas.forEach((fila, idx) => {
                if (idx === 0) return; // skip header original
                const celdas = fila.querySelectorAll('td');
                if (!celdas.length) return;

                const tr = document.createElement('tr');
                celdas.forEach((celda, ci) => {
                    const td = document.createElement('td');

                    if (ci === 0) {
                        // Hora — preservar salto de línea: "7:00 am a\n7:50 am"
                        const clone = celda.cloneNode(true);
                        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
                        const partes = clone.textContent
                            .replace(/\u00a0/g, ' ')
                            .split('\n')
                            .map(s => s.trim())
                            .filter(Boolean);
                        // partes[0] = "7:00 am a", partes[1] = "7:50 am"
                        td.innerHTML = partes.map(p =>
                            `<span style="display:block;white-space:nowrap">${p}</span>`
                        ).join('');
                        td.style.textAlign = 'center';
                    } else {
                        // Verificar si la celda tiene contenido real (más que solo &nbsp;)
                        const textoPlano = celda.textContent.replace(/\u00a0/g, '').trim();
                        if (!textoPlano) {
                            td.innerHTML = '<span style="color:var(--borde,#e2e8f0)">\u2014</span>';
                        } else {
                            const datos = parsearCeldaMateria(celda);
                            if (!datos) {
                                td.innerHTML = '<span style="color:var(--borde,#e2e8f0)">\u2014</span>';
                            } else {
                                const { fase, tipo, abrev, grupoSalon } = datos;
                                // Nombre completo desde mapa (buscar por abrev)
                                const nombreCompleto = mapaMateria[abrev] || '';

                                const div = document.createElement('div');
                                div.className = 'hrr-cell-materia';

                                // Fila superior: fase + tipo
                                const topRow = document.createElement('div');
                                topRow.className = 'hrr-cell-materia-top';
                                if (fase) {
                                    const faseSp = document.createElement('span');
                                    faseSp.className = 'hrr-fase';
                                    faseSp.textContent = fase;
                                    topRow.appendChild(faseSp);
                                }
                                if (tipo) {
                                    const tipoSp = document.createElement('span');
                                    tipoSp.className = 'hrr-tipo';
                                    tipoSp.textContent = tipo;
                                    topRow.appendChild(tipoSp);
                                }
                                if (topRow.children.length) div.appendChild(topRow);

                                // Abreviación
                                if (abrev) {
                                    const abrevSp = document.createElement('span');
                                    abrevSp.className = 'hrr-abrev';
                                    abrevSp.textContent = abrev;
                                    div.appendChild(abrevSp);
                                }

                                // Nombre completo de la materia
                                // if (nombreCompleto) {
                                //     const nombreSp = document.createElement('span');
                                //     nombreSp.className = 'hrr-nombre';
                                //     nombreSp.textContent = nombreCompleto;
                                //     div.appendChild(nombreSp);
                                // }

                                // Grupo / Salón
                                if (grupoSalon) {
                                    const salonSp = document.createElement('span');
                                    salonSp.className = 'hrr-salon';
                                    salonSp.textContent = grupoSalon;
                                    div.appendChild(salonSp);
                                }

                                td.appendChild(div);
                            }
                        }
                    }

                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            nuevaTabla.appendChild(tbody);

            tableWrap.appendChild(nuevaTabla);
            tableCard.appendChild(tableWrap);
            wrap.appendChild(tableCard);
        }

        // ── 4d. Tabla de materias ────────────────────────────────────────
        if (tablaMaterias) {
            const matCard = document.createElement('div');
            matCard.className = 'hrr-card';

            const matTitle = document.createElement('p');
            matTitle.className = 'hrr-section-title';
            matTitle.textContent = 'Nomenclatura de Materias';
            matCard.appendChild(matTitle);

            const tableWrap = document.createElement('div');
            tableWrap.className = 'hrr-table-wrap';

            const nuevaTabla = document.createElement('table');
            nuevaTabla.className = 'hrr-table';

            // Encabezados
            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');
            tablaMaterias.querySelectorAll('th').forEach(th => {
                const newTh = document.createElement('th');
                newTh.innerHTML = th.innerHTML;
                headRow.appendChild(newTh);
            });
            thead.appendChild(headRow);
            nuevaTabla.appendChild(thead);

            // Filas
            const tbody = document.createElement('tbody');
            tablaMaterias.querySelectorAll('tr').forEach((fila, idx) => {
                if (idx === 0) return;
                const celdas = fila.querySelectorAll('td');
                if (!celdas.length) return;

                const esTotales = fila.querySelector('td[colspan]');
                const tr = document.createElement('tr');
                if (esTotales) tr.className = 'hrr-totales';

                celdas.forEach((celda, ci) => {
                    const td = document.createElement('td');

                    if (esTotales) {
                        td.innerHTML = celda.innerHTML;
                        td.colSpan = celda.colSpan || 1;
                        td.style.textAlign = celda.className?.includes('text-start') ? 'left' : 'center';
                    } else if (ci === 4) {
                        // Unidad oferta — badge de color
                        const bgOrig = celda.getAttribute('style') || '';
                        const isMia = bgOrig.includes('#2DB92D');
                        const badge = document.createElement('span');
                        badge.className = 'hrr-badge' + (isMia ? ' mia' : '');
                        badge.textContent = celda.textContent.trim();
                        td.appendChild(badge);
                    } else if (ci === 6) {
                        // Tipo oferta — pill
                        const text = celda.textContent.trim();
                        const pill = document.createElement('span');
                        pill.className = 'hrr-oferta-pill ' + (text.toLowerCase().includes('no') ? 'no-escolarizada' : 'escolarizada');
                        pill.textContent = text;
                        td.appendChild(pill);
                    } else {
                        td.innerHTML = celda.innerHTML;
                        td.style.textAlign = celda.className?.includes('text-start') ? 'left' : 'center';
                    }

                    tr.appendChild(td);
                });

                tbody.appendChild(tr);
            });
            nuevaTabla.appendChild(tbody);

            tableWrap.appendChild(nuevaTabla);
            matCard.appendChild(tableWrap);
            wrap.appendChild(matCard);
        }

        // ── 4e. Grid inferior: Horas + Alertas ──────────────────────────
        const bottomGrid = document.createElement('div');
        bottomGrid.id = 'hrr-bottom-grid';

        // Total de horas
        if (tablaHoras) {
            const horasCard = document.createElement('div');
            horasCard.className = 'hrr-card';

            const horasTitle = document.createElement('p');
            horasTitle.className = 'hrr-section-title';
            horasTitle.textContent = 'Total de Horas';
            horasCard.appendChild(horasTitle);

            const tableWrap = document.createElement('div');
            tableWrap.className = 'hrr-table-wrap';

            const newTabla = tablaHoras.cloneNode(true);
            newTabla.className = 'hrr-table';
            newTabla.removeAttribute('style');
            tableWrap.appendChild(newTabla);
            horasCard.appendChild(tableWrap);
            bottomGrid.appendChild(horasCard);
        }

        // Alertas
        if (alertas.length) {
            const alertCard = document.createElement('div');
            alertCard.className = 'hrr-card';
            alertas.forEach(texto => {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'hrr-alert';
                alertDiv.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/>
                    </svg>
                    <span>${texto}</span>
                `;
                alertCard.appendChild(alertDiv);
            });
            bottomGrid.appendChild(alertCard);
        }

        if (bottomGrid.children.length) wrap.appendChild(bottomGrid);

        // ── 5. Montar en el DOM ──────────────────────────────────────────
        mainContainer.appendChild(wrap);

        log('UI de horario montada');
    }



    // ── Logger ──
    function log(msg) {
        console.log(
            '%c✦ SIASE+ Horario %c' + msg,
            'background:#007bff;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px',
            'background:#0b1121;color:#82b1ff;padding:2px 6px;border-radius:0 4px 4px 0'
        );
    }

})();


const actualTitleLabel = document.querySelector("#hrr-periodo-actual > b").textContent;
document.querySelector("#hrr-wrap > div:nth-child(3) > p").textContent = `Horario ${actualTitleLabel}`;