// iafoto01.js — SIASE+ Entrega de Documentos
// Responsabilidades:
//   1. Sincronizar tema claro/oscuro con canal compartido.
//   2. Reconstruir UI con el sistema de diseño SIASE+.
//   3. Reemplazar los diálogos jQuery UI por modales SIASE+.
//   4. Tabla de documentos con búsqueda y paginación nativa.
//   5. Preservar toda la lógica de negocio (AJAX, formulario, DataTable).

(function refactorIaFoto01() {

    document.title = 'SIASE+ | Expediente';

    // ══════════════════════════════════════════════════════════════
    // 0. TEMA
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
    // 1. ESPERAR A QUE JQUERY Y DATATABLES ESTÉN LISTOS
    // ══════════════════════════════════════════════════════════════
    function waitForJQuery(cb, maxMs = 8000) {
        const start = Date.now();
        (function check() {
            if (typeof $ !== 'undefined' && typeof $.fn.DataTable !== 'undefined') {
                cb();
            } else if (Date.now() - start < maxMs) {
                setTimeout(check, 80);
            } else {
                console.warn('[SIASE+] jQuery/DataTable no disponible — usando fallback');
                cb(); // igual procedemos
            }
        })();
    }

    // ══════════════════════════════════════════════════════════════
    // 2. EXTRAER DATOS DEL DOM ORIGINAL
    // ══════════════════════════════════════════════════════════════

    // 2a. Opciones del select de tipo de documento
    const selectOrig = document.querySelector('select[name="HTMLCve_Docto"]');
    const selectOpts = selectOrig ? Array.from(selectOrig.options).map(o => ({ value: o.value, text: o.textContent.trim() })) : [];

    // 2b. Campos hidden del formulario
    const hiddenFields = [];
    document.querySelectorAll('input[type="hidden"]').forEach(inp => {
        hiddenFields.push({ name: inp.name, id: inp.id || null, value: inp.value });
    });

    // 2c. Filas de la tabla de documentos
    const tableRows = [];
    document.querySelectorAll('#idListado tbody tr').forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length >= 3) {
            tableRows.push({
                doc: cells[0]?.textContent.trim() || '',
                fecha: cells[1]?.textContent.trim() || '',
                estatus: cells[2]?.textContent.trim() || '',
                comentario: cells[3]?.textContent.trim() || '',
            });
        }
    });

    // 2d. Texto del estado del expediente y progreso
    const progressBar = document.getElementById('idbarra');
    const progressPct = progressBar ? parseInt(progressBar.style.width) || 60 : 60;
    const progressText = progressBar ? progressBar.textContent.trim() : 'Validando Documentos';
    const progressClass = progressBar ? progressBar.className : '';

    const statusParagraph = document.querySelector('p');
    const statusText = statusParagraph ? statusParagraph.textContent.trim() : '';

    // ══════════════════════════════════════════════════════════════
    // 3. LIMPIAR BODY (preservar lógica de negocio oculta)
    // ══════════════════════════════════════════════════════════════
    document.body.innerHTML = '';

    // ══════════════════════════════════════════════════════════════
    // 4. CONSTRUIR NUEVA ESTRUCTURA
    // ══════════════════════════════════════════════════════════════
    const wrap = el('div', { id: 'sp-wrap' });

    // ── 4a. Cabecera ──
    const header = el('div', { className: 'sp-page-header' });
    const pageTitle = el('h2', { className: 'sp-page-title' });
    pageTitle.textContent = 'Carga de Documentos para Expediente';
    header.appendChild(pageTitle);

    const helpBtn = el('button', { className: 'sp-help-btn', type: 'button', id: 'idAyuda' });
    helpBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Instrucciones`;
    header.appendChild(helpBtn);
    wrap.appendChild(header);

    // ── 4b. Tarjeta: Formulario de carga ──
    const formCard = el('div', { className: 'sp-card', id: 'idFormulario' });
    const formCardHeader = el('div', { className: 'sp-card-header' });
    const formCardHeaderTitle = el('h3', { className: 'sp-card-header-title' });
    formCardHeaderTitle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-.15em;margin-right:6px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Subir documento`;
    formCardHeader.appendChild(formCardHeaderTitle);
    formCard.appendChild(formCardHeader);

    const formCardBody = el('div', { className: 'sp-card-body' });

    // Formulario real (con los hidden fields)
    const form = el('form', { enctype: 'multipart/form-data', name: 'mi_forma', method: 'post' });

    // Restaurar campos hidden
    hiddenFields.forEach(({ name, id, value }) => {
        const inp = el('input', { type: 'hidden', name, value });
        if (id) inp.id = id;
        form.appendChild(inp);
    });

    // Grid del formulario visible
    const grid = el('div', { className: 'sp-form-grid' });

    // Row: Tipo de documento
    const lblTipo = el('label', { className: 'sp-label', htmlFor: 'idCve_Docto' });
    lblTipo.textContent = 'Tipo de Documento:';
    grid.appendChild(lblTipo);

    const selectNew = el('select', { name: 'HTMLCve_Docto', id: 'idCve_Docto', className: 'sp-select' });
    selectOpts.forEach(({ value, text }) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        selectNew.appendChild(opt);
    });
    // Si no había opciones (carga dinámica), añadir placeholder
    if (selectOpts.length === 0) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '— Seleccione un tipo —';
        selectNew.appendChild(placeholder);
    }
    grid.appendChild(selectNew);

    // Row: Archivo
    const lblArchivo = el('label', { className: 'sp-label', htmlFor: 'HTMLArchivo' });
    lblArchivo.textContent = 'Archivo PDF:';
    grid.appendChild(lblArchivo);

    const fileWrap = el('div', { className: 'sp-file-wrap' });
    const fileInput = el('input', {
        type: 'file',
        name: 'HTMLArchivo',
        id: 'HTMLArchivo',
        accept: '.pdf,application/pdf',
        className: 'sp-file-input',
    });
    fileWrap.appendChild(fileInput);
    grid.appendChild(fileWrap);

    // Row: Acciones
    const lblEmpty = el('span', {});
    grid.appendChild(lblEmpty);

    const actions = el('div', { className: 'sp-actions' });

    const btnGuardar = el('button', { type: 'button', id: 'idGuardarArch', className: 'sp-btn sp-btn--primary' });
    btnGuardar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Guardar documento`;
    actions.appendChild(btnGuardar);

    const btnEnviar = el('button', { type: 'button', id: 'idTermina', className: 'sp-btn sp-btn--secondary', id: 'idEnviarRevision' });
    btnEnviar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Enviar a revisión`;
    actions.appendChild(btnEnviar);
    grid.appendChild(actions);

    form.appendChild(grid);
    formCardBody.appendChild(form);
    formCard.appendChild(formCardBody);
    wrap.appendChild(formCard);

    // ── 4c. Tarjeta: Tabla de documentos ──
    const tableCard = el('div', { className: 'sp-card', id: 'idContList' });
    const tableCardHeader = el('div', { className: 'sp-card-header' });
    const tableCardTitle = el('h3', { className: 'sp-card-header-title' });
    tableCardTitle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-.15em;margin-right:6px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Documentos cargados`;
    tableCardHeader.appendChild(tableCardTitle);
    tableCard.appendChild(tableCardHeader);

    // Controles de búsqueda
    const dtControls = el('div', { className: 'sp-dt-controls' });
    const searchWrap = el('div', { className: 'sp-dt-search-wrap' });
    const searchLbl = el('span');
    searchLbl.textContent = 'Buscar:';
    const searchInput = el('input', { type: 'search', className: 'sp-dt-search-input', placeholder: 'Filtrar documentos…', id: 'sp-search' });
    searchWrap.appendChild(searchLbl);
    searchWrap.appendChild(searchInput);
    const dtInfo = el('div', { className: 'sp-dt-info', id: 'sp-dt-info' });
    dtControls.appendChild(searchWrap);
    dtControls.appendChild(dtInfo);
    tableCard.appendChild(dtControls);

    // Tabla
    const tableWrap = el('div', { className: 'sp-table-wrap' });
    const table = el('table', { className: 'sp-table', id: 'idListado' });
    const thead = el('thead');
    const theadRow = el('tr');
    ['Documento', 'Fecha de carga', 'Estatus', 'Comentario'].forEach(h => {
        const th = el('th');
        th.textContent = h;
        theadRow.appendChild(th);
    });
    thead.appendChild(theadRow);
    table.appendChild(thead);

    const tbody = el('tbody', { id: 'sp-tbody' });
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    // Paginación
    const paginationWrap = el('div', { className: 'sp-dt-controls', id: 'sp-pagination' });
    tableCard.appendChild(tableWrap);
    tableCard.appendChild(paginationWrap);
    wrap.appendChild(tableCard);

    // ── 4d. Tarjeta: Estado del expediente ──
    const progressCard = el('div', { className: 'sp-card' });
    const progressCardHeader = el('div', { className: 'sp-card-header' });
    const progressCardTitle = el('h3', { className: 'sp-card-header-title' });
    progressCardTitle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-.15em;margin-right:6px"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Estado del expediente`;
    progressCardHeader.appendChild(progressCardTitle);
    progressCard.appendChild(progressCardHeader);

    const progressBody = el('div', { className: 'sp-card-body' });
    const progressSection = el('div', { className: 'sp-progress-section' });
    const progressLabel = el('p', { className: 'sp-progress-label' });
    progressLabel.innerHTML = statusText ? statusText.replace(/^El estatus de su expediente es:\s*/i, '<strong>Estado:</strong> ') : '';
    progressSection.appendChild(progressLabel);

    const track = el('div', { className: 'sp-progress-track' });
    const bar = el('div', { className: 'sp-progress-bar', id: 'idbarra', role: 'progressbar', 'aria-valuenow': String(progressPct), 'aria-valuemin': '0', 'aria-valuemax': '100' });
    bar.style.width = progressPct + '%';
    bar.textContent = progressText;
    track.appendChild(bar);
    progressSection.appendChild(track);

    progressBody.appendChild(progressSection);
    progressCard.appendChild(progressBody);
    wrap.appendChild(progressCard);

    // ── 4e. Diálogos ocultos reutilizados por lógica jQuery ──
    const divRevision = el('div', { id: 'idRevision', title: 'Revisión de Documentos', style: 'display:none' });
    const divMensaje = el('div', { id: 'idMensaje', title: 'Aviso Importante', style: 'display:none' });
    const pMensaje = el('p');
    divMensaje.appendChild(pMensaje);
    wrap.appendChild(divRevision);
    wrap.appendChild(divMensaje);

    document.body.appendChild(wrap);

    // ══════════════════════════════════════════════════════════════
    // 5. TABLA NATIVA CON BÚSQUEDA Y PAGINACIÓN
    // ══════════════════════════════════════════════════════════════
    const PAGE_SIZE = 10;
    let filteredRows = [...tableRows];
    let currentPage = 1;

    function statusClass(estatus) {
        const e = (estatus || '').toUpperCase();
        if (e.includes('ACEPT')) return 'sp-status--accepted';
        if (e.includes('CARG')) return 'sp-status--loaded';
        if (e.includes('RECHAZ') || e.includes('RECHA')) return 'sp-status--rejected';
        return 'sp-status--pending';
    }

    function statusIcon(estatus) {
        const e = (estatus || '').toUpperCase();
        if (e.includes('ACEPT')) return '✓';
        if (e.includes('CARG')) return '↑';
        if (e.includes('RECHAZ')) return '✕';
        return '…';
    }

    function renderTable() {
        const total = filteredRows.length;
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, total);
        const page = filteredRows.slice(start, end);

        tbody.innerHTML = '';
        if (page.length === 0) {
            const emptyRow = el('tr', { className: 'sp-empty-row' });
            const emptyCell = el('td');
            emptyCell.setAttribute('colspan', '4');
            emptyCell.textContent = 'No se encontraron registros';
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
        } else {
            page.forEach(row => {
                const tr = el('tr');
                const tdDoc = el('td');
                tdDoc.textContent = row.doc;
                const tdFecha = el('td');
                tdFecha.textContent = row.fecha;
                const tdEstatus = el('td');
                const badge = el('span', { className: 'sp-status ' + statusClass(row.estatus) });
                badge.textContent = statusIcon(row.estatus) + ' ' + row.estatus;
                tdEstatus.appendChild(badge);
                const tdComent = el('td');
                tdComent.textContent = row.comentario || '—';
                tr.appendChild(tdDoc);
                tr.appendChild(tdFecha);
                tr.appendChild(tdEstatus);
                tr.appendChild(tdComent);
                tbody.appendChild(tr);
            });
        }

        // Info
        dtInfo.textContent = total === 0
            ? 'Sin registros'
            : `Mostrando ${start + 1}–${end} de ${total} registros`;

        // Paginación
        paginationWrap.innerHTML = '';
        if (total > PAGE_SIZE) {
            const totalPages = Math.ceil(total / PAGE_SIZE);
            const paginationInner = el('div', { className: 'sp-dt-pagination' });

            const btnPrev = el('button', { className: 'sp-dt-page-btn', type: 'button' });
            btnPrev.textContent = '← Anterior';
            if (currentPage === 1) btnPrev.disabled = true;
            btnPrev.addEventListener('click', () => { currentPage--; renderTable(); });

            paginationInner.appendChild(btnPrev);

            for (let i = 1; i <= totalPages; i++) {
                const btn = el('button', { className: 'sp-dt-page-btn' + (i === currentPage ? ' is-active' : ''), type: 'button' });
                btn.textContent = i;
                btn.addEventListener('click', () => { currentPage = i; renderTable(); });
                paginationInner.appendChild(btn);
            }

            const btnNext = el('button', { className: 'sp-dt-page-btn', type: 'button' });
            btnNext.textContent = 'Siguiente →';
            if (currentPage === totalPages) btnNext.disabled = true;
            btnNext.addEventListener('click', () => { currentPage++; renderTable(); });
            paginationInner.appendChild(btnNext);

            paginationWrap.appendChild(paginationInner);
        }
    }

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase();
        filteredRows = q
            ? tableRows.filter(r => r.doc.toLowerCase().includes(q) || r.estatus.toLowerCase().includes(q) || r.fecha.includes(q))
            : [...tableRows];
        currentPage = 1;
        renderTable();
    });

    renderTable();

    // ══════════════════════════════════════════════════════════════
    // 6. SISTEMA DE DIÁLOGOS SIASE+
    //    Intercepta los $.fn.dialog() de jQuery UI.
    // ══════════════════════════════════════════════════════════════
    let dialogStack = [];

    function abrirDialogo(titulo, contenidoHtmlONode, onAceptar) {
        // Eliminar overlay previo del mismo tipo
        document.getElementById('sp-dialog-overlay')?.remove();

        const overlay = el('div', { id: 'sp-dialog-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
        const box = el('div', { className: 'sp-dialog-box' });

        const dHeader = el('div', { className: 'sp-dialog-header' });
        const dTitle = el('span', { className: 'sp-dialog-title' });
        dTitle.textContent = titulo;
        const dClose = el('button', { className: 'sp-dialog-close', type: 'button', 'aria-label': 'Cerrar' });
        dClose.textContent = '✕';
        dHeader.appendChild(dTitle);
        dHeader.appendChild(dClose);

        const dBody = el('div', { className: 'sp-dialog-body' });
        if (typeof contenidoHtmlONode === 'string') {
            dBody.innerHTML = contenidoHtmlONode;
        } else if (contenidoHtmlONode instanceof Node) {
            dBody.appendChild(contenidoHtmlONode.cloneNode(true));
        }

        const dFooter = el('div', { className: 'sp-dialog-footer' });
        const btnAceptar = el('button', { className: 'sp-btn sp-btn--primary', type: 'button' });
        btnAceptar.textContent = 'Aceptar';
        dFooter.appendChild(btnAceptar);

        box.appendChild(dHeader);
        box.appendChild(dBody);
        box.appendChild(dFooter);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        function cerrar() {
            overlay.classList.add('sp-closing');
            setTimeout(() => overlay.remove(), 220);
        }

        dClose.addEventListener('click', cerrar);
        btnAceptar.addEventListener('click', () => { if (onAceptar) onAceptar(); cerrar(); });
        overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });
        document.addEventListener('keydown', function onKey(e) {
            if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', onKey); }
        });

        dialogStack.push({ overlay, cerrar });
        return { cerrar, dBody };
    }

    // ══════════════════════════════════════════════════════════════
    // 7. LÓGICA DE NEGOCIO (restaurada con intercepciones SIASE+)
    // ══════════════════════════════════════════════════════════════
    waitForJQuery(() => {
        if (typeof $ === 'undefined') {
            // Fallback sin jQuery
            btnGuardar.addEventListener('click', () => {
                if (!fileInput.value) {
                    abrirDialogo('Aviso Importante', '<p>Favor de Adjuntar Documento</p>');
                }
            });
            return;
        }

        // Interceptar $.fn.dialog para mostrar modales SIASE+ en lugar de jQuery UI
        const origDialog = $.fn.dialog;
        $.fn.dialog = function (opts, ...rest) {
            const $el = this;
            const elId = $el.attr('id');

            if (typeof opts === 'object') {
                // Registrar config pero no abrir automáticamente (a menos que autoOpen: true)
                $el.data('sp-dialog-opts', opts);
                if (opts.autoOpen === true) {
                    const titulo = $el.attr('title') || 'Aviso';
                    abrirDialogo(titulo, $el.html());
                }
                // Mock: agregar method 'open' y 'close' como strings
                $el.data('sp-dialog-initialized', true);
            } else if (opts === 'open') {
                const titulo = $el.attr('title') || 'Aviso';
                const { dBody, cerrar } = abrirDialogo(titulo, $el.html());
                $el.data('sp-dialog-close', cerrar);
                // Si el diálogo tiene botones de acción post-open (revisión), re-renderizar la tabla
                if (elId === 'idRevision') {
                    // El contenido fue seteado por AJAX antes de dialog('open')
                    const htmlRevision = $el.html();
                    abrirDialogo($el.attr('title') || 'Revisión', htmlRevision);
                }
            } else if (opts === 'close') {
                const fn = $el.data('sp-dialog-close');
                if (fn) fn();
            } else if (opts === 'html') {
                // setter
                $el.html(rest[0]);
            } else {
                // Pasar el resto de comandos al original por si necesitamos compatibilidad
                return origDialog.apply(this, [opts, ...rest]);
            }

            return $el;
        };

        // Reinyectar la lógica original de los botones con el mismo código del HTML original
        // pero usando nuestro sistema de diálogos.

        // Botón Guardar
        btnGuardar.addEventListener('click', function () {
            btnGuardar.disabled = true;
            if (!fileInput.value) {
                abrirDialogo('Aviso Importante', '<p>Favor de Adjuntar Documento</p>', () => {
                    btnGuardar.disabled = false;
                });
                return;
            }

            const file = fileInput.files[0];
            const fileSize = file.size;
            const sizeKB = parseInt(fileSize / 1024);
            const ext = fileInput.value.split('.');
            const extension = ext[ext.length - 1].toLowerCase();

            if (!ext[0]) {
                abrirDialogo('Aviso Importante', '<p>Favor de Adjuntar Documento</p>', () => { btnGuardar.disabled = false; });
                return;
            }

            if (extension !== 'pdf') {
                abrirDialogo('Aviso Importante', '<p>C.- Favor de adjuntar documento PDF.</p>', () => { btnGuardar.disabled = false; });
                return;
            }

            if (sizeKB > 600) {
                abrirDialogo('Aviso Importante', '<p>B.- El archivo PDF excede los 600 kb, favor de optimizarlo.</p>', () => { btnGuardar.disabled = false; });
                return;
            }

            // Proceder con AJAX
            const formData = new FormData();
            formData.append('HTMLArchivo', file);
            hiddenFields.forEach(({ name, value }) => formData.append(name, value));
            const doctoVal = selectNew.value;
            if (doctoVal) formData.append('HTMLCve_Docto', doctoVal);

            fetch('ecCargaDocto30.htm', {
                method: 'POST',
                body: formData,
            })
                .then(r => r.text())
                .then(html => {
                    abrirDialogo('Respuesta del servidor', html, () => { btnGuardar.disabled = false; });
                })
                .catch(() => {
                    abrirDialogo('Error', '<p>Disculpe, existió un problema al subir el archivo.</p>', () => { btnGuardar.disabled = false; });
                });
        });

        // Botón Enviar a revisión
        const btnTermina = document.getElementById('idTermina') || btnEnviar;
        btnTermina.addEventListener('click', function () {
            $.ajax({
                url: 'ecCargaDocto30.htm',
                data: {
                    HTMLRI: '',
                    HTMLUsuario: '2132062',
                    HTMLCve_Tipo_Periodo: '01',
                    HTMLCve_Periodo: '340',
                    pcRowID: '0x0000000003132b85',
                    pcFolio: '32814',
                    vcMetodo: '4',
                },
                type: 'POST',
                dataType: 'html',
                success: function (a) {
                    abrirDialogo('Revisión de Documentos', a);
                    bar.style.width = '20%';
                    bar.textContent = 'Validando Documentos';
                    bar.className = 'sp-progress-bar';
                },
                error: function () {
                    abrirDialogo('Error', '<p>Disculpe, existió un problema</p>');
                },
            });
        });

        // Botón de ayuda
        helpBtn.addEventListener('click', function () {
            abrirDialogo('Instrucciones para la carga de documentos',
                `<ul>
                    <li>Los documentos deben estar digitalizados en formato PDF (escaneado) con buena calidad y por ambos lados en un solo archivo.</li>
                    <li>No se aceptarán fotografías convertidas en archivos PDF.</li>
                    <li>Deberá subir el archivo solicitado en el tipo de documento correspondiente; en caso de no contar con alguno de ellos, anexar comprobante que acredite el documento faltante.</li>
                    <li>Una vez realizada la carga de los documentos, el tiempo de respuesta es de 48h.</li>
                </ul>`
            );
        });

        // Cargar opciones del select de tipo documento si vienen vacías (carga dinámica por DataTable original)
        // El script original de la página carga el select vía DataTable o AJAX — lo dejamos intacto si ya tiene opciones.
    });

    // ══════════════════════════════════════════════════════════════
    // 8. LOG
    // ══════════════════════════════════════════════════════════════
    console.log(
        '%c✦ SIASE+ iaFoto01 %cactivo',
        'background:#007bff;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px',
        'background:#0b1121;color:#82b1ff;padding:2px 6px;border-radius:0 4px 4px 0'
    );

    // ══════════════════════════════════════════════════════════════
    // UTIL
    // ══════════════════════════════════════════════════════════════
    function el(tag, attrs = {}) {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'className') node.className = v;
            else if (k === 'htmlFor') node.htmlFor = v;
            else if (typeof v === 'boolean') { if (v) node.setAttribute(k, ''); }
            else node.setAttribute(k, v);
        }
        return node;
    }

})();