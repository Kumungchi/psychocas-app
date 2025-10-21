import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let rolePreview: typeof import('@/lib/demo/rolePreview');
let storage: Map<string, string>;

beforeEach(async () => {
  vi.resetModules();
  storage = new Map();

  const localStorage: Storage = {
    get length() {
      return storage.size;
    },
    clear: vi.fn(() => {
      storage.clear();
    }),
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
  };

  const windowStub = {
    localStorage,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Window;

  vi.stubGlobal('window', windowStub);

  rolePreview = await import('@/lib/demo/rolePreview');
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_ENABLE_ROLE_PREVIEW;
});

describe('role preview utilities', () => {
  it('is disabled by default', () => {
    expect(rolePreview.isRolePreviewEnabled()).toBe(false);
  });

  it('honours the enable flag', () => {
    process.env.NEXT_PUBLIC_ENABLE_ROLE_PREVIEW = 'true';
    expect(rolePreview.isRolePreviewEnabled()).toBe(true);
  });

  it('persists role selections to local storage', () => {
    process.env.NEXT_PUBLIC_ENABLE_ROLE_PREVIEW = 'true';

    const state = rolePreview.writeRolePreview({
      role: 'manager',
      branchId: 'demo-branch',
      branchName: 'Demo Branch',
      fullName: 'Casey Demo',
      email: 'manager@demo.test',
    });

    expect(state.role).toBe('manager');
    expect(rolePreview.readRolePreview().branchName).toBe('Demo Branch');
  });

  it('notifies subscribers when the preview changes', () => {
    process.env.NEXT_PUBLIC_ENABLE_ROLE_PREVIEW = 'true';

    const listener = vi.fn();
    const unsubscribe = rolePreview.subscribeToRolePreview(listener);

    rolePreview.writeRolePreview({ role: 'technician' });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'technician' })
    );

    unsubscribe();
  });

  it('clears the preview state', () => {
    process.env.NEXT_PUBLIC_ENABLE_ROLE_PREVIEW = 'true';

    rolePreview.writeRolePreview({ role: 'council' });
    const cleared = rolePreview.clearRolePreview();

    expect(cleared.role).toBeNull();
    expect(rolePreview.readRolePreview().role).toBeNull();
  });
});
