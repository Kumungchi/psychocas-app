'use client';

import { useEffect, useMemo, useState } from 'react';
import SupabaseHealthCheck from '@/components/SupabaseHealthCheck';
import {
  clearRolePreview,
  isRolePreviewEnabled,
  readRolePreview,
  subscribeToRolePreview,
  writeRolePreview,
  type RolePreviewState,
} from '@/lib/demo/rolePreview';
import type { MemberRole } from '@/types/member';
import { colors, radii, spacing } from '@/ui/theme';

interface RoleOption {
  role: MemberRole;
  label: string;
  description: string;
  branchId?: string | null;
  branchName?: string | null;
}

const roleOptions: RoleOption[] = [
  {
    role: 'member',
    label: 'Member',
    description: 'View the standard membership dashboard without management tools.',
  },
  {
    role: 'manager',
    label: 'Manager',
    description: 'Preview the branch management, validation, and statistics experience.',
    branchId: 'demo-branch',
    branchName: 'Demo Branch',
  },
  {
    role: 'technician',
    label: 'Technician',
    description: 'Inspect the technician console for membership administration.',
  },
  {
    role: 'council',
    label: 'Council',
    description: 'Review the council tools including global statistics and partner management.',
  },
];

const panelStyles = {
  border: `1px solid ${colors.border}`,
  borderRadius: radii.lg,
  backgroundColor: colors.background,
  padding: spacing.xl,
};

export default function TestPage() {
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewState, setPreviewState] = useState<RolePreviewState>({
    role: null,
    branchId: null,
    branchName: null,
    fullName: null,
    email: null,
  });

  useEffect(() => {
    const enabled = isRolePreviewEnabled();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from external store on mount
    setPreviewEnabled(enabled);
    if (!enabled) {
      return;
    }

     
    setPreviewState(readRolePreview());
    const unsubscribe = subscribeToRolePreview((state) => {
      setPreviewState(state);
    });

    return unsubscribe;
  }, []);

  const activeRole = useMemo(() => previewState.role ?? null, [previewState.role]);

  const handleSelect = (option: RoleOption) => {
    writeRolePreview({
      role: option.role,
      branchId: option.branchId ?? null,
      branchName: option.branchName ?? null,
      fullName: `${option.label} Demo`,
      email: `${option.role}@demo.psychocas.cz`,
    });
  };

  const handleClear = () => {
    clearRolePreview();
    setPreviewState({
      role: null,
      branchId: null,
      branchName: null,
      fullName: null,
      email: null,
    });
  };

  return (
    <main className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div style={{ textAlign: 'center' }}>
          <h1 className="text-3xl font-bold mb-4" style={{ color: colors.textPrimary }}>
            🩺 Supabase Health Check
          </h1>
          <p style={{ color: colors.textSecondary }}>
            Validate your environment configuration and preview application roles from a single sandbox page.
          </p>
        </div>

        <SupabaseHealthCheck />

        {previewEnabled ? (
          <section style={panelStyles} className="space-y-4">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                🎭 Role preview sandbox
              </h2>
              <p style={{ color: colors.textSecondary }}>
                Select a demo role to explore the navigation, management pages, and access states without sending magic links.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              {roleOptions.map((option) => {
                const isActive = activeRole === option.role;
                return (
                  <button
                    key={option.role}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className="text-left transition-transform focus-visible:outline-none focus-visible:ring"
                    style={{
                      border: `1px solid ${isActive ? colors.brandPrimary : colors.border}`,
                      borderRadius: radii.md,
                      background: isActive ? colors.brandSurface : colors.background,
                      color: colors.textPrimary,
                      padding: spacing.lg,
                      boxShadow: isActive ? '0 8px 16px rgba(124, 58, 237, 0.12)' : 'none',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{option.label}</span>
                          {isActive && <span className="text-sm" style={{ color: colors.brandOnSurface }}>Active</span>}
                        </div>
                        <p className="text-sm" style={{ color: colors.textSecondary }}>
                          {option.description}
                        </p>
                      </div>
                      <span aria-hidden className="text-xl">{isActive ? '✅' : '👉'}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                  Current preview:{' '}
                  <span style={{ color: colors.brandPrimary }}>
                    {activeRole ? `${activeRole} (${previewState.branchName ?? 'all branches'})` : 'disabled'}
                  </span>
                </p>
                <p className="text-xs" style={{ color: colors.textSecondary }}>
                  Clear the preview to return to live authentication behaviour.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  border: `1px solid ${colors.brandPrimary}`,
                  borderRadius: radii.full,
                  color: colors.brandPrimary,
                  backgroundColor: 'transparent',
                }}
              >
                Reset preview
              </button>
            </div>

            <p className="text-xs" style={{ color: colors.textSecondary }}>
              The demo role is stored only in your browser&apos;s local storage and is ignored entirely when the preview feature flag is disabled.
            </p>
          </section>
        ) : (
          <section style={panelStyles} className="space-y-3">
            <h2 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
              Role preview disabled
            </h2>
            <p style={{ color: colors.textSecondary }}>
              Set <code className="px-1 py-0.5 rounded" style={{ backgroundColor: colors.backgroundMuted }}>NEXT_PUBLIC_ENABLE_ROLE_PREVIEW=true</code> to enable the demo role switcher.
            </p>
          </section>
        )}

        <div className="bg-gray-50 p-6 rounded-lg border" style={{ borderColor: colors.border }}>
          <h3 className="font-semibold text-gray-800 mb-4">📁 SQL skripty pro setup</h3>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between items-center">
              <code className="bg-white px-2 py-1 rounded">sql/01_schema.sql</code>
              <span className="text-gray-600">Základní tabulky</span>
            </div>
            <div className="flex justify-between items-center">
              <code className="bg-white px-2 py-1 rounded">sql/02_rls_policies.sql</code>
              <span className="text-gray-600">RLS pravidla</span>
            </div>
            <div className="flex justify-between items-center">
              <code className="bg-white px-2 py-1 rounded">sql/03_triggers.sql</code>
              <span className="text-gray-600">Anti-spam triggery</span>
            </div>
            <div className="flex justify-between items-center">
              <code className="bg-white px-2 py-1 rounded">sql/04_views.sql</code>
              <span className="text-gray-600">Pohledy pro statistiky</span>
            </div>
            <div className="flex justify-between items-center">
              <code className="bg-white px-2 py-1 rounded">sql/05_test_data.sql</code>
              <span className="text-gray-600">Testovací data</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}