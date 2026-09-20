const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf8');
code = code.replace("setKioskMode: (k: boolean) => void;\n    setKioskMode: (k: boolean) => void;", "setKioskMode: (k: boolean) => void;");
fs.writeFileSync('src/context/AppContext.tsx', code);
