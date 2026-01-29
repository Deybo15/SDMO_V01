import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import {
    Table,
    ArrowLeft,
    FileText,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Search,
    Loader2,
    X,
    Package,
    Calendar,
    Printer,
    Filter,
    Info,
    AlertOctagon,
    FileSpreadsheet,
    File
} from 'lucide-react';
import autoTable from 'jspdf-autotable';
import { PageHeader } from '../components/ui/PageHeader';

// Interface for the request data
interface Solicitud {
    numero_solicitud: number;
    descripcion_solicitud: string;
    fecha_solicitud: string;
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

export default function SolicitudesExternasTable() {
    const navigate = useNavigate();
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal Details State
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedSolicitudNum, setSelectedSolicitudNum] = useState<number | null>(null);
    const [detailsData, setDetailsData] = useState<DetalleSalida[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 25;

    // Filter state
    const [filtroNumero, setFiltroNumero] = useState('');
    const [filtroDescripcion, setFiltroDescripcion] = useState('');

    // Load data
    const cargarDatos = async (page: number) => {
        setLoading(true);
        try {
            let query = supabase
                .from('solicitud_17')
                .select('numero_solicitud, descripcion_solicitud, fecha_solicitud, seguimiento_solicitud!inner(estado_actual)', { count: 'exact' })
                .eq('tipo_solicitud', 'STE')
                .eq('seguimiento_solicitud.estado_actual', 'ACTIVA');

            if (filtroNumero && !isNaN(Number(filtroNumero))) {
                query = query.eq('numero_solicitud', Number(filtroNumero));
            }
            if (filtroDescripcion) {
                query = query.ilike('descripcion_solicitud', `%${filtroDescripcion}%`);
            }

            const from = (page - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;

            const { data, count, error } = await query
                .order('numero_solicitud', { ascending: false })
                .range(from, to);

            if (error) throw error;

            setSolicitudes(data || []);
            setTotalItems(count || 0);
            setCurrentPage(page);

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Effects
    useEffect(() => {
        cargarDatos(currentPage);
    }, [currentPage]);

    // Debounce filters
    useEffect(() => {
        const timer = setTimeout(() => {
            cargarDatos(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [filtroNumero, filtroDescripcion]);


    // Handlers
    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(prev => prev - 1);
    };

    const handleNextPage = () => {
        if ((currentPage * itemsPerPage) < totalItems) setCurrentPage(prev => prev + 1);
    };

    const getExportData = async () => {
        let query = supabase
            .from('solicitud_17')
            .select('numero_solicitud, descripcion_solicitud, fecha_solicitud, seguimiento_solicitud!inner(estado_actual)')
            .eq('tipo_solicitud', 'STE')
            .eq('seguimiento_solicitud.estado_actual', 'ACTIVA');

        if (filtroNumero && !isNaN(Number(filtroNumero))) {
            query = query.eq('numero_solicitud', Number(filtroNumero));
        }
        if (filtroDescripcion) {
            query = query.ilike('descripcion_solicitud', `%${filtroDescripcion}%`);
        }

        const { data } = await query.order('numero_solicitud', { ascending: false });
        return data || [];
    };

    const exportToExcel = async () => {
        const data = await getExportData();
        const ws = XLSX.utils.json_to_sheet(data.map(s => ({
            'Número de Solicitud': s.numero_solicitud,
            'Descripción': s.descripcion_solicitud,
            'Fecha': new Date(s.fecha_solicitud).toLocaleDateString('es-CR')
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes');
        XLSX.writeFile(wb, 'Solicitudes_Cliente_Externo.xlsx');
    };

    const exportToPDF = async () => {
        const data = await getExportData();
        const doc = new jsPDF();
        autoTable(doc, {
            head: [['Número', 'Descripción', 'Fecha']],
            body: data.map(s => [
                s.numero_solicitud,
                s.descripcion_solicitud,
                new Date(s.fecha_solicitud).toLocaleDateString('es-CR')
            ]),
        });
        doc.save('Solicitudes_Cliente_Externo.pdf');
    };

    const handleDoubleClick = async (numeroSolicitud: number) => {
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

    const handlePrintRow = (numeroSolicitud: number) => {
        const fileName = `OT-${numeroSolicitud}-CE.pdf`;
        const { data } = supabase.storage
            .from('ordenes-trabajo')
            .getPublicUrl(fileName);

        if (data && data.publicUrl) {
            window.open(data.publicUrl, '_blank');
        } else {
            alert('No se pudo obtener el enlace del archivo.');
        }
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

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
                        <PageHeader title="Salidas de Cliente Externo" icon={Table} themeColor="purple" />
                        <p className="text-slate-500 text-sm font-medium tracking-wide">
                            Lista maestra de solicitudes activas para clientes externos.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={exportToPDF} className="glass-button px-5 py-2.5 flex items-center gap-2 text-rose-400 hover:text-white rounded-xl">
                            <File className="w-4 h-4" />
                            <span className="font-bold text-xs uppercase tracking-widest">PDF</span>
                        </button>
                        <button onClick={exportToExcel} className="glass-button px-5 py-2.5 flex items-center gap-2 text-emerald-400 hover:text-white rounded-xl">
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="font-bold text-xs uppercase tracking-widest">Excel</span>
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
                                placeholder="Filtrar por número de solicitud..."
                                value={filtroNumero}
                                onChange={e => setFiltroNumero(e.target.value)}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-200 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-700 font-medium"
                            />
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-purple-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Filtrar por descripción..."
                                value={filtroDescripcion}
                                onChange={e => setFiltroDescripcion(e.target.value)}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-200 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-700 font-medium"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <button onClick={() => navigate('/cliente-externo')} className="glass-button w-full lg:w-auto px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 text-slate-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4 text-purple-500" /> Regresar
                        </button>
                    </div>
                </div>

                {/* Table Section */}
                <div className="glass-card overflow-hidden flex flex-col min-h-[600px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 text-slate-500 text-[10px] font-black tracking-widest uppercase italic border-b border-white/5">
                                    <th className="p-6 text-center w-[15%]">N° SOLICITUD</th>
                                    <th className="p-6 w-[45%]">DESCRIPCIÓN</th>
                                    <th className="p-6 text-center w-[20%]">FECHA</th>
                                    <th className="p-6 text-center w-[20%]">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody className={`text-sm divide-y divide-white/[0.03] transition-opacity duration-500 ${loading ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                {solicitudes.length === 0 && !loading ? (
                                    <tr>
                                        <td colSpan={4} className="py-32 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <AlertOctagon className="w-12 h-12 text-slate-800" />
                                                <p className="text-xs font-black uppercase text-slate-700 tracking-widest">No hay resultados coincidentes</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    solicitudes.map((sol) => (
                                        <tr key={sol.numero_solicitud} className="group hover:bg-white/[0.02] transition-colors h-24">
                                            <td className="p-6 text-center">
                                                <span
                                                    className="inline-block px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 text-sm font-black italic cursor-help ring-1 ring-purple-500/20 shadow-2xl hover:scale-105 transition-all"
                                                    onDoubleClick={() => handleDoubleClick(sol.numero_solicitud)}
                                                    title="Doble clic para ver materiales"
                                                >
                                                    {sol.numero_solicitud}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <p className="text-[13px] font-black text-white uppercase italic tracking-tight leading-relaxed line-clamp-2 max-w-xl group-hover:text-purple-400 transition-colors" title={sol.descripcion_solicitud}>
                                                    {sol.descripcion_solicitud}
                                                </p>
                                            </td>
                                            <td className="p-6 text-center">
                                                <div className="flex flex-col items-center">
                                                    <div className="p-1.5 bg-white/5 rounded-lg mb-1">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                                                    </div>
                                                    <span className="text-[11px] font-mono font-black text-slate-400 uppercase tracking-tighter">
                                                        {new Date(sol.fecha_solicitud).toLocaleDateString('es-CR')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => navigate(`/cliente-externo/registro-salida?numero=${sol.numero_solicitud}`)}
                                                        className="glass-button p-2.5 rounded-xl text-teal-400 hover:text-white hover:bg-teal-500/20 group/btn transition-all"
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
                            Mostrando <span className="text-purple-400 mx-1 text-sm font-black">{currentPage}</span> de <span className="text-white mx-1">{totalPages || 1}</span>
                            <span className="ml-4 opacity-40">({totalItems} registros totales)</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={currentPage <= 1 || loading}
                                onClick={handlePrevPage}
                                className="glass-button p-3 rounded-xl disabled:opacity-20 transition-all hover:bg-white/10"
                            >
                                <ChevronLeft className="w-5 h-5 text-slate-400" />
                            </button>
                            <button
                                disabled={(currentPage * itemsPerPage) >= totalItems || loading}
                                onClick={handleNextPage}
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
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">Solicitud Identificada: #{selectedSolicitudNum}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="p-3 hover:bg-white/5 rounded-2xl transition-all text-slate-500 hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-slate-950/20">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4">
                                    <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                    <p className="font-black text-[10px] uppercase tracking-[0.3em]">Recuperando historial histórico...</p>
                                </div>
                            ) : detailsData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-32 text-slate-800 space-y-4 grayscale opacity-20">
                                    <Info className="w-16 h-16" />
                                    <div className="text-center">
                                        <p className="text-sm font-black uppercase tracking-widest">Sin entregas registradas</p>
                                        <p className="text-[10px] font-bold text-slate-700 mt-2">No se han encontrado suministros vinculados a esta orden.</p>
                                    </div>
                                </div>
                            ) : (
                                detailsData.map((salida) => (
                                    <div key={salida.id_salida} className="bg-white/[0.03] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                                        <div className="px-8 py-5 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-purple-400 font-black text-sm italic">TRANSACCIÓN #S-{salida.id_salida}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest bg-black/40 px-4 py-2 rounded-full border border-white/5">
                                                <Calendar className="w-4 h-4 text-slate-700" />
                                                {new Date(salida.fecha_salida).toLocaleDateString()} <span className="text-slate-700 mx-1">•</span> {new Date(salida.fecha_salida).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em]">
                                                        <th className="px-8 py-4">CÓDIGO</th>
                                                        <th className="px-8 py-4">ARTÍCULO / MATERIAL</th>
                                                        <th className="px-8 py-4 text-right">CANTIDAD</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/[0.02]">
                                                    {salida.dato_salida_13.map((item, idx) => {
                                                        const nombreArticulo = Array.isArray(item.articulo_01)
                                                            ? item.articulo_01[0]?.nombre_articulo
                                                            : item.articulo_01?.nombre_articulo;

                                                        return (
                                                            <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                                                                <td className="px-8 py-4 font-mono text-[11px] font-black text-slate-500">#{item.articulo}</td>
                                                                <td className="px-8 py-4 text-[13px] font-black text-slate-200 uppercase italic tracking-tight">{nombreArticulo || '—'}</td>
                                                                <td className="px-8 py-4 text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-xl font-black text-sm ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-500/5">
                                                                            {item.cantidad}
                                                                        </span>
                                                                        <span className="text-[8px] font-black text-slate-700 uppercase mt-1 tracking-widest">Unidades</span>
                                                                    </div>
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
                                className="glass-button px-10 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all border border-white/5"
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
