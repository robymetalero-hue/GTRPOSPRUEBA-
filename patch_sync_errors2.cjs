const fs = require('fs');
let code = fs.readFileSync('firebaseSync.ts', 'utf8');

if (!code.includes('let quotaExceeded')) {
    code = code.replace(
        "import { initializeApp, getApps, getApp } from 'firebase/app';",
        `import { initializeApp, getApps, getApp } from 'firebase/app';

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

    fs.writeFileSync('firebaseSync.ts', code);
    console.log("Patched firebaseSync.ts with handleSyncError");
}
