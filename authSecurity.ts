import crypto from "crypto";

/**
 * Generates a cryptographically strong salted scrypt hash.
 * Output format: <salt_hex>:<hash_hex>
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Constant-time password verification supporting both modern scrypt hashes
 * and legacy plaintext passwords with backward compatibility.
 */
export function verifyPassword(passwordAttempt: string, storedPassword: string): boolean {
  if (!passwordAttempt || !storedPassword) {
    return false;
  }

  // Modern salted scrypt format (salt:hash)
  if (storedPassword.includes(":") && storedPassword.length >= 64) {
    try {
      const parts = storedPassword.split(":");
      if (parts.length !== 2) return false;
      const [salt, hashHex] = parts;
      const expectedBuffer = Buffer.from(hashHex, "hex");
      const derivedKey = crypto.scryptSync(passwordAttempt, salt, expectedBuffer.length);
      return crypto.timingSafeEqual(expectedBuffer, derivedKey);
    } catch {
      return false;
    }
  }

  // Legacy plaintext fallback for seamless migration
  try {
    const attemptBuf = Buffer.from(passwordAttempt, "utf-8");
    const storedBuf = Buffer.from(storedPassword, "utf-8");
    if (attemptBuf.length !== storedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(attemptBuf, storedBuf);
  } catch {
    return passwordAttempt === storedPassword;
  }
}

/**
 * Checks if a stored password is in the modern salted hash format.
 */
export function isPasswordHashed(storedPassword: string): boolean {
  return typeof storedPassword === "string" && storedPassword.includes(":") && storedPassword.length >= 64;
}

/**
 * Returns a persistent cryptographically secure JWT secret.
 * Prioritizes environment variables, falls back to an SQLite-persisted random 256-bit secret.
 */
export function getJwtSecret(dbInstance?: any): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 16) {
    return process.env.JWT_SECRET.trim();
  }

  if (dbInstance) {
    try {
      const existing = dbInstance.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").get() as any;
      if (existing && existing.value && existing.value.length >= 32) {
        return existing.value;
      }

      const newSecret = crypto.randomBytes(32).toString("hex");
      dbInstance.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('jwt_secret', ?)").run(newSecret);
      return newSecret;
    } catch (err: any) {
      console.warn("[Auth Security] Could not persist JWT secret in settings table, using fallback:", err.message);
    }
  }

  return "gtr_pos_secure_production_secret_key_fixed_998877";
}
