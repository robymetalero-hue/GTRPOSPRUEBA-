const db = require('better-sqlite3')('local_database.sqlite');
try {
  db.exec("ALTER TABLE sale_items ADD COLUMN product_name_snapshot TEXT");
  db.exec("ALTER TABLE sale_items ADD COLUMN product_sku_snapshot TEXT");
  db.exec("ALTER TABLE sale_items ADD COLUMN price_type TEXT");
  db.exec("ALTER TABLE sale_items ADD COLUMN discount_minor REAL");
  db.exec("ALTER TABLE sale_items ADD COLUMN subtotal_minor REAL");
  console.log("Columns added successfully");
} catch(e) {
  console.log("Error or already exists:", e.message);
}
