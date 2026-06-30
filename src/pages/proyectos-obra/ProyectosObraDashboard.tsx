import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { getDashboardStats, formatMonedaCRC, formatFechaCR } from '../../lib/proyectosObraService';
import {
  ArrowLeft, RefreshCw, AlertTriangle, TrendingUp, DollarSign, Briefcase,
  Clock, Activity, Filter, Layers
} from 'lucide-react';

export default function ProyectosObraDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [rawStats, setRawStats] = useState<any>(null);

  // Filtros interactivos
  const [filtroAnio, setFiltroAnio] = useState<string>('TODOS');


  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const data = await getDashboardStats();
      setRawStats(data);
    } catch (err) {
      console.error('Error cargando estadísticas del dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // CÁLCULOS Y PROCESAMIENTO DINÁMICO DE DATOS (Filtrados por año)
  // ---------------------------------------------------------
  const proyectosFiltrados = useMemo(() => {
    if (!rawStats?.proyectos) return [];
    if (filtroAnio === 'TODOS') return rawStats.proyectos;
    return rawStats.proyectos.filter((p: any) => String(p.anio) === filtroAnio);
  }, [rawStats, filtroAnio]);

  // KPIs principales
  const kpis = useMemo(() => {
    const total = proyectosFiltrados.length;
    let finalizados = 0;
    let enEjecucion = 0;
    let sinIniciar = 0;
    let sumaAvance = 0;
    let riesgoCount = 0;

    let totalAsignado = 0;
    let totalEjecutado = 0;

    proyectosFiltrados.forEach((p: any) => {
      const avance = Number(p.avance_poa ?? p.cumplimiento_poa ?? 0);
      sumaAvance += avance;

      const estadoStr = (p.estado || '').toLowerCase();
      if (estadoStr.includes('finaliz') || avance >= 1) {
        finalizados++;
      } else if (avance > 0 || estadoStr.includes('ejecu') || estadoStr.includes('activo')) {
        enEjecucion++;
      } else {
        sinIniciar++;
      }

      if (avance < 0.30) {
        riesgoCount++;
      }

      // Presupuesto desde el mapa
      const pres = rawStats?.presupuestosMap?.get(p.id);
      if (pres) {
        totalAsignado += Number(pres.presupuesto_asignado || 0);
        totalEjecutado += Number(pres.presupuesto_ejecutado || 0);
      }
    });

    const avancePromedio = total > 0 ? (sumaAvance / total) : 0;
    const pctEjecucionPresupuesto = totalAsignado > 0 ? Math.round((totalEjecutado / totalAsignado) * 100) : 0;

    return {
      total,
      finalizados,
      enEjecucion,
      sinIniciar,
      avancePromedio,
      totalAsignado,
      totalEjecutado,
      pctEjecucionPresupuesto,
      riesgoCount
    };
  }, [proyectosFiltrados, rawStats]);

  // 1. Carga por Profesional
  const cargaProfesionalesData = useMemo(() => {
    if (!proyectosFiltrados.length) return [];
    const profMap = new Map<string, { total: number; sumaAvance: number; riesgo: number }>();

    proyectosFiltrados.forEach((p: any) => {
      const respKey = p.profesional_responsable
        ? (rawStats?.colabMap?.get(String(p.profesional_responsable).trim()) || p.profesional_responsable)
        : 'Sin Asignar';

      if (!profMap.has(respKey)) {
        profMap.set(respKey, { total: 0, sumaAvance: 0, riesgo: 0 });
      }
      const item = profMap.get(respKey)!;
      item.total++;
      const avance = Number(p.avance_poa ?? p.cumplimiento_poa ?? 0);
      item.sumaAvance += avance;
      if (avance < 0.30) item.riesgo++;
    });

    return Array.from(profMap.entries()).map(([nombre, datos]) => {
      const promAvance = datos.total > 0 ? (datos.sumaAvance / datos.total) : 0;
      let fillColor = '#3b82f6'; // Azul estándar
      if (promAvance < 0.30) fillColor = '#ef4444'; // Rojo si avance < 30%

      return {
        nombre,
        proyectos: datos.total,
        promAvance: Math.round(promAvance * 100),
        riesgo: datos.riesgo,
        fillColor
      };
    }).sort((a, b) => b.proyectos - a.proyectos);
  }, [proyectosFiltrados, rawStats]);

  // 2. Presupuesto Asignado por Profesional (Barras apiladas en millones)
  const presupuestoProfesionalesData = useMemo(() => {
    if (!proyectosFiltrados.length) return [];
    const profMap = new Map<string, { asignado: number; ejecutado: number }>();

    proyectosFiltrados.forEach((p: any) => {
      const respKey = p.profesional_responsable
        ? (rawStats?.colabMap?.get(String(p.profesional_responsable).trim()) || p.profesional_responsable)
        : 'Sin Asignar';

      if (!profMap.has(respKey)) {
        profMap.set(respKey, { asignado: 0, ejecutado: 0 });
      }
      const item = profMap.get(respKey)!;
      const pres = rawStats?.presupuestosMap?.get(p.id);
      if (pres) {
        item.asignado += Number(pres.presupuesto_asignado || 0);
        item.ejecutado += Number(pres.presupuesto_ejecutado || 0);
      }
    });

    return Array.from(profMap.entries()).map(([nombre, datos]) => {
      const asignadoM = datos.asignado / 1000000;
      const ejecutadoM = datos.ejecutado / 1000000;
      const restanteM = Math.max(0, asignadoM - ejecutadoM);
      const pctEjecucion = datos.asignado > 0 ? Math.round((datos.ejecutado / datos.asignado) * 100) : 0;

      return {
        nombre,
        ejecutadoM: Number(ejecutadoM.toFixed(1)),
        restanteM: Number(restanteM.toFixed(1)),
        asignadoTotal: datos.asignado,
        ejecutadoTotal: datos.ejecutado,
        pctEjecucion
      };
    }).filter(d => d.asignadoTotal > 0).sort((a, b) => b.asignadoTotal - a.asignadoTotal);
  }, [proyectosFiltrados, rawStats]);



  // 4. Proyectos por Fase Activa
  const fasesActivasData = useMemo(() => {
    const fasesMap = new Map<string, { count: number; sumaAvance: number }>();
    const nombresFases = ['Inicio y Estudios Preliminares', 'Planeación y Diseños', 'Ejecución y Construcción', 'Recepción y Cierre'];
    nombresFases.forEach(f => fasesMap.set(f, { count: 0, sumaAvance: 0 }));

    proyectosFiltrados.forEach((p: any) => {
      const fasesProj = rawStats?.fasesMap?.get(p.id) || [];
      const faseEnProgreso = fasesProj.find((f: any) => !f.completada) || fasesProj[fasesProj.length - 1];
      const nombreFase = faseEnProgreso ? faseEnProgreso.fase.replace(/_/g, ' ') : 'Inicio y Estudios Preliminares';
      
      if (!fasesMap.has(nombreFase)) {
        fasesMap.set(nombreFase, { count: 0, sumaAvance: 0 });
      }
      const item = fasesMap.get(nombreFase)!;
      item.count++;
      item.sumaAvance += Number(p.avance_poa ?? 0);
    });

    return Array.from(fasesMap.entries()).map(([fase, datos]) => ({
      fase,
      proyectos: datos.count,
      promAvance: datos.count > 0 ? Math.round((datos.sumaAvance / datos.count) * 100) : 0
    }));
  }, [proyectosFiltrados, rawStats]);

  // 5. Tabla de alertas (Proyectos con avance menor a 30%)
  const tablaAlertasProyectos = useMemo(() => {
    if (!proyectosFiltrados.length) return [];
    
    // Filter projects where progress is low (less than 30%)
    const filtrados = proyectosFiltrados.filter((p: any) => {
      const avance = Number(p.avance_poa ?? p.cumplimiento_poa ?? 0);
      return avance < 0.30;
    });

    return filtrados.map((p: any) => {
      const seg = rawStats?.ultimosSeguimientosMap?.get(p.id);
      const respNombre = p.profesional_responsable
        ? (rawStats?.colabMap?.get(String(p.profesional_responsable).trim()) || p.profesional_responsable)
        : 'Sin Asignar';

      return {
        id: p.id,
        nombre: p.nombre_proyecto,
        responsable: respNombre,
        avance: Math.round(Number(p.avance_poa ?? 0) * 100),
        observacion: seg?.observaciones || p.observaciones_meta_poa || 'Sin observaciones registradas',
        fechaUltimoRegistro: formatFechaCR(seg?.fecha_corte || seg?.creado_en)
      };
    });
  }, [proyectosFiltrados, rawStats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#a1a1aa]">Cargando Dashboard Ejecutivo de Proyectos SDMO...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-4 md:p-8 space-y-8">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272a] pb-6">
        <div>
          <Link
            to="/proyectos-obra"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#a1a1aa] hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a Lista de Proyectos</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white">Dashboard Ejecutivo SDMO</h1>
              <p className="text-sm text-[#a1a1aa]">Monitoreo estratégico y portafolio de obras de la Municipalidad de San José</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Selector de Año */}
          <div className="flex items-center gap-2 bg-[#18181b] px-3 py-2 rounded-xl border border-[#27272a]">
            <Filter className="w-4 h-4 text-[#0071E3]" />
            <span className="text-xs text-[#a1a1aa] font-semibold">Año:</span>
            <select
              value={filtroAnio}
              onChange={(e) => setFiltroAnio(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value="TODOS" className="bg-[#18181b]">Todos los años</option>
              <option value="2026" className="bg-[#18181b]">2026</option>
              <option value="2025" className="bg-[#18181b]">2025</option>
              <option value="2024" className="bg-[#18181b]">2024</option>
              <option value="2023" className="bg-[#18181b]">2023</option>
            </select>
          </div>

          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-semibold transition-all border border-[#3f3f46]/50 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#0071E3]" />
            <span>Actualizar datos</span>
          </button>
        </div>
      </div>

      {/* FILA 1 — KPIS PRINCIPALES (4 TARJETAS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Total Proyectos */}
        <div className="bg-[#18181b] p-5 rounded-2xl border border-[#27272a] shadow-xl space-y-3">
          <div className="flex justify-between items-center text-[#a1a1aa]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Proyectos</span>
            <Layers className="w-5 h-5 text-[#0071E3]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{kpis.total}</span>
            <span className="text-xs text-[#a1a1aa]">obras</span>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-[#27272a] text-[10px] text-center">
            <div className="bg-emerald-500/10 text-emerald-400 p-1.5 rounded font-bold border border-emerald-500/20">
              {kpis.finalizados} Fin.
            </div>
            <div className="bg-blue-500/10 text-blue-400 p-1.5 rounded font-bold border border-blue-500/20">
              {kpis.enEjecucion} Ejec.
            </div>
            <div className="bg-amber-500/10 text-amber-400 p-1.5 rounded font-bold border border-amber-500/20">
              {kpis.sinIniciar} Sin in.
            </div>
          </div>
        </div>

        {/* KPI 2: Avance POA Promedio */}
        <div className="bg-[#18181b] p-5 rounded-2xl border border-[#27272a] shadow-xl flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider block">Avance POA Promedio</span>
            <span className="text-3xl font-black text-emerald-400 font-mono">
              {Math.round(kpis.avancePromedio * 100)}%
            </span>
            <span className="text-[11px] text-[#71717a] block">Cumplimiento metas físicas</span>
          </div>

          <div className="w-16 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Avance', value: kpis.avancePromedio },
                    { name: 'Restante', value: Math.max(0, 1 - kpis.avancePromedio) }
                  ]}
                  innerRadius={18}
                  outerRadius={28}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#22c55e" />
                  <Cell fill="#27272a" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI 3: Presupuesto Asignado vs Ejecutado */}
        <div className="bg-[#18181b] p-5 rounded-2xl border border-[#27272a] shadow-xl space-y-3">
          <div className="flex justify-between items-center text-[#a1a1aa]">
            <span className="text-xs font-semibold uppercase tracking-wider">Presupuesto Vigente</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-[#a1a1aa]">Ejecutado:</span>
              <span className="text-lg font-black text-white font-mono">{formatMonedaCRC(kpis.totalEjecutado)}</span>
            </div>
            <div className="w-full bg-[#09090b] h-2 rounded-full overflow-hidden mt-1.5 mb-1.5 border border-[#27272a]">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, kpis.pctEjecucionPresupuesto)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-[#71717a]">
              <span>Asignado: {formatMonedaCRC(kpis.totalAsignado)}</span>
              <span className="font-bold text-emerald-400 font-mono">{kpis.pctEjecucionPresupuesto}% ejec.</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Proyectos en Riesgo (Alerta Parpadeante) */}
        <div className={`p-5 rounded-2xl border shadow-xl flex items-center justify-between transition-all ${
          kpis.riesgoCount > 0 
            ? 'bg-rose-950/20 border-rose-500/40 animate-pulse' 
            : 'bg-[#18181b] border-[#27272a]'
        }`}>
          <div className="space-y-2">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Proyectos en Riesgo</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-500 font-mono">{kpis.riesgoCount}</span>
              <span className="text-xs text-rose-300 font-semibold">Avance &lt; 30%</span>
            </div>
            <span className="text-[11px] text-[#a1a1aa] block">Requieren atención inmediata</span>
          </div>
        </div>
      </div>

      {/* FILA 2 — GRÁFICOS PRINCIPALES DE CARGA Y PRESUPUESTO POR PROFESIONAL (2 COLUMNAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Carga por Profesional (Barras Horizontales) */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#0071E3]" />
              <span>Carga por Profesional Responsable</span>
            </h3>
            <span className="text-[11px] text-[#71717a]">Color según avance prom.</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={cargaProfesionalesData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" stroke="#71717a" fontSize={11} />
                <YAxis type="category" dataKey="nombre" stroke="#a1a1aa" fontSize={11} width={110} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#09090b] p-3 rounded-xl border border-[#27272a] text-xs text-white space-y-1.5 shadow-2xl">
                          <p className="font-bold text-[#0071E3] border-b border-[#27272a] pb-1">{d.nombre}</p>
                          <p>Total Proyectos: <strong className="font-mono">{d.proyectos}</strong></p>
                          <p>Promedio Avance: <strong className="font-mono text-emerald-400">{d.promAvance}%</strong></p>
                          <p>Proyectos en Riesgo: <strong className="font-mono text-rose-400">{d.riesgo}</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="proyectos" radius={[0, 6, 6, 0]}>
                  {cargaProfesionalesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fillColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Presupuesto Asignado por Profesional (Barras Horizontales Apiladas) */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Presupuesto Asignado por Profesional</span>
            </h3>
            <span className="text-[11px] text-[#71717a]">En Millones de Colones</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={presupuestoProfesionalesData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" stroke="#71717a" fontSize={11} tickFormatter={(v) => `₡${v}M`} />
                <YAxis type="category" dataKey="nombre" stroke="#a1a1aa" fontSize={11} width={110} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#09090b] p-3 rounded-xl border border-[#27272a] text-xs text-white space-y-1.5 shadow-2xl">
                          <p className="font-bold text-[#0071E3] border-b border-[#27272a] pb-1">{d.nombre}</p>
                          <p>Presupuesto Asignado Total: <strong className="font-mono text-white">{formatMonedaCRC(d.asignadoTotal)}</strong></p>
                          <p>Presupuesto Ejecutado: <strong className="font-mono text-emerald-400">{formatMonedaCRC(d.ejecutadoTotal)}</strong></p>
                          <p>Porcentaje Ejecución: <strong className="font-mono text-blue-400">{d.pctEjecucion}%</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="ejecutadoM" name="Ejecutado (M)" stackId="a" fill="#22c55e" />
                <Bar dataKey="restanteM" name="Restante (M)" stackId="a" fill="#3b82f6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* FILA 3 — GRÁFICOS SECUNDARIOS: FASES ACTIVAS */}
      <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Proyectos por Fase Activa</span>
          </h3>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={fasesActivasData} margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
              <XAxis type="number" stroke="#71717a" fontSize={11} />
              <YAxis type="category" dataKey="fase" stroke="#a1a1aa" fontSize={10} width={130} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-[#09090b] p-3 rounded-xl border border-[#27272a] text-xs text-white space-y-1 shadow-xl">
                        <p className="font-bold text-amber-400 border-b border-[#27272a] pb-1">{d.fase}</p>
                        <p>Proyectos en esta fase: <strong className="font-mono">{d.proyectos}</strong></p>
                        <p>Promedio Avance: <strong className="font-mono text-emerald-400">{d.promAvance}%</strong></p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="proyectos" fill="#0071E3" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FILA 4 — TABLA DE ALERTAS (PROYECTOS QUE REQUIEREN ATENCIÓN) */}
      <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a] pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <span>Proyectos que Requieren Atención</span>
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Mostrando obras con avance menor al 30%
            </p>
          </div>
        </div>

        {tablaAlertasProyectos.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-[#27272a] bg-[#09090b]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18181b] text-[#71717a] uppercase font-semibold border-b border-[#27272a]">
                <tr>
                  <th className="px-4 py-3">Nombre del Proyecto</th>
                  <th className="px-4 py-3">Profesional Responsable</th>
                  <th className="px-4 py-3">Avance POA</th>
                  <th className="px-4 py-3">Última Observación</th>
                  <th className="px-4 py-3">Último Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]/50 text-[#f4f4f5]">
                {tablaAlertasProyectos.map((p: any) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/proyectos-obra/${p.id}`)}
                    className="hover:bg-[#18181b]/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3.5 font-bold text-white group-hover:text-[#0071E3] transition-colors max-w-xs truncate">
                      {p.nombre}
                    </td>
                    <td className="px-4 py-3.5 text-[#a1a1aa] font-medium whitespace-nowrap">
                      {p.responsable}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-[#27272a] h-2 rounded-full overflow-hidden border border-[#3f3f46]/50">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, p.avance)}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-white">{p.avance}%</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-[#a1a1aa] max-w-md truncate" title={p.observacion}>
                      {p.observacion.length > 80 ? p.observacion.substring(0, 80) + '...' : p.observacion}
                    </td>
                    <td className="px-4 py-3.5 text-[#71717a] font-mono whitespace-nowrap">
                      {p.fechaUltimoRegistro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-[#71717a] py-8 text-center bg-[#09090b] rounded-xl border border-[#27272a]">
            No hay proyectos que requieran atención.
          </p>
        )}
      </div>
    </div>
  );
}
