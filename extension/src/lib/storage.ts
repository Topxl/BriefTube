import { STORAGE_KEYS } from "./config";
import type { StoredSession } from "./types";

async function getItem<T>(key: string): Promise<T | null> {
  const res = await chrome.storage.local.get(key);
  return (res[key] as T | undefined) ?? null;
}

async function setItem<T>(key: string, value: T) {
  await chrome.storage.local.set({ [key]: value });
}

async function removeItem(key: string) {
  await chrome.storage.local.remove(key);
}

export async function getSession(): Promise<StoredSession | null> {
  return getItem<StoredSession>(STORAGE_KEYS.session);
}

export async function setSession(session: StoredSession) {
  await setItem(STORAGE_KEYS.session, session);
}

export async function clearSession() {
  await removeItem(STORAGE_KEYS.session);
}

export type ExtensionPrefs = {
  targetLanguage?: string;
  defaultTab?: "summary" | "chapters" | "audio" | "comments";
  autoOpenSidebar?: boolean;
};

export async function getPrefs(): Promise<ExtensionPrefs> {
  return (await getItem<ExtensionPrefs>(STORAGE_KEYS.preferences)) ?? {};
}

export async function setPrefs(next: Partial<ExtensionPrefs>) {
  const current = await getPrefs();
  await setItem(STORAGE_KEYS.preferences, { ...current, ...next });
}
