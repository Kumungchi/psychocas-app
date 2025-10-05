'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle, XCircle } from 'lucide-react';
import Navigation from '@/components/Navigation';

interface ValidationResult {
  valid: boolean;
  message?: string;
  memberName?: string;
}

export default function Validate() {
  const [inputCode, setInputCode] = useState('');
  const [validationResult, setValidationResult] = useState<'success' | 'error' | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidatedCode, setLastValidatedCode] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [userRole, setUserRole] = useState<'member' | 'manager' | 'council' | 'technician'>('manager');
  const router = useRouter();

  // Fetch user role on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: member } = await supabase
          .from('members')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (member) {
          setUserRole(member.role as 'member' | 'manager' | 'council' | 'technician');
        }
      }
    };

    fetchUserRole();
  }, []);

  const validateCode = async (code: string) => {
    setIsValidating(true);
    setLastValidatedCode(code);
    setValidationResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/redeem_token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: code.trim().toUpperCase() }),
        }
      );

      const data = await response.json();
      
      if (response.ok && data.success) {
        setValidationResult('success');
        setResultMessage(`Kód validován! ${data.memberName ? `Člen: ${data.memberName}` : ''}`);
        setInputCode(''); // Clear input on success
      } else {
        setValidationResult('error');
        setResultMessage(data.error || 'Kód je neplatný nebo již byl použit');
      }

    } catch (error) {
      console.error('Error validating code:', error);
      setValidationResult('error');
      setResultMessage('Nastala neočekávaná chyba při validaci');
    } finally {
      setIsValidating(false);
    }
  };

  const handleManualValidation = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      validateCode(inputCode);
    }
  };

  const simulateQrScan = () => {
    // In production, this would trigger camera/QR scanner
    const mockCode = 'PSYCHO24-DEMO';
    setInputCode(mockCode);
    validateCode(mockCode);
  };

  return (
    <main className="psychocas-section pb-20">
      <div className="psychocas-container space-y-6 fade-in-up">
        {/* Header */}
        <div className="text-center pt-6">
          <h1 className="mb-3">
            Ověření kódu
          </h1>
          <p style={{ color: '#666666' }}>
            Naskenujte nebo zadejte QR kód od zákazníka
          </p>
        </div>

        {/* QR Scanner Section */}
        <div className="psychocas-card">
          <div className="text-center mb-6">
            <h3 style={{ color: '#333333' }}>
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
        </div>

        {/* Manual Input Section */}
        <div className="psychocas-card">
          <form onSubmit={handleManualValidation} className="space-y-6">
            <div className="text-center">
              <h3 style={{ color: '#333333', marginBottom: '1rem' }}>
                Nebo zadejte kód ručně
              </h3>
            </div>
            
            <div className="space-y-3 text-left">
              <label htmlFor="code-input" style={{ color: '#333333' }}>
                Kód
              </label>
              <input
                id="code-input"
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                className="psychocas-input text-center text-lg tracking-wider font-mono"
                placeholder="PSYCHO24-ABC123"
                disabled={isValidating}
                style={{ fontFamily: 'SF Mono, Monaco, monospace' }}
              />
            </div>

            <button
              type="submit"
              className="psychocas-button-primary"
              disabled={isValidating || !inputCode.trim()}
            >
              {isValidating ? 'Ověřuji...' : 'Ověřit kód'}
            </button>
          </form>
        </div>

        {/* Validation Result */}
        {validationResult && (
          <div className={`psychocas-card ${
            validationResult === 'success' ? 'status-active' : 'status-inactive'
          }`}>
            <div className="text-center space-y-4">
              {validationResult === 'success' ? (
                <CheckCircle className="w-16 h-16 mx-auto" style={{ color: '#2e7d32' }} />
              ) : (
                <XCircle className="w-16 h-16 mx-auto" style={{ color: '#c62828' }} />
              )}
              
              <div>
                <h3 className="mb-2" style={{ 
                  color: validationResult === 'success' ? '#2e7d32' : '#c62828' 
                }}>
                  {validationResult === 'success' ? 'Kód platný!' : 'Kód neplatný'}
                </h3>
                <p className="text-sm" style={{ 
                  color: validationResult === 'success' ? '#2e7d32' : '#c62828' 
                }}>
                  {resultMessage}
                </p>
                <p className="text-sm mt-3" style={{ color: '#666666' }}>
                  Kód: <strong>{lastValidatedCode}</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="psychocas-card" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffe082' }}>
          <h4 className="mb-2" style={{ color: '#f57c00' }}>
            ℹ️ Instrukce
          </h4>
          <ul className="space-y-2 text-sm" style={{ color: '#f57c00' }}>
            <li>• Kód je platný 3 minuty od vygenerování</li>
            <li>• Každý kód lze použít pouze jednou</li>
            <li>• Po validaci bude kód automaticky označen jako použitý</li>
          </ul>
        </div>
      </div>

      {/* Navigation Bar */}
      <Navigation userRole={userRole} />
    </main>
  );
}