import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ProyectoObraConDetalles } from '../../types/proyectosObra';
import { getProyectosObra, getAniosProyectos } from '../../lib/proyectosObraService';
import { generarInformeGeneralExcel } from '../../lib/reportesService';
import { ProyectoCard } from '../../components/proyectos/ProyectoCard';
import { Search, Filter, LayoutDashboard, ChevronLeft, ChevronRight, RefreshCw, Layers, Plus, MapPin, FileSpreadsheet } from 'lucide-react';

export default function ProyectosObraLista() {
  const [proyectos, setProyectos] = useState<ProyectoObraConDetalles[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generandoExcel, setGenerandoExcel] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pagina, setPagina] = useState<number>(1);
  const porPagina = 15;

  // Filtros
  const [filtroNombre, setFiltroNombre] = useState<string>('');
  const [filtroAnio, setFiltroAnio] = useState<string>('');


  // Listas para dropdowns de filtros
  const [anios, setAnios] = useState<number[]>([]);

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    cargarProyectos();
  }, [pagina, filtroAnio]);

  const cargarCatalogos = async () => {
    const ans = await getAniosProyectos();
    setAnios(ans);
  };

  const cargarProyectos = async () => {
    setLoading(true);
    try {
      const res = await getProyectosObra(
        {
          nombre: filtroNombre,
          anio: filtroAnio
        },
        pagina,
        porPagina
      );
      setProyectos(res.proyectos);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.error('Error al cargar la lista de proyectos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    cargarProyectos();
  };

  const handleLimpiarFiltros = () => {
    setFiltroNombre('');
    setFiltroAnio('');
    setPagina(1);
  };

  const handleDescargarInformeGeneral = async () => {
    setGenerandoExcel(true);
    try {
      await generarInformeGeneralExcel();
    } finally {
      setGenerandoExcel(false);
    }
  };

  const totalPaginas = Math.ceil(totalCount / porPagina) || 1;

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] p-4 md:p-8 space-y-8">
      {/* Header y Navegación rápida */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272a] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
              <Layers className="w-6 h-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Proyectos de Obra</h1>
          </div>
          <p className="text-sm text-[#a1a1aa]">
            Gestión y seguimiento de obras del Sistema de Desarrollo y Mantenimiento de Obras (SDMO)
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/proyectos-obra/nuevo"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0071E3]/80 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-[#0071E3]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Proyecto</span>
          </Link>
          <button
            onClick={handleDescargarInformeGeneral}
            disabled={generandoExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white text-sm font-semibold transition-all duration-200 border border-[#3f3f46]/50 shadow-sm disabled:opacity-50"
            title="Descargar Informe General Consolidado en Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{generandoExcel ? 'Generando...' : 'Informe General'}</span>
          </button>
          <Link
            to="/proyectos-obra/mapa"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white text-sm font-semibold transition-all duration-200 border border-[#3f3f46]/50 shadow-sm"
          >
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Ver Mapa</span>
          </Link>
          <Link
            to="/proyectos-obra/dashboard"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white text-sm font-semibold transition-all duration-200 border border-[#3f3f46]/50 shadow-sm"
          >
            <LayoutDashboard className="w-4 h-4 text-[#0071E3]" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-[#18181b] p-5 rounded-2xl border border-[#27272a] shadow-xl space-y-4">
        <form onSubmit={handleBuscar} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Nombre */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717a]" />
            <input
              type="text"
              placeholder="Buscar por nombre de proyecto..."
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white placeholder-[#71717a] focus:outline-none focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] transition-all"
            />
          </div>

          {/* Año */}
          <div>
            <select
              value={filtroAnio}
              onChange={(e) => { setFiltroAnio(e.target.value); setPagina(1); }}
              className="w-full px-3 py-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-sm text-white focus:outline-none focus:border-[#0071E3] transition-all cursor-pointer"
            >
              <option value="">Todos los Años</option>
              {anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>


        </form>

        <div className="flex justify-between items-center pt-2 border-t border-[#27272a]/50 text-xs text-[#a1a1aa]">
          <span>Mostrando <strong>{proyectos.length}</strong> de <strong>{totalCount}</strong> proyectos</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLimpiarFiltros}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Limpiar Filtros</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Proyectos */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-[#18181b] rounded-xl border border-[#27272a] animate-pulse p-5 space-y-4">
              <div className="h-4 bg-[#27272a] rounded w-1/3" />
              <div className="h-6 bg-[#27272a] rounded w-3/4" />
              <div className="h-4 bg-[#27272a] rounded w-1/2" />
              <div className="h-12 bg-[#27272a] rounded mt-auto" />
            </div>
          ))}
        </div>
      ) : proyectos.length === 0 ? (
        <div className="bg-[#18181b] rounded-2xl border border-[#27272a] p-12 text-center space-y-4">
          <Filter className="w-12 h-12 text-[#71717a] mx-auto opacity-40" />
          <h3 className="text-lg font-bold text-white">No se encontraron proyectos</h3>
          <p className="text-sm text-[#a1a1aa] max-w-md mx-auto">
            No hay registros que coincidan con los filtros seleccionados. Intente cambiando los parámetros de búsqueda.
          </p>
          <button
            onClick={handleLimpiarFiltros}
            className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-white text-sm font-semibold rounded-xl transition-all"
          >
            Restablecer Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proyectos.map((proyecto) => (
            <ProyectoCard key={proyecto.id} proyecto={proyecto} />
          ))}
        </div>
      )}

      {/* Paginación (15 por página) */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between bg-[#18181b] px-6 py-4 rounded-xl border border-[#27272a]">
          <span className="text-xs text-[#a1a1aa]">
            Página <strong className="text-white">{pagina}</strong> de <strong className="text-white">{totalPaginas}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={pagina === 1}
              onClick={() => setPagina((prev) => Math.max(prev - 1, 1))}
              className="p-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-40 disabled:hover:bg-[#27272a] text-white transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              disabled={pagina === totalPaginas}
              onClick={() => setPagina((prev) => Math.min(prev + 1, totalPaginas))}
              className="p-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-40 disabled:hover:bg-[#27272a] text-white transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
