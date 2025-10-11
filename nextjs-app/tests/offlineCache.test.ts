import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearHomeSnapshot,
  loadHomeSnapshot,
  saveHomeSnapshot,
  HOME_SNAPSHOT_STORAGE_KEY,
} from "@/lib/offlineCache";
import { MOCK_PARTNER_OFFERS } from "@/lib/partners";
import type { MemberData, TokenData } from "@/types/member";

declare global {
  var localStorage: Storage;
}

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  } as Storage;
};

beforeEach(() => {
  globalThis.localStorage = createMemoryStorage();
});

afterEach(() => {
  clearHomeSnapshot();
  delete (globalThis as Record<string, unknown>).localStorage;
});

describe("home snapshot cache", () => {
  const sampleMember: MemberData = {
    membership_active: true,
    membership_expires: "2030-01-01T00:00:00.000Z",
    full_name: "Test Tester",
    role: "member",
    branch_id: "praha",
    email: "test@example.com",
    approved: true,
    approved_at: "2024-01-01T00:00:00.000Z",
    branch: {
      id: "praha",
      name: "Praha",
      city: "Praha",
      discount_percentage: 10,
      active: true,
    },
  };

  const sampleToken: TokenData = {
    code: "ABC123",
    expiresAt: "2030-01-01T00:03:00.000Z",
  };

  it("returns null when nothing is cached", () => {
    const snapshot = loadHomeSnapshot();
    expect(snapshot).toBeNull();
  });

  it("persists and restores member data, partners, and tokens", () => {
    saveHomeSnapshot({
      member: sampleMember,
      partners: MOCK_PARTNER_OFFERS,
      token: sampleToken,
    });

    const snapshot = loadHomeSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.member?.full_name).toBe(sampleMember.full_name);
    expect(snapshot?.partners).toHaveLength(MOCK_PARTNER_OFFERS.length);
    expect(snapshot?.token?.code).toBe(sampleToken.code);
    expect(snapshot?.version).toBe(1);
    expect(new Date(snapshot!.savedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("gracefully clears invalid payloads", () => {
    saveHomeSnapshot({
      member: sampleMember,
      partners: MOCK_PARTNER_OFFERS,
      token: sampleToken,
    });

    globalThis.localStorage.setItem(HOME_SNAPSHOT_STORAGE_KEY, "not-json");

    expect(loadHomeSnapshot()).toBeNull();
    expect(globalThis.localStorage.getItem(HOME_SNAPSHOT_STORAGE_KEY)).toBeNull();
  });
});
