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
    <main className="min-h-screen bg-brand-gray flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-avenir-black text-brand-blue mb-2">
            Psychočas
          </h1>
          <p className="text-brand-text/70 font-avenir">
            Členská aplikace
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-card shadow-soft p-6">
          <h2 className="text-xl font-avenir-medium text-brand-text mb-2">
            Přihlášení
          </h2>
          <p className="text-sm text-brand-text/70 mb-6 font-avenir">
            Použij e-mail registrovaný u spolku
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-avenir-medium text-brand-text mb-2">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-200 rounded-button focus:ring-2 focus:ring-brand-accent focus:border-transparent font-avenir"
                placeholder="tvoj@email.cz"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full bg-brand-blue text-white py-3 px-4 rounded-button font-avenir-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-blue/90 transition-colors"
            >
              {isLoading ? 'Odesílám...' : 'Poslat přihlašovací odkaz'}
            </button>
          </form>

          {/* Message Display */}
          {message && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-avenir ${
              message.type === 'success' 
                ? 'bg-brand-success/10 text-brand-success border border-brand-success/20' 
                : 'bg-brand-error/10 text-brand-error border border-brand-error/20'
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