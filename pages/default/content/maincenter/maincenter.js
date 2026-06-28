// maincenter.js — SIASE+ Centro de Avisos
// Responsabilidades:
//   1. Sincronizar tema claro/oscuro con canal compartido.
//   2. Mostrar el aviso intersemestral como modal emergente custom.
//   3. Carrusel automático con flechas SVG y dots.
//   4. Tarjetas de texto de avisos DEyA.
//   5. Preservar iframes funcionales ocultos de encuestas.

(function refactorMaincenter() {

    document.title = 'SIASE+ | Avisos';

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
    // 1. EXTRAER DATOS DEL DOM ORIGINAL
    // ══════════════════════════════════════════════════════════════

    // 1a. Banners del slider
    const banners = [];
    document.querySelectorAll('#slider ul li').forEach(li => {
        const anchor = li.querySelector('a');
        const img = li.querySelector('img');
        if (!img) return;
        banners.push({
            href: anchor ? anchor.getAttribute('href') : null,
            target: anchor ? (anchor.getAttribute('target') || '_blank') : null,
            src: img.src,
            alt: img.alt || '',
        });
    });

    // 1b. Aviso intersemestral (modal)
    const iframeIntersemestral = document.querySelector('#Instrucciones iframe');
    const srcIntersemestral = iframeIntersemestral ? iframeIntersemestral.src : null;
    const tituloDialog = document.querySelector('#Instrucciones')?.getAttribute('title') || 'Aviso Importante';

    // 1c. Avisos de texto (tabla DEyA)
    const noticeCells = [];
    const tabla = document.querySelector('body > table');
    if (tabla) {
        tabla.querySelectorAll('td.auto-style9').forEach(td => {
            noticeCells.push(td.innerHTML.trim());
        });
    }

    // 1d. Preservar iframe encuestas DGPPE (#aviso)
    const iframeAviso = document.getElementById('aviso');
    if (iframeAviso) iframeAviso.remove();

    // 1e. Preservar div #idMensajeEncDti
    const divEncDti = document.getElementById('idMensajeEncDti');
    if (divEncDti) divEncDti.remove();

    // ══════════════════════════════════════════════════════════════
    // 2. LIMPIAR DOM
    // ══════════════════════════════════════════════════════════════
    document.body.innerHTML = '';

    // ══════════════════════════════════════════════════════════════
    // 3. CONSTRUIR NUEVA ESTRUCTURA
    // ══════════════════════════════════════════════════════════════
    const wrap = el('div', { id: 'mc-wrap' });

    // ── 3a. Encabezado de sección ──
    const secHeader = el('div', { className: 'mc-section-header' });
    const secTitle = el('h2', { className: 'mc-section-title' });
    secTitle.textContent = 'Avisos de Interés';
    secHeader.appendChild(secTitle);
    wrap.appendChild(secHeader);

    // ── 3b. Carrusel de banners ──
    if (banners.length > 0) {
        const carousel = el('div', { id: 'mc-carousel', 'aria-label': 'Banners informativos', role: 'region' });

        // Track
        const trackWrap = el('div', { className: 'mc-carousel-track-wrap' });
        const track = el('div', { className: 'mc-carousel-track' });

        banners.forEach(({ href, target, src, alt }) => {
            const slide = el('div', { className: 'mc-carousel-slide' });
            let inner;
            if (href) {
                inner = el('a', { href, target, rel: 'noopener noreferrer' });
            } else {
                inner = el('span', {});
            }
            const img = el('img', { src, alt, loading: 'lazy', decoding: 'async' });
            inner.appendChild(img);
            slide.appendChild(inner);
            track.appendChild(slide);
        });

        trackWrap.appendChild(track);
        carousel.appendChild(trackWrap);

        // Flechas SVG
        const svgPrev = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
        const svgNext = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

        const btnPrev = el('button', { className: 'mc-carousel-arrow mc-carousel-arrow--prev', type: 'button', 'aria-label': 'Anterior' });
        btnPrev.innerHTML = svgPrev;
        const btnNext = el('button', { className: 'mc-carousel-arrow mc-carousel-arrow--next', type: 'button', 'aria-label': 'Siguiente' });
        btnNext.innerHTML = svgNext;

        carousel.appendChild(btnPrev);
        carousel.appendChild(btnNext);

        // Dots
        const dotsWrap = el('div', { className: 'mc-carousel-dots', role: 'tablist' });
        const dots = banners.map((_, i) => {
            const d = el('button', {
                className: 'mc-carousel-dot' + (i === 0 ? ' is-active' : ''),
                type: 'button',
                role: 'tab',
                'aria-label': `Slide ${i + 1}`,
            });
            dotsWrap.appendChild(d);
            return d;
        });
        carousel.appendChild(dotsWrap);
        wrap.appendChild(carousel);

        // ── Lógica del carrusel ──
        let current = 0;
        let autoTimer = null;
        const total = banners.length;

        function goTo(idx, userAction) {
            current = ((idx % total) + total) % total;
            track.style.transform = `translateX(-${current * 100}%)`;
            dots.forEach((d, i) => d.classList.toggle('is-active', i === current));
            if (userAction) resetAuto();
        }

        function next(userAction) { goTo(current + 1, userAction); }
        function prev(userAction) { goTo(current - 1, userAction); }

        function startAuto() {
            autoTimer = setInterval(() => next(false), 4500);
        }
        function resetAuto() {
            clearInterval(autoTimer);
            startAuto();
        }

        btnNext.addEventListener('click', () => next(true));
        btnPrev.addEventListener('click', () => prev(true));
        dots.forEach((d, i) => d.addEventListener('click', () => goTo(i, true)));

        // Pausar al pasar el cursor
        carousel.addEventListener('mouseenter', () => clearInterval(autoTimer));
        carousel.addEventListener('mouseleave', startAuto);

        // Swipe táctil
        let touchStartX = 0;
        trackWrap.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
        trackWrap.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) > 40) { dx < 0 ? next(true) : prev(true); }
        }, { passive: true });

        startAuto();
    }

    // ── 3c. Tarjetas de texto (avisos DEyA) ──
    if (noticeCells.length > 0) {
        const secNotices = el('section', { id: 'mc-notices', 'aria-label': 'Avisos institucionales' });
        const grid = el('div', { className: 'mc-notices-grid' });

        noticeCells.forEach((html) => {
            const card = el('article', { className: 'mc-card mc-card--notice' });
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            const primerStrong = tempDiv.querySelector('strong');
            if (primerStrong) {
                const cardTitle = el('div', { className: 'mc-notice-title' });
                cardTitle.textContent = primerStrong.textContent.trim();
                primerStrong.remove();
                card.appendChild(cardTitle);
            }

            const body = el('div', { className: 'mc-notice-body' });
            body.innerHTML = tempDiv.innerHTML;
            card.appendChild(body);
            grid.appendChild(card);
        });

        secNotices.appendChild(grid);
        wrap.appendChild(secNotices);
    }

    document.body.appendChild(wrap);

    // ── 3d. Reincorporar elementos funcionales ocultos ──
    if (iframeAviso) {
        iframeAviso.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
        iframeAviso.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframeAviso);
    }
    if (divEncDti) {
        divEncDti.style.cssText = 'display:none!important';
        document.body.appendChild(divEncDti);
    }

    // ══════════════════════════════════════════════════════════════
    // 4. MODAL — Aviso Intersemestral
    //    Se muestra DESPUÉS de construir el layout principal.
    // ══════════════════════════════════════════════════════════════
    if (srcIntersemestral) {
        const overlay = el('div', { id: 'mc-modal-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': tituloDialog });

        const box = el('div', { id: 'mc-modal-box' });
        const header = el('div', { id: 'mc-modal-header' });

        const badge = el('span', { className: 'mc-badge mc-badge--warning' });
        badge.textContent = '⚑ Aviso';

        const title = el('span', { id: 'mc-modal-title' });
        title.textContent = tituloDialog;

        const btnClose = el('button', { id: 'mc-modal-close', type: 'button', 'aria-label': 'Cerrar aviso' });
        btnClose.textContent = '✕';

        header.appendChild(badge);
        header.appendChild(title);
        header.appendChild(btnClose);

        const body = el('div', { id: 'mc-modal-body' });
        const iframe = el('iframe', {
            src: srcIntersemestral,
            frameborder: '0',
            scrolling: 'yes',
            loading: 'lazy',
        });
        body.appendChild(iframe);

        box.appendChild(header);
        box.appendChild(body);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        function cerrarModal() {
            overlay.classList.add('mc-modal-closing');
            setTimeout(() => overlay.remove(), 260);
        }

        btnClose.addEventListener('click', cerrarModal);

        // Cerrar al hacer clic en el backdrop (fuera del box)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cerrarModal();
        });

        // Cerrar con Escape
        document.addEventListener('keydown', function onKey(e) {
            if (e.key === 'Escape') { cerrarModal(); document.removeEventListener('keydown', onKey); }
        });
    }

    console.log(
        '%c✦ SIASE+ Maincenter %cactivo',
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