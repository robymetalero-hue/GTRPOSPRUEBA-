const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/gemini-3\.5-flash/g, "gemini-2.5-flash");
content = content.replace(/gemini-3\.1-flash-live-preview/g, "gemini-2.0-flash-exp"); // or whatever the live model is

fs.writeFileSync('server.ts', content);
