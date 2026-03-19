import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Copy, RefreshCw, QrCode } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface DiscountCodeProps {
  onBack: () => void;
}

export function DiscountCode({ onBack }: DiscountCodeProps) {
  const [code, setCode] = useState('PSYCHO24-A7B9C2');
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes in seconds
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) {
      setIsExpired(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const regenerateCode = () => {
    const newCode = `PSYCHO24-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setCode(newCode);
    setTimeLeft(180);
    setIsExpired(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast.success('Kód byl zkopírován do schránky');
  };

  return (
    <div className="min-h-screen psychocas-section" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="psychocas-container space-y-8 fade-in-up">
        {/* Header */}
        <div className="flex items-center gap-4 pt-6">
          <Button
            onClick={onBack}
            variant="ghost"
            className="p-3 hover:bg-white/50 rounded-full transition-all duration-300"
            style={{ color: '#1d4f7d' }}
          >
            ←
          </Button>
          <h1 style={{ color: '#1d4f7d' }}>
            Slevový kód
          </h1>
        </div>

        {/* Code Card */}
        <Card className="psychocas-card">
          <CardContent className="space-y-8">
            {/* Code Display */}
            <div className="text-center space-y-6">
              <h2 style={{ color: '#333333', marginBottom: '2rem' }}>Váš slevový kód</h2>
              
              <div 
                className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
                  isExpired ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-100'
                }`}
              >
                <div 
                  className="text-3xl font-mono tracking-wider"
                  style={{ 
                    color: isExpired ? '#999999' : '#1d4f7d',
                    fontFamily: 'SF Mono, Monaco, monospace',
                    fontWeight: '600'
                  }}
                >
                  {code}
                </div>
              </div>

              {/* Copy Button */}
              <Button
                onClick={copyCode}
                disabled={isExpired}
                className="flex items-center gap-3 px-6 py-3 transition-all duration-300"
                style={{ 
                  backgroundColor: isExpired ? '#cccccc' : '#049edb',
                  color: '#ffffff',
                  borderRadius: '1.5rem',
                  height: '3.5rem'
                }}
              >
                <Copy className="w-5 h-5" />
                Kopírovat kód
              </Button>
            </div>

            {/* QR Code Section */}
            <div className="text-center space-y-6 pt-6 border-t" style={{ borderColor: '#e0e0e0' }}>
              <div className="flex items-center justify-center w-40 h-40 mx-auto border-2 border-dashed rounded-2xl transition-all duration-300" 
                   style={{ borderColor: isExpired ? '#cccccc' : '#049edb' }}>
                <QrCode 
                  className="w-20 h-20" 
                  style={{ color: isExpired ? '#cccccc' : '#049edb' }} 
                />
              </div>
              <p style={{ color: '#666666' }}>
                QR kód pro rychlé uplatnění
              </p>
            </div>

            {/* Timer */}
            <div className="text-center space-y-3">
              <p style={{ color: '#666666' }}>
                Zbývající čas
              </p>
              <div 
                className="text-3xl font-mono font-bold"
                style={{
                  color: isExpired ? '#c62828' : timeLeft <= 30 ? '#f57c00' : '#2e7d32'
                }}
              >
                {isExpired ? 'VYPRŠEL' : formatTime(timeLeft)}
              </div>
            </div>

            {/* Regenerate Button */}
            {isExpired && (
              <Button
                onClick={regenerateCode}
                className="w-full flex items-center gap-3 psychocas-button-primary"
                style={{ 
                  backgroundColor: '#1d4f7d',
                  color: '#ffffff',
                  borderRadius: '1.5rem',
                  height: '3.5rem'
                }}
              >
                <RefreshCw className="w-5 h-5" />
                Vygenerovat nový kód
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="psychocas-card">
          <CardContent>
            <h3 className="mb-4" style={{ color: '#333333' }}>
              Jak použít kód
            </h3>
            <div className="space-y-3" style={{ color: '#666666' }}>
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0"></span>
                <span>Ukažte kód nebo QR kód u pokladny</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0"></span>
                <span>Kód je platný 3 minuty od vygenerování</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0"></span>
                <span>Po vypršení času můžete vygenerovat nový kód</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}