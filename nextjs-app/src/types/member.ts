export type MemberRole = 'member' | 'manager' | 'council' | 'technician';

export interface BranchInfo {
  id: string;
  name: string;
  location?: string | null;
  city?: string | null;
  discount_percentage?: number | null;
  active?: boolean | null;
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
  branch?: BranchInfo | null;
}

export interface TokenData {
  code: string;
  expiresAt: string;
}
