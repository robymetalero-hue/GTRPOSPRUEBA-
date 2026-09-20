import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp({
  projectId: config.projectId,
});

getAuth(app).createCustomToken('server-sync-daemon')
  .then(token => console.log('Token:', token))
  .catch(e => console.error('Error:', e.message));
