import React from 'react';
import { useApp } from '../context/AppContext';
import { Wifi, WifiOff, RefreshCw, Database, CloudUpload } from 'lucide-react';
import { motion } from 'motion/react';

interface OfflineStatusHUDProps {
    variant?: 'compact' | 'full' | 'sidebar';
    onOpenModal?: () => void;
}

export const OfflineStatusHUD: React.FC<OfflineStatusHUDProps> = ({ variant = 'compact', onOpenModal }) => {
    const { 
        isOffline, 
        isSyncing, 
        networkLatency, 
        networkQuality, 
        pendingSalesCount, 
        pendingActionsCount,
        setIsOfflineModalOpen,
        triggerOnlineSync,
        syncError
    } = useApp();

    const [serverPendingCount, setServerPendingCount] = React.useState<number>(0);

    React.useEffect(() => {
        let mounted = true;
        const checkServerPending = async () => {
            if (!navigator.onLine) return;
            try {
                const token = localStorage.getItem('auth_token');
                const headers: Record<string, string> = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const res = await fetch('/api/offline-sales/count', { headers });
                if (res.ok) {
                    const data = await res.json();
                    if (mounted) setServerPendingCount(data.count || 0);
                }
            } catch (e) {}
        };

        checkServerPending();
        const interval = setInterval(checkServerPending, 20000);
        window.addEventListener('offline_queue_changed', checkServerPending);

        return () => {
            mounted = false;
            clearInterval(interval);
            window.removeEventListener('offline_queue_changed', checkServerPending);
        };
    }, []);

    const totalPending = (pendingSalesCount || 0) + (pendingActionsCount || 0) + serverPendingCount;

    const handleClick = () => {
        if (onOpenModal) {
            onOpenModal();
        } else if (setIsOfflineModalOpen) {
            setIsOfflineModalOpen(true);
        }
    };

    if (variant === 'sidebar') {
        return (
            <button
                type="button"
                onClick={handleClick}
                id="sidebar-offline-status-hud"
                className="w-full text-left flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all cursor-pointer group shadow-2xs"
                title="Abrir Centro de Control Offline y Sincronización"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSyncing 
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                            : isOffline 
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
                                : serverPendingCount > 0
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}>
                        {isSyncing ? (
                            <RefreshCw size={14} className="animate-spin" />
                        ) : isOffline ? (
                            <WifiOff size={14} className="animate-pulse" />
                        ) : (
                            <Wifi size={14} />
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">
                                {isSyncing ? 'Sincronizando' : isOffline ? 'Modo Offline' : 'Conectado'}
                            </span>
                            {networkLatency !== null && !isOffline && (
                                <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500">
                                    {networkLatency}ms
                                </span>
                            )}
                        </div>
                        <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 truncate">
                            {serverPendingCount > 0
                                ? `${serverPendingCount} por autorizar`
                                : totalPending > 0 
                                    ? `${totalPending} pendiente(s) en cola` 
                                    : isOffline 
                                        ? 'Operando localmente' 
                                        : 'Base de datos al día'}
                        </span>
                    </div>
                </div>

                {totalPending > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse shrink-0">
                        {totalPending}
                    </span>
                ) : (
                    <span className="text-[9px] font-bold text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0">
                        Abrir
                    </span>
                )}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            id="compact-offline-status-hud"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs ${
                isSyncing
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 hover:bg-blue-500/25'
                    : isOffline
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                        : networkQuality === 'unstable'
                            ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border border-yellow-500/25 hover:bg-yellow-500/25'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25'
            }`}
            title="Centro de Control Offline: Haz clic para ver detalles y gestionar sincronización"
        >
            {isSyncing ? (
                <>
                    <RefreshCw size={11} className="animate-spin" />
                    <span>Sincronizando</span>
                </>
            ) : isOffline ? (
                <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Offline</span>
                    {totalPending > 0 && (
                        <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-black">
                            {totalPending}
                        </span>
                    )}
                </>
            ) : (
                <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Online</span>
                    {networkLatency !== null && (
                        <span className="text-[9px] font-mono opacity-80 lowercase">
                            {networkLatency}ms
                        </span>
                    )}
                    {totalPending > 0 && (
                        <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-black animate-pulse">
                            {totalPending}
                        </span>
                    )}
                </>
            )}
        </button>
    );
};

export default OfflineStatusHUD;
