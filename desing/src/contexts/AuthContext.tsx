import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthContextType, AuthUser, UserRole } from '@/types'
import { toast } from 'sonner'

// -----------------------------------------------------------------------------
// WHY A CONTEXT?
// React Context is a way to share data across the whole app without passing it
// as props through every component. Think of it as a global variable that any
// component can read, but changes to it cause the right components to re-render.
// -----------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | null>(null)

// Custom hook — instead of writing useContext(AuthContext) everywhere,
// components call useAuth() which is shorter and throws a helpful error
// if used outside the Provider.
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}

// Fetches the member profile from our `members` table for the given Supabase user.
// If the member hasn't logged in before, we create their profile from the whitelist.
async function getOrCreateMemberProfile(userId: string, email: string): Promise<AuthUser | null> {
  // First, try to find an existing member profile
  const { data: member } = await supabase
    .from('members')
    .select('*, whitelist:member_whitelist(membership_expires_at, is_active)')
    .eq('user_id', userId)
    .single()

  if (member) {
    const whitelist = member.whitelist as { membership_expires_at: string; is_active: boolean } | null
    return {
      id: member.id,
      user_id: member.user_id,
      email: member.email,
      full_name: member.full_name,
      role: member.role as UserRole,
      branch_id: member.branch_id,
      membership_expires_at: whitelist?.membership_expires_at ?? '',
      is_membership_active:
        (whitelist?.is_active ?? false) &&
        new Date(whitelist?.membership_expires_at ?? 0) > new Date(),
    }
  }

  // Member profile doesn't exist yet — this is their first login.
  // Look them up in the whitelist by email.
  const { data: whitelistEntry } = await supabase
    .from('member_whitelist')
    .select('*')
    .eq('email', email)
    .eq('is_active', true)
    .single()

  if (!whitelistEntry) {
    // Email is not whitelisted — this shouldn't happen (we check before OTP),
    // but if it does, sign them out
    await supabase.auth.signOut()
    return null
  }

  // Create their member profile
  const { data: newMember, error: insertError } = await supabase
    .from('members')
    .insert({
      user_id: userId,
      whitelist_id: whitelistEntry.id,
      full_name: whitelistEntry.full_name,
      email: whitelistEntry.email,
      branch_id: whitelistEntry.branch_id,
      role: 'member', // everyone starts as member; managers are upgraded manually
    })
    .select()
    .single()

  if (insertError || !newMember) return null

  return {
    id: newMember.id,
    user_id: newMember.user_id,
    email: newMember.email,
    full_name: newMember.full_name,
    role: newMember.role as UserRole,
    branch_id: newMember.branch_id,
    membership_expires_at: whitelistEntry.membership_expires_at,
    is_membership_active:
      whitelistEntry.is_active &&
      new Date(whitelistEntry.membership_expires_at) > new Date(),
  }
}

// -----------------------------------------------------------------------------
// AUTH PROVIDER
// Wrap your entire app in this so every component has access to auth state.
// -----------------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const hadSessionRef = useRef(false)
  const manualSignOutRef = useRef(false)

  useEffect(() => {
    // On app load, check if there's already an active session
    // (user previously logged in and session is still valid)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await getOrCreateMemberProfile(session.user.id, session.user.email ?? '')
        setUser(profile)
        hadSessionRef.current = true
      }
      setLoading(false)
    })

    // Listen for auth changes: login, logout, token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await getOrCreateMemberProfile(session.user.id, session.user.email ?? '')
        setUser(profile)
        hadSessionRef.current = true
      } else if (event === 'SIGNED_OUT') {
        const shouldShowExpiredSessionToast = hadSessionRef.current && !manualSignOutRef.current
        setUser(null)
        hadSessionRef.current = false
        manualSignOutRef.current = false

        if (shouldShowExpiredSessionToast) {
          toast.error('Relace vypršela. Přihlaste se prosím znovu.')
        }
      }
    })

    // Cleanup: stop listening when the component unmounts
    return () => subscription.unsubscribe()
  }, [])

  // STEP 1 of login: send OTP
  // Before sending, we check the whitelist so non-members get a clear error
  async function validateWhitelistEmail(email: string): Promise<{ normalizedEmail: string; error: string | null }> {
    const normalizedEmail = email.toLowerCase().trim()

    const { data: whitelistEntry } = await supabase
      .from('member_whitelist')
      .select('id, is_active')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (!whitelistEntry) {
      return { normalizedEmail, error: 'Váš email není registrován. Kontaktujte správce Psychočas.' }
    }
    if (!whitelistEntry.is_active) {
      return { normalizedEmail, error: 'Váš účet byl deaktivován. Kontaktujte správce Psychočas.' }
    }

    return { normalizedEmail, error: null }
  }

  async function signIn(email: string): Promise<{ error: string | null }> {
    const { normalizedEmail, error: whitelistError } = await validateWhitelistEmail(email)
    if (whitelistError) {
      return { error: whitelistError }
    }

    // Email is whitelisted — send the 6-digit OTP
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        // Allow creating auth.users rows only for approved whitelist emails.
        shouldCreateUser: true,
      },
    })

    if (error) return { error: 'Nepodařilo se odeslat kód. Zkuste to znovu.' }
    return { error: null }
  }

  // STEP 2 of login: verify the 6-digit code
  async function verifyOtp(email: string, token: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token,
      type: 'email',
    })

    if (error) return { error: 'Neplatný nebo vypršelý kód. Zkuste to znovu.' }
    return { error: null }
  }

  async function signOut(): Promise<void> {
    manualSignOutRef.current = true
    await supabase.auth.signOut()
    setUser(null)
    hadSessionRef.current = false
    manualSignOutRef.current = false
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, verifyOtp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
