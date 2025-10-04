import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle, QrCode, BarChart3, Settings, Smartphone } from 'lucide-react';

export function WebDesignShowcase() {
  return (
    <div className="min-h-screen page-container" style={{ backgroundColor: '#f8fafc' }}>
      <div className="max-w-4xl mx-auto p-8 space-y-12">
        {/* Header */}
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center" 
               style={{ backgroundColor: '#1d4f7d' }}>
            <QrCode className="w-10 h-10" style={{ color: '#ffffff' }} />
          </div>
          
          <div className="space-y-4">
            <h1 style={{ color: '#1d4f7d', fontSize: '2.5rem', fontWeight: '600' }}>
              Psychočas
            </h1>
            <p style={{ color: '#666666', fontSize: '1.25rem' }}>
              Moderní členská aplikace pro digitální slevy
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Mobile App Preview */}
          <Card className="psychocas-card col-span-full lg:col-span-2">
            <CardContent className="space-y-6">
              <div className="flex items-center gap-3">
                <Smartphone className="w-6 h-6" style={{ color: '#049edb' }} />
                <h3 style={{ color: '#333333' }}>Mobilní aplikace</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Login Screen */}
                <div className="bg-gray-100 rounded-2xl p-4 aspect-[9/16] flex flex-col justify-center items-center space-y-3">
                  <div className="w-8 h-8 rounded-full" style={{ backgroundColor: '#1d4f7d' }}></div>
                  <div className="space-y-2 w-full">
                    <div className="h-2 bg-gray-300 rounded w-3/4 mx-auto"></div>
                    <div className="h-2 bg-gray-300 rounded w-1/2 mx-auto"></div>
                  </div>
                  <div className="w-full h-6 rounded" style={{ backgroundColor: '#1d4f7d' }}></div>
                  <p className="text-xs text-center" style={{ color: '#666666' }}>Přihlášení</p>
                </div>

                {/* Home Screen */}
                <div className="bg-gray-100 rounded-2xl p-4 aspect-[9/16] flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                      <Badge style={{ backgroundColor: '#e8f5e8', color: '#2e7d32', fontSize: '0.6rem' }}>
                        Aktivní
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-gray-300 rounded w-full"></div>
                      <div className="h-2 bg-gray-300 rounded w-2/3"></div>
                    </div>
                    <div className="w-full h-6 rounded" style={{ backgroundColor: '#1d4f7d' }}></div>
                  </div>
                  <p className="text-xs text-center" style={{ color: '#666666' }}>Domov</p>
                </div>

                {/* Discount Screen */}
                <div className="bg-gray-100 rounded-2xl p-4 aspect-[9/16] flex flex-col justify-center items-center space-y-3">
                  <div className="w-12 h-12 border-2 border-dashed rounded-lg flex items-center justify-center" 
                       style={{ borderColor: '#049edb' }}>
                    <QrCode className="w-6 h-6" style={{ color: '#049edb' }} />
                  </div>
                  <div className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">PSYCHO24-XXX</div>
                  <p className="text-xs text-center" style={{ color: '#666666' }}>Slevový kód</p>
                </div>

                {/* Validation Screen */}
                <div className="bg-gray-100 rounded-2xl p-4 aspect-[9/16] flex flex-col justify-center items-center space-y-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" 
                       style={{ backgroundColor: '#e8f5e8' }}>
                    <CheckCircle className="w-6 h-6" style={{ color: '#2e7d32' }} />
                  </div>
                  <div className="space-y-1 text-center">
                    <div className="h-2 bg-gray-300 rounded w-3/4 mx-auto"></div>
                    <div className="h-2 bg-gray-300 rounded w-1/2 mx-auto"></div>
                  </div>
                  <p className="text-xs text-center" style={{ color: '#666666' }}>Ověření</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Features */}
          <Card className="psychocas-card">
            <CardContent className="space-y-6">
              <h3 style={{ color: '#333333' }}>Klíčové funkce</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <QrCode className="w-5 h-5 mt-0.5" style={{ color: '#049edb' }} />
                  <div>
                    <p style={{ color: '#333333', fontWeight: '500' }}>QR kódy</p>
                    <p className="text-sm" style={{ color: '#666666' }}>Rychlé generování a ověřování</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <BarChart3 className="w-5 h-5 mt-0.5" style={{ color: '#049edb' }} />
                  <div>
                    <p style={{ color: '#333333', fontWeight: '500' }}>Statistiky</p>
                    <p className="text-sm" style={{ color: '#666666' }}>Přehled využití slev</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Settings className="w-5 h-5 mt-0.5" style={{ color: '#049edb' }} />
                  <div>
                    <p style={{ color: '#333333', fontWeight: '500' }}>Správa</p>
                    <p className="text-sm" style={{ color: '#666666' }}>Role-based přístup</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Design System */}
        <Card className="psychocas-card">
          <CardContent className="space-y-6">
            <h3 style={{ color: '#333333' }}>Design systém</h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              {/* Colors */}
              <div className="space-y-3">
                <h4 style={{ color: '#666666', fontSize: '0.875rem' }}>Barvy</h4>
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: '#1d4f7d' }}></div>
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: '#049edb' }}></div>
                  <div className="w-8 h-8 rounded-lg border" style={{ backgroundColor: '#ffffff' }}></div>
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: '#f5f5f5' }}></div>
                </div>
              </div>
              
              {/* Typography */}
              <div className="space-y-3">
                <h4 style={{ color: '#666666', fontSize: '0.875rem' }}>Typografie</h4>
                <div className="space-y-1">
                  <p style={{ fontSize: '1.25rem', fontWeight: '600', color: '#333333' }}>Avenir Medium</p>
                  <p style={{ fontSize: '1rem', color: '#666666' }}>Avenir Regular</p>
                </div>
              </div>
              
              {/* Components */}
              <div className="space-y-3">
                <h4 style={{ color: '#666666', fontSize: '0.875rem' }}>Komponenty</h4>
                <div className="space-y-2">
                  <div className="h-8 rounded-full flex items-center justify-center text-sm" 
                       style={{ backgroundColor: '#1d4f7d', color: '#ffffff' }}>
                    Tlačítko
                  </div>
                  <div className="h-8 border rounded-lg flex items-center px-3 text-sm" 
                       style={{ borderColor: '#e0e0e0', color: '#666666' }}>
                    Input pole
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Features */}
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="psychocas-card">
            <CardContent className="space-y-4">
              <h3 style={{ color: '#333333' }}>Technické vlastnosti</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2e7d32' }}></div>
                  <span style={{ color: '#666666' }}>Progressive Web App (PWA)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2e7d32' }}></div>
                  <span style={{ color: '#666666' }}>React + TypeScript</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2e7d32' }}></div>
                  <span style={{ color: '#666666' }}>Tailwind CSS v4</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2e7d32' }}></div>
                  <span style={{ color: '#666666' }}>Offline funkčnost</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="psychocas-card">
            <CardContent className="space-y-4">
              <h3 style={{ color: '#333333' }}>Uživatelské role</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge style={{ backgroundColor: '#e8f5e8', color: '#2e7d32' }}>Člen</Badge>
                  <span style={{ color: '#666666' }}>Generování slevových kódů</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge style={{ backgroundColor: '#e1f5fe', color: '#049edb' }}>Manažer</Badge>
                  <span style={{ color: '#666666' }}>Ověřování + statistiky</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge style={{ backgroundColor: '#ffebee', color: '#c62828' }}>Admin</Badge>
                  <span style={{ color: '#666666' }}>Úplná správa systému</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}