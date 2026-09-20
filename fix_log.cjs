const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace('console.error("Gemini API Error:", geminiError);', 'console.error("Gemini API Error details:", JSON.stringify(geminiError, Object.getOwnPropertyNames(geminiError)));');

fs.writeFileSync('server.ts', content);
