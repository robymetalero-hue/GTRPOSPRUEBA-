import { safeDispatchEvent } from "../utils/events";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User, CartItem, Product, Client, ReceiptTemplate, Department, SaleTab, RgbThemeSettings } from '../types';
import { normalizePermissions } from '../utils/permissions';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, setDoc, onSnapshot, getDocFromServer, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
    getOfflineSales, 
    deleteOfflineSale, 
    getOfflineActions, 
    deleteOfflineAction, 
    saveOfflineAction, 
    hasOfflineActions, 
    hasOfflineSales, 
    cacheAppState, 
    getCachedAppState,
    getOfflineStats
} from '../utils/offlineStorage';
import {
    getCachedUserProfile,
    setCachedUserProfile,
    getCachedMinimalProducts,
    setCachedMinimalProducts
} from '../utils/localForageCache';

// Initialize Client-Side Firebase SDK with auto-detect long polling to prevent stream timeouts
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, dbId);
} catch (e) {
  firestoreInstance = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
}

export const firestoreDb = firestoreInstance;

// Silence internal Firestore SDK connection logs (warnings/info)
try {
  setLogLevel('silent');
} catch (e) {}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null
    },
    operationType,
    path
  };
  
  const isPermissionError = errMessage.toLowerCase().includes('permission') || 
                            errMessage.toLowerCase().includes('insufficient') || 
                            errMessage.toLowerCase().includes('denied');

  if (isPermissionError) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else {
    // Standard connection or availability limitations are logged as console warnings to prevent blocking diagnostic error tracking
    console.warn(`[Sync Offline Mode] Standard local database operates standalone. Remote cloud sync is bypassed due to connectivity/offline status: ${errMessage}`);
  }
}

// Validate Connection to Firestore and warn if client is offline
async function testConnection() {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
  } catch (error: any) {
    // Safely catch any connectivity error without throwing or raising console errors
    console.log(`[Sync Connection Test] Note: Cloud backend connection is not active currently (${error?.message || error}). POS local SQLite is fully interactive.`);
  }
}
testConnection();

export type ViewType = 'inicio' | 'pos' | 'ventas_pendientes' | 'historial_ventas' | 'productos' | 'departamentos' | 'inventario' | 'auditoria' | 'devoluciones' | 'reportes' | 'analisis' | 'usuarios' | 'configuraciones' | 'cajas';

interface AppContextType {
    isInitializing: boolean;
    kioskMode: boolean;
    setKioskMode: (k: boolean) => void;
    isSupervisorUnlocked: boolean;
    setIsSupervisorUnlocked: (val: boolean) => void;
    supervisorInfo: { id: number; username: string; role: string } | null;
    relockKiosk: () => void;
    isFullscreen: boolean;
    toggleFullscreen: () => void;
    user: User | null;
    setUser: (u: User | null) => void;
    darkMode: boolean;
    setDarkMode: (d: boolean) => void;
    cart: CartItem[];
    addToCart: (product: Product, quantity?: number) => void;
    updateCartItemQuantity: (productId: number, qty: number) => void;
    removeFromCart: (productId: number) => void;
    clearCart: (isCompletedSale?: boolean) => void;
    lastClearedCart: CartItem[] | null;
    lastClearedMeta: any;
    cartBackup: CartItem[] | null;
    cartBackupMeta: any;
    restoreLastClearedCart: () => boolean;
    restoreCartBackup: () => boolean;
    discardCartBackup: () => void;
    updateCartItemPrice: (productId: number, priceType: 'unit' | 'bulk' | 'custom', customPrice?: number, customPriceBs?: number) => void;
    products: Product[];
    clients: Client[];
    fetchProducts: (searchQuery?: string) => Promise<void>;
    fetchClients: () => Promise<void>;
    hasMoreProducts: boolean;
    totalProducts: number;
    loadMoreProducts: (searchQuery?: string) => Promise<void>;
    view: ViewType;
    setView: (v: ViewType) => void;
    exchangeRate: number;
    setExchangeRate: (r: number) => void;
    fetchExchangeRate: () => Promise<void>;
    roundBs: (num: number) => number;
    isOffline: boolean;
    receiptTemplate: ReceiptTemplate;
    updateReceiptTemplate: (tpl: ReceiptTemplate) => Promise<void>;
    fetchReceiptTemplate: () => Promise<void>;
    departments: Department[];
    fetchDepartments: () => Promise<void>;
    tabs: SaleTab[];
    setTabs: React.Dispatch<React.SetStateAction<SaleTab[]>>;
    activeTabId: number;
    setActiveTabId: React.Dispatch<React.SetStateAction<number>>;
    clientName: string;
    setClientName: React.Dispatch<React.SetStateAction<string>>;
    clientPhone: string;
    setClientPhone: React.Dispatch<React.SetStateAction<string>>;
    discount: number;
    setDiscount: React.Dispatch<React.SetStateAction<number>>;
    discountType: 'monto' | 'porcentaje';
    setDiscountType: React.Dispatch<React.SetStateAction<'monto' | 'porcentaje'>>;
    paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Crédito';
    setPaymentMethod: React.Dispatch<React.SetStateAction<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Crédito'>>;
    theme: string;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
    rgbSettings: RgbThemeSettings;
    setRgbSettings: React.Dispatch<React.SetStateAction<RgbThemeSettings>>;
    isSyncing: boolean;
    triggerOnlineSync: () => Promise<void>;
    syncError: string | null;
    setSyncError: React.Dispatch<React.SetStateAction<string | null>>;
    
    // Offline & Sync Engine
    networkLatency: number | null;
    networkQuality: 'online' | 'offline' | 'unstable';
    pendingSalesCount: number;
    pendingActionsCount: number;
    isOfflineModalOpen: boolean;
    setIsOfflineModalOpen: (b: boolean) => void;
    deductLocalProductStock: (items: Array<{ product_id: number; quantity: number }>) => void;
    registerLocalClient: (client: { id: string | number; name: string; phone?: string }) => void;

    // S.I.T.A. Autonomous QA Testing Systems
    isAutonomousTesting: boolean;
    setIsAutonomousTesting: (b: boolean) => void;
    autonomousStep: number;
    setAutonomousStep: (n: number) => void;
    autonomousLogs: string[];
    setAutonomousLogs: React.Dispatch<React.SetStateAction<string[]>>;
    apiPingResults: any;
    setApiPingResults: (results: any) => void;

    // PWA Install & Bulletproof Update Properties
    pwaPrompt: any;
    setPwaPrompt: (prompt: any) => void;
    installPWA: () => Promise<void>;
    isPwaInstalled: boolean;
    setIsPwaInstalled: (b: boolean) => void;
    isPwaInstallModalOpen: boolean;
    setIsPwaInstallModalOpen: (b: boolean) => void;
    hasPwaUpdate: boolean;
    isUpdatingPwa: boolean;
    pwaUpdateStepMessage: string;
    pwaVersionInfo: { currentVersion: string; latestVersion: string; buildTime: number };
    checkForPwaUpdates: () => Promise<boolean>;
    applyPwaUpdate: () => Promise<void>;
    handlePwaPrimaryAction: () => Promise<void>;
    showNotification?: (message: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

/**
 * Fail-safe wrapper around localStorage.setItem.
 * Prevents QuotaExceededError or DOMException from breaking application execution
 * when storing large payloads (e.g. products catalogue). Large datasets are safely
 * preserved in IndexedDB via cacheAppState.
 */
export function safeLocalStorageSetItem(key: string, value: string): boolean {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e: any) {
        console.warn(`[Storage Warning] localStorage quota exceeded or restricted for key "${key}". Relying on IndexedDB storage.`, e?.message || e);
        return false;
    }
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isInitializing, setIsInitializing] = useState(() => {
        try {
            const hasCachedProds = !!localStorage.getItem('cached_products');
            const hasUser = !!localStorage.getItem('user');
            return !hasCachedProds && !hasUser;
        } catch {
            return false;
        }
    });
    const [kioskMode, setKioskMode] = useState(() => localStorage.getItem('kioskMode') === 'true');
    const [isSupervisorUnlocked, setIsSupervisorUnlocked] = useState(false);
    const [supervisorInfo, setSupervisorInfo] = useState<{ id: number; username: string; role: string } | null>(null);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(() => typeof document !== 'undefined' ? !!document.fullscreenElement : false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(typeof document !== 'undefined' ? !!document.fullscreenElement : false);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = useCallback(() => {
        try {
            if (!document.fullscreenElement) {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else if ((document.documentElement as any).webkitRequestFullscreen) {
                    (document.documentElement as any).webkitRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                } else if ((document as any).webkitExitFullscreen) {
                    (document as any).webkitExitFullscreen();
                }
            }
        } catch (err) {
            console.warn("Fullscreen toggle error:", err);
        }
    }, []);

    const relockKiosk = useCallback(() => {
        setIsSupervisorUnlocked(false);
        setSupervisorInfo(null);
    }, []);

    const [isOffline, setIsOffline] = useState(() => !window.navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const syncRunningRef = useRef(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    // Offline & Sync Engine States
    const [networkLatency, setNetworkLatency] = useState<number | null>(null);
    const [networkQuality, setNetworkQuality] = useState<'online' | 'offline' | 'unstable'>('online');
    const [pendingSalesCount, setPendingSalesCount] = useState<number>(0);
    const [pendingActionsCount, setPendingActionsCount] = useState<number>(0);
    const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);

    // PWA & Bulletproof Update Lifecycle States
    const [pwaPrompt, setPwaPrompt] = useState<any>(null);
    const [isPwaInstallModalOpen, setIsPwaInstallModalOpen] = useState<boolean>(false);
    const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(() => {
        const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        const localFlag = localStorage.getItem('pwa_installed') === 'true';
        return standalone || localFlag;
    });
    const [hasPwaUpdate, setHasPwaUpdate] = useState<boolean>(false);
    const [isUpdatingPwa, setIsUpdatingPwa] = useState<boolean>(false);
    const [pwaUpdateStepMessage, setPwaUpdateStepMessage] = useState<string>('Iniciando...');
    const [pwaVersionInfo, setPwaVersionInfo] = useState<{ currentVersion: string; latestVersion: string; buildTime: number }>(() => {
        const storedBuild = localStorage.getItem('pwa_build_timestamp');
        return {
            currentVersion: localStorage.getItem('pwa_app_version') || '2.4.0',
            latestVersion: '2.4.0',
            buildTime: storedBuild ? parseInt(storedBuild, 10) : 1771465200000
        };
    });

    // Check for updates against both the Service Worker and the version.json manifest
    const checkForPwaUpdates = async (): Promise<boolean> => {
        let updateFound = false;
        try {
            // 1. Service Worker update check
            if ('serviceWorker' in navigator && (window as any).__pwaServiceWorkerReg) {
                const reg = (window as any).__pwaServiceWorkerReg;
                await reg.update().catch(() => {});
                if (reg.waiting) {
                    setHasPwaUpdate(true);
                    updateFound = true;
                }
            }

            // 2. HTTP Version and API manifest ping
            if (navigator.onLine) {
                // Check static version.json
                const res = await fetch(`/version.json?t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
                }).catch(() => null);

                if (res && res.ok) {
                    const data = await res.json().catch(() => null);
                    if (data && data.buildTime) {
                        const localBuild = pwaVersionInfo.buildTime;
                        if (data.buildTime > localBuild || (data.version && data.version !== pwaVersionInfo.currentVersion)) {
                            setPwaVersionInfo(prev => ({
                                ...prev,
                                latestVersion: data.version || '2.4.0',
                                buildTime: data.buildTime
                            }));
                            setHasPwaUpdate(true);
                            updateFound = true;
                        }
                    }
                }

                // Also check /api/app-version endpoint
                const apiRes = await fetch(`/api/app-version?t=${Date.now()}`).catch(() => null);
                if (apiRes && apiRes.ok) {
                    const apiData = await apiRes.json().catch(() => null);
                    if (apiData && apiData.version && apiData.version !== pwaVersionInfo.currentVersion) {
                        setPwaVersionInfo(prev => ({
                            ...prev,
                            latestVersion: apiData.version
                        }));
                        setHasPwaUpdate(true);
                        updateFound = true;
                    }
                }
            }
        } catch (err) {
            console.warn('[PWA] Update check bypassed (offline/unreachable):', err);
        }
        return updateFound;
    };

    // Apply PWA update cleanly, purging old assets while preserving IndexedDB / business data
    const applyPwaUpdate = async () => {
        setIsUpdatingPwa(true);
        setPwaUpdateStepMessage('Iniciando actualización...');
        if (showNotification) {
            showNotification('Aplicando actualización a la última versión...', 'info');
        }

        try {
            const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

            await delay(250);
            setPwaUpdateStepMessage('Limpiando caché...');
            if (window.caches) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(k => window.caches.delete(k)));
            }

            await delay(300);
            setPwaUpdateStepMessage('Desregistrando Service Worker...');
            if ('serviceWorker' in navigator) {
                const reg = (window as any).__pwaServiceWorkerReg || await navigator.serviceWorker.getRegistration();
                if (reg && reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    reg.waiting.postMessage('SKIP_WAITING');
                }
            }

            await delay(300);
            setPwaUpdateStepMessage(`Registrando nueva versión v${pwaVersionInfo.latestVersion}...`);
            localStorage.setItem('pwa_app_version', pwaVersionInfo.latestVersion);
            localStorage.setItem('pwa_build_timestamp', String(pwaVersionInfo.buildTime));

            await delay(350);
            setPwaUpdateStepMessage('Reiniciando terminal...');
            await delay(250);

            window.location.reload();
        } catch (e) {
            console.error('[PWA] Error applying update:', e);
            setPwaUpdateStepMessage('Recargando terminal...');
            window.location.reload();
        }
    };

    // Unified single button action handler (No new buttons added to screens)
    const handlePwaPrimaryAction = async () => {
        if (hasPwaUpdate) {
            // If there's an update, this button forces the update directly
            await applyPwaUpdate();
        } else if (!isPwaInstalled) {
            // If not installed, this button triggers install / installation modal
            await installPWA();
        } else {
            // If already installed and up to date, check for new updates
            const found = await checkForPwaUpdates();
            if (!found) {
                if (showNotification) {
                    showNotification('GTR POS está al día con la última versión disponible.', 'success');
                } else {
                    setIsPwaInstallModalOpen(true);
                }
            }
        }
    };

    useEffect(() => {
        const handleBeforeInstall = (e: any) => {
            e.preventDefault();
            setPwaPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        const handleAppInstalled = () => {
            setIsPwaInstalled(true);
            localStorage.setItem('pwa_installed', 'true');
            setPwaPrompt(null);
        };
        window.addEventListener('appinstalled', handleAppInstalled);

        // Listen for PWA update available events
        const handleUpdateAvailable = () => {
            console.log('[PWA] Evento pwa-update-available recibido. Activando botón de actualización.');
            setHasPwaUpdate(true);
        };
        window.addEventListener('pwa-update-available', handleUpdateAvailable);

        // Automatic update checker on window focus and periodic interval
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && navigator.onLine) {
                checkForPwaUpdates();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Periodic background check every 3 minutes
        const updateInterval = setInterval(() => {
            if (navigator.onLine) {
                checkForPwaUpdates();
            }
        }, 180000);

        // Initial check
        checkForPwaUpdates();

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
            window.removeEventListener('pwa-update-available', handleUpdateAvailable);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(updateInterval);
        };
    }, []);

    const installPWA = async () => {
        if (pwaPrompt) {
            try {
                pwaPrompt.prompt();
                const { outcome } = await pwaPrompt.userChoice;
                if (outcome === 'accepted') {
                    setPwaPrompt(null);
                    setIsPwaInstalled(true);
                    localStorage.setItem('pwa_installed', 'true');
                    return;
                }
            } catch (e) {
                console.error("Error during pwaPrompt.prompt():", e);
            }
        }
        // Always open the dedicated PWA modal for complete guidance and alternative options
        setIsPwaInstallModalOpen(true);
    };

    // S.I.T.A. Autonomous active variables
    const [isAutonomousTesting, setIsAutonomousTesting] = useState(false);
    const [autonomousStep, setAutonomousStep] = useState(0);
    const [autonomousLogs, setAutonomousLogs] = useState<string[]>([]);
    const [apiPingResults, setApiPingResults] = useState<any>(null);

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            console.log("[Sync] Device returned online. Fetching latest remote database state...");
            fetchProducts();
            fetchClients();
            fetchExchangeRate();
        };
        const handleOffline = () => {
            setIsOffline(true);
            console.warn("[Sync] Device is offline. Standard local database operates standalone.");
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const fetchWithRetry = async (url: string, options?: RequestInit, retries = 2, delay = 500): Promise<Response> => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            throw new Error('Offline mode - network is disconnected');
        }
        let timeoutId: any;
        try {
            let signal = options?.signal;
            if (!signal && typeof AbortController !== 'undefined') {
                const controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), 4000);
                signal = controller.signal;
            }

            // Automatically inject Authorization token if available in local storage
            const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
            const finalHeaders: Record<string, string> = {};
            if (options?.headers) {
                if (options.headers instanceof Headers) {
                    options.headers.forEach((val, key) => { finalHeaders[key] = val; });
                } else if (Array.isArray(options.headers)) {
                    options.headers.forEach(([key, val]) => { finalHeaders[key] = val; });
                } else {
                    Object.assign(finalHeaders, options.headers);
                }
            }
            if (token && !finalHeaders['Authorization'] && !finalHeaders['authorization']) {
                finalHeaders['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(url, { ...options, headers: finalHeaders, signal });
            if (timeoutId) clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error('Offline mode - network is disconnected');
            }
            if (retries > 0) {
                console.warn(`[Sync Retry] Fetch to ${url} failed. Retrying in ${delay}ms... (${retries} retries left)`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                return fetchWithRetry(url, options, retries - 1, delay * 1.5);
            }
            throw error;
        }
    };

    // Initial load from local cache to prevent load delay, synchronized asynchronously with Firestore
    const [user, setUserState] = useState<User | null>(() => {
        const u = localStorage.getItem('user');
        if (u) {
            try { 
                const parsed = JSON.parse(u);
                if (parsed && parsed.username !== 'none' && parsed.role !== 'none') {
                    if (parsed.permissions) {
                        parsed.permissions = normalizePermissions(parsed.permissions);
                    }
                    return parsed; 
                }
            } catch { return null; }
        }
        return null; // Return null so the system requests Login first rather than skipping credentials
    });

    // Real-time synchronization is managed locally for each independent terminal session.
    // We do not subscribe to a single global active_session document to prevent cross-logout conflicts.

    const setUser = (u: User | null) => {
        const normalizedUser = u ? {
            ...u,
            permissions: normalizePermissions(u.permissions)
        } as User : null;
        
        setUserState(normalizedUser);
        try {
            if (normalizedUser) {
                localStorage.setItem('user', JSON.stringify(normalizedUser));
            } else {
                localStorage.removeItem('user');
                localStorage.removeItem('auth_token');
                setIsSupervisorUnlocked(false);
                setSupervisorInfo(null);
            }
            setCachedUserProfile(normalizedUser).catch(() => {});
        } catch (err) {
            console.error("Failed to save local user session state:", err);
        }
    };

    // Real-time synchronization of user permissions & role with the server database state
    useEffect(() => {
        if (!user) return;

        const syncUserSession = async () => {
            // Guard: Avoid wasteful continuous network errors when the client is disconnected
            if (navigator.onLine === false) return;

            try {
                const authToken = localStorage.getItem('auth_token');
                const res = await fetch('/api/auth/me', {
                    headers: {
                        'x-user-id': String(user.id),
                        'x-user-role': user.role || '',
                        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                    }
                });
                if (res.ok) {
                    const freshUser = await res.json();
                    
                    const localPerms = JSON.stringify(normalizePermissions(user.permissions));
                    const remotePerms = JSON.stringify(normalizePermissions(freshUser.permissions));
                    
                    if (
                        user.role !== freshUser.role || 
                        user.username !== freshUser.username || 
                        user.email !== freshUser.email || 
                        localPerms !== remotePerms
                    ) {
                        console.log("[Sync] User role/permissions updated on server, synchronizing session...", freshUser);
                        setUser(freshUser);
                    }
                } else if (res.status === 401) {
                    console.warn("[Sync] Auth check returned 401. Retaining local cached user session.");
                }
            } catch (err) {
                console.warn("[Sync] Background session sync failed:", err);
            }
        };

        // Run immediately on mount or user change
        syncUserSession();

        // Check for updates every 10 seconds for ultra-responsive updates
        const intervalId = setInterval(syncUserSession, 10000);
        return () => clearInterval(intervalId);
    }, [user?.id]);

    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('darkMode') === 'true';
    });

    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'emerald';
    });

    const [rgbSettings, setRgbSettings] = useState<RgbThemeSettings>(() => {
        try {
            const saved = localStorage.getItem('rgb_theme_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (!parsed.animationStyle) parsed.animationStyle = 'smooth';
                return parsed;
            }
        } catch (e) {
            console.error("Failed to parse rgb settings", e);
        }
        return {
            effectType: 'neon',
            speed: 20,
            glowIntensity: 'normal',
            angle: -45,
            customColors: ['#ff00ff', '#00f0ff', '#39ff14', '#0066ff', '#9900ff', '#ff7700'],
            animationStyle: 'smooth'
        };
    });

    const [view, setViewInternal] = useState<ViewType>(() => {
        try {
            const saved = localStorage.getItem('cached_current_view');
            return (saved as ViewType) || 'pos';
        } catch {
            return 'pos';
        }
    });

    const setView = (v: ViewType) => {
        setViewInternal(v);
        try {
            localStorage.setItem('cached_current_view', v);
        } catch (e) {
            console.error("Failed to cache current view:", e);
        }
    };

    // State for multi-comanda tabs
    const [tabs, setTabs] = useState<SaleTab[]>(() => {
        try {
            const cached = localStorage.getItem('cached_sales_tabs');
            return cached ? JSON.parse(cached) : [
                { id: 1, name: "Venta 1", cart: [], clientName: "", clientPhone: "", discount: 0, discountType: 'monto', paymentMethod: 'Efectivo' }
            ];
        } catch {
            return [
                { id: 1, name: "Venta 1", cart: [], clientName: "", clientPhone: "", discount: 0, discountType: 'monto', paymentMethod: 'Efectivo' }
            ];
        }
    });
    const [activeTabId, setActiveTabId] = useState<number>(() => {
        try {
            const cached = localStorage.getItem('cached_active_tab_id');
            return cached ? parseInt(cached) : 1;
        } catch {
            return 1;
        }
    });

    const getInitialTab = () => {
        // Find saved tab or default to first
        const found = tabs.find(t => t.id === activeTabId) || tabs[0];
        return found || { id: 1, name: "Venta 1", cart: [], clientName: "", clientPhone: "", discount: 0, discountType: 'monto', paymentMethod: 'Efectivo' };
    };

    const initialTab = getInitialTab();

    const [clientName, setClientName] = useState(() => initialTab.clientName || "");
    const [clientPhone, setClientPhone] = useState(() => initialTab.clientPhone || "");
    const [discount, setDiscount] = useState(() => initialTab.discount || 0);
    const [discountType, setDiscountType] = useState<'monto' | 'porcentaje'>(() => initialTab.discountType || 'monto');
    const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Crédito'>(() => initialTab.paymentMethod || 'Efectivo');
    const [cart, setCart] = useState<CartItem[]>(() => initialTab.cart || []);

    // Safety recall & recovery buffer states
    const [lastClearedCart, setLastClearedCart] = useState<CartItem[] | null>(() => {
        try {
            const saved = localStorage.getItem('gtr_pos_last_cleared_cart');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed.cart) && parsed.cart.length > 0) return parsed.cart;
            }
        } catch {}
        return null;
    });

    const [lastClearedMeta, setLastClearedMeta] = useState<any>(() => {
        try {
            const saved = localStorage.getItem('gtr_pos_last_cleared_cart');
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    clientName: parsed.clientName,
                    clientPhone: parsed.clientPhone,
                    discount: parsed.discount,
                    discountType: parsed.discountType,
                    paymentMethod: parsed.paymentMethod,
                    timestamp: parsed.timestamp
                };
            }
        } catch {}
        return null;
    });

    const [cartBackup, setCartBackup] = useState<CartItem[] | null>(() => {
        try {
            const saved = localStorage.getItem('gtr_pos_active_cart_backup');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed.cart) && parsed.cart.length > 0) return parsed.cart;
            }
        } catch {}
        return null;
    });

    const [cartBackupMeta, setCartBackupMeta] = useState<any>(() => {
        try {
            const saved = localStorage.getItem('gtr_pos_active_cart_backup');
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    clientName: parsed.clientName,
                    clientPhone: parsed.clientPhone,
                    discount: parsed.discount,
                    discountType: parsed.discountType,
                    paymentMethod: parsed.paymentMethod,
                    timestamp: parsed.timestamp
                };
            }
        } catch {}
        return null;
    });

    // Auto-save rolling backup whenever active cart has items
    useEffect(() => {
        if (cart.length > 0) {
            try {
                const payload = {
                    cart,
                    clientName,
                    clientPhone,
                    discount,
                    discountType,
                    paymentMethod,
                    activeTabId,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem('gtr_pos_active_cart_backup', JSON.stringify(payload));
            } catch (e) {
                console.error("Failed saving active cart safety backup:", e);
            }
        } else {
            // When cart is empty, ensure active cart backup is cleanly removed
            try {
                localStorage.removeItem('gtr_pos_active_cart_backup');
            } catch (e) {}
        }
    }, [cart, clientName, clientPhone, discount, discountType, paymentMethod, activeTabId]);

    // Sync tabs list and active ID to localStorage and IndexedDB
    useEffect(() => {
        localStorage.setItem('cached_sales_tabs', JSON.stringify(tabs));
        cacheAppState('cached_sales_tabs', tabs);
    }, [tabs]);

    useEffect(() => {
        localStorage.setItem('cached_active_tab_id', String(activeTabId));
    }, [activeTabId]);

    // Sync active tab state to local variables when activeTabId changes
    useEffect(() => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab) {
            setCart(activeTab.cart || []);
            setClientName(activeTab.clientName || "");
            setClientPhone(activeTab.clientPhone || "");
            setDiscount(activeTab.discount || 0);
            setDiscountType(activeTab.discountType || 'monto');
            setPaymentMethod(activeTab.paymentMethod || 'Efectivo');
        }
    }, [activeTabId]);

    // Sync state variables back to the tabs list
    useEffect(() => {
        setTabs(prev => prev.map(t => {
            if (t.id === activeTabId) {
                return {
                    ...t,
                    cart,
                    clientName,
                    clientPhone,
                    discount,
                    discountType,
                    paymentMethod
                };
            }
            return t;
        }));
    }, [cart, clientName, clientPhone, discount, discountType, paymentMethod, activeTabId]);
    const [products, setProducts] = useState<Product[]>(() => {
        try {
            const cached = localStorage.getItem('cached_products');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [hasMoreProducts, setHasMoreProducts] = useState(false);
    const [totalProducts, setTotalProducts] = useState(0);
    const [productsOffset, setProductsOffset] = useState(0);
    const PRODUCTS_LIMIT = 50;
    const [clients, setClients] = useState<Client[]>(() => {
        try {
            const cached = localStorage.getItem('cached_clients');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [exchangeRate, setExchangeRateInternal] = useState<number>(() => {
        try {
            const cached = localStorage.getItem('cached_exchange_rate');
            if (cached) {
                const parsed = parseFloat(cached);
                return (isNaN(parsed) || parsed <= 0) ? 6.96 : parsed;
            }
            return 6.96;
        } catch {
            return 6.96;
        }
    });

    const setExchangeRate = (rate: any) => {
        try {
            const val = typeof rate === 'function' ? rate(exchangeRate) : rate;
            const parsed = parseFloat(val);
            const safe = (isNaN(parsed) || parsed <= 0) ? 6.96 : parsed;
            setExchangeRateInternal(safe);
            localStorage.setItem('cached_exchange_rate', String(safe));
            cacheAppState('cached_exchange_rate', safe).catch(() => {});
        } catch {
            setExchangeRateInternal(6.96);
        }
    };

    const defaultReceiptTemplate: ReceiptTemplate = {
        logoText: "GTR POS TERMINAL",
        showLogo: true,
        headerText: "Cochabamba - Bolivia\nTelf: 444-XXXXX\nNIT: 382910023",
        footerText: "¡Gracias por su preferencia!\nConserve su recibo para cualquier reclamo.",
        showDate: true,
        showCashier: true,
        showClientInfo: true,
        showHeaderDivider: true,
        showFooterDivider: true,
        showItemSKU: false,
        showPaymentMethod: true,
        fontFamily: 'Helvetica',
        fontSizeHeader: 14,
        fontSizeBody: 8,
        ticketWidth: 80,
        logoImage: null
    };

    const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplate>(() => {
        try {
            const cached = localStorage.getItem('cached_receipt_template');
            return cached ? JSON.parse(cached) : defaultReceiptTemplate;
        } catch {
            return defaultReceiptTemplate;
        }
    });

    const [departments, setDepartments] = useState<Department[]>(() => {
        try {
            const cached = localStorage.getItem('cached_departments');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });

    const roundBs = (amount: number): number => {
        if (isNaN(amount) || amount === null || amount === undefined) return 0;
        return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
    };

    const fetchExchangeRate = async () => {
        try {
            const res = await fetchWithRetry('/api/settings/exchange-rate');
            const data = await res.json();
            const rawRate = data ? data.exchange_rate : null;
            if (rawRate !== undefined && rawRate !== null) {
                const rate = parseFloat(rawRate);
                if (!isNaN(rate) && rate > 0) {
                    setExchangeRate(rate);
                }
            }
            setIsOffline(false);
        } catch (e) {
            console.warn("Failed to fetch exchange rate, using cached value:", e);
            const cached = localStorage.getItem('cached_exchange_rate');
            if (cached) {
                const parsed = parseFloat(cached);
                if (!isNaN(parsed) && parsed > 0) {
                    setExchangeRate(parsed);
                }
            }
            if (e instanceof Error && (e.message.includes('Failed to fetch') || e.message.includes('fetch'))) {
                setIsOffline(true);
            }
        }
    };

    useEffect(() => {
        localStorage.setItem('darkMode', String(darkMode));
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    useEffect(() => {
        localStorage.setItem('theme', theme);
        const classes = document.documentElement.classList;
        const themesToRemove: string[] = [];
        for (let i = 0; i < classes.length; i++) {
            const c = classes.item(i);
            if (c && c.startsWith('theme-')) {
                themesToRemove.push(c);
            }
        }
        themesToRemove.forEach(c => classes.remove(c));
        classes.add(`theme-${theme}`);
        
        if (theme === 'rgb') {
            classes.add('gamer-rgb-glow');
        } else {
            classes.remove('gamer-rgb-glow');
        }
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('rgb_theme_settings', JSON.stringify(rgbSettings));
        
        let colors: string[] = [];
        switch (rgbSettings.effectType) {
            case 'rainbow':
                colors = ['#ff0000', '#ffaa00', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'];
                break;
            case 'neon':
                colors = ['#ff00ff', '#00f0ff', '#39ff14', '#ff0077', '#7000ff', '#ff00ff'];
                break;
            case 'fireIce':
                colors = ['#ff2a00', '#ff9d00', '#00f0ff', '#0066ff', '#ff2a00'];
                break;
            case 'aurora':
                colors = ['#00ffcc', '#2efc3a', '#0d98ba', '#9900ff', '#39ff14', '#00ffcc'];
                break;
            case 'cyberpunk':
                colors = ['#ff0055', '#9900ff', '#00ffcc', '#ff9900', '#ff00ff'];
                break;
            case 'oceanic':
                colors = ['#002244', '#005588', '#0088cc', '#00ffcc', '#00ffaa', '#002244'];
                break;
            case 'sunset':
                colors = ['#ff3300', '#ff6600', '#ff9900', '#cc0066', '#660066', '#ff3300'];
                break;
            case 'pastel':
                colors = ['#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea', '#ffb7b2'];
                break;
            case 'custom':
                colors = rgbSettings.customColors && rgbSettings.customColors.length > 0
                    ? [...rgbSettings.customColors, rgbSettings.customColors[0]]
                    : ['#ff00ff', '#00f0ff', '#ff00ff'];
                break;
            default:
                colors = ['#ff00ff', '#00f0ff', '#39ff14', '#0066ff', '#9900ff', '#ff7700', '#ff00ff'];
        }

        const angleStr = `${rgbSettings.angle}deg`;
        const gradient = `linear-gradient(${angleStr}, ${colors.join(', ')})`;
        
        let glowRadius = '15px';
        let glowColor = 'rgba(0, 255, 204, 0.35)';
        let glowHoverRadius = '25px';
        let glowHoverColor = 'rgba(0, 255, 204, 0.65)';

        switch (rgbSettings.glowIntensity) {
            case 'none':
                glowRadius = '0px';
                glowColor = 'rgba(0,0,0,0)';
                glowHoverRadius = '0px';
                glowHoverColor = 'rgba(0,0,0,0)';
                break;
            case 'subtle':
                glowRadius = '6px';
                glowColor = 'rgba(0, 255, 204, 0.15)';
                glowHoverRadius = '12px';
                glowHoverColor = 'rgba(0, 255, 204, 0.3)';
                break;
            case 'normal':
                glowRadius = '15px';
                glowColor = 'rgba(0, 255, 204, 0.35)';
                glowHoverRadius = '25px';
                glowHoverColor = 'rgba(0, 255, 204, 0.65)';
                break;
            case 'intense':
                glowRadius = '28px';
                glowColor = 'rgba(0, 255, 204, 0.75)';
                glowHoverRadius = '45px';
                glowHoverColor = 'rgba(0, 255, 204, 0.95)';
                break;
        }

        // Animation timing easing & direction
        let ease = 'ease-in-out';
        let direction = 'infinite';

        if (rgbSettings.animationStyle === 'linear') {
            ease = 'linear';
            direction = 'infinite';
        } else if (rgbSettings.animationStyle === 'smooth') {
            ease = 'cubic-bezier(0.4, 0, 0.2, 1)';
            direction = 'infinite';
        } else if (rgbSettings.animationStyle === 'cyclic') {
            ease = 'cubic-bezier(0.45, 0, 0.55, 1)';
            direction = 'infinite alternate';
        }

        const root = document.documentElement;
        root.style.setProperty('--rgb-gradient', gradient);
        root.style.setProperty('--rgb-speed', `${rgbSettings.speed}s`);
        root.style.setProperty('--rgb-glow-radius', glowRadius);
        root.style.setProperty('--rgb-glow-color', glowColor);
        root.style.setProperty('--rgb-glow-hover-radius', glowHoverRadius);
        root.style.setProperty('--rgb-glow-hover-color', glowHoverColor);
        root.style.setProperty('--rgb-ease', ease);
        root.style.setProperty('--rgb-direction', direction);
    }, [rgbSettings]);

    // Pre-hydrate state from localForage & IndexedDB instantly on component mount
    useEffect(() => {
        const prehydrateFromLocalCache = async () => {
            try {
                const [
                    cachedLfUser,
                    cachedLfProds,
                    cachedProds, 
                    cachedClis, 
                    cachedDeps, 
                    cachedRcpt, 
                    cachedExRate, 
                    cachedSalesTabs
                ] = await Promise.all([
                    getCachedUserProfile(),
                    getCachedMinimalProducts(),
                    getCachedAppState<Product[]>('cached_products'),
                    getCachedAppState<Client[]>('cached_clients'),
                    getCachedAppState<Department[]>('cached_departments'),
                    getCachedAppState<ReceiptTemplate>('cached_receipt_template'),
                    getCachedAppState<number>('cached_exchange_rate'),
                    getCachedAppState<SaleTab[]>('cached_sales_tabs')
                ]);

                if (cachedLfUser && (!user || user.username === 'none')) {
                    setUserState(cachedLfUser);
                }

                const resolvedProds = (cachedLfProds && cachedLfProds.length > 0) 
                    ? cachedLfProds 
                    : (cachedProds && cachedProds.length > 0 ? cachedProds : null);

                if (resolvedProds && resolvedProds.length > 0) {
                    setProducts(resolvedProds);
                    setTotalProducts(resolvedProds.length);
                }
                if (cachedClis && cachedClis.length > 0) setClients(cachedClis);
                if (cachedDeps && cachedDeps.length > 0) setDepartments(cachedDeps);
                if (cachedRcpt) setReceiptTemplate(cachedRcpt);
                if (cachedExRate) setExchangeRate(cachedExRate);
                if (cachedSalesTabs && cachedSalesTabs.length > 0) setTabs(cachedSalesTabs);
            } catch (err) {
                console.warn("[Cache] Hydration error:", err);
            }
        };
        prehydrateFromLocalCache();
    }, []);

    useEffect(() => {
        if (user && user.username && user.username !== 'none') {
            const hasLocalData = products.length > 0 || !!localStorage.getItem('cached_products');
            if (!hasLocalData) {
                setIsInitializing(true);
            } else {
                setIsInitializing(false);
            }

            const safetyTimeout = setTimeout(() => {
                setIsInitializing(false);
            }, 1000);

            Promise.allSettled([
                fetchProducts(),
                fetchClients(),
                fetchExchangeRate(),
                fetchReceiptTemplate(),
                fetchDepartments(),
                fetchKioskMode()
            ]).finally(() => {
                clearTimeout(safetyTimeout);
                setIsInitializing(false);
            });
        } else {
            setIsInitializing(false);
        }
    }, [user?.id, user?.username]);

    const fetchKioskMode = async () => {
        try {
            const res = await fetchWithRetry('/api/settings/kiosk');
            if (res.ok) {
                const data = await res.json();
                setKioskMode(data.kiosk_mode);
                localStorage.setItem('kioskMode', String(data.kiosk_mode));
            }
        } catch (e) {
            console.warn("Failed to fetch kiosk mode:", e);
        }
    };

    const fetchReceiptTemplate = async () => {
        try {
            const res = await fetchWithRetry('/api/settings/receipt');
            const data = await res.json();
            setReceiptTemplate(data);
            localStorage.setItem('cached_receipt_template', JSON.stringify(data));
            cacheAppState('cached_receipt_template', data);
        } catch (e) {
            console.warn("Failed to fetch receipt template, using cached value:", e);
            const cachedIdx = await getCachedAppState<ReceiptTemplate>('cached_receipt_template');
            if (cachedIdx) {
                setReceiptTemplate(cachedIdx);
            } else {
                const cached = localStorage.getItem('cached_receipt_template');
                if (cached) {
                    try {
                        setReceiptTemplate(JSON.parse(cached));
                    } catch (parseErr) {
                        console.error("Failed to parse cached receipt template:", parseErr);
                    }
                }
            }
        }
    };

    const fetchDepartments = async () => {
        try {
            const res = await fetchWithRetry('/api/departments');
            const data = await res.json();
            setDepartments(data);
            localStorage.setItem('cached_departments', JSON.stringify(data));
            cacheAppState('cached_departments', data);
        } catch (e) {
            console.warn("Failed to fetch departments, using cached value:", e);
            const cachedIdx = await getCachedAppState<Department[]>('cached_departments');
            if (cachedIdx && cachedIdx.length > 0) {
                setDepartments(cachedIdx);
            } else {
                const cached = localStorage.getItem('cached_departments');
                if (cached) {
                    try {
                        setDepartments(JSON.parse(cached));
                    } catch (parseErr) {
                        console.error("Failed to parse cached departments:", parseErr);
                    }
                }
            }
        }
    };

    const updateReceiptTemplate = async (template: ReceiptTemplate) => {
        try {
            setReceiptTemplate(template);
            localStorage.setItem('cached_receipt_template', JSON.stringify(template));
            cacheAppState('cached_receipt_template', template);
            const res = await fetch('/api/settings/receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template })
            });
            if (!res.ok) {
                throw new Error("No se pudo guardar la plantilla.");
            }
        } catch (e: any) {
            console.error("Failed to save receipt template:", e);
            throw e;
        }
    };

    const fetchProducts = async (searchQuery?: string) => {
        try {
            setProductsOffset(0);
            const url = searchQuery ? `/api/products?lazy=true&limit=${PRODUCTS_LIMIT}&offset=0&search=${encodeURIComponent(searchQuery)}` : `/api/products?lazy=true&limit=${PRODUCTS_LIMIT}&offset=0`;
            const res = await fetchWithRetry(url);
            const data = await res.json();
            
            // Check if response has pagination wrapper
            if (data && Array.isArray(data.products)) {
                setProducts(data.products);
                setTotalProducts(data.total);
                setHasMoreProducts(data.has_more);
                safeLocalStorageSetItem('cached_products', JSON.stringify(data.products));
                cacheAppState('cached_products', data.products);
                setCachedMinimalProducts(data.products).catch(() => {});
            } else {
                const arr = Array.isArray(data) ? data : [];
                setProducts(arr);
                setTotalProducts(arr.length);
                setHasMoreProducts(false);
                safeLocalStorageSetItem('cached_products', JSON.stringify(arr));
                cacheAppState('cached_products', arr);
                setCachedMinimalProducts(arr).catch(() => {});
            }
            setIsOffline(false);
        } catch (e) {
            console.warn("Failed to fetch products, using cached value:", e);
            const cachedIdx = await getCachedAppState<Product[]>('cached_products');
            if (cachedIdx && cachedIdx.length > 0) {
                setProducts(cachedIdx);
                setTotalProducts(cachedIdx.length);
                setHasMoreProducts(false);
            } else {
                const cached = localStorage.getItem('cached_products');
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        setProducts(parsed);
                        setTotalProducts(parsed.length);
                        setHasMoreProducts(false);
                    } catch (parseErr) {
                        console.error("Failed to parse cached products:", parseErr);
                    }
                }
            }
            if (e instanceof Error && (e.message.includes('Failed to fetch') || e.message.includes('fetch'))) {
                setIsOffline(true);
            }
        }
    };

    const loadMoreProducts = async (searchQuery?: string) => {
        try {
            const nextOffset = productsOffset + PRODUCTS_LIMIT;
            const url = searchQuery ? `/api/products?lazy=true&limit=${PRODUCTS_LIMIT}&offset=${nextOffset}&search=${encodeURIComponent(searchQuery)}` : `/api/products?lazy=true&limit=${PRODUCTS_LIMIT}&offset=${nextOffset}`;
            const res = await fetchWithRetry(url);
            const data = await res.json();
            
            if (data && Array.isArray(data.products)) {
                setProducts(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const newItems = data.products.filter((p: any) => !existingIds.has(p.id));
                    const merged = [...prev, ...newItems];
                    // Save merged set in cache to prevent offline gaps
                    safeLocalStorageSetItem('cached_products', JSON.stringify(merged));
                    cacheAppState('cached_products', merged);
                    return merged;
                });
                setProductsOffset(nextOffset);
                setTotalProducts(data.total);
                setHasMoreProducts(data.has_more);
            }
            setIsOffline(false);
        } catch (e) {
            console.error("Failed to load more products:", e);
        }
    };

    const fetchClients = async () => {
        try {
            const res = await fetchWithRetry('/api/clients');
            const data = await res.json();
            setClients(data);
            localStorage.setItem('cached_clients', JSON.stringify(data));
            cacheAppState('cached_clients', data);
            setIsOffline(false);
        } catch (e) {
            console.warn("Failed to fetch clients, using cached value:", e);
            const cachedIdx = await getCachedAppState<Client[]>('cached_clients');
            if (cachedIdx && cachedIdx.length > 0) {
                setClients(cachedIdx);
            } else {
                const cached = localStorage.getItem('cached_clients');
                if (cached) {
                    try {
                        setClients(JSON.parse(cached));
                    } catch (parseErr) {
                        console.error("Failed to parse cached clients:", parseErr);
                    }
                }
            }
            if (e instanceof Error && (e.message.includes('Failed to fetch') || e.message.includes('fetch'))) {
                setIsOffline(true);
            }
        }
    };

    // Real-time immediate local stock reduction for offline POS autonomy
    const deductLocalProductStock = (items: Array<{ product_id: number; quantity: number }>) => {
        if (!items || items.length === 0) return;
        setProducts(prev => {
            const itemMap = new Map(items.map(i => [Number(i.product_id), Number(i.quantity)]));
            const updated = prev.map(p => {
                if (itemMap.has(p.id)) {
                    const qtyToDeduct = itemMap.get(p.id) || 0;
                    const newStock = Math.max(0, p.stock - qtyToDeduct);
                    return { ...p, stock: newStock };
                }
                return p;
            });
            try {
                localStorage.setItem('cached_products', JSON.stringify(updated));
                cacheAppState('cached_products', updated);
            } catch (err) {
                console.warn("Error caching updated products:", err);
            }
            return updated;
        });
    };

    // Instant local client registration for offline search and POS matching
    const registerLocalClient = (client: { id: string | number; name: string; phone?: string }) => {
        if (!client || !client.name) return;
        setClients(prev => {
            const nameMatch = client.name.trim().toLowerCase();
            const exists = prev.some(c => c.name.trim().toLowerCase() === nameMatch);
            if (exists) return prev;

            const newClient: Client = {
                id: typeof client.id === 'number' ? client.id : -Date.now(),
                name: client.name.trim(),
                phone: client.phone ? client.phone.trim() : '',
                points: 0
            };
            const updated = [newClient, ...prev];
            try {
                localStorage.setItem('cached_clients', JSON.stringify(updated));
                cacheAppState('cached_clients', updated);
            } catch (err) {
                console.warn("Error caching updated clients:", err);
            }
            return updated;
        });
    };

    // STRICT ITEM CONSOLIDATION & QUANTITY ADDITION RULE (WITH STOCK LEVEL LITERALLY BOUNDED)
    const addToCart = (product: Product, quantity: number = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                let newQuantity = existing.cartQuantity + quantity;
                if (newQuantity <= 0) {
                    return prev.filter(item => item.id !== product.id);
                }
                if (newQuantity > product.stock) {
                    newQuantity = product.stock;
                    setTimeout(() => {
                        safeDispatchEvent('stockLimitHit', { 
                            detail: { name: product.name, stock: product.stock } 
                        });
                    }, 0);
                }
                return prev.map(item => 
                    item.id === product.id 
                    ? { ...item, cartQuantity: newQuantity }
                    : item
                );
            }
            if (quantity <= 0) return prev;
            let finalQty = quantity;
            if (finalQty > product.stock) {
                finalQty = product.stock;
                setTimeout(() => {
                    safeDispatchEvent('stockLimitHit', { 
                        detail: { name: product.name, stock: product.stock } 
                    });
                }, 0);
            }
            if (finalQty <= 0) return prev;
            return [...prev, { ...product, cartQuantity: finalQty }];
        });
    };

    const updateCartItemQuantity = (productId: number, qty: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.id === productId) {
                    let finalQty = isNaN(qty) ? 0 : Math.max(0, qty);
                    if (finalQty > item.stock) {
                        finalQty = item.stock;
                        setTimeout(() => {
                            safeDispatchEvent('stockLimitHit', { 
                                detail: { name: item.name, stock: item.stock } 
                            });
                        }, 0);
                    }
                    return { ...item, cartQuantity: finalQty };
                }
                return item;
            });
        });
    };

    const removeFromCart = (productId: number) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const clearCart = (isCompletedSale = false) => {
        if (!isCompletedSale && cart.length > 0) {
            const payload = {
                cart: [...cart],
                clientName,
                clientPhone,
                discount,
                discountType,
                paymentMethod,
                timestamp: new Date().toISOString()
            };
            setLastClearedCart([...cart]);
            setLastClearedMeta(payload);
            try {
                localStorage.setItem('gtr_pos_last_cleared_cart', JSON.stringify(payload));
            } catch (e) {
                console.error("Failed saving last cleared cart:", e);
            }
        } else if (isCompletedSale) {
            setLastClearedCart(null);
            setLastClearedMeta(null);
            setCartBackup(null);
            setCartBackupMeta(null);
            try {
                localStorage.removeItem('gtr_pos_last_cleared_cart');
                localStorage.removeItem('gtr_pos_active_cart_backup');
            } catch (e) {}
            // Also synchronize active sale tab so tab switching/re-renders cannot resurrect old cart items
            setTabs(prev => prev.map(t => {
                if (t.id === activeTabId) {
                    return {
                        ...t,
                        cart: [],
                        clientName: "",
                        clientPhone: "",
                        discount: 0,
                        discountType: 'monto',
                        paymentMethod: 'Efectivo'
                    };
                }
                return t;
            }));
        }
        setCart([]);
    };

    const restoreLastClearedCart = (): boolean => {
        if (!lastClearedCart || lastClearedCart.length === 0) return false;
        setCart([...lastClearedCart]);
        if (lastClearedMeta) {
            if (lastClearedMeta.clientName) setClientName(lastClearedMeta.clientName);
            if (lastClearedMeta.clientPhone) setClientPhone(lastClearedMeta.clientPhone);
            if (lastClearedMeta.discount !== undefined) setDiscount(lastClearedMeta.discount);
            if (lastClearedMeta.discountType) setDiscountType(lastClearedMeta.discountType);
            if (lastClearedMeta.paymentMethod) setPaymentMethod(lastClearedMeta.paymentMethod);
        }
        setLastClearedCart(null);
        setLastClearedMeta(null);
        localStorage.removeItem('gtr_pos_last_cleared_cart');
        return true;
    };

    const restoreCartBackup = (): boolean => {
        if (!cartBackup || cartBackup.length === 0) return false;
        setCart([...cartBackup]);
        if (cartBackupMeta) {
            if (cartBackupMeta.clientName) setClientName(cartBackupMeta.clientName);
            if (cartBackupMeta.clientPhone) setClientPhone(cartBackupMeta.clientPhone);
            if (cartBackupMeta.discount !== undefined) setDiscount(cartBackupMeta.discount);
            if (cartBackupMeta.discountType) setDiscountType(cartBackupMeta.discountType);
            if (cartBackupMeta.paymentMethod) setPaymentMethod(cartBackupMeta.paymentMethod);
        }
        setCartBackup(null);
        setCartBackupMeta(null);
        localStorage.removeItem('gtr_pos_active_cart_backup');
        return true;
    };

    const discardCartBackup = () => {
        setLastClearedCart(null);
        setLastClearedMeta(null);
        setCartBackup(null);
        setCartBackupMeta(null);
        localStorage.removeItem('gtr_pos_last_cleared_cart');
        localStorage.removeItem('gtr_pos_active_cart_backup');
    };

    const updateCartItemPrice = (productId: number, priceType: 'unit' | 'bulk' | 'custom', customPrice?: number, customPriceBs?: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                return {
                    ...item,
                    price_type: priceType,
                    custom_price: customPrice !== undefined ? customPrice : item.custom_price,
                    custom_price_bs: customPriceBs !== undefined ? customPriceBs : (priceType !== 'custom' ? undefined : item.custom_price_bs)
                };
            }
            return item;
        }));
    };

    const syncOfflineActions = async (tempIdMapping: { [key: string]: any } = {}) => {
        try {
            const offlineActions = await getOfflineActions();
            if (offlineActions.length === 0) return;

            console.log(`[Offline Sync] Found ${offlineActions.length} general offline actions to synchronize.`);
            let successCount = 0;

            // Sort actions by creation time to ensure they run in correct chronological order
            const sortedActions = [...offlineActions].sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            for (const action of sortedActions) {
                try {
                    // Replace temp IDs inside payload if needed
                    let payloadStr = JSON.stringify(action.payload);
                    Object.keys(tempIdMapping).forEach(tempId => {
                        payloadStr = payloadStr.replaceAll(tempId, String(tempIdMapping[tempId]));
                    });
                    const processedPayload = JSON.parse(payloadStr);

                    // Execute fetch call with authorization and user context
                    const authToken = localStorage.getItem('auth_token');
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
                    if (user) {
                        headers['x-user-id'] = String(user.id);
                        headers['x-user-role'] = user.role || '';
                        headers['x-user-username'] = user.username || '';
                    }

                    const res = await fetch(action.url, {
                        method: action.method,
                        headers,
                        body: JSON.stringify(processedPayload)
                    });

                    if (res.ok) {
                        const responseData = await res.json().catch(() => ({}));
                        
                        // If this was a client creation action, map the temp ID to the newly created DB ID
                        if (action.type === 'create_client' && action.metadata?.tempId && responseData.id) {
                            tempIdMapping[action.metadata.tempId] = responseData.id;
                            console.log(`[Offline Sync] Mapped temp ID ${action.metadata.tempId} to actual ID ${responseData.id}`);
                        }

                        await deleteOfflineAction(action.id);
                        successCount++;
                    } else {
                        const errText = await res.text();
                        console.error(`[Offline Sync] Server rejected action ${action.id} (Status ${res.status}):`, errText);
                        
                        // CRITICAL: NEVER delete actions on 401 (Unauthorized) or 403 (Forbidden)
                        // If token expired or session is refreshing, preserve them so user work is never lost.
                        if (res.status === 401 || res.status === 403) {
                            console.warn(`[Offline Sync] Preserving action ${action.id} in queue until session is revalidated.`);
                            break; // Stop loop until user re-authenticates
                        } else if (res.status === 400 || res.status === 404 || res.status === 422) {
                            // Definitive client-side validation errors can be pruned to prevent queue poison
                            await deleteOfflineAction(action.id);
                        }
                    }
                } catch (actionErr) {
                    console.error(`[Offline Sync] Network failed during sync of action ${action.id}:`, actionErr);
                    break; // Stop execution on connection loss
                }
            }

            if (successCount > 0) {
                safeDispatchEvent('triggerNotification', {
                    detail: {
                        message: `✓ Sincronización automática: Se procesaron ${successCount} acción(es) offline con éxito.`,
                        type: 'success'
                    }
                });
                await fetchProducts();
                await fetchClients();
                await fetchDepartments();
            }
        } catch (err) {
            console.error('[Offline Sync] Failed to process general offline actions queue:', err);
        }
    };

    const syncOfflineSales = async (tempIdMapping: { [key: string]: any } = {}) => {
        try {
            const offlineSales = await getOfflineSales();
            if (offlineSales.length === 0) return;

            console.log(`[Offline Sync] Found ${offlineSales.length} offline sales to synchronize.`);
            let successCount = 0;

            for (const sale of offlineSales) {
                try {
                    let clientId = sale.salePayload.client_id;

                    // If clientId is a temp ID, map it to the actual ID
                    if (clientId && typeof clientId === 'string' && tempIdMapping[clientId]) {
                        clientId = tempIdMapping[clientId];
                        sale.salePayload.client_id = clientId;
                    }

                    // 1. If we have a client name but no client_id, let's try to register/find the client first
                    if (sale.clientName && sale.clientName.trim() && !clientId) {
                        try {
                            const authToken = localStorage.getItem('auth_token');
                            const clientHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
                            if (authToken) clientHeaders['Authorization'] = `Bearer ${authToken}`;
                            if (user) {
                                clientHeaders['x-user-id'] = String(user.id);
                                clientHeaders['x-user-role'] = user.role || '';
                                clientHeaders['x-user-username'] = user.username || '';
                            }

                            const clientRes = await fetch('/api/clients', {
                                method: 'POST',
                                headers: clientHeaders,
                                body: JSON.stringify({ name: sale.clientName, phone: sale.clientPhone })
                            });
                            if (clientRes.ok) {
                                const clientData = await clientRes.json();
                                clientId = clientData.id;
                                sale.salePayload.client_id = clientId;
                            }
                        } catch (clientErr) {
                            console.error('[Offline Sync] Failed to register client offline:', clientErr);
                        }
                    }

                    // 2. Submit to Offline Quarantine Queue for Administrator Authorization (Prevents unverified stock deductions)
                    const submitPayload = {
                        ...sale.salePayload,
                        id: sale.id,
                        client_name: sale.clientName,
                        client_phone: sale.clientPhone,
                        user_name: user?.username || sale.salePayload.user_name || 'Vendedor'
                    };

                    const token = localStorage.getItem('auth_token');
                    const saleHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (token) saleHeaders['Authorization'] = `Bearer ${token}`;

                    const saleRes = await fetch('/api/offline-sales/submit', {
                        method: 'POST',
                        headers: saleHeaders,
                        body: JSON.stringify(submitPayload)
                    });

                    if (saleRes.ok) {
                        // Success! Safely remove from local device queue as it is now in the server inbox
                        await deleteOfflineSale(sale.id);
                        successCount++;
                    } else {
                        const errText = await saleRes.text();
                        console.error(`[Offline Sync] Server rejected offline sale ${sale.id}:`, errText);
                    }
                } catch (saleErr) {
                    console.error(`[Offline Sync] Network failed during sync of sale ${sale.id}:`, saleErr);
                    break; // Stop syncing remaining if we are still offline or connection breaks
                }
            }

            if (successCount > 0) {
                safeDispatchEvent('triggerNotification', {
                    detail: {
                        message: `✓ Contingencia Offline: ${successCount} venta(s) enviada(s) a la Bandeja de Autorización del Administrador.`,
                        type: 'info'
                    }
                });
                // Refresh local lists
                await fetchProducts();
                await fetchClients();
            }
        } catch (err) {
            console.error('[Offline Sync] Failed to process offline sales queue:', err);
        }
    };

    const triggerOnlineSync = async (forceFull = false) => {
        if (navigator.onLine === false) return;
        if (syncRunningRef.current) return;
        syncRunningRef.current = true;
        setIsSyncing(true);

        const safetyTimer = setTimeout(() => {
            setIsSyncing(false);
            syncRunningRef.current = false;
        }, 3500);

        try {
            const tempIdMapping: { [key: string]: any } = {};
            // First synchronize general actions, then sales with shared mapping
            await syncOfflineActions(tempIdMapping);
            await syncOfflineSales(tempIdMapping);

            console.log("[PWA Sync] Syncing with Google Cloud Firestore in real-time...");
            const token = localStorage.getItem('auth_token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const res = await fetch('/api/sync/trigger', { 
                method: 'POST', 
                headers,
                body: JSON.stringify({ full: forceFull })
            });
            if (res.ok) {
                const data = await res.json();
                console.log("[PWA Sync] Sync completed successfully:", data.status);
                // Concurrently fetch latest data in parallel
                await Promise.allSettled([
                    fetchProducts(),
                    fetchClients(),
                    fetchExchangeRate(),
                    fetchDepartments()
                ]);
                setSyncError(null);
            } else {
                const errData = await res.json().catch(() => ({}));
                const errMsg = errData.error || `HTTP ${res.status}`;
                console.warn("[PWA Sync] Sync completed with server-side error:", errMsg);
                setSyncError(errMsg);
            }
        } catch (error: any) {
            console.warn("[PWA Sync] Error triggering backend online synchronization:", error);
            setSyncError(error?.message || String(error));
        } finally {
            clearTimeout(safetyTimer);
            setTimeout(() => {
                setIsSyncing(false);
                syncRunningRef.current = false;
            }, 600);
        }
    };

    
    // Global WebSocket connection for settings/alerts
    useEffect(() => {
        if (!user || user.username === 'none') return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/alerts`;
        
        let socket: any = null;
        let reconnectTimeout: any = null;

        const connect = () => {
            socket = new WebSocket(wsUrl);

            socket.onmessage = (event: any) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'kiosk_mode_changed') {
                        setKioskMode(data.kiosk_mode);
                        localStorage.setItem('kioskMode', String(data.kiosk_mode));
                        safeDispatchEvent('triggerNotification', {
                            detail: {
                                message: data.kiosk_mode
                                    ? "✓ Modo Quiosco ha sido activado por el administrador."
                                    : "✓ Modo Quiosco ha sido desactivado.",
                                type: 'info'
                            }
                        });
                    } else if (data.type === 'exchange_rate_updated' && data.new_rate) {
                        const newRateNum = Number(data.new_rate);
                        if (!isNaN(newRateNum) && newRateNum > 0) {
                            console.log(`[PWA Socket] Live exchange rate update received: $1 = ${newRateNum} Bs.`);
                            setExchangeRate(newRateNum);
                            localStorage.setItem('cached_exchange_rate', String(newRateNum));
                            safeDispatchEvent('exchange_rate_updated', { detail: newRateNum });
                        }
                    }
                } catch (err) { }
            };

            socket.onclose = () => {
                reconnectTimeout = setTimeout(connect, 10000);
            };

            socket.onerror = () => {};
        };

        connect();

        return () => {
            if (socket) socket.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, [user?.id, user?.username]);


    // Global Offline Queue and Connectivity Monitoring
    const refreshOfflineStats = async () => {
        try {
            const s = await getOfflineStats();
            setPendingSalesCount(s.salesCount);
            setPendingActionsCount(s.actionsCount);
        } catch (e) {
            // Ignore if db is initializing
        }
    };

    useEffect(() => {
        refreshOfflineStats();
        const handleQueueChange = () => {
            refreshOfflineStats();
        };
        const handleOpenModal = () => {
            setIsOfflineModalOpen(true);
        };
        window.addEventListener('offline_queue_changed', handleQueueChange);
        window.addEventListener('open-offline-manager', handleOpenModal);
        return () => {
            window.removeEventListener('offline_queue_changed', handleQueueChange);
            window.removeEventListener('open-offline-manager', handleOpenModal);
        };
    }, []);

    // Periodic network health check to measure latency and detect reconnection
    useEffect(() => {
        let timer: any = null;
        let isCancelled = false;

        const checkHealth = async () => {
            if (!navigator.onLine) {
                if (!isOffline) setIsOffline(true);
                setNetworkQuality('offline');
                setNetworkLatency(null);
                return;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const startTime = performance.now();

            try {
                const res = await fetch('/api/health', {
                    method: 'GET',
                    signal: controller.signal,
                    cache: 'no-store'
                });
                clearTimeout(timeoutId);
                const latency = Math.round(performance.now() - startTime);

                if (!isCancelled) {
                    if (res.ok) {
                        setNetworkLatency(latency);
                        const quality = latency > 600 ? 'unstable' : 'online';
                        setNetworkQuality(quality);
                        if (isOffline) {
                            setIsOffline(false);
                        }
                    } else {
                        setNetworkQuality('unstable');
                    }
                }
            } catch (err: any) {
                clearTimeout(timeoutId);
                if (!isCancelled) {
                    setNetworkLatency(null);
                    setNetworkQuality('offline');
                    if (!isOffline) setIsOffline(true);
                }
            }
        };

        checkHealth();
        timer = setInterval(checkHealth, 15000);

        return () => {
            isCancelled = true;
            if (timer) clearInterval(timer);
        };
    }, [isOffline]);

    // Auto trigger sync when the system transitions to online
    useEffect(() => {
        if (!isOffline && navigator.onLine) {
            triggerOnlineSync();
        }
    }, [isOffline]);

    const showNotification = (message: string, type: 'success' | 'error' | 'warn' | 'info' = 'success') => {
        safeDispatchEvent('triggerNotification', {
            detail: { message, type }
        });
    };

    return (
        <AppContext.Provider value={{
            isInitializing,
            user,
            setUser,
            darkMode,
            setDarkMode,
            kioskMode,
            setKioskMode: async (k) => { 
                setKioskMode(k); 
                localStorage.setItem('kioskMode', String(k)); 
                try {
                    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                    await fetch('/api/settings/kiosk', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ kiosk_mode: k })
                    });
                } catch (e) {
                    console.error("Error saving kiosk mode to server", e);
                }
            },
            isSupervisorUnlocked,
            setIsSupervisorUnlocked,
            supervisorInfo,
            relockKiosk,
            isFullscreen,
            toggleFullscreen,
            cart,
            addToCart,
            updateCartItemQuantity,
            removeFromCart,
            clearCart,
            lastClearedCart,
            lastClearedMeta,
            cartBackup,
            cartBackupMeta,
            restoreLastClearedCart,
            restoreCartBackup,
            discardCartBackup,
            updateCartItemPrice,
            products,
            clients,
            fetchProducts,
            fetchClients,
            hasMoreProducts,
            totalProducts,
            loadMoreProducts,
            deductLocalProductStock,
            registerLocalClient,
            view,
            setView,
            exchangeRate,
            setExchangeRate,
            fetchExchangeRate,
            roundBs,
            isOffline,
            networkLatency,
            networkQuality,
            pendingSalesCount,
            pendingActionsCount,
            isOfflineModalOpen,
            setIsOfflineModalOpen,
            receiptTemplate,
            updateReceiptTemplate,
            fetchReceiptTemplate,
            departments,
            fetchDepartments,
            tabs,
            setTabs,
            activeTabId,
            setActiveTabId,
            clientName,
            setClientName,
            clientPhone,
            setClientPhone,
            discount,
            setDiscount,
            discountType,
            setDiscountType,
            paymentMethod,
            setPaymentMethod,
            theme,
            setTheme,
            rgbSettings,
            setRgbSettings,
            isSyncing,
            triggerOnlineSync,
            syncError,
            setSyncError,
            isAutonomousTesting,
            setIsAutonomousTesting,
            autonomousStep,
            setAutonomousStep,
            autonomousLogs,
            setAutonomousLogs,
            apiPingResults,
            setApiPingResults,
            pwaPrompt,
            setPwaPrompt,
            installPWA,
            isPwaInstalled,
            setIsPwaInstalled,
            isPwaInstallModalOpen,
            setIsPwaInstallModalOpen,
            hasPwaUpdate,
            isUpdatingPwa,
            pwaUpdateStepMessage,
            pwaVersionInfo,
            checkForPwaUpdates,
            applyPwaUpdate,
            handlePwaPrimaryAction,
            showNotification
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("AppContext must be used within an AppProvider.");
    return ctx;
};

export const useApp = useAppContext;
