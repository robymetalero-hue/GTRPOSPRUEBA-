const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
    'const PORT = process.env.PORT || 3000;',
    'const PORT = parseInt(process.env.PORT || "3000", 10);'
);

fs.writeFileSync('server.ts', code);
