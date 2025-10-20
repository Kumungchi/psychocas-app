'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle, XCircle } from 'lucide-react';
import Navigation from '@/components/Navigation';
import useMemberContext from '@/hooks/useMemberContext';
import { logError } from '@/lib/logging';
import useLocale from '@/hooks/useLocale';

export default function Validate() {
  const [inputCode, setInputCode] = useState('');
  const [validationResult, setValidationResult] = useState<'success' | 'error' | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidatedCode, setLastValidatedCode] = useState('');
  const [resultMessage, setResultMessage] = useState<
    | {
        translationKey?: string;
        text?: string;
        params?: Record<string, string | number>;
      }
    | null
  >(null);
  const router = useRouter();
  const { t, formatMessage } = useLocale();

  const { member, status: memberStatus } = useMemberContext({
    scope: 'validate',
    onUnauthorized: () => router.replace('/login'),
  });

  const isMemberLoading = memberStatus === 'idle' || memberStatus === 'loading';
  const hasAccess = member?.role === 'manager' || member?.role === 'council';

  useEffect(() => {
    if (memberStatus === 'ready' && !hasAccess) {
      router.replace('/home?error=unauthorized');
    }
  }, [hasAccess, memberStatus, router]);

  const validateCode = async (code: string) => {
    setIsValidating(true);
    setLastValidatedCode(code);
    setValidationResult(null);
    setResultMessage(null);

    try {
      if (!hasAccess) {
        setValidationResult('error');
        setResultMessage({ translationKey: 'validate.resultMessage.forbidden' });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/redeem_token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: code.trim().toUpperCase() }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setValidationResult('success');
        if (data.memberName) {
          setResultMessage({ translationKey: 'validate.resultMessage.successWithMember', params: { member: data.memberName } });
        } else {
          setResultMessage({ translationKey: 'validate.resultMessage.success' });
        }
        setInputCode(''); // Clear input on success
      } else {
        setValidationResult('error');
        if (data.error) {
          setResultMessage({ text: data.error });
        } else {
          setResultMessage({ translationKey: 'validate.resultMessage.invalid' });
        }
      }

    } catch (error) {
      logError('validate', 'Error validating code.', error);
      setValidationResult('error');
      setResultMessage({ translationKey: 'validate.resultMessage.unexpected' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleManualValidation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAccess || !inputCode.trim()) {
      return;
    }
    void validateCode(inputCode);
  };

  const simulateQrScan = () => {
    if (!hasAccess) {
      return;
    }
    // In production, this would trigger camera/QR scanner
    const mockCode = 'PSYCHO24-DEMO';
    setInputCode(mockCode);
    void validateCode(mockCode);
  };

  if (isMemberLoading) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container space-y-6 fade-in-up">
          <div className="psychocas-card text-center mt-10">
            <h1 className="text-2xl font-semibold mb-3">{t('validate.loadingTitle')}</h1>
            <p className="text-sm text-gray-600">{t('validate.loadingDescription')}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isMemberLoading && memberStatus === 'error' && !member) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container space-y-6 fade-in-up">
          <div className="psychocas-card text-center mt-10">
            <h1 className="text-2xl font-semibold mb-3">{t('validate.loadErrorTitle')}</h1>
            <p className="text-sm text-gray-600">{t('validate.loadErrorDescription')}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isMemberLoading && !hasAccess) {
    return (
      <main className="psychocas-section pb-20">
        <div className="psychocas-container space-y-6 fade-in-up">
          <div className="psychocas-card text-center mt-10">
            <h1 className="text-2xl font-semibold mb-3">{t('validate.accessDeniedTitle')}</h1>
            <p className="text-sm text-gray-600">{t('validate.accessDeniedDescription')}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="psychocas-section pb-20">
      <div className="psychocas-container space-y-6 fade-in-up">
        {/* Header */}
        <div className="text-center pt-6">
          <h1 className="mb-3">{t('validate.heading')}</h1>
          <p style={{ color: '#666666' }}>{t('validate.headerDescription')}</p>
        </div>

        {/* QR Scanner Section */}
        <div className="psychocas-card">
          <div className="text-center mb-6">
            <h3 style={{ color: '#333333' }}>{t('validate.scanHeading')}</h3>
          </div>

          <div
            className="aspect-square max-w-64 mx-auto border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-all duration-300"
            style={{ borderColor: '#049edb' }}
            onClick={simulateQrScan}
          >
            <div className="text-center space-y-3">
              <Camera className="w-20 h-20 mx-auto" style={{ color: '#049edb' }} />
              <p style={{ color: '#666666' }}>{t('validate.simulateHint')}</p>
            </div>
          </div>
        </div>

        {/* Manual Input Section */}
        <div className="psychocas-card">
          <form onSubmit={handleManualValidation} className="space-y-6">
            <div className="text-center">
              <h3 style={{ color: '#333333', marginBottom: '1rem' }}>{t('validate.manualHeading')}</h3>
            </div>

            <div className="space-y-3 text-left">
              <label htmlFor="code-input" style={{ color: '#333333' }}>
                {t('validate.codeLabel')}
              </label>
              <input
                id="code-input"
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                className="psychocas-input text-center text-lg tracking-wider font-mono"
                placeholder={t('validate.placeholder')}
                disabled={isValidating}
                style={{ fontFamily: 'SF Mono, Monaco, monospace' }}
              />
            </div>

            <button
              type="submit"
              className="psychocas-button-primary"
              disabled={isValidating || !inputCode.trim() || !hasAccess}
            >
              {isValidating ? t('validate.submitProcessing') : t('validate.submitDefault')}
            </button>
        </form>
      </div>

        {/* Validation Result */}
        {validationResult && resultMessage && (
          <div className={`psychocas-card ${
            validationResult === 'success' ? 'status-active' : 'status-inactive'
          }`}>
            <div className="text-center space-y-4">
              {validationResult === 'success' ? (
                <CheckCircle className="w-16 h-16 mx-auto" style={{ color: '#2e7d32' }} />
              ) : (
                <XCircle className="w-16 h-16 mx-auto" style={{ color: '#c62828' }} />
              )}

              <div>
                <h3 className="mb-2" style={{
                  color: validationResult === 'success' ? '#2e7d32' : '#c62828'
                }}>
                  {validationResult === 'success'
                    ? t('validate.resultSuccessTitle')
                    : t('validate.resultErrorTitle')}
                </h3>
                <p className="text-sm" style={{
                  color: validationResult === 'success' ? '#2e7d32' : '#c62828'
                }}>
                  {resultMessage.translationKey
                    ? resultMessage.params
                      ? formatMessage(resultMessage.translationKey, resultMessage.params)
                      : t(resultMessage.translationKey)
                    : resultMessage.text}
                </p>
                <p className="text-sm mt-3" style={{ color: '#666666' }}>
                  {t('validate.resultCodeLabel')}: <strong>{lastValidatedCode}</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="psychocas-card" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffe082' }}>
          <h4 className="mb-2" style={{ color: '#f57c00' }}>{t('validate.instructionsCardTitle')}</h4>
          <ul className="space-y-2 text-sm" style={{ color: '#f57c00' }}>
            <li>{t('validate.instructionsPoints.validity')}</li>
            <li>{t('validate.instructionsPoints.singleUse')}</li>
            <li>{t('validate.instructionsPoints.afterUse')}</li>
          </ul>
        </div>
      </div>

      {/* Navigation Bar */}
      <Navigation userRole={member?.role ?? 'member'} />
    </main>
  );
}