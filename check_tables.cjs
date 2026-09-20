const Database = require('better-sqlite3');
const db = new Database('gtr_pos.db');
const tables = [
  'users', 'products', 'clients', 'sales', 'sale_items', 'shifts', 
  'settings', 'exchange_rate_audit', 'caja_cierres', 'departments', 
  'stock_arrivals', 'pending_sales', 'pending_sale_items', 
  'accounts_receivable', 'credit_payments', 'pending_sale_payments', 
  'inventory_audit_logs', 'cash_accounts', 'cash_movements', 
  'cash_settlements', 'inventory_counts', 'inventory_count_items', 
  'system_audit_logs'
];
for (const table of tables) {
  try {
    db.prepare(`SELECT * FROM ${table} LIMIT 1`).all();
    console.log(`${table}: OK`);
  } catch (err) {
    console.log(`${table}: FAILED - ${err.message}`);
  }
}
