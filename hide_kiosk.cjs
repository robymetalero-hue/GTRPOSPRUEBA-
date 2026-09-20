const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const isKioskLockedVar = "\n    const isKioskLocked = kioskMode && user?.role !== 'admin';\n";
code = code.replace("const lowStockCount", isKioskLockedVar + "    const lowStockCount");

const effectForceView = `
    useEffect(() => {
        if (isKioskLocked && view !== 'pos') {
            setView('pos');
        }
    }, [isKioskLocked, view, setView]);
`;
code = code.replace("useEffect(() => {\n        if (user) {", effectForceView + "    useEffect(() => {\n        if (user) {");

// Hide desktop sidebar
code = code.replace(
    `<div className="hidden lg:block lg:w-[260px] h-full shrink-0">`,
    `{!isKioskLocked && <div className="hidden lg:block lg:w-[260px] h-full shrink-0">`
);
code = code.replace(
    `                {sidebarContent}\n            </div>`,
    `                {sidebarContent}\n            </div>}`
);

// Hide mobile sidebar logic wrapper
code = code.replace(
    `<AnimatePresence>\n                {mobileSidebarOpen && (`,
    `<AnimatePresence>\n                {!isKioskLocked && mobileSidebarOpen && (`
);

// Hide mobile top bar header
code = code.replace(
    `<header className="lg:hidden h-14 bg-white dark:bg-[#0c111e] border-b border-slate-200/60 dark:border-slate-850/40 px-4 flex items-center justify-between shrink-0 select-none z-[50] relative">`,
    `{!isKioskLocked && (<header className="lg:hidden h-14 bg-white dark:bg-[#0c111e] border-b border-slate-200/60 dark:border-slate-850/40 px-4 flex items-center justify-between shrink-0 select-none z-[50] relative">`
);
code = code.replace(
    `                    </div>\n                </header>\n\n                {/* Main page view content display */}`,
    `                    </div>\n                </header>)}\n\n                {/* Main page view content display */}`
);

fs.writeFileSync('src/App.tsx', code);
console.log("App.tsx modified for Kiosk mode");
