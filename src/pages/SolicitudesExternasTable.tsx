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
import { cn } from '../lib/utils';

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
    const [searchTerm, setSearchTerm] = useState('');

    // Load data
    const cargarDatos = async (page: number) => {
        setLoading(true);
        try {
            let query = supabase
                .from('solicitud_17')
                .select('numero_solicitud, descripcion_solicitud, fecha_solicitud, seguimiento_solicitud!inner(estado_actual)', { count: 'exact' })
                .eq('tipo_solicitud', 'STE')
                .eq('seguimiento_solicitud.estado_actual', 'ACTIVA');

            if (searchTerm) {
                const num = Number(searchTerm);
                if (!isNaN(num)) {
                    query = query.or(`numero_solicitud.eq.${num},descripcion_solicitud.ilike.%${searchTerm}%`);
                } else {
                    query = query.ilike('descripcion_solicitud', `%${searchTerm}%`);
                }
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
    }, [searchTerm]);


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

        if (searchTerm) {
            const num = Number(searchTerm);
            if (!isNaN(num)) {
                query = query.or(`numero_solicitud.eq.${num},descripcion_solicitud.ilike.%${searchTerm}%`);
            } else {
                query = query.ilike('descripcion_solicitud', `%${searchTerm}%`);
            }
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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans relative flex flex-col selection:bg-[#0071E3]/30 pb-20">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333333; border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #424245; }
            `}</style>

            <PageHeader
                title="Salidas Clientes Externos"
                icon={Table}
                subtitle="Gestión y entrega de materiales para órdenes de trabajo activas ST-E."
                rightElement={
                    <div className="flex items-center gap-4">
                        <button
                            onClick={exportToPDF}
                            className="h-11 px-6 bg-transparent border border-[#F5F5F7] text-[#F5F5F7] rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all flex items-center gap-2.5 active:scale-95"
                        >
                            <File className="w-4 h-4" /> PDF Listado
                        </button>
                        <button
                            onClick={exportToExcel}
                            className="h-11 px-6 bg-[#0071E3] text-white rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2.5 shadow-xl active:scale-95"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Excel Completo
                        </button>
                    </div>
                }
            />

            <div className="max-w-[1600px] mx-auto w-full px-8 space-y-8 flex-1 flex flex-col">
                {/* Filters Section */}
                <div className="bg-[#121212] border border-[#333333] rounded-[8px] p-6 shadow-2xl">
                    <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
                        <div className="w-full lg:w-[70%]">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] group-focus-within:text-[#0071E3] transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar por número de solicitud o descripción de la órden..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-12 pr-4 py-3 text-sm text-[#F5F5F7] focus:border-[#0071E3]/50 outline-none transition-all placeholder:text-[#424245] font-medium"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/cliente-externo')}
                            className="h-11 px-8 bg-transparent border border-[#F5F5F7] text-[#F5F5F7] rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all flex items-center gap-2.5 active:scale-95"
                        >
                            <ArrowLeft className="w-4 h-4" /> Regresar
                        </button>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-[#121212] border border-[#333333] rounded-[8px] shadow-3xl overflow-hidden mb-16 h-full min-h-[500px] flex flex-col">
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-[#1D1D1F] text-[#86868B] text-[10px] font-black tracking-[0.2em] uppercase border-b border-[#333333]">
                                    <th className="p-6 text-center w-[15%]">N° SOLICITUD</th>
                                    <th className="p-6 w-[50%]">DESCRIPCIÓN</th>
                                    <th className="p-6 text-center w-[15%]">FECHA</th>
                                    <th className="p-6 text-center w-[20%]">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody className={cn("text-sm divide-y divide-[#333333]/30 transition-opacity duration-500", loading ? 'opacity-30 pointer-events-none' : 'opacity-100')}>
                                {solicitudes.length === 0 && !loading ? (
                                    <tr>
                                        <td colSpan={4} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <AlertOctagon className="w-12 h-12 text-[#333333]" />
                                                <p className="text-[10px] font-black uppercase text-[#86868B] tracking-widest">No hay resultados coincidentes</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    solicitudes.map((sol) => (
                                        <tr key={sol.numero_solicitud} className="hover:bg-white/[0.02] transition-colors group h-24">
                                            <td className="p-6 text-center">
                                                <button
                                                    onDoubleClick={() => handleDoubleClick(sol.numero_solicitud)}
                                                    className="inline-block px-4 py-2 rounded-[8px] bg-[#0071E3]/10 text-[#0071E3] text-[13px] font-black tracking-tight border border-[#0071E3]/20 hover:bg-[#0071E3]/20 transition-all font-mono italic"
                                                    title="Doble clic para ver materiales"
                                                >
                                                    {sol.numero_solicitud}
                                                </button>
                                            </td>
                                            <td className="p-6">
                                                <p className="text-[11px] font-black text-[#F5F5F7] uppercase tracking-tight leading-relaxed line-clamp-2 max-w-2xl italic" title={sol.descripcion_solicitud}>
                                                    {sol.descripcion_solicitud}
                                                </p>
                                            </td>
                                            <td className="p-6 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5 text-[#86868B]" />
                                                    <span className="text-[11px] font-black text-[#F5F5F7] italic">
                                                        {new Date(sol.fecha_solicitud).toLocaleDateString('es-CR')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center justify-center gap-4">
                                                    <button
                                                        onClick={() => navigate(`/cliente-externo/registro-salida?numero=${sol.numero_solicitud}`)}
                                                        className="h-10 w-10 bg-[#0071E3]/10 text-[#0071E3] rounded-[8px] border border-[#0071E3]/30 flex items-center justify-center hover:bg-[#0071E3] hover:text-white transition-all active:scale-90"
                                                        title="Realizar Salida"
                                                    >
                                                        <ExternalLink className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrintRow(sol.numero_solicitud)}
                                                        className="h-10 w-10 bg-transparent border border-[#333333] text-[#86868B] rounded-[8px] flex items-center justify-center hover:bg-white/5 hover:text-[#F5F5F7] transition-all active:scale-90"
                                                        title="Imprimir Orden"
                                                    >
                                                        <Printer className="w-5 h-5" />
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
                    <div className="bg-[#1D1D1F] border-t border-[#333333] px-8 py-4 flex items-center justify-between mt-auto">
                        <div className="text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">
                            Página <span className="text-[#0071E3] text-[13px]">{currentPage}</span> de <span className="text-white">{totalPages || 1}</span>
                            <span className="ml-4 opacity-40">({totalItems} registros totales)</span>
                        </div>
                        <div className="flex gap-4">
                            <button
                                disabled={currentPage <= 1 || loading}
                                onClick={handlePrevPage}
                                className="h-10 px-6 bg-transparent border border-[#333333] text-[#F5F5F7] rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all disabled:opacity-20 flex items-center gap-2"
                            >
                                <ChevronLeft className="w-5 h-5" /> Anterior
                            </button>
                            <button
                                disabled={(currentPage * itemsPerPage) >= totalItems || loading}
                                onClick={handleNextPage}
                                className="h-10 px-6 bg-transparent border border-[#333333] text-[#F5F5F7] rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all disabled:opacity-20 flex items-center gap-2"
                            >
                                Siguiente <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Details Modal */}
            {showDetailsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-[20px] animate-in fade-in duration-300">
                    <div className="w-full max-w-4xl bg-[#121212] border border-[#333333] rounded-[8px] shadow-[0_32px_128px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-8 border-b border-[#333333] flex justify-between items-center bg-black/20">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-[#0071E3]/10 rounded-[8px] border border-[#0071E3]/20">
                                    <Package className="w-7 h-7 text-[#0071E3]" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-[#F5F5F7] italic uppercase tracking-tighter">Materiales Entregados</h3>
                                    <p className="text-[10px] font-black text-[#86868B] uppercase tracking-widest mt-1">Órden de Trabajo #{selectedSolicitudNum}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="p-3 bg-transparent border border-[#F5F5F7]/30 text-[#86868B] rounded-[8px] hover:text-[#F5F5F7] hover:bg-white/5 transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-black/40">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-24 text-[#86868B] space-y-4">
                                    <Loader2 className="w-12 h-12 animate-spin text-[#0071E3]" />
                                    <p className="font-black text-[10px] uppercase tracking-[0.3em]">Recuperando historial histórico...</p>
                                </div>
                            ) : detailsData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-32 text-[#86868B] space-y-4">
                                    <Info className="w-16 h-16 opacity-10" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Sin entregas registradas</p>
                                </div>
                            ) : (
                                detailsData.map((salida) => (
                                    <div key={salida.id_salida} className="bg-[#1D1D1F] border border-[#333333] rounded-[8px] overflow-hidden shadow-xl">
                                        <div className="px-8 py-5 bg-black/20 border-b border-[#333333] flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[#0071E3] font-black text-[13px] uppercase italic">SALIDA #{salida.id_salida}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] font-black text-[#86868B] uppercase tracking-widest">
                                                <Calendar className="w-4 h-4" />
                                                {new Date(salida.fecha_salida).toLocaleDateString()} <span className="opacity-20 mx-1">•</span> {new Date(salida.fecha_salida).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="text-[#86868B] text-[9px] font-black uppercase tracking-[0.2em] bg-black/20">
                                                        <th className="px-6 py-4">CÓDIGO</th>
                                                        <th className="px-6 py-4">ARTÍCULO / MATERIAL</th>
                                                        <th className="px-6 py-4 text-right">CANTIDAD</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#333333]/30">
                                                    {salida.dato_salida_13.map((item, idx) => {
                                                        const nombreArticulo = Array.isArray(item.articulo_01)
                                                            ? item.articulo_01[0]?.nombre_articulo
                                                            : item.articulo_01?.nombre_articulo;

                                                        return (
                                                            <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                                                                <td className="px-6 py-4 font-mono text-[11px] font-black text-[#86868B]">#{item.articulo}</td>
                                                                <td className="px-6 py-4 text-[11px] font-black text-[#F5F5F7] uppercase tracking-tight italic">{nombreArticulo || '—'}</td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <span className="bg-[#0071E3]/10 text-[#0071E3] px-3 py-1 rounded-[4px] font-black text-[11px] border border-[#0071E3]/20 italic">{item.cantidad}</span>
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

                        <div className="p-8 border-t border-[#333333] bg-black/20 flex justify-end">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="h-11 px-8 bg-[#0071E3] text-white rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-xl"
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
