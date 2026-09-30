import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { safeDispatchEvent } from '../utils/events';
import { hasPermission } from '../utils/permissions';
import { 
  ClipboardCheck, CheckCircle, AlertTriangle, Play, X, 
  Eye, RefreshCw, Search, Check, ChevronLeft, 
  ShieldCheck, FileText, Zap, History, ListCheck, CheckCheck
} from 'lucide-react';

interface PhysicalCountManagerProps {
  onClose?: () => void;
  externalViewMode?: 'blind' | 'quantities';
  embeddedMode?: boolean;
}

interface InventoryCount {
  id: number;
  user_id: number;
  username: string;
  auditor_name?: string;
  store_name?: string;
  mode?: 'BLIND' | 'STANDARD';
  override_segregation?: number;
  override_reason?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  status: 'en_progreso' | 'completado' | 'aprobado' | 'cerrado' | 'pausado' | 'finalizado' | 'cancelado';
  category_filter: string | null;
  approved_at: string | null;
  approved_by_username: string | null;
  is_blind_sanitized?: boolean;
}

interface CountItem {
  id: number;
  inventory_count_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  product_category: string;
  system_stock?: number;
  expected_quantity?: number;
  live_stock?: number;
  counted_stock: number;
  physical_quantity?: number;
  difference?: number;
  is_checked: number;
  status: string;
  notes?: string | null;
  recount_requested?: number;
}

export default function PhysicalCountManager({ onClose, externalViewMode, embeddedMode = false }: PhysicalCountManagerProps) {
  const { user, products, fetchProducts, showNotification } = useAppContext();
  const isAdmin = user?.role === 'admin' || user?.role === 'propietario' || user?.role === 'administrador' || user?.role === 'dueño' || user?.role === 'jefe';
  const canPreviewQuantities = isAdmin || hasPermission(user, 'preview_quantities_in_count');

  // Bloqueo estricto del scroll del body mientras el modal esté abierto
  useEffect(() => {
    if (!embeddedMode) {
      const prevOverflow = document.body.style.overflow;
      const prevPosition = document.body.style.position;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.position = prevPosition;
      };
    }
  }, [embeddedMode]);

  const [activeTab, setActiveTab] = useState<'activo' | 'historico'>('activo');
  const [activeSession, setActiveSession] = useState<InventoryCount | null>(null);
  const [sessionItems, setSessionItems] = useState<CountItem[]>([]);
  const [historicalCounts, setHistoricalCounts] = useState<InventoryCount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Estados para inicio de nueva sesión
  const [auditorName, setAuditorName] = useState<string>(user?.username || 'Auditor Almacén');
  const [storeName, setStoreName] = useState<string>('Almacén Principal');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [categories, setCategories] = useState<string[]>([]);
  const [isBlindMode, setIsBlindMode] = useState<boolean>(!isAdmin && !canPreviewQuantities);
  const [sessionNotes, setSessionNotes] = useState<string>('');

  // Advertencia de segregación de funciones
  const [overrideSegregation, setOverrideSegregation] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [segregationWarning, setSegregationWarning] = useState<string | null>(null);

  // Filtros del listado de conteo activo
  const [itemSearch, setItemSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'todos' | 'pendientes' | 'revisados' | 'diferencias'>('todos');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Modal / Detalle de sesión histórica
  const [selectedHistoricCount, setSelectedHistoricCount] = useState<InventoryCount | null>(null);
  const [historicItems, setHistoricItems] = useState<CountItem[]>([]);

  // Notas del administrador para aprobación
  const [adminNotes, setAdminNotes] = useState('');

  // Carga inicial
  useEffect(() => {
    fetchProducts();
    fetchActiveSession();
    fetchHistory();
  }, [activeTab]);

  useEffect(() => {
    if (products && products.length > 0) {
      const uniqueCats = Array.from(new Set(products.map(p => p.category || 'Sin Categoría'))).filter(Boolean);
      setCategories(uniqueCats);
    }
  }, [products]);

  // Validar segregación de funciones
  useEffect(() => {
    if (!isAdmin && user?.username && auditorName) {
      const isOperatorSelfAuditing = auditorName.toLowerCase().trim().includes(user.username.toLowerCase().trim()) || auditorName.toLowerCase().includes('cajero');
      if (isOperatorSelfAuditing && !overrideSegregation) {
        setSegregationWarning("Advertencia de Segregación: Se requiere confirmación para auto-auditoría de trabajador.");
      } else {
        setSegregationWarning(null);
      }
    } else {
      setSegregationWarning(null);
    }
  }, [auditorName, user, overrideSegregation, isAdmin]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchProducts();
    await fetchActiveSession();
    await fetchHistory();
    setIsRefreshing(false);
    showNotification?.("✓ Datos y existencias sincronizados con el Punto de Venta.", "info");
  };

  const fetchActiveSession = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory-counts?user_role=${user?.role || ''}`, {
        headers: { 'x-user-role': user?.role || '' }
      });
      if (res.ok) {
        const counts: InventoryCount[] = await res.json();
        const active = counts.find(c => c.status === 'en_progreso' || c.status === 'completado' || c.status === 'pausado' || c.status === 'finalizado');
        if (active) {
          setActiveSession(active);
          await fetchSessionItems(active.id);
        } else {
          setActiveSession(null);
          setSessionItems([]);
        }
      }
    } catch (err) {
      console.error("Error fetching active session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/inventory-counts?user_role=${user?.role || ''}`, {
        headers: { 'x-user-role': user?.role || '' }
      });
      if (res.ok) {
        const counts: InventoryCount[] = await res.json();
        const historic = counts.filter(c => c.status === 'aprobado' || c.status === 'cerrado' || c.status === 'cancelado');
        setHistoricalCounts(historic);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const fetchSessionItems = async (countId: number, isHistoric = false) => {
    try {
      const res = await fetch(`/api/inventory-counts/${countId}?user_role=${user?.role || ''}`, {
        headers: { 'x-user-role': user?.role || '' }
      });
      if (res.ok) {
        const data = await res.json();
        const isSanitized = data.is_blind_sanitized === true;

        const mapItems = (items: any[]) => items.map(it => {
          const prodObj = products?.find(p => p.id === it.product_id);
          const liveStock = prodObj?.stock !== undefined ? prodObj.stock : (it.live_stock ?? it.expected_quantity ?? 0);
          const physicalQty = it.physical_quantity ?? 0;
          const isChecked = it.status !== 'pendiente' ? 1 : 0;
          const diff = physicalQty - liveStock;

          return {
            ...it,
            product_name: prodObj?.name || it.product_name,
            product_sku: prodObj?.sku || it.product_sku || 'N/A',
            product_category: prodObj?.category || it.product_category || 'General',
            system_stock: isSanitized ? undefined : liveStock,
            live_stock: liveStock,
            counted_stock: physicalQty,
            difference: isSanitized ? 0 : diff,
            is_checked: isChecked,
            status: it.status || 'pendiente'
          };
        });

        if (isHistoric) {
          setHistoricItems(mapItems(data.items || []));
        } else {
          setSessionItems(mapItems(data.items || []));
        }
      }
    } catch (err) {
      console.error("Error fetching items:", err);
    }
  };

  const handleStartSession = async () => {
    if (!auditorName.trim()) {
      showNotification?.("Ingresa el nombre del auditor responsable.", "error");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        user_id: user?.id || 1,
        username: user?.username || 'admin',
        auditor_name: auditorName.trim(),
        store_name: storeName.trim(),
        notes: sessionNotes || `Control Físico de Almacén${isBlindMode ? ' a Ciegas' : ''}`,
        category_filter: selectedCategory === 'Todos' ? null : selectedCategory,
        mode: isBlindMode ? 'BLIND' : 'STANDARD',
        override_segregation: overrideSegregation ? 1 : 0,
        override_reason: overrideSegregation ? overrideReason : null
      };

      const res = await fetch('/api/inventory-counts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(user?.id || 1),
          'x-user-role': user?.role || ''
        },
        body: JSON.stringify(payload)
      });

      const responseData = await res.json();

      if (res.ok) {
        showNotification?.(`✓ Nueva sesión de auditoría física iniciada con éxito.`, "success");
        await fetchProducts();
        await fetchActiveSession();
      } else if (responseData.has_active_session) {
        const replace = confirm(`${responseData.error}\n\n¿Deseas cancelar la sesión anterior e iniciar esta nueva auditoría de inventario?`);
        if (replace) {
          const retryRes = await fetch('/api/inventory-counts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': String(user?.id || 1),
              'x-user-role': user?.role || ''
            },
            body: JSON.stringify({ ...payload, force_new: true })
          });
          if (retryRes.ok) {
            showNotification?.(`✓ Nueva sesión de auditoría iniciada con éxito.`, "success");
            await fetchProducts();
            await fetchActiveSession();
          } else {
            const errData = await retryRes.json();
            showNotification?.(errData.error || "No se pudo iniciar la sesión.", "error");
          }
        } else {
          await fetchActiveSession();
        }
      } else if (responseData.segregation_warning) {
        setSegregationWarning(responseData.error);
        showNotification?.(responseData.error, "warning");
      } else {
        showNotification?.(`Error al iniciar sesión: ${responseData.error}`, "error");
      }
    } catch (err) {
      console.error(err);
      showNotification?.("Fallo de red al crear sesión.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateItem = async (itemId: number, updatedFields: { counted_stock?: number; is_checked?: number; status?: string; notes?: string }) => {
    if (!activeSession) return;
    const item = sessionItems.find(it => it.id === itemId);
    if (!item) return;

    const newStock = updatedFields.counted_stock !== undefined ? Math.max(0, updatedFields.counted_stock) : item.counted_stock;
    const nextChecked = updatedFields.is_checked !== undefined ? updatedFields.is_checked : item.is_checked;
    const nextStatus = updatedFields.status !== undefined ? updatedFields.status : (nextChecked === 0 ? 'pendiente' : 'contado');

    const sysStock = item.system_stock ?? item.live_stock ?? 0;
    const diff = newStock - sysStock;

    // Actualización optimista inmediata
    setSessionItems(prev => prev.map(it => it.id === itemId ? { 
      ...it, 
      counted_stock: newStock,
      is_checked: nextStatus !== 'pendiente' ? 1 : 0,
      status: nextStatus,
      difference: diff,
      notes: updatedFields.notes !== undefined ? updatedFields.notes : it.notes
    } : it));

    try {
      const res = await fetch(`/api/inventory-counts/${activeSession.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': user?.role || ''
        },
        body: JSON.stringify({ 
          physical_quantity: newStock,
          status: nextStatus,
          notes: updatedFields.notes !== undefined ? updatedFields.notes : item.notes
        })
      });
      if (!res.ok) {
        console.error("Failed to update count item on server");
      }
    } catch (err) {
      console.error("Network error while updating count item:", err);
    }
  };

  const handleToggleCheck = async (item: CountItem) => {
    const isChecked = item.is_checked === 1;
    const nextChecked = isChecked ? 0 : 1;
    await handleUpdateItem(item.id, { is_checked: nextChecked });
  };

  const handleSetStockToSystem = async (item: CountItem) => {
    const sys = item.system_stock ?? item.live_stock ?? 0;
    await handleUpdateItem(item.id, { counted_stock: sys, is_checked: 1 });
  };

  const handleMatchAllPending = async () => {
    const pending = sessionItems.filter(it => it.is_checked === 0);
    if (pending.length === 0) {
      showNotification?.("No hay productos pendientes por verificar.", "info");
      return;
    }
    if (!confirm(`¿Deseas marcar los ${pending.length} productos pendientes con la cantidad exacta que figura en el POS?`)) return;
    
    setIsLoading(true);
    for (const item of pending) {
      const sys = item.system_stock ?? item.live_stock ?? 0;
      await handleUpdateItem(item.id, { counted_stock: sys, is_checked: 1 });
    }
    setIsLoading(false);
    showNotification?.("✓ Todos los productos pendientes han sido verificados con stock del POS.", "success");
  };

  const handleCompleteSession = async () => {
    if (!activeSession) return;
    setIsLoading(true);
    try {
      const targetStatus = isAdmin ? 'cerrado' : 'completado';
      const res = await fetch(`/api/inventory-counts/${activeSession.id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': user?.role || ''
        },
        body: JSON.stringify({ 
          status: targetStatus,
          auto_apply: isAdmin
        })
      });

      if (res.ok) {
        showNotification?.(
          isAdmin 
            ? "✓ Control físico completado y ajustado directamente en el inventario de productos."
            : "✓ Conteo físico finalizado. Reporte enviado a Administración.", 
          "success"
        );
        await fetchProducts();
        await fetchActiveSession();
        await fetchHistory();

        safeDispatchEvent('inventory_operation', {
          detail: {
            type: 'physical_count',
            id: activeSession.id,
            user: user?.username || 'admin',
            timestamp: new Date().toISOString()
          }
        });
      } else {
        showNotification?.("No se pudo completar la sesión de control físico.", "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveCount = async () => {
    if (!activeSession) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory-counts/${activeSession.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(user?.id || 1),
          'x-user-role': user?.role || ''
        },
        body: JSON.stringify({
          admin_id: user?.id,
          admin_username: user?.username,
          notes: adminNotes || 'Conciliación aprobada sin discrepancias mayores.'
        })
      });

      if (res.ok) {
        showNotification?.("✓ Ajustes físicos de inventario aprobados y aplicados correctamente.", "success");
        setAdminNotes('');
        await fetchActiveSession();
        await fetchProducts();
        await fetchHistory();
        
        safeDispatchEvent('inventory_operation', {
          detail: {
            type: 'physical_count',
            id: activeSession.id,
            user: user?.username || 'admin',
            timestamp: new Date().toISOString()
          }
        });
      } else {
        const err = await res.json();
        showNotification?.(`Error al aprobar: ${err.error}`, "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSession = async () => {
    if (!activeSession) return;
    if (!confirm("¿Está seguro que desea cancelar esta sesión de control físico? Los cambios no guardados se descartarán.")) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory-counts/${activeSession.id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': user?.role || ''
        },
        body: JSON.stringify({ status: 'cancelado' })
      });
      if (res.ok) {
        showNotification?.("Sesión de auditoría cancelada.", "info");
        setActiveSession(null);
        setSessionItems([]);
        await fetchActiveSession();
        await fetchHistory();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewHistoricCount = (count: InventoryCount) => {
    setSelectedHistoricCount(count);
    fetchSessionItems(count.id, true);
  };

  // Resumen y métricas
  const getDiscrepancySummary = (itemsList: CountItem[]) => {
    const totalItems = itemsList.length;
    const checkedItems = itemsList.filter(it => it.is_checked === 1).length;
    const pendingItems = totalItems - checkedItems;
    
    const itemsWithSysStock = itemsList.filter(it => it.system_stock !== undefined);
    const hasAdminVisibility = itemsWithSysStock.length > 0;

    const productsWithDiff = hasAdminVisibility 
      ? itemsList.filter(it => it.is_checked === 1 && it.counted_stock !== (it.system_stock ?? it.live_stock ?? 0)).length
      : 0;

    const totalSystemStock = hasAdminVisibility
      ? itemsList.reduce((sum, it) => sum + (it.system_stock ?? it.live_stock ?? 0), 0)
      : 0;

    const totalCountedStock = itemsList.reduce((sum, it) => sum + (it.is_checked === 1 ? it.counted_stock : 0), 0);
    const totalDiscrepancyUnits = hasAdminVisibility ? totalCountedStock - totalSystemStock : 0;
    const completedPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

    return {
      totalItems,
      checkedItems,
      pendingItems,
      productsWithDiff,
      totalSystemStock,
      totalCountedStock,
      totalDiscrepancyUnits,
      completedPercent,
      hasAdminVisibility
    };
  };

  const activeSummary = useMemo(() => getDiscrepancySummary(sessionItems), [sessionItems]);

  // Lista de categorías únicas presentes en la sesión activa
  const activeSessionCategories = useMemo(() => {
    const cats = new Set<string>();
    sessionItems.forEach(it => {
      if (it.product_category) cats.add(it.product_category);
    });
    return Array.from(cats);
  }, [sessionItems]);

  // Filtrado de productos en sesión activa
  const filteredItems = useMemo(() => {
    return sessionItems.filter(it => {
      const cleanQuery = itemSearch.toLowerCase().replace(/^#/, '').trim();
      const searchTerms = cleanQuery.split(/\s+/).filter(Boolean);
      const searchableText = `${it.product_id || ''} ${(it.product_name || '').toLowerCase()} ${(it.product_sku || '').toLowerCase()} ${(it.product_category || '').toLowerCase()}`;
      const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => searchableText.includes(term));
      
      let matchesFilter = true;
      if (activeFilter === 'pendientes') {
        matchesFilter = it.is_checked === 0;
      } else if (activeFilter === 'revisados') {
        matchesFilter = it.is_checked === 1;
      } else if (activeFilter === 'diferencias' && activeSummary.hasAdminVisibility) {
        matchesFilter = it.is_checked === 1 && it.counted_stock !== (it.system_stock ?? it.live_stock ?? 0);
      }

      const matchesCategory = selectedCategoryFilter === 'ALL' || (it.product_category && it.product_category.toLowerCase() === selectedCategoryFilter.toLowerCase());

      return matchesSearch && matchesFilter && matchesCategory;
    });
  }, [sessionItems, itemSearch, activeFilter, selectedCategoryFilter, activeSummary.hasAdminVisibility]);

  return (
    <div 
      id="physical-count-screen"
      className={embeddedMode 
        ? "w-full h-full flex flex-col overflow-hidden bg-slate-100 dark:bg-[#070b14] select-none" 
        : "fixed inset-0 z-[9999] w-full h-full bg-slate-900/90 backdrop-blur-md flex flex-col md:p-3 select-none overflow-hidden"
      }
    >
      {/* CONTENEDOR PRINCIPAL: Ocupa el 100% de la pantalla en móviles sin recortes */}
      <div className={embeddedMode 
        ? "w-full h-full flex flex-col overflow-hidden" 
        : "w-full h-full md:max-w-6xl md:mx-auto flex flex-col bg-slate-100 dark:bg-[#090e1a] md:rounded-2xl border-0 md:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      }>
        
        {/* ======================================================== */}
        {/* 1. CABECERA ULTRA-COMPACTA (Altura: ~44px)               */}
        {/* ======================================================== */}
        <header className="h-12 px-3 bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 gap-2 z-20 shadow-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {onClose && (
              <button 
                id="btn-close-physical-count-top"
                type="button"
                onClick={onClose} 
                className="w-8 h-8 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                title="Cerrar / Pausar"
              >
                <ChevronLeft size={22} className="stroke-[2.5]" />
              </button>
            )}

            <div className="min-w-0 flex items-center gap-1.5 truncate">
              <h1 className="text-xs md:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight truncate leading-tight">
                Control Físico
              </h1>
              {activeSession && (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                  #{activeSession.id}
                </span>
              )}
              {activeSession && (
                <span className={`px-1.5 py-0.2 text-[9px] font-black uppercase rounded-md border shrink-0 ${
                  activeSession.mode === 'BLIND' 
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' 
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}>
                  {activeSession.mode === 'BLIND' ? 'Ciegas' : 'Visible'}
                </span>
              )}
            </div>
          </div>

          {/* Acciones y Selector de Pestaña */}
          <div className="flex items-center gap-1.5 shrink-0">
            {activeSession && (
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                <span className="text-emerald-600 dark:text-emerald-400 font-black">{activeSummary.checkedItems}</span>
                <span className="text-slate-400">/</span>
                <span>{activeSummary.totalItems}</span>
                <span className="text-[9px] text-slate-400">({activeSummary.completedPercent}%)</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveTab(activeTab === 'activo' ? 'historico' : 'activo');
                setSelectedHistoricCount(null);
              }}
              className={`p-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'historico'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
              title={activeTab === 'activo' ? "Ver Historial de Auditorías" : "Volver al Conteo Activo"}
            >
              <History size={15} />
              <span className="hidden sm:inline">{activeTab === 'activo' ? 'Historial' : 'Conteo'}</span>
            </button>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Sincronizar existencias del POS"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <RefreshCw size={15} className={isRefreshing ? "animate-spin text-indigo-500" : ""} />
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* 2. ÁREA DE TRABAJO PRINCIPAL (PANTALLA COMPLETA)         */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          
          {/* VISTA 1: CONTEO ACTIVO */}
          {activeTab === 'activo' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* CASO A: FORMULARIO PARA INICIAR NUEVA AUDITORÍA */}
              {!activeSession && (
                <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
                  <div className="max-w-md w-full bg-white dark:bg-[#11192e] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col gap-4 text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <ShieldCheck size={28} />
                    </div>

                    <div>
                      <h2 className="text-sm md:text-base font-black text-slate-850 dark:text-white uppercase tracking-tight">
                        Nuevo Control Físico de Inventario
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                        Verifica las existencias reales en anaqueles y estantes directamente con el stock del Punto de Venta.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 text-left">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ubicación / Almacén</label>
                        <select
                          value={storeName}
                          onChange={e => setStoreName(e.target.value)}
                          className="w-full mt-1 p-2 text-xs font-bold bg-slate-50 dark:bg-[#151f32] text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Almacén Principal">Almacén Principal</option>
                          <option value="Sucursal Centro">Sucursal Centro</option>
                          <option value="Depósito Secundario">Depósito Secundario</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Auditor Responsable</label>
                        <input
                          type="text"
                          value={auditorName}
                          onChange={e => setAuditorName(e.target.value)}
                          placeholder="Ej. Juan Pérez"
                          className="w-full mt-1 p-2 text-xs font-bold bg-slate-50 dark:bg-[#151f32] text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Alcance de Categorías</label>
                        <select
                          value={selectedCategory}
                          onChange={e => setSelectedCategory(e.target.value)}
                          className="w-full mt-1 p-2 text-xs font-bold bg-slate-50 dark:bg-[#151f32] text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Todos">Todos los productos ({products?.length || 0} artículos)</option>
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Modo de Control</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setIsBlindMode(false)}
                            className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                              !isBlindMode
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                                : 'bg-slate-50 dark:bg-[#151f32] border-slate-200 dark:border-slate-800 text-slate-500'
                            }`}
                          >
                            <span className="text-xs font-black uppercase flex items-center gap-1.5">
                              <Eye size={12} className="text-emerald-500" />
                              Visible (POS)
                            </span>
                            <span className="text-[9px] font-medium opacity-80 leading-tight">Muestra el stock del sistema</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsBlindMode(true)}
                            className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                              isBlindMode
                                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-800 dark:text-indigo-300 ring-1 ring-indigo-500/30'
                                : 'bg-slate-50 dark:bg-[#151f32] border-slate-200 dark:border-slate-800 text-slate-500'
                            }`}
                          >
                            <span className="text-xs font-black uppercase flex items-center gap-1.5">
                              <ShieldCheck size={12} className="text-indigo-500" />
                              A Ciegas
                            </span>
                            <span className="text-[9px] font-medium opacity-80 leading-tight">Oculta existencias</span>
                          </button>
                        </div>
                      </div>

                      {segregationWarning && !isAdmin && (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-amber-700 dark:text-amber-300 text-xs">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                          <p className="text-[10px] leading-tight">{segregationWarning}</p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleStartSession}
                        disabled={isLoading}
                        className={`w-full mt-2 py-2.5 px-4 text-white font-black text-xs uppercase rounded-xl tracking-wider shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 ${
                          isBlindMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'
                        }`}
                      >
                        <Play size={13} />
                        <span>{isLoading ? 'Iniciando...' : 'Comenzar Auditoría'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CASO B: SESIÓN COMPLETADA PENDIENTE DE APROBACIÓN */}
              {activeSession && activeSession.status === 'completado' && (
                <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
                  {!isAdmin ? (
                    <div className="bg-white dark:bg-[#11192e] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl text-center flex flex-col items-center gap-4 max-w-md">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <CheckCircle size={28} />
                      </div>
                      <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase">
                        Conteo Finalizado y Enviado
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Tu conteo físico ha sido registrado exitosamente y está listo para la revisión y aprobación por el Administrador.
                      </p>
                      {onClose && (
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl transition cursor-pointer"
                        >
                          Cerrar Pantalla
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-[#11192e] p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col gap-3 max-w-2xl w-full">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                        <div>
                          <h3 className="text-xs md:text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                            Reconciliación y Aprobación
                          </h3>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Auditor: <strong className="text-indigo-600 dark:text-indigo-400">{activeSession.auditor_name || activeSession.username}</strong>
                          </p>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase rounded-lg border border-amber-500/20">
                          Pendiente Aprobación
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-black/30 p-2.5 rounded-xl text-center">
                        <div>
                          <span className="text-[8px] font-black uppercase text-slate-400 block">Total</span>
                          <span className="text-xs font-mono font-bold text-slate-800 dark:text-white">{activeSummary.totalItems}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase text-slate-400 block">Coincidentes</span>
                          <span className="text-xs font-mono font-bold text-emerald-500">
                            {sessionItems.filter(it => it.counted_stock === (it.system_stock ?? it.live_stock ?? 0)).length}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase text-slate-400 block">Con Dif.</span>
                          <span className="text-xs font-mono font-bold text-rose-500">{activeSummary.productsWithDiff}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase text-slate-400 block">Dif. Neta</span>
                          <span className={`text-xs font-mono font-bold ${activeSummary.totalDiscrepancyUnits >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>
                            {activeSummary.totalDiscrepancyUnits > 0 ? `+${activeSummary.totalDiscrepancyUnits}` : activeSummary.totalDiscrepancyUnits} u
                          </span>
                        </div>
                      </div>

                      <div className="max-h-[260px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                        {sessionItems.map(it => {
                          const sys = it.system_stock ?? it.live_stock ?? 0;
                          const physical = it.counted_stock ?? 0;
                          const diff = physical - sys;

                          return (
                            <div key={it.id} className="p-2 flex items-center justify-between text-xs gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-slate-800 dark:text-white uppercase truncate text-xs">{it.product_name}</div>
                                <div className="text-[9px] text-slate-400 font-mono">SKU: {it.product_sku}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-right font-mono text-[10px]">
                                <span className="text-slate-500">POS: <strong>{sys}</strong></span>
                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold text-slate-800 dark:text-white">
                                  Físico: {physical}
                                </span>
                                <span className={`font-black w-12 text-right ${diff === 0 ? 'text-emerald-500' : diff > 0 ? 'text-indigo-500' : 'text-rose-500'}`}>
                                  {diff === 0 ? '0 u' : diff > 0 ? `+${diff} u` : `${diff} u`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div>
                        <input
                          type="text"
                          value={adminNotes}
                          onChange={e => setAdminNotes(e.target.value)}
                          placeholder="Observaciones de conciliación..."
                          className="w-full p-2 text-xs bg-slate-50 dark:bg-[#151f32] text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleCancelSession}
                          className="py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 font-bold text-xs uppercase rounded-xl transition cursor-pointer"
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          onClick={handleApproveCount}
                          disabled={isLoading}
                          className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl transition shadow-md cursor-pointer"
                        >
                          {isLoading ? 'Aplicando...' : 'Aprobar y Ajustar Stock'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CASO C: CONTEO FÍSICO ACTIVO - ESPACIO Y SCROLL MÁXIMO */}
              {activeSession && activeSession.status !== 'completado' && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  
                  {/* BARRA SUPERIOR DE BÚSQUEDA Y FILTROS INTEGRADA */}
                  <div className="bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 px-3 py-2 shrink-0 flex flex-col gap-1.5 z-10">
                    
                    {/* Fila 1: Buscador + Botón = Todo al POS */}
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="text"
                          value={itemSearch}
                          onChange={e => setItemSearch(e.target.value)}
                          placeholder="Buscar artículo, SKU, #ID..."
                          className="w-full pl-8 pr-7 py-1.5 text-xs font-bold bg-slate-50 dark:bg-[#151f32] text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                          autoComplete="off"
                          spellCheck="false"
                        />
                        <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
                        {itemSearch && (
                          <button
                            type="button"
                            onClick={() => setItemSearch('')}
                            className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      {/* Filtro por Categoría si existen varias */}
                      {activeSessionCategories.length > 1 && (
                        <select
                          value={selectedCategoryFilter}
                          onChange={e => setSelectedCategoryFilter(e.target.value)}
                          className="max-w-[120px] p-1.5 text-[10px] font-bold bg-slate-50 dark:bg-[#151f32] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                        >
                          <option value="ALL">Categorías ({activeSessionCategories.length})</option>
                          {activeSessionCategories.map(c => (
                            <option key={c} value={c}>{c.toUpperCase()}</option>
                          ))}
                        </select>
                      )}

                      {/* Botón rápido = Todo al POS para Admin */}
                      {isAdmin && activeSummary.pendingItems > 0 && (
                        <button
                          type="button"
                          onClick={handleMatchAllPending}
                          disabled={isLoading}
                          className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase rounded-xl border border-indigo-200 dark:border-indigo-800 transition cursor-pointer flex items-center gap-1 shrink-0"
                          title="Marcar todos los artículos pendientes con su stock actual del POS"
                        >
                          <Zap size={12} className="text-amber-500 fill-amber-500" />
                          <span className="hidden sm:inline">= Todo</span> POS
                        </button>
                      )}
                    </div>

                    {/* Fila 2: Chips de Filtro Horizontal */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                      <button
                        type="button"
                        onClick={() => setActiveFilter('todos')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition whitespace-nowrap cursor-pointer shrink-0 ${
                          activeFilter === 'todos'
                            ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        Todos ({sessionItems.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveFilter('pendientes')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition whitespace-nowrap cursor-pointer shrink-0 ${
                          activeFilter === 'pendientes'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        Pendientes ({activeSummary.pendingItems})
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveFilter('revisados')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition whitespace-nowrap cursor-pointer shrink-0 ${
                          activeFilter === 'revisados'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        Verificados ({activeSummary.checkedItems})
                      </button>

                      {activeSummary.hasAdminVisibility && (
                        <button
                          type="button"
                          onClick={() => setActiveFilter('diferencias')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition whitespace-nowrap cursor-pointer shrink-0 ${
                            activeFilter === 'diferencias'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          Diferencias ({activeSummary.productsWithDiff})
                        </button>
                      )}
                    </div>

                  </div>

                  {/* ======================================================== */}
                  {/* LISTA DE ARTÍCULOS DE ALTA DENSIDAD Y ESPACIO EXPANDIDO  */}
                  {/* ======================================================== */}
                  <div className="flex-1 overflow-y-auto p-2 md:p-3 flex flex-col gap-2 pb-24">
                    {filteredItems.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-wide bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl my-auto">
                        {itemSearch ? 'No se encontraron artículos con ese criterio.' : 'No hay artículos en esta vista.'}
                      </div>
                    ) : (
                      filteredItems.map(it => {
                        const isChecked = it.is_checked === 1;
                        const sysStock = it.system_stock ?? it.live_stock ?? 0;
                        const physical = it.counted_stock ?? 0;
                        const diff = physical - sysStock;
                        const showStock = it.system_stock !== undefined;

                        return (
                          <div
                            key={it.id}
                            id={`item-count-${it.id}`}
                            className={`p-2.5 sm:p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 ${
                              isChecked
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/50 shadow-xs'
                                : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            {/* Información del Artículo (Descripción COMPLETA sin recortes) */}
                            <div className="min-w-0 flex-1 flex flex-col gap-1">
                              {/* Metadata: ID, SKU, Categoría y Estado */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                                  #{it.product_id}
                                </span>
                                {it.product_sku && (
                                  <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                                    SKU: {it.product_sku}
                                  </span>
                                )}
                                {it.product_category && (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                                    {it.product_category}
                                  </span>
                                )}
                                {isChecked && (
                                  <span className="ml-auto sm:hidden px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase border border-emerald-500/20">
                                    ✓ Verificado
                                  </span>
                                )}
                              </div>
                              
                              {/* NOMBRE COMPLETO DEL PRODUCTO (Permite salto de línea fluido en pantallas verticales) */}
                              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase leading-snug break-words whitespace-normal">
                                {it.product_name}
                              </h3>

                              {/* Existencias POS y Discrepancias */}
                              <div className="flex items-center gap-2.5 font-mono text-[10px] sm:text-xs">
                                {showStock && (
                                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                                    Stock POS: <strong className="text-slate-900 dark:text-white font-bold">{sysStock} u</strong>
                                  </span>
                                )}
                                {isChecked && showStock && (
                                  <span className={`font-black px-1.5 py-0.2 rounded ${
                                    diff === 0 
                                      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50' 
                                      : diff > 0 
                                        ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50' 
                                        : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50'
                                  }`}>
                                    {diff === 0 ? '✓ Coincide' : diff > 0 ? `+${diff} u (Sobrante)` : `${diff} u (Faltante)`}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Controles de Conteo (Adaptables a vertical en móviles y horizontal en desktop/kiosco ancho) */}
                            <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80">
                              
                              {/* Botón Rápido = POS */}
                              {showStock && (
                                <button
                                  type="button"
                                  onClick={() => handleSetStockToSystem(it)}
                                  className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase transition border cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                                    isChecked && physical === sysStock
                                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                                      : 'bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                                  }`}
                                  title="Igualar a la cantidad del POS"
                                >
                                  <span>= POS</span>
                                  <span className="font-mono">({sysStock})</span>
                                </button>
                              )}

                              {/* Stepper de Conteo Táctil */}
                              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(it.id, { counted_stock: Math.max(0, physical - 1), is_checked: 1 })}
                                  className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-black text-base flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition active:scale-90 cursor-pointer shadow-xs"
                                  title="Restar 1"
                                >
                                  -
                                </button>

                                <input
                                  type="number"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  min="0"
                                  value={it.counted_stock === null || it.counted_stock === undefined ? '' : it.counted_stock}
                                  onFocus={e => e.target.select()}
                                  onChange={e => {
                                    const val = parseInt(e.target.value);
                                    handleUpdateItem(it.id, { counted_stock: isNaN(val) ? 0 : Math.max(0, val), is_checked: 1 });
                                  }}
                                  className="w-12 h-8 text-center font-mono font-black text-xs sm:text-sm bg-transparent text-slate-900 dark:text-white focus:outline-none"
                                />

                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(it.id, { counted_stock: physical + 1, is_checked: 1 })}
                                  className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-black text-base flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition active:scale-90 cursor-pointer shadow-xs"
                                  title="Sumar 1"
                                >
                                  +
                                </button>
                              </div>

                              {/* Botón Marcar / Check Táctil */}
                              <button
                                type="button"
                                onClick={() => handleToggleCheck(it)}
                                className={`w-9 h-8 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${
                                  isChecked
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-500 hover:text-white'
                                }`}
                                title={isChecked ? "Marcar como pendiente" : "Marcar como verificado"}
                              >
                                <Check size={18} className="stroke-[3]" />
                              </button>

                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* ======================================================== */}
                  {/* BARRA INFERIOR FIJA / ACCIONES (Altura: ~48px)           */}
                  {/* ======================================================== */}
                  <div className="absolute bottom-0 inset-x-0 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-2 md:p-2.5 flex items-center justify-between gap-2 z-30 shadow-lg">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCancelSession}
                        className="px-2.5 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] font-bold uppercase rounded-xl transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      {onClose && (
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase rounded-xl transition cursor-pointer"
                        >
                          Pausar
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleCompleteSession}
                      disabled={activeSummary.pendingItems > 0 || isLoading}
                      className={`flex-1 max-w-sm py-2 px-3 text-xs font-black uppercase rounded-xl transition flex items-center justify-center gap-1.5 shadow-md ${
                        activeSummary.pendingItems > 0
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-90'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-98 cursor-pointer'
                      }`}
                    >
                      <CheckCircle size={14} className="shrink-0" />
                      <span className="truncate">
                        {activeSummary.pendingItems > 0
                          ? `Faltan ${activeSummary.pendingItems} artículos`
                          : (isAdmin ? 'Finalizar y Conciliar' : 'Concluir y Enviar')}
                      </span>
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* VISTA 2: HISTORIAL DE AUDITORÍAS */}
          {activeTab === 'historico' && (
            <div className="flex-1 overflow-y-auto p-3 md:p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs md:text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  Historial de Auditorías Físicas
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  {historicalCounts.length} registros
                </span>
              </div>

              {historicalCounts.length === 0 ? (
                <div className="p-10 text-center text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-wide bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl my-auto">
                  No hay sesiones de auditoría física registradas en el historial.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {historicalCounts.map(count => (
                    <div 
                      key={count.id}
                      className="p-3 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase">
                            Auditoría #{count.id}
                          </span>
                          <span className={`px-2 py-0.2 text-[9px] font-black uppercase rounded border ${
                            count.status === 'cerrado' || count.status === 'aprobado'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          }`}>
                            {count.status === 'cerrado' || count.status === 'aprobado' ? 'Conciliado' : count.status}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase mt-0.5 truncate">
                          {count.store_name || 'Almacén Principal'}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Auditor: {count.auditor_name || count.username} · {new Date(count.created_at || count.started_at || '').toLocaleDateString()}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleViewHistoricCount(count)}
                        className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <FileText size={12} />
                        <span>Ver Detalle</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* MODAL DETALLE HISTÓRICO */}
      {selectedHistoricCount && (
        <div className="fixed inset-0 z-[11000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-4 shadow-2xl flex flex-col gap-3 max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">
                  Auditoría #{selectedHistoricCount.id}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {selectedHistoricCount.store_name || 'Almacén Principal'} · {selectedHistoricCount.auditor_name || selectedHistoricCount.username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoricCount(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
              {historicItems.map(it => (
                <div key={it.id} className="p-2 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 dark:text-white uppercase truncate text-xs">{it.product_name}</div>
                    <div className="text-[9px] text-slate-400 font-mono">SKU: {it.product_sku}</div>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-[10px] text-slate-500">POS: {it.system_stock ?? it.live_stock ?? 0}</span>
                    <span className="text-[10px] font-bold text-slate-800 dark:text-white">Físico: {it.counted_stock}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSelectedHistoricCount(null)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
