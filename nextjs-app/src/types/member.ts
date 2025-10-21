export type MemberRole = 'member' | 'manager' | 'council' | 'technician' | 'admin';

export interface BranchInfo {
  id: string;
  name: string | null;
  location?: string | null;
  city?: string | null;
  discount_percentage?: number | null;
  active?: boolean | null;
}

export interface MembershipRow {
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
  origin?: 'memberships' | 'demo';
}

export interface TokenData {
  code: string;
  expiresAt: string;
}
