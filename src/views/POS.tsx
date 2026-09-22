import { filterAndRankProducts } from "../lib/searchUtils";
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { hasPermission } from '../utils/permissions';
import type { Product } from '../types';
import { 
    ShoppingCart, Plus, Minus, Trash2, Printer, Search, UserCheck, 
    AlertTriangle, CreditCard, DollarSign, Camera, X, ClipboardCheck,
    Coins, HelpCircle, ChevronRight, ChevronDown, ShoppingBag, Grid, List, LayoutGrid,
    CheckCircle2, ArrowLeftRight, QrCode, History, Eye, Star, FileText, Sparkles, Download, Check, Clock, Truck, Lock, Loader2,
    RotateCcw, ShieldAlert, Maximize2, Package
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import OfflineStatusHUD from '../components/OfflineStatusHUD';
import { saveOfflineSale, saveOfflineAction } from '../utils/offlineStorage';
import { useElasticScroll } from '../utils/touchScroll';
import { safeDispatchEvent } from '../utils/events';

interface SaleTab {
    id: number;
    name: string;
    cart: any[];
    clientName: string;
    clientPhone: string;
    discount: number;
    discountType: 'monto' | 'porcentaje';
    paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Crédito';
}

const triggerVibrate = (pattern: number | number[] = 40) => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
            window.navigator.vibrate(pattern);
        } catch (e) {
            // Silence error in case of permission/iframe restrictions
        }
    }
};


// --- Optimized Search Input with Live Suggestions ---
const POSSearchInput = React.memo(({ 
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

    // Sync with external clear (when initialValue becomes empty)
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
        <div ref={containerRef} className="relative flex-1 w-full min-w-[200px] sm:min-w-[280px]">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none z-10">
                {isSearching ? (
                    <Loader2 size={16} className="animate-spin text-indigo-500" />
                ) : (
                    <Search size={16} />
                )}
            </span>
            <input 
                ref={inputRef}
                type="text" 
                id="search-input"
                placeholder="Buscar por artículo, SKU, #ID, marca o categoría..." 
                className="pl-10 pr-9 py-2.5 w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white text-xs sm:text-sm transition placeholder-slate-400 font-semibold shadow-inner"
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

            {/* Live Autocomplete Suggestions Dropdown */}
            {showSuggestions && localVal.trim().length > 0 && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#0e1424] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-slate-100/80 dark:bg-slate-850/80 border-b border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <span>Sugerencias ({Math.min(suggestions.length, 8)})</span>
                        <span className="text-[9px] lowercase text-slate-400 font-normal">Click o Enter para agregar</span>
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
                                <div className="text-right shrink-0 flex items-center gap-2">
                                    <div>
                                        <div className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                                            Bs. {priceBs}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono">
                                            ${prod.price_unit.toFixed(2)} USD
                                        </div>
                                    </div>
                                    <span className="hidden sm:inline-block px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold shadow-xs">
                                        + Agregar
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});

export default function POS() {
    const { 
        products, fetchProducts, cart, addToCart: rawAddToCart, updateCartItemQuantity: rawUpdateCartItemQuantity, 
        removeFromCart, clearCart, lastClearedCart, cartBackup, restoreLastClearedCart, restoreCartBackup, discardCartBackup, updateCartItemPrice, user, kioskMode, exchangeRate, 
        roundBs, receiptTemplate, clients, fetchClients,
        tabs, setTabs, activeTabId, setActiveTabId,
        clientName, setClientName, clientPhone, setClientPhone,
        discount, setDiscount, discountType, setDiscountType,
        paymentMethod, setPaymentMethod, departments, fetchDepartments,
        hasMoreProducts, loadMoreProducts,
        deductLocalProductStock, registerLocalClient
    } = useAppContext();

    const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
    const [visibleCatalogLimit, setVisibleCatalogLimit] = useState(48);
    const executeCheckoutRef = useRef<any>(null);
    const isKioskLocked = (kioskMode || (user && user.role === 'vendedor')) && user?.role !== 'admin' && user?.role !== 'propietario';


    const catalogScroll = useElasticScroll(true);
    const cartScroll = useElasticScroll(true);

    const addToCart = (product: any, quantity: number = 1) => {
        const existingInCart = cart.find((item: any) => item.id === product.id);
        const currentQty = existingInCart ? existingInCart.cartQuantity : 0;
        const targetQty = currentQty + quantity;

        if (quantity > 0) {
            if (product.stock <= 0) {
                triggerVibrate([50, 50, 50]);
                showNotification(`⚠️ El artículo "${product.name}" no tiene stock disponible (0 unidades).`, 'error');
                return;
            }
            if (targetQty > product.stock) {
                triggerVibrate([50, 50, 50]);
                showNotification(`⚠️ No es posible agregar más unidades. El stock disponible de "${product.name}" es de ${product.stock} unidades (ya tienes ${currentQty} en el carrito).`, 'error');
                return;
            }
        }
        triggerVibrate(30);
        rawAddToCart(product, quantity);
    };

    const updateCartItemQuantity = (productId: number, qty: number) => {
        const product = products.find((p: any) => p.id === productId);
        if (product && qty > 0) {
            if (product.stock <= 0) {
                triggerVibrate([50, 50, 50]);
                showNotification(`⚠️ El artículo "${product.name}" no tiene stock disponible (0 unidades).`, 'error');
                rawUpdateCartItemQuantity(productId, 0);
                return;
            }
            if (qty > product.stock) {
                triggerVibrate([50, 50, 50]);
                showNotification(`⚠️ No es posible establecer esa cantidad. El stock disponible de "${product.name}" es de ${product.stock} unidades.`, 'error');
                rawUpdateCartItemQuantity(productId, product.stock);
                return;
            }
        }
        triggerVibrate(30);
        rawUpdateCartItemQuantity(productId, qty);
    };
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 150);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        fetchProducts(debouncedSearch);
    }, [debouncedSearch]);

    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("Todos");
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

    const [receiptConfirmation, setReceiptConfirmation] = useState<{
        saleId: number | string;
        total: number;
        currency: 'BOB' | 'USD';
        itemsCount: number;
        paymentMethod: string;
        items: any[];
        clientName: string;
        clientPhone: string;
        discountValue: number;
        discount: number;
        discountType: 'monto' | 'porcentaje';
        pointsRedeemedValue: number;
        subtotal: number;
        exchangeRate: number;
        cashReceived: string;
        destination?: string;
    } | null>(null);
    
    // Density/Layout mode for high product visibility
    const [viewLayoutMode, setViewLayoutMode] = useState<'grid' | 'compact-grid' | 'list'>(() => {
        try {
            return (localStorage.getItem('pos_view_layout_mode') as 'grid' | 'compact-grid' | 'list') || 'grid';
        } catch (_) {
            return 'grid';
        }
    });

    const handleLayoutModeChange = (mode: 'grid' | 'compact-grid' | 'list') => {
        triggerVibrate(20);
        setViewLayoutMode(mode);
        try {
            localStorage.setItem('pos_view_layout_mode', mode);
        } catch (_) {}
    };

    // Product fuzzy matching engine for natural language parsing
    function findBestProductMatch<T extends { name: string; sku?: string; stock?: number }>(items: T[], query: string): T | undefined {
        if (!query) return undefined;
        const normalizedQuery = query.toLowerCase().trim();
        const exactSku = items.find(item => item.sku && item.sku.toLowerCase().trim() === normalizedQuery);
        if (exactSku) return exactSku;

        const exactName = items.find(item => item.name.toLowerCase().trim() === normalizedQuery);
        if (exactName) return exactName;

        const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
        if (queryWords.length === 0) return undefined;

        let bestItem: T | undefined = undefined;
        let bestScore = -100000;

        for (const item of items) {
            const itemNameLower = item.name.toLowerCase();
            const itemWords = itemNameLower.split(/\s+/).filter(w => w.length > 0);
            
            let matchCount = 0;
            let missingCount = 0;
            
            for (const qw of queryWords) {
                if (itemNameLower.includes(qw)) {
                    matchCount++;
                } else {
                    missingCount++;
                }
            }

            if (matchCount === 0) continue;

            let extraCount = 0;
            for (const iw of itemWords) {
                if (!queryWords.includes(iw)) {
                    extraCount++;
                }
            }

            let score = (matchCount * 10) - (missingCount * 50) - (extraCount * 1.5);
            if (itemNameLower.includes(normalizedQuery)) {
                score += 15;
            }

            if (score > bestScore) {
                bestScore = score;
                bestItem = item;
            }
        }

        return bestScore > -20 ? bestItem : undefined;
    }

    // Inline AI Command Bar state
    const [aiCommandText, setAiCommandText] = useState("");
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);

    const placeholders = [
        "Escribe: 'Agrega una Sprite y un Coca Cola'",
        "Escribe: 'Descuento del 10%'",
        "Escribe: 'Establece cliente Juan de la Cruz'",
        "Escribe: 'Pagar con Tarjeta'",
        "Escribe: 'Suma 3 unidades al Sprite'"
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const executeLocalAIAction = (action: string, payload: any) => {
        if (action === 'addProductToCart') {
            const matchName = payload.productName || "";
            const qty = payload.quantity || 1;
            const target = findBestProductMatch(products, matchName);
            if (target) {
                if (target.stock <= 0) {
                    showNotification(`Lo siento, el producto "${target.name}" está agotado.`, 'error');
                    return;
                }
                addToCart(target, qty);
                showNotification(`Se agregó ${qty} x "${target.name}" al carrito.`, 'success');
            } else {
                showNotification(`No se encontró un producto similar a "${matchName}"`, 'error');
            }
        } else if (action === 'checkoutSale') {
            const method = payload.paymentMethod || 'Efectivo';
            const abono = payload.initialAbono !== undefined ? Number(payload.initialAbono) : 0;
            const limitDate = payload.dueDate || "";
            const clientNameVal = payload.clientName || "";
            const clientPhoneVal = payload.clientPhone || "";

            setPaymentMethod(method as any);
            if (abono > 0) setInitialAbono(abono);
            if (limitDate) setDueDate(limitDate);
            if (clientNameVal) setClientName(clientNameVal);
            if (clientPhoneVal) setClientPhone(clientPhoneVal);

            showNotification(`Preparando venta con método: ${method}...`, 'success');
            setTimeout(() => {
                executeCheckout(method);
            }, 150);
        } else if (action === 'applyDiscountCode') {
            if (payload.discount !== undefined) {
                setDiscount(payload.discount);
                if (payload.discountType) setDiscountType(payload.discountType);
                showNotification(`Descuento de ${payload.discount} ${payload.discountType === 'porcentaje' ? '%' : 'Bs.'} aplicado.`, 'success');
            }
        } else if (action === 'updateClientDetails') {
            if (payload.name) setClientName(payload.name);
            if (payload.phone) setClientPhone(payload.phone);
            showNotification(`Cliente actualizado: ${payload.name || clientName}`, 'success');
        } else if (action === 'clearCartItems') {
            clearCart();
            showNotification(`Carrito vaciado por completo.`, 'success');
        } else if (action === 'modifyCartItemQuantity') {
            const matchName = payload.productName || "";
            const qty = payload.quantity;
            const delta = payload.delta;
            const item = cart.find(i => findBestProductMatch([i], matchName));
            if (item) {
                let targetQty = qty !== undefined ? qty : item.cartQuantity + (delta || 0);
                if (targetQty <= 0) {
                    removeFromCart(item.id);
                    showNotification(`Se removió "${item.name}" del carrito.`, 'success');
                } else {
                    updateCartItemQuantity(item.id, targetQty);
                    showNotification(`Cantidad de "${item.name}" actualizada a ${targetQty}.`, 'success');
                }
            } else {
                showNotification(`El producto "${matchName}" no está en el carrito.`, 'error');
            }
        } else if (action === 'modifyCartItemPrice') {
            const matchName = payload.productName || "";
            const price = payload.price;
            const item = cart.find(i => findBestProductMatch([i], matchName));
            if (item && price !== undefined) {
                updateCartItemPrice(item.id, price);
                showNotification(`Precio de "${item.name}" actualizado a Bs. ${price}.`, 'success');
            } else {
                showNotification(`El producto "${matchName}" no está en el carrito.`, 'error');
            }
        } else if (action === 'createDepartment') {
            const deptName = payload.departmentName || "";
            if (!deptName) {
                showNotification("No se especificó el nombre del departamento.", "error");
                return;
            }
            fetch("/api/departments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: deptName })
            })
            .then(res => {
                if (!res.ok) throw new Error("Fallo en el servidor al registrar el departamento.");
                return res.json();
            })
            .then(() => {
                showNotification(`Departamento "${deptName}" creado con éxito.`, "success");
                fetchDepartments();
            })
            .catch(err => {
                console.error(err);
                showNotification(`No se pudo crear el departamento "${deptName}".`, "error");
            });
        } else if (action === 'classifyProduct') {
            const matchName = payload.productNameOrSku || "";
            const categoryName = payload.categoryName || "";
            if (!matchName || !categoryName) {
                showNotification("Faltan parámetros para clasificar el producto.", "error");
                return;
            }
            
            // Find target product from the inventory list
            const targetProd = findBestProductMatch(products, matchName) as any;
            if (!targetProd) {
                showNotification(`No se encontró un producto similar a "${matchName}" para clasificar.`, "error");
                return;
            }

            // Ensure the category/department exists. If not, let's create it first!
            const exists = (departments || []).some((d: any) => d.name.toLowerCase() === categoryName.toLowerCase());
            
            const performClassification = () => {
                const updatedProd = {
                    ...targetProd,
                    category: categoryName
                };
                fetch(`/api/products/${targetProd.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatedProd)
                })
                .then(res => {
                    if (!res.ok) throw new Error("Fallo en el servidor al actualizar la categoría.");
                    return res.json();
                })
                .then(() => {
                    showNotification(`Producto "${targetProd.name}" clasificado en "${categoryName}" con éxito.`, "success");
                    fetchProducts();
                })
                .catch(err => {
                    console.error(err);
                    showNotification(`No se pudo clasificar el producto "${targetProd.name}".`, "error");
                });
            };

            if (!exists) {
                // Auto create the category/department
                fetch("/api/departments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: categoryName })
                })
                .then(res => {
                    if (!res.ok) throw new Error("Error auto-creando departamento.");
                    return res.json();
                })
                .then(() => {
                    fetchDepartments();
                    performClassification();
                })
                .catch(err => {
                    console.error(err);
                    // Fallback to perform classification anyway as the database might allow it or accept it
                    performClassification();
                });
            } else {
                performClassification();
            }
        }
    };

    const handleSendAICommand = async () => {
        if (!aiCommandText.trim() || isAiProcessing) return;
        const textToSend = aiCommandText.trim();
        setAiCommandText("");
        setIsAiProcessing(true);

        showNotification(`GTR-Cerebro pensando...`, 'success');

        try {
            const response = await fetch("/api/chat-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: textToSend,
                    cart: cart
                })
            });

            if (!response.ok) {
                throw new Error("Respuesta del servidor incorrecta");
            }

            const data = await response.json();
            if (data.action && data.action.name) {
                executeLocalAIAction(data.action.name, data.action.payload || {});
            } else {
                showNotification(data.text || "Comando procesado correctamente.", 'success');
            }
        } catch (err: any) {
            console.error("AI Command bar processing error:", err);
            showNotification("Fallo al conectar con el cerebro GTR.", 'error');
        } finally {
            setIsAiProcessing(false);
        }
    };
    
    // States for product image reveals
    const [expandedImages, setExpandedImages] = useState<Record<number, boolean>>({});
    const [sideDetailProduct, setSideDetailProduct] = useState<any | null>(null);

    const [selectedCartItemId, setSelectedCartItemId] = useState<number | null>(null);

    const activeCartItemId = selectedCartItemId && cart.some(i => i.id === selectedCartItemId)
        ? selectedCartItemId 
        : (cart.length > 0 ? cart[cart.length - 1].id : null);

    // Global listener for fast keystrokes typed by hardware barcode readers & manual +/- quantity keys
    useEffect(() => {
        let buffer = "";
        let lastKeyTime = Date.now();
        let lastChar = "";
        let lastCharTime = Date.now();

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";
            
            // Intercept '+' and '-' keys globally unless typing in search or client text inputs
            const isTextInput = target.tagName === "INPUT" && (
                target.id === "search-input" ||
                target.getAttribute("placeholder")?.toLowerCase().includes("buscar") || 
                target.getAttribute("placeholder")?.toLowerCase().includes("nombre") || 
                target.getAttribute("placeholder")?.toLowerCase().includes("celular") ||
                target.getAttribute("placeholder")?.toLowerCase().includes("teléfono") ||
                target.getAttribute("placeholder")?.toLowerCase().includes("cliente")
            );

            if (!isTextInput) {
                if (e.key === '+' || e.key === 'Add') {
                    const activeId = activeCartItemId;
                    if (activeId) {
                        e.preventDefault();
                        const tgt = cart.find(i => i.id === activeId);
                        if (tgt) {
                            addToCart(tgt, 1);
                            showNotification(`✓ Cantidad +1: ${tgt.name}`, "success");
                        }
                    }
                } else if (e.key === '-' || e.key === 'Subtract') {
                    const activeId = activeCartItemId;
                    if (activeId) {
                        e.preventDefault();
                        const tgt = cart.find(i => i.id === activeId);
                        if (tgt) {
                            addToCart(tgt, -1);
                            showNotification(`✓ Cantidad -1: ${tgt.name}`, "success");
                        }
                    }
                }
            }

            const now = Date.now();
            const diff = now - lastKeyTime;
            lastKeyTime = now;

            // Barcode scanners render hardware key downs at high velocity (under < 40ms)
            const isScannerSpeed = diff < 40;

            if (e.key === 'Enter') {
                if (buffer.length >= 4) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const code = buffer.trim();
                    buffer = ""; // Clear buffer
                    
                    // Match barcode / SKU casing-insensitively with master product data
                    const cleanCode = code.toLowerCase();
                    const normCode = cleanCode.replace(/^0+/, '');

                    const match = products.find(p => {
                        if (!p.sku) return false;
                        const cleanSku = p.sku.trim().toLowerCase();
                        const normSku = cleanSku.replace(/^0+/, '');
                        return cleanSku === cleanCode || normSku === normCode || normSku === cleanCode || cleanSku === normCode;
                    });
                    if (match) {
                        addToCart(match, 1);
                        showNotification(`✓ ${match.name} añadido al carrito`, "success");
                        // Play a pleasant recognition feedback beep
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
                    } else {
                        showNotification(`⚠️ Código no registrado: ${code}`, "error");
                    }
                } else {
                    buffer = "";
                }
                return;
            }

            if (e.key.length === 1) {
                // If focus is in search or any input and is typed slowly by human, reset buffer
                if (isInput && !isScannerSpeed) {
                    buffer = "";
                    lastChar = e.key;
                    lastCharTime = now;
                    return;
                }
                
                // If scanned or outside fields, collect
                if (isScannerSpeed || !isInput) {
                    if (buffer === "" && lastChar && (now - lastCharTime < 150)) {
                        buffer = lastChar + e.key;
                        lastChar = ""; // consume
                    } else {
                        buffer += e.key;
                    }
                } else {
                    buffer = "";
                }
            }
        };

        const handleCustomBarcodeScan = (e: Event) => {
            const customEvent = e as CustomEvent;
            const barcode = customEvent.detail?.barcode;
            if (barcode) {
                const cleanCode = barcode.toLowerCase().trim();
                const normCode = cleanCode.replace(/^0+/, '');
                const match = products.find(p => {
                    if (!p.sku) return false;
                    const cleanSku = p.sku.trim().toLowerCase();
                    const normSku = cleanSku.replace(/^0+/, '');
                    return cleanSku === cleanCode || normSku === normCode || normSku === cleanCode || cleanSku === normCode;
                });
                if (match) {
                    addToCart(match, 1);
                    showNotification(`✓ [Escáner GTR] ${match.name} añadido al carrito`, "success");
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
                } else {
                    showNotification(`⚠️ [Escáner GTR] Código no registrado: ${barcode}`, "error");
                }
            }
        };

        window.addEventListener('gtr-barcode-scanned', handleCustomBarcodeScan);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('gtr-barcode-scanned', handleCustomBarcodeScan);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [products, addToCart, cart, activeCartItemId]);

    // Core checkout parameters
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);
    const [clientOperationId, setClientOperationId] = useState<string>("");
    const [checkoutCurrency, setCheckoutCurrency] = useState<'BOB' | 'USD'>('BOB');
    const cashInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isCheckoutOpen) {
            const opId = "op_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
            setClientOperationId(opId);
            setIsCheckoutProcessing(false);
        }
    }, [isCheckoutOpen]);

    useEffect(() => {
        if (isCheckoutOpen) {
            // Focus on the cash received input field instantly
            const timer = setTimeout(() => {
                if (cashInputRef.current) {
                    cashInputRef.current.focus();
                    try {
                        cashInputRef.current.select();
                    } catch (e) {}
                }
            }, 120);
            return () => clearTimeout(timer);
        }
    }, [isCheckoutOpen, paymentMethod, checkoutCurrency]);

    const [checkoutDescription, setCheckoutDescription] = useState("");
    const [initialAbono, setInitialAbono] = useState<number>(0);
    const [dueDate, setDueDate] = useState<string>("");
    const [cashReceived, setCashReceived] = useState<string>("");
    const [showClientSuggestions, setShowClientSuggestions] = useState(false);
    const [usePoints, setUsePoints] = useState<boolean>(false);
    const [creditDestination, setCreditDestination] = useState<string>( "");

    // States for quick overwrite of newly focused inputs
    const [justFocusedQty, setJustFocusedQty] = useState<Record<string, boolean>>({});
    const [justFocusedPrice, setJustFocusedPrice] = useState<Record<string, boolean>>({});
    const [justFocusedCash, setJustFocusedCash] = useState(false);
    const [justFocusedAbono, setJustFocusedAbono] = useState(false);
    const [justFocusedDiscount, setJustFocusedDiscount] = useState(false);

    const getOverwriteValue = (original: string, current: string, isFirstKeyPress: boolean): string => {
        if (!isFirstKeyPress) return current;
        if (!original) return current;
        if (current === original) return current;
        if (current.length <= original.length) return current;
        
        let i = 0;
        while (i < original.length && original[i] === current[i]) {
            i++;
        }
        let j = 0;
        while (j < original.length - i && original[original.length - 1 - j] === current[current.length - 1 - j]) {
            j++;
        }
        const diff = current.slice(i, current.length - j);
        return diff.length > 0 ? diff : current;
    };

    // States for viewing the last sale transaction directly
    const [lastSaleModalOpen, setLastSaleModalOpen] = useState(false);
    const [lastSaleDetails, setLastSaleDetails] = useState<any>(null);
    const [lastSaleItems, setLastSaleItems] = useState<any[]>([]);
    const [loadingLastSale, setLoadingLastSale] = useState(false);

    // Pending Sale Modal States
    const [isPendingSaleModalOpen, setIsPendingSaleModalOpen] = useState(false);
    const [pendingClientName, setPendingClientName] = useState("");
    const [pendingDestination, setPendingDestination] = useState("");
    const [pendingClientPhone, setPendingClientPhone] = useState("");
    const [pendingTransportCompany, setPendingTransportCompany] = useState("");
    const [isSavingPending, setIsSavingPending] = useState(false);

    const handleSavePendingSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pendingClientName.trim() || !pendingDestination.trim()) {
            showNotification("⚠️ Nombre de cliente y destino son obligatorios.", "error");
            return;
        }
        setIsSavingPending(true);
        try {
            const items = cart.map(item => ({
                product_id: item.id,
                quantity: item.cartQuantity || 1,
                price: item.selectedPrice || item.price_unit
            }));
            
            if (!navigator.onLine) {
                const payload = {
                    client_name: pendingClientName.trim(),
                    destination: pendingDestination.trim(),
                    client_phone: pendingClientPhone.trim() || null,
                    transport_company: pendingTransportCompany.trim() || null,
                    total: subtotal,
                    discount: 0,
                    items
                };
                await saveOfflineAction('create_pending_sale', '/api/pending-sales', 'POST', payload);
                clearCart(true);
                setLocalPriceInputs({});
                setSelectedCartItemId(null);
                setIsMobileCartOpen(false);
                setPendingClientName("");
                setPendingDestination("");
                setPendingClientPhone("");
                setPendingTransportCompany("");
                setIsPendingSaleModalOpen(false);
                showNotification("📦 Pedido registrado offline. Se sincronizará automáticamente al recuperar internet.", "success");
                return;
            }

            const res = await fetch('/api/pending-sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_name: pendingClientName.trim(),
                    destination: pendingDestination.trim(),
                    client_phone: pendingClientPhone.trim() || null,
                    transport_company: pendingTransportCompany.trim() || null,
                    total: subtotal,
                    discount: 0,
                    items
                })
            });
            
            if (res.ok) {
                clearCart(true);
                setLocalPriceInputs({});
                setSelectedCartItemId(null);
                setIsMobileCartOpen(false);
                setPendingClientName("");
                setPendingDestination("");
                setPendingClientPhone("");
                setPendingTransportCompany("");
                setIsPendingSaleModalOpen(false);
                showNotification("📦 ¡Pedido guardado como Venta Pendiente para envío con éxito!", "success");
            } else {
                const err = await res.json();
                showNotification("⚠️ Error: " + (err.error || "No se pudo guardar"), "error");
            }
        } catch (err: any) {
            console.error(err);
            showNotification("⚠️ Error de conexión al guardar venta pendiente", "error");
        } finally {
            setIsSavingPending(false);
        }
    };

    const handleViewLastSale = async () => {
        setLoadingLastSale(true);
        setLastSaleModalOpen(true);
        try {
            const res = await fetch('/api/sales');
            if (res.ok) {
                const sales = await res.json();
                if (sales && sales.length > 0) {
                    const lastSale = sales[0]; // first item is the most recent
                    setLastSaleDetails(lastSale);
                    
                    // Fetch items for this sale
                    const itemsRes = await fetch(`/api/sales/${lastSale.id}/items`);
                    if (itemsRes.ok) {
                        const itemsData = await itemsRes.json();
                        setLastSaleItems(itemsData);
                    } else {
                        setLastSaleItems([]);
                    }
                } else {
                    setLastSaleDetails(null);
                    showNotification("No hay ninguna venta registrada aún.", "error");
                }
            } else {
                showNotification("Error de conexión con el servidor fiscal.", "error");
            }
        } catch (err) {
            console.error("Error loading last sale:", err);
            showNotification("Fallo al obtener última venta.", "error");
        } finally {
            setLoadingLastSale(false);
        }
    };

    const generatePastTicketPDF = (sale: any, items: any[]) => {
        try {
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

            const width = tpl.ticketWidth || 80;
            const ml = 6;
            const mr = width - ml;
            const cx = width / 2;
            const font = tpl.fontFamily || 'Helvetica';
            
            let totalLines = 0;
            if (tpl.showLogo) totalLines += 2;
            if (tpl.showLogo && tpl.logoImage) totalLines += 3;
            if (tpl.headerText) totalLines += tpl.headerText.split('\n').length;
            if (tpl.showDate) totalLines += 1;
            if (tpl.showCashier) totalLines += 1;
            if (tpl.showClientInfo && sale.client_name) totalLines += 1;
            totalLines += items.length * 1.5;
            totalLines += 8;

            const predictedHeight = Math.max(120, Math.round(totalLines * 4.2) + 20);

            const doc = new jsPDF({
                unit: 'mm',
                format: [width, predictedHeight]
            });

            doc.setFont(font, "normal");
            let y = 10;

            if (tpl.showLogo) {
                if (tpl.logoImage) {
                    try {
                        const imgWidth = 14;
                        const imgHeight = 14;
                        const lx = cx - (imgWidth / 2);
                        doc.addImage(tpl.logoImage, 'PNG', lx, y, imgWidth, imgHeight);
                        y += imgHeight + 2.5;
                    } catch {}
                }
                if (tpl.logoText) {
                    doc.setFont(font, "bold");
                    doc.setFontSize(13);
                    const wrappedLogo = doc.splitTextToSize(tpl.logoText, mr - ml);
                    wrappedLogo.forEach((line: string) => {
                        doc.text(line, cx, y, { align: 'center' });
                        y += 5.5;
                    });
                    y += 1;
                }
            }

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

            doc.setTextColor(15, 23, 42);

            if (tpl.showHeaderDivider) {
                doc.setLineWidth(0.2);
                doc.setDrawColor(203, 213, 225);
                doc.line(ml, y, mr, y);
                y += 4;
            }

            doc.setFont(font, "normal");
            doc.setFontSize(8);
            if (tpl.showDate) {
                const formattedDate = new Date(sale.created_at || Date.now()).toLocaleString();
                doc.text(`Fecha: ${formattedDate}`, ml, y);
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

            // Header columns
            doc.setFont(font, "bold");
            doc.setFontSize(8.5);
            doc.text("CANT  PRODUCTO", ml, y);
            const colPriceX = mr;
            const currencyStr = sale.currency === 'USD' ? "SUB ($)" : "SUB (Bs.)";
            doc.text(currencyStr, colPriceX, y, { align: 'right' });
            y += 2.5;

            doc.setLineWidth(0.22);
            doc.setDrawColor(148, 163, 184);
            doc.line(ml, y, mr, y);
            y += 4;

            // Render products
            items.forEach(item => {
                doc.setFontSize(tpl.fontSizeBody ? tpl.fontSizeBody + 1 : 9);
                
                doc.setFont(font, "bold");
                doc.text(`${item.quantity}x`, ml, y);
                
                doc.setFont(font, "normal");
                const detailX = ml + 8;
                const maxNameWidth = mr - detailX - 20;
                const nameText = item.product_name || 'Producto';
                const wrappedName = doc.splitTextToSize(nameText, maxNameWidth);
                
                const firstLine = wrappedName[0] || "";
                doc.text(firstLine, detailX, y);
                
                doc.setFont(font, "bold");
                const subVal = (item.quantity * item.price);
                const itemSub = sale.currency === 'USD' ? `$${subVal.toFixed(2)}` : `Bs.${subVal.toFixed(2)}`;
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
            doc.setLineWidth(0.22);
            doc.setDrawColor(148, 163, 184);
            doc.line(ml, y, mr, y);
            y += 4.5;

            // Totals
            doc.setFont(font, "normal");
            doc.setFontSize(8.5);

            const discount = sale.discount || 0;
            const finalTotal = sale.total || 0;
            const subtotal = finalTotal + discount;

            doc.text(`Subtotal:`, ml, y);
            const subStr = sale.currency === 'USD'
                ? `$ ${subtotal.toFixed(2)}`
                : `Bs. ${subtotal.toFixed(2)}`;
            doc.text(subStr, colPriceX, y, { align: 'right' });
            y += 4;

            if (discount > 0) {
                doc.setFont(font, "bold");
                doc.setTextColor(239, 68, 68);
                doc.text(`Desc:`, ml, y);
                const descStr = sale.currency === 'USD'
                    ? `-$ ${discount.toFixed(2)}`
                    : `-Bs. ${discount.toFixed(2)}`;
                doc.text(descStr, colPriceX, y, { align: 'right' });
                y += 4;
                doc.setTextColor(15, 23, 42);
            }

            doc.setFont(font, "bold");
            doc.setFontSize(9.5);
            doc.text(`TOTAL GENERAL:`, ml, y);
            const totalStr = sale.currency === 'USD'
                ? `$ ${finalTotal.toFixed(2)} USD`
                : `Bs. ${finalTotal.toFixed(2)}`;
            doc.text(totalStr, colPriceX, y, { align: 'right' });
            y += 5;

            if (tpl.showPaymentMethod) {
                doc.setFont(font, "normal");
                doc.setFontSize(8);
                const payCurr = sale.currency === 'USD' ? 'USD' : 'BOB';
                doc.text(`Pago: ${sale.payment_method || 'Efectivo'} [${payCurr}]`, ml, y);
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

            // Digital Audit Barcode
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
                console.error("Barcode drawing failed gracefully", barErr);
            }

            doc.save(`Recibo_Past_Venta_${sale.id}.pdf`);
            showNotification(`✓ PDF de venta #${sale.id} descargado`, 'success');
        } catch (pdfErr) {
            console.error("Historical PDF generation error:", pdfErr);
            showNotification("Fallo al generar archivo PDF.", "error");
        }
    };

    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => {
            setNotification(null);
        }, 4000);
    };

    useEffect(() => {
        fetchProducts();
        fetchClients();
    }, []);

    useEffect(() => {
        if (!receiptConfirmation) return;
        const timer = setTimeout(() => {
            setReceiptConfirmation(null);
        }, 8000);
        return () => clearTimeout(timer);
    }, [receiptConfirmation]);

    useEffect(() => {
        // Listen to AI checkout request events from AudioVoice
        const handleAICheckout = (e: any) => {
            const method = e.detail?.paymentMethod || 'Efectivo';
            const abono = e.detail?.initialAbono !== undefined ? Number(e.detail.initialAbono) : 0;
            const limitDate = e.detail?.dueDate || "";
            const clientNameVal = e.detail?.clientName || "";
            const clientPhoneVal = e.detail?.clientPhone || "";

            setPaymentMethod(method);
            if (abono > 0) setInitialAbono(abono);
            if (limitDate) setDueDate(limitDate);
            if (clientNameVal) setClientName(clientNameVal);
            if (clientPhoneVal) setClientPhone(clientPhoneVal);

            setTimeout(() => {
                if (executeCheckoutRef.current) {
                    executeCheckoutRef.current(method);
                }
            }, 150);
        };

        const handleAIClientChange = (e: any) => {
            if (e.detail?.name) setClientName(e.detail.name);
            if (e.detail?.phone) setClientPhone(e.detail.phone);
        };

        const handleAIApplyDiscount = (e: any) => {
            if (e.detail?.discount !== undefined) setDiscount(e.detail.discount);
            if (e.detail?.discountType) setDiscountType(e.detail.discountType);
        };

        const handleStockLimitHit = (e: any) => {
            const { name, stock } = e.detail || {};
            showNotification(`Stock límite: "${name}" se limitó a su stock disponible de ${stock} unidades.`, 'error');
        };

        const handleTriggerNotification = (e: any) => {
            const { message, type } = e.detail || {};
            showNotification(message, type || 'success');
        };

        window.addEventListener('aiCheckout', handleAICheckout);
        window.addEventListener('aiClientChange', handleAIClientChange);
        window.addEventListener('aiApplyDiscount', handleAIApplyDiscount);
        window.addEventListener('stockLimitHit', handleStockLimitHit);
        window.addEventListener('triggerNotification', handleTriggerNotification);
        return () => {
            window.removeEventListener('aiCheckout', handleAICheckout);
            window.removeEventListener('aiClientChange', handleAIClientChange);
            window.removeEventListener('aiApplyDiscount', handleAIApplyDiscount);
            window.removeEventListener('stockLimitHit', handleStockLimitHit);
            window.removeEventListener('triggerNotification', handleTriggerNotification);
        };
    }, []);

    // Handle adding tabs
    const handleAddTab = () => {
        const nextId = tabs.length > 0 ? Math.max(...tabs.map(t => t.id)) + 1 : 1;
        const newTab: SaleTab = {
            id: nextId,
            name: `Venta ${nextId}`,
            cart: [],
            clientName: "",
            clientPhone: "",
            discount: 0,
            discountType: 'monto',
            paymentMethod: 'Efectivo'
        };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(nextId);
    };

    // Switch tab trigger
    const handleSwitchTab = (tabId: number) => {
        if (tabId === activeTabId) return;
        setActiveTabId(tabId);
    };

    // Remove tab trigger
    const handleRemoveTab = (tabId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (tabs.length === 1) {
            showNotification("No puedes cerrar todas las pestañas de venta activa.", "error");
            return;
        }

        const remainingTabs = tabs.filter(t => t.id !== tabId);
        setTabs(remainingTabs);

        if (activeTabId === tabId) {
            const fallbackTab = remainingTabs[0];
            setActiveTabId(fallbackTab.id);
        }
    };

    const [localPriceInputs, setLocalPriceInputs] = useState<Record<number, string>>({});

    const getCartItemPriceUSD = (item: any) => {
        if (!item) return 0;
        if (item.price_type === 'bulk') {
            return Number(item.price_bulk) || 0;
        }
        if (item.price_type === 'custom' && item.custom_price !== undefined && item.custom_price !== null) {
            return Number(item.custom_price) || 0;
        }
        return Number(item.price_unit) || 0;
    };

    const getCartItemPriceBs = (item: any) => {
        if (!item) return 0;
        const rate = exchangeRate || 6.96;
        if (item.price_type === 'custom') {
            if (item.custom_price_bs !== undefined && item.custom_price_bs !== null) {
                return Number(item.custom_price_bs) || 0;
            }
            if (item.custom_price !== undefined && item.custom_price !== null) {
                return roundBs((Number(item.custom_price) || 0) * rate);
            }
        }
        return roundBs(getCartItemPriceUSD(item) * rate);
    };

    const handleCustomPriceChange = (itemId: number, text: string) => {
        setLocalPriceInputs(prev => ({ ...prev, [itemId]: text }));
        const normalized = text.replace(',', '.').trim();
        const valBs = parseFloat(normalized);
        if (!isNaN(valBs) && valBs >= 0) {
            const rate = exchangeRate || 6.96;
            updateCartItemPrice(itemId, 'custom', valBs / rate, valBs);
        }
    };

    const enableCustomPrice = (item: any) => {
        const currentPriceBs = getCartItemPriceBs(item);
        setLocalPriceInputs(prev => ({ ...prev, [item.id]: currentPriceBs.toFixed(2) }));
        const rate = exchangeRate || 6.96;
        updateCartItemPrice(item.id, 'custom', currentPriceBs / rate, currentPriceBs);
    };

    // Calculate Categorias with memoization
    const categories = React.useMemo(() => {
        const uniqueCats = Array.from(new Set(products.map(p => p.category ? p.category.trim() : "")));
        const list = ["Todos", ...uniqueCats.filter(cat => cat !== "")];
        const hasLowStock = products.some(p => p.stock <= p.stock_alarm);
        if (hasLowStock) {
            list.push("⚠️ Bajo Stock");
        }
        return list;
    }, [products]);

    // Filter Products based on search & category with memoization
    const filtered = React.useMemo(() => {
        const query = debouncedSearch.toLowerCase().trim();
        const categoryFilter = selectedCategory;
        const categoryMatched = products.filter(p => {
            let matchesCategory = false;
            if (categoryFilter === "Todos") {
                matchesCategory = true;
            } else if (categoryFilter === "⚠️ Bajo Stock") {
                matchesCategory = p.stock <= p.stock_alarm;
            } else {
                matchesCategory = p.category === categoryFilter;
            }
            return matchesCategory;
        });
        
        return filterAndRankProducts(categoryMatched, query);
    }, [products, debouncedSearch, selectedCategory]);

    // Reset visible catalog limit on search/category change
    React.useEffect(() => {
        setVisibleCatalogLimit(48);
    }, [debouncedSearch, selectedCategory]);

    const visibleProducts = React.useMemo(() => {
        return filtered.slice(0, visibleCatalogLimit);
    }, [filtered, visibleCatalogLimit]);

    const subtotal = React.useMemo(() => {
        return cart.reduce((acc, item) => acc + (getCartItemPriceBs(item) * item.cartQuantity), 0);
    }, [cart, exchangeRate]);
    
    // Process discount with memoization
    const discountValue = React.useMemo(() => {
        return discountType === 'porcentaje' 
            ? (subtotal * (discount / 100)) 
            : discount;
    }, [subtotal, discount, discountType]);

    const matchedClient = React.useMemo(() => {
        const nameClean = clientName.toLowerCase().trim();
        if (!nameClean) return null;
        return clients.find(c => c.name.toLowerCase().trim() === nameClean);
    }, [clients, clientName]);

    const availablePoints = React.useMemo(() => {
        return matchedClient ? (matchedClient.points || 0) : 0;
    }, [matchedClient]);
    
    // Each point is worth 1.00 Bs. 
    // Redemption of points cannot exceed the price after previous discount
    const pointsRedeemedValue = React.useMemo(() => {
        return usePoints ? Math.min(availablePoints, Math.floor(subtotal - discountValue)) : 0;
    }, [usePoints, availablePoints, subtotal, discountValue]);

    const total = React.useMemo(() => {
        return Math.max(0, subtotal - discountValue - pointsRedeemedValue);
    }, [subtotal, discountValue, pointsRedeemedValue]);

    const usdTotal = React.useMemo(() => {
        return total / exchangeRate;
    }, [total, exchangeRate]);

    const executeCheckout = async (methodToUse = paymentMethod) => {
        if (cart.length === 0) return;
        if (isCheckoutProcessing) return;

        if (methodToUse === 'Crédito' && !clientName.trim()) {
            showNotification("⚠️ Se requiere registrar un cliente con Nombre para procesar ventas al Crédito.", "error");
            return;
        }

        setIsCheckoutProcessing(true);

        try {
            // Register client details if provided. By hitting POST /api/clients first, we retrieve/create clientId
            let clientId: any = null;
            if (clientName.trim()) {
                if (navigator.onLine) {
                    try {
                        const clientRes = await fetch('/api/clients', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: clientName, phone: clientPhone })
                        });
                        if (clientRes.ok) {
                            const clientData = await clientRes.json();
                            clientId = clientData.id;
                        }
                    } catch (e) {
                        console.error("Client registration error:", e);
                    }
                } else {
                    // Generate a unique temporary client ID
                    const tempId = `client_temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    clientId = tempId;

                    // Save client creation as an offline action
                    await saveOfflineAction(
                        'create_client',
                        '/api/clients',
                        'POST',
                        { name: clientName, phone: clientPhone },
                        { tempId }
                    );

                    console.log(`[POS Offline] Saved offline client action with temp ID: ${tempId}`);
                }
            }

            const opId = clientOperationId || ("op_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11));

            const salePayload = {
                total: checkoutCurrency === 'USD' ? usdTotal : total,
                discount: checkoutCurrency === 'USD' ? (discountValue + pointsRedeemedValue) / exchangeRate : (discountValue + pointsRedeemedValue),
                payment_method: methodToUse,
                user_id: user?.id || 1,
                client_id: clientId,
                items: cart.filter(c => c.cartQuantity > 0).map(c => ({
                    product_id: c.id,
                    quantity: c.cartQuantity,
                    price: checkoutCurrency === 'USD' ? getCartItemPriceUSD(c) : getCartItemPriceBs(c)
                })),
                initial_abono: methodToUse === 'Crédito' ? initialAbono : 0,
                due_date: methodToUse === 'Crédito' && dueDate ? dueDate : null,
                redeemed_points: pointsRedeemedValue,
                currency: checkoutCurrency,
                exchange_rate: exchangeRate,
                notes: checkoutDescription,
                clientOperationId: opId
            };

            const saveOffline = async () => {
                try {
                    // In the Online-First model, offline contingency sales are quarantined:
                    // We DO NOT deduct local inventory blindly. Stock deduction occurs strictly upon Admin Authorization.
                    salePayload.notes = (salePayload.notes ? salePayload.notes + ' ' : '') + '[Contingencia Offline - Pendiente Aprobación]';
                    const offlineSale = await saveOfflineSale(salePayload, clientName, clientPhone);
                    const placeholderSaleId = offlineSale.id;

                    // Immediate local client registration (safe client cache)
                    if (clientName.trim()) {
                        registerLocalClient({
                            id: clientId || -Date.now(),
                            name: clientName.trim(),
                            phone: clientPhone ? clientPhone.trim() : ''
                        });
                    }

                    const contingencyNotes = (checkoutDescription ? checkoutDescription + ' ' : '') + '[CONTINGENCIA OFFLINE - PENDIENTE APROBACIÓN]';
                    generateTicketPDF(methodToUse, placeholderSaleId, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, creditDestination, contingencyNotes);
                    
                    setReceiptConfirmation({
                        saleId: placeholderSaleId,
                        total: checkoutCurrency === 'USD' ? usdTotal : total,
                        currency: checkoutCurrency,
                        itemsCount: cart.reduce((acc, item) => acc + item.cartQuantity, 0),
                        paymentMethod: methodToUse,
                        items: [...cart],
                        clientName,
                        clientPhone,
                        discountValue,
                        discount,
                        discountType,
                        pointsRedeemedValue,
                        subtotal,
                        exchangeRate,
                        cashReceived,
                        destination: creditDestination
                    });

                    clearCart(true);
                    setLocalPriceInputs({});
                    setSelectedCartItemId(null);
                    setIsMobileCartOpen(false);
                    setDiscount(0);
                    setClientName("");
                    setClientPhone("");
                    setCreditDestination("");
                    setCheckoutDescription("");
                    setInitialAbono(0);
                    setDueDate("");
                    setCashReceived("");
                    setUsePoints(false);
                    setPaymentMethod('Efectivo');
                    setIsCheckoutOpen(false);
                    triggerVibrate([80, 50, 80]);
                    showNotification("✓ Venta offline registrada en contingencia. El ticket fue emitido y la venta ingresará a la Bandeja de Aprobación del Administrador al reconectar.", "success");
                } catch (saveErr) {
                    triggerVibrate([150, 100, 150]);
                    console.error("Failed to save offline sale:", saveErr);
                    showNotification("Fallo al registrar la venta en contingencia offline.", "error");
                }
            };

            if (!navigator.onLine) {
                await saveOffline();
                return;
            }

            try {
                const res = await fetch('/api/sales', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(salePayload)
                });
                if (res.ok) {
                    const data = await res.json();
                    const saleId = data.saleId;
                    
                    // Dispatch global event for inventory transaction tracking
                    safeDispatchEvent('inventory_operation', {
                        detail: {
                            type: 'sale',
                            id: saleId,
                            user: user?.username || 'Cajero',
                            timestamp: new Date().toISOString()
                        }
                    });
                    
                    generateTicketPDF(methodToUse, saleId, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, creditDestination, checkoutDescription);
                    
                    setReceiptConfirmation({
                        saleId,
                        total: checkoutCurrency === 'USD' ? usdTotal : total,
                        currency: checkoutCurrency,
                        itemsCount: cart.reduce((acc, item) => acc + item.cartQuantity, 0),
                        paymentMethod: methodToUse,
                        items: [...cart],
                        clientName,
                        clientPhone,
                        discountValue,
                        discount,
                        discountType,
                        pointsRedeemedValue,
                        subtotal,
                        exchangeRate,
                        cashReceived,
                        destination: creditDestination
                    });

                    clearCart(true);
                    setLocalPriceInputs({});
                    setSelectedCartItemId(null);
                    setIsMobileCartOpen(false);
                    setDiscount(0);
                    setClientName("");
                    setClientPhone("");
                    setCreditDestination("");
                    setCheckoutDescription("");
                    setInitialAbono(0);
                    setDueDate("");
                    setCashReceived("");
                    setUsePoints(false);
                    setPaymentMethod('Efectivo');
                    fetchProducts(); // update master stock list
                    fetchClients();  // update client list suggestions matching new addition
                    setIsCheckoutOpen(false);
                    triggerVibrate([80, 50, 80]);
                    if (data.isDuplicate) {
                        showNotification("✓ Venta recuperada de transacción anterior (ya registrada). Recibo térmico PDF descargado.", "success");
                    } else {
                        showNotification("✓ Venta procesada y recibo térmico PDF descargado.", "success");
                    }
                } else {
                    const errData = await res.json();
                    triggerVibrate([150, 100, 150]);
                    showNotification(`Error: ${errData.error}`, "error");
                }
            } catch (err) {
                console.error("Checkout failure, saving offline:", err);
                await saveOffline();
            }
        } finally {
            setIsCheckoutProcessing(false);
        }
    };

    useEffect(() => {
        executeCheckoutRef.current = executeCheckout;
    }, [executeCheckout]);

    const generateTicketPDF = (
        methodUsed: string,
        saleIdToUse?: number | string,
        overrideCart?: any[],
        overrideClientName?: string,
        overrideClientPhone?: string,
        overrideDiscountValue?: number,
        overrideTotal?: number,
        overrideSubtotal?: number,
        overridePointsRedeemed?: number,
        overrideCurrency?: 'BOB' | 'USD',
        overrideExchangeRate?: number,
        overrideCashReceived?: string,
        overrideDestination?: string,
        overrideNotes?: string
    ) => {
        const activeCart = overrideCart || cart;
        const activeClientName = overrideClientName !== undefined ? overrideClientName : clientName;
        const activeClientPhone = overrideClientPhone !== undefined ? overrideClientPhone : clientPhone;
        const activeDestination = overrideDestination !== undefined ? overrideDestination : (methodUsed === 'Crédito' ? creditDestination : '');
        const activeNotes = overrideNotes !== undefined ? overrideNotes : checkoutDescription;
        const activeDiscountValue = overrideDiscountValue !== undefined ? overrideDiscountValue : discountValue;
        const activeCurrency = overrideCurrency || checkoutCurrency;
        const activeExchangeRate = overrideExchangeRate || exchangeRate;
        const activeTotal = overrideTotal !== undefined ? overrideTotal : (activeCurrency === 'USD' ? usdTotal : total);
        const activeSubtotal = overrideSubtotal !== undefined ? overrideSubtotal : subtotal;
        const activeCashReceived = overrideCashReceived !== undefined ? overrideCashReceived : cashReceived;

        try {
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
            if (tpl.showClientInfo && activeClientName) headerLines += 1;

            let itemLines = activeCart.length * 1.5;
            activeCart.forEach(item => {
                if (tpl.showItemSKU && item.sku) itemLines += 0.8;
            });

            let footerLines = 3;
            if (activeDiscountValue > 0) footerLines += 1.5;
            if (tpl.showPaymentMethod) footerLines += 1.5;
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
                doc.text(`Fecha: ${new Date().toLocaleString()}`, ml, y);
                y += 4;
            }
            if (tpl.showCashier) {
                doc.text(`Atendió: ${user?.username || 'admin'}`, ml, y);
                y += 4;
            }
            if (tpl.showClientInfo && activeClientName) {
                doc.setFont(font, "bold");
                doc.text(`Cliente: ${activeClientName} (${activeClientPhone || 'Particular'})`, ml, y);
                doc.setFont(font, "normal");
                y += 4.5;
            }
            if (methodUsed === 'Crédito' && activeDestination) {
                doc.setFont(font, "bold");
                doc.text(`Destino: ${activeDestination}`, ml, y);
                doc.setFont(font, "normal");
                y += 4.5;
            }

            if (activeNotes && activeNotes.trim() !== "") {
                doc.setFont(font, "bold");
                doc.text(`Notas:`, ml, y);
                doc.setFont(font, "normal");
                y += 4;
                const wrappedNotes = doc.splitTextToSize(activeNotes.trim(), mr - ml);
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
            doc.text(activeCurrency === 'USD' ? "SUB ($)" : "SUB (Bs.)", colPriceX, y, { align: 'right' });
            y += 2.5;

            // Thin table divider line
            doc.setLineWidth(0.22);
            doc.setDrawColor(148, 163, 184);
            doc.line(ml, y, mr, y);
            y += 4;

            // Items mapping - Larger details, bold quantities and prices
            activeCart.forEach(item => {
                doc.setFontSize(tpl.fontSizeBody ? tpl.fontSizeBody + 1 : 9); // Slightly larger font for details
                
                // Draw bold quantity
                doc.setFont(font, "bold");
                doc.text(`${item.cartQuantity}x`, ml, y);
                
                // Draw normal name with small indent
                doc.setFont(font, "normal");
                const detailX = ml + 9;
                const maxNameWidth = mr - detailX - 22; // leaving space for price
                const wrappedName = doc.splitTextToSize(item.name, maxNameWidth);
                
                const firstLine = wrappedName[0] || "";
                doc.text(firstLine, detailX, y);
                
                // Draw bold price subtotal on the right
                doc.setFont(font, "bold");
                const itemSub = activeCurrency === 'USD' 
                    ? `$${(getCartItemPriceUSD(item) * item.cartQuantity).toFixed(2)}`
                    : `Bs.${(getCartItemPriceBs(item) * item.cartQuantity).toFixed(2)}`;
                doc.text(itemSub, colPriceX, y, { align: 'right' });
                y += 4.2;

                if (wrappedName.length > 1) {
                    doc.setFont(font, "normal");
                    for (let i = 1; i < wrappedName.length; i++) {
                        doc.text(wrappedName[i], detailX, y);
                        y += 4.2;
                    }
                }

                if (tpl.showItemSKU && item.sku) {
                    doc.setFont(font, "italic");
                    doc.setFontSize(7.5);
                    doc.text(`SKU: ${item.sku}`, detailX, y - 0.5);
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
            const subStr = activeCurrency === 'USD'
                ? `$ ${(activeSubtotal / activeExchangeRate).toFixed(2)}`
                : `Bs. ${activeSubtotal.toFixed(2)}`;
            doc.text(subStr, colPriceX, y, { align: 'right' });
            y += 4;

            if (activeDiscountValue > 0) {
                doc.setFont(font, "bold");
                doc.setTextColor(239, 68, 68); // Soft red for discount text
                doc.text(`Desc:`, ml, y);
                const descStr = activeCurrency === 'USD'
                    ? `-$ ${(activeDiscountValue / activeExchangeRate).toFixed(2)}`
                    : `-Bs. ${activeDiscountValue.toFixed(2)}`;
                doc.text(descStr, colPriceX, y, { align: 'right' });
                y += 4;
                doc.setTextColor(15, 23, 42); // Reset color
            }

            // Puntos Canjeados en esta venta
            if (overridePointsRedeemed && overridePointsRedeemed > 0) {
                doc.setFont(font, "bold");
                doc.setTextColor(16, 185, 129); // Green color for loyalty points
                doc.text(`Canje Puntos:`, ml, y);
                doc.text(`-${overridePointsRedeemed} pts`, colPriceX, y, { align: 'right' });
                y += 4;
                doc.setTextColor(15, 23, 42); // Reset color
            }

            // Puntos Ganados en esta venta: 1 punto por cada 10 Bs de compra
            const spentInBsForPoints = activeCurrency === 'USD' ? (activeTotal * activeExchangeRate) : activeTotal;
            const pointsEarned = Math.floor(spentInBsForPoints / 10);
            if (pointsEarned > 0 && matchedClient) {
                doc.setFont(font, "normal");
                doc.setFontSize(8);
                doc.setTextColor(79, 70, 229); // Indigo for points earned
                doc.text(`Puntos Ganados hoy:`, ml, y);
                doc.setFont(font, "bold");
                doc.text(`+${pointsEarned} pts`, colPriceX, y, { align: 'right' });
                y += 4;
                doc.setTextColor(15, 23, 42); // Reset color
            }

            // Puntos acumulados totales del cliente (proyectados)
            if (matchedClient) {
                const currentClientPoints = matchedClient.points || 0;
                const projectedBalance = Math.max(0, currentClientPoints - (overridePointsRedeemed || 0) + pointsEarned);
                doc.setFont(font, "normal");
                doc.setFontSize(7.5);
                doc.setTextColor(100, 116, 139);
                doc.text(`Saldo Total Puntos:`, ml, y);
                doc.text(`${projectedBalance} pts`, colPriceX, y, { align: 'right' });
                y += 3.8;
                doc.setTextColor(15, 23, 42); // Reset color
            }

            // Clean double-line look for total
            doc.setLineWidth(0.15);
            doc.line(ml, y - 0.8, mr, y - 0.8);

            doc.setFont(font, "bold");
            doc.setFontSize(9.5);
            doc.text(`TOTAL GENERAL:`, ml, y);
            const totalStr = activeCurrency === 'USD'
                ? `$ ${activeTotal.toFixed(2)} USD`
                : `Bs. ${activeTotal.toFixed(2)}`;
            doc.text(totalStr, colPriceX, y, { align: 'right' });
            y += 5;

            if (tpl.showPaymentMethod) {
                doc.setFont(font, "normal");
                doc.setFontSize(8);
                doc.text(`Pago: ${methodUsed} [${activeCurrency}]`, ml, y);
                y += 4.5;

                if (methodUsed === 'Efectivo' && activeCashReceived.trim()) {
                    const recNum = parseFloat(activeCashReceived);
                    if (!isNaN(recNum)) {
                        doc.text(`Entregado:`, ml, y);
                        doc.text(`${activeCurrency === 'USD' ? '$' : 'Bs.'} ${recNum.toFixed(2)}`, colPriceX, y, { align: 'right' });
                        y += 4;

                        const finalChange = recNum - activeTotal;
                        doc.setFont(font, "bold");
                        doc.text(`Cambio:`, ml, y);
                        doc.text(`${activeCurrency === 'USD' ? '$' : 'Bs.'} ${Math.max(0, finalChange).toFixed(2)}`, colPriceX, y, { align: 'right' });
                        doc.setFont(font, "normal");
                        y += 4.5;
                    }
                }
                y += 1;
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

            // Barcode scan area
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
                doc.text(`*GTR-${(saleIdToUse || Date.now()).toString().slice(-7)}*`, cx, y, { align: 'center' });
            } catch (barErr) {
                console.error("Barcode drawing failed gracefully", barErr);
            }

            doc.save(`Ticket_GTR_POS_Venta_${saleIdToUse || Date.now()}.pdf`);
        } catch (e) {
            console.error("PDF download failure:", e);
        }
    };

    const renderCartPane = (isMobile = false) => {
        const totalItemsInCart = cart.reduce((acc, item) => acc + item.cartQuantity, 0);

        return (
            <div className={`flex flex-col h-full ${isMobile ? 'bg-white dark:bg-[#0c111e]' : ''} select-none`}>
                <div className="p-4.5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-7.5 h-7.5 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-500/10">
                            <ShoppingCart size={13} />
                        </div>
                        <h2 className="text-slate-800 dark:text-slate-100 text-xs font-black uppercase tracking-wider">Carrito de Compra</h2>
                        <span className="bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                            {totalItemsInCart} u
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setIsScannerOpen(true)}
                            className="mr-1 shadow-xs border border-blue-100 hover:border-blue-500/40 bg-blue-50/50 hover:bg-blue-100 text-blue-600 dark:bg-blue-95/20 dark:hover:bg-blue-95/45 dark:text-blue-400 p-2.5 rounded-xl transition flex items-center justify-center gap-1.5 font-bold text-[9.5px] uppercase tracking-wide cursor-pointer h-[34px] shrink-0 active:scale-95 duration-100"
                            title="Escanear Código de Barras con Cámara"
                        >
                            <Camera size={13} className="text-blue-500 dark:text-blue-400 animate-pulse-slow" />
                            <span>Scanner</span>
                        </button>
                        
                        {(lastClearedCart || cartBackup) && cart.length === 0 && (
                            <button 
                                onClick={() => {
                                    if (lastClearedCart) {
                                        restoreLastClearedCart();
                                        if (showNotification) showNotification("¡Carrito restaurado con éxito!", "success");
                                    } else if (cartBackup) {
                                        restoreCartBackup();
                                        if (showNotification) showNotification("¡Carrito de la sesión anterior recuperado!", "success");
                                    }
                                }} 
                                className="text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 font-extrabold uppercase tracking-wide transition cursor-pointer mr-2 shrink-0 flex items-center gap-1 animate-pulse"
                                title="Rescatar productos borrados o no guardados"
                            >
                                <RotateCcw size={11} />
                                <span>Rescatar Carrito</span>
                            </button>
                        )}

                        {cart.length > 0 && (
                            <button 
                                onClick={() => clearCart(false)} 
                                className="text-[10px] text-rose-500 hover:text-rose-600 font-extrabold uppercase tracking-wide transition cursor-pointer mr-2 shrink-0"
                            >
                                Vaciar Todo
                            </button>
                        )}
                        {isMobile && (
                            <button 
                                onClick={() => setIsMobileCartOpen(false)}
                                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-500 dark:text-slate-400 cursor-pointer transition shrink-0"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* GTR AI Operational Neural Bar */}
                {hasPermission(user, 'access_ai') && (
                    <div className="px-4 py-2.5 bg-indigo-50/30 dark:bg-indigo-950/10 border-b border-slate-150 dark:border-slate-850 flex items-center gap-2" id="cart-ai-command-bar">
                        <Sparkles className={`w-3.5 h-3.5 text-indigo-500 shrink-0 ${isAiProcessing ? 'animate-spin' : 'animate-pulse'}`} />
                        <input
                            type="text"
                            value={aiCommandText}
                            onChange={(e) => setAiCommandText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSendAICommand();
                                }
                            }}
                            disabled={isAiProcessing}
                            placeholder={placeholders[currentPlaceholderIndex]}
                            className="flex-1 bg-transparent text-[11px] font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none min-w-0"
                        />
                        {aiCommandText.trim().length > 0 && (
                            <button
                                onClick={handleSendAICommand}
                                disabled={isAiProcessing}
                                className="p-1 text-indigo-600 dark:text-indigo-400 hover:scale-105 active:scale-95 transition cursor-pointer"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                {/* Items in active cart with elastic spring animations */}
                <div 
                    className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[160px] scrollbar-none touch-momentum"
                    style={cartScroll.style}
                    {...cartScroll.touchHandlers}
                >
                    {/* Cart Safety Recall / Accidental Clear Alert */}
                    {lastClearedCart && lastClearedCart.length > 0 && cart.length === 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-center justify-between gap-2.5 shadow-xs animate-fade-in">
                            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs">
                                <div className="p-1.5 bg-amber-200/60 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-xl shrink-0">
                                    <RotateCcw size={15} />
                                </div>
                                <div>
                                    <span className="font-extrabold block text-[11px] leading-tight text-amber-900 dark:text-amber-200">¿Vaciado por error?</span>
                                    <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                                        Se borraron {lastClearedCart.reduce((acc, item) => acc + (item.cartQuantity || 1), 0)} unidades ({lastClearedCart.length} ítems).
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => {
                                        if (restoreLastClearedCart()) {
                                            if (showNotification) showNotification("¡Carrito restaurado con éxito!", "success");
                                        }
                                    }}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-[10px] uppercase rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1"
                                >
                                    <RotateCcw size={11} />
                                    Restaurar
                                </button>
                                <button
                                    onClick={discardCartBackup}
                                    className="p-1 text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-900/50 rounded-lg transition cursor-pointer"
                                    title="Descartar"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Session Expiration / Accidental Tab Refresh Backup Alert */}
                    {!lastClearedCart && cartBackup && cartBackup.length > 0 && cart.length === 0 && (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl flex items-center justify-between gap-2.5 shadow-xs animate-fade-in">
                            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 text-xs">
                                <div className="p-1.5 bg-indigo-200/60 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl shrink-0">
                                    <ShieldAlert size={15} />
                                </div>
                                <div>
                                    <span className="font-extrabold block text-[11px] leading-tight text-indigo-900 dark:text-indigo-200">Rescate de Sesión Previa</span>
                                    <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold">
                                        Carrito guardado de {cartBackup.reduce((acc, item) => acc + (item.cartQuantity || 1), 0)} unidades recuperable.
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => {
                                        if (restoreCartBackup()) {
                                            if (showNotification) showNotification("¡Carrito de la sesión anterior recuperado!", "success");
                                        }
                                    }}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-[10px] uppercase rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1"
                                >
                                    <RotateCcw size={11} />
                                    Recuperar
                                </button>
                                <button
                                    onClick={discardCartBackup}
                                    className="p-1 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200/50 dark:hover:bg-indigo-900/50 rounded-lg transition cursor-pointer"
                                    title="Descartar"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                    <AnimatePresence initial={false} >
                        {cart.map(item => {
                            const isCustom = item.price_type === 'custom';
                            const activePriceBs = getCartItemPriceBs(item);
                            const activePriceUSD = getCartItemPriceUSD(item);
                            const totalItemBs = activePriceBs * item.cartQuantity;
                            const isActive = item.id === activeCartItemId;

                            return (
                                <motion.div 
                                    layout
                                    initial={{ opacity: 0, scale: 0.92, y: 15 }}
                                    animate={{ 
                                        opacity: 1, 
                                        scale: 1, 
                                        y: 0,
                                        boxShadow: isActive ? "0 10px 25px -5px rgba(99,102,241,0.18)" : "0 2px 8px -1px rgba(0,0,0,0.04)"
                                    }}
                                    exit={{ opacity: 0, scale: 0.85, x: -30, transition: { duration: 0.18 } }}
                                    whileHover={{ scale: 1.015, transition: { duration: 0.1 } }}
                                    whileTap={{ scale: 0.985 }}
                                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                                    key={item.id} 
                                    onClick={() => setSelectedCartItemId(item.id)}
                                    className={`flex flex-col gap-1.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                        isActive 
                                            ? 'bg-indigo-50/10 dark:bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/15' 
                                            : 'bg-white dark:bg-[#0b0f19] border-slate-200/70 dark:border-slate-850/80 hover:border-slate-350 dark:hover:border-slate-700'
                                    }`}
                                >
                                    {/* 1. Header Row: Name & Delete Button */}
                                    <div className="flex justify-between items-start gap-1">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-extrabold text-[11.5px] sm:text-[12.5px] text-slate-850 dark:text-slate-100 uppercase tracking-tight leading-snug">
                                                {item.name}
                                            </h4>
                                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                <span className="text-[8px] bg-slate-100 dark:bg-slate-800/80 px-1 py-0.5 rounded font-mono font-bold text-slate-500 dark:text-slate-400 uppercase border border-slate-150/40 dark:border-slate-750/30">
                                                    SKU: {item.sku}
                                                </span>
                                                <span className="text-[8px] bg-slate-100 dark:bg-slate-800/80 px-1 py-0.5 rounded font-bold text-slate-500 dark:text-slate-400 uppercase border border-slate-150/40 dark:border-slate-750/30">
                                                    {item.category}
                                                </span>
                                                {isActive && (
                                                    <span className="text-[7.5px] text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded font-black bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/30 uppercase tracking-wider flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                                        Activo (+/-)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFromCart(item.id);
                                            }}
                                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition shrink-0 cursor-pointer"
                                            title="Quitar del carrito"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>

                                    {/* Subtly divider */}
                                    <div className="border-t border-slate-100 dark:border-slate-850/50 my-0" />

                                    {/* 2. Structured Pricing and Quantity Grid */}
                                    <div className="grid grid-cols-2 gap-2 items-stretch">
                                        
                                        {/* Column A: Interactive Price & Quick Presets */}
                                        <div className="flex flex-col gap-1 justify-between">
                                            <div>
                                                <span className="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                                    Precio Unitario
                                                </span>
                                                
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">Bs.</span>
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        pattern="[0-9.,]*"
                                                        autoComplete="off"
                                                        autoCorrect="off"
                                                        disabled={!hasPermission(user, 'modify_prices')}
                                                        className={`w-18 px-1.5 py-0.5 text-[11px] font-black font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center transition-all ${
                                                            isCustom ? 'ring-1 ring-amber-500/35 border-amber-500/20 bg-amber-500/5' : ''
                                                        }`}
                                                        value={localPriceInputs[item.id] !== undefined ? localPriceInputs[item.id] : activePriceBs.toFixed(2)}
                                                        onChange={(e) => {
                                                            const rawVal = e.target.value.replace(/[^0-9.,]/g, '');
                                                            const origPriceText = localPriceInputs[item.id] !== undefined ? localPriceInputs[item.id] : activePriceBs.toFixed(2);
                                                            const isFirst = justFocusedPrice[item.id];
                                                            const finalVal = getOverwriteValue(origPriceText, rawVal, isFirst);
                                                            setJustFocusedPrice(prev => ({ ...prev, [item.id]: false }));
                                                            handleCustomPriceChange(item.id, finalVal);
                                                        }}
                                                        placeholder="0.00"
                                                        onFocus={(e) => {
                                                            const target = e.target;
                                                            setJustFocusedPrice(prev => ({ ...prev, [item.id]: true }));
                                                            setTimeout(() => {
                                                                try {
                                                                    target.select();
                                                                    target.setSelectionRange(0, target.value.length);
                                                                } catch (err) {}
                                                            }, 100);
                                                            if (!isCustom) {
                                                                enableCustomPrice(item);
                                                            }
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const target = e.currentTarget;
                                                            setTimeout(() => {
                                                                try {
                                                                    target.select();
                                                                    target.setSelectionRange(0, target.value.length);
                                                                } catch (err) {}
                                                            }, 100);
                                                            setSelectedCartItemId(item.id);
                                                        }}
                                                        onBlur={() => {
                                                            setJustFocusedPrice(prev => ({ ...prev, [item.id]: false }));
                                                            const currentText = (localPriceInputs[item.id] !== undefined ? localPriceInputs[item.id] : "").replace(',', '.').trim();
                                                            const num = parseFloat(currentText);
                                                            if (!isNaN(num) && num >= 0) {
                                                                setLocalPriceInputs(prev => ({ ...prev, [item.id]: num.toFixed(2) }));
                                                                const rate = exchangeRate || 6.96;
                                                                updateCartItemPrice(item.id, 'custom', num / rate, num);
                                                            } else {
                                                                setLocalPriceInputs(prev => {
                                                                    const copy = { ...prev };
                                                                    delete copy[item.id];
                                                                    return copy;
                                                                });
                                                            }
                                                        }}

                                                        title="Haga clic para editar el precio directamente"
                                                    />
                                                    {isCustom && (
                                                        <span className="text-[7px] text-amber-600 dark:text-amber-400 font-bold uppercase bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20 shrink-0">
                                                            Fijo
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {/* USD approximation indicator underneath */}
                                                <span className="text-[7.5px] text-slate-400 dark:text-slate-500 font-mono block mt-0.5 ml-4">
                                                    (${activePriceUSD.toFixed(2)} USD)
                                                </span>
                                            </div>

                                            {/* Quick Pricing Presets Toggles (Detalle / X Mayor) */}
                                            <div className="flex items-center bg-slate-100 dark:bg-slate-850 p-0.5 rounded-md border border-slate-200/50 dark:border-slate-800/40 w-fit mt-0.5">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setLocalPriceInputs(prev => {
                                                            const copy = { ...prev };
                                                            delete copy[item.id];
                                                            return copy;
                                                        });
                                                        updateCartItemPrice(item.id, 'unit');
                                                    }}
                                                    className={`px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase transition cursor-pointer ${
                                                        (!item.price_type || item.price_type === 'unit')
                                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                                    }`}
                                                >
                                                    Detalle
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setLocalPriceInputs(prev => {
                                                            const copy = { ...prev };
                                                            delete copy[item.id];
                                                            return copy;
                                                        });
                                                        updateCartItemPrice(item.id, 'bulk');
                                                    }}
                                                    className={`px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase transition cursor-pointer ${
                                                        item.price_type === 'bulk'
                                                            ? 'bg-amber-500 text-white shadow-xs font-extrabold'
                                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                                    }`}
                                                >
                                                    X Mayor
                                                </button>
                                            </div>
                                        </div>

                                        {/* Column B: Quantity Adjuster & Row Subtotal */}
                                        <div className="flex flex-col gap-1 items-end justify-between text-right">
                                            {/* Quantity Segment */}
                                            <div className="flex flex-col gap-0.5 items-end">
                                                <span className="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                    Cantidad
                                                </span>
                                                <div className="flex items-center gap-0.5">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            addToCart(item, -1);
                                                            setSelectedCartItemId(item.id);
                                                        }}
                                                        className="w-6 h-6 flex items-center justify-center text-[10px] font-black bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition shrink-0 cursor-pointer text-slate-800 dark:text-white"
                                                        title="Restar cantidad"
                                                    >
                                                        -
                                                    </button>
                                                    <input 
                                                        type="text" 
                                                        inputMode="numeric" 
                                                        pattern="[0-9]*"
                                                        className="min-w-[36px] max-w-[130px] h-6 px-1 text-center font-mono text-[11px] font-black bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white pointer-events-auto transition-all"
                                                        style={{ width: `${Math.max(2.5, ((item.cartQuantity || '').toString().length || 1) * 0.65 + 0.8)}rem` }}
                                                        value={item.cartQuantity || ''} 
                                                        onFocus={(e) => {
                                                            const target = e.target;
                                                            setJustFocusedQty(prev => ({ ...prev, [item.id]: true }));
                                                            setTimeout(() => {
                                                                try {
                                                                    target.select();
                                                                    target.setSelectionRange(0, target.value.length);
                                                                } catch (err) {}
                                                            }, 100);
                                                        }}
                                                        onChange={(e) => {
                                                            const rawVal = e.target.value.replace(/[^0-9]/g, '');
                                                            const origQtyText = (item.cartQuantity || '').toString();
                                                            const isFirst = justFocusedQty[item.id];
                                                            const finalVal = getOverwriteValue(origQtyText, rawVal, isFirst);
                                                            setJustFocusedQty(prev => ({ ...prev, [item.id]: false }));
                                                            const num = parseInt(finalVal, 10);
                                                            updateCartItemQuantity(item.id, isNaN(num) ? 0 : num);
                                                        }}
                                                        onBlur={() => {
                                                            setJustFocusedQty(prev => ({ ...prev, [item.id]: false }));
                                                            if (!item.cartQuantity || item.cartQuantity <= 0) {
                                                                updateCartItemQuantity(item.id, 1);
                                                            }
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const target = e.currentTarget;
                                                            setTimeout(() => {
                                                                try {
                                                                    target.select();
                                                                    target.setSelectionRange(0, target.value.length);
                                                                } catch (err) {}
                                                            }, 100);
                                                            setSelectedCartItemId(item.id);
                                                        }}

                                                    />
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            addToCart(item, 1);
                                                            setSelectedCartItemId(item.id);
                                                        }}
                                                        className="w-6 h-6 flex items-center justify-center text-[10px] font-black bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition shrink-0 cursor-pointer text-slate-800 dark:text-white"
                                                        title="Sumar cantidad"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Subtotal Display Segment */}
                                            <div className="flex flex-col items-end">
                                                <span className="text-[7.5px] text-slate-400 dark:text-slate-500 uppercase font-bold block leading-none mb-0.5">
                                                    Subtotal del Item
                                                </span>
                                                <span className="text-[12px] sm:text-[13px] font-black font-mono text-slate-800 dark:text-white leading-none">
                                                    Bs. {totalItemBs.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                    {cart.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-16">
                            <ShoppingCart size={32} className="text-slate-200 dark:text-slate-800 mb-3" />
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Sin productos</span>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[200px] mt-1 pr-1 mb-4 font-semibold leading-relaxed">
                                Presiona sobre los artículos del catálogo o escribe arriba para integrarlos al recibo.
                            </p>
                            <button
                                onClick={() => setIsScannerOpen(true)}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-wider transition duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-md shadow-indigo-655/15"
                            >
                                <Camera size={13} />
                                <span>Escanear con Cámara</span>
                            </button>
                        </div>
                    )}
                </div>
                 {/* Subtotal & Action buttons: Simple, highly scannable, delegating details to Checkout */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-850 bg-white dark:bg-[#0c111e] flex flex-col gap-2 shrink-0">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-450 dark:text-slate-400">
                        <span>Items en Carrito:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{cart.length} artículos</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-850 pt-2 shrink-0">
                        <span className="text-xs font-black text-slate-600 dark:text-slate-350 uppercase tracking-wide">SUBTOTAL PARCIAL:</span>
                        <div className="flex flex-col items-end leading-none">
                            <span className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">
                                Bs. {subtotal.toFixed(2)}
                            </span>
                            <span className="text-[9.5px] font-mono font-extrabold text-slate-400 mt-1">
                                $ {(subtotal / exchangeRate).toFixed(2)} USD
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={cart.length === 0}
                        onClick={() => {
                            setPaymentMethod('Efectivo');
                            setCashReceived("");
                            setIsCheckoutOpen(true);
                        }}
                        className={`w-full py-3.5 mt-2 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 duration-200 shadow-md ${
                            cart.length > 0
                                ? 'gamer-rgb-glow text-white hover:shadow-xl cursor-pointer font-sans'
                                : 'bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none font-sans'
                        }`}
                        id="open-checkout-screen-btn"
                    >
                        <CheckCircle2 size={13} className="text-white animate-pulse" />
                        <span>PROCEDER AL PAGO (Bs. {subtotal.toFixed(2)})</span>
                    </button>

                    <button
                        type="button"
                        disabled={cart.length === 0}
                        onClick={() => {
                            setPendingClientName("");
                            setPendingDestination("");
                            setPendingClientPhone("");
                            setIsPendingSaleModalOpen(true);
                        }}
                        className={`w-full py-2.5 mt-1 rounded-2xl text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 duration-200 border ${
                            cart.length > 0
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:border-amber-500/40 cursor-pointer'
                                : 'bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-600 border-transparent cursor-not-allowed'
                        }`}
                        id="save-pending-sale-btn"
                    >
                        <Truck size={12} className="animate-bounce" />
                        <span>RETENER / VENTA PENDIENTE (ENVÍO)</span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col lg:flex-row h-full relative overflow-hidden bg-neutral-50/50 dark:bg-[#070a10]">
            
            <AnimatePresence>
                {receiptConfirmation && (
                    <motion.div
                        initial={{ y: -300, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -300, opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 120 }}
                        className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
                        id="receipt-generated-confirmation"
                    >
                        <div className="bg-white/95 dark:bg-[#0c111e]/95 backdrop-blur-md border border-emerald-500/30 dark:border-emerald-500/40 rounded-3xl p-5 shadow-2xl shadow-emerald-500/10 flex flex-col gap-4 text-slate-800 dark:text-white">
                            
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                                        <CheckCircle2 className="w-6 h-6 animate-pulse" />
                                    </div>
                                    <div>
                                        <h4 className="font-sans font-black text-xs text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">¡Recibo Generado!</h4>
                                        <p className="text-[10px] font-semibold text-slate-400">La venta se completó y se descargó el PDF</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setReceiptConfirmation(null)}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Ticket Details */}
                            <div className="grid grid-cols-2 gap-y-2 text-xs font-mono bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850">
                                <div className="text-slate-400">ID Venta:</div>
                                <div className="text-right font-bold text-slate-850 dark:text-slate-100">#{receiptConfirmation.saleId}</div>
                                
                                <div className="text-slate-400">Cliente:</div>
                                <div className="text-right font-bold text-slate-850 dark:text-slate-100">
                                    {receiptConfirmation.clientName || 'Cliente Particular'}
                                </div>

                                {receiptConfirmation.paymentMethod === 'Crédito' && receiptConfirmation.destination && (
                                    <>
                                        <div className="text-slate-400">Destino:</div>
                                        <div className="text-right font-bold text-slate-850 dark:text-slate-100 uppercase">{receiptConfirmation.destination}</div>
                                    </>
                                )}

                                <div className="text-slate-400">Método de Pago:</div>
                                <div className="text-right font-bold text-slate-850 dark:text-slate-100">{receiptConfirmation.paymentMethod}</div>

                                <div className="text-slate-400">Artículos Vendidos:</div>
                                <div className="text-right font-bold text-slate-850 dark:text-slate-100">{receiptConfirmation.itemsCount} u</div>

                                <div className="col-span-2 border-t border-slate-150 dark:border-slate-800/80 my-1"></div>

                                <div className="text-slate-500 font-sans font-black text-xs uppercase tracking-wider">Total Cobrado:</div>
                                <div className="text-right font-sans font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                    {receiptConfirmation.currency === 'USD' ? '$' : 'Bs.'} {receiptConfirmation.total.toFixed(2)} {receiptConfirmation.currency}
                                </div>
                            </div>

                            {/* CTAs */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        generateTicketPDF(
                                            receiptConfirmation.paymentMethod,
                                            receiptConfirmation.saleId,
                                            receiptConfirmation.items,
                                            receiptConfirmation.clientName,
                                            receiptConfirmation.clientPhone,
                                            receiptConfirmation.discountValue,
                                            receiptConfirmation.total,
                                            receiptConfirmation.subtotal,
                                            receiptConfirmation.pointsRedeemedValue,
                                            receiptConfirmation.currency,
                                            receiptConfirmation.exchangeRate,
                                            receiptConfirmation.cashReceived,
                                            receiptConfirmation.destination
                                        );
                                        showNotification("✓ Copia del ticket de venta descargada.", "success");
                                    }}
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>Reimprimir Ticket</span>
                                </button>
                                <button
                                    onClick={() => setReceiptConfirmation(null)}
                                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-350 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                                >
                                    <span>Aceptar</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Custom sliding notification toast */}
            {notification && (
                <div id="pos-toast" className={`fixed bottom-24 lg:bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-xs font-bold transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
                    notification.type === 'success' 
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/10' 
                        : 'bg-rose-600 border-rose-500 text-white shadow-rose-500/10'
                }`}>
                    <span className="text-sm">{notification.type === 'success' ? '✓' : '⚠️'}</span>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Left Column (the main product catalog & controls) - Wrap in h-full flex flex-col to enable sticky header */}
            <div className="flex-grow flex-1 flex flex-col h-full overflow-hidden">
                
                {/* FIXED STICKY HEADER PANEL FOR MOBILE AND DESKTOP */}
                <div className="px-3.5 pt-3.5 pb-2.5 md:px-5 md:pt-5 bg-neutral-50/95 dark:bg-[#070a10]/95 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-850/30 flex flex-col gap-3 shrink-0 z-10 select-none">
                    
                    {/* Upper active ticket tabs matching Image 2 */}
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between shrink-0">
                        {/* Active Tabs & Add Button */}
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0 select-none flex-1">
                            {tabs.map(tab => {
                                const isActive = tab.id === activeTabId;
                                return (
                                    <div
                                        key={tab.id}
                                        onClick={() => handleSwitchTab(tab.id)}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all duration-200 whitespace-nowrap border ${
                                            isActive 
                                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/10' 
                                                : 'bg-white dark:bg-[#0c111e] border-slate-200/60 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span>{tab.name}</span>
                                        <button
                                            onClick={(e) => handleRemoveTab(tab.id, e)}
                                            className={`p-0.5 rounded-md transition hover:bg-black/10 flex items-center justify-center ${isActive ? 'text-white/80' : 'text-slate-400'}`}
                                        >
                                            <X size={9} />
                                        </button>
                                    </div>
                                );
                            })}
                            <button
                                onClick={handleAddTab}
                                className="w-7 h-7 rounded-full bg-slate-105 hover:bg-slate-200 dark:bg-[#0c111e] dark:hover:bg-slate-850 border border-slate-200/50 dark:border-slate-850 text-slate-500 flex items-center justify-center shrink-0 cursor-pointer transition"
                                title="Nueva Pestaña de Carrito"
                            >
                                <Plus size={12} />
                            </button>
                        </div>
                        
                        {/* Actions Row: Offline Status, Ver Última Venta & Live Exchange Rate */}
                        <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
                            {/* Intelligent Offline HUD (Only visible on large screens to avoid duplicate HUD on mobile top bar) */}
                            <div className="hidden lg:block">
                                <OfflineStatusHUD variant="compact" />
                            </div>

                            {/* Botón Ver Última Venta */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleViewLastSale}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl text-[9.5px] font-black uppercase tracking-wider shadow-sm cursor-pointer transition shrink-0"
                            >
                                <History size={11} className="text-amber-500 animate-pulse" />
                                <span>Ver Última Venta</span>
                            </motion.button>
                            
                            {/* Live exchange badge */}
                            <span className="text-[8.5px] font-black uppercase text-slate-400 bg-slate-105 dark:bg-black/15 border border-slate-200/50 dark:border-slate-800 px-2.5 py-1.5 rounded-xl tracking-wider select-none shrink-0">
                                💵 CAMBIO: $1 = {(exchangeRate || 6.96).toFixed(2)} Bs.
                            </span>
                        </div>
                    </div>

                    {/* Search & Categories bar */}
                    <div className="flex flex-col 2xl:flex-row gap-2.5 2xl:gap-4 items-stretch 2xl:items-center justify-between bg-white dark:bg-[#0c111e] p-2.5 lg:p-3 rounded-2xl lg:rounded-3xl border border-slate-200/60 dark:border-slate-850 select-none shrink-0 shadow-xs">
                        <div className="flex gap-2 w-full 2xl:w-5/12 items-center shrink-0 min-w-0">
                            <div className="flex-1 min-w-0">
                                <POSSearchInput 
                                    initialValue={search} 
                                    onSearchChange={(val) => setSearch(val)} 
                                    onEnter={(val) => {
                                        triggerVibrate(10);
                                        setSearch(val);
                                        setDebouncedSearch(val);
                                        fetchProducts(val);
                                    }}
                                    isSearching={search !== debouncedSearch} 
                                    suggestions={filtered}
                                    onSelectSuggestion={(prod) => {
                                        triggerVibrate(15);
                                        addToCart(prod);
                                    }}
                                    exchangeRate={exchangeRate}
                                />
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsScannerOpen(true)}
                                className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl sm:rounded-2xl flex items-center gap-1.5 font-bold text-xs transition duration-200 hover:scale-[1.01] active:scale-95 whitespace-nowrap cursor-pointer shadow-md shadow-blue-500/10 h-10 shrink-0"
                                title="Escanear Código de Barras"
                            >
                                <Camera size={15} />
                                <span className="hidden sm:inline font-bold">Scanner</span>
                            </button>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full 2xl:w-7/12 justify-between 2xl:justify-end min-w-0">
                            {/* Category selectors with active active oceanic blue styles */}
                            <div className="flex gap-1 overflow-x-auto w-full sm:w-auto pb-0.5 scrollbar-none select-none min-w-0 flex-1 sm:flex-initial">
                                {categories.map(cat => (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        key={cat}
                                        onClick={() => { triggerVibrate(15); setSelectedCategory(cat); }}
                                        className={`px-2.5 py-1 rounded-xl text-[10px] font-black whitespace-nowrap relative transition-colors duration-200 cursor-pointer shrink-0 ${
                                            selectedCategory === cat 
                                                ? 'text-white shadow-md font-extrabold' 
                                                : 'bg-slate-55 dark:bg-[#070b13] border border-slate-100 dark:border-slate-850/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100/80'
                                        }`}
                                    >
                                        {selectedCategory === cat && (
                                            <motion.div
                                                layoutId="pos-active-cat-bg"
                                                className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 -z-10 rounded-xl"
                                                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                                            />
                                        )}
                                        <span className="relative z-10">{cat}</span>
                                    </motion.button>
                                ))}
                            </div>

                            {/* Density & Layout mode toggle for displaying more products */}
                            <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-[#070b13] p-0.5 rounded-xl border border-slate-250/20 dark:border-slate-850/60 shrink-0 justify-around sm:justify-start">
                                <button
                                    type="button"
                                    onClick={() => handleLayoutModeChange('grid')}
                                    className={`px-2 py-1 rounded-lg transition duration-150 cursor-pointer flex items-center gap-1 text-[9px] font-bold ${
                                        viewLayoutMode === 'grid' 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
                                        }`}
                                    title="Grilla Estándar"
                                >
                                    <LayoutGrid size={11} />
                                    <span>Estándar</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleLayoutModeChange('compact-grid')}
                                    className={`px-2 py-1 rounded-lg transition duration-150 cursor-pointer flex items-center gap-1 text-[9px] font-bold ${
                                        viewLayoutMode === 'compact-grid' 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
                                        }`}
                                    title="Grilla Compacta (Ver más)"
                                >
                                    <Grid size={11} />
                                    <span>Compacto</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleLayoutModeChange('list')}
                                    className={`px-2 py-1 rounded-lg transition duration-150 cursor-pointer flex items-center gap-1 text-[9px] font-bold ${
                                        viewLayoutMode === 'list' 
                                            ? 'bg-indigo-600 text-white shadow-sm' 
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                    title="Lista de Alta Densidad (Máximo productos)"
                                >
                                    <List size={11} />
                                    <span>Lista</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SCROLLABLE PRODUCT LIST */}
                <div 
                    className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto flex flex-col gap-4 pb-28 lg:pb-6 touch-momentum"
                    style={catalogScroll.style}
                    {...catalogScroll.touchHandlers}
                >

                {filtered.length === 0 && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center py-16 px-4 bg-white/40 dark:bg-[#0c111e]/40 backdrop-blur-md rounded-3xl border border-slate-150 dark:border-slate-850 text-center max-w-md mx-auto my-8 shadow-sm"
                    >
                        <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-[#0c111e] flex items-center justify-center text-slate-450 dark:text-slate-500 mb-4 border border-slate-200/55 dark:border-slate-850">
                            <Search size={22} className="animate-pulse" />
                        </div>
                        <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            Sin Resultados
                        </h3>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed font-semibold">
                            No se encontraron artículos que coincidan con <span className="font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">"{search || selectedCategory}"</span>.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                triggerVibrate(15);
                                setSearch("");
                                setDebouncedSearch("");
                                setSelectedCategory("Todos");
                                const el = document.getElementById('search-input') as HTMLInputElement;
                                if (el) el.value = "";
                            }}
                            className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors shadow-lg shadow-indigo-500/10 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Restablecer Filtros
                        </button>
                    </motion.div>
                )}

                {/* Master product catalog grid with adaptive layout density */}
                <motion.div 
                    layout="position"
                    className={
                        filtered.length === 0
                            ? "hidden"
                            : viewLayoutMode === 'grid' 
                            ? "grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 sm:gap-4 auto-rows-fr" 
                            : viewLayoutMode === 'compact-grid'
                            ? "grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-2 sm:gap-2.5 auto-rows-fr"
                            : "flex flex-col gap-1.5"
                    }
                >
                    <AnimatePresence >
                        {visibleProducts.map(p => {
                            const lowStock = p.stock <= p.stock_alarm;
                            const itemInCart = cart.find(c => c.id === p.id);
                            const qtyInCart = itemInCart ? itemInCart.cartQuantity : 0;

                            if (viewLayoutMode === 'list') {
                                return (
                                    <motion.div 
                                        layout
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 5 }}
                                        whileHover={{ scale: 1.008, x: 2, boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}
                                        whileTap={{ scale: 0.99 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                                        id={`product-row-${p.id}`}
                                        key={p.id}
                                        onClick={() => addToCart(p, 1)}
                                        className={`group bg-white dark:bg-[#0c111e] border border-slate-150 dark:border-slate-850 p-2 rounded-2xl flex flex-row items-center justify-between gap-3 cursor-pointer select-none min-h-[52px]`}
                                    >
                                        {/* Row Left: ID + Indicator + Thumbnail + Name/Sku */}
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className={`w-2 h-2 rounded-full ${qtyInCart > 0 ? "bg-indigo-600 animate-pulse" : "bg-neutral-200 dark:bg-neutral-800"}`}></span>
                                                <span className="text-[9px] font-mono font-bold text-slate-450">#{p.id}</span>
                                            </div>
                                            
                                            {p.image && (
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSideDetailProduct(p);
                                                    }}
                                                    className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200/50 dark:border-slate-800 bg-slate-50 dark:bg-black/20 shrink-0 relative hover:scale-105 transition duration-150 cursor-zoom-in"
                                                    title="Ver foto del producto"
                                                >
                                                    <img 
                                                        src={p.image} 
                                                        className="w-full h-full object-cover" 
                                                        alt={p.name} 
                                                        referrerPolicy="no-referrer" 
                                                    />
                                                </div>
                                            )}

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-extrabold text-[12px] text-slate-800 dark:text-gray-150 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight truncate">
                                                        {p.name}
                                                    </h4>
                                                    <span className="hidden sm:inline-block text-[8px] font-bold text-slate-450 bg-slate-100 dark:bg-slate-900/40 px-1.5 py-0.5 rounded uppercase max-w-[80px] truncate">
                                                        {p.category}
                                                    </span>
                                                </div>
                                                <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">SKU: {p.sku || 'N/A'}</p>
                                            </div>
                                        </div>

                                        {/* Row Right: Stock status + Prices + Direct Incrementer */}
                                        <div className="flex items-center gap-3 sm:gap-4.5 shrink-0">
                                            {/* Stock tracker */}
                                            <div className="flex flex-col text-right justify-center">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">STOCK</span>
                                                <span className={`text-[10px] sm:text-[11px] font-mono font-bold ${lowStock ? "text-rose-500 font-extrabold" : "text-slate-600 dark:text-slate-400"}`}>
                                                    {p.stock} u
                                                    {lowStock && <span className="ml-1 text-[8px] font-black text-rose-500 bg-rose-500/10 px-1 rounded">MÍN</span>}
                                                </span>
                                            </div>

                                            {/* Pricing column */}
                                            <div className="flex flex-col text-right justify-center font-mono">
                                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                                    Bs. {roundBs((Number(p.price_unit) || 0) * exchangeRate).toFixed(2)}
                                                </span>
                                                <span className="text-[9px] text-slate-405 dark:text-slate-500">
                                                    ${(Number(p.price_unit) || 0).toFixed(2)} USD
                                                </span>
                                            </div>

                                            {/* POS Row Buttons */}
                                            <div className="flex items-center gap-1.5 sm:gap-1 bg-slate-50 dark:bg-slate-900/60 p-1 sm:p-0.5 rounded-xl animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                                                {qtyInCart > 0 ? (
                                                    <button
                                                        onClick={() => updateCartItemQuantity(p.id, Math.max(0, qtyInCart - 1))}
                                                        className="w-11 h-11 sm:w-6 sm:h-6 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-lg bg-white dark:bg-[#111625] hover:bg-slate-100 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center transition border border-slate-200/50 dark:border-slate-805 cursor-pointer text-sm sm:text-xs font-black select-none"
                                                        title="Restar cantidad"
                                                    >
                                                        -
                                                    </button>
                                                ) : null}

                                                <span className={`text-sm sm:text-[10px] font-mono font-extrabold px-1 text-center min-w-[28px] sm:min-w-[20px] w-auto select-none ${qtyInCart > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-705'}`}>
                                                    {qtyInCart}
                                                </span>

                                                <button
                                                    onClick={() => addToCart(p, 1)}
                                                    className={`w-11 h-11 sm:w-6 sm:h-6 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-lg text-sm sm:text-xs font-black flex items-center justify-center transition border cursor-pointer select-none ${
                                                        qtyInCart > 0 
                                                             ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 shadow-xs' 
                                                            : 'bg-white dark:bg-[#111625] border-slate-200/50 dark:border-slate-805 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-405'
                                                    }`}
                                                    title="Sumar cantidad al carrito"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            }

                            if (viewLayoutMode === 'compact-grid') {
                                return (
                                    <motion.div 
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        whileHover={{ y: -2, boxShadow: "0 8px 20px -4px rgba(0,0,0,0.06)" }}
                                        whileTap={{ scale: 0.97 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                                        id={`product-card-compact-${p.id}`}
                                        key={p.id}
                                        onClick={() => addToCart(p, 1)}
                                        className={`group bg-white dark:bg-[#0c111e] rounded-2xl p-2.5 border transition-all duration-150 flex flex-col justify-between cursor-pointer select-none h-full ${
                                            qtyInCart > 0 
                                                ? 'border-indigo-500/70 shadow-xs ring-1 ring-indigo-500/20' 
                                                : 'border-slate-200/70 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-750 shadow-2xs'
                                        }`}
                                    >
                                        <div>
                                            {/* Compact Header: Index code & Cart quant indicator */}
                                            <div className="flex justify-between items-center text-[8.5px] mb-1.5">
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${qtyInCart > 0 ? "bg-indigo-600 animate-pulse" : "bg-neutral-300 dark:bg-neutral-700"}`}></span>
                                                    <span className="font-bold text-slate-400 font-mono truncate">#{p.id}</span>
                                                </div>
                                                {qtyInCart > 0 ? (
                                                    <span className="font-black text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded-full text-[8.5px] whitespace-nowrap">
                                                        {qtyInCart} u
                                                    </span>
                                                ) : lowStock ? (
                                                    <span className="text-[7.5px] font-black text-rose-500 bg-rose-500/10 px-1.5 py-0.2 rounded whitespace-nowrap">
                                                        MÍN
                                                    </span>
                                                ) : (
                                                    <span className="font-mono text-[8px] text-slate-400 whitespace-nowrap">{p.stock} u</span>
                                                )}
                                            </div>

                                            {/* Body */}
                                            <div className="flex gap-2 items-start min-w-0">
                                                {p.image ? (
                                                    <div 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSideDetailProduct(p);
                                                        }}
                                                        className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200/60 dark:border-slate-800 bg-slate-50 shrink-0 relative hover:scale-105 transition duration-150 cursor-zoom-in shadow-2xs"
                                                        title="Ver foto ampliada"
                                                    >
                                                        <img 
                                                            src={p.image} 
                                                            className="w-full h-full object-cover" 
                                                            alt={p.name} 
                                                            referrerPolicy="no-referrer" 
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg border border-slate-100 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/40 shrink-0 flex items-center justify-center text-slate-300 dark:text-slate-700">
                                                        <Package size={14} />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-extrabold text-[11px] text-slate-800 dark:text-gray-150 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 leading-snug line-clamp-2 h-7" title={p.name}>
                                                        {p.name}
                                                    </h3>
                                                    <p className="text-[8px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">SKU: {p.sku || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom prices section */}
                                        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-850/50 flex items-center justify-between text-[10px] gap-1">
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-extrabold text-indigo-600 dark:text-indigo-400 font-mono text-[11.5px] leading-tight whitespace-nowrap">
                                                    Bs. {roundBs((Number(p.price_unit) || 0) * exchangeRate).toFixed(2)}
                                                </span>
                                                <span className="text-[7.5px] font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                                    ${(Number(p.price_unit) || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            
                                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                                {qtyInCart > 0 ? (
                                                    <div className="flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/40 p-0.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/40">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateCartItemQuantity(p.id, Math.max(0, qtyInCart - 1))}
                                                            className="w-5 h-5 rounded bg-white dark:bg-[#0c111e] hover:text-rose-500 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold shadow-2xs"
                                                            title="Restar"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400 px-1 text-center min-w-[16px]">
                                                            {qtyInCart}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => addToCart(p, 1)}
                                                            className="w-5 h-5 rounded bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs"
                                                            title="Sumar"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => addToCart(p, 1)}
                                                        className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 text-slate-600 hover:text-white dark:text-slate-300 dark:hover:text-white flex items-center justify-center text-xs font-bold transition shadow-2xs"
                                                        title="Añadir al carrito"
                                                    >
                                                        <Plus size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            }

                            // Otherwise, render full standard detailed grid card
                            return (
                                <motion.div 
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    whileHover={{ y: -2, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.04)" }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                                    id={`product-card-${p.id}`}
                                    key={p.id}
                                    onClick={() => addToCart(p, 1)}
                                    className={`group bg-white dark:bg-[#0c111e] rounded-2xl p-3 sm:p-3.5 border transition-all duration-200 flex flex-col justify-between cursor-pointer select-none h-full ${
                                        qtyInCart > 0 
                                            ? 'border-indigo-500/70 shadow-sm ring-1 ring-indigo-500/20' 
                                            : 'border-slate-200/80 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                                    }`}
                                >
                                    <div>
                                        {/* Top Meta: ID + In-Cart / Stock alert */}
                                        <div className="flex items-center justify-between gap-1.5 mb-2.5">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${qtyInCart > 0 ? "bg-indigo-600 animate-pulse" : "bg-neutral-300 dark:bg-neutral-700"}`}></span>
                                                <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 truncate">#{p.id}</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {qtyInCart > 0 ? (
                                                    <span className="text-[9.5px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                        {qtyInCart} en carrito
                                                    </span>
                                                ) : lowStock ? (
                                                    <span className="text-[8.5px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                        ⚠️ MÍNIMO
                                                    </span>
                                                ) : (
                                                    <span className="text-[9.5px] font-mono font-bold text-slate-400 dark:text-slate-500">
                                                        {p.stock} u
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Thumbnail & Title/SKU */}
                                        <div className="flex gap-2.5 items-start">
                                            {p.image ? (
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSideDetailProduct(p);
                                                    }}
                                                    className="w-13 h-13 rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-black/30 shrink-0 relative group/img cursor-zoom-in shadow-2xs"
                                                    title="Ampliar foto completa"
                                                >
                                                    <img 
                                                        src={p.image} 
                                                        className="w-full h-full object-cover transition duration-300 group-hover/img:scale-110" 
                                                        alt={p.name} 
                                                        referrerPolicy="no-referrer" 
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center">
                                                        <Maximize2 size={11} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-13 h-13 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/40 shrink-0 flex items-center justify-center text-slate-300 dark:text-slate-700">
                                                    <Package size={18} />
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-extrabold text-[12px] text-slate-850 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug line-clamp-2 h-8" title={p.name}>
                                                    {p.name}
                                                </h3>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate">SKU: {p.sku || 'N/A'}</span>
                                                    {p.category && (
                                                        <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-850 px-1.5 py-0.2 rounded truncate max-w-[75px]">
                                                            {p.category}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom: Pricing + Quick Stepper/Add Button */}
                                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-850/70 flex items-center justify-between gap-2">
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-baseline gap-0.5">
                                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">Bs.</span>
                                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight leading-none whitespace-nowrap">
                                                    {roundBs((Number(p.price_unit) || 0) * exchangeRate).toFixed(2)}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap">
                                                ${(Number(p.price_unit) || 0).toFixed(2)} USD
                                            </span>
                                        </div>

                                        <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                                            {qtyInCart > 0 ? (
                                                <div className="flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/40 p-0.5 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 shadow-xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateCartItemQuantity(p.id, Math.max(0, qtyInCart - 1))}
                                                        className="w-6 h-6 rounded-lg bg-white dark:bg-[#0c111e] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-350 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition cursor-pointer text-xs font-black shadow-2xs"
                                                        title="Restar una unidad"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 px-1.5 text-center min-w-[20px]">
                                                        {qtyInCart}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => addToCart(p, 1)}
                                                        className="w-6 h-6 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition cursor-pointer text-xs font-black shadow-2xs"
                                                        title="Añadir otra unidad"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => addToCart(p, 1)}
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white dark:bg-slate-800 dark:hover:bg-indigo-600 dark:text-slate-300 dark:hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-1 cursor-pointer group-hover:bg-indigo-600 group-hover:text-white shadow-2xs"
                                                    title="Añadir al carrito"
                                                >
                                                    <Plus size={11} />
                                                    <span>Añadir</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </motion.div>

                {filtered.length > visibleCatalogLimit && (
                    <div className="mt-6 mb-4 flex flex-col sm:flex-row items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => setVisibleCatalogLimit(prev => prev + 48)}
                            className="px-5 py-2.5 rounded-2xl bg-indigo-600/10 hover:bg-indigo-600/20 active:scale-95 text-indigo-600 dark:text-indigo-400 font-bold text-xs transition duration-150 flex items-center gap-2 cursor-pointer border border-indigo-500/20"
                        >
                            <span>Mostrar más productos ({visibleCatalogLimit} de {filtered.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setVisibleCatalogLimit(filtered.length)}
                            className="px-3.5 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-semibold text-[11px] transition cursor-pointer"
                        >
                            <span>Mostrar todos</span>
                        </button>
                    </div>
                )}

                {hasMoreProducts && (
                    <div className="mt-8 flex justify-center pb-8">
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
                                'Cargar Más Catálogo de Productos'
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>

            {/* Desktop persistent Sidebar checkouts pane */}
            <div className="hidden lg:flex w-[330px] xl:w-[370px] 2xl:w-[410px] bg-white dark:bg-[#0a0f1b] border-l border-slate-200/60 dark:border-slate-850 flex-col shrink-0">
                {renderCartPane(false)}
            </div>

            {/* Sticky Mobile Bottom Bar */}
            <div className={`lg:hidden fixed left-0 right-0 z-40 bg-white/95 dark:bg-[#0a0f1b]/95 backdrop-blur-md border-t border-slate-200/60 dark:border-slate-800 p-3.5 flex items-center justify-between shadow-2xl px-5 animate-in fade-in slide-in-from-bottom-6 ${isKioskLocked ? "bottom-16" : "bottom-0"}`}>
                <div 
                    onClick={() => setIsMobileCartOpen(true)}
                    className="flex items-center gap-3 cursor-pointer"
                >
                    <div className="relative w-10.5 h-10.5 rounded-2xl bg-indigo-550/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-505/10">
                        <ShoppingBag size={16} />
                        {cart.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white font-mono font-black text-[9px] rounded-full w-5.5 h-5.5 flex items-center justify-center border-2 border-white dark:border-[#0a0f1b] shadow-sm animate-scale">
                                {cart.reduce((s, i) => s + i.cartQuantity, 0)}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">Mi Carrito</span>
                        <span className="text-sm font-black font-mono text-slate-800 dark:text-indigo-400 mt-1.5">
                            Bs. {total.toFixed(2)}
                        </span>
                    </div>
                </div>

                <div className="flex gap-2">
                    {cart.length > 0 ? (
                        <button
                            onClick={() => setIsMobileCartOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-[18px] py-2.5 font-extrabold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-lg shadow-indigo-600/10 cursor-pointer"
                        >
                            <span>Detalles / Cobrar</span>
                            <ChevronRight size={13} />
                        </button>
                    ) : (
                        <button
                            disabled
                            className="bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-500 rounded-2xl px-[18px] py-2.5 font-extrabold text-xs cursor-not-allowed"
                        >
                            Carrito vacío
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Bottom Sheet Slide-up Drawer Modal */}
            <AnimatePresence>
                {isMobileCartOpen && (
                    <div className="lg:hidden fixed inset-0 z-[60] flex items-end justify-center">
                        {/* Smooth sliding backdrop shadow */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
                            onClick={() => setIsMobileCartOpen(false)}
                        />
                        {/* Bottom drawer container */}
                        <motion.div 
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            className="relative bg-white dark:bg-[#0c111e] w-full rounded-t-[32px] overflow-hidden shadow-2xl h-[85vh] flex flex-col z-[60] border-t border-slate-105 dark:border-slate-850"
                        >
                            {/* Drag Handle element */}
                            <div className="w-12 h-1.5 bg-slate-201 dark:bg-slate-800 rounded-full mx-auto my-3 shrink-0 cursor-pointer" onClick={() => setIsMobileCartOpen(false)} />
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                {renderCartPane(true)}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Lateral Drawer showing large HD product image and specifications */}
            <AnimatePresence>
                {sideDetailProduct && (
                    <div className="fixed inset-0 z-[60] flex justify-end">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" 
                            onClick={() => setSideDetailProduct(null)}
                        />
                        <motion.div 
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                            className="relative bg-white dark:bg-[#0f1424] w-full max-w-sm h-full shadow-2xl border-l border-slate-100 dark:border-slate-850 p-6 flex flex-col justify-between z-50"
                        >
                            <div className="overflow-y-auto">
                                {/* Close cross */}
                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-4 mb-4 select-none">
                                    <div>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-[#6366f1] bg-indigo-50 dark:bg-indigo-950/45 px-2.5 py-1 rounded-full">Detalle de Producto</span>
                                        <h3 className="font-extrabold text-xs text-slate-800 dark:text-gray-100 mt-2 uppercase">{sideDetailProduct.name}</h3>
                                    </div>
                                    <button 
                                        onClick={() => setSideDetailProduct(null)}
                                        className="p-1 px-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition cursor-pointer text-slate-400 hover:text-slate-600 font-bold text-xs"
                                        title="Cerrar detalles"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>

                                {/* Product photo presentation */}
                                <div className="w-full aspect-square bg-slate-50/50 dark:bg-black/35 rounded-2xl flex items-center justify-center p-3 border border-slate-100 dark:border-slate-850 overflow-hidden relative group">
                                    {sideDetailProduct.image ? (
                                        <img 
                                            src={sideDetailProduct.image} 
                                            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105" 
                                            alt={sideDetailProduct.name} 
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <div className="text-center text-slate-400">
                                            <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
                                            <span className="text-[9px] uppercase font-extrabold tracking-wider">Sin imagen cargada</span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-5 space-y-3.5">
                                    <div className="grid grid-cols-2 gap-3.5 text-[11px] font-bold">
                                        <div className="p-3 bg-slate-50/50 dark:bg-[#0d1221]/30 rounded-xl border dark:border-slate-850/55">
                                            <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-widest block mb-0.5">Categoría</span>
                                            <span className="text-slate-800 dark:text-slate-200">{sideDetailProduct.category}</span>
                                        </div>
                                        <div className="p-3 bg-slate-50/50 dark:bg-[#0d1221]/30 rounded-xl border dark:border-slate-850/55">
                                            <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-widest block mb-0.5">Código SKU</span>
                                            <span className="font-mono text-slate-800 dark:text-slate-200">{sideDetailProduct.sku || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-indigo-50/20 dark:bg-indigo-950/20 rounded-xl border border-indigo-505/10">
                                        <span className="text-[9px] text-indigo-500 font-extrabold uppercase tracking-widest block mb-1">Precios en POS</span>
                                        <div className={`grid ${user?.role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'} gap-2 text-center text-[10px] font-bold`}>
                                            <div className="p-2 bg-white/60 dark:bg-black/20 rounded-lg">
                                                <span className="text-[8px] text-slate-450 uppercase tracking-widest block">Unitario</span>
                                                <span className="text-indigo-600 dark:text-indigo-400">Bs. {roundBs(sideDetailProduct.price_unit * exchangeRate).toFixed(2)}</span>
                                            </div>
                                            <div className="p-2 bg-white/60 dark:bg-black/20 rounded-lg">
                                                <span className="text-[8px] text-slate-455 uppercase tracking-widest block">Mayorista</span>
                                                <span className="text-slate-600 dark:text-slate-300">Bs. {roundBs(sideDetailProduct.price_bulk * exchangeRate).toFixed(2)}</span>
                                            </div>
                                            {user?.role === 'admin' && (
                                                <div className="p-2 bg-white/60 dark:bg-black/20 rounded-lg">
                                                    <span className="text-[8px] text-slate-455 uppercase tracking-widest block">Costo</span>
                                                    <span className="text-slate-400 dark:text-slate-500">Bs. {roundBs(sideDetailProduct.price_cost * exchangeRate).toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-slate-50/50 dark:bg-[#0d1221]/30 rounded-xl border dark:border-slate-850/55 flex justify-between items-center text-[11px] font-bold">
                                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">Existencias</span>
                                        <span className={`px-2.5 py-0.5 text-[10px] font-mono font-black rounded-lg ${sideDetailProduct.stock <= sideDetailProduct.stock_alarm ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'}`}>
                                            {sideDetailProduct.stock} u disponibles
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Add to checkout trigger */}
                            <div className="border-t border-slate-100 dark:border-slate-850 pt-4 select-none shrink-0">
                                <button
                                    onClick={() => {
                                        addToCart(sideDetailProduct, 1);
                                        showNotification(`✓ ${sideDetailProduct.name} añadido al carrito`, "success");
                                    }}
                                    className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition active:scale-95 duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
                                >
                                    <ShoppingCart size={13} />
                                    <span>Añadir al Carrito (Bs. {roundBs(sideDetailProduct.price_unit * exchangeRate).toFixed(2)})</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Barcode Scanner Modal with audio and visual cues */}
            <BarcodeScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                products={products}
                addToCart={addToCart}
                onSuccessScan={(product) => {
                    setIsScannerOpen(false);
                    setIsMobileCartOpen(true);
                    showNotification(`✓ ${product.name} añadido al carrito`, "success");
                }}
            />

            {/* Modal de Última Venta con Ticket Digital Integrado */}
            <AnimatePresence>
                {lastSaleModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs" 
                            onClick={() => setLastSaleModalOpen(false)}
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-205 dark:border-slate-850 p-6 max-w-sm w-full relative z-10 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-hidden select-none"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-850/60 shrink-0">
                                <div className="flex items-center gap-2 text-amber-500">
                                    <History size={16} className="animate-pulse" />
                                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-850 dark:text-white">Detalle de Última Venta</h3>
                                </div>
                                <button 
                                    onClick={() => setLastSaleModalOpen(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-850 transition cursor-pointer"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-4 text-xs">
                                {loadingLastSale ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                                        <div className="w-8 h-8 rounded-full border-2 border-indigo-600/20 border-t-indigo-650 animate-spin" />
                                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Consultando Base de Datos...</span>
                                    </div>
                                ) : !lastSaleDetails ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <AlertTriangle size={24} className="text-amber-500 mb-2" />
                                        <p className="text-xs font-bold text-slate-600 dark:text-slate-450 uppercase">No se encontró ninguna venta registrada</p>
                                        <p className="text-[10px] text-slate-400 mt-1">Realiza una venta en el Punto de Venta para habilitar este botón.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {/* Physical style receipt ticket roll wrapper */}
                                        <div className="bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-150 dark:border-slate-850 p-4 flex flex-col gap-3 font-mono text-xs text-slate-750 dark:text-slate-300 relative overflow-hidden shadow-inner">
                                            {/* Sapphire visual check cap */}
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-cyan-500" />
                                            
                                            <div className="text-center pt-2 pb-3 border-b border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center">
                                                <span className="font-extrabold text-[#2563eb] text-xs tracking-tight">GTR POS TERMINAL</span>
                                                <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-normal mt-1 block">NIT: 382910023 • Cochabamba</span>
                                                <span className="text-[9.5px] font-black text-rose-500 dark:text-rose-400 bg-rose-500/5 px-2 py-0.5 rounded-md border border-rose-500/10 mt-2">TRANS # {lastSaleDetails.id}</span>
                                            </div>

                                            {/* Transaction info block */}
                                            <div className="flex flex-col gap-1 text-[10px] pb-3 border-b border-dashed border-slate-200 dark:border-slate-800 font-semibold">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Cajero:</span>
                                                    <span className="text-slate-705 dark:text-slate-200">@{lastSaleDetails.user_name || 'Cajero Fiscal'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Fecha:</span>
                                                    <span className="text-slate-705 dark:text-slate-200">{new Date(lastSaleDetails.created_at).toLocaleString()}</span>
                                                </div>
                                                {lastSaleDetails.client_name && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Cliente:</span>
                                                        <span className="text-slate-705 dark:text-slate-200">{lastSaleDetails.client_name}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Método de Pago:</span>
                                                    <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-md font-bold text-[8.5px] uppercase tracking-wide border border-blue-500/10">{lastSaleDetails.payment_method}</span>
                                                </div>
                                            </div>

                                            {/* Articles list */}
                                            <div className="flex flex-col gap-2 py-1 max-h-36 overflow-y-auto">
                                                <div className="flex justify-between font-black text-[9px] text-slate-400 dark:text-slate-500 tracking-wider">
                                                    <span>ARTÍCULO</span>
                                                    <div className="flex gap-4">
                                                        <span>CANT</span>
                                                        <span className="w-16 text-right font-mono">TOTAL</span>
                                                    </div>
                                                </div>
                                                
                                                {lastSaleItems.length === 0 ? (
                                                    <p className="text-[10px] text-slate-400 text-center py-2 animate-pulse">Cargando desglose...</p>
                                                ) : (
                                                    lastSaleItems.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                                                            <span className="truncate max-w-[150px]">{item.product_name || 'Artículo'}</span>
                                                            <div className="flex gap-4">
                                                                <span className="font-mono text-slate-400">x{item.quantity}</span>
                                                                <span className="font-mono w-16 text-right">Bs.{Number(item.quantity * item.price).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* Financial summaries */}
                                            <div className="pt-3 border-t border-dashed border-slate-200 dark:border-slate-800 flex flex-col gap-1 font-bold text-[10.5px]">
                                                <div className="flex justify-between">
                                                    <span>Subtotal:</span>
                                                    <span className="font-mono">Bs. {Number((lastSaleDetails.total || 0) + (lastSaleDetails.discount || 0)).toFixed(2)}</span>
                                                </div>
                                                {lastSaleDetails.discount > 0 && (
                                                    <div className="flex justify-between text-rose-500">
                                                        <span>Descuento:</span>
                                                        <span className="font-mono">-Bs. {Number(lastSaleDetails.discount).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-xs font-black border-t border-slate-250 dark:border-slate-800 pt-2 text-slate-850 dark:text-white">
                                                    <span>TOTAL NETO:</span>
                                                    <span className="font-mono text-emerald-650 dark:text-emerald-400 font-black">Bs. {Number(lastSaleDetails.total || 0).toFixed(2)}</span>
                                                </div>
                                            </div>

                                            {/* Aesthetic digital barcode sticker */}
                                            <div className="flex flex-col items-center pt-2.5 pb-1 border-t border-dashed border-slate-200 dark:border-slate-800 mt-2 select-none gap-1 bg-white/50 dark:bg-black/10 rounded-xl">
                                                <QrCode size={32} className="opacity-75 dark:bg-white dark:text-black p-0.5 rounded cursor-pointer" />
                                                <span className="text-[7px] font-bold tracking-widest text-slate-400 uppercase">SYS-SECURE-ID-{lastSaleDetails.id}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer Controls */}
                            <div className="flex gap-2.5 mt-2 shrink-0">
                                <button
                                    onClick={() => setLastSaleModalOpen(false)}
                                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold uppercase rounded-xl transition cursor-pointer dark:bg-slate-900 dark:text-slate-350"
                                >
                                    Cerrar
                                </button>
                                {lastSaleDetails && (
                                    <button
                                        onClick={() => generatePastTicketPDF(lastSaleDetails, lastSaleItems)}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/10 cursor-pointer"
                                    >
                                        <Printer size={12} />
                                        Re-Imprimir PDF
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de Retención de Venta Pendiente (Envío) */}
            <AnimatePresence>
                {isPendingSaleModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" 
                            onClick={() => setIsPendingSaleModalOpen(false)}
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-205 dark:border-slate-850 p-6 max-w-md w-full relative z-10 flex flex-col gap-4 shadow-2xl select-none text-slate-800 dark:text-white"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-850/60 shrink-0">
                                <div className="flex items-center gap-2 text-amber-500">
                                    <Truck size={18} className="animate-pulse" />
                                    <h2 className="text-sm font-extrabold uppercase tracking-wider">Retener / Venta Pendiente</h2>
                                </div>
                                <button 
                                    onClick={() => setIsPendingSaleModalOpen(false)}
                                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 dark:text-slate-500 cursor-pointer transition"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                                Registra este pedido de forma temporal para envíos. El stock de los productos no se deducirá hasta que la venta sea finalizada y cobrada en el módulo correspondiente.
                            </p>

                            <form onSubmit={handleSavePendingSale} className="flex flex-col gap-3.5 mt-1">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Cliente *</label>
                                    <div className="relative">
                                        <input 
                                            type="text"
                                            required
                                            value={pendingClientName}
                                            onChange={(e) => setPendingClientName(e.target.value)}
                                            placeholder="Ej. Juan Pérez"
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-205 dark:border-slate-850 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 text-slate-700 dark:text-slate-200 placeholder-slate-400"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destino del Envío *</label>
                                    <textarea 
                                        required
                                        rows={2}
                                        value={pendingDestination}
                                        onChange={(e) => setPendingDestination(e.target.value)}
                                        placeholder="Ej. Calle Aroma #420, Cochabamba (Envío por flota o delivery)"
                                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-205 dark:border-slate-850 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 text-slate-700 dark:text-slate-200 placeholder-slate-400 resize-none"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa de Transporte (Opcional)</label>
                                    <input 
                                        type="text"
                                        value={pendingTransportCompany}
                                        onChange={(e) => setPendingTransportCompany(e.target.value)}
                                        placeholder="Ej. Trans Copacabana, Delivery Moto, etc."
                                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-205 dark:border-slate-850 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 text-slate-700 dark:text-slate-200 placeholder-slate-400"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono / Celular (Opcional)</label>
                                    <input 
                                        type="tel"
                                        value={pendingClientPhone}
                                        onChange={(e) => setPendingClientPhone(e.target.value)}
                                        placeholder="Ej. 78945612"
                                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-205 dark:border-slate-850 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 text-slate-700 dark:text-slate-200 placeholder-slate-400"
                                    />
                                </div>

                                <div className="p-3 bg-slate-50/50 dark:bg-black/20 border border-slate-200/50 dark:border-slate-850 rounded-2xl flex justify-between items-center text-xs mt-1.5">
                                    <span className="font-bold text-slate-500">Monto del Pedido:</span>
                                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">Bs. {subtotal.toFixed(2)}</span>
                                </div>

                                <div className="flex gap-2.5 mt-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsPendingSaleModalOpen(false)}
                                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingPending}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-slate-300 disabled:to-slate-400 text-white font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5 transition"
                                    >
                                        {isSavingPending ? "Guardando..." : "Guardar Pedido"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de Finalización de Compra (Checkout) */}
            <AnimatePresence>
                {isCheckoutOpen && (
                    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" 
                            onClick={() => setIsCheckoutOpen(false)}
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            className="bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-205 dark:border-slate-850 p-4 sm:p-5 max-w-3xl w-full relative z-10 flex flex-col gap-3 shadow-2xl max-h-[95vh] overflow-y-auto select-none"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-850/60 shrink-0">
                                <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                    <ShoppingCart size={14} className="animate-pulse text-indigo-555" />
                                    <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-850 dark:text-white">Panel de Facturación & Pago Rápido</h3>
                                </div>
                                <button 
                                    onClick={() => {
                                        setIsCheckoutOpen(false);
                                        setCashReceived("");
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-850 transition cursor-pointer"
                                    id="close-checkout-modal-btn"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Modal Body: 12-Column Responsive Layout tailored for Cash Register */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pr-1">
                                
                                {/* LEFT WORKSPACE (Col Span 7): THE HERO - CAJA REGISTRADORA / MEDIO ACTIVO */}
                                <div className="lg:col-span-7 flex flex-col gap-3">
                                    {paymentMethod === 'Efectivo' && (
                                        <div className="p-3 bg-slate-50 dark:bg-black/10 border border-slate-200/65 dark:border-slate-800/40 rounded-xl flex flex-col gap-2 shadow-xs animate-in fade-in duration-200">
                                            
                                            {/* Header Section with Improved Caja Registradora Selector */}
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1 text-emerald-650 dark:text-emerald-400 font-sans">
                                                    <Coins size={12} />
                                                    <span className="text-[8.5px] font-black uppercase tracking-widest">Moneda de Recibo</span>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-1 bg-slate-200/30 dark:bg-slate-900/50 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-800/40">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCheckoutCurrency('BOB');
                                                            setCashReceived("");
                                                        }}
                                                        className={`flex flex-col items-center justify-center py-1 px-2 rounded-md transition-all duration-150 cursor-pointer select-none ${
                                                            checkoutCurrency === 'BOB'
                                                                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                                        }`}
                                                    >
                                                        <span className="text-[7.5px] font-black uppercase tracking-wider opacity-85">Bolivianos (Bs.)</span>
                                                        <span className="font-mono text-[10px] font-black">Bs. {total.toFixed(2)}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCheckoutCurrency('USD');
                                                            setCashReceived("");
                                                        }}
                                                        className={`flex flex-col items-center justify-center py-1 px-2 rounded-md transition-all duration-150 cursor-pointer select-none ${
                                                            checkoutCurrency === 'USD'
                                                                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                                        }`}
                                                    >
                                                        <span className="text-[7.5px] font-black uppercase tracking-wider opacity-85">Dólares (USD)</span>
                                                        <span className="font-mono text-[10px] font-black">$ {usdTotal.toFixed(2)}</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Giant Money Received Input Field */}
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                    <span>Efectivo Recibido ({checkoutCurrency}):</span>
                                                    {cashReceived && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setCashReceived("")}
                                                            className="text-[8px] font-black text-rose-500 hover:text-rose-650 uppercase hover:underline cursor-pointer"
                                                        >
                                                            Limpiar Entrada
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <input 
                                                        ref={cashInputRef}
                                                        type="text" 
                                                        inputMode="decimal"
                                                        pattern="[0-9.]*"
                                                        autoFocus
                                                        key={isCheckoutOpen ? `checkout-cash-input-${checkoutCurrency}` : "closed"}
                                                        placeholder={(checkoutCurrency === 'USD' ? usdTotal : total).toFixed(2)}
                                                        className="w-full py-1.5 px-3 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 text-sm font-bold font-mono text-right pr-10 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 text-slate-800 dark:text-white caret-emerald-500 transition-all duration-150"
                                                        value={cashReceived}
                                                        onFocus={(e) => {
                                                            const target = e.target;
                                                            setJustFocusedCash(true);
                                                            setTimeout(() => {
                                                                try {
                                                                    target.select();
                                                                    target.setSelectionRange(0, target.value.length);
                                                                } catch (err) {}
                                                            }, 100);
                                                        }}
                                                        onClick={(e) => {
                                                            const target = e.currentTarget;
                                                            setTimeout(() => {
                                                                try {
                                                                    target.select();
                                                                    target.setSelectionRange(0, target.value.length);
                                                                } catch (err) {}
                                                            }, 100);
                                                        }}
                                                        onBlur={() => {
                                                            setJustFocusedCash(false);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (justFocusedCash && /^[0-9.]$/.test(e.key)) {
                                                                e.preventDefault();
                                                                setCashReceived(e.key);
                                                                setJustFocusedCash(false);
                                                            } else if (e.key !== 'Tab' && e.key !== 'Shift' && e.key !== 'Enter') {
                                                                setJustFocusedCash(false);
                                                            }
                                                        }}
                                                        onChange={(e) => {
                                                            const rawVal = e.target.value.replace(/[^0-9.]/g, '');
                                                            const origCashText = cashReceived;
                                                            const isFirst = justFocusedCash;
                                                            const finalVal = getOverwriteValue(origCashText, rawVal, isFirst);
                                                            setJustFocusedCash(false);
                                                            setCashReceived(finalVal);
                                                        }}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-black text-emerald-500 select-none">
                                                        {checkoutCurrency === 'USD' ? '$' : 'Bs.'}
                                                    </span>
                                                </div>

                                                {/* Core fast exact-cash buttons */}
                                                <div className="mt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCashReceived((checkoutCurrency === 'USD' ? usdTotal : total).toFixed(2))}
                                                        className="w-full py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer select-none"
                                                    >
                                                        <Check size={10} />
                                                        Pago Exacto
                                                    </button>
                                                </div>
                                            </div>

                                            {/* GIANT DYNAMIC RE-RENDERED VUELTO STATUS CARD */}
                                            <div className="mt-1">
                                                {(() => {
                                                    const receivedNum = cashReceived.toString().trim() !== "" ? Number(cashReceived) : 0;
                                                    const currentTotal = checkoutCurrency === 'USD' ? usdTotal : total;
                                                    const change = receivedNum - currentTotal;
                                                    
                                                    if (cashReceived.toString().trim() === "") {
                                                        return null;
                                                    } else if (change >= 0) {
                                                        return (
                                                            <motion.div 
                                                                initial={{ scale: 0.98, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                className="bg-emerald-600 rounded-xl p-3 text-white text-center flex flex-col items-center justify-center gap-0.5 select-none shadow-sm shadow-emerald-550/10 animate-in fade-in duration-200 border border-emerald-500/20"
                                                            >
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-100">
                                                                    Entregar Cambio (Vuelto)
                                                                </span>
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-xl font-black font-mono tracking-tight">
                                                                        {checkoutCurrency === 'USD' ? '$' : 'Bs.'} {change.toFixed(2)} {checkoutCurrency}
                                                                    </span>
                                                                    
                                                                    {checkoutCurrency === 'USD' ? (
                                                                        <span className="text-[9px] font-mono font-bold text-emerald-100 bg-black/15 px-2 py-0.5 rounded-full mt-1">
                                                                            Equivale a: <strong className="text-white font-black">Bs. {(change * exchangeRate).toFixed(2)}</strong>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[9px] font-mono font-bold text-emerald-100 bg-black/15 px-2 py-0.5 rounded-full mt-1">
                                                                            Equivale a: <strong className="text-white font-black">$ {(change / exchangeRate).toFixed(2)} USD</strong>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    } else {
                                                        return (
                                                            <motion.div 
                                                                initial={{ scale: 0.98, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                className="bg-rose-600 rounded-xl p-3 text-white text-center flex flex-col items-center gap-0.5 select-none animate-in fade-in duration-200 border border-rose-500/20"
                                                            >
                                                                <span className="text-[8px] font-black uppercase tracking-wider text-rose-105">
                                                                    ⚠️ Efectivo Insuficiente
                                                                </span>
                                                                <span className="text-sm font-black font-mono">
                                                                    Faltan: {checkoutCurrency === 'USD' ? '$' : 'Bs.'} {Math.abs(change).toFixed(2)}
                                                                </span>
                                                            </motion.div>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    {paymentMethod === 'Tarjeta' && (
                                        <div className="p-3 bg-slate-50 dark:bg-black/10 border border-blue-500/10 rounded-xl flex flex-col gap-2 text-center animate-in fade-in duration-200">
                                            <CreditCard size={20} className="text-blue-500 mx-auto" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Pago por Tarjeta</span>
                                                <p className="text-[9px] text-slate-400 uppercase font-medium">Use la terminal POS física</p>
                                            </div>
                                            <div className="bg-blue-55/10 dark:bg-blue-950/10 border border-blue-100/30 rounded-lg p-2 flex flex-col gap-1 max-w-sm mx-auto w-full">
                                                <div className="flex justify-between text-[10px] font-mono font-bold">
                                                    <span className="text-slate-400">COBRO:</span>
                                                    <span className="text-slate-800 dark:text-white">Bs. {total.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {paymentMethod === 'Transferencia' && (
                                        <div className="p-3 bg-slate-50 dark:bg-black/10 border border-purple-500/10 rounded-xl flex flex-col gap-2 text-center animate-in fade-in duration-200">
                                            <QrCode size={20} className="text-purple-500 mx-auto" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Pago por Transferencia</span>
                                                <p className="text-[9px] text-slate-400 uppercase font-medium">Muestre el código QR al cliente</p>
                                            </div>
                                            <div className="bg-purple-55/10 dark:bg-purple-950/10 border border-purple-100/30 rounded-lg p-2 flex flex-col gap-1 max-w-sm mx-auto w-full">
                                                <div className="flex justify-between text-[10px] font-mono font-bold">
                                                    <span className="text-slate-400">COBRO:</span>
                                                    <span className="text-slate-800 dark:text-white">Bs. {total.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {paymentMethod === 'Crédito' && (
                                        <div className="p-3 bg-slate-50 dark:bg-black/10 border border-amber-500/10 rounded-xl flex flex-col gap-2.5 animate-in fade-in duration-200">
                                            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                                <ArrowLeftRight size={14} />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Planificación de Venta al Crédito (CXC)</span>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-0.5">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[8px] font-bold text-slate-400 dark:text-slate-450 uppercase tracking-wider">Abono Inicial (Bs)</span>
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        pattern="[0-9.]*"
                                                        placeholder="0.00" 
                                                        className="p-1.5 bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-mono font-bold dark:text-white focus:outline-none focus:border-amber-500"
                                                        value={initialAbono || ""} 
                                                        onFocus={(e) => {
                                                            const target = e.target;
                                                            setJustFocusedAbono(true);
                                                            setTimeout(() => {
                                                                try {
                                                                    target.select();
                                                                    target.setSelectionRange(0, target.value.length);
                                                                } catch (err) {}
                                                            }, 100);
                                                        }}
                                                        onClick={(e) => {
                                                            const target = e.currentTarget;
                                                            setTimeout(() => {
                                                                try {
                                                                    target.select();
                                                                    target.setSelectionRange(0, target.value.length);
                                                                } catch (err) {}
                                                            }, 100);
                                                        }}
                                                        onBlur={() => {
                                                            setJustFocusedAbono(false);
                                                        }}
                                                        onChange={(e) => {
                                                            const rawVal = e.target.value.replace(/[^0-9.]/g, '');
                                                            const origAbonoText = (initialAbono || "").toString();
                                                            const isFirst = justFocusedAbono;
                                                            const finalVal = getOverwriteValue(origAbonoText, rawVal, isFirst);
                                                            setJustFocusedAbono(false);
                                                            setInitialAbono(finalVal === "" ? 0 : Math.max(0, Number(finalVal)));
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[8px] font-bold text-slate-455 dark:text-slate-450 uppercase tracking-wider">Vencimiento</span>
                                                    <input 
                                                        type="date" 
                                                        className="p-1.5 bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-mono font-bold dark:text-white focus:outline-none focus:border-amber-500"
                                                        value={dueDate}
                                                        onChange={e => setDueDate(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="bg-amber-55/10 dark:bg-amber-500/10 border border-amber-500/15 rounded-lg p-2.5 flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-slate-750 dark:text-slate-300">
                                                <span className="text-slate-455">SALDO RESTANTE EN CUENTA:</span>
                                                <span className="text-rose-500 dark:text-rose-450 font-black font-mono text-sm">
                                                    Bs. {Math.max(0, total - (initialAbono || 0)).toFixed(2)}
                                                </span>
                                            </div>

                                            {/* New Menu for Credit: requesting destination, client name, and phone number */}
                                            <div className="border-t border-dashed border-slate-200 dark:border-slate-800/80 pt-2 flex flex-col gap-2">
                                                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                                    <UserCheck size={12} />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Datos Obligatorios del Cliente & Envío</span>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {/* Client Name Input */}
                                                    <div className="flex flex-col gap-1 relative">
                                                        <label className="text-[8px] font-bold text-slate-455 dark:text-slate-450 uppercase tracking-wider">Nombre del Cliente *</label>
                                                        <div className="relative">
                                                            <input 
                                                                type="text" 
                                                                placeholder="Ej: Juan Pérez" 
                                                                className="p-1.5 w-full bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold focus:outline-none focus:border-amber-500 dark:text-white uppercase"
                                                                value={clientName}
                                                                onChange={e => {
                                                                    setClientName(e.target.value);
                                                                    setShowClientSuggestions(true);
                                                                }}
                                                                onFocus={() => setShowClientSuggestions(true)}
                                                            />
                                                            
                                                            {/* Autocomplete Predictions floating dropdown */}
                                                            {showClientSuggestions && clientName.trim().length > 0 && (
                                                                <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-36 overflow-y-auto bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl divide-y divide-slate-100 dark:divide-slate-850">
                                                                    {clients
                                                                        .filter(c => (c.name || '').toLowerCase().includes(clientName.toLowerCase()) || (c.phone || '').includes(clientName))
                                                                        .slice(0, 5)
                                                                        .map(c => (
                                                                            <div
                                                                                key={c.id}
                                                                                onClick={() => {
                                                                                    setClientName(c.name);
                                                                                    setClientPhone(c.phone || "");
                                                                                    setShowClientSuggestions(false);
                                                                                }}
                                                                                className="p-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition uppercase"
                                                                            >
                                                                                {c.name} {c.phone ? `(${c.phone})` : ''}
                                                                            </div>
                                                                        ))
                                                                    }
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Client Phone Input */}
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[8px] font-bold text-slate-455 dark:text-slate-450 uppercase tracking-wider">Celular / Teléfono</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Ej: 70000000" 
                                                            className="p-1.5 w-full bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-mono font-bold focus:outline-none focus:border-amber-500 dark:text-white"
                                                            value={clientPhone}
                                                            onChange={e => setClientPhone(e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Destination input field */}
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[8px] font-bold text-slate-455 dark:text-slate-450 uppercase tracking-wider">Dirección / Destino de Envío</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Ej: Av. Las Américas, Edif. GTR #32" 
                                                        className="p-1.5 w-full bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold focus:outline-none focus:border-amber-500 dark:text-white uppercase"
                                                        value={creditDestination}
                                                        onChange={e => setCreditDestination(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </div>

                                {/* RIGHT WORKSPACE (Col Span 5): BILL SUMMARY, OTRO METODO & EXECUTE */}
                                <div className="lg:col-span-5 flex flex-col gap-3">
                                    
                                    {/* Core Total Box Display */}
                                    <div className="p-3 bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col gap-2 shadow-xs">
                                        <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                                            <span>Subtotal del Carrito:</span>
                                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Bs. {subtotal.toFixed(2)}</span>
                                        </div>
                                        {discountValue > 0 && (
                                            <div className="flex justify-between items-center text-[10px] text-rose-500 font-bold">
                                                <span>Descuento Aplicado:</span>
                                                <span className="font-mono">-Bs. {discountValue.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="border-t border-dashed border-slate-200 dark:border-slate-800/60 pt-2 flex justify-between items-center">
                                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Total Neto a Cobrar</span>
                                            <div className="text-right">
                                                <span className="text-base font-mono font-black text-indigo-600 dark:text-indigo-400">
                                                    Bs. {total.toFixed(2)}
                                                </span>
                                                <span className="block text-[8px] font-mono font-bold text-slate-400">
                                                    $ {usdTotal.toFixed(2)} USD
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Toggle Payment Method selector */}
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Medio de Pago:</span>
                                        <div className="grid grid-cols-2 gap-1">
                                            {[
                                                { id: 'Efectivo', label: 'Efectivo', icon: Coins },
                                                { id: 'Tarjeta', label: 'Tarjeta', icon: CreditCard },
                                                { id: 'Transferencia', label: 'QR Bancario', icon: QrCode },
                                                { id: 'Crédito', label: 'Crédito', icon: ArrowLeftRight }
                                            ].map((m) => {
                                                const IconComp = m.icon;
                                                const isActive = paymentMethod === m.id;
                                                return (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setPaymentMethod(m.id as any);
                                                            if (m.id !== 'Efectivo') {
                                                                setCashReceived("");
                                                            }
                                                        }}
                                                        className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 text-[9px] font-extrabold uppercase tracking-wide cursor-pointer select-none ${
                                                            isActive
                                                            ? `bg-indigo-650 text-white border-indigo-650 shadow-sm`
                                                            : `bg-white dark:bg-[#0c111e] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900`
                                                        }`}
                                                    >
                                                        <IconComp size={11} className={isActive ? 'text-white' : 'text-slate-400'} />
                                                        <span>{m.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Discount Parameter Special settings */}
                                    <div className="p-2 bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col gap-1.5">
                                        <div className="flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                            <span>Descuento de Caja:</span>
                                            <div className="flex gap-1">
                                                <button 
                                                    type="button"
                                                    disabled={!hasPermission(user, 'apply_discounts')}
                                                    onClick={() => setDiscountType('monto')}
                                                    className={`px-1 py-0.2 rounded text-[8px] font-bold transition ${!hasPermission(user, 'apply_discounts') ? 'opacity-40 cursor-not-allowed' : ''} ${discountType === 'monto' ? 'bg-indigo-500/10 text-indigo-600 font-extrabold' : 'bg-transparent text-slate-400'}`}
                                                >
                                                    Bs.
                                                </button>
                                                <button 
                                                    type="button"
                                                    disabled={!hasPermission(user, 'apply_discounts')}
                                                    onClick={() => setDiscountType('porcentaje')}
                                                    className={`px-1 py-0.2 rounded text-[8px] font-bold transition ${!hasPermission(user, 'apply_discounts') ? 'opacity-40 cursor-not-allowed' : ''} ${discountType === 'porcentaje' ? 'bg-indigo-500/10 text-indigo-600 font-extrabold' : 'bg-transparent text-slate-400'}`}
                                                >
                                                    %
                                                </button>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                inputMode="decimal"
                                                pattern="[0-9.]*"
                                                disabled={!hasPermission(user, 'apply_discounts')}
                                                placeholder={!hasPermission(user, 'apply_discounts') ? "Sin permiso" : (discountType === 'porcentaje' ? "Ej: 10%" : "Ej: Bs.15")}
                                                className={`p-1.5 w-full bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-mono font-bold text-right pr-6 focus:outline-none focus:border-indigo-500 dark:text-white ${!hasPermission(user, 'apply_discounts') ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900' : ''}`}
                                                value={discount === 0 ? "" : discount} 
                                                onFocus={(e) => {
                                                    const target = e.target;
                                                    setJustFocusedDiscount(true);
                                                    setTimeout(() => {
                                                        try {
                                                            target.select();
                                                            target.setSelectionRange(0, target.value.length);
                                                        } catch (err) {}
                                                    }, 100);
                                                }}
                                                onClick={(e) => {
                                                    const target = e.currentTarget;
                                                    setTimeout(() => {
                                                        try {
                                                            target.select();
                                                            target.setSelectionRange(0, target.value.length);
                                                        } catch (err) {}
                                                    }, 100);
                                                }}
                                                onBlur={() => {
                                                    setJustFocusedDiscount(false);
                                                }}
                                                onChange={(e) => {
                                                    const rawVal = e.target.value.replace(/[^0-9.]/g, '');
                                                    const origDiscountText = (discount || "").toString();
                                                    const isFirst = justFocusedDiscount;
                                                    const finalVal = getOverwriteValue(origDiscountText, rawVal, isFirst);
                                                    setJustFocusedDiscount(false);
                                                    setDiscount(finalVal === "" ? 0 : Math.max(0, Number(finalVal)));
                                                }}
                                            />
                                            <span className="absolute right-2 top-1.5 text-[10px] font-semibold text-slate-405">{discountType === 'porcentaje' ? '%' : 'Bs'}</span>
                                        </div>
                                    </div>

                                    {/* Notes/Comments Field */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Notas del Ticket / Venta:</label>
                                        <textarea
                                            placeholder="Escriba alguna nota o aclaración que saldrá impresa en el ticket..."
                                            className="p-1.5 w-full h-11 bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-800 rounded-xl text-[9px] font-bold focus:outline-none focus:border-indigo-500 dark:text-white resize-none shadow-xs"
                                            value={checkoutDescription}
                                            onChange={e => setCheckoutDescription(e.target.value)}
                                        />
                                    </div>

                                    {/* EXECUTION ACTION TRIGGER */}
                                    <div className="mt-1 flex flex-col gap-1">
                                        <motion.button 
                                            type="button"
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => executeCheckout(paymentMethod)}
                                            disabled={
                                                isCheckoutProcessing ||
                                                (paymentMethod === 'Crédito' && !clientName.trim()) ||
                                                (paymentMethod === 'Efectivo' && cashReceived.trim() !== "" && (Number(cashReceived) - (checkoutCurrency === 'USD' ? usdTotal : total)) < 0)
                                            }
                                            className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer font-sans select-none border-none ${
                                                (isCheckoutProcessing ||
                                                 (paymentMethod === 'Crédito' && !clientName.trim()) ||
                                                 (paymentMethod === 'Efectivo' && cashReceived.trim() !== "" && (Number(cashReceived) - (checkoutCurrency === 'USD' ? usdTotal : total)) < 0))
                                                    ? 'bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
                                                    : 'gamer-rgb-glow text-white hover:shadow-xl shadow-md'
                                            }`}
                                        >
                                            {isCheckoutProcessing ? (
                                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Printer size={12} className="text-white" />
                                            )}
                                            <span>
                                                {isCheckoutProcessing ? 'Procesando Venta...' : `Cobrar & Imprimir Ticket (${checkoutCurrency === 'USD' ? `$ ${usdTotal.toFixed(2)} USD` : `${total.toFixed(2)} Bs.`})`}
                                            </span>
                                        </motion.button>
                                        
                                        {paymentMethod === 'Crédito' && !clientName.trim() && (
                                            <p className="text-[8px] text-amber-600 dark:text-amber-400 font-extrabold uppercase mt-1 text-center tracking-wider animate-pulse">
                                                ⚠️ Se requiere ingresar un cliente para ventas al crédito
                                            </p>
                                        )}
                                        {paymentMethod === 'Efectivo' && cashReceived.trim() !== "" && (Number(cashReceived) - (checkoutCurrency === 'USD' ? usdTotal : total)) < 0 && (
                                            <p className="text-[8px] text-rose-500 mt-1 font-extrabold uppercase text-center tracking-wider animate-pulse">
                                                ⚠️ Efectivo recibido incompleto para procesar pedido
                                            </p>
                                        )}
                                    </div>

                                </div>

                            </div>
                            
                            {/* Modal Footer Secondary Close */}
                            <div className="flex justify-end border-t border-slate-100 dark:border-slate-850/60 pt-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCheckoutOpen(false);
                                        setCashReceived("");
                                    }}
                                    className="px-6 py-2 bg-slate-100 hover:bg-slate-150 text-slate-655 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-850 text-xs font-bold rounded-xl transition cursor-pointer"
                                    id="cancel-checkout-billing-btn"
                                >
                                    Modificar Carrito / Cancelar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
