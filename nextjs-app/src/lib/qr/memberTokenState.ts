export type MemberTokenStatus = 'active' | 'expired' | 'scanned' | 'redeemed' | 'revoked';

export type MemberTokenUiState = 'active' | 'redeemed' | 'expired' | 'revoked';

export function resolveMemberTokenUiState(
  status: MemberTokenStatus | null | undefined,
  expiresAt: number,
  now: number,
): MemberTokenUiState {
  if (status === 'redeemed') return 'redeemed';
  if (status === 'revoked') return 'revoked';
  if (status === 'expired' || expiresAt <= now) return 'expired';
  return 'active';
}
