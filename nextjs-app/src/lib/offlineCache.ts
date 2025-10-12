import type { MemberData, TokenData } from '@/types/member';
import type { PartnerOfferRecord } from '@/lib/partners';

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_KEY_BASE = 'psychocas.home.snapshot';
export const HOME_SNAPSHOT_STORAGE_KEY = `${SNAPSHOT_KEY_BASE}.v${SNAPSHOT_VERSION}`;

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
  member: MemberData | null;
  partners: PartnerOfferRecord[];
  token: TokenData | null;
}

export function saveHomeSnapshot(input: {
  member: MemberData | null;
  partners: PartnerOfferRecord[];
  token: TokenData | null;
}): HomeSnapshot {
  const snapshot: HomeSnapshot = {
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    member: input.member,
    partners: input.partners,
    token: input.token,
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
