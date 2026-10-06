import React, { useState, useEffect, useMemo, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { useAppContext } from '../context/AppContext';
import { safeDispatchEvent } from '../utils/events';
import { hasPermission } from '../utils/permissions';
import { 
  ClipboardCheck, CheckCircle, AlertTriangle, Play, X, 
  Eye, RefreshCw, Search, Check, ChevronLeft, 
  ShieldCheck, FileText, Zap, History, ListCheck, CheckCheck,
  Package, AlertCircle, Download, Printer
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
  had_movements_during_count?: number;
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
  const [isBlindMode, setIsBlindMode] = useState<boolean>(!isAdmin && !canPreviewQuantities ? true : true);
  const [sessionNotes, setSessionNotes] = useState<string>('');

  // Sincronizar forzado de modo a ciegas para operadores sin permisos de previsualización
  useEffect(() => {
    if (!canPreviewQuantities && !isBlindMode) {
      setIsBlindMode(true);
    }
  }, [canPreviewQuantities, isBlindMode]);

  // Advertencia de segregación de funciones (solo relevante si el usuario intenta hacer conteo con visibilidad STANDARD)
  const [overrideSegregation, setOverrideSegregation] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [segregationWarning, setSegregationWarning] = useState<string | null>(null);
  const [isSessionSanitized, setIsSessionSanitized] = useState<boolean>(false);

  // Modo a ciegas activo de forma estricta (no revela stock al personal/kiosco ni al admin si la sesión es BLIND)
  const isBlindActive = activeSession?.mode === 'BLIND' || !isAdmin || isSessionSanitized || externalViewMode === 'blind';

  // Filtros del listado de conteo activo
  const [itemSearch, setItemSearch] = useState('');
  const itemDebounceRef = useRef<Record<number, any>>({});
  const [activeFilter, setActiveFilter] = useState<'todos' | 'pendientes' | 'revisados' | 'diferencias' | 'reconteo'>('todos');
  const [adminReviewFilter, setAdminReviewFilter] = useState<'todos' | 'diferencias' | 'coincidentes'>('todos');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [stockSection, setStockSection] = useState<'with_stock' | 'zero_stock'>('with_stock');
  const [historicStockFilter, setHistoricStockFilter] = useState<'all' | 'with_stock' | 'zero_stock' | 'diferencias' | 'coincidentes'>('all');
  const [selectedRecountIds, setSelectedRecountIds] = useState<number[]>([]);

  // Sincronizar automáticamente selección de reconteo con los artículos que tienen diferencias
  useEffect(() => {
    if (activeSession && (activeSession.status === 'completado' || activeSession.status === 'finalizado')) {
      const diffIds = sessionItems
        .filter(it => it.counted_stock !== (it.system_stock ?? it.live_stock ?? 0))
        .map(it => it.id);
      setSelectedRecountIds(diffIds);
    }
  }, [activeSession?.id, activeSession?.status, sessionItems.length]);

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

  // Validar segregación de funciones (solo relevante si el usuario intenta hacer conteo con visibilidad STANDARD)
  useEffect(() => {
    if (!isAdmin && !isBlindMode && user?.username && auditorName) {
      const isOperatorSelfAuditing = auditorName.toLowerCase().trim().includes(user.username.toLowerCase().trim()) || auditorName.toLowerCase().includes('cajero');
      if (isOperatorSelfAuditing && !overrideSegregation) {
        setSegregationWarning("Advertencia de Segregación: Se requiere confirmación para auto-auditoría con existencias visibles.");
      } else {
        setSegregationWarning(null);
      }
    } else {
      setSegregationWarning(null);
    }
  }, [auditorName, user, overrideSegregation, isAdmin, isBlindMode]);

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
        if (!isHistoric) {
          setIsSessionSanitized(isSanitized);
        }

        const mapItems = (items: any[]) => items.map(it => {
          const prodObj = products?.find(p => p.id === it.product_id);
          const physicalQty = it.physical_quantity ?? 0;
          const isChecked = (it.status !== 'pendiente' && it.status !== 'requiere_revision' && !it.recount_requested) ? 1 : 0;

          if (isSanitized) {
            return {
              ...it,
              product_name: prodObj?.name || it.product_name,
              product_sku: prodObj?.sku || it.product_sku || 'N/A',
              product_category: prodObj?.category || it.product_category || 'General',
              system_stock: undefined,
              live_stock: undefined,
              counted_stock: physicalQty,
              difference: undefined,
              is_checked: isChecked,
              status: it.status || 'pendiente'
            };
          }

          const liveStock = prodObj?.stock !== undefined ? prodObj.stock : (it.live_stock ?? it.expected_quantity ?? 0);
          const diff = physicalQty - liveStock;

          return {
            ...it,
            product_name: prodObj?.name || it.product_name,
            product_sku: prodObj?.sku || it.product_sku || 'N/A',
            product_category: prodObj?.category || it.product_category || 'General',
            system_stock: liveStock,
            live_stock: liveStock,
            counted_stock: physicalQty,
            difference: diff,
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
      const finalBlind = !canPreviewQuantities ? true : isBlindMode;
      const payload = {
        user_id: user?.id || 1,
        username: user?.username || 'admin',
        auditor_name: auditorName.trim(),
        store_name: storeName.trim(),
        notes: sessionNotes || `Control Físico de Almacén${finalBlind ? ' a Ciegas' : ''}`,
        category_filter: selectedCategory === 'Todos' ? null : selectedCategory,
        mode: finalBlind ? 'BLIND' : 'STANDARD',
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

  const handleUpdateItem = (itemId: number, updatedFields: { counted_stock?: number; is_checked?: number; status?: string; notes?: string }, immediate = false) => {
    if (!activeSession) return;
    const item = sessionItems.find(it => it.id === itemId);
    if (!item) return;

    const newStock = updatedFields.counted_stock !== undefined ? Math.max(0, updatedFields.counted_stock) : item.counted_stock;
    const nextChecked = updatedFields.is_checked !== undefined ? updatedFields.is_checked : item.is_checked;
    const nextStatus = updatedFields.status !== undefined ? updatedFields.status : (nextChecked === 0 ? 'pendiente' : 'contado');

    const diff = item.system_stock !== undefined ? newStock - item.system_stock : undefined;

    // Actualización optimista inmediata en interfaz
    setSessionItems(prev => prev.map(it => it.id === itemId ? { 
      ...it, 
      counted_stock: newStock,
      is_checked: nextChecked,
      status: nextStatus,
      difference: diff,
      recount_requested: 0,
      notes: updatedFields.notes !== undefined ? updatedFields.notes : it.notes
    } : it));

    if (itemDebounceRef.current[itemId]) {
      clearTimeout(itemDebounceRef.current[itemId]);
    }

    const sendRequest = async () => {
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

    if (immediate) {
      sendRequest();
    } else {
      itemDebounceRef.current[itemId] = setTimeout(sendRequest, 250);
    }
  };

  const handleToggleCheck = async (item: CountItem) => {
    const isChecked = item.is_checked === 1;
    if (isChecked) {
      handleUpdateItem(item.id, { is_checked: 0, status: 'pendiente' }, true);
    } else {
      const currentCount = item.counted_stock ?? 0;
      handleUpdateItem(item.id, { counted_stock: currentCount, is_checked: 1, status: 'contado' }, true);
    }
  };

  const handleSetStockToSystem = async (item: CountItem) => {
    if (item.system_stock === undefined || isBlindActive) return;
    handleUpdateItem(item.id, { counted_stock: item.system_stock, is_checked: 1, status: 'contado' }, true);
  };

  const handleMatchAllPending = async () => {
    if (isBlindActive || !activeSummary.hasAdminVisibility) return;
    const targetItems = stockSection === 'with_stock' ? itemsWithStock : currentSectionItems;
    const pending = targetItems.filter(it => it.is_checked === 0);
    if (pending.length === 0) {
      showNotification?.("No hay productos pendientes por verificar en esta sección.", "info");
      return;
    }
    if (!confirm(`¿Deseas marcar los ${pending.length} productos pendientes con la cantidad exacta que figura en el POS?`)) return;
    
    setIsLoading(true);
    for (const item of pending) {
      if (item.system_stock !== undefined) {
        handleUpdateItem(item.id, { counted_stock: item.system_stock, is_checked: 1, status: 'contado' }, true);
      }
    }
    setIsLoading(false);
    showNotification?.("✓ Todos los productos pendientes de esta sección han sido verificados con el stock del sistema.", "success");
  };

  const handleCompleteSession = async () => {
    if (!activeSession) return;

    let uncountedAction = 'omit';
    const uncounted = sessionItems.filter(it => it.is_checked === 0);
    if (uncounted.length > 0) {
      const countedCount = sessionItems.length - uncounted.length;
      const confirmSend = confirm(
        `📋 Resumen de Conteo Físico:\n\n` +
        `• Artículos contados: ${countedCount} de ${sessionItems.length}\n` +
        `• Artículos no contados: ${uncounted.length}\n\n` +
        `¿Deseas enviar el reporte con solo los ${countedCount} artículos contados?\n\n` +
        `✓ [Aceptar]: Los artículos no contados mantendrán su stock actual del sistema sin generar faltantes falsos.\n` +
        `✕ [Cancelar]: Continuar contando en tienda.`
      );
      if (!confirmSend) {
        return;
      }
      uncountedAction = 'omit';
    }

    setIsLoading(true);
    try {
      // Si estamos en modo visible para admin, auto-confirmar productos de stock 0 sin movimiento
      if (activeSummary.hasAdminVisibility && !isBlindActive) {
        const uncountedZeroItems = sessionItems.filter(it => (it.system_stock ?? 0) <= 0 && it.is_checked === 0);
        for (const zItem of uncountedZeroItems) {
          handleUpdateItem(zItem.id, { counted_stock: 0, is_checked: 1, status: 'contado' }, true);
        }
      }

      const res = await fetch(`/api/inventory-counts/${activeSession.id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': user?.role || ''
        },
        body: JSON.stringify({ 
          status: 'completado',
          auto_apply: false, // NUNCA auto-aplicar al enviar; la aprobación debe ser explícita
          uncounted_action: uncountedAction
        })
      });

      if (res.ok) {
        showNotification?.(
          isAdmin 
            ? "✓ Conteo físico completado. Revisa las diferencias antes de conciliar."
            : "✓ Conteo físico finalizado. Reporte enviado a Administración sin discrepancias artificiales.", 
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

  const handleRequestRecount = async () => {
    if (!activeSession) return;
    const discrepancyItems = sessionItems.filter(it => it.counted_stock !== (it.system_stock ?? it.live_stock ?? 0));
    const targetIds = selectedRecountIds.length > 0 
      ? selectedRecountIds 
      : discrepancyItems.map(it => it.id);

    if (targetIds.length === 0) {
      showNotification?.("Selecciona al menos un producto para solicitar reconteo.", "info");
      return;
    }

    if (!confirm(`¿Solicitar reconteo físico de los ${targetIds.length} productos seleccionados? La sesión volverá a estar disponible para el personal con aviso de verificación.`)) {
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
          reason: 'Diferencia detectada en revisión administrativa'
        })
      });

      if (res.ok) {
        showNotification?.(`✓ Reconteo solicitado para ${targetIds.length} artículos. Sesión reabierta para el personal.`, "success");
        await fetchActiveSession();
        safeDispatchEvent('inventory_operation', {
          detail: {
            type: 'recount_requested',
            id: activeSession.id,
            user: user?.username || 'admin',
            timestamp: new Date().toISOString()
          }
        });
      } else {
        const err = await res.json();
        showNotification?.(`Error al solicitar reconteo: ${err.error || 'Error desconocido'}`, "error");
      }
    } catch (e: any) {
      console.error(e);
      showNotification?.("Error de conexión al solicitar reconteo.", "error");
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
        showNotification?.("Sesión de auditoría cancelada e inventario liberado.", "info");
        setActiveSession(null);
        setSessionItems([]);
        await fetchActiveSession();
        await fetchHistory();
        await fetchProducts();

        safeDispatchEvent('inventory_operation', {
          detail: {
            type: 'physical_count_cancelled',
            id: activeSession.id,
            user: user?.username || 'admin',
            timestamp: new Date().toISOString()
          }
        });
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

  const exportCountToPDF = (count: InventoryCount, items: CountItem[]) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;

      // Header Banner
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(10, y, pageWidth - 20, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text("INFORME DE CONTROL FÍSICO DE INVENTARIO", 15, y + 9);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Folio Auditoría: #${count.id} | Modo: ${count.mode === 'BLIND' ? 'Auditoría a Ciegas' : 'Auditoría Visible'}`, 15, y + 16);
      doc.text(`Fecha Emisión: ${new Date().toLocaleString()}`, pageWidth - 15, y + 16, { align: 'right' });

      y += 29;

      // Metadata Grid Box
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(10, y, pageWidth - 20, 27, 2, 2, 'FD');

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');

      doc.text("Almacén / Sucursal:", 14, y + 6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(count.store_name || "Almacén Principal", 55, y + 6.5);

      doc.setFont('helvetica', 'bold');
      doc.text("Auditor Operativo:", 14, y + 12.5);
      doc.setFont('helvetica', 'normal');
      doc.text(count.auditor_name || count.username || "Personal Almacén", 55, y + 12.5);

      doc.setFont('helvetica', 'bold');
      doc.text("Supervisor Aprobador:", 14, y + 18.5);
      doc.setFont('helvetica', 'normal');
      doc.text(count.approved_by_username || "Administrador", 55, y + 18.5);

      doc.setFont('helvetica', 'bold');
      doc.text("Fecha Inicio:", 115, y + 6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(count.started_at || count.created_at).toLocaleString(), 145, y + 6.5);

      doc.setFont('helvetica', 'bold');
      doc.text("Fecha Cierre:", 115, y + 12.5);
      doc.setFont('helvetica', 'normal');
      doc.text(count.completed_at || count.approved_at ? new Date(count.completed_at || count.approved_at!).toLocaleString() : 'En Proceso', 145, y + 12.5);

      doc.setFont('helvetica', 'bold');
      doc.text("Estado Final:", 115, y + 18.5);
      doc.setFont('helvetica', 'normal');
      doc.text((count.status === 'cerrado' || count.status === 'aprobado' ? 'CONCILIADO Y CERRADO' : count.status.toUpperCase()), 145, y + 18.5);

      y += 32;

      // Executive Summary Metrics Box
      const total = items.length;
      const correct = items.filter(it => it.counted_stock === (it.system_stock ?? it.live_stock ?? 0)).length;
      const withDiff = items.filter(it => it.counted_stock !== (it.system_stock ?? it.live_stock ?? 0)).length;
      const netUnits = items.reduce((sum, it) => sum + ((it.counted_stock ?? 0) - (it.system_stock ?? it.live_stock ?? 0)), 0);

      doc.setFillColor(241, 245, 249);
      doc.rect(10, y, pageWidth - 20, 12, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);

      const colW = (pageWidth - 20) / 4;
      doc.text(`Total Productos: ${total}`, 10 + colW * 0.2, y + 7.5);
      doc.setTextColor(16, 185, 129); // green
      doc.text(`Coincidentes: ${correct}`, 10 + colW * 1.2, y + 7.5);
      doc.setTextColor(withDiff > 0 ? 225 : 100, withDiff > 0 ? 29 : 116, withDiff > 0 ? 72 : 139);
      doc.text(`Con Diferencias: ${withDiff}`, 10 + colW * 2.2, y + 7.5);
      doc.setTextColor(netUnits < 0 ? 225 : 79, netUnits < 0 ? 29 : 70, netUnits < 0 ? 72 : 229);
      doc.text(`Dif. Neta: ${netUnits > 0 ? '+' : ''}${netUnits} u`, 10 + colW * 3.2, y + 7.5);

      y += 18;

      // Table Header
      doc.setFillColor(71, 85, 105);
      doc.rect(10, y, pageWidth - 20, 6.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');

      doc.text("SKU", 12, y + 4.5);
      doc.text("DESCRIPCIÓN DEL ARTÍCULO", 42, y + 4.5);
      doc.text("POS", 125, y + 4.5, { align: 'right' });
      doc.text("FÍSICO", 147, y + 4.5, { align: 'right' });
      doc.text("DIFERENCIA", 172, y + 4.5, { align: 'right' });
      doc.text("ESTADO", 195, y + 4.5, { align: 'right' });

      y += 6.5;

      // Table Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const sys = it.system_stock ?? it.live_stock ?? 0;
        const physical = it.counted_stock ?? 0;
        const diff = physical - sys;

        if (y > 275) {
          doc.addPage();
          y = 15;
          doc.setFillColor(71, 85, 105);
          doc.rect(10, y, pageWidth - 20, 6.5, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          doc.text("SKU", 12, y + 4.5);
          doc.text("DESCRIPCIÓN DEL ARTÍCULO", 42, y + 4.5);
          doc.text("POS", 125, y + 4.5, { align: 'right' });
          doc.text("FÍSICO", 147, y + 4.5, { align: 'right' });
          doc.text("DIFERENCIA", 172, y + 4.5, { align: 'right' });
          doc.text("ESTADO", 195, y + 4.5, { align: 'right' });
          y += 6.5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
        }

        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(10, y, pageWidth - 20, 5.5, 'F');
        }

        doc.setTextColor(71, 85, 105);
        doc.text(String(it.product_sku || '-').substring(0, 14), 12, y + 3.8);

        const truncName = String(it.product_name || 'Sin Nombre').substring(0, 48);
        doc.text(truncName, 42, y + 3.8);

        doc.text(String(sys), 125, y + 3.8, { align: 'right' });
        doc.text(String(physical), 147, y + 3.8, { align: 'right' });

        if (diff === 0) {
          doc.setTextColor(16, 185, 129);
          doc.text("0 u", 172, y + 3.8, { align: 'right' });
          doc.text("COINCIDE", 195, y + 3.8, { align: 'right' });
        } else if (diff > 0) {
          doc.setTextColor(79, 70, 229);
          doc.text(`+${diff} u`, 172, y + 3.8, { align: 'right' });
          doc.text("SOBRANTE", 195, y + 3.8, { align: 'right' });
        } else {
          doc.setTextColor(225, 29, 72);
          doc.text(`${diff} u`, 172, y + 3.8, { align: 'right' });
          doc.text("FALTANTE", 195, y + 3.8, { align: 'right' });
        }

        y += 5.5;
      }

      // Footer sign off
      if (y > 250) {
        doc.addPage();
        y = 20;
      } else {
        y += 12;
      }

      doc.setDrawColor(203, 213, 225);
      doc.line(20, y + 15, 80, y + 15);
      doc.line(pageWidth - 80, y + 15, pageWidth - 20, y + 15);

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Firma Auditor Responsable", 50, y + 20, { align: 'center' });
      doc.text("Firma Administración / Visto Bueno", pageWidth - 50, y + 20, { align: 'center' });

      doc.save(`auditoria_inventario_${count.id}_${new Date().toISOString().slice(0, 10)}.pdf`);
      showNotification?.("✓ Informe PDF de auditoría descargado.", "success");
    } catch (e: any) {
      console.error("PDF Export Error:", e);
      showNotification?.("Error al exportar PDF de auditoría.", "error");
    }
  };

  const exportCountToCsv = (count: InventoryCount, items: CountItem[]) => {
    try {
      const headers = [
        "Folio Conteo",
        "Almacén",
        "ID Producto",
        "Nombre Producto",
        "SKU",
        "Categoría",
        "Stock POS (Snapshot)",
        "Conteo Físico",
        "Diferencia",
        "Estado",
        "Reconteo",
        "Movimiento Durante Conteo"
      ];

      const rows = items.map(it => {
        const sys = it.system_stock ?? it.live_stock ?? 0;
        const physical = it.counted_stock ?? 0;
        const diff = physical - sys;
        return [
          count.id,
          `"${(count.store_name || 'Almacén Principal').replace(/"/g, '""')}"`,
          it.product_id,
          `"${(it.product_name || '').replace(/"/g, '""')}"`,
          `"${(it.product_sku || '').replace(/"/g, '""')}"`,
          `"${(it.product_category || '').replace(/"/g, '""')}"`,
          sys,
          physical,
          diff,
          diff === 0 ? "COINCIDE" : diff > 0 ? "SOBRANTE" : "FALTANTE",
          it.recount_requested ? "SI" : "NO",
          it.had_movements_during_count ? "SI" : "NO"
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `auditoria_inventario_${count.id}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification?.("✓ Archivo CSV de auditoría descargado.", "success");
    } catch (e: any) {
      console.error("CSV Export Error:", e);
      showNotification?.("Error al exportar CSV.", "error");
    }
  };

  // Resumen y métricas
  const getDiscrepancySummary = (itemsList: CountItem[]) => {
    const totalItems = itemsList.length;
    const checkedItems = itemsList.filter(it => it.is_checked === 1 && it.status !== 'requiere_revision' && !it.recount_requested).length;
    
    // Visibilidad de stock teórico: en revisión administrativa o completada siempre es visible para auditar
    const isReviewMode = activeSession?.status === 'completado' || activeSession?.status === 'en_revision' || activeSession?.status === 'finalizado';
    const itemsWithSysStock = itemsList.filter(it => it.system_stock !== undefined || it.live_stock !== undefined);
    const hasAdminVisibility = itemsWithSysStock.length > 0 && (isAdmin || isReviewMode || !isBlindActive);

    const pendingItems = itemsList.filter(it => 
      ((it.system_stock ?? it.live_stock ?? 0) > 0 && (it.is_checked === 0 || it.status === 'pendiente')) || 
      it.status === 'requiere_revision' || 
      Boolean(it.recount_requested)
    ).length;

    // Conteo exacto de productos con diferencia física vs teórica (idéntico a la lógica de reviewItems)
    const productsWithDiff = hasAdminVisibility 
      ? itemsList.filter(it => {
          if (it.status === 'omitido') return false;
          const sys = it.system_stock ?? it.live_stock ?? 0;
          const physical = it.counted_stock ?? 0;
          return physical !== sys;
        }).length
      : 0;

    const totalSystemStock = hasAdminVisibility
      ? itemsList.reduce((sum, it) => sum + (it.system_stock ?? it.live_stock ?? 0), 0)
      : 0;

    const totalCountedStock = itemsList.reduce((sum, it) => sum + (it.counted_stock ?? 0), 0);
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

  const activeSummary = useMemo(() => getDiscrepancySummary(sessionItems), [sessionItems, isBlindActive]);

  const recountItemsCount = useMemo(() => {
    return sessionItems.filter(it => it.recount_requested === 1 || it.status === 'requiere_revision').length;
  }, [sessionItems]);

  // Separación clara de productos: Con existencias (>0) vs Apartado Especial Stock 0 (<=0)
  // En MODO BLIND: NO SE SEPARA, para no revelar la existencia teórica al auditor
  const { itemsWithStock, itemsZeroStock } = useMemo(() => {
    const withStock: CountItem[] = [];
    const zeroStock: CountItem[] = [];
    for (const it of sessionItems) {
      const stock = it.system_stock;
      if (stock !== undefined && stock > 0) {
        withStock.push(it);
      } else {
        zeroStock.push(it);
      }
    }
    return { itemsWithStock: withStock, itemsZeroStock: zeroStock };
  }, [sessionItems]);

  // Selección de la lista a mostrar según el apartado activo (en BLIND siempre es la lista completa)
  const currentSectionItems = (isBlindActive || !activeSummary.hasAdminVisibility) 
    ? sessionItems 
    : (stockSection === 'with_stock' ? itemsWithStock : itemsZeroStock);

  // Lista de categorías únicas presentes en la sección activa
  const activeSessionCategories = useMemo(() => {
    const cats = new Set<string>();
    currentSectionItems.forEach(it => {
      if (it.product_category) cats.add(it.product_category);
    });
    return Array.from(cats);
  }, [currentSectionItems]);

  // Filtrado de productos en sesión activa
  const filteredItems = useMemo(() => {
    return currentSectionItems.filter(it => {
      const cleanQuery = itemSearch.toLowerCase().replace(/^#/, '').trim();
      const searchTerms = cleanQuery.split(/\s+/).filter(Boolean);
      const searchableText = `${it.product_id || ''} ${(it.product_name || '').toLowerCase()} ${(it.product_sku || '').toLowerCase()} ${(it.product_category || '').toLowerCase()}`;
      const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => searchableText.includes(term));
      
      let matchesFilter = true;
      if (activeFilter === 'pendientes') {
        matchesFilter = it.is_checked === 0;
      } else if (activeFilter === 'revisados') {
        matchesFilter = it.is_checked === 1;
      } else if (activeFilter === 'reconteo') {
        matchesFilter = it.recount_requested === 1 || it.status === 'requiere_revision';
      } else if (activeFilter === 'diferencias' && activeSummary.hasAdminVisibility && !isBlindActive) {
        matchesFilter = it.is_checked === 1 && it.system_stock !== undefined && it.counted_stock !== it.system_stock;
      }

      const matchesCategory = selectedCategoryFilter === 'ALL' || (it.product_category && it.product_category.toLowerCase() === selectedCategoryFilter.toLowerCase());

      return matchesSearch && matchesFilter && matchesCategory;
    });
  }, [currentSectionItems, itemSearch, activeFilter, selectedCategoryFilter, activeSummary.hasAdminVisibility, isBlindActive]);

  // Detección cruzada: si se busca y el producto está en el otro apartado
  const crossSectionMatchesCount = useMemo(() => {
    if (isBlindActive || !activeSummary.hasAdminVisibility) return 0;
    if (!itemSearch.trim()) return 0;
    const oppositeItems = stockSection === 'with_stock' ? itemsZeroStock : itemsWithStock;
    const cleanQuery = itemSearch.toLowerCase().replace(/^#/, '').trim();
    const searchTerms = cleanQuery.split(/\s+/).filter(Boolean);
    return oppositeItems.filter(it => {
      const searchableText = `${it.product_id || ''} ${(it.product_name || '').toLowerCase()} ${(it.product_sku || '').toLowerCase()} ${(it.product_category || '').toLowerCase()}`;
      return searchTerms.length > 0 && searchTerms.every(term => searchableText.includes(term));
    }).length;
  }, [itemSearch, stockSection, itemsWithStock, itemsZeroStock, isBlindActive, activeSummary.hasAdminVisibility]);

  // Lista de artículos para la revisión del Administrador según el filtro seleccionado
  const reviewItems = useMemo(() => {
    if (adminReviewFilter === 'diferencias') {
      return sessionItems.filter(it => it.status !== 'omitido' && it.counted_stock !== (it.system_stock ?? it.live_stock ?? 0));
    }
    if (adminReviewFilter === 'coincidentes') {
      return sessionItems.filter(it => it.status !== 'omitido' && it.counted_stock === (it.system_stock ?? it.live_stock ?? 0));
    }
    return sessionItems;
  }, [sessionItems, adminReviewFilter]);

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
                            disabled={!canPreviewQuantities}
                            onClick={() => {
                              if (canPreviewQuantities) setIsBlindMode(false);
                            }}
                            className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition ${
                              !canPreviewQuantities
                                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-[#121a2b] border-slate-200 dark:border-slate-800 text-slate-400'
                                : !isBlindMode
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/30 cursor-pointer'
                                : 'bg-slate-50 dark:bg-[#151f32] border-slate-200 dark:border-slate-800 text-slate-500 cursor-pointer'
                            }`}
                            title={!canPreviewQuantities ? "Deshabilitado: Requiere permisos de administrador o previsualización de stock" : "Ver stock esperado del sistema durante el conteo"}
                          >
                            <span className="text-xs font-black uppercase flex items-center gap-1.5">
                              <Eye size={12} className={canPreviewQuantities ? "text-emerald-500" : "text-slate-400"} />
                              Visible (Con Control)
                            </span>
                            <span className="text-[9px] font-medium opacity-80 leading-tight">
                              {!canPreviewQuantities ? 'Deshabilitado para este usuario' : 'Muestra el stock del sistema'}
                            </span>
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
                            <span className="text-[9px] font-medium opacity-80 leading-tight">Oculta existencias (Permitido)</span>
                          </button>
                        </div>
                        {!canPreviewQuantities && (
                          <div className="mt-1.5 p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium flex items-center gap-1.5">
                            <ShieldCheck size={13} className="shrink-0 text-indigo-500" />
                            <span>El inventario con control de cantidades físicas está deshabilitado. Tienes habilitado el <strong>inventario a ciegas</strong>.</span>
                          </div>
                        )}
                      </div>

                      {segregationWarning && !isAdmin && !isBlindMode && (
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col gap-1.5 text-amber-800 dark:text-amber-300 text-xs">
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                            <p className="text-[10px] leading-tight">{segregationWarning}</p>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer mt-1 text-[10px] font-bold">
                            <input
                              type="checkbox"
                              checked={overrideSegregation}
                              onChange={e => setOverrideSegregation(e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-0"
                            />
                            <span>Confirmar excepción de auto-conteo</span>
                          </label>
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
              {activeSession && (activeSession.status === 'completado' || activeSession.status === 'finalizado') && (
                <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
                  {!isAdmin ? (
                    <div className="bg-white dark:bg-[#11192e] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl text-center flex flex-col items-center gap-4 max-w-md">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <CheckCircle size={28} />
                      </div>
                      <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase">
                        ✓ Conteo Físico Enviado
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Tu conteo físico ha sido registrado exitosamente y enviado a Administración.
                        <br />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Pendiente de revisión administrativa.</span>
                      </p>
                      <div className="flex items-center gap-2">
                        {onClose && (
                          <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl transition cursor-pointer"
                          >
                            Cerrar Pantalla
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSession(null);
                            setSessionItems([]);
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase rounded-xl transition cursor-pointer"
                        >
                          Iniciar Nuevo Conteo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-[#11192e] p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col gap-3 max-w-2xl w-full">
                      {/* Cabecera de auditoría */}
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                        <div>
                          <h3 className="text-xs md:text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                            Reconciliación y Aprobación de Inventario
                          </h3>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Auditor: <strong className="text-indigo-600 dark:text-indigo-400">{activeSession.auditor_name || activeSession.username}</strong>
                            {' • '}
                            <span>{activeSession.store_name || 'Almacén Principal'}</span>
                            {' • '}
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                              {activeSession.mode === 'BLIND' ? 'Auditoría a Ciegas' : 'Auditoría Visible'}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => exportCountToCsv(activeSession, sessionItems)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1 border border-slate-200 dark:border-slate-700"
                            title="Exportar a CSV"
                          >
                            <Download size={11} />
                            <span>CSV</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => exportCountToPDF(activeSession, sessionItems)}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1 border border-indigo-200/50 dark:border-indigo-800/50"
                            title="Descargar Informe PDF"
                          >
                            <Printer size={11} />
                            <span>PDF</span>
                          </button>
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase rounded-lg border border-amber-500/20">
                            Pendiente Aprobación
                          </span>
                        </div>
                      </div>

                      {/* INFORME AUTOMÁTICO: CASO A (Todo coincide) vs CASO B (Existen diferencias) */}
                      {activeSummary.productsWithDiff === 0 ? (
                        /* CASO A: TODO CORRECTO */
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                            <CheckCheck size={22} className="stroke-[2.5]" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                              ✓ Control Correcto — Sin Diferencias
                            </h4>
                            <p className="text-[10px] text-emerald-600/90 dark:text-emerald-400/90 leading-tight">
                              Todos los artículos contados coinciden con el inventario registrado ({activeSummary.totalItems} de {activeSummary.totalItems} correctos). No se requieren ajustes contables.
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* CASO B: CON DISCREPANCIAS */
                        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                            <AlertTriangle size={22} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-rose-700 dark:text-rose-300 uppercase tracking-wide">
                              ⚠️ Control con Discrepancias — Requiere Decisión
                            </h4>
                            <p className="text-[10px] text-rose-600/90 dark:text-rose-400/90 leading-tight">
                              Se detectaron {activeSummary.productsWithDiff} producto(s) con diferencias entre el conteo físico y el sistema. Puedes solicitar un reconteo de estos productos o aprobar el ajuste.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Resumen numérico */}
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

                      {/* Filtros de revisión administrativa si hay diferencias */}
                      {activeSummary.productsWithDiff > 0 && (
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 flex-wrap gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Filtrar:</span>
                            <button
                              type="button"
                              onClick={() => setAdminReviewFilter('todos')}
                              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                                adminReviewFilter === 'todos' 
                                  ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' 
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Todos ({sessionItems.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdminReviewFilter('diferencias')}
                              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase transition cursor-pointer ${
                                adminReviewFilter === 'diferencias' 
                                  ? 'bg-rose-600 text-white shadow-xs' 
                                  : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              }`}
                            >
                              Con Diferencias ({activeSummary.productsWithDiff})
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdminReviewFilter('coincidentes')}
                              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                                adminReviewFilter === 'coincidentes' 
                                  ? 'bg-emerald-600 text-white shadow-xs' 
                                  : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              }`}
                            >
                              Coincidentes ({sessionItems.length - activeSummary.productsWithDiff})
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const diffIds = sessionItems
                                .filter(it => it.counted_stock !== (it.system_stock ?? it.live_stock ?? 0))
                                .map(it => it.id);
                              if (selectedRecountIds.length === diffIds.length) {
                                setSelectedRecountIds([]);
                              } else {
                                setSelectedRecountIds(diffIds);
                              }
                            }}
                            className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer ml-auto"
                          >
                            {selectedRecountIds.length === activeSummary.productsWithDiff
                              ? 'Deseleccionar todos'
                              : `Seleccionar todas las dif. (${activeSummary.productsWithDiff})`}
                          </button>
                        </div>
                      )}

                      {/* Lista de productos en revisión */}
                      <div className="max-h-[240px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                        {reviewItems.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400 font-medium">
                            No hay productos en este filtro.
                          </div>
                        ) : (
                          reviewItems.map(it => {
                            const sys = it.system_stock ?? it.live_stock ?? 0;
                            const physical = it.counted_stock ?? 0;
                            const diff = physical - sys;
                            const hasDiff = diff !== 0;

                            return (
                              <div key={it.id} className={`p-2 flex items-center justify-between text-xs gap-2 transition ${
                                hasDiff ? 'bg-rose-500/5 dark:bg-rose-950/20' : ''
                              }`}>
                                {hasDiff && (
                                  <input
                                    type="checkbox"
                                    checked={selectedRecountIds.includes(it.id)}
                                    onChange={() => {
                                      setSelectedRecountIds(prev => 
                                        prev.includes(it.id) ? prev.filter(id => id !== it.id) : [...prev, it.id]
                                      );
                                    }}
                                    title="Marcar para reconteo"
                                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-slate-700 cursor-pointer shrink-0"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-slate-800 dark:text-white uppercase truncate text-xs flex items-center gap-1.5">
                                    <span className="truncate">{it.product_name}</span>
                                    {it.had_movements_during_count === 1 && (
                                      <span className="shrink-0 px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[8px] font-bold rounded">
                                        ⚡ Mov. durante conteo
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[9px] text-slate-400 font-mono">
                                    SKU: {it.product_sku} {it.product_category ? `• ${it.product_category}` : ''}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 text-right font-mono text-[10px]">
                                  <span className="text-slate-500">POS: <strong>{sys}</strong></span>
                                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold text-slate-800 dark:text-white">
                                    Físico: {physical}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black w-24 text-center ${
                                    diff === 0 
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                      : diff > 0 
                                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20' 
                                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                  }`}>
                                    {diff === 0 ? '✓ Coincide' : diff > 0 ? `+${diff} Sobrante` : `${diff} Faltante`}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div>
                        <input
                          type="text"
                          value={adminNotes}
                          onChange={e => setAdminNotes(e.target.value)}
                          placeholder="Observaciones de conciliación (opcional)..."
                          className="w-full p-2 text-xs bg-slate-50 dark:bg-[#151f32] text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Botones de acción según caso */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCancelSession}
                          className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 font-bold text-xs uppercase rounded-xl transition cursor-pointer shrink-0"
                        >
                          Rechazar
                        </button>

                        {activeSummary.productsWithDiff > 0 && (
                          <button
                            type="button"
                            onClick={handleRequestRecount}
                            disabled={isLoading || selectedRecountIds.length === 0}
                            className={`flex-1 py-2 text-white font-black text-xs uppercase rounded-xl transition shadow-md flex items-center justify-center gap-1.5 ${
                              selectedRecountIds.length === 0
                                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-500 cursor-pointer'
                            }`}
                          >
                            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
                            <span>Solicitar Reconteo ({selectedRecountIds.length})</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleApproveCount}
                          disabled={isLoading}
                          className={`flex-1 py-2 text-white font-black text-xs uppercase rounded-xl transition shadow-md cursor-pointer flex items-center justify-center gap-1.5 ${
                            activeSummary.productsWithDiff === 0
                              ? 'bg-emerald-600 hover:bg-emerald-500'
                              : 'bg-indigo-600 hover:bg-indigo-500'
                          }`}
                        >
                          <CheckCircle size={14} />
                          <span>
                            {isLoading 
                              ? 'Aplicando...' 
                              : activeSummary.productsWithDiff === 0 
                                ? '✓ Aprobar y Liberar Inventario' 
                                : 'Aprobar Ajustes y Conciliar'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CASO C: CONTEO FÍSICO ACTIVO - ESPACIO Y SCROLL MÁXIMO */}
              {activeSession && activeSession.status !== 'completado' && activeSession.status !== 'finalizado' && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  
                  {/* ALERTA DE RECONTEO SI FUE SOLICITADO POR ADMINISTRACIÓN */}
                  {recountItemsCount > 0 && (
                    <div className="bg-purple-600/10 border-b border-purple-500/30 px-3 py-2 flex items-center justify-between gap-2 text-purple-900 dark:text-purple-300 text-xs">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={15} className="text-purple-600 shrink-0" />
                        <span className="font-bold">
                          Administración ha solicitado verificar <strong>{recountItemsCount}</strong> artículo(s) con discrepancia.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveFilter('reconteo')}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer shrink-0"
                      >
                        Ver para Reconteo
                      </button>
                    </div>
                  )}

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

                      {/* Botón rápido = Todo al POS para Admin (Solo en modo STANDARD) */}
                      {isAdmin && !isBlindActive && activeSummary.hasAdminVisibility && activeSummary.pendingItems > 0 && (
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

                    {/* Segmented Switcher: Artículos con Stock vs Apartado Stock 0 (Solo en modo STANDARD con visibilidad) */}
                    {!isBlindActive && activeSummary.hasAdminVisibility && (
                      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setStockSection('with_stock');
                            setActiveFilter('todos');
                          }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                            stockSection === 'with_stock'
                              ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs border border-slate-200/80 dark:border-slate-700'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <Package size={13} className="shrink-0" />
                          <span>Con Existencias</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                            stockSection === 'with_stock'
                              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {itemsWithStock.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setStockSection('zero_stock');
                            setActiveFilter('todos');
                          }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                            stockSection === 'zero_stock'
                              ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-xs border border-amber-300/80 dark:border-amber-700/80'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <AlertCircle size={13} className="shrink-0" />
                          <span>Apartado Stock 0</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                            stockSection === 'zero_stock'
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {itemsZeroStock.length}
                          </span>
                        </button>
                      </div>
                    )}

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
                        Todos ({currentSectionItems.length})
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
                        Pendientes ({currentSectionItems.filter(it => it.is_checked === 0).length})
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
                        Verificados ({currentSectionItems.filter(it => it.is_checked === 1).length})
                      </button>

                      {recountItemsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveFilter('reconteo')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition whitespace-nowrap cursor-pointer shrink-0 animate-pulse ${
                            activeFilter === 'reconteo'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          Para Reconteo ({currentSectionItems.filter(it => it.recount_requested === 1 || it.status === 'requiere_revision').length})
                        </button>
                      )}

                      {!isBlindActive && activeSummary.hasAdminVisibility && (
                        <button
                          type="button"
                          onClick={() => setActiveFilter('diferencias')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition whitespace-nowrap cursor-pointer shrink-0 ${
                            activeFilter === 'diferencias'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          Diferencias ({currentSectionItems.filter(it => it.is_checked === 1 && it.system_stock !== undefined && it.counted_stock !== it.system_stock).length})
                        </button>
                      )}
                    </div>

                  </div>

                  {/* ======================================================== */}
                  {/* LISTA DE ARTÍCULOS DE ALTA DENSIDAD Y ESPACIO EXPANDIDO  */}
                  {/* ======================================================== */}
                  <div className="flex-1 overflow-y-auto p-2 md:p-3 flex flex-col gap-2 pb-24">
                    {/* Banner explicativo exclusivo para el Apartado de Stock 0 */}
                    {stockSection === 'zero_stock' && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 flex items-start gap-2.5 text-[11px] leading-snug">
                        <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <strong className="font-black text-amber-900 dark:text-amber-200">
                            Apartado Especial: Productos con Stock en Cero (0 unidades teóricas)
                          </strong>
                          <p className="opacity-90 mt-0.5">
                            Estos productos están separados para no entorpecer tu conteo de pasillo. Si encuentras cajas o unidades físicas de alguno de ellos en bodega, ingresa la cantidad contada para registrar el ingreso a favor en el inventario.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Aviso cruzado si el usuario busca algo que está en la otra sección */}
                    {crossSectionMatchesCount > 0 && (
                      <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between gap-2 text-[11px] text-indigo-700 dark:text-indigo-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Search size={14} className="shrink-0 text-indigo-500" />
                          <span className="truncate">
                            Se encontró <strong>{crossSectionMatchesCount}</strong> artículo(s) coincidente(s) en el <strong>{stockSection === 'with_stock' ? 'Apartado Stock 0' : 'Listado Con Existencias'}</strong>.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStockSection(prev => prev === 'with_stock' ? 'zero_stock' : 'with_stock')}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider shrink-0 cursor-pointer shadow-xs transition"
                        >
                          Ver en {stockSection === 'with_stock' ? 'Stock 0' : 'Con Existencias'}
                        </button>
                      </div>
                    )}

                    {filteredItems.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-wide bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl my-auto">
                        {itemSearch ? 'No se encontraron artículos con ese criterio.' : 'No hay artículos en esta vista.'}
                      </div>
                    ) : (
                      filteredItems.map(it => {
                        const isChecked = it.is_checked === 1 && it.status !== 'requiere_revision' && !it.recount_requested;
                        const isPending = (it.status === 'pendiente' || it.status === 'requiere_revision' || Boolean(it.recount_requested)) || !isChecked;
                        const showStock = it.system_stock !== undefined && activeSummary.hasAdminVisibility && !isBlindActive;
                        const sysStock = it.system_stock;
                        const physical = it.counted_stock ?? 0;
                        const diff = (showStock && sysStock !== undefined) ? physical - sysStock : undefined;

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
                                {Boolean(it.recount_requested === 1 || it.status === 'requiere_revision') && (
                                  <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 text-[9px] font-black uppercase text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 animate-pulse">
                                    Reconteo Requerido
                                  </span>
                                )}
                                {isChecked && (
                                  <span className="ml-auto sm:hidden px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase border border-emerald-500/20">
                                    ✓ {showStock ? 'Verificado' : 'Contado'}
                                  </span>
                                )}
                              </div>
                              
                              {/* NOMBRE COMPLETO DEL PRODUCTO */}
                              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase leading-snug break-words whitespace-normal">
                                {it.product_name}
                              </h3>

                              {/* Existencias POS y Discrepancias (ESTRICTAMENTE PROHIBIDO EN MODO A CIEGAS) */}
                              {!isBlindActive && showStock && sysStock !== undefined && (
                                <div className="flex items-center gap-2.5 font-mono text-[10px] sm:text-xs">
                                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                                    Stock POS: <strong className="text-slate-900 dark:text-white font-bold">{sysStock} u</strong>
                                  </span>
                                  {isChecked && diff !== undefined && (
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
                              )}
                            </div>

                            {/* Controles de Conteo */}
                            <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80">
                              
                              {/* Botón Rápido = POS (PROHIBIDO EN MODO A CIEGAS) */}
                              {!isBlindActive && showStock && sysStock !== undefined && (
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
                                  onClick={() => handleUpdateItem(it.id, { counted_stock: Math.max(0, physical - 1), is_checked: 1, status: 'contado' }, true)}
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
                                  placeholder="—"
                                  value={isPending ? '' : physical}
                                  onFocus={e => e.target.select()}
                                  onBlur={() => {
                                    if (!isPending) {
                                      handleUpdateItem(it.id, { counted_stock: physical, is_checked: 1, status: 'contado' }, true);
                                    }
                                  }}
                                  onChange={e => {
                                    const raw = e.target.value;
                                    if (raw === '') {
                                      handleUpdateItem(it.id, { counted_stock: 0, is_checked: 0, status: 'pendiente' }, false);
                                    } else {
                                      const val = parseInt(raw, 10);
                                      handleUpdateItem(it.id, { counted_stock: isNaN(val) ? 0 : Math.max(0, val), is_checked: 1, status: 'contado' }, false);
                                    }
                                  }}
                                  className="w-12 h-8 text-center font-mono font-black text-xs sm:text-sm bg-transparent text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                />

                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(it.id, { counted_stock: isPending ? 1 : physical + 1, is_checked: 1, status: 'contado' }, true)}
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
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-4 md:p-5 shadow-2xl flex flex-col gap-3 max-h-[88vh]">
            {/* Cabecera del modal con exportación */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">
                    Auditoría #{selectedHistoricCount.id}
                  </h3>
                  <span className={`px-2 py-0.2 rounded text-[9px] font-black uppercase border ${
                    selectedHistoricCount.status === 'cerrado' || selectedHistoricCount.status === 'aprobado'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  }`}>
                    {selectedHistoricCount.status === 'cerrado' || selectedHistoricCount.status === 'aprobado' ? 'Conciliado' : selectedHistoricCount.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  {selectedHistoricCount.store_name || 'Almacén Principal'} · Auditor: <strong className="text-slate-600 dark:text-slate-300">{selectedHistoricCount.auditor_name || selectedHistoricCount.username}</strong>
                  {selectedHistoricCount.approved_by_username && (
                    <span> · Aprobó: <strong className="text-indigo-600 dark:text-indigo-400">{selectedHistoricCount.approved_by_username}</strong></span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => exportCountToCsv(selectedHistoricCount, historicItems)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1 border border-slate-200 dark:border-slate-700"
                  title="Exportar archivo CSV"
                >
                  <Download size={12} />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportCountToPDF(selectedHistoricCount, historicItems)}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1 border border-indigo-200/50 dark:border-indigo-800/50"
                  title="Descargar informe PDF"
                >
                  <Printer size={12} />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedHistoricCount(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Resumen numérico del informe histórico */}
            {(() => {
              const total = historicItems.length;
              const correct = historicItems.filter(it => it.counted_stock === (it.system_stock ?? it.live_stock ?? 0)).length;
              const withDiff = historicItems.filter(it => it.counted_stock !== (it.system_stock ?? it.live_stock ?? 0)).length;
              const netUnits = historicItems.reduce((sum, it) => sum + ((it.counted_stock ?? 0) - (it.system_stock ?? it.live_stock ?? 0)), 0);

              return (
                <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-black/30 p-2 rounded-xl text-center">
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 block">Total</span>
                    <span className="text-xs font-mono font-bold text-slate-800 dark:text-white">{total}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 block">Coincidentes</span>
                    <span className="text-xs font-mono font-bold text-emerald-500">{correct}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 block">Con Dif.</span>
                    <span className="text-xs font-mono font-bold text-rose-500">{withDiff}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 block">Dif. Neta</span>
                    <span className={`text-xs font-mono font-bold ${netUnits >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>
                      {netUnits > 0 ? `+${netUnits}` : netUnits} u
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Filtros en detalle histórico */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setHistoricStockFilter('all')}
                className={`flex-1 py-1 rounded-lg text-center cursor-pointer transition ${historicStockFilter === 'all' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500'}`}
              >
                Todos ({historicItems.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoricStockFilter('diferencias')}
                className={`flex-1 py-1 rounded-lg text-center cursor-pointer transition ${historicStockFilter === 'diferencias' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500'}`}
              >
                Con Diferencias ({historicItems.filter(it => it.counted_stock !== (it.system_stock ?? it.live_stock ?? 0)).length})
              </button>
              <button
                type="button"
                onClick={() => setHistoricStockFilter('coincidentes')}
                className={`flex-1 py-1 rounded-lg text-center cursor-pointer transition ${historicStockFilter === 'coincidentes' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'}`}
              >
                Coincidentes ({historicItems.filter(it => it.counted_stock === (it.system_stock ?? it.live_stock ?? 0)).length})
              </button>
            </div>

            {/* Lista detallada de productos */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl max-h-[340px]">
              {historicItems
                .filter(it => {
                  const sys = it.system_stock ?? it.live_stock ?? 0;
                  const diff = (it.counted_stock ?? 0) - sys;
                  if (historicStockFilter === 'diferencias') return diff !== 0;
                  if (historicStockFilter === 'coincidentes') return diff === 0;
                  if (historicStockFilter === 'with_stock') return sys > 0;
                  if (historicStockFilter === 'zero_stock') return sys <= 0;
                  return true;
                })
                .map(it => {
                  const sys = it.system_stock ?? it.live_stock ?? 0;
                  const physical = it.counted_stock ?? 0;
                  const diff = physical - sys;
                  const hasDiff = diff !== 0;

                  return (
                    <div key={it.id} className={`p-2 flex items-center justify-between text-xs gap-2 transition ${
                      hasDiff ? 'bg-rose-500/5 dark:bg-rose-950/20' : ''
                    }`}>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 dark:text-white uppercase truncate text-xs flex items-center gap-1.5">
                          <span className="truncate">{it.product_name}</span>
                          {it.recount_requested === 1 && (
                            <span className="shrink-0 px-1 py-0.2 bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[8px] font-bold rounded">
                              Recontado
                            </span>
                          )}
                          {it.had_movements_during_count === 1 && (
                            <span className="shrink-0 px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[8px] font-bold rounded">
                              ⚡ Mov. durante conteo
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          SKU: {it.product_sku} {it.product_category ? `• ${it.product_category}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-right font-mono text-[10px]">
                        <span className="text-slate-500">POS: <strong>{sys}</strong></span>
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold text-slate-800 dark:text-white">
                          Físico: {physical}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black w-24 text-center ${
                          diff === 0 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                            : diff > 0 
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20' 
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}>
                          {diff === 0 ? '✓ Coincide' : diff > 0 ? `+${diff} Sobrante` : `${diff} Faltante`}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            <button
              type="button"
              onClick={() => setSelectedHistoricCount(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase rounded-xl transition cursor-pointer"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
