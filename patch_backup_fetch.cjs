const fs = require('fs');
let content = fs.readFileSync('src/views/ConfiguracionesView.tsx', 'utf8');

content = content.replace(
    /const res = await fetch\('\/api\/backup'\);/g,
    `const res = await fetch('/api/backup', { headers: { 'Authorization': \`Bearer \${localStorage.getItem('auth_token')}\` } });`
);

content = content.replace(
    /if \(!res\.ok\) throw new Error\("No se pudo obtener el archivo de respaldo"\);/g,
    `if (!res.ok) {
                let errMsg = "No se pudo obtener el archivo de respaldo";
                try {
                    const errData = await res.json();
                    if (errData.error) errMsg += ": " + errData.error;
                } catch(e) {}
                throw new Error(errMsg);
            }`
);

fs.writeFileSync('src/views/ConfiguracionesView.tsx', content);
