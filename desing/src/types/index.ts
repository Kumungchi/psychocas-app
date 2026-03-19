// =============================================================================
// PSYCHOČAS APP — TYPE DEFINITIONS
// =============================================================================
// These types mirror the Supabase database schema exactly.
// If you add a column to the DB, add it here too.
// TypeScript will then warn you everywhere that column is used if something is wrong.

// -----------------------------------------------------------------------------
// DATABASE ENUMS
// A "union type" in TypeScript is like an enum — it's a fixed set of allowed values.
// -----------------------------------------------------------------------------

export type UserRole = 'member' | 'manager' | 'board' | 'technician'

export type PartnerCategory = 'cafe' | 'shop' | 'event' | 'service' | 'other'

export type TokenStatus = 'valid' | 'expired' | 'redeemed' | 'invalid'

// -----------------------------------------------------------------------------
// DATABASE ROW TYPES
// Each type here = one row in the corresponding Supabase table.
// "null" means the field is optional in the DB (can be NULL).
// -----------------------------------------------------------------------------

export interface Branch {
  id: string
  name: string
  city: string
  created_at: string
}

// member_whitelist — the pre-approved list imported from your Excel
export interface MemberWhitelist {
  id: string
  email: string
  full_name: string
  branch_id: string
  membership_expires_at: string   // ISO date string e.g. "2025-06-15"
  is_active: boolean
  notes: string | null
  created_at: string
}

// members — created automatically on first login, linked to auth.users
export interface Member {
  id: string
  user_id: string                 // Supabase Auth user ID
  whitelist_id: string
  full_name: string
  email: string
  branch_id: string
  role: UserRole
  created_at: string
}

// Partner — a shop, café, event, or service offering a discount
export interface Partner {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  category: PartnerCategory
  website: string | null
  instagram: string | null
  address: string | null
  branch_id: string | null        // NULL = national discount, string = local to that branch
  is_active: boolean
  created_at: string
}

// Discount — a specific offer from a partner
// e.g. Partner: "Café Molo", Discount: "15 % na všechny nápoje"
export interface Discount {
  id: string
  partner_id: string
  title: string                   // e.g. "15 % sleva na všechny nápoje"
  description: string | null
  discount_value: string          // flexible text: "15 %", "2+1", "zdarma káva"
  valid_from: string | null       // ISO date, null = no start restriction
  valid_until: string | null      // ISO date, null = no end date
  is_active: boolean
  created_by: string              // member ID of manager who created it
  created_at: string
}

// Token — generated when a member wants to use a specific discount
// Lives for 3 minutes, single-use
export interface Token {
  id: string
  member_id: string
  discount_id: string
  token_hash: string              // long UUID — used in the public validation URL
  code: string                    // short: "PSYCH-A7B2" — backup for manual entry
  expires_at: string              // ISO datetime, 3 minutes after created_at
  redeemed_at: string | null      // null = not yet used
  created_at: string
}

// Redemption — created when a token is successfully scanned
// This is our analytics data
export interface Redemption {
  id: string
  token_id: string
  discount_id: string             // denormalized for fast queries
  partner_id: string              // denormalized for fast queries
  member_id: string
  branch_id: string
  redeemed_at: string
}

// -----------------------------------------------------------------------------
// JOINED/ENRICHED TYPES
// These are what we actually use in the UI — the DB row with related data
// joined in a single query (Supabase supports this with select())
// -----------------------------------------------------------------------------

// Discount with its partner data included — used in the discount list
export interface DiscountWithPartner extends Discount {
  partner: Partner
}

// Token with its discount and partner — used on the QR screen
export interface TokenWithDiscount extends Token {
  discount: DiscountWithPartner
}

// Redemption with full context — used in analytics/stats
export interface RedemptionWithContext extends Redemption {
  discount: Discount
  partner: Partner
}

// -----------------------------------------------------------------------------
// AUTH TYPES
// What we store in the AuthContext (React's global auth state)
// -----------------------------------------------------------------------------

// The currently logged-in user — combines Supabase Auth + our members table
export interface AuthUser {
  id: string                      // members.id
  user_id: string                 // auth.users.id
  email: string
  full_name: string
  role: UserRole
  branch_id: string
  membership_expires_at: string
  is_membership_active: boolean   // computed: expires_at > now AND whitelist.is_active
}

// What the AuthContext provides to the whole app
export interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string) => Promise<{ error: string | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

// -----------------------------------------------------------------------------
// API RESPONSE TYPES
// Used by Supabase Edge Functions
// -----------------------------------------------------------------------------

// POST /functions/v1/generate_token
export interface GenerateTokenRequest {
  discount_id: string
}

export interface GenerateTokenResponse {
  token: Token
  validation_url: string          // the full URL for the QR code
}

// GET /v/:tokenHash (public validation page)
export interface ValidateTokenResponse {
  status: TokenStatus
  member_name: string | null      // shown on validation page
  discount_title: string | null
  discount_value: string | null
  partner_name: string | null
  membership_expires_at: string | null
  redeemed_at: string | null      // if already redeemed, show when
}

// -----------------------------------------------------------------------------
// UI STATE TYPES
// These are not from the DB — they're used inside components
// -----------------------------------------------------------------------------

export interface TokenCountdown {
  minutes: number
  seconds: number
  isExpired: boolean
  percentLeft: number             // 0–100, for a visual progress ring
}

// Stats query filters
export interface StatsFilter {
  period: 'day' | 'week' | 'month'
  branch_id: string | null        // null = show all branches (board only)
}
