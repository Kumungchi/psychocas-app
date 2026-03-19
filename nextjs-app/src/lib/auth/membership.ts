import type { MemberRole } from '@/types/member'

// Checks if a membership is still active
export function isMembershipActive(expiresAt: string | null, isActive: boolean): boolean {
  if (!isActive) return false
  if (!expiresAt) return false
  return new Date(expiresAt) > new Date()
}

// Checks if a user has at least the required role
// Order: member < manager < council < technician < admin
export function hasRole(userRole: MemberRole, requiredRole: MemberRole): boolean {
  const levels: Record<MemberRole, number> = { member: 1, manager: 2, council: 3, technician: 4, admin: 5 }
  return levels[userRole] >= levels[requiredRole]
}

// Returns a display-friendly name for the role (in Czech)
export function getRoleLabel(role: MemberRole): string {
  const labels: Record<MemberRole, string> = {
    member: 'Člen',
    manager: 'Správce',
    council: 'Výbor',
    technician: 'Technik',
    admin: 'Admin',
  }
  return labels[role]
}
