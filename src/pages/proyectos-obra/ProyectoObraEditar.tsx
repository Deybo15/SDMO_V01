import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

import { getProyectoObraPorId, actualizarProyectoObra, getColaboradores } from '../../lib/proyectosObraService';
import { ArrowLeft, Save, Building2, User, Layers, FileText, DollarSign } from 'lucide-react';

export default function ProyectoObraEditar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [colaboradores, setColaboradores] = useState<any[]>([]);

  // Estado del formulario
  const [nombreProyecto, setNombreProyecto] = useState<string>('');
  const [codigoMeta, setCodigoMeta] = useState<string>('');
  const [gerencia, setGerencia] = useState<string>('');
  const [profesionalResponsable, setProfesionalResponsable] = useState<string>('');
  const [tipoContrato, setTipoContrato] = useState<string>('');
  const [tipoEjecucion, setTipoEjecucion] = useState<string>('');
  const [poaOrigen, setPoaOrigen] = useState<string>('');
  const [origenPresupuesto, setOrigenPresupuesto] = useState<string>('');
  const [lineaEstrategica, setLineaEstrategica] = useState<string>('');
  const [programa, setPrograma] = useState<string>('');
  const [canton, setCanton] = useState<string>('San José');
  const [distrito, setDistrito] = useState<string>('');

  const [estado, setEstado] = useState<string>('Activo');
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [observacionesMetaPoa, setObservacionesMetaPoa] = useState<string>('');

  const cargarProyecto = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [proyecto, colabs] = await Promise.all([
        getProyectoObraPorId(id),
        getColaboradores()
      ]);

      setColaboradores(colabs);

      if (!proyecto) {
        alert('Proyecto no encontrado');
        navigate('/proyectos-obra');
        return;
      }

      setNombreProyecto(proyecto.nombre_proyecto || '');
      setCodigoMeta(proyecto.codigo_meta || '');
      setGerencia(proyecto.gerencia || '');
      setProfesionalResponsable(proyecto.profesional_responsable || '');
      setTipoContrato(proyecto.tipo_contrato || '');
      setTipoEjecucion(proyecto.tipo_ejecucion || '');
      setPoaOrigen(proyecto.poa_origen || '');
      setOrigenPresupuesto(proyecto.origen_presupuesto || '');
      setLineaEstrategica(proyecto.linea_estrategica || '');
      setPrograma(proyecto.programa || '');
      setCanton(proyecto.canton || 'San José');
      setDistrito(proyecto.distrito || '');

      setEstado(proyecto.estado || 'Activo');
      setAnio(proyecto.anio || new Date().getFullYear());
      setObservacionesMetaPoa(proyecto.observaciones_meta_poa || '');
    } catch (err) {
      console.error('Error al cargar proyecto para edición:', err);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (id) {
      cargarProyecto();
    }
  }, [id, cargarProyecto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!nombreProyecto.trim()) {
      alert('El nombre del proyecto es obligatorio.');
      return;
    }

    setGuardando(true);
    try {
      await actualizarProyectoObra(id, {
        nombre_proyecto: nombreProyecto.trim(),
        codigo_meta: codigoMeta.trim(),
        gerencia: gerencia.trim(),
        dependencia: 'Desarrollo y Mantenimiento de Obras',
        profesional_responsable: profesionalResponsable,
        tipo_contrato: tipoContrato.trim(),
        tipo_ejecucion: tipoEjecucion.trim(),
        poa_origen: poaOrigen.trim(),
        origen_presupuesto: origenPresupuesto.trim(),
        linea_estrategica: lineaEstrategica.trim(),
        programa: programa.trim(),
        canton: canton.trim(),
        distrito: distrito.trim(),

        estado: estado.trim(),
        anio: Number(anio),
        observaciones_meta_poa: observacionesMetaPoa.trim()
      });

      navigate(`/proyectos-obra/${id}`);
    } catch (err: any) {
      console.error('Error al actualizar el proyecto:', err);
      alert('Ocurrió un error al actualizar el proyecto: ' + (err.message || err));
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#a1a1aa]">Cargando datos del proyecto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-4 md:p-8 space-y-6">
      {/* Volver y Título */}
      <div className="space-y-4">
        <Link
          to={`/proyectos-obra/${id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#a1a1aa] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Detalle del Proyecto</span>
        </Link>

        <div className="flex items-center justify-between border-b border-[#27272a] pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white">Editar Proyecto de Obra</h1>
              <p className="text-sm text-[#a1a1aa]">Modifique los datos generales del proyecto ID: {id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Sección 1: Datos Principales */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-6">
          <h3 className="text-lg font-bold text-white border-b border-[#27272a] pb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#0071E3]" />
            <span>Información General del Proyecto</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">
                Nombre del Proyecto <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={nombreProyecto}
                onChange={(e) => setNombreProyecto(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Código Meta</label>
              <input
                type="text"
                value={codigoMeta}
                onChange={(e) => setCodigoMeta(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all"
              />
            </div>

            {/* Gerencia Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Gerencia</label>
              <select
                value={gerencia}
                onChange={(e) => setGerencia(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all cursor-pointer"
              >
                <option value="">--Seleccionar--</option>
                <option value="Provisión de Servicios">Provisión de Servicios</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">
                Profesional Responsable
              </label>
              <select
                value={profesionalResponsable}
                onChange={(e) => setProfesionalResponsable(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all cursor-pointer"
              >
                <option value="">--Seleccionar--</option>
                {colaboradores.map((c) => (
                  <option key={c.identificacion || c.alias} value={c.alias || c.colaborador}>
                    {c.alias || c.colaborador}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sección 2: Clasificación y Planificación */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-6">
          <h3 className="text-lg font-bold text-white border-b border-[#27272a] pb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0071E3]" />
            <span>Clasificación y Planificación</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tipo de Contrato */}
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Tipo de Contrato</label>
              <select
                value={tipoContrato}
                onChange={(e) => setTipoContrato(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all cursor-pointer"
              >
                <option value="">--Seleccionar--</option>
                <option value="Obra Pública">Obra Pública</option>
                <option value="Servicio">Servicio</option>
                <option value="Insumos">Insumos</option>
              </select>
            </div>

            {/* Tipo de Ejecución */}
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Tipo de Ejecución</label>
              <select
                value={tipoEjecucion}
                onChange={(e) => setTipoEjecucion(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all cursor-pointer"
              >
                <option value="">--Seleccionar--</option>
                <option value="Contrato">Contrato</option>
                <option value="Administración">Administración</option>
                <option value="Mixto">Mixto</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">POA Origen</label>
              <input
                type="text"
                value={poaOrigen}
                onChange={(e) => setPoaOrigen(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all"
              />
            </div>

            {/* Origen Presupuesto */}
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Origen Presupuesto</label>
              <select
                value={origenPresupuesto}
                onChange={(e) => setOrigenPresupuesto(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all cursor-pointer"
              >
                <option value="">--Seleccionar--</option>
                <option value="Ordinario">Ordinario</option>
                <option value="Extraordinario">Extraordinario</option>
                <option value="Fondo de emergencias">Fondo de emergencias</option>
              </select>
            </div>

            {/* Línea Estratégica */}
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Línea Estratégica</label>
              <select
                value={lineaEstrategica}
                onChange={(e) => setLineaEstrategica(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all cursor-pointer"
              >
                <option value="">--Seleccionar--</option>
                <option value="Planificación_urbana_y_movilidad_sostenible">Planificación urbana y movilidad sostenible</option>
                <option value="Resiliencia_y_sostenibilidad_ambiental">Resiliencia y sostenibilidad ambiental</option>
                <option value="Equilibrio_y_Derecho_a_la_Ciudad">Equilibrio y Derecho a la Ciudad</option>
                <option value="Gestión_Operativa_y_Administrativa_Ordinaria">Gestión Operativa y Administrativa Ordinaria</option>
                <option value="Competitividad_e_Innovación">Competitividad e Innovación</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Programa</label>
              <input
                type="text"
                value={programa}
                onChange={(e) => setPrograma(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Sección 3: Ubicación y Estado */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-6">
          <h3 className="text-lg font-bold text-white border-b border-[#27272a] pb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>Ubicación y Estado</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cantón */}
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Cantón</label>
              <select
                value={canton}
                onChange={(e) => setCanton(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all cursor-pointer"
              >
                <option value="">--Seleccionar--</option>
                <option value="San José">San José</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Distrito</label>
              <input
                type="text"
                value={distrito}
                onChange={(e) => setDistrito(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all"
              />
            </div>



            {/* Estado */}
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all cursor-pointer"
              >
                <option value="">--Seleccionar--</option>
                <option value="Activo">Activo</option>
                <option value="Adjudicado">Adjudicado</option>
                <option value="Finalizado">Finalizado</option>
                <option value="Suspendido">Suspendido</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Año</label>
              <input
                type="number"
                value={anio}
                onChange={(e) => setAnio(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Observaciones Meta POA</label>
              <textarea
                rows={4}
                value={observacionesMetaPoa}
                onChange={(e) => setObservacionesMetaPoa(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex justify-end gap-4 pt-4 border-t border-[#27272a]">
          <Link
            to={`/proyectos-obra/${id}`}
            className="px-6 py-3 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-xl text-sm font-semibold transition-all"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={guardando}
            className="flex items-center gap-2 px-7 py-3 bg-[#0071E3] hover:bg-[#0071E3]/80 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-[#0071E3]/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{guardando ? 'Guardando Cambios...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
