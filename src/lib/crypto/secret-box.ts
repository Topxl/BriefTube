import crypto from "crypto";

/**
 * AES-256-GCM helpers for encrypting short secrets at rest.
 *
 * The key is a 32-byte hex string (64 chars). Generate one with:
 *   openssl rand -hex 32
 * and store it in Infisical under the env var of your choice.
 *
 * This file is deliberately generic (takes the key as a parameter) so the
 * same primitive can back YouTube refresh-token storage and the extension
 * sign-in handoff without coupling them to the same key.
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type EncryptedPayload = {
  ciphertext: string; // hex (encrypted bytes + auth tag appended)
  iv: string; // hex
};

function readKey(hex: string | undefined): Buffer | null {
  if (hex?.length !== 64) return null;
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}

export function isSecretBoxConfigured(keyHex: string | undefined): boolean {
  return readKey(keyHex) !== null;
}

export function encryptSecret(
  keyHex: string | undefined,
  plaintext: string,
): EncryptedPayload | null {
  const key = readKey(keyHex);
  if (!key) return null;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("hex"),
    iv: iv.toString("hex"),
  };
}

export function decryptSecret(
  keyHex: string | undefined,
  payload: EncryptedPayload,
): string | null {
  const key = readKey(keyHex);
  if (!key) return null;
  try {
    const buf = Buffer.from(payload.ciphertext, "hex");
    const tag = buf.subarray(buf.length - TAG_BYTES);
    const enc = buf.subarray(0, buf.length - TAG_BYTES);
    const iv = Buffer.from(payload.iv, "hex");
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
