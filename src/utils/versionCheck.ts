/**
 * Version Checking and Comparison Utilities for GTR POS
 * 
 * Ensures the running client is synchronized with the latest server build upon login
 * and during active operations, triggering cache purges or update prompts if outdated.
 */

import { hardRefreshApp } from './appRefresh';

export const CLIENT_VERSION = "2.4.0";

export interface VersionComparisonResult {
    clientVersion: string;
    serverVersion: string;
    isOutdated: boolean;
    isNewer: boolean;
    isEqual: boolean;
    difference: 'major' | 'minor' | 'patch' | 'none';
    message: string;
}

export interface ValidateLoginVersionOptions {
    autoForceRefresh?: boolean;
    onVersionMismatch?: (result: VersionComparisonResult) => void;
    clientVersionOverride?: string;
}

/**
 * Normalizes a version string into an array of integers [major, minor, patch]
 * Strips leading 'v', extra spaces, or non-numeric metadata.
 */
export function parseVersion(versionStr?: string | null): number[] {
    if (!versionStr || typeof versionStr !== 'string') {
        return [0, 0, 0];
    }
    const clean = versionStr.trim().replace(/^v/i, '');
    const parts = clean.split('.').map(p => {
        const parsed = parseInt(p, 10);
        return isNaN(parsed) ? 0 : parsed;
    });

    while (parts.length < 3) {
        parts.push(0);
    }
    return parts.slice(0, 3);
}

/**
 * Compares two semantic version strings (v1 vs v2).
 * Returns:
 *   -1 if v1 < v2 (v1 is older)
 *    0 if v1 === v2 (equal)
 *    1 if v1 > v2 (v1 is newer)
 */
export function compareVersions(v1: string, v2: string): number {
    const p1 = parseVersion(v1);
    const p2 = parseVersion(v2);

    for (let i = 0; i < 3; i++) {
        if (p1[i] < p2[i]) return -1;
        if (p1[i] > p2[i]) return 1;
    }
    return 0;
}

/**
 * Compares the active client version with a server version.
 */
export function compareClientWithServerVersion(
    serverVersion?: string | null,
    clientVer: string = CLIENT_VERSION
): VersionComparisonResult {
    const safeServerVer = (serverVersion && typeof serverVersion === 'string' && serverVersion.trim())
        ? serverVersion.trim().replace(/^v/i, '')
        : clientVer;
    
    const safeClientVer = clientVer.trim().replace(/^v/i, '');

    const cmp = compareVersions(safeClientVer, safeServerVer);
    const isOutdated = cmp < 0;
    const isNewer = cmp > 0;
    const isEqual = cmp === 0;

    const pClient = parseVersion(safeClientVer);
    const pServer = parseVersion(safeServerVer);

    let difference: 'major' | 'minor' | 'patch' | 'none' = 'none';
    if (pClient[0] !== pServer[0]) {
        difference = 'major';
    } else if (pClient[1] !== pServer[1]) {
        difference = 'minor';
    } else if (pClient[2] !== pServer[2]) {
        difference = 'patch';
    }

    let message = `GTR POS v${safeClientVer} está al día con el servidor.`;
    if (isOutdated) {
        message = `Versión obsoleta detectada: Cliente v${safeClientVer} vs Servidor v${safeServerVer}. Se requiere actualización.`;
    } else if (isNewer) {
        message = `Cliente v${safeClientVer} es más reciente que el servidor v${safeServerVer}.`;
    }

    return {
        clientVersion: safeClientVer,
        serverVersion: safeServerVer,
        isOutdated,
        isNewer,
        isEqual,
        difference,
        message
    };
}

/**
 * Validates the application version upon user login.
 * Compares CLIENT_VERSION with the version payload returned by /api/auth/login.
 * 
 * If a discrepancy is found and autoForceRefresh is true (or when forced),
 * initiates cache purging and updates state safely.
 */
export async function validateVersionOnLogin(
    loginPayload?: any,
    options: ValidateLoginVersionOptions = {}
): Promise<VersionComparisonResult> {
    const { 
        autoForceRefresh = false, 
        onVersionMismatch, 
        clientVersionOverride = CLIENT_VERSION 
    } = options;

    let reportedServerVersion = loginPayload?.app_version 
        || loginPayload?.server_version 
        || loginPayload?.version;

    // Fallback: If not present in login payload, query /api/app-version
    if (!reportedServerVersion && navigator.onLine) {
        try {
            const res = await fetch(`/api/app-version?_t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                reportedServerVersion = data?.version;
            }
        } catch (e) {
            console.warn("[validateVersionOnLogin] Fallback version check failed:", e);
        }
    }

    const result = compareClientWithServerVersion(reportedServerVersion, clientVersionOverride);

    if (result.isOutdated) {
        console.warn(`[validateVersionOnLogin] ${result.message}`);
        
        // Dispatch global event for listeners (like App.tsx or AppContext)
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app-update-available', {
                detail: {
                    version: result.serverVersion,
                    clientVersion: result.clientVersion,
                    source: 'login_validation'
                }
            }));
        }

        if (onVersionMismatch) {
            onVersionMismatch(result);
        }

        if (autoForceRefresh) {
            console.info("[validateVersionOnLogin] Auto-forcing application refresh for outdated client...");
            await hardRefreshApp();
        }
    }

    return result;
}
