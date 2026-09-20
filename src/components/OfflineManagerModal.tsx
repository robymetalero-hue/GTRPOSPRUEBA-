import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
    getOfflineSales, 
    getOfflineActions, 
    deleteOfflineSale, 
    deleteOfflineAction, 
    getOfflineStats, 
    downloadOfflineBackupFile,
    OfflineSale, 
    OfflineAction,
    OfflineStats 
} from '../utils/offlineStorage';
import { 
    Wifi, 
    WifiOff, 
    RefreshCw, 
    Database, 
    Download, 
    Trash2, 
    CheckCircle2, 
    AlertTriangle, 
    X, 
    Clock, 
    ShoppingBag, 
    User, 
    CreditCard, 
    FileText, 
    ShieldCheck, 
    Server, 
    ArrowRight,
    ShieldAlert,
    Check,
    XCircle,
    PackageCheck,
    Boxes
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';

interface OfflineManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const OfflineManagerModal: React.FC<OfflineManagerModalProps> = ({ isOpen, onClose }) => {
    const { 
        user,
        isOffline, 
        isSyncing, 
        triggerOnlineSync, 
        syncError, 
        networkLatency, 
        networkQuality,
        showNotification,
        exchangeRate,
        receiptTemplate,
        fetchProducts
    } = useApp();

    const isAdmin = Boolean(
        user?.role === 'admin' || 
        user?.role === 'propietario' || 
        user?.role === 'administrador' ||
        user?.username?.toLowerCase() === 'admin' ||
        user?.username?.toLowerCase() === 'roby'
    );

    const [activeTab, setActiveTab] = useState<'server_approvals' | 'sales' | 'actions' | 'backup' | 'diagnostic'>('server_approvals');
    const [sales, setSales] = useState<OfflineSale[]>([]);
    const [actions, setActions] = useState<OfflineAction[]>([]);
    const [serverSales, setServerSales] = useState<any[]>([]);
    const [isLoadingServerSales, setIsLoadingServerSales] = useState(false);
    const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
    const [stats, setStats] = useState<OfflineStats>({
        salesCount: 0,
        actionsCount: 0,
        totalAmountBob: 0,
        totalAmountUsd: 0,
        oldestPendingDate: null
    });
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSale, setSelectedSale] = useState<OfflineSale | null>(null);
    const [pingStatus, setPingStatus] = useState<string | null>(null);
    const [isPinging, setIsPinging] = useState(false);

    const loadServerPendingSales = async () => {
        setIsLoadingServerSales(true);
        try {
            const token = localStorage.getItem('auth_token');
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/offline-sales/pending', { headers });
            if (res.ok) {
                const data = await res.json();
                setServerSales(data.sales || []);
            }
        } catch (e) {
            console.error("Failed to load server pending offline sales:", e);
        } finally {
            setIsLoadingServerSales(false);
        }
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [salesData, actionsData, statsData] = await Promise.all([
                getOfflineSales(),
                getOfflineActions(),
                getOfflineStats()
            ]);
            setSales(salesData);
            setActions(actionsData);
            setStats(statsData);
        } catch (err) {
            console.error("Failed loading offline modal data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadData();
            loadServerPendingSales();
        }
    }, [isOpen]);

    // Listen for changes in the queue to refresh view reactively
    useEffect(() => {
        const handleQueueChange = () => {
            if (isOpen) {
                loadData();
                loadServerPendingSales();
            }
        };
        window.addEventListener('offline_queue_changed', handleQueueChange);
        return () => {
            window.removeEventListener('offline_queue_changed', handleQueueChange);
        };
    }, [isOpen]);

    const handleApproveOfflineSale = async (sale: any, forceOverride = false) => {
        if (!isAdmin) {
            if (showNotification) showNotification("Solo un Administrador o Propietario puede autorizar ventas offline.", "error");
            return;
        }

        setActionInProgressId(sale.id);
        try {
            const token = localStorage.getItem('auth_token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/offline-sales/${sale.id}/approve`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ force_override: forceOverride })
            });

            const data = await res.json();

            if (res.status === 409 && data.requiresConfirmation) {
                const deficitsText = (data.deficitItems || [])
                    .map((it: any) => `• ${it.name} (Stock en catálogo: ${it.current_stock}, Solicitado: ${it.requested_quantity}, Faltan: ${it.deficit})`)
                    .join('\n');
                
                const confirmed = window.confirm(
                    `ADVERTENCIA DE STOCK INSUFICIENTE:\n\n${deficitsText}\n\n¿Desea autorizar y aplicar esta venta de todos modos? (El stock se ajustará a 0 o mínimo permitido).`
                );

                if (confirmed) {
                    return handleApproveOfflineSale(sale, true);
                }
                return;
            }

            if (res.ok) {
                if (showNotification) showNotification(data.message || "✓ Venta offline aprobada con éxito. Stock descontado.", "success");
                await loadServerPendingSales();
                if (fetchProducts) await fetchProducts();
            } else {
                if (showNotification) showNotification(data.error || "Error al aprobar la venta offline.", "error");
            }
        } catch (e: any) {
            if (showNotification) showNotification(`Fallo de conexión: ${e.message}`, "error");
        } finally {
            setActionInProgressId(null);
        }
    };

    const handleRejectOfflineSale = async (sale: any) => {
        if (!isAdmin) {
            if (showNotification) showNotification("Solo un Administrador o Propietario puede rechazar ventas offline.", "error");
            return;
        }

        const reason = window.prompt("Ingrese el motivo del rechazo de esta venta offline:", "Falta de stock o duplicidad detectada");
        if (reason === null) return;

        setActionInProgressId(sale.id);
        try {
            const token = localStorage.getItem('auth_token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/offline-sales/${sale.id}/reject`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ reason })
            });

            const data = await res.json();
            if (res.ok) {
                if (showNotification) showNotification("✓ Venta offline rechazada y archivada. El inventario se mantuvo intacto.", "info");
                await loadServerPendingSales();
            } else {
                if (showNotification) showNotification(data.error || "Error al rechazar la venta.", "error");
            }
        } catch (e: any) {
            if (showNotification) showNotification(`Fallo de conexión: ${e.message}`, "error");
        } finally {
            setActionInProgressId(null);
        }
    };

    const handleManualPing = async () => {
        setIsPinging(true);
        setPingStatus(null);
        const startTime = performance.now();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const res = await fetch('/api/health', {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-store'
            });
            clearTimeout(timeoutId);
            const duration = Math.round(performance.now() - startTime);
            if (res.ok) {
                setPingStatus(`✓ Conexión Activa y Rápida: ${duration} ms`);
                if (showNotification) showNotification(`✓ Servidor responde correctamente en ${duration} ms`, 'success');
            } else {
                setPingStatus(`⚠️ Servidor respondió con estado HTTP ${res.status}`);
            }
        } catch (e: any) {
            setPingStatus('❌ Sin respuesta del servidor local/remoto (Modo Offline Autónomo Activo)');
            if (showNotification) showNotification('Sin conexión con el servidor. Operando en modo local.', 'warn');
        } finally {
            setIsPinging(false);
        }
    };

    const handleDeleteSale = async (id: string) => {
        const confirmDelete = window.confirm("¿Seguro que deseas eliminar esta venta de la cola offline? Esta acción es irreversible.");
        if (confirmDelete) {
            await deleteOfflineSale(id);
            if (selectedSale?.id === id) setSelectedSale(null);
            await loadData();
            if (showNotification) showNotification("Venta offline eliminada de la cola.", "info");
        }
    };

    const handleDeleteAction = async (id: string) => {
        const confirmDelete = window.confirm("¿Seguro que deseas descartar esta acción del sistema?");
        if (confirmDelete) {
            await deleteOfflineAction(id);
            await loadData();
            if (showNotification) showNotification("Acción descartada.", "info");
        }
    };

    const handlePrintOfflineTicket = (sale: OfflineSale) => {
        try {
            const payload = sale.salePayload || {};
            const method = payload.payment_method || 'Efectivo';
            const items = payload.items || [];
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, Math.max(160, 100 + items.length * 10)]
            });

            doc.setFont('courier', 'bold');
            doc.setFontSize(13);
            doc.text('DIGITAL STORE GTR POS', 40, 10, { align: 'center' });
            
            doc.setFontSize(8);
            doc.setFont('courier', 'normal');
            doc.text('COMPROBANTE LOCAL OFFLINE', 40, 15, { align: 'center' });
            doc.text('--------------------------------', 40, 19, { align: 'center' });
            
            doc.text(`ID Venta: ${String(sale.id).slice(0, 18)}`, 5, 24);
            doc.text(`Fecha: ${new Date(sale.createdAt || Date.now()).toLocaleString()}`, 5, 29);
            doc.text(`Cliente: ${sale.clientName || 'Cliente General'}`, 5, 34);
            if (sale.clientPhone) doc.text(`Tel: ${sale.clientPhone}`, 5, 39);
            doc.text(`Método: ${method}`, 5, 44);
            doc.text('--------------------------------', 40, 48, { align: 'center' });

            let y = 53;
            items.forEach((item: any, idx: number) => {
                const name = item.product_name || `Item #${item.product_id || idx + 1}`;
                const qty = item.quantity || 1;
                const price = Number(item.price_bob || 0);
                const sub = (qty * price).toFixed(2);
                doc.text(`${qty}x ${name.slice(0, 18)}`, 5, y);
                doc.text(`Bs. ${sub}`, 75, y, { align: 'right' });
                y += 5;
            });

            doc.text('--------------------------------', 40, y, { align: 'center' });
            y += 5;

            const totalBob = Number(payload.total_bob || 0);
            const totalUsd = Number(payload.total_usd || (totalBob / (exchangeRate || 6.96)));

            doc.setFont('courier', 'bold');
            doc.setFontSize(10);
            doc.text(`TOTAL BS:`, 5, y);
            doc.text(`Bs. ${totalBob.toFixed(2)}`, 75, y, { align: 'right' });
            y += 5;
            doc.text(`TOTAL USD:`, 5, y);
            doc.text(`$ ${totalUsd.toFixed(2)}`, 75, y, { align: 'right' });
            y += 7;

            doc.setFont('courier', 'normal');
            doc.setFontSize(7);
            doc.text('Venta almacenada en memoria local.', 40, y, { align: 'center' });
            y += 4;
            doc.text('Sincronización automática pendiente.', 40, y, { align: 'center' });

            doc.save(`Ticket_Offline_${sale.id}.pdf`);
            if (showNotification) showNotification("✓ Recibo térmico PDF generado desde la memoria offline.", "success");
        } catch (err) {
            console.error("Error generating offline ticket:", err);
            if (showNotification) showNotification("Error al generar recibo offline.", "error");
        }
    };

    const handleDownloadBackup = async () => {
        try {
            await downloadOfflineBackupFile();
            if (showNotification) showNotification("✓ Respaldo de emergencia descargado exitosamente en archivo .JSON", "success");
        } catch (e) {
            console.error("Download error:", e);
            if (showNotification) showNotification("Error al descargar respaldo offline.", "error");
        }
    };

    const handleSyncNow = async () => {
        try {
            await triggerOnlineSync();
            await loadData();
        } catch (err) {
            console.error("Manual sync failed:", err);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs select-none">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 10 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    id="offline-manager-modal-container"
                    className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
                >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#080d1a]">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                isOffline 
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' 
                                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}>
                                {isOffline ? <WifiOff size={20} className="animate-pulse" /> : <Wifi size={20} />}
                            </div>
                            <div>
                                <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                                    Centro de Control Modo Offline
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Motor Autónomo GTR POS • Base de Datos Local Indestructible
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSyncNow}
                                disabled={isSyncing || isOffline}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm ${
                                    isOffline 
                                        ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700' 
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                                title={isOffline ? "Sin conexión a internet para sincronizar" : "Sincronizar transacciones pendientes ahora"}
                            >
                                <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                                <span>{isSyncing ? "Sincronizando..." : "Sincronizar Ahora"}</span>
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Network & Live Metrics Strip */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-slate-50/40 dark:bg-black/20 border-b border-slate-100 dark:border-slate-800/60 text-xs">
                        <div className="flex flex-col p-3 rounded-xl bg-white dark:bg-[#070b13] border border-slate-200/80 dark:border-slate-800">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Estado de Red</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`w-2.5 h-2.5 rounded-full ${isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                                <span className="font-extrabold text-slate-800 dark:text-white">
                                    {isOffline ? 'Modo Local Autónomo' : 'Conectado a Internet'}
                                </span>
                            </div>
                            {networkLatency !== null && !isOffline && (
                                <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                                    Latencia: {networkLatency} ms
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col p-3 rounded-xl bg-white dark:bg-[#070b13] border border-slate-200/80 dark:border-slate-800">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Ventas en Cola</span>
                            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                                {stats.salesCount} <span className="text-xs font-medium text-slate-400">tickets</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                Total: {stats.totalAmountBob.toFixed(2)} Bs
                            </span>
                        </div>

                        <div className="flex flex-col p-3 rounded-xl bg-white dark:bg-[#070b13] border border-slate-200/80 dark:border-slate-800">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Acciones del Sistema</span>
                            <span className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                                {stats.actionsCount} <span className="text-xs font-medium text-slate-400">acciones</span>
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                Clientes / Abonos en espera
                            </span>
                        </div>

                        <div className="flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-[#070b13] border border-slate-200/80 dark:border-slate-800">
                            <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Persistencia Local</span>
                                <div className="flex items-center gap-1.5 mt-0.5 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                                    <Database size={13} />
                                    <span>IndexedDB Activo</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleDownloadBackup}
                                className="mt-1.5 flex items-center justify-center gap-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                                <Download size={11} />
                                Respaldo JSON
                            </button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 px-6 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#0c111e] overflow-x-auto scrollbar-none">
                        <button
                            type="button"
                            onClick={() => setActiveTab('server_approvals')}
                            className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                                activeTab === 'server_approvals'
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                        >
                            <ShieldAlert size={14} className={serverSales.length > 0 ? "text-amber-500 animate-pulse" : ""} />
                            <span>Bandeja de Autorización ({serverSales.length})</span>
                            {serverSales.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                                    {serverSales.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('sales')}
                            className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                                activeTab === 'sales'
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                        >
                            <ShoppingBag size={14} />
                            <span>Cola Local ({sales.length})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('actions')}
                            className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                                activeTab === 'actions'
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                        >
                            <User size={14} />
                            <span>Acciones en Cola ({actions.length})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('backup')}
                            className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                                activeTab === 'backup'
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                        >
                            <Download size={14} />
                            <span>Respaldo</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('diagnostic')}
                            className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                                activeTab === 'diagnostic'
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                        >
                            <Server size={14} />
                            <span>Diagnóstico</span>
                        </button>
                    </div>

                    {/* Tab Body */}
                    <div className="flex-1 p-6 overflow-y-auto max-h-[55vh]">
                        {/* TAB 0: SERVER APPROVALS (ONLINE-FIRST QUARANTINE INBOX) */}
                        {activeTab === 'server_approvals' && (
                            <div className="flex flex-col gap-4">
                                <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                                            <ShieldAlert size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                Control de Contingencia Online-First
                                            </h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                                                Las ventas tomadas sin conexión quedan en cuarentena y <strong>NO descuentan stock automáticamente</strong>. El Administrador verifica la disponibilidad en vivo antes de autorizar.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={loadServerPendingSales}
                                        disabled={isLoadingServerSales}
                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer self-start sm:self-auto"
                                    >
                                        <RefreshCw size={12} className={isLoadingServerSales ? "animate-spin" : ""} />
                                        <span>Actualizar Bandeja</span>
                                    </button>
                                </div>

                                {isLoadingServerSales ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <RefreshCw size={24} className="animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
                                        <span className="text-xs font-bold">Verificando bandeja de autorización...</span>
                                    </div>
                                ) : serverSales.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-3">
                                            <PackageCheck size={28} />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                            Bandeja de Autorización al Día
                                        </h3>
                                        <p className="text-xs text-slate-500 max-w-md mt-1">
                                            No hay ventas offline pendientes de validación. Todas las ventas en el sistema fueron procesadas de forma atómica y verificada.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <div className="text-xs text-slate-500 flex justify-between items-center mb-1">
                                            <span>Hay <strong>{serverSales.length}</strong> venta(s) offline esperando autorización administrativa:</span>
                                        </div>

                                        {serverSales.map((sale: any) => {
                                            const isActioning = actionInProgressId === sale.id;
                                            const hasDeficit = sale.has_deficit;

                                            return (
                                                <div 
                                                    key={sale.id}
                                                    className={`p-4 rounded-xl border transition-all flex flex-col gap-3 ${
                                                        hasDeficit 
                                                            ? 'bg-amber-50/40 dark:bg-amber-950/15 border-amber-300 dark:border-amber-800/70' 
                                                            : 'bg-slate-50 dark:bg-[#070b13] border-slate-200/80 dark:border-slate-800'
                                                    }`}
                                                >
                                                    {/* Sale Header */}
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-2.5">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs">
                                                                #{String(sale.id).slice(0, 16)}
                                                            </span>
                                                            <span className="text-xs text-slate-600 dark:text-slate-400">
                                                                Vendedor: <strong className="text-slate-800 dark:text-slate-200">{sale.user_name || 'Vendedor'}</strong>
                                                            </span>
                                                            <span className="text-xs text-slate-400">•</span>
                                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                                {new Date(sale.created_at).toLocaleString()}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                                                                {sale.payment_method}
                                                            </span>
                                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                                                Bs. {Number(sale.total || 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Client info if any */}
                                                    {(sale.client_name || sale.notes) && (
                                                        <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-4">
                                                            {sale.client_name && (
                                                                <span>Cliente: <strong className="text-slate-800 dark:text-slate-200">{sale.client_name}</strong> {sale.client_phone ? `(${sale.client_phone})` : ''}</span>
                                                            )}
                                                            {sale.notes && (
                                                                <span className="italic text-slate-500">Nota: {sale.notes}</span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Items with Stock Verification Semaphore */}
                                                    <div className="flex flex-col gap-1.5 bg-white dark:bg-black/30 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                            Artículos y Verificación de Stock en Tiempo Real:
                                                        </span>
                                                        {(sale.items || []).map((item: any, idx: number) => {
                                                            const isAvailable = item.has_sufficient_stock;
                                                            return (
                                                                <div 
                                                                    key={idx}
                                                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 border-b last:border-b-0 border-slate-100 dark:border-slate-800/60 text-xs"
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <Boxes size={14} className="text-slate-400 shrink-0" />
                                                                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                                                            {item.product_name}
                                                                        </span>
                                                                        {item.sku && (
                                                                            <span className="text-[10px] font-mono text-slate-400">
                                                                                ({item.sku})
                                                                            </span>
                                                                        )}
                                                                        <span className="text-slate-500 font-bold shrink-0">
                                                                            x{item.quantity}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        {isAvailable ? (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                                                                                <Check size={11} />
                                                                                Stock OK ({item.current_stock} disp.)
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
                                                                                <AlertTriangle size={11} />
                                                                                Déficit: Faltan {item.deficit} (Disp: {item.current_stock})
                                                                            </span>
                                                                        )}
                                                                        <span className="font-mono text-slate-600 dark:text-slate-400">
                                                                            Bs. {(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Status Warning Banner */}
                                                    {hasDeficit && (
                                                        <div className="p-2.5 rounded-lg bg-amber-100/70 dark:bg-amber-900/30 border border-amber-300/80 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                                            <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                                                            <span>
                                                                <strong>Atención:</strong> Uno o más productos no cuentan con stock suficiente en el catálogo. Si se autoriza, el stock pasará a 0 o mínimo de contingencia.
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Admin Approval Actions */}
                                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            Estado: <span className="font-bold text-amber-600 dark:text-amber-400">En Espera de Autorización</span>
                                                        </div>

                                                        {isAdmin ? (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRejectOfflineSale(sale)}
                                                                    disabled={isActioning}
                                                                    className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                                >
                                                                    <XCircle size={13} />
                                                                    <span>Rechazar Venta</span>
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleApproveOfflineSale(sale)}
                                                                    disabled={isActioning}
                                                                    className={`px-4 py-1.5 rounded-lg text-white text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 ${
                                                                        hasDeficit 
                                                                            ? 'bg-amber-600 hover:bg-amber-700' 
                                                                            : 'bg-emerald-600 hover:bg-emerald-700'
                                                                    }`}
                                                                >
                                                                    {isActioning ? (
                                                                        <RefreshCw size={13} className="animate-spin" />
                                                                    ) : (
                                                                        <Check size={13} />
                                                                    )}
                                                                    <span>
                                                                        {hasDeficit ? "Forzar Autorización" : "Autorizar y Descontar Stock"}
                                                                    </span>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs italic text-slate-400">
                                                                Requiere autorización de Administrador o Propietario.
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 1: LOCAL SALES QUEUE (DEVICE STORAGE) */}
                        {activeTab === 'sales' && (
                            <div className="flex flex-col gap-3">
                                {sales.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400 mb-3">
                                            <CheckCircle2 size={28} className="text-emerald-500" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                            No hay ventas pendientes de sincronización
                                        </h3>
                                        <p className="text-xs text-slate-500 max-w-sm mt-1">
                                            Todas las ventas emitidas en el Punto de Venta se encuentran debidamente sincronizadas con el servidor central.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2.5">
                                        <div className="text-xs text-slate-500 flex justify-between items-center mb-1">
                                            <span>Mostrando {sales.length} venta(s) guardada(s) localmente en IndexedDB:</span>
                                            <button 
                                                onClick={loadData}
                                                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                                            >
                                                <RefreshCw size={11} /> Actualizar
                                            </button>
                                        </div>

                                        {sales.map((sale) => {
                                            const payload = sale.salePayload || {};
                                            const items = payload.items || [];
                                            const total = Number(payload.total) || 0;
                                            const currency = payload.currency || 'BOB';
                                            const formattedDate = sale.createdAt ? new Date(sale.createdAt).toLocaleString() : 'Fecha no disp.';

                                            return (
                                                <div 
                                                    key={sale.id}
                                                    className="p-4 rounded-xl bg-slate-50 dark:bg-[#070b13] border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-400 transition-colors"
                                                >
                                                    <div className="flex flex-col gap-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                                                                {sale.id}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                                {payload.payment_method || 'Efectivo'}
                                                            </span>
                                                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                                <Clock size={11} /> {formattedDate}
                                                            </span>
                                                        </div>

                                                        <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 mt-0.5">
                                                            <User size={12} className="text-slate-400" />
                                                            <span className="font-bold">{sale.clientName || 'Cliente General'}</span>
                                                            {sale.clientPhone && <span className="text-slate-400 font-mono">({sale.clientPhone})</span>}
                                                            <span className="text-slate-300 dark:text-slate-700">•</span>
                                                            <span>{items.length} producto(s)</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <div className="text-right">
                                                            <span className="text-base font-black text-slate-900 dark:text-white">
                                                                {currency === 'USD' ? `$${total.toFixed(2)}` : `${total.toFixed(2)} Bs`}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePrintOfflineTicket(sale)}
                                                                className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition cursor-pointer"
                                                                title="Emitir/Imprimir Recibo Térmico PDF"
                                                            >
                                                                <FileText size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteSale(sale.id)}
                                                                className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer"
                                                                title="Descartar venta de la cola"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 2: ACTIONS */}
                        {activeTab === 'actions' && (
                            <div className="flex flex-col gap-3">
                                {actions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400 mb-3">
                                            <CheckCircle2 size={28} className="text-emerald-500" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                            No hay acciones de sistema pendientes
                                        </h3>
                                        <p className="text-xs text-slate-500 max-w-sm mt-1">
                                            Todas las creaciones de clientes y registros complementarios se han sincronizado con la base de datos central.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2.5">
                                        {actions.map((action) => (
                                            <div
                                                key={action.id}
                                                className="p-4 rounded-xl bg-slate-50 dark:bg-[#070b13] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                                            >
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                                            {action.type}
                                                        </span>
                                                        <span className="font-mono text-xs text-slate-500">
                                                            {action.method} {action.url}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">
                                                        {JSON.stringify(action.payload)}
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteAction(action.id)}
                                                    className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer shrink-0"
                                                    title="Descartar acción"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 3: BACKUP */}
                        {activeTab === 'backup' && (
                            <div className="flex flex-col gap-4">
                                <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 flex flex-col gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                                Respaldo de Emergencia Offline
                                            </h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                                Si el servidor central o el internet permanecen caídos por un tiempo prolongado, puedes descargar un archivo <strong>.JSON</strong> con todas las ventas, productos y acciones realizadas localmente.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-2 flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={handleDownloadBackup}
                                            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shadow-md shadow-indigo-600/10"
                                        >
                                            <Download size={14} />
                                            <span>Descargar Archivo de Respaldo (.JSON)</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                                        ¿Cómo funciona la seguridad de datos en GTR POS?
                                    </p>
                                    <ul className="list-disc pl-5 flex flex-col gap-1">
                                        <li>Los datos se guardan instantáneamente en <strong>IndexedDB</strong> (base de datos nativa del navegador con cuota de hasta varios Gigabytes).</li>
                                        <li>Si se cierra el navegador, se apaga la computadora o se reinicia la terminal, los datos <strong>no se pierden</strong>.</li>
                                        <li>Al detectar conexión con el servidor, la cola se procesa automáticamente de forma secuencial garantizando la consistencia del inventario y las ventas.</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: DIAGNOSTIC */}
                        {activeTab === 'diagnostic' && (
                            <div className="flex flex-col gap-4">
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Server size={16} className="text-indigo-600 dark:text-indigo-400" />
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                                Prueba de Conectividad con el Servidor
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleManualPing}
                                            disabled={isPinging}
                                            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                                        >
                                            <RefreshCw size={12} className={isPinging ? "animate-spin" : ""} />
                                            <span>Probar Ping Ahora</span>
                                        </button>
                                    </div>

                                    {pingStatus && (
                                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300">
                                            {pingStatus}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Navegador & Conexión</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {navigator.onLine ? "Online (Hardware detectado)" : "Offline (Sin interfaz de red)"}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                                            {navigator.userAgent}
                                        </span>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base de Datos Offline</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            gtr_pos_offline_db (v3)
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-1">
                                            Almacén de Ventas, Acciones y Caché de Catálogo activos.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#080d1a]">
                        <span className="text-xs text-slate-400 font-medium">
                            GTR POS v2.0 • Sincronización Automática Inteligente
                        </span>

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                        >
                            Cerrar
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default OfflineManagerModal;
