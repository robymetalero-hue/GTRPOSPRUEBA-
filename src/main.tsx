// Polyfill CustomEvent for older browsers / webviews (e.g. WeChat, WebView, old Safari) where new CustomEvent() throws "Illegal constructor"
try {
  if (typeof window !== 'undefined') {
    new window.CustomEvent('test-custom-event');
  }
} catch (e) {
  const CustomEventPolyfill = function (event: string, params?: any) {
    params = params || { bubbles: false, cancelable: false, detail: null };
    const evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
  };
  CustomEventPolyfill.prototype = window.Event.prototype;
  (window as any).CustomEvent = CustomEventPolyfill;
}

// Force Bolivia Time (America/La_Paz, UTC-4) and es-BO locale globally on Date prototype methods
const originalToLocaleString = Date.prototype.toLocaleString;
Date.prototype.toLocaleString = function (
  this: Date,
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions
): string {
  return originalToLocaleString.call(this, locales || 'es-BO', {
    timeZone: 'America/La_Paz',
    ...options
  });
};

const originalToLocaleDateString = Date.prototype.toLocaleDateString;
Date.prototype.toLocaleDateString = function (
  this: Date,
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions
): string {
  return originalToLocaleDateString.call(this, locales || 'es-BO', {
    timeZone: 'America/La_Paz',
    ...options
  });
};

const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
Date.prototype.toLocaleTimeString = function (
  this: Date,
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions
): string {
  return originalToLocaleTimeString.call(this, locales || 'es-BO', {
    timeZone: 'America/La_Paz',
    ...options
  });
};

const originalToISOString = Date.prototype.toISOString;
Date.prototype.toISOString = function () {
  const time = this.getTime();
  if (isNaN(time)) {
    return originalToISOString.call(this);
  }
  // Subtract 4 hours to get Bolivia time (UTC-4) and format as UTC ISO string
  const boliviaTime = new Date(time - (4 * 60 * 60 * 1000));
  return originalToISOString.call(boliviaTime);
};

let cachedUserStr: string | null = null;
let cachedUserObj: any = null;

const originalFetch = window.fetch;
try {
  Object.defineProperty(window, 'fetch', {
    value: async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      let url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else if (input && typeof input === 'object' && 'url' in input) {
        url = (input as any).url;
      }
      if (!url.startsWith('http') || url.startsWith(window.location.origin)) {
        init = init || {};
        const headersObj: Record<string, string> = {};
        if (init.headers) {
          if (typeof (init.headers as any).forEach === 'function') {
            (init.headers as any).forEach((value: string, key: string) => {
              headersObj[key.toLowerCase()] = value;
            });
          } else if (Array.isArray(init.headers)) {
            init.headers.forEach(([key, value]) => {
              headersObj[key.toLowerCase()] = value;
            });
          } else if (typeof init.headers === 'object') {
            Object.keys(init.headers).forEach(key => {
              headersObj[key.toLowerCase()] = (init.headers as any)[key];
            });
          }
        }

        // Attach Authorization token if available
        const token = localStorage.getItem('auth_token');
        if (token && token.trim() && (!headersObj['authorization'] || headersObj['authorization'] === 'Bearer ' || headersObj['authorization'] === 'Bearer undefined')) {
          headersObj['authorization'] = `Bearer ${token.trim()}`;
        } else if (!token && (headersObj['authorization'] === 'Bearer ' || headersObj['authorization'] === 'Bearer undefined')) {
          delete headersObj['authorization'];
        }

        // Attach user identification headers if available
        const userJson = localStorage.getItem('user');
        if (userJson) {
          try {
            if (userJson !== cachedUserStr) {
                cachedUserStr = userJson;
                cachedUserObj = JSON.parse(userJson);
            }
            const user = cachedUserObj;
            if (user) {
              if (!headersObj['x-user-id'] && user.id) {
                headersObj['x-user-id'] = String(user.id);
              }
              if (!headersObj['x-user-role'] && user.role) {
                headersObj['x-user-role'] = String(user.role);
              }
              if (!headersObj['x-user-username'] && user.username) {
                headersObj['x-user-username'] = String(user.username);
              }
              if (!headersObj['x-user-name'] && user.username) {
                headersObj['x-user-name'] = String(user.username);
              }
              if (!headersObj['x-user-permissions'] && user.permissions) {
                headersObj['x-user-permissions'] = JSON.stringify(user.permissions);
              }
            }
          } catch (err) {
            console.error("Error parsing user in fetch patch", err);
          }
        }
        init.headers = headersObj;
      }
      return originalFetch(input, init).then(res => {
        if (res.status === 401 && !url.includes('/auth/login')) {
            console.warn("[Fetch Interceptor] Received 401 Unauthorized for URL:", url);
        }
        return res;
      });
    },
    writable: true,
    configurable: true,
    enumerable: true
  });
} catch (e) {
  console.warn("Could not patch window.fetch via Object.defineProperty:", e);
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('unhandledrejection', async (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('Failed to fetch dynamically imported module')) {
    event.preventDefault();
    console.warn("Chunk load error detected. Unregistering service workers and clearing caches...");
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      if (window.caches) {
        const keys = await window.caches.keys();
        for (const key of keys) {
          await window.caches.delete(key);
        }
      }
      window.location.reload();
    } catch (e) {
      window.location.reload();
    }
  }
});

// Service Worker Registration for PWA Standalone & Offline Execution
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    // updateViaCache: 'none' forces browser to always query server directly for sw.js changes
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        (window as any).__pwaServiceWorkerReg = reg;
        console.log('[PWA] Service Worker registrado exitosamente con scope:', reg.scope);
        
        // Immediate check on load to detect newly deployed code
        reg.update().catch(() => {});

        // Periodic background update check every 2.5 minutes when online
        setInterval(() => {
          if (navigator.onLine) {
            reg.update().catch(() => {});
          }
        }, 150000);

        // If there is already a waiting worker on load
        if (reg.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: { registration: reg } }));
        }

        // Check for updates on install
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Nueva versión detectada y lista para aplicar.');
                window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: { registration: reg } }));
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[PWA] Error al registrar Service Worker:', err);
      });
  });

  // When new Service Worker activates and takes control:
  let hasTriggeredAutoRefresh = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasTriggeredAutoRefresh) return;

    // Check if the user currently has active uncompleted items in POS cart
    try {
      const activeCart = localStorage.getItem('active_pos_cart');
      const items = activeCart ? JSON.parse(activeCart) : [];
      if (items && Array.isArray(items) && items.length > 0) {
        console.log('[PWA] Nueva versión activada. Reteniendo recarga automática porque hay productos en el carrito.');
        window.dispatchEvent(new CustomEvent('pwa-update-available'));
        return;
      }
    } catch (_) {}

    hasTriggeredAutoRefresh = true;
    console.log('[PWA] Nueva versión activada. Recargando de forma transparente...');
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
