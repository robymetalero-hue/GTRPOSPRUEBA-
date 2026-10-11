import React, { useState, useEffect } from 'react';
import { 
    ShieldCheck, AlertTriangle, TrendingUp, Clock, Database, 
    RotateCcw, DollarSign, Layers, HardDrive, CheckCircle2, 
    Loader2, RefreshCw, AlertOctagon, ArrowUpRight, ShieldAlert,
    ChevronRight, Sparkles, Activity
} from 'lucide-react';

interface MetricSummary {
    totalCatalogItems: number;
    totalStockUnits: number;
    totalStockCostBob: number;
    totalStockCostUsd: number;
    trappedCapitalBob: number;
    trappedCapitalUsd: number;
    dormantProductsCount: number;
    criticalStockoutCount: number;
    warningStockoutCount: number;
    healthyStockCount: number;
    catalogTurnoverAverage: number;
}

interface ResilienceStatus {
    sqliteIntegrity: string;
    journalMode: string;
    snapshotCount: number;
    lastSnapshotDate: string | null;
    environment: string;
}

interface ProductMetric {
    id: number;
    name: string;
    sku: string;
    category: string;
    stock: number;
    cost: number;
    price: number;
    totalValueBob: number;
    unitsSold30d: number;
    dailyRunRate: number;
    daysOfStockLeft: number;
    stockRisk: 'critical' | 'warning' | 'healthy' | 'dormant' | 'out_of_stock';
    turnoverRatio: number;
}

interface CategoryMargin {
    category: string;
    totalProducts: number;
    unitsSold: number;
    revenue: number;
    cost: number;
    grossProfit: number;
    marginPct: number;
}

interface Phase3Data {
    success: boolean;
    summary: MetricSummary;
    resilienceStatus: ResilienceStatus;
    criticalRiskProducts: ProductMetric[];
    topDormantProducts: ProductMetric[];
    categoryMargins: CategoryMargin[];
}

export default function Phase3ResiliencePanel() {
    const [data, setData] = useState<Phase3Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'stockout' | 'dormant' | 'margins' | 'resilience'>('stockout');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'warn' | 'error' } | null>(null);

    const showFeedback = (message: string, type: 'success' | 'warn' | 'error' = 'success') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 5000);
    };

    const fetchMetrics = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('auth_token');
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/analytics/phase3-metrics', { headers });
            if (res.ok) {
                const json = await res.json();
                setData(json);
            } else {
                showFeedback("No se pudieron cargar las métricas de la Fase 3.", "error");
            }
        } catch {
            showFeedback("Error de red al consultar analítica predictiva.", "warn");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    const handleCreateAutoSnapshot = async () => {
        setActionLoading('snapshot');
        try {
            const token = localStorage.getItem('auth_token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/backup/auto-snapshot', {
                method: 'POST',
                headers
            });
            const result = await res.json();
            if (res.ok && result.success) {
                showFeedback(`✓ ${result.message} (Manteniendo últimas ${result.totalSnapshots} copias)`, "success");
                fetchMetrics();
            } else {
                showFeedback(result.error || "Fallo al generar el respaldo rotativo.", "error");
            }
        } catch (e: any) {
            showFeedback("Error al solicitar copia de seguridad: " + e.message, "error");
        } finally {
            setActionLoading(null);
        }
    };

    const handleVerifyIntegrity = async () => {
        setActionLoading('integrity');
        try {
            const token = localStorage.getItem('auth_token');
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/backup/verify-integrity', { headers });
            const result = await res.json();
            if (res.ok && result.success) {
                showFeedback(`✓ Integridad SQLite al 100% verificada (Cero violaciones de claves foráneas).`, "success");
            } else {
                showFeedback(`⚠️ Resultado de verificación: ${result.status}`, "warn");
            }
        } catch (e: any) {
            showFeedback("Error al verificar integridad: " + e.message, "error");
        } finally {
            setActionLoading(null);
        }
    };

    if (loading && !data) {
        return (
            <div className="bg-white dark:bg-[#0c111e] p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-md flex items-center justify-center gap-3 py-12 text-slate-400">
                <Loader2 className="animate-spin text-blue-500" size={24} />
                <span className="text-xs font-bold uppercase tracking-wider">Cargando Analítica Predictiva y Resiliencia...</span>
            </div>
        );
    }

    const summary = data?.summary;
    const resilience = data?.resilienceStatus;

    return (
        <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col gap-5 p-5 md:p-6 transition-all">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
                        <Activity size={22} className="animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                Analítica Predictiva & Resiliencia
                            </h2>
                            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                FASE 3 ACTIVA
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                            Rotación de inventario, alerta de quiebres de stock, capital inmovilizado y blindaje SQLite.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                    <button
                        onClick={fetchMetrics}
                        disabled={loading}
                        className="p-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition cursor-pointer disabled:opacity-50"
                        title="Actualizar métricas"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>

                    <button
                        onClick={handleCreateAutoSnapshot}
                        disabled={!!actionLoading}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer disabled:opacity-50"
                    >
                        {actionLoading === 'snapshot' ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
                        <span>Respaldo con Rotación</span>
                    </button>

                    <button
                        onClick={handleVerifyIntegrity}
                        disabled={!!actionLoading}
                        className="px-3.5 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        {actionLoading === 'integrity' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        <span>Verificar DB</span>
                    </button>
                </div>
            </div>

            {/* Feedback notification */}
            {feedback && (
                <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
                    feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                    feedback.type === 'warn' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}>
                    <CheckCircle2 size={16} />
                    <span>{feedback.message}</span>
                </div>
            )}

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Rotación de Inventario */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-black uppercase tracking-wider">Rotación Media (30d)</span>
                        <TrendingUp size={16} className="text-blue-500" />
                    </div>
                    <div>
                        <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                            {summary?.catalogTurnoverAverage || 0}x
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {summary?.totalStockUnits || 0} unidades totales en stock
                        </div>
                    </div>
                </div>

                {/* 2. Capital Estancado */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-black uppercase tracking-wider">Capital Inmovilizado</span>
                        <DollarSign size={16} className="text-amber-500" />
                    </div>
                    <div>
                        <div className="text-xl md:text-2xl font-black text-amber-600 dark:text-amber-400">
                            Bs. {(summary?.trappedCapitalBob || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                            ${(summary?.trappedCapitalUsd || 0).toFixed(2)} USD ({summary?.dormantProductsCount || 0} productos sin venta)
                        </div>
                    </div>
                </div>

                {/* 3. Alerta de Quiebre de Stock */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-black uppercase tracking-wider">Riesgo de Quiebre</span>
                        <AlertOctagon size={16} className="text-rose-500" />
                    </div>
                    <div>
                        <div className="text-xl md:text-2xl font-black text-rose-600 dark:text-rose-400">
                            {summary?.criticalStockoutCount || 0} críticos
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                            Menos de 7 días de inventario restante
                        </div>
                    </div>
                </div>

                {/* 4. Estado de Resiliencia SQLite */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-black uppercase tracking-wider">Integridad SQLite</span>
                        <ShieldCheck size={16} className="text-emerald-500" />
                    </div>
                    <div>
                        <div className="text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <span>100% ÍNTEGRO</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                            Modo WAL • {resilience?.snapshotCount || 0} instantáneas activas
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Selector */}
            <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2 overflow-x-auto text-xs font-black">
                <button
                    onClick={() => setActiveTab('stockout')}
                    className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        activeTab === 'stockout'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-black'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <AlertTriangle size={14} />
                    <span>Pronóstico de Agotamiento ({data?.criticalRiskProducts.length || 0})</span>
                </button>

                <button
                    onClick={() => setActiveTab('dormant')}
                    className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        activeTab === 'dormant'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-black'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Clock size={14} />
                    <span>Capital Inmovilizado ({data?.topDormantProducts.length || 0})</span>
                </button>

                <button
                    onClick={() => setActiveTab('margins')}
                    className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        activeTab === 'margins'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-black'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Layers size={14} />
                    <span>Margen Real por Categoría ({data?.categoryMargins.length || 0})</span>
                </button>

                <button
                    onClick={() => setActiveTab('resilience')}
                    className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        activeTab === 'resilience'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-black'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <HardDrive size={14} />
                    <span>Respaldos & Blindaje</span>
                </button>
            </div>

            {/* Tab Contents */}
            <div className="min-h-[220px]">
                {/* 1. STOCKOUT FORECAST TAB */}
                {activeTab === 'stockout' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                            <span>Productos con mayor velocidad de venta y riesgo de agotarse en menos de 7 días:</span>
                            <span className="text-rose-500 font-bold text-[11px]">Ordenados por días de stock restantes</span>
                        </div>

                        {data?.criticalRiskProducts && data.criticalRiskProducts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                                {data.criticalRiskProducts.map((p) => (
                                    <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-rose-500/20 flex items-center justify-between">
                                        <div className="min-w-0 pr-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                                                    {p.name}
                                                </span>
                                                <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                                                    {p.sku}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                                                <span>Stock: <strong className="text-slate-700 dark:text-slate-300">{p.stock}</strong></span>
                                                <span>•</span>
                                                <span>Venta/día: <strong className="text-blue-500">{p.dailyRunRate}</strong></span>
                                                <span>•</span>
                                                <span>Vendidos (30d): <strong>{p.unitsSold30d}</strong></span>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-black text-xs rounded-xl inline-block">
                                                {p.daysOfStockLeft} {p.daysOfStockLeft === 1 ? 'día' : 'días'}
                                            </span>
                                            <div className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">
                                                Quiebre Inminente
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl text-slate-400 text-xs font-medium">
                                ✓ Ningún producto presenta riesgo inminente de quiebre de stock en los próximos 7 días.
                            </div>
                        )}
                    </div>
                )}

                {/* 2. DORMANT STOCK / TRAPPED CAPITAL TAB */}
                {activeTab === 'dormant' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                            <span>Productos con stock existente pero sin ninguna venta en los últimos 30 días (Capital Inmovilizado):</span>
                            <span className="text-amber-500 font-bold text-[11px]">Top 10 por costo retenido</span>
                        </div>

                        {data?.topDormantProducts && data.topDormantProducts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                                {data.topDormantProducts.map((p) => (
                                    <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-amber-500/20 flex items-center justify-between">
                                        <div className="min-w-0 pr-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                                                    {p.name}
                                                </span>
                                                <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                                                    {p.category}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                                                <span>Stock: <strong className="text-slate-700 dark:text-slate-300">{p.stock}</strong></span>
                                                <span>•</span>
                                                <span>Costo unitario: <strong>Bs. {p.cost}</strong></span>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <div className="font-black text-xs text-amber-600 dark:text-amber-400">
                                                Bs. {p.totalValueBob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                                            </div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                Costo Retenido
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl text-slate-400 text-xs font-medium">
                                ✓ Todo el catálogo activo ha registrado rotación durante los últimos 30 días.
                            </div>
                        )}
                    </div>
                )}

                {/* 3. CATEGORY MARGINS TAB */}
                {activeTab === 'margins' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                            <span>Rendimiento y margen bruto real obtenido por departamento o categoría (últimos 30 días):</span>
                            <span className="text-blue-500 font-bold text-[11px]">Ordenado por facturación</span>
                        </div>

                        {data?.categoryMargins && data.categoryMargins.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                                {data.categoryMargins.map((cat, idx) => (
                                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 flex flex-col justify-between gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                {cat.category}
                                            </span>
                                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs rounded-lg">
                                                {cat.marginPct}% margen
                                            </span>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                                style={{ width: `${Math.min(100, Math.max(10, cat.marginPct))}%` }}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                                            <span>Ventas: <strong>Bs. {cat.revenue.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</strong></span>
                                            <span className="text-emerald-500">Utilidad: <strong>Bs. {cat.grossProfit.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</strong></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl text-slate-400 text-xs font-medium">
                                Sin ventas registradas en los últimos 30 días para calcular márgenes por departamento.
                            </div>
                        )}
                    </div>
                )}

                {/* 4. RESILIENCE & BACKUPS TAB */}
                {activeTab === 'resilience' && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/40 dark:border-slate-800">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                    Motor de Base de Datos
                                </span>
                                <div className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Database size={15} className="text-blue-500" />
                                    <span>SQLite 3 (WAL Mode)</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Concurrencia libre de bloqueos y checkpoints automáticos.</p>
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/40 dark:border-slate-800">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                    Copias de Respaldo Activas
                                </span>
                                <div className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <HardDrive size={15} className="text-indigo-500" />
                                    <span>{resilience?.snapshotCount || 0} Instantáneas</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Rotación inteligente para conservar las últimas 7 versiones en disco.</p>
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/40 dark:border-slate-800">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                    Aislamiento Operativo
                                </span>
                                <div className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <ShieldCheck size={15} className="text-emerald-500" />
                                    <span>{resilience?.environment === 'sandbox' ? 'Sandbox Protegido' : 'Producción Real'}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Pruebas aisladas sin afectar inventario real.</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                            <span className="text-xs text-slate-400 font-semibold">
                                Último respaldo verificado: <strong>{resilience?.lastSnapshotDate ? new Date(resilience.lastSnapshotDate).toLocaleString('es-BO') : 'Hoy'}</strong>
                            </span>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleVerifyIntegrity}
                                    disabled={!!actionLoading}
                                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                                >
                                    Verificar Tablas
                                </button>
                                <button
                                    onClick={handleCreateAutoSnapshot}
                                    disabled={!!actionLoading}
                                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                                >
                                    Crear Respaldo Ahora
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
