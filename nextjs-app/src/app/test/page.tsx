import SupabaseHealthCheck from '@/components/SupabaseHealthCheck';

export default function TestPage() {
  return (
    <main className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          🩺 Supabase Health Check
        </h1>
        
        <SupabaseHealthCheck />
        
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="bg-amber-50 p-6 rounded-lg border border-amber-200">
            <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
              📋 Před testováním
            </h3>
            <ul className="text-amber-700 text-sm space-y-2">
              <li>1. Spusťte SQL skripty v Supabase</li>
              <li>2. Ověřte .env.local konfiguraci</li>
              <li>3. Zkontrolujte URL a API klíče</li>
            </ul>
          </div>
          
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
              🎯 Očekávané výsledky
            </h3>
            <ul className="text-green-700 text-sm space-y-2">
              <li>✅ Auth: {"{ user: null }"}</li>
              <li>✅ DB: Nalezena ≥1 pobočka</li>
              <li>✅ Všechny testy úspěšné</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 bg-gray-50 p-6 rounded-lg border">
          <h3 className="font-semibold text-gray-800 mb-4">📁 SQL skripty pro setup</h3>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between items-center">
              <code className="bg-white px-2 py-1 rounded">sql/01_schema.sql</code>
              <span className="text-gray-600">Základní tabulky</span>
            </div>
            <div className="flex justify-between items-center">
              <code className="bg-white px-2 py-1 rounded">sql/02_rls_policies.sql</code>
              <span className="text-gray-600">RLS pravidla</span>
            </div>
            <div className="flex justify-between items-center">
              <code className="bg-white px-2 py-1 rounded">sql/03_triggers.sql</code>
              <span className="text-gray-600">Anti-spam triggery</span>
            </div>
            <div className="flex justify-between items-center">
              <code className="bg-white px-2 py-1 rounded">sql/04_views.sql</code>
              <span className="text-gray-600">Pohledy pro statistiky</span>
            </div>
            <div className="flex justify-between items-center">
              <code className="bg-white px-2 py-1 rounded">sql/05_test_data.sql</code>
              <span className="text-gray-600">Testovací data</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}