const Database = require('better-sqlite3');
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT,
    sku TEXT,
    category TEXT
  );
  INSERT INTO products (name, sku, category) VALUES 
  ('bolsa usb 8gb', 'bol-001', 'acc'),
  ('bolsa kingston', 'bol-002', 'acc'),
  ('flash bolsa 8gb', 'fl-bol-001', 'acc'),
  ('kingbolen ect600', 'kb-001', 'acc'),
  ('probador de circuitos kinbolen', 'kin-001', 'acc');
`);

function searchDb(search) {
      let countQuery = `SELECT COUNT(*) as count FROM products`;
      let queryStr = `SELECT * FROM products`;
      let conditions = [];
      let whereParams = [];
      let orderByStr = ` ORDER BY id DESC `;
      let orderParams = [];

      if (search) {
        const s = search.toLowerCase();
        const searchTerms = s.split(/\s+/).filter(w => w.length > 0);
        
        if (searchTerms.length > 0) {
            const termConditions = searchTerms.map(() => `(LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(category) LIKE ?)`);
            conditions.push(`(${termConditions.join(' AND ')})`);
            
            for (const term of searchTerms) {
                whereParams.push(`%${term}%`, `%${term}%`, `%${term}%`);
            }
            
            orderByStr = ` ORDER BY 
                CASE 
                    WHEN LOWER(sku) = ? THEN 1000
                    WHEN LOWER(name) = ? THEN 900
                    WHEN LOWER(name) LIKE ? THEN 700
                    WHEN LOWER(name) LIKE ? THEN 600
                    ELSE 100
                END DESC, id DESC `;
            orderParams.push(s, s, `${s}%`, `% ${s}%`);
        }
      }

      if (conditions.length > 0) {
        const condStr = ` WHERE ` + conditions.join(' AND ');
        queryStr += condStr;
        countQuery += condStr;
      }
      queryStr += orderByStr;

      let allParams = [...whereParams];
      if (search) {
          allParams = [...allParams, ...orderParams];
      }

      const rows = db.prepare(queryStr).all(...allParams);
      console.log("Search for:", search);
      rows.forEach(r => console.log(r.name));
      console.log('---');
}

searchDb('bol');
