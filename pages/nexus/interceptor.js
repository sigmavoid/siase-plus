// interceptor.js
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

// Interceptamos la apertura de la conexión para guardar la URL
XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
};

// Interceptamos el envío para leer la respuesta cuando llegue
XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
        // CAMBIA 'ConsultarTareas' por el segmento de URL que encontraste en el Paso 1
        if (this._url.includes('https://api.nexus.uanl.mx/WebApi/Tarea/ConsultarTareas') && this.responseText) {
            try {
                const jsonData = JSON.parse(this.responseText);
                console.log("🔥 ¡JSON INTERCEPTADO CON ÉXITO!", jsonData);

                // Enviamos el JSON desde el contexto de la página hacia tu Content Script
                window.postMessage({
                    source: 'EXTENSION_CALENDARIO',
                    payload: jsonData
                }, '*');
            } catch (e) {
                console.error("Error al parsear el JSON interceptado", e);
            }
        }
    });
    return originalSend.apply(this, arguments);
};