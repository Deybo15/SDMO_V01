import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Search,
    Filter,
    Calendar,
    FileText,
    Eye,
    RotateCw,
    CheckCircle,
    XCircle,
    PlayCircle,
    Wrench,
    Package,
    PlusCircle,
    Save,
    X,
    Loader2,
    Info,
    AlertTriangle,
    History,
    ChevronLeft,
    ChevronRight,
    ArrowRight,
    Download,
    Layers,
    Clock,
    Eraser,
    TrendingUp
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

// Interfaces
interface SolicitudSTI {
    numero_solicitud: number;
    fecha_solicitud: string;
    descripcion_solicitud: string;
    tipo_solicitud: string;
    supervisor_asignado: string | null;
    estado_actual?: string;
    supervisor_alias?: string;
}

interface Seguimiento {
    id_seguimiento?: number;
    numero_solicitud: number;
    estado_actual: string;
    fecha_inicio: string | null;
    fecha_finalizacion: string | null;
}

interface RegistroSeguimiento {
    id_registro?: number;
    numero_solicitud: number;
    fecha_registro: string;
    registro_seguimiento: string;
}

interface ArticuloAsociado {
    id_salida: number;
    fecha_salida: string;
    cantidad: number;
    nombre_articulo: string;
    codigo_articulo: string;
}

export default function SeguimientoSolicitud() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [solicitudes, setSolicitudes] = useState<SolicitudSTI[]>([]);
    const [stats, setStats] = useState({ total: 0, activas: 0, ejecutadas: 0, canceladas: 0 });
    const [totalRecords, setTotalRecords] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [activeEstado, setActiveEstado] = useState('');

    // Pagination
    const [page, setPage] = useState(1);
    const pageSize = 25;

    // Sorting
    const [sortCol, setSortCol] = useState<string>('numero_solicitud');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Modal State
    const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudSTI | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);

    // Modal Data
    const [seguimientoData, setSeguimientoData] = useState<Seguimiento | null>(null);
    const [registros, setRegistros] = useState<RegistroSeguimiento[]>([]);
    const [articulos, setArticulos] = useState<ArticuloAsociado[]>([]);
    const [articulosLoading, setArticulosLoading] = useState(false);

    // Form New Register
    const [showNuevoRegistro, setShowNuevoRegistro] = useState(false);
    const [nuevoRegistro, setNuevoRegistro] = useState({ fecha: new Date().toISOString().split('T')[0], texto: '' });

    // Notification State
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const themeColor = 'amber';

    const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // Helper to fetch all records handling 1000-row limit
    const fetchAll = async (table: string, select: string, filterField?: string, filterValue?: string) => {
        let allData: any[] = [];
        let pageIdx = 0;
        const size = 1000;
        while (true) {
            let query = supabase
                .from(table)
                .select(select)
                .range(pageIdx * size, (pageIdx + 1) * size - 1);

            if (filterField && filterValue) {
                query = query.eq(filterField, filterValue);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) break;
            allData.push(...data);
            if (data.length < size) break;
            pageIdx++;
        }
        return allData;
    };

    // Load Stats
    const loadStats = async () => {
        try {
            const { count: total } = await supabase
                .from('solicitud_17')
                .select('*', { count: 'exact', head: true })
                .eq('tipo_solicitud', 'STI');

            const allSeguimientos = await fetchAll('seguimiento_solicitud', 'numero_solicitud, estado_actual');
            const allStiIdsData = await fetchAll('solicitud_17', 'numero_solicitud', 'tipo_solicitud', 'STI');
            const stiIdsSet = new Set(allStiIdsData.map((s: any) => s.numero_solicitud));

            const newStats = {
                total: total || 0,
                activas: 0,
                ejecutadas: 0,
                canceladas: 0
            };

            let seguimientosCounted = 0;
            allSeguimientos.forEach((s: any) => {
                if (stiIdsSet.has(s.numero_solicitud)) {
                    seguimientosCounted++;
                    const estado = s.estado_actual?.toUpperCase();
                    if (estado === 'ACTIVA') newStats.activas++;
                    else if (estado === 'EJECUTADA') newStats.ejecutadas++;
                    else if (estado === 'CANCELADA') newStats.canceladas++;
                }
            });

            const sinRegistro = (total || 0) - seguimientosCounted;
            newStats.activas += Math.max(0, sinRegistro);

            setStats(newStats);
        } catch (error) {
            console.error("Error loading stats:", error);
        }
    };

    // Fetch Paginated Data
    const fetchSolicitudes = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('solicitud_17')
                .select('numero_solicitud, fecha_solicitud, descripcion_solicitud, tipo_solicitud, supervisor_asignado', { count: 'exact' })
                .eq('tipo_solicitud', 'STI');

            if (activeEstado) {
                const idsData = await fetchAll('seguimiento_solicitud', 'numero_solicitud', 'estado_actual', activeEstado);
                const ids = idsData.map((i: any) => i.numero_solicitud);
                if (ids.length === 0) {
                    setSolicitudes([]);
                    setTotalRecords(0);
                    setLoading(false);
                    return;
                }
                query = query.in('numero_solicitud', ids);
            }

            if (activeSearch) {
                const isNumeric = /^\d+$/.test(activeSearch);
                if (isNumeric) {
                    query = query.or(`numero_solicitud.eq.${activeSearch},descripcion_solicitud.ilike.%${activeSearch}%`);
                } else {
                    query = query.ilike('descripcion_solicitud', `%${activeSearch}%`);
                }
            }

            query = query.order(sortCol as any, { ascending: sortDir === 'asc' });

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data, count, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                setSolicitudes([]);
                setTotalRecords(0);
                return;
            }

            setTotalRecords(count || 0);

            // Fetch relations
            const ids = data.map(s => s.numero_solicitud);
            const supIds = data.map(s => s.supervisor_asignado).filter(Boolean) as string[];

            const { data: estadosData } = await supabase.from('seguimiento_solicitud').select('numero_solicitud, estado_actual').in('numero_solicitud', ids);
            const { data: colabsData } = await supabase.from('colaboradores_06').select('identificacion, alias').in('identificacion', supIds);

            const estadosMap = new Map();
            estadosData?.forEach(s => estadosMap.set(s.numero_solicitud, s.estado_actual));

            const colabsMap = new Map();
            colabsData?.forEach(c => colabsMap.set(c.identificacion, c.alias));

            setSolicitudes(data.map(s => ({
                ...s,
                estado_actual: estadosMap.get(s.numero_solicitud) || 'ACTIVA',
                supervisor_alias: s.supervisor_asignado ? (colabsMap.get(s.supervisor_asignado) || 'No asignado') : 'No asignado'
            })));

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [page, activeSearch, activeEstado, sortCol, sortDir]);

    useEffect(() => { loadStats(); }, []);
    useEffect(() => { fetchSolicitudes(); }, [fetchSolicitudes]);

    const handleApplyFilters = () => {
        setPage(1);
        setActiveSearch(searchTerm);
        setActiveEstado(filterEstado);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilterEstado('');
        setPage(1);
        setActiveSearch('');
        setActiveEstado('');
    };

    const handleExportExcel = async () => {
        setLoading(true);
        try {
            // High limit fetch for export
            let query = supabase.from('solicitud_17').select('numero_solicitud, fecha_solicitud, descripcion_solicitud, supervisor_asignado').eq('tipo_solicitud', 'STI');
            if (activeEstado) {
                const idsData = await fetchAll('seguimiento_solicitud', 'numero_solicitud', 'estado_actual', activeEstado);
                query = query.in('numero_solicitud', idsData.map(i => i.numero_solicitud));
            }
            if (activeSearch) {
                const isNumeric = /^\d+$/.test(activeSearch);
                if (isNumeric) query = query.or(`numero_solicitud.eq.${activeSearch},descripcion_solicitud.ilike.%${activeSearch}%`);
                else query = query.ilike('descripcion_solicitud', `%${activeSearch}%`);
            }

            const { data: allData } = await query.order('numero_solicitud', { ascending: false }).limit(2000);
            if (!allData || allData.length === 0) return;

            const ws = XLSX.utils.json_to_sheet(allData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "STI");
            XLSX.writeFile(wb, `Seguimiento_STI_${new Date().toISOString().split('T')[0]}.xlsx`);
            showNotification('Exportado exitosamente', 'success');
        } catch (error) {
            showNotification('Error al exportar', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Modal Handlers
    const handleOpenModal = async (solicitud: SolicitudSTI) => {
        setSelectedSolicitud(solicitud);
        setIsModalOpen(true);
        setModalLoading(true);

        try {
            let { data: segData } = await supabase.from('seguimiento_solicitud').select('*').eq('numero_solicitud', solicitud.numero_solicitud).maybeSingle();
            if (!segData) {
                const { data: newSeg } = await supabase.from('seguimiento_solicitud').insert({ numero_solicitud: solicitud.numero_solicitud, estado_actual: 'ACTIVA' }).select().single();
                segData = newSeg;
            }
            setSeguimientoData(segData);

            const { data: regData } = await supabase.from('registro_seguimiento_solicitud').select('*').eq('numero_solicitud', solicitud.numero_solicitud).order('fecha_registro', { ascending: false });
            setRegistros(regData || []);

            // Articulos
            const { data: salidas } = await supabase.from('salida_articulo_08').select(`id_salida, fecha_salida, dato_salida_13(cantidad, articulo, articulo_01(nombre_articulo))`).eq('numero_solicitud', solicitud.numero_solicitud);
            const found: ArticuloAsociado[] = [];
            salidas?.forEach((s: any) => s.dato_salida_13?.forEach((d: any) => found.push({
                id_salida: s.id_salida,
                fecha_salida: s.fecha_salida,
                cantidad: d.cantidad,
                nombre_articulo: d.articulo_01?.nombre_articulo || 'N/A',
                codigo_articulo: d.articulo
            })));
            setArticulos(found);
        } finally {
            setModalLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans relative">
            {/* Background Halos */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[85%] left-[20%] w-[80rem] h-[80rem] bg-amber-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
                <div className="absolute top-[15%] right-[20%] w-[80rem] h-[80rem] bg-indigo-500/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>
            </div>

            {/* Header */}
            <div className="max-w-7xl mx-auto px-1 pt-6 flex flex-col gap-8 relative z-10">
                <PageHeader
                    title="SEGUIMIENTO STI"
                    icon={Wrench}
                    themeColor="amber"
                    backRoute="/cliente-interno"
                />

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Solicitudes', value: stats.total, icon: Layers, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        { label: 'En Ejecución', value: stats.activas, icon: PlayCircle, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                        { label: 'Terminadas', value: stats.ejecutadas, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { label: 'Canceladas', value: stats.canceladas, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' }
                    ].map((m, i) => (
                        <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 flex items-center gap-3 group hover:bg-white/[0.08] transition-all duration-300">
                            <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center ${m.color}`}>
                                <m.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{m.label}</p>
                                <p className="text-xl font-black text-white mt-1">{m.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <main className="relative z-10 max-w-7xl mx-auto p-6 space-y-6">
                {/* Advanced Filters */}
                <section className="relative group/filters">
                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-[2.5rem] blur opacity-25"></div>
                    <div className="relative bg-[#1E293B]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tight">Filtros Avanzados</h2>
                                    <p className="text-gray-400 text-sm mt-1">Localiza tickets por descripción, número o estado.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleApplyFilters} className="px-6 py-3 bg-amber-500 text-black font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2">
                                        <Search className="w-5 h-5" /> APLICAR FILTROS
                                    </button>
                                    <button onClick={clearFilters} className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 rounded-2xl border border-white/10"><Eraser className="w-5 h-5" /></button>
                                    <button onClick={handleExportExcel} className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/20"><Download className="w-5 h-5" /></button>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Descripción / # Ticket</label>
                                <div className="relative group/input">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within/input:text-amber-500" />
                                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleApplyFilters()} className="w-full bg-black/20 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:border-amber-500/50" placeholder="Ej: Fugas de agua o #1024" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Filtrar por Estado</label>
                                <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-2xl py-4 px-6 text-white appearance-none cursor-pointer">
                                    <option value="">Todos los Estados</option>
                                    <option value="ACTIVA">Activa</option>
                                    <option value="EJECUTADA">Ejecutada</option>
                                    <option value="CANCELADA">Cancelada</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Results Table */}
                <section className="bg-[#1E293B]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/5">
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer" onClick={() => { setSortCol('numero_solicitud'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>Ticket</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Fecha</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Descripción</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Estado</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" /></td></tr>
                                ) : solicitudes.map(sol => (
                                    <tr key={sol.numero_solicitud} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-8 py-6 font-black text-white italic tracking-tighter text-lg">#{sol.numero_solicitud}</td>
                                        <td className="px-8 py-6 text-sm text-gray-400">{new Date(sol.fecha_solicitud).toLocaleDateString()}</td>
                                        <td className="px-8 py-6 text-sm font-medium text-gray-300 max-w-md truncate">{sol.descripcion_solicitud}</td>
                                        <td className="px-8 py-6">
                                            <span className={cn(
                                                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                sol.estado_actual === 'ACTIVA' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.1)]' :
                                                    sol.estado_actual === 'EJECUTADA' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                                        'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                            )}>
                                                {sol.estado_actual}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button onClick={() => handleOpenModal(sol)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 group-hover:border-amber-500/50">
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Simple Pagination */}
                    <div className="p-6 bg-black/20 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Total: {totalRecords} Solicitudes</span>
                        <div className="flex gap-2">
                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 bg-white/5 rounded-lg disabled:opacity-20"><ChevronLeft size={20} /></button>
                            <span className="px-4 py-2 bg-white/5 rounded-lg text-sm font-bold">{page}</span>
                            <button disabled={page * pageSize >= totalRecords} onClick={() => setPage(p => p + 1)} className="p-2 bg-white/5 rounded-lg disabled:opacity-20"><ChevronRight size={20} /></button>
                        </div>
                    </div>
                </section>
            </main>

            {/* Modal de Detalle (Glassmorphic) */}
            {isModalOpen && selectedSolicitud && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0F172A]/90 backdrop-blur-xl" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative w-full max-w-5xl bg-[#1E293B] border border-white/10 rounded-[2.5rem] shadow-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500"><Wrench size={28} /></div>
                                <div>
                                    <h2 className="text-2xl font-black text-white italic tracking-tighter">Ticket STI #{selectedSolicitud.numero_solicitud}</h2>
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Información detallada y bitácora</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full"><X size={24} /></button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Details Column */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-6">
                                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Info size={14} />Descripción</h4>
                                        <p className="text-white font-medium leading-relaxed italic">"{selectedSolicitud.descripcion_solicitud}"</p>
                                        <div className="grid grid-cols-2 mt-6 gap-4 text-[11px]">
                                            <div><span className="block text-gray-500 uppercase font-black tracking-tighter">Fecha</span> <span className="text-white font-bold">{new Date(selectedSolicitud.fecha_solicitud).toLocaleDateString()}</span></div>
                                            <div><span className="block text-gray-500 uppercase font-black tracking-tighter">Supervisor</span> <span className="text-white font-bold">{selectedSolicitud.supervisor_alias}</span></div>
                                        </div>
                                    </div>

                                    {/* Timeline Bitacora */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2"><History size={14} />Historial de Avance</h4>
                                            <button onClick={() => setShowNuevoRegistro(!showNuevoRegistro)} className="text-[10px] font-black text-emerald-400 hover:underline">AGREGAR REGISTRO</button>
                                        </div>

                                        {showNuevoRegistro && (
                                            <div className="bg-white/5 border border-emerald-500/20 rounded-[2rem] p-6 space-y-4">
                                                <input type="date" value={nuevoRegistro.fecha} onChange={e => setNuevoRegistro(p => ({ ...p, fecha: e.target.value }))} className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                                                <textarea value={nuevoRegistro.texto} onChange={e => setNuevoRegistro(p => ({ ...p, texto: e.target.value }))} placeholder="Escriba el detalle del avance..." className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 text-sm text-white min-h-[100px]" />
                                                <div className="flex justify-end gap-3">
                                                    <button onClick={() => setShowNuevoRegistro(false)} className="text-xs font-bold text-gray-500">Cancelar</button>
                                                    <button onClick={async () => {
                                                        const { error } = await supabase.from('registro_seguimiento_solicitud').insert({ numero_solicitud: selectedSolicitud.numero_solicitud, fecha_registro: nuevoRegistro.fecha, registro_seguimiento: nuevoRegistro.texto });
                                                        if (!error) { showNotification('Registro guardado', 'success'); setShowNuevoRegistro(false); handleOpenModal(selectedSolicitud); }
                                                    }} className="bg-emerald-500 text-black px-6 py-2 rounded-xl text-xs font-bold">Guardar</button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {registros.map((reg, idx) => (
                                                <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 border-l-4 border-l-amber-500/50">
                                                    <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">{new Date(reg.fecha_registro).toLocaleDateString()}</div>
                                                    <p className="text-sm text-gray-300 italic">"{reg.registro_seguimiento}"</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Sidebar Column */}
                                <div className="space-y-6">
                                    <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 space-y-6">
                                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Clock size={14} />Gestión de Estado</h4>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-gray-600 uppercase ml-2">Estado Actual</label>
                                                <select
                                                    value={seguimientoData?.estado_actual || ''}
                                                    onChange={e => setSeguimientoData(p => p ? { ...p, estado_actual: e.target.value } : null)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-sm font-bold italic"
                                                >
                                                    <option value="ACTIVA">ACTIVA</option>
                                                    <option value="EJECUTADA">EJECUTADA</option>
                                                    <option value="CANCELADA">CANCELADA</option>
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-600 uppercase ml-2">Inicio</label>
                                                    <input type="date" value={seguimientoData?.fecha_inicio || ''} onChange={e => setSeguimientoData(p => p ? { ...p, fecha_inicio: e.target.value } : null)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-2 px-4 text-xs" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-600 uppercase ml-2">Fin</label>
                                                    <input type="date" value={seguimientoData?.fecha_finalizacion || ''} onChange={e => setSeguimientoData(p => p ? { ...p, fecha_finalizacion: e.target.value } : null)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-2 px-4 text-xs" />
                                                </div>
                                            </div>
                                            <button onClick={async () => {
                                                const { error } = await supabase.from('seguimiento_solicitud').update({
                                                    estado_actual: seguimientoData?.estado_actual,
                                                    fecha_inicio: seguimientoData?.fecha_inicio || null,
                                                    fecha_finalizacion: seguimientoData?.fecha_finalizacion || null
                                                }).eq('numero_solicitud', selectedSolicitud.numero_solicitud);
                                                if (!error) { showNotification('Actualizado', 'success'); setIsModalOpen(false); fetchSolicitudes(); loadStats(); }
                                            }} className="w-full py-4 bg-amber-500 text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-lg mt-2">GUARDAR CAMBIOS</button>
                                        </div>
                                    </div>

                                    {/* Articles */}
                                    <div className="bg-black/20 border border-white/5 rounded-[2rem] p-6 space-y-4">
                                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Package size={14} />Materiales ({articulos.length})</h4>
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                                            {articulos.map((art, idx) => (
                                                <div key={idx} className="bg-white/5 p-3 rounded-xl flex justify-between items-center text-[11px] group hover:bg-white/10">
                                                    <div className="truncate"><span className="block font-black text-white italic">{art.nombre_articulo}</span> <span className="text-gray-500">{art.codigo_articulo}</span></div>
                                                    <div className="font-black text-amber-500 text-sm italic">{art.cantidad}</div>
                                                </div>
                                            ))}
                                            {articulos.length === 0 && <p className="text-center text-[9px] font-black text-gray-700 py-4 uppercase">Sin materiales vinculados</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
            `}</style>
        </div>
    );
}
