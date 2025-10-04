import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { QrCode, Keyboard, CheckCircle, XCircle, Camera } from 'lucide-react';

interface ValidationProps {
  onBack: () => void;
}

export function Validation({ onBack }: ValidationProps) {
  const [inputCode, setInputCode] = useState('');
  const [validationResult, setValidationResult] = useState<'success' | 'error' | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidatedCode, setLastValidatedCode] = useState('');

  const validateCode = async (code: string) => {
    setIsValidating(true);
    setLastValidatedCode(code);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock validation logic
    const isValid = code.includes('PSYCHO24') && code.length >= 10;
    setValidationResult(isValid ? 'success' : 'error');
    setIsValidating(false);
  };

  const handleManualValidation = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      validateCode(inputCode);
    }
  };

  const simulateQrScan = () => {
    const mockCode = 'PSYCHO24-A7B9C2';
    validateCode(mockCode);
  };

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 pt-4">
          <Button
            onClick={onBack}
            variant="ghost"
            className="p-2"
            style={{ color: '#1d4f7d' }}
          >
            ←
          </Button>
          <h1 className="text-xl" style={{ color: '#1d4f7d' }}>
            Ověření kódu
          </h1>
        </div>

        {/* QR Scanner Section */}
        <Card className="psychocas-card">
          <CardContent className="p-6 space-y-6">
            <div className="text-center">
              <h3 style={{ color: '#333333', marginBottom: '1rem' }}>
                Naskenujte QR kód
              </h3>
            </div>
            
            <div 
              className="aspect-square max-w-64 mx-auto border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-all duration-300"
              style={{ borderColor: '#049edb' }}
              onClick={simulateQrScan}
            >
              <div className="text-center space-y-3">
                <Camera className="w-20 h-20 mx-auto" style={{ color: '#049edb' }} />
                <p style={{ color: '#666666' }}>
                  Klikněte pro simulaci skenování
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual Input Section */}
        <Card className="psychocas-card">
          <CardContent className="p-6">
            <form onSubmit={handleManualValidation} className="space-y-6">
              <div className="text-center">
                <h3 style={{ color: '#333333', marginBottom: '1rem' }}>
                  Nebo zadejte kód ručně
                </h3>
              </div>
              
              <div>
                <Input
                  id="code-input"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="PSYCHO24-XXXXXX"
                  className="psychocas-input text-center font-mono text-lg"
                  disabled={isValidating}
                />
              </div>
              
              <Button
                type="submit"
                disabled={!inputCode.trim() || isValidating}
                className="w-full psychocas-button-primary"
                style={{ 
                  backgroundColor: '#1d4f7d',
                  color: '#ffffff',
                  borderRadius: '1.5rem',
                  height: '3.5rem'
                }}
              >
                {isValidating ? 'Ověřuji...' : 'Ověřit kód'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Validation Result */}
        {validationResult && (
          <Card className="psychocas-card">
            <CardContent className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" 
                   style={{ backgroundColor: validationResult === 'success' ? '#e8f5e8' : '#ffebee' }}>
                {validationResult === 'success' ? (
                  <CheckCircle className="w-8 h-8" style={{ color: '#2e7d32' }} />
                ) : (
                  <XCircle className="w-8 h-8" style={{ color: '#c62828' }} />
                )}
              </div>
              
              <div className="space-y-2">
                <h3 style={{ color: validationResult === 'success' ? '#2e7d32' : '#c62828' }}>
                  {validationResult === 'success' ? 'Kód je platný!' : 'Neplatný kód'}
                </h3>
                <p style={{ color: '#666666' }}>
                  {validationResult === 'success' 
                    ? 'Sleva byla úspěšně uplatněna.'
                    : 'Kód je neplatný nebo vypršelý. Zkuste to znovu.'
                  }
                </p>
                
                {lastValidatedCode && (
                  <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#f5f5f5' }}>
                    <p className="text-sm" style={{ color: '#666666' }}>Ověřený kód:</p>
                    <p className="font-mono" style={{ color: '#333333' }}>{lastValidatedCode}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="psychocas-card">
          <CardContent className="p-4">
            <h3 className="mb-2" style={{ color: '#333333' }}>
              Pokyny pro ověření:
            </h3>
            <ul className="text-sm space-y-1" style={{ color: '#666666' }}>
              <li>• Použijte QR skener pro rychlé ověření</li>
              <li>• Nebo zadejte kód ručně</li>
              <li>• Kódy jsou platné pouze 3 minuty</li>
              <li>• Každý kód lze použít pouze jednou</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}