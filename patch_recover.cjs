const fs = require('fs');
let content = fs.readFileSync('src/views/LoginScreen.tsx', 'utf8');
content = content.replace(
    /const data = await res.json\(\);/,
    `const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) {
                throw new Error("El servidor no pudo procesar la solicitud. Es posible que el servidor esté inactivo, o la sesión haya expirado.");
            }
            const data = await res.json();`
);
fs.writeFileSync('src/views/LoginScreen.tsx', content);
