import { DEFAULT_PREFERENCES, STORAGE_KEYS } from "./defaults";
import type { CandidateItem, MatchPreferences, PageConsent, ResumeProfile } from "./types";

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

async function getValue<T>(key: string): Promise<T | undefined> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) as T : undefined;
}

async function setValue<T>(key: string, value: T): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export async function loadProfile(): Promise<ResumeProfile | undefined> {
  return getValue<ResumeProfile>(STORAGE_KEYS.profile);
}

export async function saveProfile(profile: ResumeProfile): Promise<void> {
  await setValue(STORAGE_KEYS.profile, profile);
}

export async function loadPreferences(): Promise<MatchPreferences> {
  const saved = await getValue<Partial<MatchPreferences>>(STORAGE_KEYS.preferences);
  return {
    ...DEFAULT_PREFERENCES,
    ...saved,
    weights: { ...DEFAULT_PREFERENCES.weights, ...saved?.weights },
    hardFilters: { ...DEFAULT_PREFERENCES.hardFilters, ...saved?.hardFilters }
  };
}

export async function savePreferences(preferences: MatchPreferences): Promise<void> {
  await setValue(STORAGE_KEYS.preferences, preferences);
}

export async function loadConsent(): Promise<PageConsent> {
  return (await getValue<PageConsent>(STORAGE_KEYS.consent)) || { accepted: false };
}

export async function saveConsent(consent: PageConsent): Promise<void> {
  await setValue(STORAGE_KEYS.consent, consent);
}

export async function loadCandidates(): Promise<CandidateItem[]> {
  return (await getValue<CandidateItem[]>(STORAGE_KEYS.candidates)) || [];
}

export async function saveCandidates(candidates: CandidateItem[]): Promise<void> {
  await setValue(STORAGE_KEYS.candidates, candidates.slice(0, 200));
}

export async function clearExtensionStorage(): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.clear();
  } else {
    localStorage.clear();
  }
}
