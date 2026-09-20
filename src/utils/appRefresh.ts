/**
 * Utility function to perform a controlled hard refresh of the application
 * when a version discrepancy or stale asset issue is detected.
 *
 * Iterates through `window.caches.keys()`, deletes all named caches,
 * clears `localStorage` and `indexedDB` in a controlled manner
 * (preserving critical user authentication and offline transaction queues),
 * and executes `window.location.reload(true)`.
 */

const CRITICAL_LOCAL_STORAGE_KEYS = [
    'user',
    'auth_token',
    'gtr_offline_sales_queue',
    'gtr_offline_actions_queue',
    'gtr_hardware_config',
    'cached_sales_tabs',
    'cached_active_tab_id',
    'gtr_pos_active_cart_backup',
    'kioskMode',
    'pwa_installed'
];

export async function hardRefreshApp(): Promise<void> {
    console.warn("[hardRefreshApp] Version mismatch detected. Initiating controlled hard refresh...");

    // 1. Unregister Service Workers
    if ('serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        } catch (swErr) {
            console.warn("[hardRefreshApp] Error unregistering service workers:", swErr);
        }
    }

    // 2. Iterate through window.caches.keys() and delete all named caches
    if ('caches' in window && window.caches) {
        try {
            const cacheNames = await window.caches.keys();
            await Promise.all(
                cacheNames.map((cacheName) => {
                    console.log(`[hardRefreshApp] Deleting cache: ${cacheName}`);
                    return window.caches.delete(cacheName);
                })
            );
        } catch (cacheErr) {
            console.warn("[hardRefreshApp] Error clearing named window caches:", cacheErr);
        }
    }

    // 3. Controlled LocalStorage Clear (excluding critical user & queue data)
    try {
        const preservedItems: Record<string, string> = {};

        // Backup critical keys
        CRITICAL_LOCAL_STORAGE_KEYS.forEach((key) => {
            const val = localStorage.getItem(key);
            if (val !== null) {
                preservedItems[key] = val;
            }
        });

        // Clear localStorage
        localStorage.clear();

        // Restore critical keys
        Object.entries(preservedItems).forEach(([key, val]) => {
            localStorage.setItem(key, val);
        });
    } catch (lsErr) {
        console.warn("[hardRefreshApp] Error clearing localStorage selectively:", lsErr);
    }

    // 4. Controlled IndexedDB Clear (excluding critical offline sales/actions queues)
    if ('indexedDB' in window && window.indexedDB) {
        try {
            await new Promise<void>((resolve) => {
                const req = window.indexedDB.open('gtr_pos_offline_db');
                req.onsuccess = () => {
                    const db = req.result;
                    // Clear app_state_cache (product/client/department cache), leaving offline_sales & offline_actions intact
                    if (db.objectStoreNames.contains('app_state_cache')) {
                        try {
                            const tx = db.transaction('app_state_cache', 'readwrite');
                            const store = tx.objectStore('app_state_cache');
                            store.clear();
                            tx.oncomplete = () => {
                                db.close();
                                resolve();
                            };
                            tx.onerror = () => {
                                db.close();
                                resolve();
                            };
                        } catch {
                            db.close();
                            resolve();
                        }
                    } else {
                        db.close();
                        resolve();
                    }
                };
                req.onerror = () => resolve();
            });

            // Delete non-critical third-party or temporary IndexedDB databases if listed
            if (typeof window.indexedDB.databases === 'function') {
                const dbs = await window.indexedDB.databases();
                for (const dbInfo of dbs) {
                    if (dbInfo.name && dbInfo.name !== 'gtr_pos_offline_db' && !dbInfo.name.includes('offline')) {
                        window.indexedDB.deleteDatabase(dbInfo.name);
                    }
                }
            }
        } catch (idbErr) {
            console.warn("[hardRefreshApp] Error clearing IndexedDB stores:", idbErr);
        }
    }

    // 5. Clear SessionStorage
    try {
        sessionStorage.clear();
    } catch (ssErr) {
        console.warn("[hardRefreshApp] Error clearing sessionStorage:", ssErr);
    }

    // 6. Force reload
    try {
        (window.location as any).reload(true);
    } catch {
        window.location.reload();
    }
}
