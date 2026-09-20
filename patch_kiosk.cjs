const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

if (!code.includes('const [kioskMode, setKioskMode]')) {
    code = code.replace(
        "const [isInitializing, setIsInitializing] = useState(true);",
        "const [isInitializing, setIsInitializing] = useState(true);\n    const [kioskMode, setKioskMode] = useState(() => localStorage.getItem('kioskMode') === 'true');"
    );
    fs.writeFileSync('src/context/AppContext.tsx', code);
    console.log("Patched kioskMode state");
}
