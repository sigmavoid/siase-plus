// nexus.js — SIASE+ Nexus
// Inyecta el botón "Exportar a Calendar" y el toggle de modo oscuro
// en el toolbar de Nexus, solo cuando la página activa es Calendario.

(function () {

    // ═══════════════════════════════════════════════════════════
    // SELECTORES
    // ═══════════════════════════════════════════════════════════
    const SEL_TOOLBAR_ROW_DIV =
        'body > app-root > app-appmain > div > mat-sidenav-container > mat-sidenav-content > mat-toolbar > mat-toolbar-row > div';
    const SEL_TITULO_SPAN =
        'body > app-root > app-appmain > div > mat-sidenav-container > mat-sidenav-content > mat-toolbar > mat-toolbar-row > div > div:nth-child(1) > span';

    // ═══════════════════════════════════════════════════════════
    // HELPERS DE ESTADO
    // ═══════════════════════════════════════════════════════════

    // Verifica que el span de título diga exactamente "Calendario"
    function esVistaCalendario() {
        const span = document.querySelector(SEL_TITULO_SPAN);
        return span && span.textContent.trim() === 'Calendario';
    }

    // Elimina los controles si ya no estamos en Calendario
    function limpiarControles() {
        const existente = document.getElementById('nx-plus-controls');
        if (existente) existente.remove();
    }

    // ═══════════════════════════════════════════════════════════
    // TOGGLE — modo oscuro
    // ═══════════════════════════════════════════════════════════
    function aplicarModo(esOscuro) {
        document.documentElement.classList.toggle('nx-dark', esOscuro);
        document.body.classList.toggle('nx-dark', esOscuro);
    }

    function inicializarToggle(toggle) {
        // Preferencia guardada → sistema operativo → claro
        const guardado = (() => {
            try { return localStorage.getItem('nexus-plus-tema'); } catch (_) { return null; }
        })();
        const inicial = guardado
            ? guardado === 'dark'
            : window.matchMedia('(prefers-color-scheme: dark)').matches;

        toggle.checked = inicial;
        aplicarModo(inicial);

        toggle.addEventListener('change', () => {
            const oscuro = toggle.checked;
            aplicarModo(oscuro);
            try { localStorage.setItem('nexus-plus-tema', oscuro ? 'dark' : 'light'); } catch (_) { }
        });

        // Respeta cambios del SO solo si el usuario no eligió manualmente
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            const hay = (() => {
                try { return localStorage.getItem('nexus-plus-tema'); } catch (_) { return null; }
            })();
            if (!hay) { toggle.checked = e.matches; aplicarModo(e.matches); }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCCIÓN DE CONTROLES
    // ═══════════════════════════════════════════════════════════
    function construirControles() {
        const wrapper = document.createElement('div');
        wrapper.id = 'nx-plus-controls';

        // ── Toggle modo oscuro ──
        wrapper.innerHTML = `
            <div id="nx-modo-toggle-container">
                <span class="nx-switch-label">Tema</span>
                <label class="nx-switch-slider" title="Alternar modo oscuro">
                    <input type="checkbox" id="nx-modoToggle" aria-label="Modo oscuro">
                    <span class="nx-slider"></span>
                </label>
            </div>
            <button id="nx-btn-exportar" title="Exportar tareas a Google Calendar">
                📅 Exportar a Calendar
            </button>
        `;

        // Conectar el toggle
        const toggle = wrapper.querySelector('#nx-modoToggle');
        inicializarToggle(toggle);

        // Conectar el botón de exportar
        const btnExportar = wrapper.querySelector('#nx-btn-exportar');
        btnExportar.addEventListener('click', () => {
            // Llamada directa a content_script.js.
            // Ambos corren en world: ISOLATED → comparten el mismo window proxy.
            if (window.__siasePlus?.exportar) {
                window.__siasePlus.exportar();
            } else {
                console.error('[SIASE+] content_script no disponible aún.');
            }
        });

        return wrapper;
    }

    // ═══════════════════════════════════════════════════════════
    // INYECCIÓN
    // ═══════════════════════════════════════════════════════════
    function intentarInyectar() {
        // Nada que hacer si ya está
        if (document.getElementById('nx-plus-controls')) return true;

        // Solo inyectamos si el título es "Calendario"
        if (!esVistaCalendario()) return false;

        const contenedor = document.querySelector(SEL_TOOLBAR_ROW_DIV);
        if (!contenedor) return false;

        contenedor.appendChild(construirControles());
        console.log('%c✦ SIASE+ Nexus %ccontroles inyectados',
            'background:#1d4ed8;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px',
            'background:#0b1121;color:#82b1ff;padding:2px 6px;border-radius:0 4px 4px 0'
        );
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    // OBSERVER — Angular renderiza el DOM tarde y hace SPA routing
    // Vigilamos tanto la carga inicial como los cambios de ruta
    // ═══════════════════════════════════════════════════════════
    const observer = new MutationObserver(() => {
        if (esVistaCalendario()) {
            intentarInyectar();
        } else {
            // Navegamos a otra sección: quitamos los controles
            limpiarControles();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Intento inmediato por si el DOM ya está listo al cargar
    intentarInyectar();

})();