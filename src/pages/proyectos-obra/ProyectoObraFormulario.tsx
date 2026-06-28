import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SemaforoColor } from '../../types/proyectosObra';
import { crearProyectoObra, getDependenciasProyectos, getColaboradores } from '../../lib/proyectosObraService';
import { ArrowLeft, Save, Building2, User, Layers, DollarSign, FileText, Calendar } from 'lucide-react';

export default function ProyectoObraFormulario() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(false);
  const [dependenciasExistentes, setDependenciasExistentes] = useState<string[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);

  // Estado del formulario (inicializados en vacíos para mostrar "--Seleccionar--")
  const [nombreProyecto, setNombreProyecto] = useState<string>('');
  const [codigoMeta, setCodigoMeta] = useState<string>('');
  const [gerencia, setGerencia] = useState<string>('');
  const [dependencia, setDependencia] = useState<string>('');
  const [nuevaDependencia, setNuevaDependencia] = useState<string>('');
  const [profesionalResponsable, setProfesionalResponsable] = useState<string>('');
  const [tipoContrato, setTipoContrato] = useState<string>('');
  const [tipoEjecucion, setTipoEjecucion] = useState<string>('');
  const [poaOrigen, setPoaOrigen] = useState<string>('');
  const [origenPresupuesto, setOrigenPresupuesto] = useState<string>('');
  const [lineaEstrategica, setLineaEstrategica] = useState<string>('');
  const [programa, setPrograma] = useState<string>('');
  const [canton, setCanton] = useState<string>('');
  const [distrito, setDistrito] = useState<string>('');
  const [semaforo, setSemaforo] = useState<SemaforoColor>('Verde');
  const [estado, setEstado] = useState<string>('');
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [observacionesMetaPoa, setObservacionesMetaPoa] = useState<string>('');
  const [presupuestoAsignado, setPresupuestoAsignado] = useState<number>(0);

  useEffect(() => {
    cargarCatalogos();
  }, []);

  const cargarCatalogos = async () => {
    const [deps, colabs] = await Promise.all([
      getDependenciasProyectos(),
      getColaboradores()
    ]);
    setDependenciasExistentes(deps);
    setColaboradores(colabs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreProyecto.trim()) {
      alert('El nombre del proyecto es obligatorio.');
      return;
    }

    setLoading(true);
    try {
      const depFinal = dependencia === '__OTRA__' ? nuevaDependencia.trim() : dependencia;

      await crearProyectoObra(
        {
          nombre_proyecto: nombreProyecto.trim(),
          codigo_meta: codigoMeta.trim(),
          gerencia: gerencia.trim(),
          dependencia: depFinal,
          profesional_responsable: profesionalResponsable,
          tipo_contrato: tipoContrato.trim(),
          tipo_ejecucion: tipoEjecucion.trim(),
          poa_origen: poaOrigen.trim(),
          origen_presupuesto: origenPresupuesto.trim(),
          linea_estrategica: lineaEstrategica.trim(),
          programa: programa.trim(),
          canton: canton.trim(),
          distrito: distrito.trim(),
          semaforo,
          estado: estado.trim(),
          anio: Number(anio),
          observaciones_meta_poa: observacionesMetaPoa.trim(),
          activo: true
        },
        Number(presupuestoAsignado)
      );

      navigate('/proyectos-obra');
    } catch (err: any) {
      console.error('Error al guardar el proyecto:', err);
      alert('Ocurrió un error al registrar el proyecto: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-4 md:p-8 space-y-6">
      {/* Volver y Título */}
      <div className="space-y-4">
        <Link
          to="/proyectos-obra"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#a1a1aa] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Proyectos</span>
        </Link>

        <div className="flex items-center justify-between border-b border-[#27272a] pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white">Registrar Nuevo Proyecto</h1>
              <p className="text-sm text-[#a1a1aa]">Ingrese la información del proyecto de obra para el SDMO</p>
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
                placeholder="Ej. Construcción de Red Pluvial Distrito Catedral"
                value={nombreProyecto}
                onChange={(e) => setNombreProyecto(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Código Meta</label>
              <input
                type="text"
                placeholder="Ej. META-2026-04"
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

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Dependencia</label>
              <select
                value={dependencia}
                onChange={(e) => setDependencia(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all cursor-pointer"
              >
                <option value="">--Seleccionar--</option>
                {dependenciasExistentes.map((dep) => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
                <option value="__OTRA__">+ Escribir nueva dependencia...</option>
              </select>
              {dependencia === '__OTRA__' && (
                <input
                  type="text"
                  placeholder="Escriba el nombre de la nueva dependencia"
                  value={nuevaDependencia}
                  onChange={(e) => setNuevaDependencia(e.target.value)}
                  className="w-full mt-2 px-4 py-2 bg-[#09090b] border border-[#0071E3] rounded-xl text-sm text-white focus:outline-none"
                  required
                />
              )}
            </div>

            <div>
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
                  <option key={c.identificacion} value={c.identificacion}>
                    {c.colaborador} ({c.identificacion})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sección 2: Clasificación y Contratación */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-6">
          <h3 className="text-lg font-bold text-white border-b border-[#27272a] pb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0071E3]" />
            <span>Clasificación y Planificación</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tipo de Contrato Dropdown */}
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

            {/* Tipo de Ejecución Dropdown */}
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
                placeholder="Ej. POA 2026"
                value={poaOrigen}
                onChange={(e) => setPoaOrigen(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all"
              />
            </div>

            {/* Origen Presupuesto Dropdown */}
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

            {/* Línea Estratégica Dropdown */}
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
                placeholder="Ej. Desarrollo Urbano"
                value={programa}
                onChange={(e) => setPrograma(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Sección 3: Ubicación, Estado y Presupuesto */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-[#27272a] shadow-xl space-y-6">
          <h3 className="text-lg font-bold text-white border-b border-[#27272a] pb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>Ubicación, Estado y Presupuesto Inicial</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cantón Dropdown */}
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
                placeholder="Ej. Catedral, Carmen, Merced..."
                value={distrito}
                onChange={(e) => setDistrito(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Semáforo Inicial</label>
              <select
                value={semaforo}
                onChange={(e) => setSemaforo(e.target.value as SemaforoColor)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all cursor-pointer"
              >
                <option value="Verde">🟢 Verde</option>
                <option value="Rojo">🔴 Rojo</option>
                <option value="Amarillo">🟡 Amarillo</option>
                <option value="Morado">🟣 Morado</option>
                <option value="Azul">🔵 Azul</option>
              </select>
            </div>

            {/* Estado Dropdown */}
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

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">
                Presupuesto Asignado Inicial (₡)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={presupuestoAsignado}
                onChange={(e) => setPresupuestoAsignado(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Observaciones Meta POA</label>
              <textarea
                rows={4}
                placeholder="Detalles adicionales, metas asociadas o justificación..."
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
            to="/proyectos-obra"
            className="px-6 py-3 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-xl text-sm font-semibold transition-all"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-7 py-3 bg-[#0071E3] hover:bg-[#0071E3]/80 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-[#0071E3]/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Guardando Proyecto...' : 'Guardar Proyecto'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
