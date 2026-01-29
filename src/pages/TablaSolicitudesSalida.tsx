import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    ArrowLeft,
    FileText,
    Printer,
    ExternalLink,
    Loader2,
    FileSpreadsheet,
    File,
    ChevronLeft,
    ChevronRight,
    X,
    Package,
    Calendar,
    Info,
    AlertOctagon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader } from '../components/ui/PageHeader';

interface Solicitud {
    numero_solicitud: string;
    fecha_solicitud: string;
    descripcion_solicitud: string;
    instalacion_municipal?: string;
    instalaciones_municipales_16?: {
        instalacion_municipal: string;
    };
}

interface DetalleSalida {
    id_salida: number;
    fecha_salida: string;
    dato_salida_13: {
        articulo: string;
        cantidad: number;
        articulo_01: {
            nombre_articulo: string;
        } | {
            nombre_articulo: string;
        }[];
    }[];
}

export default function TablaSolicitudesSalida() {
    const navigate = useNavigate();
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchNum, setSearchNum] = useState('');
    const [searchDesc, setSearchDesc] = useState('');

    // Modal Details State
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedSolicitudNum, setSelectedSolicitudNum] = useState<string | null>(null);
    const [detailsData, setDetailsData] = useState<DetalleSalida[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ITEMS_PER_PAGE = 25;

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchSolicitudes(1);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchNum, searchDesc]);

    useEffect(() => {
        fetchSolicitudes(currentPage);
    }, [currentPage]);

    const fetchSolicitudes = async (page: number) => {
        setLoading(true);
        try {
            let query = supabase
                .from('solicitud_17')
                .select('numero_solicitud, fecha_solicitud, descripcion_solicitud, instalaciones_municipales_16(instalacion_municipal), seguimiento_solicitud!inner(estado_actual)', { count: 'exact' })
                .eq('tipo_solicitud', 'STI')
                .eq('seguimiento_solicitud.estado_actual', 'ACTIVA');

            if (searchNum) {
                query = query.eq('numero_solicitud', searchNum);
            }
            if (searchDesc) {
                query = query.ilike('descripcion_solicitud', `%${searchDesc}%`);
            }

            const from = (page - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            const { data, error, count } = await query
                .order('numero_solicitud', { ascending: false })
                .range(from, to);

            if (error) throw error;

            const mappedData = (data || []).map((item: any) => ({
                ...item,
                instalacion_municipal: item.instalaciones_municipales_16?.instalacion_municipal || 'N/A'
            }));

            setSolicitudes(mappedData);
            setTotalRecords(count || 0);
            setCurrentPage(page);
        } catch (error) {
            console.error('Error fetching solicitudes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        let query = supabase
            .from('solicitud_17')
            .select('numero_solicitud, fecha_solicitud, descripcion_solicitud, instalaciones_municipales_16(instalacion_municipal), seguimiento_solicitud!inner(estado_actual)')
            .eq('tipo_solicitud', 'STI')
            .eq('seguimiento_solicitud.estado_actual', 'ACTIVA');

        if (searchNum) query = query.eq('numero_solicitud', searchNum);
        if (searchDesc) query = query.ilike('descripcion_solicitud', `%${searchDesc}%`);

        const { data } = await query.order('numero_solicitud', { ascending: false });

        if (!data) return;

        const ws = XLSX.utils.json_to_sheet(data.map((s: any) => ({
            'Número': s.numero_solicitud,
            'Descripción': s.descripcion_solicitud,
            'Instalación': s.instalaciones_municipales_16?.instalacion_municipal || 'N/A',
            'Fecha': new Date(s.fecha_solicitud).toLocaleDateString()
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Solicitudes");
        XLSX.writeFile(wb, "solicitudes_cliente_interno.xlsx");
    };

    const handleExportPDF = async () => {
        let query = supabase
            .from('solicitud_17')
            .select('numero_solicitud, fecha_solicitud, descripcion_solicitud, instalaciones_municipales_16(instalacion_municipal), seguimiento_solicitud!inner(estado_actual)')
            .eq('tipo_solicitud', 'STI')
            .eq('seguimiento_solicitud.estado_actual', 'ACTIVA');

        if (searchNum) query = query.eq('numero_solicitud', searchNum);
        if (searchDesc) query = query.ilike('descripcion_solicitud', `%${searchDesc}%`);

        const { data } = await query.order('numero_solicitud', { ascending: false });

        if (!data) return;

        const doc = new jsPDF();
        autoTable(doc, {
            head: [['Número', 'Descripción', 'Instalación', 'Fecha']],
            body: data.map((s: any) => [
                s.numero_solicitud,
                s.descripcion_solicitud,
                s.instalaciones_municipales_16?.instalacion_municipal || 'N/A',
                new Date(s.fecha_solicitud).toLocaleDateString()
            ]),
        });
        doc.save("solicitudes_cliente_interno.pdf");
    };

    const handlePrintRow = (numeroSolicitud: string) => {
        const fileName = `OT-${numeroSolicitud}-CI.pdf`;
        const { data } = supabase.storage
            .from('ordenes-trabajo')
            .getPublicUrl(fileName);

        if (data && data.publicUrl) {
            window.open(data.publicUrl, '_blank');
        } else {
            alert('No se pudo obtener el enlace del archivo.');
        }
    };

    const handleDoubleClick = async (numeroSolicitud: string) => {
        setSelectedSolicitudNum(numeroSolicitud);
        setShowDetailsModal(true);
        setLoadingDetails(true);
        setDetailsData([]);

        try {
            const { data, error } = await supabase
                .from('salida_articulo_08')
                .select(`
                    id_salida,
                    fecha_salida,
                    dato_salida_13 (
                        articulo,
                        cantidad,
                        articulo_01 (
                            nombre_articulo
                        )
                    )
                `)
                .eq('numero_solicitud', numeroSolicitud)
                .order('fecha_salida', { ascending: false });

            if (error) throw error;
            setDetailsData(data || []);
        } catch (error) {
            console.error('Error fetching details:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE);

    return (
        <div className="min-h-screen bg-[#0f111a] text-slate-100 p-4 md:p-8 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-purple-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto space-y-6 relative z-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-white/5">
                    <div className="space-y-1">
                        <PageHeader title="Salidas de Cliente Interno" icon={FileText} themeColor="purple" />
                        <p className="text-slate-500 text-sm font-medium tracking-wide">
                            Gestión y entrega de materiales para órdenes de trabajo activas ST-I.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleExportPDF} className="glass-button px-5 py-2.5 flex items-center gap-2 text-rose-400 hover:text-white rounded-xl">
                            <File className="w-4 h-4" />
                            <span className="font-bold text-xs">PDF LISTADO</span>
                        </button>
                        <button onClick={handleExportExcel} className="glass-button px-5 py-2.5 flex items-center gap-2 text-emerald-400 hover:text-white rounded-xl">
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="font-bold text-xs">EXCEL COMPLETO</span>
                        </button>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="glass-card p-5 flex flex-col lg:flex-row gap-4 items-center justify-between">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full lg:w-[75%]">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-purple-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar por número de solicitud..."
                                value={searchNum}
                                onChange={e => setSearchNum(e.target.value)}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-200 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-700 font-medium"
                            />
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-purple-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar por descripción..."
                                value={searchDesc}
                                onChange={e => setSearchDesc(e.target.value)}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-200 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-700 font-medium"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <button onClick={() => navigate('/')} className="glass-button w-full lg:w-auto px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 text-slate-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4" /> Regresar
                        </button>
                    </div>
                </div>

                {/* Table Section */}
                <div className="glass-card overflow-hidden flex flex-col min-h-[600px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 text-slate-500 text-[10px] font-black tracking-widest uppercase italic border-b border-white/5">
                                    <th className="p-6 text-center w-[12%]">NÚMERO</th>
                                    <th className="p-6 w-[38%]">DESCRIPCIÓN DE LA SOLICITUD</th>
                                    <th className="p-6 w-[20%]">INSTALACIÓN</th>
                                    <th className="p-6 text-center w-[15%]">FECHA</th>
                                    <th className="p-6 text-center w-[15%]">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody className={`text-sm divide-y divide-white/[0.03] transition-opacity duration-500 ${loading ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                {solicitudes.length === 0 && !loading ? (
                                    <tr>
                                        <td colSpan={5} className="py-32 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <AlertOctagon className="w-12 h-12 text-slate-800" />
                                                <p className="text-xs font-black uppercase text-slate-700 tracking-widest">No se encontraron solicitudes activas</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    solicitudes.map((sol) => (
                                        <tr key={sol.numero_solicitud} className="hover:bg-white/[0.02] transition-colors group h-24">
                                            <td className="p-6 text-center">
                                                <span
                                                    className="inline-block px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 text-sm font-black italic cursor-help ring-1 ring-purple-500/20 shadow-2xl shadow-purple-500/5 hover:scale-105 transition-all"
                                                    onDoubleClick={() => handleDoubleClick(sol.numero_solicitud)}
                                                    title="Doble clic para ver materiales"
                                                >
                                                    {sol.numero_solicitud}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <p className="text-[13px] font-black text-white uppercase italic tracking-tight leading-relaxed line-clamp-2 max-w-2xl group-hover:text-purple-400 transition-colors" title={sol.descripcion_solicitud}>
                                                    {sol.descripcion_solicitud}
                                                </p>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-white/5 rounded-lg">
                                                        <Package className="w-3.5 h-3.5 text-slate-600" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{sol.instalacion_municipal}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 text-center">
                                                <div className="flex flex-col items-center">
                                                    <div className="p-1.5 bg-white/5 rounded-lg mb-1">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                                                    </div>
                                                    <span className="text-[11px] font-mono font-black text-slate-400">{new Date(sol.fecha_solicitud).toLocaleDateString()}</span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => navigate(`/cliente-interno/realizar-salidas/formulario?numero=${sol.numero_solicitud}`)}
                                                        className="glass-button p-2.5 rounded-xl text-emerald-400 hover:text-white hover:bg-emerald-500/20 group/btn transition-all"
                                                        title="Realizar Salida"
                                                    >
                                                        <ExternalLink className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrintRow(sol.numero_solicitud)}
                                                        className="glass-button p-2.5 rounded-xl text-rose-400 hover:text-white hover:bg-rose-500/20 group/btn transition-all"
                                                        title="Imprimir Orden"
                                                    >
                                                        <Printer className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="mt-auto p-6 border-t border-white/5 bg-black/20 flex items-center justify-between">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
                            Mostrando página <span className="text-purple-400 mx-1 text-sm font-black">{currentPage}</span> de <span className="text-white mx-1">{totalPages || 1}</span>
                            <span className="ml-4 opacity-40">({totalRecords} registros totales)</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={currentPage <= 1 || loading}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="glass-button p-3 rounded-xl disabled:opacity-20 transition-all hover:bg-white/10"
                            >
                                <ChevronLeft className="w-5 h-5 text-slate-400" />
                            </button>
                            <button
                                disabled={currentPage >= totalPages || loading}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="glass-button p-3 rounded-xl disabled:opacity-20 transition-all hover:bg-white/10"
                            >
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Details Modal */}
            {showDetailsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#020617]/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-4xl glass-card bg-slate-900 shadow-[0_32px_128px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh] border-white/10">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-500/10 rounded-2xl ring-1 ring-purple-500/20">
                                    <Package className="w-7 h-7 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Materiales Entregados</h3>
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">Órden de Trabajo #{selectedSolicitudNum}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="p-3 hover:bg-white/5 rounded-2xl transition-all text-slate-500 hover:text-white border border-transparent hover:border-white/10"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-slate-950/20">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4">
                                    <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                    <p className="font-black text-[10px] uppercase tracking-[0.3em]">Recuperando historial...</p>
                                </div>
                            ) : detailsData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-32 text-slate-800 space-y-4">
                                    <Info className="w-16 h-16 opacity-10" />
                                    <p className="text-sm font-black uppercase tracking-widest">Sin entregas registradas</p>
                                </div>
                            ) : (
                                detailsData.map((salida) => (
                                    <div key={salida.id_salida} className="bg-white/[0.03] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                                        <div className="px-8 py-5 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-purple-400 font-black text-sm italic">SALIDA #{salida.id_salida}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                                                <Calendar className="w-4 h-4 text-slate-700" />
                                                {new Date(salida.fecha_salida).toLocaleDateString()} <span className="text-slate-700 mx-1">•</span> {new Date(salida.fecha_salida).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em]">
                                                        <th className="px-6 py-4">CÓDIGO</th>
                                                        <th className="px-6 py-4">ARTÍCULO / MATERIAL</th>
                                                        <th className="px-6 py-4 text-right">CANTIDAD</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/[0.02]">
                                                    {salida.dato_salida_13.map((item, idx) => {
                                                        const nombreArticulo = Array.isArray(item.articulo_01)
                                                            ? item.articulo_01[0]?.nombre_articulo
                                                            : item.articulo_01?.nombre_articulo;

                                                        return (
                                                            <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                                                                <td className="px-6 py-4 font-mono text-[11px] font-black text-slate-500">#{item.articulo}</td>
                                                                <td className="px-6 py-4 text-[12px] font-black text-slate-200 uppercase italic tracking-tight">{nombreArticulo || 'Desconocido'}</td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg font-black text-xs ring-1 ring-emerald-500/20">{item.cantidad}</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex justify-end">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="glass-button px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
                            >
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
