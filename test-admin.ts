import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp({
  projectId: config.projectId,
});
// Need to set databaseId
const db = getFirestore(app, config.firestoreDatabaseId);

db.collection('system_audit_logs').limit(1).get()
  .then(() => console.log('Success!'))
  .catch(e => console.error('Error:', e.message));
