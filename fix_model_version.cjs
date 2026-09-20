const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace("model: 'gemini-1.5-flash'", "model: 'gemini-3.5-flash'");

fs.writeFileSync('server.ts', content);
