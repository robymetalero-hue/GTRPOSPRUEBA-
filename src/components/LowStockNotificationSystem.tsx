import { createSafeCustomEvent } from "../utils/events";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { 
    AlertTriangle, ChevronDown, ChevronUp, Plus, Check, RefreshCw, 
    ArrowUpRight, Package, AlertCircle, ShoppingCart, HelpCircle
} from 'lucide-react';

export default function LowStockNotificationSystem() {
    const { products, fetchProducts, user } = useAppContext();
    const [isExpanded, setIsExpanded] = useState(false);
    const [restockingId, setRestockingId] = useState<number | null>(null);
    const [restockQty, setRestockQty] = useState<string>('');
    const [restockPrice, setRestockPrice] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Filter low stock items: current stock <= stock_alarm
    const lowStockItems = products.filter(p => p.stock <= p.stock_alarm);
    
    // Only display warning badge / panel for Administrator
    if (user?.role !== 'admin') {
        return null;
    }

    const handleRestock = async (productId: number, basePrice: number) => {
        const qty = parseInt(restockQty);
        if (isNaN(qty) || qty <= 0) {
            setStatusMessage({ text: "Cantidad inválida", type: 'error' });
            return;
        }

        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            const price = restockPrice.trim() ? parseFloat(restockPrice) : basePrice;
            const res = await fetch('/api/stock-arrivals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: productId,
                    quantity: qty,
                    arrival_price: isNaN(price) ? basePrice : price
                })
            });

            if (res.ok) {
                setStatusMessage({ text: "¡Stock ingresado exitosamente!", type: 'success' });
                setRestockQty('');
                setRestockPrice('');
                setRestockingId(null);
                await fetchProducts();
            } else {
                const errData = await res.json();
                setStatusMessage({ text: errData.error || "Error al ingresar stock", type: 'error' });
            }
        } catch (e) {
            setStatusMessage({ text: "Error de conexión", type: 'error' });
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setStatusMessage(null), 4000);
        }
    };

    if (lowStockItems.length === 0) {
        return (
            <div className="bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 p-4 rounded-3xl flex items-center justify-between text-emerald-800 dark:text-emerald-400">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-xl">
                        <Check className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider font-sans">Nivel de Stock Óptimo</h4>
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Todos los productos del almacén se encuentran con existencias suficientes.</p>
                    </div>
                </div>
                <div className="text-[10px] font-mono bg-emerald-500/20 px-2.5 py-1 rounded-lg font-bold">
                    OK
                </div>
            </div>
        );
    }

    return (
        <div 
            className="bg-amber-500/5 border border-amber-500/20 dark:border-amber-500/30 p-4 rounded-3xl flex flex-col gap-3 transition-all duration-300 relative overflow-hidden"
            id="low-stock-notification-panel"
        >
            {/* Header / Summary row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl animate-pulse">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 font-sans flex items-center gap-2">
                            Alerta de Inventario
                            <span className="px-2 py-0.5 bg-amber-500 text-white dark:text-slate-950 font-black text-[9px] rounded-full font-mono tracking-tight shrink-0">
                                {lowStockItems.length} BAJO
                            </span>
                        </h4>
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                            Hay artículos cuyas existencias han alcanzado o descendido del nivel mínimo establecido.
                        </p>
                    </div>
                </div>
                
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="py-1.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase rounded-xl transition hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300"
                >
                    <span>{isExpanded ? 'Ocultar Detalles' : 'Ver Artículos'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Expanded items list */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden border-t border-amber-500/10 dark:border-amber-500/20 pt-3 mt-1"
                    >
                        {statusMessage && (
                            <div className={`text-[10px] font-bold p-2.5 rounded-xl mb-3 flex items-center gap-1.5 ${
                                statusMessage.type === 'success' 
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}>
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{statusMessage.text}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[300px] overflow-y-auto pr-1">
                            {lowStockItems.map(p => {
                                const isRestocking = restockingId === p.id;
                                return (
                                    <div 
                                        key={p.id}
                                        className="bg-white dark:bg-[#0c111e]/60 border border-slate-100 dark:border-slate-850/60 p-3 rounded-2xl flex flex-col justify-between gap-3 shadow-xs hover:border-amber-500/30 transition-all duration-200"
                                    >
                                        <div className="flex items-start gap-2.5">
                                            {p.image ? (
                                                <img 
                                                    src={p.image} 
                                                    alt={p.name}
                                                    referrerPolicy="no-referrer"
                                                    className="w-10 h-10 object-cover rounded-xl shrink-0 border border-slate-100 dark:border-slate-800"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-850 flex items-center justify-center shrink-0 text-slate-400">
                                                    <Package className="w-5 h-5" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-1.5">
                                                    <span className="font-sans font-black text-xs text-slate-800 dark:text-slate-100 truncate block">
                                                        {p.name}
                                                    </span>
                                                    <span className="text-[8px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold shrink-0">
                                                        {p.sku || 'S/SKU'}
                                                    </span>
                                                </div>
                                                <p className="text-[9px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wider">{p.category}</p>
                                                
                                                <div className="flex items-center gap-3 mt-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-mono text-slate-400 uppercase font-bold">Disponible</span>
                                                        <span className="text-xs font-mono font-black text-rose-500">{p.stock} u.</span>
                                                    </div>
                                                    <div className="w-px h-5 bg-slate-100 dark:bg-slate-850" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-mono text-slate-400 uppercase font-bold">Límite Alerta</span>
                                                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">{p.stock_alarm} u.</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Restock interactive controls */}
                                        <div className="border-t border-slate-100 dark:border-slate-850/60 pt-2.5 mt-1 flex items-center justify-between gap-2">
                                            {isRestocking ? (
                                                <div className="flex items-center gap-1.5 w-full">
                                                    <div className="flex flex-col flex-1 gap-1">
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Cant. Ingreso</span>
                                                        <input 
                                                            type="number" 
                                                            min="1"
                                                            placeholder="Cant"
                                                            value={restockQty}
                                                            onChange={e => setRestockQty(e.target.value)}
                                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-center font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col flex-1 gap-1">
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Costo Unit. (Opcional)</span>
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            placeholder={`Bs. ${p.price_cost}`}
                                                            value={restockPrice}
                                                            onChange={e => setRestockPrice(e.target.value)}
                                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-center font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                    <div className="flex gap-1 self-end">
                                                        <button
                                                            disabled={isSubmitting}
                                                            onClick={() => handleRestock(p.id, p.price_cost)}
                                                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
                                                            title="Confirmar Ingreso"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setRestockingId(null);
                                                                setRestockQty('');
                                                                setRestockPrice('');
                                                            }}
                                                            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 rounded-lg transition cursor-pointer"
                                                            title="Cancelar"
                                                        >
                                                            <ChevronUp className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            // Dispatch custom event or fill search so user can check
                                                            const customEvt = createSafeCustomEvent('search-inventory-sku', { detail: p.sku });
                                                            window.dispatchEvent(customEvt);
                                                        }}
                                                        className="py-1.5 px-3 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                                                    >
                                                        <Package className="w-3 h-3 text-indigo-500" />
                                                        <span>Localizar en Almacén</span>
                                                    </button>
                                                    
                                                    <button
                                                        onClick={() => {
                                                            setRestockingId(p.id);
                                                            setRestockQty('10'); // Default suggestion
                                                        }}
                                                        className="py-1.5 px-3 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        <span>Ingreso Rápido</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
