// content.js — SIASE+ eSelCarrera
// Light by default · toggle activa modo OSCURO

console.log('%c✦ SIASE+ %cactivo',
    'background:#007bff;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px',
    'background:#0b1121;color:#82b1ff;padding:2px 6px;border-radius:0 4px 4px 0'
);

document.title = "SIASE+";

// Eliminar favicons existentes
document.querySelectorAll('link[rel*="icon"]').forEach(el => el.remove());

// Crear nuevo favicon
const favicon = document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/png";
favicon.href = chrome.runtime.getURL("media/img/siase.png");

document.head.appendChild(favicon);
if (window.self === window.top) {

    // ═══════════════════════════════════════════════════════════
    // 1. REFACTOR table:nth-child(1) — banner → div#siase-banner
    // ═══════════════════════════════════════════════════════════
    const tablaBanner = document.querySelector('body > table:nth-child(1)');
    let bannerDiv = null;

    if (tablaBanner) {
        bannerDiv = document.createElement('div');
        bannerDiv.id = 'siase-banner';

        const tdImg = tablaBanner.querySelector('tr:nth-child(1) td');
        const tdBarra = tablaBanner.querySelector('tr:nth-child(2) td');

        // ── Imagen del banner ──
        const bannerImgWrap = document.createElement('div');
        bannerImgWrap.id = 'siase-banner-img';
        while (tdImg && tdImg.firstChild) bannerImgWrap.appendChild(tdImg.firstChild);

        // ── Barra azul con texto ──
        const bannerBarraWrap = document.createElement('div');
        bannerBarraWrap.id = 'siase-banner-barra';
        if (tdBarra) {
            // Preserva el bgcolor en data para el modo toggle
            bannerBarraWrap.dataset.origBg = tdBarra.getAttribute('bgcolor') || '094988';
            while (tdBarra.firstChild) bannerBarraWrap.appendChild(tdBarra.firstChild);
        }

        bannerDiv.appendChild(bannerImgWrap);
        bannerDiv.appendChild(bannerBarraWrap);
        tablaBanner.parentNode.replaceChild(bannerDiv, tablaBanner);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. REFACTOR table:nth-child(2) — layout → div#siase-layout
    // ═══════════════════════════════════════════════════════════
    // Después del reemplazo anterior, la segunda tabla es ahora :nth-child(2)
    const tablaLayout = document.querySelector('body > table');

    let layoutDiv = null;

    if (tablaLayout) {
        const tdNav = tablaLayout.querySelector('tbody > tr > td:nth-child(1)');
        const tdContent = tablaLayout.querySelector('tbody > tr > td:nth-child(2)');

        layoutDiv = document.createElement('div');
        layoutDiv.id = 'siase-layout';

        const navDiv = document.createElement('div');
        navDiv.id = 'siase-nav';

        // ── Reemplaza la tabla anidada por un <nav> vertical ──
        const tablaNav = tdNav && tdNav.querySelector('table');

        if (tablaNav) {
            const nav = document.createElement('nav');
            nav.id = 'siase-nav-bar';
            nav.setAttribute('aria-label', 'Sistemas UANL');

            // Recorre cada <tr> y extrae el <a> y el <img> con todos sus atributos
            tablaNav.querySelectorAll('tr').forEach(tr => {
                const anchor = tr.querySelector('a');
                const img = tr.querySelector('img');
                if (!anchor || !img) return;

                const navItem = document.createElement('a');

                // Copia todos los atributos del <a> original
                Array.from(anchor.attributes).forEach(attr => {
                    navItem.setAttribute(attr.name, attr.value);
                });

                const navImg = document.createElement('img');

                // Copia todos los atributos del <img> original
                Array.from(img.attributes).forEach(attr => {
                    navImg.setAttribute(attr.name, attr.value);
                });

                navItem.appendChild(navImg);
                nav.appendChild(navItem);
            });

            // Elimina la tabla original y añade el <nav>
            tablaNav.remove();
            navDiv.appendChild(nav);
        }

        // Mueve cualquier otro nodo restante de tdNav (p.ej. el <br>)
        while (tdNav && tdNav.firstChild) navDiv.appendChild(tdNav.firstChild);

        const contentDiv = document.createElement('div');
        contentDiv.id = 'siase-content';
        while (tdContent && tdContent.firstChild) contentDiv.appendChild(tdContent.firstChild);

        layoutDiv.appendChild(navDiv);
        layoutDiv.appendChild(contentDiv);
        tablaLayout.parentNode.replaceChild(layoutDiv, tablaLayout);
    }

    // ═══════════════════════════════════════════════════════════
    // 3. TARJETA — envuelve banner + layout en div#siase-card
    // ═══════════════════════════════════════════════════════════
    const card = document.createElement('div');
    card.id = 'siase-card';

    // Referencia al nodo que sigue a bannerDiv en el DOM
    // (puede haber nodos de texto / comentarios entre ellos)
    const refNode = bannerDiv || layoutDiv;
    if (refNode) {
        refNode.parentNode.insertBefore(card, refNode);
    }

    if (bannerDiv) card.appendChild(bannerDiv);
    if (layoutDiv) card.appendChild(layoutDiv);

    // ═══════════════════════════════════════════════════════════
    // 4. BARRA SUPERIOR DERECHA — toggle + botón Salir
    // ═══════════════════════════════════════════════════════════

    // Extrae el botón Salir del DOM original y lo sube a la barra
    const botonSalirOrig = document.querySelector('.Boton01, input[value="Salir"]');

    const topBar = document.createElement('div');
    topBar.id = 'siase-topbar';
    topBar.innerHTML = `
        <div id="modo-toggle-container">
            <span class="switch-label">Tema</span>
            <label class="switch-slider" title="Alternar modo oscuro">
                <input type="checkbox" id="modoToggle" aria-label="Modo oscuro">
                <span class="slider"></span>
            </label>
        </div>
        <button id="siase-btn-salir" onclick="location='https://www.uanl.mx/enlinea'">
            Salir
        </button>
    `;

    // Elimina el botón original para no duplicarlo
    if (botonSalirOrig) botonSalirOrig.closest('div[align="center"]')?.remove();

    // La barra va dentro de la tarjeta, antes del banner
    card.insertBefore(topBar, card.firstChild);

    // ═══════════════════════════════════════════════════════════
    // 5. TOGGLE — lógica modo claro / oscuro
    // ═══════════════════════════════════════════════════════════
    const toggle = document.getElementById('modoToggle');

    const aplicarModo = (esOscuro) => {
        // Se aplica tanto a <html> como a <body>: <body> cubre el
        // contenido visible, pero <html> es el que se ve en la parte
        // de arriba/bordes de la página (p.ej. overscroll), y solo
        // tenía el color claro por defecto sin esto.
        document.documentElement.classList.toggle('dark-mode', esOscuro);
        document.body.classList.toggle('dark-mode', esOscuro);

        // Corrige elementos con bgcolor inline
        document.querySelectorAll('[bgcolor]').forEach(el => {
            if (!el.dataset.origBg) el.dataset.origBg = el.getAttribute('bgcolor');
            const bg = el.dataset.origBg.toLowerCase().replace('#', '');
            if (esOscuro) {
                if (bg === '094988') el.style.backgroundColor = '#1e3a5f';
                else if (bg === '000000') el.style.backgroundColor = '#2a2a3a';
                else el.style.backgroundColor = '#1a1a2e';
            } else {
                if (bg === '094988') el.style.backgroundColor = '#1d4ed8';
                else if (bg === '000000') el.style.backgroundColor = '#e2e8f0';
                else el.style.backgroundColor = '#ffffff';
            }
        });

        // Barra del banner (era un td con bgcolor, ahora es un div)
        const barra = document.getElementById('siase-banner-barra');
        if (barra) {
            barra.style.backgroundColor = esOscuro ? '#1e3a5f' : '#1d4ed8';
        }
    };

    toggle.addEventListener('change', () => {
        const esOscuro = toggle.checked;
        aplicarModo(esOscuro);
        try { localStorage.setItem('siase-tema', esOscuro ? 'dark' : 'light'); } catch (_) { }
    });

    const guardado = (() => { try { return localStorage.getItem('siase-tema'); } catch (_) { return null; } })();
    const esOscuro = guardado
        ? guardado === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;

    toggle.checked = esOscuro;
    aplicarModo(esOscuro);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const hay = (() => { try { return localStorage.getItem('siase-tema'); } catch (_) { return null; } })();
        if (!hay) { toggle.checked = e.matches; aplicarModo(e.matches); }
    });


    // ═══════════════════════════════════════════════════════════
    // 6. REFACTOR + CONTENCIÓN de paneles (#siase, #correo, #codice, #nexus)
    //    - table → nav, conservando la imagen superior (pestaña)
    //      y el div.margen con su contenido
    //    - el HTML original posiciona estos paneles con
    //      position:absolute + coordenadas fijas (right/top), por
    //      lo que su contenido se salía de #siase-content e
    //      invadía el nav lateral (ver CSS).
    //    - el script original de la página que decide qué panel
    //      mostrar (oculta()/muestra()) tiene un error de sintaxis
    //      en su comentario ("<!-" en vez de "<!--"), así que esas
    //      funciones NUNCA llegan a definirse y el cambio de panel
    //      nunca funcionó realmente. Se reemplaza por completo con
    //      un manejador propio conectado a los links del nav.
    // ═══════════════════════════════════════════════════════════
    // ── Banner "logos-sistemas-siase" propio, en SVG ──
    // Se inserta INLINE (no como <img src="...">) a propósito: así
    // hereda las variables CSS del tema (--siase-banner-border,
    // --siase-banner-grad-*) y reacciona en vivo al toggle claro/
    // oscuro igual que el resto de la página — sin usar filter:invert
    // ni nada que altere colores que no deban cambiar (el fondo negro
    // de la barra y el texto "SIASE" en blanco se quedan igual en
    // ambos modos). Los valores por defecto (sin variables CSS
    // disponibles) son los originales del archivo banner_siase.svg.
    // ── Plantilla base para todos los banners SVG ──
    // Cada banner tiene IDs únicos con prefijo propio para evitar
    // colisiones cuando los cuatro SVGs coexisten en el DOM inline.
    function makeBannerSVG({ svgId, lgBaseId, lgAppliedId, rectId, stops, label }) {
        const stopsMarkup = stops.map(({ color, offset }) =>
            `<stop style="stop-color:${color};stop-opacity:1" offset="${offset}" />`
        ).join('\n      ');
        return `<svg viewBox="0 0 145.52083 8.4666667" id="${svgId}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="${lgBaseId}">
      ${stopsMarkup}
    </linearGradient>
    <rect id="${rectId}" x="11.311059" y="8.3603477" width="183.92766" height="20.900869" />
    <linearGradient xlink:href="#${lgBaseId}" id="${lgAppliedId}"
      x1="0.23733985" y1="7.2693987" x2="57.147717" y2="7.2693987"
      gradientUnits="userSpaceOnUse"
      gradientTransform="matrix(0.72481196,0,0,1,0.10311301,0)" />
  </defs>
  <g>
    <rect style="fill:#82b1ff33;stroke-width:0.269595;stroke-opacity:1" width="150" height="1" x="0" y="8.3441963" />
    <path d="m 3.9593398 0.6203166 c -2.0071893 0 -3.60592702 2.496029 -3.58442523 5.5961834 l 0.0146092 2.1063767 C 0.39373869 8.9305901 2.0443827 8.530201 4.0515722 8.530201 H 37.956135 c 2.007189 0 3.468777 -0.1748447 3.468552 -0.2073243 L 41.410078 6.2165 C 41.388578 3.1163456 39.755216 0.6203166 37.748027 0.6203166 Z"
      style="fill:url(#${lgAppliedId});fill-rule:nonzero;stroke-width:0.274723;stroke-dasharray:none;stroke-opacity:1" />
    <text xml:space="preserve"
      transform="matrix(0.26458333,0,0,0.26458333,4.10381,0.27139869)"
      style="font-size:17.3333px;writing-mode:lr-tb;direction:ltr;white-space:pre;shape-inside:url(#${rectId});fill-opacity:1;stroke-width:1;stroke-opacity:1">
      <tspan x="11.310547" y="24.130409"><tspan style="font-weight:bold;fill:#ffffff;stroke:none">${label}</tspan></tspan>
    </text>
  </g>
</svg>`;
    }

    const SVG_BANNER_SIASE = makeBannerSVG({
        svgId: 'siase-banner-svg', lgBaseId: 'lg-siase', lgAppliedId: 'lg-siase-a', rectId: 'rect-siase',
        stops: [
            { color: 'var(--siase-grad-1, #fbbe1e)', offset: '0' },
            { color: 'var(--siase-grad-2, #fbae00)', offset: '0.44444445' },
            { color: 'var(--siase-grad-3, #fbcf1e)', offset: '1' },
        ],
        label: 'SIASE',
    });

    const SVG_BANNER_MAIL = makeBannerSVG({
        svgId: 'correo-banner-svg', lgBaseId: 'lg-correo', lgAppliedId: 'lg-correo-a', rectId: 'rect-correo',
        stops: [
            { color: 'var(--correo-grad-1, #00a786)', offset: '0' },
            { color: 'var(--correo-grad-2, #0e8870)', offset: '0.44444445' },
            { color: 'var(--correo-grad-3, #0ee2b8)', offset: '1' },
        ],
        label: 'CORREO U',
    });

    const SVG_BANNER_CODICE = makeBannerSVG({
        svgId: 'codice-banner-svg', lgBaseId: 'lg-codice', lgAppliedId: 'lg-codice-a', rectId: 'rect-codice',
        stops: [
            { color: 'var(--codice-grad-1, #d54b51)', offset: '0' },
            { color: 'var(--codice-grad-2, #c5171f)', offset: '0.44444445' },
            { color: 'var(--codice-grad-3, #d55b4b)', offset: '1' },
        ],
        label: 'CODICE',
    });

    const SVG_BANNER_NEXUS = makeBannerSVG({
        svgId: 'nexus-banner-svg', lgBaseId: 'lg-nexus', lgAppliedId: 'lg-nexus-a', rectId: 'rect-nexus',
        stops: [
            { color: 'var(--nexus-grad-1, #1e5fa4)', offset: '0' },
            { color: 'var(--nexus-grad-2, #0e4177)', offset: '0.44444445' },
            { color: 'var(--nexus-grad-3, #1e75c5)', offset: '1' },
        ],
        label: 'NEXUS',
    });

    const idsPaneles = ['siase', 'correo', 'codice', 'nexus'];
    const panelActivoPorDefecto = 'siase';

    function mostrarPanel(id) {
        idsPaneles.forEach(pid => {
            const panel = document.getElementById(pid);
            if (panel) panel.classList.toggle('siase-panel-hidden', pid !== id);
        });
    }

    idsPaneles.forEach(id => {
        const panel = document.getElementById(id);
        if (!panel) return;

        const tabla = panel.querySelector('table');
        if (!tabla) return;

        const imgPestana = tabla.querySelector('img');
        const margen = tabla.querySelector('div.margen');

        const nav = document.createElement('nav');
        nav.className = 'siase-panel-nav';
        nav.setAttribute('aria-label', id);

        const svgMap = { siase: SVG_BANNER_SIASE, correo: SVG_BANNER_MAIL, codice: SVG_BANNER_CODICE, nexus: SVG_BANNER_NEXUS };

        const imgWrap = document.createElement('div');
        imgWrap.className = 'siase-panel-img';

        if (svgMap[id]) {
            imgWrap.innerHTML = svgMap[id];
            nav.appendChild(imgWrap);
        } else if (imgPestana) {
            imgWrap.appendChild(imgPestana);
            nav.appendChild(imgWrap);
        }

        if (margen) nav.appendChild(margen);

        tabla.parentNode.replaceChild(nav, tabla);
    });


    mostrarPanel(panelActivoPorDefecto);

    // ═══════════════════════════════════════════════════════════
    // 6.5. ALTURA ESTABLE — fija #siase-layout a la altura del
    //      contenido de #codice (el panel más largo de los 4), un
    //      poco más holgada, para que el layout no se agrande ni
    //      se encoja al cambiar entre #siase / #correo / #codice /
    //      #nexus.
    // ═══════════════════════════════════════════════════════════
    const HOLGURA_ALTURA = 40; // px de margen sobre la altura de #codice

    function fijarAlturaEstable() {
        const layout = document.getElementById('siase-layout');
        const panelCodice = document.getElementById('codice');
        if (!layout || !panelCodice) return;

        // Se mide aunque #codice no sea el panel activo: se quita
        // momentáneamente la clase que lo oculta (display:none no
        // permite medir), se toma su altura real y se restaura.
        const estabaOculto = panelCodice.classList.contains('siase-panel-hidden');
        if (estabaOculto) panelCodice.classList.remove('siase-panel-hidden');

        const alturaCodice = panelCodice.scrollHeight;

        if (estabaOculto) panelCodice.classList.add('siase-panel-hidden');

        if (alturaCodice > 0) {
            layout.style.minHeight = (alturaCodice + HOLGURA_ALTURA) + 'px';
        }
    }

    fijarAlturaEstable();

    const enlace = document.querySelector("#correo > nav > div.margen > div > a");

    if (enlace) {
        const href = enlace.href;

        enlace.outerHTML = `
        <button onclick="window.location.href='${href}'">
            Ingresar
        </button>
    `;
    }


    // El texto de #codice puede ajustar sus líneas (y por tanto su
    // altura) si el ancho de la tarjeta cambia, así que se recalcula
    // ante cambios de tamaño de ventana.
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fijarAlturaEstable, 150);
    });

    // Conecta cada link del nav lateral con su panel correspondiente,
    // leyendo el id desde el atributo onmouseover original
    // (muestra('siase'), muestra('correo'), etc.) y reemplazándolo
    // por un manejador propio que sí funciona.
    document.querySelectorAll('#siase-nav-bar a').forEach(a => {
        const handler = a.getAttribute('onmouseover') || '';
        const match = handler.match(/muestra\('([^']+)'\)/);
        if (!match) return;
        const targetId = match[1];

        a.removeAttribute('onmouseover');
        a.addEventListener('mouseenter', () => mostrarPanel(targetId));
        a.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarPanel(targetId);
        });
    });

    // ── Hover suave en links de carrera ──
    // document.querySelectorAll('#contenido a').forEach(el => {
    //     el.style.transition = 'background 0.15s, padding-left 0.15s';
    //     el.addEventListener('mouseenter', () => {
    //         el.style.paddingLeft = '10px';
    //         el.style.background = 'rgba(0,123,255,0.1)';
    //         el.style.borderRadius = '4px';
    //     });
    //     el.addEventListener('mouseleave', () => {
    //         el.style.paddingLeft = '';
    //         el.style.background = '';
    //     });
    // });


}