import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ProyectoDocumento, ProyectoObraConDetalles } from '../../types/proyectosObra';
import {
  getProyectoObraPorId,
  registrarSeguimiento,
  actualizarFaseProyecto,
  subirDocumentoProyecto,
  eliminarDocumentoProyecto,
  crearUrlDocumentoProyecto,
  formatMonedaCRC,
  formatFechaCR,
  formatProgressPercent,
  normalizeProgressFraction
} from '../../lib/proyectosObraService';
import { generarReporteProyectoPDF, generarReporteProyectoExcel } from '../../lib/reportesService';
import {
  ESTADO_CONTRATACION_OPTIONS,
  ESTADO_PROYECTO_OPTIONS,
  LINEA_ESTRATEGICA_OPTIONS,
  ORIGEN_PRESUPUESTO_OPTIONS,
  TIPO_CONTRATO_OPTIONS,
  TIPO_EJECUCION_OPTIONS,
  TIPO_PROYECTO_OPTIONS,
  TIPO_DOCUMENTO_PROYECTO_OPTIONS,
  FASE_PROYECTO_OPTIONS,
  getCatalogLabel,
  getFaseProyectoOrder
} from '../../lib/proyectosObraCatalogos';

import { PoaProgressBar } from '../../components/proyectos/PoaProgressBar';
import { supabase } from '../../lib/supabase';
import { useAuthorization } from '../../hooks/useAuthorization';
import { 
  ArrowLeft, Building2, User, FileText, DollarSign, Briefcase, 
  Clock, Activity, Plus, CheckCircle2, AlertCircle, Calendar, Send, Edit3, History, Save, X, FileSpreadsheet, Download,
  Upload, Trash2, ExternalLink
} from 'lucide-react';

export default function ProyectoObraDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authorized: puedeEditar } = useAuthorization();

  const [proyecto, setProyecto] = useState<ProyectoObraConDetalles | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [tabActiva, setTabActiva] = useState<'general' | 'presupuesto' | 'contrato' | 'documentos' | 'fases' | 'seguimiento'>('general');

  // Formulario para nuevo seguimiento (APPEND-ONLY)
  const [mostrarModalSeguimiento, setMostrarModalSeguimiento] = useState<boolean>(false);
  const [nuevoAvance, setNuevoAvance] = useState<number>(0);
  const [fechaCorteSeguimiento, setFechaCorteSeguimiento] = useState<string>(new Date().toISOString().split('T')[0]);

  const [nuevasObservaciones, setNuevasObservaciones] = useState<string>('');
  const [nuevaEtapa, setNuevaEtapa] = useState<string>('');
  const [guardandoSeguimiento, setGuardandoSeguimiento] = useState<boolean>(false);

  // Estado para edición de Fases
  const [faseEnEdicion, setFaseEnEdicion] = useState<string | number | null>(null);
  const [editFechaInicioReal, setEditFechaInicioReal] = useState<string>('');
  const [editFechaFinReal, setEditFechaFinReal] = useState<string>('');
  const [editPorcentajeAvance, setEditPorcentajeAvance] = useState<number>(0);
  const [guardandoFase, setGuardandoFase] = useState<boolean>(false);
  const [archivoDocumento, setArchivoDocumento] = useState<File | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState<string>('Solicitud inicial');
  const [descripcionDocumento, setDescripcionDocumento] = useState<string>('');
  const [subiendoDocumento, setSubiendoDocumento] = useState<boolean>(false);

  const handleIniciarEdicionFase = (fase: any) => {
    if (!puedeEditar) return;
    setFaseEnEdicion(fase.id);
    setEditFechaInicioReal(fase.fecha_inicio_real || '');
    setEditFechaFinReal(fase.fecha_fin_real || '');
    setEditPorcentajeAvance(formatProgressPercent(fase.porcentaje_avance));
  };

  const handleAbrirSeguimiento = () => {
    if (!proyecto || !puedeEditar) return;
    setNuevoAvance(formatProgressPercent(proyecto.avance_poa ?? 0));
    setFechaCorteSeguimiento(new Date().toISOString().split('T')[0]);
    setNuevasObservaciones('');
    setNuevaEtapa('');
    setMostrarModalSeguimiento(true);
  };

  const handleGuardarEdicionFase = async (fase: any) => {
    if (!proyecto || !id || !puedeEditar) return;

    if (!Number.isFinite(editPorcentajeAvance) || editPorcentajeAvance < 0 || editPorcentajeAvance > 100) {
      alert('El porcentaje de avance de la fase debe estar entre 0 y 100.');
      return;
    }

    if (editFechaInicioReal && editFechaFinReal && editFechaInicioReal > editFechaFinReal) {
      alert('La fecha de inicio real no puede ser posterior a la fecha de fin real.');
      return;
    }

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
      const numAvance = normalizeProgressFraction(editPorcentajeAvance);
      const numAvanceAnterior = normalizeProgressFraction(fase.porcentaje_avance);
      if (numAvance !== numAvanceAnterior) {
        await actualizarFaseProyecto(
          proyecto.id,
          fase.id,
          fase.fase,
          'porcentaje_avance',
          `${formatProgressPercent(numAvanceAnterior)}%`,
          `${formatProgressPercent(numAvance)}%`,
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

  const cargarDetalle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await getProyectoObraPorId(id);
    if (!data) {
      navigate('/proyectos-obra');
      return;
    }
    setProyecto(data);

    setNuevoAvance(formatProgressPercent(data.avance_poa ?? 0));
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => {
    if (id) {
      cargarDetalle();
    }
  }, [id, cargarDetalle]);

  const handleGuardarSeguimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proyecto || !id || !puedeEditar) return;

    if (!fechaCorteSeguimiento) {
      alert('La fecha de corte es obligatoria.');
      return;
    }

    if (!Number.isFinite(nuevoAvance) || nuevoAvance < 0 || nuevoAvance > 100) {
      alert('El porcentaje de avance del seguimiento debe estar entre 0 y 100.');
      return;
    }

    if (!nuevaEtapa.trim() && !nuevasObservaciones.trim()) {
      alert('Ingrese una etapa u observación para documentar el seguimiento.');
      return;
    }

    setGuardandoSeguimiento(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const registradoPor = user?.email || 'Usuario SDMO';

      await registrarSeguimiento({
        proyecto_id: id,
        fecha_corte: fechaCorteSeguimiento,
        avance_registrado: normalizeProgressFraction(nuevoAvance),
        observaciones: nuevasObservaciones.trim(),
        etapa: nuevaEtapa.trim(),
        registrado_por: registradoPor
      });

      setMostrarModalSeguimiento(false);
      setNuevasObservaciones('');
      setNuevaEtapa('');
      setFechaCorteSeguimiento(new Date().toISOString().split('T')[0]);
      await cargarDetalle();
    } catch (err) {
      console.error('Error guardando seguimiento:', err);
    } finally {
      setGuardandoSeguimiento(false);
    }
  };

  const handleSubirDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proyecto || !id || !puedeEditar || !archivoDocumento) return;

    if (archivoDocumento.size > 25 * 1024 * 1024) {
      alert('El archivo no puede superar 25 MB.');
      return;
    }

    setSubiendoDocumento(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const subidoPor = user?.email || 'Usuario SDMO';

      await subirDocumentoProyecto(
        id,
        archivoDocumento,
        tipoDocumento,
        descripcionDocumento,
        subidoPor
      );

      setArchivoDocumento(null);
      setDescripcionDocumento('');
      await cargarDetalle();
    } catch (err: any) {
      console.error('Error subiendo documento:', err);
      alert('No se pudo subir el documento: ' + (err.message || err));
    } finally {
      setSubiendoDocumento(false);
    }
  };

  const handleAbrirDocumento = async (documento: ProyectoDocumento) => {
    try {
      const url = await crearUrlDocumentoProyecto(documento.ruta_storage);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('Error abriendo documento:', err);
      alert('No se pudo abrir el documento: ' + (err.message || err));
    }
  };

  const handleEliminarDocumento = async (documento: ProyectoDocumento) => {
    if (!puedeEditar) return;
    const confirmado = window.confirm(`¿Eliminar el documento "${documento.nombre_archivo}"?`);
    if (!confirmado) return;

    try {
      await eliminarDocumentoProyecto(documento);
      await cargarDetalle();
    } catch (err: any) {
      console.error('Error eliminando documento:', err);
      alert('No se pudo eliminar el documento: ' + (err.message || err));
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
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'fases', label: 'Fases', icon: Clock },
    { id: 'seguimiento', label: 'Seguimiento', icon: Activity },
  ] as const;

  const pres = proyecto.presupuesto_vigente;
  const cont = proyecto.contrato;
  const prioridadLabel = proyecto.prioridad === 1
    ? 'Alta'
    : proyecto.prioridad === 2
      ? 'Media'
      : proyecto.prioridad === 3
        ? 'Baja'
        : '-';

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

              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#27272a] text-white">
                {getCatalogLabel(proyecto.estado || 'Activo', ESTADO_PROYECTO_OPTIONS, 'Activo')}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white">{proyecto.nombre_proyecto}</h1>
            <p className="text-sm text-[#a1a1aa] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#71717a]" />
              <span>{proyecto.dependencia}</span>
              {proyecto.gerencia && <span>• Gerencia: {proyecto.gerencia}</span>}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
            <button
              onClick={() => generarReporteProyectoPDF(proyecto)}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-xl text-xs font-semibold transition-all border border-[#3f3f46]/50 shadow-sm shrink-0"
              title="Descargar Informe en PDF"
            >
              <FileText className="w-4 h-4 text-rose-400" />
              <span>PDF</span>
            </button>

            <button
              onClick={() => generarReporteProyectoExcel(proyecto)}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-xl text-xs font-semibold transition-all border border-[#3f3f46]/50 shadow-sm shrink-0"
              title="Descargar Libro en Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Excel</span>
            </button>

            {puedeEditar && (
              <Link
                to={`/proyectos-obra/${proyecto.id}/editar`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0071E3] hover:bg-[#0071E3]/80 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-[#0071E3]/20 shrink-0"
              >
                <Edit3 className="w-4 h-4" />
                <span>Editar Proyecto</span>
              </Link>
            )}

            <div className="w-full md:w-56 bg-[#09090b] p-3 rounded-xl border border-[#27272a] space-y-1.5">
              <PoaProgressBar percentage={proyecto.avance_poa ?? 0} />
            </div>
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
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Tipo de Proyecto</p>
                  <p className="font-medium text-white mt-1">{getCatalogLabel(proyecto.tipo_proyecto, TIPO_PROYECTO_OPTIONS)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Prioridad</p>
                  <p className="font-medium text-white mt-1">{prioridadLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Tipo de Contrato</p>
                  <p className="font-medium text-white mt-1">{getCatalogLabel(proyecto.tipo_contrato, TIPO_CONTRATO_OPTIONS)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Tipo de Ejecución</p>
                  <p className="font-medium text-white mt-1">{getCatalogLabel(proyecto.tipo_ejecucion, TIPO_EJECUCION_OPTIONS)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">POA Origen</p>
                  <p className="font-medium text-white mt-1">{proyecto.poa_origen || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Origen Presupuesto</p>
                  <p className="font-medium text-white mt-1">{getCatalogLabel(proyecto.origen_presupuesto, ORIGEN_PRESUPUESTO_OPTIONS)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Línea Estratégica</p>
                  <p className="font-medium text-white mt-1">{getCatalogLabel(proyecto.linea_estrategica, LINEA_ESTRATEGICA_OPTIONS)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Programa</p>
                  <p className="font-medium text-white mt-1">{proyecto.programa || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Fecha Solicitud</p>
                  <p className="font-medium text-white mt-1">{formatFechaCR(proyecto.fecha_solicitud)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Requiere Contratacion</p>
                  <p className="font-medium text-white mt-1">{proyecto.requiere_contratacion ? 'Si' : 'No'}</p>
                </div>
              </div>
              {proyecto.descripcion_general && (
                <div className="p-4 bg-[#09090b] rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase mb-1">Descripcion General</p>
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">{proyecto.descripcion_general}</p>
                </div>
              )}
              {proyecto.justificacion && (
                <div className="p-4 bg-[#09090b] rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase mb-1">Justificacion</p>
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">{proyecto.justificacion}</p>
                </div>
              )}
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
                <div>
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Barrio / Comunidad</p>
                  <p className="font-medium text-white mt-1">{proyecto.barrio_comunidad || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Direccion Exacta</p>
                  <p className="font-medium text-white mt-1">{proyecto.direccion_exacta || '-'}</p>
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

                <div className="bg-[#09090b] p-5 rounded-xl border border-[#27272a]">
                  <p className="text-xs text-[#71717a] font-semibold uppercase">Codigo Presupuestario</p>
                  <p className="text-lg font-black text-white font-mono mt-2">{pres.codigo_presupuestario || '-'}</p>
                </div>

                {/* Presupuesto Libre: Columna GENERADA por Supabase */}
                <div className="bg-[#09090b] p-5 rounded-xl border border-teal-500/30 bg-teal-500/5">
                  <p className="text-xs text-teal-400 font-semibold uppercase flex items-center justify-between">
                    <span>Presupuesto Libre</span>
                    <span className="text-[10px] bg-teal-500/20 px-2 py-0.5 rounded text-teal-300">Generado en BD</span>
                  </p>
                  <p className="text-xl font-black text-teal-300 font-mono mt-2">
                    {formatMonedaCRC(pres.presupuesto_libre ?? (pres.presupuesto_asignado - pres.presupuesto_adjudicado - pres.presupuesto_reserva))}
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
                  <p className="font-bold text-[#0071E3] mt-1">{getCatalogLabel(cont.estado_contratacion, ESTADO_CONTRATACION_OPTIONS)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#71717a] py-8 text-center">No hay contrato ni solicitud SICOP vinculada aún.</p>
            )}
          </div>
        )}

        {/* 4. DOCUMENTOS */}
        {tabActiva === 'documentos' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 border-b border-[#27272a] pb-5">
              <div>
                <h3 className="text-lg font-bold text-white">Documentos del Proyecto</h3>
                <p className="text-xs text-[#71717a]">Archivos, fotos, planos, actas, informes y cierre vinculados al proyecto.</p>
              </div>

              {puedeEditar && (
                <form onSubmit={handleSubirDocumento} className="w-full lg:max-w-xl bg-[#09090b] border border-[#27272a] rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1">Tipo</label>
                      <select
                        value={tipoDocumento}
                        onChange={(e) => setTipoDocumento(e.target.value)}
                        className="w-full px-3 py-2 bg-[#18181b] border border-[#27272a] rounded-lg text-sm text-white focus:outline-none focus:border-[#0071E3]"
                      >
                        {TIPO_DOCUMENTO_PROYECTO_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1">Archivo</label>
                      <input
                        type="file"
                        onChange={(e) => setArchivoDocumento(e.target.files?.[0] || null)}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/jpeg,image/png,image/webp"
                        className="w-full text-xs text-[#a1a1aa] file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#27272a] file:text-white hover:file:bg-[#3f3f46]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1">Descripción</label>
                    <input
                      type="text"
                      value={descripcionDocumento}
                      onChange={(e) => setDescripcionDocumento(e.target.value)}
                      placeholder="Referencia breve del documento"
                      className="w-full px-3 py-2 bg-[#18181b] border border-[#27272a] rounded-lg text-sm text-white focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!archivoDocumento || subiendoDocumento}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-[#0071E3] hover:bg-[#0071E3]/80 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{subiendoDocumento ? 'Subiendo...' : 'Subir Documento'}</span>
                  </button>
                </form>
              )}
            </div>

            {proyecto.documentos && proyecto.documentos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {proyecto.documentos.map((doc) => (
                  <div key={doc.id} className="bg-[#09090b] p-4 rounded-xl border border-[#27272a] space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-[#0071E3]">
                          {getCatalogLabel(doc.tipo_documento, TIPO_DOCUMENTO_PROYECTO_OPTIONS)}
                        </p>
                        <h4 className="font-bold text-white text-sm truncate mt-1" title={doc.nombre_archivo}>
                          {doc.nombre_archivo}
                        </h4>
                      </div>
                      <FileText className="w-5 h-5 text-[#a1a1aa] shrink-0" />
                    </div>

                    {doc.descripcion && (
                      <p className="text-xs text-[#a1a1aa] leading-relaxed bg-[#18181b] p-2 rounded-lg border border-[#27272a]">
                        {doc.descripcion}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-[#71717a]">
                      <span>{formatFechaCR(doc.creado_en)}</span>
                      <span>{doc.tamano_bytes ? `${(doc.tamano_bytes / 1024 / 1024).toFixed(1)} MB` : '-'}</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272a]">
                      <button
                        type="button"
                        onClick={() => handleAbrirDocumento(doc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-semibold rounded-lg transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir</span>
                      </button>
                      {puedeEditar && (
                        <button
                          type="button"
                          onClick={() => handleEliminarDocumento(doc)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold rounded-lg transition-all border border-rose-500/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#71717a] py-8 text-center bg-[#09090b] rounded-xl border border-[#27272a]">
                No hay documentos vinculados a este proyecto.
              </p>
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
                {(() => {
                  const fasesOrdenadas = [...proyecto.fases].sort((a, b) => {
                    return getFaseProyectoOrder(a.fase) - getFaseProyectoOrder(b.fase);
                  });

                  return fasesOrdenadas.map((fase) => {
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
                            {getCatalogLabel(fase.fase, FASE_PROYECTO_OPTIONS)}
                          </h4>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-[#27272a] text-white">
                            Avance: {formatProgressPercent(fase.porcentaje_avance)}%
                          </span>
                          {!enEdicion ? (
                            puedeEditar && (
                            <button
                              onClick={() => handleIniciarEdicionFase(fase)}
                              className="flex items-center gap-1.5 px-3 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-semibold rounded-lg transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#0071E3]" />
                              <span>Editar</span>
                            </button>
                            )
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
                            <label className="block text-[#a1a1aa] font-semibold mb-1">Porcentaje de Avance (%)</label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              value={editPorcentajeAvance}
                              onChange={(e) => setEditPorcentajeAvance(parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-white focus:outline-none focus:border-[#0071E3]"
                            />
                            <span className="text-[10px] text-[#71717a] mt-0.5 block">Ej. 75 = 75%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
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
                            {getCatalogLabel(h.fase, FASE_PROYECTO_OPTIONS)}
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
              {puedeEditar && (
                <button
                  onClick={handleAbrirSeguimiento}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0071E3] hover:bg-[#0071E3]/80 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-[#0071E3]/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Seguimiento</span>
                </button>
              )}
            </div>

            {proyecto.seguimientos && proyecto.seguimientos.length > 0 ? (
              <div className="space-y-4">
                {proyecto.seguimientos.map((seg) => (
                  <div key={seg.id} className="bg-[#09090b] p-5 rounded-xl border border-[#27272a] space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">

                        <span className="text-xs font-mono text-[#a1a1aa] flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Fecha Corte: {formatFechaCR(seg.fecha_corte)}
                        </span>
                      </div>
                      <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                        {formatProgressPercent(seg.avance_registrado)}% Avance
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
                <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1">Fecha de Corte</label>
                <input
                  type="date"
                  value={fechaCorteSeguimiento}
                  onChange={(e) => setFechaCorteSeguimiento(e.target.value)}
                  className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1">Porcentaje de Avance (%)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={nuevoAvance}
                  onChange={(e) => setNuevoAvance(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3]"
                  required
                />
                <span className="text-[11px] text-[#71717a] mt-0.5 block">Ejemplo: 75 equivale al 75%</span>
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
