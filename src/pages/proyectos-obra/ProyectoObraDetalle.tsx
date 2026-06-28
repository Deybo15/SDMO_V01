import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ProyectoObraConDetalles, SemaforoColor } from '../../types/proyectosObra';
import { getProyectoObraPorId, registrarSeguimiento, actualizarFaseProyecto, formatMonedaCRC, formatFechaCR } from '../../lib/proyectosObraService';
import { SemaforoBadge } from '../../components/proyectos/SemaforoBadge';
import { PoaProgressBar } from '../../components/proyectos/PoaProgressBar';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, Building2, User, FileText, DollarSign, Briefcase, 
  Clock, Activity, Plus, CheckCircle2, AlertCircle, Calendar, Send, Edit3, History, Save, X
} from 'lucide-react';

export default function ProyectoObraDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [proyecto, setProyecto] = useState<ProyectoObraConDetalles | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [tabActiva, setTabActiva] = useState<'general' | 'presupuesto' | 'contrato' | 'fases' | 'seguimiento'>('general');

  // Formulario para nuevo seguimiento (APPEND-ONLY)
  const [mostrarModalSeguimiento, setMostrarModalSeguimiento] = useState<boolean>(false);
  const [nuevoAvance, setNuevoAvance] = useState<number>(0);
  const [nuevoSemaforo, setNuevoSemaforo] = useState<SemaforoColor>('Verde');
  const [nuevasObservaciones, setNuevasObservaciones] = useState<string>('');
  const [nuevaEtapa, setNuevaEtapa] = useState<string>('');
  const [guardandoSeguimiento, setGuardandoSeguimiento] = useState<boolean>(false);

  // Estado para edición de Fases
  const [faseEnEdicion, setFaseEnEdicion] = useState<string | number | null>(null);
  const [editFechaInicioReal, setEditFechaInicioReal] = useState<string>('');
  const [editFechaFinReal, setEditFechaFinReal] = useState<string>('');
  const [editPorcentajeAvance, setEditPorcentajeAvance] = useState<number>(0);
  const [guardandoFase, setGuardandoFase] = useState<boolean>(false);

  const handleIniciarEdicionFase = (fase: any) => {
    setFaseEnEdicion(fase.id);
    setEditFechaInicioReal(fase.fecha_inicio_real || '');
    setEditFechaFinReal(fase.fecha_fin_real || '');
    setEditPorcentajeAvance(fase.porcentaje_avance || 0);
  };

  const handleGuardarEdicionFase = async (fase: any) => {
    if (!proyecto || !id) return;
    setGuardandoFase(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const modificadoPor = user?.email || 'Usuario SDMO';

      // 1. Comparar fecha_inicio_real
      const valIniNuevo = editFechaInicioReal.trim() || null;
      const valIniAnterior = fase.fecha_inicio_real || null;
      if (valIniNuevo !== valIniAnterior) {
        await actualizarFaseProyecto(
          proyecto.id,
          fase.id,
          fase.fase,
          'fecha_inicio_real',
          valIniAnterior || 'Sin definir',
          valIniNuevo || 'Sin definir',
          modificadoPor
        );
      }

      // 2. Comparar fecha_fin_real
      const valFinNuevo = editFechaFinReal.trim() || null;
      const valFinAnterior = fase.fecha_fin_real || null;
      if (valFinNuevo !== valFinAnterior) {
        await actualizarFaseProyecto(
          proyecto.id,
          fase.id,
          fase.fase,
          'fecha_fin_real',
          valFinAnterior || 'Sin definir',
          valFinNuevo || 'Sin definir',
          modificadoPor
        );
      }

      // 3. Comparar porcentaje_avance
      const numAvance = Number(editPorcentajeAvance);
      const numAvanceAnterior = Number(fase.porcentaje_avance);
      if (numAvance !== numAvanceAnterior) {
        await actualizarFaseProyecto(
          proyecto.id,
          fase.id,
          fase.fase,
          'porcentaje_avance',
          `${Math.round(numAvanceAnterior * 100)}%`,
          `${Math.round(numAvance * 100)}%`,
          modificadoPor
        );
      }

      setFaseEnEdicion(null);
      await cargarDetalle();
    } catch (err) {
      console.error('Error guardando cambios de fase:', err);
      alert('Error guardando los cambios en la fase');
    } finally {
      setGuardandoFase(false);
    }
  };

  useEffect(() => {
    if (id) {
      cargarDetalle();
    }
  }, [id]);

  const cargarDetalle = async () => {
    if (!id) return;
    setLoading(true);
    const data = await getProyectoObraPorId(id);
    if (!data) {
      navigate('/proyectos-obra');
      return;
    }
    setProyecto(data);
    setNuevoSemaforo(data.semaforo);
    setNuevoAvance(data.avance_poa ?? 0);
    setLoading(false);
  };

  const handleGuardarSeguimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proyecto || !id) return;

    setGuardandoSeguimiento(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const registradoPor = user?.email || 'Usuario SDMO';

      await registrarSeguimiento({
        proyecto_id: id,
        fecha_corte: new Date().toISOString().split('T')[0],
        avance_registrado: Number(nuevoAvance),
        semaforo: nuevoSemaforo,
        observaciones: nuevasObservaciones,
        etapa: nuevaEtapa,
        registrado_por: registradoPor
      });

      setMostrarModalSeguimiento(false);
      setNuevasObservaciones('');
      setNuevaEtapa('');
      await cargarDetalle();
    } catch (err) {
      console.error('Error guardando seguimiento:', err);
    } finally {
      setGuardandoSeguimiento(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#a1a1aa]">Cargando detalles del proyecto...</p>
        </div>
      </div>
    );
  }

  if (!proyecto) return null;

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'presupuesto', label: 'Presupuesto', icon: DollarSign },
    { id: 'contrato', label: 'Contrato', icon: Briefcase },
    { id: 'fases', label: 'Fases', icon: Clock },
    { id: 'seguimiento', label: 'Seguimiento', icon: Activity },
  ] as const;

  const pres = proyecto.presupuesto_vigente;
  const cont = proyecto.contrato;

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-4 md:p-8 space-y-6">
      {/* Botón de Regreso y Header */}
      <div className="space-y-4">
        <Link
          to="/proyectos-obra"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#a1a1aa] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Proyectos</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#18181b] p-6 rounded-2xl border border-[#27272a]">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-[#27272a] text-[#a1a1aa] tracking-wider uppercase">
                {proyecto.codigo_meta || `ID: ${proyecto.id}`}
              </span>
              <SemaforoBadge color={proyecto.semaforo} size="md" />
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#27272a] text-white">
                {proyecto.estado || 'Activo'}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white">{proyecto.nombre_proyecto}</h1>
            <p className="text-sm text-[#a1a1aa] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#71717a]" />
              <span>{proyecto.dependencia}</span>
              {proyecto.gerencia && <span>• Gerencia: {proyecto.gerencia}</span>}
            </p>
          </div>

          <div className="w-full md:w-64 bg-[#09090b] p-4 rounded-xl border border-[#27272a] space-y-2">
            <PoaProgressBar percentage={proyecto.avance_poa ?? proyecto.cumplimiento_poa ?? 0} />
          </div>
        </div>
      </div>

      {/* Pestañas de Navegación */}
      <div className="flex border-b border-[#27272a] gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const activa = tabActiva === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-semibold text-sm transition-all whitespace-nowrap ${
                activa
                  ? 'bg-[#18181b] text-[#0071E3] border-t-2 border-x border-[#27272a] border-t-[#0071E3]'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenido de las Pestañas */}
      <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] min-h-[400px]">
        {/* 1. GENERAL */}
        {tabActiva === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white border-b border-[#27272a] pb-2">Información de la Meta / Proyecto</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Tipo de Contrato</p>
                  <p className="font-medium text-white mt-1">{proyecto.tipo_contrato || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Tipo de Ejecución</p>
                  <p className="font-medium text-white mt-1">{proyecto.tipo_ejecucion || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">POA Origen</p>
                  <p className="font-medium text-white mt-1">{proyecto.poa_origen || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Origen Presupuesto</p>
                  <p className="font-medium text-white mt-1">{proyecto.origen_presupuesto || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Línea Estratégica</p>
                  <p className="font-medium text-white mt-1">{proyecto.linea_estrategica || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Programa</p>
                  <p className="font-medium text-white mt-1">{proyecto.programa || '-'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white border-b border-[#27272a] pb-2">Ubicación y Responsable</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2 bg-[#09090b] p-4 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#0071E3]" />
                    Profesional Responsable
                  </p>
                  <p className="text-base font-bold text-white mt-1">{proyecto.nombre_responsable}</p>
                  <p className="text-xs font-mono text-[#71717a] mt-0.5">Cédula: {proyecto.profesional_responsable || 'N/D'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Cantón</p>
                  <p className="font-medium text-white mt-1">{proyecto.canton || 'San José'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Distrito</p>
                  <p className="font-medium text-white mt-1">{proyecto.distrito || '-'}</p>
                </div>
              </div>
              {proyecto.observaciones_meta_poa && (
                <div className="mt-4 p-4 bg-[#09090b] rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase mb-1">Observaciones Meta POA</p>
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">{proyecto.observaciones_meta_poa}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. PRESUPUESTO */}
        {tabActiva === 'presupuesto' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
              <h3 className="text-lg font-bold text-white">Resumen de Presupuesto del Proyecto</h3>
              {pres?.version && (
                <span className="text-xs font-mono bg-[#27272a] px-3 py-1 rounded-full text-[#a1a1aa]">
                  Versión: {pres.version}
                </span>
              )}
            </div>

            {pres ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#09090b] p-5 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Presupuesto Asignado</p>
                  <p className="text-xl font-black text-emerald-400 font-mono mt-2">{formatMonedaCRC(pres.presupuesto_asignado)}</p>
                </div>
                <div className="bg-[#09090b] p-5 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Presupuesto Adjudicado</p>
                  <p className="text-xl font-black text-blue-400 font-mono mt-2">{formatMonedaCRC(pres.presupuesto_adjudicado)}</p>
                </div>
                <div className="bg-[#09090b] p-5 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Presupuesto Ejecutado</p>
                  <p className="text-xl font-black text-purple-400 font-mono mt-2">{formatMonedaCRC(pres.presupuesto_ejecutado)}</p>
                </div>
                <div className="bg-[#09090b] p-5 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Presupuesto Comprometido</p>
                  <p className="text-xl font-black text-amber-400 font-mono mt-2">{formatMonedaCRC(pres.presupuesto_comprometido)}</p>
                </div>
                <div className="bg-[#09090b] p-5 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Presupuesto Reserva</p>
                  <p className="text-xl font-black text-orange-400 font-mono mt-2">{formatMonedaCRC(pres.presupuesto_reserva)}</p>
                </div>

                {/* Presupuesto Libre: Columna GENERADA por Supabase */}
                <div className="bg-[#09090b] p-5 rounded-xl border border-teal-500/30 bg-teal-500/5">
                  <p className="text-xs text-teal-400 font-semibold uppercase flex items-center justify-between">
                    <span>Presupuesto Libre</span>
                    <span className="text-[10px] bg-teal-500/20 px-2 py-0.5 rounded text-teal-300">Generado en BD</span>
                  </p>
                  <p className="text-xl font-black text-teal-300 font-mono mt-2">
                    {formatMonedaCRC(pres.presupuesto_libre ?? (pres.presupuesto_asignado - pres.presupuesto_ejecutado - pres.presupuesto_comprometido))}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#71717a] py-8 text-center">No hay información de presupuesto registrada para este proyecto.</p>
            )}
          </div>
        )}

        {/* 3. CONTRATO */}
        {tabActiva === 'contrato' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-[#27272a] pb-3">Información de Contratación (SICOP)</h3>
            {cont ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">N° Procedimiento SICOP</p>
                  <p className="font-bold text-white mt-1 font-mono">{cont.numero_procedimiento_sicop || '-'}</p>
                </div>
                <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">N° Contrato SICOP</p>
                  <p className="font-bold text-white mt-1 font-mono">{cont.numero_contrato_sicop || '-'}</p>
                </div>
                <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">N° Orden de Compra</p>
                  <p className="font-bold text-white mt-1 font-mono">{cont.numero_orden_compra || '-'}</p>
                </div>
                <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Empresa Adjudicada / Contratista</p>
                  <p className="font-bold text-white mt-1">{cont.empresa_adjudicada || cont.contratista || '-'}</p>
                </div>
                <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Analista Proveeduría</p>
                  <p className="font-bold text-white mt-1">{cont.analista_proveeduria || '-'}</p>
                </div>
                <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Estado de Contratación</p>
                  <p className="font-bold text-[#0071E3] mt-1">{cont.estado_contratacion || '-'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#71717a] py-8 text-center">No hay contrato ni solicitud SICOP vinculada aún.</p>
            )}
          </div>
        )}

        {/* 4. FASES */}
        {tabActiva === 'fases' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
              <h3 className="text-lg font-bold text-white">Línea de Tiempo y Fases del Proyecto</h3>
            </div>

            {proyecto.fases && proyecto.fases.length > 0 ? (
              <div className="space-y-4">
                {proyecto.fases.map((fase) => {
                  const enEdicion = faseEnEdicion === fase.id;
                  return (
                    <div key={fase.id} className="bg-[#09090b] p-5 rounded-xl border border-[#27272a] space-y-4">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          {fase.completada ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Clock className="w-5 h-5 text-amber-400" />
                          )}
                          <h4 className="font-bold text-white text-base">
                            {fase.fase.replace(/_/g, ' ')}
                          </h4>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-[#27272a] text-white">
                            Avance: {Math.round(fase.porcentaje_avance * 100)}%
                          </span>
                          {!enEdicion ? (
                            <button
                              onClick={() => handleIniciarEdicionFase(fase)}
                              className="flex items-center gap-1.5 px-3 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-semibold rounded-lg transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#0071E3]" />
                              <span>Editar</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleGuardarEdicionFase(fase)}
                                disabled={guardandoFase}
                                className="flex items-center gap-1 px-3 py-1 bg-[#0071E3] hover:bg-[#0071E3]/80 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>{guardandoFase ? 'Guardando...' : 'Guardar'}</span>
                              </button>
                              <button
                                onClick={() => setFaseEnEdicion(null)}
                                className="p-1 bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] hover:text-white rounded-lg transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {!enEdicion ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-2 border-t border-[#27272a]/50">
                          <div>
                            <span className="text-[#71717a] block">Inicio Plan</span>
                            <span className="font-mono text-white">{formatFechaCR(fase.fecha_inicio_plan)}</span>
                          </div>
                          <div>
                            <span className="text-[#71717a] block">Fin Plan</span>
                            <span className="font-mono text-white">{formatFechaCR(fase.fecha_fin_plan)}</span>
                          </div>
                          <div>
                            <span className="text-[#71717a] block">Inicio Real</span>
                            <span className="font-mono text-emerald-400">{formatFechaCR(fase.fecha_inicio_real)}</span>
                          </div>
                          <div>
                            <span className="text-[#71717a] block">Fin Real</span>
                            <span className="font-mono text-emerald-400">{formatFechaCR(fase.fecha_fin_real)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-3 border-t border-[#0071E3]/30 bg-[#18181b]/50 p-4 rounded-xl">
                          <div>
                            <label className="block text-[#a1a1aa] font-semibold mb-1">Fecha Inicio Real</label>
                            <input
                              type="date"
                              value={editFechaInicioReal}
                              onChange={(e) => setEditFechaInicioReal(e.target.value)}
                              className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-white focus:outline-none focus:border-[#0071E3]"
                            />
                          </div>
                          <div>
                            <label className="block text-[#a1a1aa] font-semibold mb-1">Fecha Fin Real</label>
                            <input
                              type="date"
                              value={editFechaFinReal}
                              onChange={(e) => setEditFechaFinReal(e.target.value)}
                              className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-white focus:outline-none focus:border-[#0071E3]"
                            />
                          </div>
                          <div>
                            <label className="block text-[#a1a1aa] font-semibold mb-1">Porcentaje de Avance (0 a 1)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="1"
                              value={editPorcentajeAvance}
                              onChange={(e) => setEditPorcentajeAvance(parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-white focus:outline-none focus:border-[#0071E3]"
                            />
                            <span className="text-[10px] text-[#71717a] mt-0.5 block">Ej. 0.50 = 50%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#71717a] py-8 text-center">No hay fases configuradas para este proyecto.</p>
            )}

            {/* Sección de Historial de Modificaciones de Fases */}
            <div className="pt-6 border-t border-[#27272a] space-y-4">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-[#0071E3]" />
                <span>Historial de Modificaciones de Fases (Audit Log)</span>
              </h4>

              {proyecto.historial_fases && proyecto.historial_fases.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[#27272a] bg-[#09090b]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#18181b] text-[#71717a] uppercase font-semibold border-b border-[#27272a]">
                      <tr>
                        <th className="px-4 py-3">Fase</th>
                        <th className="px-4 py-3">Campo Modificado</th>
                        <th className="px-4 py-3">Valor Anterior</th>
                        <th className="px-4 py-3">Valor Nuevo</th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Modificado Por</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272a]/50 text-[#f4f4f5]">
                      {proyecto.historial_fases.map((h: any) => (
                        <tr key={h.id || Math.random()} className="hover:bg-[#18181b]/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-[#0071E3]">
                            {h.fase?.replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-3 font-mono text-[#a1a1aa]">{h.campo_modificado}</td>
                          <td className="px-4 py-3 font-mono text-rose-400">{formatFechaCR(h.valor_anterior) || h.valor_anterior || '-'}</td>
                          <td className="px-4 py-3 font-mono text-emerald-400">{formatFechaCR(h.valor_nuevo) || h.valor_nuevo || '-'}</td>
                          <td className="px-4 py-3 text-[#71717a] font-mono">{formatFechaCR(h.creado_en)}</td>
                          <td className="px-4 py-3 text-[#a1a1aa] font-medium">{h.modificado_por || 'Sistema'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[#71717a] py-4 text-center bg-[#09090b] rounded-xl border border-[#27272a]">
                  No se registran modificaciones anteriores en las fases de este proyecto.
                </p>
              )}
            </div>
          </div>
        )}

        {/* 5. SEGUIMIENTO (APPEND-ONLY) */}
        {tabActiva === 'seguimiento' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Bitácora de Seguimiento</h3>
                <p className="text-xs text-[#71717a]">Registro histórico append-only ordenado descendentemente por fecha corte</p>
              </div>
              <button
                onClick={() => setMostrarModalSeguimiento(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#0071E3] hover:bg-[#0071E3]/80 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-[#0071E3]/20"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Seguimiento</span>
              </button>
            </div>

            {proyecto.seguimientos && proyecto.seguimientos.length > 0 ? (
              <div className="space-y-4">
                {proyecto.seguimientos.map((seg) => (
                  <div key={seg.id} className="bg-[#09090b] p-5 rounded-xl border border-[#27272a] space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <SemaforoBadge color={seg.semaforo} size="sm" />
                        <span className="text-xs font-mono text-[#a1a1aa] flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Fecha Corte: {formatFechaCR(seg.fecha_corte)}
                        </span>
                      </div>
                      <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                        {Math.round(seg.avance_registrado * 100)}% Avance
                      </span>
                    </div>

                    {seg.etapa && (
                      <p className="text-xs font-semibold text-[#0071E3] uppercase tracking-wider">Etapa: {seg.etapa}</p>
                    )}

                    {seg.observaciones && (
                      <p className="text-sm text-[#f4f4f5] leading-relaxed bg-[#18181b] p-3 rounded-lg border border-[#27272a]">
                        {seg.observaciones}
                      </p>
                    )}

                    <div className="text-[11px] text-[#71717a] text-right">
                      Registrado por: <strong className="text-[#a1a1aa]">{seg.registrado_por || 'Sistema'}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#71717a] py-8 text-center">No hay entradas de seguimiento registradas aún.</p>
            )}
          </div>
        )}
      </div>

      {/* Modal para Nuevo Seguimiento (Append-Only) */}
      {mostrarModalSeguimiento && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] rounded-2xl border border-[#27272a] max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-xl font-bold text-white">Registrar Entrada de Seguimiento</h3>
            <p className="text-xs text-[#a1a1aa]">Esta acción insertará una nueva entrada inmutable en el historial.</p>

            <form onSubmit={handleGuardarSeguimiento} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1">Semáforo</label>
                <select
                  value={nuevoSemaforo}
                  onChange={(e) => setNuevoSemaforo(e.target.value as SemaforoColor)}
                  className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3]"
                >
                  <option value="Verde">🟢 Verde</option>
                  <option value="Rojo">🔴 Rojo</option>
                  <option value="Amarillo">🟡 Amarillo</option>
                  <option value="Morado">🟣 Morado</option>
                  <option value="Azul">🔵 Azul</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1">Porcentaje de Avance (0 a 1)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={nuevoAvance}
                  onChange={(e) => setNuevoAvance(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3]"
                  required
                />
                <span className="text-[11px] text-[#71717a] mt-0.5 block">Ejemplo: 0.75 equivale al 75%</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1">Etapa Actual</label>
                <input
                  type="text"
                  placeholder="Ej. En proceso de licitación, En construcción..."
                  value={nuevaEtapa}
                  onChange={(e) => setNuevaEtapa(e.target.value)}
                  className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1">Observaciones</label>
                <textarea
                  rows={4}
                  placeholder="Escriba los avances y novedades del período..."
                  value={nuevasObservaciones}
                  onChange={(e) => setNuevasObservaciones(e.target.value)}
                  className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalSeguimiento(false)}
                  className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-xl text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoSeguimiento}
                  className="flex items-center gap-2 px-5 py-2 bg-[#0071E3] hover:bg-[#0071E3]/80 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{guardandoSeguimiento ? 'Guardando...' : 'Guardar Entrada'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
