'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/home`,
        },
      });

      if (error) {
        setMessage({
          type: 'error',
          text: error.message
        });
      } else {
        setMessage({
          type: 'success',
          text: 'Zkontroluj e-mail a klikni na odkaz pro přihlášení!'
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

  return (
    <main className="psychocas-section flex items-center justify-center">
      <div className="psychocas-container fade-in-up">
        {/* Welcome Section */}
        <div className="psychocas-card text-center">
          <div className="mb-12">
            <h1 className="mb-3">
              Vítejte v Psychočas
            </h1>
            <p className="text-lg" style={{ color: '#666666' }}>
              Přihlaste se do vaší členské aplikace
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-8">
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
              {isLoading ? 'Odesílám...' : 'Přihlásit se'}
            </button>
          </form>

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

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-brand-text/50 font-avenir">
            Aplikace pro členy studentského spolku Psychočas
          </p>
        </div>
      </div>
    </main>
  );
}