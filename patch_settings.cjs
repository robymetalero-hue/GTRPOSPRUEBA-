const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  `syncAfterWrite("settings");
      res.json({ success: true, kiosk_mode });`,
  `syncAfterWrite("settings");
      try { broadcastAlert(JSON.stringify({ type: "kiosk_mode_changed", kiosk_mode: kiosk_mode ? true : false })); } catch (err) {}
      res.json({ success: true, kiosk_mode });`
);

fs.writeFileSync('server.ts', content);
