'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const requestedRedirect = searchParams.get('redirectTo');
  const sanitizedRedirect = useMemo(() => {
    if (!requestedRedirect) {
      return '/home';
    }

    if (!requestedRedirect.startsWith('/') || requestedRedirect.startsWith('//') || requestedRedirect.includes('://')) {
      return '/home';
    }

    return requestedRedirect;
  }, [requestedRedirect]);

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push(sanitizedRedirect);
      }
    };
    checkUser();
  }, [router, sanitizedRedirect]);

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      callbackUrl.searchParams.set('redirectTo', sanitizedRedirect);
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        setMessage({
          type: 'error',
          text: error.message
        });
      } else {
        setEmailSent(true);
        setMessage({
          type: 'success',
          text: 'Přihlašovací odkaz byl odeslán na váš email.'
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Nastala neočekávaná chyba'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    setEmailSent(false);
    setMessage(null);
  };

  return (
    <main className="psychocas-section flex items-center justify-center">
      <div className="psychocas-container fade-in-up">
        <div className="psychocas-card text-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <svg width="100" height="100" viewBox="-60 -60 120 120" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#1d4f7d', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#049edb', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <circle cx="0" cy="0" r="55" fill="url(#logoGradient)" />
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
          {/* Welcome Section */}
          <div className="mb-12">
            <h1 className="mb-3">
              Vítejte v Psychočas aplikaci
            </h1>
            <p className="text-lg" style={{ color: '#666666' }}>
              {emailSent 
                ? 'Zkontrolujte svůj email' 
                : 'Přihlaste se do vaší členské aplikace'}
            </p>
          </div>

          {/* Email Form - Show when email not sent yet */}
          {!emailSent && (
            <form onSubmit={handleSendMagicLink} className="space-y-8">
              <div className="space-y-3 text-left">
                <label htmlFor="email" style={{ color: '#333333' }}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="psychocas-input"
                  placeholder="Zadejte váš email"
                  required
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="psychocas-button-primary"
                disabled={isLoading || !email}
              >
                {isLoading ? 'Odesílám...' : 'Odeslat přihlašovací odkaz'}
              </button>
            </form>
          )}

          {/* Success State - Show after email sent */}
          {emailSent && (
            <div className="space-y-6">
              {/* Email Icon/Illustration */}
              <div className="flex justify-center mb-6">
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1d4f7d 0%, #049edb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '40px'
                }}>
                  ✉️
                </div>
              </div>

              {/* Success Message */}
              <div className="space-y-4">
                <h2 className="text-2xl font-bold" style={{ color: '#333333' }}>
                  Email byl odeslán!
                </h2>
                <p style={{ color: '#666666', lineHeight: '1.6' }}>
                  Přihlašovací odkaz jsme odeslali na adresu:<br/>
                  <strong style={{ color: '#333333' }}>{email}</strong>
                </p>
              </div>

              {/* Instructions */}
              <div className="p-6 rounded-xl text-left" style={{ 
                backgroundColor: '#f0f9ff',
                borderLeft: '4px solid #049edb'
              }}>
                <p className="text-sm mb-3" style={{ color: '#333333', fontWeight: '600' }}>
                  📋 Jak se přihlásit:
                </p>
                <ol className="text-sm space-y-2" style={{ color: '#666666', paddingLeft: '20px' }}>
                  <li>Otevřete svou emailovou schránku</li>
                  <li>Najděte email od Psychočas</li>
                  <li>Klikněte na přihlašovací odkaz v emailu</li>
                  <li>Budete automaticky přesměrováni do aplikace</li>
                </ol>
              </div>

              {/* Expiration Warning */}
              <div className="p-4 rounded-xl" style={{ 
                backgroundColor: '#fff3cd',
                borderLeft: '4px solid #f57c00'
              }}>
                <p className="text-sm" style={{ color: '#856404' }}>
                  ⏰ Odkaz vyprší za 60 minut
                </p>
              </div>

              {/* Resend Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="psychocas-button-secondary"
                >
                  ← Zpět na přihlášení
                </button>
              </div>

              {/* Help Text */}
              <p className="text-sm pt-4" style={{ color: '#999999' }}>
                Nevidíte email? Zkontrolujte složku spam nebo nevyžádané pošty.
              </p>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div className={`mt-6 p-4 rounded-xl text-sm ${
              message.type === 'success' 
                ? 'status-active' 
                : 'status-inactive'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}