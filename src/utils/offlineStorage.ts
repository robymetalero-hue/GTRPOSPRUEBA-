import { safeDispatchEvent } from "./events";

// Offline storage utility for GTR POS
// Manages offline sales queueing in IndexedDB with fallback to LocalStorage

const DB_NAME = 'gtr_pos_offline_db';
const STORE_NAME = 'offline_sales';
const ACTIONS_STORE_NAME = 'offline_actions';
const STATE_CACHE_STORE = 'app_state_cache';
const DB_VERSION = 3; // Incremented database version to support state persistence cache store

export interface OfflineSale {
    id: string; // Unique temporary ID
    salePayload: any;
    clientName?: string;
    clientPhone?: string;
    createdAt: string;
}

export interface OfflineAction {
    id: string; // Unique temporary ID
    type: string; // e.g., 'create_client', 'create_pending_sale', 'adjust_points', 'add_department'
    url: string;
    method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    payload: any;
    metadata?: any;
    createdAt: string;
}

// Memory fallback queue in case both IndexedDB and LocalStorage are inaccessible
let memoryQueue: OfflineSale[] = [];
let memoryActionsQueue: OfflineAction[] = [];
const memoryStateCache: Record<string, any> = {};

/**
 * Safely opens IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB not supported'));
            return;
        }

        try {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                reject(request.error || new Error('Database open failed'));
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(ACTIONS_STORE_NAME)) {
                    db.createObjectStore(ACTIONS_STORE_NAME, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STATE_CACHE_STORE)) {
                    db.createObjectStore(STATE_CACHE_STORE, { keyPath: 'key' });
                }
            };
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * LocalStorage Fallback functions
 */
function getLocalStorageQueue(): OfflineSale[] {
    try {
        const stored = localStorage.getItem('gtr_offline_sales_queue');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.warn('LocalStorage fallback failed:', e);
        return memoryQueue;
    }
}

function saveLocalStorageQueue(queue: OfflineSale[]): void {
    try {
        localStorage.setItem('gtr_offline_sales_queue', JSON.stringify(queue));
    } catch (e) {
        console.warn('Saving to LocalStorage failed:', e);
        memoryQueue = queue;
    }
}

/**
 * Saves a sale to the offline queue
 */
export async function saveOfflineSale(salePayload: any, clientName?: string, clientPhone?: string): Promise<OfflineSale> {
    // Ensure payload has a unique idempotency clientOperationId
    const safePayload = {
        ...salePayload,
        clientOperationId: salePayload.clientOperationId || salePayload.client_operation_id || `offline_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const offlineSale: OfflineSale = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        salePayload: safePayload,
        clientName,
        clientPhone,
        createdAt: new Date().toISOString()
    };

    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(offlineSale);

            request.onsuccess = () => {
                db.close();
                console.log('[Offline DB] Sale saved successfully to IndexedDB:', offlineSale.id);
                safeDispatchEvent('offline_queue_changed', { detail: { action: 'add_sale', sale: offlineSale } });
                resolve(offlineSale);
            };

            request.onerror = () => {
                db.close();
                reject(request.error || new Error('Failed to save to IndexedDB'));
            };
        });
    } catch (err) {
        console.warn('[Offline DB] IndexedDB unavailable, falling back to LocalStorage:', err);
        const queue = getLocalStorageQueue();
        queue.push(offlineSale);
        saveLocalStorageQueue(queue);
        safeDispatchEvent('offline_queue_changed', { detail: { action: 'add_sale', sale: offlineSale } });
        return offlineSale;
    }
}

/**
 * Retrieves all offline sales from the queue
 */
export async function getOfflineSales(): Promise<OfflineSale[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                db.close();
                resolve(request.result || []);
            };

            request.onerror = () => {
                db.close();
                reject(request.error || new Error('Failed to fetch from IndexedDB'));
            };
        });
    } catch (err) {
        console.warn('[Offline DB] IndexedDB fetch failed, using fallback:', err);
        return getLocalStorageQueue();
    }
}

/**
 * Deletes a sale from the offline queue
 */
export async function deleteOfflineSale(id: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                db.close();
                console.log('[Offline DB] Sale deleted from IndexedDB:', id);
                safeDispatchEvent('offline_queue_changed', { detail: { action: 'delete_sale', id } });
                resolve();
            };

            request.onerror = () => {
                db.close();
                reject(request.error || new Error('Failed to delete from IndexedDB'));
            };
        });
    } catch (err) {
        console.warn('[Offline DB] IndexedDB delete failed, using fallback:', err);
        const queue = getLocalStorageQueue();
        const filtered = queue.filter(item => item.id !== id);
        saveLocalStorageQueue(filtered);
        safeDispatchEvent('offline_queue_changed', { detail: { action: 'delete_sale', id } });
    }
}

/**
 * Checks if there are pending offline sales in queue
 */
export async function hasOfflineSales(): Promise<boolean> {
    const list = await getOfflineSales();
    return list.length > 0;
}

/**
 * LocalStorage Fallback functions for actions
 */
function getLocalStorageActionsQueue(): OfflineAction[] {
    try {
        const stored = localStorage.getItem('gtr_offline_actions_queue');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.warn('LocalStorage fallback failed for actions:', e);
        return memoryActionsQueue;
    }
}

function saveLocalStorageActionsQueue(queue: OfflineAction[]): void {
    try {
        localStorage.setItem('gtr_offline_actions_queue', JSON.stringify(queue));
    } catch (e) {
        console.warn('Saving actions to LocalStorage failed:', e);
        memoryActionsQueue = queue;
    }
}

/**
 * Saves a POS action to the offline action queue
 */
export async function saveOfflineAction(
    type: string, 
    url: string, 
    method: 'POST' | 'PUT' | 'DELETE' | 'PATCH', 
    payload: any, 
    metadata?: any
): Promise<OfflineAction> {
    const offlineAction: OfflineAction = {
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        url,
        method,
        payload,
        metadata,
        createdAt: new Date().toISOString()
    };

    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(ACTIONS_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(ACTIONS_STORE_NAME);
            const request = store.add(offlineAction);

            request.onsuccess = () => {
                db.close();
                console.log('[Offline DB] Action saved successfully to IndexedDB:', offlineAction.id, `(${type})`);
                safeDispatchEvent('offline_queue_changed', { detail: { action: 'add_action', item: offlineAction } });
                resolve(offlineAction);
            };

            request.onerror = () => {
                db.close();
                reject(request.error || new Error('Failed to save action to IndexedDB'));
            };
        });
    } catch (err) {
        console.warn('[Offline DB] IndexedDB action save failed, falling back to LocalStorage:', err);
        const queue = getLocalStorageActionsQueue();
        queue.push(offlineAction);
        saveLocalStorageActionsQueue(queue);
        safeDispatchEvent('offline_queue_changed', { detail: { action: 'add_action', item: offlineAction } });
        return offlineAction;
    }
}

/**
 * Retrieves all offline actions from the queue
 */
export async function getOfflineActions(): Promise<OfflineAction[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(ACTIONS_STORE_NAME, 'readonly');
            const store = transaction.objectStore(ACTIONS_STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                db.close();
                resolve(request.result || []);
            };

            request.onerror = () => {
                db.close();
                reject(request.error || new Error('Failed to fetch actions from IndexedDB'));
            };
        });
    } catch (err) {
        console.warn('[Offline DB] IndexedDB action fetch failed, using fallback:', err);
        return getLocalStorageActionsQueue();
    }
}

/**
 * Deletes an action from the offline action queue
 */
export async function deleteOfflineAction(id: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(ACTIONS_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(ACTIONS_STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                db.close();
                console.log('[Offline DB] Action deleted from IndexedDB:', id);
                safeDispatchEvent('offline_queue_changed', { detail: { action: 'delete_action', id } });
                resolve();
            };

            request.onerror = () => {
                db.close();
                reject(request.error || new Error('Failed to delete action from IndexedDB'));
            };
        });
    } catch (err) {
        console.warn('[Offline DB] IndexedDB action delete failed, using fallback:', err);
        const queue = getLocalStorageActionsQueue();
        const filtered = queue.filter(item => item.id !== id);
        saveLocalStorageActionsQueue(filtered);
        safeDispatchEvent('offline_queue_changed', { detail: { action: 'delete_action', id } });
    }
}

/**
 * Checks if there are pending offline actions in queue
 */
export async function hasOfflineActions(): Promise<boolean> {
    const list = await getOfflineActions();
    return list.length > 0;
}

export interface OfflineStats {
    salesCount: number;
    actionsCount: number;
    totalAmountBob: number;
    totalAmountUsd: number;
    oldestPendingDate: string | null;
}

/**
 * Computes live statistics for all items waiting in offline queues
 */
export async function getOfflineStats(): Promise<OfflineStats> {
    const [sales, actions] = await Promise.all([
        getOfflineSales(),
        getOfflineActions()
    ]);

    let totalBob = 0;
    let totalUsd = 0;
    let oldestDate: string | null = null;

    for (const sale of sales) {
        const payload = sale.salePayload || {};
        const currency = payload.currency || 'BOB';
        const total = Number(payload.total) || 0;

        if (currency === 'USD') {
            totalUsd += total;
        } else {
            totalBob += total;
        }

        if (sale.createdAt) {
            if (!oldestDate || new Date(sale.createdAt) < new Date(oldestDate)) {
                oldestDate = sale.createdAt;
            }
        }
    }

    for (const action of actions) {
        if (action.createdAt) {
            if (!oldestDate || new Date(action.createdAt) < new Date(oldestDate)) {
                oldestDate = action.createdAt;
            }
        }
    }

    return {
        salesCount: sales.length,
        actionsCount: actions.length,
        totalAmountBob: totalBob,
        totalAmountUsd: totalUsd,
        oldestPendingDate: oldestDate
    };
}

/**
 * Generates a full emergency export JSON payload containing all offline records
 */
export async function exportOfflineBackupJSON(): Promise<string> {
    const [sales, actions] = await Promise.all([
        getOfflineSales(),
        getOfflineActions()
    ]);

    const backup = {
        format: 'GTR_POS_OFFLINE_BACKUP_v2',
        generatedAt: new Date().toISOString(),
        deviceInfo: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            platform: typeof navigator !== 'undefined' ? navigator.platform : ''
        },
        summary: {
            salesCount: sales.length,
            actionsCount: actions.length
        },
        offlineSales: sales,
        offlineActions: actions
    };

    return JSON.stringify(backup, null, 2);
}

/**
 * Triggers a direct browser download of the emergency offline backup file
 */
export async function downloadOfflineBackupFile(): Promise<void> {
    const jsonStr = await exportOfflineBackupJSON();
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `GTR_POS_Respaldo_Offline_${dateStr}.json`;

    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Persists generic app state (products, clients, settings, departments, cart) into IndexedDB
 */
export async function cacheAppState(key: string, data: any): Promise<void> {
    if (data === undefined || data === null) return;
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STATE_CACHE_STORE, 'readwrite');
            const store = transaction.objectStore(STATE_CACHE_STORE);
            const record = { key, data, updatedAt: new Date().toISOString() };
            const request = store.put(record);

            request.onsuccess = () => {
                db.close();
                resolve();
            };

            request.onerror = () => {
                db.close();
                reject(request.error || new Error('Failed to cache state in IndexedDB'));
            };
        });
    } catch (err) {
        console.warn(`[IndexedDB Cache] Failed to put key "${key}", falling back to LocalStorage:`, err);
        try {
            localStorage.setItem(`idxdb_fallback_${key}`, JSON.stringify(data));
        } catch (lsErr) {
            memoryStateCache[key] = data;
        }
    }
}

/**
 * Retrieves cached app state from IndexedDB
 */
export async function getCachedAppState<T>(key: string): Promise<T | null> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(STATE_CACHE_STORE, 'readonly');
            const store = transaction.objectStore(STATE_CACHE_STORE);
            const request = store.get(key);

            request.onsuccess = () => {
                db.close();
                if (request.result && request.result.data !== undefined) {
                    resolve(request.result.data as T);
                } else {
                    // Try LocalStorage fallback
                    const fallback = localStorage.getItem(`idxdb_fallback_${key}`);
                    if (fallback) {
                        try {
                            resolve(JSON.parse(fallback));
                        } catch {
                            resolve(null);
                        }
                    } else {
                        resolve(memoryStateCache[key] ?? null);
                    }
                }
            };

            request.onerror = () => {
                db.close();
                const fallback = localStorage.getItem(`idxdb_fallback_${key}`);
                if (fallback) {
                    try { resolve(JSON.parse(fallback)); } catch { resolve(null); }
                } else {
                    resolve(memoryStateCache[key] ?? null);
                }
            };
        });
    } catch (err) {
        console.warn(`[IndexedDB Cache] IndexedDB open error for "${key}", using fallback:`, err);
        const fallback = localStorage.getItem(`idxdb_fallback_${key}`);
        if (fallback) {
            try { return JSON.parse(fallback); } catch { return null; }
        }
        return memoryStateCache[key] ?? null;
    }
}

/**
 * Clears cached app state from IndexedDB
 */
export async function clearCachedAppState(key: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(STATE_CACHE_STORE, 'readwrite');
            const store = transaction.objectStore(STATE_CACHE_STORE);
            const request = store.delete(key);

            request.onsuccess = () => { db.close(); resolve(); };
            request.onerror = () => { db.close(); resolve(); };
        });
    } catch (err) {
        localStorage.removeItem(`idxdb_fallback_${key}`);
        delete memoryStateCache[key];
    }
}

/**
 * Purges ALL offline queues, offline sales, offline actions, and cached app state from IndexedDB and LocalStorage
 */
export async function clearAllOfflineStorage(): Promise<void> {
    memoryQueue = [];
    memoryActionsQueue = [];
    Object.keys(memoryStateCache).forEach(k => delete memoryStateCache[k]);

    try {
        localStorage.clear();
    } catch (e) {}

    try {
        const db = await openDB();
        const stores = [STORE_NAME, ACTIONS_STORE_NAME, STATE_CACHE_STORE];
        const tx = db.transaction(stores, 'readwrite');
        stores.forEach(s => {
            try { tx.objectStore(s).clear(); } catch (e) {}
        });
        await new Promise<void>((res) => {
            tx.oncomplete = () => { db.close(); res(); };
            tx.onerror = () => { db.close(); res(); };
        });
    } catch (e) {
        console.warn("Failed to clear IndexedDB stores:", e);
    }
}

