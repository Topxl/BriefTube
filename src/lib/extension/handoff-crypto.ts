import {
  decryptSecret,
  encryptSecret,
  isSecretBoxConfigured,
  type EncryptedPayload,
} from "@/lib/crypto/secret-box";

/**
 * Encrypts the Supabase session we hand off to the Chrome extension.
 *
 * Falls back to YOUTUBE_TOKEN_KEY when EXTENSION_HANDOFF_KEY isn't set so
 * existing deployments don't need a config change to pick up the security
 * fix. Split them (generate a fresh `openssl rand -hex 32`) at the next
 * rotation window.
 */
function getKey(): string | undefined {
  return process.env.EXTENSION_HANDOFF_KEY ?? process.env.YOUTUBE_TOKEN_KEY;
}

export function isHandoffCryptoConfigured(): boolean {
  return isSecretBoxConfigured(getKey());
}

export type EncryptedHandoff = EncryptedPayload;

export function encryptHandoff(plaintext: string): EncryptedHandoff | null {
  return encryptSecret(getKey(), plaintext);
}

export function decryptHandoff(payload: EncryptedHandoff): string | null {
  return decryptSecret(getKey(), payload);
}
