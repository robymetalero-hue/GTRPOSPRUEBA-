import { filterAndRankProducts } from "../lib/searchUtils";
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { normalizeProductName } from '../utils/productUtils';
import { useAppContext } from '../context/AppContext';
import { hasPermission } from '../utils/permissions';
import { safeDispatchEvent } from '../utils/events';
import { Plus, Edit, Trash2, ShieldAlert, AlertTriangle, Check, X, Tag, ShoppingBag, Eye, RefreshCw, Camera, ChevronDown, ChevronRight, Maximize2, Search, History, Sparkles, ArrowUpRight, Download, ArrowDownLeft, Clock, User, ClipboardCheck, FileSpreadsheet, DollarSign, Loader2 } from 'lucide-react';
import { Product } from '../types';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import LowStockNotificationSystem from '../components/LowStockNotificationSystem';
import { useElasticScroll } from '../utils/touchScroll';
import PhysicalCountManager from '../components/PhysicalCountManager';
import { TableSkeleton, EmptyState } from '../components/UIStateFeedback';


// --- Optimized Search Input with Live Suggestions ---
const InventorySearchInput = React.memo(({ 
    onSearchChange, 
    onEnter, 
    initialValue, 
    isSearching,
    suggestions = [],
    onSelectSuggestion,
    exchangeRate = 6.96
}: { 
    onSearchChange: (val: string) => void, 
    onEnter: (val: string) => void, 
    initialValue: string, 
    isSearching: boolean,
    suggestions?: Product[],
    onSelectSuggestion?: (prod: Product) => void,
    exchangeRate?: number
}) => {
    const [localVal, setLocalVal] = useState(initialValue);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync with external clear
    useEffect(() => {
        if (initialValue === "") {
            setLocalVal("");
            if (inputRef.current) inputRef.current.value = "";
        }
    }, [initialValue]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleSync = (e: any) => {
            if (e.detail !== undefined) {
                setLocalVal(e.detail);
                if (inputRef.current) {
                    inputRef.current.value = e.detail;
                }
            }
        };
        window.addEventListener('sync-search-input', handleSync);
        return () => window.removeEventListener('sync-search-input', handleSync);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalVal(val);
        setHighlightedIndex(-1);
        setShowSuggestions(val.trim().length > 0);
        onSearchChange(val);
    };

    const handleClear = () => {
        setLocalVal("");
        setShowSuggestions(false);
        onSearchChange("");
        if (inputRef.current) {
            inputRef.current.value = "";
            inputRef.current.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex(prev => (prev + 1) % suggestions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowSuggestions(false);
                return;
            }
            if (e.key === 'Enter' && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                e.preventDefault();
                if (onSelectSuggestion) {
                    onSelectSuggestion(suggestions[highlightedIndex]);
                }
                setShowSuggestions(false);
                return;
            }
        }
        if (e.key === 'Enter') {
            setShowSuggestions(false);
            onEnter(localVal);
        }
    };

    return (
        <div ref={containerRef} className="relative w-full md:w-80 lg:w-96 flex-1 min-w-[240px] shrink-0">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none z-10">
                {isSearching ? (
                    <Loader2 size={16} className="animate-spin text-blue-500" />
                ) : (
                    <Search size={16} />
                )}
            </span>
            <input 
                ref={inputRef}
                type="text" 
                id="search-query-input"
                placeholder="Buscar por nombre, SKU, #ID, marca o categoría..." 
                className="pl-10 pr-9 py-2.5 w-full bg-slate-50 dark:bg-black/15 border border-slate-200 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white text-xs sm:text-sm transition placeholder-slate-400 font-semibold shadow-inner"
                value={localVal}
                onFocus={() => {
                    if (localVal.trim().length > 0) setShowSuggestions(true);
                }}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                spellCheck="false"
            />
            {localVal && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                >
                    <X size={15} />
                </button>
            )}

            {/* Suggestions Floating Dropdown */}
            {showSuggestions && localVal.trim().length > 0 && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#0e1424] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-slate-100/80 dark:bg-slate-850/80 border-b border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <span>Sugerencias ({Math.min(suggestions.length, 8)})</span>
                        <span className="text-[9px] lowercase text-slate-400 font-normal">Click o Enter para seleccionar</span>
                    </div>
                    {suggestions.slice(0, 8).map((prod, idx) => {
                        const priceBs = (prod.price_unit * (exchangeRate || 6.96)).toFixed(2);
                        const isHighlighted = idx === highlightedIndex;
                        return (
                            <div 
                                key={prod.id}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                onClick={() => {
                                    if (onSelectSuggestion) onSelectSuggestion(prod);
                                    setShowSuggestions(false);
                                }}
                                className={`px-3 py-2 flex items-center justify-between cursor-pointer border-b border-slate-100 dark:border-slate-850/60 last:border-0 transition-colors ${
                                    isHighlighted ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                }`}
                            >
                                <div className="min-w-0 flex-1 pr-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                                            {prod.name}
                                        </span>
                                        {prod.category && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-150 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase shrink-0">
                                                {prod.category}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-400">
                                        {prod.sku && <span>SKU: {prod.sku}</span>}
                                        <span className={prod.stock > 0 ? "text-emerald-500 font-semibold" : "text-rose-500 font-bold"}>
                                            Stock: {prod.stock}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                                        Bs. {priceBs}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                        ${prod.price_unit.toFixed(2)} USD
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});

export default function Inventory() {
    const { 
        products, fetchProducts, user, exchangeRate, roundBs, departments, fetchDepartments, view,
        hasMoreProducts, loadMoreProducts
    } = useAppContext();
    const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
    const elasticScroll = useElasticScroll(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isPhysicalCountOpen, setIsPhysicalCountOpen] = useState(false);

    // CSV Bulk Import states
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importBehavior, setImportBehavior] = useState<'update_stock' | 'skip' | 'overwrite'>('update_stock');
    const [importedProducts, setImportedProducts] = useState<any[]>([]);
    const [importError, setImportError] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importSuccessResult, setImportSuccessResult] = useState<any | null>(null);

    // Filter states
    const [selectedCategory, setSelectedCategory] = useState("Todos");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 150);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        fetchProducts(debouncedSearchQuery);
    }, [debouncedSearchQuery]);

    // Form states
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [sku, setSku] = useState("");
    const [stock, setStock] = useState<number | "">(0);
    const [priceUnit, setPriceUnit] = useState<number | "">(0); // Detalle
    const [priceBulk, setPriceBulk] = useState<number | "">(0); // Mayorista
    const [priceCost, setPriceCost] = useState<number | "">(0); // Costo
    const [stockAlarm, setStockAlarm] = useState<number | "">(5);
    const [image, setImage] = useState<string | null>(null);

    // Row expansion & lightbox states
    const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Product History tracking states (Ingresos/Salidas and Registro de Ventas)
    const [selectedHistoryTab, setSelectedHistoryTab] = useState<'todos' | 'ingresos' | 'salidas' | 'precios' | 'cantidades'>('todos');
    const [productStockHistory, setProductStockHistory] = useState<any[]>([]);
    const [productSalesHistory, setProductSalesHistory] = useState<any[]>([]);
    const [productAuditHistory, setProductAuditHistory] = useState<any[]>([]);
    const [loadingHistoryProductId, setLoadingHistoryProductId] = useState<number | null>(null);

    // Modal Stock History States
    const [showStockHistoryModal, setShowStockHistoryModal] = useState(false);
    const [stockHistoryProduct, setStockHistoryProduct] = useState<any | null>(null);
    const [modalAuditHistory, setModalAuditHistory] = useState<any[]>([]);
    const [loadingModalHistory, setLoadingModalHistory] = useState(false);
    const [selectedModalHistoryTab, setSelectedModalHistoryTab] = useState<'todos' | 'ingresos' | 'salidas' | 'precios' | 'cantidades'>('todos');

    const handleOpenStockHistory = async (p: any) => {
        setStockHistoryProduct(p);
        setShowStockHistoryModal(true);
        setLoadingModalHistory(true);
        setSelectedModalHistoryTab('todos');
        try {
            const res = await fetch(`/api/products/${p.id}/audit-history`);
            if (res.ok) {
                const data = await res.json();
                setModalAuditHistory(data);
            } else {
                setModalAuditHistory([]);
            }
        } catch (err) {
            console.error("Error fetching stock history for modal:", err);
            setModalAuditHistory([]);
        } finally {
            setLoadingModalHistory(false);
        }
    };

    const fetchProductHistories = async (productId: number) => {
        setLoadingHistoryProductId(productId);
        try {
            const [stockRes, salesRes, auditRes] = await Promise.all([
                fetch(`/api/products/${productId}/stock-history`),
                fetch(`/api/products/${productId}/sales-history`),
                fetch(`/api/products/${productId}/audit-history`)
            ]);
            if (stockRes.ok) {
                const stockData = await stockRes.json();
                setProductStockHistory(stockData);
            }
            if (salesRes.ok) {
                const salesData = await salesRes.json();
                setProductSalesHistory(salesData);
            }
            if (auditRes.ok) {
                const auditData = await auditRes.json();
                setProductAuditHistory(auditData);
            }
        } catch (e) {
            console.error("Failed to fetch product histories:", e);
        } finally {
            setLoadingHistoryProductId(null);
        }
    };

    useEffect(() => {
        if (expandedProductId) {
            fetchProductHistories(expandedProductId);
            setSelectedHistoryTab('todos');
        } else {
            setProductStockHistory([]);
            setProductSalesHistory([]);
            setProductAuditHistory([]);
        }
    }, [expandedProductId]);

    useEffect(() => {
        const handleInventoryOperation = () => {
            fetchProducts();
            if (expandedProductId) {
                fetchProductHistories(expandedProductId);
            }
            if (showStockHistoryModal && stockHistoryProduct) {
                fetch(`/api/products/${stockHistoryProduct.id}/audit-history`)
                    .then(res => res.ok ? res.json() : [])
                    .then(data => setModalAuditHistory(data))
                    .catch(err => console.error("Error refreshing stock history modal:", err));
            }
        };
        window.addEventListener('inventory_operation', handleInventoryOperation);
        return () => {
            window.removeEventListener('inventory_operation', handleInventoryOperation);
        };
    }, [expandedProductId, showStockHistoryModal, stockHistoryProduct]);

    const renderProductHistoryLogs = (pId: number) => {
        const isLoading = loadingHistoryProductId === pId;

        const logsAll = productAuditHistory;

        const logsIngresos = productAuditHistory.filter(log => 
            ['ingreso_compra', 'ingreso_devolucion', 'ajuste_incremento', 'creacion_producto'].includes(log.type) ||
            (log.type === 'INVENTORY_MANUAL_ADJUSTMENT' && log.quantity_changed > 0)
        );

        const logsSalidas = productAuditHistory.filter(log => 
            ['salida_venta', 'ajuste_decremento'].includes(log.type) ||
            (log.type === 'INVENTORY_MANUAL_ADJUSTMENT' && log.quantity_changed < 0)
        );

        const logsPrecios = productAuditHistory.filter(log => 
            ['cambio_precio', 'cambio_costo'].includes(log.type) ||
            (log.changed_fields && (log.changed_fields.price_unit !== undefined || log.changed_fields.price_bulk !== undefined || log.changed_fields.price_cost !== undefined)) ||
            (log.price_before !== null && log.price_after !== null && log.price_before !== log.price_after)
        );

        const logsCantidades = productAuditHistory.filter(log => 
            ['ajuste_incremento', 'ajuste_decremento', 'INVENTORY_MANUAL_ADJUSTMENT'].includes(log.type) || 
            (log.quantity_before !== null && log.quantity_after !== null && log.quantity_before !== log.quantity_after) ||
            ['ingreso_compra', 'ingreso_devolucion', 'salida_venta', 'creacion_producto'].includes(log.type)
        );

        let filteredLogs: any[] = [];
        if (selectedHistoryTab === 'todos') {
            filteredLogs = logsAll;
        } else if (selectedHistoryTab === 'ingresos') {
            filteredLogs = logsIngresos;
        } else if (selectedHistoryTab === 'salidas') {
            filteredLogs = logsSalidas;
        } else if (selectedHistoryTab === 'precios') {
            filteredLogs = logsPrecios;
        } else if (selectedHistoryTab === 'cantidades') {
            filteredLogs = logsCantidades;
        }

        return (
            <div className="mt-4 p-5 bg-slate-50/70 dark:bg-[#070c14]/40 rounded-3xl border border-slate-200/60 dark:border-slate-850 flex flex-col gap-4 animate-in fade-in duration-200">
                {/* Header and Filter Tabs */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3.5 border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <History size={16} className="text-indigo-500 shrink-0" />
                            <span className="text-xs font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider">
                                Auditoría, Kárdex & Trazabilidad Completa
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">
                            Historial pormenorizado de transacciones, ingresos, salidas y modificaciones de precios.
                        </p>
                    </div>

                    {/* Filter Segmented Pills */}
                    <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-800/80">
                        <button
                            type="button"
                            onClick={() => setSelectedHistoryTab('todos')}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                selectedHistoryTab === 'todos'
                                    ? 'bg-white dark:bg-[#12192d] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/20'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                            }`}
                        >
                            Todos ({logsAll.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedHistoryTab('ingresos')}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                selectedHistoryTab === 'ingresos'
                                    ? 'bg-white dark:bg-[#12192d] text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/20'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                            }`}
                        >
                            Ingresos ({logsIngresos.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedHistoryTab('salidas')}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                selectedHistoryTab === 'salidas'
                                    ? 'bg-white dark:bg-[#12192d] text-amber-600 dark:text-amber-400 shadow-sm border border-slate-200/20'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                            }`}
                        >
                            Salidas ({logsSalidas.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedHistoryTab('precios')}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                selectedHistoryTab === 'precios'
                                    ? 'bg-white dark:bg-[#12192d] text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200/20'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                            }`}
                        >
                            Precios/Costos ({logsPrecios.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedHistoryTab('cantidades')}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                selectedHistoryTab === 'cantidades'
                                    ? 'bg-white dark:bg-[#12192d] text-pink-600 dark:text-pink-400 shadow-sm border border-slate-200/20'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                            }`}
                        >
                            Cantidades ({logsCantidades.length})
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2.5">
                        <RefreshCw size={22} className="text-indigo-500 animate-spin" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Recuperando trazabilidad del kárdex...
                        </span>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-[9.5px] font-black uppercase tracking-wider bg-white dark:bg-[#080d16]/30 border border-dashed border-slate-200 dark:border-slate-850 p-6 rounded-2xl">
                        No se encontraron registros de movimiento de tipo &ldquo;{selectedHistoryTab}&rdquo; para este producto.
                    </div>
                ) : (
                    <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
                        {filteredLogs.map((log) => {
                            // Identify action type and styles
                            let actionLabel = 'Modificación de Producto';
                            let actionBadgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-850/80 dark:text-slate-300';
                            let iconEl = <Tag size={13} />;
                            let sideDiffText = '';
                            let sideDiffClass = 'text-slate-500';

                            if (log.type === 'ingreso_compra') {
                                actionLabel = 'Compra de Existencias';
                                actionBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 border border-emerald-500/20';
                                iconEl = <ArrowDownLeft size={13} />;
                                sideDiffText = `+${log.quantity} pz`;
                                sideDiffClass = 'text-emerald-600 dark:text-emerald-400';
                            } else if (log.type === 'ingreso_devolucion') {
                                actionLabel = 'Devolución de Cliente';
                                actionBadgeClass = 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/5 dark:text-teal-400 border border-teal-500/20';
                                iconEl = <RefreshCw size={13} />;
                                sideDiffText = `+${log.quantity} pz`;
                                sideDiffClass = 'text-teal-600 dark:text-teal-400';
                            } else if (log.type === 'ajuste_incremento') {
                                actionLabel = 'Ajuste de Inventario (+)';
                                actionBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 border border-emerald-500/20';
                                iconEl = <ArrowDownLeft size={13} />;
                                sideDiffText = `+${log.quantity} pz`;
                                sideDiffClass = 'text-emerald-600 dark:text-emerald-400';
                            } else if (log.type === 'ajuste_decremento') {
                                actionLabel = 'Ajuste de Inventario (-)';
                                actionBadgeClass = 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/5 dark:text-amber-400 border border-amber-500/20';
                                iconEl = <ArrowUpRight size={13} />;
                                sideDiffText = `-${log.quantity} pz`;
                                sideDiffClass = 'text-amber-600 dark:text-amber-400';
                            } else if (log.type === 'salida_venta') {
                                actionLabel = 'Venta Realizada';
                                actionBadgeClass = 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/5 dark:text-indigo-400 border border-indigo-500/20';
                                iconEl = <ShoppingBag size={13} />;
                                sideDiffText = `-${log.quantity} pz`;
                                sideDiffClass = 'text-indigo-600 dark:text-indigo-400 font-bold';
                            } else if (log.type === 'cambio_precio') {
                                actionLabel = 'Cambio de Precio de Venta';
                                actionBadgeClass = 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/5 dark:text-cyan-400 border border-cyan-500/20';
                                iconEl = <DollarSign size={13} />;
                            } else if (log.type === 'cambio_costo') {
                                actionLabel = 'Ajuste de Costo de Compra';
                                actionBadgeClass = 'bg-pink-500/10 text-pink-600 dark:bg-pink-500/5 dark:text-pink-400 border border-pink-500/20';
                                iconEl = <DollarSign size={13} />;
                            }

                            // Extract changes from before/after if we have them
                            const hasPriceUnitChange = log.price_before !== null && log.price_after !== null && log.price_before !== log.price_after;
                            const beforeFields = log.changed_fields;

                            return (
                                <div 
                                    key={log.id}
                                    className="flex flex-col sm:flex-row sm:items-start justify-between p-4 bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-150 dark:border-slate-850/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-800 transition-all duration-150 gap-3"
                                >
                                    <div className="flex items-start gap-3.5 flex-1">
                                        <div className={`p-2 rounded-xl shrink-0 ${actionBadgeClass}`}>
                                            {iconEl}
                                        </div>

                                        <div className="flex flex-col flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[10px] font-black text-slate-850 dark:text-slate-150 uppercase tracking-wide leading-none">
                                                    {actionLabel}
                                                </span>
                                                {log.reference && (
                                                    <span className="font-mono text-[8px] bg-slate-100 dark:bg-slate-850 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 font-bold">
                                                        {log.reference}
                                                    </span>
                                                )}
                                                {log.type === 'salida_venta' && log.reference && (
                                                    <button 
                                                        onClick={() => handleOpenTicketTrace(log.reference)}
                                                        className="py-0.5 px-2 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-[8.5px] font-black text-white rounded-lg cursor-pointer flex items-center gap-1 uppercase transition-all shadow-xs border border-emerald-600/10"
                                                        title="Haga clic para ver el ticket completo y los otros productos vendidos en el mismo"
                                                    >
                                                        Rastrear Ticket <Eye size={11} />
                                                    </button>
                                                )}
                                            </div>

                                            <p className="text-[9.5px] text-slate-600 dark:text-slate-350 font-bold mt-1.5">
                                                {log.notes || 'Movimiento de almacén registrado en sistema.'}
                                            </p>

                                            {/* Stock levels and differentials before vs after */}
                                            {log.quantity_before !== null && log.quantity_after !== null && (
                                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[8.5px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#070c14]/40 p-2 rounded-xl border border-slate-100 dark:border-slate-850/40 w-fit">
                                                    <span>Existencia Antes: <span className="font-mono font-black text-slate-800 dark:text-slate-200">{log.quantity_before} pz</span></span>
                                                    <span className="text-slate-300 dark:text-slate-750">→</span>
                                                    <span>Existencia Después: <span className="font-mono font-black text-slate-800 dark:text-slate-200">{log.quantity_after} pz</span></span>
                                                    <span className="text-slate-350 dark:text-slate-750">•</span>
                                                    <span className={`font-mono font-black ${log.quantity_after >= log.quantity_before ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                        Diferencia: {log.quantity_after - log.quantity_before > 0 ? '+' : ''}{log.quantity_after - log.quantity_before} pz
                                                    </span>
                                                </div>
                                            )}

                                            {/* Granular Price and Cost changes (Very Detailed) */}
                                            {(hasPriceUnitChange || beforeFields) && (
                                                <div className="mt-2 flex flex-col gap-1 bg-cyan-50/20 dark:bg-cyan-950/10 border border-cyan-100/40 dark:border-cyan-950/40 p-2 rounded-xl text-[8.5px] font-bold w-fit text-slate-600 dark:text-slate-300">
                                                    <span className="text-[7.5px] uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-black">Histórico de Alteración Monetaria:</span>
                                                    
                                                    {/* Unit Price Change */}
                                                    {((beforeFields?.price_unit) || (log.price_before !== null && log.price_after !== null && log.type === 'cambio_precio')) && (
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            <span>P. Unitario:</span>
                                                            <span className="font-mono line-through text-slate-400">
                                                                ${(beforeFields?.price_unit?.before ?? log.price_before ?? 0).toFixed(2)} USD
                                                            </span>
                                                            <span className="text-slate-300">→</span>
                                                            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-extrabold">
                                                                ${(beforeFields?.price_unit?.after ?? log.price_after ?? 0).toFixed(2)} USD
                                                            </span>
                                                            {exchangeRate && (
                                                                <span className="text-[8px] text-slate-400 font-medium">
                                                                    (Bs. {((beforeFields?.price_unit?.before ?? log.price_before ?? 0) * exchangeRate).toFixed(2)} → Bs. {((beforeFields?.price_unit?.after ?? log.price_after ?? 0) * exchangeRate).toFixed(2)})
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Cost Price Change */}
                                                    {beforeFields?.price_cost && (
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            <span>Costo Compra:</span>
                                                            <span className="font-mono line-through text-slate-400">
                                                                ${beforeFields.price_cost.before.toFixed(2)} USD
                                                            </span>
                                                            <span className="text-slate-300">→</span>
                                                            <span className="font-mono text-pink-600 dark:text-pink-400 font-extrabold">
                                                                ${beforeFields.price_cost.after.toFixed(2)} USD
                                                            </span>
                                                            {exchangeRate && (
                                                                <span className="text-[8px] text-slate-400 font-medium">
                                                                    (Bs. {(beforeFields.price_cost.before * exchangeRate).toFixed(2)} → Bs. {(beforeFields.price_cost.after * exchangeRate).toFixed(2)})
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Bulk Price Change */}
                                                    {beforeFields?.price_bulk && (
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            <span>P. Mayoreo:</span>
                                                            <span className="font-mono line-through text-slate-400">
                                                                ${beforeFields.price_bulk.before.toFixed(2)} USD
                                                            </span>
                                                            <span className="text-slate-300">→</span>
                                                            <span className="font-mono text-violet-600 dark:text-violet-400 font-extrabold">
                                                                ${beforeFields.price_bulk.after.toFixed(2)} USD
                                                            </span>
                                                            {exchangeRate && (
                                                                <span className="text-[8px] text-slate-400 font-medium">
                                                                    (Bs. {(beforeFields.price_bulk.before * exchangeRate).toFixed(2)} → Bs. {(beforeFields.price_bulk.after * exchangeRate).toFixed(2)})
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap sm:items-center gap-x-2.5 gap-y-1 text-[8px] text-slate-400 font-bold mt-2 border-t border-slate-100 dark:border-slate-850/60 pt-2">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={8.5} className="shrink-0" /> {new Date(log.created_at).toLocaleString()}
                                                </span>
                                                <span className="hidden sm:inline text-slate-300 dark:text-slate-750">•</span>
                                                <span className="flex items-center gap-1 uppercase">
                                                    <User size={8.5} className="shrink-0" /> {log.username || 'admin'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sidebar Differential (Transactions column) */}
                                    {sideDiffText && (
                                        <div className="flex flex-col items-end shrink-0 pl-1">
                                            <span className={`text-[11px] font-black font-mono ${sideDiffClass}`}>
                                                {sideDiffText}
                                            </span>
                                            <span className="text-[8px] text-slate-400 dark:text-slate-500 font-mono font-bold mt-0.5">
                                                Valuado: {log.price !== undefined ? `$${(log.price || 0).toFixed(2)}` : 'N/A'}
                                            </span>
                                            {exchangeRate && log.price !== undefined && (
                                                <span className="text-[7.5px] text-slate-400 font-mono mt-0.5 font-semibold">
                                                    (Bs. {((log.price || 0) * exchangeRate).toFixed(2)})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // Ticket Tracer / Detail Modal States
    const [traceTicketId, setTraceTicketId] = useState<number | null>(null);
    const [traceTicketDetails, setTraceTicketDetails] = useState<any | null>(null);
    const [traceTicketItems, setTraceTicketItems] = useState<any[]>([]);
    const [loadingTraceTicket, setLoadingTraceTicket] = useState(false);
    const [showTraceTicketModal, setShowTraceTicketModal] = useState(false);

    const handleOpenTicketTrace = async (reference: string) => {
        const match = reference.match(/#\s*(\d+)/);
        if (!match) return;
        const saleId = parseInt(match[1]);
        if (isNaN(saleId)) return;

        setTraceTicketId(saleId);
        setLoadingTraceTicket(true);
        setShowTraceTicketModal(true);
        try {
            const saleRes = await fetch(`/api/sales/${saleId}`);
            if (saleRes.ok) {
                const saleData = await saleRes.json();
                setTraceTicketDetails(saleData);
            } else {
                setTraceTicketDetails(null);
            }

            const itemsRes = await fetch(`/api/sales/${saleId}/items`);
            if (itemsRes.ok) {
                const itemsData = await itemsRes.json();
                setTraceTicketItems(itemsData);
            } else {
                setTraceTicketItems([]);
            }
        } catch (err) {
            console.error("Error fetching ticket trace details:", err);
            showNotification("Fallo al conectar para recuperar los detalles del ticket.", "error");
        } finally {
            setLoadingTraceTicket(false);
        }
    };

    // SKU Camera scanner states
    const [isSkuScannerOpen, setIsSkuScannerOpen] = useState(false);
    const [skuScannerError, setSkuScannerError] = useState<string | null>(null);
    const [skuCameras, setSkuCameras] = useState<Array<{ id: string; label: string }>>([]);
    const [selectedSkuCameraId, setSelectedSkuCameraId] = useState<string>("");
    const skuHtml5QrcodeRef = useRef<Html5Qrcode | null>(null);

    // Quick Stock Entry Modal States
    const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
    const [stockInSearch, setStockInSearch] = useState("");
    const [stockInSearchResults, setStockInSearchResults] = useState<Product[]>([]);
    const [isSearchingStockIn, setIsSearchingStockIn] = useState(false);
    const [selectedProductForStockIn, setSelectedProductForStockIn] = useState<Product | null>(null);
    const [stockInQuantity, setStockInQuantity] = useState<number | "">("");
    const [keepSameCost, setKeepSameCost] = useState(true);
    const [newCostPrice, setNewCostPrice] = useState<number | "">("");
    const [isSubmittingStockIn, setIsSubmittingStockIn] = useState(false);
    const [arrivalHistory, setArrivalHistory] = useState<any[]>([]);
    const [activeModalTab, setActiveModalTab] = useState<'form' | 'history'>('form');

    useEffect(() => {
        if (!stockInSearch.trim() || selectedProductForStockIn) {
            setStockInSearchResults([]);
            setIsSearchingStockIn(false);
            return;
        }

        const query = stockInSearch.trim();
        setIsSearchingStockIn(true);

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/products?search=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    const fetched: Product[] = Array.isArray(data) ? data : (Array.isArray(data.products) ? data.products : []);
                    setStockInSearchResults(fetched);
                }
            } catch (e) {
                console.error("Error searching products for stock-in modal:", e);
            } finally {
                setIsSearchingStockIn(false);
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [stockInSearch, selectedProductForStockIn]);

    const loadArrivalHistory = async () => {
        try {
            const res = await fetch('/api/stock-arrivals');
            if (res.ok) {
                const data = await res.json();
                setArrivalHistory(data);
            }
        } catch (e) {
            console.error("Failed to load arrivals history:", e);
        }
    };

    const handleSaveStockIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProductForStockIn || !stockInQuantity || stockInQuantity <= 0) {
            showNotification("Por favor selecciona un producto y pon una cantidad válida.", "error");
            return;
        }

        setIsSubmittingStockIn(true);
        const finalCost = keepSameCost 
            ? (selectedProductForStockIn.price_cost || 0) 
            : Number(newCostPrice || 0);

        try {
            const res = await fetch('/api/stock-arrivals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: selectedProductForStockIn.id,
                    quantity: Number(stockInQuantity),
                    arrival_price: finalCost
                })
            });

            if (res.ok) {
                showNotification(`✓ Agregadas ${stockInQuantity} unidades al stock de "${selectedProductForStockIn.name}"`, "success");
                
                // Dispatch global inventory operation event
                safeDispatchEvent('inventory_operation', {
                    detail: {
                        type: 'stock_in',
                        id: selectedProductForStockIn.id,
                        user: user?.username || 'admin',
                        timestamp: new Date().toISOString()
                    }
                });

                // Reset form values
                setStockInSearch("");
                setSelectedProductForStockIn(null);
                setStockInQuantity("");
                setKeepSameCost(true);
                setNewCostPrice("");
                
                // Refresh records
                fetchProducts();
                loadArrivalHistory();
            } else {
                const err = await res.json();
                showNotification(`Error: ${err.error}`, "error");
            }
        } catch (err) {
            console.error(err);
            showNotification("Fallo al contactar al servidor para ingresar stock.", "error");
        } finally {
            setIsSubmittingStockIn(false);
        }
    };

    useEffect(() => {
        if (isStockInModalOpen) {
            loadArrivalHistory();
        }
    }, [isStockInModalOpen]);

    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => {
            setNotification(null);
        }, 4000);
    };

    const handleCSVSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split(/\r?\n/);
                if (lines.length < 2) {
                    setImportError("El archivo CSV está vacío o no contiene suficientes filas.");
                    return;
                }

                // Detect headers: name, sku, category, stock, price_unit, price_bulk, price_cost, stock_alarm
                const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase().replace(/"/g, ''));
                
                const parsed: any[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    // Match commas or semicolons but ignore inside quotes
                    const values = line.split(/[;,]/).map(v => v.trim().replace(/^"|"$/g, ''));
                    
                    const item: any = {};
                    headers.forEach((header, index) => {
                        const val = values[index];
                        if (header === 'name' || header === 'nombre') item.name = val;
                        else if (header === 'sku' || header === 'código') item.sku = val;
                        else if (header === 'category' || header === 'categoría') item.category = val;
                        else if (header === 'stock' || header === 'inventario') item.stock = Number(val || 0);
                        else if (header === 'price_unit' || header === 'precio_unitario' || header === 'unit') item.price_unit = Number(val || 0);
                        else if (header === 'price_bulk' || header === 'precio_mayor' || header === 'bulk') item.price_bulk = Number(val || 0);
                        else if (header === 'price_cost' || header === 'costo' || header === 'cost') item.price_cost = Number(val || 0);
                        else if (header === 'stock_alarm' || header === 'mínimo' || header === 'alarm') item.stock_alarm = Number(val || 0);
                    });

                    // Auto-generate some safe fallbacks if name/sku present
                    if (item.name || item.sku) {
                        if (!item.name) item.name = "Artículo sin nombre";
                        if (!item.sku) item.sku = "AUTO-" + Math.floor(Math.random() * 1000000);
                        if (!item.category) item.category = "Varios";
                        parsed.push(item);
                    }
                }

                if (parsed.length === 0) {
                    setImportError("No se pudieron extraer artículos del archivo. Verifique el formato.");
                } else {
                    setImportError(null);
                    setImportedProducts(parsed);
                }
            } catch (err: any) {
                setImportError("Error al analizar el archivo: " + err.message);
            }
        };
        reader.readAsText(file);
    };

    const executeBulkImport = async () => {
        if (importedProducts.length === 0) return;
        setIsImporting(true);
        setImportError(null);

        try {
            const res = await fetch('/api/products/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': user?.role || '',
                    'x-user-id': String(user?.id || ''),
                    'x-user-permissions': JSON.stringify(user?.permissions || {})
                },
                body: JSON.stringify({
                    products: importedProducts,
                    behavior: importBehavior
                })
            });

            if (res.ok) {
                const data = await res.json();
                setImportSuccessResult(data);
                showNotification(`✓ Importación completada: ${data.inserted} creados, ${data.updated} actualizados, ${data.skipped} omitidos.`, "success");
                
                // Dispatch global inventory operation event
                safeDispatchEvent('inventory_operation', {
                    detail: {
                        type: 'bulk_import',
                        user: user?.username || 'admin',
                        timestamp: new Date().toISOString()
                    }
                });

                fetchProducts(); // Refresh general inventory list
            } else {
                const err = await res.json();
                setImportError(err.error || "Fallo al realizar la importación masiva.");
            }
        } catch (err: any) {
            console.error(err);
            setImportError("Error de comunicación de red: " + err.message);
        } finally {
            setIsImporting(false);
        }
    };

    const downloadInventoryCSV = () => {
        if (!user || user.role !== 'admin') {
            showNotification("Acceso denegado: Solo los administradores pueden descargar reportes de inventario.", "error");
            return;
        }

        if (!products || products.length === 0) {
            showNotification("No hay productos registrados en el inventario para exportar.", "error");
            return;
        }

        const escapeCSV = (val: any) => {
            if (val === null || val === undefined) return '';
            let str = String(val);
            str = str.replace(/"/g, '""');
            if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                return `"${str}"`;
            }
            return str;
        };

        const headers = [
            'ID',
            'Nombre',
            'SKU',
            'Categoría',
            'Stock Actual (pz)',
            'Alerta de Stock Mínimo',
            'Precio Costo (USD)',
            'Precio Costo (Bs.)',
            'Precio Detalle (USD)',
            'Precio Detalle (Bs.)',
            'Precio Mayorista (USD)',
            'Precio Mayorista (Bs.)',
            'Valorización Costo Total (USD)',
            'Valorización Costo Total (Bs.)'
        ];

        const rows = products.map(p => {
            const costUSD = Number(p.price_cost) || 0;
            const costBs = roundBs(costUSD * exchangeRate);
            const unitUSD = Number(p.price_unit) || 0;
            const unitBs = roundBs(unitUSD * exchangeRate);
            const bulkUSD = Number(p.price_bulk) || 0;
            const bulkBs = roundBs(bulkUSD * exchangeRate);
            const stockVal = Number(p.stock) || 0;

            const totalValCostUSD = costUSD * stockVal;
            const totalValCostBs = costBs * stockVal;

            return [
                p.id,
                p.name,
                p.sku || '',
                p.category || '',
                p.stock,
                p.stock_alarm,
                costUSD.toFixed(2),
                costBs.toFixed(2),
                unitUSD.toFixed(2),
                unitBs.toFixed(2),
                bulkUSD.toFixed(2),
                bulkBs.toFixed(2),
                totalValCostUSD.toFixed(2),
                totalValCostBs.toFixed(2)
            ].map(escapeCSV);
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        try {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const dateStr = new Date().toISOString().slice(0, 10);
            link.setAttribute('href', url);
            link.setAttribute('download', `reporte_inventario_${dateStr}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification("✓ Reporte de inventario CSV descargado correctamente.", "success");
        } catch (e) {
            console.error("Error generating CSV:", e);
            showNotification("Error al generar o descargar el reporte CSV.", "error");
        }
    };

    useEffect(() => {
        fetchProducts();
        fetchDepartments();
    }, []);

    useEffect(() => {
        const handleSearchSku = (e: any) => {
            if (e.detail) {
                setSearchQuery(e.detail);
                setDebouncedSearchQuery(e.detail);
                window.dispatchEvent(new CustomEvent('sync-search-input', { detail: e.detail }));
                const filterEl = document.getElementById("search-query-input") as HTMLInputElement;
                if (filterEl) {
                    filterEl.scrollIntoView({ behavior: "smooth" });
                    filterEl.focus();
                }
            }
        };
        window.addEventListener('search-inventory-sku', handleSearchSku);
        return () => {
            window.removeEventListener('search-inventory-sku', handleSearchSku);
        };
    }, []);

    // Manage camera lists & start/stop for SKU scanner
    useEffect(() => {
        if (!isSkuScannerOpen) {
            if (skuHtml5QrcodeRef.current) {
                skuHtml5QrcodeRef.current.stop().catch(err => console.log("Stop error:", err));
                skuHtml5QrcodeRef.current = null;
            }
            return;
        }

        const getCameras = async () => {
            setSkuScannerError(null);
            try {
                const devices = await Html5Qrcode.getCameras();
                if (devices.length > 0) {
                    setSkuCameras(devices);
                    const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('entera') || d.label.toLowerCase().includes('environment') || d.label.toLowerCase().includes('trasera'));
                    setSelectedSkuCameraId(backCamera ? backCamera.id : devices[0].id);
                } else {
                    const navDevices = await navigator.mediaDevices.enumerateDevices();
                    const video = navDevices.filter(d => d.kind === 'videoinput');
                    if (video.length > 0) {
                        const formatted = video.map(v => ({ id: v.deviceId, label: v.label || `Cámara ${v.deviceId.slice(0, 5)}` }));
                        setSkuCameras(formatted);
                        const backCamera = formatted.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('entera') || d.label.toLowerCase().includes('environment') || d.label.toLowerCase().includes('trasera'));
                        setSelectedSkuCameraId(backCamera ? backCamera.id : formatted[0].id);
                    } else {
                        setSkuScannerError("No se detectaron recursos de video/cámara.");
                    }
                }
            } catch (err) {
                console.warn("Could not list cameras:", err);
                setSkuScannerError("No se encontraron cámaras o falta permiso de uso.");
            }
        };

        getCameras();
    }, [isSkuScannerOpen]);

    // Initialize scanner inside the viewpoint
    useEffect(() => {
        if (!isSkuScannerOpen || !selectedSkuCameraId || skuScannerError) return;

        let active = true;
        const start = async () => {
            try {
                if (skuHtml5QrcodeRef.current) {
                    try { await skuHtml5QrcodeRef.current.stop(); } catch (e) {}
                }
                const scanner = new Html5Qrcode("sku-scanner-viewfinder", {
                    verbose: false,
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.QR_CODE
                    ],
                    useBarCodeDetectorIfSupported: true
                });
                skuHtml5QrcodeRef.current = scanner;
                await scanner.start(
                    selectedSkuCameraId,
                    {
                        fps: 30, // Faster scanning tick
                        qrbox: { width: 320, height: 130 }, // Optimized wide landscape ratio for 1D barcodes
                        videoConstraints: {
                            deviceId: selectedSkuCameraId ? { exact: selectedSkuCameraId } : undefined,
                            width: { ideal: 1280, max: 1920 }, // 720p is the sweet spot for fast decode latency
                            height: { ideal: 720, max: 1080 },
                            focusMode: { ideal: "continuous" },
                            advanced: [
                                { focusMode: { exact: "continuous" } } as any,
                                { focusMode: "continuous" } as any
                            ]
                        } as any
                    },
                    (decodedText) => {
                        if (active) {
                            setSku(decodedText.trim());
                            setIsSkuScannerOpen(false);
                            // Visual / Sound cue feedback
                            try {
                                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                                const osc = audioCtx.createOscillator();
                                const gain = audioCtx.createGain();
                                osc.connect(gain);
                                gain.connect(audioCtx.destination);
                                osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
                                gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
                                osc.start();
                                osc.stop(audioCtx.currentTime + 0.1);
                            } catch (e) {}
                            showNotification("✓ Código SKU capturado correctamente.", "success");
                        }
                    },
                    () => {}
                );

                // Apply continuous focus track hooks as well
                setTimeout(() => {
                    try {
                        const videoElem = document.querySelector("#sku-scanner-viewfinder video") as HTMLVideoElement;
                        if (videoElem) {
                            videoElem.setAttribute("autoplay", "true");
                            videoElem.setAttribute("playsinline", "true");
                            const stream = videoElem.srcObject as MediaStream;
                            const track = stream?.getVideoTracks()[0];
                            if (track) {
                                const capabilities = track.getCapabilities() as any;
                                const constraints = {} as any;

                                if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
                                    constraints.focusMode = "continuous";
                                }
                                if (capabilities.zoom) {
                                    constraints.zoom = Math.min(capabilities.zoom.max || 1, 1.25);
                                }

                                if (Object.keys(constraints).length > 0) {
                                    track.applyConstraints(constraints)
                                        .then(() => console.log("Inventory camera autofocus & zoom applied:", constraints))
                                        .catch((err) => console.warn("Failed settings advanced zoom/focus on inventory camera:", err));
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Inventory autofocus hook skipped:", e);
                    }
                }, 500);
            } catch (e) {
                console.error("Camera start failed:", e);
                setSkuScannerError("Fallo al iniciar visor de cámara. Asegúrate de otorgar permisos.");
            }
        };

        // Small delay to ensure container element is mounted
        const timer = setTimeout(() => {
            start();
        }, 150);

        return () => {
            active = false;
            clearTimeout(timer);
            if (skuHtml5QrcodeRef.current) {
                skuHtml5QrcodeRef.current.stop().catch(err => console.log("Cleanup stop error:", err));
                skuHtml5QrcodeRef.current = null;
            }
        };
    }, [isSkuScannerOpen, selectedSkuCameraId]);

    // Duplicate Protection & Idempotency States
    const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
    const [clientOpId, setClientOpId] = useState<string>('');
    const [duplicateModalData, setDuplicateModalData] = useState<{ warning: string; existingProduct: any; payload: any } | null>(null);

    // Read-Only Duplicate Diagnostic States
    const [isDiagnoseModalOpen, setIsDiagnoseModalOpen] = useState(false);
    const [diagnoseLoading, setDiagnoseLoading] = useState(false);
    const [diagnoseData, setDiagnoseData] = useState<any | null>(null);

    // Real-time similar products calculation
    const similarProducts = useMemo(() => {
        if (!isFormOpen || editingProduct || !name.trim()) return [];
        const normTyped = normalizeProductName(name);
        if (normTyped.length < 2) return [];
        return products.filter(p => normalizeProductName(p.name) === normTyped || normalizeProductName(p.name).includes(normTyped)).slice(0, 4);
    }, [isFormOpen, editingProduct, name, products]);

    const runDuplicatesDiagnose = async () => {
        setIsDiagnoseModalOpen(true);
        setDiagnoseLoading(true);
        try {
            const res = await fetch('/api/products/diagnose-duplicates');
            const data = await res.json();
            if (res.ok) {
                setDiagnoseData(data);
            } else {
                showNotification("Error al ejecutar diagnóstico: " + (data.error || ''), "error");
            }
        } catch (err: any) {
            console.error(err);
            showNotification("Error de conexión al obtener diagnóstico.", "error");
        } finally {
            setDiagnoseLoading(false);
        }
    };

    const openCreateForm = () => {
        setEditingProduct(null);
        setName("");
        setCategory("");
        setSku("");
        setStock(10);
        setPriceUnit(1.0);
        setPriceBulk(0.8);
        setPriceCost(0.5);
        setStockAlarm(5);
        setImage(null);
        const newOpId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'prod-op-' + Date.now() + '-' + Math.random().toString(36).substring(2);
        setClientOpId(newOpId);
        setIsSubmittingProduct(false);
        setDuplicateModalData(null);
        setIsFormOpen(true);
    };

    const openEditForm = (p: Product) => {
        setEditingProduct(p);
        setName(p.name);
        setCategory(p.category);
        setSku(p.sku);
        setStock(p.stock);
        setPriceUnit(p.price_unit);
        setPriceBulk(p.price_bulk);
        setPriceCost(p.price_cost || 0);
        setStockAlarm(p.stock_alarm);
        setImage(p.image || null);
        setIsFormOpen(true);
    };

    const handleSave = async (e: React.FormEvent, forceCreateOverride = false) => {
        if (e && e.preventDefault) e.preventDefault();
        if (isSubmittingProduct) return;
        
        if (!name.trim() || !sku.trim() || !category.trim()) {
            showNotification("Por favor completa los campos requeridos: Nombre, Categoría y SKU.", "error");
            return;
        }

        setIsSubmittingProduct(true);

        const activeOpId = clientOpId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'prod-op-' + Date.now() + '-' + Math.random().toString(36).substring(2));

        const payload = {
            name: name.trim(),
            category: category.trim(),
            sku: sku.trim(),
            stock: Number(stock),
            price_unit: Number(priceUnit),
            price_bulk: Number(priceBulk),
            price_cost: Number(priceCost),
            stock_alarm: Number(stockAlarm),
            image,
            clientOperationId: activeOpId,
            forceCreate: forceCreateOverride
        };

        try {
            let res;
            if (editingProduct) {
                res = await fetch(`/api/products/${editingProduct.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await res.json();

            if (res.ok) {
                showNotification(`✓ Producto "${name.trim()}" guardado exitosamente en stock.`, "success");
                
                // Dispatch global inventory operation event
                safeDispatchEvent('inventory_operation', {
                    detail: {
                        type: editingProduct ? 'adjustment' : 'creation',
                        id: editingProduct ? editingProduct.id : data.id,
                        user: user?.username || 'admin',
                        timestamp: new Date().toISOString()
                    }
                });

                setIsFormOpen(false);
                setDuplicateModalData(null);
                fetchProducts();
            } else {
                if (data.duplicateWarning && data.existingProduct) {
                    setDuplicateModalData({
                        warning: data.error,
                        existingProduct: data.existingProduct,
                        payload
                    });
                } else if (data.existingProduct) {
                    showNotification(`⚠️ SKU Duplicado: ${data.error}`, "error");
                } else {
                    showNotification(`Error: ${data.error || 'Ocurrió un problema al guardar'}`, "error");
                }
            }
        } catch (e: any) {
            console.error(e);
            showNotification("Error de conexión al guardar producto.", "error");
        } finally {
            setIsSubmittingProduct(false);
        }
    };

    const handleDelete = async (id: number, prodName: string) => {
        if (!window.confirm(`¿Estás completamente seguro de eliminar "${prodName}" de los registros? Esta acción no se puede deshacer.`)) return;
        try {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showNotification("Producto eliminado del inventario con éxito.", "success");
                
                // Dispatch global inventory operation event
                safeDispatchEvent('inventory_operation', {
                    detail: {
                        type: 'deletion',
                        id,
                        user: user?.username || 'admin',
                        timestamp: new Date().toISOString()
                    }
                });

                fetchProducts();
            } else {
                const err = await res.json().catch(() => ({}));
                showNotification(`No se pudo eliminar el producto: ${err.error || "No posees los niveles de acceso requeridos."}`, "error");
            }
        } catch (e) {
            console.error(e);
            showNotification("Fallo al conectar con el servidor de base de datos.", "error");
        }
    };

    // Derive unique categories from products with memoization
    const categoriesList = React.useMemo(() => {
        const list = ["Todos", ...Array.from(new Set(products.map(p => p.category || "General")))];
        const hasLowStock = products.some(p => p.stock <= p.stock_alarm);
        if (hasLowStock) {
            list.push("⚠️ Bajo Stock");
        }
        return list;
    }, [products]);

    // Filtered list of products for main table with memoization
    const finalFilteredProducts = React.useMemo(() => {
        const query = debouncedSearchQuery.toLowerCase().trim();
        const cat = selectedCategory;
        const baseFiltered = products.filter(p => {
            let matchesCategory = false;
            if (cat === "Todos") {
                matchesCategory = true;
            } else if (cat === "⚠️ Bajo Stock") {
                matchesCategory = p.stock <= p.stock_alarm;
            } else {
                matchesCategory = (p.category || "General") === cat;
            }
            return matchesCategory;
        });
        return filterAndRankProducts(baseFiltered, query);
    }, [products, debouncedSearchQuery, selectedCategory]);

    return (
        <div 
            className="p-5 md:p-6 overflow-y-auto h-full flex flex-col gap-5 select-none bg-[#f8fafc]/40 dark:bg-[#070a10] touch-momentum"
            style={elasticScroll.style}
            {...elasticScroll.touchHandlers}
        >
            
            {/* Elegant fading notifications */}
            {notification && (
                <div id="inv-toast" className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-xs font-bold transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
                    notification.type === 'success' 
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-550/10' 
                        : 'bg-rose-600 border-rose-500 text-white shadow-rose-550/10'
                }`}>
                    <span className="text-sm">{notification.type === 'success' ? '✓' : '⚠️'}</span>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Header portion */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/60 dark:border-slate-850/40 gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        {view === 'productos' ? (
                            <Tag className="text-blue-500 shrink-0" size={16} />
                        ) : (
                            <ClipboardCheck className="text-indigo-500 shrink-0" size={16} />
                        )}
                        <h1 className="text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                            {view === 'productos' ? 'Catálogo de Productos' : 'Control de Almacén e Inventario'}
                        </h1>
                    </div>
                    <p className="text-[11px] text-slate-404 mt-1.5 font-semibold">
                        {view === 'productos' 
                            ? 'Gestiona la lista oficial de productos, SKUs, imágenes, categorías, costos and precios de venta.'
                            : 'Monitorea las existencias en tiempo real, registra entradas o salidas de stock y realiza conteos físicos.'}
                    </p>
                </div>
                {hasPermission(user, 'view_inventory') ? (
                    <div className="flex gap-2.5 flex-wrap">
                        {view === 'productos' ? (
                            <>
                                <button 
                                    onClick={openCreateForm}
                                    className="py-2.5 px-4.5 bg-blue-600 hover:bg-blue-500 hover:scale-[1.01] active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-blue-500/10 border border-blue-550 transition-all cursor-pointer"
                                >
                                    + Registrar Artículo
                                </button>
                                 {user?.role === 'admin' && (
                                    <>
                                        <button 
                                            onClick={() => {
                                                setImportSuccessResult(null);
                                                setImportedProducts([]);
                                                setImportError(null);
                                                setIsImportModalOpen(true);
                                            }}
                                            className="py-2.5 px-4.5 bg-sky-600 hover:bg-sky-500 hover:scale-[1.01] active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-sky-600/10 border border-[#2c3e50]/20 transition-all cursor-pointer flex items-center gap-1.5"
                                            title="Importar productos masivamente desde un archivo CSV"
                                        >
                                            <FileSpreadsheet size={14} />
                                            <span>Importar CSV</span>
                                        </button>
                                        <button 
                                            onClick={runDuplicatesDiagnose}
                                            className="py-2.5 px-4.5 bg-purple-600 hover:bg-purple-500 hover:scale-[1.01] active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-purple-600/10 border border-purple-500 transition-all cursor-pointer flex items-center gap-1.5"
                                            title="Ver diagnóstico de productos duplicados o repetidos (Solo lectura)"
                                        >
                                            <ShieldAlert size={14} />
                                            <span>Diagnóstico Duplicados</span>
                                        </button>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <button 
                                    onClick={() => {
                                        setIsStockInModalOpen(true);
                                        setActiveModalTab('form');
                                    }}
                                    className="py-2.5 px-4.5 bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.01] active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-indigo-550/10 border border-indigo-550 transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                    <ArrowUpRight size={14} className="animate-pulse" />
                                    <span>Entrada de Stock (Rápido)</span>
                                </button>
                                <button 
                                    onClick={() => setIsPhysicalCountOpen(true)}
                                    className="py-2.5 px-4.5 bg-indigo-600/90 hover:bg-indigo-600 hover:scale-[1.01] active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-indigo-650/10 border border-indigo-650 transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                    <ClipboardCheck size={14} />
                                    <span>Control Físico (Checklist)</span>
                                </button>
                                {user?.role === 'admin' && (
                                    <button 
                                        onClick={downloadInventoryCSV}
                                        className="py-2.5 px-4.5 bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-emerald-600/10 border border-emerald-600 transition-all cursor-pointer flex items-center gap-1.5"
                                        title="Descargar Reporte de Inventario en formato CSV (Solo Administradores)"
                                    >
                                        <Download size={14} />
                                        <span>Reporte CSV</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                ) : null}
            </div>

            {/* Low Stock Notification Monitoring System for Admin */}
            <LowStockNotificationSystem />

            {/* Main Warehouse Filters portion */}
            <div className="bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/60 dark:border-slate-850/40 flex flex-col md:flex-row shadow-sm gap-4 items-center justify-between">
                
                {/* Search Bar */}
                <InventorySearchInput 
                    initialValue={searchQuery}
                    onSearchChange={(val) => setSearchQuery(val)}
                    onEnter={(val) => {
                        setSearchQuery(val);
                        setDebouncedSearchQuery(val);
                        fetchProducts(val);
                    }}
                    isSearching={searchQuery !== debouncedSearchQuery}
                    suggestions={finalFilteredProducts}
                    onSelectSuggestion={(prod) => {
                        setSearchQuery(prod.name);
                        setDebouncedSearchQuery(prod.name);
                        fetchProducts(prod.name);
                    }}
                    exchangeRate={exchangeRate}
                />

                {/* Categories Scroll Area arranged like departments */}
                <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto pb-1 max-w-full scrollbar-none select-none items-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b] dark:text-slate-500 mr-2 shrink-0 hidden lg:inline">
                        Departamentos:
                    </span>
                    {categoriesList.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-2xl text-[10.5px] font-extrabold tracking-wide whitespace-nowrap transition-all duration-200 cursor-pointer select-none border ${
                                selectedCategory === cat 
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-md shadow-blue-500/10 scale-[1.01]' 
                                    : 'bg-slate-50 dark:bg-[#070b13] border-slate-200/40 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-indigo-650 dark:hover:bg-slate-850/60 dark:hover:text-[#818cf8]'
                            }`}
                        >
                            <span>{cat}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Stock Replenishment Modal */}
            {isStockInModalOpen && (
                <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-[#0f1424] rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-slate-150 dark:border-slate-850 flex flex-[#0f1424] flex-col gap-4 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-hidden">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#1a233a] pb-3">
                            <div className="flex items-center gap-2">
                                <ArrowUpRight className="text-indigo-550" size={18} />
                                <h2 className="font-extrabold text-xs uppercase tracking-widest text-[#2c3e50] dark:text-[#a5b4fc]">
                                    Entrada de Stock de Mercancía
                                </h2>
                            </div>
                            <button onClick={() => {
                                setIsStockInModalOpen(false);
                                setSelectedProductForStockIn(null);
                                setStockInSearch("");
                            }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Top Navigation Tabs */}
                        <div className="flex border-b border-slate-100 dark:border-[#1a233a] gap-2">
                            <button
                                onClick={() => setActiveModalTab('form')}
                                className={`pb-2 px-3 text-xs font-bold leading-normal border-b-2 transition cursor-pointer ${
                                    activeModalTab === 'form'
                                        ? 'border-indigo-600 text-indigo-650 dark:text-indigo-400'
                                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                            >
                                Registrar Entrada
                            </button>
                            <button
                                onClick={() => {
                                    setActiveModalTab('history');
                                    loadArrivalHistory();
                                }}
                                className={`pb-2 px-3 text-xs font-bold leading-normal border-b-2 transition cursor-pointer ${
                                    activeModalTab === 'history'
                                        ? 'border-indigo-600 text-indigo-650 dark:text-indigo-400'
                                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                            >
                                Historial de Lotes
                            </button>
                        </div>

                        {/* Body contents */}
                        <div className="flex-grow overflow-y-auto pr-1">
                            {activeModalTab === 'form' ? (
                                <div className="flex flex-col gap-4">
                                    {/* Product Searcher (with clean autocomplete input and select feedback) */}
                                    <div className="flex flex-col gap-1.5 relative">
                                        <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Buscar Producto Existente *</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                className="w-full p-2.5 pl-9 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-semibold focus:outline-none focus:border-blue-550 dark:text-white"
                                                placeholder="Busca por nombre, SKU o código de barras..."
                                                value={stockInSearch}
                                                onChange={e => {
                                                    setStockInSearch(e.target.value);
                                                    if (selectedProductForStockIn) {
                                                        setSelectedProductForStockIn(null);
                                                    }
                                                }}
                                            />
                                            <Search className="absolute left-3 top-3.5 text-slate-400" size={14} />
                                            {selectedProductForStockIn && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        setSelectedProductForStockIn(null);
                                                        setStockInSearch("");
                                                    }}
                                                    className="absolute right-3 top-3 text-xs text-rose-500 hover:underline font-bold cursor-pointer"
                                                >
                                                    Limpiar
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown search suggestions */}
                                        {stockInSearch && !selectedProductForStockIn && (
                                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-[#0d1220] border border-slate-205 dark:border-[#1a233a] rounded-2xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                                                {(() => {
                                                    const map = new Map<number, Product>();
                                                    products.forEach(p => map.set(p.id, p));
                                                    stockInSearchResults.forEach(p => map.set(p.id, p));
                                                    const combinedList = Array.from(map.values());
                                                    const filtered = filterAndRankProducts(combinedList, stockInSearch);

                                                    if (filtered.length > 0) {
                                                        return filtered.slice(0, 8).map(p => (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedProductForStockIn(p);
                                                                    setStockInSearch(p.name);
                                                                    setStockInSearchResults([]);
                                                                }}
                                                                className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-[#141b2c] flex justify-between items-center border-b border-slate-100 dark:border-[#162035] last:border-none transition cursor-pointer"
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase">{p.name}</span>
                                                                    <span className="text-[9px] text-slate-400 font-mono font-bold mt-0.5">{p.sku || `#${p.id}`} • {p.category}</span>
                                                                </div>
                                                                <div className="text-right flex flex-col">
                                                                    <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">Stock: {p.stock} pz</span>
                                                                    {user?.role === 'admin' && <span className="text-[9px] text-slate-400 font-bold">Costo: Bs. {p.price_cost || 0}</span>}
                                                                </div>
                                                            </button>
                                                        ));
                                                    }

                                                    if (isSearchingStockIn) {
                                                        return (
                                                            <div className="p-4 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
                                                                <Loader2 className="animate-spin text-indigo-500" size={14} />
                                                                Buscando en todo el inventario...
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="p-4 text-center text-xs text-slate-400 font-semibold">
                                                            Ningún producto coincide con el término de búsqueda.
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>

                                    {/* Current selected product metrics */}
                                    {selectedProductForStockIn && (
                                        <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-150 dark:border-[#1c294a] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-in slide-in-from-top-1">
                                            <div>
                                                <span className="text-[8.5px] font-black uppercase tracking-widest text-indigo-650 dark:text-indigo-400 bg-white dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-100/40">{selectedProductForStockIn.category}</span>
                                                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase mt-1.5 leading-tight">{selectedProductForStockIn.name}</h4>
                                                <p className="text-[9.5px] text-slate-400 font-mono font-bold mt-0.5">SKU: {selectedProductForStockIn.sku}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col text-right">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Histórico actual</span>
                                                    <span className="text-xs font-mono font-black text-slate-700 dark:text-slate-300">{selectedProductForStockIn.stock} pz</span>
                                                </div>
                                                {user?.role === 'admin' && (
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Costo actual</span>
                                                        <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">Bs. {(Number(selectedProductForStockIn.price_cost) || 0).toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action form fields */}
                                    <form onSubmit={handleSaveStockIn} className="flex flex-col gap-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* Quantity to add */}
                                            <div className="flex flex-col gap-1.5 font-semibold">
                                                <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Cantidad Recibida o Ingresada *</label>
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    required
                                                    disabled={!selectedProductForStockIn}
                                                    className="p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-mono font-bold focus:outline-none focus:border-indigo-600 dark:text-white disabled:opacity-50"
                                                    placeholder="Ej: 50"
                                                    value={stockInQuantity}
                                                    onFocus={e => e.target.select()}
                                                    onClick={e => (e.target as HTMLInputElement).select()}
                                                    onChange={e => setStockInQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                                                />
                                            </div>
                                            
                                            {/* Price arrival classifications */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Condición de Precio de Llegada</label>
                                                <div className="grid grid-cols-2 gap-2 h-10">
                                                    <button
                                                        type="button"
                                                        disabled={!selectedProductForStockIn}
                                                        onClick={() => setKeepSameCost(true)}
                                                        className={`text-[10px] font-bold rounded-xl border transition cursor-pointer disabled:opacity-50 select-none ${
                                                            keepSameCost 
                                                                ? 'bg-blue-600 text-white border-blue-650 shadow-md shadow-blue-600/10'
                                                                : 'bg-white dark:bg-[#0c111e] text-slate-400 dark:text-slate-300 border-slate-205 dark:border-slate-850 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        Mismo Precio (Costo)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={!selectedProductForStockIn || !hasPermission(user, 'modify_prices')}
                                                        onClick={() => setKeepSameCost(false)}
                                                        className={`text-[10px] font-bold rounded-xl border transition cursor-pointer disabled:opacity-50 select-none ${
                                                            !keepSameCost
                                                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-600/10'
                                                                : 'bg-white dark:bg-[#0c111e] text-slate-400 dark:text-slate-300 border-slate-205 dark:border-slate-850 hover:bg-slate-50'
                                                        } ${!hasPermission(user, 'modify_prices') ? 'cursor-not-allowed opacity-40' : ''}`}
                                                        title={!hasPermission(user, 'modify_prices') ? "No tienes permisos para modificar costos" : ""}
                                                    >
                                                        Nuevo Costo
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* New price cost insertion input if selected */}
                                        {!keepSameCost && selectedProductForStockIn && (
                                            <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-1.5 font-semibold">
                                                <label className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-500">Nuevo Costo de Llegada/Compra (por Unidad en Bs.) *</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    min="0.01"
                                                    required
                                                    className="p-2.5 border border-indigo-500/45 dark:border-indigo-900 rounded-xl dark:bg-[#070b13] text-xs font-mono font-bold focus:outline-none focus:border-indigo-600 text-indigo-600 dark:text-indigo-300 h-10"
                                                    placeholder="Ej: 14.50"
                                                    value={newCostPrice}
                                                    onFocus={e => e.target.select()}
                                                    onClick={e => (e.target as HTMLInputElement).select()}
                                                    onChange={e => setNewCostPrice(e.target.value === "" ? "" : Number(e.target.value))}
                                                />
                                            </div>
                                        )}

                                        {/* Submit button */}
                                        <button
                                            type="submit"
                                            disabled={isSubmittingStockIn || !selectedProductForStockIn || !stockInQuantity}
                                            className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-lg transition duration-150 cursor-pointer text-center flex items-center justify-center gap-1.5"
                                        >
                                            {isSubmittingStockIn ? "Guardando lote..." : "Ingresar Unidades al Inventario"}
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                /* History contents tab */
                                <div className="flex flex-col gap-3 font-semibold">
                                    <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1 pl-1">
                                        Registros de Lotes de Ingreso
                                    </div>
                                    {arrivalHistory.length === 0 ? (
                                        <div className="border border-dashed border-slate-205 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400 font-semibold text-xs">
                                            No se registran transacciones pasadas de ingreso de mercancías.
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                                            {arrivalHistory.map((arr: any) => (
                                                <div key={arr.id} className="p-3.5 border border-slate-100 dark:border-[#1d273f] rounded-2xl bg-slate-50/50 dark:bg-black/10 flex justify-between items-center text-xs transition duration-150">
                                                    <div className="flex flex-col">
                                                        <span className="font-extrabold text-slate-800 dark:text-slate-150 uppercase leading-snug">{arr.product_name || "Producto Desconocido"}</span>
                                                        <span className="text-[9px] font-mono font-bold text-slate-450 mt-0.5">SKU: {arr.product_sku || "N/A"} • Ingresado el: {new Date(arr.created_at).toLocaleDateString()} {new Date(arr.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    </div>
                                                    <div className="text-right flex flex-col">
                                                        <span className="font-black text-emerald-600 dark:text-emerald-400">+{arr.quantity} pz</span>
                                                        <span className="text-[10px] text-slate-400 font-bold mt-0.5">Costo lote: Bs. {Number(arr.arrival_price).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Form Glass Overlay Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0f1424] rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-150 dark:border-slate-850 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-3">
                            <h2 className="font-extrabold text-xs uppercase tracking-widest text-[#2c3e50] dark:text-[#a5b4fc]">
                                {editingProduct ? 'Modificar Artículo del Inventario' : 'Dar de alta nuevo Artículo'}
                            </h2>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="flex flex-col gap-1.5 col-span-2">
                                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Descripción o Nombre Comercial *</label>
                                    <input 
                                        type="text" 
                                        className="p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-semibold focus:outline-none focus:border-blue-550"
                                        placeholder="Ej: Refresco de Cola 500ml"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        required
                                    />
                                    {similarProducts.length > 0 && (
                                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 mt-1 flex flex-col gap-1.5">
                                            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-extrabold text-[10px] uppercase tracking-wider">
                                                <AlertTriangle size={13} />
                                                <span>Productos similares detectados en catálogo:</span>
                                            </div>
                                            <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                                                {similarProducts.map(sp => (
                                                    <div key={sp.id} className="flex justify-between items-center bg-white dark:bg-[#141b2d] p-1.5 rounded-lg border border-amber-500/20 text-xs">
                                                        <div>
                                                            <span className="font-extrabold text-slate-800 dark:text-white">#{sp.id} {sp.name}</span>
                                                            <span className="text-[9.5px] text-slate-400 block font-mono">SKU: {sp.sku} | Stock: {sp.stock} u. | ${sp.price_unit}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsFormOpen(false);
                                                                openEditForm(sp);
                                                            }}
                                                            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-[9.5px] font-extrabold cursor-pointer transition shrink-0"
                                                        >
                                                            Abrir Existente
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Departamento *</label>
                                    <select 
                                        className="p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-semibold focus:outline-none focus:border-blue-550 dark:text-white"
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        required
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {departments.map(dept => (
                                            <option key={dept.id} value={dept.name}>{dept.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Código SKU de Barras *</label>
                                    <div className="flex gap-1.5 h-10">
                                        <input 
                                            type="text" 
                                            className="flex-1 p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-mono font-bold focus:outline-none focus:border-blue-550 dark:text-white"
                                            placeholder="Ej: BEB-COLA-50"
                                            value={sku}
                                            onChange={e => setSku(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setIsSkuScannerOpen(true)}
                                            className="px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition duration-150 cursor-pointer"
                                            title="Escanear SKU con Cámara"
                                        >
                                            <Camera size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Unidades Disponibles</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        className="p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-mono font-black text-slate-700 dark:text-grey-100 focus:outline-none focus:border-blue-550 dark:text-white"
                                        value={stock}
                                        onFocus={e => e.target.select()}
                                        onClick={e => (e.target as HTMLInputElement).select()}
                                        onChange={e => setStock(e.target.value === "" ? "" : Number(e.target.value))}
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Alerta de Stock Mín.</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        className="p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-mono font-black text-rose-500 focus:outline-none focus:border-blue-550 dark:text-white"
                                        value={stockAlarm}
                                        onFocus={e => e.target.select()}
                                        onClick={e => (e.target as HTMLInputElement).select()}
                                        onChange={e => setStockAlarm(e.target.value === "" ? "" : Number(e.target.value))}
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Precio Venta Detalle ($)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        disabled={!hasPermission(user, 'modify_prices')}
                                        className={`p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-mono font-black text-blue-600 dark:text-blue-400 focus:outline-none focus:border-blue-550 dark:text-white ${!hasPermission(user, 'modify_prices') ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900' : ''}`}
                                        value={priceUnit}
                                        onFocus={e => e.target.select()}
                                        onClick={e => (e.target as HTMLInputElement).select()}
                                        onChange={e => setPriceUnit(e.target.value === "" ? "" : Number(e.target.value))}
                                    />
                                    <span className="text-[10px] font-bold text-slate-400 pl-1">~ {roundBs(Number(priceUnit) * exchangeRate).toFixed(2)} Bs.</span>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Precio Mayorista ($)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        disabled={!hasPermission(user, 'modify_prices')}
                                        className={`p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-mono font-black text-purple-600 dark:text-purple-400 focus:outline-none focus:border-blue-550 dark:text-white ${!hasPermission(user, 'modify_prices') ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900' : ''}`}
                                        value={priceBulk}
                                        onFocus={e => e.target.select()}
                                        onClick={e => (e.target as HTMLInputElement).select()}
                                        onChange={e => setPriceBulk(e.target.value === "" ? "" : Number(e.target.value))}
                                    />
                                    <span className="text-[10px] font-bold text-slate-400 pl-1">~ {roundBs(Number(priceBulk) * exchangeRate).toFixed(2)} Bs.</span>
                                </div>

                                {user?.role === 'admin' && (
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Precio de Costo ($)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            min="0"
                                            disabled={!hasPermission(user, 'modify_prices')}
                                            className={`p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-blue-550 dark:text-white ${!hasPermission(user, 'modify_prices') ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900' : ''}`}
                                            value={priceCost}
                                            onFocus={e => e.target.select()}
                                            onClick={e => (e.target as HTMLInputElement).select()}
                                            onChange={e => setPriceCost(e.target.value === "" ? "" : Number(e.target.value))}
                                        />
                                        <span className="text-[10px] font-bold text-slate-400 pl-1">~ {roundBs(Number(priceCost) * exchangeRate).toFixed(2)} Bs.</span>
                                    </div>
                                )}

                                <div className="flex flex-col gap-1.5 col-span-2">
                                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Imagen del Producto (Opcional)</label>
                                    <div className="flex gap-4 items-center bg-slate-50/50 dark:bg-black/20 p-3 border border-slate-200 dark:border-slate-850 rounded-2xl">
                                        {image ? (
                                            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white shrink-0">
                                                <img src={image} className="w-full h-full object-cover" alt="Vista previa del artículo" referrerPolicy="no-referrer" />
                                                <button
                                                    type="button"
                                                    onClick={() => setImage(null)}
                                                    className="absolute top-0.5 right-0.5 bg-rose-500 hover:bg-rose-600 text-white p-0.5 rounded-full transition shadow-md"
                                                    title="Quitar"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 shrink-0 select-none">
                                                <Camera size={18} />
                                                <span className="text-[8px] font-bold mt-1 uppercase">S/I</span>
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        if (file.size > 2 * 1024 * 1024) {
                                                            showNotification("La imagen supera el límite de 2MB.", "error");
                                                            return;
                                                        }
                                                        const reader = new FileReader();
                                                        reader.onload = (event) => {
                                                            if (event.target?.result) {
                                                                setImage(event.target.result as string);
                                                            }
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                                className="text-[10.5px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-[#11192e] dark:file:text-indigo-400 file:cursor-pointer cursor-pointer"
                                            />
                                            <p className="text-[8.5px] text-slate-400 uppercase tracking-wider mt-1.5 font-bold">Límite sugerido: 2MB (Carga local ultra-rápida)</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3.5 border-t border-slate-100 dark:border-slate-850 pt-4 mt-2 select-none">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer">
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmittingProduct}
                                    className={`px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-500/10 border border-blue-550 flex items-center gap-2 cursor-pointer ${isSubmittingProduct ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    {isSubmittingProduct && <Loader2 size={14} className="animate-spin" />}
                                    <span>{isSubmittingProduct ? 'Guardando producto...' : 'Guardar Cambios'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Duplicate Product Warning Modal */}
            {duplicateModalData && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0f1424] rounded-3xl w-full max-w-md p-6 shadow-2xl border border-amber-500/40 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 text-amber-500">
                            <AlertTriangle size={28} className="shrink-0" />
                            <div>
                                <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Posible Registro Duplicado</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{duplicateModalData.warning}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-black/30 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 text-xs">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Producto Existente en Sistema</span>
                            <span className="font-extrabold text-slate-800 dark:text-white">
                                #{duplicateModalData.existingProduct.id} - {duplicateModalData.existingProduct.name}
                            </span>
                            <div className="flex gap-4 text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 mt-1">
                                <span>SKU: {duplicateModalData.existingProduct.sku}</span>
                                <span>Stock: {duplicateModalData.existingProduct.stock} u.</span>
                                <span>Precio: ${duplicateModalData.existingProduct.price_unit}</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                            Para evitar duplicar registros y mantener el inventario 100% preciso, no se permite crear dos productos con el mismo nombre. Puedes abrir el producto existente para editarlo o cambiar el nombre del nuevo artículo.
                        </p>

                        <div className="flex justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setDuplicateModalData(null)}
                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Modificar Datos
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const existing = products.find(p => p.id === duplicateModalData.existingProduct.id);
                                    setDuplicateModalData(null);
                                    setIsFormOpen(false);
                                    if (existing) openEditForm(existing);
                                }}
                                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold transition cursor-pointer shadow-md"
                            >
                                Abrir Producto Existente
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Read-Only Duplicates Diagnostic Modal */}
            {isDiagnoseModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0f1424] rounded-3xl w-full max-w-3xl max-h-[85vh] p-6 shadow-2xl border border-purple-500/30 flex flex-col gap-4 animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-3">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="text-purple-500" size={20} />
                                <div>
                                    <h2 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-white">
                                        Diagnóstico de Duplicados en Catálogo (Solo Lectura)
                                    </h2>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                        Análisis detallado de productos con nombres o SKUs idénticos. Ningún dato se modifica ni borra.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsDiagnoseModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
                            {diagnoseLoading ? (
                                <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                                    <Loader2 size={28} className="animate-spin text-purple-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Escaneando base de datos de productos...</span>
                                </div>
                            ) : diagnoseData ? (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-slate-50 dark:bg-black/30 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Total en Catálogo</span>
                                            <span className="text-lg font-black text-slate-800 dark:text-white">{diagnoseData.totalProductsCatalog} u.</span>
                                        </div>
                                        <div className="bg-purple-500/10 p-3 rounded-2xl border border-purple-500/20 text-center">
                                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">Grupos Detectados</span>
                                            <span className="text-lg font-black text-purple-600 dark:text-purple-300">{diagnoseData.totalDuplicateGroups}</span>
                                        </div>
                                        <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 text-center">
                                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">Productos Involucrados</span>
                                            <span className="text-lg font-black text-amber-600 dark:text-amber-300">{diagnoseData.totalImpactedProducts}</span>
                                        </div>
                                    </div>

                                    {diagnoseData.duplicateGroups.length === 0 ? (
                                        <div className="p-10 text-center border border-dashed border-emerald-500/30 rounded-2xl bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                                            ✓ ¡Excelente! No se encontraron productos duplications o con SKUs repetidos en tu base de datos.
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {diagnoseData.duplicateGroups.map((group: any, idx: number) => (
                                                <div key={group.id || idx} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20 flex flex-col gap-3">
                                                    <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 bg-purple-600 text-white rounded text-[9px] font-extrabold uppercase">
                                                                {group.type}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                Clave: <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">{group.normalizedKey}</code>
                                                            </span>
                                                        </div>
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${group.riskLevel === 'CRÍTICO' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                                            Riesgo {group.riskLevel}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                        {group.description}
                                                    </p>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {group.products.map((p: any) => (
                                                            <div key={p.id} className="p-3 bg-white dark:bg-[#121829] rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-1 text-xs">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-black text-slate-800 dark:text-white">#{p.id} - {p.name}</span>
                                                                    <span className="text-[10px] font-mono font-bold text-blue-500">${p.price_unit}</span>
                                                                </div>
                                                                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                                                                    <span>SKU: {p.sku || 'S/N'}</span>
                                                                    <span>Stock: {p.stock} u.</span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-[9px] font-extrabold text-slate-400 mt-1 pt-1 border-t border-slate-100 dark:border-slate-850">
                                                                    <div className="flex gap-2">
                                                                        <span>🛒 Ventas: {p.sales_count}</span>
                                                                        <span>📦 Movimientos: {p.audit_count}</span>
                                                                        <span>📥 Lotes: {p.arrivals_count}</span>
                                                                    </div>
                                                                    {user?.role === 'admin' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={async () => {
                                                                                await handleDelete(p.id, p.name);
                                                                                runDuplicatesDiagnose();
                                                                            }}
                                                                            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 font-extrabold flex items-center gap-1 cursor-pointer px-1.5 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                                                            title="Eliminar este duplicado de forma definitiva"
                                                                        >
                                                                            <Trash2 size={11} />
                                                                            <span>Eliminar</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="p-3 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                                        💡 <strong>Aviso Importante de Protección de Datos:</strong> {diagnoseData.note} Conservar ambos registros garantiza que las ventas antiguas sigan vinculadas a su comprobante original sin alterar la contabilidad.
                                    </div>
                                </>
                            ) : null}
                        </div>

                        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-850">
                            <button
                                type="button"
                                onClick={() => setIsDiagnoseModalOpen(false)}
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Cerrar Diagnóstico
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SKU Camera scanning Modal */}
            {isSkuScannerOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0f1424] rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-slate-150 dark:border-slate-850 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-2.5">
                            <div className="flex items-center gap-2">
                                <Camera className="text-blue-500" size={15} />
                                <h3 className="font-extrabold text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200">
                                    Escanear SKU
                                </h3>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsSkuScannerOpen(false)} 
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 transition cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Scanner Cam Display Viewfinder */}
                        <div className="relative w-full aspect-video bg-[#070b13] dark:bg-black rounded-xl overflow-hidden border border-slate-100 dark:border-slate-850">
                            <div id="sku-scanner-viewfinder" className="w-full h-full" />
                            {skuScannerError && (
                                <div className="absolute inset-0 bg-[#070b13]/90 text-white flex flex-col items-center justify-center p-4 text-center">
                                    <div className="text-red-500 font-bold mb-1 text-xs">⚠️ Fallo de cámara</div>
                                    <div className="text-[10px] font-medium opacity-80 max-w-xs leading-normal">{skuScannerError}</div>
                                </div>
                            )}
                        </div>

                        {/* Camera list dropdown */}
                        {skuCameras.length > 1 && (
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Seleccionar Cámara</label>
                                <select
                                    className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:border-blue-500 dark:text-white"
                                    value={selectedSkuCameraId}
                                    onChange={(e) => setSelectedSkuCameraId(e.target.value)}
                                >
                                    {skuCameras.map(cam => (
                                        <option key={cam.id} value={cam.id}>{cam.label || `Cámara ${cam.id.slice(0, 5)}`}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* NEW: PHOTO UPLOAD DECODER FOR SKU */}
                        <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-xl border border-blue-100 dark:border-blue-900/30 flex flex-col gap-1.5">
                            <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-450 block">Escanear de Foto / Carga Directa</span>
                            <p className="text-[8.5px] text-slate-500 font-semibold leading-relaxed">
                                Si el visor del stream tiene problemas de enfoque, toma una foto con tu cámara nativa y súbela:
                            </p>
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setSkuScannerError(null);
                                    
                                    const parser = new Html5Qrcode("sku-scanner-viewfinder", { verbose: false });
                                    try {
                                        const decodedText = await parser.scanFile(file, false);
                                        setSku(decodedText.trim());
                                        setIsSkuScannerOpen(false);
                                        // Play happy feedback beep
                                        try {
                                            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                                            const osc = audioCtx.createOscillator();
                                            const gain = audioCtx.createGain();
                                            osc.connect(gain);
                                            gain.connect(audioCtx.destination);
                                            osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
                                            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
                                            osc.start();
                                            osc.stop(audioCtx.currentTime + 0.1);
                                        } catch (err) {}
                                        showNotification("✓ SKU decodificado correctamente de fotografía.", "success");
                                    } catch (err) {
                                        console.warn("SKU file parse failed:", err);
                                        setSkuScannerError("No se encontró ningún código de barras en la foto cargada. Intenta que la foto esté más enfocada e iluminada.");
                                    }
                                }}
                                className="w-full text-[9px] text-gray-500 rounded-lg cursor-pointer file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[9px] file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-700 bg-white dark:bg-zinc-950 p-1 border dark:border-slate-850"
                            />
                        </div>

                        <div className="text-[9.5px] text-center font-bold text-slate-400 bg-slate-50 dark:bg-black/25 py-2 px-3 rounded-lg border border-slate-100 dark:border-slate-850 leading-relaxed">
                            Enfoca con la cámara el código de barras o QR. El sistema reconocerá el SKU de manera automática.
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsSkuScannerOpen(false)}
                            className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a233a] dark:text-slate-300 dark:hover:bg-[#202b48] text-slate-600 font-bold text-xs rounded-lg transition cursor-pointer"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile View: Product Cards (block md:hidden) */}
            <div className="block md:hidden space-y-4 flex-1">
                {products.length === 0 ? (
                    <div className="bg-white dark:bg-[#0c111e] rounded-3xl p-8 border border-slate-200/60 dark:border-slate-850/40 text-center text-slate-400">
                        No hay productos registrados en el inventario. Haz clic en "Agregar Producto" para insertar uno.
                    </div>
                ) : finalFilteredProducts.length === 0 ? (
                    <div className="bg-white dark:bg-[#0c111e] rounded-3xl p-8 border border-slate-200/60 dark:border-slate-850/40 text-center text-slate-400">
                        🚫 Ningún artículo coincide con los filtros aplicados. Intenta con otra búsqueda o selecciona "Todos".
                    </div>
                ) : (
                    finalFilteredProducts.map(p => {
                        const lowStock = p.stock <= p.stock_alarm;
                        const isExpanded = expandedProductId === p.id;
                        return (
                            <div 
                                key={p.id} 
                                className={`bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/60 dark:border-slate-850/40 p-4 shadow-xs transition duration-150 ${
                                    isExpanded ? 'ring-2 ring-blue-500/50 dark:ring-indigo-500/50 bg-slate-50/20 dark:bg-[#0d1221]/10' : ''
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Thumbnail Photo with Lightbox support */}
                                    {p.image ? (
                                        <button
                                            type="button"
                                            onClick={() => setLightboxImage(p.image)}
                                            className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-black/30 shrink-0 flex items-center justify-center hover:scale-[1.04] transition duration-150 relative group cursor-pointer"
                                            title="Ver fotografía"
                                        >
                                            <img src={p.image} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-150">
                                                <Eye size={10} className="text-white" />
                                            </div>
                                        </button>
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-black/10 flex items-center justify-center text-slate-400 shrink-0">
                                            <Camera size={16} className="opacity-55" />
                                        </div>
                                    )}

                                    {/* Description / Info Hierarchy */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="bg-slate-100 dark:bg-slate-950 text-slate-500 text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-md border border-slate-200/20">
                                                {p.category}
                                            </span>
                                            {lowStock && (
                                                <span className="text-[8px] text-rose-500 font-extrabold flex items-center gap-0.5 bg-rose-500/10 px-1.5 py-0.5 rounded-md">
                                                    <AlertTriangle size={8} /> Alerta Stock
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm mt-1 leading-tight uppercase truncate">
                                            {p.name}
                                        </h3>
                                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block mt-0.5">SKU: {p.sku}</span>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="flex gap-1.5">
                                        <button 
                                            onClick={() => handleOpenStockHistory(p)}
                                            className="w-7 h-7 flex items-center justify-center text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/20 rounded-lg transition hover:bg-indigo-100 cursor-pointer"
                                            title="Ver Historial"
                                        >
                                            <History size={13} />
                                        </button>
                                        <button 
                                            onClick={() => openEditForm(p)}
                                            className="w-7 h-7 flex items-center justify-center text-blue-600 bg-blue-50 dark:bg-blue-950/20 rounded-lg transition hover:bg-blue-100 cursor-pointer"
                                            title="Editar"
                                        >
                                            <Edit size={13} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(p.id, p.name)}
                                            className="w-7 h-7 flex items-center justify-center text-rose-600 bg-rose-50 dark:bg-rose-950/20 rounded-lg transition hover:bg-rose-100 cursor-pointer"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Stock & Consolidated Primary Price */}
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-850/50 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-500">Stock actual</span>
                                        <span className={`text-sm font-black font-mono ${lowStock ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {p.stock} pz
                                        </span>
                                    </div>

                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-500">Precio Detalle</span>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400">${(Number(p.price_unit) || 0).toFixed(2)} USD</span>
                                            <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-extrabold font-mono font-black">({roundBs((Number(p.price_unit) || 0) * exchangeRate).toFixed(2)} Bs)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Toggle detail trigger to avoid pricing clutter */}
                                <div className="mt-2 flex items-center justify-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center gap-1 hover:underline cursor-pointer"
                                    >
                                        {isExpanded ? (
                                            <>Cerrar detalle <ChevronDown size={12} className="rotate-180" /></>
                                        ) : (
                                            <>Detalles <ChevronDown size={12} /></>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenStockHistory(p)}
                                        className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1 hover:underline cursor-pointer"
                                    >
                                        <History size={11} /> Ver Historial
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800/80 space-y-3 animate-in slide-in-from-top-2 duration-150">
                                        <div className="grid grid-cols-2 gap-3">
                                            {user?.role === 'admin' && (
                                                <div className="bg-slate-50/50 dark:bg-black/25 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-850/80 flex flex-col gap-0.5">
                                                    <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500">Precio Costo</span>
                                                    <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">${(Number(p.price_cost) || 0).toFixed(2)} USD</span>
                                                    <span className="text-[10px] font-mono text-slate-450 dark:text-slate-400">({roundBs((Number(p.price_cost) || 0) * exchangeRate).toFixed(2)} Bs)</span>
                                                </div>
                                            )}
                                            <div className="bg-slate-50/50 dark:bg-black/25 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-850/80 flex flex-col gap-0.5">
                                                <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500">Precio Mayorista</span>
                                                <span className="text-xs font-mono font-black text-purple-600 dark:text-purple-400">${(Number(p.price_bulk) || 0).toFixed(2)} USD</span>
                                                <span className="text-[10px] font-mono text-slate-450 dark:text-slate-400">({roundBs((Number(p.price_bulk) || 0) * exchangeRate).toFixed(2)} Bs)</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 bg-slate-50/30 dark:bg-black/10 p-2.5 rounded-xl border border-slate-200/40 dark:border-slate-850/60 text-[10px]">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase text-slate-400">Alerta de Stock</span>
                                                <span className="font-mono text-rose-500 font-extrabold mt-0.5">{p.stock_alarm} pz (Mínimo)</span>
                                            </div>
                                            {user?.role === 'admin' && (
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black uppercase text-slate-400">Rentabilidad</span>
                                                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5">
                                                        {p.price_unit > 0 ? (((p.price_unit - p.price_cost) / p.price_unit) * 100).toFixed(1) : "0.0"}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {renderProductHistoryLogs(p.id)}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Desktop View: Products Table (hidden md:flex) */}
            <div className="bg-white dark:bg-[#0c111e] rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-850/40 overflow-hidden flex-1 flex-col hidden md:flex">
                <div className="overflow-x-auto w-full flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-150 dark:border-slate-850/60 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                <th className="p-4 pl-6 w-12"></th>
                                <th className="p-4">Código SKU</th>
                                <th className="p-4">Descripción / Artículo</th>
                                <th className="p-4">Categoría</th>
                                {view === 'productos' ? (
                                    <>
                                        {user?.role === 'admin' && <th className="p-4 text-right">Precio Costo</th>}
                                        <th className="p-4 text-right">Precio Mayor</th>
                                        <th className="p-4 text-right">Precio Detalle</th>
                                        <th className="p-4 text-right">Stock</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-4 text-right">Existencias</th>
                                        <th className="p-4 text-right">Alerta Stock</th>
                                        <th className="p-4 text-center">Estado</th>
                                    </>
                                )}
                                <th className="p-4 text-center pr-6">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850/50 text-[11px] font-bold">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={view === 'productos' ? (user?.role === 'admin' ? 9 : 8) : 8} className="p-8">
                                        <EmptyState
                                            icon={ShoppingBag}
                                            title="No hay productos registrados"
                                            description="El inventario está vacío actualmente. Puedes registrar nuevos artículos de forma manual o importar un catálogo."
                                            actionLabel={hasPermission(user, 'can_create_products') ? "Agregar Producto" : undefined}
                                            onAction={hasPermission(user, 'can_create_products') ? openCreateForm : undefined}
                                        />
                                    </td>
                                </tr>
                            ) : finalFilteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={view === 'productos' ? (user?.role === 'admin' ? 9 : 8) : 8} className="p-8">
                                        <EmptyState
                                            icon={Search}
                                            title="Sin coincidencias en inventario"
                                            description="Ningún artículo coincide con los términos de búsqueda o filtros de categoría aplicados."
                                            actionLabel="Restablecer Filtros"
                                            onAction={() => {
                                                setSearchQuery("");
                                                setSelectedCategory("Todos");
                                            }}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                finalFilteredProducts.map(p => {
                                    const lowStock = p.stock <= p.stock_alarm;
                                    const isExpanded = expandedProductId === p.id;
                                    return (
                                        <React.Fragment key={p.id}>
                                            <tr className={`hover:bg-slate-50/50 dark:hover:bg-[#0d1221]/45 transition duration-150 ${isExpanded ? 'bg-slate-50/30 dark:bg-[#0d1221]/20' : ''}`}>
                                                <td className="p-4 pl-6">
                                                    <button
                                                        onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                                                        className="w-6 h-6 flex items-center justify-center text-slate-450 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-black/20 rounded-lg transition shrink-0 cursor-pointer"
                                                        title={isExpanded ? "Contraer detalles" : "Ver detalles expandidos"}
                                                    >
                                                        {isExpanded ? <ChevronDown size={14} className="text-blue-500" /> : <ChevronRight size={14} />}
                                                    </button>
                                                </td>
                                                <td className="p-4 font-mono font-bold text-slate-400">{p.sku}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        {/* Interactive Thumbnail Photo Button */}
                                                        {p.image ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setLightboxImage(p.image)}
                                                                className="w-10 h-10 rounded-xl overflow-hidden border border-slate-205 dark:border-slate-800/65 bg-white dark:bg-black/30 shrink-0 flex items-center justify-center hover:scale-[1.06] active:scale-95 hover:shadow-md transition duration-150 group relative cursor-pointer"
                                                                title="Clic para ver fotografía ampliada"
                                                            >
                                                                <img src={p.image} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                                                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-150">
                                                                    <Eye size={12} className="text-white" />
                                                                </div>
                                                            </button>
                                                        ) : (
                                                            <div 
                                                                className="w-10 h-10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-black/10 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 shrink-0 select-none"
                                                                title="Sin imagen registrada"
                                                            >
                                                                <Camera size={14} className="opacity-55" />
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col">
                                                            <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs leading-none uppercase">{p.name}</span>
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                {p.image ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setLightboxImage(p.image)}
                                                                        className="text-[9px] text-blue-600 dark:text-indigo-400 hover:underline hover:text-blue-500 hover:dark:text-indigo-300 font-extrabold flex items-center gap-1 cursor-pointer"
                                                                    >
                                                                        <Eye size={10} /> Ver fotografía
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[9px] text-slate-404 font-extrabold">Sin fotografía</span>
                                                                )}
                                                                {lowStock && (
                                                                    <span className="text-[8px] text-rose-500 font-extrabold flex items-center gap-0.5 bg-rose-500/10 px-1.5 py-0.5 rounded-lg w-max leading-none">
                                                                        <AlertTriangle size={8} /> Alerta Stock
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="bg-slate-100 dark:bg-[#070c14] text-slate-500 text-[9px] uppercase font-bold py-1 px-2.5 rounded-lg border border-slate-200/40 dark:border-slate-800/60">
                                                        {p.category}
                                                    </span>
                                                </td>
                                                {view === 'productos' ? (
                                                    <>
                                                        {user?.role === 'admin' && (
                                                            <td className="p-4 text-right text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                                                <div className="flex flex-col items-end">
                                                                    <span>${(Number(p.price_cost) || 0).toFixed(2)}</span>
                                                                    <span className="text-[9.5px] text-slate-400 font-bold opacity-80">({roundBs((Number(p.price_cost) || 0) * exchangeRate).toFixed(2)} Bs)</span>
                                                                </div>
                                                            </td>
                                                        )}
                                                        <td className="p-4 text-right text-xs font-bold font-mono text-purple-650 dark:text-purple-450">
                                                            <div className="flex flex-col items-end">
                                                                <span>${(Number(p.price_bulk) || 0).toFixed(2)}</span>
                                                                <span className="text-[9.5px] text-slate-400 font-bold opacity-80">({roundBs((Number(p.price_bulk) || 0) * exchangeRate).toFixed(2)} Bs)</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right text-xs font-bold font-mono text-blue-600 dark:text-blue-400 bg-blue-500/2 dark:bg-blue-400/2">
                                                            <div className="flex flex-col items-end">
                                                                <span>${(Number(p.price_unit) || 0).toFixed(2)}</span>
                                                                <span className="text-[9.5px] text-indigo-500 font-extrabold font-black">({roundBs((Number(p.price_unit) || 0) * exchangeRate).toFixed(2)} Bs)</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <span className={`font-mono text-xs font-black ${lowStock ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {p.stock} pz
                                                            </span>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="p-4 text-right">
                                                            <span className={`font-mono text-xs font-black ${lowStock ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {p.stock} pz
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-slate-400 dark:text-slate-500 text-xs">
                                                            {p.stock_alarm} pz
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {p.stock <= 0 ? (
                                                                <span className="bg-rose-500/10 text-rose-500 border border-rose-550/15 text-[8.5px] uppercase font-black px-2 py-0.5 rounded-lg">
                                                                    Sin stock
                                                                </span>
                                                            ) : lowStock ? (
                                                                <span className="bg-amber-500/10 text-amber-550 border border-amber-550/15 text-[8.5px] uppercase font-black px-2 py-0.5 rounded-lg animate-pulse">
                                                                    Stock Bajo
                                                                </span>
                                                            ) : (
                                                                <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-550/15 text-[8.5px] uppercase font-black px-2 py-0.5 rounded-lg">
                                                                    En Stock
                                                                </span>
                                                            )}
                                                        </td>
                                                    </>
                                                )}
                                                <td className="p-4">
                                                    <div className="flex items-center justify-center gap-2 pr-2">
                                                        <button 
                                                            onClick={() => handleOpenStockHistory(p)}
                                                            className="w-7 h-7 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-xl transition cursor-pointer"
                                                            title="Ver Historial de Stock"
                                                        >
                                                            <History size={13} />
                                                        </button>
                                                        <button 
                                                            onClick={() => openEditForm(p)}
                                                            className="w-7 h-7 flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-xl transition cursor-pointer"
                                                            title="Editar"
                                                        >
                                                            <Edit size={13} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(p.id, p.name)}
                                                            className="w-7 h-7 flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition cursor-pointer"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Beautiful Collapsible / Expanded panel row (Optimized to prevent price duplication on desktop) */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/70 dark:bg-[#070b13]/40 border-y border-slate-150 dark:border-slate-850/80 animate-in slide-in-from-top-2 duration-200">
                                                    <td colSpan={view === 'productos' ? (user?.role === 'admin' ? 9 : 8) : 8} className="p-6">
                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                                            {/* Product image section with lightbox zoom buttons */}
                                                            <div className="md:col-span-4 flex flex-col gap-2">
                                                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 select-none">Fotografía del Producto</span>
                                                                {p.image ? (
                                                                    <div className="relative group rounded-2xl overflow-hidden border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-black/30 aspect-square flex items-center justify-center p-2.5 shadow-sm">
                                                                        <img 
                                                                            src={p.image} 
                                                                            referrerPolicy="no-referrer"
                                                                            className="w-full h-full object-contain rounded-xl" 
                                                                            alt={p.name} 
                                                                        />
                                                                        <button
                                                                            onClick={() => setLightboxImage(p.image)}
                                                                            className="absolute bottom-3 right-3 bg-indigo-600 hover:bg-slate-900 dark:bg-indigo-650 dark:hover:bg-[#11192e] text-white py-2 px-3.5 rounded-xl transition shadow-lg flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider cursor-pointer"
                                                                        >
                                                                            <Maximize2 size={11} /> Ampliar Imagen
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-850/70 bg-slate-100/50 dark:bg-black/10 aspect-square flex flex-col items-center justify-center text-slate-400 gap-2 select-none">
                                                                        <Camera size={28} strokeWidth={1.5} />
                                                                        <span className="text-[9.5px] font-black uppercase tracking-wider opacity-70">Sin imagen registrada</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Technical / pricing details list panels mirroring user guidelines */}
                                                            <div className="md:col-span-8 flex flex-col gap-4">
                                                                <div className="flex flex-col gap-1.5 border-b border-slate-100 dark:border-slate-850 pb-3">
                                                                    <div className="text-[9px] font-black uppercase tracking-widest text-indigo-650 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg w-max leading-none">{p.category}</div>
                                                                    <h3 className="text-base font-black text-slate-850 dark:text-white uppercase leading-normal">{p.name}</h3>
                                                                </div>

                                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                                                    <div className="bg-slate-50/50 dark:bg-black/20 p-3.5 border border-slate-200/50 dark:border-slate-850 rounded-2xl flex flex-col gap-0.5">
                                                                        <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">Código de Barras</span>
                                                                        <span className="text-xs font-mono font-black text-[#2c3e50] dark:text-slate-200">{p.sku}</span>
                                                                    </div>

                                                                    <div className="bg-slate-50/50 dark:bg-black/20 p-3.5 border border-slate-200/50 dark:border-slate-850 rounded-2xl flex flex-col gap-0.5">
                                                                        <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">Existencias Disponibles</span>
                                                                        <span className={`text-xs font-black ${lowStock ? 'text-rose-500' : 'text-slate-850 dark:text-white'}`}>
                                                                            {p.stock} unidades (pz)
                                                                        </span>
                                                                    </div>

                                                                    <div className="bg-slate-50/50 dark:bg-black/20 p-3.5 border border-slate-200/50 dark:border-slate-850 rounded-2xl flex flex-col gap-0.5">
                                                                        <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">Alerta de Advertencia</span>
                                                                        <span className="text-xs font-bold text-rose-500 font-mono tracking-tight font-extrabold">{p.stock_alarm} unidades (Mínimo)</span>
                                                                    </div>
                                                                </div>

                                                                {/* Rentabilidad y Margen Comercial Business Info Card (Avoids repeating the exact same prices shown above) */}
                                                                {user?.role === 'admin' && (
                                                                    <div className="bg-slate-50/30 dark:bg-black/15 p-4 border border-slate-200/40 dark:border-slate-850 rounded-2xl flex flex-col gap-3">
                                                                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-850 pb-1.5 flex items-center gap-1.5 select-none">
                                                                            <Sparkles size={11} className="text-indigo-500" />
                                                                            Análisis de Rentabilidad Comercial
                                                                        </span>
                                                                        <div className="grid grid-cols-2 gap-3.5">
                                                                            <div className="flex flex-col p-3 bg-white dark:bg-[#111625] rounded-xl border border-slate-200/40 dark:border-slate-850/80">
                                                                                <span className="text-[8px] font-black text-slate-400 uppercase">Margen de Ganancia Neto</span>
                                                                                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-mono font-black mt-1">
                                                                                    {p.price_unit > 0 ? (((p.price_unit - p.price_cost) / p.price_unit) * 100).toFixed(1) : "0.0"}%
                                                                                </span>
                                                                                <span className="text-[9px] text-slate-450 dark:text-slate-500 font-semibold mt-0.5 leading-normal">
                                                                                    Fracción de ganancia neta contenida en el precio de venta final.
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex flex-col p-3 bg-white dark:bg-[#111625] rounded-xl border border-slate-200/40 dark:border-slate-850/80">
                                                                                <span className="text-[8px] font-black text-slate-400 uppercase">Porcentaje de Margen Comercial (Markup)</span>
                                                                                <span className="text-sm text-purple-600 dark:text-purple-400 font-mono font-black mt-1">
                                                                                    {p.price_cost > 0 ? (((p.price_unit - p.price_cost) / p.price_cost) * 100).toFixed(1) : "0.0"}%
                                                                                </span>
                                                                                <span className="text-[9px] text-slate-450 dark:text-slate-500 font-semibold mt-0.5 leading-normal">
                                                                                    Incremento aplicado sobre el costo bruto de adquisición.
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center gap-2 text-slate-400 text-[9px] pl-1 font-bold">
                                                                    <Tag size={10} />
                                                                    <span>Sincronizado al Tipo de Cambio Actual de $1 USD = {exchangeRate} BOB (Auditable).</span>
                                                                </div>

                                                                {renderProductHistoryLogs(p.id)}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {hasMoreProducts && (
                    <div className="mt-6 flex justify-center pb-6">
                        <button
                            onClick={async () => {
                                setLoadingMoreProducts(true);
                                await loadMoreProducts();
                                setLoadingMoreProducts(false);
                            }}
                            disabled={loadingMoreProducts}
                            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-sans text-xs font-extrabold transition duration-200 shadow-lg shadow-indigo-600/15 disabled:opacity-50 flex items-center gap-2 cursor-pointer border border-indigo-600/20"
                        >
                            {loadingMoreProducts ? (
                                <>
                                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/35 border-t-white animate-spin" />
                                    Cargando más productos...
                                </>
                            ) : (
                                'Cargar Más Productos'
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Product Image Lightbox Full-view HUD */}
            {lightboxImage && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
                    <button 
                        onClick={() => setLightboxImage(null)}
                        className="absolute top-4 right-4 text-white hover:text-slate-200 bg-white/10 hover:bg-white/25 p-2.5 rounded-full transition shadow-lg cursor-pointer"
                        title="Cerrar Imagen Ampliada"
                    >
                        <X size={22} />
                    </button>
                    <div 
                        className="relative max-w-4xl max-h-[85vh] overflow-hidden flex items-center justify-center rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200 bg-zinc-950"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img 
                            src={lightboxImage} 
                            referrerPolicy="no-referrer"
                            className="max-w-full max-h-[82vh] object-contain rounded-xl" 
                            alt="Visualización ampliada del artículo" 
                        />
                    </div>
                </div>
            )}

            {isPhysicalCountOpen && (
                <PhysicalCountManager onClose={() => setIsPhysicalCountOpen(false)} />
            )}

            {/* Modal de Importación Masiva (CSV) */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[65] overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/80 dark:border-slate-850 max-w-3xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-4 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center text-sky-600 dark:text-sky-400">
                                    <FileSpreadsheet size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-tight">Importación Masiva de Productos</h3>
                                    <p className="text-[11px] text-slate-450 dark:text-slate-500 font-medium">Cargue archivos CSV o Excel exportados para poblar su almacén al instante.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsImportModalOpen(false)}
                                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto py-5 pr-1 flex flex-col gap-4 text-xs">
                            
                            {/* CSV Template Guideline Banner */}
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-150 dark:border-slate-850/60 flex flex-col gap-2">
                                <span className="font-extrabold uppercase text-[10px] text-slate-500 dark:text-slate-400">Estructura del Archivo Requerida:</span>
                                <p className="text-[11px] leading-relaxed text-slate-400 select-all font-mono bg-white dark:bg-black/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                                    name, sku, category, stock, price_unit, price_bulk, price_cost, stock_alarm
                                </p>
                                <span className="text-[10px] text-slate-400 mt-1">
                                    * El archivo puede utilizar comas (,) o puntos y comas (;) como separadores. Los campos <strong>name</strong> y <strong>sku</strong> son obligatorios para registrar un producto.
                                </span>
                            </div>

                            {/* Behavior Controls & File Input */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <div className="flex flex-col gap-1.5">
                                    <span className="font-bold text-slate-500">¿Cómo procesar artículos existentes (mismo SKU o Nombre)?</span>
                                    <select 
                                        value={importBehavior}
                                        onChange={(e: any) => setImportBehavior(e.target.value)}
                                        className="py-2 px-3 bg-slate-50 dark:bg-[#111625] border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    >
                                        <option value="update_stock">Sumar existencias al producto existente (Recomendado)</option>
                                        <option value="overwrite">Sobrescribir datos del artículo existente</option>
                                        <option value="skip">Omitir e ignorar duplicados</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <span className="font-bold text-slate-500">Seleccionar Archivo (.csv)</span>
                                    <input 
                                        type="file" 
                                        accept=".csv"
                                        onChange={handleCSVSelect}
                                        className="file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10.5px] file:font-black file:uppercase file:bg-sky-50 file:text-sky-600 dark:file:bg-sky-950/30 dark:file:text-sky-400 hover:file:cursor-pointer hover:file:bg-sky-100 transition text-[11px] text-slate-400"
                                    />
                                </div>
                            </div>

                            {/* Import Error Banner */}
                            {importError && (
                                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-450 font-bold flex items-center gap-2">
                                    <AlertTriangle size={14} className="shrink-0 animate-bounce" />
                                    <span>{importError}</span>
                                </div>
                            )}

                            {/* Import Success Result Box */}
                            {importSuccessResult && (
                                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-450 font-semibold flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5 font-bold text-xs uppercase text-emerald-700 dark:text-emerald-400">
                                        <Check size={14} />
                                        <span>¡Importación finalizada con éxito!</span>
                                    </div>
                                    <p className="text-[11px] text-emerald-600/90 dark:text-emerald-400/80 mt-1">
                                        Resultados: {importSuccessResult.inserted} nuevos registrados, {importSuccessResult.updated} actualizados, {importSuccessResult.skipped} filas omitidas.
                                    </p>
                                </div>
                            )}

                            {/* Preview Table of Detected Rows */}
                            {importedProducts.length > 0 && !importSuccessResult && (
                                <div className="flex flex-col gap-2 mt-2">
                                    <div className="flex justify-between items-center pb-1">
                                        <span className="font-black uppercase text-[10px] text-slate-500 tracking-wider">Vista Previa de Artículos Detectados ({importedProducts.length}):</span>
                                        <button 
                                            onClick={() => setImportedProducts([])}
                                            className="text-[10px] text-rose-500 font-extrabold uppercase hover:underline"
                                        >
                                            Limpiar lista
                                        </button>
                                    </div>
                                    
                                    <div className="border border-slate-150 dark:border-slate-850 rounded-2xl overflow-hidden max-h-56 overflow-y-auto bg-slate-50/50 dark:bg-black/10">
                                        <table className="w-full text-left text-[11px] border-collapse">
                                            <thead className="bg-slate-100 dark:bg-slate-900 font-black uppercase text-slate-500 border-b border-slate-150 dark:border-slate-800 sticky top-0">
                                                <tr>
                                                    <th className="p-2.5">Código / SKU</th>
                                                    <th className="p-2.5">Nombre del Artículo</th>
                                                    <th className="p-2.5">Categoría</th>
                                                    <th className="p-2.5 text-right">Precio Detalle</th>
                                                    <th className="p-2.5 text-right">Stock</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-150 dark:divide-slate-850 font-semibold">
                                                {importedProducts.slice(0, 100).map((p, idx) => (
                                                    <tr key={idx} className="hover:bg-white dark:hover:bg-[#111625]/40 transition">
                                                        <td className="p-2.5 font-mono text-slate-450 font-extrabold">{p.sku}</td>
                                                        <td className="p-2.5 text-slate-800 dark:text-slate-200 uppercase">{p.name}</td>
                                                        <td className="p-2.5 text-slate-500">{p.category}</td>
                                                        <td className="p-2.5 text-right font-mono text-blue-600 dark:text-blue-400 font-extrabold">Bs. {Number(p.price_unit || 0).toFixed(2)}</td>
                                                        <td className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">{p.stock} pz</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {importedProducts.length > 100 && (
                                            <div className="p-2.5 text-center text-[10px] text-slate-400 border-t border-slate-150 dark:border-slate-850 bg-white dark:bg-[#0c111e]">
                                                ... y {importedProducts.length - 100} artículos más en cola de importación.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Modal Footer Actions */}
                        <div className="border-t border-slate-100 dark:border-slate-850 pt-4 flex justify-end gap-2.5 shrink-0">
                            <button 
                                onClick={() => setIsImportModalOpen(false)}
                                className="py-2 px-4.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl cursor-pointer transition-all"
                            >
                                {importSuccessResult ? 'Cerrar' : 'Cancelar'}
                            </button>
                            {importedProducts.length > 0 && !importSuccessResult && (
                                <button 
                                    onClick={executeBulkImport}
                                    disabled={isImporting}
                                    className="py-2 px-5 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-600/40 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                                >
                                    {isImporting ? (
                                        <>
                                            <RefreshCw size={12} className="animate-spin" />
                                            <span>Importando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check size={12} />
                                            <span>Confirmar Importación Masiva</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                    </div>
                </div>
            )}

            {/* TRACE TICKET DETAILS MODAL */}
            {showTraceTicketModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200 dark:border-slate-850 w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50 dark:bg-[#070c14]/30">
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="text-indigo-600 dark:text-indigo-400" size={18} />
                                <span className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                    Trazabilidad: Detalle de Ticket #{traceTicketId}
                                </span>
                            </div>
                            <button 
                                onClick={() => setShowTraceTicketModal(false)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
                            {loadingTraceTicket ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <RefreshCw size={24} className="text-indigo-500 animate-spin" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando datos del ticket de venta...</span>
                                </div>
                            ) : !traceTicketDetails ? (
                                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                                    <AlertTriangle className="text-amber-500" size={32} />
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-350">Error al cargar</span>
                                    <p className="text-[11px] text-slate-400 max-w-sm">No se encontraron los datos generales o históricos para el ticket seleccionado.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Ticket General Metadata */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-[#070c14]/40 border border-slate-150 dark:border-slate-850/60 p-4 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-350">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[8.5px] uppercase text-slate-400 tracking-wider font-semibold">Fecha de Emisión</span>
                                            <span className="text-slate-800 dark:text-slate-200">{new Date(traceTicketDetails.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[8.5px] uppercase text-slate-400 tracking-wider font-semibold">Atendido por</span>
                                            <span className="text-slate-800 dark:text-slate-200 uppercase">@{traceTicketDetails.user_name || 'Cajero'}</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[8.5px] uppercase text-slate-400 tracking-wider font-semibold">Método de Pago</span>
                                            <span className="text-indigo-600 dark:text-indigo-400 uppercase">{traceTicketDetails.payment_method}</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[8.5px] uppercase text-slate-400 tracking-wider font-semibold">Cliente de Registro</span>
                                            <span className="text-slate-800 dark:text-slate-200 truncate">{traceTicketDetails.client_name || 'Al Público'}</span>
                                        </div>
                                    </div>

                                    {/* Products Table */}
                                    <div className="flex flex-col gap-2.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                                            <span>Detalle de Artículos Vendidos en la misma Transacción</span>
                                            <span className="bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono text-[9px]">{traceTicketItems.length} items</span>
                                        </span>

                                        <div className="border border-slate-200/80 dark:border-slate-850/80 rounded-2xl overflow-hidden bg-white dark:bg-[#0c111e]">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-[#070c14]/30 border-b border-slate-150 dark:border-slate-850/80 text-[8.5px] font-black uppercase text-slate-400 tracking-wider font-mono">
                                                        <th className="p-3">Artículo</th>
                                                        <th className="p-3 text-center">Cant</th>
                                                        <th className="p-3 text-right">Precio Pz</th>
                                                        <th className="p-3 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {traceTicketItems.map((item) => {
                                                        const isCurrentProduct = Number(item.product_id) === Number(expandedProductId);
                                                        return (
                                                            <tr 
                                                                key={item.id} 
                                                                className={`border-b border-slate-100 dark:border-slate-850/40 last:border-0 ${
                                                                    isCurrentProduct 
                                                                        ? 'bg-indigo-50/30 dark:bg-indigo-950/20 font-extrabold text-indigo-950 dark:text-indigo-100 border-l-4 border-l-indigo-500' 
                                                                        : 'text-slate-600 dark:text-slate-300'
                                                                }`}
                                                            >
                                                                <td className="p-3">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-semibold text-xs">{item.product_name || 'Producto'}</span>
                                                                        <span className="text-[8.5px] font-mono text-slate-400 mt-0.5">SKU: {item.sku || 'N/A'}</span>
                                                                        {isCurrentProduct && (
                                                                            <span className="inline-flex mt-1 text-[8px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-md font-black uppercase w-max tracking-wide">
                                                                                Artículo en Consulta
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 text-center font-mono">{item.quantity} pz</td>
                                                                <td className="p-3 text-right font-mono">
                                                                    {traceTicketDetails.currency === 'USD' ? '$' : 'Bs.'}{item.price?.toFixed(2)}
                                                                </td>
                                                                <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">
                                                                    {traceTicketDetails.currency === 'USD' ? '$' : 'Bs.'}{(item.quantity * item.price)?.toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Financial Summary */}
                                    <div className="flex flex-col gap-2.5 bg-slate-50 dark:bg-[#070c14]/20 border border-slate-150 dark:border-slate-850/60 p-5 rounded-2xl text-xs font-bold mt-2">
                                        <div className="flex items-center justify-between text-slate-500">
                                            <span>Subtotal Bruto:</span>
                                            <span className="font-mono text-slate-700 dark:text-slate-300">
                                                {traceTicketDetails.currency === 'USD' ? '$' : 'Bs.'}{(traceTicketDetails.total + traceTicketDetails.discount).toFixed(2)}
                                            </span>
                                        </div>
                                        {traceTicketDetails.discount > 0 && (
                                            <div className="flex items-center justify-between text-emerald-500">
                                                <span>Descuento Aplicado:</span>
                                                <span className="font-mono">
                                                    -{traceTicketDetails.currency === 'USD' ? '$' : 'Bs.'}{traceTicketDetails.discount.toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-base font-black border-t border-slate-200 dark:border-slate-800 pt-2.5 text-slate-800 dark:text-white">
                                            <span>Total Transado:</span>
                                            <span className="font-mono text-indigo-600 dark:text-indigo-400">
                                                {traceTicketDetails.currency === 'USD' ? '$' : 'Bs.'}{traceTicketDetails.total.toFixed(2)} {traceTicketDetails.currency}
                                            </span>
                                        </div>
                                        {traceTicketDetails.currency === 'BOB' && exchangeRate && (
                                            <div className="text-[10px] text-slate-400 flex items-center justify-between font-medium border-t border-slate-150 dark:border-slate-850 pt-2">
                                                <span>Conversión Referencial (Tipo de Cambio: {exchangeRate}):</span>
                                                <span className="font-mono font-bold">${(traceTicketDetails.total / exchangeRate).toFixed(2)} USD</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-850 flex justify-end bg-slate-50 dark:bg-[#070c14]/20">
                            <button 
                                onClick={() => setShowTraceTicketModal(false)}
                                className="py-2 px-5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl cursor-pointer shadow-md transition-all uppercase tracking-wider"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DEDICATED STOCK HISTORY MODAL */}
            {showStockHistoryModal && stockHistoryProduct && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200 dark:border-slate-850 w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50 dark:bg-[#070c14]/30">
                            <div className="flex items-center gap-2">
                                <History className="text-indigo-600 dark:text-indigo-400" size={18} />
                                <span className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                    Historial de Cambios de Stock: {stockHistoryProduct.name}
                                </span>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowStockHistoryModal(false);
                                    setStockHistoryProduct(null);
                                    setModalAuditHistory([]);
                                }}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
                            {/* Product Quick Info Card */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-[#070c14]/40 border border-slate-150 dark:border-slate-850/60 p-4 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-350">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[8.5px] uppercase text-slate-400 tracking-wider font-semibold">Código SKU</span>
                                    <span className="text-slate-800 dark:text-slate-200 font-mono font-black">{stockHistoryProduct.sku}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[8.5px] uppercase text-slate-400 tracking-wider font-semibold">Categoría</span>
                                    <span className="text-slate-800 dark:text-slate-200 uppercase">{stockHistoryProduct.category}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[8.5px] uppercase text-slate-400 tracking-wider font-semibold">Stock Actual</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{stockHistoryProduct.stock} unidades</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[8.5px] uppercase text-slate-400 tracking-wider font-semibold">Precio Detalle</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">${(Number(stockHistoryProduct.price_unit) || 0).toFixed(2)} USD</span>
                                </div>
                            </div>

                            {/* Filters Tab Inside Modal */}
                            <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 w-fit">
                                <button
                                    type="button"
                                    onClick={() => setSelectedModalHistoryTab('todos')}
                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                        selectedModalHistoryTab === 'todos'
                                            ? 'bg-white dark:bg-[#12192d] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/20'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                                    }`}
                                >
                                    Todos ({modalAuditHistory.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedModalHistoryTab('ingresos')}
                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                        selectedModalHistoryTab === 'ingresos'
                                            ? 'bg-white dark:bg-[#12192d] text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/20'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                                    }`}
                                >
                                    Ingresos ({modalAuditHistory.filter(log => ['ingreso_compra', 'ingreso_devolucion', 'ajuste_incremento', 'creacion_producto'].includes(log.type) || (log.type === 'INVENTORY_MANUAL_ADJUSTMENT' && log.quantity_changed > 0)).length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedModalHistoryTab('salidas')}
                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                        selectedModalHistoryTab === 'salidas'
                                            ? 'bg-white dark:bg-[#12192d] text-amber-600 dark:text-amber-400 shadow-sm border border-slate-200/20'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                                    }`}
                                >
                                    Salidas ({modalAuditHistory.filter(log => ['salida_venta', 'ajuste_decremento'].includes(log.type) || (log.type === 'INVENTORY_MANUAL_ADJUSTMENT' && log.quantity_changed < 0)).length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedModalHistoryTab('precios')}
                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                        selectedModalHistoryTab === 'precios'
                                            ? 'bg-white dark:bg-[#12192d] text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200/20'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                                    }`}
                                >
                                    Precios/Costos ({modalAuditHistory.filter(log => ['cambio_precio', 'cambio_costo'].includes(log.type) || (log.changed_fields && (log.changed_fields.price_unit !== undefined || log.changed_fields.price_bulk !== undefined || log.changed_fields.price_cost !== undefined)) || (log.price_before !== null && log.price_after !== null && log.price_before !== log.price_after)).length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedModalHistoryTab('cantidades')}
                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                        selectedModalHistoryTab === 'cantidades'
                                            ? 'bg-white dark:bg-[#12192d] text-pink-600 dark:text-pink-400 shadow-sm border border-slate-200/20'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                                    }`}
                                >
                                    Cantidades ({modalAuditHistory.filter(log => ['ajuste_incremento', 'ajuste_decremento', 'INVENTORY_MANUAL_ADJUSTMENT'].includes(log.type) || (log.quantity_before !== null && log.quantity_after !== null && log.quantity_before !== log.quantity_after) || ['ingreso_compra', 'ingreso_devolucion', 'salida_venta', 'creacion_producto'].includes(log.type)).length})
                                </button>
                            </div>

                            {/* Logs Rendering */}
                            {loadingModalHistory ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <RefreshCw size={24} className="text-indigo-500 animate-spin" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando trazabilidad del kárdex de stock...</span>
                                </div>
                            ) : modalAuditHistory.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-wider bg-slate-50 dark:bg-[#080d16]/30 border border-dashed border-slate-200 dark:border-slate-850 p-6 rounded-2xl">
                                    No se encontraron registros de movimiento para este producto.
                                </div>
                            ) : (() => {
                                let filtered = modalAuditHistory;
                                if (selectedModalHistoryTab === 'ingresos') {
                                    filtered = modalAuditHistory.filter(log => ['ingreso_compra', 'ingreso_devolucion', 'ajuste_incremento', 'creacion_producto'].includes(log.type) || (log.type === 'INVENTORY_MANUAL_ADJUSTMENT' && log.quantity_changed > 0));
                                } else if (selectedModalHistoryTab === 'salidas') {
                                    filtered = modalAuditHistory.filter(log => ['salida_venta', 'ajuste_decremento'].includes(log.type) || (log.type === 'INVENTORY_MANUAL_ADJUSTMENT' && log.quantity_changed < 0));
                                } else if (selectedModalHistoryTab === 'precios') {
                                    filtered = modalAuditHistory.filter(log => ['cambio_precio', 'cambio_costo'].includes(log.type) || (log.changed_fields && (log.changed_fields.price_unit !== undefined || log.changed_fields.price_bulk !== undefined || log.changed_fields.price_cost !== undefined)) || (log.price_before !== null && log.price_after !== null && log.price_before !== log.price_after));
                                } else if (selectedModalHistoryTab === 'cantidades') {
                                    filtered = modalAuditHistory.filter(log => ['ajuste_incremento', 'ajuste_decremento', 'INVENTORY_MANUAL_ADJUSTMENT'].includes(log.type) || (log.quantity_before !== null && log.quantity_after !== null && log.quantity_before !== log.quantity_after) || ['ingreso_compra', 'ingreso_devolucion', 'salida_venta', 'creacion_producto'].includes(log.type));
                                }

                                if (filtered.length === 0) {
                                    return (
                                        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-wider bg-slate-50 dark:bg-[#080d16]/30 border border-dashed border-slate-200 dark:border-slate-850 p-6 rounded-2xl">
                                            No hay movimientos de tipo &ldquo;{selectedModalHistoryTab}&rdquo; registrados.
                                        </div>
                                    );
                                }

                                return (
                                    <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
                                        {filtered.map((log) => {
                                            let actionLabel = 'Modificación de Producto';
                                            let actionBadgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-850/80 dark:text-slate-300';
                                            let iconEl = <Tag size={13} />;
                                            let sideDiffText = '';
                                            let sideDiffClass = 'text-slate-500';

                                            if (log.type === 'ingreso_compra') {
                                                actionLabel = 'Compra de Existencias';
                                                actionBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 border border-emerald-500/20';
                                                iconEl = <ArrowDownLeft size={13} />;
                                                sideDiffText = `+${log.quantity} pz`;
                                                sideDiffClass = 'text-emerald-600 dark:text-emerald-400';
                                            } else if (log.type === 'ingreso_devolucion') {
                                                actionLabel = 'Devolución de Cliente';
                                                actionBadgeClass = 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/5 dark:text-teal-400 border border-teal-500/20';
                                                iconEl = <RefreshCw size={13} />;
                                                sideDiffText = `+${log.quantity} pz`;
                                                sideDiffClass = 'text-teal-600 dark:text-teal-400';
                                            } else if (log.type === 'ajuste_incremento') {
                                                actionLabel = 'Ajuste de Inventario (+)';
                                                actionBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 border border-emerald-500/20';
                                                iconEl = <ArrowDownLeft size={13} />;
                                                sideDiffText = `+${log.quantity} pz`;
                                                sideDiffClass = 'text-emerald-600 dark:text-emerald-400';
                                            } else if (log.type === 'ajuste_decremento') {
                                                actionLabel = 'Ajuste de Inventario (-)';
                                                actionBadgeClass = 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/5 dark:text-amber-400 border border-amber-500/20';
                                                iconEl = <ArrowUpRight size={13} />;
                                                sideDiffText = `-${log.quantity} pz`;
                                                sideDiffClass = 'text-amber-600 dark:text-amber-400';
                                            } else if (log.type === 'salida_venta') {
                                                actionLabel = 'Venta Realizada';
                                                actionBadgeClass = 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/5 dark:text-indigo-400 border border-indigo-500/20';
                                                iconEl = <ShoppingBag size={13} />;
                                                sideDiffText = `-${log.quantity} pz`;
                                                sideDiffClass = 'text-indigo-600 dark:text-indigo-400 font-bold';
                                            } else if (log.type === 'cambio_precio') {
                                                actionLabel = 'Cambio de Precio de Venta';
                                                actionBadgeClass = 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/5 dark:text-cyan-400 border border-cyan-500/20';
                                                iconEl = <DollarSign size={13} />;
                                            } else if (log.type === 'cambio_costo') {
                                                actionLabel = 'Ajuste de Costo de Compra';
                                                actionBadgeClass = 'bg-pink-500/10 text-pink-600 dark:bg-pink-500/5 dark:text-pink-400 border border-pink-500/20';
                                                iconEl = <DollarSign size={13} />;
                                            } else if (log.type === 'creacion_producto') {
                                                actionLabel = 'Creación de Producto';
                                                actionBadgeClass = 'bg-[#4f46e5]/10 text-[#4f46e5] dark:bg-[#4f46e5]/5 dark:text-[#818cf8] border border-[#4f46e5]/20';
                                                iconEl = <Plus size={13} />;
                                                sideDiffText = `+${log.quantity || 0} pz`;
                                                sideDiffClass = 'text-[#4f46e5] dark:text-[#818cf8] font-bold';
                                            } else if (log.type === 'INVENTORY_MANUAL_ADJUSTMENT') {
                                                const isInc = log.quantity_changed > 0;
                                                actionLabel = `Ajuste Físico (${isInc ? '+' : '-'})`;
                                                actionBadgeClass = isInc 
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 border border-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/5 dark:text-amber-400 border border-amber-500/20';
                                                iconEl = isInc ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />;
                                                sideDiffText = `${isInc ? '+' : ''}${log.quantity_changed} pz`;
                                                sideDiffClass = isInc ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';
                                            }

                                            const hasPriceUnitChange = log.price_before !== null && log.price_after !== null && log.price_before !== log.price_after;
                                            const beforeFields = log.changed_fields;

                                            return (
                                                <div 
                                                    key={log.id}
                                                    className="flex flex-col sm:flex-row sm:items-start justify-between p-4 bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-150 dark:border-slate-850/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-800 transition-all duration-150 gap-3"
                                                >
                                                    <div className="flex items-start gap-3.5 flex-1">
                                                        <div className={`p-2 rounded-xl shrink-0 ${actionBadgeClass}`}>
                                                            {iconEl}
                                                        </div>

                                                        <div className="flex flex-col flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-[10px] font-black text-slate-850 dark:text-slate-150 uppercase tracking-wide leading-none">
                                                                    {actionLabel}
                                                                </span>
                                                                {log.reference && (
                                                                    <span className="font-mono text-[8px] bg-slate-100 dark:bg-slate-850 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 font-bold">
                                                                        {log.reference}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <p className="text-[9.5px] text-slate-600 dark:text-slate-350 font-bold mt-1.5">
                                                                {log.notes || 'Movimiento de almacén registrado en sistema.'}
                                                            </p>

                                                            {/* Stock levels and differentials */}
                                                            {log.quantity_before !== null && log.quantity_after !== null && (
                                                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[8.5px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#070c14]/40 p-2 rounded-xl border border-slate-100 dark:border-slate-850/40 w-fit">
                                                                    <span>Antes: <span className="font-mono font-black text-slate-800 dark:text-slate-200">{log.quantity_before} pz</span></span>
                                                                    <span className="text-slate-300 dark:text-slate-750">→</span>
                                                                    <span>Después: <span className="font-mono font-black text-slate-800 dark:text-slate-200">{log.quantity_after} pz</span></span>
                                                                    <span className="text-slate-350 dark:text-slate-750">•</span>
                                                                    <span className={`font-mono font-black ${log.quantity_after >= log.quantity_before ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                                        Dif: {log.quantity_after - log.quantity_before > 0 ? '+' : ''}{log.quantity_after - log.quantity_before} pz
                                                                    </span>
                                                                </div>
                                                            )}

                                                            <div className="flex flex-wrap sm:items-center gap-x-2.5 gap-y-1 text-[8px] text-slate-400 font-bold mt-2 border-t border-slate-100 dark:border-slate-850/60 pt-2">
                                                                <span className="flex items-center gap-1">
                                                                    <Clock size={8.5} className="shrink-0" /> {new Date(log.created_at).toLocaleString()}
                                                                </span>
                                                                <span className="hidden sm:inline text-slate-300 dark:text-slate-750">•</span>
                                                                <span className="flex items-center gap-1 uppercase">
                                                                    <User size={8.5} className="shrink-0" /> {log.username || 'admin'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {sideDiffText && (
                                                        <div className="flex flex-col items-end shrink-0 pl-1">
                                                            <span className={`text-[11px] font-black font-mono ${sideDiffClass}`}>
                                                                {sideDiffText}
                                                            </span>
                                                            <span className="text-[8px] text-slate-400 dark:text-slate-500 font-mono font-bold mt-0.5">
                                                                Valuado: {log.price !== undefined ? `$${(log.price || 0).toFixed(2)}` : 'N/A'}
                                                            </span>
                                                            {exchangeRate && log.price !== undefined && (
                                                                <span className="text-[7.5px] text-slate-400 font-mono mt-0.5 font-semibold">
                                                                    (Bs. {((log.price || 0) * exchangeRate).toFixed(2)})
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-[#070c14]/30 border-t border-slate-100 dark:border-slate-850 flex items-center justify-end">
                            <button
                                onClick={() => {
                                    setShowStockHistoryModal(false);
                                    setStockHistoryProduct(null);
                                    setModalAuditHistory([]);
                                }}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-750"
                            >
                                Cerrar Historial
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
