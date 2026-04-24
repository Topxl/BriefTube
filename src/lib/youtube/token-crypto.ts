import {
  decryptSecret,
  encryptSecret,
  isSecretBoxConfigured,
  type EncryptedPayload,
} from "@/lib/crypto/secret-box";

// AES-256-GCM. Key is a 32-byte hex string (64 chars) in env YOUTUBE_TOKEN_KEY.
// Generate one with: `openssl rand -hex 32` and store it in Infisical (/web).

function getKey(): string | undefined {
  return process.env.YOUTUBE_TOKEN_KEY;
}

export function isTokenCryptoConfigured(): boolean {
  return isSecretBoxConfigured(getKey());
}

export type EncryptedToken = EncryptedPayload;

export function encryptToken(plaintext: string): EncryptedToken | null {
  return encryptSecret(getKey(), plaintext);
}

export function decryptToken(payload: EncryptedToken): string | null {
  return decryptSecret(getKey(), payload);
}
