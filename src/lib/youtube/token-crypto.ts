import crypto from "crypto";

// AES-256-GCM. Key is a 32-byte hex string (64 chars) in env YOUTUBE_TOKEN_KEY.
// Generate one with: `openssl rand -hex 32` and store it in Infisical (/web).

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function getKey(): Buffer | null {
  const hex = process.env.YOUTUBE_TOKEN_KEY;
  if (hex?.length !== 64) return null;
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}

export function isTokenCryptoConfigured(): boolean {
  return getKey() !== null;
}

export type EncryptedToken = {
  ciphertext: string; // hex (encrypted bytes + 16-byte auth tag appended)
  iv: string; // hex
};

export function encryptToken(plaintext: string): EncryptedToken | null {
  const key = getKey();
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

export function decryptToken(payload: EncryptedToken): string | null {
  const key = getKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(payload.ciphertext, "hex");
    const tag = buf.subarray(buf.length - 16);
    const enc = buf.subarray(0, buf.length - 16);
    const iv = Buffer.from(payload.iv, "hex");
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
