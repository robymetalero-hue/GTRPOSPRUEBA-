import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Lock, Eye, EyeOff, Sparkles, ShieldAlert, 
    RefreshCw, UserCheck, KeySquare, Store, Zap
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { validateVersionOnLogin, CLIENT_VERSION } from '../utils/versionCheck';
import { hardRefreshApp } from '../utils/appRefresh';
import { 
    getCachedUserByUsername, 
    setCachedUserProfile, 
    setCachedAuthToken, 
    clearAuthCache 
} from '../utils/localForageCache';
import { User } from '../types';

export default function LoginScreen() {
    const { setUser } = useAppContext();
    const [username, setUsername] = useState(() => {
        return localStorage.getItem('last_logged_username') || '';
    });
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    // Status states
    const [loading, setLoading] = useState(false);
    const [isOptimisticValidating, setIsOptimisticValidating] = useState(false);
    const [error, setError] = useState<string | null>(() => {
        const savedErr = sessionStorage.getItem('gtr_login_last_error');
        if (savedErr) {
            sessionStorage.removeItem('gtr_login_last_error');
            return savedErr;
        }
        return null;
    });

    useEffect(() => {
        // Pre-fill username from last active session if available
        const lastUser = localStorage.getItem('last_logged_username');
        if (lastUser && !username) {
            setUsername(lastUser);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanUsername = username.trim();
        const cleanPassword = password.trim();

        if (!cleanUsername || !cleanPassword) {
            setError("Por favor, rellene todos los campos de acceso.");
            return;
        }

        setLoading(true);
        setError(null);
        sessionStorage.removeItem('gtr_login_last_error');

        // Check if we have cached profile for this user in localForage
        let isKnownCachedUser = false;
        let optimisticUser: User | null = null;

        try {
            const cached = await getCachedUserByUsername(cleanUsername);
            if (cached && cached.username.toLowerCase() === cleanUsername.toLowerCase()) {
                isKnownCachedUser = true;
                optimisticUser = cached;
            }
        } catch {}

        if (!optimisticUser) {
            optimisticUser = {
                id: 1,
                username: cleanUsername,
                role: cleanUsername.toLowerCase() === 'admin' ? 'admin' : 'trabajador',
                permissions: {
                    view_reports: true,
                    edit_prices: true,
                    view_inventory: true,
                    apply_discounts: true,
                    manage_credits: true,
                    manage_caja: true,
                    delete_sales: true,
                    view_sales: true,
                    access_ai: true
                }
            };
        }

        // OPTIMISTIC LOADING: Instantly transition to app UI while validating in background
        setIsOptimisticValidating(true);
        setUser(optimisticUser);
        localStorage.setItem('last_logged_username', cleanUsername);

        // Perform authoritative validation in the background
        (async () => {
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: cleanUsername, password: cleanPassword })
                });

                const contentType = res.headers.get("content-type") || "";
                let data: any = null;

                if (contentType.includes("application/json")) {
                    try {
                        data = await res.json();
                    } catch {
                        data = null;
                    }
                }

                if (res.ok && data && data.user) {
                    // Authoritative login success: update token, user profile and localForage
                    if (data.token) {
                        await setCachedAuthToken(data.token);
                    }

                    await setCachedUserProfile(data.user);
                    setUser(data.user);

                    // Check server version
                    const versionCheck = await validateVersionOnLogin(data, {
                        clientVersionOverride: CLIENT_VERSION,
                        onVersionMismatch: (result) => {
                            console.warn(`[Login] Client is outdated: local v${result.clientVersion} vs server v${result.serverVersion}`);
                        }
                    });

                    if (versionCheck.isOutdated) {
                        sessionStorage.setItem('gtr_login_last_error', `Nueva versión disponible (v${versionCheck.serverVersion}). Actualizando terminal...`);
                        await hardRefreshApp();
                        return;
                    }
                } else {
                    // Authoritative login rejected: Roll back optimistic session
                    await clearAuthCache();
                    setUser(null);

                    let errMsg = "Credenciales inválidas de terminal de caja.";
                    if (data && data.error) {
                        errMsg = data.error;
                    } else if (res.status === 502 || res.status === 503 || res.status === 504) {
                        errMsg = "El servidor fiscal se está actualizando o reiniciando. Reintente en unos segundos.";
                    } else if (res.status === 404) {
                        errMsg = "Servicio fiscal no disponible temporalmente.";
                    }
                    sessionStorage.setItem('gtr_login_last_error', errMsg);
                    setError(errMsg);
                }
            } catch (err: any) {
                // If network is disconnected or server is temporarily unreachable
                if (isKnownCachedUser) {
                    // Retain cached session in offline mode
                    window.dispatchEvent(new CustomEvent('triggerNotification', {
                        detail: {
                            message: 'Modo Offline: Sesión iniciada con credenciales cacheadas localmente.',
                            type: 'warn'
                        }
                    }));
                } else {
                    // Rollback if there is no offline cache for this operator
                    await clearAuthCache();
                    setUser(null);
                    const errMsg = "Error de conexión con el servidor fiscal: " + (err?.message || "Servicio no disponible");
                    sessionStorage.setItem('gtr_login_last_error', errMsg);
                    setError(errMsg);
                }
            } finally {
                setLoading(false);
                setIsOptimisticValidating(false);
            }
        })();
    };

    return (
        <div id="login-container" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-50 dark:bg-[#070a10] select-none text-slate-900 overflow-y-auto">
            
            {/* Ambient Background Glow matching POS style */}
            <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-500/5 dark:bg-indigo-500/5 rounded-full blur-[110px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#6366f1]/5 dark:bg-[#6366f1]/5 rounded-full blur-[110px] pointer-events-none" />

            <motion.div 
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[420px] bg-white dark:bg-[#0c111e] rounded-[32px] border border-slate-200/70 dark:border-slate-850/50 shadow-2xl shadow-indigo-900/5 p-7 md:p-8 relative z-10"
            >
                {/* Brand Identity */}
                <div className="flex flex-col items-center text-center gap-3 mb-7">
                    <div className="w-13 h-13 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/15">
                        <Store size={25} className="animate-pulse text-indigo-100" />
                    </div>
                    <div>
                        <h2 className="font-sans font-black text-2xl tracking-tight text-slate-850 dark:text-white leading-tight uppercase">
                            DIGITAL STORE
                        </h2>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                            <Zap size={11} className="text-emerald-500" />
                            <p className="text-[10px] uppercase font-black tracking-widest text-[#6366f1] pr-0.5">
                                Acceso Instantáneo POS & Sincronización
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Error Alert */}
                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div 
                            key="error-alert"
                            initial={{ opacity: 0, height: 0, y: -5 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -5 }}
                            className="p-3 bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/20 rounded-2xl flex items-start gap-2.5 text-rose-600 dark:text-rose-400 text-xs font-bold leading-normal mb-5 overflow-hidden"
                        >
                            <ShieldAlert className="shrink-0 mt-0.5" size={14} />
                            <span>{error}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Login Form */}
                <form 
                    onSubmit={handleLogin}
                    className="flex flex-col gap-4.5"
                >
                    {/* Username input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-1 font-mono">
                            Usuario de Licencia
                        </label>
                        <div className="relative">
                            <input 
                                type="text"
                                placeholder="Ej. admin o roby"
                                className="w-full p-3.5 pl-10.5 bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold leading-normal focus:outline-none focus:border-indigo-505 focus:ring-1 focus:ring-indigo-505 dark:text-white transition"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                disabled={loading}
                                autoFocus={!username}
                            />
                            <UserCheck size={14} className="absolute left-4 top-4.5 text-slate-400" />
                        </div>
                    </div>

                    {/* Password input with visual toggle */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">
                                Contraseña
                            </label>
                        </div>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"}
                                placeholder="Ingrese contraseña de caja"
                                className="w-full p-3.5 pl-10.5 pr-11 bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold leading-normal focus:outline-none focus:border-indigo-550 focus:ring-1 focus:ring-indigo-550 dark:text-white transition font-mono tracking-wide"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                disabled={loading}
                                autoFocus={!!username}
                            />
                            <Lock size={14} className="absolute left-4 top-4.5 text-slate-400" />
                            
                            {/* Small eye preview switcher */}
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none"
                                title={showPassword ? "Ocultar Contraseña" : "Mostrar Contraseña"}
                            >
                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    {/* Submit Login Button */}
                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer disabled:opacity-50 select-none mt-2 active:scale-[0.99]"
                    >
                        {loading ? (
                            <>
                                <RefreshCw size={13} className="animate-spin" />
                                <span>Iniciando Sesión Instantánea...</span>
                            </>
                        ) : (
                            <>
                                <KeySquare size={13} />
                                <span>Ingresar al Sistema</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Footer terms / secure notice */}
                <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-850/60 text-center flex flex-col gap-0.5 pointer-events-none">
                    <span className="text-[9px] uppercase font-black text-slate-405 dark:text-slate-504 tracking-wider leading-none">
                        GTR POS SECURE v2.0
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 leading-none mt-1">
                        Caché local persistente con localForage & Validación en segundo plano
                    </span>
                </div>
            </motion.div>
        </div>
    );
}
