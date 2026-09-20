import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  writeBatch, 
  query, 
  limit 
} from 'firebase/firestore';
import { db } from './database.ts';
import fs from 'fs';
import path from 'path';

// Load Firebase app configuration
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
try {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e: any) {
  console.warn("Could not read firebase-applet-config.json:", e.message);
}

// Initialize Client-Side Firebase SDK on Node.js server side
let app: any = null;
try {
  if (firebaseConfig.projectId) {
    if (getApps().length) {
      app = getApp();
    } else {
      app = initializeApp({
        apiKey: firebaseConfig.apiKey,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        messagingSenderId: firebaseConfig.messagingSenderId,
        appId: firebaseConfig.appId
      });
      console.log("Firebase SDK successfully initialized on server side with Project ID:", firebaseConfig.projectId);
    }
  }
} catch (e: any) {
  console.warn("Could not initialize Firebase Web SDK safely on server:", e.message);
}

let firestoreInstance: any = null;
try {
  firestoreInstance = app
    ? (firebaseConfig.firestoreDatabaseId 
        ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
        : getFirestore(app))
    : null;
} catch (e: any) {
  console.warn("Could not initialize Firestore instance safely on server:", e.message);
}

export const firestore = firestoreInstance;

export const SYNC_TABLES = [
  'users',
  'products',
  'clients',
  'sales',
  'sale_items',
  'shifts',
  'settings',
  'exchange_rate_audit',
  'caja_cierres',
  'departments',
  'stock_arrivals',
  'pending_sales',
  'pending_sale_items',
  'accounts_receivable',
  'credit_payments',
  'pending_sale_payments'
];

let isPullingInProgress = false;
let lastPullTimestamp = 0;
const PULL_COOLDOWN_MS = 10000; // 10 seconds rate limit for background pulls

/**
 * Pushes a local SQLite table's content to Firestore.
 * Supports targeted synchronization for specific rows to optimize speed and network payload.
 */
export async function pushLocalToFirestore(tableName: string, idOrIds?: any | any[]) {
  if (!firestore) {
    console.warn("Firestore not initialized, skipping push for table:", tableName);
    return;
  }

  try {
    const isSettings = tableName === 'settings';
    let rows: any[] = [];
    const idList = idOrIds ? (Array.isArray(idOrIds) ? idOrIds.map(String) : [String(idOrIds)]) : null;

    if (idList && idList.length > 0) {
      // Sync only specific rows to make it super fast
      if (isSettings) {
        const placeholders = idList.map(() => '?').join(', ');
        rows = db.prepare(`SELECT * FROM settings WHERE key IN (${placeholders})`).all(...idList) as any[];
      } else {
        const placeholders = idList.map(() => '?').join(', ');
        rows = db.prepare(`SELECT * FROM ${tableName} WHERE id IN (${placeholders})`).all(...idList) as any[];
      }
    } else {
      // Full table sync
      rows = db.prepare(`SELECT * FROM ${tableName}`).all() as any[];
    }

    const colRef = collection(firestore, tableName);

    // If this is a targeted update (idList was specified), we don't handle deletions of other rows.
    // We only upsert the specified rows. This runs in O(N) where N is the number of updated rows (usually 1 or a few).
    if (idList && idList.length > 0) {
      if (rows.length === 0) {
        console.log(`[Sync] Targeted sync requested for "${tableName}" but rows were empty locally.`);
        return;
      }
      let batch = writeBatch(firestore);
      let opCount = 0;

      for (const row of rows) {
        const docId = isSettings ? row.key : String(row.id);
        const docRef = doc(firestore, tableName, docId);

        const cleanData: any = {};
        for (const [key, val] of Object.entries(row)) {
          if (val !== undefined) {
            cleanData[key] = val;
          }
        }

        batch.set(docRef, cleanData);
        opCount++;

        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(firestore);
          opCount = 0;
        }
      }

      if (opCount > 0) {
        await batch.commit();
      }

      console.log(`[Sync] Targeted sync for table "${tableName}" (${rows.length} rows: [${idList.join(', ')}]) completed successfully.`);
      return;
    }

    // Fetch existing documents from Firestore for this collection to handle deletions
    const snapshot = await getDocs(colRef);
    
    // Set of local IDs currently in SQLite
    const localIds = new Set(rows.map(row => {
      if (tableName === 'settings') {
        return row.key;
      }
      return String(row.id);
    }));

    // Start a Firestore batch
    let batch = writeBatch(firestore);
    let opCount = 0;

    // Delete keys from Firestore that no longer exist in local SQLite (soft synchronization)
    // Safeguard: Do not perform remote deletions if the local table is completely empty, 
    // to prevent accidental cloud data wipes due to local SQLite corruption or uninitialized startup states.
    if (rows.length > 0) {
      for (const docSnap of snapshot.docs) {
        if (!localIds.has(docSnap.id)) {
          batch.delete(docSnap.ref);
          opCount++;
          if (opCount >= 400) {
            await batch.commit();
            batch = writeBatch(firestore);
            opCount = 0;
          }
        }
      }
    }

    // Upsert all local records to Firestore
    for (const row of rows) {
      const docId = tableName === 'settings' ? row.key : String(row.id);
      const docRef = doc(firestore, tableName, docId);
      
      // Create a clean object removing any undefined properties
      const cleanData: any = {};
      for (const [key, val] of Object.entries(row)) {
        if (val !== undefined) {
          cleanData[key] = val;
        }
      }

      batch.set(docRef, cleanData);
      opCount++;

      // Commit batches when approaching Firestore's 500 operation limit
      if (opCount >= 400) {
        await batch.commit();
        batch = writeBatch(firestore);
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    console.log(`[Sync] Successfully synchronized table "${tableName}" to Firestore (Local Row Count: ${rows.length})`);
  } catch (error: any) {
    console.warn(`[Sync Offline Mode] Unable to sync local table "${tableName}" to Firestore (will save locally):`, error.message);
  }
}

/**
 * Syncs all SQLite tables to Firestore.
 */
export async function pushAllLocalToFirestore() {
  console.log("[Sync] Triggered full push from SQLite to Google Cloud Firestore...");
  for (const table of SYNC_TABLES) {
    await pushLocalToFirestore(table);
  }
}

/**
 * Pulls master documents from Google Cloud Firestore and populates SQLite.
 * If Firestore is empty, we perform an initial bootstrap sync from local SQLite data.
 * This function handles deletions in Firestore correctly by clearing local records before sync ONLY if forceOverwrite is true.
 */
export async function pullFirestoreToLocal(forceOverwrite: boolean = false) {
  if (!firestore) {
    console.warn("[Sync] Firestore not initialized, skipping database pull.");
    return;
  }

  if (isPullingInProgress) {
    console.log("[Sync] Pull already in progress. Skipping concurrent execution.");
    return;
  }

  if (!forceOverwrite && (Date.now() - lastPullTimestamp < PULL_COOLDOWN_MS)) {
    // Cool down period, skip to prevent rate limits
    return;
  }

  isPullingInProgress = true;

  try {
    console.log("[Sync] Pulling master database records from Google Cloud Firestore...");

    // Determine if Firestore has been initialized/populated already
    const metaRef = doc(firestore, 'sync_metadata', 'status');
    const metaDoc = await getDoc(metaRef);
    
    // Query local database sizes to see if we have actual user records locally to seed
    const localProductsCount = (db.prepare("SELECT COUNT(*) as count FROM products").get() as any)?.count || 0;
    const localSalesCount = (db.prepare("SELECT COUNT(*) as count FROM sales").get() as any)?.count || 0;
    const localClientsCount = (db.prepare("SELECT COUNT(*) as count FROM clients").get() as any)?.count || 0;
    const hasLocalUserData = localProductsCount > 0 || localSalesCount > 0 || localClientsCount > 0;

    // Check if Firestore actually contains any user data across main tables as a safety check
    let hasAnyFirestoreDocuments = false;
    for (const collName of ['products', 'sales', 'clients', 'users']) {
      try {
        const snap = await getDocs(query(collection(firestore, collName), limit(1)));
        if (!snap.empty) {
          hasAnyFirestoreDocuments = true;
          break;
        }
      } catch (err: any) {
        console.warn(`[Sync] Safety check failed for Firestore collection "${collName}":`, err.message);
      }
    }

    const isPopulated = hasAnyFirestoreDocuments || metaDoc.exists();

    if (!isPopulated) {
      if (hasLocalUserData) {
        console.log("[Sync] Firestore is currently empty/uninitialized. Seeding initial cloud tables with local database records.");
        await pushAllLocalToFirestore();
        await setDoc(metaRef, { initialized: true, initializedAt: new Date().toISOString() });
        return;
      } else {
        console.log("[Sync] Firestore and local SQLite are both empty/uninitialized. Skipping initial seed.");
        await setDoc(metaRef, { initialized: true, initializedAt: new Date().toISOString() });
      }
    } else if (!metaDoc.exists()) {
      // Ensure metadata flag exists henceforth so deleting all products does not trigger re-seeding
      await setDoc(metaRef, { initialized: true, initializedAt: new Date().toISOString() });
    }

    // Pull each collection and upsert data into SQLite
    for (const table of SYNC_TABLES) {
      const snapshot = await getDocs(collection(firestore, table));
      
      if (snapshot.empty) {
        const localCount = (db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any)?.count || 0;
        if (localCount > 0) {
          console.log(`[Sync Safety] Descubierta tabla "${table}" vacía en Firestore pero con ${localCount} filas locales. Reparando y subiendo datos locales para prevenir pérdida.`);
          await pushLocalToFirestore(table);
        } else {
          console.log(`[Sync] Table "${table}" was empty in both Cloud Firestore and SQLite.`);
        }
        continue;
      }

      // Sync remote records with SQLite table in an atomic transaction:
      // Clear the local table first to ensure consistency (deletions are synced correctly from cloud to local),
      // then insert the latest remote records with safety column checking.
      let allowedColumns: Set<string>;
      try {
        const info = db.pragma(`table_info(${table})`) as any[];
        allowedColumns = new Set(info.map(col => col.name));
      } catch (colErr: any) {
        console.warn(`[Sync] Could not fetch columns for table ${table}, using document keys directly:`, colErr.message);
        allowedColumns = new Set();
      }

      const syncTx = db.transaction(() => {
        if (forceOverwrite) {
          db.prepare(`DELETE FROM ${table}`).run();
        }
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          let keys = Object.keys(data);
          if (keys.length === 0) continue;

          // Filter keys to valid SQLite columns only
          if (allowedColumns.size > 0) {
            keys = keys.filter(k => allowedColumns.has(k));
          }
          if (keys.length === 0) continue;

          const placeholders = keys.map(() => '?').join(', ');
          const values = keys.map(k => data[k]);

          const insertSql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
          db.prepare(insertSql).run(...values);
        }
      });

      syncTx();
      console.log(`[Sync] Table "${table}" successfully replaced local copy with ${snapshot.size} cloud records.`);
    }

    lastPullTimestamp = Date.now();
    console.log("[Sync] Database synchronizations completed. GTR POS is fully ready and permanently synced.");
  } catch (error: any) {
    console.log("[Sync Offline Mode] Standard local database operates standalone. Remote cloud sync is bypassed:", error.message);
  } finally {
    isPullingInProgress = false;
  }
}

/**
 * Convenient helper to trigger a non-blocking asynchronous sync of one or more tables to Firestore after a local write.
 * Supports mapping table names to exact primary key values to execute a targeted push.
 */
export function syncAfterWrite(tableOrMap: string | string[] | Record<string, any | any[]>, idOrIds?: any | any[]) {
  if (typeof tableOrMap === 'object' && !Array.isArray(tableOrMap)) {
    // It's a Record mapping: { tableName: idOrIds }
    for (const [table, ids] of Object.entries(tableOrMap)) {
      pushLocalToFirestore(table, ids).catch(err => {
        console.warn(`[Sync Offline Mode] Targeted sync postponed for table "${table}":`, err.message);
      });
    }
  } else {
    const tables = Array.isArray(tableOrMap) ? tableOrMap : [tableOrMap];
    for (const table of tables) {
      // If single table and idOrIds is supplied, target it. Otherwise fallback to full table sync.
      const targetIds = (tables.length === 1 || tables[0] === table) ? idOrIds : undefined;
      pushLocalToFirestore(table, targetIds).catch(err => {
        console.warn(`[Sync Offline Mode] Sync postponed for table "${table}":`, err.message);
      });
    }
  }
}
