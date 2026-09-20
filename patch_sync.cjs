const fs = require('fs');
let content = fs.readFileSync('firebaseSync.ts', 'utf8');

content = content.replace(
    /console\.warn\(\`\\[Sync\\] Failed to fetch max ID from Firestore for "\\\$\{tableName\}\"\. Defaulting to full synchronization:\`, firestoreErr\.message\);/g,
    `if (!firestoreErr.message.includes('Quota')) { console.warn(\`[Sync] Failed to fetch max ID from Firestore for "\${tableName}". Defaulting to full synchronization:\`, firestoreErr.message); }`
);

content = content.replace(
    /console\.warn\(\`\\[Sync Warning\\] Failed to pull table "\\\$\{table\}\" from Cloud Firestore:\`, tableErr\.message\);/g,
    `if (!tableErr.message.includes('Quota')) { console.warn(\`[Sync Warning] Failed to pull table "\${table}" from Cloud Firestore:\`, tableErr.message); }`
);

fs.writeFileSync('firebaseSync.ts', content);
