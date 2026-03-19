'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import useLocale from '@/hooks/useLocale';
import PsychocasLogo from '@/components/PsychocasLogo';
import type { ValidateTokenResponse, TokenStatus } from '@/types/discount';
import { CheckCircle, XCircle, Clock, Tag, CalendarDays, User } from 'lucide-react';

const statusConfig: Record<TokenStatus, {
  bg: string; border: string; iconBg: string; iconColor: string;
  headlineKey: string; headlineColor: string;
}> = {
  valid: {
    bg: '#f0fdf4', border: '#bbf7d0',
    iconBg: '#dcfce7', iconColor: '#16a34a',
    headlineKey: 'publicValidation.validHeadline', headlineColor: '#15803d',
  },
  expired: {
    bg: '#fff7ed', border: '#fed7aa',
    iconBg: '#ffedd5', iconColor: '#ea580c',
    headlineKey: 'publicValidation.expiredHeadline', headlineColor: '#c2410c',
  },
  redeemed: {
    bg: '#fefce8', border: '#fde68a',
    iconBg: '#fef9c3', iconColor: '#ca8a04',
    headlineKey: 'publicValidation.redeemedHeadline', headlineColor: '#a16207',
  },
  invalid: {
    bg: '#fff1f2', border: '#fecdd3',
    iconBg: '#ffe4e6', iconColor: '#e11d48',
    headlineKey: 'publicValidation.invalidHeadline', headlineColor: '#be123c',
  },
};

function StatusIcon({ status }: { status: TokenStatus }) {
  const cfg = statusConfig[status];
  const iconProps = { className: 'w-10 h-10', style: { color: cfg.iconColor } };

  return (
    <div
      className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
      style={{ backgroundColor: cfg.iconBg }}
    >
      {status === 'valid' && <CheckCircle {...iconProps} />}
      {status === 'expired' && <Clock {...iconProps} />}
      {status === 'redeemed' && <Clock {...iconProps} />}
      {status === 'invalid' && <XCircle {...iconProps} />}
    </div>
  );
}

export default function PublicValidatePage() {
  const { tokenHash } = useParams<{ tokenHash: string }>();
  const { t } = useLocale();
  const [result, setResult] = useState<ValidateTokenResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenHash) return;
    async function validate() {
      const { data, error } = await supabase.functions.invoke('redeem_token', {
        body: { token_hash: tokenHash },
      });
      if (error || !data) {
        setResult({
          status: 'invalid', member_name: null, discount_title: null,
          discount_value: null, partner_name: null, membership_expires_at: null, redeemed_at: null,
        });
      } else {
        setResult(data as ValidateTokenResponse);
      }
      setLoading(false);
    }
     
    void validate();
  }, [tokenHash]);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#f5f5f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1d4f7d' }} />
        <p className="text-gray-500">{t('publicValidation.verifying')}</p>
      </div>
    );
  }

  const status = result?.status ?? 'invalid';
  const cfg = statusConfig[status];

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      {/* Brand header */}
      <header style={{
        backgroundColor: '#fff', borderBottom: '1px solid #f0f0f0',
        padding: 'clamp(0.75rem, 3vw, 1.25rem) clamp(1rem, 5vw, 1.5rem)',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <PsychocasLogo size={36} />
        <div>
          <p style={{ fontWeight: 600, color: '#1d4f7d', lineHeight: 1.2, fontSize: '0.95rem' }}>Psychočas</p>
          <p style={{ fontSize: '0.75rem', color: '#999' }}>{t('publicValidation.pageTitle')}</p>
        </div>
      </header>

      {/* Main card */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(1rem, 4vw, 1.5rem)' }}>
        <div style={{ width: '100%', maxWidth: '22rem' }}>
          <div
            className="bg-white rounded-2xl shadow-sm text-center space-y-5 p-6"
            style={{ backgroundColor: cfg.bg, borderColor: cfg.border, borderWidth: 2, borderStyle: 'solid' }}
          >
            <StatusIcon status={status} />

            <div>
              <h2 style={{ color: cfg.headlineColor, marginBottom: '0.35rem', fontSize: 'clamp(1.1rem, 5vw, 1.3rem)' }}>
                {t(cfg.headlineKey)}
              </h2>

              {status === 'expired' && (
                <p className="text-gray-500" style={{ fontSize: '0.9rem' }}>{t('publicValidation.expiredNote')}</p>
              )}
              {status === 'redeemed' && result?.redeemed_at && (
                <p className="text-gray-500" style={{ fontSize: '0.9rem' }}>
                  {t('publicValidation.redeemedNote')} {new Date(result.redeemed_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {status === 'invalid' && (
                <p className="text-gray-500" style={{ fontSize: '0.9rem' }}>{t('publicValidation.invalidNote')}</p>
              )}
            </div>

            {status === 'valid' && result && (
              <>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '0.75rem', padding: '0.875rem', textAlign: 'left' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 flex-shrink-0" style={{ color: '#16a34a' }} />
                    <span className="font-semibold text-gray-700" style={{ fontSize: '0.95rem' }}>{result.member_name}</span>
                  </div>
                  {result.membership_expires_at && (
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <span className="text-gray-500" style={{ fontSize: '0.85rem' }}>
                        {t('publicValidation.memberSince')} {new Date(result.membership_expires_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: 'linear-gradient(135deg, #1d4f7d 0%, #049edb 100%)',
                    borderRadius: '0.875rem', padding: '1rem', color: '#fff', textAlign: 'left',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="w-4 h-4" style={{ opacity: 0.8 }} />
                    <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>{result.partner_name}</span>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>{result.discount_title}</p>
                  <p style={{ fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.01em' }}>{result.discount_value}</p>
                </div>
              </>
            )}
          </div>

          <p className="text-center mt-4 text-xs text-gray-400">
            {t('publicValidation.branding')}
          </p>
        </div>
      </main>
    </div>
  );
}
