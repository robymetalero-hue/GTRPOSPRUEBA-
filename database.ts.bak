process.env.TZ = 'America/La_Paz';

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Helper to get current Bolivia time as ISO 8601 with offset
export function getBoliviaISOString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
    let hour = partMap.hour;
    if (hour === '24') hour = '00';
    return `${partMap.year}-${partMap.month}-${partMap.day}T${hour}:${partMap.minute}:${partMap.second}-04:00`;
  } catch (err) {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const boliviaTime = new Date(utc - (4 * 3600000));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${boliviaTime.getFullYear()}-${pad(boliviaTime.getMonth() + 1)}-${pad(boliviaTime.getDate())}T${pad(boliviaTime.getHours())}:${pad(boliviaTime.getMinutes())}:${pad(boliviaTime.getSeconds())}-04:00`;
  }
}

const dbPath = path.resolve(process.cwd(), 'gtr_pos.db');
export const db = new Database(dbPath, { timeout: 10000 });

// Enable WAL journal mode and boost better-sqlite3 performance under concurrent AI/Express operations
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('cache_size = -16000'); // 16MB cache allocation

// Initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    permissions TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    sku TEXT UNIQUE,
    stock INTEGER,
    price_unit REAL,
    price_bulk REAL,
    price_cost REAL,
    stock_alarm INTEGER
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total REAL,
    discount REAL,
    payment_method TEXT,
    user_id INTEGER,
    client_id INTEGER,
    exchange_rate REAL DEFAULT 6.96,
    currency TEXT DEFAULT 'BOB',
    cierre_id INTEGER DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours'))
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    product_name_snapshot TEXT,
    product_sku_snapshot TEXT,
    quantity INTEGER,
    price REAL,
    cost REAL DEFAULT NULL,
    price_type TEXT,
    discount_minor REAL,
    subtotal_minor REAL
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    closed_by INTEGER,
    total_sales REAL,
    closed_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS exchange_rate_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    old_rate REAL,
    new_rate REAL,
    changed_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours'))
  );

  CREATE TABLE IF NOT EXISTS caja_cierres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    admin_id INTEGER,
    admin_username TEXT,
    amount REAL,
    closed_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours')),
    observation TEXT,
    sales_count INTEGER
  );

  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS stock_arrivals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    quantity INTEGER,
    arrival_price REAL,
    created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours'))
  );

  CREATE TABLE IF NOT EXISTS accounts_receivable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    client_id INTEGER,
    total_amount REAL,
    paid_amount REAL,
    remaining_amount REAL,
    status TEXT,
    created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours')),
    due_date DATETIME DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS credit_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_receivable_id INTEGER,
    amount REAL,
    payment_method TEXT,
    user_id INTEGER,
    registered_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours')),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS pending_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT,
    destination TEXT,
    client_phone TEXT,
    total REAL DEFAULT 0.0,
    discount REAL DEFAULT 0.0,
    exchange_rate REAL DEFAULT 6.96,
    currency TEXT DEFAULT 'BOB',
    status TEXT DEFAULT 'pendiente', -- 'pendiente', 'completada', 'cancelada'
    paid_amount REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours'))
  );

  CREATE TABLE IF NOT EXISTS pending_sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pending_sale_id INTEGER,
    amount REAL,
    payment_method TEXT,
    user_id INTEGER,
    registered_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours')),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS pending_sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pending_sale_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price REAL
  );

  CREATE TABLE IF NOT EXISTS inventory_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    product_name TEXT,
    product_sku TEXT,
    type TEXT, -- 'ingreso_compra', 'ingreso_devolucion', 'salida_venta', 'ajuste_incremento', 'ajuste_decremento'
    quantity INTEGER,
    price REAL,
    user_id INTEGER,
    username TEXT,
    reference TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours'))
  );


  -- High-Performance Database Indexes
  CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales (user_id);
  CREATE INDEX IF NOT EXISTS idx_sales_client_id ON sales (client_id);
  CREATE INDEX IF NOT EXISTS idx_sales_cierre_id ON sales (cierre_id);
  CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at);

  CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items (sale_id);
  CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items (product_id);

  CREATE INDEX IF NOT EXISTS idx_stock_arrivals_product_id ON stock_arrivals (product_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_product_id ON inventory_audit_logs (product_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_audit_logs_created_at ON inventory_audit_logs (created_at);

  CREATE INDEX IF NOT EXISTS idx_accounts_receivable_sale_id ON accounts_receivable (sale_id);
  CREATE INDEX IF NOT EXISTS idx_accounts_receivable_client_id ON accounts_receivable (client_id);
  CREATE INDEX IF NOT EXISTS idx_accounts_receivable_status ON accounts_receivable (status);

  CREATE INDEX IF NOT EXISTS idx_credit_payments_ar_id ON credit_payments (account_receivable_id);

  CREATE INDEX IF NOT EXISTS idx_pending_sales_status ON pending_sales (status);
  CREATE INDEX IF NOT EXISTS idx_pending_sale_items_sale_id ON pending_sale_items (pending_sale_id);
  CREATE INDEX IF NOT EXISTS idx_pending_sale_items_prod_id ON pending_sale_items (product_id);
`);

// Seed default departments if table is empty
try {
  const count = db.prepare('SELECT COUNT(*) as count FROM departments').get() as any;
  if (!count || count.count === 0) {
    const defaults = ['Storage', 'Micro SDs', 'USBs', 'Electronics'];
    const stmt = db.prepare('INSERT OR IGNORE INTO departments (name) VALUES (?)');
    for (const name of defaults) {
      stmt.run(name);
    }
    console.log("[Database] Successfully seeded default departments:", defaults);
  }
} catch (e: any) {
  console.error("Failed to seed default departments:", e.message);
}

// Gracefully migrate existing databases
try {
  db.exec("ALTER TABLE products ADD COLUMN price_cost REAL DEFAULT 0.0");
} catch (e: any) {}

try {
  db.exec("ALTER TABLE sales ADD COLUMN exchange_rate REAL DEFAULT 6.96");
} catch (e: any) {}

try {
  db.exec("ALTER TABLE sales ADD COLUMN currency TEXT DEFAULT 'BOB'");
} catch (e: any) {}

try {
  db.exec("ALTER TABLE sales ADD COLUMN cierre_id INTEGER DEFAULT NULL");
} catch (e: any) {}

try {
  db.exec("ALTER TABLE products ADD COLUMN image TEXT DEFAULT NULL");
} catch (e: any) {}

try {
  db.exec("ALTER TABLE clients ADD COLUMN points INTEGER DEFAULT 0");
} catch (e: any) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT NULL");
} catch (e: any) {}

try {
  db.exec("ALTER TABLE sale_items ADD COLUMN cost REAL DEFAULT NULL");
} catch (e: any) {}

try {
  db.exec("ALTER TABLE sales ADD COLUMN notes TEXT DEFAULT NULL");
} catch (e: any) {}

try {
  db.exec("ALTER TABLE pending_sales ADD COLUMN paid_amount REAL DEFAULT 0.0");
} catch (e: any) {}

try {
  db.exec("ALTER TABLE inventory_counts ADD COLUMN category_filter TEXT DEFAULT NULL");
} catch (e: any) {}

// Create Cash Accounts & Movements & Settlements tables
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER UNIQUE,
      seller_username TEXT,
      current_balance REAL DEFAULT 0.0,
      last_settlement_at DATETIME DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (e: any) {
  console.error("Error creating cash_accounts:", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER,
      sale_id INTEGER,
      type TEXT, -- 'venta', 'devolucion', 'ajuste', 'ingreso_manual', 'retiro_manual'
      amount REAL,
      currency TEXT DEFAULT 'BOB',
      payment_method TEXT,
      status TEXT DEFAULT 'pendiente', -- 'pendiente', 'liquidado'
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (e: any) {
  console.error("Error creating cash_movements:", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER,
      seller_username TEXT,
      admin_id INTEGER,
      admin_username TEXT,
      period_start DATETIME,
      period_end DATETIME,
      calculated_amount REAL,
      delivered_amount REAL,
      difference REAL,
      notes TEXT,
      sale_ids TEXT, -- JSON array of sale IDs
      status TEXT, -- 'confirmada', 'con_diferencia', 'anulada_admin'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (e: any) {
  console.error("Error creating cash_settlements:", e.message);
}

// Create Inventory Physical Count tables
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      status TEXT DEFAULT 'en_progreso', -- 'en_progreso', 'pausado', 'finalizado', 'revisado_admin', 'cerrado', 'cancelado'
      notes TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME DEFAULT NULL,
      total_products INTEGER DEFAULT 0,
      reviewed_products INTEGER DEFAULT 0,
      correct_products INTEGER DEFAULT 0,
      difference_products INTEGER DEFAULT 0,
      category_filter TEXT DEFAULT NULL
    );
  `);
} catch (e: any) {
  console.error("Error creating inventory_counts:", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_count_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_count_id INTEGER,
      product_id INTEGER,
      product_name TEXT,
      product_sku TEXT,
      expected_quantity INTEGER DEFAULT 0,
      physical_quantity INTEGER DEFAULT 0,
      difference INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pendiente', -- 'pendiente', 'correcto', 'diferencia', 'no_encontrado', 'requiere_revision'
      had_movements_during_count INTEGER DEFAULT 0,
      notes TEXT,
      reviewed_at DATETIME DEFAULT NULL
    );
  `);
} catch (e: any) {
  console.error("Error creating inventory_count_items:", e.message);
}

// Create System Audit Logs table for advanced immutable auditing
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT,
      category TEXT,
      module TEXT,
      action TEXT,
      severity TEXT,
      entity_type TEXT,
      entity_id TEXT,
      entity_name TEXT,
      user_id INTEGER,
      user_name TEXT,
      user_role TEXT,
      affected_user_id INTEGER,
      affected_user_name TEXT,
      before_data TEXT,
      after_data TEXT,
      changed_fields TEXT,
      quantity_before INTEGER,
      quantity_changed INTEGER,
      quantity_after INTEGER,
      price_before REAL,
      price_after REAL,
      currency TEXT,
      exchange_rate REAL,
      reason TEXT,
      result TEXT,
      status TEXT,
      related_sale_id INTEGER,
      related_ticket TEXT,
      related_product_id INTEGER,
      related_cash_id INTEGER,
      related_inventory_movement_id INTEGER,
      related_session_id TEXT,
      source_module TEXT,
      device_info TEXT,
      user_agent TEXT,
      ip_address TEXT,
      error_code TEXT,
      error_message TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours'))
    );

    CREATE INDEX IF NOT EXISTS idx_system_audit_logs_created_at ON system_audit_logs (created_at);
    CREATE INDEX IF NOT EXISTS idx_system_audit_logs_category ON system_audit_logs (category);
    CREATE INDEX IF NOT EXISTS idx_system_audit_logs_user_name ON system_audit_logs (user_name);
    CREATE INDEX IF NOT EXISTS idx_system_audit_logs_related_product_id ON system_audit_logs (related_product_id);
    CREATE INDEX IF NOT EXISTS idx_system_audit_logs_related_ticket ON system_audit_logs (related_ticket);
    CREATE INDEX IF NOT EXISTS idx_system_audit_logs_event_type ON system_audit_logs (event_type);
  `);
} catch (e: any) {
  console.error("Error creating system_audit_logs:", e.message);
}

// Seed exchange rate default
try {
  const hasRate = db.prepare('SELECT value FROM settings WHERE key = ?').get('exchange_rate');
  if (!hasRate) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('exchange_rate', '6.96');
  }
} catch (e) {}

// Seed Admin Users
const seedUser = (username: string, email: string, pass: string) => {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  const permissions = JSON.stringify({
    create_sales: true,
    add_to_cart: true,
    remove_from_cart: true,
    change_quantities: true,
    clear_cart: true,
    apply_discounts: true,
    modify_prices: true,
    select_price_unit: true,
    select_price_bulk: true,
    sell_below_price: true,
    sell_below_cost: true,
    cancel_before_confirm: true,
    void_confirmed_sale: true,
    edit_sale: true,
    make_refunds: true,
    reprint_tickets: true,
    view_past_sales: true,
    view_own_sales_only: false,
    view_other_sales: true,
    create_pending_sales: true,
    edit_pending_sales: true,
    delete_pending_sales: true,
    complete_pending_sales: true,
    view_inventory: true,
    view_stock_available: true,
    view_sale_prices: true,
    view_wholesale_prices: true,
    view_purchase_prices: true,
    view_costs: true,
    view_profits: true,
    add_products: true,
    edit_products: true,
    delete_products: true,
    increase_stock: true,
    decrease_stock: true,
    inventory_adjustments: true,
    view_stock_movements: true,
    physical_control_checklist: true,
    confirm_stock_differences: true,
    correct_stock_differences: true,
    view_own_cash_accumulated: true,
    view_own_sales_detail: true,
    view_own_tickets: true,
    view_other_cash: true,
    reset_own_cash: true,
    reset_other_cash: true,
    view_reset_history: true,
    register_withdrawals: true,
    register_manual_incomes: true,
    modify_cash_movements: true,
    view_dashboard: true,
    view_total_sales: true,
    view_revenues: true,
    view_costs_admin: true,
    view_profits_admin: true,
    view_utility_percentages: true,
    view_exchange_rate: true,
    modify_exchange_rate: true,
    view_general_reports: true,
    export_info: true,
    admin_users: true,
    admin_permissions: true,
    view_audit: true,
    view_reports: true // legacy
  });
  if (!exists) {
    db.prepare('INSERT INTO users (username, password, role, permissions, email) VALUES (?, ?, ?, ?, ?)')
      .run(username, pass, 'admin', permissions, email);
  } else {
    // Ensure email and permissions are updated for seed users
    db.prepare('UPDATE users SET email = ?, password = COALESCE(password, ?), permissions = ? WHERE username = ?').run(email, pass, permissions, username);
  }
};

try {
  seedUser('admin', 'robymetalero@gmail.com', '1234');
  seedUser('roby', 'robymetalero@gmail.com', '1234');
} catch (e: any) {
  console.error("Error seeding users:", e.message);
}

// Seed Demo Products
try {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_products', 'true');
} catch (e) {}

// Seed historical data into inventory_audit_logs if empty
try {
  const auditCount = db.prepare('SELECT COUNT(*) as count FROM inventory_audit_logs').get() as any;
  if (!auditCount || auditCount.count === 0) {
    console.log("[Database] inventory_audit_logs is empty. Migrating historical data...");
    
    // 1. Migrate stock arrivals
    const arrivals = db.prepare(`
      SELECT sa.*, p.name as product_name, p.sku as product_sku 
      FROM stock_arrivals sa
      JOIN products p ON sa.product_id = p.id
    `).all() as any[];
    
    const insertAudit = db.prepare(`
      INSERT INTO inventory_audit_logs 
      (product_id, product_name, product_sku, type, quantity, price, user_id, username, reference, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const arr of arrivals) {
      insertAudit.run(
        arr.product_id,
        arr.product_name,
        arr.product_sku,
        'ingreso_compra',
        arr.quantity,
        arr.arrival_price,
        1,
        'admin',
        `Ingreso #${arr.id}`,
        'Migración de ingreso histórico',
        arr.created_at
      );
    }
    
    // 2. Migrate sales
    const sales = db.prepare(`
      SELECT si.*, s.created_at, p.name as product_name, p.sku as product_sku, s.user_id, u.username
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN users u ON s.user_id = u.id
    `).all() as any[];
    
    for (const s of sales) {
      insertAudit.run(
        s.product_id,
        s.product_name,
        s.product_sku,
        'salida_venta',
        s.quantity,
        s.price,
        s.user_id || 1,
        s.username || 'Cajero',
        `Venta #${s.sale_id}`,
        'Migración de venta histórica',
        s.created_at
      );
    }
    
    console.log(`[Database] Migration completed! Migrated ${arrivals.length} arrivals and ${sales.length} sale items.`);
  }
} catch (e: any) {
  console.error("Failed to migrate historical inventory logs:", e.message);
}

// Seed / Migrate inventory_audit_logs into system_audit_logs
try {
  const sysAuditCount = db.prepare('SELECT COUNT(*) as count FROM system_audit_logs').get() as any;
  if (!sysAuditCount || sysAuditCount.count === 0) {
    console.log("[Database] system_audit_logs is empty. Migrating from inventory_audit_logs...");
    const oldLogs = db.prepare('SELECT * FROM inventory_audit_logs').all() as any[];
    
    const insertSys = db.prepare(`
      INSERT INTO system_audit_logs (
        event_type, category, module, action, severity,
        entity_type, entity_id, entity_name,
        user_id, user_name, user_role,
        quantity_changed, price_after,
        reason, related_ticket, related_product_id,
        status, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    db.transaction(() => {
      for (const old of oldLogs) {
        let category = 'inventario';
        let action = 'Movimiento de Inventario';
        if (old.type === 'salida_venta') {
          category = 'ventas';
          action = 'Venta';
        } else if (old.type === 'ingreso_compra') {
          category = 'inventario';
          action = 'Ingreso de mercadería';
        } else if (old.type === 'ingreso_devolucion') {
          category = 'devoluciones';
          action = 'Devolución de mercadería';
        } else if (old.type && old.type.startsWith('ajuste')) {
          category = 'inventario';
          action = 'Ajuste de stock';
        }
        
        insertSys.run(
          old.type,
          category,
          'inventario',
          action,
          'info',
          'producto',
          old.product_id ? String(old.product_id) : null,
          old.product_name,
          old.user_id,
          old.username || 'admin',
          'admin',
          old.quantity,
          old.price,
          old.notes,
          old.reference,
          old.product_id,
          'success',
          JSON.stringify({ migrated_from_old: true }),
          old.created_at
        );
      }
    })();
    console.log(`[Database] System audit logs migration complete: migrated ${oldLogs.length} rows.`);
  }
} catch (e: any) {
  console.error("Failed to migrate old audit logs to system_audit_logs:", e.message);
}

export function insertSystemAuditLog(log: any) {
  try {
    const stmt = db.prepare(`
      INSERT INTO system_audit_logs (
        event_type, category, module, action, severity,
        entity_type, entity_id, entity_name,
        user_id, user_name, user_role,
        affected_user_id, affected_user_name,
        before_data, after_data, changed_fields,
        quantity_before, quantity_changed, quantity_after,
        price_before, price_after, currency, exchange_rate,
        reason, result, status,
        related_sale_id, related_ticket, related_product_id,
        related_cash_id, related_inventory_movement_id, related_session_id,
        source_module, device_info, user_agent, ip_address,
        error_code, error_message, metadata
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const result = stmt.run(
      log.eventType || log.event_type || null,
      log.category || null,
      log.module || null,
      log.action || null,
      log.severity || 'info',
      log.entityType || log.entity_type || null,
      log.entityId ? String(log.entityId) : (log.entity_id ? String(log.entity_id) : null),
      log.entityName || log.entity_name || null,
      log.userId || log.user_id || null,
      log.userName || log.user_name || null,
      log.userRole || log.user_role || null,
      log.affectedUserId || log.affected_user_id || null,
      log.affectedUserName || log.affected_user_name || null,
      log.beforeData ? (typeof log.beforeData === 'object' ? JSON.stringify(log.beforeData) : log.beforeData) : (log.before_data ? (typeof log.before_data === 'object' ? JSON.stringify(log.before_data) : log.before_data) : null),
      log.afterData ? (typeof log.afterData === 'object' ? JSON.stringify(log.afterData) : log.afterData) : (log.after_data ? (typeof log.after_data === 'object' ? JSON.stringify(log.after_data) : log.after_data) : null),
      log.changedFields ? (typeof log.changedFields === 'object' ? JSON.stringify(log.changedFields) : log.changedFields) : (log.changed_fields ? (typeof log.changed_fields === 'object' ? JSON.stringify(log.changed_fields) : log.changed_fields) : null),
      log.quantityBefore !== undefined && log.quantityBefore !== null ? log.quantityBefore : (log.quantity_before !== undefined && log.quantity_before !== null ? log.quantity_before : null),
      log.quantityChanged !== undefined && log.quantityChanged !== null ? log.quantityChanged : (log.quantity_changed !== undefined && log.quantity_changed !== null ? log.quantity_changed : null),
      log.quantityAfter !== undefined && log.quantityAfter !== null ? log.quantityAfter : (log.quantity_after !== undefined && log.quantity_after !== null ? log.quantity_after : null),
      log.priceBefore !== undefined && log.priceBefore !== null ? log.priceBefore : (log.price_before !== undefined && log.price_before !== null ? log.price_before : null),
      log.priceAfter !== undefined && log.priceAfter !== null ? log.priceAfter : (log.price_after !== undefined && log.price_after !== null ? log.price_after : null),
      log.currency || null,
      log.exchangeRate || log.exchange_rate || null,
      log.reason || null,
      log.result || null,
      log.status || 'success',
      log.relatedSaleId || log.related_sale_id || null,
      log.relatedTicket || log.related_ticket || null,
      log.relatedProductId || log.related_product_id || null,
      log.relatedCashId || log.related_cash_id || null,
      log.relatedInventoryMovementId || log.related_inventory_movement_id || null,
      log.relatedSessionId || log.related_session_id || null,
      log.sourceModule || log.source_module || null,
      log.deviceInfo || log.device_info || null,
      log.userAgent || log.user_agent || null,
      log.ipAddress || log.ip_address || null,
      log.errorCode || log.error_code || null,
      log.errorMessage || log.error_message || null,
      log.metadata ? (typeof log.metadata === 'object' ? JSON.stringify(log.metadata) : log.metadata) : null
    );
    return result.lastInsertRowid;
  } catch (err: any) {
    console.error("Failed to insert system audit log:", err.message);
    return null;
  }
}
