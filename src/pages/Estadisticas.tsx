import React, { useEffect, useState } from 'react';
import { supabase, checkTableExists } from '../lib/supabase';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Award, TrendingUp, Package, Star, Users } from 'lucide-react';
import 'chart.js/auto';

type TopResident = { name: string; count: number };

type Stats = {
  months: string[];
  createdByMonth: Record<string, number>;
  claimsByStatus: {
    claimed: Record<string, number>;
    completed: Record<string, number>;
    cancelled: Record<string, number>;
    delayed: Record<string, number>;
  };
  autosByMonth: Record<string, number>;
  topResidents: TopResident[];
};

const Estadisticas: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimsAvailable, setClaimsAvailable] = useState<boolean>(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // Puntos creados por mes
        const { data: createdPoints } = await supabase
          .from('concentration_points')
          .select('id, created_at, user_id, status');
        // Reclamos por mes y estado
        let claims = [] as any[];
        try {
          const exists = await checkTableExists('concentration_claims');
          setClaimsAvailable(!!exists);
          if (exists) {
            const { data } = await supabase
              .from('concentration_claims')
              .select('id, created_at, status, completed_at, cancelled_at');
            claims = data || [];
          } else {
            claims = [];
          }
        } catch (err) {
          console.warn('No se pudieron obtener claims (tabla ausente):', err);
          setClaimsAvailable(false);
          claims = [];
        }
        // Dirigentes más comprometidos
        const { data: residentPoints } = await supabase
          .from('concentration_points')
          .select('user_id');
        // Procesamiento de datos
        const now = new Date();
        const months = Array.from({ length: 12 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }).reverse();
        // Puntos creados por mes
        const createdByMonth: Record<string, number> = {};
        (createdPoints || []).forEach(p => {
          const m = p.created_at?.slice(0, 7);
          if (m) createdByMonth[m] = (createdByMonth[m] || 0) + 1;
        });
        // Reclamos por estado y mes
        const claimsByStatus: {
          claimed: Record<string, number>;
          completed: Record<string, number>;
          cancelled: Record<string, number>;
          delayed: Record<string, number>;
        } = {
          claimed: {}, completed: {}, cancelled: {}, delayed: {}
        };
        (claims || []).forEach(c => {
          const m = c.created_at?.slice(0, 7);
          if (c.status === 'claimed') claimsByStatus.claimed[m] = (claimsByStatus.claimed[m] || 0) + 1;
          if (c.status === 'completed') claimsByStatus.completed[m] = (claimsByStatus.completed[m] || 0) + 1;
          if (c.status === 'cancelled') claimsByStatus.cancelled[m] = (claimsByStatus.cancelled[m] || 0) + 1;
          if (c.status === 'delayed') claimsByStatus.delayed[m] = (claimsByStatus.delayed[m] || 0) + 1;
        });
        // autos por mes (igual a completed)
        const autosByMonth = { ...claimsByStatus.completed };
        // Dirigentes más comprometidos
        const residentCount: Record<string, number> = {};
        (residentPoints || []).forEach(p => {
          if (!p.user_id) return;
          residentCount[p.user_id] = (residentCount[p.user_id] || 0) + 1;
        });
        const topResidentsRaw = Object.entries(residentCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        let topResidents: { name: string; count: number }[] = [];
        if (topResidentsRaw.length > 0) {
          const topUserIds = topResidentsRaw.map(([userId]) => userId);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', topUserIds);
          const nameMap: Record<string, string> = {};
          (profilesData || []).forEach(p => {
            nameMap[p.user_id] = p.name || 'Usuario Anónimo';
          });
          topResidents = topResidentsRaw.map(([userId, count]) => ({ name: nameMap[userId] || userId, count }));
        }
        setStats({ months, createdByMonth, claimsByStatus, autosByMonth, topResidents });
        setError(null);
      } catch {
        setError('Error al cargar estadísticas');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-800 mb-6 flex items-center gap-2">
          <Award className="w-8 h-8 text-yellow-400" /> Estadísticas Generales
        </h1>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-blue-300 border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-blue-700 font-semibold">Cargando estadísticas...</span>
          </div>
        ) : error ? (
          <div className="text-red-600 font-semibold">{error}</div>
        ) : stats && (
          <div className="space-y-10">
            {!claimsAvailable && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">Las métricas relacionadas con reclamos no están disponibles porque la tabla <code>concentration_claims</code> no existe en la base de datos.</div>
            )}
            {/* Gráfico de barras: Puntos creados y reclamos por mes */}
            <div className="bg-white rounded-xl p-6 shadow">
              <h2 className="text-xl font-bold text-blue-700 mb-2 flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Puntos y Reclamos por Mes</h2>
              <Bar
                data={{
                  labels: stats.months,
                  datasets: [
                    {
                      label: 'Puntos Creados',
                      data: stats.months.map((m: string) => stats.createdByMonth[m] || 0),
                      backgroundColor: '#34d399',
                    },
                    {
                      label: 'Reclamados',
                      data: stats.months.map((m: string) => stats.claimsByStatus.claimed[m] || 0),
                      backgroundColor: '#60a5fa',
                    },
                    {
                      label: 'Retirados',
                      data: stats.months.map((m: string) => stats.claimsByStatus.completed[m] || 0),
                      backgroundColor: '#a78bfa',
                    },
                    {
                      label: 'Cancelados',
                      data: stats.months.map((m: string) => stats.claimsByStatus.cancelled[m] || 0),
                      backgroundColor: '#fbbf24',
                    },
                    {
                      label: 'Demorados',
                      data: stats.months.map((m: string) => stats.claimsByStatus.delayed[m] || 0),
                      backgroundColor: '#f472b6',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'top' as const } },
                  scales: { y: { beginAtZero: true } },
                }}
                height={300}
              />
            </div>
            {/* Donut: Proporción de estados de reclamos */}
            <div className="bg-white rounded-xl p-6 shadow flex flex-col items-center">
              <h2 className="text-xl font-bold text-blue-700 mb-2 flex items-center gap-2"><Package className="w-5 h-5" /> Proporción de Reclamos</h2>
              <Doughnut
                data={{
                  labels: ['Reclamados', 'Retirados', 'Cancelados', 'Demorados'],
                  datasets: [
                    {
                      data: [
                        (Object.values(stats.claimsByStatus.claimed) as number[]).reduce((a, b) => a + b, 0),
                        (Object.values(stats.claimsByStatus.completed) as number[]).reduce((a, b) => a + b, 0),
                        (Object.values(stats.claimsByStatus.cancelled) as number[]).reduce((a, b) => a + b, 0),
                        (Object.values(stats.claimsByStatus.delayed) as number[]).reduce((a, b) => a + b, 0),
                      ],
                      backgroundColor: ['#60a5fa', '#a78bfa', '#fbbf24', '#f472b6'],
                    },
                  ],
                }}
                options={{ responsive: true, plugins: { legend: { position: 'bottom' as const } } }}
                width={300}
                height={300}
              />
            </div>
            {/* autos por mes */}
            <div className="bg-white rounded-xl p-6 shadow">
              <h2 className="text-xl font-bold text-purple-700 mb-2 flex items-center gap-2"><Star className="w-5 h-5" /> autos Retirados por Mes</h2>
              <Bar
                data={{
                  labels: stats.months,
                  datasets: [
                    {
                      label: 'autos Retirados',
                      data: stats.months.map((m: string) => stats.autosByMonth[m] || 0),
                      backgroundColor: '#a78bfa',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'top' as const } },
                  scales: { y: { beginAtZero: true } },
                }}
                height={300}
              />
            </div>
            {/* Dirigentes más comprometidos */}
            <div className="bg-white rounded-xl p-6 shadow flex flex-col items-center">
              <h2 className="text-xl font-bold text-blue-700 mb-2 flex items-center gap-2"><Users className="w-5 h-5" /> Dirigentes más comprometidos</h2>
              <Bar
                data={{
                  labels: stats.topResidents.map((r: TopResident) => r.name),
                  datasets: [
                    {
                      label: 'Puntos creados',
                      data: stats.topResidents.map((r: TopResident) => r.count),
                      backgroundColor: '#34d399',
                    },
                  ],
                }}
                options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
                height={200}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Estadisticas;
