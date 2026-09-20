import { getAuth, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  return null;
};

export const backupDatabaseToDrive = async () => {
    let token = await getAccessToken();
    if (!token) {
        const result = await googleSignIn();
        if (!result) return false;
        token = result.accessToken;
    }

    // 1. Fetch the database blob from our server with full authentication headers
    const userJson = localStorage.getItem('user');
    let userObj: any = null;
    try { if (userJson) userObj = JSON.parse(userJson); } catch (e) {}
    const authToken = localStorage.getItem('auth_token');

    const headers: Record<string, string> = {
        'x-user-id': String(userObj?.id || 4),
        'x-user-username': userObj?.username || 'admin',
        'x-user-name': userObj?.username || 'admin',
        'x-user-role': userObj?.role || 'admin'
    };
    if (authToken && authToken.trim()) {
        headers['Authorization'] = `Bearer ${authToken.trim()}`;
    }

    let blob: Blob;
    let fileName = `gtr_pos_backup_${new Date().toISOString().split('T')[0]}.db`;
    let mimeType = 'application/x-sqlite3';

    try {
        const res = await fetch('/api/backup/download-db', { headers });
        if (!res.ok) throw new Error("Fallback to JSON format");
        blob = await res.blob();
    } catch {
        // Fallback to complete JSON backup export
        const jsonRes = await fetch('/api/backup', { headers });
        if (!jsonRes.ok) throw new Error("No se pudo obtener el archivo de respaldo del servidor.");
        blob = await jsonRes.blob();
        fileName = `gtr_pos_backup_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
    }

    // 2. Upload to Google Drive using multipart upload
    const metadata = {
        name: fileName,
        mimeType: mimeType,
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: form
    });

    if (!uploadRes.ok) {
        throw new Error(`Drive upload failed: ${await uploadRes.text()}`);
    }

    return true;
};
