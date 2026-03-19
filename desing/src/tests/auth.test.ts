// =============================================================================
// AUTH BUSINESS LOGIC TESTS
// =============================================================================
// These test the rules around authentication — not the Supabase API calls
// (those are tested via integration tests), but the pure logic:
//   - Whitelist validation
//   - Membership expiry checks
//   - Role permission checks
// =============================================================================

import { describe, it, expect } from 'vitest'
import { isMembershipActive, hasRole, getRoleLabel, mockUser } from '@/lib/auth'

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------

describe('isMembershipActive', () => {
  it('returns true when membership is active and not expired', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() // 30 days
    expect(isMembershipActive(future, true)).toBe(true)
  })

  it('returns false when membership is expired', () => {
    const past = new Date(Date.now() - 1000).toISOString() // 1 second ago
    expect(isMembershipActive(past, true)).toBe(false)
  })

  it('returns false when is_active is false even if not expired', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    expect(isMembershipActive(future, false)).toBe(false)
  })

  it('returns false when both expired and inactive', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isMembershipActive(past, false)).toBe(false)
  })
})

describe('hasRole', () => {
  it('member has member role', () => {
    expect(hasRole('member', 'member')).toBe(true)
  })

  it('member does NOT have manager role', () => {
    expect(hasRole('member', 'manager')).toBe(false)
  })

  it('manager has manager role', () => {
    expect(hasRole('manager', 'manager')).toBe(true)
  })

  it('manager also has member role (higher includes lower)', () => {
    expect(hasRole('manager', 'member')).toBe(true)
  })

  it('manager does NOT have board role', () => {
    expect(hasRole('manager', 'board')).toBe(false)
  })

  it('board has member, manager, and board roles', () => {
    expect(hasRole('board', 'member')).toBe(true)
    expect(hasRole('board', 'manager')).toBe(true)
    expect(hasRole('board', 'board')).toBe(true)
  })

  it('board does NOT have technician role', () => {
    expect(hasRole('board', 'technician')).toBe(false)
  })

  it('technician has all roles (super-admin)', () => {
    expect(hasRole('technician', 'member')).toBe(true)
    expect(hasRole('technician', 'manager')).toBe(true)
    expect(hasRole('technician', 'board')).toBe(true)
    expect(hasRole('technician', 'technician')).toBe(true)
  })
})

describe('getRoleLabel', () => {
  it('returns Czech labels', () => {
    expect(getRoleLabel('member')).toBe('Člen')
    expect(getRoleLabel('manager')).toBe('Správce')
    expect(getRoleLabel('board')).toBe('Výbor')
    expect(getRoleLabel('technician')).toBe('Technik')
  })
})

describe('mockUser helper', () => {
  it('creates a user with default values', () => {
    const user = mockUser()
    expect(user.role).toBe('member')
    expect(user.is_membership_active).toBe(true)
  })

  it('allows overriding specific fields', () => {
    const manager = mockUser({ role: 'manager' })
    expect(manager.role).toBe('manager')
    expect(manager.email).toBe('test@psychocas.cz') // default preserved
  })
})
