'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        setMessage({
          type: 'error',
          text: error.message
        });
      } else {
        setStep('otp');
        setMessage({
          type: 'success',
          text: 'Kód byl odeslán na váš email!'
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      console.log('Verifying OTP:', { email, otp });
      
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'magiclink',
      });

      console.log('Verify OTP response:', { data, error });

      if (error) {
        console.error('OTP verification error:', error);
        setMessage({
          type: 'error',
          text: `Chyba ověření: ${error.message || 'Neplatný kód. Zkuste to znovu.'}`
        });
      } else if (data.user) {
        console.log('User verified successfully:', data.user);
        router.push('/home');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setMessage({
        type: 'error',
        text: 'Nastala neočekávaná chyba'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setOtp('');
    setMessage(null);
  };

  return (
    <main className="psychocas-section flex items-center justify-center">
      <div className="psychocas-container fade-in-up">
        <div className="psychocas-card text-center">
          {/* Welcome Section */}
          <div className="mb-12">
            <h1 className="mb-3">
              Vítejte v Psychočas aplikaci
            </h1>
            <p className="text-lg" style={{ color: '#666666' }}>
              {step === 'email' 
                ? 'Přihlaste se do vaší členské aplikace' 
                : 'Zadejte 6-místný kód z emailu'}
            </p>
          </div>

          {/* Email Step */}
          {step === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-8">
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
                />
              </div>

              <button
                type="submit"
                className="psychocas-button-primary"
                disabled={isLoading || !email}
              >
                {isLoading ? 'Odesílám...' : 'Odeslat kód'}
              </button>
            </form>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-8">
              <div className="space-y-3 text-left">
                <label htmlFor="otp" style={{ color: '#333333' }}>
                  Ověřovací kód
                </label>
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="psychocas-input text-center text-2xl tracking-widest font-mono"
                  placeholder="000000"
                  required
                  disabled={isLoading}
                  maxLength={6}
                  autoFocus
                  style={{
                    fontFamily: 'SF Mono, Monaco, monospace',
                    letterSpacing: '0.5em'
                  }}
                />
                <p className="text-sm text-center" style={{ color: '#666666' }}>
                  Kód byl odeslán na: <strong>{email}</strong>
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  className="psychocas-button-primary"
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? 'Ověřuji...' : 'Ověřit kód'}
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  className="psychocas-button-secondary"
                  disabled={isLoading}
                >
                  ← Zpět na email
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isLoading}
                  className="text-sm"
                  style={{ color: '#049edb', textDecoration: 'underline' }}
                >
                  Odeslat kód znovu
                </button>
              </div>
            </form>
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