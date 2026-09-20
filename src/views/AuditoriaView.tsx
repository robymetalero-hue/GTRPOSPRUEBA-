import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import PhysicalCountManager from '../components/PhysicalCountManager';
import { TableSkeleton, EmptyState } from '../components/UIStateFeedback';
import { 
    History, Search, Filter, RefreshCw, Calendar, ArrowDownLeft, 
    ArrowUpRight, ShoppingBag, ClipboardList, User, ShieldCheck, Download,
    AlertTriangle, CheckCircle, XCircle, Eye, EyeOff, ChevronLeft, ChevronRight, 
    Coins, Settings, Database, Server, Info, ArrowRight, ShieldAlert, FileSpreadsheet,
    Lock, Unlock, Package, Layers, X
} from 'lucide-react';

export default function AuditoriaView() {
    const { showNotification, user } = useAppContext();
    const isAdmin = user?.role === 'admin' || user?.role === 'propietario' || user?.role === 'administrador' || user?.role === 'dueño' || user?.role === 'jefe';

    // Dynamic View Mode: 'quantities' (Vista con Cantidades) vs 'blind' (Vista Ciega)
    const [auditViewMode, setAuditViewMode] = useState<'quantities' | 'blind'>(isAdmin ? 'quantities' : 'blind');

    // Main Navigation Tabs
    const [activeTab, setActiveTab] = useState<'general' | 'conteo_fisico' | 'precios'>('general');

    // Audit Logs State
    const [logs, setLogs] = useState<any[]>([]);
    const [uniqueUsers, setUniqueUsers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination state
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    // Filters state
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('todos');
    const [severityFilter, setSeverityFilter] = useState<string>('todos');
    const [statusFilter, setStatusFilter] = useState<string>('todos');
    const [userFilter, setUserFilter] = useState<string>('todos');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [productSearch, setProductSearch] = useState<string>('');

    // Modal/Detail view state
    const [selectedLog, setSelectedLog] = useState<any | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [viewRawJSON, setViewRawJSON] = useState(false);

    // Price History specific states
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [priceHistory, setPriceHistory] = useState<any[]>([]);
    const [loadingPriceHistory, setLoadingPriceHistory] = useState(false);
    const [allProductsList, setAllProductsList] = useState<any[]>([]);

    // Automatically enforce 'blind' mode if user is not an administrator
    useEffect(() => {
        if (!isAdmin && auditViewMode === 'quantities') {
            setAuditViewMode('blind');
        }
    }, [isAdmin, auditViewMode]);

    // Handle view mode toggle
    const handleToggleViewMode = (mode: 'quantities' | 'blind') => {
        if (!isAdmin && mode === 'quantities') {
            showNotification('Acceso Denegado: Solo el perfil Administrador puede ver las existencias esperadas.', 'warning');
            return;
        }
        setAuditViewMode(mode);
        showNotification(
            mode === 'quantities' 
                ? 'Vista con Cantidades Reales Activada (Modo Transparente)' 
                : 'Vista Ciega Activada (Sin sesgo de cantidades)',
            'info'
        );
    };

    // Fetch master logs
    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', String(page));
            params.append('limit', String(limit));
            if (searchTerm) params.append('search', searchTerm);
            if (activeTab === 'precios') {
                params.append('category', 'precios');
            } else if (categoryFilter && categoryFilter !== 'todos') {
                params.append('category', categoryFilter);
            }
            if (severityFilter && severityFilter !== 'todos') params.append('severity', severityFilter);
            if (statusFilter && statusFilter !== 'todos') params.append('status', statusFilter);
            if (userFilter && userFilter !== 'todos') params.append('user', userFilter);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (productSearch) params.append('product', productSearch);

            const res = await fetch(`/api/system-audit?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
                setUniqueUsers(data.users || []);
                setTotalPages(data.pagination?.pages || 1);
                setTotalRecords(data.pagination?.total || 0);
            } else {
                showNotification('Error al cargar la auditoría avanzada', 'error');
            }
        } catch (e) {
            console.error("Error fetching audit logs:", e);
            showNotification('Error de conexión con el servicio de auditoría', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Fetch product list for Price History search
    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                const data = await res.json();
                setAllProductsList(data || []);
            }
        } catch (err) {
            console.error("Error fetching products list:", err);
        }
    };

    // Fetch Price History for a specific product
    const fetchProductPriceHistory = async (prodId: string) => {
        if (!prodId) return;
        setLoadingPriceHistory(true);
        try {
            const res = await fetch(`/api/products/${prodId}/price-history`);
            if (res.ok) {
                const data = await res.json();
                setPriceHistory(data || []);
            } else {
                showNotification('Error al recuperar historial de precios', 'error');
            }
        } catch (e) {
            console.error(e);
            showNotification('Fallo de conexión', 'error');
        } finally {
            setLoadingPriceHistory(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'conteo_fisico') {
            fetchLogs();
        }
    }, [page, limit, categoryFilter, severityFilter, statusFilter, userFilter, startDate, endDate, productSearch, activeTab]);

    useEffect(() => {
        const handleInventoryOperation = () => {
            if (activeTab !== 'conteo_fisico') {
                fetchLogs();
            }
            fetchProducts();
        };
        window.addEventListener('inventory_operation', handleInventoryOperation);
        return () => {
            window.removeEventListener('inventory_operation', handleInventoryOperation);
        };
    }, [page, limit, categoryFilter, severityFilter, statusFilter, userFilter, startDate, endDate, productSearch, activeTab]);

    useEffect(() => {
        fetchProducts();
    }, []);

    // Debounce search term changes so typing or clearing updates automatically
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            if (activeTab !== 'conteo_fisico') {
                fetchLogs();
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const triggerSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchLogs();
    };

    const resetFilters = () => {
        setSearchTerm('');
        setCategoryFilter('todos');
        setSeverityFilter('todos');
        setStatusFilter('todos');
        setUserFilter('todos');
        setStartDate('');
        setEndDate('');
        setProductSearch('');
        setPage(1);
    };

    // Stats calculations
    const statsSummary = useMemo(() => {
        let authLogsCount = 0;
        let priceLogsCount = 0;
        let criticalLogsCount = 0;
        let failedLogsCount = 0;

        logs.forEach(log => {
            if (log.category === 'autenticacion') authLogsCount++;
            if (log.category === 'precios') priceLogsCount++;
            if (log.severity === 'critical') criticalLogsCount++;
            if (log.status === 'failed') failedLogsCount++;
        });

        return { authLogsCount, priceLogsCount, criticalLogsCount, failedLogsCount };
    }, [logs]);

    const getCategoryBadge = (category: string) => {
        switch (category) {
            case 'autenticacion':
                return <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:bg-purple-500/5 dark:text-purple-400 rounded-md">Seguridad</span>;
            case 'usuarios':
                return <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:bg-blue-500/5 dark:text-blue-400 rounded-md">Usuarios</span>;
            case 'productos':
                return <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/5 dark:text-indigo-400 rounded-md">Productos</span>;
            case 'precios':
                return <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:bg-amber-500/5 dark:text-amber-400 rounded-md">Precios/Costos</span>;
            case 'inventario':
                return <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 rounded-md">Inventario</span>;
            case 'ventas':
                return <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-pink-500/10 text-pink-600 dark:bg-pink-500/5 dark:text-pink-400 rounded-md">Ventas</span>;
            case 'configuracion':
                return <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/5 dark:text-cyan-400 rounded-md">Configuración</span>;
            default:
                return <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">Sistema</span>;
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'info':
                return <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-sky-500/10 text-sky-600 rounded-md">Baja</span>;
            case 'warning':
                return <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-amber-500/10 text-amber-600 rounded-md">Media</span>;
            case 'critical':
                return <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-red-500/15 text-red-600 dark:bg-red-500/10 dark:text-red-400 rounded-md animate-pulse">Crítica</span>;
            default:
                return <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-slate-100 text-slate-500 rounded-md">Info</span>;
        }
    };

    const getStatusIcon = (status: string) => {
        if (status === 'success') {
            return <CheckCircle className="text-emerald-500 shrink-0" size={15} title="Éxito" />;
        }
        return <XCircle className="text-rose-500 shrink-0" size={15} title="Fallo" />;
    };

    const exportToCSV = () => {
        try {
            const headers = ['UUID', 'Fecha/Hora', 'Categoría', 'Tipo de Evento', 'Acción', 'Criticidad', 'Resultado', 'Responsable', 'Rol', 'Entidad Afectada', 'ID Entidad', 'Motivo', 'Detalle Técnico'];
            const rows = logs.map(log => [
                log.id,
                new Date(log.created_at).toLocaleString(),
                log.category,
                log.event_type,
                log.action,
                log.severity,
                log.status,
                log.user_name || 'Sistema',
                log.user_role || 'system',
                log.entity_name || '',
                log.entity_id || '',
                log.reason || '',
                log.metadata || ''
            ]);
            
            const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
                + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
            
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `auditoria_sistema_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification('Auditoría avanzada exportada con éxito', 'success');
        } catch (e) {
            showNotification('Error al exportar los datos a CSV', 'error');
        }
    };

    const exportToJSON = () => {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `reporte_seguridad_auditoria_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            document.body.removeChild(downloadAnchor);
            showNotification('Reporte JSON de seguridad exportado correctamente', 'success');
        } catch (e) {
            showNotification('Error al exportar reporte JSON', 'error');
        }
    };

    // Formatter for stock values depending on auditViewMode (Blind vs Quantities)
    const renderStockValue = (val: number | string | null | undefined, suffix: string = 'Uds') => {
        if (val === null || val === undefined) return '—';
        if (auditViewMode === 'blind') {
            return (
                <span className="inline-flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px] font-black border border-amber-500/20" title="Cantidad Oculta en Vista Ciega">
                    <Lock size={10} className="shrink-0" /> *** {suffix}
                </span>
            );
        }
        return `${val} ${suffix}`;
    };

    // Helper to render parsed before/after comparisons dynamically inside modal
    const renderComparisonFields = (log: any) => {
        let before: any = null;
        let after: any = null;
        let changed: any = null;

        try {
            before = typeof log.before_data === 'string' ? JSON.parse(log.before_data) : log.before_data;
            after = typeof log.after_data === 'string' ? JSON.parse(log.after_data) : log.after_data;
            changed = typeof log.changed_fields === 'string' ? JSON.parse(log.changed_fields) : log.changed_fields;
        } catch (e) {
            console.error("JSON parsing error on details view", e);
        }

        const qBefore = log.quantity_before !== undefined && log.quantity_before !== null ? log.quantity_before : (log.quantityBefore !== undefined ? log.quantityBefore : null);
        const qChanged = log.quantity_changed !== undefined && log.quantity_changed !== null ? log.quantity_changed : (log.quantityChanged !== undefined ? log.quantityChanged : null);
        const qAfter = log.quantity_after !== undefined && log.quantity_after !== null ? log.quantity_after : (log.quantityAfter !== undefined ? log.quantityAfter : null);
        const pBefore = log.price_before !== undefined && log.price_before !== null ? log.price_before : (log.priceBefore !== undefined ? log.priceBefore : null);
        const pAfter = log.price_after !== undefined && log.price_after !== null ? log.price_after : (log.priceAfter !== undefined ? log.priceAfter : null);

        const hasStockData = qBefore !== null || qChanged !== null || qAfter !== null;
        const hasPriceData = pBefore !== null || pAfter !== null;

        // Custom UI for stock/inventory traceability
        let stockVisualCard = null;
        if (hasStockData) {
            const isPositive = qChanged !== null && qChanged >= 0;
            stockVisualCard = (
                <div className="flex flex-col gap-3 bg-slate-50 dark:bg-[#070c14] border border-slate-200/80 dark:border-slate-850/60 rounded-2xl p-4">
                    <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/40 pb-2">
                        <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-indigo-500 flex items-center gap-1.5">
                            <Database size={13} className="text-indigo-500" />
                            Trazabilidad de Inventario
                        </span>
                        {auditViewMode === 'blind' ? (
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                <Lock size={10} /> Vista Ciega Aplicada
                            </span>
                        ) : log.entity_name && (
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={log.entity_name}>
                                {log.entity_name}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
                        {/* 1. Stock Previo */}
                        <div className="bg-white dark:bg-[#0c111e] border border-slate-200/80 dark:border-slate-850/50 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                            <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
                                <span className="text-[9px] font-bold uppercase tracking-wider">Unidades Antes</span>
                                <ClipboardList size={14} className="opacity-80" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-lg font-black text-slate-700 dark:text-slate-200">
                                    {renderStockValue(qBefore)}
                                </span>
                            </div>
                            <span className="text-[8px] text-slate-400 mt-1 block">Existencias previas</span>
                        </div>

                        {/* 2. Cantidad Cambio */}
                        <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-xs ${
                            isPositive 
                                ? 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-500/5 dark:border-emerald-500/20' 
                                : 'bg-rose-500/5 border-rose-500/20 dark:bg-rose-500/5 dark:border-rose-500/20'
                        }`}>
                            <div className="flex items-center justify-between">
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {isPositive ? 'Cantidad Ingresada' : 'Cantidad Egresada'}
                                </span>
                                {isPositive ? (
                                    <ArrowUpRight size={14} className="text-emerald-500" />
                                ) : (
                                    <ArrowDownLeft size={14} className="text-rose-500" />
                                )}
                            </div>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className={`text-lg font-black ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {auditViewMode === 'blind' ? renderStockValue(qChanged) : (qChanged !== null ? `${isPositive ? '+' : ''}${qChanged} Uds` : '—')}
                                </span>
                            </div>
                            <span className="text-[8px] text-slate-400 mt-1 block">Variación registrada</span>
                        </div>

                        {/* 3. Stock Posterior */}
                        <div className="bg-white dark:bg-[#0c111e] border border-slate-200/80 dark:border-slate-850/50 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                            <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
                                <span className="text-[9px] font-bold uppercase tracking-wider">Unidades Después</span>
                                <CheckCircle size={14} className="text-indigo-500/80" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-lg font-black text-slate-850 dark:text-slate-100">
                                    {renderStockValue(qAfter)}
                                </span>
                            </div>
                            <span className="text-[8px] text-slate-400 mt-1 block font-semibold text-indigo-500 dark:text-indigo-400">Balance auditado</span>
                        </div>
                    </div>
                </div>
            );
        }

        // Custom UI for price/cost changes
        let priceVisualCard = null;
        if (hasPriceData) {
            priceVisualCard = (
                <div className="flex flex-col gap-3 bg-slate-50 dark:bg-[#070c14] border border-slate-200/80 dark:border-slate-850/60 rounded-2xl p-4">
                    <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/40 pb-2">
                        <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
                            <Coins size={13} className="text-emerald-500" />
                            Ajuste de Precios / Costos
                        </span>
                    </div>

                    <div className="flex items-center justify-center gap-8 py-3 bg-white dark:bg-[#0c111e] border border-slate-200/80 dark:border-slate-850/50 rounded-xl shadow-xs font-semibold">
                        {pBefore !== null && (
                            <div className="flex flex-col items-center">
                                <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider">Valor Anterior</span>
                                <span className="text-sm font-bold text-slate-500 line-through mt-0.5">
                                    ${Number(pBefore).toFixed(2)} USD
                                </span>
                            </div>
                        )}

                        {pBefore !== null && pAfter !== null && (
                            <ArrowRight size={16} className="text-slate-350 dark:text-slate-500 animate-pulse" />
                        )}

                        {pAfter !== null && (
                            <div className="flex flex-col items-center">
                                <span className="text-[8px] text-emerald-500 font-extrabold uppercase tracking-wider">Valor Nuevo</span>
                                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    ${Number(pAfter).toFixed(2)} USD
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (hasStockData || hasPriceData || (changed && Object.keys(changed).length > 0)) {
            return (
                <div className="flex flex-col gap-3">
                    {stockVisualCard}
                    {priceVisualCard}

                    {changed && Object.keys(changed).length > 0 && (
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Campos Modificados</span>
                            <div className="grid grid-cols-1 gap-1.5 border border-slate-200/80 dark:border-slate-850/60 rounded-xl overflow-hidden text-xs bg-white dark:bg-[#0c111e]">
                                <div className="grid grid-cols-3 bg-slate-50 dark:bg-[#070c14] px-3.5 py-1.5 font-mono text-[9px] font-black uppercase text-slate-400 border-b border-slate-200/60 dark:border-slate-850/40">
                                    <span>Propiedad</span>
                                    <span>Anterior</span>
                                    <span>Nuevo</span>
                                </div>
                                {Object.entries(changed).map(([key, value]: [string, any]) => {
                                    let beforeVal = value?.before;
                                    let afterVal = value?.after;
                                    if (typeof beforeVal === 'object') beforeVal = JSON.stringify(beforeVal);
                                    if (typeof afterVal === 'object') afterVal = JSON.stringify(afterVal);
                                    return (
                                        <div key={key} className="grid grid-cols-3 px-3.5 py-1.5 border-b border-slate-100 dark:border-slate-850 last:border-0 font-semibold items-center">
                                            <span className="font-mono text-indigo-500 dark:text-indigo-400 truncate pr-1">{key}</span>
                                            <span className="text-red-500 line-through truncate pr-2">{String(beforeVal !== undefined ? beforeVal : '—')}</span>
                                            <span className="text-emerald-500 truncate">{String(afterVal !== undefined ? afterVal : '—')}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="bg-slate-50 dark:bg-[#070c14] p-3 rounded-xl text-center italic text-slate-400 text-xs">
                Sin variaciones adicionales registradas.
            </div>
        );
    };

    return (
        <div className="h-full w-full max-h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-[#070c14] text-slate-800 dark:text-slate-100 p-3 sm:p-4 gap-2.5 select-none">
            {/* Top Header section */}
            <div className="flex-shrink-0 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white dark:bg-[#0c111e] p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-850/60 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                        <History size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-sm sm:text-base font-black uppercase tracking-wider">
                                Auditoría y Control de Inventario
                            </h1>
                            {/* Dynamic Admin View Mode Badge */}
                            {auditViewMode === 'quantities' ? (
                                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-500/20 flex items-center gap-1">
                                    <Unlock size={10} /> Transparente (Cantidades Visibles)
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/20 flex items-center gap-1">
                                    <Lock size={10} /> Vista Ciega Activa (Sin Sesgo)
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                            <ShieldCheck className="text-emerald-500 shrink-0" size={12} />
                            Registro inmutable de trazabilidad, eventos de seguridad y arqueo físico.
                        </p>
                    </div>
                </div>

                {/* Right controls: View Mode Filter Toggle, Tabs, and Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                    
                    {/* DYNAMIC VIEW MODE FILTER: Vista Ciega vs Vista con Cantidades */}
                    <div className="bg-slate-100 dark:bg-[#070c14] p-1 rounded-xl border border-slate-200/80 dark:border-slate-850/60 flex items-center">
                        <button
                            type="button"
                            onClick={() => handleToggleViewMode('quantities')}
                            className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                                auditViewMode === 'quantities' 
                                    ? 'bg-emerald-600 text-white shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                            title={isAdmin ? "Mostrar existencias esperadas reales" : "Solo Administrador"}
                        >
                            <Eye size={12} />
                            <span>Cantidades</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleToggleViewMode('blind')}
                            className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                                auditViewMode === 'blind' 
                                    ? 'bg-amber-600 text-white shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                            title="Ocultar existencias para evitar sesgos"
                        >
                            <EyeOff size={12} />
                            <span>Vista Ciega</span>
                        </button>
                    </div>

                    {/* Navigation Tab Selector */}
                    <div className="bg-slate-100 dark:bg-[#070c14] p-1 rounded-xl border border-slate-200/80 dark:border-slate-850/60 flex items-center">
                        <button
                            onClick={() => { setActiveTab('general'); resetFilters(); }}
                            className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'general' 
                                    ? 'bg-indigo-600 text-white shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <ClipboardList size={12} />
                            <span>Bitácora</span>
                        </button>
                        <button
                            onClick={() => { setActiveTab('conteo_fisico'); }}
                            className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'conteo_fisico' 
                                    ? 'bg-indigo-600 text-white shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <Package size={12} />
                            <span>Conteo Físico</span>
                        </button>
                        <button
                            onClick={() => { setActiveTab('precios'); resetFilters(); }}
                            className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'precios' 
                                    ? 'bg-indigo-600 text-white shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <Coins size={12} />
                            <span>Precios</span>
                        </button>
                    </div>

                    {/* Action buttons */}
                    {activeTab !== 'conteo_fisico' && (
                        <>
                            <button 
                                onClick={fetchLogs}
                                className="p-2 bg-slate-100 dark:bg-[#070c14] border border-slate-200/80 dark:border-slate-850/60 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl flex items-center justify-center cursor-pointer transition-all"
                                title="Actualizar Datos"
                            >
                                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                            </button>
                            
                            <button
                                onClick={exportToCSV}
                                className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl shadow-xs border border-emerald-500/20 flex items-center gap-1 cursor-pointer transition-all uppercase"
                                title="Exportar CSV"
                            >
                                <FileSpreadsheet size={12} />
                                CSV
                            </button>

                            <button
                                onClick={exportToJSON}
                                className="px-2.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black rounded-xl shadow-xs border border-slate-700/30 flex items-center gap-1 cursor-pointer transition-all uppercase"
                                title="Exportar JSON"
                            >
                                <Download size={12} />
                                JSON
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Main Content View Container (100% Height Flex Layout) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2.5">

                {/* TAB 1: BITÁCORA GENERAL DE EVENTOS Y TRAZABILIDAD */}
                {activeTab === 'general' && (
                    <>
                        {/* Compact Presets & Filter Row */}
                        <div className="flex-shrink-0 bg-white dark:bg-[#0c111e] p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-850/60 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[9.5px] uppercase font-black tracking-widest text-slate-400 px-1 flex items-center gap-1">
                                    <Filter size={11} className="text-indigo-500" /> Presets:
                                </span>

                                <button
                                    onClick={() => { resetFilters(); setSeverityFilter('critical'); }}
                                    className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 text-[10.5px] font-black ${
                                        severityFilter === 'critical' 
                                            ? 'bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400' 
                                            : 'bg-slate-50 dark:bg-[#070c14] border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-red-400'
                                    }`}
                                >
                                    <ShieldAlert size={11} className="text-red-500" /> Críticos ({statsSummary.criticalLogsCount})
                                </button>

                                <button
                                    onClick={() => { resetFilters(); setCategoryFilter('autenticacion'); }}
                                    className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 text-[10.5px] font-black ${
                                        categoryFilter === 'autenticacion' 
                                            ? 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-400' 
                                            : 'bg-slate-50 dark:bg-[#070c14] border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-purple-400'
                                    }`}
                                >
                                    <User size={11} className="text-purple-500" /> Accesos ({statsSummary.authLogsCount})
                                </button>

                                <button
                                    onClick={() => { resetFilters(); setCategoryFilter('inventario'); }}
                                    className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 text-[10.5px] font-black ${
                                        categoryFilter === 'inventario' 
                                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400' 
                                            : 'bg-slate-50 dark:bg-[#070c14] border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
                                    }`}
                                >
                                    <Database size={11} className="text-emerald-500" /> Inventario
                                </button>

                                <button
                                    onClick={() => { resetFilters(); setStatusFilter('failed'); }}
                                    className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 text-[10.5px] font-black ${
                                        statusFilter === 'failed' 
                                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400' 
                                            : 'bg-slate-50 dark:bg-[#070c14] border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-rose-400'
                                    }`}
                                >
                                    <XCircle size={11} className="text-rose-500" /> Rechazos ({statsSummary.failedLogsCount})
                                </button>
                            </div>

                            {/* Search and Filters inline controls */}
                            <form onSubmit={triggerSearch} className="flex items-center gap-1.5 flex-1 max-w-xl justify-end">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2 text-slate-400" size={12} />
                                    <input
                                        type="text"
                                        placeholder="Buscar por motivo, ticket, usuario o evento..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-7 pr-7 py-1.5 bg-slate-50 dark:bg-[#070c14] border border-slate-200/80 dark:border-slate-850/60 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                    />
                                    {searchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>

                                <select
                                    value={categoryFilter}
                                    onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                                    className="bg-slate-50 dark:bg-[#070c14] border border-slate-200/80 dark:border-slate-850/60 rounded-xl text-xs font-semibold py-1.5 px-2 focus:outline-none cursor-pointer"
                                >
                                    <option value="todos">Todas Categorías</option>
                                    <option value="autenticacion">Seguridad/Accesos</option>
                                    <option value="inventario">Ajustes Inventario</option>
                                    <option value="precios">Precios/Costos</option>
                                    <option value="usuarios">Usuarios</option>
                                    <option value="ventas">Ventas</option>
                                    <option value="caja">Cajas</option>
                                    <option value="configuracion">Configuración</option>
                                </select>

                                {(severityFilter !== 'todos' || categoryFilter !== 'todos' || statusFilter !== 'todos' || userFilter !== 'todos' || searchTerm !== '') && (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-extrabold uppercase shrink-0"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </form>
                        </div>

                        {/* Table View Container (Takes 100% Remaining Height) */}
                        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/80 dark:border-slate-850/60 overflow-hidden shadow-xs">
                            
                            {/* Table Header Fixed */}
                            <div className="overflow-x-auto flex-1 flex flex-col min-h-0">
                                <table className="w-full border-collapse text-left">
                                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#070c14] border-b border-slate-200/80 dark:border-slate-850/60">
                                        <tr className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 font-mono">
                                            <th className="px-4 py-2.5">Fecha/Hora</th>
                                            <th className="px-4 py-2.5">Categoría</th>
                                            <th className="px-4 py-2.5">Evento / Acción</th>
                                            <th className="px-4 py-2.5">Responsable</th>
                                            <th className="px-4 py-2.5">Entidad Afectada</th>
                                            <th className="px-4 py-2.5">Trazabilidad Stock</th>
                                            <th className="px-4 py-2.5 text-center">Criticidad</th>
                                            <th className="px-4 py-2.5 text-center">Estado</th>
                                            <th className="px-4 py-2.5 text-center">Ver</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100/80 dark:divide-slate-850/60 text-xs font-semibold overflow-y-auto">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={9} className="p-6">
                                                    <TableSkeleton rows={6} cols={9} />
                                                </td>
                                            </tr>
                                        ) : logs.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="p-8">
                                                    <EmptyState
                                                        icon={ShieldCheck}
                                                        title="Sin registros de auditoría"
                                                        description="No se encontraron eventos coincidentes con los filtros aplicados o no hay incidentes registrados en este período."
                                                        actionLabel="Restablecer Filtros"
                                                        onAction={resetFilters}
                                                    />
                                                </td>
                                            </tr>
                                        ) : (
                                            logs.map((log) => {
                                                const qBefore = log.quantity_before !== undefined && log.quantity_before !== null ? log.quantity_before : (log.quantityBefore !== undefined ? log.quantityBefore : null);
                                                const qAfter = log.quantity_after !== undefined && log.quantity_after !== null ? log.quantity_after : (log.quantityAfter !== undefined ? log.quantityAfter : null);
                                                const hasStockTraceability = qBefore !== null || qAfter !== null;

                                                return (
                                                    <tr 
                                                        key={log.id} 
                                                        className="hover:bg-slate-50/70 dark:hover:bg-[#070c14]/30 transition duration-150"
                                                    >
                                                        <td className="px-4 py-2.5 text-[10.5px] whitespace-nowrap font-mono text-slate-500">
                                                            {new Date(log.created_at).toLocaleString()}
                                                        </td>

                                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                                            {getCategoryBadge(log.category)}
                                                        </td>

                                                        <td className="px-4 py-2.5">
                                                            <div className="flex flex-col">
                                                                <span className="text-slate-800 dark:text-slate-200 font-black uppercase text-[10px] leading-tight">{log.action || 'Operación'}</span>
                                                                <span className="font-mono text-[8.5px] text-slate-400 mt-0.5 truncate max-w-[150px]">{log.event_type}</span>
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5 uppercase text-[10px] font-black text-slate-600 dark:text-slate-350">
                                                                <div className="w-5 h-5 bg-slate-100 dark:bg-[#12192d] rounded-full flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-800">
                                                                    <User size={10} />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span>{log.user_name || 'Sistema'}</span>
                                                                    <span className="text-[8px] text-slate-400 font-normal lowercase">{log.user_role || 'cajero'}</span>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-2.5">
                                                            <div className="flex flex-col max-w-[160px] truncate">
                                                                <span className="text-slate-800 dark:text-slate-200 font-extrabold uppercase leading-tight truncate">{log.entity_name || 'N/A'}</span>
                                                                <span className="font-mono text-[8px] text-slate-400 mt-0.5">{log.entity_type ? `${log.entity_type} ID: ${log.entity_id || '?'}` : 'sin entidad'}</span>
                                                            </div>
                                                        </td>

                                                        {/* Stock Traceability Column in Table */}
                                                        <td className="px-4 py-2.5 font-mono text-[10px]">
                                                            {hasStockTraceability ? (
                                                                <div className="flex items-center gap-1 font-bold">
                                                                    <span className="text-slate-500">{renderStockValue(qBefore, '')}</span>
                                                                    <ArrowRight size={10} className="text-slate-400" />
                                                                    <span className="text-emerald-600 dark:text-emerald-400 font-black">{renderStockValue(qAfter, 'pz')}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 italic text-[9px]">Sin stock</span>
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-2.5 whitespace-nowrap text-center">
                                                            {getSeverityBadge(log.severity)}
                                                        </td>

                                                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                                                            <div className="flex justify-center">
                                                                {getStatusIcon(log.status)}
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                                                            <button
                                                                onClick={() => { setSelectedLog(log); setShowDetailModal(true); }}
                                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#12192d] dark:hover:bg-[#1b253f] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg cursor-pointer transition-all inline-flex items-center gap-1 text-[9px] font-black uppercase"
                                                            >
                                                                <Eye size={11} />
                                                                <span>Ver</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pinned High-Performance Pagination Footer */}
                            {!loading && logs.length > 0 && (
                                <div className="flex-shrink-0 bg-slate-50/90 dark:bg-[#070c14]/90 px-4 py-2.5 border-t border-slate-200/80 dark:border-slate-850/60 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                                    <div>
                                        <span>Mostrando {(page-1)*limit + 1} - {Math.min(page*limit, totalRecords)} de {totalRecords} registros</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 bg-white dark:bg-[#0c111e] border border-slate-200/80 dark:border-slate-850/60 rounded-lg px-2">
                                            <span className="text-[9px] text-slate-400">Filas:</span>
                                            <select
                                                value={limit}
                                                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                                                className="bg-transparent border-none py-1 focus:outline-none font-bold text-xs"
                                            >
                                                <option value={25}>25</option>
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button
                                                disabled={page === 1}
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                className="p-1 rounded-lg border border-slate-200/80 dark:border-slate-850/60 bg-white dark:bg-[#0c111e] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-slate-500"
                                            >
                                                <ChevronLeft size={13} />
                                            </button>
                                            <span className="text-xs px-2 py-0.5 font-bold">Pág. {page} de {totalPages}</span>
                                            <button
                                                disabled={page === totalPages}
                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                className="p-1 rounded-lg border border-slate-200/80 dark:border-slate-850/60 bg-white dark:bg-[#0c111e] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-slate-500"
                                            >
                                                <ChevronRight size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* TAB 2: AUDITORÍA FÍSICA DE INVENTARIO (CONTEOS EN TIEMPO REAL) */}
                {activeTab === 'conteo_fisico' && (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <PhysicalCountManager 
                            embeddedMode={true} 
                            externalViewMode={auditViewMode}
                        />
                    </div>
                )}

                {/* TAB 3: HISTORIAL DE PRECIOS Y COSTOS */}
                {activeTab === 'precios' && (
                    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3.5 overflow-hidden">
                        {/* Left Panel: Product Selector */}
                        <div className="lg:col-span-1 overflow-y-auto flex flex-col gap-3">
                            <div className="bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/80 dark:border-slate-850/60 p-4 shadow-xs">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3 block">Selección de Producto</span>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-extrabold text-slate-400 uppercase">Buscar producto a auditar</label>
                                    <select
                                        value={selectedProductId}
                                        onChange={(e) => {
                                            setSelectedProductId(e.target.value);
                                            fetchProductPriceHistory(e.target.value);
                                        }}
                                        className="w-full bg-slate-50 dark:bg-[#070c14] border border-slate-200/80 dark:border-slate-850/60 rounded-xl text-xs font-semibold py-2.5 px-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                        <option value="">Seleccione un producto...</option>
                                        {allProductsList.map((p: any) => (
                                            <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedProductId && (
                                    <div className="border-t border-slate-100 dark:border-slate-850 mt-4 pt-3 flex flex-col gap-1.5">
                                        <span className="text-[9px] font-extrabold uppercase text-slate-400 font-mono">Estatus Actual en Almacén</span>
                                        {allProductsList.filter(p => String(p.id) === String(selectedProductId)).map((p: any) => (
                                            <div key={p.id} className="flex flex-col gap-1 mt-1 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400 font-semibold">Precio Unitario:</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-100">${Number(p.price_unit).toFixed(2)} USD</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400 font-semibold">Precio Mayorista:</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-100">${Number(p.price_bulk).toFixed(2)} USD</span>
                                                </div>
                                                {isAdmin && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400 font-semibold">Costo Compra:</span>
                                                        <span className="font-bold text-red-500 dark:text-red-400">${Number(p.price_cost || 0).toFixed(2)} USD</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400 font-semibold">Stock Físico Actual:</span>
                                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                                                        {renderStockValue(p.stock, 'pz')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/80 dark:border-slate-850/60 p-4 shadow-xs text-xs">
                                <h4 className="font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                                    <Info size={13} className="text-indigo-500" />
                                    Trazabilidad de Precios
                                </h4>
                                <p className="text-slate-400 leading-relaxed font-semibold text-[11px]">
                                    Todo ajuste en el costo de reposición o en los precios al consumidor se registra con timbre de usuario y timestamp.
                                </p>
                            </div>
                        </div>

                        {/* Right Panel: Timeline */}
                        <div className="lg:col-span-2 overflow-y-auto bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/80 dark:border-slate-850/60 p-4 shadow-xs flex flex-col min-h-0">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3 block">Historial Cronológico de Precios</span>

                            {loadingPriceHistory ? (
                                <div className="flex-1 flex flex-col justify-center items-center py-12 gap-2">
                                    <RefreshCw className="text-indigo-500 animate-spin" size={20} />
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cargando variaciones...</span>
                                </div>
                            ) : !selectedProductId ? (
                                <div className="flex-1 flex flex-col justify-center items-center py-12 text-center text-slate-400 font-black uppercase text-xs tracking-wider border-2 border-dashed border-slate-100 dark:border-slate-850 rounded-2xl">
                                    Seleccione un producto a la izquierda para cargar su historial.
                                </div>
                            ) : priceHistory.length === 0 ? (
                                <div className="flex-1 flex flex-col justify-center items-center py-12 text-center text-slate-400 font-black uppercase text-xs tracking-wider border-2 border-dashed border-slate-100 dark:border-slate-850 rounded-2xl">
                                    Sin registros de variaciones de precio/costo para este producto.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4 relative pl-4 border-l border-slate-200/80 dark:border-slate-850/60 ml-2 py-1 flex-1">
                                    {priceHistory.map((historyLog) => {
                                        const isCostChange = historyLog.event_type === 'cambio_costo';
                                        const beforeData = typeof historyLog.before_data === 'string' ? JSON.parse(historyLog.before_data || '{}') : (historyLog.before_data || {});
                                        const afterData = typeof historyLog.after_data === 'string' ? JSON.parse(historyLog.after_data || '{}') : (historyLog.after_data || {});
                                        
                                        const prevPrice = isCostChange ? (beforeData.price_cost || historyLog.price_before) : (beforeData.price_unit || historyLog.price_before);
                                        const newPrice = isCostChange ? (afterData.price_cost || historyLog.price_after) : (afterData.price_unit || historyLog.price_after);

                                        return (
                                            <div key={historyLog.id} className="relative group">
                                                <div className={`absolute -left-[22px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0c111e] ${isCostChange ? 'bg-red-500' : 'bg-indigo-500'}`} />

                                                <div className="bg-slate-50 dark:bg-[#070c14] rounded-xl p-3 border border-slate-200/60 dark:border-slate-850/40">
                                                    <div className="flex justify-between items-center gap-2 mb-1.5 border-b border-slate-100 dark:border-slate-850 pb-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-[9.5px] text-slate-400">{new Date(historyLog.created_at).toLocaleString()}</span>
                                                            <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded ${isCostChange ? 'bg-red-500/10 text-red-600' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                                                                {isCostChange ? 'Costo Compra' : 'Precio Venta'}
                                                            </span>
                                                        </div>
                                                        <span className="text-[9.5px] text-slate-400 font-extrabold uppercase flex items-center gap-1">
                                                            <User size={10} />
                                                            {historyLog.user_name || 'admin'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-3 text-xs">
                                                        <div className="flex items-center gap-2 font-mono">
                                                            <span className="text-slate-400 line-through">${Number(prevPrice || 0).toFixed(2)} USD</span>
                                                            <ArrowRight className="text-slate-400" size={12} />
                                                            <span className={`font-black ${isCostChange ? 'text-red-500' : 'text-emerald-500'}`}>${Number(newPrice || 0).toFixed(2)} USD</span>
                                                        </div>

                                                        <span className="text-slate-500 italic text-[10.5px] truncate max-w-xs">
                                                            "{historyLog.reason || 'Modificación en panel'}"
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Audit Details Modal (Drawer style) */}
            <AnimatePresence>
                {showDetailModal && selectedLog && (
                    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
                        <div className="absolute inset-0" onClick={() => setShowDetailModal(false)} />

                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="relative w-full max-w-xl h-full bg-white dark:bg-[#0c111e] border-l border-slate-200 dark:border-slate-850 shadow-2xl flex flex-col p-5 overflow-y-auto"
                        >
                            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-850 pb-3 mb-4">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <History className="text-indigo-600 dark:text-indigo-400" size={16} />
                                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                            Detalle del Evento
                                        </h2>
                                    </div>
                                    <span className="font-mono text-[8.5px] text-slate-400 uppercase mt-0.5">UUID: {selectedLog.id}</span>
                                </div>
                                <button 
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#12192d] dark:hover:bg-[#1b253f] text-slate-500 rounded-lg cursor-pointer"
                                >
                                    <XCircle size={16} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-4 flex-1 text-xs">
                                <div className="bg-slate-50 dark:bg-[#070c14] rounded-xl p-3 border border-slate-200/60 dark:border-slate-850/40 grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[8px] text-slate-400 font-extrabold uppercase font-mono">Evento</span>
                                        <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">{selectedLog.action || 'Operación'}</span>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            {getCategoryBadge(selectedLog.category)}
                                            {getSeverityBadge(selectedLog.severity)}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] text-slate-400 font-extrabold uppercase font-mono">Fecha / Hora</span>
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-350">{new Date(selectedLog.created_at).toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3">
                                    <span className="text-[8.5px] font-extrabold uppercase tracking-widest text-indigo-500 flex items-center gap-1">
                                        <Info size={10} /> Motivo Registrado
                                    </span>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 italic">
                                        "{selectedLog.reason || 'Operación estándar del sistema.'}"
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-slate-400">Responsabilidad</span>
                                    <div className="bg-white dark:bg-[#0c111e] border border-slate-200/80 dark:border-slate-850/60 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Usuario</span>
                                            <span className="font-bold uppercase">{selectedLog.user_name || 'Sistema'} ({selectedLog.user_role || 'system'})</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Dirección IP</span>
                                            <span className="font-mono text-slate-700 dark:text-slate-300">{selectedLog.ip_address || '127.0.0.1'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-slate-400">Trazabilidad de Estados</span>
                                        <button
                                            type="button"
                                            onClick={() => setViewRawJSON(!viewRawJSON)}
                                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#12192d] text-[8.5px] font-black uppercase rounded cursor-pointer"
                                        >
                                            {viewRawJSON ? "Ver Estructurado" : "Ver JSON"}
                                        </button>
                                    </div>

                                    {viewRawJSON ? (
                                        <div className="bg-slate-900 text-slate-200 font-mono text-[9.5px] p-3 rounded-xl overflow-x-auto max-h-60">
                                            <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
                                        </div>
                                    ) : (
                                        renderComparisonFields(selectedLog)
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
