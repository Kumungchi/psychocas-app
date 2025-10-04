import { Card, CardContent } from './ui/card';
import { Info } from 'lucide-react';

export function DemoInfo() {
  return (
    <Card className="psychocas-card mb-6">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 mt-0.5" style={{ color: '#049edb' }} />
          <div className="space-y-2">
            <h3 className="font-medium" style={{ color: '#333333' }}>
              Demo aplikace
            </h3>
            <div className="text-sm space-y-1" style={{ color: '#666666' }}>
              <p>Vyzkoušejte různé role:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>člen@psychocas.cz</strong> - základní člen</li>
                <li><strong>manager@psychocas.cz</strong> - manažer s ověřováním</li>
                <li><strong>admin@psychocas.cz</strong> - admin se správou členů</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}