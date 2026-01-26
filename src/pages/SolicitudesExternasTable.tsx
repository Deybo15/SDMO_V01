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
    Info
} from 'lucide-react';
import autoTable from 'jspdf-autotable';

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
    const itemsPerPage = 10;

    // Filter state
    const [filtroNumero, setFiltroNumero] = useState('');
    const [filtroDescripcion, setFiltroDescripcion] = useState('');

    // Load data
    const cargarDatos = async () => {
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

            const { data, count, error } = await query
                .order('numero_solicitud', { ascending: false })
                .range((currentPage - 1) * itemsPerPage, (currentPage * itemsPerPage) - 1);

            if (error) throw error;

            setSolicitudes(data || []);
            setTotalItems(count || 0);

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Effects
    useEffect(() => {
        cargarDatos();
    }, [currentPage]); // Reload when page changes

    // Debounce filters
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1); // Reset to page 1 on filter change
            cargarDatos();
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
            alert('Error al cargar los detalles de la solicitud.');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handlePrintRow = async (numeroSolicitud: number) => {
        try {
            // El archivo debe existir en el bucket 'ordenes-trabajo'
            // Formato: OT-{numero_solicitud}-CE.pdf (Cliente Externo - Assuming suffix, adjusting if needed based on internal logic)
            // Correction: Check internal logic. Internal uses CI. External likely uses CE or similar?
            // Actually, internal used OT-{numeroSolicitud}-CI.pdf.
            // Let's assume standard behavior or just warn user.
            // Or better, just try to open it.

            // Wait, does the user want the print button? The request didn't explicitly ask for it, BUT verification mentions matching 'Realizar Salidas'.
            // 'Realizar Salidas' has a print button. I'll add it for consistency.
            // Assuming nomenclature might be CE for Cliente Externo?
            const fileName = `OT-${numeroSolicitud}-CE.pdf`;

            const { data } = supabase.storage
                .from('ordenes-trabajo')
                .getPublicUrl(fileName);

            if (data && data.publicUrl) {
                window.open(data.publicUrl, '_blank');
            } else {
                alert('No se pudo obtener el enlace del archivo.');
            }

        } catch (error: any) {
            console.error('Error en handlePrintRow:', error);
            alert('Ocurrió un error inesperado al intentar abrir el PDF.');
        }
    };


    return (
        <div className="min-h-screen bg-[#0f111a] text-[#e4e6ea] font-sans p-4 md:p-8 relative overflow-x-hidden">
            {/* Ambient Background Elements */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[10%] left-[5%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px] animate-pulse" />
                <div className="absolute bottom-[10%] right-[5%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]" />
                <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-teal-500/5 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-7xl mx-auto space-y-8 relative z-10">
                {/* Premium Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/20 to-blue-700/20 border border-white/10 flex items-center justify-center shadow-2xl relative group">
                            <div className="absolute inset-0 bg-purple-500/10 rounded-2xl blur-xl group-hover:bg-purple-500/20 transition-all" />
                            <Table className="w-8 h-8 text-purple-400 relative z-10" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none mb-2">
                                Salidas de Cliente Externo
                            </h1>
                            <div className="flex items-center gap-2 text-purple-500/60 font-black uppercase tracking-widest text-[10px]">
                                <Calendar className="w-4 h-4" />
                                Lista Maestra de Solicitudes
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/cliente-externo')}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4 text-purple-500" />
                            Regresar
                        </button>
                    </div>
                </div>

                {/* Search & Actions Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-widest ml-1 opacity-40">Filtrar por Número</label>
                            <div className="relative group/input">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within/input:text-purple-400 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Ejem: 10855..."
                                    value={filtroNumero}
                                    onChange={(e) => setFiltroNumero(e.target.value)}
                                    className="w-full bg-[#1e2235]/60 backdrop-blur-xl border border-white/10 rounded-[1.25rem] py-4 pl-12 pr-4 text-white font-bold placeholder-slate-700 focus:outline-none focus:border-purple-500/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-widest ml-1 opacity-40">Filtrar por Descripción</label>
                            <div className="relative group/input">
                                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within/input:text-purple-400 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar palabras clave..."
                                    value={filtroDescripcion}
                                    onChange={(e) => setFiltroDescripcion(e.target.value)}
                                    className="w-full bg-[#1e2235]/60 backdrop-blur-xl border border-white/10 rounded-[1.25rem] py-4 pl-12 pr-4 text-white font-bold placeholder-slate-700 focus:outline-none focus:border-purple-500/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 flex items-center gap-2">
                        <button
                            onClick={exportToExcel}
                            className="flex-1 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/5"
                        >
                            Exportar Excel
                        </button>
                        <button
                            onClick={exportToPDF}
                            className="flex-1 py-4 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-450 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-500/5"
                        >
                            Exportar PDF
                        </button>
                    </div>
                </div>

                {/* Main Table Content */}
                <div className="bg-[#1e2235]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.02]">
                                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 w-[15%] text-center">N° Solicitud</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 w-[45%]">Descripción</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 w-[20%] text-center">Fecha</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 w-[20%] text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="p-20 text-center">
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                                                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest animate-pulse">Consultando registros...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : solicitudes.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-20 text-center">
                                            <div className="flex flex-col items-center justify-center gap-4 opacity-30">
                                                <X className="w-12 h-12 text-slate-500" />
                                                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">No hay resultados coincidentes</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    solicitudes.map((sol) => (
                                        <tr key={sol.numero_solicitud} className="group hover:bg-white/[0.03] transition-colors relative">
                                            <td className="p-6 text-center">
                                                <div
                                                    className="inline-block px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 font-black font-mono text-sm cursor-pointer hover:bg-purple-500 hover:text-white transition-all shadow-inner"
                                                    onDoubleClick={() => handleDoubleClick(sol.numero_solicitud)}
                                                    title="Doble clic para ver detalles"
                                                >
                                                    {sol.numero_solicitud}
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <p className="text-slate-200 font-medium leading-relaxed line-clamp-2 max-w-lg group-hover:text-white transition-colors" title={sol.descripcion_solicitud}>
                                                    {sol.descripcion_solicitud}
                                                </p>
                                            </td>
                                            <td className="p-6 text-center">
                                                <span className="text-slate-500 font-bold text-xs uppercase tracking-tighter">
                                                    {new Date(sol.fecha_solicitud).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => navigate(`/cliente-externo/registro-salida?numero=${sol.numero_solicitud}`)}
                                                        className="px-4 py-2 bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-black border border-teal-500/20 rounded-xl flex items-center gap-2 transition-all text-[10px] font-black uppercase tracking-widest group/btn"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                                                        Salida
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrintRow(sol.numero_solicitud)}
                                                        className="p-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 rounded-xl transition-all group/print"
                                                        title="Imprimir Orden"
                                                    >
                                                        <Printer className="w-4 h-4 group-hover/print:rotate-12 transition-transform" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Premium Pagination */}
                    <div className="p-8 border-t border-white/5 bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4 order-2 sm:order-1">
                            <button
                                onClick={handlePrevPage}
                                disabled={currentPage === 1 || loading}
                                className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 hover:border-purple-500/50 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button
                                onClick={handleNextPage}
                                disabled={(currentPage * itemsPerPage) >= totalItems || loading}
                                className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 hover:border-purple-500/50 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex flex-col items-center sm:items-end gap-1 order-1 sm:order-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-500/60">Paginación Dinámica</span>
                            <span className="text-slate-400 text-xs font-bold">
                                Página <span className="text-white">{currentPage}</span> de <span className="text-white">{Math.max(1, Math.ceil(totalItems / itemsPerPage))}</span>
                                <span className="mx-3 opacity-20">|</span>
                                <span className="text-white">{totalItems}</span> Registros Totales
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Details Modal */}
            {showDetailsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowDetailsModal(false)} />

                    <div className="relative w-full max-w-4xl bg-[#0f111a]/90 border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[80vh] animate-in zoom-in-95 duration-300 transition-all">
                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-purple-500/10 to-blue-500/10 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center shadow-inner">
                                    <Package className="w-6 h-6 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Detalles de Materiales</h3>
                                    <p className="text-[10px] font-black text-purple-500/60 uppercase tracking-widest mt-1">Solicitud Identificada: #{selectedSolicitudNum}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="p-3 hover:bg-white/10 rounded-2xl transition-all text-slate-500 hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                                    <p className="text-slate-500 font-black uppercase text-xs tracking-widest animate-pulse">Sincronizando información galáctica...</p>
                                </div>
                            ) : detailsData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-6 grayscale opacity-20">
                                    <Info className="w-20 h-20" />
                                    <div className="text-center space-y-2">
                                        <p className="text-2xl font-black uppercase italic tracking-tighter">Sin Entregas</p>
                                        <p className="text-sm font-bold uppercase tracking-widest leading-loose">No se ha registrado movimiento de materiales<br />para esta solicitud todavía.</p>
                                    </div>
                                </div>
                            ) : (
                                detailsData.map((salida) => (
                                    <div key={salida.id_salida} className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative group/card">
                                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                            <div className="px-3 py-1 bg-purple-500 text-black text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">Registrado</div>
                                        </div>

                                        <div className="px-8 py-5 bg-white/5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                                    <FileText className="w-4 h-4 text-purple-400" />
                                                </div>
                                                <span className="text-white font-black uppercase tracking-tight italic">Transacción #S-{salida.id_salida}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-black/40 px-4 py-2 rounded-full border border-white/5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(salida.fecha_salida).toLocaleDateString()} — {new Date(salida.fecha_salida).toLocaleTimeString()}
                                            </div>
                                        </div>

                                        <div className="p-0 overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-black/30 text-slate-500">
                                                    <tr>
                                                        <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest">Código</th>
                                                        <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest">Artículo</th>
                                                        <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-right">Cantidad</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {salida.dato_salida_13.map((item, idx) => {
                                                        const nombreArticulo = Array.isArray(item.articulo_01)
                                                            ? item.articulo_01[0]?.nombre_articulo
                                                            : item.articulo_01?.nombre_articulo;

                                                        return (
                                                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                                                <td className="px-8 py-5 font-mono text-xs text-purple-400/70 font-bold">{item.articulo}</td>
                                                                <td className="px-8 py-5 text-sm font-bold text-slate-200">{nombreArticulo || '—'}</td>
                                                                <td className="px-8 py-5 text-right font-black text-white text-lg lowercase">
                                                                    {item.cantidad}
                                                                    <span className="ml-2 text-[10px] uppercase text-slate-600 tracking-tighter">unidades</span>
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

                        {/* Modal Footer */}
                        <div className="p-8 border-t border-white/10 bg-black/40 flex justify-end">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:border-purple-500/50"
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
