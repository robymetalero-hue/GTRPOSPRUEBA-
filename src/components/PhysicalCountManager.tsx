import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { safeDispatchEvent } from '../utils/events';
import { hasPermission } from '../utils/permissions';
import { 
  ClipboardCheck, CheckCircle, AlertTriangle, Play, X, 
  Eye, RefreshCw, Search, Check, ChevronLeft, 
  ShieldCheck, FileText, Zap, History, Printer,
  RotateCcw, AlertCircle, TrendingDown, TrendingUp,
  Layers, Filter, ArrowDownRight, ArrowUpRight
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
  exclude_zero_stock?: number;
  sort_order?: string;
  approved_at: string | null;
  approved_by_username: string | null;
  is_blind_sanitized?: boolean;
  total_products?: number;
  reviewed_products?: number;
  correct_products?: number;
  difference_products?: number;
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
  price_cost?: number;
  price_sale?: number;
  cost_impact?: number;
  sale_impact?: number;
  is_failed?: boolean;
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
  const [excludeZeroStock, setExcludeZeroStock] = useState<boolean>(true);
  const [sortOrder, setSortOrder] = useState<string>('category_name');

  // Advertencia de segregación de funciones
  const [overrideSegregation, setOverrideSegregation] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [segregationWarning, setSegregationWarning] = useState<string | null>(null);

  // Filtros del listado de conteo activo
  const [itemSearch, setItemSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'todos' | 'pendientes' | 'revisados' | 'diferencias'>('todos');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [activeCountSort, setActiveCountSort] = useState<string>('category_name');
  const [hideZeroStockInActive, setHideZeroStockInActive] = useState<boolean>(true);

  // Filtro del Informe de Administración para Conteo a Ciegas
  const [adminReportFilter, setAdminReportFilter] = useState<'fallidos' | 'todos' | 'coincidentes'>('fallidos');
  const [selectedRecountIds, setSelectedRecountIds] = useState<number[]>([]);
  const [showRecountModal, setShowRecountModal] = useState<boolean>(false);
  const [recountInstruction, setRecountInstruction] = useState<string>('Por favor verificar conteo físico en estantería.');
  const [showPrintReport, setShowPrintReport] = useState<boolean>(false);
  const [confirmCompleteModal, setConfirmCompleteModal] = useState<boolean>(false);

  // Modal / Detalle de sesión histórica
  const [selectedHistoricCount, setSelectedHistoricCount] = useState<InventoryCount | null>(null);
  const [historicItems, setHistoricItems] = useState<CountItem[]>([]);
  const [historicReportFilter, setHistoricReportFilter] = useState<'fallidos' | 'todos' | 'coincidentes'>('fallidos');

  // Notas del administrador para aprobación
  const [adminNotes, setAdminNotes] = useState('');

  // Carga inicial
  const [catalogSummary, setCatalogSummary] = useState<{
    total_products: number;
    with_stock_count: number;
    total_units: number;
    categories: Array<{ category: string; total_products: number; with_stock: number; total_units: number }>;
  } | null>(null);

  const fetchCatalogSummary = async () => {
    try {
      const res = await fetch('/api/inventory-counts/categories-summary');
      if (res.ok) {
        const data = await res.json();
        setCatalogSummary(data);
        if (Array.isArray(data.categories)) {
          setCategories(data.categories.map((c: any) => c.category));
        }
      }
    } catch (e) {
      console.warn("Failed to fetch catalog summary:", e);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCatalogSummary();
    fetchActiveSession();
    fetchHistory();
  }, [activeTab]);

  useEffect(() => {
    if (!catalogSummary && products && products.length > 0) {
      const uniqueCats = Array.from(new Set(products.map(p => p.category || 'Sin Categoría'))).filter(Boolean);
      setCategories(uniqueCats);
    }
  }, [products, catalogSummary]);

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
    await fetchCatalogSummary();
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
          const priceCost = prodObj?.price_cost || it.price_cost || 0;
          const priceSale = prodObj?.price_unit || it.price_sale || 0;
          const costImpact = diff * priceCost;
          const saleImpact = diff * priceSale;

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
            status: it.status || 'pendiente',
            price_cost: priceCost,
            price_sale: priceSale,
            cost_impact: costImpact,
            sale_impact: saleImpact,
            is_failed: !isSanitized && diff !== 0 && isChecked === 1,
            recount_requested: it.recount_requested || 0
          };
        });

        const mapped = mapItems(data.items || []);
        if (isHistoric) {
          setHistoricItems(mapped);
        } else {
          setSessionItems(mapped);
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
        override_reason: overrideSegregation ? overrideReason : null,
        exclude_zero_stock: excludeZeroStock,
        sort_order: sortOrder
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
        showNotification?.(`✓ Nueva sesión de control físico iniciada (${isBlindMode ? 'A Ciegas' : 'Visible'}).`, "success");
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
    const isBlindSanitized = activeSession.mode === 'BLIND' && !isAdmin;

    // Actualización optimista inmediata
    setSessionItems(prev => prev.map(it => it.id === itemId ? { 
      ...it, 
      counted_stock: newStock,
      is_checked: nextStatus !== 'pendiente' ? 1 : 0,
      status: nextStatus,
      difference: isBlindSanitized ? 0 : diff,
      is_failed: !isBlindSanitized && diff !== 0 && nextStatus !== 'pendiente',
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

  const handleQuickAdd = async (item: CountItem, amount: number) => {
    const current = item.counted_stock || 0;
    const target = Math.max(0, current + amount);
    await handleUpdateItem(item.id, { counted_stock: target, is_checked: 1 });
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
    setConfirmCompleteModal(false);
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
            ? "✓ Control físico finalizado y stock conciliado en inventario."
            : "✓ Inventario a ciegas finalizado. Informe enviado a Administración para validación.", 
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
          notes: adminNotes || 'Conciliación física aprobada por administración.'
        })
      });

      if (res.ok) {
        showNotification?.("✓ Ajustes físicos de inventario aprobados y aplicados en la base de datos.", "success");
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

  const handleRequestRecount = async () => {
    if (!activeSession) return;
    const targetIds = selectedRecountIds.length > 0 
      ? selectedRecountIds 
      : sessionItems.filter(it => it.is_failed).map(it => it.id);

    if (targetIds.length === 0) {
      showNotification?.("No hay artículos con discrepancia seleccionados para reconteo.", "info");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory-counts/${activeSession.id}/recount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': user?.role || ''
        },
        body: JSON.stringify({
          item_ids: targetIds,
          reason: recountInstruction || 'Verificar cantidad física en anaquel'
        })
      });

      if (res.ok) {
        showNotification?.(`✓ Se solicitó reconteo para ${targetIds.length} artículo(s) al kiosco.`, "success");
        setShowRecountModal(false);
        setSelectedRecountIds([]);
        await fetchActiveSession();
      } else {
        const err = await res.json();
        showNotification?.(err.error || "No se pudo solicitar el reconteo.", "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSession = async () => {
    if (!activeSession) return;
    if (!confirm("¿Está seguro que desea cancelar esta sesión de control físico? Los cambios no aprobados se descartarán.")) return;
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

  // Resumen y métricas de discrepancias
  const getDiscrepancySummary = (itemsList: CountItem[]) => {
    const totalItems = itemsList.length;
    const checkedItems = itemsList.filter(it => it.is_checked === 1).length;
    const pendingItems = totalItems - checkedItems;
    
    const itemsWithSysStock = itemsList.filter(it => it.system_stock !== undefined);
    const hasAdminVisibility = itemsWithSysStock.length > 0;

    const failedItems = hasAdminVisibility 
      ? itemsList.filter(it => it.is_checked === 1 && it.counted_stock !== (it.system_stock ?? it.live_stock ?? 0))
      : [];

    const exactItems = hasAdminVisibility
      ? itemsList.filter(it => it.is_checked === 1 && it.counted_stock === (it.system_stock ?? it.live_stock ?? 0))
      : [];

    const totalSystemStock = hasAdminVisibility
      ? itemsList.reduce((sum, it) => sum + (it.system_stock ?? it.live_stock ?? 0), 0)
      : 0;

    const totalCountedStock = itemsList.reduce((sum, it) => sum + (it.is_checked === 1 ? it.counted_stock : 0), 0);
    const totalDiscrepancyUnits = hasAdminVisibility ? totalCountedStock - totalSystemStock : 0;
    const completedPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

    const netCostImpact = failedItems.reduce((acc, it) => {
      const diff = it.counted_stock - (it.system_stock ?? it.live_stock ?? 0);
      return acc + (diff * (it.price_cost || 0));
    }, 0);

    const netSaleImpact = failedItems.reduce((acc, it) => {
      const diff = it.counted_stock - (it.system_stock ?? it.live_stock ?? 0);
      return acc + (diff * (it.price_sale || 0));
    }, 0);

    const accuracyRate = checkedItems > 0 
      ? Math.round((exactItems.length / checkedItems) * 100) 
      : 100;

    return {
      totalItems,
      checkedItems,
      pendingItems,
      failedItems,
      exactItems,
      productsWithDiff: failedItems.length,
      totalSystemStock,
      totalCountedStock,
      totalDiscrepancyUnits,
      completedPercent,
      hasAdminVisibility,
      netCostImpact,
      netSaleImpact,
      accuracyRate
    };
  };

  const activeSummary = useMemo(() => getDiscrepancySummary(sessionItems), [sessionItems]);
  const historicSummary = useMemo(() => getDiscrepancySummary(historicItems), [historicItems]);

  // Lista de categorías únicas presentes en la sesión activa
  const activeSessionCategories = useMemo(() => {
    const cats = new Set<string>();
    sessionItems.forEach(it => {
      if (it.product_category) cats.add(it.product_category);
    });
    return Array.from(cats).sort();
  }, [sessionItems]);

  // Filtrado y ordenamiento de artículos en sesión activa
  const filteredItems = useMemo(() => {
    return sessionItems
      .filter(it => {
        // Excluir productos con stock 0 si está activo el filtro
        const sysStock = it.system_stock ?? it.live_stock ?? 0;
        if (hideZeroStockInActive && sysStock <= 0 && it.counted_stock <= 0) {
          return false;
        }

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
      })
      .sort((a, b) => {
        if (activeCountSort === 'name_asc') {
          return a.product_name.localeCompare(b.product_name);
        } else if (activeCountSort === 'sku') {
          return (a.product_sku || '').localeCompare(b.product_sku || '');
        } else if (activeCountSort === 'stock_desc') {
          const stockA = a.system_stock ?? a.live_stock ?? 0;
          const stockB = b.system_stock ?? b.live_stock ?? 0;
          return stockB - stockA;
        } else {
          // Orden predeterminado: Categoría -> Nombre
          const catComp = (a.product_category || '').localeCompare(b.product_category || '');
          if (catComp !== 0) return catComp;
          return a.product_name.localeCompare(b.product_name);
        }
      });
  }, [sessionItems, itemSearch, activeFilter, selectedCategoryFilter, activeSummary.hasAdminVisibility, activeCountSort, hideZeroStockInActive]);

  // Artículos filtrados para el Informe de Administración
  const adminReportItems = useMemo(() => {
    return sessionItems.filter(it => {
      const sys = it.system_stock ?? it.live_stock ?? 0;
      const physical = it.counted_stock ?? 0;
      const isFailed = physical !== sys;

      if (adminReportFilter === 'fallidos') {
        return isFailed;
      } else if (adminReportFilter === 'coincidentes') {
        return !isFailed;
      }
      return true;
    }).sort((a, b) => {
      // Priorizar los que fallaron
      const diffA = Math.abs((a.counted_stock ?? 0) - (a.system_stock ?? a.live_stock ?? 0));
      const diffB = Math.abs((b.counted_stock ?? 0) - (b.system_stock ?? b.live_stock ?? 0));
      if (diffB !== diffA) return diffB - diffA; // Mayor discrepancia primero
      return a.product_name.localeCompare(b.product_name);
    });
  }, [sessionItems, adminReportFilter]);

  // Artículos filtrados para el modal de histórico
  const historicReportItems = useMemo(() => {
    return historicItems.filter(it => {
      const sys = it.system_stock ?? it.live_stock ?? 0;
      const physical = it.counted_stock ?? 0;
      const isFailed = physical !== sys;

      if (historicReportFilter === 'fallidos') return isFailed;
      if (historicReportFilter === 'coincidentes') return !isFailed;
      return true;
    }).sort((a, b) => {
      const diffA = Math.abs((a.counted_stock ?? 0) - (a.system_stock ?? a.live_stock ?? 0));
      const diffB = Math.abs((b.counted_stock ?? 0) - (b.system_stock ?? b.live_stock ?? 0));
      return diffB - diffA;
    });
  }, [historicItems, historicReportFilter]);

  // Recuento de productos activos en almacén (con stock > 0 vs total)
  const productsWithStockCount = useMemo(() => {
    if (catalogSummary?.with_stock_count !== undefined) {
      return catalogSummary.with_stock_count;
    }
    if (!products) return 0;
    return products.filter(p => (p.stock || 0) > 0).length;
  }, [catalogSummary, products]);

  return (
    <div 
      id="physical-count-screen"
      className={embeddedMode 
        ? "w-full h-full flex flex-col overflow-hidden bg-slate-100 dark:bg-[#070b14] select-none" 
        : "fixed inset-0 z-[9999] w-full h-full bg-slate-900/90 backdrop-blur-md flex flex-col md:p-3 select-none overflow-hidden"
      }
    >
      {/* CONTENEDOR PRINCIPAL */}
      <div className={embeddedMode 
        ? "w-full h-full flex flex-col overflow-hidden" 
        : "w-full h-full md:max-w-6xl md:mx-auto flex flex-col bg-slate-100 dark:bg-[#090e1a] md:rounded-2xl border-0 md:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      }>
        
        {/* ======================================================== */}
        {/* 1. CABECERA PRINCIPAL                                    */}
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
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  #{activeSession.id}
                </span>
              )}
              {activeSession && (
                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md border shrink-0 ${
                  activeSession.mode === 'BLIND' 
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' 
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}>
                  {activeSession.mode === 'BLIND' ? 'Auditoría a Ciegas' : 'Visible'}
                </span>
              )}
            </div>
          </div>

          {/* Acciones de Cabecera */}
          <div className="flex items-center gap-1.5 shrink-0">
            {activeSession && activeSession.status !== 'completado' && (
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
        {/* 2. ÁREA PRINCIPAL                                        */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          
          {/* TAB 1: CONTEO ACTIVO O INFORME DE ADMINISTRACIÓN */}
          {activeTab === 'activo' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* CASO A: FORMULARIO DE INICIO DE SESIÓN */}
              {!activeSession && (
                <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
                  <div className="max-w-lg w-full bg-white dark:bg-[#11192e] p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col gap-4 text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <ShieldCheck size={28} />
                    </div>

                    <div>
                      <h2 className="text-sm md:text-base font-black text-slate-850 dark:text-white uppercase tracking-tight">
                        Nuevo Control Físico de Inventario
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                        Audita las existencias físicas reales en anaqueles y estantes y compáralas de forma precisa con el sistema.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3.5 text-left">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Alcance de Categorías</label>
                          <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="w-full mt-1 p-2 text-xs font-bold bg-slate-50 dark:bg-[#151f32] text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                          >
                            <option value="Todos">
                              Todas las Categorías ({catalogSummary?.total_products || products?.length || 0} prod. - {catalogSummary?.with_stock_count || productsWithStockCount} activos con stock)
                            </option>
                            {categories.map(cat => {
                              const cInfo = catalogSummary?.categories?.find(c => c.category.toLowerCase() === cat.toLowerCase());
                              return (
                                <option key={cat} value={cat}>
                                  {cat.toUpperCase()} {cInfo ? `(${cInfo.total_products} prod. - ${cInfo.with_stock} con stock)` : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Orden del Recorrido</label>
                          <select
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value)}
                            className="w-full mt-1 p-2 text-xs font-bold bg-slate-50 dark:bg-[#151f32] text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                          >
                            <option value="category_name">Por Categoría y Nombre (Anaqueles)</option>
                            <option value="name_asc">Alfabético por Nombre (A-Z)</option>
                            <option value="sku">Por Código SKU</option>
                            <option value="stock_desc">Mayor a Menor Stock</option>
                          </select>
                        </div>
                      </div>

                      {/* FILTRO CLAVE: OMITIR PRODUCTOS EN 0 */}
                      <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-850/60 rounded-xl flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id="chk-exclude-zero-stock"
                          checked={excludeZeroStock}
                          onChange={e => setExcludeZeroStock(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="chk-exclude-zero-stock" className="text-xs font-bold text-slate-800 dark:text-white cursor-pointer select-none">
                          <span>Omitir productos con stock en 0</span>
                          <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            Recomendado: No mostrar productos vacíos en la lista para agilizar el conteo físico en estantes ({productsWithStockCount} artículos activos con stock &gt; 0).
                          </span>
                        </label>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Modo de Control</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setIsBlindMode(false)}
                            className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                              !isBlindMode
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                                : 'bg-slate-50 dark:bg-[#151f32] border-slate-200 dark:border-slate-800 text-slate-500'
                            }`}
                          >
                            <span className="text-xs font-black uppercase flex items-center gap-1.5">
                              <Eye size={13} className="text-emerald-500" />
                              Visible (POS)
                            </span>
                            <span className="text-[9px] font-medium opacity-80 leading-tight">Muestra las existencias del sistema</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsBlindMode(true)}
                            className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                              isBlindMode
                                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-800 dark:text-indigo-300 ring-1 ring-indigo-500/30'
                                : 'bg-slate-50 dark:bg-[#151f32] border-slate-200 dark:border-slate-800 text-slate-500'
                            }`}
                          >
                            <span className="text-xs font-black uppercase flex items-center gap-1.5">
                              <ShieldCheck size={13} className="text-indigo-500" />
                              A Ciegas
                            </span>
                            <span className="text-[9px] font-medium opacity-80 leading-tight">Oculta existencias (Recomendado Kiosco)</span>
                          </button>
                        </div>
                      </div>

                      {segregationWarning && !isAdmin && (
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-amber-700 dark:text-amber-300 text-xs">
                          <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
                          <p className="text-[10px] leading-tight">{segregationWarning}</p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleStartSession}
                        disabled={isLoading}
                        className={`w-full mt-2 py-3 px-4 text-white font-black text-xs uppercase rounded-xl tracking-wider shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 ${
                          isBlindMode ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                        }`}
                      >
                        <Play size={14} />
                        <span>{isLoading ? 'Iniciando...' : 'Comenzar Control Físico'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CASO B: INFORME DE AUDITORÍA FÍSICA A CIEGAS RECIBIDO POR EL ADMIN (O PANTALLA DE ÉXITO EN KIOSCO) */}
              {activeSession && activeSession.status === 'completado' && (
                <div className="flex-1 overflow-y-auto p-3 md:p-4 flex flex-col items-center">
                  {!isAdmin ? (
                    <div className="bg-white dark:bg-[#11192e] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl text-center flex flex-col items-center gap-4 max-w-md my-auto">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center animate-bounce">
                        <CheckCircle size={36} />
                      </div>
                      <h3 className="text-base font-black text-slate-850 dark:text-white uppercase">
                        ¡Inventario a Ciegas Enviado!
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Tu conteo físico ha sido transmitido exitosamente al Administrador. El sistema ha generado el informe comparativo para su revisión y aprobación.
                      </p>
                      {onClose && (
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl transition cursor-pointer"
                        >
                          Volver al Punto de Venta
                        </button>
                      )}
                    </div>
                  ) : (
                    /* INFORME COMPLETO Y PULIDO PARA EL ADMINISTRADOR CON ÍTEMS FALLADOS EN ROJO */
                    <div className="w-full max-w-4xl bg-white dark:bg-[#11192e] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 md:p-6 flex flex-col gap-4">
                      
                      {/* ENCABEZADO OFICIAL DEL INFORME */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-[9px] uppercase tracking-wider rounded-md border border-indigo-500/20">
                              Informe de Auditoría a Ciegas
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-400">
                              Sesión #{activeSession.id}
                            </span>
                          </div>
                          <h2 className="text-sm md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mt-1">
                            Discrepancias y Cuadre de Inventario Físico
                          </h2>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Ubicación: <strong>{activeSession.store_name || 'Almacén Principal'}</strong> · Auditor Kiosco: <strong className="text-indigo-600 dark:text-indigo-400">{activeSession.auditor_name || activeSession.username}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowPrintReport(true)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                            title="Imprimir informe oficial"
                          >
                            <Printer size={14} />
                            <span>Imprimir / PDF</span>
                          </button>
                        </div>
                      </div>

                      {/* ALERTA VISUAL DESTACADA EN ROJO SI EXISTEN DISCREPANCIAS */}
                      {activeSummary.productsWithDiff > 0 ? (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                              <AlertTriangle size={18} />
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase">
                                🚨 {activeSummary.productsWithDiff} Artículos fallaron en el conteo físico
                              </h4>
                              <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                                Se detectaron diferencias cuantitativas entre el conteo a ciegas y el stock del sistema.
                              </p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-black uppercase rounded-lg shadow-xs shrink-0">
                            Revisión Urgente
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-2.5">
                          <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                          <div>
                            <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase">
                              ✓ 100% de Coincidencia Física
                            </h4>
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                              Todos los artículos contados a ciegas concuerdan exactamente con las existencias del sistema POS.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* TARJETAS KPI DE IMPACTO FINANCIERO Y DIFERENCIAS */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60">
                          <span className="text-[9px] font-black uppercase text-rose-600 dark:text-rose-400 block tracking-wider">
                            Fallaron en Conteo
                          </span>
                          <span className="text-lg md:text-xl font-mono font-black text-rose-600 dark:text-rose-400">
                            {activeSummary.productsWithDiff} u
                          </span>
                          <span className="text-[9px] text-rose-500 font-semibold block mt-0.5">
                            {activeSummary.productsWithDiff > 0 ? 'Con discrepancia' : 'Sin fallas'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60">
                          <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 block tracking-wider">
                            Exactos / Conformes
                          </span>
                          <span className="text-lg md:text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {activeSummary.exactItems.length}
                          </span>
                          <span className="text-[9px] text-emerald-500 font-semibold block mt-0.5">
                            {activeSummary.accuracyRate}% precisión
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                          <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">
                            Diferencia Neta
                          </span>
                          <span className={`text-lg md:text-xl font-mono font-black ${
                            activeSummary.totalDiscrepancyUnits === 0 
                              ? 'text-slate-700 dark:text-slate-300' 
                              : activeSummary.totalDiscrepancyUnits > 0 
                                ? 'text-amber-500' 
                                : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {activeSummary.totalDiscrepancyUnits > 0 ? `+${activeSummary.totalDiscrepancyUnits}` : activeSummary.totalDiscrepancyUnits} u
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">
                            Unidades físicas
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                          <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">
                            Impacto al Costo
                          </span>
                          <span className={`text-lg md:text-xl font-mono font-black ${
                            activeSummary.netCostImpact < 0 
                              ? 'text-rose-600 dark:text-rose-400' 
                              : activeSummary.netCostImpact > 0 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            Bs. {activeSummary.netCostImpact.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">
                            Costo estimado
                          </span>
                        </div>
                      </div>

                      {/* FILTROS DIRECTOS DEL INFORME: FALLADOS ACTIVADO POR DEFECTO */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                          <button
                            type="button"
                            onClick={() => setAdminReportFilter('fallidos')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                              adminReportFilter === 'fallidos'
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                                : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                            }`}
                          >
                            <AlertCircle size={14} />
                            <span>Fallaron en Conteo ({activeSummary.productsWithDiff})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAdminReportFilter('coincidentes')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                              adminReportFilter === 'coincidentes'
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                                : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
                            }`}
                          >
                            <CheckCircle size={14} />
                            <span>Coincidentes ({activeSummary.exactItems.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAdminReportFilter('todos')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                              adminReportFilter === 'todos'
                                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            <Layers size={14} />
                            <span>Todos ({activeSummary.totalItems})</span>
                          </button>
                        </div>

                        {activeSummary.productsWithDiff > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRecountIds(activeSummary.failedItems.map(it => it.id));
                              setShowRecountModal(true);
                            }}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1 shrink-0"
                            title="Solicitar al kiosco que vuelva a contar los artículos fallados"
                          >
                            <RotateCcw size={13} />
                            <span className="hidden sm:inline">Pedir</span> Reconteo ({activeSummary.productsWithDiff})
                          </button>
                        )}
                      </div>

                      {/* LISTADO DESTACADO DE ARTÍCULOS CON DISCREPANCIA (EN ROJO) */}
                      <div className="max-h-[360px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/80">
                        {adminReportItems.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-wide">
                            {adminReportFilter === 'fallidos' 
                              ? '✓ ¡Excelente! Ningún producto falló en el conteo físico.' 
                              : 'No hay artículos en esta categoría.'}
                          </div>
                        ) : (
                          adminReportItems.map(it => {
                            const sys = it.system_stock ?? it.live_stock ?? 0;
                            const physical = it.counted_stock ?? 0;
                            const diff = physical - sys;
                            const isFailed = diff !== 0;
                            const isSelectedForRecount = selectedRecountIds.includes(it.id);

                            return (
                              <div 
                                key={it.id} 
                                className={`p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors ${
                                  isFailed 
                                    ? 'bg-rose-50/70 dark:bg-rose-950/25 border-l-4 border-l-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40' 
                                    : 'bg-white dark:bg-[#11192e] border-l-4 border-l-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-850/30'
                                }`}
                              >
                                {/* Info del Producto */}
                                <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-mono font-bold text-slate-400">
                                      #{it.product_id}
                                    </span>
                                    {it.product_sku && (
                                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                        SKU: {it.product_sku}
                                      </span>
                                    )}
                                    {it.product_category && (
                                      <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                                        {it.product_category}
                                      </span>
                                    )}
                                    {it.recount_requested === 1 && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-500 text-white text-[9px] font-black uppercase">
                                        Reconteo en curso
                                      </span>
                                    )}
                                  </div>

                                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase leading-snug">
                                    {it.product_name}
                                  </h4>

                                  {isFailed && it.cost_impact !== undefined && (
                                    <div className="text-[10px] font-mono font-semibold text-rose-600 dark:text-rose-400">
                                      Impacto al Costo: Bs. {it.cost_impact.toFixed(2)} (Costo unit: Bs. {(it.price_cost || 0).toFixed(2)})
                                    </div>
                                  )}
                                </div>

                                {/* Comparativa: Stock POS vs Físico vs Diferencia */}
                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                                  
                                  <div className="flex items-center gap-2 font-mono text-xs">
                                    <div className="text-right">
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Stock POS</span>
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{sys} u</span>
                                    </div>

                                    <div className="text-right px-2 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Físico Kiosco</span>
                                      <span className="text-xs font-black text-slate-900 dark:text-white">{physical} u</span>
                                    </div>
                                  </div>

                                  {/* BADGE DE DIFERENCIA DESTACADO EN ROJO */}
                                  <div className="shrink-0 w-28 text-right">
                                    {isFailed ? (
                                      <span className={`inline-block px-2.5 py-1 text-xs font-black uppercase rounded-lg shadow-xs ${
                                        diff < 0 
                                          ? 'bg-rose-600 text-white' 
                                          : 'bg-amber-600 text-white'
                                      }`}>
                                        {diff < 0 ? `${diff} u (Faltante)` : `+${diff} u (Sobrante)`}
                                      </span>
                                    ) : (
                                      <span className="inline-block px-2.5 py-1 text-xs font-black uppercase rounded-lg bg-emerald-600 text-white shadow-xs">
                                        ✓ Exacto
                                      </span>
                                    )}
                                  </div>

                                  {/* Botón individual de reconteo para ítems fallados */}
                                  {isFailed && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRecountIds([it.id]);
                                        setShowRecountModal(true);
                                      }}
                                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-600 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                                      title="Solicitar reconteo individual de este producto"
                                    >
                                      <RotateCcw size={14} />
                                    </button>
                                  )}

                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* OBSERVACIONES DEL ADMINISTRADOR */}
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Observaciones de Conciliación / Justificación
                        </label>
                        <input
                          type="text"
                          value={adminNotes}
                          onChange={e => setAdminNotes(e.target.value)}
                          placeholder="Ej. Conforme con diferencias por merma / ajuste autorizado por gerencia..."
                          className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-[#151f32] text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* BOTONES DE DECISIÓN DEL ADMINISTRADOR */}
                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handleCancelSession}
                          className="w-full sm:w-auto px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase rounded-xl transition cursor-pointer"
                        >
                          Rechazar Conteo
                        </button>

                        <div className="flex-1" />

                        {activeSummary.productsWithDiff > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRecountIds(activeSummary.failedItems.map(it => it.id));
                              setShowRecountModal(true);
                            }}
                            className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw size={14} />
                            <span>Solicitar Reconteo de Ítems Fallidos</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleApproveCount}
                          disabled={isLoading}
                          className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl transition shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle size={15} />
                          <span>{isLoading ? 'Aplicando...' : 'Aprobar y Ajustar Stock en POS'}</span>
                        </button>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* CASO C: CONTEO FÍSICO ACTIVO (KIOSCO O ALMACÉN EN PROCESO) */}
              {activeSession && activeSession.status !== 'completado' && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  
                  {/* BARRA SUPERIOR DE BÚSQUEDA Y FILTROS */}
                  <div className="bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 px-3 py-2 shrink-0 flex flex-col gap-1.5 z-10">
                    
                    {/* Fila 1: Búsqueda rápida + Orden */}
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="text"
                          value={itemSearch}
                          onChange={e => setItemSearch(e.target.value)}
                          placeholder="Buscar por artículo, SKU, código de barra..."
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

                      {/* Selector de Orden en Vivo */}
                      <select
                        value={activeCountSort}
                        onChange={e => setActiveCountSort(e.target.value)}
                        className="max-w-[130px] p-1.5 text-[10px] font-bold bg-slate-50 dark:bg-[#151f32] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                        title="Cambiar orden de visualización de los artículos"
                      >
                        <option value="category_name">Orden: Categoría</option>
                        <option value="name_asc">Orden: A-Z</option>
                        <option value="sku">Orden: SKU</option>
                        <option value="stock_desc">Orden: Stock</option>
                      </select>

                      {/* Toggle Ocultar Stock 0 */}
                      <button
                        type="button"
                        onClick={() => setHideZeroStockInActive(!hideZeroStockInActive)}
                        className={`px-2 py-1.5 text-[10px] font-bold rounded-xl border transition cursor-pointer flex items-center gap-1 shrink-0 ${
                          hideZeroStockInActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}
                        title="Ocultar productos sin existencias en el POS"
                      >
                        <Filter size={11} />
                        <span className="hidden sm:inline">Sin Stock:</span> {hideZeroStockInActive ? 'Ocultos' : 'Visibles'}
                      </button>

                      {/* Botón rápido = Todo al POS solo para Administrador */}
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

                    {/* Fila 2: Chips de Categorías para salto rápido en pasillos */}
                    {activeSessionCategories.length > 1 && (
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                        <button
                          type="button"
                          onClick={() => setSelectedCategoryFilter('ALL')}
                          className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md transition whitespace-nowrap cursor-pointer ${
                            selectedCategoryFilter === 'ALL'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          Todas ({sessionItems.length})
                        </button>
                        {activeSessionCategories.map(c => {
                          const countInCat = sessionItems.filter(it => it.product_category === c).length;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setSelectedCategoryFilter(c)}
                              className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md transition whitespace-nowrap cursor-pointer ${
                                selectedCategoryFilter.toLowerCase() === c.toLowerCase()
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {c} ({countInCat})
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Fila 3: Chips de Filtro Estado */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
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

                  {/* LISTA DE ARTÍCULOS PARA CONTEO */}
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
                        const isRecountItem = it.recount_requested === 1;

                        return (
                          <div
                            key={it.id}
                            id={`item-count-${it.id}`}
                            className={`p-2.5 sm:p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 ${
                              isRecountItem
                                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-500 ring-1 ring-amber-500/50 shadow-sm'
                                : isChecked
                                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/50 shadow-xs'
                                  : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            {/* Información del Artículo */}
                            <div className="min-w-0 flex-1 flex flex-col gap-1">
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
                                {isRecountItem && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-black uppercase flex items-center gap-1">
                                    <RotateCcw size={10} />
                                    <span>Reconteo Solicitado</span>
                                  </span>
                                )}
                                {isChecked && (
                                  <span className="ml-auto sm:hidden px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase border border-emerald-500/20">
                                    ✓ Verificado
                                  </span>
                                )}
                              </div>
                              
                              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase leading-snug break-words whitespace-normal">
                                {it.product_name}
                              </h3>

                              {/* NOTA DE RECUENTO O DETALLES */}
                              {isRecountItem && it.notes && (
                                <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-100/50 dark:bg-amber-900/30 p-1 rounded">
                                  {it.notes}
                                </p>
                              )}

                              {/* Existencias POS (Solo si NO está en modo a ciegas sanitizado) */}
                              <div className="flex items-center gap-2.5 font-mono text-[10px] sm:text-xs">
                                {showStock ? (
                                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                                    Stock POS: <strong className="text-slate-900 dark:text-white font-bold">{sysStock} u</strong>
                                  </span>
                                ) : (
                                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-[10px]">
                                    Modo a Ciegas · Ingrese unidades físicas
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

                            {/* Controles de Conteo Físico Táctil */}
                            <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between sm:justify-end gap-1.5 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80">
                              
                              {/* Chips de Adición Rápida (+1, +5, +10) */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleQuickAdd(it, 1)}
                                  className="px-1.5 py-1 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                                  title="Sumar 1 unidad"
                                >
                                  +1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickAdd(it, 5)}
                                  className="px-1.5 py-1 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                                  title="Sumar 5 unidades"
                                >
                                  +5
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickAdd(it, 10)}
                                  className="px-1.5 py-1 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                                  title="Sumar 10 unidades"
                                >
                                  +10
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {/* Botón Rápido = POS (Solo visible si showStock) */}
                                {showStock && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetStockToSystem(it)}
                                    className={`px-2 py-1.5 rounded-xl text-[10px] font-black uppercase transition border cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
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
                                  className={`w-9 h-8 rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${
                                    isChecked
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-500 hover:text-white'
                                  }`}
                                  title={isChecked ? "Marcar como pendiente" : "Marcar como contado"}
                                >
                                  <Check size={18} className="stroke-[3]" />
                                </button>
                              </div>

                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* BARRA INFERIOR FIJA / ACCIONES */}
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
                      onClick={() => setConfirmCompleteModal(true)}
                      disabled={isLoading}
                      className={`flex-1 max-w-sm py-2 px-3 text-xs font-black uppercase rounded-xl transition flex items-center justify-center gap-1.5 shadow-md ${
                        activeSummary.pendingItems > 0
                          ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20 active:scale-98 cursor-pointer'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-98 cursor-pointer'
                      }`}
                    >
                      <CheckCircle size={14} className="shrink-0" />
                      <span className="truncate">
                        {activeSummary.pendingItems > 0
                          ? `Finalizar (${activeSummary.pendingItems} pendientes)`
                          : (isAdmin ? 'Finalizar y Conciliar' : 'Concluir y Enviar a Admin')}
                      </span>
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 2: HISTORIAL DE AUDITORÍAS */}
          {activeTab === 'historico' && (
            <div className="flex-1 overflow-y-auto p-3 md:p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs md:text-sm font-black text-slate-850 dark:text-white uppercase tracking-tight">
                  Historial de Auditorías Físicas
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  {historicalCounts.length} registros concluidos
                </span>
              </div>

              {historicalCounts.length === 0 ? (
                <div className="p-10 text-center text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-wide bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl my-auto">
                  No hay sesiones de auditoría física registradas en el historial.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
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
                        <span>Ver Informe Detallado</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* MODAL: CONFIRMAR FINALIZACIÓN DEL CONTEO */}
      {confirmCompleteModal && (
        <div className="fixed inset-0 z-[10500] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <CheckCircle size={22} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase">
                  {isAdmin ? '¿Finalizar y Conciliar Conteo?' : '¿Concluir Inventario a Ciegas?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAdmin 
                    ? 'Los ajustes de stock se aplicarán directamente a la base de datos.' 
                    : 'El informe será enviado inmediatamente a Administración con los resultados de las existencias físicas.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl flex items-center justify-around text-center">
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block">Contados</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{activeSummary.checkedItems}</span>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block">Pendientes</span>
                <span className={`text-base font-black ${activeSummary.pendingItems > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {activeSummary.pendingItems}
                </span>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block">Progreso</span>
                <span className="text-base font-black text-indigo-600 dark:text-indigo-400">{activeSummary.completedPercent}%</span>
              </div>
            </div>

            {activeSummary.pendingItems > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg font-medium leading-tight">
                Nota: Tienes {activeSummary.pendingItems} productos sin verificar. Si continúas, se enviará el conteo con el estado actual.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmCompleteModal(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl transition cursor-pointer"
              >
                Seguir Contando
              </button>
              <button
                type="button"
                onClick={handleCompleteSession}
                className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase rounded-xl transition shadow-md cursor-pointer"
              >
                Confirmar y Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SOLICITAR RECONTEO AL KIOSCO */}
      {showRecountModal && (
        <div className="fixed inset-0 z-[10500] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase">
                  Solicitar Reconteo Físico
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  La sesión volverá a estar activa para que el auditor/kiosco cuente nuevamente los artículos observados.
                </p>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Instrucciones para el Auditor de Kiosco
              </label>
              <textarea
                value={recountInstruction}
                onChange={e => setRecountInstruction(e.target.value)}
                rows={3}
                className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-[#151f32] text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                placeholder="Indique qué anaquel o lote verificar..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowRecountModal(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRequestRecount}
                className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase rounded-xl transition shadow-md cursor-pointer"
              >
                Enviar a Reconteo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE HISTÓRICO CON COMPARATIVA Y DISCREPANCIAS */}
      {selectedHistoricCount && (
        <div className="fixed inset-0 z-[11000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh]">
            
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase">
                    Auditoría #{selectedHistoricCount.id}
                  </span>
                  <span className="px-2 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase border border-emerald-500/20">
                    {selectedHistoricCount.status}
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase mt-0.5">
                  {selectedHistoricCount.store_name || 'Almacén Principal'} · Auditor: {selectedHistoricCount.auditor_name || selectedHistoricCount.username}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoricCount(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Resumen Histórico */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-black/30 p-2.5 rounded-xl text-center">
              <div>
                <span className="text-[8px] font-black uppercase text-slate-400 block">Total Ítems</span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-white">{historicSummary.totalItems}</span>
              </div>
              <div>
                <span className="text-[8px] font-black uppercase text-slate-400 block">Con Discrepancia</span>
                <span className="text-xs font-mono font-bold text-rose-500">{historicSummary.productsWithDiff}</span>
              </div>
              <div>
                <span className="text-[8px] font-black uppercase text-slate-400 block">Dif. Neta</span>
                <span className={`text-xs font-mono font-bold ${historicSummary.totalDiscrepancyUnits >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>
                  {historicSummary.totalDiscrepancyUnits > 0 ? `+${historicSummary.totalDiscrepancyUnits}` : historicSummary.totalDiscrepancyUnits} u
                </span>
              </div>
            </div>

            {/* Filtros dentro del Histórico */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setHistoricReportFilter('fallidos')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
                  historicReportFilter === 'fallidos' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}
              >
                Discrepancias ({historicSummary.productsWithDiff})
              </button>
              <button
                type="button"
                onClick={() => setHistoricReportFilter('coincidentes')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
                  historicReportFilter === 'coincidentes' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}
              >
                Coincidentes ({historicSummary.exactItems.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoricReportFilter('todos')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
                  historicReportFilter === 'todos' ? 'bg-slate-800 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}
              >
                Todos ({historicSummary.totalItems})
              </button>
            </div>

            {/* Listado de ítems históricos */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
              {historicReportItems.map(it => {
                const sys = it.system_stock ?? it.live_stock ?? 0;
                const physical = it.counted_stock ?? 0;
                const diff = physical - sys;
                const isFailed = diff !== 0;

                return (
                  <div key={it.id} className={`p-2.5 flex items-center justify-between text-xs gap-2 ${
                    isFailed ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''
                  }`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-850 dark:text-white uppercase truncate text-xs">{it.product_name}</div>
                      <div className="text-[9px] text-slate-400 font-mono">SKU: {it.product_sku}</div>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs shrink-0">
                      <span className="text-[10px] text-slate-500">POS: <strong>{sys}</strong></span>
                      <span className="text-[10px] font-bold text-slate-800 dark:text-white px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        Físico: {physical}
                      </span>
                      <span className={`font-black text-xs w-20 text-right ${
                        diff === 0 ? 'text-emerald-500' : diff > 0 ? 'text-amber-500' : 'text-rose-600'
                      }`}>
                        {diff === 0 ? '0 u' : diff > 0 ? `+${diff} u` : `${diff} u`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setSelectedHistoricCount(null)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl cursor-pointer"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}

      {/* MODAL PARA IMPRESIÓN DEL INFORME DE DISCREPANCIAS */}
      {showPrintReport && (
        <div className="fixed inset-0 z-[12000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            
            {/* Cabecera Imprimible */}
            <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">GTR POS - ACTA OFICIAL DE CONTROL FÍSICO</h2>
                <p className="text-xs text-slate-600">
                  Informe de Auditoría Física a Ciegas y Conciliación de Existencias
                </p>
              </div>
              <div className="text-right text-xs font-mono">
                <div>Fecha: {new Date().toLocaleDateString()}</div>
                <div>Hora: {new Date().toLocaleTimeString()}</div>
              </div>
            </div>

            {/* Metadatos */}
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-3 rounded-lg text-xs">
              <div><strong>Almacén:</strong> {activeSession?.store_name || 'Almacén Principal'}</div>
              <div><strong>Auditor Kiosco:</strong> {activeSession?.auditor_name || activeSession?.username}</div>
              <div><strong>Sesión ID:</strong> #{activeSession?.id}</div>
            </div>

            {/* Tabla de Discrepancias Destacada */}
            <div>
              <h4 className="text-xs font-black uppercase text-rose-700 mb-1.5 flex items-center gap-1">
                🚨 Detalle de Artículos con Discrepancias Físicas
              </h4>
              <table className="w-full text-left text-xs border border-slate-300 divide-y divide-slate-300">
                <thead className="bg-slate-200 text-[10px] font-black uppercase">
                  <tr>
                    <th className="p-1.5">Producto</th>
                    <th className="p-1.5">SKU</th>
                    <th className="p-1.5 text-center">Stock Sistema</th>
                    <th className="p-1.5 text-center">Conteo Físico</th>
                    <th className="p-1.5 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {activeSummary.failedItems.map(it => {
                    const sys = it.system_stock ?? it.live_stock ?? 0;
                    const physical = it.counted_stock ?? 0;
                    const diff = physical - sys;
                    return (
                      <tr key={it.id} className="bg-rose-50/50">
                        <td className="p-1.5 font-bold font-sans">{it.product_name}</td>
                        <td className="p-1.5 text-slate-500">{it.product_sku}</td>
                        <td className="p-1.5 text-center">{sys} u</td>
                        <td className="p-1.5 text-center font-bold">{physical} u</td>
                        <td className="p-1.5 text-right font-black text-rose-700">
                          {diff < 0 ? `${diff} u (Faltante)` : `+${diff} u (Sobrante)`}
                        </td>
                      </tr>
                    );
                  })}
                  {activeSummary.failedItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500 font-sans">
                        ✓ No se registraron diferencias físicas en el inventario.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Firmas de Conformidad */}
            <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
              <div className="border-t border-slate-400 pt-2">
                <strong>Firma Auditor de Kiosco</strong>
                <p className="text-[10px] text-slate-500">{activeSession?.auditor_name || activeSession?.username}</p>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <strong>Firma y Sello de Administración</strong>
                <p className="text-[10px] text-slate-500">{user?.username || 'Administrador General'}</p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowPrintReport(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 font-bold text-xs uppercase rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 text-white font-black text-xs uppercase rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Imprimir / Guardar PDF</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
