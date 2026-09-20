const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace("if (isInitializing, kioskMode) {", "if (isInitializing) {");
fs.writeFileSync('src/App.tsx', code);
