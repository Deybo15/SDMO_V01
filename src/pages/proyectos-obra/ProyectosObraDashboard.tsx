import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LabelList,
  PieChart, Pie, Cell
} from 'recharts';
import {
  getDashboardStats,
  formatMonedaCRC,
  formatFechaCR,
  formatProgressPercent,
  normalizeProgressFraction
} from '../../lib/proyectosObraService';
import {
  ArrowLeft, RefreshCw, AlertTriangle, TrendingUp, DollarSign, Briefcase,
  Clock, Activity, Filter, Layers, FileText, Flag, ShieldCheck, Gift
} from 'lucide-react';
import {
  FASE_PROYECTO_OPTIONS,
  getCatalogLabel,
  getFaseProyectoOrder
} from '../../lib/proyectosObraCatalogos';

const formatProfessionalAxisLabel = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 4) {
    return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3].charAt(0)}.`;
  }
  return name.length <= 22 ? name : `${name.slice(0, 20)}…`;
};

export default function ProyectosObraDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [rawStats, setRawStats] = useState<any>(null);

  // Filtros interactivos
  const [filtroAnio, setFiltroAnio] = useState<string>('TODOS');

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const next30Days = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  }, []);


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
      const avance = normalizeProgressFraction(p.avance_poa ?? 0);
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
      const avance = normalizeProgressFraction(p.avance_poa ?? 0);
      item.sumaAvance += avance;
      if (avance < 0.30) item.riesgo++;
    });

    return Array.from(profMap.entries()).map(([nombre, datos]) => {
      const promAvance = datos.total > 0 ? (datos.sumaAvance / datos.total) : 0;
      return {
        nombre,
        proyectos: datos.total,
        promAvance: Math.round(promAvance * 100),
        riesgo: datos.riesgo
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
        asignadoM: Number(asignadoM.toFixed(1)),
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
    FASE_PROYECTO_OPTIONS.forEach(f => fasesMap.set(f.label, { count: 0, sumaAvance: 0 }));

    proyectosFiltrados.forEach((p: any) => {
      const fasesProj = rawStats?.fasesMap?.get(p.id) || [];
      const fasesOrdenadas = [...fasesProj].sort((a: any, b: any) => getFaseProyectoOrder(a.fase) - getFaseProyectoOrder(b.fase));
      const faseEnProgreso = fasesOrdenadas.find((f: any) => !f.completada) || fasesOrdenadas[fasesOrdenadas.length - 1];
      const nombreFase = faseEnProgreso
        ? getCatalogLabel(faseEnProgreso.fase, FASE_PROYECTO_OPTIONS)
        : FASE_PROYECTO_OPTIONS[0].label;
      
      if (!fasesMap.has(nombreFase)) {
        fasesMap.set(nombreFase, { count: 0, sumaAvance: 0 });
      }
      const item = fasesMap.get(nombreFase)!;
      item.count++;
      item.sumaAvance += normalizeProgressFraction(p.avance_poa ?? 0);
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
      const avance = normalizeProgressFraction(p.avance_poa ?? 0);
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
        avance: formatProgressPercent(p.avance_poa ?? 0),
        observacion: seg?.observaciones || p.observaciones_meta_poa || 'Sin observaciones registradas',
        fechaUltimoRegistro: formatFechaCR(seg?.fecha_corte || seg?.creado_en)
      };
    });
  }, [proyectosFiltrados, rawStats]);

  const indicadoresGestion = useMemo(() => {
    const ids = new Set(proyectosFiltrados.map((p: any) => p.id));
    const permisos = (rawStats?.permisos || []).filter((p: any) => ids.has(p.proyecto_id));
    const hitos = (rawStats?.hitos || []).filter((h: any) => ids.has(h.proyecto_id));
    const garantias = (rawStats?.garantias || []).filter((g: any) => ids.has(g.proyecto_id));
    const documentos = (rawStats?.documentos || []).filter((d: any) => ids.has(d.proyecto_id));
    const donaciones = (rawStats?.donaciones || []).filter((d: any) => ids.has(d.proyecto_id));

    const permisosPendientes = permisos.filter((p: any) => {
      const estado = String(p.estado || '').toLowerCase();
      return estado.includes('pendiente') || estado.includes('tramite') || estado.includes('trámite');
    }).length;

    const permisosVencidos = permisos.filter((p: any) => {
      const estado = String(p.estado || '').toLowerCase();
      return estado.includes('vencido') || (!!p.fecha_vencimiento && p.fecha_vencimiento < today);
    }).length;

    const hitosAtrasados = hitos.filter((h: any) => {
      const estado = String(h.estado || '').toLowerCase();
      return !estado.includes('completado') && !!h.fecha_plan && h.fecha_plan < today;
    }).length;

    const garantiasPorVencer = garantias.filter((g: any) => {
      const estado = String(g.estado || '').toLowerCase();
      return !estado.includes('liberada') && !estado.includes('ejecutada') && !!g.fecha_vencimiento && g.fecha_vencimiento >= today && g.fecha_vencimiento <= next30Days;
    }).length;

    const garantiasVencidas = garantias.filter((g: any) => {
      const estado = String(g.estado || '').toLowerCase();
      return estado.includes('vencida') || (!!g.fecha_vencimiento && g.fecha_vencimiento < today);
    }).length;

    const valorDonaciones = donaciones.reduce((total: number, d: any) => total + (Number(d.valor_estimado) || 0), 0);

    return {
      permisosPendientes,
      permisosVencidos,
      hitosAtrasados,
      garantiasPorVencer,
      garantiasVencidas,
      documentosTotal: documentos.length,
      valorDonaciones
    };
  }, [proyectosFiltrados, rawStats, next30Days, today]);

  const alertasOperativas = useMemo(() => {
    const proyectosMap = new Map(proyectosFiltrados.map((p: any) => [p.id, p]));
    const alertas: Array<{ id: string; proyectoId: string | number; proyecto: string; tipo: string; detalle: string; fecha: string; severidad: 'alta' | 'media' }> = [];

    (rawStats?.permisos || []).forEach((permiso: any) => {
      const proyecto = proyectosMap.get(permiso.proyecto_id);
      if (!proyecto) return;
      const estado = String(permiso.estado || '').toLowerCase();
      if (estado.includes('vencido') || (!!permiso.fecha_vencimiento && permiso.fecha_vencimiento < today)) {
        alertas.push({
          id: `permiso-${permiso.id}`,
          proyectoId: proyecto.id,
          proyecto: proyecto.nombre_proyecto,
          tipo: 'Permiso vencido',
          detalle: `${permiso.tipo_permiso || 'Permiso'} - ${permiso.entidad_emisora || 'Entidad no indicada'}`,
          fecha: formatFechaCR(permiso.fecha_vencimiento),
          severidad: 'alta'
        });
      } else if (estado.includes('pendiente') || estado.includes('tramite') || estado.includes('trámite')) {
        alertas.push({
          id: `permiso-${permiso.id}`,
          proyectoId: proyecto.id,
          proyecto: proyecto.nombre_proyecto,
          tipo: 'Permiso pendiente',
          detalle: `${permiso.tipo_permiso || 'Permiso'} - ${permiso.entidad_emisora || 'Entidad no indicada'}`,
          fecha: formatFechaCR(permiso.fecha_solicitud || permiso.creado_en),
          severidad: 'media'
        });
      }
    });

    (rawStats?.hitos || []).forEach((hito: any) => {
      const proyecto = proyectosMap.get(hito.proyecto_id);
      if (!proyecto || !hito.fecha_plan || hito.fecha_plan >= today) return;
      const estado = String(hito.estado || '').toLowerCase();
      if (estado.includes('completado')) return;
      alertas.push({
        id: `hito-${hito.id}`,
        proyectoId: proyecto.id,
        proyecto: proyecto.nombre_proyecto,
        tipo: 'Hito atrasado',
        detalle: hito.nombre || 'Hito sin nombre',
        fecha: formatFechaCR(hito.fecha_plan),
        severidad: 'alta'
      });
    });

    (rawStats?.garantias || []).forEach((garantia: any) => {
      const proyecto = proyectosMap.get(garantia.proyecto_id);
      if (!proyecto || !garantia.fecha_vencimiento) return;
      const estado = String(garantia.estado || '').toLowerCase();
      if (estado.includes('liberada') || estado.includes('ejecutada')) return;
      if (garantia.fecha_vencimiento < today || estado.includes('vencida')) {
        alertas.push({
          id: `garantia-${garantia.id}`,
          proyectoId: proyecto.id,
          proyecto: proyecto.nombre_proyecto,
          tipo: 'Garantia vencida',
          detalle: `${garantia.tipo_garantia || 'Garantia'} - ${garantia.entidad_emisora || 'Entidad no indicada'}`,
          fecha: formatFechaCR(garantia.fecha_vencimiento),
          severidad: 'alta'
        });
      } else if (garantia.fecha_vencimiento <= next30Days) {
        alertas.push({
          id: `garantia-${garantia.id}`,
          proyectoId: proyecto.id,
          proyecto: proyecto.nombre_proyecto,
          tipo: 'Garantia por vencer',
          detalle: `${garantia.tipo_garantia || 'Garantia'} - ${garantia.entidad_emisora || 'Entidad no indicada'}`,
          fecha: formatFechaCR(garantia.fecha_vencimiento),
          severidad: 'media'
        });
      }
    });

    return alertas.sort((a, b) => {
      const prioridad = a.severidad === b.severidad ? 0 : a.severidad === 'alta' ? -1 : 1;
      return prioridad || a.fecha.localeCompare(b.fecha);
    }).slice(0, 12);
  }, [proyectosFiltrados, rawStats, next30Days, today]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#d4d4d8] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#a1a1aa]">Cargando Dashboard Ejecutivo de Proyectos SDMO...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#f4f4f5] p-4 md:p-8 space-y-8 selection:bg-white/20">
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
            <div className="p-3 rounded-xl bg-[#111112] text-[#e4e4e7] border border-[#71717a]">
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
            <Filter className="w-4 h-4 text-[#d4d4d8]" />
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
            <RefreshCw className="w-3.5 h-3.5 text-[#d4d4d8]" />
            <span>Actualizar datos</span>
          </button>
        </div>
      </div>

      {/* FILA 1 — KPIS PRINCIPALES (4 TARJETAS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Total Proyectos */}
        <div className="bg-[#111112] p-5 rounded-xl border border-[#71717a] space-y-3">
          <div className="flex justify-between items-center text-[#a1a1aa]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Proyectos</span>
            <Layers className="w-5 h-5 text-[#d4d4d8]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{kpis.total}</span>
            <span className="text-xs text-[#a1a1aa]">obras</span>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-[#27272a] text-[10px] text-center">
            <div className="bg-[#e4e4e7] text-[#111112] p-1.5 rounded font-bold border border-white">
              {kpis.finalizados} Fin.
            </div>
            <div className="bg-[#3f3f46] text-white p-1.5 rounded font-bold border border-[#a1a1aa]">
              {kpis.enEjecucion} Ejec.
            </div>
            <div className="bg-[#18181b] text-[#a1a1aa] p-1.5 rounded font-bold border border-[#52525b]">
              {kpis.sinIniciar} Sin in.
            </div>
          </div>
        </div>

        {/* KPI 2: Avance POA Promedio */}
        <div className="bg-[#111112] p-5 rounded-xl border border-[#52525b] flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider block">Avance POA Promedio</span>
            <span className="text-3xl font-black text-white font-mono">
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
                  <Cell fill="#d4d4d8" stroke="#ffffff" strokeWidth={1} />
                  <Cell fill="#27272a" stroke="#71717a" strokeWidth={1} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI 3: Presupuesto Asignado vs Ejecutado */}
        <div className="bg-[#111112] p-5 rounded-xl border border-[#52525b] space-y-3">
          <div className="flex justify-between items-center text-[#a1a1aa]">
            <span className="text-xs font-semibold uppercase tracking-wider">Presupuesto Vigente</span>
            <DollarSign className="w-5 h-5 text-[#d4d4d8]" />
          </div>
          <div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-[#a1a1aa]">Ejecutado:</span>
              <span className="text-lg font-black text-white font-mono">{formatMonedaCRC(kpis.totalEjecutado)}</span>
            </div>
            <div className="w-full bg-[#18181b] h-3 rounded-[3px] overflow-hidden mt-2 mb-2 border border-[#a1a1aa]">
              <div
                className="h-full transition-all duration-500 border-r border-white"
                style={{
                  width: `${Math.min(100, kpis.pctEjecucionPresupuesto)}%`,
                  backgroundColor: '#27272a',
                  backgroundImage: 'repeating-linear-gradient(135deg, transparent 0, transparent 5px, rgba(255,255,255,0.7) 5px, rgba(255,255,255,0.7) 6px)',
                  boxShadow: 'inset 0 0 0 1px #a1a1aa'
                }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-[#71717a]">
              <span>Asignado: {formatMonedaCRC(kpis.totalAsignado)}</span>
              <span className="font-bold text-[#e4e4e7] font-mono">{kpis.pctEjecucionPresupuesto}% ejec.</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Proyectos en Riesgo (Alerta Parpadeante) */}
        <div className={`p-5 rounded-xl border flex items-center justify-between transition-all ${
          kpis.riesgoCount > 0 
            ? 'bg-[#111112] border-white ring-1 ring-inset ring-[#71717a]'
            : 'bg-[#111112] border-[#52525b]'
        }`}>
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-white" />
              <span>Proyectos en Riesgo</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono">{kpis.riesgoCount}</span>
              <span className="text-xs text-[#d4d4d8] font-semibold">Avance &lt; 30%</span>
            </div>
            <span className="text-[11px] text-[#a1a1aa] block">Requieren atención inmediata</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
        <div className="bg-[#111112] p-5 rounded-xl border border-[#3f3f46] space-y-2">
          <div className="flex justify-between items-center text-[#a1a1aa]">
            <span className="text-xs font-semibold uppercase tracking-wider">Permisos</span>
            <ShieldCheck className="w-5 h-5 text-[#d4d4d8]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{indicadoresGestion.permisosPendientes}</span>
            <span className="text-xs text-[#a1a1aa]">pendientes</span>
          </div>
          <p className="text-xs text-[#a1a1aa] font-semibold">{indicadoresGestion.permisosVencidos} vencidos</p>
        </div>

        <div className="bg-[#111112] p-5 rounded-xl border border-[#3f3f46] space-y-2">
          <div className="flex justify-between items-center text-[#a1a1aa]">
            <span className="text-xs font-semibold uppercase tracking-wider">Hitos</span>
            <Flag className="w-5 h-5 text-[#d4d4d8]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{indicadoresGestion.hitosAtrasados}</span>
            <span className="text-xs text-[#a1a1aa]">atrasados</span>
          </div>
          <p className="text-xs text-[#71717a]">Segun fecha plan</p>
        </div>

        <div className="bg-[#111112] p-5 rounded-xl border border-[#3f3f46] space-y-2">
          <div className="flex justify-between items-center text-[#a1a1aa]">
            <span className="text-xs font-semibold uppercase tracking-wider">Garantias</span>
            <ShieldCheck className="w-5 h-5 text-[#d4d4d8]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{indicadoresGestion.garantiasPorVencer}</span>
            <span className="text-xs text-[#a1a1aa]">por vencer</span>
          </div>
          <p className="text-xs text-[#a1a1aa] font-semibold">{indicadoresGestion.garantiasVencidas} vencidas</p>
        </div>

        <div className="bg-[#111112] p-5 rounded-xl border border-[#3f3f46] space-y-2">
          <div className="flex justify-between items-center text-[#a1a1aa]">
            <span className="text-xs font-semibold uppercase tracking-wider">Documentos</span>
            <FileText className="w-5 h-5 text-[#d4d4d8]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{indicadoresGestion.documentosTotal}</span>
            <span className="text-xs text-[#a1a1aa]">adjuntos</span>
          </div>
          <p className="text-xs text-[#71717a]">En proyectos filtrados</p>
        </div>

        <div className="bg-[#111112] p-5 rounded-xl border border-[#3f3f46] space-y-2">
          <div className="flex justify-between items-center text-[#a1a1aa]">
            <span className="text-xs font-semibold uppercase tracking-wider">Donaciones</span>
            <Gift className="w-5 h-5 text-[#d4d4d8]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-white font-mono">{formatMonedaCRC(indicadoresGestion.valorDonaciones)}</span>
          </div>
          <p className="text-xs text-[#71717a]">Valor estimado</p>
        </div>
      </div>

      {/* FILA 2 — GRÁFICOS PRINCIPALES DE CARGA Y PRESUPUESTO POR PROFESIONAL (2 COLUMNAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Carga por Profesional (Barras Horizontales) */}
        <div className="bg-[#111112] p-6 rounded-xl border border-[#3f3f46] space-y-4">
          <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#d4d4d8]" />
              <span>Carga por profesional responsable</span>
            </h3>
            <span className="text-[11px] text-[#71717a]">Ordenado por volumen de proyectos</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={cargaProfesionalesData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <defs>
                  <pattern id="cargaGraphite" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="8" height="8" fill="#27272a" />
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#d4d4d8" strokeWidth="1.2" />
                  </pattern>
                </defs>
                <CartesianGrid stroke="#27272a" strokeDasharray="4 5" horizontal={false} />
                <XAxis type="number" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="nombre" stroke="#a1a1aa" fontSize={10} width={135} tickLine={false} tickFormatter={formatProfessionalAxisLabel} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#09090b] p-3 rounded-xl border border-[#27272a] text-xs text-white space-y-1.5 shadow-2xl">
                          <p className="font-bold text-white border-b border-[#3f3f46] pb-1">{d.nombre}</p>
                          <p>Total Proyectos: <strong className="font-mono">{d.proyectos}</strong></p>
                          <p>Promedio Avance: <strong className="font-mono text-[#d4d4d8]">{d.promAvance}%</strong></p>
                          <p>Proyectos en Riesgo: <strong className="font-mono text-white">{d.riesgo}</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="proyectos" fill="url(#cargaGraphite)" stroke="#d4d4d8" strokeWidth={1} radius={[0, 3, 3, 0]} barSize={22}>
                  {cargaProfesionalesData.map((_, index) => (
                    <Cell key={`cell-${index}`} stroke="#a1a1aa" strokeWidth={1} />
                  ))}
                  <LabelList dataKey="proyectos" position="right" fill="#f4f4f5" fontSize={11} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Presupuesto Asignado por Profesional (Barras Horizontales Apiladas) */}
        <div className="bg-[#111112] p-6 rounded-xl border border-[#3f3f46] space-y-4">
          <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#d4d4d8]" />
              <span>Presupuesto asignado por profesional</span>
            </h3>
            <span className="text-[11px] text-[#71717a]">En Millones de Colones</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={presupuestoProfesionalesData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <defs>
                  <pattern id="budgetGraphite" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="8" height="8" fill="#27272a" />
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#d4d4d8" strokeWidth="1.2" />
                  </pattern>
                </defs>
                <CartesianGrid stroke="#27272a" strokeDasharray="4 5" horizontal={false} />
                <XAxis type="number" stroke="#71717a" fontSize={11} tickLine={false} tickFormatter={(v) => `₡${v}M`} />
                <YAxis type="category" dataKey="nombre" stroke="#a1a1aa" fontSize={10} width={135} tickLine={false} tickFormatter={formatProfessionalAxisLabel} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#09090b] p-3 rounded-xl border border-[#27272a] text-xs text-white space-y-1.5 shadow-2xl">
                          <p className="font-bold text-white border-b border-[#3f3f46] pb-1">{d.nombre}</p>
                          <p>Presupuesto Asignado Total: <strong className="font-mono text-white">{formatMonedaCRC(d.asignadoTotal)}</strong></p>
                          <p>Presupuesto Ejecutado: <strong className="font-mono text-[#d4d4d8]">{formatMonedaCRC(d.ejecutadoTotal)}</strong></p>
                          <p>Porcentaje Ejecución: <strong className="font-mono text-white">{d.pctEjecucion}%</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#a1a1aa' }} />
                <Bar dataKey="ejecutadoM" name="Ejecutado (M)" stackId="a" fill="url(#budgetGraphite)" stroke="#d4d4d8" strokeWidth={1} barSize={22} />
                <Bar dataKey="restanteM" name="Restante (M)" stackId="a" fill="#71717a" stroke="#f4f4f5" strokeWidth={1} barSize={22} radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="asignadoM" position="right" fill="#f4f4f5" fontSize={10} formatter={(value: number) => `₡${value}M`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* FILA 3 — GRÁFICOS SECUNDARIOS: FASES ACTIVAS */}
      <div className="bg-[#111112] p-6 rounded-xl border border-[#3f3f46] space-y-4">
        <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#d4d4d8]" />
            <span>Proyectos por fase activa</span>
          </h3>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={fasesActivasData} margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
              <defs>
                <pattern id="phaseGraphite" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="8" height="8" fill="#27272a" />
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#d4d4d8" strokeWidth="1.2" />
                </pattern>
              </defs>
              <CartesianGrid stroke="#27272a" strokeDasharray="4 5" horizontal={false} />
              <XAxis type="number" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis type="category" dataKey="fase" stroke="#a1a1aa" fontSize={10} width={130} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-[#09090b] p-3 rounded-xl border border-[#27272a] text-xs text-white space-y-1 shadow-xl">
                        <p className="font-bold text-white border-b border-[#3f3f46] pb-1">{d.fase}</p>
                        <p>Proyectos en esta fase: <strong className="font-mono">{d.proyectos}</strong></p>
                        <p>Promedio Avance: <strong className="font-mono text-[#d4d4d8]">{d.promAvance}%</strong></p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="proyectos" fill="url(#phaseGraphite)" stroke="#d4d4d8" strokeWidth={1} radius={[0, 3, 3, 0]} barSize={22}>
                <LabelList dataKey="proyectos" position="right" fill="#f4f4f5" fontSize={11} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#111112] p-6 rounded-xl border border-[#3f3f46] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a] pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#d4d4d8]" />
              <span>Alertas operativas</span>
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Permisos pendientes o vencidos, hitos atrasados y garantias por vencer.
            </p>
          </div>
        </div>

        {alertasOperativas.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-[#27272a] bg-[#09090b]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18181b] text-[#71717a] uppercase font-semibold border-b border-[#27272a]">
                <tr>
                  <th className="px-4 py-3">Severidad</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Proyecto</th>
                  <th className="px-4 py-3">Detalle</th>
                  <th className="px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]/50 text-[#f4f4f5]">
                {alertasOperativas.map((alerta) => (
                  <tr
                    key={alerta.id}
                    onClick={() => navigate(`/proyectos-obra/${alerta.proyectoId}`)}
                    className="hover:bg-[#18181b]/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded text-[11px] font-bold border ${
                        alerta.severidad === 'alta'
                          ? 'bg-[#e4e4e7] text-[#111112] border-white'
                          : 'bg-[#27272a] text-[#d4d4d8] border-[#71717a]'
                      }`}>
                        {alerta.severidad === 'alta' ? 'Alta' : 'Media'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-white whitespace-nowrap">{alerta.tipo}</td>
                    <td className="px-4 py-3.5 font-bold text-white group-hover:text-[#d4d4d8] transition-colors max-w-xs truncate">{alerta.proyecto}</td>
                    <td className="px-4 py-3.5 text-[#a1a1aa] max-w-md truncate" title={alerta.detalle}>{alerta.detalle}</td>
                    <td className="px-4 py-3.5 text-[#71717a] font-mono whitespace-nowrap">{alerta.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-[#71717a] py-8 text-center bg-[#09090b] rounded-xl border border-[#27272a]">
            No hay alertas operativas para el filtro actual.
          </p>
        )}
      </div>

      {/* FILA 4 — TABLA DE ALERTAS (PROYECTOS QUE REQUIEREN ATENCIÓN) */}
      <div className="bg-[#111112] p-6 rounded-xl border border-[#3f3f46] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a] pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#d4d4d8]" />
              <span>Proyectos que requieren atención</span>
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
                    <td className="px-4 py-3.5 font-bold text-white group-hover:text-[#d4d4d8] transition-colors max-w-xs truncate">
                      {p.nombre}
                    </td>
                    <td className="px-4 py-3.5 text-[#a1a1aa] font-medium whitespace-nowrap">
                      {p.responsable}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-[#27272a] h-2.5 rounded-[3px] overflow-hidden border border-[#a1a1aa]">
                          <div
                            className="h-full border-r border-white"
                            style={{
                              width: `${Math.min(100, p.avance)}%`,
                              backgroundColor: '#27272a',
                              backgroundImage: 'repeating-linear-gradient(135deg, transparent 0, transparent 4px, rgba(255,255,255,0.7) 4px, rgba(255,255,255,0.7) 5px)',
                              boxShadow: 'inset 0 0 0 1px #a1a1aa'
                            }}
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
