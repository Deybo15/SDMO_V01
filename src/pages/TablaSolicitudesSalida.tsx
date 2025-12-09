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
    Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Solicitud {
    numero_solicitud: string;
    fecha_solicitud: string;
    descripcion_solicitud: string;
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
                .select('numero_solicitud, fecha_solicitud, descripcion_solicitud', { count: 'exact' })
                .eq('tipo_solicitud', 'STI');

            // Apply filters
            if (searchNum) {
                // Use exact match for numeric column
                query = query.eq('numero_solicitud', searchNum);
            }
            if (searchDesc) {
                query = query.ilike('descripcion_solicitud', `%${searchDesc}%`);
            }

            // Apply pagination
            const from = (page - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            const { data, error, count } = await query
                .order('numero_solicitud', { ascending: false })
                .range(from, to);

            if (error) throw error;

            setSolicitudes(data || []);
            setTotalRecords(count || 0);
            setCurrentPage(page);
        } catch (error) {
            console.error('Error fetching solicitudes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        // Fetch all matching records for export
        let query = supabase
            .from('solicitud_17')
            .select('numero_solicitud, fecha_solicitud, descripcion_solicitud')
            .eq('tipo_solicitud', 'STI');

        if (searchNum) query = query.eq('numero_solicitud', searchNum);
        if (searchDesc) query = query.ilike('descripcion_solicitud', `%${searchDesc}%`);

        const { data } = await query.order('numero_solicitud', { ascending: false });

        if (!data) return;

        const ws = XLSX.utils.json_to_sheet(data.map(s => ({
            'Número': s.numero_solicitud,
            'Descripción': s.descripcion_solicitud,
            'Fecha': new Date(s.fecha_solicitud).toLocaleDateString()
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Solicitudes");
        XLSX.writeFile(wb, "solicitudes_cliente_interno.xlsx");
    };

    const handleExportPDF = async () => {
        let query = supabase
            .from('solicitud_17')
            .select('numero_solicitud, fecha_solicitud, descripcion_solicitud')
            .eq('tipo_solicitud', 'STI');

        if (searchNum) query = query.eq('numero_solicitud', searchNum);
        if (searchDesc) query = query.ilike('descripcion_solicitud', `%${searchDesc}%`);

        const { data } = await query.order('numero_solicitud', { ascending: false });

        if (!data) return;

        const doc = new jsPDF();
        autoTable(doc, {
            head: [['Número', 'Descripción', 'Fecha']],
            body: data.map(s => [
                s.numero_solicitud,
                s.descripcion_solicitud,
                new Date(s.fecha_solicitud).toLocaleDateString()
            ]),
        });
        doc.save("solicitudes_cliente_interno.pdf");
    };
    const handlePrintRow = async (numeroSolicitud: string, _descripcion?: string) => {
        try {
            // El archivo debe existir en el bucket 'ordenes-trabajo'
            // Formato: OT-{numero_solicitud}-CI.pdf (Cliente Interno)
            const fileName = `OT-${numeroSolicitud}-CI.pdf`;

            // Intentar abrir directamente la URL pública
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
            alert('Error al cargar los detalles de la solicitud.');
        } finally {
            setLoadingDetails(false);
        }
    };

    const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE);

    return (
        <div className="min-h-screen bg-[#1a1d29] text-[#e4e6ea] font-sans p-4 md:p-8 relative" >
            {/* Background Effects */}
            < div className="fixed inset-0 pointer-events-none" >
                <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-[#7877c6]/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-[#3b82f6]/10 rounded-full blur-[100px]" />
            </div >

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="sticky top-0 z-50 flex items-center justify-between mb-8 -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 py-4 bg-[#1a1d29]/90 backdrop-blur-xl border-b border-white/10 shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-600/20 border border-white/20 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Realizar Salidas</h1>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors"
                    >
                        Regresar
                    </button>
                </div>

                {/* Main Card */}
                <div className="bg-[#1e2330]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="p-8">
                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar por número de solicitud"
                                    value={searchNum}
                                    onChange={(e) => setSearchNum(e.target.value)}
                                    className="w-full bg-[#13161c] border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:border-purple-500 focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar por descripción"
                                    value={searchDesc}
                                    onChange={(e) => setSearchDesc(e.target.value)}
                                    className="w-full bg-[#13161c] border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:border-purple-500 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 mb-8">
                            <button
                                onClick={() => navigate(-1)}
                                className="px-4 py-2 bg-[#2d3342] hover:bg-[#363c4e] text-white rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Regresar
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="px-4 py-2 bg-[#4a3b69] hover:bg-[#58467d] text-white rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="px-4 py-2 bg-[#4a3b69] hover:bg-[#58467d] text-white rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <File className="w-4 h-4" /> Exportar PDF
                            </button>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full text-left">
                                <thead className="bg-[#4a3b69]/30 text-slate-200">
                                    <tr>
                                        <th className="p-4 font-semibold text-center w-[15%]">Número de Solicitud</th>
                                        <th className="p-4 font-semibold w-[45%]">Descripción</th>
                                        <th className="p-4 font-semibold text-center w-[20%]">Fecha de Solicitud</th>
                                        <th className="p-4 font-semibold text-center w-[20%]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 bg-[#13161c]/50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-slate-400">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 className="w-5 h-5 animate-spin" /> Cargando solicitudes...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : solicitudes.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-slate-400">
                                                No se encontraron solicitudes
                                            </td>
                                        </tr>
                                    ) : (
                                        solicitudes.map((sol) => (
                                            <tr key={sol.numero_solicitud} className="hover:bg-white/5 transition-colors group">
                                                <td
                                                    className="p-4 font-bold text-white text-center cursor-pointer hover:text-purple-400 transition-colors"
                                                    onDoubleClick={() => handleDoubleClick(sol.numero_solicitud)}
                                                    title="Doble clic para ver detalles de materiales"
                                                >
                                                    {sol.numero_solicitud}
                                                </td>
                                                <td className="p-4 text-slate-300">
                                                    <div className="line-clamp-2" title={sol.descripcion_solicitud}>
                                                        {sol.descripcion_solicitud}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-300 text-center">
                                                    {new Date(sol.fecha_solicitud).toLocaleDateString()}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => navigate(`/cliente-interno/realizar-salidas/formulario?numero=${sol.numero_solicitud}`)}
                                                            className="px-3 py-1.5 bg-[#1f4b3e] hover:bg-[#275d4d] text-[#4ade80] border border-[#4ade80]/20 rounded-lg flex items-center gap-2 transition-all text-sm font-medium"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" /> Salida
                                                        </button>
                                                        <button
                                                            onClick={() => handlePrintRow(sol.numero_solicitud, sol.descripcion_solicitud)}
                                                            className="px-3 py-1.5 bg-[#4a2b2b] hover:bg-[#5d3636] text-[#f87171] border border-[#f87171]/20 rounded-lg flex items-center gap-2 transition-all text-sm font-medium"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" /> Imprimir
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
                        <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1 || loading}
                                className="px-4 py-2 bg-[#2d3342] hover:bg-[#363c4e] text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" /> Anterior
                            </button>

                            <span className="text-slate-400 text-sm">
                                Página {currentPage} de {totalPages || 1} ({totalRecords} registros)
                            </span>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || loading}
                                className="px-4 py-2 bg-[#2d3342] hover:bg-[#363c4e] text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Siguiente <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Detalles */}
            {showDetailsModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-4xl bg-[#1a1d29] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1e2330]">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/20 rounded-lg">
                                    <Package className="w-6 h-6 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Detalle de Materiales Entregados</h3>
                                    <p className="text-sm text-slate-400">Solicitud #{selectedSolicitudNum}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <Loader2 className="w-8 h-8 animate-spin mb-3 text-purple-500" />
                                    <p>Cargando información...</p>
                                </div>
                            ) : detailsData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-white/5 rounded-xl border border-white/5">
                                    <Info className="w-12 h-12 mb-3 opacity-50" />
                                    <p className="text-lg font-medium">No hay salidas registradas</p>
                                    <p className="text-sm">Esta solicitud aún no tiene materiales entregados.</p>
                                </div>
                            ) : (
                                detailsData.map((salida) => (
                                    <div key={salida.id_salida} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                        <div className="px-6 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-purple-400 font-bold">Salida #{salida.id_salida}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                                <Calendar className="w-4 h-4" />
                                                {new Date(salida.fecha_salida).toLocaleDateString()} {new Date(salida.fecha_salida).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-black/20 text-slate-400">
                                                    <tr>
                                                        <th className="px-6 py-3 font-medium">Código</th>
                                                        <th className="px-6 py-3 font-medium">Artículo</th>
                                                        <th className="px-6 py-3 font-medium text-right">Cantidad</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {salida.dato_salida_13.map((item, idx) => {
                                                        const nombreArticulo = Array.isArray(item.articulo_01)
                                                            ? item.articulo_01[0]?.nombre_articulo
                                                            : item.articulo_01?.nombre_articulo;

                                                        return (
                                                            <tr key={idx} className="hover:bg-white/5">
                                                                <td className="px-6 py-3 font-mono text-slate-400">{item.articulo}</td>
                                                                <td className="px-6 py-3 text-slate-200">{nombreArticulo || 'Desconocido'}</td>
                                                                <td className="px-6 py-3 text-right font-medium text-white">{item.cantidad}</td>
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

                        <div className="p-4 border-t border-white/10 bg-[#1e2330] flex justify-end">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
