// =============================================================================
// TOKEN LOGIC TESTS
// =============================================================================
// These tests verify the business rules for tokens:
//   - 3-minute expiry
//   - Countdown display
//   - Code format validation
//
// WHY UNIT TEST THIS?
// The token countdown and expiry logic is pure math — no UI, no database.
// Pure functions are the easiest and most valuable things to test because
// they always produce the same output for the same input.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { getTokenCountdown, formatCountdown, isValidTokenCode, generateTokenCode } from '@/lib/tokens'
import type { TokenCountdown } from '@/types'

// -----------------------------------------------------------------------------
// TESTS
// describe() groups related tests. it() is a single test case.
// expect() asserts that a value matches what you expect.
// -----------------------------------------------------------------------------

describe('getTokenCountdown', () => {
  it('returns isExpired=true when token is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString() // 1 second ago
    const result = getTokenCountdown(past)
    expect(result.isExpired).toBe(true)
    expect(result.minutes).toBe(0)
    expect(result.seconds).toBe(0)
    expect(result.percentLeft).toBe(0)
  })

  it('returns isExpired=false and correct time when token is in the future', () => {
    const future = new Date(Date.now() + 90_000).toISOString() // 90 seconds = 1min 30sec
    const result = getTokenCountdown(future)
    expect(result.isExpired).toBe(false)
    expect(result.minutes).toBe(1)
    expect(result.seconds).toBeGreaterThanOrEqual(28) // slight timing tolerance
    expect(result.seconds).toBeLessThanOrEqual(30)
  })

  it('returns 100% when freshly created (3 minutes left)', () => {
    const future = new Date(Date.now() + 3 * 60 * 1000).toISOString()
    const result = getTokenCountdown(future)
    expect(result.percentLeft).toBe(100)
  })

  it('returns ~50% when halfway through 3 minutes', () => {
    const future = new Date(Date.now() + 90_000).toISOString() // 1.5 min left of 3 min
    const result = getTokenCountdown(future)
    expect(result.percentLeft).toBeGreaterThanOrEqual(48)
    expect(result.percentLeft).toBeLessThanOrEqual(52)
  })
})

describe('formatCountdown', () => {
  it('formats as "VYPRŠEL" when expired', () => {
    const expired: TokenCountdown = { minutes: 0, seconds: 0, isExpired: true, percentLeft: 0 }
    expect(formatCountdown(expired)).toBe('VYPRŠEL')
  })

  it('pads seconds with leading zero', () => {
    const countdown: TokenCountdown = { minutes: 2, seconds: 5, isExpired: false, percentLeft: 80 }
    expect(formatCountdown(countdown)).toBe('2:05')
  })

  it('formats correctly without padding when seconds >= 10', () => {
    const countdown: TokenCountdown = { minutes: 1, seconds: 45, isExpired: false, percentLeft: 60 }
    expect(formatCountdown(countdown)).toBe('1:45')
  })
})

describe('isValidTokenCode', () => {
  it('accepts a valid code', () => {
    expect(isValidTokenCode('PSYCH-A7B2C3')).toBe(true)
  })

  it('rejects lowercase letters', () => {
    expect(isValidTokenCode('PSYCH-a7b2c3')).toBe(false)
  })

  it('rejects wrong prefix', () => {
    expect(isValidTokenCode('PSYCHO-A7B2C3')).toBe(false)
    expect(isValidTokenCode('psych-A7B2C3')).toBe(false)
  })

  it('rejects wrong length', () => {
    expect(isValidTokenCode('PSYCH-A7B2')).toBe(false)   // too short
    expect(isValidTokenCode('PSYCH-A7B2C3D4')).toBe(false) // too long
  })
})

describe('generateTokenCode', () => {
  it('generates a valid code', () => {
    const code = generateTokenCode()
    expect(isValidTokenCode(code)).toBe(true)
  })

  it('generates different codes each time', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateTokenCode()))
    // 20 random codes should all be unique
    expect(codes.size).toBe(20)
  })

  it('never uses confusable characters (0, 1, I, O)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateTokenCode()
      expect(code).not.toMatch(/[01IO]/)
    }
  })
})
