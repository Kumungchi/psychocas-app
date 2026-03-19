import type { AuthUser, UserRole } from '@/types'

// Checks if a membership is still active
export function isMembershipActive(expiresAt: string, isActive: boolean): boolean {
  if (!isActive) return false
  return new Date(expiresAt) > new Date()
}

// Checks if a user has at least the required role
// Order: member < manager < board < technician
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const levels: Record<UserRole, number> = { member: 1, manager: 2, board: 3, technician: 4 }
  return levels[userRole] >= levels[requiredRole]
}

// Returns a display-friendly name for the role (in Czech)
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    member: 'Člen',
    manager: 'Správce',
    board: 'Výbor',
    technician: 'Technik',
  }
  return labels[role]
}

// Creates a mock AuthUser for testing
export function mockUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'test-id',
    user_id: 'auth-test-id',
    email: 'test@psychocas.cz',
    full_name: 'Jan Novák',
    role: 'member',
    branch_id: 'branch-prague',
    membership_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    is_membership_active: true,
    ...overrides,
  }
}
