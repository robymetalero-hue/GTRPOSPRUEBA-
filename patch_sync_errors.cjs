const fs = require('fs');
let code = fs.readFileSync('firebaseSync.ts', 'utf8');

if (!code.includes('let quotaExceeded')) {
    code = code.replace(
        'import { getApps, initializeApp, getApp } from "firebase/app";',
        `import { getApps, initializeApp, getApp } from "firebase/app";

let quotaExceeded = false;
let quotaExceededTime = 0;
function checkQuota() {
  if (quotaExceeded) {
    if (Date.now() - quotaExceededTime > 1000 * 60 * 60) {
      quotaExceeded = false;
      return false;
    }
    return true;
  }
  return false;
}
function handleSyncError(err, msg) {
  if (err && err.message && err.message.toLowerCase().includes('quota')) {
    if (!quotaExceeded) {
      console.warn("[Firestore Quota Exceeded] Free tier read/write quota exceeded. Offline mode engaged.");
      quotaExceeded = true;
      quotaExceededTime = Date.now();
    }
  } else {
    console.warn(msg, err && err.message ? err.message : err);
  }
}
`
    );

    code = code.replace(
        'export async function pushLocalToFirestore(tableName: string, idList?: string[]) {',
        `export async function pushLocalToFirestore(tableName: string, idList?: string[]) {
  if (checkQuota()) return;`
    );

    code = code.replace(
        'export async function pullFirestoreToLocal(forceFullSync = false) {',
        `export async function pullFirestoreToLocal(forceFullSync = false) {
  if (checkQuota()) return;`
    );

    code = code.replace(
        /console\.warn\(\`\[Sync\] Failed to fetch max ID from Firestore for "\$\{tableName\}"\. Defaulting to full synchronization:\`, firestoreErr\.message\);/g,
        `handleSyncError(firestoreErr, \`[Sync] Failed to fetch max ID from Firestore for "\${tableName}". Defaulting to full synchronization:\`);`
    );

    code = code.replace(
        /console\.warn\(\`\[Sync Offline Mode\] Unable to sync local table "\$\{tableName\}" to Firestore \(will save locally\):\`, error\.message\);/g,
        `handleSyncError(error, \`[Sync Offline Mode] Unable to sync local table "\${tableName}" to Firestore (will save locally):\`);`
    );

    code = code.replace(
        /console\.warn\(\`\[Sync Warning\] Failed to pull table "\$\{table\}" from Cloud Firestore:\`, tableErr\.message\);/g,
        `handleSyncError(tableErr, \`[Sync Warning] Failed to pull table "\${table}" from Cloud Firestore:\`);`
    );

    fs.writeFileSync('firebaseSync.ts', code);
    console.log("Patched firebaseSync.ts");
}
