'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { MemberData } from '@/types/member';
import Button from '@/ui/components/Button';
import { colors, radii, spacing, typography } from '@/ui/theme';
import useLocale from '@/hooks/useLocale';

interface ProfileDrawerProps {
  member: MemberData | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (member: MemberData | null) => void;
}

interface ProfileFormState {
  full_name: string;
  phone?: string;
  branch_id?: string | null;
}

type SupabaseBranchRecord = {
  id: string;
  name: string | null;
  city?: string | null;
  location?: string | null;
  discount_percentage?: number | null;
  active?: boolean | null;
};

const normalizeBranch = (
  branch: SupabaseBranchRecord | SupabaseBranchRecord[] | null | undefined
): MemberData['branch'] => {
  if (!branch) {
    return null;
  }

  const record = Array.isArray(branch) ? branch[0] ?? null : branch;
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    name: record.name ?? null,
    city: record.city ?? null,
    location: record.location ?? null,
    discount_percentage: record.discount_percentage ?? null,
    active: record.active ?? null,
  };
};

export default function ProfileDrawer({ member, open, onClose, onUpdated }: ProfileDrawerProps) {
  const { t } = useLocale();
  const [form, setForm] = useState<ProfileFormState>({
    full_name: member?.full_name ?? '',
    phone: member?.phone ?? '',
    branch_id: member?.branch_id ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const canEditProfile = Boolean(member && member.origin !== 'demo' && member.email);

  useEffect(() => {
    setForm({
      full_name: member?.full_name ?? '',
      phone: member?.phone ?? '',
      branch_id: member?.branch_id ?? null,
    });
    setError(null);
    setSuccess(false);
  }, [member, open]);

  const handleSave = async () => {
    if (!canEditProfile || !member?.email) {
      return;
    }

    setSaving(true);
    setError(null);

    const { data, error: updateError } = await supabase
      .from('memberships')
      .update({
        full_name: form.full_name.trim() || null,
        phone: form.phone?.trim() || null,
        branch_id: form.branch_id ?? null,
      })
      .eq('email', member.email)
      .select(
        `user_id, membership_active, membership_expires, full_name, role, branch_id, email, approved, approved_at,
         phone, branch:branch_id (id, name, city, location, discount_percentage, active)`
      )
      .single();

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    onUpdated({
      ...member,
      full_name: data?.full_name ?? member.full_name,
      branch_id: data?.branch_id ?? member.branch_id,
      branch: normalizeBranch(data?.branch) ?? member.branch,
      phone: data?.phone ?? member.phone,
    });
  };

  return (
    <aside
      aria-hidden={!open}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: open ? 'auto' : 'none',
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: open ? 'rgba(15, 23, 42, 0.4)' : 'transparent',
        transition: 'background-color 0.2s ease-in-out',
        zIndex: 70,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-drawer-title"
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '100%',
          backgroundColor: colors.background,
          borderTopLeftRadius: radii.lg,
          borderBottomLeftRadius: radii.lg,
          padding: spacing.xl,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.lg,
          boxShadow: '0 0 40px rgba(15, 23, 42, 0.16)',
        }}
      >
        <div>
          <h2 id="profile-drawer-title" style={{ fontFamily: typography.heading, marginBottom: spacing.sm }}>
            {t('home.profileTitle')}
          </h2>
          <p style={{ color: colors.textSecondary, margin: 0, fontFamily: typography.body }}>
            {member?.email}
          </p>
        </div>

        {!canEditProfile && (
          <p style={{ color: colors.textSecondary, fontFamily: typography.body }}>
            {t('home.profileReadOnlyNotice')}
          </p>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('home.manageProfile')}</span>
          <input
            type="text"
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
            style={{
              padding: spacing.sm,
              borderRadius: radii.md,
              border: `1px solid ${colors.border}`,
              fontFamily: typography.body,
            }}
            placeholder={t('home.manageProfile')}
            disabled={!canEditProfile}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('home.phone')}</span>
          <input
            type="tel"
            value={form.phone ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            style={{
              padding: spacing.sm,
              borderRadius: radii.md,
              border: `1px solid ${colors.border}`,
              fontFamily: typography.body,
            }}
            placeholder="+420..."
            disabled={!canEditProfile}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('home.branchPreference')}</span>
          <input
            type="text"
            value={form.branch_id ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, branch_id: event.target.value }))}
            style={{
              padding: spacing.sm,
              borderRadius: radii.md,
              border: `1px solid ${colors.border}`,
              fontFamily: typography.body,
            }}
            placeholder={member?.branch?.name ?? ''}
            disabled={!canEditProfile}
          />
        </label>

        {error && (
          <p role="alert" style={{ color: colors.danger, fontFamily: typography.body }}>
            {error}
          </p>
        )}
        {success && (
          <p role="status" style={{ color: colors.accent, fontFamily: typography.body }}>
            {t('home.successProfile')}
          </p>
        )}

        <div style={{ display: 'flex', gap: spacing.sm, marginTop: 'auto' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving} style={{ flex: 1 }}>
            {t('home.close')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !canEditProfile} style={{ flex: 1 }}>
            {saving ? t('home.saving') : t('home.saveProfile')}
          </Button>
        </div>
      </div>
    </aside>
  );
}
