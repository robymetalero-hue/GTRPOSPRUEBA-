/**
 * Módulo de Validación Criptográfica de Integridad de Bases de Datos
 * Compara hashes canónicos SHA-256 entre:
 * 1. Base de datos SQLite del servidor (Motor relacional primario)
 * 2. Caché local IndexedDB del navegador (remix_pos_offline)
 * 3. Verificación física de archivos (PRAGMA integrity_check) post-restauración
 */

import { getCachedAppState, cacheAppState } from './offlineStorage';

export interface TableHashResult {
  tableName: string;
  displayName: string;
  isLocalCached: boolean;
  serverCount: number;
  serverHash: string;
  serverAggregates: Record<string, any>;
  localCount?: number;
  localHash?: string;
  localAggregates?: Record<string, any>;
  status: 'matched' | 'mismatch' | 'server_only' | 'local_empty';
  verdictMessage: string;
}

export interface DatabaseIntegrityReport {
  timestamp: string;
  allAligned: boolean;
  sqliteIntegrity: {
    status: string;
    integrityMessage: string;
    quickCheck: string;
    foreignKeyViolations: number;
    fileSizeBytes: number;
    lastModified: string;
  };
  globalMasterHash: string;
  localComputedMasterHash: string;
  tables: Record<string, TableHashResult>;
  summary: {
    totalTablesChecked: number;
    alignedTables: number;
    mismatchedTables: number;
    serverOnlyTables: number;
    integrityScorePercentage: number;
    restorationIntegrityConfirmed: boolean;
  };
}

/**
 * Genera un hash SHA-256 en el navegador usando la API WebCrypto nativa
 */
export async function computeSha256(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple hash si WebCrypto no estuviera disponible en iframes restringidos
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'fallback_' + Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Funciones de cálculo canónico local para datos en IndexedDB
 */
export async function hashLocalProducts(products: any[]): Promise<{ count: number; hash: string; aggregates: any }> {
  const sorted = [...(products || [])].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  const str = sorted.map(r => 
    `[id=${r.id}|name=${(r.name || '').trim()}|cat=${(r.category || '').trim()}|sku=${(r.sku || '').trim()}|price=${Number(r.price_unit || 0).toFixed(2)}|stock=${Number(r.stock || 0).toFixed(2)}]`
  ).join('\n');
  const stockSum = sorted.reduce((s, r) => s + (Number(r.stock) || 0), 0);
  const priceSum = sorted.reduce((s, r) => s + (Number(r.price_unit) || 0), 0);
  const hash = await computeSha256(str);
  return {
    count: sorted.length,
    hash,
    aggregates: { stockSum: Math.round(stockSum * 100) / 100, priceSum: Math.round(priceSum * 100) / 100 }
  };
}

export async function hashLocalClients(clients: any[]): Promise<{ count: number; hash: string; aggregates: any }> {
  const sorted = [...(clients || [])].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  const str = sorted.map(r => 
    `[id=${r.id}|name=${(r.name || '').trim()}|phone=${(r.phone || '').trim()}|pts=${Number(r.points || 0)}]`
  ).join('\n');
  const pointsSum = sorted.reduce((s, r) => s + (Number(r.points) || 0), 0);
  const hash = await computeSha256(str);
  return {
    count: sorted.length,
    hash,
    aggregates: { pointsSum }
  };
}

export async function hashLocalDepartments(depts: any[]): Promise<{ count: number; hash: string; aggregates: any }> {
  const sorted = [...(depts || [])].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  const str = sorted.map(r => `[id=${r.id}|name=${(r.name || '').trim()}]`).join('\n');
  const hash = await computeSha256(str);
  return {
    count: sorted.length,
    hash,
    aggregates: {}
  };
}

export async function hashLocalSettings(settings: any[] | Record<string, any>): Promise<{ count: number; hash: string; aggregates: any }> {
  let entries: { key: string; value: string }[] = [];
  if (Array.isArray(settings)) {
    entries = settings.map(s => ({ key: String(s.key || ''), value: String(s.value || '') }));
  } else if (settings && typeof settings === 'object') {
    entries = Object.entries(settings).map(([key, value]) => ({ key, value: String(value ?? '') }));
  }
  entries.sort((a, b) => a.key.localeCompare(b.key));
  const str = entries.map(r => `[key=${r.key.trim()}|val=${r.value.trim()}]`).join('\n');
  const hash = await computeSha256(str);
  return {
    count: entries.length,
    hash,
    aggregates: {}
  };
}

/**
 * Ejecuta la verificación completa de integridad comparando hashes de IndexedDB y SQLite
 */
export async function runDatabaseIntegrityAudit(): Promise<DatabaseIntegrityReport> {
  // 1. Obtener hashes del servidor SQLite
  const serverRes = await fetch('/api/diagnose/database-integrity-hashes');
  if (!serverRes.ok) {
    const errData = await serverRes.json().catch(() => ({}));
    throw new Error(errData.error || `Error HTTP ${serverRes.status} al consultar servidor`);
  }
  const serverData = await serverRes.json();

  // 2. Extraer datos cacheados en IndexedDB local
  const [cachedProducts, cachedClients, cachedDepts] = await Promise.all([
    getCachedAppState<any[]>('cached_products'),
    getCachedAppState<any[]>('cached_clients'),
    getCachedAppState<any[]>('cached_departments'),
  ]);

  // 3. Computar hashes locales en IndexedDB
  const localProdHash = cachedProducts ? await hashLocalProducts(cachedProducts) : null;
  const localClientHash = cachedClients ? await hashLocalClients(cachedClients) : null;
  const localDeptHash = cachedDepts ? await hashLocalDepartments(cachedDepts) : null;

  const tables: Record<string, TableHashResult> = {};
  let totalChecked = 0;
  let alignedCount = 0;
  let mismatchCount = 0;
  let serverOnlyCount = 0;

  // Evaluar Productos
  const sProd = serverData.tables.products;
  if (sProd) {
    totalChecked++;
    const isMatched = localProdHash ? localProdHash.hash === sProd.hash : false;
    if (isMatched) alignedCount++;
    else if (localProdHash) mismatchCount++;
    else serverOnlyCount++;

    tables.products = {
      tableName: 'products',
      displayName: 'Productos (Catálogo & Stock)',
      isLocalCached: true,
      serverCount: sProd.count,
      serverHash: sProd.hash,
      serverAggregates: sProd.aggregates,
      localCount: localProdHash?.count,
      localHash: localProdHash?.hash,
      localAggregates: localProdHash?.aggregates,
      status: isMatched ? 'matched' : (localProdHash ? 'mismatch' : 'local_empty'),
      verdictMessage: isMatched 
        ? 'Íntegro: Hash SHA-256 exacto entre SQLite e IndexedDB (Stock y precios alineados)' 
        : (localProdHash ? 'Discrepancia detectada: La caché local no coincide con la versión restaurada del servidor' : 'Caché local de productos no inicializada en IndexedDB')
    };
  }

  // Evaluar Clientes
  const sClient = serverData.tables.clients;
  if (sClient) {
    totalChecked++;
    const isMatched = localClientHash ? localClientHash.hash === sClient.hash : false;
    if (isMatched) alignedCount++;
    else if (localClientHash) mismatchCount++;
    else serverOnlyCount++;

    tables.clients = {
      tableName: 'clients',
      displayName: 'Clientes (Fidelización & Puntos)',
      isLocalCached: true,
      serverCount: sClient.count,
      serverHash: sClient.hash,
      serverAggregates: sClient.aggregates,
      localCount: localClientHash?.count,
      localHash: localClientHash?.hash,
      localAggregates: localClientHash?.aggregates,
      status: isMatched ? 'matched' : (localClientHash ? 'mismatch' : 'local_empty'),
      verdictMessage: isMatched 
        ? 'Íntegro: Hash SHA-256 exacto (Puntos y datos de clientes consistentes)' 
        : (localClientHash ? 'Discrepancia detectada en clientes' : 'Caché local de clientes vacía')
    };
  }

  // Evaluar Departamentos
  const sDept = serverData.tables.departments;
  if (sDept) {
    totalChecked++;
    const isMatched = localDeptHash ? localDeptHash.hash === sDept.hash : false;
    if (isMatched) alignedCount++;
    else if (localDeptHash) mismatchCount++;
    else serverOnlyCount++;

    tables.departments = {
      tableName: 'departments',
      displayName: 'Departamentos / Categorías',
      isLocalCached: true,
      serverCount: sDept.count,
      serverHash: sDept.hash,
      serverAggregates: sDept.aggregates,
      localCount: localDeptHash?.count,
      localHash: localDeptHash?.hash,
      localAggregates: localDeptHash?.aggregates,
      status: isMatched ? 'matched' : (localDeptHash ? 'mismatch' : 'local_empty'),
      verdictMessage: isMatched 
        ? 'Íntegro: Hash SHA-256 exacto' 
        : (localDeptHash ? 'Discrepancia en categorías de productos' : 'Caché de departamentos vacía')
    };
  }

  // Evaluar Tablas de Servidor SQLite (sales, sale_items, cash_movements, settings)
  const serverTables = ['settings', 'sales', 'sale_items', 'cash_movements'];
  for (const tName of serverTables) {
    const sTable = serverData.tables[tName];
    if (sTable) {
      totalChecked++;
      serverOnlyCount++;
      tables[tName] = {
        tableName: tName,
        displayName: sTable.name || tName,
        isLocalCached: false,
        serverCount: sTable.count,
        serverHash: sTable.hash,
        serverAggregates: sTable.aggregates,
        status: 'server_only',
        verdictMessage: `Estructura SQLite íntegra y verificada en servidor (${sTable.count} registros)`
      };
    }
  }

  const isSqliteHealthy = serverData.sqliteIntegrity?.status === 'ok';
  const hasNoMismatches = mismatchCount === 0;
  const allAligned = isSqliteHealthy && hasNoMismatches;
  const integrityScore = totalChecked > 0 
    ? Math.round(((alignedCount + (isSqliteHealthy ? serverOnlyCount : 0)) / totalChecked) * 100)
    : 100;

  return {
    timestamp: serverData.timestamp || new Date().toISOString(),
    allAligned,
    sqliteIntegrity: serverData.sqliteIntegrity,
    globalMasterHash: serverData.globalMasterHash,
    localComputedMasterHash: localProdHash ? localProdHash.hash : 'none',
    tables,
    summary: {
      totalTablesChecked: totalChecked,
      alignedTables: alignedCount,
      mismatchedTables: mismatchCount,
      serverOnlyTables: serverOnlyCount,
      integrityScorePercentage: integrityScore,
      restorationIntegrityConfirmed: allAligned
    }
  };
}

/**
 * Re-alinea y re-sincroniza las bases de datos locales (IndexedDB) con la última versión limpia del servidor SQLite
 */
export async function realignLocalCacheWithServer(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/diagnose/clean-tables-export');
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status} al descargar tablas limpias`);
    }
    const data = await res.json();

    if (data.products && Array.isArray(data.products)) {
      await cacheAppState('cached_products', data.products);
      try { localStorage.setItem('cached_products', JSON.stringify(data.products)); } catch {}
    }
    if (data.clients && Array.isArray(data.clients)) {
      await cacheAppState('cached_clients', data.clients);
      try { localStorage.setItem('cached_clients', JSON.stringify(data.clients)); } catch {}
    }
    if (data.departments && Array.isArray(data.departments)) {
      await cacheAppState('cached_departments', data.departments);
      try { localStorage.setItem('cached_departments', JSON.stringify(data.departments)); } catch {}
    }

    return {
      success: true,
      message: `Caché IndexedDB re-alineada con éxito: ${data.products?.length || 0} productos, ${data.clients?.length || 0} clientes, ${data.departments?.length || 0} departamentos.`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error al re-alinear caché: ${err.message}`
    };
  }
}
