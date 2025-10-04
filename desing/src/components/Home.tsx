import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { CheckCircle, XCircle, Instagram, Globe, HelpCircle, Smartphone } from 'lucide-react';
import { PWAInstallPrompt } from './PWAInstallPrompt';

interface HomeProps {
  userEmail: string;
  onNavigateToDiscount: () => void;
}

export function Home({ userEmail, onNavigateToDiscount }: HomeProps) {
  // Mock user data
  const membershipActive = true;
  const expirationDate = '15. června 2025';
  
  // PWA install prompt state
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const [hasSeenPWAPrompt, setHasSeenPWAPrompt] = useState(false);

  useEffect(() => {
    // Check if user has seen PWA prompt before
    const hasSeenPrompt = localStorage.getItem('pwa-prompt-seen');
    if (!hasSeenPrompt) {
      // Show PWA prompt after a short delay on first visit
      const timer = setTimeout(() => {
        setShowPWAPrompt(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
    setHasSeenPWAPrompt(true);
  }, []);

  const handleClosePWAPrompt = () => {
    setShowPWAPrompt(false);
    localStorage.setItem('pwa-prompt-seen', 'true');
    setHasSeenPWAPrompt(true);
  };

  return (
    <div className="min-h-screen psychocas-section pb-20" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="psychocas-container space-y-8 fade-in-up">
        {/* Header */}
        <div className="text-center pt-6">
          <h1 style={{ color: '#1d4f7d', marginBottom: '0.75rem' }}>
            Vítejte zpět!
          </h1>
          <p style={{ color: '#666666', fontSize: '1rem' }}>
            {userEmail}
          </p>
        </div>

        {/* Membership Status Card */}
        <Card className="psychocas-card">
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 style={{ color: '#333333' }}>Stav členství</h2>
              <Badge 
                className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                  membershipActive ? 'status-active' : 'status-inactive'
                }`}
                style={{
                  backgroundColor: membershipActive ? '#e8f5e8' : '#ffebee',
                  color: membershipActive ? '#2e7d32' : '#c62828',
                  fontWeight: '500'
                }}
              >
                {membershipActive ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {membershipActive ? 'Aktivní' : 'Neaktivní'}
              </Badge>
            </div>
            
            <div className="space-y-3">
              <p style={{ color: '#666666', fontSize: '0.95rem' }}>
                Platnost do
              </p>
              <p style={{ color: '#333333', fontSize: '1.1rem', fontWeight: '500' }}>
                {expirationDate}
              </p>
            </div>

            {membershipActive && (
              <Button
                onClick={onNavigateToDiscount}
                className="w-full psychocas-button-primary mt-6"
                style={{ 
                  backgroundColor: '#1d4f7d',
                  color: '#ffffff',
                  borderRadius: '1.5rem',
                  height: '3.5rem'
                }}
              >
                Uplatnit slevu
              </Button>
            )}
          </CardContent>
        </Card>

        {/* App Info */}
        <Card className="psychocas-card">
          <CardContent>
            <h3 className="mb-4" style={{ color: '#333333' }}>
              O aplikaci Psychočas
            </h3>
            <div className="space-y-3" style={{ color: '#666666', fontSize: '0.95rem' }}>
              <p>
                Vaše digitální členská karta pro rychlé a pohodlné uplatňování slev ve spolupracujících podnicích.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#f8f9fa' }}>
                  <div style={{ color: '#1d4f7d', fontWeight: '600' }}>3 min</div>
                  <div className="text-xs">Platnost kódu</div>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#f8f9fa' }}>
                  <div style={{ color: '#1d4f7d', fontWeight: '600' }}>24/7</div>
                  <div className="text-xs">Dostupnost</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="psychocas-card">
          <CardContent>
            <h3 className="mb-6" style={{ color: '#333333' }}>
              Rychlé odkazy
            </h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:transform hover:scale-[1.02]">
                <Instagram className="w-5 h-5" style={{ color: '#049edb' }} />
                <span style={{ color: '#333333', fontSize: '1rem' }}>Instagram</span>
              </button>
              
              <button className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:transform hover:scale-[1.02]">
                <Globe className="w-5 h-5" style={{ color: '#049edb' }} />
                <span style={{ color: '#333333', fontSize: '1rem' }}>Webové stránky</span>
              </button>
              
              <button className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:transform hover:scale-[1.02]">
                <HelpCircle className="w-5 h-5" style={{ color: '#049edb' }} />
                <span style={{ color: '#333333', fontSize: '1rem' }}>FAQ</span>
              </button>

              {hasSeenPWAPrompt && (
                <button 
                  onClick={() => setShowPWAPrompt(true)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:transform hover:scale-[1.02]"
                >
                  <Smartphone className="w-5 h-5" style={{ color: '#049edb' }} />
                  <span style={{ color: '#333333', fontSize: '1rem' }}>Nainstalovat aplikaci</span>
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <PWAInstallPrompt 
        isOpen={showPWAPrompt} 
        onClose={handleClosePWAPrompt} 
      />
    </div>
  );
}