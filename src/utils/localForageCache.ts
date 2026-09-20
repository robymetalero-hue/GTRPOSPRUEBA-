import localforage from 'localforage';
import { User, Product } from '../types';

// Configure default localForage instances with prioritized drivers
export const authCache = localforage.createInstance({
    name: 'GTR_POS_APP',
    storeName: 'user_auth_profile',
    description: 'Fast local persistence for user profile, permissions and credentials'
});

export const productCache = localforage.createInstance({
    name: 'GTR_POS_APP',
    storeName: 'minimal_product_catalog',
    description: 'Persistent local storage for essential product catalog'
});

export const appStateCache = localforage.createInstance({
    name: 'GTR_POS_APP',
    storeName: 'app_general_state',
    description: 'Persistent cache for exchange rate, departments and settings'
});

const USER_KEY = 'cached_active_user';
const TOKEN_KEY = 'cached_auth_token';
const PRODUCTS_KEY = 'cached_catalog_products';
const USER_PROFILES_MAP_KEY = 'cached_known_user_profiles';

/**
 * Initializes and validates localForage drivers (IndexedDB -> LocalStorage)
 */
export async function initLocalForageCache(): Promise<void> {
    try {
        await Promise.all([
            authCache.ready(),
            productCache.ready(),
            appStateCache.ready()
        ]);
    } catch (err) {
        console.warn('[localForage] Driver initialization fallback to default:', err);
    }
}

/**
 * Retrieve cached active user profile
 */
export async function getCachedUserProfile(): Promise<User | null> {
    try {
        const user = await authCache.getItem<User>(USER_KEY);
        if (user && user.username && user.username !== 'none') {
            return user;
        }
        // Fallback to localStorage if localForage had not yet populated
        const lsUser = localStorage.getItem('user');
        if (lsUser) {
            const parsed = JSON.parse(lsUser);
            if (parsed && parsed.username && parsed.username !== 'none') {
                authCache.setItem(USER_KEY, parsed).catch(() => {});
                return parsed;
            }
        }
        return null;
    } catch (err) {
        console.warn('[localForage] Error reading user profile:', err);
        return null;
    }
}

/**
 * Persist active user profile into localForage and localStorage simultaneously
 */
export async function setCachedUserProfile(user: User | null): Promise<void> {
    try {
        if (user && user.username !== 'none') {
            await authCache.setItem(USER_KEY, user);
            try {
                localStorage.setItem('user', JSON.stringify(user));
            } catch {}

            // Also keep a registry of known profiles indexed by username for instant optimistic login
            const knownProfiles = (await authCache.getItem<Record<string, User>>(USER_PROFILES_MAP_KEY)) || {};
            knownProfiles[user.username.toLowerCase().trim()] = user;
            await authCache.setItem(USER_PROFILES_MAP_KEY, knownProfiles);
        } else {
            await authCache.removeItem(USER_KEY);
            try {
                localStorage.removeItem('user');
            } catch {}
        }
    } catch (err) {
        console.warn('[localForage] Error storing user profile:', err);
    }
}

/**
 * Lookup a cached user profile by username for instant optimistic hydration
 */
export async function getCachedUserByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    const cleanUser = username.toLowerCase().trim();
    try {
        const knownProfiles = await authCache.getItem<Record<string, User>>(USER_PROFILES_MAP_KEY);
        if (knownProfiles && knownProfiles[cleanUser]) {
            return knownProfiles[cleanUser];
        }
        // Check active user cache
        const activeUser = await getCachedUserProfile();
        if (activeUser && activeUser.username.toLowerCase().trim() === cleanUser) {
            return activeUser;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Retrieve cached minimal products catalog for instant login & POS hydration
 */
export async function getCachedMinimalProducts(): Promise<Product[] | null> {
    try {
        const products = await productCache.getItem<Product[]>(PRODUCTS_KEY);
        if (products && Array.isArray(products) && products.length > 0) {
            return products;
        }
        // Fallback to localStorage
        const lsProds = localStorage.getItem('cached_products');
        if (lsProds) {
            const parsed = JSON.parse(lsProds);
            if (Array.isArray(parsed) && parsed.length > 0) {
                productCache.setItem(PRODUCTS_KEY, parsed).catch(() => {});
                return parsed;
            }
        }
        return null;
    } catch (err) {
        console.warn('[localForage] Error reading products cache:', err);
        return null;
    }
}

/**
 * Persist minimal products catalog into localForage
 */
export async function setCachedMinimalProducts(products: Product[]): Promise<void> {
    if (!products || !Array.isArray(products)) return;
    try {
        // Strip heavy base64 strings or unnecessary blobs to keep catalog ultra-fast and lightweight
        const minimalCatalog: Product[] = products.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            sku: p.sku || '',
            stock: Number(p.stock) || 0,
            price_unit: Number(p.price_unit) || 0,
            price_bulk: Number(p.price_bulk) || 0,
            price_cost: Number(p.price_cost) || 0,
            stock_alarm: Number(p.stock_alarm) || 0,
            image: p.image && !p.image.startsWith('data:image') ? p.image : null
        }));

        await productCache.setItem(PRODUCTS_KEY, minimalCatalog);
        try {
            // Keep small subset in localStorage for instant sync bootstrap
            localStorage.setItem('cached_products', JSON.stringify(minimalCatalog.slice(0, 100)));
        } catch {}
    } catch (err) {
        console.warn('[localForage] Error storing products catalog:', err);
    }
}

/**
 * Get cached auth token
 */
export async function getCachedAuthToken(): Promise<string | null> {
    try {
        const token = await authCache.getItem<string>(TOKEN_KEY);
        if (token) return token;
        return localStorage.getItem('auth_token');
    } catch {
        return localStorage.getItem('auth_token');
    }
}

/**
 * Set cached auth token
 */
export async function setCachedAuthToken(token: string | null): Promise<void> {
    try {
        if (token) {
            await authCache.setItem(TOKEN_KEY, token);
            localStorage.setItem('auth_token', token);
        } else {
            await authCache.removeItem(TOKEN_KEY);
            localStorage.removeItem('auth_token');
        }
    } catch {}
}

/**
 * Completely clear auth cache on explicit logout
 */
export async function clearAuthCache(): Promise<void> {
    try {
        await authCache.removeItem(USER_KEY);
        await authCache.removeItem(TOKEN_KEY);
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
    } catch {}
}
