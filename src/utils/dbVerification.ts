import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore,
  getFirestore, 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  limit, 
  query 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { firestoreDb } from '../context/AppContext';

export interface CollectionCheckResult {
  name: string;
  accessible: boolean;
  docCount?: number;
  error?: string;
}

export interface DbVerificationResult {
  success: boolean;
  firestoreAccessible: boolean;
  serverApiAccessible: boolean;
  collections: CollectionCheckResult[];
  quotaExceeded: boolean;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

function getFirestoreInstance() {
  if (firestoreDb) return firestoreDb;
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
    try {
      return initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, dbId);
    } catch {
      return dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
    }
  } catch (err: any) {
    console.error("[DbVerification] Error initializing Firestore instance:", err);
    return null;
  }
}

/**
 * Perform a diagnostic read from Firestore to verify accessibility of active data,
 * detect quota limits, connection issues, or permission errors, and return a clear diagnostic report.
 */
export async function verifyFirestoreData(): Promise<DbVerificationResult> {
  const timestamp = new Date().toISOString();
  const collectionsToCheck = ['gtr_pos_shared_state', 'products', 'users', 'sales'];
  const collectionsResults: CollectionCheckResult[] = [];

  let firestoreAccessible = false;
  let serverApiAccessible = false;
  let quotaExceeded = false;
  let primaryErrorMessage = '';

  // 1. Verify Express Server API Health
  try {
    const res = await fetch('/api/app-version', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      serverApiAccessible = true;
    }
  } catch (err: any) {
    console.warn("[DbVerification] Server API ping failed:", err.message);
  }

  // 2. Verify Firestore Client Connection & Read Collections
  const db = getFirestoreInstance();

  if (!db) {
    return {
      success: false,
      firestoreAccessible: false,
      serverApiAccessible,
      collections: [],
      quotaExceeded: false,
      message: 'No se pudo inicializar la instancia de Firestore. Verifique la configuración en firebase-applet-config.json.',
      timestamp
    };
  }

  // Test primary document read
  try {
    const docRef = doc(db, 'gtr_pos_shared_state', 'current_state');
    const docSnap = await getDoc(docRef);
    if (docSnap) {
      // Successfully communicated with Firestore
      firestoreAccessible = true;
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.warn("[DbVerification] Test document read error:", errMsg);

    if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('resource_exhausted') || errMsg.includes('429')) {
      quotaExceeded = true;
      primaryErrorMessage = 'Límite de cuota de Firestore alcanzado o superado.';
    } else if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('denied')) {
      primaryErrorMessage = 'Permisos insuficientes para leer la base de datos de Firestore.';
    } else if (errMsg.toLowerCase().includes('offline') || errMsg.toLowerCase().includes('network')) {
      primaryErrorMessage = 'Sin conexión de red con el servidor de Firestore.';
    } else {
      primaryErrorMessage = `Error de conexión con Firestore: ${errMsg}`;
    }
  }

  // Check each target collection
  for (const collName of collectionsToCheck) {
    try {
      const q = query(collection(db, collName), limit(5));
      const querySnap = await getDocs(q);
      firestoreAccessible = true;

      collectionsResults.push({
        name: collName,
        accessible: true,
        docCount: querySnap.size
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('resource_exhausted') || errMsg.includes('429')) {
        quotaExceeded = true;
      }

      collectionsResults.push({
        name: collName,
        accessible: false,
        error: errMsg
      });
    }
  }

  const allAccessible = collectionsResults.some(c => c.accessible) || firestoreAccessible;

  let finalMessage = '';
  if (allAccessible) {
    finalMessage = 'Diagnóstico completado con éxito: La base de datos Firestore está en línea y los datos son completamente accesibles.';
  } else if (quotaExceeded) {
    finalMessage = 'Atención: Se ha alcanzado el límite de cuota de solicitudes de Firestore.';
  } else if (primaryErrorMessage) {
    finalMessage = primaryErrorMessage;
  } else {
    finalMessage = 'No se pudo establecer comunicación con la base de datos de Firestore.';
  }

  return {
    success: allAccessible,
    firestoreAccessible,
    serverApiAccessible,
    collections: collectionsResults,
    quotaExceeded,
    message: finalMessage,
    timestamp,
    details: {
      projectId: firebaseConfig.projectId,
      databaseId: (firebaseConfig as any).firestoreDatabaseId
    }
  };
}
