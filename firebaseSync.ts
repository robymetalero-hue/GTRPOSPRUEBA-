import { initializeApp, getApps, getApp } from 'firebase/app';

let quotaExceeded = false;
let quotaExceededTime = 0;
export function checkQuota(): boolean {
  if (quotaExceeded) {
    if (Date.now() - quotaExceededTime > 1000 * 60 * 60) {
      quotaExceeded = false;
      return false;
    }
    return true;
  }
  return false;
}

function handleSyncError(err: any, msg: string) {
  const errMsg = err?.message || String(err);
  const lower = errMsg.toLowerCase();
  if (lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('429')) {
    if (!quotaExceeded) {
      console.warn("[Sync] Firestore quota limit reached. Operating in standalone offline mode.");
      quotaExceeded = true;
      quotaExceededTime = Date.now();
    }
  } else if (!lower.includes('offline') && !lower.includes('network') && !lower.includes('unavailable') && !lower.includes('auth')) {
    console.warn(`${msg} ${errMsg}`);
  }
}

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  writeBatch, 
  query, 
  limit,
  orderBy
} from 'firebase/firestore';
import { db } from './database.ts';
import { 
  validateFirestoreWriteOperation, 
  validateRemoteFirestoreDocument,
  type UserContext 
} from './firestoreIntegrityMiddleware.ts';
import fs from 'fs';
import path from 'path';

// Load Firebase app configuration searching multiple potential locations
let firebaseConfig: any = {};
const configLocations = [
  path.resolve(process.cwd(), 'firebase-applet-config.json'),
  path.resolve(process.cwd(), '..', 'firebase-applet-config.json')
];

for (const loc of configLocations) {
  try {
    if (fs.existsSync(loc)) {
      firebaseConfig = JSON.parse(fs.readFileSync(loc, 'utf8'));
      break;
    }
  } catch (e: any) {
    console.warn(`[Firebase] Could not read config at ${loc}:`, e.message);
  }
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
      console.log("[Firebase] SDK initialized with Project ID:", firebaseConfig.projectId);
    }
  }
} catch (e: any) {
  console.warn("[Firebase] SDK initialization deferred:", e.message);
}

let firestoreInstance: any = null;
try {
  firestoreInstance = app
    ? (firebaseConfig.firestoreDatabaseId 
        ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
        : getFirestore(app))
    : null;
} catch (e: any) {
  console.warn("[Firestore] Instance deferred:", e.message);
}

export const firestore = firestoreInstance;

let authDisabledUntil = 0;
let authAuthenticated = false;
let authPromise: Promise<void> | null = null;

export async function ensureServerAuth() {
  if (!app || !firestore) return;
  if (authAuthenticated) return;
  if (Date.now() < authDisabledUntil) return;

  if (!authPromise) {
    authPromise = (async () => {
      const authTimeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
      const authTask = (async () => {
        try {
          const auth = getAuth(app);
          const email = "server_sync@dstore.app";
          const password = "ServerSync_SecretPassword!123";
          try {
            await signInWithEmailAndPassword(auth, email, password);
            authAuthenticated = true;
          } catch (e: any) {
            if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
              try {
                await createUserWithEmailAndPassword(auth, email, password);
                authAuthenticated = true;
              } catch (createErr: any) {
                authDisabledUntil = Date.now() + (10 * 60 * 1000);
              }
            } else {
              authDisabledUntil = Date.now() + (10 * 60 * 1000);
            }
          }
        } catch (err: any) {
          authDisabledUntil = Date.now() + (10 * 60 * 1000);
        }
      })();
      await Promise.race([authTask, authTimeout]);
    })().finally(() => {
      authPromise = null;
    });
  }
  return authPromise;
}

export const SYNC_TABLES = [
  'settings',
  'users',
  'products',
  'clients',
  'sales',
  'sale_items',
  'shifts',
  'exchange_rate_audit',
  'caja_cierres',
  'departments',
  'stock_arrivals',
  'pending_sales',
  'pending_sale_items',
  'accounts_receivable',
  'credit_payments',
  'pending_sale_payments',
  'cash_accounts',
  'cash_movements',
  'cash_settlements',
  'inventory_audit_logs',
  'system_audit_logs',
  'inventory_counts',
  'inventory_count_items',
  'offline_pending_sales',
  'firestore_transaction_ledger'
];

let isPullingInProgress = false;
let lastPullTimestamp = 0;
const PULL_COOLDOWN_MS = 10000; // 10 seconds rate limit for background pulls

// List of tables that are append-only to avoid full collection scans & rewrites on sync
export const APPEND_ONLY_TABLES = [
  'sales',
  'sale_items',
  'shifts',
  'exchange_rate_audit',
  'caja_cierres',
  'stock_arrivals',
  'pending_sales',
  'pending_sale_items',
  'accounts_receivable',
  'credit_payments',
  'pending_sale_payments',
  'cash_settlements',
  'inventory_audit_logs',
  'system_audit_logs',
  'inventory_counts',
  'inventory_count_items',
  'firestore_transaction_ledger'
];

// In-memory cache of last successfully synchronized maximum IDs per table to prevent redundant Firestore operations
export const lastSyncedMaxIdCache: Record<string, number> = {};

/**
 * Records a deletion in the local deleted_records tombstone table.
 */
export function recordDeletion(tableName: string, recordId: string | number) {
  try {
    const idStr = String(recordId);
    db.prepare("INSERT OR REPLACE INTO deleted_records (table_name, record_id, deleted_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%S-04:00', 'now', '-4 hours'))").run(tableName, idStr);
  } catch (e: any) {
    console.warn(`[DeletedRecords] Warning recording deletion for ${tableName} #${recordId}:`, e.message);
  }
}

/**
 * Checks if a record was marked as deleted.
 */
export function isRecordDeleted(tableName: string, recordId: string | number): boolean {
  try {
    const row = db.prepare('SELECT 1 FROM deleted_records WHERE table_name = ? AND record_id = ?').get(tableName, String(recordId));
    return !!row;
  } catch (e: any) {
    return false;
  }
}

/**
 * Deletes document(s) directly and immediately from Firestore.
 */
export async function deleteFromFirestore(tableName: string, idOrIds: any | any[], userContext?: UserContext) {
  if (!firestore || checkQuota()) {
    return;
  }
  await ensureServerAuth();

  const ids = Array.isArray(idOrIds) ? idOrIds.map(String) : [String(idOrIds)];
  if (ids.length === 0) return;

  try {
    let batch = writeBatch(firestore);
    let count = 0;
    for (const id of ids) {
      // Validate deletion operation and log to tamper-evident transaction ledger
      try {
        validateFirestoreWriteOperation(tableName, id, 'DELETE', undefined, userContext);
      } catch (valErr: any) {
        console.warn(`[Firestore Integrity Warning] Blocked delete operation on ${tableName} #${id}:`, valErr.message);
        continue;
      }

      const docRef = doc(firestore, tableName, String(id));
      batch.delete(docRef);
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(firestore);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
    console.log(`[Sync Delete] Successfully deleted ${ids.length} document(s) from Firestore collection "${tableName}".`);
  } catch (err: any) {
    handleSyncError(err, `[Sync Delete Error] Could not delete from Firestore "${tableName}":`);
  }
}

/**
 * Pushes a local SQLite table's content to Firestore.
 * Supports targeted synchronization for specific rows to optimize speed and network payload.
 */
export async function pushLocalToFirestore(tableName: string, idOrIds?: any | any[], userContext?: UserContext) {
  if (!firestore || checkQuota()) {
    return;
  }
  await ensureServerAuth();

  try {
    const isSettings = tableName === 'settings';
    let rows: any[] = [];
    const idList = idOrIds ? (Array.isArray(idOrIds) ? idOrIds.map(String) : [String(idOrIds)]) : null;

    // Filter out locally deleted records
    let deletedIdsSet = new Set<string>();
    try {
      const deletedRows = db.prepare("SELECT record_id FROM deleted_records WHERE table_name = ?").all(tableName) as any[];
      deletedIdsSet = new Set(deletedRows.map(r => String(r.record_id)));
    } catch (e) {}

    if (idList && idList.length > 0) {
      // Sync only specific rows to make it super fast
      if (isSettings) {
        const placeholders = idList.map(() => '?').join(', ');
        rows = db.prepare(`SELECT * FROM settings WHERE key IN (${placeholders})`).all(...idList) as any[];
      } else {
        const validIds = idList.filter(id => !deletedIdsSet.has(String(id)));
        if (validIds.length === 0) {
          // If all targeted IDs are deleted, delete them from Firestore
          await deleteFromFirestore(tableName, idList, userContext);
          return;
        }
        const placeholders = validIds.map(() => '?').join(', ');
        rows = db.prepare(`SELECT * FROM ${tableName} WHERE id IN (${placeholders})`).all(...validIds) as any[];
      }
    } else {
      // Full table sync requested.
      if (APPEND_ONLY_TABLES.includes(tableName)) {
        // 1. Obtener ID máximo local en SQLite
        let localMaxId = 0;
        try {
          const maxRow = db.prepare(`SELECT MAX(id) as maxId FROM ${tableName}`).get() as any;
          localMaxId = Number(maxRow?.maxId || 0);
        } catch (sqliteErr: any) {}

        // 2. Si localMaxId es 0, no hay datos locales, no hace falta hacer nada
        if (localMaxId === 0) {
          return;
        }

        // 3. Consultar cache local en memoria. Si ya está sincronizado hasta el ID local máximo, omitir
        const cachedMax = lastSyncedMaxIdCache[tableName];
        if (cachedMax !== undefined && localMaxId <= cachedMax) {
          return;
        }

        // 4. Consultar ID máximo actual en Firestore
        let firestoreMaxId = 0;
        const colRef = collection(firestore, tableName);
        try {
          const q = query(colRef, orderBy('id', 'desc'), limit(1));
          const qSnapshot = await getDocs(q);
          if (!qSnapshot.empty) {
            const docData = qSnapshot.docs[0].data();
            if (docData && typeof docData.id === 'number') {
              firestoreMaxId = docData.id;
            }
          }
        } catch (firestoreErr: any) {
          handleSyncError(firestoreErr, `[Sync] Could not verify remote max ID for "${tableName}":`);
          firestoreMaxId = -1;
        }

        if (firestoreMaxId >= 0) {
          if (localMaxId <= firestoreMaxId) {
            lastSyncedMaxIdCache[tableName] = firestoreMaxId;
            return;
          }

          rows = db.prepare(`SELECT * FROM ${tableName} WHERE id > ?`).all(firestoreMaxId) as any[];

          if (rows.length === 0) {
            lastSyncedMaxIdCache[tableName] = firestoreMaxId;
            return;
          }

          let batch = writeBatch(firestore);
          let opCount = 0;

          for (const row of rows) {
            const docId = String(row.id);
            if (deletedIdsSet.has(docId)) continue;

            const cleanData: any = {};
            for (const [key, val] of Object.entries(row)) {
              if (val !== undefined) {
                cleanData[key] = val;
              }
            }

            // Strictly validate payload integrity and compute cryptographic transaction hash
            let enrichedData = cleanData;
            try {
              const validation = validateFirestoreWriteOperation(tableName, docId, 'CREATE', cleanData, userContext);
              enrichedData = validation.enrichedPayload;
            } catch (valErr: any) {
              console.warn(`[Firestore Anti-Ghost Violation] Blocked record on ${tableName} #${docId}:`, valErr.message);
              continue;
            }

            const docRef = doc(firestore, tableName, docId);
            batch.set(docRef, enrichedData);
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

          lastSyncedMaxIdCache[tableName] = localMaxId;
          return;
        }
      }

      rows = db.prepare(`SELECT * FROM ${tableName}`).all() as any[];
      if (deletedIdsSet.size > 0 && !isSettings) {
        rows = rows.filter(r => !deletedIdsSet.has(String(r.id)));
      }
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

        const cleanData: any = {};
        for (const [key, val] of Object.entries(row)) {
          if (val !== undefined) {
            cleanData[key] = val;
          }
        }
        if (isSettings && !cleanData.updated_at) {
          cleanData.updated_at = new Date().toISOString();
        }

        // Validate payload & compute transaction hash
        let enrichedData = cleanData;
        try {
          const validation = validateFirestoreWriteOperation(tableName, docId, 'CREATE', cleanData, userContext);
          enrichedData = validation.enrichedPayload;
        } catch (valErr: any) {
          console.warn(`[Firestore Anti-Ghost Violation] Blocked targeted row on ${tableName} #${docId}:`, valErr.message);
          continue;
        }

        const docRef = doc(firestore, tableName, docId);
        batch.set(docRef, enrichedData);
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
    if (rows.length > 0) {
      for (const docSnap of snapshot.docs) {
        if (!localIds.has(docSnap.id)) {
          try {
            validateFirestoreWriteOperation(tableName, docSnap.id, 'DELETE', undefined, userContext);
          } catch (delErr: any) {
            continue;
          }
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

    // Upsert all local records to Firestore with strict verification
    for (const row of rows) {
      const docId = tableName === 'settings' ? row.key : String(row.id);
      
      const cleanData: any = {};
      for (const [key, val] of Object.entries(row)) {
        if (val !== undefined) {
          cleanData[key] = val;
        }
      }
      if (tableName === 'settings' && !cleanData.updated_at) {
        cleanData.updated_at = new Date().toISOString();
      }

      let enrichedData = cleanData;
      try {
        const validation = validateFirestoreWriteOperation(tableName, docId, 'CREATE', cleanData, userContext);
        enrichedData = validation.enrichedPayload;
      } catch (valErr: any) {
        console.warn(`[Firestore Anti-Ghost Violation] Blocked upsert on ${tableName} #${docId}:`, valErr.message);
        continue;
      }

      const docRef = doc(firestore, tableName, docId);
      batch.set(docRef, enrichedData);
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
    handleSyncError(error, `[Sync Offline Mode] Unable to sync local table "${tableName}" to Firestore (will save locally):`);
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
  if (!firestore || checkQuota()) {
    return;
  }
  await ensureServerAuth();

  if (isPullingInProgress) {
    return;
  }

  if (!forceOverwrite && (Date.now() - lastPullTimestamp < PULL_COOLDOWN_MS)) {
    return;
  }

  isPullingInProgress = true;

  try {
    // Determine if Firestore has been initialized/populated already
    const metaRef = doc(firestore, 'sync_metadata', 'status');
    const metaDoc = await getDoc(metaRef);
    
    // Query local database sizes to see if we have actual user records locally to seed
    const localProductsCount = (db.prepare("SELECT COUNT(*) as count FROM products").get() as any)?.count || 0;
    const localSalesCount = (db.prepare("SELECT COUNT(*) as count FROM sales").get() as any)?.count || 0;
    const localClientsCount = (db.prepare("SELECT COUNT(*) as count FROM clients").get() as any)?.count || 0;
    const hasLocalUserData = localProductsCount > 0 || localSalesCount > 0 || localClientsCount > 0;

    // Check if Firestore actually contains any user data across main tables as a parallel safety check
    let hasAnyFirestoreDocuments = false;
    try {
      const safetySnaps = await Promise.all(
        ['products', 'sales', 'clients', 'users'].map(collName =>
          getDocs(query(collection(firestore, collName), limit(1))).catch(() => null)
        )
      );
      hasAnyFirestoreDocuments = safetySnaps.some(s => s && !s.empty);
    } catch (err: any) {
      handleSyncError(err, `[Sync] Safety check:`);
    }

    const isPopulated = hasAnyFirestoreDocuments || metaDoc.exists();

    if (!isPopulated) {
      if (hasLocalUserData) {
        console.log("[Sync] Initializing cloud database with local records...");
        await pushAllLocalToFirestore();
        await setDoc(metaRef, { initialized: true, initializedAt: new Date().toISOString() });
        return;
      } else {
        await setDoc(metaRef, { initialized: true, initializedAt: new Date().toISOString() });
      }
    } else if (!metaDoc.exists()) {
      await setDoc(metaRef, { initialized: true, initializedAt: new Date().toISOString() });
    }

    let updatedTableCount = 0;

    // Fetch all Firestore collections in parallel concurrently for ultra-fast load speed
    const collectionResults = await Promise.all(
      SYNC_TABLES.map(async (table) => {
        try {
          let snapshot;
          if (table === 'firestore_transaction_ledger') {
            snapshot = await getDocs(query(collection(firestore, table), limit(100)));
          } else {
            snapshot = await getDocs(collection(firestore, table));
          }
          return { table, snapshot, error: null };
        } catch (tableErr: any) {
          handleSyncError(tableErr, `[Sync Warning] Table "${table}":`);
          return { table, snapshot: null, error: tableErr };
        }
      })
    );

    // Pull each collection and upsert data into SQLite inside a single high-performance transaction
    const globalSyncTx = db.transaction(() => {
      for (const { table, snapshot, error } of collectionResults) {
        if (error || !snapshot) continue;

        try {
          if (snapshot.empty) {
            if (metaDoc.exists()) {
              try {
                db.prepare(`DELETE FROM ${table}`).run();
              } catch (e: any) {}
            }
            continue;
          }

          let allowedColumns: Set<string>;
          try {
            const info = db.pragma(`table_info(${table})`) as any[];
            allowedColumns = new Set(info.map(col => col.name));
          } catch (colErr: any) {
            allowedColumns = new Set();
          }

          // Fetch locally deleted record IDs for this table
          let deletedIdsSet = new Set<string>();
          try {
            const deletedRows = db.prepare("SELECT record_id FROM deleted_records WHERE table_name = ?").all(table) as any[];
            deletedIdsSet = new Set(deletedRows.map(r => String(r.record_id)));
          } catch (e) {}

          // Pre-capture local verified stock map to implement the ANTI-OVERWRITE STOCK SHIELD
          const localProductStocksMap = new Map<number, number>();
          if (table === 'products') {
            try {
              const currentProds = db.prepare('SELECT id, stock FROM products').all() as any[];
              for (const p of currentProds) {
                if (p.id !== undefined && p.stock !== null && p.stock !== undefined) {
                  localProductStocksMap.set(Number(p.id), Number(p.stock));
                }
              }
            } catch (_) {}
          }

          const remoteDocs = snapshot.docs;
          const remoteIds = new Set<string>();

          if (forceOverwrite && table !== 'system_audit_logs') {
            db.prepare(`DELETE FROM ${table}`).run();
          }

          for (const docSnap of remoteDocs) {
            const data = docSnap.data();
            if (table === 'settings' && !data.key) {
              data.key = docSnap.id;
            }
            const docId = String(table === 'settings' ? (data.key || docSnap.id) : (data.id !== undefined ? data.id : docSnap.id));
            remoteIds.add(docId);

            // CRITICAL: Never re-insert records that have been deleted!
            if (deletedIdsSet.has(docId)) {
              continue;
            }

            // ANTI-GHOST RECORD VALIDATION: Verify incoming Firestore document structure
            if (!validateRemoteFirestoreDocument(table, data, docId)) {
              continue;
            }

            if (table === 'departments' && data && data.name && ['Storage', 'Micro SDs', 'USBs', 'Electronics', 'Micro SD'].includes(data.name)) {
              const prodCount = db.prepare("SELECT COUNT(*) as count FROM products WHERE category = ?").get(data.name) as any;
              if (!prodCount || prodCount.count === 0) {
                continue;
              }
            }

            if (table === 'products' && data.id !== undefined) {
              try {
                const prodIdNum = Number(data.id);
                const localStock = localProductStocksMap.get(prodIdNum);

                // ANTI-OVERWRITE STOCK SHIELD:
                // Stock is an inventory counter governed by historical transactions in the immutable ledger.
                // Remote metadata updates (prices, costs, names, categories, descriptions, images) from Firestore
                // MUST NEVER overwrite the verified local physical stock, UNLESS an explicit certified formal
                // reconciliation payload is present.
                const isFormalReconciliation = Boolean(
                  data.is_formal_reconciliation || 
                  data.reconciled_by_forensic || 
                  data._force_stock_reconciliation
                );

                if (!isFormalReconciliation) {
                  if (localStock !== undefined) {
                    // Shield local physical stock: Retain verified local stock so remote metadata edits never stomp on inventory
                    data.stock = localStock;
                  } else {
                    // Newly received product from remote without prior local row.
                    // Register its initial creation event in system_audit_logs if missing so the ledger is born in sync.
                    const initialStock = Number(data.stock) || 0;
                    try {
                      const hasLog = db.prepare(
                        "SELECT id FROM system_audit_logs WHERE (related_product_id = ? OR entity_id = ?) AND event_type = 'creacion_producto' LIMIT 1"
                      ).get(prodIdNum, prodIdNum);
                      if (!hasLog) {
                        db.prepare(`
                          INSERT INTO system_audit_logs (
                            event_type, action, user_name, user_role, entity_type, entity_id,
                            related_product_id, quantity_before, quantity_changed, quantity_after,
                            reason, created_at
                          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(
                          'creacion_producto', 'creacion', 'sync_shield', 'admin', 'product',
                          prodIdNum, prodIdNum, 0, initialStock, initialStock,
                          'Alta remota sincronizada: Stock inicial blindado en libro mayor inmutable',
                          data.created_at || new Date().toISOString()
                        );
                      }
                    } catch (_) {}
                  }
                }
              } catch (e: any) {
                console.warn('[Sync Stock Shield] Error shielding product stock:', e.message);
              }
            }

            if (table === 'settings' && docId === 'exchange_rate' && !forceOverwrite) {
              try {
                const localRateRow = db.prepare("SELECT value, updated_at FROM settings WHERE key = 'exchange_rate'").get() as any;
                const lastAudit = db.prepare("SELECT changed_at, new_rate FROM exchange_rate_audit ORDER BY id DESC LIMIT 1").get() as any;
                
                const remoteVal = parseFloat(data.value);
                const localVal = parseFloat(localRateRow?.value || (lastAudit?.new_rate ? String(lastAudit.new_rate) : ''));

                // Shield 1: If incoming remote rate is 6.96 or invalid, but local has a valid audited custom rate (e.g. 13, 8.5, etc.),
                // NEVER let the remote default 6.96 stomp on the user's custom rate!
                if (!isNaN(remoteVal) && remoteVal === 6.96 && !isNaN(localVal) && localVal > 0 && localVal !== 6.96) {
                  console.log(`[Sync ExchangeRate Shield] Retaining local custom exchange rate of ${localVal} Bs. over remote default 6.96.`);
                  continue;
                }

                // Shield 2: Timestamp comparison using lastAudit.changed_at, settings.updated_at, remote updated_at or _tx_timestamp
                const localTimestamp = (lastAudit && lastAudit.changed_at) 
                  ? lastAudit.changed_at 
                  : (localRateRow ? localRateRow.updated_at : null);
                const remoteTimestamp = data.updated_at || data._tx_timestamp || null;

                if (localTimestamp && remoteTimestamp) {
                  const localTime = new Date(localTimestamp).getTime();
                  const remoteTime = new Date(remoteTimestamp).getTime();
                  if (!isNaN(localTime) && !isNaN(remoteTime) && localTime >= remoteTime) {
                    console.log(`[Sync ExchangeRate Shield] Local rate timestamp (${localTimestamp}) is newer or equal to remote (${remoteTimestamp}). Keeping local.`);
                    continue;
                  }
                }
              } catch (e: any) {
                console.warn('[Sync ExchangeRate Shield] Warning checking rate timestamps:', e.message);
              }
            }

            let keys = Object.keys(data);
            if (keys.length === 0) continue;

            if (allowedColumns.size > 0) {
              keys = keys.filter(k => allowedColumns.has(k));
            }
            if (keys.length === 0) continue;

            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(k => data[k]);

            const insertSql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
            db.prepare(insertSql).run(...values);
          }

          // Reconcile deletions
          if (['products', 'clients', 'departments'].includes(table) && remoteDocs.length > 0 && !forceOverwrite) {
            try {
              const localRows = db.prepare(`SELECT id, updated_at FROM ${table}`).all() as any[];
              for (const localRow of localRows) {
                const localIdStr = String(localRow.id);
                if (!remoteIds.has(localIdStr)) {
                  const updatedAtTime = localRow.updated_at ? new Date(localRow.updated_at).getTime() : 0;
                  const isRecentlyCreatedLocally = (Date.now() - updatedAtTime) < 60000;

                  if (!isRecentlyCreatedLocally || deletedIdsSet.has(localIdStr)) {
                    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(localRow.id);
                    recordDeletion(table, localIdStr);
                  }
                }
              }
            } catch (reconcileErr: any) {}
          }
          updatedTableCount++;
        } catch (tableErr: any) {
          handleSyncError(tableErr, `[Sync Warning] Table "${table}":`);
        }
      }
    });

    globalSyncTx();

    // AUTOMATED CATALOG STOCK SHIELD RECONCILIATION:
    // Guarantees that no product stock has drifted from its transactional history.
    try {
      reconcileCatalogStockWithLedger();
    } catch (reconcileErr: any) {
      console.warn('[Sync Guard] Warning during post-pull stock reconciliation:', reconcileErr.message);
    }

    lastPullTimestamp = Date.now();
    
    for (const key of Object.keys(lastSyncedMaxIdCache)) {
      delete lastSyncedMaxIdCache[key];
    }
    
    if (forceOverwrite) {
      console.log(`[Sync] Master database pull completed successfully (${updatedTableCount} tables synced).`);
    }
  } catch (error: any) {
    // Standalone fallback
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

/**
 * Completely purges all data from Google Cloud Firestore and local SQLite,
 * leaving a clean zeroed database with baseline seed admin users and default settings.
 */
export async function clearAllFirestoreAndLocalData(): Promise<void> {
  console.log("[Sync Reset] Starting complete database purge (Local SQLite & Cloud Firestore)...");

  // 1. Clear Google Cloud Firestore collections in parallel
  if (firestore) {
    try {
      await ensureServerAuth();
      const collectionsToClear = [...SYNC_TABLES, 'processed_operations', 'deleted_records'];
      
      await Promise.all(collectionsToClear.map(async (tableName) => {
        try {
          let hasMore = true;
          let totalDeleted = 0;
          while (hasMore) {
            const colRef = collection(firestore, tableName);
            const q = query(colRef, limit(200));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
              hasMore = false;
              break;
            }
            const batch = writeBatch(firestore);
            for (const docSnap of snapshot.docs) {
              batch.delete(docSnap.ref);
            }
            await batch.commit();
            totalDeleted += snapshot.size;
            if (snapshot.size < 200) {
              hasMore = false;
            }
          }
          if (totalDeleted > 0) {
            console.log(`[Sync Reset] Cleared ${totalDeleted} records from Firestore collection "${tableName}".`);
          }
        } catch (colErr: any) {
          console.warn(`[Sync Reset Warning] Error clearing Firestore collection "${tableName}":`, colErr.message);
        }
      }));

      // Mark sync_metadata status as initialized so empty collections are treated as intentionally zeroed
      const metaRef = doc(firestore, 'sync_metadata', 'status');
      await setDoc(metaRef, { initialized: true, resetAt: new Date().toISOString() });
    } catch (fsErr: any) {
      console.warn("[Sync Reset Warning] Failed to authenticate or access Firestore during reset:", fsErr.message);
    }
  }

  // 2. Clear local SQLite database tables
  const tablesToClear = [
    'products',
    'clients',
    'sales',
    'sale_items',
    'shifts',
    'caja_cierres',
    'departments',
    'stock_arrivals',
    'pending_sales',
    'pending_sale_items',
    'accounts_receivable',
    'credit_payments',
    'pending_sale_payments',
    'cash_accounts',
    'cash_movements',
    'cash_settlements',
    'inventory_audit_logs',
    'system_audit_logs',
    'inventory_counts',
    'inventory_count_items',
    'exchange_rate_audit',
    'offline_pending_sales',
    'firestore_transaction_ledger',
    'processed_operations',
    'deleted_records'
  ];

  try {
    db.exec(`DROP TRIGGER IF EXISTS prevent_system_audit_logs_delete;`);
    db.exec(`DROP TRIGGER IF EXISTS prevent_system_audit_logs_update;`);
    db.exec(`DROP TRIGGER IF EXISTS prevent_firestore_ledger_delete;`);
    db.exec(`DROP TRIGGER IF EXISTS prevent_firestore_ledger_update;`);
  } catch (e) {}

  for (const table of tablesToClear) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch (e: any) {
      console.warn(`[Local Reset Warning] Error deleting local table "${table}":`, e.message);
    }
  }

  // Remove non-seed users and reset sequence
  try {
    db.prepare("DELETE FROM users WHERE username NOT IN ('admin', 'roby')").run();
  } catch (e: any) {}

  // Reset auto-increment sequence counters so ticket and product IDs start fresh at #1
  try {
    db.prepare(`DELETE FROM sqlite_sequence WHERE name NOT IN ('users')`).run();
  } catch (e: any) {}

  // Re-enable immutable triggers for system_audit_logs and firestore_transaction_ledger
  try {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS prevent_system_audit_logs_update
      BEFORE UPDATE ON system_audit_logs
      BEGIN
        SELECT RAISE(FAIL, 'system_audit_logs are immutable and cannot be updated');
      END;
      CREATE TRIGGER IF NOT EXISTS prevent_system_audit_logs_delete
      BEFORE DELETE ON system_audit_logs
      BEGIN
        SELECT RAISE(FAIL, 'system_audit_logs are immutable and cannot be deleted');
      END;
      CREATE TRIGGER IF NOT EXISTS prevent_firestore_ledger_update
      BEFORE UPDATE ON firestore_transaction_ledger
      BEGIN
        SELECT RAISE(FAIL, 'firestore_transaction_ledger entries are immutable and cannot be modified');
      END;
      CREATE TRIGGER IF NOT EXISTS prevent_firestore_ledger_delete
      BEFORE DELETE ON firestore_transaction_ledger
      BEGIN
        SELECT RAISE(FAIL, 'firestore_transaction_ledger entries are immutable and cannot be deleted');
      END;
    `);
  } catch (e) {}

  // Re-seed default settings and seed users in SQLite (preserving existing custom exchange rate)
  try {
    const existingRate = db.prepare('SELECT value FROM settings WHERE key = ?').get('exchange_rate') as any;
    const rateToPreserve = (existingRate && existingRate.value && !isNaN(parseFloat(existingRate.value)) && parseFloat(existingRate.value) > 0)
      ? String(existingRate.value)
      : '6.96';
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('exchange_rate', rateToPreserve);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_products', 'true');
  } catch (e) {}

  // Reset in-memory cache
  for (const key of Object.keys(lastSyncedMaxIdCache)) {
    delete lastSyncedMaxIdCache[key];
  }

  // 3. Re-push seed users and settings to Firestore
  try {
    await pushLocalToFirestore('users');
    await pushLocalToFirestore('settings');
  } catch (e) {}

  console.log("[Sync Reset] Complete database reset finished successfully. Database is now at clean zero state.");
}

/**
 * AUTOMATED CATALOG STOCK SHIELD RECONCILIATION
 * Mathematical source of truth verification:
 * Real Stock = Initial Stock + Total Arrivals - Total Sales + Total Adjustments
 * Reconciles any drifts between products.stock and historical transaction ledger.
 */
export function reconcileCatalogStockWithLedger(): { audited: number; corrected: number; corrections: any[] } {
  const prods = db.prepare('SELECT id, name, sku, stock FROM products').all() as any[];
  let corrected = 0;
  const corrections: any[] = [];
  const nowIso = new Date().toISOString();

  for (const p of prods) {
    // 1. Initial stock at product creation
    const createLog = db.prepare(`
      SELECT quantity_after 
      FROM system_audit_logs 
      WHERE (related_product_id = ? OR entity_id = ?) AND event_type = 'creacion_producto'
      ORDER BY created_at ASC LIMIT 1
    `).get(p.id, p.id) as any;
    const initialStock = createLog ? (createLog.quantity_after || 0) : 0;

    // 2. Cumulative arrivals
    const arrivals = (db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM stock_arrivals WHERE product_id = ?').get(p.id) as any)?.total || 0;

    // 3. Cumulative sales
    const sales = (db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM sale_items WHERE product_id = ?').get(p.id) as any)?.total || 0;

    // 4. Inventory manual adjustments (strictly excluding audit, shield, and reconciliation logs to prevent feedback loops)
    const adjustments = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'ajuste_incremento' OR type = 'ingreso_devolucion' THEN quantity ELSE 0 END), 0) as inc,
        COALESCE(SUM(CASE WHEN type = 'ajuste_decremento' THEN quantity ELSE 0 END), 0) as dec
      FROM inventory_audit_logs
      WHERE product_id = ? 
        AND reference NOT LIKE 'Auditoría%' 
        AND reference NOT LIKE 'Conciliación%' 
        AND reference NOT LIKE 'Blindaje%'
    `).get(p.id) as any;

    const expectedStock = initialStock + arrivals - sales + (adjustments?.inc || 0) - (adjustments?.dec || 0);

    if (expectedStock !== p.stock) {
      const diff = expectedStock - p.stock;
      db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(expectedStock, nowIso, p.id);
      
      db.prepare(`
        INSERT INTO inventory_audit_logs 
        (product_id, product_name, product_sku, type, quantity, price, user_id, username, reference, notes, created_at)
        VALUES (?, ?, ?, ?, ?, 0, 1, 'system_guard', 'Blindaje Inmutable Anti-Desfase', ?, ?)
      `).run(p.id, p.name, p.sku, diff > 0 ? 'ajuste_incremento' : 'ajuste_decremento', Math.abs(diff), `Blindaje reactivo: Stock corregido de ${p.stock} a ${expectedStock} según libro mayor inmutable`, nowIso);

      try {
        db.prepare(`
          INSERT INTO system_audit_logs (
            event_type, action, user_name, user_role, entity_type, entity_id,
            related_product_id, quantity_before, quantity_changed, quantity_after,
            reason, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'ajuste_manual', diff > 0 ? 'incremento' : 'decremento', 'system_guard', 'admin', 'product',
          p.id, p.id, p.stock, diff, expectedStock,
          `Blindaje reactivo: Stock corregido de ${p.stock} a ${expectedStock} según libro mayor inmutable`,
          nowIso
        );
      } catch (_) {}

      corrected++;
      corrections.push({ id: p.id, name: p.name, sku: p.sku, oldStock: p.stock, newStock: expectedStock, diff });
      console.log(`[Stock Guard Shield] Reconciled Product #${p.id} (${p.name}): ${p.stock} -> ${expectedStock}`);
    }
  }

  return { audited: prods.length, corrected, corrections };
}

let ledgerReconciliationTimer: NodeJS.Timeout | null = null;

/**
 * Starts a periodic mathematical reconciliation routine against the immutable ledger.
 * Continuously protects stock against deferred offline syncs and remote metadata collisions.
 */
export function startPeriodicLedgerReconciliation(intervalMs: number = 60000) {
  if (ledgerReconciliationTimer) {
    clearInterval(ledgerReconciliationTimer);
  }

  // Initial immediate reconciliation
  try {
    const initRes = reconcileCatalogStockWithLedger();
    if (initRes.corrected > 0) {
      console.log(`[Ledger Shield Boot] Reconciled ${initRes.corrected} products with mathematical ledger.`);
    }
  } catch (err: any) {
    console.warn('[Ledger Shield Boot Warning]:', err.message);
  }

  // Recurring background interval
  ledgerReconciliationTimer = setInterval(() => {
    try {
      const res = reconcileCatalogStockWithLedger();
      if (res.corrected > 0) {
        console.log(`[Periodic Ledger Reconciler] Automatically reconciled ${res.corrected} products drifting from immutable ledger.`);
        if (typeof (global as any).broadcastGlobalInventoryUpdate === 'function') {
          (global as any).broadcastGlobalInventoryUpdate(res.corrections);
        }
      }
    } catch (err: any) {
      console.warn('[Periodic Ledger Reconciler Warning]:', err.message);
    }
  }, intervalMs);

  console.log(`[Ledger Reconciler] Periodic immutable ledger reconciliation active (every ${intervalMs / 1000}s).`);
}

// Export alias pushFirestoreToLocal for seamless drop-in compatibility
export const pushFirestoreToLocal = pullFirestoreToLocal;
