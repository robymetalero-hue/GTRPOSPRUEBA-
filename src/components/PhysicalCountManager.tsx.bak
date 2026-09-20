import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  ClipboardCheck, Clock, CheckCircle, AlertTriangle, Play, X, Trash2, 
  Save, Eye, RefreshCw, Sparkles, Filter, Search, Check, Ban 
} from 'lucide-react';

interface PhysicalCountManagerProps {
  onClose: () => void;
}

interface InventoryCount {
  id: number;
  user_id: number;
  username: string;
  created_at: string;
  status: 'en_progreso' | 'completado' | 'aprobado';
  category_filter: string | null;
  approved_at: string | null;
  approved_by_username: string | null;
}

interface CountItem {
  id: number;
  inventory_count_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  product_category: string;
  system_stock: number;
  counted_stock: number;
  had_movements_during_count: number;
  is_checked: number;
}

export default function PhysicalCountManager({ onClose }: PhysicalCountManagerProps) {
  const { user, products, fetchProducts, showNotification } = useAppContext();
  const isAdmin = user?.role === 'admin' || user?.role === 'propietario';

  const [activeTab, setActiveTab] = useState<'activo' | 'historico'>('activo');
  const [activeSession, setActiveSession] = useState<InventoryCount | null>(null);
  const [sessionItems, setSessionItems] = useState<CountItem[]>([]);
  const [historicalCounts, setHistoricalCounts] = useState<InventoryCount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // New session config
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [categories, setCategories] = useState<string[]>([]);

  // Filtering counts inside active count
  const [itemSearch, setItemSearch] = useState('');
  const [filterPendingOnly, setFilterPendingOnly] = useState(false);

  // Selected historic count view
  const [selectedHistoricCount, setSelectedHistoricCount] = useState<InventoryCount | null>(null);
  const [historicItems, setHistoricItems] = useState<CountItem[]>([]);

  useEffect(() => {
    // Extract categories
    if (products && products.length > 0) {
      const uniqueCats = Array.from(new Set(products.map(p => p.category || 'Sin Categoría')));
      setCategories(uniqueCats);
    }
  }, [products]);

  useEffect(() => {
    fetchProducts();
    fetchActiveSession();
    fetchHistory();
  }, [activeTab]);

  const fetchActiveSession = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/inventory-counts');
      if (res.ok) {
        const counts: InventoryCount[] = await res.json();
        const active = counts.find(c => c.status === 'en_progreso' || c.status === 'completado');
        if (active) {
          setActiveSession(active);
          fetchSessionItems(active.id);
        } else {
          setActiveSession(null);
          setSessionItems([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/inventory-counts');
      if (res.ok) {
        const counts: InventoryCount[] = await res.json();
        const historic = counts.filter(c => c.status === 'aprobado' || c.status === 'completado');
        setHistoricalCounts(historic);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessionItems = async (countId: number, isHistoric = false) => {
    try {
      const res = await fetch(`/api/inventory-counts/${countId}`);
      if (res.ok) {
        const data = await res.json();
        const mapItems = (items: any[]) => items.map(it => {
          const prodObj = products?.find(p => p.id === it.product_id);
          return {
            ...it,
            system_stock: it.expected_quantity,
            counted_stock: it.physical_quantity,
            product_category: prodObj?.category || 'Sin Categoría',
            is_checked: it.status !== 'pendiente' ? 1 : 0
          };
        });
        if (isHistoric) {
          setHistoricItems(mapItems(data.items || []));
        } else {
          setSessionItems(mapItems(data.items || []));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartSession = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/inventory-counts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(user?.id || 1),
          'x-user-role': user?.role || ''
        },
        body: JSON.stringify({
          category_filter: selectedCategory === 'Todos' ? null : selectedCategory
        })
      });

      if (res.ok) {
        await res.json();
        showNotification?.("✓ Nueva sesión de conteo físico iniciada con éxito.", "success");
        await fetchActiveSession();
      } else {
        const err = await res.json();
        showNotification?.(`Error al iniciar sesión: ${err.error}`, "error");
      }
    } catch (err) {
      console.error(err);
      showNotification?.("Fallo de red al crear sesión.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateItemStock = async (itemId: number, value: string) => {
    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 0) return;

    // Local optimistic update
    setSessionItems(prev => prev.map(it => it.id === itemId ? { ...it, counted_stock: parsed } : it));

    try {
      await fetch(`/api/inventory-counts/${activeSession?.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ physical_quantity: parsed })
      });
    } catch (err) {
      console.error("Failed to update counted stock:", err);
    }
  };

  const handleToggleItemCheck = async (itemId: number, currentCheck: number) => {
    const nextCheck = currentCheck === 1 ? 0 : 1;
    const item = sessionItems.find(it => it.id === itemId);
    if (!item) return;
    
    // Local optimistic update
    setSessionItems(prev => prev.map(it => it.id === itemId ? { ...it, is_checked: nextCheck } : it));

    try {
      await fetch(`/api/inventory-counts/${activeSession?.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ physical_quantity: item.counted_stock })
      });
    } catch (err) {
      console.error("Failed to check item:", err);
    }
  };

  const handleCompleteSession = async () => {
    if (!activeSession) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory-counts/${activeSession.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completado' })
      });

      if (res.ok) {
        showNotification?.("✓ Conteo físico completado. Esperando revisión administrativa.", "success");
        fetchActiveSession();
        fetchHistory();
      } else {
        showNotification?.("No se pudo completar el conteo físico.", "error");
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
        }
      });

      if (res.ok) {
        showNotification?.("✓ Ajustes físicos de inventario aprobados y aplicados correctamente.", "success");
        fetchActiveSession();
        fetchProducts(); // Refresh main inventory products list
        fetchHistory();
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

  const handleViewHistoricCount = (count: InventoryCount) => {
    setSelectedHistoricCount(count);
    fetchSessionItems(count.id, true);
  };

  const handleCancelSession = async () => {
    if (!activeSession) return;
    if (!confirm("¿Está seguro que desea cancelar esta sesión de conteo? Se perderán los registros no aprobados.")) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory-counts/${activeSession.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelado' }) // Will be deleted or flagged in DB
      });
      if (res.ok) {
        showNotification?.("Sesión de conteo cancelada.", "success");
        setActiveSession(null);
        setSessionItems([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter items in active session
  const filteredItems = sessionItems.filter(it => {
    const matchesSearch = it.product_name.toLowerCase().includes(itemSearch.toLowerCase()) || 
                          it.product_sku.toLowerCase().includes(itemSearch.toLowerCase());
    const matchesPending = !filterPendingOnly || it.is_checked === 0;
    return matchesSearch && matchesPending;
  });

  // Calculate totals/discrepancies for summary
  const getDiscrepancySummary = (itemsList: CountItem[]) => {
    let totalItems = itemsList.length;
    let checkedItems = itemsList.filter(it => it.is_checked === 1).length;
    let productsWithDiff = itemsList.filter(it => it.counted_stock !== it.system_stock).length;
    let totalSystemStock = itemsList.reduce((sum, it) => sum + it.system_stock, 0);
    let totalCountedStock = itemsList.reduce((sum, it) => sum + it.counted_stock, 0);
    let totalDiscrepancyUnits = totalCountedStock - totalSystemStock;

    return {
      totalItems,
      checkedItems,
      productsWithDiff,
      totalSystemStock,
      totalCountedStock,
      totalDiscrepancyUnits
    };
  };

  const activeSummary = getDiscrepancySummary(sessionItems);
  const historicSummary = getDiscrepancySummary(historicItems);

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-40 select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0c111e] rounded-3xl w-full max-w-5xl border border-slate-150 dark:border-slate-850 flex flex-col gap-4 shadow-2xl overflow-hidden max-h-[92vh]">
        
        {/* Cabecera del Control Físico */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-850/60 flex justify-between items-center bg-slate-50/50 dark:bg-black/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-white">
                Control Físico de Almacén (Checklist Guiado)
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-relaxed">
                Realiza auditorías de inventario físico, detecta pérdidas o sobrantes, y mantén el sistema perfectamente cuadrado.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-650 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pestañas de Navegación del Panel */}
        <div className="px-5 flex gap-2 border-b border-slate-100 dark:border-slate-850/40 pb-2">
          <button
            onClick={() => setActiveTab('activo')}
            className={`px-4 py-2 text-[10px] uppercase font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'activo' 
                ? 'bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 font-extrabold' 
                : 'text-slate-400 hover:text-slate-650'
            }`}
          >
            <Play size={12} />
            Sesión de Conteo Activa
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`px-4 py-2 text-[10px] uppercase font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'historico' 
                ? 'bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 font-extrabold' 
                : 'text-slate-400 hover:text-slate-650'
            }`}
          >
            <Clock size={12} />
            Historial de Auditorías
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto px-5 min-h-0 flex flex-col gap-4">
          
          {activeTab === 'activo' && (
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              
              {/* SI NO HAY SESIÓN ACTIVA */}
              {!activeSession && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl gap-5">
                  <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-full text-slate-400">
                    <ClipboardCheck size={48} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-350 uppercase tracking-wide">No hay ningún control físico activo</h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mt-1.5 font-semibold">
                      Los conteos físicos te guiarán producto por producto para auditar el inventario físico real y compararlo con el sistema de ventas.
                    </p>
                  </div>

                  {/* Configuración de nueva sesión */}
                  <div className="bg-slate-50/50 dark:bg-black/10 p-5 rounded-2xl border border-slate-150 dark:border-slate-850/60 max-w-md w-full flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-450">Alcance de conteo físico:</label>
                      <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className="text-xs font-bold p-2.5 border border-slate-250 dark:border-slate-800 bg-white dark:bg-[#11192e] text-slate-850 dark:text-white rounded-xl focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Todos">Todos los productos (Recomendado)</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleStartSession}
                      disabled={isLoading}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.01] text-white font-extrabold text-xs uppercase rounded-xl shadow-lg transition cursor-pointer select-none"
                    >
                      {isLoading ? 'Iniciando...' : 'Iniciar Sesión de Conteo'}
                    </button>
                  </div>
                </div>
              )}

              {/* SI HAY SESIÓN ACTIVA */}
              {activeSession && (
                <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
                  
                  {/* Panel de Control de Conteo (Listado e Input) */}
                  <div className="flex-1 flex flex-col gap-3 min-h-0">
                    
                    {/* Barra de Filtros Internos del Conteo */}
                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between select-none">
                      <div className="relative w-full sm:max-w-xs">
                        <input
                          type="text"
                          placeholder="Buscar por artículo, SKU..."
                          value={itemSearch}
                          onChange={e => setItemSearch(e.target.value)}
                          className="pl-8 pr-4 py-2 w-full bg-slate-50 dark:bg-black/15 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white text-[11px] font-semibold"
                        />
                        <Search className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
                      </div>

                      <div className="flex gap-3 items-center self-end sm:self-auto">
                        <label className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-slate-450 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={filterPendingOnly}
                            onChange={e => setFilterPendingOnly(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                          <span>Ocultar ya contados</span>
                        </label>
                      </div>
                    </div>

                    {/* Tabla/Lista Scrollholder de Productos a Contar */}
                    <div className="flex-1 overflow-y-auto border border-slate-100 dark:border-slate-850/60 rounded-2xl min-h-[30vh]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-150 dark:border-slate-850/60 text-[8.5px] font-bold text-slate-400 uppercase tracking-widest select-none">
                            <th className="p-3 pl-4 text-center">Estado</th>
                            <th className="p-3">Producto / SKU</th>
                            <th className="p-3">Categoría</th>
                            <th className="p-3 text-center">Stock Sistema</th>
                            <th className="p-3 text-center">Stock Físico Real</th>
                            <th className="p-3 text-center pr-4">Marcar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850/40 text-[11px] font-bold">
                          {filteredItems.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-12 text-center text-slate-400 font-semibold">
                                Ningún producto coincide con el filtro o búsqueda actual.
                              </td>
                            </tr>
                          ) : (
                            filteredItems.map(it => {
                              const isChecked = it.is_checked === 1;
                              const isDiff = it.counted_stock !== it.system_stock;
                              const alertMovement = it.had_movements_during_count === 1;

                              return (
                                <tr 
                                  key={it.id} 
                                  className={`transition hover:bg-slate-50/30 dark:hover:bg-slate-900/10 ${
                                    isChecked ? 'bg-emerald-500/2 opacity-75' : ''
                                  }`}
                                >
                                  {/* Icono de Check */}
                                  <td className="p-3 pl-4 text-center select-none">
                                    <button
                                      onClick={() => handleToggleItemCheck(it.id, it.is_checked)}
                                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer ${
                                        isChecked 
                                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                                          : 'border-slate-300 hover:border-slate-400 dark:border-slate-700'
                                      }`}
                                    >
                                      {isChecked && <Check size={12} />}
                                    </button>
                                  </td>

                                  {/* Nombre y SKU */}
                                  <td className="p-3">
                                    <div>
                                      <span className={`text-slate-850 dark:text-slate-200 uppercase ${isChecked ? 'line-through text-slate-400' : ''}`}>
                                        {it.product_name}
                                      </span>
                                      <div className="text-[9px] text-slate-400 mt-0.5 font-mono">SKU: {it.product_sku || 'N/A'}</div>
                                    </div>
                                    
                                    {/* Alerta de Movimiento por Venta durante conteo */}
                                    {alertMovement && (
                                      <div className="mt-1 flex items-center gap-1.5 text-[8.5px] font-bold text-amber-600 bg-amber-500/5 py-0.5 px-2 rounded-md border border-amber-500/10 select-none max-w-[280px]">
                                        <AlertTriangle size={10} className="shrink-0 animate-bounce" />
                                        <span>Hubo venta/devolución física durante el conteo. Verifique.</span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Categoría */}
                                  <td className="p-3 select-none">
                                    <span className="bg-slate-100 dark:bg-black/35 py-0.5 px-2 text-[9px] rounded-md text-slate-500 uppercase">
                                      {it.product_category}
                                    </span>
                                  </td>

                                  {/* Stock Teórico */}
                                  <td className="p-3 text-center font-mono text-slate-650 dark:text-slate-350 select-none">{it.system_stock} pz</td>

                                  {/* Stock Físico Input */}
                                  <td className="p-3 text-center">
                                    <input
                                      type="number"
                                      disabled={activeSession.status === 'completado'}
                                      value={it.counted_stock}
                                      onChange={e => handleUpdateItemStock(it.id, e.target.value)}
                                      className={`w-20 text-center font-mono font-black py-1 rounded-lg border focus:outline-none focus:ring-0 ${
                                        isDiff 
                                          ? 'border-rose-500 text-rose-600 bg-rose-500/5 focus:border-rose-600' 
                                          : 'border-slate-250 dark:border-slate-800 focus:border-indigo-500 text-slate-800 dark:text-white'
                                      }`}
                                    />
                                  </td>

                                  {/* Acción de Check Rápido */}
                                  <td className="p-3 text-center pr-4 select-none">
                                    <button
                                      onClick={() => handleToggleItemCheck(it.id, it.is_checked)}
                                      className={`px-2 py-1 text-[9px] rounded-md uppercase font-black tracking-wider transition cursor-pointer ${
                                        isChecked 
                                          ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' 
                                          : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15'
                                      }`}
                                    >
                                      {isChecked ? 'Listo' : 'Contar'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Panel de Resumen Lateral (Discrepancias y Finalización) */}
                  <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
                    <div className="bg-slate-50/50 dark:bg-black/25 rounded-2xl border border-slate-150 dark:border-slate-850 p-5 flex flex-col gap-4 shadow-xs select-none">
                      <h4 className="font-extrabold text-xs uppercase tracking-widest text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-850">
                        Progreso de Auditoría
                      </h4>

                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-semibold">Productos a auditar:</span>
                          <span className="font-bold">{activeSummary.totalItems}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-semibold">Productos marcados:</span>
                          <span className="font-bold text-emerald-500">{activeSummary.checkedItems} / {activeSummary.totalItems}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-semibold">Discrepancias detectadas:</span>
                          <span className={`font-bold ${activeSummary.productsWithDiff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {activeSummary.productsWithDiff} productos
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-semibold">Diferencia neta en unidades:</span>
                          <span className={`font-mono font-bold ${activeSummary.totalDiscrepancyUnits === 0 ? 'text-slate-500' : activeSummary.totalDiscrepancyUnits > 0 ? 'text-indigo-500' : 'text-rose-500'}`}>
                            {activeSummary.totalDiscrepancyUnits > 0 ? `+${activeSummary.totalDiscrepancyUnits}` : activeSummary.totalDiscrepancyUnits} pz
                          </span>
                        </div>
                      </div>

                      {/* Barra de progreso visual */}
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${(activeSummary.checkedItems / activeSummary.totalItems) * 100}%` }}
                        />
                      </div>

                      {/* Botones de Acción de Flujo */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-850 flex flex-col gap-2.5">
                        
                        {/* Finalizar Conteo (Cualquier usuario puede completarlo) */}
                        {activeSession.status === 'en_progreso' && (
                          <button
                            onClick={handleCompleteSession}
                            disabled={isLoading}
                            className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-[10.5px] uppercase rounded-xl transition cursor-pointer select-none"
                          >
                            Concluir Conteo & Enviar
                          </button>
                        )}

                        {/* Aprobar & Reconciliar (Solo Administradores, una vez completada la sesión) */}
                        {activeSession.status === 'completado' && (
                          <div className="flex flex-col gap-3">
                            <div className="p-3 border border-amber-200 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[10px] font-semibold rounded-xl leading-normal">
                              ⚠️ Conteo en revisión. El inventario real físico no se actualizará en base de datos hasta que el administrador lo apruebe.
                            </div>
                            {isAdmin ? (
                              <button
                                onClick={handleApproveCount}
                                disabled={isLoading}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10.5px] uppercase rounded-xl transition cursor-pointer select-none shadow-md shadow-emerald-550/10"
                              >
                                Aprobar & Reconciliar Inventario
                              </button>
                            ) : (
                              <div className="text-center text-[10px] font-black uppercase text-slate-400">
                                Esperando aprobación del Admin
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          onClick={handleCancelSession}
                          className="w-full py-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-extrabold text-[10px] uppercase rounded-xl transition cursor-pointer"
                        >
                          Cancelar Auditoría
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {activeTab === 'historico' && (
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              
              <div className="flex-1 flex flex-col md:flex-row gap-5 min-h-0">
                
                {/* Listado de Auditorías Completadas en el Pasado */}
                <div className="flex-1 overflow-y-auto border border-slate-100 dark:border-slate-850/60 rounded-2xl min-h-[30vh]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-150 dark:border-slate-850/60 text-[8.5px] font-bold text-slate-400 uppercase tracking-widest pl-4">
                        <th className="p-3 pl-6">ID Auditoría</th>
                        <th className="p-3">Realizado Por</th>
                        <th className="p-3 text-center">Filtro de Alcance</th>
                        <th className="p-3 text-center">Estado</th>
                        <th className="p-3 text-center">Aprobado Por</th>
                        <th className="p-3 text-center">Fecha de Cierre</th>
                        <th className="p-3 text-center pr-6">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850/40 text-[11px] font-bold">
                      {historicalCounts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-405 font-medium">
                            No se registran auditorías o controles físicos históricos en este negocio.
                          </td>
                        </tr>
                      ) : (
                        historicalCounts.map(h => {
                          const isApp = h.status === 'aprobado';
                          return (
                            <tr key={h.id} className="hover:bg-slate-50/30 dark:hover:bg-[#0d1221]/30">
                              <td className="p-3 pl-6 font-mono text-slate-400">#COUNT-{h.id}</td>
                              <td className="p-3 uppercase text-slate-705 dark:text-slate-200">{h.username}</td>
                              <td className="p-3 text-center">
                                <span className="bg-slate-50 dark:bg-black/30 border border-slate-200/50 dark:border-slate-850 py-0.5 px-2 text-[9px] rounded-lg">
                                  {h.category_filter || 'Todos los productos'}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`py-0.5 px-2 border rounded-full text-[8.5px] uppercase font-black ${
                                  isApp 
                                    ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10' 
                                    : 'bg-indigo-500/5 text-indigo-650 border-indigo-550/10'
                                }`}>
                                  {h.status}
                                </span>
                              </td>
                              <td className="p-3 text-center text-slate-400 font-semibold uppercase">{h.approved_by_username || '-'}</td>
                              <td className="p-3 text-center font-mono text-slate-450 text-[9.5px]">{new Date(h.created_at).toLocaleString()}</td>
                              <td className="p-3 text-center pr-6">
                                <button
                                  onClick={() => handleViewHistoricCount(h)}
                                  className="py-1 px-3 bg-slate-50 border border-slate-150 dark:bg-[#11192e] dark:border-slate-800 hover:bg-slate-100 text-indigo-650 dark:text-indigo-400 text-[9.5px] font-bold uppercase rounded-lg transition cursor-pointer"
                                >
                                  Ver Detalle
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Vista del Detalle de Diferencias de la auditoría seleccionada */}
                {selectedHistoricCount && (
                  <div className="w-full lg:w-96 shrink-0 flex flex-col gap-3 min-h-[300px]">
                    <div className="bg-white dark:bg-[#11192e] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4 h-full">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                          Discrepancias de Auditoría #{selectedHistoricCount.id}
                        </span>
                        <button 
                          onClick={() => setSelectedHistoricCount(null)}
                          className="text-slate-405 hover:text-slate-600 dark:hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center text-xs pb-2 border-b border-slate-100 dark:border-slate-850">
                        <div className="p-2 bg-slate-50 dark:bg-black/25 rounded-lg">
                          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Calculados</div>
                          <div className="font-mono font-bold text-slate-600 dark:text-white mt-1">{historicSummary.totalSystemStock} pz</div>
                        </div>
                        <div className="p-2 bg-slate-50 dark:bg-black/25 rounded-lg">
                          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Contados</div>
                          <div className="font-mono font-bold text-slate-600 dark:text-white mt-1">{historicSummary.totalCountedStock} pz</div>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto max-h-[40vh] flex flex-col gap-2 pr-1 scrollbar-thin">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Diferencias de producto individuales:</span>
                        {historicItems.filter(it => it.counted_stock !== it.system_stock).map(it => {
                          const diff = it.counted_stock - it.system_stock;
                          return (
                            <div key={it.id} className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-[#070c14]/20 flex justify-between items-center">
                              <div>
                                <div className="text-xs font-bold text-slate-750 dark:text-slate-105 uppercase leading-none">{it.product_name}</div>
                                <div className="text-[9px] text-slate-450 mt-1 font-mono">Esp: {it.system_stock} | Real: {it.counted_stock}</div>
                              </div>
                              <span className={`font-mono text-xs font-black ${diff > 0 ? 'text-indigo-500' : 'text-rose-500'}`}>
                                {diff > 0 ? `+${diff}` : diff} pz
                              </span>
                            </div>
                          );
                        })}

                        {historicItems.filter(it => it.counted_stock !== it.system_stock).length === 0 && (
                          <div className="text-center p-12 text-slate-400 text-[10px] font-semibold uppercase leading-normal">
                            ¡Sin diferencias detectadas! El inventario físico coincidió al 100% con el sistema.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

        {/* Footer del Modal */}
        <div className="p-4 bg-slate-50/50 dark:bg-black/25 border-t border-slate-100 dark:border-slate-850/60 flex justify-end select-none">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a233a] dark:text-slate-300 dark:hover:bg-[#202b48] text-slate-650 font-bold text-xs uppercase rounded-xl cursor-pointer transition flex items-center justify-center"
          >
            Cerrar Panel
          </button>
        </div>

      </div>
    </div>
  );
}
