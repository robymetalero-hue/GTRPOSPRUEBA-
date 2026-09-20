const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

code = code.replace(
    /runtimeCaching:\s*\[/,
    `runtimeCaching: [
            {
              urlPattern: /^\\/api\\/backup/i,
              handler: 'NetworkOnly'
            },`
);

fs.writeFileSync('vite.config.ts', code);
console.log("Patched vite.config.ts");
