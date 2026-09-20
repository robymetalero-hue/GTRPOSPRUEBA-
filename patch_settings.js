const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const newRoute = `
  app.get("/api/settings/kiosk", (req, res) => {
    try {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('kiosk_mode');
      const kiosk_mode = row && row.value === 'true' ? true : false;
      res.json({ kiosk_mode });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/settings/kiosk", (req, res) => {
    try {
      const { kiosk_mode } = req.body;
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('kiosk_mode', kiosk_mode ? 'true' : 'false');
      syncAfterWrite("settings");
      res.json({ success: true, kiosk_mode });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
`;

content = content.replace('app.get("/api/settings/receipt", (req, res) => {', newRoute + '\n  app.get("/api/settings/receipt", (req, res) => {');

fs.writeFileSync('server.ts', content);
