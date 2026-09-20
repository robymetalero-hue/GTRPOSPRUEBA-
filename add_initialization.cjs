const fs = require('fs');

let context = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

if (!context.includes('isInitializing: boolean;')) {
    context = context.replace('interface AppContextType {', 'interface AppContextType {\n    isInitializing: boolean;');
    context = context.replace('const [isOffline, setIsOffline] = useState', 'const [isInitializing, setIsInitializing] = useState(true);\n    const [isOffline, setIsOffline] = useState');
    
    // Replace the initial fetch call
    const initialFetchStr = `
        fetchProducts();
        fetchClients();
        fetchExchangeRate();
        fetchReceiptTemplate();
        fetchDepartments();
    }, []);`;

    const newFetchStr = `
        Promise.all([
            fetchProducts(),
            fetchClients(),
            fetchExchangeRate(),
            fetchReceiptTemplate(),
            fetchDepartments()
        ]).finally(() => {
            setTimeout(() => setIsInitializing(false), 800); // Elegant small delay for animation
        });
    }, []);`;

    context = context.replace(initialFetchStr, newFetchStr);
    
    // Add isInitializing to context value
    context = context.replace('value={{', 'value={{\n            isInitializing,');

    fs.writeFileSync('src/context/AppContext.tsx', context);
    console.log("Added initialization state to AppContext");
}

let appContent = fs.readFileSync('src/App.tsx', 'utf8');

if (!appContent.includes('if (isInitializing)')) {
    // Inject the loader in App.tsx
    appContent = appContent.replace('const { user, logout, view, setView', 'const { user, logout, view, setView, isInitializing');
    
    const loaderCode = `
    if (isInitializing) {
        return (
            <div className="fixed inset-0 bg-[#f8fafc] dark:bg-[#070a10] z-[9999] flex flex-col items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="flex flex-col items-center gap-6"
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-30 rounded-full"></div>
                        <div className="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-2xl relative z-10 border border-indigo-500/50">
                            <span className="text-white font-black text-2xl font-mono tracking-tighter">GTR</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center">
                        <h2 className="text-slate-800 dark:text-slate-200 font-extrabold text-xl tracking-tight uppercase">Inicializando Entorno</h2>
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">
                            <Loader2 size={14} className="animate-spin text-indigo-500" />
                            <span>Cargando datos maestros</span>
                        </div>
                    </div>
                    <div className="w-48 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                        <motion.div 
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                            className="h-full bg-indigo-500 w-1/2 rounded-full"
                        />
                    </div>
                </motion.div>
            </div>
        );
    }
`;
    // Find where the main render happens in AppLayout
    appContent = appContent.replace('return (\n        <div className={`flex', loaderCode + '\n    return (\n        <div className={`flex');
    
    // add Loader2 to lucide imports if not there
    if (!appContent.includes('Loader2')) {
        appContent = appContent.replace('Menu, X,', 'Menu, X, Loader2,');
    }
    
    fs.writeFileSync('src/App.tsx', appContent);
    console.log("Added loader to App.tsx");
}

