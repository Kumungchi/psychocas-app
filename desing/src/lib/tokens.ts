import type { TokenCountdown } from '@/types'

// Calculates how much time is left on a token
export function getTokenCountdown(expiresAt: string): TokenCountdown {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()

  if (diffMs <= 0) {
    return { minutes: 0, seconds: 0, isExpired: true, percentLeft: 0 }
  }

  const totalSeconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const percentLeft = Math.round((diffMs / (3 * 60 * 1000)) * 100) // 3 min = 100%

  return { minutes, seconds, isExpired: false, percentLeft: Math.min(percentLeft, 100) }
}

// Formats countdown as "2:45" or "VYPRŠEL" when expired
export function formatCountdown(countdown: TokenCountdown): string {
  if (countdown.isExpired) return 'VYPRŠEL'
  return `${countdown.minutes}:${String(countdown.seconds).padStart(2, '0')}`
}

// Validates a short token code format: "PSYCH-XXXXXX" (6 alphanumeric chars after dash)
export function isValidTokenCode(code: string): boolean {
  return /^PSYCH-[A-Z0-9]{6}$/.test(code)
}

// Generates a random short code — excludes confusable chars (0, 1, I, O)
export function generateTokenCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'PSYCH-'
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
