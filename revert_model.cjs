const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace("model: 'gemini-2.0-flash'", "model: 'gemini-2.5-flash'");

fs.writeFileSync('server.ts', content);
