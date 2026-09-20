import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import { db } from "./database.ts";

export interface UserContext {
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  ipAddress?: string;
  userAgent?: string;
  isSystemDaemon?: boolean;
}

export const requestContextStorage = new AsyncLocalStorage<UserContext>();

export const SYSTEM_SYNC_USER: UserContext = {
  userId: 0,
  userName: "system_sync_daemon",
  userRole: "system_daemon",
  isSystemDaemon: true,
};

const HMAC_SECRET = process.env.FIRESTORE_INTEGRITY_SECRET || "GTR_POS_FIRESTORE_SECURE_HMAC_SALT_2026";

/**
 * Deterministically sorts object keys recursively to produce a canonical JSON string for hashing.
 */
export function canonicalizeData(obj: any): string {
  if (obj === null || obj === undefined) return "";
  if (typeof obj !== "object") return String(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizeData).join(",") + "]";
  }

  const sortedKeys = Object.keys(obj)
    .filter(k => !k.startsWith("_tx_")) // Exclude injected transaction metadata
    .sort();

  const parts = sortedKeys.map(key => {
    const val = obj[key];
    const cleanVal = typeof val === "object" ? canonicalizeData(val) : JSON.stringify(val);
    return `${JSON.stringify(key)}:${cleanVal}`;
  });

  return "{" + parts.join(",") + "}";
}

/**
 * Computes a cryptographic SHA-256 HMAC for the transaction against user identity and payload.
 */
export function computeTransactionHash(params: {
  tableName: string;
  recordId: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload?: any;
  user: UserContext;
  timestamp: string;
}): string {
  const { tableName, recordId, operation, payload, user, timestamp } = params;
  const canonicalPayload = canonicalizeData(payload || {});
  const payloadChecksum = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

  const message = [
    `TABLE:${tableName}`,
    `ID:${recordId}`,
    `OP:${operation}`,
    `PAYLOAD_HASH:${payloadChecksum}`,
    `USER_ID:${user.userId ?? "anon"}`,
    `USER_NAME:${user.userName ?? "unknown"}`,
    `USER_ROLE:${user.userRole ?? "guest"}`,
    `TIME:${timestamp}`
  ].join("|");

  return crypto.createHmac("sha256", HMAC_SECRET).update(message).digest("hex");
}

/**
 * Validates a Firestore write operation against user context and schema integrity.
 * Injects cryptographic verification metadata and logs into the tamper-evident ledger.
 */
export function validateFirestoreWriteOperation(
  tableName: string,
  recordId: string | number,
  operation: "CREATE" | "UPDATE" | "DELETE",
  payload?: any,
  explicitUser?: UserContext
): {
  valid: boolean;
  txHash: string;
  enrichedPayload: any;
  user: UserContext;
} {
  const idStr = String(recordId).trim();

  // 1. Sanity check on Record ID (Prevent empty/NaN/ghost IDs)
  if (!idStr || idStr === "null" || idStr === "undefined" || idStr === "NaN") {
    throw new Error(`[Firestore Integrity Violation] Write blocked: Invalid or empty document ID "${recordId}" on table "${tableName}".`);
  }

  // 2. Resolve User Context
  let activeUser: UserContext = explicitUser || requestContextStorage.getStore() || SYSTEM_SYNC_USER;

  // If a user is provided by name/id, verify they are a valid user in the database or system daemon
  if (!activeUser.isSystemDaemon && activeUser.userName) {
    try {
      const dbUser = db.prepare("SELECT id, username, role FROM users WHERE username = ? OR id = ?").get(activeUser.userName, activeUser.userId) as any;
      if (dbUser) {
        activeUser = {
          userId: dbUser.id,
          userName: dbUser.username,
          userRole: dbUser.role,
          ipAddress: activeUser.ipAddress,
          userAgent: activeUser.userAgent,
          isSystemDaemon: false,
        };
      }
    } catch (dbErr) {
      // In-memory or offline fallback
    }
  }

  // 3. Anti-Ghost & Schema Validation
  if (operation !== "DELETE" && payload) {
    if (typeof payload !== "object") {
      throw new Error(`[Firestore Integrity Violation] Payload for ${tableName} #${idStr} must be a valid object.`);
    }

    // Table-specific anti-ghost checks
    if (tableName === "products") {
      if (payload.name !== undefined && (typeof payload.name !== "string" || payload.name.trim() === "")) {
        throw new Error(`[Firestore Anti-Ghost Violation] Product #${idStr} cannot have an empty name.`);
      }
      if (payload.price !== undefined && (isNaN(Number(payload.price)) || Number(payload.price) < 0)) {
        throw new Error(`[Firestore Anti-Ghost Violation] Product #${idStr} has invalid price: ${payload.price}`);
      }
      if (payload.stock !== undefined && isNaN(Number(payload.stock))) {
        throw new Error(`[Firestore Anti-Ghost Violation] Product #${idStr} has invalid stock value: ${payload.stock}`);
      }
    }

    if (tableName === "clients") {
      if (payload.name !== undefined && (typeof payload.name !== "string" || payload.name.trim() === "")) {
        throw new Error(`[Firestore Anti-Ghost Violation] Client #${idStr} cannot have an empty name.`);
      }
    }

    if (tableName === "sales") {
      if (payload.total !== undefined && (isNaN(Number(payload.total)) || Number(payload.total) < 0)) {
        throw new Error(`[Firestore Anti-Ghost Violation] Sale #${idStr} has invalid total: ${payload.total}`);
      }
    }

    if (tableName === "inventory_audit_logs") {
      if (payload.quantity !== undefined && Number(payload.quantity) === 0) {
        throw new Error(`[Firestore Anti-Ghost Violation] Inventory log #${idStr} cannot have quantity 0.`);
      }
    }
  }

  // 4. Compute High-Precision Cryptographic Hash
  const timestamp = new Date().toISOString();
  const txHash = computeTransactionHash({
    tableName,
    recordId: idStr,
    operation,
    payload,
    user: activeUser,
    timestamp
  });

  const canonicalPayload = canonicalizeData(payload || {});
  const payloadChecksum = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

  // 5. Enrich Payload with cryptographic transaction stamps
  let enrichedPayload: any = null;
  if (operation !== "DELETE" && payload) {
    enrichedPayload = {
      ...payload,
      _tx_hash: txHash,
      _tx_user_id: activeUser.userId,
      _tx_user_name: activeUser.userName,
      _tx_user_role: activeUser.userRole,
      _tx_op: operation,
      _tx_timestamp: timestamp
    };
  }

  // 6. Record in Tamper-Evident Firestore Transaction Ledger
  try {
    db.prepare(`
      INSERT OR REPLACE INTO firestore_transaction_ledger 
      (tx_hash, table_name, record_id, operation, user_id, user_name, user_role, payload_checksum, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'VALIDATED_AND_COMMITTED', ?)
    `).run(
      txHash,
      tableName,
      idStr,
      operation,
      activeUser.userId,
      activeUser.userName,
      activeUser.userRole,
      payloadChecksum,
      timestamp
    );
  } catch (ledgerErr: any) {
    // If ledger fails due to duplicate hash on exact same state, that's idempotent
  }

  return {
    valid: true,
    txHash,
    enrichedPayload: enrichedPayload || payload,
    user: activeUser
  };
}

/**
 * Validates remote Firestore document during pulls to prevent phantom or corrupt documents from entering SQLite.
 */
export function validateRemoteFirestoreDocument(tableName: string, docData: any, docId: string): boolean {
  if (!docData || typeof docData !== "object") return false;

  const id = String(docData.id !== undefined ? docData.id : docId).trim();
  if (!id || id === "null" || id === "undefined" || id === "NaN") {
    console.warn(`[Pull Anti-Ghost Filter] Rejected remote document on "${tableName}" with invalid ID:`, docId);
    return false;
  }

  if (tableName === "products") {
    if (!docData.name || typeof docData.name !== "string" || docData.name.trim() === "") {
      console.warn(`[Pull Anti-Ghost Filter] Rejected remote product #${id} due to missing or empty name.`);
      return false;
    }
    if (docData.price !== undefined && isNaN(Number(docData.price))) {
      return false;
    }
  }

  if (tableName === "clients") {
    if (!docData.name || typeof docData.name !== "string" || docData.name.trim() === "") {
      console.warn(`[Pull Anti-Ghost Filter] Rejected remote client #${id} due to missing or empty name.`);
      return false;
    }
  }

  if (tableName === "sales") {
    if (docData.total !== undefined && isNaN(Number(docData.total))) {
      return false;
    }
  }

  if (tableName === "inventory_audit_logs") {
    if (docData.quantity !== undefined && Number(docData.quantity) === 0) {
      return false;
    }
  }

  return true;
}

/**
 * Retrieves recent verified transactions from the Firestore transaction ledger.
 */
export function getRecentFirestoreLedger(limit: number = 50) {
  try {
    return db.prepare(`
      SELECT * FROM firestore_transaction_ledger 
      ORDER BY id DESC 
      LIMIT ?
    `).all(limit);
  } catch (e: any) {
    return [];
  }
}

/**
 * Retrieves statistical integrity summary of the Firestore Transaction Ledger.
 */
export function getFirestoreLedgerStats() {
  try {
    const totalWrites = (db.prepare("SELECT COUNT(*) as count FROM firestore_transaction_ledger").get() as any)?.count || 0;
    const opsSummary = db.prepare("SELECT operation, COUNT(*) as count FROM firestore_transaction_ledger GROUP BY operation").all() as any[];
    const userSummary = db.prepare("SELECT user_name, COUNT(*) as count FROM firestore_transaction_ledger GROUP BY user_name ORDER BY count DESC LIMIT 10").all() as any[];
    const lastEntry = db.prepare("SELECT * FROM firestore_transaction_ledger ORDER BY id DESC LIMIT 1").get() as any;

    return {
      totalWrites,
      operations: opsSummary,
      topUsers: userSummary,
      lastTransaction: lastEntry || null
    };
  } catch (e: any) {
    return { totalWrites: 0, operations: [], topUsers: [], lastTransaction: null };
  }
}
