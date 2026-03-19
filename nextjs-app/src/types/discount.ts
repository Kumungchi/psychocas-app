// Types for partners, discounts, tokens, and validation
// These mirror the Supabase tables: partners, discounts, tokens, redemptions

export type PartnerCategory = 'cafe' | 'shop' | 'event' | 'service' | 'other';

export type TokenStatus = 'valid' | 'expired' | 'redeemed' | 'invalid';

export interface Partner {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  category: PartnerCategory;
  website: string | null;
  instagram: string | null;
  address: string | null;
  branch_id: string | null; // NULL = national, string = local
  is_active: boolean;
  created_at: string;
}

export interface Discount {
  id: string;
  partner_id: string;
  title: string;
  description: string | null;
  discount_value: string;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface DiscountWithPartner extends Discount {
  partner: Partner;
}

export interface ValidateTokenResponse {
  status: TokenStatus;
  member_name: string | null;
  discount_title: string | null;
  discount_value: string | null;
  partner_name: string | null;
  membership_expires_at: string | null;
  redeemed_at: string | null;
}

export type AuditAction = 'insert' | 'update' | 'delete' | 'activate' | 'deactivate';
export type AuditEntity = 'partner' | 'discount';

export interface AuditLogRow {
  id: string;
  action: AuditAction;
  entity_type: AuditEntity;
  entity_name: string | null;
  created_at: string;
  actor: { full_name: string } | null;
}
