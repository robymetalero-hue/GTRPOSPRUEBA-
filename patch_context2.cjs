const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

code = code.replace("kioskMode: boolean;", "kioskMode: boolean;\n    setKioskMode: (k: boolean) => void;");

if (!code.includes("const [kioskMode, setKioskMode] = useState")) {
    code = code.replace("const [user, setUser] = useState<User | null>(null);", "const [user, setUser] = useState<User | null>(null);\n    const [kioskMode, setKioskMode] = useState<boolean>(false);");
}

if (!code.includes("savedKiosk")) {
    code = code.replace("const savedTheme = localStorage.getItem('theme');", "const savedKiosk = localStorage.getItem('kioskMode');\n        if (savedKiosk) setKioskMode(savedKiosk === 'true');\n        const savedTheme = localStorage.getItem('theme');");
}

fs.writeFileSync('src/context/AppContext.tsx', code);
