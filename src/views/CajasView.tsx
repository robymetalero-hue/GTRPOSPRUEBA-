import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { hasPermission } from '../utils/permissions';
import { TableSkeleton, EmptyState, StatCardSkeleton } from '../components/UIStateFeedback';
import { 
  Landmark, DollarSign, History, Calendar, Clock, RefreshCw, ChevronRight, X, FileText, 
  UserCheck, HelpCircle, ArrowUpRight, ArrowDownLeft, Sliders, AlertCircle, Plus, Search, CheckCircle2,
  ShoppingBag, AlertTriangle
} from 'lucide-react';

interface CashAccount {
  id: number;
  seller_id: number;
  seller_username: string;
  current_balance: number;
  last_settlement_at: string | null;
  updated_at: string;
}

interface CashMovement {
  id: number;
  seller_id: number;
  sale_id: number | null;
  type: 'venta' | 'devolucion' | 'ajuste' | 'ingreso_manual' | 'retiro_manual';
  amount: number;
  currency: string;
  payment_method: string;
  status: 'pendiente' | 'liquidado';
  notes: string | null;
  created_at: string;
  sale_total?: number;
  sale_discount?: number;
  sale_payment?: string;
}

interface CashSettlement {
  id: number;
  seller_id: number;
  seller_username: string;
  admin_id: number;
  admin_username: string;
  period_start: string;
  period_end: string;
  calculated_amount: number;
  delivered_amount: number;
  difference: number;
  notes: string | null;
  sale_ids: string; // JSON array of numbers
  status: 'confirmada' | 'con_diferencia' | 'anulada_admin';
  created_at: string;
}

interface SaleDetail {
  id: number;
  total: number;
  discount: number;
  payment_method: string;
  created_at: string;
  currency: string;
  exchange_rate: number;
  items?: Array<{
    product_name: string;
    quantity: number;
    price: number;
  }>;
}

export default function CajasView() {
  const { user, showNotification, exchangeRate } = useAppContext();
  const isAdminOrPropietario = user?.role === 'propietario' || hasPermission(user, 'view_other_cash');

  const [activeTab, setActiveTab] = useState<'estado' | 'cierres'>('estado');
  
  // Backend States
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<CashAccount | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [settlements, setSettlements] = useState<CashSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter pending/all movements in detail modal
  const [showOnlyPending, setShowOnlyPending] = useState(true);

  // Ticket trace details modal states
  const [traceTicketId, setTraceTicketId] = useState<number | null>(null);
  const [traceTicketDetails, setTraceTicketDetails] = useState<any | null>(null);
  const [traceTicketItems, setTraceTicketItems] = useState<any[]>([]);
  const [loadingTraceTicket, setLoadingTraceTicket] = useState(false);
  const [showTraceTicketModal, setShowTraceTicketModal] = useState(false);

  const handleOpenTicketTrace = async (saleId: number) => {
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
      showNotification?.("Fallo al conectar para recuperar los detalles del ticket.", "error");
    } finally {
      setLoadingTraceTicket(false);
    }
  };

  // Modals and dialog forms
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSettleFormOpen, setIsSettleFormOpen] = useState(false);
  const [isAdjustFormOpen, setIsAdjustFormOpen] = useState(false);

  // Form parameters
  const [deliveredAmount, setDeliveredAmount] = useState<string>('');
  const [settleNotes, setSettleNotes] = useState<string>('');
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'ingreso_manual' | 'retiro_manual'>('ingreso_manual');
  const [adjustMethod, setAdjustMethod] = useState<string>('Efectivo');
  const [adjustNotes, setAdjustNotes] = useState<string>('');

  // Blind Cash Settlement States
  const [isBlindCashSettlement, setIsBlindCashSettlement] = useState<boolean>(true);
  const [showBlindResult, setShowBlindResult] = useState<boolean>(false);

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [sellerFilter, setSellerFilter] = useState('all');

  // Load account status and historical liquidations
  useEffect(() => {
    fetchAccounts();
    fetchSettlements();
  }, [user, activeTab]);

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'x-user-role': user?.role || '',
      'x-user-id': String(user?.id || ''),
      'x-user-permissions': JSON.stringify(user?.permissions || {})
    };
  };

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/cash-accounts?user_role=${user?.role || ''}&user_id=${user?.id || ''}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
        
        // If logged in as seller, auto-select their own account
        if (!isAdminOrPropietario && data.length > 0) {
          const myAccount = data[0];
          setSelectedAccount(myAccount);
          fetchMovements(myAccount.seller_id);
        }
      } else {
        showNotification?.("No se pudieron cargar las cuentas de caja acumulativa.", "error");
      }
    } catch (err) {
      console.error("Error fetching cash accounts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMovements = async (sellerId: number) => {
    try {
      const res = await fetch(`/api/cash-accounts/${sellerId}/movements?user_role=${user?.role || ''}&user_id=${user?.id || ''}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setMovements(data);
      }
    } catch (err) {
      console.error("Error reading cash movements:", err);
    }
  };

  const fetchSettlements = async () => {
    try {
      const res = await fetch(`/api/cash-settlements?user_role=${user?.role || ''}&user_id=${user?.id || ''}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSettlements(data);
      }
    } catch (err) {
      console.error("Error reading settlements list:", err);
    }
  };

  const handleOpenDetail = (account: CashAccount) => {
    setSelectedAccount(account);
    fetchMovements(account.seller_id);
    setIsDetailModalOpen(true);
  };

  const handleOpenSettle = () => {
    if (!selectedAccount) return;
    setDeliveredAmount('');
    setSettleNotes('');
    setIsBlindCashSettlement(true);
    setShowBlindResult(false);
    setIsSettleFormOpen(true);
  };

  const handleConfirmSettle = async () => {
    if (!selectedAccount) return;
    const deliveredVal = parseFloat(deliveredAmount);
    if (isNaN(deliveredVal) || deliveredVal < 0) {
      showNotification?.("Monto entregado no es válido.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/cash-accounts/${selectedAccount.seller_id}/settle`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          admin_id: user?.id || 1,
          admin_username: user?.username || 'admin',
          delivered_amount: deliveredVal,
          notes: settleNotes || 'Liquidación recibida conforme'
        })
      });

      if (res.ok) {
        const result = await res.json();
        showNotification?.(`✓ Caja de ${selectedAccount.seller_username} liquidada correctamente. Diferencia: ${result.difference.toFixed(2)} Bs.`, "success");
        setIsSettleFormOpen(false);
        setIsDetailModalOpen(false);
        fetchAccounts();
        fetchSettlements();
      } else {
        const err = await res.json();
        showNotification?.(`Error al liquidar: ${err.error}`, "error");
      }
    } catch (err) {
      console.error(err);
      showNotification?.("Fallo de red al liquidar la caja.", "error");
    }
  };

  const handleOpenAdjust = (type: 'ingreso_manual' | 'retiro_manual') => {
    setAdjustType(type);
    setAdjustAmount('');
    setAdjustMethod('Efectivo');
    setAdjustNotes('');
    setIsAdjustFormOpen(true);
  };

  const handleConfirmAdjust = async () => {
    if (!selectedAccount) return;
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      showNotification?.("Debe ingresar un monto numérico válido mayor a cero.", "error");
      return;
    }
    if (!adjustNotes.trim()) {
      showNotification?.("Por favor agregue una descripción justificando el ajuste.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/cash-accounts/${selectedAccount.seller_id}/adjust`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          amount: amt,
          type: adjustType,
          payment_method: adjustMethod,
          notes: adjustNotes
        })
      });

      if (res.ok) {
        showNotification?.(`✓ Movimiento manual registrado con éxito.`, "success");
        setIsAdjustFormOpen(false);
        fetchAccounts();
        fetchMovements(selectedAccount.seller_id);
      } else {
        const err = await res.json();
        showNotification?.(`Error al ajustar: ${err.error}`, "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Desglosar movimientos para Vendedor o Admin
  const calculateMethodTotals = () => {
    const totals: Record<string, number> = {
      'Efectivo': 0,
      'Transferencia': 0,
      'QR': 0,
      'Tarjeta': 0,
      'Otros': 0
    };

    let totalPending = 0;

    movements.forEach(m => {
      if (m.status === 'pendiente') {
        const method = m.payment_method || 'Efectivo';
        const amtInBs = m.currency === 'USD' ? (m.amount * (exchangeRate || 6.96)) : m.amount;
        totalPending += amtInBs;

        if (totals[method] !== undefined) {
          totals[method] += amtInBs;
        } else {
          totals['Otros'] += amtInBs;
        }
      }
    });

    return { totals, totalPending };
  };

  const { totals: methodTotals, totalPending: computedPendingBalance } = calculateMethodTotals();

  // Filtros de liquidaciones históricas
  const filteredSettlements = settlements.filter(s => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch = !q || 
                          (s.seller_username || '').toLowerCase().includes(q) || 
                          (s.admin_username || '').toLowerCase().includes(q) ||
                          (s.notes || '').toLowerCase().includes(q) ||
                          String(s.id).includes(q);
    const matchesSeller = sellerFilter === 'all' || String(s.seller_id) === sellerFilter;
    return matchesSearch && matchesSeller;
  });

  return (
    <div id="cajas-view" className="p-4 md:p-6 overflow-y-auto h-full flex flex-col gap-6 select-none bg-slate-50/50 dark:bg-[#070a10]">
      
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-[#0c111e] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-850/40 gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <Landmark size={20} />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Cajas Acumulativas individuales</h1>
            <p className="text-[11px] text-slate-400 mt-1 font-semibold leading-relaxed">
              {isAdminOrPropietario 
                ? 'Monitorea los saldos acumulados de tus vendedores, recibe efectivo y liquida cuentas sin plazos rígidos.' 
                : 'Visualiza el dinero que has acumulado en tus ventas. Entrega los montos indicados al administrador.'}
            </p>
          </div>
        </div>

        {/* Pestañas (Solo Admin/Propietario ve ambas, Vendedor también para consultar sus liquidaciones) */}
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-black/45 border border-slate-200/40 dark:border-slate-800/80 rounded-xl self-stretch sm:self-auto">
          <button
            onClick={() => setActiveTab('estado')}
            className={`flex-1 sm:flex-none px-4 py-2 text-[10px] uppercase font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'estado' 
                ? 'bg-white dark:bg-[#0f1424] text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-200/50' 
                : 'text-slate-400 hover:text-slate-650'
            }`}
          >
            <UserCheck size={12} />
            Estado de Cajas
          </button>
          <button
            onClick={() => setActiveTab('cierres')}
            className={`flex-1 sm:flex-none px-4 py-2 text-[10px] uppercase font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'cierres' 
                ? 'bg-white dark:bg-[#0f1424] text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-200/50' 
                : 'text-slate-400 hover:text-slate-650'
            }`}
          >
            <History size={12} />
            Liquidaciones Históricas
          </button>
        </div>
      </div>

      {activeTab === 'estado' && (
        <div className="flex flex-col gap-6">
          
          {/* VISTA VENDEDOR INDIVIDUAL */}
          {!isAdminOrPropietario && selectedAccount && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Tarjeta de Saldo Principal */}
              <div className="lg:col-span-1 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl p-6 shadow-md flex flex-col justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Landmark size={120} />
                </div>

                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-indigo-200">MI CAJA ACUMULATIVA</span>
                    <h2 className="text-lg font-black mt-1 uppercase tracking-wide">{selectedAccount.seller_username}</h2>
                  </div>
                  <span className="bg-white/10 text-white border border-white/20 py-0.5 px-2 text-[8px] uppercase rounded-full font-black tracking-widest">
                    ACTIVA
                  </span>
                </div>

                <div className="my-2">
                  <span className="text-[9px] uppercase font-black tracking-widest text-indigo-200">Total pendiente de entrega al administrador</span>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-4xl font-mono font-black tracking-tight">{selectedAccount.current_balance.toFixed(2)}</span>
                    <span className="text-sm font-black">Bs.</span>
                  </div>
                  <p className="text-[10px] text-indigo-100 font-bold mt-2 flex items-center gap-1.5">
                    <Clock size={11} /> 
                    Desde: {selectedAccount.last_settlement_at ? new Date(selectedAccount.last_settlement_at).toLocaleString() : 'Inicio del comercio'}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/15 text-[10px] text-indigo-200 font-bold flex flex-col gap-3">
                  <div className="flex justify-between">
                    <span>Ventas vigentes sin liquidar:</span>
                    <span className="font-mono font-black text-white">{movements.filter(m => m.type === 'venta' && m.status === 'pendiente').length} tickets</span>
                  </div>
                  {isAdminOrPropietario ? (
                    <button
                      onClick={handleOpenSettle}
                      className="w-full mt-2 py-2.5 bg-white text-indigo-700 hover:bg-indigo-50 font-black text-[10px] uppercase rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <CheckCircle2 size={13} />
                      Auto-Liquidar & Resetear mi Caja
                    </button>
                  ) : (
                    <div className="text-center text-[9px] text-indigo-200 bg-white/10 p-2 rounded-lg leading-snug font-medium">
                      * El administrador debe realizar tu arqueo físico de caja para resetear tu saldo a cero.
                    </div>
                  )}
                </div>
              </div>

              {/* Desglose por Métodos de Pago */}
              <div className="lg:col-span-2 bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/80 dark:border-slate-850/40 p-6 flex flex-col justify-between shadow-sm gap-5">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-widest pl-1 mb-4 flex items-center gap-1.5">
                    <Sliders size={12} className="text-indigo-500" />
                    Distribución por método de pago
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {Object.entries(methodTotals).map(([method, amount]) => {
                      let colorClass = 'bg-slate-50 border-slate-100 dark:bg-black/20 dark:border-slate-800 text-slate-700';
                      if (method === 'Efectivo') colorClass = 'bg-emerald-500/5 border-emerald-500/10 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400';
                      if (method === 'QR' || method === 'Transferencia') colorClass = 'bg-indigo-500/5 border-indigo-500/10 dark:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400';

                      return (
                        <div key={method} className={`p-3 rounded-xl border ${colorClass} flex flex-col justify-between gap-2 shadow-xs`}>
                          <span className="text-[9px] font-black uppercase tracking-wider">{method}</span>
                          <span className="text-base font-black font-mono leading-none">{amount.toFixed(2)}<span className="text-[9px] font-bold ml-0.5">Bs</span></span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 border border-indigo-100 dark:border-slate-800 bg-indigo-50/10 dark:bg-black/20 rounded-xl text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 leading-normal flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Recordatorio de Arqueo:</strong> Los importes por transferencias o códigos QR ya han ingresado directamente a las cuentas de la empresa. El efectivo físico debe ser entregado al administrador quien liquidará tu balance y reseteará tu saldo a cero.
                  </span>
                </div>
              </div>

              {/* Listado de movimientos individuales */}
              <div className="lg:col-span-3 bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/80 dark:border-slate-850/40 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-slate-850/60 flex justify-between items-center bg-slate-50/50 dark:bg-black/10">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">Detalle de mis transacciones activas</span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">Total recalculado: {computedPendingBalance.toFixed(2)} Bs.</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/20 dark:bg-slate-950/20 border-b border-slate-150 dark:border-slate-850/60 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="p-3 pl-6">ID Movimiento</th>
                        <th className="p-3">Concepto / Tipo</th>
                        <th className="p-3 text-center">Referencia</th>
                        <th className="p-3 text-center">Método de Pago</th>
                        <th className="p-3">Observaciones / Notas</th>
                        <th className="p-3 text-right">Importe</th>
                        <th className="p-3 pr-6 text-center">Fecha y Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850/40 text-[11px] font-bold">
                      {movements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8">
                            <EmptyState
                              icon={Landmark}
                              title="Sin ventas pendientes de liquidar"
                              description="No posees movimientos o transacciones pendientes de liquidación en tu caja acumulativa activa."
                            />
                          </td>
                        </tr>
                      ) : (
                        movements.map(m => {
                          let typeBadge = 'bg-slate-50 text-slate-500 border-slate-150';
                          let icon = <DollarSign size={10} />;
                          let amtColor = 'text-slate-800 dark:text-slate-250';

                          if (m.type === 'venta') {
                            typeBadge = 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/10';
                            icon = <ArrowDownLeft size={10} />;
                            amtColor = 'text-emerald-600 dark:text-emerald-400';
                          } else if (m.type === 'devolucion') {
                            typeBadge = 'bg-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/10';
                            icon = <ArrowUpRight size={10} />;
                            amtColor = 'text-rose-600 dark:text-rose-400';
                          } else if (m.type === 'ingreso_manual') {
                            typeBadge = 'bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/10';
                            amtColor = 'text-indigo-650 dark:text-indigo-400';
                          } else if (m.type === 'retiro_manual') {
                            typeBadge = 'bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/10';
                            amtColor = 'text-amber-650 dark:text-amber-400';
                          }

                          return (
                            <tr key={m.id} className="hover:bg-slate-50/30 dark:hover:bg-[#0d1221]/20">
                              <td className="p-3 pl-6 font-mono text-slate-400">#MOV-{m.id}</td>
                              <td className="p-3">
                                <span className={`inline-flex items-center gap-1.5 py-0.5 px-2 border rounded-full text-[9px] uppercase font-black ${typeBadge}`}>
                                  {icon}
                                  {m.type === 'venta' ? 'VENTA REGISTRADA' : m.type === 'devolucion' ? 'DEVOLUCIÓN' : m.type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono text-slate-500">{m.sale_id ? `Ticket #${m.sale_id}` : 'Manual'}</td>
                              <td className="p-3 text-center">
                                <span className="bg-slate-50 dark:bg-black/30 border border-slate-200/50 dark:border-slate-850 py-0.5 px-2 text-[9px] rounded-lg">
                                  {m.payment_method}
                                </span>
                              </td>
                              <td className="p-3 text-slate-400 font-semibold">{m.notes || '-'}</td>
                              <td className={`p-3 text-right font-black font-mono text-xs ${amtColor}`}>
                                {m.amount > 0 ? `+${m.amount.toFixed(2)}` : m.amount.toFixed(2)} Bs.
                              </td>
                              <td className="p-3 pr-6 text-center font-mono text-slate-450 text-[9.5px]">{new Date(m.created_at).toLocaleString()}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VISTA ADMINISTRADOR/PROPIETARIO (LISTADO DE TODAS LAS CAJAS) */}
          {isAdminOrPropietario && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {accounts.map(acc => {
                return (
                  <div key={acc.id} className="bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/80 dark:border-slate-850/40 p-5 flex flex-col justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-800 transition shadow-xs">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-850/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#f1f5f9] dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 flex items-center justify-center font-black text-xs text-slate-705 dark:text-slate-350 uppercase">
                          {acc.seller_username.slice(0, 2)}
                        </div>
                        <div>
                          <span className="font-extrabold text-xs text-slate-800 dark:text-white uppercase leading-none">{acc.seller_username}</span>
                          <div className="text-[8px] tracking-wider text-slate-400 uppercase font-black mt-0.5">CAJA ACUMULATIVA</div>
                        </div>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full ${acc.current_balance > 0 ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`}></span>
                    </div>

                    <div className="flex flex-col gap-1.5 my-1">
                      <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest pl-1">Saldo acumulado por entregar</span>
                      <div className="flex justify-between items-baseline p-3 bg-slate-50/50 dark:bg-black/25 border border-slate-150/40 dark:border-slate-850/80 rounded-xl">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-mono font-black text-slate-800 dark:text-indigo-400">
                            {acc.current_balance.toFixed(2)}
                          </span>
                          <span className="text-[10px] font-black text-slate-400">Bs.</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 font-bold">
                          ~ ${(acc.current_balance / exchangeRate).toFixed(2)} USD
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] font-semibold text-slate-400 flex flex-col gap-1.5 pl-1">
                      <p className="flex items-center gap-1.5">
                        <Calendar size={11} className="text-indigo-400" />
                        <span>Último reseteo: {acc.last_settlement_at ? new Date(acc.last_settlement_at).toLocaleDateString() : 'Nunca liquidado'}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleOpenDetail(acc)}
                      className="w-full py-2.5 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-[#11192e] dark:text-indigo-400 text-indigo-650 font-extrabold text-[10.5px] uppercase rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      <FileText size={12} />
                      Ver Detalle & Liquidar
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {activeTab === 'cierres' && (
        <div className="bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/80 dark:border-slate-850/40 overflow-hidden flex flex-col shadow-xs">
          
          {/* Barra de Filtros */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-850/60 bg-slate-50/50 dark:bg-black/10 flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Buscar por vendedor o administrador..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-xs font-semibold pl-9 pr-4 py-2 bg-white dark:bg-[#11192e] border border-slate-250 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-850 dark:text-white"
              />
            </div>

            {isAdminOrPropietario && (
              <div className="flex gap-2 items-center w-full sm:w-auto justify-end">
                <label className="text-[10px] uppercase font-black text-slate-400">Filtrar por Vendedor:</label>
                <select
                  value={sellerFilter}
                  onChange={e => setSellerFilter(e.target.value)}
                  className="text-xs font-bold p-1.5 border border-slate-250 dark:border-slate-800 bg-white dark:bg-[#11192e] rounded-lg focus:outline-none text-slate-700 dark:text-white"
                >
                  <option value="all">TODOS</option>
                  {Array.from(new Set(settlements.map(s => s.seller_username))).map((name) => {
                    const id = settlements.find(s => s.seller_username === name)?.seller_id;
                    return <option key={id} value={String(id)}>{String(name || '').toUpperCase()}</option>;
                  })}
                </select>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/25 dark:bg-slate-950/20 border-b border-slate-150 dark:border-slate-850/60 text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-4">
                  <th className="p-4 pl-6">ID Liquidación</th>
                  <th className="p-4">Vendedor</th>
                  <th className="p-4">Recibido Por (Admin)</th>
                  <th className="p-4">Periodo de Arqueo</th>
                  <th className="p-4 text-right">Monto Estimado</th>
                  <th className="p-4 text-right">Monto Entregado</th>
                  <th className="p-4 text-right">Diferencia</th>
                  <th className="p-4">Notas / Notas</th>
                  <th className="p-4 pr-6 text-center">Fecha Arqueo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850/50 text-[11px] font-bold">
                {filteredSettlements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8">
                      <EmptyState
                        icon={History}
                        title="Sin liquidaciones históricas"
                        description="No se registran liquidaciones históricas de caja acumulativa de vendedores bajo los filtros seleccionados."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredSettlements.map(settle => {
                    const hasDiff = settle.difference !== 0;
                    const diffColor = settle.difference === 0 
                      ? 'text-emerald-500' 
                      : settle.difference > 0 
                        ? 'text-indigo-500' 
                        : 'text-rose-500';

                    return (
                      <tr key={settle.id} className="hover:bg-slate-50/30 dark:hover:bg-[#0d1221]/30">
                        <td className="p-4 pl-6 font-mono text-slate-400">#LIQ-{settle.id}</td>
                        <td className="p-4 text-slate-800 dark:text-slate-105 uppercase">{settle.seller_username}</td>
                        <td className="p-4 text-slate-500 uppercase">{settle.admin_username}</td>
                        <td className="p-4 text-slate-400 font-mono text-[10px] leading-relaxed">
                          {settle.period_start ? new Date(settle.period_start).toLocaleDateString() : 'N/A'} - {settle.period_end ? new Date(settle.period_end).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-500">{settle.calculated_amount.toFixed(2)} Bs.</td>
                        <td className="p-4 text-right font-mono text-indigo-650 dark:text-indigo-400 font-black">{settle.delivered_amount.toFixed(2)} Bs.</td>
                        <td className={`p-4 text-right font-black font-mono ${diffColor}`}>
                          {settle.difference > 0 ? `+${settle.difference.toFixed(2)}` : settle.difference.toFixed(2)} Bs.
                        </td>
                        <td className="p-4 text-slate-400 font-semibold max-w-[180px] truncate">{settle.notes || '-'}</td>
                        <td className="p-4 pr-6 text-center font-mono text-slate-450 text-[10px]">{new Date(settle.created_at).toLocaleString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODAL DETALLE DE CAJA Y LIQUIDACIÓN (SOLO ADMIN/PROPIETARIO) --- */}
      {isDetailModalOpen && selectedAccount && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c111e] rounded-2xl w-full max-w-4xl border border-slate-150 dark:border-slate-850 flex flex-col gap-4 shadow-2xl overflow-hidden max-h-[90vh]">
            
            {/* Header del Modal */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-850/60 flex justify-between items-center bg-slate-50/50 dark:bg-black/10 select-none">
              <div>
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-white">
                  Auditoría de Caja Activa: {selectedAccount.seller_username}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-normal">
                  Visualiza los tickets sin liquidar, ingresa ajustes manuales directos, y consolida saldo.
                </p>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-650 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Panel de Control de Saldo y Ajustes Manuales */}
            <div className="px-5 grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-indigo-50/50 dark:bg-black/25 rounded-xl border border-indigo-100/40 dark:border-slate-800/80 flex flex-col justify-between sm:col-span-2">
                <div>
                  <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider">Saldo calculado en sistema:</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black font-mono text-indigo-650 dark:text-indigo-400">{selectedAccount.current_balance.toFixed(2)}</span>
                    <span className="text-xs font-black text-slate-400">Bs.</span>
                  </div>
                </div>
                <div className="text-[9.5px] font-semibold text-slate-400 mt-2">
                  Periodo acumulado desde {selectedAccount.last_settlement_at ? new Date(selectedAccount.last_settlement_at).toLocaleString() : 'el origen del comercio'}.
                </div>
              </div>

              {/* Acciones Rápidas de Ajuste */}
              {isAdminOrPropietario && (
                <div className="p-4 bg-slate-50/50 dark:bg-black/25 rounded-xl border border-slate-100 dark:border-slate-800/80 sm:col-span-2 flex flex-col justify-between gap-3">
                  <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider">Movimiento de Caja Manual Auxiliar</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenAdjust('ingreso_manual')}
                      className="flex-1 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 font-black text-[10px] uppercase rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus size={11} /> Ingreso
                    </button>
                    <button
                      onClick={() => handleOpenAdjust('retiro_manual')}
                      className="flex-1 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 font-black text-[10px] uppercase rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowUpRight size={11} /> Retiro
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Listado de movimientos de este vendedor */}
            <div className="flex-1 overflow-y-auto px-5 border-t border-b border-slate-100 dark:border-slate-850/60 py-1">
              <div className="flex justify-between items-center py-2 select-none">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Transacciones:</span>
                <div className="flex bg-slate-100 dark:bg-black/40 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-850">
                  <button
                    onClick={() => setShowOnlyPending(true)}
                    className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                      showOnlyPending
                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-black'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Activo (Sin Liquidar)
                  </button>
                  <button
                    onClick={() => setShowOnlyPending(false)}
                    className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                      !showOnlyPending
                        ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-xs font-black'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Todo el Historial
                  </button>
                </div>
              </div>

              <div className="border border-slate-100 dark:border-slate-850/65 rounded-xl overflow-hidden mt-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-150 dark:border-slate-850/60 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="p-3 pl-4">ID</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3 text-center">Referencia</th>
                      <th className="p-3 text-center">Pago</th>
                      <th className="p-3">Notas</th>
                      <th className="p-3 text-right">Monto</th>
                      <th className="p-3 text-center pr-4">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850/50 text-[10.5px] font-bold">
                    {(() => {
                      const displayedMovements = showOnlyPending 
                        ? movements.filter(m => m.status === 'pendiente') 
                        : movements;

                      if (displayedMovements.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold uppercase tracking-wider">
                              No se registran transacciones {showOnlyPending ? 'pendientes' : ''} para este arqueo de caja.
                            </td>
                          </tr>
                        );
                      }

                      return displayedMovements.map(m => {
                        let typeBadge = 'bg-slate-50 text-slate-500 border-slate-150';
                        let amtColor = 'text-slate-800 dark:text-slate-205';

                        if (m.type === 'venta') {
                          typeBadge = 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/10';
                          amtColor = 'text-emerald-600 dark:text-emerald-400';
                        } else if (m.type === 'devolucion') {
                          typeBadge = 'bg-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/10';
                          amtColor = 'text-rose-600 dark:text-rose-400';
                        } else if (m.type === 'ingreso_manual') {
                          typeBadge = 'bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/10';
                          amtColor = 'text-indigo-650 dark:text-indigo-400';
                        } else if (m.type === 'retiro_manual') {
                          typeBadge = 'bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/10';
                          amtColor = 'text-amber-650 dark:text-amber-400';
                        }

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                            <td className="p-3 pl-4 font-mono text-slate-400">#{m.id}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center py-0.5 px-2 border rounded-full text-[8.5px] uppercase font-black ${typeBadge}`}>
                                {m.type === 'venta' ? 'VENTA' : m.type === 'devolucion' ? 'DEVOLUCIÓN' : m.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono">
                              {m.sale_id ? (
                                <button
                                  onClick={() => handleOpenTicketTrace(m.sale_id!)}
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline hover:text-indigo-800 dark:hover:text-indigo-300 transition cursor-pointer font-bold bg-transparent border-0 p-0"
                                >
                                  Ticket #{m.sale_id}
                                </button>
                              ) : (
                                <span className="text-slate-400">Manual</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className="bg-slate-50 dark:bg-black/30 border border-slate-200/50 dark:border-slate-850 py-0.5 px-2 text-[9px] rounded-lg">
                                {m.payment_method}
                              </span>
                            </td>
                            <td className="p-3 text-slate-400 font-semibold max-w-[200px] truncate">{m.notes || '-'}</td>
                            <td className={`p-3 text-right font-black font-mono ${amtColor}`}>
                              {m.amount > 0 ? `+${m.amount.toFixed(2)}` : m.amount.toFixed(2)} Bs.
                            </td>
                            <td className="p-3 text-center pr-4 font-mono text-slate-450 text-[9px]">{new Date(m.created_at).toLocaleString()}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer de Acciones de Modal */}
            <div className="p-4 bg-slate-50/50 dark:bg-black/25 border-t border-slate-100 dark:border-slate-850/60 flex justify-between items-center select-none">
              <button 
                onClick={() => setIsDetailModalOpen(false)} 
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 font-bold text-[10.5px] uppercase cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                Cerrar Auditoría
              </button>
              
              {isAdminOrPropietario && (selectedAccount.current_balance !== 0 || movements.some(m => m.status === 'pendiente')) && (
                <button 
                  onClick={handleOpenSettle}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10.5px] uppercase rounded-xl cursor-pointer shadow-md shadow-indigo-500/10 transition flex items-center gap-1.5"
                >
                  <CheckCircle2 size={13} />
                  Liquidar Caja (Resetear)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- FORMULARIO DE LIQUIDACIÓN / ARQUEO DE CAJA CIEGA --- */}
      {isSettleFormOpen && selectedAccount && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-in zoom-in-95 duration-200 select-none">
          <div className="bg-white dark:bg-[#0f1424] rounded-2xl w-full max-w-lg p-6 border border-slate-200 dark:border-slate-850 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-2.5">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-805 dark:text-white">
                  Arqueo de Caja {isBlindCashSettlement ? 'a Ciegas' : ''}: {selectedAccount.seller_username}
                </h3>
                <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md border border-indigo-500/20">
                  {isBlindCashSettlement ? '🛡️ Ciega' : 'Transparente'}
                </span>
              </div>
              <button onClick={() => setIsSettleFormOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Toggle Modo Ciego */}
            <div className="flex items-center justify-between p-3 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <div>
                <span className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight block">
                  Modo Arqueo a Ciegas
                </span>
                <span className="text-[9.5px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Oculta el saldo esperado del sistema al cajero/auditor durante la entrega física.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isBlindCashSettlement}
                  onChange={e => {
                    setIsBlindCashSettlement(e.target.checked);
                    setShowBlindResult(false);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Saldo Esperado en Sistema (Oculto o Visible) */}
            <div className="bg-slate-50 dark:bg-black/20 p-3.5 rounded-xl border border-slate-100 dark:border-slate-850 flex justify-between items-center">
              <span className="text-[9.5px] uppercase font-black text-slate-400">Saldo Esperado en Sistema:</span>
              <span className="text-base font-black font-mono text-slate-800 dark:text-white">
                {isBlindCashSettlement && !showBlindResult ? (
                  <span className="text-indigo-500 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest bg-indigo-500/10 px-2 py-1 rounded">
                    ***.** Bs. (Oculto a Ciegas)
                  </span>
                ) : (
                  `${selectedAccount.current_balance.toFixed(2)} Bs.`
                )}
              </span>
            </div>

            {/* Entrada del Monto Entregado */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-450 pl-1">
                Monto Entregado Físicamente en Caja (Bs.)
              </label>
              <input 
                type="number"
                step="0.01"
                className="w-full text-base font-extrabold font-mono p-3 rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-black/50 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                placeholder="Ingresa el monto total contado..."
                value={deliveredAmount}
                onChange={e => {
                  setDeliveredAmount(e.target.value);
                  setShowBlindResult(false);
                }}
              />

              {/* Resultado de Discrepancia si se reveló o si está en modo transparente */}
              {deliveredAmount && !isNaN(parseFloat(deliveredAmount)) && (!isBlindCashSettlement || showBlindResult) && (
                <div className="p-3 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs font-bold mt-1">
                  <span className="text-slate-500 uppercase text-[10px]">Diferencia de Arqueo:</span>
                  <span className={`font-mono text-sm font-black ${
                    parseFloat(deliveredAmount) - selectedAccount.current_balance === 0 
                      ? 'text-emerald-500' 
                      : parseFloat(deliveredAmount) - selectedAccount.current_balance > 0 
                        ? 'text-indigo-500' 
                        : 'text-rose-500'
                  }`}>
                    {(parseFloat(deliveredAmount) - selectedAccount.current_balance) === 0
                      ? '✓ Sin Discrepancia (0.00 Bs.)'
                      : (parseFloat(deliveredAmount) - selectedAccount.current_balance) > 0
                        ? `+${(parseFloat(deliveredAmount) - selectedAccount.current_balance).toFixed(2)} Bs. (Sobrante)`
                        : `${(parseFloat(deliveredAmount) - selectedAccount.current_balance).toFixed(2)} Bs. (Faltante)`
                    }
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-450 pl-1">Observaciones / Notas del Arqueo</label>
              <textarea 
                rows={2}
                className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-black/50 text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500"
                placeholder="Ej. Arqueo a ciegas sin novedades, billetes en sobre sellado #412."
                value={settleNotes}
                onChange={e => setSettleNotes(e.target.value)}
              />
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-2.5 mt-2">
              <button 
                type="button"
                onClick={() => setIsSettleFormOpen(false)}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 font-bold text-xs uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 transition"
              >
                Cancelar
              </button>

              {isBlindCashSettlement && !showBlindResult && (
                <button
                  type="button"
                  onClick={() => {
                    if (!deliveredAmount || isNaN(parseFloat(deliveredAmount))) {
                      showNotification?.("Ingresa primero la cantidad física contada.", "error");
                      return;
                    }
                    setShowBlindResult(true);
                  }}
                  className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-extrabold text-xs rounded-xl cursor-pointer uppercase transition hover:bg-amber-500/20"
                >
                  Revelar Discrepancia
                </button>
              )}

              <button 
                type="button"
                onClick={handleConfirmSettle}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer uppercase transition"
              >
                Confirmar Arqueo & Resetear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FORMULARIO DE INGRESO / RETIRO AUXILIAR MANUAL --- */}
      {isAdjustFormOpen && selectedAccount && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-in zoom-in-95 duration-200 select-none">
          <div className="bg-white dark:bg-[#0f1424] rounded-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-850 flex flex-col gap-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-2.5">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-indigo-500">
                {adjustType === 'ingreso_manual' ? 'Registrar Ingreso Manual en Caja' : 'Registrar Retiro Manual en Caja'}
              </h3>
              <button onClick={() => setIsAdjustFormOpen(false)} className="text-slate-400 hover:text-slate-650 dark:hover:text-white">
                <X size={16} />
              </button>
            </div>

            <p className="text-[10.5px] font-semibold text-slate-400 leading-normal">
              Inserta un movimiento monetario directo para corregir balances, registrar retiros para compras rápidas u otros ingresos de mostrador.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-450 pl-1">Importe en Bs.</label>
              <input 
                type="number"
                step="0.01"
                className="w-full text-sm font-bold font-mono p-2.5 rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-black/50 text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500"
                placeholder="0.00 Bs."
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-450 pl-1">Método de Pago</label>
              <select
                value={adjustMethod}
                onChange={e => setAdjustMethod(e.target.value)}
                className="text-xs font-bold p-2.5 border border-slate-250 dark:border-slate-800 bg-white dark:bg-black/50 text-slate-850 dark:text-white rounded-xl focus:outline-none focus:border-indigo-500"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="QR">QR</option>
                <option value="Tarjeta">Tarjeta</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-450 pl-1">Motivo / Justificación</label>
              <textarea 
                rows={2}
                className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-black/50 text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500"
                placeholder="Ej: Retiro para compra de insumos de papelería."
                value={adjustNotes}
                onChange={e => setAdjustNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button 
                onClick={() => setIsAdjustFormOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 font-bold text-xs uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmAdjust}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer uppercase transition"
              >
                Registrar Movimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {showTraceTicketModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4 overflow-y-auto">
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
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer transition-all"
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
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
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
                            return (
                              <tr key={item.id} className="border-b border-slate-100 dark:border-slate-850/40 last:border-0 text-slate-600 dark:text-slate-300">
                                <td className="p-3">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{item.product_name || 'Producto'}</span>
                                    <span className="text-[8.5px] font-mono text-slate-400 mt-0.5">SKU: {item.product_sku_snapshot || item.sku || 'N/A'}</span>
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

    </div>
  );
}
