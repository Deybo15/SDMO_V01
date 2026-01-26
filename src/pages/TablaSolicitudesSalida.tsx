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
    instalacion_municipal?: string; // Mapped from join
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

            // Flatten/Map data for easier usage
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
        // Fetch all matching records for export
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
                <div className="sticky top-0 z-50 flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 py-4 bg-[#1a1d29]/90 backdrop-blur-xl border-b border-white/10 shadow-lg gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-600/20 border border-white/20 flex items-center justify-center shadow-lg shadow-purple-500/10">
                            <FileText className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-2xl font-black text-white tracking-tight leading-tight">Salidas de Cliente Interno</h1>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5 hidden md:block">Gestión de órdenes de trabajo ST-I</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full sm:w-auto px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                    >
                        Regresar
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="space-y-4 md:space-y-6">
                    {/* Filters & Actions Card */}
                    <div className="bg-[#1e2330]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-8 shadow-2xl">
                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar por número..."
                                    value={searchNum}
                                    onChange={(e) => setSearchNum(e.target.value)}
                                    className="w-full bg-[#13161c] border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 outline-none transition-all placeholder-gray-600"
                                />
                            </div>
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar por descripción..."
                                    value={searchDesc}
                                    onChange={(e) => setSearchDesc(e.target.value)}
                                    className="w-full bg-[#13161c] border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 outline-none transition-all placeholder-gray-600"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                            <button
                                onClick={() => navigate(-1)}
                                className="flex-1 sm:flex-none px-4 py-2.5 bg-[#2d3342]/50 hover:bg-[#363c4e] text-white rounded-xl flex items-center justify-center gap-2 transition-all text-xs font-bold uppercase tracking-widest border border-white/5"
                            >
                                <ArrowLeft className="w-4 h-4" /> Regresar
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="flex-1 sm:flex-none px-4 py-2.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 rounded-xl flex items-center justify-center gap-2 transition-all text-xs font-bold uppercase tracking-widest border border-purple-500/20"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Excel
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="flex-1 sm:flex-none px-4 py-2.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 rounded-xl flex items-center justify-center gap-2 transition-all text-xs font-bold uppercase tracking-widest border border-purple-500/20"
                            >
                                <File className="w-4 h-4" /> PDF
                            </button>
                        </div>
                    </div>

                    {/* Records List/Table */}
                    <div className="bg-[#1e2330]/40 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-purple-500/5 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                                    <tr>
                                        <th className="p-4 text-center w-[12%] border-b border-white/5">Número</th>
                                        <th className="p-4 w-[38%] border-b border-white/5">Descripción</th>
                                        <th className="p-4 w-[20%] border-b border-white/5">Instalación</th>
                                        <th className="p-4 text-center w-[15%] border-b border-white/5">Fecha</th>
                                        <th className="p-4 text-center w-[15%] border-b border-white/5">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                                                    <span className="font-bold uppercase tracking-widest text-xs">Cargando registros...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : solicitudes.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                                                No se encontraron solicitudes
                                            </td>
                                        </tr>
                                    ) : (
                                        solicitudes.map((sol) => (
                                            <tr key={sol.numero_solicitud} className="hover:bg-white/[0.02] transition-colors group">
                                                <td
                                                    className="p-4 font-black text-purple-400 text-center cursor-pointer hover:bg-purple-500/10 transition-all rounded-lg"
                                                    onDoubleClick={() => handleDoubleClick(sol.numero_solicitud)}
                                                    title="Doble clic para ver materiales"
                                                >
                                                    {sol.numero_solicitud}
                                                </td>
                                                <td className="p-4 text-slate-300">
                                                    <div className="line-clamp-2 leading-relaxed" title={sol.descripcion_solicitud}>
                                                        {sol.descripcion_solicitud}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-400">
                                                    <div className="line-clamp-1 text-xs font-medium" title={sol.instalacion_municipal}>
                                                        {sol.instalacion_municipal}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-400 text-center text-xs font-bold">
                                                    {new Date(sol.fecha_solicitud).toLocaleDateString()}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => navigate(`/cliente-interno/realizar-salidas/formulario?numero=${sol.numero_solicitud}`)}
                                                            className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center gap-2 transition-all text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-emerald-500/5"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" /> Salida
                                                        </button>
                                                        <button
                                                            onClick={() => handlePrintRow(sol.numero_solicitud)}
                                                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl flex items-center gap-2 transition-all text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-rose-500/5"
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

                        {/* Mobile & Tablet Card List View */}
                        <div className="lg:hidden divide-y divide-white/5">
                            {loading ? (
                                <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-4">
                                    <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
                                    <span className="font-bold uppercase tracking-widest text-xs">Cargando datos...</span>
                                </div>
                            ) : solicitudes.length === 0 ? (
                                <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                                    Sin resultados
                                </div>
                            ) : (
                                solicitudes.map((sol) => (
                                    <div key={sol.numero_solicitud} className="p-4 md:p-6 active:bg-white/[0.02] transition-colors relative group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Orden de Trabajo</span>
                                                <span
                                                    className="text-lg font-black text-purple-400"
                                                    onClick={() => handleDoubleClick(sol.numero_solicitud)}
                                                >
                                                    #{sol.numero_solicitud}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1 block">Fecha</span>
                                                <span className="text-xs font-bold text-gray-400">{new Date(sol.fecha_solicitud).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4 mb-5">
                                            <div>
                                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block mb-1">Descripción</span>
                                                <p className="text-sm text-slate-300 leading-relaxed font-medium line-clamp-3">{sol.descripcion_solicitud}</p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-white/5 rounded-xl p-3 border border-white/5">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                                    <Package className="w-4 h-4 text-gray-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block">Instalación</span>
                                                    <p className="text-xs text-gray-400 font-bold truncate uppercase">{sol.instalacion_municipal}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => navigate(`/cliente-interno/realizar-salidas/formulario?numero=${sol.numero_solicitud}`)}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-[0.98] transition-all"
                                            >
                                                <ExternalLink className="w-4 h-4" /> Salida
                                            </button>
                                            <button
                                                onClick={() => handlePrintRow(sol.numero_solicitud)}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-[0.98] transition-all"
                                            >
                                                <Printer className="w-4 h-4" /> Imprimir
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pagination Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-between p-4 md:p-6 bg-white/[0.02] border-t border-white/5 gap-4">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest order-2 sm:order-1">
                                Página {currentPage} de {totalPages || 1} <span className="text-gray-700 mx-1">/</span> {totalRecords} registros
                            </span>

                            <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1 || loading}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-[#2d3342] hover:bg-[#363c4e] text-white rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-20 disabled:grayscale text-xs font-bold uppercase tracking-widest border border-white/5"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Anterior
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || loading}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-[#2d3342] hover:bg-[#363c4e] text-white rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-20 disabled:grayscale text-xs font-bold uppercase tracking-widest border border-white/5"
                                >
                                    Siguiente <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
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
