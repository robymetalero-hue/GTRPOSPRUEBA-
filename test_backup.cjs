const Database = require('better-sqlite3');
const db = new Database('gtr_pos.db');
const TABLE_NAMES = [
  'users',
  'products',
  'clients',
  'sales',
  'sale_items',
  'shifts',
  'settings',
  'exchange_rate_audit',
  'caja_cierres',
  'departments',
  'stock_arrivals',
  'pending_sales',
  'pending_sale_items',
  'accounts_receivable',
  'credit_payments',
  'pending_sale_payments',
  'inventory_audit_logs',
  'cash_accounts',
  'cash_movements',
  'cash_settlements',
  'inventory_counts',
  'inventory_count_items',
  'system_audit_logs'
];
const backupData = {};
try {
  for (const table of TABLE_NAMES) {
    backupData[table] = db.prepare(`SELECT * FROM ${table}`).all();
  }
  console.log("Success! Total tables backed up:", Object.keys(backupData).length);
  console.log("Data size:", JSON.stringify(backupData).length);
} catch (e) {
  console.error("Failed:", e.message);
}
