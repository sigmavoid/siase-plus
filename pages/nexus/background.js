// background.js — SIASE+ Nexus

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// ── Escuchar conexiones por puerto (más fiable que onMessage en MV3) ──
chrome.runtime.onConnect.addListener((puerto) => {
    if (puerto.name !== 'siase-plus') return;

    puerto.onMessage.addListener(async (mensaje) => {

        if (mensaje.action === 'notificarSinDatos') {
            notificar('Sin tareas', 'Abre la vista Calendario en Nexus primero.');
            puerto.postMessage({ ok: false, razon: 'sin_datos' });
            return;
        }

        if (mensaje.action === 'exportarEventos') {
            try {
                const resultado = await manejarExportacion(mensaje.eventos);
                puerto.postMessage(resultado);
            } catch (err) {
                console.error('[SIASE+] Error en exportación:', err);
                puerto.postMessage({ ok: false, razon: err.message });
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────
// Flujo de exportación
// ─────────────────────────────────────────────────────────────
async function manejarExportacion(eventos) {
    let token;
    try {
        token = await obtenerToken();
    } catch (err) {
        notificar('Error de autenticación', 'No se pudo obtener acceso a Google Calendar.');
        throw err;
    }

    const { creados, fallidos } = await crearEventos(eventos, token);

    if (fallidos === 0) {
        notificar('✅ Exportación completada', `${creados} tarea(s) agregada(s) a tu Google Calendar.`);
    } else {
        notificar('⚠️ Exportación parcial', `${creados} exportada(s), ${fallidos} con error.`);
    }

    return { ok: true, creados, fallidos };
}

// ─────────────────────────────────────────────────────────────
// OAuth2
// ─────────────────────────────────────────────────────────────
function obtenerToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                reject(new Error(chrome.runtime.lastError?.message || 'Token vacío'));
            } else {
                resolve(token);
            }
        });
    });
}

// ─────────────────────────────────────────────────────────────
// Crear eventos (secuencial para evitar 429)
// ─────────────────────────────────────────────────────────────
async function crearEventos(eventos, token) {
    let creados = 0;
    let fallidos = 0;

    for (const evento of eventos) {
        try {
            const res = await fetch(CALENDAR_API, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(evento),
            });

            if (res.ok) {
                creados++;
            } else {
                const err = await res.json().catch(() => ({}));
                console.error('[SIASE+] Evento no creado:', err);
                fallidos++;
            }
        } catch (err) {
            console.error('[SIASE+] Error de red al crear evento:', err);
            fallidos++;
        }
    }

    return { creados, fallidos };
}

// ─────────────────────────────────────────────────────────────
// Notificación del sistema
// ─────────────────────────────────────────────────────────────
function notificar(titulo, mensaje) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: titulo,
        message: mensaje,
    });
}