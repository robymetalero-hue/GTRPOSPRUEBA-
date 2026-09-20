const fs = require('fs');
let content = fs.readFileSync('src/components/AudioVoice.tsx', 'utf8');

// The issue was I replaced `));` with `);` globally, which broke JSON.stringify({...}); calls.
// Let's replace JSON.stringify( ... ); with JSON.stringify( ... )); where appropriate, but it's hard to match.
// Instead, I'll just look for `wsRef.current.send(JSON.stringify(...)` ending in `);` instead of `));`.

content = content.replace(/wsRef\.current\.send\(JSON\.stringify\(\{([\s\S]*?)\}\);\n/g, 'wsRef.current.send(JSON.stringify({$1}));\n');
content = content.replace(/body: JSON\.stringify\(\{([\s\S]*?)\}\)([\s,]*)\n/g, 'body: JSON.stringify({$1})$2\n');
content = content.replace(/body: JSON\.stringify\(([\w]+)\)([\s,]*)\n/g, 'body: JSON.stringify($1)$2\n');

// Also check if any `fetch` or `send` calls have `);` that should be `));`.
// Wait, `wsRef.current.send(JSON.stringify({ type: 'context_update', text: cartContext });` -> `...}));`
fs.writeFileSync('src/components/AudioVoice.tsx', content);
console.log("Fixed AudioVoice");
