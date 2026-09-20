const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');
const line = lines.findIndex(l => l.includes('loginLimiter'));
if (line !== -1) {
  console.log(lines.slice(Math.max(0, line - 5), line + 15).join('\n'));
}
