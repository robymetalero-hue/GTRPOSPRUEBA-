const Database = require('better-sqlite3');
const db = new Database('gtr_pos.db');
const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(rows.map(r => r.name).join(', '));
