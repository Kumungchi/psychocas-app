'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { TrendingUp, Users, Percent, Clock } from 'lucide-react';
import Navigation from '@/components/Navigation';

type Period = 'day' | 'week' | 'month';

type DayChartItem = { time: string; validations: number };
type WeekChartItem = { day: string; validations: number };
type MonthChartItem = { week: string; validations: number };

type ChartItem = DayChartItem | WeekChartItem | MonthChartItem;

const mockData: Record<Period, ChartItem[]> = {
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

const getLabel = (item: ChartItem): string => {
  if ('time' in item) {
    return item.time;
  }

  if ('day' in item) {
    return item.day;
  }

  return item.week;
};

export default function Statistics() {
  const [period, setPeriod] = useState<Period>('week');
  const [userRole, setUserRole] = useState<'member' | 'manager' | 'council' | 'technician'>('manager');

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

  const data = mockData[period];
  const totalValidations = data.reduce((sum, item) => sum + item.validations, 0);
  const avgPerPeriod = Math.round(totalValidations / data.length);
  const maxValidation = Math.max(...data.map(item => item.validations));

  return (
    <main className="psychocas-section pb-20">
      <div className="psychocas-container space-y-6 fade-in-up">
        {/* Header */}
        <div className="text-center pt-6">
          <h1 className="mb-3">Statistiky</h1>
          <p style={{ color: '#666666' }}>Přehled využití slevových kódů</p>
        </div>

        {/* Filter */}
        <div className="psychocas-card">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium" style={{ color: '#333333' }}>
              Období:
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'day' | 'week' | 'month')}
              className="psychocas-input flex-1"
              style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
            >
              <option value="day">Den</option>
              <option value="week">Týden</option>
              <option value="month">Měsíc</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Total */}
          <div className="psychocas-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#e3f2fd' }}>
                <Users className="w-5 h-5" style={{ color: '#1d4f7d' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#666666' }}>Celkem</p>
                <p className="text-lg font-semibold" style={{ color: '#333333' }}>{totalValidations}</p>
              </div>
            </div>
          </div>

          {/* Average */}
          <div className="psychocas-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#e1f5fe' }}>
                <TrendingUp className="w-5 h-5" style={{ color: '#049edb' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#666666' }}>Průměr</p>
                <p className="text-lg font-semibold" style={{ color: '#333333' }}>{avgPerPeriod}</p>
              </div>
            </div>
          </div>

          {/* Success Rate */}
          <div className="psychocas-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#e8f5e8' }}>
                <Percent className="w-5 h-5" style={{ color: '#2e7d32' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#666666' }}>Úspěšnost</p>
                <p className="text-lg font-semibold" style={{ color: '#333333' }}>94%</p>
              </div>
            </div>
          </div>

          {/* Avg Time */}
          <div className="psychocas-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#fff3e0' }}>
                <Clock className="w-5 h-5" style={{ color: '#ff9800' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#666666' }}>Avg. čas</p>
                <p className="text-lg font-semibold" style={{ color: '#333333' }}>2.3s</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="psychocas-card">
          <h3 className="mb-6" style={{ color: '#333333' }}>
            Ověření kódů - {period === 'day' ? 'Dnes' : period === 'week' ? 'Tento týden' : 'Tento měsíc'}
          </h3>
          
          <div className="space-y-3">
            {data.map((item, index) => {
              const label = getLabel(item);
              const percentage = (item.validations / maxValidation) * 100;
              
              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: '#666666' }}>{label}</span>
                    <span style={{ color: '#333333', fontWeight: '600' }}>{item.validations}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: '#1d4f7d'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="psychocas-card">
          <h3 className="mb-3" style={{ color: '#333333' }}>Shrnutí</h3>
          <div className="space-y-2 text-sm" style={{ color: '#666666' }}>
            <p>
              • Nejaktivnější {period === 'day' ? 'hodina' : period === 'week' ? 'den' : 'týden'}:{' '}
              <strong style={{ color: '#333333' }}>
                {(() => {
                  const maxItem = data.reduce((max, item) => item.validations > max.validations ? item : max, data[0]);
                  return getLabel(maxItem);
                })()}
              </strong>
            </p>
            <p>• Celkem aktivních členů: <strong style={{ color: '#333333' }}>1,247</strong></p>
            <p>• Průměrná doba ověření: <strong style={{ color: '#333333' }}>2.3 sekundy</strong></p>
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <Navigation userRole={userRole} />
    </main>
  );
}
