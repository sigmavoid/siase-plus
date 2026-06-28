// content_script.js — SIASE+ Nexus

(function () {

    let eventosCalendario = [];

    // ── Escuchar al interceptor (world MAIN → ISOLATED via postMessage) ──
    window.addEventListener('message', (event) => {
        if (
            event.source !== window ||
            !event.data ||
            event.data.source !== 'EXTENSION_CALENDARIO'
        ) return;

        const tareasCrudas = event.data.payload?.Tareas;
        if (!tareasCrudas || tareasCrudas.length === 0) {
            console.warn('[SIASE+] Payload sin tareas.');
            return;
        }

        eventosCalendario = formatearParaGoogle(tareasCrudas);
        console.log(`[SIASE+] ${eventosCalendario.length} tarea(s) guardadas en caché.`);
    });

    // ── API pública para nexus.js (mismo world: ISOLATED) ──
    window.__siasePlus = {
        exportar() {
            if (eventosCalendario.length === 0) {
                console.warn('[SIASE+] Sin tareas en caché.');
                enviarAlBackground({ action: 'notificarSinDatos' });
                return;
            }
            enviarAlBackground({ action: 'exportarEventos', eventos: eventosCalendario });
        }
    };

    // ── Comunicación con el background via puerto persistente ──
    // chrome.runtime.connect() despierta al SW de forma fiable antes de enviar.
    // sendMessage falla si el SW aún no levantó; connect() espera a que esté listo.
    function enviarAlBackground(mensaje) {
        try {
            const puerto = chrome.runtime.connect({ name: 'siase-plus' });

            puerto.onMessage.addListener((resp) => {
                console.log('[SIASE+] Respuesta del background:', resp);
                puerto.disconnect();
            });

            puerto.onDisconnect.addListener(() => {
                if (chrome.runtime.lastError) {
                    console.error('[SIASE+] Error de conexión:', chrome.runtime.lastError.message);
                }
            });

            // El SW ya está despierto en cuanto connect() resuelve — enviamos de inmediato
            puerto.postMessage(mensaje);

        } catch (err) {
            console.error('[SIASE+] No se pudo conectar al background:', err.message);
        }
    }

    // ── Formatear para Google Calendar ──
    function formatearParaGoogle(tareas) {
        return tareas.map((tarea) => ({
            summary: `🎓 ${tarea.Descripcion}`,
            description: `📚 Curso: ${tarea.Curso.Nombre}\n💯 Valor: ${tarea.Valor} pts`,
            start: {
                dateTime: `${tarea.FechaInicio}-06:00`,
                timeZone: 'America/Monterrey',
            },
            end: {
                dateTime: `${tarea.FechaFin}-06:00`,
                timeZone: 'America/Monterrey',
            },
        }));
    }

})();