import "server-only";

import { createVerify, verify as ed25519Verify } from "crypto";

/**
 * Official HighLevel webhook verification keys (public material only).
 * Source: HighLevel Webhook Integration Guide (RSA legacy + Ed25519 current).
 */
const LEGACY_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCp
vuxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8g
F3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOK
UJ062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTX
pIocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTz
Nh/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELh
CHULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sY
JPQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAy
kT1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

const GHL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

export type WebhookVerifyResult =
  | { ok: true; method: "ed25519" | "rsa" }
  | { ok: false; reason: string };

function verifyLegacyRsaSha256(rawBody: string, signatureB64: string): boolean {
  const verifier = createVerify("SHA256");
  verifier.update(rawBody);
  verifier.end();
  return verifier.verify(LEGACY_RSA_PUBLIC_KEY, signatureB64, "base64");
}

function verifyEd25519(rawBody: string, signatureB64: string): boolean {
  const payloadBuffer = Buffer.from(rawBody, "utf8");
  const signatureBuffer = Buffer.from(signatureB64, "base64");
  return ed25519Verify(
    null,
    payloadBuffer,
    GHL_ED25519_PUBLIC_KEY,
    signatureBuffer,
  );
}

export function verifyGhlWebhookSignature(
  rawBody: string,
  headers: Headers,
): WebhookVerifyResult {
  const ghlSig = headers.get("x-ghl-signature") ?? headers.get("X-GHL-Signature");
  const legacySig = headers.get("x-wh-signature") ?? headers.get("X-WH-Signature");

  if (ghlSig && ghlSig !== "N/A") {
    try {
      const ok = verifyEd25519(rawBody, ghlSig);
      return ok
        ? { ok: true, method: "ed25519" }
        : { ok: false, reason: "ed25519_verify_failed" };
    } catch (e) {
      return {
        ok: false,
        reason: e instanceof Error ? e.message : "ed25519_verify_error",
      };
    }
  }

  if (legacySig && legacySig !== "N/A") {
    try {
      const ok = verifyLegacyRsaSha256(rawBody, legacySig);
      return ok
        ? { ok: true, method: "rsa" }
        : { ok: false, reason: "rsa_verify_failed" };
    } catch (e) {
      return {
        ok: false,
        reason: e instanceof Error ? e.message : "rsa_verify_error",
      };
    }
  }

  return { ok: false, reason: "missing_signature_headers" };
}

const REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function assertWebhookNotReplayed(payload: {
  timestamp?: string;
  webhookId?: string;
}): { ok: true } | { ok: false; reason: string } {
  if (payload.timestamp) {
    const t = Date.parse(payload.timestamp);
    if (!Number.isFinite(t)) {
      return { ok: false, reason: "invalid_timestamp" };
    }
    if (Math.abs(Date.now() - t) > REPLAY_WINDOW_MS) {
      return { ok: false, reason: "timestamp_outside_window" };
    }
  }
  return { ok: true };
}
