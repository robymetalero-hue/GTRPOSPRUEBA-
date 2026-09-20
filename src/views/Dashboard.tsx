import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { 
    TrendingUp, AlertTriangle, RefreshCw, BarChart2, ShieldAlert, DollarSign, Wallet, 
    ArrowUpRight, ArrowDownRight, Sparkles, BrainCircuit, Loader2, Clock, Users,
    Filter, CreditCard, ShoppingBag, Layers, Percent, Zap, ChevronRight, BarChart3, PieChart as PieIcon
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend, BarChart, Bar, LineChart, Line
} from 'recharts';
import DateRangePicker, { DateRange } from '../components/DateRangePicker';
import ThreeDHourlySalesChart from '../components/ThreeDHourlySalesChart';
import { backupDatabaseToDrive } from "../utils/driveBackup";

const CardSkeleton = () => (
    <div className="bg-white dark:bg-[#0c111e] p-6 rounded-[28px] border border-slate-200/60 dark:border-slate-850/40 shadow-xl shadow-slate-200/20 dark:shadow-slate-900/40 animate-pulse">
        <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        </div>
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
    </div>
);

export default function Dashboard() {
    const { user, fetchProducts, exchangeRate } = useAppContext();
    const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');
    const [sellerId, setSellerId] = useState<string>('all');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
    
    const [dateRange, setDateRange] = useState<DateRange>(() => {
        const today = new Date();
        const formatDate = (d: Date) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };
        const prior = new Date();
        prior.setDate(today.getDate() - 6);
        return {
            startDate: formatDate(prior),
            endDate: formatDate(today),
            preset: '7days'
        };
    });

    const [stats, setStats] = useState({
        salesToday: 0,
        profitToday: 0,
        sellers: [] as any[],
        periodSummary: {
            totalSales: 0,
            totalProfit: 0,
            totalTx: 0,
            totalItems: 0,
            avgTicket: 0,
            avgItemsPerTicket: 0,
            profitMarginPct: 0,
            prevPeriodSales: 0,
            prevPeriodProfit: 0,
            prevPeriodTx: 0,
            growthSalesPct: 0,
            growthProfitPct: 0,
            growthTxPct: 0
        },
        lowStock: [] as any[],
        topProducts: [] as any[],
        salesTrend: [] as any[],
        paymentDistribution: [] as any[],
        hourlySales: [] as any[]
    });

    const [loading, setLoading] = useState(true);
    const [insights, setInsights] = useState<any[]>([]);
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warn' | 'error' } | null>(null);

    const showNotification = (message: string, type: 'success' | 'warn' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => {
            setNotification(null);
        }, 5000);
    };

    const loadStats = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
                compare: String(!!dateRange.compare),
                sellerId,
                paymentMethod: paymentMethodFilter
            });
            
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

            const res = await fetch(`/api/dashboard?${queryParams.toString()}`, {
                signal: controller?.signal
            }).catch(() => null);

            if (timeoutId) clearTimeout(timeoutId);

            if (res && res.ok) {
                const data = await res.json().catch(() => null);
                if (data) {
                    setStats(data);
                }
            }
        } catch {
            // Keep existing stats on transient network hiccup
        } finally {
            setLoading(false);
        }
    };

    const loadInsights = async () => {
        setLoadingInsights(true);
        try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
            
            const res = await fetch(`/api/dashboard/insights?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, {
                signal: controller?.signal
            }).catch(() => null);

            if (timeoutId) clearTimeout(timeoutId);

            if (res && res.ok) {
                const data = await res.json().catch(() => null);
                if (Array.isArray(data) && data.length > 0) {
                    setInsights(data);
                    return;
                }
            }
            
            // Smart local fallback if backend or network is offline
            setInsights([
                {
                    title: "Optimización de Inventario",
                    description: "Revisa los productos próximos al umbral de alerta para planificar compras preventivas con tus proveedores."
                },
                {
                    title: "Estrategia en Horarios Pico",
                    description: "Refuerza la atención en las horas de mayor afluencia comercial para acelerar el despacho y flujo de caja."
                },
                {
                    title: "Promoción de Métodos de Pago",
                    description: "Incentiva pagos QR y transferencias para reducir los tiempos de cuadre y conteo de efectivo en caja."
                }
            ]);
        } catch {
            setInsights([
                {
                    title: "Inteligencia de Negocio",
                    description: "Monitorea continuamente tus productos estrella y mantén stock de respaldo para maximizar tus ventas diarias."
                }
            ]);
        } finally {
            setLoadingInsights(false);
        }
    };

    useEffect(() => {
        loadStats();
        loadInsights();
    }, [dateRange, sellerId, paymentMethodFilter]);

    useEffect(() => {
        if (user?.role !== 'admin') return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/alerts`;

        let socket: WebSocket | null = null;
        let reconnectTimeout: any = null;

        const connect = () => {
            socket = new WebSocket(wsUrl);

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'low_stock_alert') {
                        showNotification(
                            `⚠️ ALERTA DE STOCK: "${data.product.name}" (${data.product.sku}) tiene un stock crítico de ${data.product.stock} unidades.`,
                            "warn"
                        );

                        setStats(prev => {
                            const exists = prev.lowStock.some(p => p.id === data.product.id);
                            let updatedLowStock = [...prev.lowStock];
                            if (exists) {
                                updatedLowStock = updatedLowStock.map(p =>
                                    p.id === data.product.id ? { ...p, stock: data.product.stock, stock_alarm: data.product.stock_alarm } : p
                                );
                            } else {
                                updatedLowStock.push({
                                    id: data.product.id,
                                    name: data.product.name,
                                    sku: data.product.sku,
                                    stock: data.product.stock,
                                    stock_alarm: data.product.stock_alarm
                                });
                            }
                            return { ...prev, lowStock: updatedLowStock };
                        });
                    }
                } catch (err) {
                    console.error("Error parsing alert message:", err);
                }
            };

            socket.onclose = () => {
                reconnectTimeout = setTimeout(connect, 10000);
            };

            socket.onerror = () => {};
        };

        connect();

        return () => {
            if (socket) socket.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, [user]);

    // Calculate peak sales hour
    const peakHour = React.useMemo(() => {
        if (!stats.hourlySales || stats.hourlySales.length === 0) return null;
        let max = stats.hourlySales[0];
        for (const h of stats.hourlySales) {
            if (h.total > max.total) max = h;
        }
        return max.total > 0 ? max : null;
    }, [stats.hourlySales]);

    const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

    return (
        <div className="p-4 md:p-6 overflow-y-auto h-full flex flex-col gap-6 relative select-none bg-[#f8fafc]/50 dark:bg-[#060911] text-slate-900 dark:text-slate-100">
            
            {/* Notification Toast */}
            {notification && (
                <div id="dashboard-toast" className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-xs font-bold transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
                    notification.type === 'success' 
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/10' 
                        : notification.type === 'warn'
                        ? 'bg-amber-600 border-amber-500 text-white shadow-amber-500/10'
                        : 'bg-rose-600 border-rose-500 text-white shadow-rose-500/10'
                }`}>
                    <span className="text-sm">{notification.type === 'success' ? '✓' : '⚠️'}</span>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Header with Title & Date / Filter Controls */}
            <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-850/80 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                            <BarChart3 size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">Dashboard Analítico & Reportes Pro</h1>
                            <p className="text-[11px] text-slate-400 font-medium">Métricas de rendimiento, KPIs comparativos e inteligencia de caja en tiempo real.</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Date Range Picker */}
                    <DateRangePicker value={dateRange} onChange={setDateRange} />

                    {/* Refresh Button */}
                    <button 
                        onClick={loadStats}
                        className="p-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                        title="Actualizar Estadísticas"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Sub-Filters Bar (Caja/Vendedor & Método de Pago) */}
            <div className="bg-white/60 dark:bg-[#0c111e]/80 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-850/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5 shrink-0">
                        <Filter size={12} className="text-blue-500" />
                        Filtros de Caja:
                    </span>

                    {/* Seller / Caja Dropdown */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-3 py-1.5 rounded-xl">
                        <Users size={13} className="text-slate-400" />
                        <select
                            value={sellerId}
                            onChange={(e) => setSellerId(e.target.value)}
                            className="bg-transparent text-xs font-extrabold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                        >
                            <option value="all">Todas las Cajas / Vendedores</option>
                            {stats.sellers?.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name || s.username} ({s.role})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Period Selector */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-3 py-1.5 rounded-xl">
                        <CreditCard size={13} className="text-slate-400" />
                        <select
                            value={paymentMethodFilter}
                            onChange={(e) => setPaymentMethodFilter(e.target.value)}
                            className="bg-transparent text-xs font-extrabold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                        >
                            <option value="all">Todos los Métodos de Pago</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Tarjeta">Tarjeta / POS</option>
                            <option value="Transferencia">Transferencia / QR</option>
                            <option value="Crédito">Venta a Crédito</option>
                        </select>
                    </div>
                </div>

                {/* Filter Active Badge */}
                {(sellerId !== 'all' || paymentMethodFilter !== 'all') && (
                    <button
                        onClick={() => { setSellerId('all'); setPaymentMethodFilter('all'); }}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                        Restablecer filtros
                    </button>
                )}
            </div>

            {/* KPIs Pro Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Total Sales Period */}
                <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/70 dark:border-slate-850 shadow-xs relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Venta Total Periodo</span>
                        <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/10">
                            <TrendingUp size={18} />
                        </div>
                    </div>
                    {loading ? (
                        <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse mt-2"></div>
                    ) : (
                        <>
                            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight block">
                                Bs. {(stats.periodSummary?.totalSales || 0).toFixed(2)}
                            </span>
                            <div className="flex items-center justify-between mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1 font-bold">
                                    {stats.periodSummary?.growthSalesPct >= 0 ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center font-extrabold">
                                            <ArrowUpRight size={14} /> +{(stats.periodSummary?.growthSalesPct || 0).toFixed(1)}%
                                        </span>
                                    ) : (
                                        <span className="text-rose-500 flex items-center font-extrabold">
                                            <ArrowDownRight size={14} /> {(stats.periodSummary?.growthSalesPct || 0).toFixed(1)}%
                                        </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-normal">vs periodo prev.</span>
                                </span>
                                <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-lg text-[10px] font-extrabold">
                                    {stats.periodSummary?.totalTx || 0} ventas
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* 2. Total Net Profit & Margin */}
                {user?.role === 'admin' ? (
                    <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/70 dark:border-slate-850 shadow-xs relative overflow-hidden group hover:border-blue-500/40 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Utilidad Estimada</span>
                            <div className="w-10 h-10 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-500/10">
                                <DollarSign size={18} />
                            </div>
                        </div>
                        {loading ? (
                            <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse mt-2"></div>
                        ) : (
                            <>
                                <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 tracking-tight block">
                                    Bs. {(stats.periodSummary?.totalProfit || 0).toFixed(2)}
                                </span>
                                <div className="flex items-center justify-between mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span className="bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1">
                                        <Percent size={11} /> {(stats.periodSummary?.profitMarginPct || 0).toFixed(1)}% Margen
                                    </span>
                                    <span className="text-[10px] font-extrabold text-slate-400">
                                        {(stats.periodSummary?.growthProfitPct || 0) >= 0 ? '+' : ''}{(stats.periodSummary?.growthProfitPct || 0).toFixed(1)}% util.
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/70 dark:border-slate-850 shadow-xs relative opacity-70">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Utilidad Estimada</span>
                        <div className="text-xs text-slate-400 italic">Restringido a administradores</div>
                    </div>
                )}

                {/* 3. Average Ticket */}
                <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/70 dark:border-slate-850 shadow-xs relative overflow-hidden group hover:border-violet-500/40 transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Promedio</span>
                        <div className="w-10 h-10 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center border border-violet-500/10">
                            <Wallet size={18} />
                        </div>
                    </div>
                    {loading ? (
                        <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse mt-2"></div>
                    ) : (
                        <>
                            <span className="text-2xl font-black font-mono text-violet-600 dark:text-violet-400 tracking-tight block">
                                Bs. {(stats.periodSummary?.avgTicket || 0).toFixed(2)}
                            </span>
                            <div className="flex items-center justify-between mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                <span className="text-[10px] font-bold text-slate-400">
                                    {(stats.periodSummary?.avgItemsPerTicket || 0).toFixed(1)} ítems / ticket
                                </span>
                                <span className="bg-violet-500/10 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-lg text-[10px] font-extrabold">
                                    {stats.periodSummary?.totalItems || 0} uds. totales
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* 4. Peak Sales Hour */}
                <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/70 dark:border-slate-850 shadow-xs relative overflow-hidden group hover:border-amber-500/40 transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora Pico de Ventas</span>
                        <div className="w-10 h-10 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/10">
                            <Clock size={18} />
                        </div>
                    </div>
                    {loading ? (
                        <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse mt-2"></div>
                    ) : (
                        <>
                            <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 tracking-tight block">
                                {peakHour ? `${peakHour.hour}:00 - ${Number(peakHour.hour) + 1}:00` : 'Sin datos'}
                            </span>
                            <div className="flex items-center justify-between mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                <span className="text-[10px] font-bold text-slate-400">
                                    Venta Máxima en Hora
                                </span>
                                <span className="bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-lg text-[10px] font-extrabold">
                                    Bs. {(peakHour?.total || 0).toFixed(0)} ({peakHour?.count || 0} vent.)
                                </span>
                            </div>
                        </>
                    )}
                </div>

            </div>

            {/* AI Insights & Alerts Banner */}
            <AnimatePresence>
                {stats.lowStock.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <span className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase tracking-wide block">
                                    ⚠️ Alarma de Inventario Critico ({stats.lowStock.length} SKU)
                                </span>
                                <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                                    Hay productos con existencias por debajo del mínimo de seguridad. Revisa la sección de Inventario para reabastecer.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {stats.lowStock.slice(0, 3).map((p: any) => (
                                <span key={p.id} className="text-[10px] font-extrabold bg-rose-200/60 dark:bg-rose-900/80 text-rose-900 dark:text-rose-100 px-2.5 py-1 rounded-xl">
                                    {p.name} ({p.stock} uds)
                                </span>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Interactive Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Temporal Evolution Chart (2 cols) */}
                <div className="lg:col-span-2 bg-white dark:bg-[#0c111e] p-5 md:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-850 shadow-xs flex flex-col justify-between">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                        <div>
                            <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <TrendingUp size={16} className="text-emerald-500" />
                                Tendencia de Ventas & Utilidad
                            </h2>
                            <p className="text-[11px] text-slate-400 mt-0.5">Evolución diaria de recaudación y ganancia en el rango seleccionado.</p>
                        </div>

                        {/* Chart Type Selector */}
                        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                            <button
                                onClick={() => setChartType('area')}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition cursor-pointer ${
                                    chartType === 'area' 
                                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                Área
                            </button>
                            <button
                                onClick={() => setChartType('bar')}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition cursor-pointer ${
                                    chartType === 'bar' 
                                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                Barras
                            </button>
                            <button
                                onClick={() => setChartType('line')}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition cursor-pointer ${
                                    chartType === 'line' 
                                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                Línea
                            </button>
                        </div>
                    </div>

                    <div className="h-[280px] w-full">
                        {loading ? (
                            <div className="h-full w-full bg-slate-100 dark:bg-slate-900/50 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-400">
                                Cargando gráfico...
                            </div>
                        ) : stats.salesTrend && stats.salesTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                {chartType === 'area' ? (
                                    <AreaChart data={stats.salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                                            </linearGradient>
                                            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `Bs.${v}`} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: '#0f172a', 
                                                borderColor: '#1e293b', 
                                                borderRadius: '16px', 
                                                color: '#fff',
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                                            }}
                                            formatter={(value: any) => [`Bs. ${Number(value).toFixed(2)}`, '']}
                                        />
                                        <Area type="monotone" dataKey="total" name="Ventas Total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#salesGrad)" />
                                        {user?.role === 'admin' && (
                                            <Area type="monotone" dataKey="profit" name="Utilidad Neta" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#profitGrad)" />
                                        )}
                                        {dateRange.compare && (
                                            <Area type="monotone" dataKey="compareTotal" name="Ventas Periodo Prev." stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} fillOpacity={0} />
                                        )}
                                    </AreaChart>
                                ) : chartType === 'bar' ? (
                                    <BarChart data={stats.salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `Bs.${v}`} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: '#0f172a', 
                                                borderColor: '#1e293b', 
                                                borderRadius: '16px', 
                                                color: '#fff',
                                                fontSize: '11px',
                                                fontWeight: 'bold'
                                            }}
                                            formatter={(value: any) => [`Bs. ${Number(value).toFixed(2)}`, '']}
                                        />
                                        <Bar dataKey="total" name="Ventas Total" fill="#10b981" radius={[8, 8, 0, 0]} />
                                        {user?.role === 'admin' && (
                                            <Bar dataKey="profit" name="Utilidad Neta" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                        )}
                                    </BarChart>
                                ) : (
                                    <LineChart data={stats.salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `Bs.${v}`} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: '#0f172a', 
                                                borderColor: '#1e293b', 
                                                borderRadius: '16px', 
                                                color: '#fff',
                                                fontSize: '11px',
                                                fontWeight: 'bold'
                                            }}
                                            formatter={(value: any) => [`Bs. ${Number(value).toFixed(2)}`, '']}
                                        />
                                        <Line type="monotone" dataKey="total" name="Ventas Total" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                        {user?.role === 'admin' && (
                                            <Line type="monotone" dataKey="profit" name="Utilidad Neta" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                        )}
                                    </LineChart>
                                )}
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                                No se encontraron registros de venta en el rango seleccionado.
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Payment Method Distribution (1 col) */}
                <div className="bg-white dark:bg-[#0c111e] p-5 md:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-850 shadow-xs flex flex-col justify-between">
                    <div>
                        <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <PieIcon size={16} className="text-violet-500" />
                            Mezcla por Métodos de Pago
                        </h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">Distribución de recaudación en caja por canal.</p>
                    </div>

                    <div className="h-[200px] w-full my-2">
                        {loading ? (
                            <div className="h-full w-full bg-slate-100 dark:bg-slate-900/50 rounded-2xl animate-pulse"></div>
                        ) : stats.paymentDistribution && stats.paymentDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.paymentDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.paymentDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: '#0f172a', 
                                            borderColor: '#1e293b', 
                                            borderRadius: '14px', 
                                            color: '#fff',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                        }}
                                        formatter={(value: any) => [`Bs. ${Number(value).toFixed(2)}`, 'Recaudado']}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                                Sin movimientos de pago
                            </div>
                        )}
                    </div>

                    {/* Custom Legend Cards */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        {stats.paymentDistribution?.map((item, idx) => {
                            const pct = stats.periodSummary?.totalSales > 0 
                                ? ((item.value / stats.periodSummary.totalSales) * 100).toFixed(1) 
                                : '0.0';
                            return (
                                <div key={item.name} className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                                        <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-900 dark:text-white font-mono">{pct}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>

            {/* Hourly Peak Heatmap & Top Products Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. Peak Hours Heatmap Chart (2 cols) */}
                <div className="lg:col-span-2">
                    <ThreeDHourlySalesChart 
                        data={stats.hourlySales}
                        exchangeRate={exchangeRate}
                        isLoading={loading}
                        isAdmin={user?.role === 'admin'}
                        title="Rendimiento de Ventas por Hora (24h)"
                        subtitle="Gráfico volumétrico 3D interactivo con rotación espacial 360°, métricas y zoom táctil"
                    />
                </div>

                {/* 2. Top Products Ranking (1 col) */}
                <div className="bg-white dark:bg-[#0c111e] p-5 md:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-850 shadow-xs flex flex-col justify-between">
                    <div>
                        <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <ShoppingBag size={16} className="text-emerald-500" />
                            Top Productos Más Vendidos
                        </h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">Ranking por unidades desplazadas e ingresos.</p>
                    </div>

                    <div className="flex flex-col gap-2.5 my-4 overflow-y-auto max-h-[220px] pr-1">
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-900/60 rounded-2xl animate-pulse"></div>
                            ))
                        ) : stats.topProducts && stats.topProducts.length > 0 ? (
                            stats.topProducts.map((p, idx) => {
                                const maxQty = stats.topProducts[0]?.total_qty || 1;
                                const pct = Math.min(100, Math.round((p.total_qty / maxQty) * 100));
                                return (
                                    <div key={p.id || p.name} className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/80">
                                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="w-5 h-5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold text-[10px] rounded-lg flex items-center justify-center shrink-0">
                                                    #{idx + 1}
                                                </span>
                                                <span className="text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                                            </div>
                                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black shrink-0">
                                                {p.total_qty} uds.
                                            </span>
                                        </div>
                                        
                                        {/* Progress Bar */}
                                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mt-1">
                                            <span>Monto: Bs. {(p.total_revenue || 0).toFixed(2)}</span>
                                            {user?.role === 'admin' && p.total_profit !== undefined && (
                                                <span className="text-blue-500">Util: Bs. {(p.total_profit || 0).toFixed(2)}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                                Sin registros de ventas
                            </div>
                        )}
                    </div>

                    <div className="text-[10px] font-bold text-slate-400 text-right">
                        Mostrando Top 6 en el rango
                    </div>
                </div>

            </div>

            {/* AI Strategic Insights & Recommendations (Gemini Powered) */}
            <div className="bg-gradient-to-br from-indigo-900/20 via-slate-900/40 to-blue-900/20 p-5 md:p-6 rounded-3xl border border-indigo-500/20 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                            <BrainCircuit size={20} className="animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                Inteligencia Comercial Gemini AI
                                <span className="bg-indigo-500/20 text-indigo-300 text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-indigo-500/30">PRO</span>
                            </h2>
                            <p className="text-[11px] text-indigo-200/70 font-medium">Recomendaciones estratégicas automáticas para maximizar el flujo de caja y ventas.</p>
                        </div>
                    </div>

                    <button
                        onClick={loadInsights}
                        disabled={loadingInsights}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[10px] font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        {loadingInsights ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        <span>Generar Insights</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {loadingInsights ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-24 bg-slate-900/50 rounded-2xl border border-indigo-500/10 animate-pulse"></div>
                        ))
                    ) : insights && insights.length > 0 ? (
                        insights.map((insight: any, i: number) => (
                            <div key={i} className="p-3.5 bg-slate-900/60 rounded-2xl border border-indigo-500/20 backdrop-blur-md flex flex-col justify-between">
                                <div>
                                    <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block mb-1">
                                        {insight.title || 'Recomendación Estratégica'}
                                    </span>
                                    <p className="text-[11px] text-slate-300 font-medium leading-snug">
                                        {insight.description || insight}
                                    </p>
                                </div>
                                <div className="mt-2 text-[10px] font-extrabold text-emerald-400 flex items-center gap-1">
                                    <Zap size={11} /> Impacto Estimado: Positivo
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-3 py-4 text-center text-indigo-200/60 text-xs font-semibold">
                            Haz clic en "Generar Insights" para obtener un análisis de inteligencia comercial sobre tus ventas.
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
