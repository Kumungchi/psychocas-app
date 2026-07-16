import { describe, expect, it } from 'vitest';
import { resolveMemberTokenUiState } from '@/lib/qr/memberTokenState';

describe('member QR token state', () => {
  const now = Date.UTC(2026, 6, 16, 12, 0, 0);

  it('keeps a current token active while the backend update is loading', () => {
    expect(resolveMemberTokenUiState(undefined, now + 60_000, now)).toBe('active');
    expect(resolveMemberTokenUiState('scanned', now + 60_000, now)).toBe('active');
  });

  it('shows redemption even after the local countdown reaches zero', () => {
    expect(resolveMemberTokenUiState('redeemed', now - 1, now)).toBe('redeemed');
  });

  it('distinguishes revoked and expired tokens', () => {
    expect(resolveMemberTokenUiState('revoked', now + 60_000, now)).toBe('revoked');
    expect(resolveMemberTokenUiState('expired', now + 60_000, now)).toBe('expired');
    expect(resolveMemberTokenUiState('active', now, now)).toBe('expired');
  });
});
