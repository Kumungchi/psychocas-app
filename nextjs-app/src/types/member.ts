export type MemberRole = 'member' | 'manager' | 'council' | 'technician';

export interface BranchInfo {
  id: string;
  name: string;
  location?: string | null;
  city?: string | null;
  discount_percentage?: number | null;
  active?: boolean | null;
}

export interface MemberRow {
  membership_active: boolean;
  membership_expires: string | null;
  full_name: string | null;
  role: string | null;
  branch_id: string | null;
  email?: string | null;
  approved?: boolean | null;
  approved_at?: string | null;
  phone?: string | null;
  branch?: BranchInfo | BranchInfo[] | null;
}

export interface TrustedUserRow {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  branch_id: string | null;
  branch?: BranchInfo | BranchInfo[] | null;
  approved_at?: string | null;
  access_expires_at?: string | null;
  membership_active?: boolean | null;
}

export interface MemberData {
  membership_active: boolean;
  membership_expires: string | null;
  full_name: string | null;
  role: MemberRole;
  branch_id: string | null;
  email?: string | null;
  approved?: boolean | null;
  approved_at?: string | null;
  phone?: string | null;
  branch?: BranchInfo | null;
  origin?: 'members' | 'trusted_users';
  trusted_access_expires_at?: string | null;
}

export interface TokenData {
  code: string;
  expiresAt: string;
}
