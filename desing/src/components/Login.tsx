import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface LoginProps {
  onLogin: (email: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('clen@psychocas.cz');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onLogin(email);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center psychocas-section" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="psychocas-container fade-in-up">        
        <div className="psychocas-card text-center">
          {/* Welcome Section */}
          <div className="mb-12">
            <h1 className="mb-3" style={{ color: '#1d4f7d' }}>
              Vítejte v Psychočas
            </h1>
            <p className="text-lg" style={{ color: '#666666' }}>
              Přihlaste se do vaší členské aplikace
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3 text-left">
              <Label htmlFor="email" style={{ color: '#333333' }}>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="psychocas-input w-full"
                placeholder="Zadejte váš email"
                required
              />
            </div>

            <Button
              type="submit"
              className="psychocas-button-primary w-full"
              style={{ 
                backgroundColor: '#1d4f7d',
                color: '#ffffff',
                borderRadius: '1.5rem',
                height: '3.5rem'
              }}
            >
              Přihlásit se
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}