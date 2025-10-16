import { describe, expect, it } from 'vitest'

import {
  ROLE_ALLOWED_PATHS,
  ROLE_DEFAULT_REDIRECT,
  hasPsychocasEmail,
  isAllowedRedirect,
  normaliseRole,
  type MemberRole,
} from '../src/lib/auth/roleRouting'

const createMember = (role: MemberRole, email: string | null) => ({
  role,
  email,
})

describe('auth callback role handling', () => {
  it('keeps members as members by default', () => {
    const member = createMember('member', 'member.tester@psychocas.test')
    expect(normaliseRole(member)).toBe('member')
    expect(ROLE_DEFAULT_REDIRECT.member).toBe('/home')
    expect(isAllowedRedirect('/redeem', 'member')).toBe(true)
    expect(isAllowedRedirect('/stats', 'member')).toBe(false)
  })

  it('requires an @psychocas.cz email to treat managers as managers', () => {
    const realManager = createMember('manager', 'manager@psychocas.cz')
    const externalManager = createMember('manager', 'manager@example.com')

    expect(hasPsychocasEmail(realManager.email)).toBe(true)
    expect(normaliseRole(realManager)).toBe('manager')
    expect(ROLE_DEFAULT_REDIRECT.manager).toBe('/stats')
    expect(isAllowedRedirect('/stats', 'manager')).toBe(true)

    expect(hasPsychocasEmail(externalManager.email)).toBe(false)
    expect(normaliseRole(externalManager)).toBe('member')
  })

  it('grants council users access to the admin and technician tools', () => {
    const councilMember = createMember('council', 'tajemnik@psychocas.cz')

    expect(normaliseRole(councilMember)).toBe('council')
    expect(ROLE_DEFAULT_REDIRECT.council).toBe('/admin')
    expect(isAllowedRedirect('/admin', 'council')).toBe(true)
    expect(isAllowedRedirect('/technician', 'council')).toBe(true)
  })

  it('only exposes technician tools when the email is trusted', () => {
    const technician = createMember('technician', 'technik@psychocas.cz')
    const externalTech = createMember('technician', 'technician@gmail.com')

    expect(normaliseRole(technician)).toBe('technician')
    expect(isAllowedRedirect('/technician', 'technician')).toBe(true)

    expect(normaliseRole(externalTech)).toBe('member')
    expect(isAllowedRedirect('/technician', 'member')).toBe(false)
  })

  it('allows nested paths within the permitted areas', () => {
    expect(isAllowedRedirect('/stats/detail', 'manager')).toBe(true)
    expect(isAllowedRedirect('/admin/settings', 'council')).toBe(true)
    expect(isAllowedRedirect('/admin/settings', 'manager')).toBe(false)
  })

  it('only defines the expected allowed paths for each role', () => {
    expect(ROLE_ALLOWED_PATHS.member).toEqual(['/home', '/redeem'])
    expect(ROLE_ALLOWED_PATHS.manager).toContain('/stats')
    expect(ROLE_ALLOWED_PATHS.council).toContain('/admin')
  })
})
