const fs = require('fs');
let content = fs.readFileSync('src/views/LoginScreen.tsx', 'utf8');

const oldLogic = `            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) {
                throw new Error("La sesión del servidor de desarrollo ha expirado o la URL no es válida. Abre la app en tu navegador web para restaurar la sesión o genera una versión de producción (Share) con un servidor activo.");
            }
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) {
                throw new Error("El servidor no pudo procesar la solicitud. Es posible que el servidor esté inactivo, o la sesión haya expirado.");
            }`;

const newLogic = `            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) {
                throw new Error("El servidor no pudo procesar la solicitud. Es posible que el servidor esté inactivo o la sesión haya expirado.");
            }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/views/LoginScreen.tsx', content);
