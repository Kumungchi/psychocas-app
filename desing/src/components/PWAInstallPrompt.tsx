import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Download, Smartphone } from 'lucide-react';

interface PWAInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PWAInstallPrompt({ isOpen, onClose }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
        onClose();
      }
    }
  };

  const handleManualInstall = () => {
    // Show manual installation instructions for different browsers
    alert('Pro instalaci aplikace:\n\niOS Safari: Sdílet → Přidat na plochu\nAndroid Chrome: Menu → Přidat na plochu\nDesktop Chrome: Adresní řádek → Ikona instalace');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="psychocas-card max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3" style={{ color: '#1d4f7d' }}>
            <Smartphone className="w-6 h-6" style={{ color: '#049edb' }} />
            Nainstalovat aplikaci
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" 
                 style={{ backgroundColor: '#e1f5fe' }}>
              <Download className="w-8 h-8" style={{ color: '#049edb' }} />
            </div>
            
            <div className="space-y-2">
              <p style={{ color: '#333333' }}>
                Získejte rychlejší přístup k Psychočas aplikaci
              </p>
              <p className="text-sm" style={{ color: '#666666' }}>
                Nainstalujte si aplikaci na své zařízení pro lepší zážitek a rychlejší načítání
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {isInstallable ? (
              <Button
                onClick={handleInstall}
                className="w-full psychocas-button-primary"
                style={{ 
                  backgroundColor: '#1d4f7d',
                  color: '#ffffff',
                  borderRadius: '1.5rem',
                  height: '3.5rem'
                }}
              >
                <Download className="w-5 h-5 mr-2" />
                Nainstalovat aplikaci
              </Button>
            ) : (
              <Button
                onClick={handleManualInstall}
                className="w-full psychocas-button-primary"
                style={{ 
                  backgroundColor: '#1d4f7d',
                  color: '#ffffff',
                  borderRadius: '1.5rem',
                  height: '3.5rem'
                }}
              >
                <Download className="w-5 h-5 mr-2" />
                Jak nainstalovat
              </Button>
            )}
            
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full"
              style={{ color: '#666666' }}
            >
              Možná později
            </Button>
          </div>

          <div className="text-xs text-center space-y-1" style={{ color: '#999999' }}>
            <p>✓ Rychlejší načítání</p>
            <p>✓ Offline přístup</p>
            <p>✓ Ikona na ploše</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
