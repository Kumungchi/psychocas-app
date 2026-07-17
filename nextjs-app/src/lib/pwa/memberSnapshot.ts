const DB_NAME = 'psychocas-pwa';
const STORE_NAME = 'member-snapshots';
const SNAPSHOT_KEY = 'current';
const VERSION = 3;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type OfflineOffer = {
  id: string;
  title: string;
  value: string;
  scope: 'national' | 'local';
  partnerName: string;
  category: string;
  description: string | null;
  redemptionInstructions: string | null;
  terms: string | null;
  partnerWebsite: string | null;
  partnerDescription: string | null;
  partnerAddress: string | null;
  validFrom: number | null;
  validUntil: number | null;
  lastVerifiedAt: number | null;
  updatedAt: number;
  favorite: boolean;
};

export type MemberOfflineSnapshot = {
  version: number;
  savedAt: number;
  expiresAt: number;
  membershipUntil: number;
  branchName: string | null;
  offers: OfflineOffer[];
};

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMemberSnapshot(input: {
  membershipUntil: number;
  branchName: string | null;
  offers: OfflineOffer[];
}): Promise<MemberOfflineSnapshot> {
  const savedAt = Date.now();
  const snapshot: MemberOfflineSnapshot = {
    version: VERSION,
    savedAt,
    expiresAt: savedAt + MAX_AGE_MS,
    membershipUntil: input.membershipUntil,
    branchName: input.branchName,
    offers: input.offers.slice(0, 100),
  };
  const database = await openDatabase();
  if (!database) return snapshot;
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(snapshot, SNAPSHOT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  return snapshot;
}

export async function loadMemberSnapshot(): Promise<MemberOfflineSnapshot | null> {
  const database = await openDatabase();
  if (!database) return null;
  const snapshot = await new Promise<MemberOfflineSnapshot | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
    request.onsuccess = () => resolve((request.result as MemberOfflineSnapshot | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  if (!snapshot || snapshot.version !== VERSION || snapshot.expiresAt <= Date.now()) {
    await clearMemberSnapshot();
    return null;
  }
  return snapshot;
}

export async function clearMemberSnapshot(): Promise<void> {
  const database = await openDatabase();
  if (database) {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }
  if (typeof localStorage !== 'undefined') {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('psychocas.home.snapshot')) localStorage.removeItem(key);
    }
  }
  if (typeof navigator !== 'undefined') {
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PRIVATE_CACHES' });
  }
}
