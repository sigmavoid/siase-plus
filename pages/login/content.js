// content.js
// Este script se ejecutará en la página del SIASE una vez cargada

console.log("Extensión SIASE Mejorado: Script inyectado con éxito.");

// Aquí puedes añadir en el futuro código para autocompletar,
// realizar validaciones o cambiar la estructura HTML dinámicamente.
// Ejemplo: Cambiar placeholders de los inputs si no los tienen
const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
inputs.forEach(input => {
    if (!input.placeholder && input.name.toLowerCase().includes('htmlusucve')) {
        input.placeholder = 'Ingresa tu matrícula';
    }
    if (!input.placeholder && input.type === 'password') {
        input.placeholder = 'Ingresa tu contraseña';
    }
});
