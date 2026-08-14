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
import { cn, formatDateOnly } from '../lib/utils';

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
            <tr key={i} className="animate-pulse border-b border-[#333333]">
                <td className="px-8 py-6"><div className="h-4 bg-white/5 rounded-[8px] w-16"></div></td>
                <td className="px-8 py-6"><div className="h-4 bg-white/5 rounded-[8px] w-24"></div></td>
                <td className="px-8 py-6"><div className="h-4 bg-white/5 rounded-[8px] w-full"></div></td>
                <td className="px-8 py-6"><div className="h-4 bg-white/5 rounded-[8px] w-20"></div></td>
                <td className="px-8 py-6"><div className="h-6 bg-white/5 rounded-[8px] w-24"></div></td>
                <td className="px-8 py-6 text-right"><div className="h-8 bg-white/5 rounded-[8px] w-8 ml-auto"></div></td>
            </tr>
        ))}
    </>
);

function getEstadoBadge(estado?: string) {
    if (!estado) return <span className="text-[#71717a] font-semibold text-[10px] uppercase tracking-widest px-3 py-1.5 border border-[#3f3f46] rounded-md bg-[#18181b]">Sin registro</span>;

    const colors = {
        'ACTIVA': 'bg-[#18181b] border-[#e4e4e7] text-white',
        'EJECUTADA': 'bg-[#e4e4e7] border-white text-black',
        'CANCELADA': 'bg-[#111112] border-[#52525b] text-[#a1a1aa] border-dashed'
    }[estado] || 'bg-[#18181b] text-[#a1a1aa] border-[#3f3f46]';

    return <span className={cn("px-3 py-1.5 rounded-md font-semibold text-[10px] uppercase tracking-wider border", colors)}>{estado}</span>;
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
    const [nuevoRegistro, setNuevoRegistro] = useState({ fecha: new Date().toLocaleDateString('en-CA'), texto: '' });

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

    const loadMetadata = useCallback(async () => {
        try {
            const { data } = await supabase.from('colaboradores_06')
                .select('identificacion, alias')
                .not('alias', 'is', null)
                .order('alias');
            if (data) setSupervisores(data.map(d => ({ id: d.identificacion, alias: d.alias })));
        } catch (e) { console.error('Error metadata:', e); }
    }, []);

    const fetchAll = useCallback(async (table: string, select: string, filterField?: string, filterValue?: string) => {
        const allData: any[] = [];
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
    }, []);

    const loadStats = useCallback(async () => {
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
    }, [fetchAll]);

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
            const colabsMap = new Map();
            if (supIds.length > 0) {
                const { data: colabsData } = await supabase.from('colaboradores_06').select('identificacion, alias').in('identificacion', supIds);
                colabsData?.forEach(c => colabsMap.set(c.identificacion, c.alias));
            }

            setSolicitudes(data.map((s: any) => {
                const segObj = Array.isArray(s.seguimiento_solicitud) ? s.seguimiento_solicitud[0] : s.seguimiento_solicitud;
                return {
                    ...s,
                    numero_solicitud: Number(s.numero_solicitud),
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
    }, [loadMetadata, loadStats]);

    useEffect(() => { fetchSolicitudes(); }, [fetchSolicitudes, realtimeChange]);

    const clearFilters = () => { setSearchTerm(''); setFilterEstado(''); setPage(1); };

    const handleExportExcel = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('solicitud_17')
                .select('numero_solicitud, fecha_solicitud, descripcion_solicitud, supervisor_asignado, seguimiento_solicitud!left(estado_actual, fecha_inicio, fecha_finalizacion)')
                .eq('tipo_solicitud', 'STI');

            if (filterEstado) {
                if (filterEstado === 'ACTIVA') {
                    query = query.or(`estado_actual.eq.ACTIVA,estado_actual.is.null`, { foreignTable: 'seguimiento_solicitud' });
                } else {
                    query = query.not('seguimiento_solicitud', 'is', null);
                    query = query.eq('seguimiento_solicitud.estado_actual', filterEstado);
                }
            }

            if (searchTerm) {
                const isNumeric = /^\d+$/.test(searchTerm);
                if (isNumeric) query = query.or(`numero_solicitud.eq.${searchTerm},descripcion_solicitud.ilike.%${searchTerm}%`);
                else query = query.ilike('descripcion_solicitud', `%${searchTerm}%`);
            }

            const { data: allData, error } = await query.order('numero_solicitud', { ascending: false }).limit(3000);
            if (error) throw error;
            if (!allData || allData.length === 0) {
                showNotification('No hay datos para exportar', 'error');
                return;
            }

            const supIds = allData.map(s => s.supervisor_asignado).filter(Boolean) as string[];
            const colabsMap = new Map();
            if (supIds.length > 0) {
                const { data: colabsData } = await supabase.from('colaboradores_06').select('identificacion, alias').in('identificacion', Array.from(new Set(supIds)));
                colabsData?.forEach(c => colabsMap.set(c.identificacion, c.alias));
            }

            const formattedData = allData.map((s: any) => {
                const segObj = Array.isArray(s.seguimiento_solicitud) ? s.seguimiento_solicitud[0] : s.seguimiento_solicitud;
                return {
                    'N° SOLICITUD': s.numero_solicitud,
                    'FECHA REGISTRO': formatDateOnly(s.fecha_solicitud),
                    'DESCRIPCIÓN STI': s.descripcion_solicitud,
                    'SUPERVISOR RESPONSABLE': s.supervisor_asignado ? (colabsMap.get(s.supervisor_asignado) || s.supervisor_asignado) : 'NO ASIGNADO',
                    'ESTADO STI': segObj?.estado_actual || 'ACTIVA',
                    'INICIO LABORES': segObj?.fecha_inicio ? formatDateOnly(segObj.fecha_inicio) : 'SIN FECHA',
                    'CIERRE LABORES': segObj?.fecha_finalizacion ? formatDateOnly(segObj.fecha_finalizacion) : 'SIN FECHA'
                };
            });

            const ws = XLSX.utils.json_to_sheet(formattedData);
            const wscols = [
                { wch: 15 }, { wch: 18 }, { wch: 80 }, { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 18 }
            ];
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "STI_SEGUIMIENTO");
            XLSX.writeFile(wb, `Seguimiento_STI_${new Date().toLocaleDateString('en-CA')}.xlsx`);
            showNotification('Excel generado exitosamente', 'success');
        } catch (error) {
            console.error('Export error:', error);
            showNotification('Error al exportar reporte', 'error');
        }
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
        <div className="min-h-screen bg-black text-[#f4f4f5] pb-20 selection:bg-white/20">
            <div className="max-w-[1600px] mx-auto px-4 md:px-8 pt-6 space-y-6 relative z-10">
                <header className="flex flex-col justify-between gap-4 border-b border-[#27272a] pb-4 md:flex-row md:items-center">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-[#71717a] bg-[#111112] p-3 text-[#e4e4e7]">
                            <Wrench className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white md:text-[30px]">Seguimiento Cliente Interno</h1>
                            <p className="text-sm text-[#a1a1aa]">Consulta y control operativo de solicitudes internas</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => navigate('/cliente-interno')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#71717a] bg-[#111112] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#18181b]">
                            <ChevronLeft className="h-5 w-5" /> Regresar
                        </button>
                        <button onClick={handleExportExcel} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#e4e4e7] bg-[#e4e4e7] px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-white disabled:opacity-50">
                            <Download className="h-5 w-5" /> Exportar
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                        { label: 'Total', value: stats.total, icon: LayoutGrid, color: 'text-[#0071E3]', bg: 'bg-[#0071E3]/10' },
                        { label: 'Activas', value: stats.activas, icon: PlayCircle, color: 'text-[#0071E3]', bg: 'bg-[#0071E3]/10' },
                        { label: 'Terminadas', value: stats.ejecutadas, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                        { label: 'Canceladas', value: stats.canceladas, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-400/10' }
                    ].map((m, i) => (
                        <div key={i} className="rounded-xl border border-[#3f3f46] bg-[#0d0d0e] p-5 flex items-center gap-4 group hover:border-[#71717a] transition-colors">
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center border border-[#52525b] bg-[#151517] text-[#e4e4e7]">
                                <m.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-semibold tabular-nums text-white leading-none">{m.value}</p>
                                <p className="text-xs font-medium text-[#a1a1aa] mt-1">{m.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <section className="rounded-xl border border-[#3f3f46] bg-[#0d0d0e] p-5 md:p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-[#d4d4d8]" />
                        <h2 className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-[0.18em]">Criterios de búsqueda</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                        <div className="lg:col-span-8 space-y-3">
                            <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-3">Búsqueda Unificada</label>
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a] group-focus-within:text-white transition-colors" />
                                <input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} className="w-full bg-black border border-[#3f3f46] rounded-lg h-14 pl-14 pr-6 text-sm text-white font-medium placeholder:text-[#71717a] focus:border-[#a1a1aa] transition-colors outline-none" placeholder="N° Solicitud o descripción técnica..." />
                            </div>
                        </div>
                        <div className="lg:col-span-3 space-y-3">
                            <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-3">Filtrar por Estado</label>
                            <select value={filterEstado} onChange={e => { setFilterEstado(e.target.value); setPage(1); }} className="w-full bg-black border border-[#3f3f46] rounded-lg h-14 px-5 text-sm text-white font-semibold appearance-none cursor-pointer focus:border-[#a1a1aa] outline-none transition-colors">
                                <option value="">Todos los Estados</option>
                                <option value="ACTIVA">ACTIVAS</option>
                                <option value="EJECUTADA">EJECUTADAS</option>
                                <option value="CANCELADA">CANCELADAS</option>
                            </select>
                        </div>
                        <div className="lg:col-span-1 flex gap-4 h-14">
                            <button onClick={clearFilters} className="w-full bg-[#111112] border border-[#3f3f46] rounded-lg flex items-center justify-center hover:border-[#71717a] hover:bg-[#18181b] transition-colors text-[#a1a1aa] hover:text-white"><Eraser className="w-5 h-5" /></button>
                        </div>
                    </div>
                </section>

                <section className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl overflow-hidden">
                    <div className="">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#151517] border-b border-[#3f3f46] text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.16em]">
                                    <th className="px-5 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => { setSortCol('numero_solicitud'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>N° Solicitud</th>
                                    <th className="px-5 py-4">Fecha registro</th>
                                    <th className="px-5 py-4">Descripción STI</th>
                                    <th className="px-5 py-4 text-center">Supervisor</th>
                                    <th className="px-5 py-4 text-center">Estado STI</th>
                                    <th className="px-5 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333333]">
                                {loading ? <TableSkeleton /> : solicitudes.map(sol => (
                                    <tr key={sol.numero_solicitud} className="hover:bg-[#151517] transition-colors group">
                                        <td className="px-5 py-4 font-semibold text-white text-sm">#{sol.numero_solicitud}</td>
                                        <td className="px-5 py-4 text-xs font-medium text-[#a1a1aa]">{formatDateOnly(sol.fecha_solicitud)}</td>
                                        <td className="px-5 py-4 text-sm font-medium text-[#f4f4f5] relative cursor-default" onMouseEnter={e => setHoveredDescription({ id: sol.numero_solicitud, text: sol.descripcion_solicitud, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHoveredDescription(null)}>
                                            <div className="truncate max-w-[300px]">
                                                {sol.descripcion_solicitud}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className="px-3 py-1.5 bg-[#18181b] rounded-md border border-[#3f3f46] text-[9px] font-semibold uppercase text-[#d4d4d8] whitespace-nowrap block w-fit mx-auto">
                                                {sol.supervisor_alias}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            {getEstadoBadge(sol.estado_actual)}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button onClick={() => handleOpenModal(sol)} className="ml-auto w-10 h-10 bg-[#111112] border border-[#3f3f46] rounded-lg flex items-center justify-center hover:border-[#a1a1aa] hover:bg-[#18181b] transition-colors text-[#a1a1aa] hover:text-white"><Eye className="w-5 h-5" /></button>
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
                <div className={cn("fixed bottom-10 right-10 z-[9999] px-8 py-5 rounded-[8px] border border-[#333333] bg-[#121212] backdrop-blur-2xl flex items-center gap-5 animate-in slide-in-from-right-10 shadow-3xl",
                    notification.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                )}>
                    {notification.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{notification.message}</span>
                </div>
            )}

            {/* Tooltip con más contraste */}
            {hoveredDescription && (
                <div
                    className="fixed z-[10000] pointer-events-none p-5 bg-black/95 border border-[#333333] rounded-[8px] shadow-4xl max-w-sm backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
                    style={{ left: hoveredDescription.x + 20, top: hoveredDescription.y + 10 }}
                >
                    <p className="text-[11px] text-[#F5F5F7] leading-relaxed italic font-bold">"{hoveredDescription.text}"</p>
                </div>
            )}

            {/* Status Quick Picker */}
            {editingStatusId && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-[20px]" onClick={() => setEditingStatusId(null)}></div>
                    <div className="relative bg-[#121212] border border-[#333333] rounded-[8px] p-10 w-full max-w-sm space-y-6 animate-in zoom-in-95 shadow-4xl">
                        <p className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.3em] text-center mb-4">Actualizar Estado STI</p>
                        {['ACTIVA', 'EJECUTADA', 'CANCELADA'].map(est => (
                            <button key={est} onClick={async () => {
                                const { error } = await supabase.from('seguimiento_solicitud').upsert({ numero_solicitud: editingStatusId, estado_actual: est });
                                if (!error) { showNotification('Estado Sincronizado', 'success'); setEditingStatusId(null); setRealtimeChange(c => c + 1); }
                            }} className="w-full h-16 rounded-[8px] text-[10px] font-black uppercase tracking-widest border border-[#333333] bg-[#1D1D1F] hover:border-[#0071E3]/50 hover:bg-white/5 transition-all flex items-center justify-center gap-4 text-[#F5F5F7]">
                                {est === 'EJECUTADA' ? 'FINALIZADA' : est}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tracking Detail Modal */}
            {isModalOpen && selectedSolicitud && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6">
                    <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative w-full max-w-7xl bg-[#0d0d0e] border border-[#52525b] rounded-xl shadow-4xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95">
                        <div className="bg-[#151517] border-b border-[#3f3f46] px-6 py-5 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Solicitud #{selectedSolicitud.numero_solicitud}</h2>
                                <p className="text-xs font-medium text-[#a1a1aa] mt-1">Detalle y seguimiento técnico</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-11 h-11 bg-[#111112] border border-[#3f3f46] rounded-lg flex items-center justify-center text-[#a1a1aa] hover:text-white hover:border-[#71717a] transition-colors"><X size={22} /></button>
                        </div>

                        <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar space-y-6 bg-[#0d0d0e] flex-1">
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                <div className="bg-[#151517] border border-[#3f3f46] p-5 rounded-lg">
                                    <p className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-widest mb-2">Fecha de reporte</p>
                                    <p className="text-xl font-semibold text-white">{formatDateOnly(selectedSolicitud.fecha_solicitud)}</p>
                                </div>
                                <div className="bg-[#151517] border border-[#3f3f46] p-5 rounded-lg flex flex-col justify-center">
                                    <p className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-widest mb-3">Estado actual</p>
                                    <div>{getEstadoBadge(seguimientoData?.estado_actual)}</div>
                                </div>
                                <div className="lg:col-span-2 bg-[#151517] border border-[#3f3f46] p-5 rounded-lg">
                                    <p className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-widest mb-2">Supervisor responsable</p>
                                    <p className="text-xl font-semibold text-white">{selectedSolicitud.supervisor_alias}</p>
                                </div>
                            </div>

                            <div className="bg-[#111112] border border-[#3f3f46] rounded-lg p-5 md:p-6 text-[#e4e4e7]">
                                <p className="text-sm md:text-base font-medium leading-relaxed">{selectedSolicitud.descripcion_solicitud}</p>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                                <div className="xl:col-span-8 space-y-4">
                                    <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-5 md:p-6">
                                        <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
                                            <h5 className="font-semibold text-white text-xs uppercase tracking-[0.18em] flex items-center gap-3"><History className="w-5 h-5 text-[#d4d4d8]" /> Bitácora técnica STI</h5>
                                            <button onClick={() => setShowNuevoRegistro(true)} className="h-11 px-5 bg-[#e4e4e7] text-black rounded-lg text-xs font-semibold hover:bg-white transition-colors flex items-center gap-2"><PlusCircle className="w-4 h-4" /> Agregar registro</button>
                                        </div>

                                        {showNuevoRegistro && (
                                            <div className="bg-[#151517] border border-[#3f3f46] rounded-lg p-5 mb-6 gap-4 flex flex-col animate-in slide-in-from-top-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-1">Fecha</label>
                                                    <input type="date" value={nuevoRegistro.fecha} onChange={e => setNuevoRegistro(p => ({ ...p, fecha: e.target.value }))} className="bg-black border border-[#3f3f46] rounded-lg h-12 px-4 text-sm font-semibold text-white outline-none focus:border-[#a1a1aa] transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-1">Observaciones Técnicas</label>
                                                    <textarea value={nuevoRegistro.texto} onChange={e => setNuevoRegistro(p => ({ ...p, texto: e.target.value }))} placeholder="Detalle las acciones realizadas en campo..." className="w-full bg-black border border-[#3f3f46] rounded-lg p-4 text-sm min-h-[130px] outline-none focus:border-[#a1a1aa] text-white font-medium resize-none" />
                                                </div>
                                                <div className="flex justify-end gap-5 pt-2">
                                                    <button onClick={() => setShowNuevoRegistro(false)} className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] px-6 hover:text-white transition-colors">Cancelar</button>
                                                    <button onClick={async () => {
                                                        const { error } = await supabase.from('registro_seguimiento_solicitud').insert({ numero_solicitud: selectedSolicitud.numero_solicitud, fecha_registro: nuevoRegistro.fecha, registro_seguimiento: nuevoRegistro.texto });
                                                        if (!error) { showNotification('Movimiento Registrado', 'success'); setShowNuevoRegistro(false); handleOpenModal(selectedSolicitud); }
                                                    }} className="bg-[#e4e4e7] hover:bg-white text-black px-6 h-12 rounded-lg text-xs font-semibold transition-colors">Guardar registro</button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                                            {registros.length > 0 ? registros.map((reg, i) => (
                                                <div key={i} className="bg-[#151517] border border-[#3f3f46] rounded-lg p-5 hover:border-[#71717a] transition-colors">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <Clock className="w-4 h-4 text-[#d4d4d8]" />
                                                        <p className="text-[10px] font-semibold text-[#d4d4d8] uppercase tracking-widest">{formatDateOnly(reg.fecha_registro)}</p>
                                                    </div>
                                                    <p className="text-[#f4f4f5] text-sm leading-relaxed font-medium">{reg.registro_seguimiento}</p>
                                                </div>
                                            )) : <div className="text-center py-20 border border-dashed border-[#333333] rounded-[8px]"><p className="text-[#333333] font-black uppercase tracking-[0.4em] text-[10px]">Sin entradas en bitácora</p></div>}
                                        </div>
                                    </div>

                                    <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl overflow-hidden">
                                        <div className="p-5 border-b border-[#3f3f46] bg-[#151517] flex justify-between items-center">
                                            <h5 className="font-semibold text-white text-xs uppercase tracking-[0.18em] flex items-center gap-3"><Package className="w-5 h-5 text-[#d4d4d8]" /> Insumos aplicados</h5>
                                            <div className="px-3 h-8 flex items-center bg-[#18181b] border border-[#3f3f46] rounded-md text-[10px] font-semibold text-[#d4d4d8] uppercase tracking-widest">{articulos.length} ítems</div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full table-fixed text-sm border-collapse">
                                                <thead className="bg-[#151517]">
                                                    <tr className="text-[9px] text-[#a1a1aa] uppercase tracking-[0.16em] font-semibold">
                                                        <th className="w-[18%] px-5 py-4 text-left">Ref. salida</th>
                                                        <th className="w-[18%] px-5 py-4 text-left">Fecha</th>
                                                        <th className="w-[52%] px-5 py-4 text-left">Descripción del artículo</th>
                                                        <th className="w-[12%] px-5 py-4 text-right">Cantidad</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#333333]">
                                                    {articulos.map((art, i) => (
                                                        <tr key={i} className="hover:bg-[#151517] transition-colors group">
                                                            <td className="px-5 py-4 text-[11px] font-mono font-semibold text-[#a1a1aa]">#{art.id_salida}</td>
                                                            <td className="px-5 py-4">
                                                                <p className="text-[11px] font-medium text-[#d4d4d8] tabular-nums">{formatDateOnly(art.fecha_salida)}</p>
                                                            </td>
                                                            <td className="px-5 py-4 text-[#f4f4f5]">
                                                                <p className="font-semibold text-[13px] leading-snug">{art.nombre_articulo}</p>
                                                                <p className="text-[10px] text-[#a1a1aa] font-mono mt-1">{art.codigo_articulo}</p>
                                                            </td>
                                                            <td className="px-5 py-4 text-right"><span className="inline-flex min-w-10 justify-center rounded-md border border-[#52525b] bg-[#18181b] px-3 py-1.5 font-semibold tabular-nums text-white">{art.cantidad}</span></td>
                                                        </tr>
                                                    ))}
                                                    {articulos.length === 0 && (
                                                        <tr><td colSpan={4} className="px-6 py-16 text-center text-[#71717a] text-[10px] font-semibold uppercase tracking-[0.2em]">No se registran materiales suministrados</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                <div className="xl:col-span-4 space-y-4">
                                    <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-5 md:p-6 space-y-6">
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] text-[#86868B] font-black uppercase tracking-widest ml-2 flex items-center gap-2">
                                                    <PlayCircle className="w-4 h-4 text-[#d4d4d8]" /> Estado STI
                                                </label>
                                                <div className="relative">
                                                    <select key={seguimientoData?.estado_actual} defaultValue={seguimientoData?.estado_actual || 'ACTIVA'} onChange={e => setSeguimientoData(p => p ? { ...p, estado_actual: e.target.value } : null)} className="w-full bg-[#151517] border border-[#3f3f46] rounded-lg h-14 px-4 text-sm font-semibold text-white outline-none focus:border-[#a1a1aa] transition-colors appearance-none cursor-pointer">
                                                        <option value="ACTIVA">ACTIVA</option>
                                                        <option value="EJECUTADA">FINALIZADA</option>
                                                        <option value="CANCELADA">CANCELADA</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] text-[#86868B] font-black uppercase tracking-widest ml-2 flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-[#d4d4d8]" /> Inicio de labores
                                                </label>
                                                <input type="date" value={seguimientoData?.fecha_inicio || ''} onChange={e => setSeguimientoData(p => p ? { ...p, fecha_inicio: e.target.value } : null)} className="w-full bg-[#151517] border border-[#3f3f46] rounded-lg h-14 px-4 text-sm font-semibold text-white focus:border-[#a1a1aa] outline-none transition-colors custom-date-input" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] text-[#86868B] font-black uppercase tracking-widest ml-2 flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-[#d4d4d8]" /> Cierre de labores
                                                </label>
                                                <input type="date" value={seguimientoData?.fecha_finalizacion || ''} onChange={e => setSeguimientoData(p => p ? { ...p, fecha_finalizacion: e.target.value } : null)} className="w-full bg-[#151517] border border-[#3f3f46] rounded-lg h-14 px-4 text-sm font-semibold text-white focus:border-[#a1a1aa] outline-none transition-colors custom-date-input" />
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
                                                }} className="w-full h-14 bg-[#e4e4e7] hover:bg-white text-black font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-3">
                                                    <CheckCircle className="w-5 h-5" /> Guardar cambios
                                                </button>
                                            </div>
                                        </div>
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
