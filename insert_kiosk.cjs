const fs = require('fs');
let code = fs.readFileSync('src/views/ConfiguracionesView.tsx', 'utf8');

const target = "{/* Version PUSH Controller for Admins */}";

const kioskComponent = `            {/* Modo Quiosco / Terminal Seguro */}
            <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850/40 p-6 flex flex-col gap-6">
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-850/50 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                            <Lock size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-extrabold text-slate-850 dark:text-white uppercase tracking-wider">Modo Quiosco / Terminal Seguro</h2>
                            <p className="text-[11px] text-slate-400 mt-1 font-semibold">Bloquea la interfaz gráfica y oculta la barra de navegación para cajeros.</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-4">
                        <Info className="text-indigo-500 shrink-0 mt-0.5" size={18} />
                        <div className="flex-1">
                            <h3 className="text-xs font-bold text-slate-850 dark:text-white mb-1.5">Bloqueo de Navegación del Terminal</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                Al activar esta opción, la aplicación forzará la vista completa de la terminal de <strong>Caja (POS)</strong> y deshabilitará la navegación para cualquier usuario que no sea administrador. Útil para terminales dedicadas exclusivamente a ventas.
                            </p>
                        </div>
                        <div className="pt-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={kioskMode} 
                                    onChange={(e) => {
                                        const val = e.target.checked;
                                        setKioskMode(val);
                                        if (val && document.documentElement.requestFullscreen) {
                                            document.documentElement.requestFullscreen().catch(() => {});
                                        } else if (!val && document.fullscreenElement) {
                                            document.exitFullscreen().catch(() => {});
                                        }
                                        showNotification(\`Modo Quiosco \${val ? 'Activado' : 'Desactivado'}\`, 'success');
                                    }}
                                    disabled={!isAdmin}
                                />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            `;

code = code.replace(target, kioskComponent + target);
fs.writeFileSync('src/views/ConfiguracionesView.tsx', code);
console.log("Kiosk section inserted in ConfiguracionesView.");
