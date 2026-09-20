import React, { useEffect, useState } from 'react';
import { useAppContext, firestoreDb } from '../context/AppContext';
import { isMainAdmin } from '../utils/permissions';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { 
    Users, UserPlus, ShieldAlert, CheckSquare, Square, Save, 
    ShieldCheck, KeyRound, Pencil, Trash2, X, Check, Shield, User, AlertTriangle,
    History, Search, RefreshCw, Eye, ShoppingCart, Tag, Landmark, Lock
} from 'lucide-react';

interface PermissionGroup {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: Array<{
    key: string;
    label: string;
    description: string;
    defaultValue: boolean;
  }>;
}

const ALL_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'ventas_carrito',
    title: 'Permisos de Ventas y Carrito',
    icon: <ShoppingCart size={15} className="text-blue-500" />,
    items: [
      { key: 'create_sales', label: 'Crear ventas', description: 'Permite confirmar y registrar ventas en el POS.', defaultValue: true },
      { key: 'add_to_cart', label: 'Agregar al carrito', description: 'Permite añadir productos al carro de compras.', defaultValue: true },
      { key: 'remove_from_cart', label: 'Quitar del carrito', description: 'Permite quitar productos individuales del carro.', defaultValue: true },
      { key: 'change_quantities', label: 'Cambiar cantidades', description: 'Permite alterar cantidades de productos en el carro.', defaultValue: true },
      { key: 'clear_cart', label: 'Vaciar el carrito', description: 'Permite vaciar por completo el carro de compras.', defaultValue: true },
      { key: 'apply_discounts', label: 'Aplicar descuentos', description: 'Permite registrar descuentos porcentuales o fijos.', defaultValue: true },
      { key: 'modify_prices', label: 'Modificar precios manuales', description: 'Permite alterar el precio unitario del ítem durante la venta.', defaultValue: false },
      { key: 'select_price_unit', label: 'Seleccionar precio unitario', description: 'Permite elegir el precio al detalle.', defaultValue: true },
      { key: 'select_price_bulk', label: 'Seleccionar precio al por mayor', description: 'Permite elegir la tarifa por mayor.', defaultValue: true },
      { key: 'sell_below_price', label: 'Vender bajo precio sugerido', description: 'Permite registrar tarifas menores a las asignadas.', defaultValue: false },
      { key: 'sell_below_cost', label: 'Vender por debajo del costo', description: 'Permite vender perdiendo utilidad (bajo el costo).', defaultValue: false },
      { key: 'cancel_before_confirm', label: 'Cancelar venta pre-confirmación', description: 'Permite anular el carro antes de registrar pago.', defaultValue: true },
      { key: 'void_confirmed_sale', label: 'Anular venta confirmada', description: 'Permite anular ventas ya registradas históricas.', defaultValue: false },
      { key: 'edit_sale', label: 'Editar venta', description: 'Permite editar transacciones históricas registradas.', defaultValue: false },
      { key: 'make_refunds', label: 'Realizar devoluciones', description: 'Permite procesar reincorporaciones de stock por reembolso.', defaultValue: false },
      { key: 'reprint_tickets', label: 'Reimprimir tickets', description: 'Permite emitir copias físicas de facturas y tickets.', defaultValue: true },
      { key: 'view_past_sales', label: 'Ver ventas anteriores', description: 'Permite listar el histórico general del negocio.', defaultValue: true },
      { key: 'view_own_sales_only', label: 'Ver solo ventas propias', description: 'Restringe el historial únicamente a su usuario activo.', defaultValue: true },
      { key: 'view_other_sales', label: 'Ver ventas de otros', description: 'Permite monitorear el histórico de otros cajeros.', defaultValue: false },
      { key: 'create_pending_sales', label: 'Crear ventas pendientes', description: 'Permite guardar carros de compra en espera.', defaultValue: true },
      { key: 'edit_pending_sales', label: 'Editar ventas pendientes', description: 'Permite alterar notas o cantidades de preventas.', defaultValue: true },
      { key: 'delete_pending_sales', label: 'Eliminar ventas pendientes', description: 'Permite anular pre-tickets guardados.', defaultValue: true },
      { key: 'complete_pending_sales', label: 'Completar ventas pendientes', description: 'Permite consolidar preventas a ventas de mostrador.', defaultValue: true },
      { key: 'manage_credits', label: 'Gestionar Créditos y CxC', description: 'Permite abrir y gestionar el módulo de Ventas Pendientes y Cuentas por Cobrar (CxC).', defaultValue: true }
    ]
  },
  {
    id: 'inventario',
    title: 'Permisos de Inventario',
    icon: <Tag size={15} className="text-indigo-500" />,
    items: [
      { key: 'view_inventory', label: 'Ver inventario', description: 'Permite ingresar a la pestaña general de almacén.', defaultValue: true },
      { key: 'view_stock_available', label: 'Ver cantidad disponible', description: 'Permite ver las cantidades físicas exactas.', defaultValue: true },
      { key: 'view_sale_prices', label: 'Ver precios de venta', description: 'Muestra las tarifas de venta asignadas.', defaultValue: true },
      { key: 'view_wholesale_prices', label: 'Ver precios por mayor', description: 'Muestra tarifas de tarifa por mayor.', defaultValue: true },
      { key: 'view_purchase_prices', label: 'Ver precios de compra', description: 'Muestra el precio unitario pagado al proveedor.', defaultValue: false },
      { key: 'view_costs', label: 'Ver costos', description: 'Permite acceder a los costos agregados del producto.', defaultValue: false },
      { key: 'view_profits', label: 'Ver ganancias', description: 'Calcula y expone utilidades netas teóricas.', defaultValue: false },
      { key: 'add_products', label: 'Agregar productos', description: 'Permite crear nuevos registros en catálogo.', defaultValue: false },
      { key: 'edit_products', label: 'Editar productos', description: 'Permite modificar SKU, nombre o precios.', defaultValue: false },
      { key: 'delete_products', label: 'Eliminar productos', description: 'Permite borrar productos de catálogo.', defaultValue: false },
      { key: 'increase_stock', label: 'Aumentar stock', description: 'Permite registrar entradas de mercadería rápidas.', defaultValue: false },
      { key: 'decrease_stock', label: 'Disminuir stock', description: 'Permite egresar mercadería por mermas o pérdidas.', defaultValue: false },
      { key: 'inventory_adjustments', label: 'Ajustes de inventario', description: 'Permite alterar cantidades arbitrariamente.', defaultValue: false },
      { key: 'view_stock_movements', label: 'Ver movimientos de inventario', description: 'Muestra la trazabilidad detallada de stock.', defaultValue: true },
      { key: 'physical_control_checklist', label: 'Conteo físico checklist', description: 'Permite auditar el almacén mediante checklist.', defaultValue: true },
      { key: 'preview_quantities_in_count', label: 'Previsualizar cantidades (Conteo)', description: 'Permite deshabilitar el modo ciego para ver el stock durante la auditoría.', defaultValue: false },
      { key: 'confirm_stock_differences', label: 'Confirmar diferencias', description: 'Calcula diferencias del conteo físico.', defaultValue: false },
      { key: 'correct_stock_differences', label: 'Corregir diferencias', description: 'Aplica ajustes físicos automáticos basados en conteo.', defaultValue: false }
    ]
  },
  {
    id: 'caja',
    title: 'Permisos de Caja',
    icon: <Landmark size={15} className="text-emerald-500" />,
    items: [
      { key: 'view_own_cash_accumulated', label: 'Ver su caja acumulada', description: 'Muestra el saldo activo de su propia caja.', defaultValue: true },
      { key: 'view_own_sales_detail', label: 'Ver detalle de sus ventas', description: 'Muestra los tickets desglosados propios.', defaultValue: true },
      { key: 'view_own_tickets', label: 'Ver sus tickets', description: 'Permite listar facturas emitidas por su terminal.', defaultValue: true },
      { key: 'view_other_cash', label: 'Ver cajas de otros', description: 'Permite ver saldos o listados de otros cajeros.', defaultValue: false },
      { key: 'reset_own_cash', label: 'Resetear su propia caja', description: 'Permite poner en cero su caja acumulada.', defaultValue: false },
      { key: 'reset_other_cash', label: 'Resetear cajas de otros', description: 'Permite consolidar saldos de otros vendedores.', defaultValue: false },
      { key: 'view_reset_history', label: 'Ver historial de reseteos', description: 'Muestra auditoría de arqueos pasados.', defaultValue: false },
      { key: 'register_withdrawals', label: 'Registrar retiros manuales', description: 'Permite registrar egresos auxiliares en efectivo.', defaultValue: false },
      { key: 'register_manual_incomes', label: 'Registrar ingresos manuales', description: 'Permite registrar depósitos manuales.', defaultValue: false },
      { key: 'modify_cash_movements', label: 'Modificar movimientos de caja', description: 'Permite corregir importes de transacciones de arqueo.', defaultValue: false },
      { key: 'manage_caja', label: 'Gestionar Cajas', description: 'Permite abrir y gestionar el módulo de Cajas, Arqueos y movimientos de efectivo.', defaultValue: true }
    ]
  },
  {
    id: 'administrativos',
    title: 'Permisos Administrativos',
    icon: <Lock size={15} className="text-rose-500" />,
    items: [
      { key: 'view_dashboard', label: 'Ver Dashboard general', description: 'Da acceso a métricas globales de venta.', defaultValue: false },
      { key: 'view_total_sales', label: 'Ver ventas totales', description: 'Muestra montos brutos consolidados.', defaultValue: false },
      { key: 'view_revenues', label: 'Ver ingresos', description: 'Muestra las ganancias brutas e ingresos.', defaultValue: false },
      { key: 'view_costs_admin', label: 'Ver costos administrativos', description: 'Expone la valorización monetaria de inventario.', defaultValue: false },
      { key: 'view_profits_admin', label: 'Ver utilidades administrativas', description: 'Muestra retornos netos de inversión.', defaultValue: false },
      { key: 'view_utility_percentages', label: 'Ver porcentaje de utilidad', description: 'Visualiza márgenes porcentuales por ítem.', defaultValue: false },
      { key: 'view_exchange_rate', label: 'Ver tipo de cambio', description: 'Visualiza la tasa de conversión BOB/USD.', defaultValue: true },
      { key: 'modify_exchange_rate', label: 'Modificar tipo de cambio', description: 'Permite actualizar el tipo de cambio del POS.', defaultValue: false },
      { key: 'view_general_reports', label: 'Ver reportes generales', description: 'Habilita visualización de estadísticas avanzadas.', defaultValue: false },
      { key: 'export_info', label: 'Exportar información', description: 'Habilita exportaciones a Excel/CSV o PDF.', defaultValue: false },
      { key: 'admin_users', label: 'Administrar usuarios', description: 'Habilita la creación y edición de cajeros.', defaultValue: false },
      { key: 'admin_permissions', label: 'Administrar permisos', description: 'Acceso a esta consola de privilegios.', defaultValue: false },
      { key: 'view_audit', label: 'Ver bitácora de auditoría', description: 'Muestra logs detallados de seguridad y almacén.', defaultValue: false },
      { key: 'access_ai', label: 'Acceso a la IA (GTR-Heurística)', description: 'Permite interactuar con el asistente de voz y comandos rápidos de Inteligencia Artificial.', defaultValue: true },
      { key: 'access_forensic_audit', label: 'Auditoría Forense con IA', description: 'Permite acceder al módulo forense de revisión matemática profunda de registros, cálculo de libro mayor y diagnóstico de discrepancias con IA.', defaultValue: false }
    ]
  }
];

export default function PermissionsConsole() {
    const { user, setUser } = useAppContext();
    const [workers, setWorkers] = useState<any[]>([]);
    
    // Form and UI States
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [originalPermissions, setOriginalPermissions] = useState<any | null>(null);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<'admin' | 'vendedor' | 'propietario'>('vendedor');
    
    // Full Granular Permissions State Map
    const [permissionsState, setPermissionsState] = useState<Record<string, boolean>>(() => {
      const initial: Record<string, boolean> = {};
      ALL_PERMISSION_GROUPS.forEach(g => {
        g.items.forEach(item => {
          initial[item.key] = item.defaultValue;
        });
      });
      return initial;
    });

    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    // Security Audit Log States
    const [securityLogs, setSecurityLogs] = useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [searchLogQuery, setSearchLogQuery] = useState("");
    const [filterLogAction, setFilterLogAction] = useState("all");

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => {
            setNotification(null);
        }, 4000);
    };

    const fetchSecurityLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const q = query(collection(firestoreDb, 'security_logs'), orderBy('timestamp', 'desc'), limit(50));
            const querySnapshot = await getDocs(q);
            const logs: any[] = [];
            querySnapshot.forEach((doc) => {
                logs.push({ id: doc.id, ...doc.data() });
            });
            setSecurityLogs(logs);
        } catch (e: any) {
            console.warn("Security logs unavailable or offline in Firestore:", e?.message || e);
            setSecurityLogs([]);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    const logSecurityAction = async (targetUsername: string, actionType: string, changes: string) => {
        try {
            await addDoc(collection(firestoreDb, 'security_logs'), {
                admin_username: user?.username || 'admin',
                target_username: targetUsername,
                action_type: actionType,
                changes: changes,
                timestamp: new Date().toISOString()
            });
            fetchSecurityLogs();
        } catch (e: any) {
            console.warn("Could not log security action to Firestore:", e?.message || e);
        }
    };

    const loadUsers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setWorkers(data);
            }
        } catch (e: any) {
            console.error(e?.message || String(e));
        }
    };

    useEffect(() => {
        loadUsers();
        if (user?.role === 'admin' || user?.role === 'propietario') {
            fetchSecurityLogs();
        }
        
        const handleAiRefresh = () => {
            loadUsers();
            if (user?.role === 'admin' || user?.role === 'propietario') {
                fetchSecurityLogs();
            }
        };
        window.addEventListener('aiUsersRefresh', handleAiRefresh);
        return () => {
            window.removeEventListener('aiUsersRefresh', handleAiRefresh);
        };
    }, [user]);

    const resetForm = () => {
        setEditingUser(null);
        setOriginalPermissions(null);
        setUsername("");
        setPassword("");
        setEmail("");
        setRole('vendedor');
        
        // Reset permissions to default values
        const defaults: Record<string, boolean> = {};
        ALL_PERMISSION_GROUPS.forEach(g => {
          g.items.forEach(item => {
            defaults[item.key] = item.defaultValue;
          });
        });
        setPermissionsState(defaults);
    };

    const handleEditClick = (u: any) => {
        const isTargetMainAdmin = isMainAdmin(u);
        const isCurrentMainAdmin = isMainAdmin(user);

        if (isTargetMainAdmin && !isCurrentMainAdmin) {
            showNotification("El Administrador Principal solo puede ser editado por sí mismo.", "error");
            return;
        }

        setEditingUser(u);
        setUsername(u.username);
        setPassword(""); // Require re-typing password only if editing
        setEmail(u.email || "");
        setRole(u.role || 'vendedor');
        
        // Load user permissions from DB or default to group values
        const userPermissions = u.permissions || {};
        setOriginalPermissions({ ...userPermissions });

        const loaded: Record<string, boolean> = {};
        ALL_PERMISSION_GROUPS.forEach(g => {
          g.items.forEach(item => {
            loaded[item.key] = isTargetMainAdmin ? true : (userPermissions[item.key] !== undefined 
              ? !!userPermissions[item.key] 
              : item.defaultValue);
          });
        });
        setPermissionsState(loaded);
    };

    const togglePermission = (key: string) => {
      if (editingUser && isMainAdmin(editingUser)) {
        showNotification("No se pueden alterar los permisos del Administrador Principal (Pieza Clave).", "error");
        return;
      }
      setPermissionsState(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) {
            showNotification("Completa el nombre de usuario.", "error");
            return;
        }
        if (!editingUser && !password.trim()) {
            showNotification("Establece una contraseña para la nueva cuenta.", "error");
            return;
        }

        const changesList: string[] = [];
        if (editingUser) {
            ALL_PERMISSION_GROUPS.forEach(g => {
              g.items.forEach(item => {
                const oldVal = originalPermissions ? originalPermissions[item.key] : undefined;
                const oldBool = oldVal === undefined ? item.defaultValue : !!oldVal;
                const newBool = !!permissionsState[item.key];
                if (oldBool !== newBool) {
                  changesList.push(`${item.label}: ${oldBool ? 'SÍ' : 'NO'} → ${newBool ? 'SÍ' : 'NO'}`);
                }
              });
            });

            if (editingUser.role !== role) {
                changesList.push(`Rol: ${editingUser.role.toUpperCase()} → ${role.toUpperCase()}`);
            }
            if (editingUser.email !== email) {
                changesList.push(`Email: ${editingUser.email || 'Ninguno'} → ${email || 'Ninguno'}`);
            }
        }

        const payload = {
            username: username.toLowerCase().trim(),
            password: password.trim() || undefined, // Send password only if filled
            email: email.trim() || null,
            role,
            permissions: permissionsState
        };

        try {
            const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
            const method = editingUser ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showNotification(
                    editingUser 
                        ? `✓ Cuenta de "${username}" actualizada exitosamente.` 
                        : `✓ Cuenta de "${username}" creada exitosamente.`, 
                    "success"
                );
                
                if (editingUser && changesList.length > 0) {
                    await logSecurityAction(username, 'MODIFICAR_PERMISOS', changesList.join(' | '));
                } else if (!editingUser) {
                    await logSecurityAction(username, 'CREAR_USUARIO', 'Nueva cuenta registrada en el POS');
                }
                
                // If updating self, trigger an immediate refresh of the active session context
                if (editingUser && user && Number(editingUser.id) === Number(user.id)) {
                    try {
                        const meRes = await fetch('/api/auth/me');
                        if (meRes.ok) {
                            const updatedMe = await meRes.json();
                            setUser(updatedMe);
                        }
                    } catch (e) {
                        console.error("Error automatic refreshing own session permissions:", e);
                    }
                }
                
                resetForm();
                loadUsers();
            } else {
                const err = await res.json();
                showNotification(`Error: ${err.error || 'No se pudo guardar la cuenta'}`, "error");
            }
        } catch (e: any) {
            console.error(e);
            showNotification("Fallo en la comunicación con el servidor.", "error");
        }
    };

    const handleDeleteUser = async (uId: number, uName: string) => {
        try {
            const res = await fetch(`/api/users/${uId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                showNotification(`✓ Usuario "${uName}" eliminado con éxito.`, "success");
                await logSecurityAction(uName, 'ELIMINAR_USUARIO', `Cuenta de usuario eliminada por el administrador`);
                setDeleteConfirmId(null);
                loadUsers();
            } else {
                showNotification("No se pudo eliminar el usuario.", "error");
            }
        } catch (e: any) {
            console.error(e);
        }
    };

    const filteredLogs = securityLogs.filter(log => {
        let queryMatches = true;
        const query = searchLogQuery.toLowerCase().trim();
        if (query) {
            const searchTerms = query.split(/\s+/);
            const searchableText = `${log.admin_username || ""} ${log.target_username || ""} ${log.changes || ""}`.toLowerCase();
            queryMatches = searchTerms.every(term => searchableText.includes(term));
        }

        const actionMatches = filterLogAction === 'all' || log.action_type === filterLogAction;
        return queryMatches && actionMatches;
    });

    return (
        <div id="permissions-console" className="p-5 md:p-6 overflow-y-auto h-full flex flex-col gap-6 select-none bg-slate-50/50 dark:bg-[#070a10]">
            
            {/* Header Portion */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-[#0c111e] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-850/40 gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Gestión de Accesos y Permisos</h1>
                        <p className="text-[11px] text-slate-450 mt-1 font-semibold">Configura privilegios granulares para evitar fraudes, restringir visualización de costos y proteger la rentabilidad.</p>
                    </div>
                </div>
            </div>

            {/* Layout de Consola */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Formulario de Alta y Configuración Granular (Izquierda) */}
                <div className="lg:col-span-8 flex flex-col gap-5">
                  <form onSubmit={handleSubmit} className="bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/80 dark:border-slate-850/40 p-6 flex flex-col gap-5 shadow-xs">
                    
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-850/60">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                            <UserPlus size={14} className="text-indigo-500" />
                            {editingUser ? `Editar Usuario: ${editingUser.username}` : 'Registrar Nuevo Operador / Cajero'}
                        </h2>
                        {editingUser && (
                            <button 
                                type="button" 
                                onClick={resetForm}
                                className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 hover:text-slate-650 bg-slate-100 dark:bg-black/20 rounded-lg"
                            >
                                Cancelar Edición
                            </button>
                        )}
                    </div>

                    {/* Fila 0: Cartel informativo para Administrador Principal */}
                    {editingUser && isMainAdmin(editingUser) && (
                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3 text-amber-700 dark:text-amber-400 text-xs font-bold shadow-xs">
                            <ShieldCheck className="shrink-0 text-amber-500" size={20} />
                            <span>🔒 Cuenta de Administrador Principal (Pieza Clave): Esta cuenta posee el 100% de los privilegios del sistema de forma permanente e intocable. No es posible editar ni revocar sus funciones.</span>
                        </div>
                    )}

                    {/* Fila 1: Credenciales básicas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-450">Username / Nombre de Usuario</label>
                            <input
                                type="text"
                                required
                                disabled={!!editingUser}
                                placeholder="Ej: roby_vendedor"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-black/50 text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-450">
                                Contraseña {editingUser && <span className="text-[8px] text-indigo-500">(Llenar solo para cambiar)</span>}
                            </label>
                            <input
                                type="password"
                                required={!editingUser}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-250 dark:border-slate-800 dark:bg-black/50 text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-450">Rol Primario</label>
                            <select
                                value={role}
                                disabled={!!(editingUser && isMainAdmin(editingUser))}
                                onChange={e => setRole(e.target.value as any)}
                                className="w-full text-xs font-bold p-2.5 border border-slate-250 dark:border-slate-800 bg-white dark:bg-black/50 text-slate-850 dark:text-white rounded-xl focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                            >
                                <option value="vendedor">Vendedor / Cajero (Mostrador)</option>
                                <option value="admin">Administrador (Control Total)</option>
                                <option value="propietario">Propietario / Dueño del Local</option>
                            </select>
                        </div>
                    </div>

                    {/* Matriz Completa de Configuración Granular */}
                    <div className="flex flex-col gap-4 mt-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1 border-b border-slate-100 dark:border-slate-850 pb-2 flex items-center gap-1.5">
                            <KeyRound size={12} className="text-indigo-500" />
                            Matriz de Permisos Granulares Adicionales (50+ Atributos)
                        </span>

                        <div className="flex flex-col gap-6 max-h-[48vh] overflow-y-auto pr-1">
                          {ALL_PERMISSION_GROUPS.map(group => {
                            return (
                              <div key={group.id} className="flex flex-col gap-3">
                                <div className="flex items-center gap-2 pl-1 select-none">
                                  {group.icon}
                                  <span className="text-[11px] font-black uppercase tracking-wide text-slate-705 dark:text-slate-200">
                                    {group.title}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {group.items.map(item => {
                                    const isEditingMaster = editingUser && isMainAdmin(editingUser);
                                    const isChecked = isEditingMaster ? true : !!permissionsState[item.key];
                                    return (
                                      <div 
                                        key={item.key} 
                                        onClick={() => togglePermission(item.key)}
                                        className={`p-3 rounded-xl border flex items-start gap-3 transition select-none ${
                                          isEditingMaster ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:border-slate-350 dark:hover:border-slate-800'
                                        } ${
                                          isChecked 
                                            ? 'bg-indigo-500/5 border-indigo-500/20 text-slate-850 dark:text-white' 
                                            : 'bg-slate-50/20 border-slate-150 dark:bg-black/20 dark:border-slate-850/80 text-slate-500'
                                        }`}
                                      >
                                        <button 
                                          type="button"
                                          disabled={isEditingMaster}
                                          className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center mt-0.5 transition shrink-0 ${
                                            isChecked 
                                              ? 'bg-indigo-600 border-indigo-600 text-white' 
                                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-black/30'
                                          }`}
                                        >
                                          {isChecked && <Check size={11} />}
                                        </button>
                                        <div className="flex flex-col text-left">
                                          <span className="text-xs font-bold leading-tight">{item.label}</span>
                                          <span className="text-[9.5px] text-slate-400 font-semibold leading-normal mt-0.5">{item.description}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                    >
                        <Save size={14} />
                        {editingUser ? 'Guardar Cambios de Cuenta' : 'Registrar Nuevo Operador'}
                    </button>
                  </form>
                </div>

                {/* Listado de Operadores Existentes (Derecha) */}
                <div className="lg:col-span-4 flex flex-col gap-5">
                  <div className="bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/80 dark:border-slate-850/40 p-5 flex flex-col gap-4 shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white pl-1 border-b border-slate-150 dark:border-slate-850 pb-2 flex items-center gap-1.5">
                        <Users size={13} className="text-indigo-500" />
                        Operadores Registrados
                    </span>

                    <div className="flex flex-col gap-3 max-h-[62vh] overflow-y-auto">
                      {workers.map(w => {
                        const isWorkerMainAdmin = isMainAdmin(w);
                        const isCurrentMainAdmin = isMainAdmin(user);

                        return (
                          <div key={w.id} className={`p-3 rounded-xl border flex justify-between items-center gap-2 transition ${
                            isWorkerMainAdmin 
                              ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30' 
                              : 'bg-slate-50/50 dark:bg-black/20 border-slate-150 dark:border-slate-850/80'
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-black uppercase text-xs ${
                                isWorkerMainAdmin 
                                  ? 'bg-amber-500 text-white border-amber-600' 
                                  : 'bg-slate-150 dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-350'
                              }`}>
                                {w.username.slice(0, 2)}
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-black uppercase text-slate-850 dark:text-white leading-none">{w.username}</span>
                                  {isWorkerMainAdmin && (
                                    <span className="py-0.5 px-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-black text-[7.5px] rounded-md border border-amber-500/30 uppercase tracking-widest flex items-center gap-1">
                                      <Shield size={8} /> Principal
                                    </span>
                                  )}
                                </div>
                                <div className="text-[8px] font-black tracking-widest text-slate-400 uppercase mt-0.5">
                                  {isWorkerMainAdmin ? 'ADMINISTRADOR MAESTRO (PIEZA CLAVE)' : w.role}
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-1 items-center">
                              {/* Edit button */}
                              {isWorkerMainAdmin && !isCurrentMainAdmin ? (
                                <button
                                  type="button"
                                  disabled
                                  className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-lg opacity-60 cursor-not-allowed"
                                  title="El Administrador Principal no puede ser editado por administradores secundarios."
                                >
                                  <Lock size={12} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleEditClick(w)}
                                  className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-[#11192e] text-indigo-650 dark:text-indigo-400 rounded-lg transition cursor-pointer"
                                  title="Editar privilegios"
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                              
                              {/* Delete button: Main admin can NEVER be deleted */}
                              {!isWorkerMainAdmin && w.id !== user?.id && (
                                <>
                                  {deleteConfirmId === w.id ? (
                                    <div className="flex gap-1 animate-in slide-in-from-right-3 duration-150">
                                      <button
                                        onClick={() => handleDeleteUser(w.id, w.username)}
                                        className="py-1 px-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[8px] rounded-lg cursor-pointer"
                                      >
                                        Eliminar
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="py-1 px-2 bg-slate-200 text-slate-500 font-extrabold text-[8px] rounded-lg cursor-pointer"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirmId(w.id)}
                                      className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg transition cursor-pointer"
                                      title="Borrar usuario"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

            </div>

            {/* --- SECCIÓN BITÁCORA DE AUDITORÍA DE SEGURIDAD (ADMIN ONLY) --- */}
            {(user?.role === 'admin' || user?.role === 'propietario') && (
                <div className="bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-200/80 dark:border-slate-850/40 overflow-hidden flex flex-col shadow-xs mt-3 select-none">
                    
                    <div className="p-4 border-b border-slate-100 dark:border-slate-850/60 bg-slate-50/50 dark:bg-black/10 flex flex-col sm:flex-row gap-3 justify-between items-center">
                        <div className="flex items-center gap-2">
                            <History size={15} className="text-indigo-500" />
                            <span className="text-xs font-black uppercase tracking-widest text-slate-805 dark:text-white">Bitácora de Auditoría de Cambios y Privilegios (Firestore)</span>
                        </div>
                        
                        <div className="flex gap-3 items-center w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-60">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 pointer-events-none">
                                    <Search size={12} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Buscar por usuario o cambio..."
                                    value={searchLogQuery}
                                    onChange={e => setSearchLogQuery(e.target.value)}
                                    className="w-full text-[10px] font-semibold pl-8 pr-4 py-1.5 bg-white dark:bg-[#11192e] border border-slate-250 dark:border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-850 dark:text-white"
                                />
                            </div>

                            <select
                                value={filterLogAction}
                                onChange={e => setFilterLogAction(e.target.value)}
                                className="text-[10px] font-bold p-1.5 border border-slate-250 dark:border-slate-800 bg-white dark:bg-[#11192e] rounded-lg focus:outline-none text-slate-700 dark:text-white"
                            >
                                <option value="all">TODAS LAS ACCIONES</option>
                                <option value="CREAR_USUARIO">CREAR USUARIO</option>
                                <option value="MODIFICAR_PERMISOS">MODIFICAR PERMISOS</option>
                                <option value="ELIMINAR_USUARIO">ELIMINAR USUARIO</option>
                            </select>
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/20 dark:bg-slate-950/20 border-b border-slate-150 dark:border-slate-850/60 text-[8.5px] font-bold text-slate-400 uppercase tracking-widest">
                                    <th className="p-3 pl-6">Administrador</th>
                                    <th className="p-3">Destinatario</th>
                                    <th className="p-3 text-center">Tipo Evento</th>
                                    <th className="p-3">Detalle de Modificaciones</th>
                                    <th className="p-3 pr-6 text-center">Fecha y Hora</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-850/50 text-[10.5px] font-semibold">
                                {isLoadingLogs ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400">Cargando bitácora de auditoría...</td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400">Sin registros de auditoría de seguridad para mostrar.</td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/20 dark:hover:bg-[#0d1221]/15">
                                            <td className="p-3 pl-6 text-slate-800 dark:text-slate-150 uppercase font-black">{log.admin_username}</td>
                                            <td className="p-3 text-slate-655 uppercase">{log.target_username}</td>
                                            <td className="p-3 text-center">
                                                <span className={`py-0.5 px-2 border rounded-full text-[8px] uppercase font-black ${
                                                    log.action_type === 'MODIFICAR_PERMISOS' 
                                                        ? 'bg-amber-500/5 text-amber-600 border-amber-500/10' 
                                                        : log.action_type === 'ELIMINAR_USUARIO'
                                                            ? 'bg-rose-500/5 text-rose-600 border-rose-500/10'
                                                            : 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10'
                                                }`}>
                                                    {log.action_type.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-400 text-[10px] break-all max-w-sm font-semibold leading-relaxed">{log.changes || 'Sin cambios registrados'}</td>
                                            <td className="p-3 pr-6 text-center font-mono text-[9px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Fading Toast notification */}
            {notification && (
                <div id="permissions-toast" className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-xs font-bold transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
                    notification.type === 'success' 
                        ? 'bg-emerald-600 border-emerald-500 text-white' 
                        : 'bg-rose-600 border-rose-500 text-white'
                }`}>
                    <span>{notification.message}</span>
                </div>
            )}

        </div>
    );
}
