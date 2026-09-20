const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// The faulty GROUP BY is on line 3659: "GROUP BY label" in the else block.
content = content.replace(/GROUP BY label\n\s*ORDER BY t.label DESC/, 'GROUP BY t.label\n          ORDER BY t.label DESC');

fs.writeFileSync('server.ts', content);
