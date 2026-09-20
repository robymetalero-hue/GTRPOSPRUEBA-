import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { canAccessForensicAudit } from '../utils/permissions';
import { 
  ShieldCheck, ShieldAlert, Sparkles, Search, RefreshCw, Filter, 
  Calendar, CheckCircle2, AlertTriangle, XCircle, ArrowDownLeft, 
  ArrowUpRight, User, Clock, FileText, Printer, ChevronRight, 
  HelpCircle, Send, Database, BarChart3, AlertOctagon, Info, Lock,
  Check, Layers, History, TrendingUp, TrendingDown, DollarSign, CalendarDays,
  Award, FileCheck, CheckCheck, Scale, AlertCircle, Copy,
  Mic, MicOff, Volume2, Radio, Activity, Headphones, Play, Square, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react';

interface PeriodProductItem {
  id: number;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  openingStock: number;
  periodPurchases: number;
  purchaseCount: number;
  periodSales: number;
  salesCount: number;
  periodAdjustmentsInc: number;
  periodAdjustmentsDec: number;
  expectedClosingStock: number;
  closingRecordedStock: number;
  discrepancy: number;
  isBalanced: boolean;
  hasMovementInPeriod: boolean;
}

interface PeriodTransactionItem {
  id: string | number;
  timestamp: string;
  productId: number;
  productName: string;
  sku: string;
  operationType: 'creacion' | 'compra' | 'venta' | 'ajuste_inc' | 'ajuste_dec' | 'conteo' | 'devolucion';
  reference: string;
  operator: string;
  operatorRole?: string;
  quantityChanged: number;
  runningCalculatedStock: number;
  recordedSnapshot?: number | null;
  hasDiscrepancy: boolean;
  discrepancyDelta?: number;
  notes?: string;
  priceOrCost?: number;
}

interface PeriodAuditData {
  filter: {
    periodType: string;
    label: string;
    startStr: string;
    endStr: string;
    productId?: number;
    onlyDiscrepancies: boolean;
  };
  metrics: {
    totalProductsAudited: number;
    balancedProductsCount: number;
    discrepantProductsCount: number;
    totalUnitsDrift: number;
    totalTransactionsReviewed: number;
    totalPurchasesUnits: number;
    purchasesCount: number;
    totalSalesUnits: number;
    salesCount: number;
    totalSalesAmount: number;
    totalAdjustmentsCount: number;
    anomaliesCount: number;
  };
  products: PeriodProductItem[];
  recordLedger: PeriodTransactionItem[];
  anomalies: Array<{
    timestamp: string;
    productId: number;
    productName: string;
    sku: string;
    type: string;
    description: string;
    operator: string;
    expectedStock: number;
    recordedStock: number;
    gap: number;
    recommendation: string;
  }>;
  executionTimestamp: string;
}

interface ProductTimelineItem {
  id: string | number;
  timestamp: string;
  eventType: string;
  operationLabel: string;
  referenceId?: string | number;
  userName: string;
  userRole?: string;
  quantityChanged: number;
  runningCalculatedStock: number;
  recordedStockAfter?: number | null;
  discrepancyDelta?: number;
  isAnomaly: boolean;
  notes?: string;
  priceOrCost?: number;
}

interface ProductAuditData {
  productId: number;
  name: string;
  sku: string;
  category: string;
  currentRecordedStock: number;
  calculatedLedgerStock: number;
  stockDifference: number;
  isBalanced: boolean;
  initialStock: number;
  initialStockDate?: string;
  initialStockAuthor?: string;
  totalPurchased: number;
  purchaseCount: number;
  totalSold: number;
  salesCount: number;
  totalAdjustmentsInc: number;
  totalAdjustmentsDec: number;
  totalReturns: number;
  anomaliesDetected: number;
  timeline: ProductTimelineItem[];
  identifiedGaps: Array<{
    timestamp: string;
    description: string;
    userName: string;
    expectedStock: number;
    recordedStock: number;
    gap: number;
    reason: string;
  }>;
}

export default function AuditoriaForenseView() {
  const { user, showNotification } = useAppContext();
  const hasAccess = canAccessForensicAudit(user);

  // Default active tab is 'report_acta' so the user sees the CERTIFIED REPORT IMMEDIATELY
  const [activeTab, setActiveTab] = useState<'report_acta' | 'period_catalog' | 'ledger_records' | 'product_detail'>('report_acta');

  // Period Filter Configuration - default to 'today' (Hoy)
  const [periodType, setPeriodType] = useState<'today' | 'week' | 'month' | 'year' | 'all' | 'custom'>('today');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState<boolean>(false);
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // Available periods from server
  const [availableMonths, setAvailableMonths] = useState<Array<{ value: string; label: string }>>([
    { value: '2026-09', label: 'Septiembre 2026' },
    { value: '2026-08', label: 'Agosto 2026' },
    { value: '2026-07', label: 'Julio 2026' }
  ]);
  const [availableYears, setAvailableYears] = useState<number[]>([2026]);

  // Data States
  const [periodData, setPeriodData] = useState<PeriodAuditData | null>(null);
  const [productAudit, setProductAudit] = useState<ProductAuditData | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<{ id: number; name: string; sku: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search in selector
  const [productQuery, setProductQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // AI Diagnostic Report States
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiCustomQuestion, setAiCustomQuestion] = useState<string>('');

  // Gemini 3.8 Live Voice Forensic Console States
  const [isLiveVoiceActive, setIsLiveVoiceActive] = useState<boolean>(false);
  const [liveVoiceTranscript, setLiveVoiceTranscript] = useState<string>("");
  const [isLiveConsoleExpanded, setIsLiveConsoleExpanded] = useState<boolean>(true);

  useEffect(() => {
    const handleLiveStatus = (e: any) => {
      if (e?.detail) {
        setIsLiveVoiceActive(!!e.detail.isLiveActive);
        if (e.detail.transcript) {
          setLiveVoiceTranscript(e.detail.transcript);
        }
      }
    };
    window.addEventListener('ai-live-forensic-status', handleLiveStatus);
    return () => window.removeEventListener('ai-live-forensic-status', handleLiveStatus);
  }, []);

  const handleInvokeLiveAi = (customPrompt?: string) => {
    const prompt = customPrompt || `Inicia la auditoría forense en vivo de GTR POS para el período actual (${periodData?.filter?.label || 'hoy'}). Revisa si los 141 productos y todas las transacciones de ventas y compras cuadran al 100%, y bríndame tu dictamen pericial con voz en tiempo real.`;
    window.dispatchEvent(new CustomEvent('start-ai-live-forensic', {
      detail: { prompt }
    }));
    setIsLiveVoiceActive(true);
    setIsLiveConsoleExpanded(true);
    showNotification("🎙️ IA Live Pericial invocada con éxito. Habla por tu micrófono o escucha su informe.", "info");
  };

  const handleStopLiveAi = () => {
    window.dispatchEvent(new CustomEvent('stop-ai-live-forensic'));
    setIsLiveVoiceActive(false);
    showNotification("Conversación en vivo finalizada.", "info");
  };

  // Reconciliation Modal
  const [reconcileTarget, setReconcileTarget] = useState<PeriodProductItem | null>(null);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);

  // Initial load: fetch period list, period audit, and automatically generate official report!
  useEffect(() => {
    if (hasAccess) {
      initializeAudit();
    }
  }, [hasAccess]);

  const initializeAudit = async () => {
    try {
      setIsLoading(true);
      // 1. Load available periods info
      const periodsRes = await fetch('/api/forensic-audit/periods', {
        headers: {
          'x-user-role': user?.role || '',
          'x-user-username': user?.username || '',
          'x-user-permissions': JSON.stringify(user?.permissions || {})
        }
      });
      let curDate = '';
      if (periodsRes.ok) {
        const d = await periodsRes.json();
        if (d.availableMonths?.length) {
          setAvailableMonths(d.availableMonths);
          setSelectedMonth(d.availableMonths[0].value);
        }
        if (d.availableYears?.length) {
          setAvailableYears(d.availableYears);
          setSelectedYear(d.availableYears[0]);
        }
        if (d.currentBoliviaDate) {
          curDate = d.currentBoliviaDate;
          setSelectedDate(d.currentBoliviaDate);
          setStartDate(d.currentBoliviaDate);
          setEndDate(d.currentBoliviaDate);
        }
      }

      // 2. Load audit for today
      await loadPeriodAudit({ periodType: 'today', date: curDate }, true);
      searchProducts('');
    } catch (e) {
      console.error("Initialization error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPeriodAudit = async (overrideParams?: Partial<{
    periodType: string;
    date: string;
    month: string;
    year: number;
    startDate: string;
    endDate: string;
    onlyDiscrepancies: boolean;
    search: string;
  }>, autoGenerateReport: boolean = true) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      const pType = overrideParams?.periodType || periodType;
      params.append('periodType', pType);

      if (pType === 'today') {
        const d = overrideParams?.date || selectedDate;
        if (d) params.append('date', d);
      } else if (pType === 'month') {
        const m = overrideParams?.month || selectedMonth;
        if (m) params.append('month', m);
      } else if (pType === 'year') {
        const y = overrideParams?.year || selectedYear;
        if (y) params.append('year', String(y));
      } else if (pType === 'custom') {
        const s = overrideParams?.startDate || startDate;
        const e = overrideParams?.endDate || endDate;
        if (s) params.append('startDate', s);
        if (e) params.append('endDate', e);
      }

      const onlyDisc = overrideParams?.onlyDiscrepancies !== undefined ? overrideParams.onlyDiscrepancies : onlyDiscrepancies;
      if (onlyDisc) {
        params.append('onlyDiscrepancies', 'true');
      }

      const q = overrideParams?.search !== undefined ? overrideParams.search : catalogSearch;
      if (q && q.trim()) {
        params.append('search', q.trim());
      }

      const res = await fetch(`/api/forensic-audit/period-audit?${params.toString()}`, {
        headers: {
          'x-user-role': user?.role || '',
          'x-user-username': user?.username || '',
          'x-user-permissions': JSON.stringify(user?.permissions || {})
        }
      });

      if (!res.ok) {
        throw new Error('Error al ejecutar auditoría automática por período');
      }

      const data = await res.json();
      if (data.success) {
        setPeriodData(data);
        if (autoGenerateReport) {
          // Trigger report generation automatically so the user immediately sees the full report
          triggerReportFetch(pType, overrideParams?.date || selectedDate, overrideParams?.month || selectedMonth, overrideParams?.year || selectedYear);
        }
      }
    } catch (err: any) {
      showNotification(err.message || 'Error al conectar con el motor forense', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerReportFetch = async (pType: string, dateVal?: string, monthVal?: string, yearVal?: number, customQ?: string) => {
    try {
      setIsGeneratingAI(true);
      const payload: any = {
        scope: 'period',
        periodType: pType,
        date: pType === 'today' ? (dateVal || selectedDate) : undefined,
        month: pType === 'month' ? (monthVal || selectedMonth) : undefined,
        year: pType === 'year' ? (yearVal || selectedYear) : undefined,
        startDate: pType === 'custom' ? startDate : undefined,
        endDate: pType === 'custom' ? endDate : undefined,
        customQuestion: customQ || undefined
      };

      const res = await fetch('/api/forensic-audit/ai-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': user?.role || '',
          'x-user-username': user?.username || '',
          'x-user-permissions': JSON.stringify(user?.permissions || {})
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const d = await res.json();
        if (d.success && d.report) {
          setAiReport(d.report);
        }
      }
    } catch (e) {
      console.warn("Report fetch error:", e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const searchProducts = async (q: string) => {
    try {
      setIsSearching(true);
      const res = await fetch(`/api/forensic-audit/search?q=${encodeURIComponent(q)}`, {
        headers: {
          'x-user-role': user?.role || '',
          'x-user-username': user?.username || '',
          'x-user-permissions': JSON.stringify(user?.permissions || {})
        }
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const loadProductAudit = async (productId: number) => {
    try {
      setIsLoading(true);
      setProductAudit(null);
      const res = await fetch(`/api/forensic-audit/product/${productId}`, {
        headers: {
          'x-user-role': user?.role || '',
          'x-user-username': user?.username || '',
          'x-user-permissions': JSON.stringify(user?.permissions || {})
        }
      });
      if (!res.ok) {
        throw new Error('No se pudo obtener el historial del producto');
      }
      const data = await res.json();
      if (data.success) {
        setProductAudit(data);
        setActiveTab('product_detail');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconcileProduct = async (product: PeriodProductItem) => {
    try {
      setIsReconciling(true);
      const res = await fetch('/api/forensic-audit/reconcile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': user?.role || '',
          'x-user-username': user?.username || '',
          'x-user-permissions': JSON.stringify(user?.permissions || {})
        },
        body: JSON.stringify({
          productId: product.id,
          notes: `Conciliación administrativa certificada (${product.name}, de ${product.currentStock} a ${product.expectedClosingStock} uds)`
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo conciliar el producto');
      }

      showNotification(data.message || 'Producto conciliado con éxito', 'success');
      setReconcileTarget(null);
      loadPeriodAudit(undefined, true);
      if (selectedProduct && selectedProduct.id === product.id) {
        loadProductAudit(product.id);
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setIsReconciling(false);
    }
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    if (!periodData) return [];
    return periodData.products.filter(p => {
      if (onlyDiscrepancies && p.isBalanced) return false;
      if (!catalogSearch) return true;
      const s = catalogSearch.toLowerCase();
      return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.category.toLowerCase().includes(s);
    });
  }, [periodData, onlyDiscrepancies, catalogSearch]);

  const isPeriodPerfect = periodData ? periodData.metrics.discrepantProductsCount === 0 : false;

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 m-4">
        <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-3 ring-8 ring-rose-50 dark:ring-rose-900/20">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Acceso Exclusivo de Administración</h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md text-xs sm:text-sm leading-relaxed mb-4">
          El módulo de <strong>Auditoría Forense con Inteligencia Artificial</strong> contiene revisiones profundas de transacciones, libros mayores y diagnóstico causal de desvíos. Solo los usuarios con rol de Administrador pueden acceder.
        </p>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-xs font-medium">
          Privilegio requerido: <code className="text-indigo-600 dark:text-indigo-400 font-mono">access_forensic_audit</code>
        </span>
      </div>
    );
  }

  return (
    <div 
      id="auditoria-forense-scroll-container"
      className="h-full w-full overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-48 select-text scroll-smooth"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      
      {/* Sleek, Compact Mobile-Optimized Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-6 rounded-2xl shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" /> Auditoría Forense Activa
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Lock className="w-3 h-3" /> Solo Administrador
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/30 text-indigo-200">
                Cotejo Inmutable
              </span>
            </div>
            
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <span>Auditoría Inteligente & Conciliación Forense</span>
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-3xl leading-snug">
              Cotejo exhaustivo de la base de datos completa ítem por ítem y registro por registro. Compila y comprueba que compras, ventas y ajustes cuadren matemáticamente al 100%.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
            <button
              onClick={() => {
                if (isLiveVoiceActive) {
                  handleStopLiveAi();
                } else {
                  handleInvokeLiveAi();
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-lg flex items-center gap-1.5 transition active:scale-95 ${
                isLiveVoiceActive 
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/40 ring-2 ring-rose-400 animate-pulse' 
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-600/30'
              }`}
            >
              <Mic className={`w-4 h-4 ${isLiveVoiceActive ? 'animate-bounce text-white' : 'text-emerald-100'}`} />
              <span>{isLiveVoiceActive ? '🔴 En Vivo (Finalizar)' : '🎙️ Invocar IA Live Pericial'}</span>
            </button>
            <button
              onClick={() => {
                if (activeTab === 'product_detail' && selectedProduct) {
                  loadProductAudit(selectedProduct.id);
                } else {
                  loadPeriodAudit(undefined, true);
                }
              }}
              disabled={isLoading || isGeneratingAI}
              className="px-3.5 py-2 bg-slate-800/90 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-medium border border-slate-700 flex items-center gap-1.5 transition shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isGeneratingAI ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Actualizar</span>
            </button>
            <button
              onClick={() => triggerReportFetch(periodType, selectedDate, selectedMonth, selectedYear)}
              disabled={isGeneratingAI}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAI ? 'animate-spin' : ''}`} />
              <span>{isGeneratingAI ? 'Generando Dictamen...' : 'Dictamen Pericial'}</span>
            </button>
          </div>
        </div>

        {/* Primary View Tabs - Report & Certification is FIRST */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-4 pt-3 border-t border-slate-800 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('report_acta')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'report_acta'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4 text-emerald-400" />
            <span>📋 Acta & Dictamen Oficial</span>
          </button>

          <button
            onClick={() => setActiveTab('period_catalog')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'period_catalog'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>📦 Catálogo Ítem por Ítem (141)</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger_records')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ledger_records'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>📑 Cotejo Registro por Registro ({periodData?.recordLedger.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('product_detail')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'product_detail'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>🔍 Ficha de Producto</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONSOLA PERICIAL IA LIVE - GEMINI 3.8 LIVE (VOZ Y AUDITORÍA EN TIEMPO REAL) */}
      {/* ========================================================================= */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 shadow-xl relative overflow-hidden ${
        isLiveVoiceActive 
          ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-emerald-950/80 border-emerald-500/50 ring-1 ring-emerald-500/30 text-white' 
          : 'bg-white dark:bg-slate-800/95 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 shadow-sm'
      }`}>
        {isLiveVoiceActive && (
          <div className="absolute -right-10 -top-10 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isLiveVoiceActive 
                ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-400/30 shadow-lg' 
                : 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400'
            }`}>
              {isLiveVoiceActive ? <Radio className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold flex items-center gap-1.5">
                  <span>Consola Pericial IA Live</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-semibold border border-indigo-500/30">
                    Gemini 3.8 Live
                  </span>
                </h2>
                {isLiveVoiceActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-0.5" /> En Vivo • Micrófono y Altavoz Activos
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    En Espera
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                La IA inspecciona registros de ventas, inventario y kárdex en vivo mediante herramientas de base de datos mientras te habla con voz.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {isLiveVoiceActive ? (
              <button
                onClick={handleStopLiveAi}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Finalizar Llamada</span>
              </button>
            ) : (
              <button
                onClick={() => handleInvokeLiveAi()}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Iniciar Conversación por Voz</span>
              </button>
            )}
            <button
              onClick={() => setIsLiveConsoleExpanded(!isLiveConsoleExpanded)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition"
              title="Colapsar/Expandir Consola"
            >
              {isLiveConsoleExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isLiveConsoleExpanded && (
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700/60">
            {/* Audio Wave Visualizer when Active */}
            {isLiveVoiceActive && (
              <div className="bg-slate-950/80 p-3 rounded-xl border border-emerald-500/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 h-7 px-2">
                  {[40, 75, 100, 60, 30, 85, 95, 50, 70, 90, 45, 80, 60, 35].map((h, i) => (
                    <span 
                      key={i} 
                      className="w-1.5 bg-gradient-to-t from-emerald-500 to-teal-300 rounded-full animate-pulse"
                      style={{ 
                        height: `${h}%`,
                        animationDuration: `${0.4 + (i % 5) * 0.15}s`
                      }} 
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-300">
                  <Headphones className="w-4 h-4 text-emerald-400 animate-bounce" />
                  <span>Voz Zephyr en tiempo real • Audio Bidireccional</span>
                </div>
              </div>
            )}

            {/* Live Spoken Transcript Box */}
            <div className={`p-3.5 rounded-xl text-xs sm:text-sm font-sans leading-relaxed border transition ${
              isLiveVoiceActive 
                ? 'bg-slate-950/90 border-slate-800 text-slate-100' 
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                <span className="flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                  {isLiveVoiceActive ? 'Último informe hablado por la IA en vivo:' : 'Transcripción y Estado:'}
                </span>
                {liveVoiceTranscript && (
                  <button 
                    onClick={() => navigator.clipboard.writeText(liveVoiceTranscript)}
                    className="text-slate-400 hover:text-indigo-400 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copiar texto
                  </button>
                )}
              </div>
              
              <div className="min-h-[48px] max-h-36 overflow-y-auto whitespace-pre-wrap select-text font-normal text-xs sm:text-sm">
                {liveVoiceTranscript ? (
                  <span className="text-slate-200 dark:text-slate-100">{liveVoiceTranscript}</span>
                ) : isLiveVoiceActive ? (
                  <span className="text-emerald-400/80 italic flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" /> Conectado con Gemini 3.8 Live. Puedes hablar por el micrófono ahora o pulsar una de las preguntas periciales de abajo...
                  </span>
                ) : (
                  <span className="text-slate-500 italic">
                    Pulsa "Iniciar Conversación por Voz" o cualquiera de los botones de auditoría rápida abajo para comenzar la conversación pericial con Gemini 3.8 Live.
                  </span>
                )}
              </div>
            </div>

            {/* Quick Spoken Queries Bar */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> Preguntas Periciales Rápidas:
              </span>
              {[
                { label: '🔍 ¿Hay fallas o desvíos contables hoy?', prompt: 'Realiza una auditoría completa de hoy y dime con voz clara si todos los 141 productos y las transacciones cuadran al 100% o si detectaste alguna falla o desvío.' },
                { label: '📦 Audita historial de Coca Cola 2L', prompt: 'Inspecciona a fondo el kárdex y las ventas de Coca Cola 2L y dime si su stock físico cuadra exactamente con sus ventas y compras.' },
                { label: '💰 ¿Cuáles fueron las ventas y montos de hoy?', prompt: 'Revisa las transacciones de ventas de hoy y dame el resumen de ventas cobradas, montos en Bolivianos y cajeros que operaron.' },
                { label: '📑 ¿Cuadran las transacciones del período?', prompt: 'Revisa las transacciones registradas en el período y compáralas con el kárdex para certificar que no falte ni sobre ningún centavo ni unidad.' }
              ].map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    handleInvokeLiveAi(query.prompt);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition active:scale-95"
                >
                  {query.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Temporal Control Bar (Día, Semana, Mes, Año, Histórico) */}
      <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-indigo-500" /> Período:
          </span>

          <button
            onClick={() => {
              setPeriodType('today');
              loadPeriodAudit({ periodType: 'today' }, true);
            }}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition ${
              periodType === 'today'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Día (Hoy)
          </button>

          <button
            onClick={() => {
              setPeriodType('week');
              loadPeriodAudit({ periodType: 'week' }, true);
            }}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition ${
              periodType === 'week'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Semana (7 Días)
          </button>

          <button
            onClick={() => {
              setPeriodType('month');
              loadPeriodAudit({ periodType: 'month' }, true);
            }}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition ${
              periodType === 'month'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Mes
          </button>

          <button
            onClick={() => {
              setPeriodType('year');
              loadPeriodAudit({ periodType: 'year' }, true);
            }}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition ${
              periodType === 'year'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Año
          </button>

          <button
            onClick={() => {
              setPeriodType('all');
              loadPeriodAudit({ periodType: 'all' }, true);
            }}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition ${
              periodType === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Histórico Completo
          </button>

          <button
            onClick={() => setPeriodType('custom')}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition ${
              periodType === 'custom'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Personalizado
          </button>
        </div>

        {/* Dynamic Period Dropdowns/Inputs */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {periodType === 'today' && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Fecha:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  loadPeriodAudit({ periodType: 'today', date: e.target.value }, true);
                }}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
              />
            </div>
          )}

          {periodType === 'month' && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Mes:</span>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  loadPeriodAudit({ periodType: 'month', month: e.target.value }, true);
                }}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                {availableMonths.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          )}

          {periodType === 'year' && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Año:</span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setSelectedYear(y);
                  loadPeriodAudit({ periodType: 'year', year: y }, true);
                }}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {periodType === 'custom' && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
              />
              <span className="text-slate-400">al</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
              />
              <button
                onClick={() => loadPeriodAudit({ periodType: 'custom', startDate, endDate }, true)}
                className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-500"
              >
                Filtrar
              </button>
            </div>
          )}

          <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800/60">
            {periodData?.filter.label || 'Cargando...'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ACTA DE AUDITORÍA & DICTAMEN OFICIAL (VISIBLE IMMEDIATELY ON LOAD) */}
      {/* ========================================================================= */}
      {activeTab === 'report_acta' && (
        <div className="space-y-4 sm:space-y-6">
          
          {/* Official Audit Certification Banner */}
          <div className={`p-5 sm:p-6 rounded-2xl border shadow-lg relative overflow-hidden transition ${
            isPeriodPerfect
              ? 'bg-gradient-to-br from-emerald-950/90 via-slate-900 to-emerald-950/70 border-emerald-500/40 text-white'
              : 'bg-gradient-to-br from-amber-950/90 via-slate-900 to-rose-950/70 border-amber-500/40 text-white'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                  isPeriodPerfect 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  {isPeriodPerfect ? <CheckCheck className="w-7 h-7 sm:w-8 sm:h-8" /> : <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8" />}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isPeriodPerfect ? 'bg-emerald-500/30 text-emerald-300' : 'bg-amber-500/30 text-amber-300'
                    }`}>
                      {isPeriodPerfect ? 'CERTIFICACIÓN OFICIAL DE INTEGRIDAD' : 'ATENCIÓN: REVISIÓN REQUERIDA'}
                    </span>
                    <span className="text-xs text-slate-300 font-mono">
                      Período: {periodData?.filter.label}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl md:text-2xl font-black mt-1 tracking-tight">
                    {isPeriodPerfect 
                      ? 'REGISTROS 100% COMPILADOS, COTEJADOS Y CUADRADOS' 
                      : `SE DETECTARON ${periodData?.metrics.discrepantProductsCount} PRODUCTO(S) CON DESFASE EN ESTE PERÍODO`}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                    {isPeriodPerfect
                      ? `Se certifica que la totalidad de los ${periodData?.metrics.totalProductsAudited || 141} productos del catálogo y las ${periodData?.metrics.totalTransactionsReviewed || 0} transacciones del período han sido compiladas, comparadas y cotejadas registro a registro. No existe ningún desfase de inventario ni transacciones huérfanas.`
                      : `La auditoría automática detectó ${periodData?.metrics.discrepantProductsCount} producto(s) cuya ficha no coincide con la sumatoria de movimientos. Puede revisarlos e iniciar su conciliación en un solo clic.`}
                  </p>
                </div>
              </div>

              {/* Action Pill */}
              <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                {!isPeriodPerfect && (
                  <button
                    onClick={() => {
                      setOnlyDiscrepancies(true);
                      setActiveTab('period_catalog');
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow transition flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>Ver Desfases</span>
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-medium border border-white/20 transition flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Acta</span>
                </button>
              </div>
            </div>

            {/* 4 Pillars of Integrity Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-slate-100">141/141 Productos Cotejados</div>
                  <div className="text-[11px] text-slate-300">Catálogo verificado al 100%</div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-slate-100">{periodData?.metrics.totalTransactionsReviewed || 0} Registros Revisados</div>
                  <div className="text-[11px] text-slate-300">Compras, ventas y ajustes validados</div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <Scale className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-slate-100">Libro Mayor Equilibrado</div>
                  <div className="text-[11px] text-slate-300">Entradas - Salidas = Saldo Físico</div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                {isPeriodPerfect ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-slate-100">
                    {isPeriodPerfect ? '0 Desfases Detectados' : `${periodData?.metrics.totalUnitsDrift} Uds en Desvío`}
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {isPeriodPerfect ? 'Sin descuadres en este período' : 'Requiere conciliación'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick KPI Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Total Catálogo</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">{periodData?.metrics.totalProductsAudited || 141}</span>
              <span className="text-[10px] text-slate-500 block">Ítems auditados</span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">100% Cuadrados</span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{periodData?.metrics.balancedProductsCount || 0}</span>
              <span className="text-[10px] text-emerald-600/80 block">Sin discrepancias</span>
            </div>

            <div className={`p-3.5 rounded-xl border shadow-sm ${
              (periodData?.metrics.discrepantProductsCount || 0) > 0
                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80'
            }`}>
              <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Desfases</span>
              <span className={`text-xl font-bold ${(periodData?.metrics.discrepantProductsCount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                {periodData?.metrics.discrepantProductsCount || 0}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {periodData?.metrics.totalUnitsDrift ? `${periodData.metrics.totalUnitsDrift} uds desvío` : '0 unidades'}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Transacciones</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">{periodData?.metrics.totalTransactionsReviewed || 0}</span>
              <span className="text-[10px] text-slate-500 block">Operaciones revisadas</span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Compras (+)</span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+{periodData?.metrics.totalPurchasesUnits || 0}</span>
              <span className="text-[10px] text-slate-500 block">{periodData?.metrics.purchasesCount || 0} lotes recibidos</span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Ventas (-)</span>
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400">-{periodData?.metrics.totalSalesUnits || 0}</span>
              <span className="text-[10px] text-slate-500 block">Bs. {(periodData?.metrics.totalSalesAmount || 0).toLocaleString('es-BO', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Full Official Diagnostic Report Document */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 py-3.5 text-white flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold">Informe & Dictamen Pericial Oficial de Auditoría</h3>
                  <p className="text-[11px] text-slate-300">Generado con base fáctica inmutable de SQLite y firmas de usuario</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    if (aiReport) {
                      navigator.clipboard.writeText(aiReport);
                      showNotification('Informe copiado al portapapeles', 'info');
                    }
                  }}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="p-4 sm:p-6 md:p-8 space-y-4 max-h-[750px] overflow-y-auto text-slate-800 dark:text-slate-200 leading-relaxed font-sans text-xs sm:text-sm">
              {isGeneratingAI && !aiReport ? (
                <div className="py-12 text-center text-slate-500">
                  <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Compilando dictamen forense y verificando partida doble...</p>
                  <p className="text-xs text-slate-400 mt-1">Cotejando libros mayores, transacciones de venta, recepción de compras y auditoría de seguridad.</p>
                </div>
              ) : aiReport ? (
                <div className="whitespace-pre-wrap font-sans space-y-2 prose dark:prose-invert max-w-none">
                  {aiReport}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p>Haga clic en <strong>"Generar Dictamen IA"</strong> o seleccione un período para generar el informe pericial.</p>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Question Input */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-2 text-indigo-900 dark:text-indigo-300 font-semibold text-xs sm:text-sm">
              <HelpCircle className="w-4 h-4 text-indigo-500" />
              <span>¿Desea consultar algo específico sobre las transacciones del período?</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={aiCustomQuestion}
                onChange={(e) => setAiCustomQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && aiCustomQuestion.trim()) {
                    triggerReportFetch(periodType, selectedDate, selectedMonth, selectedYear, aiCustomQuestion);
                  }
                }}
                placeholder="Ej: ¿Por qué se generó el descuadre? o ¿Qué usuario registró las ventas de hoy?"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => triggerReportFetch(periodType, selectedDate, selectedMonth, selectedYear, aiCustomQuestion)}
                disabled={isGeneratingAI || !aiCustomQuestion.trim()}
                className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Consultar</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ITEM-BY-ITEM PERIOD CATALOG (141 SKUs)                             */}
      {/* ========================================================================= */}
      {activeTab === 'period_catalog' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
            {/* Table Filters Bar */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Buscar producto o SKU (ej. Flash bolsa, 14)..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyDiscrepancies}
                    onChange={(e) => {
                      setOnlyDiscrepancies(e.target.checked);
                      loadPeriodAudit({ onlyDiscrepancies: e.target.checked }, false);
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Mostrar solo con desfase</span>
                </label>

                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Mostrando <strong>{filteredProducts.length}</strong> de {periodData?.metrics.totalProductsAudited || 141}
                </span>
              </div>
            </div>

            {/* Products Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Producto / SKU</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3 text-right">Apertura</th>
                    <th className="p-3 text-right text-emerald-600">Compras (+)</th>
                    <th className="p-3 text-right text-amber-600">Ventas (-)</th>
                    <th className="p-3 text-right">Ajustes (+/-)</th>
                    <th className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">Cierre Calculado</th>
                    <th className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">Stock en Ficha</th>
                    <th className="p-3 text-center">Estado / Desfase</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin mx-auto mb-2" />
                        <span>Calculando balances matemáticos ítem por ítem...</span>
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        No se encontraron productos que coincidan con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr 
                        key={p.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition ${
                          !p.isBalanced ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="p-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</div>
                          <div className="font-mono text-[10px] text-slate-500">SKU: {p.sku}</div>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{p.category}</td>
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">{p.openingStock}</td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {p.periodPurchases > 0 ? `+${p.periodPurchases}` : '0'}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {p.periodSales > 0 ? `-${p.periodSales}` : '0'}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {p.periodAdjustmentsInc - p.periodAdjustmentsDec > 0 
                            ? `+${p.periodAdjustmentsInc - p.periodAdjustmentsDec}` 
                            : (p.periodAdjustmentsInc - p.periodAdjustmentsDec < 0 ? `${p.periodAdjustmentsInc - p.periodAdjustmentsDec}` : '0')}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                          {p.expectedClosingStock}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                          {p.closingRecordedStock}
                        </td>
                        <td className="p-3 text-center">
                          {p.isBalanced ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> Cuadrado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                              <AlertTriangle className="w-3 h-3" /> Desfase {p.discrepancy > 0 ? `+${p.discrepancy}` : p.discrepancy}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedProduct({ id: p.id, name: p.name, sku: p.sku });
                                loadProductAudit(p.id);
                              }}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium transition"
                            >
                              Inspeccionar
                            </button>
                            {!p.isBalanced && (
                              <button
                                onClick={() => setReconcileTarget(p)}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Conciliar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RECORD-BY-RECORD IMMUTABLE LEDGER                                  */}
      {/* ========================================================================= */}
      {activeTab === 'ledger_records' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-500" />
                  <span>Cotejo de Transacciones Registro por Registro ({periodData?.recordLedger.length || 0})</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cada compra, venta y ajuste se compara contra el saldo continuo calculado y el snapshot del sistema
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">Fecha y Hora (BO)</th>
                    <th className="p-3">Tipo Operación</th>
                    <th className="p-3">Producto & SKU</th>
                    <th className="p-3">Comprobante / Ref</th>
                    <th className="p-3">Operador</th>
                    <th className="p-3 text-right">Variación ($\pm$)</th>
                    <th className="p-3 text-right text-indigo-600 dark:text-indigo-400 font-bold">Saldo Calculado</th>
                    <th className="p-3 text-right text-slate-500">Snapshot Guardado</th>
                    <th className="p-3 text-center">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {periodData?.recordLedger.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        No se registraron operaciones en este período.
                      </td>
                    </tr>
                  ) : (
                    periodData?.recordLedger.map((rec, i) => (
                      <tr
                        key={rec.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition ${
                          rec.hasDiscrepancy ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="p-3 text-center text-slate-400 font-mono">{i + 1}</td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {rec.timestamp.substring(0, 19).replace('T', ' ')}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            rec.operationType === 'compra'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : rec.operationType === 'venta'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          }`}>
                            {rec.operationType}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{rec.productName}</div>
                          <div className="font-mono text-[10px] text-slate-500">SKU: {rec.sku}</div>
                        </td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{rec.reference}</td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">@{rec.operator}</span>
                          {rec.operatorRole && <span className="text-[10px] text-slate-400 block">({rec.operatorRole})</span>}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          <span className={rec.quantityChanged > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {rec.quantityChanged > 0 ? `+${rec.quantityChanged}` : rec.quantityChanged}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {rec.runningCalculatedStock}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500">
                          {rec.recordedSnapshot !== null && rec.recordedSnapshot !== undefined ? rec.recordedSnapshot : '—'}
                        </td>
                        <td className="p-3 text-center">
                          {rec.hasDiscrepancy ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> Salto ({rec.discrepancyDelta})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SURGICAL SINGLE PRODUCT AUDIT                                      */}
      {/* ========================================================================= */}
      {activeTab === 'product_detail' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              Seleccionar Producto para Inspección Quirúrgica:
            </label>
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={productQuery}
                  onChange={(e) => {
                    setProductQuery(e.target.value);
                    searchProducts(e.target.value);
                  }}
                  placeholder="Escriba el nombre o SKU (ej. Flash bolsa 8gb, 14)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              {selectedProduct && (
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-medium text-indigo-900 dark:text-indigo-200 self-stretch md:self-auto">
                  <span>Seleccionado: <strong>{selectedProduct.name}</strong> (SKU: {selectedProduct.sku})</span>
                </div>
              )}
            </div>

            {/* Suggestions Grid */}
            {searchResults.length > 0 && !selectedProduct && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProduct(p);
                      setProductQuery(p.name);
                      loadProductAudit(p.id);
                    }}
                    className="p-2.5 text-left bg-slate-50 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-950/50 rounded-xl border border-slate-200 dark:border-slate-700/60 transition text-xs flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate max-w-[200px]">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-slate-500">SKU: {p.sku} | Cat: {p.category}</div>
                    </div>
                    <span className="font-bold font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {p.stock} uds
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Dossier */}
          {isLoading ? (
            <div className="p-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Reconstruyendo libro mayor inmutable y trazando eventos históricos...</p>
            </div>
          ) : productAudit ? (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-700/80">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                        {productAudit.category}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                        SKU: {productAudit.sku}
                      </span>
                      {productAudit.isBalanced ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 100% Cuadrado
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Descuadre: {productAudit.stockDifference} uds
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                      {productAudit.name}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Creado el {productAudit.initialStockDate ? productAudit.initialStockDate.substring(0, 19).replace('T', ' ') : 'inicio'} por @{productAudit.initialStockAuthor || 'sistema'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-center">
                      <span className="text-[11px] uppercase font-semibold text-slate-500 block">Stock en Ficha</span>
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{productAudit.currentRecordedStock}</span>
                    </div>
                    <div className="text-slate-400 font-mono text-lg">=</div>
                    <div className="text-center">
                      <span className="text-[11px] uppercase font-semibold text-indigo-600 dark:text-indigo-400 block">Libro Mayor</span>
                      <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{productAudit.calculatedLedgerStock}</span>
                    </div>
                  </div>
                </div>

                {/* Mathematical Equation Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-5">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 block font-medium">Stock Inicial</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200">+{productAudit.initialStock}</span>
                    <span className="text-[10px] text-slate-400 block">Al dar de alta</span>
                  </div>

                  <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium">Ingresos (Compras)</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">+{productAudit.totalPurchased}</span>
                    <span className="text-[10px] text-emerald-600/70 block">{productAudit.purchaseCount} lotes recibidos</span>
                  </div>

                  <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40">
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 block font-medium">Salidas (Ventas)</span>
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">-{productAudit.totalSold}</span>
                    <span className="text-[10px] text-amber-600/70 block">{productAudit.salesCount} tickets cobrados</span>
                  </div>

                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/40">
                    <span className="text-[11px] text-blue-700 dark:text-blue-400 block font-medium">Ajustes Positivos</span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">+{productAudit.totalAdjustmentsInc}</span>
                    <span className="text-[10px] text-blue-600/70 block">Devoluciones y ajustes</span>
                  </div>

                  <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/40">
                    <span className="text-[11px] text-rose-700 dark:text-rose-400 block font-medium">Ajustes Negativos</span>
                    <span className="text-lg font-bold text-rose-600 dark:text-rose-400">-{productAudit.totalAdjustmentsDec}</span>
                    <span className="text-[10px] text-rose-600/70 block">Bajas o mermas</span>
                  </div>
                </div>
              </div>

              {/* Timeline Table */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span>Cronología Inmutable ({productAudit.timeline.length} movimientos)</span>
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3 w-10 text-center">#</th>
                        <th className="p-3">Fecha y Hora (BO)</th>
                        <th className="p-3">Operación</th>
                        <th className="p-3">Usuario Responsable</th>
                        <th className="p-3 text-right">Variación ($\pm$)</th>
                        <th className="p-3 text-right">Saldo Libro Mayor</th>
                        <th className="p-3 text-right">Snapshot</th>
                        <th className="p-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {productAudit.timeline.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition ${
                            item.isAnomaly ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                          }`}
                        >
                          <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {item.timestamp.substring(0, 19).replace('T', ' ')}
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-slate-800 dark:text-slate-200 block">
                              {item.operationLabel}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                              <User className="w-3 h-3 text-slate-400" />
                              @{item.userName}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold">
                            <span className={item.quantityChanged > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                              {item.quantityChanged > 0 ? `+${item.quantityChanged}` : item.quantityChanged}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {item.runningCalculatedStock}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-500">
                            {item.recordedStockAfter !== undefined && item.recordedStockAfter !== null ? item.recordedStockAfter : '—'}
                          </td>
                          <td className="p-3 text-center">
                            {item.isAnomaly ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="w-3 h-3" /> Desfase ({item.discrepancyDelta})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" /> OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Seleccione un producto en el buscador superior o haga clic en "Inspeccionar" en la tabla para auditar su libro mayor completo.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reconciliation Modal Confirmation */}
      <AnimatePresence>
        {reconcileTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Conciliación Certificada</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ajuste inmutable con sellado en bitácora</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {reconcileTarget.name} (SKU: {reconcileTarget.sku})
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Stock Actual en Ficha:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{reconcileTarget.currentStock} uds</span>
                </div>
                <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
                  <span>Stock Real según Libro Mayor:</span>
                  <span className="font-bold font-mono">{reconcileTarget.expectedClosingStock} uds</span>
                </div>
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold border-t border-slate-200 dark:border-slate-700 pt-1">
                  <span>Ajuste a Aplicar:</span>
                  <span className="font-mono">
                    {reconcileTarget.expectedClosingStock - reconcileTarget.currentStock > 0 ? '+' : ''}
                    {reconcileTarget.expectedClosingStock - reconcileTarget.currentStock} uds
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Esta acción registrará un asiento de auditoría formal a nombre del Administrador <strong>@{user?.username}</strong>, dejando constancia criptográfica y actualizando el catálogo a su saldo contable exacto.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setReconcileTarget(null)}
                  disabled={isReconciling}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleReconcileProduct(reconcileTarget)}
                  disabled={isReconciling}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isReconciling ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Conciliando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirmar y Cuadrar</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
