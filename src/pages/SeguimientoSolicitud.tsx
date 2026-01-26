import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Search,
    Eye,
    CheckCircle,
    XCircle,
    PlayCircle,
    Wrench,
    Package,
    PlusCircle,
    X,
    History,
    ChevronLeft,
    Download,
    Clock,
    Eraser,
    LayoutGrid,
    Calendar // Added for date fields
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
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

// --- Helper Components ---

const TableSkeleton = () => (
    <>
        {[...Array(5)].map((_, i) => (
            <tr key={i} className="animate-pulse border-b border-white/10">
                <td className="px-8 py-6"><div className="h-4 bg-white/10 rounded w-16"></div></td>
                <td className="px-8 py-6"><div className="h-4 bg-white/10 rounded w-24"></div></td>
                <td className="px-8 py-6"><div className="h-4 bg-white/10 rounded w-full"></div></td>
                <td className="px-8 py-6"><div className="h-4 bg-white/10 rounded w-20"></div></td>
                <td className="px-8 py-6"><div className="h-6 bg-white/10 rounded-full w-24"></div></td>
                <td className="px-8 py-6 text-right"><div className="h-8 bg-white/10 rounded w-8 ml-auto"></div></td>
            </tr>
        ))}
    </>
);

function getEstadoBadge(estado?: string) {
    if (!estado) return <span className="text-white/40 font-bold text-[10px] uppercase tracking-widest px-4 py-1.5 border border-white/20 rounded-full bg-white/10">Sin Registro</span>;
    const colors = {
        'ACTIVA': 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300',
        'EJECUTADA': 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
        'CANCELADA': 'bg-rose-500/20 border-rose-500/50 text-rose-300'
    }[estado] || 'bg-slate-500/20 text-slate-300 border-slate-400/40';

    return <span className={cn("px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-wider border backdrop-blur-md shadow-lg", colors)}>{estado}</span>;
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

    const [showNuevoRegistro, setShowNuevoRegistro] = useState(false);
    const [nuevoRegistro, setNuevoRegistro] = useState({ fecha: new Date().toISOString().split('T')[0], texto: '' });

    // Advanced States
    const [supervisores, setSupervisores] = useState<{ id: string, alias: string }[]>([]);
    const [realtimeChange, setRealtimeChange] = useState(0);
    const [hoveredDescription, setHoveredDescription] = useState<{ id: number; text: string; x: number; y: number } | null>(null);
    const [editingStatusId, setEditingStatusId] = useState<number | null>(null);

    // Notification State
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // --- Data Loaders ---

    const loadMetadata = async () => {
        try {
            const { data } = await supabase.from('colaboradores_06')
                .select('identificacion, alias')
                .not('alias', 'is', null)
                .order('alias');
            if (data) setSupervisores(data.map(d => ({ id: d.identificacion, alias: d.alias })));
        } catch (e) { console.error('Error metadata:', e); }
    };

    const fetchAll = async (table: string, select: string, filterField?: string, filterValue?: string) => {
        let allData: any[] = [];
        let pageIdx = 0;
        const size = 1000;
        try {
            while (true) {
                let query = supabase.from(table).select(select).range(pageIdx * size, (pageIdx + 1) * size - 1);
                if (filterField && filterValue) query = query.eq(filterField, filterValue);
                const { data, error } = await query;
                if (error) throw error;
                if (!data || data.length === 0) break;
                allData.push(...data);
                if (data.length < size) break;
                pageIdx++;
            }
        } catch (e) {
            console.error(`Error fetchAll ${table}:`, e);
        }
        return allData;
    };

    const loadStats = async () => {
        try {
            const { count: total } = await supabase
                .from('solicitud_17')
                .select('numero_solicitud', { count: 'exact', head: true })
                .eq('tipo_solicitud', 'STI');

            const allSeguimientos = await fetchAll('seguimiento_solicitud', 'numero_solicitud, estado_actual');
            const allStiIdsData = await fetchAll('solicitud_17', 'numero_solicitud', 'tipo_solicitud', 'STI');
            const stiIdsSet = new Set(allStiIdsData.map((s: any) => s.numero_solicitud));

            const newStats = { total: total || 0, activas: 0, ejecutadas: 0, canceladas: 0 };
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
        } catch (error) { console.error("Error loading stats:", error); }
    };

    const fetchSolicitudes = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('solicitud_17')
                .select('numero_solicitud, fecha_solicitud, descripcion_solicitud, tipo_solicitud, supervisor_asignado, seguimiento_solicitud!left(estado_actual)', { count: 'exact' })
                .eq('tipo_solicitud', 'STI');

            if (filterEstado) {
                if (filterEstado === 'ACTIVA') {
                    // Filter for ACTIVA: (seguimiento.estado_actual == 'ACTIVA') OR (no seguimiento record exists)
                    query = query.or(`estado_actual.eq.ACTIVA,estado_actual.is.null`, { foreignTable: 'seguimiento_solicitud' });
                } else {
                    // For EJECUTADA or CANCELADA, we only want rows that HAVE an entry with that status
                    query = query.not('seguimiento_solicitud', 'is', null);
                    query = query.eq('seguimiento_solicitud.estado_actual', filterEstado);
                }
            }

            if (searchTerm) {
                const isNumeric = /^\d+$/.test(searchTerm);
                if (isNumeric) {
                    query = query.or(`numero_solicitud.eq.${searchTerm},descripcion_solicitud.ilike.%${searchTerm}%`);
                } else {
                    query = query.ilike('descripcion_solicitud', `%${searchTerm}%`);
                }
            }

            query = query.order(sortCol as any, { ascending: sortDir === 'asc' });

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            const { data, count, error } = await query.range(from, to);

            if (error) throw error;
            if (!data || data.length === 0) {
                setSolicitudes([]); setTotalRecords(0); return;
            }

            setTotalRecords(count || 0);

            const supIds = data.map(s => s.supervisor_asignado).filter(Boolean) as string[];
            let colabsMap = new Map();
            if (supIds.length > 0) {
                const { data: colabsData } = await supabase.from('colaboradores_06').select('identificacion, alias').in('identificacion', supIds);
                colabsData?.forEach(c => colabsMap.set(c.identificacion, c.alias));
            }

            setSolicitudes(data.map((s: any) => {
                const segObj = Array.isArray(s.seguimiento_solicitud) ? s.seguimiento_solicitud[0] : s.seguimiento_solicitud;
                return {
                    ...s,
                    estado_actual: segObj?.estado_actual || 'ACTIVA',
                    supervisor_alias: s.supervisor_asignado ? (colabsMap.get(s.supervisor_asignado) || 'No asignado') : 'No asignado'
                };
            }));

        } catch (error) { console.error('Fetch error:', error); }
        finally { setLoading(false); }
    }, [page, searchTerm, filterEstado, sortCol, sortDir]);

    useEffect(() => {
        loadMetadata(); loadStats();
        const channel = supabase.channel('tracking-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'seguimiento_solicitud' }, () => setRealtimeChange(c => c + 1))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    useEffect(() => { fetchSolicitudes(); }, [fetchSolicitudes, realtimeChange]);

    const clearFilters = () => { setSearchTerm(''); setFilterEstado(''); setPage(1); };

    const handleExportExcel = async () => {
        setLoading(true);
        try {
            let query = supabase.from('solicitud_17').select('numero_solicitud, fecha_solicitud, descripcion_solicitud, supervisor_asignado').eq('tipo_solicitud', 'STI');
            if (filterEstado) {
                const idsData = await fetchAll('seguimiento_solicitud', 'numero_solicitud, estado_actual', 'estado_actual', filterEstado);
                query = query.in('numero_solicitud', idsData.map(i => i.numero_solicitud));
            }
            if (searchTerm) {
                const isNumeric = /^\d+$/.test(searchTerm);
                if (isNumeric) query = query.or(`numero_solicitud.eq.${searchTerm},descripcion_solicitud.ilike.%${searchTerm}%`);
                else query = query.ilike('descripcion_solicitud', `%${searchTerm}%`);
            }
            const { data: allData } = await query.order('numero_solicitud', { ascending: false }).limit(2000);
            if (!allData || allData.length === 0) return;
            const ws = XLSX.utils.json_to_sheet(allData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "STI");
            XLSX.writeFile(wb, `Seguimiento_STI_${new Date().toISOString().split('T')[0]}.xlsx`);
            showNotification('Reporte generado', 'success');
        } catch (error) { showNotification('Error al exportar', 'error'); }
        finally { setLoading(false); }
    };

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
            const { data: salidas } = await supabase.from('salida_articulo_08').select(`id_salida, fecha_salida, dato_salida_13(cantidad, articulo, articulo_01(nombre_articulo))`).eq('numero_solicitud', solicitud.numero_solicitud);
            const found: ArticuloAsociado[] = [];
            salidas?.forEach((s: any) => s.dato_salida_13?.forEach((d: any) => found.push({
                id_salida: s.id_salida, fecha_salida: s.fecha_salida, cantidad: d.cantidad, nombre_articulo: d.articulo_01?.nombre_articulo || 'N/A', codigo_articulo: d.articulo
            })));
            setArticulos(found);
        } finally { setModalLoading(false); }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden p-1">
            <div className="fixed inset-0 pointer-events-none opacity-30">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[160px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[160px]"></div>
            </div>

            <div className="max-w-[1600px] mx-auto px-4 py-8 relative z-10 space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/40 transform hover:scale-105 transition-transform">
                                <Wrench className="w-7 h-7 text-white" />
                            </div>
                            <span className="text-xs font-black text-blue-400 uppercase tracking-[0.4em] drop-shadow-sm">Gestión Operativa</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-none">
                            Seguimiento <span className="text-blue-500">STI</span>
                        </h1>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => navigate('/cliente-interno')} className="h-14 px-8 bg-white/5 border-2 border-white/10 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-3 shadow-xl">
                            <ChevronLeft className="w-5 h-5" /> Regresar
                        </button>
                        <button onClick={handleExportExcel} className="h-14 px-8 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all flex items-center gap-3 shadow-xl">
                            <Download className="w-5 h-5" /> Exportar
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total', value: stats.total, icon: LayoutGrid, color: 'text-blue-400', bg: 'bg-blue-400/20', border: 'border-blue-500/30' },
                        { label: 'Activas', value: stats.activas, icon: PlayCircle, color: 'text-indigo-400', bg: 'bg-indigo-400/20', border: 'border-indigo-500/30' },
                        { label: 'Terminadas', value: stats.ejecutadas, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/20', border: 'border-emerald-500/30' },
                        { label: 'Canceladas', value: stats.canceladas, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-400/20', border: 'border-rose-500/30' }
                    ].map((m, i) => (
                        <div key={i} className={cn("bg-white/[0.04] backdrop-blur-3xl border-2 rounded-[2.5rem] p-7 flex items-center gap-6 group hover:bg-white/[0.06] transition-all shadow-2xl", m.border)}>
                            <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center transition-transform group-hover:rotate-12", m.bg, m.color)}>
                                <m.icon className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-4xl font-black text-white tracking-tighter leading-none">{m.value}</p>
                                <p className="text-[11px] font-black text-white/70 uppercase tracking-widest mt-2">{m.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <section className="bg-white/[0.03] border-2 border-white/20 rounded-[3rem] p-10 space-y-8 shadow-3xl">
                    <div className="flex items-center gap-3 mb-2 px-2">
                        <Search className="w-5 h-5 text-blue-500" />
                        <h2 className="text-sm font-black text-white/90 uppercase tracking-[0.3em]">Criterios de Búsqueda</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
                        <div className="lg:col-span-8 space-y-3">
                            <label className="text-[11px] font-black text-white/60 uppercase tracking-widest ml-3">Búsqueda Unificada</label>
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-blue-500 transition-colors" />
                                <input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} className="w-full bg-slate-900/50 border-2 border-white/10 rounded-3xl h-16 pl-14 pr-6 text-sm text-white font-bold placeholder:text-white/20 focus:border-blue-500 focus:bg-slate-900 transition-all outline-none" placeholder="N° Solicitud o descripción..." />
                            </div>
                        </div>
                        <div className="lg:col-span-3 space-y-3">
                            <label className="text-[11px] font-black text-white/60 uppercase tracking-widest ml-3">Estado</label>
                            <select value={filterEstado} onChange={e => { setFilterEstado(e.target.value); setPage(1); }} className="w-full bg-slate-900/50 border-2 border-white/10 rounded-3xl h-16 px-6 text-sm text-white font-bold appearance-none cursor-pointer focus:border-blue-500 outline-none transition-all">
                                <option value="">Todos</option>
                                <option value="ACTIVA">ACTIVAS</option>
                                <option value="EJECUTADA">EJECUTADAS</option>
                                <option value="CANCELADA">CANCELADAS</option>
                            </select>
                        </div>
                        <div className="lg:col-span-1 flex gap-4 h-16">
                            <button onClick={clearFilters} className="w-full bg-white/5 border-2 border-white/10 rounded-3xl flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-all text-white/40 hover:text-white group"><Eraser className="w-6 h-6 group-hover:rotate-12 transition-transform" /></button>
                        </div>
                    </div>
                </section>

                <section className="bg-white/[0.02] border-2 border-white/20 shadow-3xl rounded-[3.5rem] overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar-h">
                        <table className="w-full text-left border-collapse min-w-[1200px]">
                            <thead>
                                <tr className="bg-white/[0.05] border-b-2 border-white/20 text-[11px] font-black text-white uppercase tracking-[0.2em]">
                                    <th className="px-6 py-8 cursor-pointer hover:text-blue-400 transition-colors" onClick={() => { setSortCol('numero_solicitud'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>N° Solicitud</th>
                                    <th className="px-6 py-8">Fecha</th>
                                    <th className="px-6 py-8">Descripción STI</th>
                                    <th className="px-6 py-8 text-center">Supervisor</th>
                                    <th className="px-6 py-8 text-center">Estado App</th>
                                    <th className="px-6 py-8 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-white/10">
                                {loading ? <TableSkeleton /> : solicitudes.map(sol => (
                                    <tr key={sol.numero_solicitud} className="hover:bg-white/[0.06] transition-all group">
                                        <td className="px-6 py-7 font-black text-blue-400 text-lg">#{sol.numero_solicitud}</td>
                                        <td className="px-6 py-7 text-sm font-bold text-white/80">{new Date(sol.fecha_solicitud).toLocaleDateString()}</td>
                                        <td className="px-6 py-7 truncate max-w-[250px] italic font-medium text-white/90 relative cursor-default" onMouseEnter={e => setHoveredDescription({ id: sol.numero_solicitud, text: sol.descripcion_solicitud, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHoveredDescription(null)}>
                                            {sol.descripcion_solicitud}
                                        </td>
                                        <td className="px-6 py-7 text-xs font-black text-white/70 text-center whitespace-nowrap">
                                            <span className="px-4 py-2 bg-white/5 rounded-2xl border border-white/10 uppercase tracking-tighter">{sol.supervisor_alias}</span>
                                        </td>
                                        <td className="px-6 py-7 text-center">
                                            {getEstadoBadge(sol.estado_actual)}
                                        </td>
                                        <td className="px-6 py-7 text-right">
                                            <button onClick={() => handleOpenModal(sol)} className="w-12 h-12 bg-white/5 border-2 border-white/10 rounded-2xl flex items-center justify-center hover:bg-blue-600 hover:border-blue-400 transition-all text-white hover:shadow-2xl hover:shadow-blue-500/40 active:scale-90"><Eye className="w-6 h-6" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {/* Notifications */}
            {notification && (
                <div className={cn("fixed bottom-10 right-10 z-[9999] px-8 py-5 rounded-[2rem] shadow-3xl border-2 backdrop-blur-3xl flex items-center gap-5 animate-in slide-in-from-bottom-10",
                    notification.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                )}>
                    {notification.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">{notification.message}</span>
                </div>
            )}

            {/* Tooltip con más contraste */}
            {hoveredDescription && (
                <div className="fixed z-[10000] pointer-events-none p-6 bg-slate-900 border-2 border-white/30 rounded-3xl shadow-4xl max-w-md backdrop-blur-2xl animate-in fade-in zoom-in-95" style={{ left: hoveredDescription.x + 20, top: hoveredDescription.y + 20 }}>
                    <p className="text-[12px] text-white leading-relaxed italic font-bold">"{hoveredDescription.text}"</p>
                </div>
            )}

            {/* Status Quick Picker */}
            {editingStatusId && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" onClick={() => setEditingStatusId(null)}></div>
                    <div className="relative bg-slate-950 border-2 border-white/20 rounded-[3rem] p-10 w-full max-w-sm space-y-5 animate-in zoom-in-95 shadow-4xl">
                        <p className="text-[11px] font-black text-white/60 uppercase tracking-[0.3em] text-center mb-4">Actualizar Estado Solicitud</p>
                        {['ACTIVA', 'EJECUTADA', 'CANCELADA'].map(est => (
                            <button key={est} onClick={async () => {
                                const { error } = await supabase.from('seguimiento_solicitud').upsert({ numero_solicitud: editingStatusId, estado_actual: est });
                                if (!error) { showNotification('Estado Sincronizado', 'success'); setEditingStatusId(null); setRealtimeChange(c => c + 1); }
                            }} className="w-full h-16 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest border-2 border-white/10 hover:bg-white/10 hover:border-blue-500 transition-all flex items-center justify-center gap-4 text-white hover:text-blue-400 group">
                                {est}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tracking Detail Modal */}
            {isModalOpen && selectedSolicitud && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative w-full max-w-7xl bg-slate-950 border-2 border-white/20 rounded-[3rem] shadow-4xl overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in-95">
                        <div className="bg-white/5 border-b-2 border-white/10 p-10 flex justify-between items-center">
                            <div>
                                <h2 className="text-4xl font-black text-white tracking-tighter">Solicitud <span className="text-blue-500">#{selectedSolicitud.numero_solicitud}</span></h2>
                                <p className="text-[11px] font-black text-white/50 uppercase tracking-[0.4em] mt-1">Consola de Seguimiento Técnico</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-16 h-16 hover:bg-white/10 rounded-3xl transition-all flex items-center justify-center border-2 border-white/10 text-white/60 hover:text-white hover:border-white/30"><X size={32} /></button>
                        </div>

                        <div className="p-10 overflow-y-auto custom-scrollbar space-y-10 bg-slate-900/40 flex-1">
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                <div className="bg-white/[0.05] border-2 border-white/10 p-7 rounded-[2.5rem] shadow-xl">
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Apertura</p>
                                    <p className="text-2xl font-black text-white">{new Date(selectedSolicitud.fecha_solicitud).toLocaleDateString()}</p>
                                </div>
                                <div className="bg-white/[0.05] border-2 border-white/10 p-7 rounded-[2.5rem] shadow-xl">
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Estado Actual</p>
                                    {getEstadoBadge(seguimientoData?.estado_actual)}
                                </div>
                                <div className="lg:col-span-2 bg-white/[0.05] border-2 border-white/10 p-7 rounded-[2.5rem] shadow-xl">
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Responsable Asignado</p>
                                    <p className="text-2xl font-black text-blue-400 italic tracking-tight">{selectedSolicitud.supervisor_alias}</p>
                                </div>
                            </div>

                            <div className="bg-blue-600/10 border-2 border-blue-500/30 rounded-[2.5rem] p-10 italic text-blue-50 shadow-inner">
                                <p className="text-xl font-bold leading-relaxed">"{selectedSolicitud.descripcion_solicitud}"</p>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                                <div className="xl:col-span-8 space-y-10">
                                    <div className="bg-white/[0.03] border-2 border-white/10 rounded-[3rem] p-10 shadow-2xl">
                                        <div className="flex justify-between items-center mb-8">
                                            <h5 className="font-black text-white text-[11px] uppercase tracking-[0.3em] flex items-center gap-4"><History className="w-6 h-6 text-indigo-400" /> Bitácora Técnica de Campo</h5>
                                            <button onClick={() => setShowNuevoRegistro(true)} className="h-12 px-7 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center gap-3 shadow-2xl shadow-indigo-600/30 active:scale-95"><PlusCircle className="w-5 h-5" /> Agregar registro</button>
                                        </div>

                                        {showNuevoRegistro && (
                                            <div className="bg-white/[0.07] border-2 border-white/20 rounded-[2.5rem] p-8 mb-10 gap-6 flex flex-col animate-in slide-in-from-top-6 shadow-4xl">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-white/50 uppercase tracking-widest ml-1">Fecha del Movimiento</label>
                                                    <input type="date" value={nuevoRegistro.fecha} onChange={e => setNuevoRegistro(p => ({ ...p, fecha: e.target.value }))} className="bg-slate-950 border-2 border-white/10 rounded-2xl h-14 px-5 text-sm font-black text-white outline-none focus:border-indigo-500 transition-all" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-white/50 uppercase tracking-widest ml-1">Detalles Técnicos</label>
                                                    <textarea value={nuevoRegistro.texto} onChange={e => setNuevoRegistro(p => ({ ...p, texto: e.target.value }))} placeholder="Bitácora de campo..." className="w-full bg-slate-950 border-2 border-white/10 rounded-[2rem] p-6 text-sm min-h-[150px] outline-none focus:border-indigo-500 text-white font-medium italic" />
                                                </div>
                                                <div className="flex justify-end gap-5 pt-2"><button onClick={() => setShowNuevoRegistro(false)} className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] px-6 hover:text-white transition-colors">Descartar</button><button onClick={async () => {
                                                    const { error } = await supabase.from('registro_seguimiento_solicitud').insert({ numero_solicitud: selectedSolicitud.numero_solicitud, fecha_registro: nuevoRegistro.fecha, registro_seguimiento: nuevoRegistro.texto });
                                                    if (!error) { showNotification('Movimiento Registrado', 'success'); setShowNuevoRegistro(false); handleOpenModal(selectedSolicitud); }
                                                }} className="bg-emerald-500 hover:bg-emerald-400 text-black px-10 h-14 rounded-2xl text-[11px] font-black tracking-widest uppercase transition-all shadow-2xl shadow-emerald-500/20 active:scale-95">Sincronizar Bitácora</button></div>
                                            </div>
                                        )}

                                        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                                            {registros.length > 0 ? registros.map((reg, i) => (
                                                <div key={i} className="bg-white/[0.04] border-2 border-white/5 rounded-[2rem] p-8 hover:bg-white/[0.08] hover:border-white/10 transition-all shadow-xl">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <Clock className="w-4 h-4 text-indigo-400" />
                                                        <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">{new Date(reg.fecha_registro).toLocaleDateString()}</p>
                                                    </div>
                                                    <p className="text-white text-[15px] leading-relaxed italic font-medium">"{reg.registro_seguimiento}"</p>
                                                </div>
                                            )) : <div className="text-center py-20 bg-white/[0.02] rounded-[3rem] border-2 border-dashed border-white/10"><p className="text-white/20 font-black uppercase tracking-[0.4em] text-xs">Sin registros de bitácora</p></div>}
                                        </div>
                                    </div>

                                    <div className="bg-white/[0.03] border-2 border-white/10 rounded-[3.5rem] overflow-hidden shadow-2xl">
                                        <div className="p-10 border-b-2 border-white/10 bg-white/5 flex justify-between items-center">
                                            <h5 className="font-black text-white text-[11px] uppercase tracking-[0.3em] flex items-center gap-4"><Package className="w-6 h-6 text-amber-500" /> Stock de Materiales Aplicados</h5>
                                            <div className="px-5 h-10 flex items-center bg-amber-500/20 border-2 border-amber-500/40 rounded-full text-[11px] font-black text-amber-400 uppercase tracking-widest shadow-lg shadow-amber-500/10">{articulos.length} Items</div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="bg-white/[0.06]">
                                                    <tr className="text-[10px] text-white/50 uppercase tracking-[0.2em] font-black">
                                                        <th className="px-10 py-5 text-left">N° Salida</th>
                                                        <th className="px-10 py-5 text-left">Fecha</th>
                                                        <th className="px-10 py-5 text-left">Insumo Técnico</th>
                                                        <th className="px-10 py-5 text-right">Cantidad</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y-2 divide-white/10">
                                                    {articulos.map((art, i) => (
                                                        <tr key={i} className="hover:bg-white/[0.05] transition-colors group">
                                                            <td className="px-10 py-5 text-[11px] font-black text-white/30 group-hover:text-amber-500/60 transition-colors">#{art.id_salida}</td>
                                                            <td className="px-10 py-5">
                                                                <p className="text-xs font-black text-white/70 uppercase tracking-tighter Otros">{new Date(art.fecha_salida).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                                            </td>
                                                            <td className="px-10 py-5">
                                                                <p className="font-black text-white text-sm tracking-tight">{art.nombre_articulo}</p>
                                                                <p className="text-[10px] text-amber-500 font-mono tracking-widest mt-2">{art.codigo_articulo}</p>
                                                            </td>
                                                            <td className="px-10 py-5 text-right"><span className="bg-white/10 px-4 py-2 rounded-xl font-black text-blue-400 border border-white/5 shadow-inner">{art.cantidad}</span></td>
                                                        </tr>
                                                    ))}
                                                    {articulos.length === 0 && (
                                                        <tr><td colSpan={4} className="px-10 py-20 text-center text-white/10 text-[11px] font-black uppercase tracking-[0.4em]">No se registran materiales</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                <div className="xl:col-span-4 space-y-8">
                                    <div className="bg-white/[0.04] border-2 border-white/20 rounded-[3.5rem] p-10 space-y-8 shadow-4xl group">

                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-[11px] text-white/60 font-black uppercase tracking-widest ml-2 flex items-center gap-2">
                                                    <PlayCircle className="w-4 h-4 text-blue-500" /> Estado de la Solicitud
                                                </label>
                                                <div className="relative">
                                                    <select key={seguimientoData?.estado_actual} defaultValue={seguimientoData?.estado_actual || 'ACTIVA'} onChange={e => setSeguimientoData(p => p ? { ...p, estado_actual: e.target.value } : null)} className="w-full bg-slate-950 border-2 border-white/10 rounded-[1.5rem] h-16 px-6 text-sm font-black text-white outline-none focus:border-blue-500 focus:bg-slate-900 transition-all appearance-none cursor-pointer shadow-lg">
                                                        <option value="ACTIVA">ACTIVA</option>
                                                        <option value="EJECUTADA">FINALIZADA</option>
                                                        <option value="CANCELADA">CANCELADA</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[11px] text-white/80 font-black uppercase tracking-widest ml-2 flex items-center gap-2">
                                                    <Calendar className="w-5 h-5 text-indigo-400" /> FECHA DE INICIO DE LABORES
                                                </label>
                                                <input type="date" value={seguimientoData?.fecha_inicio || ''} onChange={e => setSeguimientoData(p => p ? { ...p, fecha_inicio: e.target.value } : null)} className="w-full bg-slate-800 border-2 border-white/30 rounded-[1.5rem] h-16 px-6 text-sm font-black text-white focus:border-indigo-500 focus:bg-slate-700 outline-none transition-all shadow-lg custom-date-input" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[11px] text-white/80 font-black uppercase tracking-widest ml-2 flex items-center gap-2">
                                                    <Calendar className="w-5 h-5 text-emerald-400" /> FECHA DE CIERRE DE LABORES
                                                </label>
                                                <input type="date" value={seguimientoData?.fecha_finalizacion || ''} onChange={e => setSeguimientoData(p => p ? { ...p, fecha_finalizacion: e.target.value } : null)} className="w-full bg-slate-800 border-2 border-white/30 rounded-[1.5rem] h-16 px-6 text-sm font-black text-white focus:border-emerald-500 focus:bg-slate-700 outline-none transition-all shadow-lg custom-date-input" />
                                            </div>
                                            <div className="pt-6">
                                                <button onClick={async () => {
                                                    if (seguimientoData?.fecha_inicio && seguimientoData?.fecha_finalizacion && new Date(seguimientoData.fecha_finalizacion) < new Date(seguimientoData.fecha_inicio)) {
                                                        showNotification('Error cronología de fechas', 'error'); return;
                                                    }
                                                    const { error } = await supabase.from('seguimiento_solicitud').upsert({ numero_solicitud: selectedSolicitud.numero_solicitud, estado_actual: seguimientoData?.estado_actual, fecha_inicio: seguimientoData?.fecha_inicio || null, fecha_finalizacion: seguimientoData?.fecha_finalizacion || null });
                                                    if (error) {
                                                        console.error("Error al sincronizar:", error);
                                                        showNotification(`Error: ${error.message}`, 'error');
                                                    } else {
                                                        showNotification('Sincronización Exitosa', 'success');
                                                        setIsModalOpen(false);
                                                        fetchSolicitudes();
                                                        loadStats();
                                                    }
                                                }} className="w-full h-20 bg-blue-600 hover:bg-blue-500 text-white font-black text-[13px] uppercase tracking-[0.2em] rounded-[1.5rem] shadow-4xl transition-all shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-4">
                                                    <CheckCircle className="w-6 h-6" /> Guardar Cambios
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-indigo-900/20 to-blue-900/20 border-2 border-white/10 rounded-[3rem] p-10 text-center shadow-3xl">
                                        <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-12 border border-indigo-500/30">
                                            <History className="w-7 h-7 text-indigo-400" />
                                        </div>
                                        <p className="text-[11px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-3">Protocolo de Cierre</p>
                                        <p className="text-sm text-white/50 leading-relaxed italic font-medium">Verifique que todos los materiales estén debidamente asociados y la bitácora técnica refleje fielmente las labores ejecutadas antes de finalizar la solicitud.</p>
                                    </div>
                                </div>
                            </div>
                        </div>


                    </div>
                </div>
            )}

            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; border: 2px solid rgba(0,0,0,0.2); } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); } .custom-scrollbar-h::-webkit-scrollbar { height: 8px; } .custom-scrollbar-h::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; } .custom-scrollbar-h::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; border: 2px solid rgba(0,0,0,0.2); } .custom-scrollbar-h::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); } .custom-date-input::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; opacity: 0.8; transition: opacity 0.2s; } .custom-date-input::-webkit-calendar-picker-indicator:hover { opacity: 1; }`}</style>
        </div>
    );
}
