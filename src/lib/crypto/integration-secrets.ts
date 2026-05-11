import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

import { getServerEnv } from "@/lib/env.server";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;

function deriveKeyMaterial(secret: string): Buffer {
  const trimmed = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === KEY_LEN) return buf;
  } catch {
    // fall through
  }
  return scryptSync(trimmed, "aos-integration-secrets", KEY_LEN);
}

function getKey(): Buffer {
  const { INTEGRATION_ENCRYPTION_KEY } = getServerEnv();
  if (!INTEGRATION_ENCRYPTION_KEY) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured");
  }
  const key = deriveKeyMaterial(INTEGRATION_ENCRYPTION_KEY);
  if (key.length !== KEY_LEN) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY must resolve to 32 bytes (use 64-char hex or 32-byte base64)",
    );
  }
  return key;
}

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

export function encryptJson(payload: unknown): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: 16 });
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: 1,
  };
}

export function decryptJson<T>(payload: EncryptedPayload): T {
  const key = getKey();
  const iv = Buffer.from(payload.iv, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}
