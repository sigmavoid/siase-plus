// header.js — SIASE+ Header Refactor
// Elimina la tabla del header y construye un layout moderno en divs.
//
// Estructura resultante:
//   #siase-header
//     #siase-header-top
//       #siase-header-logos   ← logo UANL · banner panorámico · escudo facultad
//       #siase-user-card      ← foto · info usuario · toggle tema · botón Salir
//     #siase-header-nav       ← menú horizontal de links
//
// Comunicación cross-frame:
//   • Lee el tema guardado en localStorage ('siase-tema') al cargar.
//   • Escucha el evento storage para sincronizarse si default.js
//     (u otro frame) cambia el tema mientras está abierto.
//   • Al cambiar el toggle emite el cambio a localStorage para que
//     default.js lo propague al resto de frames.

(function refactorHeader() {


    // ══════════════════════════════════════════════════════════════
    // 0. HELPERS DE TEMA
    // ══════════════════════════════════════════════════════════════
    const TEMA_KEY = 'siase-tema';

    function leerTema() {
        try { return localStorage.getItem(TEMA_KEY); } catch (_) { return null; }
    }
    function guardarTema(esOscuro) {
        try { localStorage.setItem(TEMA_KEY, esOscuro ? 'dark' : 'light'); } catch (_) { }
    }

    function aplicarTema(esOscuro) {
        document.documentElement.classList.toggle('dark-mode', esOscuro);
        document.body.classList.toggle('dark-mode', esOscuro);
    }

    // ══════════════════════════════════════════════════════════════
    // 1. LOCALIZAR TABLA ORIGINAL
    // ══════════════════════════════════════════════════════════════
    const tablaHeader = document.querySelector('body > table.MenuLink, body > table');
    if (!tablaHeader) return;

    // Filas de la tabla
    const filaTop = tablaHeader.querySelector('tr:nth-child(1)');
    const filaNave = tablaHeader.querySelector('tr:nth-child(2)');

    // Celdas fila superior:
    //   td[1] → logo UANL
    //   td[2] → foto carnet (DIV SUPERIOR DERECHO)
    //   td[3] → info personal (DIV SUPERIOR DERECHO)
    //   td[4] → banner panorámico
    //   td[5] → escudo facultad
    const tdLogoUANL = filaTop?.querySelector('td:nth-child(1)');
    const tdFotoCarnet = filaTop?.querySelector('td:nth-child(2)');
    const tdInfoUsuario = filaTop?.querySelector('td:nth-child(3)');
    const tdBannerWide = filaTop?.querySelector('td:nth-child(4)');
    const tdEscudo = filaTop?.querySelector('td:nth-child(5)');

    // Celda del menú de navegación
    const tdMenu = filaNave?.querySelector('td[bgcolor="#094988"], td[bgcolor="094988"], td[colspan]');

    // ══════════════════════════════════════════════════════════════
    // 2. CONSTRUIR #siase-header
    // ══════════════════════════════════════════════════════════════
    const header = document.createElement('div');
    header.id = 'siase-header';

    // ── 2a. Fila superior ──────────────────────────────────────────
    const headerTop = document.createElement('div');
    headerTop.id = 'siase-header-top';

    // ── 2b. Logos (izquierda) ─────────────────────────────────────
    const logosDiv = document.createElement('div');
    logosDiv.id = 'siase-header-logos';

    const imgLogoUANL = tdLogoUANL?.querySelector('img');
    if (imgLogoUANL) {
        imgLogoUANL.removeAttribute('width');
        imgLogoUANL.removeAttribute('height');
        imgLogoUANL.alt = 'Logo UANL';
        imgLogoUANL.src = chrome.runtime.getURL("media/img/header_siase.png");
        logosDiv.appendChild(imgLogoUANL);
    }

    const imgBannerWide = tdBannerWide?.querySelector('img');
    if (imgBannerWide) {
        // imgBannerWide.removeAttribute('width');
        // imgBannerWide.removeAttribute('height');
        // imgBannerWide.alt = 'SIASE';
        // imgBannerWide.classList.add('header-banner-wide');
        // logosDiv.appendChild(imgBannerWide);
        imgBannerWide.remove(); // Elimina la imagen original para evitar que ocupe espacio en su lugar, ya que ahora está dentro de logosDiv
    }

    const imgEscudo = tdEscudo?.querySelector('img');
    if (imgEscudo) {
        // imgEscudo.removeAttribute('width');
        // imgEscudo.removeAttribute('height');
        // imgEscudo.alt = 'Escudo Facultad';
        // imgEscudo.classList.add('header-escudo');
        // logosDiv.appendChild(imgEscudo);
        imgEscudo.remove();
    }

    headerTop.appendChild(logosDiv);

    // ── 2c. Tarjeta de usuario (derecha) ──────────────────────────
    const userCard = document.createElement('div');
    userCard.id = 'siase-user-card';

    // Foto del carnet
    const imgCarnet = tdFotoCarnet?.querySelector('img');
    if (imgCarnet) {
        imgCarnet.removeAttribute('width');
        imgCarnet.removeAttribute('height');
        imgCarnet.removeAttribute('border');
        imgCarnet.alt = 'Foto estudiante';
        userCard.appendChild(imgCarnet);
    }

    // Información textual
    const userInfo = document.createElement('div');
    userInfo.id = 'siase-user-info';

    // Datos que menu.js leerá para construir el widget de perfil
    const userData = { foto: imgCarnet?.src || null, nombre: '—', matricula: '—', carrera: '—', plan: '—' };

    if (tdInfoUsuario) {
        const campos = [
            { label: 'Matrícula', key: 'matricula', regex: /Matr[íi]cula[^:]*:\s*([^\n<]+)/i },
            { label: 'Nombre', key: 'nombre', regex: /Nombre[^:]*:\s*([^\n<]+)/i },
            { label: 'Carrera', key: 'carrera', regex: /Carrera[^:]*:\s*([^\n<]+)/i },
            { label: 'Plan', key: 'plan', regex: /Plan de Estudios[^:]*:\s*([^\n<]+)/i },
        ];
        const tmpDiv = document.createElement('div');
        tmpDiv.innerHTML = tdInfoUsuario.innerHTML;
        const texto = tmpDiv.innerText || tmpDiv.textContent || '';

        campos.forEach(({ label, key, regex }) => {
            const value = (texto.match(regex)?.[1] || '—').trim();
            userData[key] = value;
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'user-field';
            fieldDiv.innerHTML = `<span class="user-label">${label}:</span><span class="user-value">${value}</span>`;
            userInfo.appendChild(fieldDiv);
        });
    }

    // Persiste en localStorage (mismo origen: disponible entre frames)
    try { localStorage.setItem('siase-user-data', JSON.stringify(userData)); } catch (_) { }

    // Expone en window para lectura directa cross-frame (mismo origen).
    // menu.js lo lee via window.parent.frames[i].__siaseUserData sin
    // depender de storage events ni de postMessage ordering.
    window.__siaseUserData = userData;

    // Notifica a default.js para que lo reenvíe a todos los frames
    // (cubre el caso en que menu.js ya escucha pero el polling aún no corrió)
    window.parent?.postMessage({ siaseUserData: userData }, '*');

    userCard.appendChild(userInfo);

    // ── Separador vertical dentro de la tarjeta ──
    const cardSep = document.createElement('div');
    cardSep.className = 'user-card-sep';
    userCard.appendChild(cardSep);

    // ── Controles: toggle + botón Salir ───────────────────────────
    const userControls = document.createElement('div');
    userControls.id = 'siase-user-controls';

    // Toggle tema
    userControls.innerHTML = `
        <div id="header-toggle-container">
            <span class="switch-label">Tema</span>
            <label class="switch-slider" title="Alternar modo claro / oscuro">
                <input type="checkbox" id="headerModoToggle" aria-label="Modo oscuro">
                <span class="slider"></span>
            </label>
        </div>
    `;

    // Botón Salir — extrae el href del link original "Salir" del menú
    const linkSalirOrig = tdMenu
        ? Array.from(tdMenu.querySelectorAll('a'))
            .find(a => a.textContent.trim().toLowerCase() === 'salir')
        : null;
    const salirHref = linkSalirOrig?.href || '#';
    try { localStorage.setItem('siase-salir-href', salirHref); } catch (_) { }


    const btnSalir = document.createElement('button');
    btnSalir.id = 'siase-btn-salir';
    btnSalir.textContent = 'Salir';
    btnSalir.addEventListener('click', () => { window.location.href = salirHref; });
    userControls.appendChild(btnSalir);

    userCard.appendChild(userControls);
    // #siase-user-card ya no se inserta aquí:
    // menu.js lo reconstruye como widget de perfil leyendo siase-user-data de localStorage.
    header.appendChild(headerTop);

    // ── 2d. Barra de menú de navegación ───────────────────────────
    const navBar = document.createElement('div');
    navBar.id = 'siase-header-nav';
    navBar.setAttribute('role', 'navigation');
    navBar.setAttribute('aria-label', 'Menú principal SIASE');

    // SVGs inline para Facebook e Instagram con clase nav-svg-icon
    // fill="currentColor" permite que el CSS controle el color dinámicamente
    const SVG_FACEBOOK = `<svg class="nav-svg-icon" viewBox="-5.5 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M1.188 5.594h18.438c0.625 0 1.188 0.563 1.188 1.188v18.438c0 0.625-0.563 1.188-1.188 1.188h-18.438c-0.625 0-1.188-0.563-1.188-1.188v-18.438c0-0.625 0.563-1.188 1.188-1.188zM14.781 17.281h2.875l0.125-2.75h-3v-2.031c0-0.781 0.156-1.219 1.156-1.219h1.75l0.063-2.563s-0.781-0.125-1.906-0.125c-2.75 0-3.969 1.719-3.969 3.563v2.375h-2.031v2.75h2.031v7.625h2.906v-7.625z" fill="currentColor"/>
    </svg>`;

    const SVG_INSTAGRAM = `<svg class="nav-svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" fill="currentColor"/>
        <path d="M18 5C17.4477 5 17 5.44772 17 6C17 6.55228 17.4477 7 18 7C18.5523 7 19 6.55228 19 6C19 5.44772 18.5523 5 18 5Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M1.65396 4.27606C1 5.55953 1 7.23969 1 10.6V13.4C1 16.7603 1 18.4405 1.65396 19.7239C2.2292 20.8529 3.14708 21.7708 4.27606 22.346C5.55953 23 7.23969 23 10.6 23H13.4C16.7603 23 18.4405 23 19.7239 22.346C20.8529 21.7708 21.7708 20.8529 22.346 19.7239C23 18.4405 23 16.7603 23 13.4V10.6C23 7.23969 23 5.55953 22.346 4.27606C21.7708 3.14708 20.8529 2.2292 19.7239 1.65396C18.4405 1 16.7603 1 13.4 1H10.6C7.23969 1 5.55953 1 4.27606 1.65396C3.14708 2.2292 2.2292 3.14708 1.65396 4.27606ZM13.4 3H10.6C8.88684 3 7.72225 3.00156 6.82208 3.0751C5.94524 3.14674 5.49684 3.27659 5.18404 3.43597C4.43139 3.81947 3.81947 4.43139 3.43597 5.18404C3.27659 5.49684 3.14674 5.94524 3.0751 6.82208C3.00156 7.72225 3 8.88684 3 10.6V13.4C3 15.1132 3.00156 16.2777 3.0751 17.1779C3.14674 18.0548 3.27659 18.5032 3.43597 18.816C3.81947 19.5686 4.43139 20.1805 5.18404 20.564C5.49684 20.7234 5.94524 20.8533 6.82208 20.9249C7.72225 20.9984 8.88684 21 10.6 21H13.4C15.1132 21 16.2777 20.9984 17.1779 20.9249C18.0548 20.8533 18.5032 20.7234 18.816 20.564C19.5686 20.1805 20.1805 19.5686 20.564 18.816C20.7234 18.5032 20.8533 18.0548 20.9249 17.1779C20.9984 16.2777 21 15.1132 21 13.4V10.6C21 8.88684 20.9984 7.72225 20.9249 6.82208C20.8533 5.94524 20.7234 5.49684 20.564 5.18404C20.1805 4.43139 19.5686 3.81947 18.816 3.43597C18.5032 3.27659 18.0548 3.14674 17.1779 3.0751C16.2777 3.00156 15.1132 3 13.4 3Z" fill="currentColor"/>
    </svg>`;

    // Mapa de reemplazos: detecta los <a> que contienen imagen de redes
    // sociales por el src de sus <img> originales
    const SOCIAL_REPLACEMENTS = [
        { srcKey: 'facebook', svg: SVG_FACEBOOK, href: 'https://www.facebook.com/uanlred/?locale=es_LA', label: 'Facebook' },
        { srcKey: 'twitter', svg: SVG_INSTAGRAM, href: 'https://www.instagram.com/geits_fime', label: 'Instagram' },
    ];

    if (tdMenu) {
        const links = Array.from(tdMenu.querySelectorAll('a'));
        links.forEach((a, i) => {
            // Omite el link "Salir" del menú (ya está en la tarjeta)
            if (a.textContent.trim().toLowerCase() === 'salir') return;

            const newA = document.createElement('a');
            // Copia todos los atributos originales
            Array.from(a.attributes).forEach(attr => newA.setAttribute(attr.name, attr.value));

            const imgOrig = a.querySelector('img');

            if (imgOrig) {
                // Es un link de red social — buscar si tiene reemplazo definido
                const srcOrig = (imgOrig.getAttribute('src') || '').toLowerCase();
                const reemplazo = SOCIAL_REPLACEMENTS.find(r => srcOrig.includes(r.srcKey));

                if (reemplazo) {
                    // Sustituye href e inyecta SVG inline
                    newA.href = reemplazo.href;
                    newA.setAttribute('aria-label', reemplazo.label);
                    newA.title = reemplazo.label;
                    newA.innerHTML = reemplazo.svg;
                } else {
                    // Red social sin reemplazo definido: mantiene img original
                    newA.innerHTML = a.innerHTML;
                }

                newA.classList.add('nav-social');
            } else {
                newA.innerHTML = a.innerHTML;
            }

            navBar.appendChild(newA);

            // Separador justo antes del primer link con icono
            const sig = links[i + 1];
            if (sig && sig.querySelector('img') && !imgOrig) {
                const sep = document.createElement('span');
                sep.className = 'nav-sep';
                sep.setAttribute('aria-hidden', 'true');
                navBar.appendChild(sep);
            }
        });
    }


    header.appendChild(navBar);


    // ══════════════════════════════════════════════════════════════
    // 3. REEMPLAZAR tabla por #siase-header
    // ══════════════════════════════════════════════════════════════
    tablaHeader.parentNode.replaceChild(header, tablaHeader);

    // ══════════════════════════════════════════════════════════════
    // 4. LÓGICA DEL TOGGLE
    // ══════════════════════════════════════════════════════════════
    const toggle = document.getElementById('headerModoToggle');

    const initTema = (() => {
        const guardado = leerTema();
        if (guardado) return guardado === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    })();

    if (toggle) toggle.checked = initTema;
    aplicarTema(initTema);

    if (toggle) {
        toggle.addEventListener('change', () => {
            const esOscuro = toggle.checked;
            aplicarTema(esOscuro);
            guardarTema(esOscuro);
            window.parent?.postMessage({ siaseTema: esOscuro ? 'dark' : 'light' }, '*');
        });
    }

    // Escucha cambios del tema desde default.js (vía storage event)
    window.addEventListener('storage', (e) => {
        if (e.key !== TEMA_KEY) return;
        const esOscuro = e.newValue === 'dark';
        if (toggle) toggle.checked = esOscuro;
        aplicarTema(esOscuro);
    });

    // Escucha postMessage desde default.js o cualquier otro frame
    window.addEventListener('message', (e) => {
        if (e.data?.siaseTema) {
            const esOscuro = e.data.siaseTema === 'dark';
            if (toggle) toggle.checked = esOscuro;
            aplicarTema(esOscuro);
        }
    });

})();