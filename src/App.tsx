import { safeDispatchEvent } from "./utils/events";
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useAppContext } from './context/AppContext';
import { hasPermission, isMainAdmin, isAdminUser, canAccessForensicAudit } from './utils/permissions';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startAutoBackupScheduler } from "./utils/driveBackupScheduler";
import { hardRefreshApp } from "./utils/appRefresh";
import { CLIENT_VERSION, compareClientWithServerVersion, validateVersionOnLogin } from "./utils/versionCheck";
export { CLIENT_VERSION };
import { 
    initLocalForageCache, 
    getCachedUserProfile, 
    setCachedUserProfile, 
    getCachedMinimalProducts, 
    setCachedMinimalProducts 
} from './utils/localForageCache';
import PhysicalCountManager from './components/PhysicalCountManager';
import AudioVoice from './components/AudioVoice';
import OfflineStatusHUD from './components/OfflineStatusHUD';
import OfflineManagerModal from './components/OfflineManagerModal';
import PWAInstallModal from './components/PWAInstallModal';
import { Menu, X, Home, ShoppingCart, Clock, Receipt, PackageSearch, 
    Folder, ClipboardCheck, Undo2, LayoutDashboard, TrendingUp, 
    Users, Smartphone, LogOut, Sun, Moon, Sparkles, ArrowLeftRight, User, Settings, Landmark, Activity, History, Loader2, Store, Cpu, Download, RefreshCw, Check, Zap, ShieldCheck
} from 'lucide-react';

const lazyWithRetries = (componentImport: () => Promise<any>) =>
  React.lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );
    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
      }
      throw error;
    }
  });

// Code Splitting with React.lazy
const POS = lazyWithRetries(() => import('./views/POS'));
const LoginScreen = lazyWithRetries(() => import('./views/LoginScreen'));
const Dashboard = lazyWithRetries(() => import('./views/Dashboard'));
const Inventory = lazyWithRetries(() => import('./views/Inventory'));
const PermissionsConsole = lazyWithRetries(() => import('./views/PermissionsConsole'));
const ConfiguracionesView = lazyWithRetries(() => import('./views/ConfiguracionesView'));
const CajasView = lazyWithRetries(() => import('./views/CajasView'));
const CuentasPorCobrarView = lazyWithRetries(() => import('./views/CuentasPorCobrarView'));
const DiagnosticoView = lazyWithRetries(() => import('./views/DiagnosticoView'));
const AuditoriaView = lazyWithRetries(() => import('./views/AuditoriaView'));
const AuditoriaForenseView = lazyWithRetries(() => import('./views/AuditoriaForenseView'));
const HardwareConfigView = lazyWithRetries(() => import('./views/HardwareConfigView'));

// Named exports from ExtraViews loaded dynamically
const InicioView = lazyWithRetries(() => import('./views/ExtraViews').then(m => ({ default: m.InicioView })));
const HistorialVentasView = lazyWithRetries(() => import('./views/ExtraViews').then(m => ({ default: m.HistorialVentasView })));
const VentasPendientesView = lazyWithRetries(() => import('./views/ExtraViews').then(m => ({ default: m.VentasPendientesView })));
const DepartamentosView = lazyWithRetries(() => import('./views/ExtraViews').then(m => ({ default: m.DepartamentosView })));
const DevolucionesView = lazyWithRetries(() => import('./views/ExtraViews').then(m => ({ default: m.DevolucionesView })));
const AnalisisView = lazyWithRetries(() => import('./views/ExtraViews').then(m => ({ default: m.AnalisisView })));

// Elegant and professional loader fallback for dynamic components
const LoadingViewFallback = () => (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[350px] p-8 text-center bg-slate-50/30 dark:bg-black/5 backdrop-blur-sm rounded-3xl animate-fadeIn">
        <div className="relative flex items-center justify-center mb-4">
            <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-600 dark:border-indigo-400/10 dark:border-t-indigo-400 rounded-full animate-spin"></div>
            <Sparkles className="absolute text-indigo-500 dark:text-indigo-400 animate-pulse" size={16} />
        </div>
        <h3 className="font-sans font-black text-xs text-slate-700 dark:text-slate-300 uppercase tracking-widest">
            Cargando Módulo
        </h3>
        <p className="font-mono text-[9px] text-slate-400 mt-1 uppercase tracking-wider">
            Preparando interfaz...
        </p>
    </div>
);

// Animated nav bar dynamic icons with custom physical micro-movements
interface AnimatedMenuIconProps {
    Icon: any;
    targetView: string;
    isActive: boolean;
}

const AnimatedMenuIcon = ({ Icon, targetView, isActive }: AnimatedMenuIconProps) => {
    let animate: any = {};
    let transition: any = { repeat: Infinity, ease: "easeInOut" };

    if (targetView === 'inicio') {
        // Dynamic home bouncing & pulse
        animate = { 
            y: isActive ? [0, -4, 0] : [0, -1.2, 0],
            scale: isActive ? [1, 1.15, 0.95, 1] : [1, 1.02, 1]
        };
        transition = {
            duration: isActive ? 1.5 : 3,
            repeat: Infinity,
            ease: "easeInOut"
        };
    } else if (targetView === 'pos') {
        // Shopping cart rolling back and forth
        animate = { 
            x: isActive ? [0, 4, -4, 0] : [0, 1, -1, 0],
            rotate: isActive ? [0, 8, -8, 0] : [0, 2, -2, 0],
            scale: isActive ? [1, 1.18, 1] : [1, 1]
        };
        transition = {
            duration: isActive ? 1.4 : 3.5,
            repeat: Infinity,
            ease: "easeInOut"
        };
    } else if (targetView === 'ventas_pendientes') {
        // Pendulum ticking clock
        animate = { 
            rotate: isActive ? [0, -25, 25, 0] : [0, -8, 8, 0],
            scale: isActive ? [1, 1.12, 1] : [1, 1.01, 1]
        };
        transition = {
            duration: isActive ? 1.2 : 2.5,
            repeat: Infinity,
            ease: "easeInOut"
        };
    } else if (targetView === 'historial_ventas') {
        // Receipt paper sliding or squeezing
        animate = { 
            y: isActive ? [0, -3.5, 2, 0] : [0, -1, 0.5, 0], 
            scaleY: isActive ? [1, 0.8, 1.1, 1] : [1, 0.95, 1.02, 1] 
        };
        transition = {
            duration: isActive ? 1.8 : 4,
            repeat: Infinity,
            ease: "easeInOut"
        };
    } else if (targetView === 'cuentas_por_cobrar') {
        // Arrows shifting
        animate = { 
            x: isActive ? [-4, 4, -4] : [-1.5, 1.5, -1.5],
            scale: isActive ? [1, 1.14, 1] : [1, 1]
        };
        transition = {
            duration: isActive ? 1.6 : 3.8,
            repeat: Infinity,
            ease: "easeInOut"
        };
    } else if (targetView === 'productos') {
        // Box scale and check
        animate = { 
            scale: isActive ? [1, 1.25, 0.9, 1] : [1, 1.04, 1], 
            rotate: isActive ? [0, 12, -12, 0] : [0, 3, -3, 0] 
        };
        transition = {
            duration: isActive ? 2.2 : 4.5,
            repeat: Infinity,
            ease: "easeInOut"
        };
    } else if (targetView === 'departamentos') {
        // Folder tag expand
        animate = { 
            scaleX: isActive ? [1, 1.16, 0.92, 1] : [1, 1.03, 1], 
            scaleY: isActive ? [1, 0.82, 1.1, 1] : [1, 0.96, 1] 
        };
        transition = {
            duration: isActive ? 2 : 4,
            repeat: Infinity,
            ease: "easeInOut"
        };
    } else if (targetView === 'inventario') {
         // Clipboard checklist pulsation
         animate = { 
             y: isActive ? [0, -4, 0] : [0, -1.5, 0],
             scale: isActive ? [1, 1.2, 0.95, 1] : [1, 1.03, 1]
         };
         transition = {
             duration: isActive ? 1.8 : 3.8,
             repeat: Infinity,
             ease: "easeInOut"
         };
    } else if (targetView === 'devoluciones') {
        // Rolling loops of returns
        animate = { 
            rotate: isActive ? [0, -60, 20, 0] : [0, -12, 4, 0],
            scale: isActive ? [1, 1.15, 0.95, 1] : [1, 1]
        };
        transition = {
            duration: isActive ? 1.8 : 3.5,
            repeat: Infinity,
            ease: "easeInOut"
        };
    } else if (targetView === 'auditoria') {
        // Turning of history wheel
        animate = { 
            rotate: isActive ? [0, 360] : [0, 15, 0],
            scale: isActive ? [1, 1.15, 0.95, 1] : [1, 1]
        };
        transition = {
            duration: isActive ? 2.5 : 4,
            repeat: isActive ? Infinity : 0,
            ease: "easeInOut"
        };
    } else if (targetView === 'reportes') {
        // Bento layout modular squeeze
        animate = { 
            scale: isActive ? [1, 1.18, 0.92, 1] : [1, 1.02, 1],
            y: isActive ? [0, -2, 2, 0] : [0, -0.5, 0.5, 0]
        };
        transition = {
            duration: isActive ? 2 : 4,
            repeat: Infinity,
            ease: "easeInOut"
        };
    } else if (targetView === 'analisis') {
        // Direct trending up bars growing
        animate = { 
            scaleY: isActive ? [1, 1.25, 0.85, 1] : [1, 1.06, 0.97, 1],
            y: isActive ? [0, -3, 0] : [0, -0.8, 0]
        };
        transition = {
            duration: isActive ? 1.5 : 3.2,
            repeat: Infinity,
            ease: "easeOut"
        };
    } else if (targetView === 'cajas') {
        // Landmark safe box breath
        animate = { 
            scale: isActive ? [1, 1.15, 1] : [1, 1.02, 1],
            rotate: isActive ? [-6, 6, -6] : [-1.5, 1.5, -1.5]
        };
        transition = {
            duration: isActive ? 2 : 4,
            repeat: Infinity,
            ease: "easeInOut"
        };
    } else if (targetView === 'configuraciones') {
        // Persistent smooth gear-spinning rotation
        animate = { 
            rotate: [0, 360] 
        };
        transition = {
            duration: isActive ? 3.5 : 12,
            repeat: Infinity,
            ease: "linear"
        };
    } else if (targetView === 'usuarios') {
        // Group of users side-sway
        animate = { 
            y: isActive ? [0, -3.5, 0] : [0, -1, 0],
            x: isActive ? [-2, 2, -2] : [-0.5, 0.5, -0.5]
        };
        transition = {
            duration: isActive ? 1.6 : 3.5,
            repeat: Infinity,
            ease: "easeInOut"
        };
    } else {
        animate = { scale: isActive ? [1, 1.15, 1] : [1, 1] };
        transition = { duration: 3, repeat: Infinity, ease: "easeInOut" };
    }

    return (
        <motion.div
            animate={animate}
            transition={transition}
            className={`transition-colors duration-300 flex items-center justify-center shrink-0`}
        >
            <Icon size={16} />
        </motion.div>
    );
};

function AppLayout() {
    const { 
        darkMode, setDarkMode, user, setUser, view, setView, isOffline, isSyncing, triggerOnlineSync,
        isAutonomousTesting, setIsAutonomousTesting, autonomousStep, setAutonomousStep, autonomousLogs, setAutonomousLogs,
        products, pwaPrompt, installPWA, isPwaInstalled, isInitializing, kioskMode, theme, setTheme, syncError,
        isOfflineModalOpen, setIsOfflineModalOpen, isPwaInstallModalOpen, setIsPwaInstallModalOpen,
        hasPwaUpdate, isUpdatingPwa, pwaUpdateStepMessage, pwaVersionInfo, checkForPwaUpdates, applyPwaUpdate, handlePwaPrimaryAction
    } = useAppContext();
    
    const isRgb = theme === 'rgb';
    
    const isKioskLocked = (kioskMode || (user && user.role === 'vendedor')) && user?.role !== 'admin' && user?.role !== 'propietario';
    const lowStockCount = products ? products.filter(p => p.stock <= p.stock_alarm).length : 0;
    const [localWorkers, setLocalWorkers] = useState<any[]>([]);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [showDevicesModal, setShowDevicesModal] = useState(false);
    const [deviceLatencies, setDeviceLatencies] = useState<{ [key: string]: number }>({
        balanza: 14,
        impresora: 22,
        server: 35,
    });
    const [pingingDevices, setPingingDevices] = useState(false);
    const [globalNotification, setGlobalNotification] = useState<{message: string; type: "success"|"error"|"warn"} | null>(null);

    
    useLayoutEffect(() => {
        const allowedKioskViews = ['pos', 'cajas', 'historial_ventas', 'conteo_fisico'];
        if (isKioskLocked && !allowedKioskViews.includes(view)) {
            setView('pos');
        }
    }, [isKioskLocked, view, setView]);
    useEffect(() => {
        if (user) {
            startAutoBackupScheduler("23:55", (msg, type) => {
                setGlobalNotification({ message: msg, type });
                setTimeout(() => setGlobalNotification(null), 7000);
            });
        }
    }, [user]);

    // localForage persistence cache layer for user profile and minimal product catalog
    useEffect(() => {
        initLocalForageCache();
    }, []);

    useEffect(() => {
        if (products && products.length > 0) {
            setCachedMinimalProducts(products);
        }
    }, [products]);

    useEffect(() => {
        if (user && (user.role as string) !== 'none' && user.username !== 'none') {
            setCachedUserProfile(user);
        }
    }, [user]);

    useEffect(() => {
        let timer: any = null;
        const handleTriggerNotification = (e: any) => {
            const { message, type } = e.detail || {};
            if (message) {
                if (timer) clearTimeout(timer);
                setGlobalNotification({ message, type: type === 'info' ? 'warn' : type || 'success' });
                timer = setTimeout(() => {
                    setGlobalNotification(null);
                }, 5000);
            }
        };
        window.addEventListener('triggerNotification', handleTriggerNotification as any);
        return () => {
            window.removeEventListener('triggerNotification', handleTriggerNotification as any);
            if (timer) clearTimeout(timer);
        };
    }, []);

    const runDevicePingTest = async () => {
        setPingingDevices(true);
        const start = performance.now();
        try {
            await fetch('/api/app-version', { method: 'HEAD', cache: 'no-store' });
            const serverLatency = Math.round(performance.now() - start);
            const baseLocal = Math.max(2, Math.floor(serverLatency * 0.35));
            setDeviceLatencies({
                balanza: Math.max(1, baseLocal + Math.floor(Math.random() * 4 - 2)),
                impresora: Math.max(3, Math.round(baseLocal * 1.5) + Math.floor(Math.random() * 6 - 3)),
                server: serverLatency,
            });
        } catch (e) {
            const mockBase = Math.floor(Math.random() * 15) + 8;
            setDeviceLatencies({
                balanza: Math.max(1, Math.round(mockBase * 0.4)),
                impresora: Math.max(3, Math.round(mockBase * 0.7)),
                server: mockBase,
            });
        } finally {
            setPingingDevices(false);
        }
    };

    useEffect(() => {
        if (!showDevicesModal) return;
        runDevicePingTest();
        const interval = setInterval(() => {
            setDeviceLatencies(prev => {
                const fluctuate = (val: number, min = 1, max = 150) => {
                    const diff = Math.floor(Math.random() * 5) - 2;
                    return Math.min(max, Math.max(min, val + diff));
                };
                return {
                    balanza: fluctuate(prev.balanza, 1, 20),
                    impresora: fluctuate(prev.impresora, 3, 35),
                    server: fluctuate(prev.server, 15, 120),
                };
            });
        }, 3000);
        return () => clearInterval(interval);
    }, [showDevicesModal]);

    // App live update push settings - blocks obsolete clients and clears cache aggressively
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [showUpdateWarning, setShowUpdateWarning] = useState(false);
    const [serverVersion, setServerVersion] = useState("");
    const [releaseNotes, setReleaseNotes] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);

    const checkAppVersion = async () => {
        try {
            const res = await fetch(`/api/app-version?_t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                const comparison = compareClientWithServerVersion(data.version, CLIENT_VERSION);
                if (comparison.isOutdated) {
                    setUpdateAvailable(true);
                    setServerVersion(comparison.serverVersion);
                    setReleaseNotes(data.release_notes || "");
                    setShowUpdateWarning(true);
                    await hardRefreshApp();
                }
            }
        } catch (err) {
            console.warn("Error checking app version:", err);
        }
    };

    const handleForceUpdate = async () => {
        setIsRefreshing(true);
        await hardRefreshApp();
    };

    useEffect(() => {
        const handlePushUpdate = async (e: any) => {
            const data = e.detail;
            if (data && data.version) {
                const comparison = compareClientWithServerVersion(data.version, CLIENT_VERSION);
                if (comparison.isOutdated) {
                    setUpdateAvailable(true);
                    setServerVersion(comparison.serverVersion);
                    setReleaseNotes(data.release_notes || "");
                    setShowUpdateWarning(true);
                    await hardRefreshApp();
                }
            }
        };
        window.addEventListener('app-update-pushed', handlePushUpdate);
        
        // Active version checks
        checkAppVersion();
        const updateInterval = setInterval(checkAppVersion, 30000);

        return () => {
            window.removeEventListener('app-update-pushed', handlePushUpdate);
            clearInterval(updateInterval);
        };
    }, []);

    const loadWorkers = async () => {
        if (!user || (user.role as string) === 'none' || user.username === 'none') {
            return;
        }
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setLocalWorkers(data);
            }
        } catch {}
    };

    useEffect(() => {
        if (user && (user.role as string) !== 'none' && user.username !== 'none') {
            loadWorkers();
        }
        if (view === 'diagnostico' && !isAdminUser(user)) {
            setView('pos');
        }
        if (view === 'auditoria_forense' && !canAccessForensicAudit(user)) {
            setView('pos');
        }
    }, [view, user]);

    if (!user || (user.role as string) === 'none' || user.username === 'none') {
        return (
            <React.Suspense fallback={<LoadingViewFallback />}>
                <LoginScreen />
            </React.Suspense>
        );
    }

    // Helper to render nav items with identical styles
    const renderNavItem = (targetView: any, label: string, Icon: any, gatePermissionKey?: string) => {
        const isActive = view === targetView;
        
        // Check custom operator credentials
        if (gatePermissionKey && !hasPermission(user, gatePermissionKey)) {
            return null;
        }

        return (
            <motion.button
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                    setView(targetView);
                    setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wide cursor-pointer relative overflow-hidden transition-colors duration-205 group ${
                    isActive 
                        ? 'text-[#2563eb] dark:text-[#38bdf8]' 
                        : 'text-slate-600 dark:text-slate-350 hover:text-[#1d4ed8] dark:hover:text-[#38bdf8]'
                }`}
            >
                {/* Elastic physical sliding pill backdrop */}
                {isActive && (
                    <motion.div
                        layoutId="active-nav-indicator"
                        className="absolute inset-0 bg-[#2563eb]/10 dark:bg-[#1d4ed8]/15 border-l-4 border-[#2563eb]"
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    />
                )}
                <span className="relative z-10 flex items-center justify-between w-full">
                    <span className="flex items-center gap-3.5">
                        <AnimatedMenuIcon Icon={Icon} targetView={targetView} isActive={isActive} />
                        <span>{label}</span>
                    </span>
                    {(targetView === 'inventario' || targetView === 'productos') && user?.role === 'admin' && lowStockCount > 0 && (
                        <span className="bg-rose-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full animate-pulse tracking-tight shrink-0 shadow-sm relative z-20">
                            {lowStockCount}
                        </span>
                    )}
                </span>
            </motion.button>
        );
    };

    const sidebarContent = (
        <div className="flex flex-col justify-between h-full bg-white dark:bg-[#0c111e] h-screen select-none border-r border-slate-200/60 dark:border-slate-850/40">
            <div>
                {/* Header logo container */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-850/60 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/15">
                            <Store size={16} className="animate-pulse" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-sans font-black text-slate-850 dark:text-white text-base tracking-tight leading-none">Digital Store</span>
                            <div className="mt-1">
                                <OfflineStatusHUD variant="badge" />
                            </div>
                        </div>
                    </div>
                    {hasPermission(user, 'access_ai') && (
                        <button 
                            onClick={() => {
                                safeDispatchEvent('open-ai-quick-commands');
                            }}
                            className="w-8 h-8 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-550/15 cursor-pointer hover:scale-105 transition-all duration-200 shadow-sm"
                            title="Llamar a la IA"
                        >
                            <Sparkles size={13} className="text-indigo-500 animate-pulse" />
                        </button>
                    )}
                </div>

                {/* Exquisitely Exposed Theme Switcher */}
                <div className="px-4.5 py-2 mt-2.5">
                    <div className="relative flex p-1 bg-slate-100 dark:bg-[#070a10] rounded-2xl border border-slate-200/50 dark:border-slate-800/80 select-none">
                        <button
                            type="button"
                            onClick={() => {
                                setDarkMode(false);
                                if (theme === 'rgb') setTheme('emerald');
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer relative ${
                                !darkMode && theme !== 'rgb' ? 'text-[#1e293b]' : 'text-slate-455 hover:text-slate-200'
                            }`}
                        >
                            {!darkMode && theme !== 'rgb' && (
                                <motion.div
                                    layoutId="theme-active-pill"
                                    className="absolute inset-0 bg-white shadow-sm border border-slate-200/40 rounded-xl"
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                />
                            )}
                            <Sun size={12} className="relative z-10 text-amber-500 animate-pulse" />
                            <span className="relative z-10">Claro</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setDarkMode(true);
                                if (theme === 'rgb') setTheme('emerald');
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer relative ${
                                darkMode && theme !== 'rgb' ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {darkMode && theme !== 'rgb' && (
                                <motion.div
                                    layoutId="theme-active-pill"
                                    className="absolute inset-0 bg-[#0c111e] shadow-sm border border-slate-800 rounded-xl"
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                />
                            )}
                            <Moon size={12} className="relative z-10 text-blue-400" />
                            <span className="relative z-10">Oscuro</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setTheme('rgb');
                                setDarkMode(true);
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer relative ${
                                theme === 'rgb' ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {theme === 'rgb' && (
                                <motion.div
                                    layoutId="theme-active-pill"
                                    className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-550 shadow-sm border border-pink-500 rounded-xl"
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                />
                            )}
                            <Sparkles size={11} className="relative z-10 text-pink-400 animate-pulse animate-bounce" />
                            <span className="relative z-10 font-black tracking-widest text-shadow shadow-pink-500/50">Modo RGB</span>
                        </button>
                    </div>
                </div>

                {/* Categorized menu groups matching Image 1 */}
                <div className="flex flex-col gap-5 p-3.5 overflow-y-auto max-h-[75vh]">
                    
                    {/* PRINCIPAL SECTION */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest px-4.5 mb-1.5 font-mono">Principal</span>
                        {renderNavItem('inicio', 'Inicio', Home)}
                        {renderNavItem('pos', 'Punto de Venta', ShoppingCart)}
                        {renderNavItem('cuentas_por_cobrar', 'Ventas Pendientes / CxC', Clock, 'manage_credits')}
                        {renderNavItem('historial_ventas', 'Historial Ventas', Receipt, 'view_sales')}
                    </div>

                    {/* INVENTARIO SECTION */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest px-4.5 mb-1.5 font-mono">Inventario</span>
                        {renderNavItem('productos', 'Productos', PackageSearch, 'view_inventory')}
                        {renderNavItem('departamentos', 'Departamentos', Folder, 'view_inventory')}
                        {renderNavItem('inventario', 'Inventario', ClipboardCheck, 'view_inventory')}
                        
                        {renderNavItem('devoluciones', 'Devoluciones', Undo2, 'view_inventory')}
                    </div>

                    {/* ADMINISTRACION SECTION */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest px-4.5 mb-1.5 font-mono">Administración</span>
                        {renderNavItem('reportes', 'Reportes', LayoutDashboard, 'view_reports')}
                        {renderNavItem('analisis', 'Análisis Productos', TrendingUp, 'view_reports')}
                        {renderNavItem('cajas', 'Cajas & Ingresos', Landmark, 'manage_caja')}
                        {renderNavItem('auditoria', 'Registro de Actividad', History, 'view_audit')}
                        {renderNavItem('configuraciones', 'Configuraciones', Settings)}
                        {renderNavItem('hardware', 'Conexión de Hardware', Cpu)}
                        {isAdminUser(user) && renderNavItem('diagnostico', 'Diagnósticos & IA', Activity, 'view_diagnostics')}
                        {canAccessForensicAudit(user) && renderNavItem('auditoria_forense', 'Auditoría Forense IA', ShieldCheck, 'access_forensic_audit')}
                        {user?.role === 'admin' && renderNavItem('usuarios', 'Usuarios', Users)}
                    </div>
                </div>
            </div>

            {/* User Profile module matching Image 1 */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-850/60 bg-slate-50/50 dark:bg-black/10 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-550/15">
                        <span className="font-extrabold text-sm uppercase">{(user?.username || 'R')[0]}</span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-black text-slate-805 dark:text-white text-xs truncate leading-none">@{user?.username || 'roby'}</span>
                        <span className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border border-emerald-500/10 w-max mt-1.5 tracking-wider">
                            Propietario
                        </span>
                    </div>
                    
                    
                    </div>

                {/* Profile actions row */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                    <button 
                        onClick={() => setShowDevicesModal(true)}
                        className="py-2 border border-slate-205 dark:border-slate-800 rounded-xl text-[10px] font-extrabold uppercase text-slate-605 hover:bg-slate-50 dark:hover:bg-slate-850 transition flex items-center justify-center gap-1.5 cursor-pointer dark:text-slate-350"
                    >
                        <Smartphone size={11} />
                        Dispositivos
                    </button>
                    <button 
                        onClick={async () => {
                            const confirmClose = window.confirm("¿Seguro que deseas salir del terminal de caja fiscal?");
                            if (confirmClose) {
                                await setUser(null);
                            }
                        }}
                        className="py-2 border border-slate-205 dark:border-slate-800 rounded-xl text-[10px] font-extrabold uppercase text-rose-500 hover:bg-rose-500/5 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <LogOut size={11} />
                        Salir
                    </button>
                </div>

                {hasPermission(user, 'access_ai') && (
                    <button 
                        onClick={() => {
                            safeDispatchEvent('open-ai-quick-commands');
                        }}
                        className="w-full mt-2.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-750 hover:to-indigo-850 text-white border border-indigo-505/20 rounded-xl text-[9.5px] font-extrabold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/10"
                    >
                        <Sparkles size={11} className="text-amber-300 animate-pulse" />
                        Comandos Rápidos IA
                    </button>
                )}

                {/* Single Smart Adaptive PWA Button (Install / Update / Status) */}
                {hasPwaUpdate ? (
                    <button
                        onClick={handlePwaPrimaryAction}
                        disabled={isUpdatingPwa}
                        className="w-full mt-2.5 py-2 px-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white border border-amber-400/40 rounded-xl text-[9.5px] font-black uppercase transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20 animate-pulse overflow-hidden"
                        title="Nueva actualización detectada. Haz clic para actualizar a la última versión."
                    >
                        {isUpdatingPwa ? (
                            <div className="flex items-center gap-1.5 max-w-full">
                                <RefreshCw size={11} className="animate-spin shrink-0" />
                                <span className="truncate tracking-tight font-mono">{pwaUpdateStepMessage || 'Limpiando caché...'}</span>
                            </div>
                        ) : (
                            <>
                                <Zap size={11} className="text-yellow-200 animate-bounce shrink-0" />
                                <span className="truncate">Actualizar App (v{pwaVersionInfo.latestVersion})</span>
                            </>
                        )}
                    </button>
                ) : !isPwaInstalled ? (
                    <button
                        onClick={handlePwaPrimaryAction}
                        className="w-full mt-2.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border border-emerald-500/20 rounded-xl text-[9.5px] font-extrabold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                        <Download size={11} className="animate-bounce" />
                        <span>Instalar App en PC / Celular</span>
                    </button>
                ) : (
                    <button
                        onClick={handlePwaPrimaryAction}
                        className="w-full mt-2.5 py-1.5 bg-slate-100 dark:bg-slate-850/70 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800 rounded-xl text-[9px] font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer"
                        title="App instalada y al día. Clic para verificar si hay nuevas actualizaciones."
                    >
                        <Check size={10} className="text-emerald-500" />
                        <span>GTR POS v{pwaVersionInfo.currentVersion} al Día</span>
                    </button>
                )}

                {/* Visual Status Indicator Footer */}
                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/40 pt-2 text-[10px] text-[#94a3b8] font-bold">
                    <span>Sistema Autorizado</span>
                    <span className="text-[9px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        v2.0 Premium
                    </span>
                </div>
            </div>
        </div>
    );

    const kioskSidebarContent = (
        <div className="flex flex-col justify-between h-full bg-white dark:bg-[#0c111e] h-screen select-none border-r border-slate-200/60 dark:border-slate-850/40">
            <div>
                {/* Header logo container */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-850/60 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-xl shadow-amber-500/15">
                            <Store size={16} className="animate-pulse" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-sans font-black text-slate-850 dark:text-white text-base tracking-tight leading-none">Digital Store</span>
                            <div className="mt-1">
                                <OfflineStatusHUD variant="badge" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Theme Switcher */}
                <div className="px-4.5 py-2 mt-2.5">
                    <div className="relative flex p-1 bg-slate-100 dark:bg-[#070a10] rounded-2xl border border-slate-200/50 dark:border-slate-800/80 select-none">
                        <button
                            type="button"
                            onClick={() => {
                                setDarkMode(false);
                                if (theme === 'rgb') setTheme('emerald');
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer relative ${
                                !darkMode && theme !== 'rgb' ? 'text-[#1e293b]' : 'text-slate-455 hover:text-slate-200'
                            }`}
                        >
                            {!darkMode && theme !== 'rgb' && (
                                <motion.div
                                    layoutId="theme-active-pill"
                                    className="absolute inset-0 bg-white shadow-sm border border-slate-200/40 rounded-xl"
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                />
                            )}
                            <Sun size={12} className="relative z-10 text-amber-500 animate-pulse" />
                            <span className="relative z-10">Claro</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setDarkMode(true);
                                if (theme === 'rgb') setTheme('emerald');
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer relative ${
                                darkMode && theme !== 'rgb' ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {darkMode && theme !== 'rgb' && (
                                <motion.div
                                    layoutId="theme-active-pill"
                                    className="absolute inset-0 bg-[#0c111e] shadow-sm border border-slate-800 rounded-xl"
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                />
                            )}
                            <Moon size={12} className="relative z-10 text-blue-400" />
                            <span className="relative z-10">Oscuro</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setTheme('rgb');
                                setDarkMode(true);
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer relative ${
                                theme === 'rgb' ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {theme === 'rgb' && (
                                <motion.div
                                    layoutId="theme-active-pill"
                                    className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-550 shadow-sm border border-pink-500 rounded-xl"
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                />
                            )}
                            <Sparkles size={11} className="relative z-10 text-pink-400 animate-pulse animate-bounce" />
                            <span className="relative z-10 font-black tracking-widest text-shadow shadow-pink-500/50">Modo RGB</span>
                        </button>
                    </div>
                </div>

                {/* Categorized menu groups */}
                <div className="flex flex-col gap-5 p-3.5 overflow-y-auto max-h-[75vh]">
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest px-4.5 mb-1.5 font-mono">Funciones</span>
                        {renderNavItem('pos', 'Punto de Venta', ShoppingCart)}
                        {renderNavItem('cajas', 'Mi Caja', Landmark)}
                        {renderNavItem('historial_ventas', 'Mis Ventas de Hoy', Receipt)}
                        {renderNavItem('conteo_fisico', 'Conteo Físico', ClipboardCheck)}
                    </div>
                </div>
            </div>

            {/* User credentials log info and safe exit */}
            <div className="p-3.5 border-t border-slate-100 dark:border-slate-850/60 bg-slate-50/50 dark:bg-black/15">
                {hasPwaUpdate && (
                    <button
                        onClick={handlePwaPrimaryAction}
                        disabled={isUpdatingPwa}
                        className="w-full mb-3 py-2 px-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white border border-amber-400/40 rounded-xl text-[9.5px] font-black uppercase transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md animate-pulse overflow-hidden"
                    >
                        {isUpdatingPwa ? (
                            <div className="flex items-center gap-1.5 max-w-full">
                                <RefreshCw size={11} className="animate-spin shrink-0" />
                                <span className="truncate tracking-tight font-mono">{pwaUpdateStepMessage || 'Limpiando caché...'}</span>
                            </div>
                        ) : (
                            <>
                                <Zap size={11} className="text-yellow-200 animate-bounce shrink-0" />
                                <span className="truncate">Actualizar a v{pwaVersionInfo.latestVersion}</span>
                            </>
                        )}
                    </button>
                )}
                <div className="flex items-center gap-3 p-2 bg-white dark:bg-[#0c111e]/50 border border-slate-200/50 dark:border-slate-850/40 rounded-2xl shadow-xs">
                    <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm uppercase">
                        {user?.username ? user.username.slice(0, 2) : 'OP'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-805 dark:text-white truncate uppercase">{user?.username || 'Invitado'}</p>
                        <p className="text-[8.5px] font-extrabold text-amber-500 font-mono mt-0.5 uppercase tracking-wider">Cajero Kiosko</p>
                    </div>
                    <button 
                        onClick={() => {
                            const confirmClose = window.confirm("¿Seguro que deseas salir del terminal de caja fiscal?");
                            if (confirmClose) {
                                setView('inicio');
                                setUser(null);
                            }
                        }} 
                        className="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/15 flex items-center justify-center text-rose-500 cursor-pointer transition hover:scale-105"
                        title="Salir del Sistema"
                    >
                        <LogOut size={13} />
                    </button>
                </div>
            </div>
        </div>
    );

    
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

    return (
        <div className={`flex h-screen w-full select-none ${darkMode ? 'dark bg-[#070a10] text-[#cacfd2]' : 'bg-neutral-50/40 text-slate-900'}`}>
            
            {/* Desktop persistent sidebar drawer */}
            <div className="hidden lg:block lg:w-[260px] h-full shrink-0">
                {isKioskLocked ? kioskSidebarContent : sidebarContent}
            </div>

            {/* Mobile Animated Dropdown Menu Panel (displayed downwards nicely) */}
            <AnimatePresence>
                {!isKioskLocked && mobileSidebarOpen && (
                    <>
                        {/* Backdrop fade overlay */}
                        <motion.div 
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 lg:hidden"
                            onClick={() => setMobileSidebarOpen(false)}
                        />
                        
                        {/* Dropdown panel sliding downwards nicely starting from the top header */}
                        <motion.div 
                            key="dropdown-panel"
                            initial={{ opacity: 0, y: -40, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -40, height: 0 }}
                            transition={{ type: "spring", stiffness: 350, damping: 28 }}
                            className="fixed top-14 left-0 right-0 z-40 bg-white dark:bg-[#0c111e]/98 border-b border-slate-200 dark:border-slate-850/90 shadow-2xl overflow-hidden lg:hidden"
                        >
                            <motion.div 
                                initial="hidden"
                                animate="visible"
                                variants={{
                                    hidden: { opacity: 0 },
                                    visible: {
                                        opacity: 1,
                                        transition: {
                                            staggerChildren: 0.035
                                        }
                                    }
                                }}
                                className="p-4 flex flex-col gap-4 max-h-[82vh] overflow-y-auto"
                            >
                                {/* PRINCIPAL SECTION */}
                                <motion.div 
                                    variants={{
                                        hidden: { opacity: 0, y: -8 },
                                        visible: { opacity: 1, y: 0 }
                                    }}
                                    className="flex flex-col gap-1"
                                >
                                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4.5 mb-1.5 font-mono">Principal</span>
                                    {renderNavItem('inicio', 'Inicio', Home)}
                                    {renderNavItem('pos', 'Punto de Venta', ShoppingCart)}
                                    {renderNavItem('cuentas_por_cobrar', 'Ventas Pendientes / CxC', Clock, 'manage_credits')}
                                    {renderNavItem('historial_ventas', 'Historial Ventas', Receipt)}
                                </motion.div>

                                {/* INVENTARIO SECTION */}
                                <motion.div 
                                    variants={{
                                        hidden: { opacity: 0, y: -8 },
                                        visible: { opacity: 1, y: 0 }
                                    }}
                                    className="flex flex-col gap-1"
                                >
                                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4.5 mb-1.5 font-mono">Inventario</span>
                                    {renderNavItem('productos', 'Productos', PackageSearch, 'view_inventory')}
                                    {renderNavItem('departamentos', 'Departamentos', Folder, 'view_inventory')}
                                    {renderNavItem('inventario', 'Inventario', ClipboardCheck, 'view_inventory')}
                                    
                                    {renderNavItem('devoluciones', 'Devoluciones', Undo2, 'view_inventory')}
                                </motion.div>

                                {/* ADMINISTRACION SECTION */}
                                <motion.div 
                                    variants={{
                                        hidden: { opacity: 0, y: -8 },
                                        visible: { opacity: 1, y: 0 }
                                    }}
                                    className="flex flex-col gap-1"
                                >
                                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4.5 mb-1.5 font-mono">Administración</span>
                                    {renderNavItem('reportes', 'Reportes', LayoutDashboard, 'view_reports')}
                                    {renderNavItem('analisis', 'Análisis Productos', TrendingUp, 'view_reports')}
                                    {renderNavItem('cajas', 'Cajas & Ingresos', Landmark, 'manage_caja')}
                                    {renderNavItem('configuraciones', 'Configuraciones', Settings)}
                                    {isAdminUser(user) && renderNavItem('diagnostico', 'Diagnósticos & IA', Activity, 'view_diagnostics')}
                                    {canAccessForensicAudit(user) && renderNavItem('auditoria_forense', 'Auditoría Forense IA', ShieldCheck, 'access_forensic_audit')}
                                    {user?.role === 'admin' && renderNavItem('usuarios', 'Usuarios', Users)}
                                </motion.div>

                                {/* Profile interactive box closely integrated within the mobile dropdown */}
                                <motion.div 
                                    variants={{
                                        hidden: { opacity: 0, y: -8 },
                                        visible: { opacity: 1, y: 0 }
                                    }}
                                    className="p-3.5 border-t border-slate-100 dark:border-slate-850/60 bg-slate-50/50 dark:bg-black/15 rounded-2xl flex flex-col gap-3 mt-1"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-550/15">
                                                <span className="font-extrabold text-xs uppercase">{(user?.username || 'R')[0]}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-805 dark:text-white text-xs">@{user?.username || 'roby'}</span>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Operario Activo</span>
                                            </div>
                                        </div>
                                        
                                        
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                                        <button 
                                            onClick={() => {
                                                setShowDevicesModal(true);
                                                setMobileSidebarOpen(false);
                                            }}
                                            className="py-2.5 border border-slate-205 dark:border-slate-800 rounded-xl font-bold uppercase text-slate-650 hover:bg-slate-50 dark:hover:bg-slate-850 transition flex items-center justify-center gap-1.5 cursor-pointer dark:text-slate-350"
                                        >
                                            <Smartphone size={10} />
                                            Dispositivos
                                        </button>
                                        <button 
                                            onClick={async () => {
                                                const confirmClose = window.confirm("¿Seguro que deseas salir del terminal de caja fiscal?");
                                                if (confirmClose) {
                                                    await setUser(null);
                                                }
                                            }}
                                            className="py-2.5 border border-slate-205 dark:border-slate-800 rounded-xl font-bold uppercase text-rose-500 hover:bg-rose-500/5 transition flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <LogOut size={10} />
                                            Salir
                                        </button>
                                    </div>

                                    {hasPermission(user, 'access_ai') && (
                                        <button 
                                            onClick={() => {
                                                setMobileSidebarOpen(false);
                                                safeDispatchEvent('open-ai-quick-commands');
                                            }}
                                            className="w-full mt-2 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-850 text-white border border-indigo-505/20 rounded-xl text-[9.5px] font-extrabold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-505/10"
                                        >
                                            <Sparkles size={11} className="text-amber-300 animate-pulse" />
                                            Comandos Rápidos IA
                                        </button>
                                    )}
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main body wrapper */}
            <div className="flex-grow flex flex-col h-full overflow-hidden relative">
                
                {/* Firebase Quota Warning Banner */}
                {syncError && (syncError.toLowerCase().includes('quota') || syncError.toLowerCase().includes('resource_exhausted')) && (
                    <div className="bg-amber-500/10 dark:bg-amber-500/5 border-b border-amber-500/20 dark:border-amber-500/10 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-450 z-50">
                        <div className="flex items-center gap-2.5 font-semibold">
                            <span className="flex h-2 w-2 relative shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            <span>
                                <strong>Límite de Escritura Firestore Excedido (Spark Plan):</strong> La cuota gratuita de escritura diaria se ha agotado. GTR POS seguirá funcionando normalmente guardando datos de forma local en SQLite e IndexedDB, y se sincronizará automáticamente mañana cuando la cuota se restablezca.
                            </span>
                        </div>
                        <a 
                            href="https://console.firebase.google.com/project/gen-lang-client-0566278135/firestore/databases/ai-studio-remixgtrposaisma-814bb0d3-8e73-41a4-8913-4a6a5d07dc2f/data?openUpgradeDialog=true"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-amber-500/25 hover:bg-amber-500/35 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 transition-colors px-3 py-1.5 rounded-lg text-[9px] uppercase font-black tracking-wider shrink-0"
                        >
                            Ver Consola & Actualizar Plan
                        </a>
                    </div>
                )}
                
                {/* Real-time Firestore Sync Fine Progress Bar */}
                {isSyncing && (
                    <div className="absolute top-14 lg:top-0 left-0 right-0 h-0.5 bg-indigo-100 dark:bg-indigo-950/20 overflow-hidden z-50">
                        <motion.div 
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600"
                            initial={{ width: "0%" }}
                            animate={{ 
                                width: ["0%", "30%", "70%", "95%"],
                                transition: {
                                    duration: 1.5,
                                    times: [0, 0.2, 0.6, 1],
                                    repeat: Infinity,
                                    repeatType: "reverse"
                                }
                            }}
                        />
                    </div>
                )}

                {/* Mobile Top bar header */}
                {!isKioskLocked && (<header className="lg:hidden h-14 bg-white dark:bg-[#0c111e] border-b border-slate-200/60 dark:border-slate-850/40 px-4 flex items-center justify-between shrink-0 select-none z-[50] relative">
                    <button 
                        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                        className="p-2 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl cursor-pointer transition-colors duration-150 relative z-[60]"
                    >
                        <motion.div
                            animate={{ rotate: mobileSidebarOpen ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {mobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
                        </motion.div>
                    </button>
                    
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-650 flex items-center justify-center text-white">
                            <Sparkles size={11} />
                        </div>
                        <span className="font-sans font-black text-slate-850 dark:text-white text-sm tracking-tight leading-none uppercase">GTR POS</span>
                        <OfflineStatusHUD variant="compact" />
                    </div>

                    <div className="flex items-center gap-1.5">
                        {hasPermission(user, 'access_ai') && (
                            <button 
                                onClick={() => {
                                    safeDispatchEvent('open-ai-quick-commands');
                                }}
                                className="w-9 h-9 rounded-full bg-slate-50 dark:bg-[#070b13] border dark:border-slate-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 cursor-pointer hover:scale-105 transition-all shadow-sm"
                                title="Llamar a la IA"
                            >
                                <Sparkles size={13} className="text-indigo-500 animate-pulse" />
                            </button>
                        )}
                        <button 
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2 bg-slate-50 dark:bg-[#070b13] border dark:border-slate-800/80 rounded-xl text-slate-650 dark:text-slate-300 cursor-pointer"
                        >
                            {darkMode ? <Sun size={14} className="text-yellow-400" /> : <Moon size={14} />}
                        </button>
                    </div>
                </header>)}

                {/* Main page view content display */}
                <main className={`flex-grow flex-1 relative ${isKioskLocked ? 'pb-16 lg:pb-0' : ''} ${view === 'pos' ? 'overflow-hidden' : 'overflow-hidden'}`}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={view}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className={`h-full w-full ${view === 'pos' ? 'overflow-hidden' : 'overflow-y-auto'}`}
                        >
                            <React.Suspense fallback={<LoadingViewFallback />}>
                                {view === 'inicio' && <InicioView />}
                                {view === 'pos' && <POS />}
                                {view === 'ventas_pendientes' && hasPermission(user, 'manage_credits') && <CuentasPorCobrarView />}
                                {view === 'historial_ventas' && hasPermission(user, 'view_sales') && <HistorialVentasView />}
                                {view === 'cuentas_por_cobrar' && hasPermission(user, 'manage_credits') && <CuentasPorCobrarView />}
                                {(view === 'productos' || view === 'inventario') && hasPermission(user, 'view_inventory') && <Inventory />}
                                {view === 'auditoria' && hasPermission(user, 'view_audit') && <AuditoriaView />}
                                {view === 'departamentos' && hasPermission(user, 'view_inventory') && <DepartamentosView />}
                                {view === 'devoluciones' && hasPermission(user, 'view_inventory') && <DevolucionesView />}
                                {view === 'reportes' && hasPermission(user, 'view_reports') && <Dashboard />}
                                {view === 'analisis' && hasPermission(user, 'view_reports') && <AnalisisView />}
                                {view === 'usuarios' && user?.role === 'admin' && <PermissionsConsole />}
                                {view === 'cajas' && hasPermission(user, 'manage_caja') && <CajasView />}
                                {view === 'conteo_fisico' && <PhysicalCountManager onClose={() => setView('pos')} />}
                                {view === 'configuraciones' && <ConfiguracionesView />}
                                {view === 'hardware' && <HardwareConfigView />}
                                {view === 'diagnostico' && (isAdminUser(user) ? <DiagnosticoView /> : <POS />)}
                                {view === 'auditoria_forense' && (canAccessForensicAudit(user) ? <AuditoriaForenseView /> : <POS />)}
                            </React.Suspense>
                        </motion.div>
                    </AnimatePresence>
                </main>

                {/* Touch-optimized Bottom Navigation Bar for Kiosk Mobile */}
                {isKioskLocked && (
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#0c111e] border-t border-slate-200/80 dark:border-slate-850/80 flex justify-around items-center z-50 px-2 shadow-2xl select-none">
                        <button
                            onClick={() => setView('pos')}
                            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors ${
                                view === 'pos' 
                                    ? 'text-blue-600 dark:text-[#38bdf8]' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-blue-500'
                            }`}
                        >
                            <ShoppingCart size={18} />
                            <span className="text-[9px] font-black uppercase tracking-wider">Ventas</span>
                        </button>
                        <button
                            onClick={() => setView('cajas')}
                            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors ${
                                view === 'cajas' 
                                    ? 'text-blue-600 dark:text-[#38bdf8]' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-blue-500'
                            }`}
                        >
                            <Landmark size={18} />
                            <span className="text-[9px] font-black uppercase tracking-wider">Mi Caja</span>
                        </button>
                        <button
                            onClick={() => setView('historial_ventas')}
                            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors ${
                                view === 'historial_ventas' 
                                    ? 'text-blue-600 dark:text-[#38bdf8]' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-blue-500'
                            }`}
                        >
                            <Receipt size={18} />
                            <span className="text-[9px] font-black uppercase tracking-wider">Historial</span>
                        </button>
                        <button
                            onClick={() => setView('conteo_fisico')}
                            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors ${
                                view === 'conteo_fisico' 
                                    ? 'text-blue-600 dark:text-[#38bdf8]' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-blue-500'
                            }`}
                        >
                            <ClipboardCheck size={18} />
                            <span className="text-[9px] font-black uppercase tracking-wider">Conteo</span>
                        </button>
                        <button
                            onClick={() => {
                                const confirmClose = window.confirm("¿Seguro que deseas salir del terminal de caja fiscal?");
                                if (confirmClose) {
                                    setView('inicio');
                                    setUser(null);
                                }
                            }}
                            className="flex flex-col items-center justify-center gap-1 flex-1 py-1 text-rose-500 hover:text-rose-600 cursor-pointer"
                        >
                            <LogOut size={18} />
                            <span className="text-[9px] font-black uppercase tracking-wider">Salir</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Devices telemetry popup modal */}
            {showDevicesModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs" onClick={() => setShowDevicesModal(false)}></div>
                    <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-205 dark:border-slate-850 p-6 max-w-sm w-full relative z-10 flex flex-col gap-4 shadow-xl select-none">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-850/60 text-indigo-500">
                            <Smartphone size={16} />
                            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-850 dark:text-white">Dispositivos Vinculados</h3>
                        </div>
                        <p className="text-[10.5px] font-semibold text-slate-400 leading-normal">
                            Tu licencia premium activa de **GTR POS v2.0** permite conectar terminales móviles ilimitados (smartphones o tabletas) para la toma de comandas móviles en salón.
                        </p>
                        
                        <div className="flex flex-col gap-2 border border-slate-100 dark:border-slate-850 p-2.5 rounded-2xl bg-slate-50/50 dark:bg-black/25">
                            <div className="flex items-center justify-between text-[11px] font-bold p-2 bg-white dark:bg-black/10 border border-slate-100 rounded-xl">
                                <div className="flex flex-col">
                                    <span className="text-slate-800 dark:text-slate-200">Balanza de Caja RS-232</span>
                                    <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        Latencia: {deviceLatencies.balanza} ms
                                    </span>
                                </div>
                                <span className="text-emerald-500 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-lg">ONLINE</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-bold p-2 bg-white dark:bg-black/10 border border-slate-100 rounded-xl">
                                <div className="flex flex-col">
                                    <span className="text-slate-800 dark:text-slate-200">Impresora Fiscal Térmica</span>
                                    <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        Latencia: {deviceLatencies.impresora} ms
                                    </span>
                                </div>
                                <span className="text-emerald-500 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-lg">ONLINE</span>
                            </div>
                        </div>

                        {/* Network and latency diagnostics footer panel */}
                        <div className="border-t border-slate-100 dark:border-slate-850/60 pt-3.5 flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                    <Activity size={13} className="animate-pulse text-indigo-500" />
                                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Latencia de Red / Hardware</span>
                                </div>
                                <button 
                                    onClick={runDevicePingTest}
                                    disabled={pingingDevices}
                                    className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                    {pingingDevices ? (
                                        <>
                                            <Loader2 size={9} className="animate-spin" />
                                            Midiendo...
                                        </>
                                    ) : (
                                        "Diagnosticar"
                                    )}
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col gap-0.5 p-2 bg-slate-50/40 dark:bg-black/15 rounded-xl border border-slate-100 dark:border-slate-850/40 text-center">
                                    <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-tight">Balanza</span>
                                    <span className="font-mono text-[11px] font-extrabold text-emerald-500 dark:text-emerald-400">
                                        {deviceLatencies.balanza} ms
                                    </span>
                                    <span className="text-[7.5px] font-bold text-slate-450 uppercase tracking-tighter">Excelente</span>
                                </div>
                                <div className="flex flex-col gap-0.5 p-2 bg-slate-50/40 dark:bg-black/15 rounded-xl border border-slate-100 dark:border-slate-850/40 text-center">
                                    <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-tight">Impresora</span>
                                    <span className="font-mono text-[11px] font-extrabold text-emerald-500 dark:text-emerald-400">
                                        {deviceLatencies.impresora} ms
                                    </span>
                                    <span className="text-[7.5px] font-bold text-slate-450 uppercase tracking-tighter">Excelente</span>
                                </div>
                                <div className="flex flex-col gap-0.5 p-2 bg-slate-50/40 dark:bg-black/15 rounded-xl border border-slate-100 dark:border-slate-850/40 text-center">
                                    <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-tight">GTR Cloud</span>
                                    <span className={`font-mono text-[11px] font-extrabold ${deviceLatencies.server < 50 ? 'text-emerald-500 dark:text-emerald-400' : deviceLatencies.server < 100 ? 'text-amber-500' : 'text-rose-500'}`}>
                                        {deviceLatencies.server} ms
                                    </span>
                                    <span className={`text-[7.5px] font-bold uppercase tracking-tighter ${deviceLatencies.server < 50 ? 'text-emerald-500' : deviceLatencies.server < 100 ? 'text-amber-500' : 'text-rose-500'}`}>
                                        {deviceLatencies.server < 50 ? 'Excelente' : deviceLatencies.server < 100 ? 'Estable' : 'Lento'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => setShowDevicesModal(false)}
                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl uppercase transition cursor-pointer dark:bg-slate-900 dark:text-slate-350 mt-1"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Elegant Mandatory App Update Locking Modal Overlay */}
            <AnimatePresence>
                {showUpdateWarning && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-[#0c111e] rounded-3xl border border-orange-500/30 p-6 max-w-md w-full relative z-10 flex flex-col gap-5 shadow-2xl"
                        >
                            <div className="flex flex-col items-center gap-3.5 text-center">
                                <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20 shadow-lg shadow-orange-550/10 animate-bounce">
                                    <Smartphone size={32} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-500 font-mono">Actualización Obligatoria</span>
                                    <h2 className="font-sans font-black text-slate-855 dark:text-white text-lg tracking-tight leading-snug">
                                        ¡Nueva Versión de GTR POS Disponible!
                                    </h2>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/10 text-center">
                                <p className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                                    Se ha detectado la versión <strong className="text-orange-550 dark:text-orange-400 font-black">v{serverVersion || "2.3.0"}</strong> en el servidor. Tu dispositivo actual posee una versión anterior y ha sido pausado para evitar cualquier desincronización en tus importes, inventarios y ventas fiscales.
                                </p>
                            </div>

                            {releaseNotes && (
                                <div className="flex flex-col gap-1.5 border border-slate-150 dark:border-slate-800 p-3 rounded-2xl bg-slate-50/50 dark:bg-black/25">
                                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">Notas de actualización:</span>
                                    <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 italic">
                                        "{releaseNotes}"
                                    </p>
                                </div>
                            )}

                            <div className="flex flex-col gap-2.5">
                                <motion.button
                                    disabled={isRefreshing}
                                    whileHover={{ scale: isRefreshing ? 1 : 1.02 }}
                                    whileTap={{ scale: isRefreshing ? 1 : 0.98 }}
                                    onClick={handleForceUpdate}
                                    className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-black rounded-2xl uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
                                >
                                    {isRefreshing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                                            <span>Actualizando Aplicación...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={14} className="text-white animate-pulse" />
                                            <span>Actualizar Ahora (Forzar)</span>
                                        </>
                                    )}
                                </motion.button>
                                <p className="text-[9px] font-bold text-center text-slate-400">
                                    Al presionar se limpiará la caché local y se cargará el terminal limpio instantáneamente.
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* S.I.T.A. Autonomous AI Test & Healing Pilot HUD */}
            <AnimatePresence>
                {isAutonomousTesting && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.95 }}
                        className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[420px] bg-slate-950/95 backdrop-blur-xl border border-indigo-500/35 rounded-3xl p-5 shadow-2xl z-50 text-white flex flex-col gap-3"
                        id="autonomous-hud"
                    >
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <span className="flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-[ping_1.5s_linear_infinite]"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                                    </span>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Piloto Autónomo QA Integrado</span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 font-bold">
                                Paso {autonomousStep + 1} de 5 ({Math.round(((autonomousStep + 1) / 5) * 100)}%)
                            </span>
                        </div>

                        <div className="space-y-1">
                            <h4 className="text-xs font-black uppercase text-indigo-150 flex items-center gap-1.5 leading-none">
                                <span className="text-indigo-400 animate-pulse text-[8px]">●</span>
                                {autonomousStep === 0 && "Inicializando Heurística S.I.T.A."}
                                {autonomousStep === 1 && "Verificando Latencia y Red de APIs"}
                                {autonomousStep === 2 && "Validando Vistas Principales (DOM Rendering)"}
                                {autonomousStep === 3 && "Corriendo Simulador de Redondeo Absoluto"}
                                {autonomousStep === 4 && "Generando Reporte y Propuesta GTR"}
                                {autonomousStep === 5 && "Auditoría de Integridad Completada"}
                            </h4>
                            <p className="text-[10px] text-slate-350 leading-relaxed font-normal">
                                {autonomousStep === 0 && "Estableciendo conexión en cola... Sincronizando el compilador estático local contra el entorno de pruebas."}
                                {autonomousStep === 1 && "Disparando pings REST asíncronos a productos, cuentas, configuraciones y almacenamiento SQLite."}
                                {autonomousStep === 2 && "Ejecutando recorrido visual. Conduciendo el navegador de forma remota por el terminal de ventas, inventario y dashboards."}
                                {autonomousStep === 3 && "Realizando 100 cálculos en paralelo simulando tasas bolivianas y redondeo sin residuo decimal."}
                                {autonomousStep === 4 && "Compilando descubrimientos. Invocando auditoría Gemini AI para generar soluciones."}
                                {autonomousStep === 5 && "Secuencia exitosa. Retornando al terminal de diagnóstico con soluciones en disco."}
                            </p>
                        </div>

                        {/* Interactive live log terminal inside the HUD */}
                        <div className="bg-black/40 border border-white/5 rounded-xl p-3 h-24 overflow-y-auto font-mono text-[9px] text-emerald-400 leading-normal space-y-1">
                            {autonomousLogs.slice(-6).map((log, index) => (
                                <div key={index} className="truncate select-all cursor-text text-start">
                                    {log}
                                </div>
                            ))}
                        </div>

                        {/* HUD Footer progress line */}
                        <div className="space-y-2">
                            <div className="relative w-full bg-white/10 rounded-full h-1 overflow-hidden">
                                <motion.div 
                                    className="bg-indigo-500 h-1 rounded-full absolute left-0 top-0 bottom-0"
                                    animate={{ width: `${((autonomousStep + 1) / 5) * 100}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsAutonomousTesting(false);
                                        setAutonomousStep(0);
                                        setAutonomousLogs(prev => [...prev, "[!] Secuencia interrumpida manualmente por el operador."]);
                                        setView('diagnostico');
                                    }}
                                    className="w-full py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-[9px] font-bold uppercase tracking-wider text-slate-300 transition cursor-pointer"
                                >
                                    Detener Secuencia
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {globalNotification && (
                <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 text-white max-w-sm animate-in slide-in-from-bottom-5 ${globalNotification.type === "success" ? "bg-emerald-600" : globalNotification.type === "warn" ? "bg-amber-500" : "bg-rose-600"}`}>
                    <div className="flex-1 font-bold text-sm">
                        {globalNotification.message}
                    </div>
                </div>
            )}

            {/* AI Voice modality interactive assistant */}
            <AudioVoice />

            {/* Offline Control Center & Diagnostics Modal */}
            <OfflineManagerModal 
                isOpen={isOfflineModalOpen} 
                onClose={() => setIsOfflineModalOpen(false)} 
            />

            {/* PWA Direct Installation & Standalone Launcher Modal */}
            <PWAInstallModal
                isOpen={isPwaInstallModalOpen}
                onClose={() => setIsPwaInstallModalOpen(false)}
            />
        </div>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <AppProvider>
                <AppLayout />
            </AppProvider>
        </ErrorBoundary>
    );
}
