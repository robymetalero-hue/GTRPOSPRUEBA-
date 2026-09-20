import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { hasPermission } from '../utils/permissions';
import { 
    Home, Clock, Calendar, ShieldCheck, ArrowRight, ShoppingCart, 
    Receipt, Trash2, Printer, Search, RefreshCw, Folder, Sparkles, 
    ArrowLeftRight, FileBarChart, PieChart, TrendingUp, AlertCircle, 
    Check, Undo2, Smartphone, HelpCircle, Activity, ChevronRight, Ban,
    Plus, PlusCircle, Eye, MessageCircle, X, Share2, PackageSearch, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import DateRangePicker, { DateRange } from '../components/DateRangePicker';
import ThreeDHourlySalesChart from '../components/ThreeDHourlySalesChart';
import { useElasticScroll } from '../utils/touchScroll';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, 
    PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, Legend as RechartsLegend
} from 'recharts';

// ----------------------------------------------------
// VIEW: INICIO (HOME PORTAL)
// ----------------------------------------------------
export function InicioView() {
    const { setView, products, user } = useAppContext();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [stats, setStats] = useState({ salesToday: 0, txToday: 0, profitToday: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;
                
                const token = localStorage.getItem('token') || '';
                const res = await fetch(`/api/dashboard?startDate=${dateStr}&endDate=${dateStr}&compare=false`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    setStats({
                        salesToday: data.salesToday || data.periodSummary?.totalSales || 0,
                        txToday: data.periodSummary?.totalTx || 0,
                        profitToday: data.profitToday || data.periodSummary?.totalProfit || 0
                    });
                }
            } catch (e) {
                console.error("Failed to fetch today stats", e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const lowStockCount = products.filter(p => p.stock <= p.stock_alarm).length;
    const totalItemsInStock = products.reduce((acc, p) => acc + p.stock, 0);

    const formatCurrency = (val: number) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(val);

    return (
        <div className="p-5 md:p-8 overflow-y-auto h-full flex flex-col gap-6 select-none bg-slate-50/50 dark:bg-[#070a10]">
            {/* Elegant Header */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-slate-950 p-6 md:p-10 text-white shadow-2xl border border-slate-800">
                <div className="absolute top-0 right-0 p-12 opacity-20 pointer-events-none mix-blend-screen">
                    <Sparkles size={120} className="text-indigo-400" />
                </div>
                <div className="absolute right-0 top-0 translate-x-20 -translate-y-20 w-96 h-96 bg-indigo-600/30 rounded-full blur-[80px]"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="flex flex-col gap-3">
                        <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] uppercase font-black px-3 py-1 rounded-full w-max tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                            Sistema Activo • GTR POS
                        </span>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
                            Hola, {user?.username}
                        </h1>
                        <p className="text-slate-400 text-sm font-medium max-w-lg mt-1 heading-normal">
                            Bienvenido a tu centro de control. Gestiona ventas, inventario y reportes financieros desde un solo lugar.
                        </p>
                    </div>

                    {/* Clock & Date Badge */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 min-w-[220px] border border-white/10 flex flex-col items-end justify-center">
                        <div className="flex items-center gap-2 text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">
                            <Clock size={12} />
                            <span>Hora Local</span>
                        </div>
                        <span className="text-3xl font-black font-mono tracking-tighter text-white">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-xs font-bold text-slate-400 mt-1 capitalize">
                            {currentTime.toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick KPI Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white dark:bg-[#0c111e] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-850 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                            <TrendingUp size={22} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hoy</span>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Ventas del Día</span>
                        <div className="flex items-end gap-2 mt-1">
                            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                {loading ? '...' : formatCurrency(stats.salesToday)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0c111e] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-850 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                            <Receipt size={22} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hoy</span>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Transacciones</span>
                        <div className="flex items-end gap-2 mt-1">
                            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                {loading ? '...' : stats.txToday}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0c111e] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-850 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-2xl">
                            <Folder size={22} />
                        </div>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Inventario Total</span>
                        <div className="flex items-end gap-2 mt-1">
                            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                {totalItemsInStock}
                            </span>
                            <span className="text-xs font-bold text-slate-400 mb-1 ml-1">unidades</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0c111e] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-850 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-2xl">
                            <AlertCircle size={22} />
                        </div>
                        {lowStockCount > 0 && (
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                            </span>
                        )}
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Alertas de Stock</span>
                        <div className="flex items-end gap-2 mt-1">
                            <span className={`text-2xl font-black tracking-tight ${lowStockCount > 0 ? "text-orange-600 dark:text-orange-500" : "text-slate-900 dark:text-white"}`}>
                                {lowStockCount}
                            </span>
                            <span className="text-xs font-bold text-slate-400 mb-1 ml-1">productos</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions Bento Grid */}
            <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-500" />
                    <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white tracking-wider">Atajos Rápidos</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* POS register */}
                    <div 
                        onClick={() => setView('pos')}
                        className="group relative overflow-hidden bg-white dark:bg-[#0c111e] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-850 flex flex-col justify-between h-48 cursor-pointer hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-1"
                    >
                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/5 rounded-full group-hover:bg-blue-500/10 transition-colors blur-2xl"></div>
                        <div className="w-12 h-12 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform">
                            <ShoppingCart size={24} />
                        </div>
                        <div className="relative z-10">
                            <h4 className="font-black text-lg text-slate-900 dark:text-white tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Registro POS</h4>
                            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">Abre la terminal de punto de venta, escanea códigos y registra transacciones.</p>
                        </div>
                    </div>

                    {/* Stock listing */}
                    <div 
                        onClick={() => setView('productos')}
                        className="group relative overflow-hidden bg-white dark:bg-[#0c111e] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-850 flex flex-col justify-between h-48 cursor-pointer hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-300 hover:-translate-y-1"
                    >
                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-violet-500/5 rounded-full group-hover:bg-violet-500/10 transition-colors blur-2xl"></div>
                        <div className="w-12 h-12 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform">
                            <Folder size={24} />
                        </div>
                        <div className="relative z-10">
                            <h4 className="font-black text-lg text-slate-900 dark:text-white tracking-tight group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">Catálogo de Almacén</h4>
                            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">Administra tu inventario, ajusta precios, y gestiona códigos de barra.</p>
                        </div>
                    </div>

                    {/* Historical sales log */}
                    <div 
                        onClick={() => setView('historial_ventas')}
                        className="group relative overflow-hidden bg-white dark:bg-[#0c111e] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-850 flex flex-col justify-between h-48 cursor-pointer hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 hover:-translate-y-1"
                    >
                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/5 rounded-full group-hover:bg-emerald-500/10 transition-colors blur-2xl"></div>
                        <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform">
                            <Receipt size={24} />
                        </div>
                        <div className="relative z-10">
                            <h4 className="font-black text-lg text-slate-900 dark:text-white tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Historial de Ventas</h4>
                            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">Revisa transacciones anteriores, imprime comprobantes y realiza anulaciones.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// VIEW: HISTORIAL DE VENTAS
// ----------------------------------------------------
export function HistorialVentasView() {
    const { user, receiptTemplate, setView } = useAppContext();
    const outerScroll = useElasticScroll(true);
    const listScroll = useElasticScroll(true);
    const [sales, setSales] = useState<any[]>([]);
    const [selectedSale, setSelectedSale] = useState<any | null>(null);
    const [saleItems, setSaleItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Set default date range preset to last week (7 days) for high-performance lazy loading
    const [dateRange, setDateRange] = useState<DateRange>(() => {
        const today = new Date();
        const prior = new Date();
        prior.setDate(today.getDate() - 6);
        const pad = (n: number) => String(n).padStart(2, '0');
        const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
        const priorStr = `${prior.getFullYear()}-${pad(prior.getMonth() + 1)}-${pad(prior.getDate())}`;
        return {
            startDate: priorStr,
            endDate: todayStr,
            preset: '7days'
        };
    });

    // Pagination states for lazy loading
    const [hasMoreSales, setHasMoreSales] = useState(false);
    const [salesOffset, setSalesOffset] = useState(0);
    const SALES_LIMIT = 25;

    // Intelligent Filter State Variables
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCashier, setSelectedCashier] = useState('all');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');

    const loadSales = async (append = false) => {
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
            setSalesOffset(0);
        }
        setError(null);
        try {
            const currentOffset = append ? salesOffset + SALES_LIMIT : 0;
            let url = `/api/sales?lazy=true&limit=${SALES_LIMIT}&offset=${currentOffset}`;
            if (dateRange.preset !== 'all' && dateRange.startDate && dateRange.endDate) {
                url += `&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
            }
            
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (append) {
                    setSales(prev => [...prev, ...data.sales]);
                    setSalesOffset(currentOffset);
                } else {
                    setSales(data.sales);
                }
                setHasMoreSales(data.has_more);
            } else {
                throw new Error("No se pudo cargar la información de ventas.");
            }
        } catch (e: any) {
            setError(e.message || "Fallo de conexión.");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const loadMoreSales = () => {
        loadSales(true);
    };

    const loadSaleDetails = async (sale: any) => {
        setSelectedSale(sale);
        setSaleItems([]);
        try {
            const res = await fetch(`/api/sales/${sale.id}/items`);
            if (res.ok) {
                const data = await res.json();
                setSaleItems(data);
                // Auto-open detailed modal on small screens / vertical mobile displays so users immediately see content and can share/reprint
                if (window.innerWidth < 1024) {
                    setShowDetailModal(true);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadSales();
    }, [dateRange]);

    // Derive unique cashiers list from actual sales
    const cashiers = React.useMemo(() => {
        const list = sales.map(s => s.user_name || 'admin');
        return Array.from(new Set(list)).filter(Boolean) as string[];
    }, [sales]);

    // Derive unique payment methods list from actual sales
    const paymentMethods = React.useMemo(() => {
        const list = sales.map(s => s.payment_method);
        return Array.from(new Set(list)).filter(Boolean) as string[];
    }, [sales]);

    // Real-time memoized intelligent filter matching all constraints
    const filteredSales = React.useMemo(() => {
        return sales.filter(sale => {
            // General query matching ID, client_name or user_name (cashier)
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase().trim();
                const searchTerms = query.split(/\s+/);
                const searchableText = `#${sale.id} ${sale.client_name || ""} ${sale.user_name || "admin"}`.toLowerCase();
                if (!searchTerms.every(term => searchableText.includes(term))) {
                    return false;
                }
            }

            // Cashier filter
            if (selectedCashier !== 'all') {
                const saleCashier = sale.user_name || 'admin';
                if (saleCashier !== selectedCashier) {
                    return false;
                }
            }

            // Payment method filter
            if (selectedPaymentMethod !== 'all') {
                if (sale.payment_method !== selectedPaymentMethod) {
                    return false;
                }
            }

            // Min Amount Filter (in BOB/Bs.)
            if (minAmount.trim() !== '') {
                const min = parseFloat(minAmount);
                if (!isNaN(min) && sale.total < min) {
                    return false;
                }
            }

            // Max Amount Filter (in BOB/Bs.)
            if (maxAmount.trim() !== '') {
                const max = parseFloat(maxAmount);
                if (!isNaN(max) && sale.total > max) {
                    return false;
                }
            }

            return true;
        });
    }, [sales, searchQuery, selectedCashier, selectedPaymentMethod, minAmount, maxAmount]);

    // calculate metrics
    const totalEarnings = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const totalDiscounts = filteredSales.reduce((sum, s) => sum + (s.discount || 0), 0);
    const transactionsCount = filteredSales.length;
    const totalItemsCount = filteredSales.reduce((sum, s) => sum + (s.item_count || 0), 0);
    const averageTicket = transactionsCount > 0 ? totalEarnings / transactionsCount : 0;

    // Capital & Profit calculations requested by user
    const totalCapital = filteredSales.reduce((sum, s) => sum + (s.capital || 0), 0);
    const totalProfit = totalEarnings - totalCapital;
    const profitMargin = totalEarnings > 0 ? (totalProfit / totalEarnings) * 100 : 0;

    // PDF ticket sharing and modal display states
    const [sharingId, setSharingId] = useState<number | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [sharingSale, setSharingSale] = useState<any | null>(null);
    const [sharingItems, setSharingItems] = useState<any[]>([]);
    const [showShareOptionsModal, setShowShareOptionsModal] = useState(false);

    // Reusable thermal PDF receipt code
    const generateTicketPDF = (sale: any, items: any[]) => {
        const tpl = receiptTemplate || {
            logoText: "GTR POS TERMINAL",
            showLogo: true,
            headerText: "Cochabamba - Bolivia\nTelf: 444-XXXXX\nNIT: 382910023",
            footerText: "¡Gracias por su preferencia!\nConserve su recibo para cualquier reclamo.",
            showDate: true,
            showCashier: true,
            showClientInfo: true,
            showHeaderDivider: true,
            showFooterDivider: true,
            showItemSKU: false,
            showPaymentMethod: true,
            fontFamily: 'Helvetica',
            fontSizeHeader: 14,
            fontSizeBody: 8,
            ticketWidth: 80
        };

        const width = 80; // Optimized primarily for 80-millimeter thermal printers
        const ml = 6;
        const mr = width - ml;
        const cx = width / 2;
        const font = tpl.fontFamily || 'Helvetica';
        
        // Calculate dynamic height precisely to avoid wasting paper (make ticket short but readable)
        let headerLines = 0;
        if (tpl.showLogo) headerLines += 2;
        if (tpl.showLogo && tpl.logoImage) headerLines += 3;
        if (tpl.headerText) headerLines += tpl.headerText.split('\n').length;
        if (tpl.showDate) headerLines += 1;
        if (tpl.showCashier) headerLines += 1;
        if (tpl.showClientInfo && sale.client_name) headerLines += 1;

        let itemLines = items.length * 1.5;
        items.forEach(item => {
            if (tpl.showItemSKU && item.product_sku) itemLines += 0.8;
        });

        let footerLines = 3;
        if (sale.discount > 0) footerLines += 1.5;
        if (tpl.showPaymentMethod) footerLines += 1;
        if (tpl.footerText) footerLines += tpl.footerText.split('\n').length;
        
        const totalEstimatedLines = headerLines + itemLines + footerLines + 8;
        const predictedHeight = Math.max(120, Math.round(totalEstimatedLines * 4.2) + 20);

        const doc = new jsPDF({
            unit: 'mm',
            format: [width, predictedHeight]
        });

        doc.setFont(font, "normal");
        let y = 10;

        // 2. Centered Logo Image support (Base64)
        if (tpl.showLogo) {
            if (tpl.logoImage) {
                try {
                    const imgWidth = 14;
                    const imgHeight = 14;
                    const lx = cx - (imgWidth / 2);
                    doc.addImage(tpl.logoImage, 'PNG', lx, y, imgWidth, imgHeight);
                    y += imgHeight + 2.5;
                } catch (imageErr) {
                    console.error("Error drawing logo image on PDF", imageErr);
                }
            }

            if (tpl.logoText) {
                doc.setFont(font, "bold");
                doc.setFontSize(13); // Eye-catching header
                const wrappedLogo = doc.splitTextToSize(tpl.logoText, mr - ml);
                wrappedLogo.forEach((line: string) => {
                    doc.text(line, cx, y, { align: 'center' });
                    y += 5.5;
                });
                y += 1;
            }
        }

        // Subheader brand info
        doc.setFont(font, "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);

        if (tpl.headerText) {
            const wrappedHeader = doc.splitTextToSize(tpl.headerText, mr - ml);
            wrappedHeader.forEach((line: string) => {
                doc.text(line, cx, y, { align: 'center' });
                y += 3.8;
            });
            y += 1.5;
        }

        doc.setTextColor(15, 23, 42); // Reset to deep slate/black

        // Sleek thin solid vector line instead of hyphens
        if (tpl.showHeaderDivider) {
            doc.setLineWidth(0.2);
            doc.setDrawColor(203, 213, 225);
            doc.line(ml, y, mr, y);
            y += 4;
        }

        // Ticket info
        doc.setFont(font, "normal");
        doc.setFontSize(8);
        if (tpl.showDate) {
            doc.text(`Fecha: ${new Date(sale.created_at).toLocaleString()}`, ml, y);
            y += 4;
        }
        if (tpl.showCashier) {
            doc.text(`Atendió: ${sale.user_name || 'maria'}`, ml, y);
            y += 4;
        }
        if (tpl.showClientInfo && sale.client_name) {
            doc.setFont(font, "bold");
            doc.text(`Cliente: ${sale.client_name}`, ml, y);
            doc.setFont(font, "normal");
            y += 4.5;
        }

        if (sale.notes && sale.notes.trim() !== "") {
            doc.setFont(font, "bold");
            doc.text(`Notas:`, ml, y);
            doc.setFont(font, "normal");
            y += 4;
            const wrappedNotes = doc.splitTextToSize(sale.notes.trim(), mr - ml);
            wrappedNotes.forEach((line: string) => {
                doc.text(line, ml, y);
                y += 4;
            });
            y += 0.5;
        }

        y += 1;

        // Header columns for the items table
        doc.setFont(font, "bold");
        doc.setFontSize(8.5);
        doc.text("CANT  PRODUCTO", ml, y);
        const colPriceX = mr;
        doc.text(sale.currency === 'USD' ? "SUB ($)" : "SUB (Bs.)", colPriceX, y, { align: 'right' });
        y += 2.5;

        // Thin table divider line
        doc.setLineWidth(0.22);
        doc.setDrawColor(148, 163, 184);
        doc.line(ml, y, mr, y);
        y += 4;

        // Items mapping - Larger details, bold quantities and prices
        items.forEach(item => {
            doc.setFontSize(tpl.fontSizeBody ? tpl.fontSizeBody + 1 : 9); // Slightly larger font for details
            
            // Draw bold quantity
            doc.setFont(font, "bold");
            doc.text(`${item.quantity}x`, ml, y);
            
            // Draw normal name with small indent
            doc.setFont(font, "normal");
            const detailX = ml + 9;
            const maxNameWidth = mr - detailX - 22; // leaving space for price
            const wrappedName = doc.splitTextToSize(item.product_name, maxNameWidth);
            
            const firstLine = wrappedName[0] || "";
            doc.text(firstLine, detailX, y);
            
            // Draw bold price subtotal on the right
            doc.setFont(font, "bold");
            const itemSub = sale.currency === 'USD'
                ? `$${(item.price * item.quantity).toFixed(2)}`
                : `Bs.${(item.price * item.quantity).toFixed(2)}`;
            doc.text(itemSub, colPriceX, y, { align: 'right' });
            y += 4.2;

            if (wrappedName.length > 1) {
                doc.setFont(font, "normal");
                for (let i = 1; i < wrappedName.length; i++) {
                    doc.text(wrappedName[i], detailX, y);
                    y += 4.2;
                }
            }

            if (tpl.showItemSKU && item.product_sku) {
                doc.setFont(font, "italic");
                doc.setFontSize(7.5);
                doc.text(`SKU: ${item.product_sku}`, detailX, y - 0.5);
                y += 3.5;
            }
        });

        y += 1;
        // Total section divider
        doc.setLineWidth(0.22);
        doc.setDrawColor(148, 163, 184);
        doc.line(ml, y, mr, y);
        y += 4.5;

        // Totals display
        doc.setFont(font, "normal");
        doc.setFontSize(8.5);

        doc.text(`Subtotal:`, ml, y);
        const subtotalVal = sale.total + (sale.discount || 0);
        const subStr = sale.currency === 'USD'
            ? `$ ${subtotalVal.toFixed(2)}`
            : `Bs. ${subtotalVal.toFixed(2)}`;
        doc.text(subStr, colPriceX, y, { align: 'right' });
        y += 4;

        if (sale.discount > 0) {
            doc.setFont(font, "bold");
            doc.setTextColor(239, 68, 68);
            doc.text(`Desc:`, ml, y);
            const descStr = sale.currency === 'USD'
                ? `-$ ${sale.discount.toFixed(2)}`
                : `-Bs. ${sale.discount.toFixed(2)}`;
            doc.text(descStr, colPriceX, y, { align: 'right' });
            y += 4;
            doc.setTextColor(15, 23, 42);
        }

        // Clean double-line look for total
        doc.setLineWidth(0.15);
        doc.line(ml, y - 0.8, mr, y - 0.8);

        doc.setFont(font, "bold");
        doc.setFontSize(9.5);
        doc.text(`TOTAL GENERAL:`, ml, y);
        const totalStr = sale.currency === 'USD'
            ? `$ ${sale.total.toFixed(2)} USD`
            : `Bs. ${sale.total.toFixed(2)}`;
        doc.text(totalStr, colPriceX, y, { align: 'right' });
        y += 5;

        if (tpl.showPaymentMethod) {
            doc.setFont(font, "normal");
            doc.setFontSize(8);
            const currLabel = sale.currency === 'USD' ? 'USD' : 'BOB';
            doc.text(`Pago: ${sale.payment_method || 'Efectivo'} [${currLabel}]`, ml, y);
            y += 4.5;
        }

        if (tpl.showFooterDivider) {
            doc.setLineWidth(0.2);
            doc.setDrawColor(203, 213, 225);
            doc.line(ml, y, mr, y);
            y += 4;
        }

        if (tpl.footerText) {
            doc.setFont(font, "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const wrappedFooter = doc.splitTextToSize(tpl.footerText, mr - ml);
            wrappedFooter.forEach((line: string) => {
                doc.text(line, cx, y, { align: 'center' });
                y += 4;
            });
            y += 1;
        }

        // Barcode
        try {
            y += 1.5;
            doc.setFont(font, "normal");
            doc.setFontSize(5.5);
            doc.setTextColor(148, 163, 184);
            doc.text("SCAN DE AUDITORIA DIGITAL GTR-POS", cx, y, { align: 'center' });
            y += 2;
            
            const barcodeWidth = 42;
            const startBarcodeX = cx - (barcodeWidth / 2);
            let barX = startBarcodeX;
            doc.setDrawColor(30, 41, 59);
            
            const strokeSeed = "101100110101110010110110110011101011110011010101";
            for (let i = 0; i < strokeSeed.length; i++) {
                const chr = strokeSeed[i];
                if (chr === '1') {
                    const isThick = i % 3 === 0;
                    doc.setLineWidth(isThick ? 0.6 : 0.22);
                    doc.line(barX, y, barX, y + 4.5);
                }
                barX += (barcodeWidth / strokeSeed.length);
            }
            
            y += 6.5;
            doc.setFont(font, "bold");
            doc.setFontSize(6);
            doc.text(`*GTR-${sale.id}*`, cx, y, { align: 'center' });
        } catch (barErr) {
            console.error("Barcode drawing on reprint failed gracefully", barErr);
        }

        return doc;
    };

    // Helper to generate a pristine, high-resolution physical style ticket canvas for image sharing
    const generateReceiptCanvas = (sale: any, items: any[]) => {
        const canvas = document.createElement('canvas');
        const headerHeight = 180;
        const rowHeight = 46;
        const footerHeight = 240;
        const totalHeight = headerHeight + (items.length * rowHeight) + footerHeight;
        canvas.width = 450;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        // Clean white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Tech visual top strap accent (Blue/Indigo gradient style)
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(0, 0, canvas.width, 10);

        // Merchant header
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px Helvetica';
        ctx.fillText("GTR POS TERMINAL", canvas.width / 2, 45);

        ctx.font = '12px Helvetica';
        ctx.fillStyle = '#64748b';
        ctx.fillText("Cochabamba - Bolivia", canvas.width / 2, 68);
        ctx.fillText("Telf: 444-XXXXX • NIT: 382910023", canvas.width / 2, 88);

        // Premium visual divider stroke
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(20, 110);
        ctx.lineTo(430, 110);
        ctx.stroke();
        ctx.setLineDash([]);

        // Ticket Metadata
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'left';
        ctx.font = 'bold 12px Helvetica';
        ctx.fillText(`TRANSMISIÓN #: ${sale.id}`, 25, 135);
        ctx.textAlign = 'right';
        ctx.fillText(`Fecha: ${new Date(sale.created_at).toLocaleString()}`, 425, 135);

        ctx.textAlign = 'left';
        ctx.fillText(`Atendió: @${sale.user_name || 'Cajero Fiscal'}`, 25, 155);
        ctx.textAlign = 'right';
        const clientNameStr = sale.client_name || 'Cliente Particular / Público';
        ctx.fillText(`Cliente: ${clientNameStr.toUpperCase()}`, 425, 155);

        // Items headers
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 12px Helvetica';
        ctx.textAlign = 'left';
        ctx.fillText("ARTÍCULO", 25, 195);
        ctx.textAlign = 'center';
        ctx.fillText("CANT", 280, 195);
        ctx.textAlign = 'right';
        ctx.fillText("SUBTOTAL", 425, 195);

        // Underline items header
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(20, 205);
        ctx.lineTo(430, 205);
        ctx.stroke();

        // Print items
        let y = 230;
        items.forEach(item => {
            // Write product title nicely
            ctx.textAlign = 'left';
            ctx.font = 'bold 12px Helvetica';
            ctx.fillStyle = '#1e293b';
            const nameUpper = item.product_name.toUpperCase();
            const displayName = nameUpper.length > 25 ? nameUpper.substring(0, 23) + "..." : nameUpper;
            ctx.fillText(displayName, 25, y);

            // Cost secondary line
            ctx.font = '9px monospace';
            ctx.fillStyle = '#64748b';
            ctx.fillText(`SKU: ${item.sku || 'N/A'} @ ${sale.currency === 'USD' ? '$' : 'Bs.'}${Number(item.price).toFixed(2)} c/u`, 25, y + 15);

            // Write quantity
            ctx.textAlign = 'center';
            ctx.font = 'bold 12px Helvetica';
            ctx.fillStyle = '#0f172a';
            ctx.fillText(`x ${item.quantity}`, 280, y);

            // Write row total
            ctx.textAlign = 'right';
            const rowTotalVal = item.price * item.quantity;
            ctx.fillText(sale.currency === 'USD' ? `$ ${rowTotalVal.toFixed(2)}` : `Bs. ${rowTotalVal.toFixed(2)}`, 425, y);

            y += 46;
        });

        // Divider before totals
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(20, y - 10);
        ctx.lineTo(430, y - 10);
        ctx.stroke();
        ctx.setLineDash([]);

        y += 12;

        // Subtotal row
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 12px Helvetica';
        ctx.textAlign = 'left';
        ctx.fillText("Subtotal de Compra:", 25, y);
        ctx.textAlign = 'right';
        const subtotalSumVal = sale.total + sale.discount;
        ctx.fillText(sale.currency === 'USD' ? `$ ${subtotalSumVal.toFixed(2)}` : `Bs. ${subtotalSumVal.toFixed(2)}`, 425, y);

        if (sale.discount > 0) {
            y += 22;
            ctx.fillStyle = '#ef4444';
            ctx.textAlign = 'left';
            ctx.fillText("Descuento concedido:", 25, y);
            ctx.textAlign = 'right';
            ctx.fillText(`-${sale.currency === 'USD' ? '$' : 'Bs.'}${sale.discount.toFixed(2)}`, 425, y);
        }

        y += 30;

        // Indigo board total section
        ctx.fillStyle = '#1e1b4b'; // Deep Indigo background board
        ctx.fillRect(20, y - 20, 410, 48);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Helvetica';
        ctx.textAlign = 'left';
        ctx.fillText("TOTAL COBRADO NETO:", 35, y + 9);

        ctx.textAlign = 'right';
        ctx.font = 'bold 16px monospace';
        const finalTotalTextStr = `${sale.currency === 'USD' ? '$' : 'Bs.'} ${sale.total.toFixed(2)} ${sale.currency || 'BOB'}`;
        ctx.fillText(finalTotalTextStr, 415, y + 9);

        y += 46;

        // Receipt footer greeting
        ctx.fillStyle = '#64748b';
        ctx.font = '11px Helvetica';
        ctx.textAlign = 'center';
        ctx.fillText("¡Gracias por su preferencia!", canvas.width / 2, y);
        ctx.fillText("GTR POS v2.0 - Cochabamba • Bolivia", canvas.width / 2, y + 16);

        y += 35;

        // Interactive authentic visual barcode roll
        ctx.fillStyle = '#0f172a';
        const barPattern = "1011001101011001110010110111010101111001101011";
        const barUnitSize = 6;
        const barStartX = (canvas.width / 2) - ((barPattern.length * barUnitSize) / 2);
        for (let idx = 0; idx < barPattern.length; idx++) {
            if (barPattern[idx] === '1') {
                ctx.fillRect(barStartX + (idx * barUnitSize), y, barUnitSize - 1, 24);
            }
        }

        ctx.font = '9px monospace';
        ctx.fillText(`*SECURE-SYS-ID-${sale.id}*`, canvas.width / 2, y + 38);

        return canvas;
    };

    // Trigger PDF download
    const handleReprintPDF = (sale: any, items: any[]) => {
        try {
            const doc = generateTicketPDF(sale, items);
            doc.save(`Ticket_Copia_GTR_POS_${sale.id}.pdf`);
        } catch (err) {
            console.error("Error creating and downloading reprint PDF", err);
        }
    };

    // Trigger share dialog options panel
    const triggerShareOptions = (sale: any, items: any[]) => {
        setSharingSale(sale);
        setSharingItems(items);
        setShowShareOptionsModal(true);
    };

    // Share PDF document directly as a file using native Web Share API
    const handleShareDirectPDF = async () => {
        if (!sharingSale) return;
        try {
            const doc = generateTicketPDF(sharingSale, sharingItems);
            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], `Ticket_Compra_GTR_POS_${sharingSale.id}.pdf`, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    files: [pdfFile],
                    title: `Ticket GTR POS #${sharingSale.id}`,
                    text: `Hola, aquí tiene su documento fiscal digital oficial en formato PDF.`
                });
            } else {
                // Fallback inside UI
                doc.save(`Ticket_Compra_GTR_POS_${sharingSale.id}.pdf`);
                alert("La compartición de archivos nativa no está activa en este navegador o PC. Se guardó el archivo PDF directamente en tu almacenamiento local.");
            }
        } catch (shareErr) {
            console.error("System shared failed", shareErr);
            alert("No se pudo compartir el archivo de manera nativa. Descargando como archivo local.");
            const doc = generateTicketPDF(sharingSale, sharingItems);
            doc.save(`Ticket_Compra_GTR_POS_${sharingSale.id}.pdf`);
        }
    };

    // Share professional receipt image directly using Web Share API
    const handleShareDirectImage = async () => {
        if (!sharingSale) return;
        try {
            const canvas = generateReceiptCanvas(sharingSale, sharingItems);
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    alert("No se pudo generar la imagen del ticket.");
                    return;
                }
                const imgFile = new File([blob], `Ticket_GTR_POS_${sharingSale.id}.png`, { type: 'image/png' });

                if (navigator.canShare && navigator.canShare({ files: [imgFile] })) {
                    await navigator.share({
                        files: [imgFile],
                        title: `Ticket Digital #${sharingSale.id}`,
                        text: `Comprobante de compra #${sharingSale.id}`
                    });
                } else {
                    // Fallback to local image save
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `Ticket_GTR_POS_${sharingSale.id}.png`;
                    link.click();
                    alert("Su dispositivo no admite el envío directo de archivos de imagen por menú nativo. Se descargó el ticket en imagen PNG a su galería o carpeta local.");
                }
            }, 'image/png');
        } catch (err) {
            console.error("Error drawing or sharing image ticket:", err);
            alert("Sucedió un error al generar la imagen.");
        }
    };

    // Helper to download image directly
    const handleDownloadImage = () => {
        if (!sharingSale) return;
        try {
            const canvas = generateReceiptCanvas(sharingSale, sharingItems);
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Ticket_GTR_POS_${sharingSale.id}.png`;
                a.click();
            }, 'image/png');
        } catch (err) {
            console.error("Could not download image", err);
        }
    };

    // Save PDF and open WhatsApp interface (Enlace)
    const handleShareWhatsApp = async () => {
        if (!sharingSale) return;
        setSharingId(sharingSale.id);
        try {
            const doc = generateTicketPDF(sharingSale, sharingItems);
            const dataUri = doc.output('datauristring');

            const res = await fetch('/api/tickets/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saleId: sharingSale.id, pdfBase64: dataUri })
            });

            if (res.ok) {
                const data = await res.json();
                const shareUrl = data.url;

                // Rich structured text message
                const itemsText = sharingItems.map(item => `• ${item.quantity}x ${item.product_name} (${sharingSale.currency === 'USD' ? '$' : 'Bs.'}${item.price.toFixed(2)})`).join('\n');
                const discountText = sharingSale.discount > 0 ? `\nDescuento: -${sharingSale.currency === 'USD' ? '$' : 'Bs.'}${sharingSale.discount.toFixed(2)}` : '';
                const totalText = `${sharingSale.currency === 'USD' ? '$' : 'Bs.'} ${sharingSale.total.toFixed(2)} ${sharingSale.currency || 'BOB'}`;

                const message = `*GTR POS - COMPROBANTE DE COMPRA DIGITAL #${sharingSale.id}*\n\n` +
                                `📅 *Fecha/Hora:* ${new Date(sharingSale.created_at).toLocaleString()}\n` +
                                `👤 *Cliente:* ${sharingSale.client_name || 'Al público / Particular'}\n` +
                                `💳 *Método de Pago:* ${sharingSale.payment_method}\n\n` +
                                `*DETALLE DE ARTÍCULOS DETALLES:*\n${itemsText}\n` +
                                `${discountText}\n` +
                                `*TOTAL COBRADO:* *${totalText}*\n\n` +
                                `📄 *Ver & Descargar Documento Oficial PDF:* ${shareUrl}\n\n` +
                                `¡Gracias por preferir nuestro servicio! GTR POS Terminal.`;

                const encodedMsg = encodeURIComponent(message);
                const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;
                window.open(whatsappUrl, '_blank');
            } else {
                alert("Código de respuesta errado al intentar subir comprobante.");
            }
        } catch (err) {
            console.error("Error uploading or sharing ticket:", err);
            alert("No se pudo iniciar el flujo de sincronización de WhatsApp.");
        } finally {
            setSharingId(null);
        }
    };

    return (
        <div 
            id="historial-ventas-view" 
            className="p-4 sm:p-5 md:p-6 overflow-y-auto h-full flex flex-col gap-4 sm:gap-5 select-none bg-neutral-50/60 dark:bg-[#070a10] touch-momentum"
            style={outerScroll.style}
            {...outerScroll.touchHandlers}
        >
            {/* Header Box */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 bg-white dark:bg-[#0c111e] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-850 shadow-xs">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <Receipt size={18} />
                        </div>
                        <div>
                            <h1 className="text-base font-extrabold text-slate-850 dark:text-white uppercase tracking-wider">Historial de Ventas</h1>
                            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Registro granular, auditoría fiscal y seguimiento de ventas por período.</p>
                        </div>
                    </div>
                </div>
                
                {/* Actions Toolbar */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <DateRangePicker 
                        value={dateRange} 
                        onChange={(r) => {
                            setDateRange(r);
                            setSelectedSale(null);
                        }} 
                        className="flex-1 sm:flex-none"
                    />

                    <button 
                        onClick={() => loadSales()}
                        className="p-2.5 bg-slate-50 dark:bg-[#070c14] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl transition cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 shrink-0 shadow-xs"
                        title="Actualizar Ventas"
                    >
                        <RefreshCw size={15} className={loading ? "animate-spin text-indigo-600" : ""} />
                    </button>
                </div>
            </div>

            {/* Performance Tracking Stats Bento Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
                {/* 1. Flujo de Caja (Total Recaudado) */}
                <div className="bg-white dark:bg-[#0c111e] p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-850 shadow-xs flex flex-col justify-between transition hover:border-indigo-500/30">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 truncate">Flujo Total</span>
                    </div>
                    <div className="flex items-baseline gap-1 my-0.5">
                        <span className="text-[10px] font-bold text-slate-400">Bs.</span>
                        <span className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight whitespace-nowrap">
                            {totalEarnings.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-medium truncate">
                        Recaudación bruta
                    </span>
                </div>

                {/* 2. Capital Invertido */}
                {user?.role === 'admin' && (
                    <>
                        <div className="bg-white dark:bg-[#0c111e] p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-850 shadow-xs flex flex-col justify-between transition hover:border-amber-500/30">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 truncate">Capital</span>
                            </div>
                            <div className="flex items-baseline gap-1 my-0.5">
                                <span className="text-[10px] font-bold text-slate-400">Bs.</span>
                                <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight whitespace-nowrap">
                                    {totalCapital.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-medium truncate">
                                Costo inventario
                            </span>
                        </div>

                        {/* 3. Utilidad / Ganancia Generada */}
                        <div className="bg-white dark:bg-[#0c111e] p-3.5 sm:p-4 rounded-2xl border border-emerald-500/30 dark:border-emerald-500/20 shadow-xs flex flex-col justify-between transition hover:border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                <span className="text-[9px] uppercase font-extrabold tracking-wider text-emerald-600 dark:text-emerald-400 truncate">Ganancia</span>
                            </div>
                            <div className="flex items-baseline gap-1 my-0.5">
                                <span className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70">Bs.</span>
                                <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight whitespace-nowrap">
                                    {totalProfit.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <span className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 font-medium truncate">
                                Utilidad neta
                            </span>
                        </div>

                        {/* 4. Margen de Beneficio */}
                        <div className="bg-white dark:bg-[#0c111e] p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-850 shadow-xs flex flex-col justify-between transition hover:border-violet-500/30">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0"></span>
                                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 truncate">Margen</span>
                            </div>
                            <div className="flex items-baseline gap-1 my-0.5">
                                <span className="text-sm sm:text-base font-black text-violet-600 dark:text-violet-400 font-mono tracking-tight whitespace-nowrap">
                                    {profitMargin.toFixed(1)}%
                                </span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-medium truncate">
                                Retorno s/ venta
                            </span>
                        </div>
                    </>
                )}

                {/* 5. Boletas de Venta */}
                <div className="bg-white dark:bg-[#0c111e] p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-850 shadow-xs flex flex-col justify-between transition hover:border-sky-500/30">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0"></span>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 truncate">Ventas</span>
                    </div>
                    <div className="flex items-baseline gap-1 my-0.5">
                        <span className="text-sm sm:text-base font-black text-sky-600 dark:text-sky-400 font-mono tracking-tight whitespace-nowrap">
                            {transactionsCount}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">tickets</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-medium truncate">
                        {dateRange.preset === 'all' ? 'Todo historial' : (dateRange.preset === 'today' ? 'Hoy' : 'En período')}
                    </span>
                </div>

                {/* 6. Artículos / Ticket Promedio */}
                <div className="bg-white dark:bg-[#0c111e] p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-850 shadow-xs flex flex-col justify-between transition hover:border-pink-500/30">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0"></span>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 truncate">Promedio</span>
                    </div>
                    <div className="flex items-baseline gap-1 my-0.5">
                        <span className="text-[10px] font-bold text-slate-400">Bs.</span>
                        <span className="text-sm sm:text-base font-black text-pink-600 dark:text-pink-400 font-mono tracking-tight whitespace-nowrap">
                            {averageTicket.toFixed(2)}
                        </span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-medium truncate">
                        {totalItemsCount} uds. vendidas
                    </span>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
                {/* Sales List Table & Mobile Cards */}
                <div className="lg:col-span-2 bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/80 dark:border-slate-850 overflow-hidden flex flex-col shadow-xs">
                    
                    {/* FILTROS INTELIGENTES */}
                    <div className="p-3.5 sm:p-4.5 border-b border-slate-100 dark:border-slate-850/80 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row gap-2.5">
                            {/* Búsqueda */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
                                <input 
                                    type="text"
                                    placeholder="Buscar por #Ticket, cliente, cajero..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-[#070c14] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-750 dark:text-slate-200 font-medium"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                            
                            {/* Cajero */}
                            <div className="w-full sm:w-44 shrink-0">
                                <select
                                    value={selectedCashier}
                                    onChange={(e) => setSelectedCashier(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#070c14] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-750 dark:text-slate-200 font-bold cursor-pointer"
                                >
                                    <option value="all">👤 Todos los cajeros</option>
                                    {cashiers.map(c => (
                                        <option key={c} value={c}>👤 @{c}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Método de pago */}
                            <div className="w-full sm:w-44 shrink-0">
                                <select
                                    value={selectedPaymentMethod}
                                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#070c14] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-750 dark:text-slate-200 font-bold cursor-pointer"
                                >
                                    <option value="all">💳 Todos los métodos</option>
                                    {paymentMethods.map(m => (
                                        <option key={m} value={m}>💰 {m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Rango de Montos & Reset */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-t border-slate-100 dark:border-slate-850/60 pt-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider shrink-0">Monto:</span>
                                <div className="flex items-center gap-1.5">
                                    <input 
                                        type="number"
                                        placeholder="Mín"
                                        value={minAmount}
                                        onChange={(e) => setMinAmount(e.target.value)}
                                        className="w-18 px-2 py-1 bg-white dark:bg-[#070c14] border border-slate-200 dark:border-slate-800 rounded-lg text-center font-mono text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-750 dark:text-slate-200"
                                    />
                                    <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px]">a</span>
                                    <input 
                                        type="number"
                                        placeholder="Máx"
                                        value={maxAmount}
                                        onChange={(e) => setMaxAmount(e.target.value)}
                                        className="w-18 px-2 py-1 bg-white dark:bg-[#070c14] border border-slate-200 dark:border-slate-800 rounded-lg text-center font-mono text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-750 dark:text-slate-200"
                                    />
                                    <span className="text-slate-400 dark:text-slate-500 font-extrabold text-[10px]">Bs.</span>
                                </div>
                            </div>

                            {/* Botón para Limpiar Filtros */}
                            {(searchQuery || selectedCashier !== 'all' || selectedPaymentMethod !== 'all' || minAmount || maxAmount) && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedCashier('all');
                                        setSelectedPaymentMethod('all');
                                        setMinAmount('');
                                        setMaxAmount('');
                                    }}
                                    className="self-start sm:self-center text-[10px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-extrabold uppercase tracking-wider cursor-pointer transition"
                                >
                                    Restablecer Filtros
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Sales Records Container */}
                    <div 
                        className="overflow-y-auto touch-momentum max-h-[580px]"
                        style={listScroll.style}
                        {...listScroll.touchHandlers}
                    >
                        {/* Mobile Cards View (< 640px) */}
                        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-850">
                            {filteredSales.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                                    <Receipt size={28} className="opacity-40" />
                                    <span className="text-xs font-semibold">No se encontraron ventas en este rango.</span>
                                </div>
                            ) : (
                                filteredSales.map(sale => {
                                    const isSelected = selectedSale?.id === sale.id;
                                    return (
                                        <div
                                            key={sale.id}
                                            onClick={() => loadSaleDetails(sale)}
                                            className={`p-3.5 transition active:scale-[0.99] cursor-pointer flex items-center justify-between gap-3 ${
                                                isSelected 
                                                    ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-l-4 border-indigo-600' 
                                                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                                                        #{sale.id}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider ${
                                                        sale.payment_method === 'Efectivo' 
                                                            ? 'bg-emerald-500/10 text-emerald-600' 
                                                            : 'bg-indigo-500/10 text-indigo-600'
                                                    }`}>
                                                        {sale.payment_method}
                                                    </span>
                                                </div>
                                                <div className="font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate uppercase">
                                                    {sale.client_name || 'Cliente Particular'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                                    <span>{sale.item_count || 1} ítems</span>
                                                    <span>•</span>
                                                    <span>@{sale.user_name || 'admin'}</span>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                <span className="font-mono font-black text-sm text-slate-850 dark:text-white">
                                                    Bs. {sale.total.toFixed(2)}
                                                </span>
                                                <ChevronRight size={14} className="text-slate-400" />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Desktop Table View (>= 640px) */}
                        <div className="hidden sm:block">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-[#f8fafc] dark:bg-[#080d15] border-b border-slate-150 dark:border-slate-850 text-[9px] font-bold text-slate-400 uppercase tracking-widest z-10">
                                    <tr>
                                        <th className="p-3.5 pl-5"># Ticket</th>
                                        <th className="p-3.5">Fecha y Hora</th>
                                        <th className="p-3.5">Cliente</th>
                                        <th className="p-3.5 text-center">Método</th>
                                        <th className="p-3.5 text-right">Ítems</th>
                                        <th className="p-3.5 text-right pr-5">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850/50 text-[11px] font-bold">
                                    {filteredSales.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-10 text-center text-slate-400 font-medium">
                                                Ninguna venta registrada en este período seleccionado.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSales.map(sale => {
                                            const isSelected = selectedSale?.id === sale.id;
                                            return (
                                                <tr 
                                                    key={sale.id}
                                                    onClick={() => loadSaleDetails(sale)}
                                                    className={`cursor-pointer transition hover:bg-slate-50/70 dark:hover:bg-[#0c111f]/60 ${
                                                        isSelected 
                                                            ? 'bg-indigo-50/50 dark:bg-indigo-950/25 text-indigo-600 dark:text-indigo-400' 
                                                            : ''
                                                    }`}
                                                >
                                                    <td className="p-3.5 pl-5 font-mono font-bold text-slate-400">#{sale.id}</td>
                                                    <td className="p-3.5 font-normal text-slate-500 dark:text-slate-400">
                                                        {new Date(sale.created_at).toLocaleString()}
                                                    </td>
                                                    <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200 uppercase truncate max-w-[140px]">
                                                        {sale.client_name || 'Particular'}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span className={`text-[9px] px-2 py-0.5 rounded-lg border uppercase tracking-wider font-extrabold ${
                                                            sale.payment_method === 'Efectivo' 
                                                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                                                                : sale.payment_method === 'Tarjeta' 
                                                                    ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' 
                                                                    : sale.payment_method === 'Crédito'
                                                                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                                        : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                                                        }`}>
                                                            {sale.payment_method}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono text-slate-500 font-semibold">{sale.item_count} pz</td>
                                                    <td className="p-3.5 text-right pr-5 font-black text-slate-850 dark:text-white font-mono text-xs">
                                                        {sale.currency === 'USD' ? '$' : 'Bs.'} {sale.total.toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        {hasMoreSales && (
                            <div className="p-3.5 flex justify-center border-t border-slate-100 dark:border-slate-850/60 bg-white/50 dark:bg-black/10">
                                <button
                                    onClick={loadMoreSales}
                                    disabled={loadingMore}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs transition duration-200 shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                >
                                    {loadingMore ? (
                                        <>
                                            <span className="w-3 h-3 rounded-full border-2 border-white/35 border-t-white animate-spin" />
                                            Cargando...
                                        </>
                                    ) : (
                                        'Cargar Más Registros'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Details card section (Desktop side panel) */}
                <div className="hidden lg:flex bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/80 dark:border-slate-850 p-5 flex-col gap-4 shadow-xs">
                    {selectedSale ? (
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-850 pb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-850 dark:text-white">Ticket #{selectedSale.id}</h3>
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-md">
                                            {selectedSale.payment_method}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-normal block mt-1">{new Date(selectedSale.created_at).toLocaleString()}</span>
                                </div>
                            </div>

                            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Desglose de Artículos</span>
                            <div className="flex flex-col gap-2 overflow-y-auto max-h-[200px] border border-slate-100 dark:border-slate-850/60 p-2 rounded-2xl bg-neutral-50/50 dark:bg-black/10">
                                {saleItems.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-white dark:bg-[#080d14] border border-slate-150 dark:border-slate-850">
                                        <div className="min-w-0 pr-3">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase truncate leading-none mb-1">{item.product_name}</h4>
                                            <span className="text-[9px] font-mono text-slate-400 bg-slate-50 dark:bg-black/20 px-1 py-0.5 rounded font-bold">SKU {item.sku}</span>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="font-mono font-extrabold text-slate-700 dark:text-slate-300 block">
                                                {item.quantity} pz x {selectedSale.currency === 'USD' ? '$' : 'Bs.'}{item.price.toFixed(2)}
                                            </span>
                                            <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                                                {selectedSale.currency === 'USD' ? '$' : 'Bs.'} {(item.quantity * item.price).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-850 pt-3 flex flex-col gap-1.5">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                                    <span>Subtotal:</span>
                                    <span className="font-mono">{selectedSale.currency === 'USD' ? '$' : 'Bs.'} {(selectedSale.total + (selectedSale.discount || 0)).toFixed(2)}</span>
                                </div>
                                {selectedSale.discount > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold text-rose-500">
                                        <span>Descuento:</span>
                                        <span className="font-mono">-{selectedSale.currency === 'USD' ? '$' : 'Bs.'} {selectedSale.discount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-800 pt-2 text-sm font-extrabold text-slate-800 dark:text-white">
                                    <span>TOTAL:</span>
                                    <span className="font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                                        {selectedSale.currency === 'USD' ? '$' : 'Bs.'} {selectedSale.total.toFixed(2)} {selectedSale.currency || 'BOB'}
                                    </span>
                                </div>
                            </div>

                            {/* Control Actions Panel */}
                            <div className="border-t border-slate-100 dark:border-slate-850 pt-3 flex flex-col gap-2">
                                <button
                                    onClick={() => setShowDetailModal(true)}
                                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-extrabold text-xs rounded-xl tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-slate-200/60 dark:border-slate-750"
                                >
                                    <Eye size={13} /> Ver Detalle Completo
                                </button>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleReprintPDF(selectedSale, saleItems)}
                                        className="py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl tracking-wider flex items-center justify-center gap-1.5 cursor-pointer uppercase transition-all shadow-xs"
                                    >
                                        <Printer size={13} /> Reimprimir
                                    </button>
                                    
                                    <button
                                        onClick={() => triggerShareOptions(selectedSale, saleItems)}
                                        className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                                    >
                                        <Share2 size={13} /> Compartir
                                    </button>
                                </div>

                                <button
                                    onClick={() => {
                                        localStorage.setItem('auto_refund_sale_id', selectedSale.id.toString());
                                        setView('devoluciones');
                                    }}
                                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/35 text-rose-600 dark:text-rose-400 font-extrabold text-xs rounded-xl tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-rose-200/50 dark:border-rose-900/30 uppercase"
                                >
                                    <Undo2 size={13} /> Devolución
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 gap-2.5">
                            <Receipt size={36} className="text-slate-300 dark:text-slate-700" />
                            <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Detalle de Comprobante</span>
                            <p className="text-[11px] font-medium max-w-[200px] mt-0.5 leading-normal">Selecciona una venta de la lista para ver sus ítems, reimprimir ticket o gestionar devoluciones.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* GRAND DETAILS MODAL FOR COMPLETE SALE AND ITEMIZATION */}
            <AnimatePresence>
                {showDetailModal && selectedSale && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs" 
                            onClick={() => setShowDetailModal(false)}
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200 dark:border-slate-850 p-5 sm:p-6 max-w-xl w-full relative z-10 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-hidden select-none"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-850/60 shrink-0">
                                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                    <Receipt size={18} className="animate-pulse" />
                                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-850 dark:text-white">COMPROBANTE GRANULAR (# {selectedSale.id})</h3>
                                </div>
                                <button 
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-850 transition cursor-pointer"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-5 text-xs">
                                
                                {/* Auditoria / Metadatos */}
                                <div className="grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-black/20 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-850/60">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha de Registro:</span>
                                        <span className="font-mono text-slate-700 dark:text-slate-200 font-semibold">{new Date(selectedSale.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atendido Por:</span>
                                        <span className="text-slate-707 dark:text-slate-202 font-bold uppercase">@{selectedSale.user_name || 'Cajero de Turno'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 col-span-2 border-t border-slate-150/50 dark:border-slate-800/50 pt-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Datos del Cliente:</span>
                                        <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                            <span className="font-black">{selectedSale.client_name || 'CLIENTE PARTICULAR (AL PÚBLICO)'}</span>
                                            {selectedSale.client_phone && <span className="font-mono font-semibold text-slate-450 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Telf: {selectedSale.client_phone}</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Moneda y Pasarela */}
                                <div className="grid grid-cols-2 gap-3 p-3.5 bg-blue-50/20 dark:bg-blue-950/5 rounded-2xl border border-blue-100/40 dark:border-blue-950/25">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider col-span-2">Moneda Registrada:</span>
                                        <span className="text-xs text-blue-600 dark:text-blue-400 uppercase font-black">
                                            {selectedSale.currency === 'USD' ? 'Dólares (USD)' : 'Bolivianos (BOB)'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Método de Cobro:</span>
                                        <span className="text-xs uppercase font-black text-slate-700 dark:text-slate-200">{selectedSale.payment_method}</span>
                                    </div>
                                </div>

                                {/* Tabla Completa de Productos */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#2563eb] mb-1">Ítems Detallados</span>
                                    <div className="border border-slate-150 dark:border-slate-850/60 rounded-2xl overflow-hidden bg-white dark:bg-[#070a11]">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-[#0c111e] border-b border-slate-150 dark:border-slate-850 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <th className="p-3">Producto</th>
                                                    <th className="p-3">Categoría</th>
                                                    <th className="p-3 text-right">Precio Unit</th>
                                                    <th className="p-3 text-center">Cant</th>
                                                    <th className="p-3 text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-850/40 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                                {saleItems.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-[#0c111f]/30">
                                                        <td className="p-3 uppercase">
                                                            <div className="font-extrabold text-slate-800 dark:text-slate-200">{item.product_name}</div>
                                                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">SKU {item.sku}</div>
                                                        </td>
                                                        <td className="p-3">
                                                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-755 uppercase font-bold text-slate-500 text-[10px]">
                                                                {item.category || "Generales"}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right font-mono">{selectedSale.currency === 'USD' ? '$' : 'Bs.'} {item.price.toFixed(2)}</td>
                                                        <td className="p-3 text-center font-mono font-extrabold text-slate-400">{item.quantity} pz</td>
                                                        <td className="p-3 text-right font-mono font-black text-slate-800 dark:text-slate-100">
                                                            {selectedSale.currency === 'USD' ? '$' : 'Bs.'} {(item.price * item.quantity).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Comprobante Total */}
                                <div className="border-t border-slate-100 dark:border-slate-850 pt-3.5 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                                        <span>Subtotal Neto:</span>
                                        <span className="font-mono">{selectedSale.currency === 'USD' ? '$' : 'Bs.'} {(selectedSale.total + selectedSale.discount).toFixed(2)}</span>
                                    </div>
                                    {selectedSale.discount > 0 && (
                                        <div className="flex justify-between items-center text-xs font-bold text-red-500">
                                            <span>Descuento Aplicado:</span>
                                            <span className="font-mono">-{selectedSale.currency === 'USD' ? '$' : 'Bs.'} {selectedSale.discount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-800 pt-2.5 text-xs font-extrabold text-slate-800 dark:text-white">
                                        <span className="text-sm">TOTAL COBRADO:</span>
                                        <span className="font-mono text-lg font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 px-3 py-1 rounded-xl border border-indigo-500/10">
                                            {selectedSale.currency === 'USD' ? '$' : 'Bs.'} {selectedSale.total.toFixed(2)} {selectedSale.currency || 'BOB'}
                                        </span>
                                    </div>
                                </div>

                            </div>

                            {/* Modal Footer */}
                            <div className="border-t border-slate-150 dark:border-slate-850 pt-3 flex items-center justify-between shrink-0 gap-2">
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleReprintPDF(selectedSale, saleItems)}
                                        className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl tracking-wider flex items-center gap-1.5 cursor-pointer uppercase transition-all"
                                    >
                                        <Printer size={13} /> Reimprimir Copia
                                    </button>
                                    <button
                                        onClick={() => triggerShareOptions(selectedSale, saleItems)}
                                        className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
                                    >
                                        <Share2 size={13} /> Compartir Ticket
                                    </button>
                                    <button
                                        onClick={() => {
                                            localStorage.setItem('auto_refund_sale_id', selectedSale.id.toString());
                                            setView('devoluciones');
                                            setShowDetailModal(false);
                                        }}
                                        className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl tracking-wider flex items-center gap-1.5 cursor-pointer transition-all uppercase"
                                    >
                                        <Undo2 size={13} /> Devolución
                                    </button>
                                </div>
                                <button 
                                    onClick={() => setShowDetailModal(false)}
                                    className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl border border-slate-200/50 dark:border-slate-800 transition cursor-pointer"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de Opciones de Compartición Profesional (PDF o Imagen) */}
            <AnimatePresence>
                {showShareOptionsModal && sharingSale && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-950/65 backdrop-blur-xs" 
                            onClick={() => setShowShareOptionsModal(false)}
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-205 dark:border-slate-850 p-6 max-w-sm w-full relative z-10 flex flex-col gap-4 shadow-2xl max-h-[95vh] overflow-y-auto select-none"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-850/60 shrink-0">
                                <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                                    <Share2 size={16} />
                                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-840 dark:text-white">Compartir Ticket Profesional</h3>
                                </div>
                                <button 
                                    onClick={() => setShowShareOptionsModal(false)}
                                    className="p-1 px-2 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl transition text-slate-400 uppercase tracking-widest text-[9px] font-black cursor-pointer"
                                >
                                    Cerrar ×
                                </button>
                            </div>

                            <p className="text-[10.5px] font-bold text-slate-400 leading-normal mb-1">
                                Selecciona el formato en el que deseas enviar o descargar el comprobante del Ticket <span className="font-mono text-slate-600 dark:text-slate-200">#{sharingSale.id}</span> para tu cliente:
                            </p>

                            <div className="flex flex-col gap-3.5">
                                {/* Option Block: OFFICIAL PDF */}
                                <div className="p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-850 bg-slate-50/50 dark:bg-black/15 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-rose-500 font-sans font-black text-[10.5px] uppercase tracking-widest">
                                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                                        Documento PDF Oficial
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                        El formato más idóneo para imprimir, archivar o compartir como archivo de contabilidad oficial del comercio.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        <button
                                            onClick={() => {
                                                handleShareDirectPDF();
                                                setShowShareOptionsModal(false);
                                            }}
                                            className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-[10.5px] uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/10 cursor-pointer"
                                        >
                                            <Share2 size={12} /> Enviar PDF
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleReprintPDF(sharingSale, sharingItems);
                                                setShowShareOptionsModal(false);
                                            }}
                                            className="py-2.5 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-205 rounded-xl font-bold text-[10.5px] uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 border dark:border-slate-755 cursor-pointer"
                                        >
                                            <Printer size={12} /> Guardar PDF
                                        </button>
                                    </div>
                                </div>

                                {/* Option Block: HIGH-RES PNG TICKET IMAGE */}
                                <div className="p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-850 bg-slate-50/50 dark:bg-black/15 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-blue-500 font-sans font-black text-[10.5px] uppercase tracking-widest">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        Imagen Digital JPG (Ticket)
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                        Genera un gráfico estilizado del ticket de caja tradicional. Muy pulcro, legible y rápido de visualizar por clientes móviles.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        <button
                                            onClick={() => {
                                                handleShareDirectImage();
                                                setShowShareOptionsModal(false);
                                            }}
                                            className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-[10.5px] uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 cursor-pointer"
                                        >
                                            <Share2 size={12} /> Enviar Imagen
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleDownloadImage();
                                                setShowShareOptionsModal(false);
                                            }}
                                            className="py-2.5 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-205 rounded-xl font-bold text-[10.5px] uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 border dark:border-slate-755 cursor-pointer"
                                        >
                                            <Printer size={11} /> Guardar Imagen
                                        </button>
                                    </div>
                                </div>

                                {/* Option Block: COMPANION LINK ON PORTAL */}
                                <div className="p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-850 bg-slate-50/50 dark:bg-black/15 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-emerald-650 dark:text-emerald-405 font-sans font-black text-[10.5px] uppercase tracking-widest">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        Enlace de Resguardo WhatsApp
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                        Sube el ticket a la nube e inicia WhatsApp Web/Móvil con un texto predefinido que enlaza al cliente a la visualización remota de su comprobante.
                                    </p>
                                    <button
                                        disabled={sharingId !== null}
                                        onClick={() => {
                                            handleShareWhatsApp();
                                        }}
                                        className="py-2.5 w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[10.5px] uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer"
                                    >
                                        {sharingId === sharingSale.id ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <MessageCircle size={12} />
                                        )}
                                        {sharingId === sharingSale.id ? "Subiendo..." : "Enviar link por WhatsApp"}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowShareOptionsModal(false)}
                                className="w-full mt-2 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 border dark:border-slate-800 text-slate-700 dark:text-slate-350 text-xs font-extrabold uppercase rounded-xl transition cursor-pointer"
                            >
                                Cancelar
                              </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ----------------------------------------------------
// VIEW: VENTAS PENDIENTES
// ----------------------------------------------------
export function VentasPendientesView() {
    const { setView } = useAppContext();
    return (
        <div className="p-5 md:p-6 h-full flex flex-col gap-5 select-none bg-neutral-50/50 dark:bg-[#070a10]">
            <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/60 dark:border-slate-850">
                <div className="flex items-center gap-2">
                    <Clock className="text-blue-500 shrink-0" size={16} />
                    <h1 className="text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Ventas Pendientes / Retenidas</h1>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Comandas temporales retenidas o suspendidas mientras el cliente termina su compra en el establecimiento.</p>
            </div>

            <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850 p-8 flex flex-col items-center justify-center text-center max-w-sm mx-auto mt-16 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-550/10 mb-4 animate-pulse">
                    <ShoppingCart size={20} />
                </div>
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-gray-150">Caja Completamente Fluida</h3>
                <p className="text-[11px] text-slate-400 font-semibold leading-relaxed mt-2 max-w-[240px]">
                    El Punto de Venta (POS) principal ahora cuenta con el selector multi-venta instantáneo `[Venta 1] +` en la barra superior.
                </p>
                <button 
                    onClick={() => setView('pos')}
                    className="mt-5 text-[10px] font-black uppercase text-white bg-blue-600 hover:bg-blue-500 p-2.5 px-6 rounded-xl border border-blue-550 transition shadow-md shadow-blue-500/10 cursor-pointer"
                >
                    Ir al Punto de Venta
                </button>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// ----------------------------------------------------
// VIEW: DEPARTAMENTOS
// ----------------------------------------------------
export function DepartamentosView() {
    const { products, departments, fetchDepartments } = useAppContext();
    const [newDeptName, setNewDeptName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const presetExamples = ["Micro SD", "SD", "USB", "Accesorios"];

    useEffect(() => {
        fetchDepartments();
    }, []);

    const handleCreateDept = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);
        if (!newDeptName.trim()) return;

        setSubmitting(true);
        try {
            const res = await fetch('/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newDeptName.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                setSuccessMsg(`✓ Departamento "${newDeptName.trim()}" creado correctamente.`);
                setNewDeptName("");
                fetchDepartments();
                setTimeout(() => setSuccessMsg(null), 3000);
            } else {
                setErrorMsg(data.error || "No se pudo crear el departamento.");
            }
        } catch (err: any) {
            setErrorMsg("Error de conexión al servidor.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteDept = async (id: number, name: string) => {
        const productCount = products.filter(p => (p.category || "").toLowerCase() === name.toLowerCase()).length;
        if (productCount > 0) {
            setErrorMsg(`No se puede eliminar "${name}" porque tiene ${productCount} productos asignados.`);
            setTimeout(() => setErrorMsg(null), 4000);
            return;
        }

        if (!window.confirm(`¿Estás seguro de eliminar el departamento "${name}"?`)) return;

        setErrorMsg(null);
        setSuccessMsg(null);
        try {
            const res = await fetch(`/api/departments/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setSuccessMsg(`✓ Departamento eliminado exitosamente.`);
                fetchDepartments();
                setTimeout(() => setSuccessMsg(null), 3000);
            } else {
                const data = await res.json();
                setErrorMsg(data.error || "No se pudo eliminar el departamento.");
            }
        } catch (err) {
            setErrorMsg("Error de conexión al eliminar.");
        }
    };

    return (
        <div className="p-5 md:p-6 overflow-y-auto h-full flex flex-col gap-5 select-none bg-neutral-50/50 dark:bg-[#070a10]">
            <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/60 dark:border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <Folder className="text-blue-500 shrink-0" size={16} />
                        <h1 className="text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Gestión de Departamentos</h1>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 font-semibold">Crea, administra y visualiza los departamentos autorizados para clasificar productos.</p>
                </div>
            </div>

            {/* Quick alert notifications */}
            {(successMsg || errorMsg) && (
                <div className={`p-3.5 rounded-2xl text-xs font-bold border transition-all duration-300 ${
                    successMsg 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-rose-50 dark:bg-rose-950/20 border-rose-250 dark:border-rose-900/40 text-rose-600 dark:text-rose-400'
                }`}>
                    {successMsg || errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Form: Create Department */}
                <div className="lg:col-span-4 bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/60 dark:border-slate-850 flex flex-col gap-4">
                    <div className="border-b border-slate-100 dark:border-slate-850 pb-2.5">
                        <h2 className="font-extrabold text-xs uppercase tracking-widest text-[#2c3e50] dark:text-[#a5b4fc] flex items-center gap-1.5">
                            <PlusCircle size={14} className="text-blue-500" />
                            Nuevo Departamento
                        </h2>
                    </div>

                    <form onSubmit={handleCreateDept} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Nombre del Departamento</label>
                            <input 
                                type="text" 
                                className="p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-semibold focus:outline-none focus:border-blue-550 dark:text-white"
                                placeholder="Ej: Electrónica o Bebidas"
                                value={newDeptName}
                                onChange={e => setNewDeptName(e.target.value)}
                                required
                            />
                        </div>

                        {/* Presets suggestions */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Sugerencias rápidas:</span>
                            <div className="flex flex-wrap gap-1.5">
                                {presetExamples.map(pr => (
                                    <button
                                        key={pr}
                                        type="button"
                                        onClick={() => setNewDeptName(pr)}
                                        className="text-[10px] font-semibold bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 py-1 px-2.5 rounded-lg border border-slate-205 dark:border-slate-800/80 transition active:scale-95 cursor-pointer animate-in fade-in"
                                    >
                                        {pr}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={submitting || !newDeptName.trim()}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition duration-150 cursor-pointer text-center"
                        >
                            {submitting ? "Creando..." : "+ Crear Departamento"}
                        </button>
                    </form>
                </div>

                {/* Right: Active Departments Grid */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 pl-1.5">
                        Departamentos Registrados ({departments.length})
                    </div>

                    {departments.length === 0 ? (
                        <div className="bg-white dark:bg-[#0c111e] border border-slate-200/60 dark:border-slate-850 rounded-3xl p-12 text-center text-slate-400 text-xs font-semibold shadow-sm">
                            No se registran categorías dadas de alta en el catálogo activo.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
                            {departments.map(dept => {
                                // Calculate metrics
                                const matchingProducts = products.filter(p => (p.category || "").toLowerCase() === (dept.name || "").toLowerCase());
                                const skuCount = matchingProducts.length;
                                const stockCount = matchingProducts.reduce((sum, p) => sum + p.stock, 0);
                                const totalValue = matchingProducts.reduce((sum, p) => sum + (p.stock * p.price_unit), 0);

                                return (
                                    <div key={dept.id} className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/60 dark:border-slate-850 select-none flex flex-col justify-between min-h-[140px] shadow-sm relative group">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{dept.name}</span>
                                                <span className="text-[9px] text-slate-400 font-semibold mt-0.5">{skuCount} SKU en catálogo</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border border-blue-500/5">
                                                    {stockCount} Unidades
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteDept(dept.id, dept.name)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition duration-150 cursor-pointer"
                                                    title="Eliminar Departamento"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-6 pt-3.5 border-t border-slate-50 dark:border-slate-850/50 flex justify-between items-center font-semibold">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Activo Valorizado</span>
                                                <span className="text-xs font-mono font-black mt-0.5 text-blue-600 dark:text-blue-400">Bs. {totalValue.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// VIEW: DEVOLUCIONES (REFUNDS MANAGER)
// ----------------------------------------------------
export function DevolucionesView() {
    const { fetchProducts } = useAppContext();
    const [sales, setSales] = useState<any[]>([]);
    const [selectedSale, setSelectedSale] = useState<any | null>(null);
    const [saleItems, setSaleItems] = useState<any[]>([]);
    const [refundQuantities, setRefundQuantities] = useState<{ [productId: number]: number }>({});
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [notification, setNotification] = useState<string | null>(null);

    const loadSales = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/sales');
            if (res.ok) {
                const data = await res.json();
                setSales(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSaleForRefund = async (sale: any) => {
        setSelectedSale(sale);
        setSaleItems([]);
        setRefundQuantities({});
        try {
            const res = await fetch(`/api/sales/${sale.id}/items`);
            if (res.ok) {
                const data = await res.json();
                setSaleItems(data);
                // Set default refund quantities to 0, keyed by sale_item id
                const initialQty: { [key: number]: number } = {};
                data.forEach((it: any) => {
                    initialQty[it.id] = 0;
                });
                setRefundQuantities(initialQty);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const incrementRefund = (saleItemId: number, maxQty: number) => {
        setRefundQuantities(prev => {
            const current = prev[saleItemId] || 0;
            return {
                ...prev,
                [saleItemId]: Math.min(maxQty, current + 1)
            };
        });
    };

    const decrementRefund = (saleItemId: number) => {
        setRefundQuantities(prev => {
            const current = prev[saleItemId] || 0;
            return {
                ...prev,
                [saleItemId]: Math.max(0, current - 1)
            };
        });
    };

    const executeRefund = async () => {
        if (!selectedSale) return;
        const itemsToRefund = saleItems.map(item => {
            const qty = refundQuantities[item.id] || 0;
            return {
                sale_item_id: item.id,
                product_id: item.product_id,
                quantity: qty
            };
        }).filter(item => item.quantity > 0);

        if (itemsToRefund.length === 0) {
            setNotification("Debes seleccionar al menos 1 unidad de artículo para procesar la devolución.");
            setTimeout(() => setNotification(null), 3000);
            return;
        }

        try {
            const res = await fetch('/api/sales/refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sale_id: selectedSale.id,
                    item_refunds: itemsToRefund
                })
            });

            if (res.ok) {
                const resData = await res.json().catch(() => ({}));
                const reconCount = resData.inventoryReconciliation?.length || 0;
                setNotification(`✓ Devolución procesada. Incremento de stock validado y reconciliado de forma atómica (${reconCount} ítem${reconCount !== 1 ? 's' : ''}).`);
                setTimeout(() => setNotification(null), 5000);
                setSelectedSale(null);
                setSaleItems([]);
                setRefundQuantities({});
                loadSales();
                fetchProducts(); // refresh master inventory numbers
            } else {
                const errData = await res.json().catch(() => ({}));
                setNotification(errData.error || "Error al procesar la devolución.");
                setTimeout(() => setNotification(null), 4000);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadSales();
    }, []);

    useEffect(() => {
        const autoRefundSaleId = localStorage.getItem('auto_refund_sale_id');
        if (autoRefundSaleId && sales.length > 0) {
            const saleToRefund = sales.find(s => s.id === Number(autoRefundSaleId));
            if (saleToRefund) {
                handleSelectSaleForRefund(saleToRefund);
            }
            localStorage.removeItem('auto_refund_sale_id');
        }
    }, [sales]);

    const cleanSearchQuery = searchQuery.toLowerCase().replace(/^#/, '').trim();
    const filteredSales = sales.filter(s => {
        if (!cleanSearchQuery) return true;
        return String(s.id).includes(cleanSearchQuery) || 
               (s.client_name && s.client_name.toLowerCase().includes(cleanSearchQuery));
    });

    return (
        <div className="p-5 md:p-6 overflow-y-auto h-full flex flex-col gap-5 select-none bg-neutral-50/50 dark:bg-[#070a10]">
            <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/60 dark:border-slate-850">
                <div className="flex items-center gap-2">
                    <Undo2 className="text-blue-500 shrink-0" size={16} />
                    <h1 className="text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Devoluciones y Reintegros</h1>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 font-semibold">Anulaciones de artículos comprados, reincorporación de productos a existencias y cuadre fiscal.</p>
            </div>

            {notification && (
                <div className="bg-slate-800 text-white font-bold p-3 px-5 text-xs rounded-2xl border border-slate-700 w-max shadow-lg animate-bounce">
                    {notification}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Search past tickets */}
                <div className="lg:col-span-2 bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850 flex flex-col overflow-hidden max-h-[500px]">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-850 flex items-center">
                        <div className="relative flex-1">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                                <Search size={14} />
                            </span>
                            <input 
                                type="text"
                                placeholder="Escribe el ID del Ticket o nombre de Cliente..."
                                className="pl-9 pr-4 py-2 w-full bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#f8fafc]/60 dark:bg-[#080d15]/50 border-b border-slate-150 dark:border-slate-850/50 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="p-4 pl-6">ID Ticket</th>
                                    <th className="p-4 hidden sm:table-cell">Fecha</th>
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4 text-right pr-6">Monto Total (Bs.)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-850/40 text-[11px] font-bold">
                                {filteredSales.map(sale => (
                                    <tr 
                                        key={sale.id}
                                        onClick={() => handleSelectSaleForRefund(sale)}
                                        className={`cursor-pointer transition hover:bg-slate-50/50 dark:hover:bg-[#0c111e]/65 ${selectedSale?.id === sale.id ? 'bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400' : ''}`}
                                    >
                                        <td className="p-4 pl-6 font-mono font-bold text-slate-400">#{sale.id}</td>
                                        <td className="p-4 text-slate-500 hidden sm:table-cell">{new Date(sale.created_at).toLocaleDateString()}</td>
                                        <td className="p-4 text-slate-700 dark:text-slate-350 uppercase truncate max-w-[120px]">{sale.client_name || 'Particular'}</td>
                                        <td className="p-4 text-right pr-6 font-mono font-black">Bs. {sale.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Refund controller panel */}
                <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850 p-5 flex flex-col gap-4">
                    {selectedSale ? (
                        <div className="flex flex-col gap-4">
                            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-850 dark:text-slate-300">Reintegro de Ticket #{selectedSale.id}</h3>
                            <p className="text-[10px] text-slate-400 font-semibold">Selecciona las unidades de los productos a devolver que ingresarán nuevamente a stock:</p>
                            
                            <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[300px]">
                                {saleItems.map(item => {
                                    const qtySelected = refundQuantities[item.id] || 0;
                                    const isFullyRefunded = item.quantity === 0;
                                    return (
                                        <div key={item.id} className={`flex justify-between items-center p-3 rounded-2xl border ${isFullyRefunded ? 'border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/10' : 'border-slate-150 dark:border-slate-850 bg-slate-50/50 dark:bg-black/10'}`}>
                                            <div className="min-w-0 pr-3">
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className="font-bold text-xs uppercase text-slate-850 dark:text-slate-200 truncate">{item.product_name}</h4>
                                                    {isFullyRefunded && (
                                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                                            Devuelto
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-405 block mt-0.5 font-mono">
                                                    Disponibles p/ devolución: {item.quantity} pz
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => decrementRefund(item.id)}
                                                    disabled={isFullyRefunded || qtySelected <= 0}
                                                    className="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 border text-xs font-black flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                                                >
                                                    -
                                                </button>
                                                <span className="font-mono text-xs font-extrabold w-5 text-center">{qtySelected}</span>
                                                <button 
                                                    onClick={() => incrementRefund(item.id, item.quantity)}
                                                    disabled={isFullyRefunded || qtySelected >= item.quantity}
                                                    className="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 border text-xs font-black flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <button 
                                onClick={executeRefund}
                                className="w-full mt-2 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-2xl tracking-wide uppercase transition hover:scale-[1.01] shadow-lg shadow-rose-500/15"
                            >
                                Registrar Devolución Física
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center text-slate-450 gap-2.5">
                            <Undo2 size={32} className="text-slate-201 dark:text-slate-800 opacity-80" />
                            <span className="text-xs font-black uppercase tracking-wider">Caja de Reintegros</span>
                            <p className="text-[10px] font-semibold max-w-[200px] mt-1.5 leading-relaxed">Selecciona un ticket de venta en el panel lateral de registros usando el buscador para regular sus existencias.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// VIEW: ANALISIS (CHARTS & DETAILED REPORTING)
// ----------------------------------------------------
export function AnalisisView() {
    const { products, user, exchangeRate } = useAppContext();
    const [sales, setSales] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState<DateRange>({
        startDate: (() => {
            const prior = new Date();
            prior.setDate(prior.getDate() - 29); // Default to last 30 days for rich analytics
            return prior.toISOString().split('T')[0];
        })(),
        endDate: new Date().toISOString().split('T')[0],
        preset: '30days'
    });

    useEffect(() => {
        const fetchSales = async () => {
            try {
                let url = '/api/sales';
                if (dateRange.preset !== 'all' && dateRange.startDate && dateRange.endDate) {
                    url += `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
                }
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setSales(data);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchSales();
    }, [dateRange]);

    // Formulate variables
    const cashTotal = sales.filter(s => s.payment_method === 'Efectivo').reduce((acc, s) => acc + s.total, 0);
    const cardTotal = sales.filter(s => s.payment_method === 'Tarjeta').reduce((acc, s) => acc + s.total, 0);
    const transferTotal = sales.filter(s => s.payment_method === 'Transferencia').reduce((acc, s) => acc + s.total, 0);
    const totalTransactions = sales.length;
    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;


    // Aggregate sales by hour
    const hourlySales = React.useMemo(() => {
        const groups: { [key: string]: { total: number; count: number } } = {};
        for (let i = 0; i < 24; i++) {
            const key = i.toString().padStart(2, '0');
            groups[key] = { total: 0, count: 0 };
        }
        sales.forEach(s => {
            if (s.created_at) {
                let hour = '';
                if (s.created_at.includes('T')) {
                    hour = s.created_at.split('T')[1].split(':')[0];
                } else if (s.created_at.includes(' ')) {
                    hour = s.created_at.split(' ')[1].split(':')[0];
                }
                if (hour && groups[hour]) {
                    groups[hour].total += s.total;
                    groups[hour].count += 1;
                }
            }
        });
        return Object.keys(groups).sort().map(hour => ({
            hour,
            label: `${hour}:00`,
            total: parseFloat(groups[hour].total.toFixed(2)),
            count: groups[hour].count
        }));
    }, [sales]);

    // Aggregate sales chronologically by day

    const salesByDay = React.useMemo(() => {
        const groups: { [key: string]: number } = {};
        sales.forEach(s => {
            const rawDate = s.created_at.split('T')[0];
            groups[rawDate] = (groups[rawDate] || 0) + s.total;
        });
        const sorted = Object.keys(groups).sort();
        return sorted.map(dateKey => {
            const [year, month, day] = dateKey.split('-');
            const formattedDate = `${day}/${month}`;
            return {
                rawDate: dateKey,
                date: formattedDate,
                total: parseFloat(groups[dateKey].toFixed(2))
            };
        });
    }, [sales]);

    // Payment methods data structured for Recharts Pie Chart
    const paymentPieData = React.useMemo(() => {
        return [
            { name: 'Efectivo', value: cashTotal, color: '#10b981' },
            { name: 'Tarjeta', value: cardTotal, color: '#4f46e5' },
            { name: 'Transferencia', value: transferTotal, color: '#8b5cf6' }
        ].filter(d => d.value > 0);
    }, [cashTotal, cardTotal, transferTotal]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-[#0c111e] p-3 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-xl text-xs font-bold text-slate-800 dark:text-slate-100">
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase mb-1">{payload[0].payload.rawDate}</p>
                    <p className="text-[#4f46e5] dark:text-[#a5b4fc] font-mono">Facturado: Bs. {payload[0].value.toFixed(2)}</p>
                </div>
            );
        }
        return null;
    };

    const CustomPieTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-[#0c111e] p-3 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-xl text-xs font-bold text-slate-800 dark:text-slate-100">
                    <p className="font-extrabold uppercase mb-0.5 text-[10px]" style={{ color: payload[0].payload.color }}>
                        {payload[0].name}
                    </p>
                    <p className="font-mono">Monto: Bs. {payload[0].value.toFixed(2)}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-5 md:p-6 overflow-y-auto h-full flex flex-col gap-5 select-none bg-[#f8fafc]/40 dark:bg-[#070a10]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-sm">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <PieChart className="text-indigo-500 shrink-0" size={16} />
                        <h1 className="text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Análisis y Segmentación</h1>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 font-semibold">Tendencias analíticas de consumo, ponderación de ingresos reales, y proyecciones.</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <DateRangePicker value={dateRange} onChange={setDateRange} />
                </div>
            </div>

            {/* Micro KPI grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-155 dark:border-slate-850 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Promedio de Ticket Comprobado</span>
                    <span className="text-xl font-black font-mono text-slate-850 dark:text-slate-100 mt-1">Bs. {averageTicket.toFixed(2)}</span>
                </div>
                <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-155 dark:border-slate-850 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold text-slate-404 uppercase tracking-widest block font-sans">Volumen de Transacciones</span>
                    <span className="text-xl font-black font-mono text-slate-850 dark:text-slate-100 mt-1">{totalTransactions} ventas</span>
                </div>
                <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-155 dark:border-slate-850 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold text-slate-404 uppercase tracking-widest block">Recaudado Acumulado Total</span>
                    <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">Bs. {totalRevenue.toFixed(2)}</span>
                </div>
            </div>

            {/* Main Visualizations Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 1. Daily sales trends line */}
                <div className="lg:col-span-2 bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-150 dark:border-slate-850 p-5 flex flex-col gap-4 shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 pb-2 border-b border-slate-50 dark:border-slate-850/60 block">Tendencia de Ventas Diarias (Bs.)</span>
                    <div className="h-64 w-full mt-2">
                        {salesByDay.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-10 w-full">
                                <Sparkles size={24} className="text-slate-300 dark:text-slate-700 animate-pulse mb-2" />
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Aún no se registran transacciones</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={salesByDay} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenueAnalisis" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis 
                                        dataKey="date" 
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                                    />
                                    <YAxis 
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                                    />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Area 
                                        type="monotone" 
                                        dataKey="total" 
                                        stroke="#6366f1" 
                                        strokeWidth={2.5} 
                                        fillOpacity={1} 
                                        fill="url(#colorRevenueAnalisis)" 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* 2. Interactive payment methods layout with Pie Chart */}
                <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-150 dark:border-slate-850 p-5 flex flex-col gap-4 shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 pb-2 border-b border-slate-50 dark:border-slate-850/60 block">Segmentación de Pago</span>
                    <div className="h-44 w-full flex items-center justify-center relative mt-2">
                        {paymentPieData.length === 0 ? (
                            <div className="text-center text-[10px] text-slate-400 uppercase font-bold tracking-wider">Sin Métodos Registrados</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                    <Pie
                                        data={paymentPieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={65}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {paymentPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomPieTooltip />} />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Compact descriptive metrics bars */}
                    <div className="flex flex-col gap-3.5 mt-2">
                        {/* Cash progress bar */}
                        <div className="flex flex-col gap-1 px-1">
                            <div className="flex justify-between font-bold text-[10px] uppercase text-slate-500">
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Efectivo</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">Bs. {cashTotal.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-[#070c14] h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/20">
                                <div 
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500" 
                                    style={{ width: `${totalRevenue > 0 ? (cashTotal / totalRevenue) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Card progress bar */}
                        <div className="flex flex-col gap-1 px-1">
                            <div className="flex justify-between font-bold text-[10px] uppercase text-slate-505">
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Tarjeta</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">Bs. {cardTotal.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-[#070c14] h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/20">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500" 
                                    style={{ width: `${totalRevenue > 0 ? (cardTotal / totalRevenue) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Transfer progress bar */}
                        <div className="flex flex-col gap-1 px-1">
                            <div className="flex justify-between font-bold text-[10px] uppercase text-slate-505">
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Transferencias</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">Bs. {transferTotal.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-[#070c14] h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/20">
                                <div 
                                    className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-500" 
                                    style={{ width: `${totalRevenue > 0 ? (transferTotal / totalRevenue) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            
            {/* 3. Hourly Sales Distribution (Peak Hours - 3D Interactive) */}
            <div className="mb-2">
                <ThreeDHourlySalesChart 
                    data={hourlySales}
                    exchangeRate={exchangeRate}
                    isAdmin={user?.role === 'admin'}
                    title="Patrón de Ventas por Hora y Horarios Pico"
                    subtitle="Visualización volumétrica 3D interactiva con rotación espacial y zoom táctil"
                />
            </div>

            {/* AI insights and secondary information bento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Insight recommendations bento */}
                {hasPermission(user, 'access_ai') && (
                    <div className="md:col-span-3 bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-150 dark:border-slate-850 p-5 flex flex-col justify-between min-h-[160px] shadow-sm">
                        <div>
                            <div className="flex items-center gap-1.5 pb-2.5 border-b border-slate-100 dark:border-slate-850 text-indigo-500">
                                <Sparkles size={14} className="animate-pulse" />
                                <h3 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-700 dark:text-slate-350">Insights Inteligentes de Negocio (AI Powered)</h3>
                            </div>
                            <ul className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-4 flex flex-col sm:flex-row gap-5 leading-relaxed">
                                <li className="flex gap-2 bg-slate-50/50 dark:bg-[#070b13]/55 p-3 rounded-2xl border border-slate-100 dark:border-slate-850/40 flex-1">
                                    <span className="text-emerald-500 shrink-0 font-bold">✔</span>
                                    <span><strong>Dominancia de Efectivo:</strong> El método de pago físico sigue liderando el volumen total. Te aconsejamos asegurar suficiente reserva de cambio en caja física para evitar demoras en horas pico de facturación.</span>
                                </li>
                                <li className="flex gap-2 bg-slate-50/50 dark:bg-[#070b13]/55 p-3 rounded-2xl border border-slate-100 dark:border-slate-850/40 flex-1">
                                    <span className="text-indigo-500 shrink-0 font-bold">✔</span>
                                    <span><strong>Sugerencia de Rotación:</strong> El flujo transaccional sugiere impulsar el inventario de accesorios de alta frecuencia para elevar la facturación del ticket promedio.</span>
                                </li>
                            </ul>
                        </div>
                        <span className="text-[8px] text-slate-400 font-bold font-mono tracking-wider text-right uppercase mt-4">GTR POS Analytics Engine 2.0</span>
                    </div>
                )}
            </div>
        </div>
    );
}
