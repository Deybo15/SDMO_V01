import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Table,
    ArrowLeft,
    FileSpreadsheet,
    FileText,
    Hash,
    AlignLeft,
    Calendar,
    Settings,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Search,
    Loader2
} from 'lucide-react';

// Interface for the request data
interface Solicitud {
    numero_solicitud: number;
    descripcion_solicitud: string;
    fecha_solicitud: string;
}

export default function RealizarSolicitudExterno() {
    const navigate = useNavigate();
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [loading, setLoading] = useState(false);

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
                .from('solicitud_17') // Using the correct table based on previous context
                .select('numero_solicitud, descripcion_solicitud, fecha_solicitud', { count: 'exact' });

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

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(solicitudes.map(s => ({
            'Número de Solicitud': s.numero_solicitud,
            'Descripción': s.descripcion_solicitud,
            'Fecha': new Date(s.fecha_solicitud).toLocaleDateString('es-CR')
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes');
        XLSX.writeFile(wb, 'Solicitudes_Cliente_Externo.xlsx');
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text('Solicitudes Cliente Externo', 10, 10);

        const tableData = solicitudes.map(s => [
            s.numero_solicitud,
            s.descripcion_solicitud,
            new Date(s.fecha_solicitud).toLocaleDateString('es-CR')
        ]);

        autoTable(doc, {
            head: [['Número', 'Descripción', 'Fecha']],
            body: tableData,
            startY: 20,
        });

        doc.save('Solicitudes_Cliente_Externo.pdf');
    };

    return (
        <div className="min-h-screen relative p-4 md:p-8 font-sans text-[#e2e8f0] overflow-hidden">
            {/* Custom Styles for Background Animation */}
            <style>{`
                body {
                    background: linear-gradient(135deg, #0f1419 0%, #1a1f2e 50%, #0a0e1a 100%);
                }
                .bg-animated::before {
                    content: '';
                    position: fixed;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: 
                        radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 75% 75%, rgba(168, 85, 247, 0.08) 0%, transparent 50%),
                        radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.05) 0%, transparent 50%);
                    animation: float 20s ease-in-out infinite;
                    z-index: -1;
                    pointer-events: none;
                }
                @keyframes float {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    33% { transform: translate(30px, -30px) rotate(120deg); }
                    66% { transform: translate(-20px, 20px) rotate(240deg); }
                }
                .glass-container {
                    background: rgba(15, 20, 25, 0.6);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
                }
                .header-gradient-text {
                    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .btn-hover-effect {
                    position: relative;
                    overflow: hidden;
                }
                .btn-hover-effect::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
                    transition: left 0.5s;
                }
                .btn-hover-effect:hover::before {
                    left: 100%;
                }
            `}</style>

            <div className="bg-animated" />

            <div className="max-w-7xl mx-auto glass-container rounded-[24px] p-8">
                {/* Header */}
                <div className="relative text-center mb-8 pb-8 border-b border-white/10 -mx-8 px-8 bg-gradient-to-br from-[#6366f1]/10 to-[#a855f7]/10">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-[#6366f1] to-[#a855f7] rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                    <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-3 header-gradient-text">
                        <Table className="w-8 h-8 text-[#6366f1]" />
                        Solicitudes Cliente Externo (Actualizado)
                    </h1>
                    <p className="text-[#94a3b8] text-base opacity-80">Gestión y consulta de solicitudes externas</p>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={filtroNumero}
                            onChange={(e) => setFiltroNumero(e.target.value)}
                            placeholder="Buscar por número de solicitud"
                            className="w-full bg-[#1e293b]/40 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]/60 focus:bg-[#1e293b]/60 transition-all shadow-sm"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
                    </div>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={filtroDescripcion}
                            onChange={(e) => setFiltroDescripcion(e.target.value)}
                            placeholder="Buscar por descripción"
                            className="w-full bg-[#1e293b]/40 backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]/60 focus:bg-[#1e293b]/60 transition-all shadow-sm"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-4 mb-6">
                    <button
                        onClick={() => navigate('/cliente-externo')}
                        className="btn-hover-effect px-6 py-3 bg-[#475569]/30 border border-[#475569]/40 rounded-2xl text-[#e2e8f0] font-medium hover:bg-[#475569]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Regresar
                    </button>
                    <button
                        onClick={exportToExcel}
                        className="btn-hover-effect px-6 py-3 bg-gradient-to-br from-[#6366f1]/30 to-[#a855f7]/30 border border-[#6366f1]/40 rounded-2xl text-[#f1f5f9] font-medium hover:from-[#6366f1]/40 hover:to-[#a855f7]/40 hover:shadow-[0_8px_25px_rgba(99,102,241,0.2)] hover:-translate-y-0.5 transition-all flex items-center gap-2"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Exportar a Excel
                    </button>
                    <button
                        onClick={exportToPDF}
                        className="btn-hover-effect px-6 py-3 bg-gradient-to-br from-[#6366f1]/30 to-[#a855f7]/30 border border-[#6366f1]/40 rounded-2xl text-[#f1f5f9] font-medium hover:from-[#6366f1]/40 hover:to-[#a855f7]/40 hover:shadow-[0_8px_25px_rgba(99,102,241,0.2)] hover:-translate-y-0.5 transition-all flex items-center gap-2"
                    >
                        <FileText className="w-4 h-4" />
                        Exportar a PDF
                    </button>
                </div>

                {/* Table */}
                <div className="bg-[#1e293b]/30 backdrop-blur-md border border-white/10 rounded-[20px] overflow-hidden shadow-xl mb-8">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gradient-to-r from-[#6366f1]/20 to-[#a855f7]/20 border-b border-[#6366f1]/30">
                                    <th className="py-4 px-6 text-center font-semibold text-[#f1f5f9] relative">
                                        <div className="flex items-center justify-center gap-2">
                                            <Hash className="w-4 h-4" />
                                            Número de Solicitud
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#6366f1] to-[#a855f7] opacity-60" />
                                    </th>
                                    <th className="py-4 px-6 text-center font-semibold text-[#f1f5f9] relative">
                                        <div className="flex items-center justify-center gap-2">
                                            <AlignLeft className="w-4 h-4" />
                                            Descripción
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#6366f1] to-[#a855f7] opacity-60" />
                                    </th>
                                    <th className="py-4 px-6 text-center font-semibold text-[#f1f5f9] relative">
                                        <div className="flex items-center justify-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            Fecha de Solicitud
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#6366f1] to-[#a855f7] opacity-60" />
                                    </th>
                                    <th className="py-4 px-6 text-center font-semibold text-[#f1f5f9] relative">
                                        <div className="flex items-center justify-center gap-2">
                                            <Settings className="w-4 h-4" />
                                            Acción
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#6366f1] to-[#a855f7] opacity-60" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-[#94a3b8]">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Cargando datos...
                                            </div>
                                        </td>
                                    </tr>
                                ) : solicitudes.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-[#94a3b8]">
                                            No se encontraron solicitudes
                                        </td>
                                    </tr>
                                ) : (
                                    solicitudes.map((solicitud) => (
                                        <tr key={solicitud.numero_solicitud} className="hover:bg-[#6366f1]/10 transition-all hover:-translate-y-[1px] group">
                                            <td className="py-4 px-6 text-center text-[#e2e8f0]">
                                                {solicitud.numero_solicitud}
                                            </td>
                                            <td className="py-4 px-6 text-center text-[#e2e8f0]">
                                                {solicitud.descripcion_solicitud}
                                            </td>
                                            <td className="py-4 px-6 text-center text-[#e2e8f0]">
                                                {solicitud.fecha_solicitud ? new Date(solicitud.fecha_solicitud).toLocaleDateString('es-CR') : 'Sin fecha'}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <button
                                                    onClick={() => navigate(`/cliente-externo/seguimiento?numero=${solicitud.numero_solicitud}`)}
                                                    className="px-4 py-2 bg-gradient-to-br from-green-500/30 to-emerald-500/30 border border-green-500/40 rounded-xl text-[#f1f5f9] text-sm font-medium hover:from-green-500/40 hover:to-emerald-500/40 hover:shadow-[0_4px_15px_rgba(34,197,94,0.2)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 mx-auto"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    Salida
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#0f1419]/40 backdrop-blur-md border border-white/10 rounded-2xl p-6">
                    <button
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        className="btn-hover-effect px-6 py-3 bg-gradient-to-br from-[#6366f1]/30 to-[#a855f7]/30 border border-[#6366f1]/40 rounded-2xl text-[#f1f5f9] font-medium hover:from-[#6366f1]/40 hover:to-[#a855f7]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                    </button>

                    <span className="text-[#94a3b8] font-medium">
                        Página {currentPage} de {Math.max(1, Math.ceil(totalItems / itemsPerPage))}
                    </span>

                    <button
                        onClick={handleNextPage}
                        disabled={(currentPage * itemsPerPage) >= totalItems}
                        className="btn-hover-effect px-6 py-3 bg-gradient-to-br from-[#6366f1]/30 to-[#a855f7]/30 border border-[#6366f1]/40 rounded-2xl text-[#f1f5f9] font-medium hover:from-[#6366f1]/40 hover:to-[#a855f7]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}