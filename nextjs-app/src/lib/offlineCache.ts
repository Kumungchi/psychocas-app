import type { MemberData, TokenData } from '@/types/member';
import type { PartnerOfferRecord, PartnerVisibilityDiagnostics } from '@/lib/partners';

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_KEY_BASE = 'psychocas.home.snapshot';
export const HOME_SNAPSHOT_STORAGE_KEY = `${SNAPSHOT_KEY_BASE}.v${SNAPSHOT_VERSION}`;
const DEFAULT_MAX_AGE_MS = 1000 * 60 * 30; // 30 minutes

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStorage(): StorageLike | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      return (globalThis as unknown as { localStorage: StorageLike }).localStorage;
    } catch {
      return null;
    }
  }

  return null;
}

export interface HomeSnapshot {
  version: number;
  savedAt: string;
  expiresAt: string | null;
  member: MemberData | null;
  partners: PartnerOfferRecord[];
  token: TokenData | null;
  partnerDiagnostics?: PartnerVisibilityDiagnostics | null;
}

export function saveHomeSnapshot(input: {
  member: MemberData | null;
  partners: PartnerOfferRecord[];
  token: TokenData | null;
  partnerDiagnostics?: PartnerVisibilityDiagnostics | null;
  maxAgeMs?: number;
}): HomeSnapshot {
  const maxAgeMs = input.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const savedAt = new Date();
  const snapshot: HomeSnapshot = {
    version: SNAPSHOT_VERSION,
    savedAt: savedAt.toISOString(),
    expiresAt: Number.isFinite(maxAgeMs) ? new Date(savedAt.getTime() + maxAgeMs).toISOString() : null,
    member: input.member,
    partners: input.partners,
    token: input.token,
    partnerDiagnostics: input.partnerDiagnostics ?? null,
  };

  const storage = getStorage();
  if (!storage) {
    return snapshot;
  }

  try {
    storage.setItem(HOME_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('Failed to persist home snapshot', error);
  }
  return snapshot;
}

export function loadHomeSnapshot(): HomeSnapshot | null {
  const storage = getStorage();
  if (!storage) return null;

  const raw = storage.getItem(HOME_SNAPSHOT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as HomeSnapshot;

    if (parsed.version !== SNAPSHOT_VERSION) {
      clearHomeSnapshot();
      return null;
    }

    if (parsed.expiresAt) {
      const expiresAt = new Date(parsed.expiresAt).getTime();
      if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
        clearHomeSnapshot();
        return null;
      }
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to parse stored home snapshot', error);
    clearHomeSnapshot();
    return null;
  }
}

export function clearHomeSnapshot(): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(HOME_SNAPSHOT_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear home snapshot', error);
  }
}
