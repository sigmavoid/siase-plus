// menu.js — SIASE+ Menu Refactor
// Se inyecta en el frame izquierdo del frameset (menu.html / mainleftdin01.htm).
//
// Responsabilidades:
//   1. Eliminar cualquier #siase-header/#siase-topbar espurio que
//      pueda aparecer en este frame (ver sección 0).
//   2. Convertir el <ul class="menu collapsible"> original (con su
//      submenú anidado "Becas") a un menú lateral moderno hecho con
//      <nav>/<a>/<details>, mismo lenguaje visual que el nav lateral
//      de eSelCarrera (#siase-nav-bar).
//   3. Convertir la tabla "Nomenclatura de Horario" a un panel
//      colapsable con la leyenda en grid.
//   4. Sincronizar el tema claro/oscuro con el resto del sistema
//      (header.js / default.js) vía el mismo canal: localStorage
//      'siase-tema' + postMessage entre frames.
//
// Nota: los <li id="li_..."> originales se usan en el <script>
// inline de la propia página (función consulta()) para ocultar
// opciones según el estado de encuestas pendientes del alumno
// (p.ej. $("#li_Kardex").hide()). Esos IDs se preservan tal cual en
// los nuevos elementos para que esa lógica siga funcionando sin
// tocarla.

(function refactorMenu() {

    document.title = 'SIASE+ | Menú';
    // document.querySelector("html > frameset > frameset > frame:nth-child(1)>html>body>'siase-header'")?.remove();
    //document.querySelector("#siase-header").remove();
    // ══════════════════════════════════════════════════════════════
    // 0. LIMPIEZA DEFENSIVA — #siase-header no pertenece a este frame
    // ══════════════════════════════════════════════════════════════
    // Este frame solo debe contener el menú lateral. Si header.js
    // llega a ejecutarse también aquí (p.ej. por un match demasiado
    // amplio en manifest.json), su selector `body > table.MenuLink`
    // coincide con la tabla "Nomenclatura de Horario" de este menú
    // (también tiene class="MenuLink"), y construiría un
    // #siase-header espurio a partir de ella. Se elimina por si
    // acaso, independientemente del origen.
    //document.getElementById('siase-header')?.remove();
    // document.getElementById('siase-topbar')?.remove();


    // ══════════════════════════════════════════════════════════════
    // 1. TEMA — mismo canal que header.js / default.js
    // ══════════════════════════════════════════════════════════════
    const TEMA_KEY = 'siase-tema';

    function leerTema() {
        try { return localStorage.getItem(TEMA_KEY); } catch (_) { return null; }
    }

    function aplicarTema(esOscuro) {
        document.documentElement.classList.toggle('dark-mode', esOscuro);
        document.body.classList.toggle('dark-mode', esOscuro);
    }

    const initTema = (() => {
        const guardado = leerTema();
        if (guardado) return guardado === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    })();
    aplicarTema(initTema);

    // Cambios de tema disparados desde default.js al guardar en
    // localStorage (llega a este frame como evento 'storage', ya
    // que el cambio ocurre en otro browsing context)
    window.addEventListener('storage', (e) => {
        if (e.key !== TEMA_KEY || !e.newValue) return;
        aplicarTema(e.newValue === 'dark');
    });

    // Propagación directa vía postMessage (default.js reenvía el
    // tema a todos los frames, incluido este, en cuanto el toggle
    // del header cambia)
    window.addEventListener('message', (e) => {
        if (e.data?.siaseTema) aplicarTema(e.data.siaseTema === 'dark');
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!leerTema()) aplicarTema(e.matches);
    });

    // ══════════════════════════════════════════════════════════════
    // 1b. WIDGET DE PERFIL — reemplaza #siase-user-card del header
    // ══════════════════════════════════════════════════════════════

    function toTitleCase(str) {
        return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
    }

    // Formato UANL: "APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2"
    // → muestra "Nombre1 Apellido1"
    function formatDisplayName(fullName) {
        const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '—';
        if (parts.length < 3) return parts.map(toTitleCase).join(' ');
        return `${toTitleCase(parts[0])} ${toTitleCase(parts[2])}`;
    }

    function getInitials(fullName) {
        const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        if (parts.length < 3) return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
        return (parts[2][0] + parts[0][0]).toUpperCase();
    }

    function makeAvatar(foto, initials, extraClass = '') {
        const av = document.createElement('div');
        av.className = `profile-avatar${extraClass ? ' ' + extraClass : ''}`;
        if (foto) {
            const img = document.createElement('img');
            img.src = foto;
            img.alt = initials;
            img.addEventListener('error', () => { img.remove(); av.textContent = initials; });
            av.appendChild(img);
        } else {
            av.textContent = initials;
        }
        return av;
    }

    function buildProfileWidget() {
        let userData = null;
        let salirHref = '#';
        try {
            const raw = localStorage.getItem('siase-user-data');
            if (raw) userData = JSON.parse(raw);
            salirHref = localStorage.getItem('siase-salir-href') || '#';
        } catch (_) { }
        if (!userData) return null;

        const displayName = formatDisplayName(userData.nombre);
        const initials = getInitials(userData.nombre);

        const widget = document.createElement('div');
        widget.id = 'siase-profile-widget';

        // ── Trigger compacto ──────────────────────────────────────
        const trigger = document.createElement('div');
        trigger.className = 'profile-trigger';
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('tabindex', '0');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-haspopup', 'true');

        const triggerInfo = document.createElement('div');
        triggerInfo.className = 'profile-trigger-info';
        triggerInfo.innerHTML =
            `<span class="profile-name">${displayName}</span>` +
            `<span class="profile-role">Estudiante</span>`;

        const chevron = document.createElement('span');
        chevron.className = 'profile-chevron';
        chevron.textContent = '›';

        trigger.appendChild(makeAvatar(userData.foto, initials));
        trigger.appendChild(triggerInfo);
        trigger.appendChild(chevron);

        // ── Dropdown (portal en body, position:fixed) ─────────────
        const dropdown = document.createElement('div');
        dropdown.className = 'profile-dropdown';
        dropdown.setAttribute('aria-hidden', 'true');

        // — Cabecera del dropdown —
        const ddHeader = document.createElement('div');
        ddHeader.className = 'profile-dd-header';

        const ddInfo = document.createElement('div');
        ddInfo.className = 'profile-dd-info';
        ddInfo.innerHTML =
            `<span class="profile-dd-name">${userData.nombre || '—'}</span>` +
            `<span class="profile-dd-role">Estudiante</span>`;

        const ddChevron = document.createElement('span');
        ddChevron.className = 'profile-chevron profile-dd-chevron';
        ddChevron.textContent = '›';

        ddHeader.appendChild(makeAvatar(userData.foto, initials, 'profile-dd-avatar-lg'));
        ddHeader.appendChild(ddInfo);
        ddHeader.appendChild(ddChevron);
        dropdown.appendChild(ddHeader);

        // — Separador —
        const mkSep = () => { const d = document.createElement('div'); d.className = 'profile-dd-sep'; return d; };
        dropdown.appendChild(mkSep());

        // — Campos informativos —
        const fields = document.createElement('div');
        fields.className = 'profile-dd-fields';
        [
            { label: 'Matrícula', value: userData.matricula },
            { label: 'Carrera', value: userData.carrera },
            { label: 'Plan de Estudios', value: userData.plan },
        ].forEach(({ label, value }) => {
            const f = document.createElement('div');
            f.className = 'profile-dd-field';
            f.innerHTML =
                `<span class="profile-dd-label">${label}</span>` +
                `<span class="profile-dd-value">${value || '—'}</span>`;
            fields.appendChild(f);
        });
        dropdown.appendChild(fields);
        dropdown.appendChild(mkSep());

        // — Acciones —
        const actions = document.createElement('div');
        actions.className = 'profile-dd-actions';

        // Toggle de tema
        const toggleRow = document.createElement('label');
        toggleRow.className = 'profile-dd-action profile-dd-toggle-row';
        toggleRow.setAttribute('for', 'menuModoToggle');
        toggleRow.innerHTML = `
            <span class="profile-dd-action-label">🌓 Tema oscuro</span>
            <span class="switch-slider">
                <input type="checkbox" id="menuModoToggle" aria-label="Modo oscuro">
                <span class="slider"></span>
            </span>`;
        actions.appendChild(toggleRow);

        // Botón Salir
        const salirLink = document.createElement('a');
        salirLink.className = 'profile-dd-action profile-dd-salir';
        salirLink.href = salirHref;
        salirLink.innerText = "Ir a UANL en Línea";
        salirLink.addEventListener('click', (e) => {
            window.top.location.href = 'https://www.uanl.mx/enlinea/';
        });
        salirLink.innerHTML = '<span>↪ Salir</span>';

        actions.appendChild(salirLink);

        dropdown.appendChild(actions);

        // Portal: el dropdown va directo al body para evitar clipping
        document.body.appendChild(dropdown);
        widget.appendChild(trigger);

        // ── Sincronización del toggle ────────────────────────────
        const menuToggle = dropdown.querySelector('#menuModoToggle');
        const syncToggle = (esOscuro) => { if (menuToggle) menuToggle.checked = esOscuro; };

        const initOscuro = (() => {
            const t = leerTema(); return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
        })();
        syncToggle(initOscuro);

        menuToggle?.addEventListener('change', () => {
            const esOscuro = menuToggle.checked;
            aplicarTema(esOscuro);
            try { localStorage.setItem(TEMA_KEY, esOscuro ? 'dark' : 'light'); } catch (_) { }
            window.parent?.postMessage({ siaseTema: esOscuro ? 'dark' : 'light' }, '*');
        });

        window.addEventListener('storage', (e) => {
            if (e.key === TEMA_KEY && e.newValue) syncToggle(e.newValue === 'dark');
        });
        window.addEventListener('message', (e) => {
            if (e.data?.siaseTema) syncToggle(e.data.siaseTema === 'dark');
        });

        // ── Abrir / Cerrar ────────────────────────────────────────
        let open = false;

        function updatePos() {
            const r = trigger.getBoundingClientRect();
            dropdown.style.top = (r.bottom + 4) + 'px';
            dropdown.style.left = r.left + 'px';
            dropdown.style.width = r.width + 'px';
        }

        function openDD() {
            open = true;
            updatePos();
            dropdown.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            trigger.classList.add('open');
            dropdown.setAttribute('aria-hidden', 'false');
        }

        function closeDD() {
            open = false;
            dropdown.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.classList.remove('open');
            dropdown.setAttribute('aria-hidden', 'true');
        }

        trigger.addEventListener('click', () => open ? closeDD() : openDD());
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open ? closeDD() : openDD(); }
            if (e.key === 'Escape') closeDD();
        });

        // Click en la cabecera del dropdown también cierra
        ddHeader.addEventListener('click', closeDD);

        // Click fuera → cerrar
        document.addEventListener('click', (e) => {
            if (open && !widget.contains(e.target) && !dropdown.contains(e.target)) closeDD();
        });

        return widget;
    }

    // ══════════════════════════════════════════════════════════════
    // 2. LOCALIZAR MENÚ ORIGINAL
    // ══════════════════════════════════════════════════════════════
    const ulMenu = document.querySelector('ul.menu.collapsible');
    if (!ulMenu) return;

    document.querySelector("#siase-header").remove();

    const wrap = document.createElement('div');
    wrap.id = 'siase-menu-wrap';

    const nav = document.createElement('nav');
    nav.id = 'siase-menu';
    nav.setAttribute('aria-label', 'Menú Escolar');

    // ── Recorre cada <li> de primer nivel ──
    Array.from(ulMenu.children).forEach(li => {
        if (li.tagName !== 'LI') return;

        const anchor = li.querySelector(':scope > a');
        if (!anchor) return;

        const subUl = li.querySelector(':scope > ul.acitem');
        const origId = li.id || null;

        if (subUl) {
            // ── Grupo colapsable (p.ej. "Becas") ──
            const details = document.createElement('details');
            details.className = 'menu-group';
            if (origId) details.id = origId;

            const summary = document.createElement('summary');
            summary.className = 'menu-group-toggle';

            // Extraer texto y aplicar lógica de Marquee para el grupo
            const toggleText = anchor.textContent.trim();
            const toggleSpan = document.createElement('span');
            toggleSpan.className = 'menu-text';
            toggleSpan.textContent = toggleText;

            if (toggleText.length >= 28) {
                summary.classList.add('marquee-btn');
                toggleSpan.classList.add('long-text');
            }

            summary.appendChild(toggleSpan);
            details.appendChild(summary);

            // Wrapper externo (grid container para la animación 0fr→1fr)
            const subNavOuter = document.createElement('div');
            subNavOuter.className = 'menu-group-items';

            // Wrapper interno: overflow:hidden necesario para el truco grid
            const subNav = document.createElement('nav');
            subNav.setAttribute('aria-label', toggleText);

            Array.from(subUl.children).forEach(subLi => {
                if (subLi.tagName !== 'LI') return;
                const subAnchor = subLi.querySelector('a');
                if (!subAnchor) return;

                const newSubA = document.createElement('a');
                newSubA.className = 'menu-sublink';
                Array.from(subAnchor.attributes).forEach(attr => newSubA.setAttribute(attr.name, attr.value));

                // Extraer texto y validar longitud
                const textContent = subAnchor.textContent.trim();
                const textSpan = document.createElement('span');
                textSpan.className = 'menu-text';
                textSpan.textContent = textContent;

                if (textContent.length >= 29) {
                    newSubA.classList.add('marquee-btn');
                    textSpan.classList.add('long-text');
                }

                newSubA.appendChild(textSpan);

                if (subLi.id) newSubA.id = subLi.id;
                subNav.appendChild(newSubA);  // sigue yendo al nav interno
            });

            subNavOuter.appendChild(subNav);
            details.appendChild(subNavOuter);
            nav.appendChild(details);

        } else {
            // ── Link simple ──
            const newA = document.createElement('a');
            newA.className = 'menu-link';
            Array.from(anchor.attributes).forEach(attr => newA.setAttribute(attr.name, attr.value));

            // ESTA ES LA PARTE CLAVE A REEMPLAZAR:
            const textContent = anchor.textContent.trim();

            // 1. Creas el wrapper invisible
            const textWrapper = document.createElement('span');
            textWrapper.className = 'text-mask-wrapper';

            // 2. Creas el span del texto
            const textSpan = document.createElement('span');
            textSpan.className = 'menu-text';
            textSpan.textContent = textContent;

            // 3. Validas la longitud y asignas las clases
            if (textContent.length >= 29) {
                textWrapper.classList.add('has-marquee');
                textSpan.classList.add('long-text');
            }

            // 4. Los unes y los agregas al botón
            textWrapper.appendChild(textSpan);
            newA.appendChild(textWrapper);
            // ------------------------------------

            if (origId) newA.id = origId;
            nav.appendChild(newA);
        }
    });

    // ── Slot del widget de perfil ───────────────────────────────────
    const profileSlot = document.createElement('div');
    profileSlot.id = 'siase-profile-slot';
    wrap.appendChild(profileSlot);
    wrap.appendChild(nav);

    // Intenta montar el widget con los datos disponibles.
    // Devuelve true si lo logró, false si los datos aún no existen.
    function montarWidget() {
        const w = buildProfileWidget();
        if (!w) return false;
        profileSlot.replaceChildren(w);
        return true;
    }

    // ── Estrategia 1: leer directamente del frame "top" (mismo origen) ──
    // header.js escribe userData en localStorage, pero también lo deja
    // en window.__siaseUserData para lectura directa cross-frame.
    // Como todos los frames son del mismo origen (deimos.dgi.uanl.mx),
    // el acceso DOM cruzado está permitido.
    function leerDesdeHeaderFrame() {
        try {
            const frames = window.parent?.frames;
            if (!frames) return false;
            for (let i = 0; i < frames.length; i++) {
                try {
                    const fw = frames[i];
                    const data = fw.__siaseUserData;
                    if (data && data.nombre) {
                        localStorage.setItem('siase-user-data', JSON.stringify(data));
                        return true;
                    }
                } catch (_) { }
            }
        } catch (_) { }
        return false;
    }

    if (leerDesdeHeaderFrame()) {
        montarWidget();
    } else if (!montarWidget()) {
        // ── Estrategia 2: postMessage desde header/default ──
        const onMessage = (e) => {
            if (!e.data?.siaseUserData) return;
            try { localStorage.setItem('siase-user-data', JSON.stringify(e.data.siaseUserData)); } catch (_) { }
            if (montarWidget()) window.removeEventListener('message', onMessage);
        };
        window.addEventListener('message', onMessage);

        // ── Estrategia 3: polling del frame top con backoff ──
        // Cubre el caso en que menu.js cargó antes que header.js
        const delays = [200, 500, 1000, 2000, 3500];
        delays.forEach(ms => setTimeout(() => {
            if (profileSlot.children.length > 0) return;
            if (leerDesdeHeaderFrame()) montarWidget();
        }, ms));
    }

    // ══════════════════════════════════════════════════════════════
    // 3. NOMENCLATURA DE HORARIO — tabla/select → panel colapsable
    // ══════════════════════════════════════════════════════════════
    const tablaHorario = document.querySelector('table.MenuLink, table[bgcolor="#EEEFE7"]');
    let inputsOcultos = [];

    if (tablaHorario) {
        const select = tablaHorario.querySelector('select[name="horario"]');
        const opciones = select
            ? Array.from(select.querySelectorAll('option')).map(o => o.textContent.trim()).filter(Boolean)
            : [];

        const horarioDetails = document.createElement('details');
        horarioDetails.id = 'siase-menu-horario';
        horarioDetails.className = 'menu-group menu-group-aux';

        const summary = document.createElement('summary');
        summary.className = 'menu-group-toggle';

        // Se añade la clase menu-text para mantener la estructura Flexbox intacta
        summary.innerHTML = '<span class="menu-text">Nomenclatura de Horario</span>';
        horarioDetails.appendChild(summary);

        const legend = document.createElement('div');
        legend.className = 'menu-schedule-legend';
        opciones.forEach(txt => {
            const span = document.createElement('span');
            span.textContent = txt;
            legend.appendChild(span);
        });
        horarioDetails.appendChild(legend);

        wrap.appendChild(horarioDetails);

        // Preserva los inputs ocultos (HTMLUsuario, HTMLpassword,
        // custNum) tal cual: no son visibles, pero otros scripts del
        // portal podrían leerlos por nombre.
        inputsOcultos = Array.from(document.querySelectorAll('input[type="hidden" i][name]'));

        tablaHorario.remove();
    }

    // ══════════════════════════════════════════════════════════════
    // 4. LIMPIEZA — restos visuales del markup original
    // ══════════════════════════════════════════════════════════════
    document.getElementById('redondear')?.remove();
    ulMenu.remove();
    document.querySelectorAll('body > center, body > br').forEach(el => el.remove());

    document.body.appendChild(wrap);


    inputsOcultos.forEach(inp => document.body.appendChild(inp));

    // Calcula el desplazamiento real de cada botón marquee según cuánto
    // desborda el texto respecto al ancho del <a> contenedor.
    // Se usa requestAnimationFrame para que el DOM ya esté pintado y
    // offsetWidth devuelva valores reales.
    requestAnimationFrame(() => {
        document.querySelectorAll('.marquee-btn').forEach(btn => {
            const span = btn.querySelector('.long-text');
            if (!span) return;
            const overflow = span.scrollWidth - btn.clientWidth;
            if (overflow > 0) {
                // Desplazamiento en px exacto, con 8px de margen interior
                btn.style.setProperty('--marquee-end', `translateX(-${overflow + 8}px)`);
            }
        });
    });
    // ══════════════════════════════════════════════════════════════
    // 5. CÁLCULO DINÁMICO PARA ANIMACIÓN MARQUEE
    // ══════════════════════════════════════════════════════════════
    function calcularDistanciasMarquee() {
        document.querySelectorAll('.has-marquee').forEach(wrapper => {
            const textSpan = wrapper.querySelector('.long-text');
            if (textSpan) {
                // clientWidth ahora se mide desde el wrapper, que es la "ventana" visual
                const overflow = textSpan.scrollWidth - wrapper.clientWidth + 1;

                if (overflow > 0) {
                    textSpan.style.setProperty('--scroll-dist', `-${overflow}px`);
                } else {
                    textSpan.style.setProperty('--scroll-dist', `0px`);
                }
            }
        });
    }

    calcularDistanciasMarquee();
    window.addEventListener('resize', calcularDistanciasMarquee);


    console.log('%c✦ SIASE+ Menú %cactivo',
        'background:#007bff;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px',
        'background:#0b1121;color:#82b1ff;padding:2px 6px;border-radius:0 4px 4px 0'
    );

})();