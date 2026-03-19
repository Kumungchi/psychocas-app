import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { TrendingUp, Users, Percent, Clock } from 'lucide-react';

interface StatisticsProps {
  onBack: () => void;
}

const mockData = {
  day: [
    { time: '9:00', validations: 12 },
    { time: '10:00', validations: 18 },
    { time: '11:00', validations: 25 },
    { time: '12:00', validations: 31 },
    { time: '13:00', validations: 28 },
    { time: '14:00', validations: 22 },
    { time: '15:00', validations: 16 },
    { time: '16:00', validations: 19 },
  ],
  week: [
    { day: 'Po', validations: 145 },
    { day: 'Út', validations: 162 },
    { day: 'St', validations: 178 },
    { day: 'Čt', validations: 153 },
    { day: 'Pá', validations: 189 },
    { day: 'So', validations: 234 },
    { day: 'Ne', validations: 198 },
  ],
  month: [
    { week: '1. týden', validations: 1259 },
    { week: '2. týden', validations: 1387 },
    { week: '3. týden', validations: 1456 },
    { week: '4. týden', validations: 1332 },
  ]
};

export function Statistics({ onBack }: StatisticsProps) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

  const data = mockData[period];
  const totalValidations = data.reduce((sum, item) => sum + item.validations, 0);
  const avgPerPeriod = Math.round(totalValidations / data.length);

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="max-w-2xl mx-auto space-y-6">
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
            Statistiky
          </h1>
        </div>

        {/* Filter */}
        <Card className="psychocas-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm" style={{ color: '#333333' }}>
                Období:
              </label>
              <Select value={period} onValueChange={(value: 'day' | 'week' | 'month') => setPeriod(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Den</SelectItem>
                  <SelectItem value="week">Týden</SelectItem>
                  <SelectItem value="month">Měsíc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="psychocas-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: '#e3f2fd' }}
                >
                  <Users className="w-5 h-5" style={{ color: '#1d4f7d' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: '#666666' }}>
                    Celkem
                  </p>
                  <p className="text-lg" style={{ color: '#333333' }}>
                    {totalValidations}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="psychocas-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: '#e1f5fe' }}
                >
                  <TrendingUp className="w-5 h-5" style={{ color: '#049edb' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: '#666666' }}>
                    Průměr
                  </p>
                  <p className="text-lg" style={{ color: '#333333' }}>
                    {avgPerPeriod}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="psychocas-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: '#e8f5e8' }}
                >
                  <Percent className="w-5 h-5" style={{ color: '#2e7d32' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: '#666666' }}>
                    Úspěšnost
                  </p>
                  <p className="text-lg" style={{ color: '#333333' }}>
                    94%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="psychocas-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: '#fff3e0' }}
                >
                  <Clock className="w-5 h-5" style={{ color: '#ff9800' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: '#666666' }}>
                    Avg. čas
                  </p>
                  <p className="text-lg" style={{ color: '#333333' }}>
                    2.3s
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="psychocas-card">
          <CardHeader>
            <CardTitle style={{ color: '#333333' }}>
              Ověření kódů - {period === 'day' ? 'Dnes' : period === 'week' ? 'Tento týden' : 'Tento měsíc'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <XAxis 
                    dataKey={period === 'day' ? 'time' : period === 'week' ? 'day' : 'week'}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#666666' }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#666666' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  <Bar 
                    dataKey="validations" 
                    fill="#1d4f7d"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="psychocas-card">
          <CardContent className="p-4">
            <h3 className="mb-3" style={{ color: '#333333' }}>
              Shrnutí
            </h3>
            <div className="space-y-2 text-sm" style={{ color: '#666666' }}>
              <p>• Nejaktivnější {period === 'day' ? 'hodina' : period === 'week' ? 'den' : 'týden'}: {
                data.reduce((max, item) => item.validations > max.validations ? item : max, data[0])[
                  period === 'day' ? 'time' : period === 'week' ? 'day' : 'week'
                ]
              }</p>
              <p>• Celkem aktivních členů: 1,247</p>
              <p>• Průměrná doba ověření: 2.3 sekundy</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}