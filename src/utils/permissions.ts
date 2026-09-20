export const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  // Ventas/Carrito
  create_sales: true,
  add_to_cart: true,
  remove_from_cart: true,
  change_quantities: true,
  clear_cart: true,
  apply_discounts: true,
  modify_prices: false,
  edit_prices: false, // alias of modify_prices
  select_price_unit: true,
  select_price_bulk: true,
  sell_below_price: false,
  sell_below_cost: false,
  cancel_before_confirm: true,
  void_confirmed_sale: false,
  edit_sale: false,
  make_refunds: false,
  reprint_tickets: true,
  view_past_sales: true,
  view_sales: true, // alias of view_past_sales
  view_own_sales_only: true,
  view_other_sales: false,
  create_pending_sales: true,
  edit_pending_sales: true,
  delete_pending_sales: true,
  complete_pending_sales: true,
  manage_credits: true,

  // Inventario
  view_inventory: true,
  view_stock_available: true,
  view_sale_prices: true,
  view_wholesale_prices: true,
  view_purchase_prices: false,
  view_costs: false,
  view_profits: false,
  add_products: false,
  edit_products: false,
  delete_products: false,
  increase_stock: false,
  decrease_stock: false,
  inventory_adjustments: false,
  view_stock_movements: true,
  physical_control_checklist: true,
  preview_quantities_in_count: false,
  confirm_stock_differences: false,
  correct_stock_differences: false,

  // Caja
  view_own_cash_accumulated: true,
  view_own_sales_detail: true,
  view_own_tickets: true,
  view_other_cash: false,
  reset_own_cash: false,
  reset_other_cash: false,
  view_reset_history: false,
  register_withdrawals: false,
  register_manual_incomes: false,
  modify_cash_movements: false,
  manage_caja: true,

  // Administrativos
  view_dashboard: false,
  view_reports: false, // alias of view_general_reports / view_dashboard
  view_total_sales: false,
  view_revenues: false,
  view_costs_admin: false,
  view_profits_admin: false,
  view_utility_percentages: false,
  view_exchange_rate: true,
  modify_exchange_rate: false,
  view_general_reports: false,
  export_info: false,
  admin_users: false,
  admin_permissions: false,
  view_audit: false,
  access_ai: true,
  view_diagnostics: false,
  access_forensic_audit: false, // Strict: only admins by default, or explicitly delegated by admin
};

/**
 * Helper to identify if user can access the Forensic AI Audit module.
 * Restricted strictly to admins / propietarios or users with explicit delegated permission.
 */
export function canAccessForensicAudit(user: any): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'propietario' || user.role === 'administrador') return true;
  if (isMainAdmin(user)) return true;
  return hasPermission(user, 'access_forensic_audit');
}

/**
 * Helper to identify if user is Admin / Propietario / Master Account.
 */
export function isAdminUser(user: any): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'propietario' || user.role === 'administrador') return true;
  return isMainAdmin(user);
}

/**
 * Normalizes user permissions, resolving aliases and supplying default values for missing keys.
 */
export function normalizePermissions(rawPermissions: any): Record<string, boolean> {
  const perms = { ...(rawPermissions || {}) };
  const normalized: Record<string, boolean> = {};

  // Fill all keys with defaults or raw values
  Object.keys(DEFAULT_PERMISSIONS).forEach((key) => {
    normalized[key] = perms[key] !== undefined ? !!perms[key] : DEFAULT_PERMISSIONS[key];
  });

  // Align aliases
  const modifyPricesVal = perms.modify_prices !== undefined ? !!perms.modify_prices : (perms.edit_prices !== undefined ? !!perms.edit_prices : DEFAULT_PERMISSIONS.modify_prices);
  normalized.modify_prices = modifyPricesVal;
  normalized.edit_prices = modifyPricesVal;

  const viewSalesVal = perms.view_past_sales !== undefined ? !!perms.view_past_sales : (perms.view_sales !== undefined ? !!perms.view_sales : DEFAULT_PERMISSIONS.view_past_sales);
  normalized.view_past_sales = viewSalesVal;
  normalized.view_sales = viewSalesVal;

  const viewReportsVal = perms.view_general_reports !== undefined ? !!perms.view_general_reports : (perms.view_reports !== undefined ? !!perms.view_reports : DEFAULT_PERMISSIONS.view_general_reports);
  normalized.view_general_reports = viewReportsVal;
  normalized.view_reports = viewReportsVal;

  return normalized;
}

/**
 * Helper to identify the Main Administrator (master admin account).
 */
export function isMainAdmin(user: any): boolean {
  if (!user) return false;
  const username = String(user.username || '').toLowerCase().trim();
  return username === 'admin' || username === 'roby' || Number(user.id) === 1;
}

/**
 * Helper to check if a user has a specific permission. Admins automatically have all permissions.
 */
export function hasPermission(user: any, key: string): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'propietario' || isMainAdmin(user)) return true;
  
  const normalized = normalizePermissions(user.permissions);
  return !!normalized[key];
}
