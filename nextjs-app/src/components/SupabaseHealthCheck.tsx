'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface HealthCheckResult {
  status: 'loading' | 'success' | 'error';
  message: string;
  data?: unknown;
}

export default function SupabaseHealthCheck() {
  const [authStatus, setAuthStatus] = useState<HealthCheckResult>({
    status: 'loading',
    message: 'Testování Auth připojení...'
  });
  
  const [dbStatus, setDbStatus] = useState<HealthCheckResult>({
    status: 'loading',
    message: 'Testování databázového připojení...'
  });

  useEffect(() => {
    const runHealthChecks = async () => {
      // Test 1: Auth připojení
      try {
        console.log('🔍 Testování Auth připojení...');
        const { data: authData, error: authError } = await supabase.auth.getSession();

        if (authError) {
          setAuthStatus({
            status: 'error',
            message: `Auth chyba: ${authError.message}`,
            data: authError
          });
        } else {
          const user = authData.session?.user ?? null;
          setAuthStatus({
            status: 'success',
            message: user ? 'Auth OK - uživatel přihlášen ✅' : 'Auth OK - bez přihlášení ✅',
            data: authData
          });
        }
      } catch (error) {
        setAuthStatus({
          status: 'error',
          message: `Auth neočekávaná chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`,
          data: error
        });
      }

      // Test 2: Databázové připojení
      try {
        console.log('🔍 Testování databáze...');
        const { data: branchData, error: dbError } = await supabase
          .from('branches')
          .select('id, name, city, created_at')
          .limit(5);

        if (dbError) {
          setDbStatus({
            status: 'error',
            message: `DB chyba: ${dbError.message}`,
            data: dbError
          });
          return;
        }

        const { data: offerData, error: offersError } = await supabase
          .from('partner_offers')
          .select('id, title, scope, active')
          .limit(5);

        if (offersError) {
          setDbStatus({
            status: 'error',
            message: `DB chyba (partner_offers): ${offersError.message}`,
            data: offersError
          });
          return;
        }

        setDbStatus({
          status: 'success',
          message: `Databáze OK - ${branchData?.length || 0} poboček, ${offerData?.length || 0} partnerských nabídek ✅`,
          data: { branches: branchData, offers: offerData }
        });
      } catch (error) {
        setDbStatus({
          status: 'error',
          message: `DB neočekávaná chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`,
          data: error
        });
      }
    };

    runHealthChecks();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'loading': return 'text-blue-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loading': return '🔄';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const HealthCheckCard = ({ title, result }: { title: string; result: HealthCheckResult }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-3">{title}</h3>
      
      <div className={`flex items-center gap-2 mb-3 ${getStatusColor(result.status)}`}>
        <span className="text-xl">{getStatusIcon(result.status)}</span>
        <p className="font-medium text-sm">{result.message}</p>
      </div>

      {result.data != null && (
        <div className="bg-gray-50 p-3 rounded border text-xs">
          <details>
            <summary className="cursor-pointer font-medium text-gray-700 mb-2">
              Response Data
            </summary>
            <pre className="text-gray-600 overflow-auto mt-2">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );

  const overallStatus = authStatus.status === 'success' && dbStatus.status === 'success' ? 'success' :
                       (authStatus.status === 'error' || dbStatus.status === 'error') ? 'error' : 'loading';

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Supabase Health Check
        </h2>
        
        <div className={`flex items-center gap-2 mb-4 ${getStatusColor(overallStatus)}`}>
          <span className="text-2xl">{getStatusIcon(overallStatus)}</span>
          <p className="font-medium">
            {overallStatus === 'success' ? 'Všechny testy úspěšné! 🎉' :
             overallStatus === 'error' ? 'Některé testy selhaly ⚠️' :
             'Probíhá testování...'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <HealthCheckCard title="🔐 Auth Test" result={authStatus} />
        <HealthCheckCard title="🗄️ Database Test" result={dbStatus} />
      </div>

      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
        <h3 className="font-semibold mb-2">Co testujeme:</h3>
        <ul className="space-y-1">
          <li>• <strong>Auth:</strong> supabase.auth.getSession() - očekáváme {"{ session: null }"}</li>
          <li>• <strong>DB:</strong> SELECT z tabulek branches a partner_offers - test RLS políček</li>
          <li>• <strong>Konfigurace:</strong> URL a API klíče z .env.local</li>
        </ul>
      </div>
    </div>
  );
}