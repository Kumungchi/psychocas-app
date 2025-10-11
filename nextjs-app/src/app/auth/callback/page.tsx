'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

type SupportedOtpType =
  | 'signup'
  | 'magiclink'
  | 'recovery'
  | 'invite'
  | 'email_change'
  | 'sms'
  | 'phone_change';

const isSupportedOtpType = (value: string | null): value is SupportedOtpType => {
  if (!value) {
    return false;
  }

  return [
    'signup',
    'magiclink',
    'recovery',
    'invite',
    'email_change',
    'sms',
    'phone_change',
  ].includes(value as SupportedOtpType);
};

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('=== Starting auth callback ===');
        console.log('Full URL:', window.location.href);
        
        // Check URL parameters - Supabase uses 'token', not 'token_hash'
        const token = searchParams.get('token');
        const token_hash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        
        console.log('URL params:', { 
          token: token ? token.substring(0, 20) + '...' : null, 
          token_hash: token_hash ? token_hash.substring(0, 20) + '...' : null, 
          type 
        });

        // If we have token in URL params, use verifyOtp
        const authToken = token || token_hash;
        if (authToken && isSupportedOtpType(type)) {
          console.log('Using token from URL params:', authToken.substring(0, 10) + '...');
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: authToken,
            type,
          });

          if (error) {
            console.error('Error verifying OTP:', error);
            setErrorMessage(error.message);
            setStatus('error');
            setTimeout(() => router.push('/login?error=verification_failed'), 3000);
            return;
          }

          if (data.session) {
            console.log('Session created successfully!');
            setStatus('success');
            const redirectTo = searchParams.get('redirectTo') || '/home';
            setTimeout(() => router.replace(redirectTo), 800);
            return;
          }
        } else if (authToken && type) {
          console.warn('Unsupported OTP type received:', type);
        }

        // Check hash fragment for direct tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');

        console.log('Hash params:', { 
          hasAccessToken: !!access_token, 
          hasRefreshToken: !!refresh_token 
        });

        if (access_token && refresh_token) {
          console.log('Setting session from hash tokens');
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            console.error('Error setting session:', error);
            setErrorMessage(error.message);
            setStatus('error');
            setTimeout(() => router.push('/login?error=session_error'), 3000);
            return;
          }

          if (data.session) {
            console.log('Session set successfully!');
            setStatus('success');
            // Clean hash from URL
            window.history.replaceState(null, '', window.location.pathname);
            const redirectTo = searchParams.get('redirectTo') || '/home';
            setTimeout(() => router.replace(redirectTo), 800);
            return;
          }
        }

        // No valid auth data found
        console.error('No valid authentication data found');
        setErrorMessage('Nenalezeny přihlašovací údaje');
        setStatus('error');
        setTimeout(() => router.push('/login?error=no_auth_data'), 3000);

      } catch (error) {
        console.error('Auth callback error:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Neznámá chyba');
        setStatus('error');
        setTimeout(() => router.push('/login?error=callback_failed'), 3000);
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  return (
    <main className="psychocas-section flex items-center justify-center">
      <div className="psychocas-container fade-in-up">
        <div className="psychocas-card text-center">
          {/* Logo at top */}
          <div className="mb-8 flex justify-center">
            <svg width="70" height="70" viewBox="-60 -60 120 120" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="callbackLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#1d4f7d', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#049edb', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <circle cx="0" cy="0" r="55" fill="url(#callbackLogoGradient)" />
              <circle cx="0" cy="0" r="50" fill="none" stroke="white" strokeWidth={6}/>
              <line x1="0" y1="0" x2="-15" y2="-25" stroke="white" strokeWidth={5} strokeLinecap="round"/>
              <line x1="0" y1="0" x2="25" y2="-15" stroke="white" strokeWidth={4} strokeLinecap="round"/>
              <circle cx="0" cy="0" r="6" fill="white"/>
              <circle cx="0" cy="-40" r="4" fill="white"/>
              <circle cx="40" cy="0" r="4" fill="white"/>
              <circle cx="0" cy="40" r="4" fill="white"/>
              <circle cx="-40" cy="0" r="4" fill="white"/>
            </svg>
          </div>

          {status === 'loading' && (
            <>
              <div className="mb-6 flex justify-center">
                <div className="loading-spinner" />
              </div>
              <h1 className="mb-3">Přihlašuji vás...</h1>
              <p className="text-gray-600">
                Prosím čekejte, ověřuji vaši identitu
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mb-6 flex justify-center">
                <div className="success-icon">
                  ✓
                </div>
              </div>
              <h1 className="mb-3 text-green-600">Úspěch!</h1>
              <p className="text-gray-600">
                Přesměrovávám vás do aplikace...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mb-6 flex justify-center">
                <div className="error-icon">
                  ✕
                </div>
              </div>
              <h1 className="mb-3 text-red-600">Chyba přihlášení</h1>
              <p className="text-gray-600">
                {errorMessage || 'Něco se pokazilo. Přesměrovávám zpět na přihlášení...'}
              </p>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-spinner {
          width: 60px;
          height: 60px;
          border: 4px solid #e0e0e0;
          border-top: 4px solid #049edb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .success-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1d4f7d 0%, #049edb 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          color: white;
        }
        
        .error-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #f44336;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          color: white;
        }
      `}</style>
    </main>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <main className="psychocas-section flex items-center justify-center">
        <div className="psychocas-container fade-in-up">
          <div className="psychocas-card text-center">
            <div className="mb-6 flex justify-center">
              <div className="loading-spinner" />
            </div>
            <h1 className="mb-3">Načítám...</h1>
          </div>
        </div>
        <style jsx global>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .loading-spinner {
            width: 60px;
            height: 60px;
            border: 4px solid #e0e0e0;
            border-top: 4px solid #049edb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
        `}</style>
      </main>
    }>
      <CallbackContent />
    </Suspense>
  );
}
