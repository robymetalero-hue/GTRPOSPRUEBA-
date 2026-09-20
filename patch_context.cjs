const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

if (!code.includes('kioskMode')) {
    code = code.replace('isInitializing: boolean;', 'isInitializing: boolean;\n    kioskMode: boolean;\n    setKioskMode: (k: boolean) => void;');
    
    const stateHook = "const [darkMode, setDarkMode] = useState<boolean>(true);";
    const newHook = stateHook + "\n    const [kioskMode, setKioskMode] = useState<boolean>(false);";
    code = code.replace(stateHook, newHook);
    
    const useEffectMount = "const savedTheme = localStorage.getItem('theme');";
    const newMount = "const savedKiosk = localStorage.getItem('kioskMode');\n        if (savedKiosk) setKioskMode(savedKiosk === 'true');\n        " + useEffectMount;
    code = code.replace(useEffectMount, newMount);
    
    const valueProvide = "darkMode,\n            setDarkMode,";
    const newValueProvide = "darkMode,\n            setDarkMode,\n            kioskMode,\n            setKioskMode: (k) => { setKioskMode(k); localStorage.setItem('kioskMode', String(k)); },";
    code = code.replace(valueProvide, newValueProvide);
    
    fs.writeFileSync('src/context/AppContext.tsx', code);
    console.log("Patched AppContext.tsx");
}
