const Database = require('better-sqlite3');
const db = new Database('local_database.sqlite');
try {
  db.exec("ALTER TABLE sale_items ADD COLUMN product_name_snapshot TEXT");
} catch(e) {}
try {
  db.exec("ALTER TABLE sale_items ADD COLUMN product_sku_snapshot TEXT");
} catch(e) {}
try {
  db.exec("ALTER TABLE sale_items ADD COLUMN price_type TEXT");
} catch(e) {}
try {
  db.exec("ALTER TABLE sale_items ADD COLUMN discount_minor REAL");
} catch(e) {}
try {
  db.exec("ALTER TABLE sale_items ADD COLUMN subtotal_minor REAL");
} catch(e) {}
console.log("Columns added successfully");
