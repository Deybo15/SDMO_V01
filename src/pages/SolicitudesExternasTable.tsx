import { useState, useEffect, useCallback } from 'react';
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
    const cargarDatos = useCallback(async (page: number) => {
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

            setSolicitudes((data || []).map((s: any) => ({
                ...s,
                numero_solicitud: Number(s.numero_solicitud)
            })));
            setTotalItems(count || 0);
            setCurrentPage(page);

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    }, [searchTerm]);

    // Effects
    useEffect(() => {
        cargarDatos(currentPage);
    }, [cargarDatos, currentPage]);

    // Debounce filters
    useEffect(() => {
        const timer = setTimeout(() => {
            cargarDatos(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [cargarDatos, searchTerm]);


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
        <div className="min-h-screen bg-black text-[#f4f4f5] font-sans relative flex flex-col selection:bg-white/20 pb-12">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333333; border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #424245; }
            `}</style>

            <PageHeader
                title="Salidas Clientes Externos"
                icon={Table}
                themeColor="neutral"
                subtitle="Gestión y entrega de materiales para órdenes de trabajo activas ST-E."
                rightElement={
                    <div className="flex items-center gap-3">
                        <button
                            onClick={exportToPDF}
                            className="h-11 px-5 bg-[#111112] border border-[#52525b] text-white rounded-lg text-sm font-semibold hover:bg-[#18181b] transition-colors flex items-center gap-2"
                        >
                            <File className="w-4 h-4" /> PDF Listado
                        </button>
                        <button
                            onClick={exportToExcel}
                            className="h-11 px-5 bg-[#e4e4e7] border border-white text-black rounded-lg text-sm font-semibold hover:bg-white transition-colors flex items-center gap-2"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Excel Completo
                        </button>
                    </div>
                }
            />

            <div className="max-w-[1600px] mx-auto w-full px-4 md:px-8 space-y-5 flex-1 flex flex-col">
                {/* Filters Section */}
                <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-4">
                    <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                        <div className="w-full lg:flex-1">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a] group-focus-within:text-white transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar por número de solicitud o descripción de la órden..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-[#111112] border border-[#3f3f46] rounded-lg pl-11 pr-4 py-3 text-sm text-white focus:border-[#a1a1aa] outline-none transition-colors placeholder:text-[#71717a]"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/cliente-externo')}
                            className="h-11 px-5 bg-[#111112] border border-[#52525b] text-white rounded-lg text-sm font-semibold hover:bg-[#18181b] transition-colors flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" /> Regresar
                        </button>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl overflow-hidden mb-8 h-full min-h-[500px] flex flex-col">
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-[#18181b] text-[#a1a1aa] text-[10px] font-semibold tracking-[0.14em] uppercase border-b border-[#3f3f46]">
                                    <th className="p-6 text-center w-[15%]">N° SOLICITUD</th>
                                    <th className="p-6 w-[50%]">DESCRIPCIÓN</th>
                                    <th className="p-6 text-center w-[15%]">FECHA</th>
                                    <th className="p-6 text-center w-[20%]">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody className={cn("text-sm divide-y divide-[#27272a] transition-opacity duration-300", loading ? 'opacity-30 pointer-events-none' : 'opacity-100')}>
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
                                        <tr key={sol.numero_solicitud} className="hover:bg-[#111112] transition-colors group">
                                            <td className="px-5 py-4 text-center">
                                                <button
                                                    onDoubleClick={() => handleDoubleClick(sol.numero_solicitud)}
                                                    className="inline-block px-3 py-2 rounded-lg bg-[#18181b] text-white text-sm font-semibold border border-[#52525b] hover:border-[#a1a1aa] transition-colors"
                                                    title="Doble clic para ver materiales"
                                                >
                                                    #{sol.numero_solicitud}
                                                </button>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-medium text-[#e4e4e7] leading-relaxed line-clamp-2 max-w-2xl" title={sol.descripcion_solicitud}>
                                                    {sol.descripcion_solicitud}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5 text-[#86868B]" />
                                                    <span className="text-xs font-semibold text-[#e4e4e7]">
                                                        {new Date(sol.fecha_solicitud).toLocaleDateString('es-CR')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => navigate(`/cliente-externo/registro-salida?numero=${sol.numero_solicitud}`)}
                                                        className="h-10 w-10 bg-[#e4e4e7] text-black rounded-lg border border-white flex items-center justify-center hover:bg-white transition-colors"
                                                        title="Realizar Salida"
                                                    >
                                                        <ExternalLink className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrintRow(sol.numero_solicitud)}
                                                        className="h-10 w-10 bg-[#111112] border border-[#3f3f46] text-[#a1a1aa] rounded-lg flex items-center justify-center hover:border-[#a1a1aa] hover:text-white transition-colors"
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
                    <div className="bg-[#111112] border-t border-[#3f3f46] px-5 py-4 flex items-center justify-between mt-auto">
                        <div className="text-xs font-medium text-[#a1a1aa]">
                            Página <span className="text-white font-semibold">{currentPage}</span> de <span className="text-white font-semibold">{totalPages || 1}</span>
                            <span className="ml-4 opacity-40">({totalItems} registros totales)</span>
                        </div>
                        <div className="flex gap-4">
                            <button
                                disabled={currentPage <= 1 || loading}
                                onClick={handlePrevPage}
                                className="h-10 px-4 bg-[#18181b] border border-[#3f3f46] text-white rounded-lg text-sm font-semibold hover:border-[#a1a1aa] transition-colors disabled:opacity-20 flex items-center gap-2"
                            >
                                <ChevronLeft className="w-5 h-5" /> Anterior
                            </button>
                            <button
                                disabled={(currentPage * itemsPerPage) >= totalItems || loading}
                                onClick={handleNextPage}
                                className="h-10 px-4 bg-[#18181b] border border-[#3f3f46] text-white rounded-lg text-sm font-semibold hover:border-[#a1a1aa] transition-colors disabled:opacity-20 flex items-center gap-2"
                            >
                                Siguiente <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Details Modal */}
            {showDetailsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl bg-[#0b0b0c] border border-[#3f3f46] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
                        <div className="px-6 py-5 border-b border-[#27272a] flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-[#18181b] rounded-lg border border-[#3f3f46]">
                                    <Package className="w-6 h-6 text-[#d4d4d8]" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white">Materiales entregados</h3>
                                    <p className="text-[10px] font-black text-[#86868B] uppercase tracking-widest mt-1">Órden de Trabajo #{selectedSolicitudNum}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="w-10 h-10 flex items-center justify-center bg-[#111112] border border-[#3f3f46] text-[#a1a1aa] rounded-lg hover:text-white hover:bg-[#18181b] transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 md:p-6 custom-scrollbar space-y-5">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-24 text-[#86868B] space-y-4">
                                    <Loader2 className="w-10 h-10 animate-spin text-white" />
                                    <p className="font-black text-[10px] uppercase tracking-[0.3em]">Recuperando historial histórico...</p>
                                </div>
                            ) : detailsData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-32 text-[#86868B] space-y-4">
                                    <Info className="w-16 h-16 opacity-10" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Sin entregas registradas</p>
                                </div>
                            ) : (
                                detailsData.map((salida) => (
                                    <div key={salida.id_salida} className="bg-[#111112] border border-[#3f3f46] rounded-xl overflow-hidden">
                                        <div className="px-5 py-4 bg-[#18181b] border-b border-[#3f3f46] flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-white font-semibold text-sm">Salida #{salida.id_salida}</span>
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
                                                                <td className="px-6 py-4 text-xs font-medium text-[#e4e4e7]">{nombreArticulo || '—'}</td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <span className="bg-[#e4e4e7] text-black px-3 py-1 rounded-md font-semibold text-xs border border-white">{item.cantidad}</span>
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

                        <div className="p-5 border-t border-[#3f3f46] bg-[#111112] flex justify-end">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="h-11 px-6 bg-[#e4e4e7] text-black rounded-lg text-sm font-semibold hover:bg-white transition-colors"
                            >
                                Cerrar ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
