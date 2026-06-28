import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats, formatMonedaCRC, formatFechaCR, SEMAFORO_COLORS } from '../../lib/proyectosObraService';
import { SemaforoBadge } from '../../components/proyectos/SemaforoBadge';
import { LayoutDashboard, ArrowLeft, Building2, TrendingUp, Activity, PieChart, Layers } from 'lucide-react';

export default function ProyectosObraDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    cargarStats();
  }, []);

  const cargarStats = async () => {
    setLoading(true);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Error al cargar dashboard de proyectos:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#a1a1aa]">Cargando estadísticas del dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const porcentajeEjecucion = stats.totalAsignado > 0 
    ? Math.round((stats.totalEjecutado / stats.totalAsignado) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-4 md:p-8 space-y-8">
      {/* Navigation and Header */}
      <div className="space-y-4">
        <Link
          to="/proyectos-obra"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#a1a1aa] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Lista de Proyectos</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272a] pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
              <LayoutDashboard className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white">Dashboard de Proyectos</h1>
              <p className="text-sm text-[#a1a1aa]">Visión general y métricas clave de desarrollo de obras</p>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas Generales / Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-2">
          <div className="flex items-center justify-between text-[#71717a]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Proyectos</span>
            <Layers className="w-5 h-5 text-[#0071E3]" />
          </div>
          <p className="text-3xl font-black text-white">{stats.totalProyectos}</p>
          <p className="text-xs text-[#a1a1aa]">Proyectos registrados en la plataforma</p>
        </div>

        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-2">
          <div className="flex items-center justify-between text-[#71717a]">
            <span className="text-xs font-semibold uppercase tracking-wider">Presupuesto Asignado Vigente</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono">{formatMonedaCRC(stats.totalAsignado)}</p>
          <p className="text-xs text-[#a1a1aa]">Suma total de fondos asignados activos</p>
        </div>

        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-2">
          <div className="flex items-center justify-between text-[#71717a]">
            <span className="text-xs font-semibold uppercase tracking-wider">Presupuesto Ejecutado</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
              {porcentajeEjecucion}% Ejecutado
            </span>
          </div>
          <p className="text-2xl font-black text-purple-400 font-mono">{formatMonedaCRC(stats.totalEjecutado)}</p>
          <div className="w-full h-2 bg-[#27272a] rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(porcentajeEjecucion, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Grid Secundario: Semáforos y Dependencias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Conteo por Semáforo */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-[#0071E3]" />
              <span>Proyectos por Semáforo</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(stats.conteoSemaforo).map(([color, count]) => {
              const semConfig = SEMAFORO_COLORS[color as keyof typeof SEMAFORO_COLORS] || SEMAFORO_COLORS.Azul;
              return (
                <div
                  key={color}
                  className="flex items-center justify-between p-4 rounded-xl border transition-all"
                  style={{
                    backgroundColor: semConfig.badgeBg,
                    borderColor: semConfig.border
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: semConfig.bg }} />
                    <span className="font-bold text-white text-sm">{color}</span>
                  </div>
                  <span className="text-xl font-black text-white font-mono">{count as number}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Proyectos por Dependencia */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#0071E3]" />
              <span>Proyectos por Dependencia</span>
            </h3>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {Object.entries(stats.porDependencia).length === 0 ? (
              <p className="text-xs text-[#71717a]">No hay datos de dependencias disponibles.</p>
            ) : (
              Object.entries(stats.porDependencia).map(([dep, count]) => (
                <div key={dep} className="flex items-center justify-between bg-[#09090b] p-3 rounded-xl border border-[#27272a]">
                  <span className="text-sm font-medium text-[#f4f4f5] truncate max-w-[240px]">{dep}</span>
                  <span className="text-xs font-mono font-bold bg-[#27272a] px-3 py-1 rounded-full text-white">
                    {count as number} {count === 1 ? 'proyecto' : 'proyectos'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Últimas 5 entradas de seguimiento */}
      <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#0071E3]" />
            <span>Últimas 5 Entradas de Seguimiento</span>
          </h3>
        </div>

        {stats.ultimosSeguimientos.length === 0 ? (
          <p className="text-sm text-[#71717a] py-6 text-center">No se registran bitácoras recientes de seguimiento.</p>
        ) : (
          <div className="space-y-4">
            {stats.ultimosSeguimientos.map((seg: any) => (
              <div key={seg.id} className="bg-[#09090b] p-4 rounded-xl border border-[#27272a] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SemaforoBadge color={seg.semaforo} size="sm" />
                    <Link
                      to={`/proyectos-obra/${seg.proyecto_id}`}
                      className="font-bold text-white hover:text-[#0071E3] transition-colors text-sm"
                    >
                      {seg.proyecto_obra?.nombre_proyecto || `Proyecto ID: ${seg.proyecto_id}`}
                    </Link>
                  </div>
                  {seg.observaciones && (
                    <p className="text-xs text-[#a1a1aa] line-clamp-1">{seg.observaciones}</p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs shrink-0">
                  <span className="font-mono text-[#71717a]">Fecha corte: {formatFechaCR(seg.fecha_corte)}</span>
                  <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded">
                    {Math.round(seg.avance_registrado * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
