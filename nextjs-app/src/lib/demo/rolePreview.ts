import type { MemberRole } from '@/types/member';

export interface RolePreviewState {
  role: MemberRole | null;
  branchId?: string | null;
  branchName?: string | null;
  fullName?: string | null;
  email?: string | null;
}

const STORAGE_KEY = 'psychocas.demo-role';

const defaultState: RolePreviewState = {
  role: null,
  branchId: null,
  branchName: null,
  fullName: null,
  email: null,
};

type Listener = (state: RolePreviewState) => void;

const listeners = new Set<Listener>();

const isBrowser = typeof window !== 'undefined';

function parseState(raw: string | null): RolePreviewState {
  if (!raw) {
    return { ...defaultState };
  }

  try {
    const parsed = JSON.parse(raw) as RolePreviewState;
    return {
      role: parsed.role ?? null,
      branchId: parsed.branchId ?? null,
      branchName: parsed.branchName ?? null,
      fullName: parsed.fullName ?? null,
      email: parsed.email ?? null,
    };
  } catch {
    return { ...defaultState };
  }
}

export function isRolePreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ROLE_PREVIEW === 'true';
}

export function readRolePreview(): RolePreviewState {
  if (!isBrowser) {
    return { ...defaultState };
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return parseState(stored);
}

function persist(state: RolePreviewState): RolePreviewState {
  if (isBrowser) {
    if (state.role) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  listeners.forEach((listener) => listener({ ...state }));
  return state;
}

export function writeRolePreview(nextState: RolePreviewState): RolePreviewState {
  const state = {
    role: nextState.role ?? null,
    branchId: nextState.branchId ?? null,
    branchName: nextState.branchName ?? null,
    fullName: nextState.fullName ?? null,
    email: nextState.email ?? null,
  } satisfies RolePreviewState;

  return persist(state);
}

export function clearRolePreview(): RolePreviewState {
  return persist({ ...defaultState });
}

export function subscribeToRolePreview(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (isBrowser) {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }

    const state = parseState(event.newValue);
    listeners.forEach((listener) => listener({ ...state }));
  });
}
