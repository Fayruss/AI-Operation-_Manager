import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * CLAUDE.md/SAD §12: "mail OAuth tokens encrypted at rest (pgcrypto)".
 * Encrypting at the application layer (AES-256-GCM) rather than relying on
 * a Postgres extension keeps the guarantee independent of which database
 * ends up hosting this (Supabase-managed Postgres may not expose pgcrypto
 * superuser functions to app roles) and means a DB dump alone never leaks
 * plaintext tokens either way.
 *
 * `ENCRYPTION_KEY` must be a 64-char hex string (32 bytes) — generate with
 * `openssl rand -hex 32`. Derives a key via scrypt so a raw passphrase would
 * also work, though a proper random key is what .env.example documents.
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY is not set — required to store OAuth tokens (see .env.example).");
  }
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }
  // Fallback: derive a 32-byte key from an arbitrary passphrase (dev convenience).
  return scryptSync(secret, "aiom-encryption-salt", 32);
}

/** Returns `iv:authTag:ciphertext`, all hex-encoded, as a single storable string. */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const key = getKey();
  const [ivHex, authTagHex, ciphertextHex] = payload.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted payload");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf8");
}
