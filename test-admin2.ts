import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

const app = initializeApp({
  credential: applicationDefault(),
  projectId: config.projectId
});

const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

async function run() {
  try {
    const snap = await db.collection('test').limit(1).get();
    console.log("Success admin SDK, docs:", snap.size);
  } catch(e: any) {
    console.error("Failed", e.message);
  }
}
run();
