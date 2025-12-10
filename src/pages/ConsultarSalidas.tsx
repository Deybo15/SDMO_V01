import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
    Database,
    ArrowLeft,
    FileText,
    Calendar,
    Search,
    CalendarDays,
    CalendarCheck,
    CalendarSearch,
    Download,
    Loader2,
    Info,
    FileX,
    Package,
    CheckCircle,
    Clock,
    ChevronDown,
    Banknote,
    Hash,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    FileSpreadsheet,
    AlertCircle,
    X,
    Filter
} from 'lucide-react';

// Interfaces
interface Salida {
    id_salida: number;
    fecha_salida: string;
    finalizada: boolean;
    numero_solicitud: string;
    dato_salida_13: {
        registro_salida: string;
        articulo: string;
        cantidad: number;
        subtotal: number;
        articulo_01: {
            nombre_articulo: string;
        };
    }[];
}

interface ResumenDiario {
    fecha: string;
    codigo_articulo: string;
    nombre_articulo: string;
    numero_solicitud: string;
    nombre_dependencia: string;
    area_mantenimiento: string;
    cantidad_total: number;
    instalacion_municipal?: string;
}

type SortConfig = {
    key: keyof ResumenDiario;
    direction: 'asc' | 'desc';
} | null;

type FeedbackType = {
    message: string;
    type: 'success' | 'error' | 'info';
} | null;

export default function ConsultarSalidas() {
    const navigate = useNavigate();

    // State
    const [activeTab, setActiveTab] = useState<'solicitud' | 'fecha'>('solicitud');
    const [solicitudInput, setSolicitudInput] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');

    const [loading, setLoading] = useState(false);
    const [salidas, setSalidas] = useState<Salida[]>([]);
    const [resumen, setResumen] = useState<ResumenDiario[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [expandedSalidas, setExpandedSalidas] = useState<number[]>([]);

    // New State for improvements
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [feedback, setFeedback] = useState<FeedbackType>(null);

    // Initialize dates
    useEffect(() => {
        const hoy = new Date();
        const hasta = format(hoy, 'yyyy-MM-dd');
        const desde = format(startOfMonth(hoy), 'yyyy-MM-dd');
        setFechaDesde(desde);
        setFechaHasta(hasta);
    }, []);

    // Feedback Helper
    const showFeedback = (message: string, type: 'success' | 'error' | 'info') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 4000);
    };

    // Helper functions
    const formatearMoneda = (valor: number) => {
        return new Intl.NumberFormat("es-CR", {
            style: "currency",
            currency: "CRC",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            currencyDisplay: "symbol"
        }).format(valor).replace('CRC', '₡');
    };

    const calcularTotalSalida = (salida: Salida) => {
        if (!salida.dato_salida_13) return 0;
        return salida.dato_salida_13.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        // Handle YYYY-MM-DD or ISO string safely without timezone conversion
        return dateStr.split('T')[0].split('-').reverse().join('/');
    };

    const toggleSalidaDetails = (id: number) => {
        setExpandedSalidas(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    // Quick Filters
    const applyQuickFilter = (type: 'today' | 'week' | 'month') => {
        const hoy = new Date();
        let start, end;

        switch (type) {
            case 'today':
                start = hoy;
                end = hoy;
                break;
            case 'week':
                start = startOfWeek(hoy, { weekStartsOn: 1 }); // Monday start
                end = endOfWeek(hoy, { weekStartsOn: 1 });
                break;
            case 'month':
                start = startOfMonth(hoy);
                end = endOfMonth(hoy);
                break;
        }

        setFechaDesde(format(start, 'yyyy-MM-dd'));
        setFechaHasta(format(end, 'yyyy-MM-dd'));
        showFeedback(`Filtro aplicado: ${type === 'today' ? 'Hoy' : type === 'week' ? 'Esta Semana' : 'Este Mes'}`, 'info');
    };

    // Sorting Logic
    const handleSort = (key: keyof ResumenDiario) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedResumen = useMemo(() => {
        if (!sortConfig) return resumen;

        return [...resumen].sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [resumen, sortConfig]);

    // Data Fetching
    const handleBuscarSolicitud = async () => {
        if (!solicitudInput.trim()) {
            showFeedback("Por favor, ingresa un número de solicitud válido.", 'error');
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setSalidas([]);

        try {
            const { data, error } = await supabase
                .from("salida_articulo_08")
                .select(`
                    id_salida,
                    fecha_salida,
                    finalizada,
                    numero_solicitud,
                    dato_salida_13 (
                        registro_salida,
                        articulo,
                        cantidad,
                        subtotal,
                        articulo_01 (
                            nombre_articulo
                        )
                    )
                `)
                .eq("numero_solicitud", solicitudInput.trim())
                .order("fecha_salida", { ascending: false });

            if (error) throw error;
            setSalidas(data || []);
            if (!data || data.length === 0) {
                showFeedback("No se encontraron salidas con ese número.", 'info');
            } else {
                showFeedback(`Se encontraron ${data.length} salidas.`, 'success');
            }
        } catch (error: any) {
            console.error("Error al obtener salidas:", error);
            showFeedback("Error al cargar las salidas: " + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBuscarResumen = async () => {
        if (!fechaDesde || !fechaHasta) {
            showFeedback("Por favor, selecciona ambas fechas.", 'error');
            return;
        }

        if (new Date(fechaDesde) > new Date(fechaHasta)) {
            showFeedback("La fecha desde no puede ser mayor que la fecha hasta.", 'error');
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setResumen([]);

        try {
            const { data, error } = await supabase
                .from("vw_resumen_diario_salida")
                .select("*")
                .gte("fecha", fechaDesde)
                .lte("fecha", fechaHasta)
                .order("fecha", { ascending: true })
                .order("codigo_articulo", { ascending: true });

            if (error) throw error;

            let finalData = data || [];

            // Fetch installations for the fetched records
            if (finalData.length > 0) {
                const solicitudes = [...new Set(finalData.map(d => d.numero_solicitud).filter(Boolean))];

                if (solicitudes.length > 0) {
                    const { data: instData, error: instError } = await supabase
                        .from('solicitud_17')
                        .select('numero_solicitud, instalaciones_municipales_16(instalacion_municipal)')
                        .in('numero_solicitud', solicitudes);

                    if (!instError && instData) {
                        const instMap = new Map(instData.map((s: any) => [
                            s.numero_solicitud,
                            s.instalaciones_municipales_16?.instalacion_municipal || 'N/A'
                        ]));

                        finalData = finalData.map(item => ({
                            ...item,
                            instalacion_municipal: instMap.get(item.numero_solicitud) || 'N/A'
                        }));
                    }
                }
            }

            setResumen(finalData);

            if (!finalData || finalData.length === 0) {
                showFeedback("No se encontraron registros en el período seleccionado.", 'info');
            } else {
                showFeedback(`Se cargaron ${finalData.length} registros exitosamente.`, 'success');
            }
        } catch (error: any) {
            console.error("Error al obtener resumen diario:", error);
            showFeedback("Error al cargar el resumen: " + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Export Functions
    const generarPDF = () => {
        if (resumen.length === 0) return;

        try {
            const doc = new jsPDF('l', 'mm', 'a4');

            doc.setFont('helvetica');
            doc.setFontSize(16);
            doc.setTextColor(40, 40, 40);
            doc.text('Resumen Diario de Salidas', 20, 20);

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Período: ${format(new Date(fechaDesde), 'dd/MM/yyyy')} - ${format(new Date(fechaHasta), 'dd/MM/yyyy')}`, 20, 30);
            doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 35);
            doc.text(`Total de registros: ${resumen.length}`, 20, 40);

            const columnas = ['Fecha', 'Código', 'Artículo', 'Solicitud', 'Instalación', 'Área', 'Cantidad'];

            const filas = sortedResumen.map(item => [
                formatDate(item.fecha),
                item.codigo_articulo || '',
                item.nombre_articulo || '',
                item.numero_solicitud || '',
                item.instalacion_municipal || '',
                item.area_mantenimiento || '',
                Number(item.cantidad_total || 0).toFixed(2)
            ]);

            autoTable(doc, {
                head: [columnas],
                body: filas,
                startY: 50,
                styles: { fontSize: 7, cellPadding: 2, valign: 'middle', overflow: 'linebreak', cellWidth: 'wrap' },
                headStyles: { fillColor: [63, 81, 181], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                columnStyles: {
                    0: { cellWidth: 22, halign: 'center' },
                    1: { cellWidth: 18, halign: 'center', fontSize: 6 },
                    2: { cellWidth: 70, overflow: 'linebreak' },
                    3: { cellWidth: 20, halign: 'center' },
                    4: { cellWidth: 50, overflow: 'linebreak' },
                    5: { cellWidth: 40, overflow: 'linebreak' },
                    6: { cellWidth: 22, halign: 'right' }
                },
                margin: { left: 15, right: 15 },
                didDrawPage: function (data: any) {
                    doc.setFontSize(8);
                    doc.setTextColor(150);
                    doc.text('Sistema de Gestión de Inventario', data.settings.margin.left, doc.internal.pageSize.height - 10);
                    doc.text('Página ' + doc.internal.getNumberOfPages(), doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
                }
            });

            doc.save(`resumen_salidas_${fechaDesde}_${fechaHasta}.pdf`);
            showFeedback("PDF generado correctamente.", 'success');
        } catch (error: any) {
            console.error('Error al generar PDF:', error);
            showFeedback('Error al generar el PDF: ' + error.message, 'error');
        }
    };

    const generarExcel = () => {
        if (resumen.length === 0) return;

        try {
            const dataToExport = sortedResumen.map(item => ({
                'Fecha': formatDate(item.fecha),
                'Código': item.codigo_articulo,
                'Artículo': item.nombre_articulo,
                'Solicitud': item.numero_solicitud,
                'Instalación': item.instalacion_municipal,
                'Área': item.area_mantenimiento,
                'Cantidad': Number(item.cantidad_total)
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);

            // Adjust column widths
            const wscols = [
                { wch: 12 }, // Fecha
                { wch: 10 }, // Código
                { wch: 40 }, // Artículo
                { wch: 15 }, // Solicitud
                { wch: 30 }, // Instalación
                { wch: 25 }, // Área
                { wch: 10 }  // Cantidad
            ];
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Resumen Salidas");

            XLSX.writeFile(wb, `resumen_salidas_${fechaDesde}_${fechaHasta}.xlsx`);
            showFeedback("Excel generado correctamente.", 'success');
        } catch (error: any) {
            console.error('Error al generar Excel:', error);
            showFeedback('Error al generar el Excel: ' + error.message, 'error');
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-[#0f1419] text-slate-200 font-sans relative">
            <style>{`
                .glass {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                .glass-dark {
                    background: rgba(0, 0, 0, 0.25);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .glass-button {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(15px);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    transition: all 0.3s ease;
                }
                .glass-button:hover {
                    background: rgba(255, 255, 255, 0.15);
                    border-color: rgba(255, 255, 255, 0.3);
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
                }
                .glass-input {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(15px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                }
                .glass-input:focus {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(168, 85, 247, 0.5);
                    outline: none;
                }
                .gradient-text {
                    background: linear-gradient(135deg, #a855f7, #3b82f6, #06b6d4, #10b981);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .status-finalizada {
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1));
                    border: 1px solid rgba(34, 197, 94, 0.4);
                    color: #4ade80;
                }
                .status-pendiente {
                    background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1));
                    border: 1px solid rgba(251, 191, 36, 0.4);
                    color: #fbbf24;
                }
                .table-glass th {
                    background: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.2));
                    color: rgba(255, 255, 255, 0.95);
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .table-glass th:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                .table-glass tbody tr:hover {
                    background: rgba(255, 255, 255, 0.08);
                }
                .resumen-glass {
                    background: linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(59, 130, 246, 0.15));
                    border: 1px solid rgba(168, 85, 247, 0.3);
                    backdrop-filter: blur(15px);
                }
                .tab-button.active {
                    background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(59, 130, 246, 0.25));
                    border-color: rgba(168, 85, 247, 0.4);
                    box-shadow: 0 0 30px rgba(168, 85, 247, 0.2);
                }
                .feedback-toast {
                    animation: slideIn 0.3s ease-out forwards;
                }
                @keyframes slideIn {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>

            {/* Feedback Toast */}
            {feedback && (
                <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 feedback-toast">
                    <div className={`glass px-6 py-4 rounded-xl shadow-2xl border flex items-center space-x-3 ${feedback.type === 'success' ? 'border-green-500/30 bg-green-500/10' :
                        feedback.type === 'error' ? 'border-red-500/30 bg-red-500/10' :
                            'border-blue-500/30 bg-blue-500/10'
                        }`}>
                        {feedback.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                        {feedback.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                        {feedback.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
                        <span className="text-white font-medium">{feedback.message}</span>
                        <button onClick={() => setFeedback(null)} className="ml-2 text-white/50 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="sticky top-0 z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 mb-8 bg-[#0f1419]/90 backdrop-blur-xl -mx-4 px-4 md:-mx-8 md:px-8 -mt-8 border-b border-white/5 shadow-lg shadow-black/20 transition-all">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-600/20 border border-white/20 flex items-center justify-center">
                        <Database className="w-6 h-6 text-white/90" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold gradient-text">
                            Consulta de Salidas
                        </h1>
                    </div>
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="glass-button flex items-center gap-2 px-4 py-2 text-white/80 hover:text-white rounded-xl transition-all shadow-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Regresar
                </button>
            </div>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Control Panel */}
                <div className="glass rounded-2xl shadow-2xl border border-white/10 p-8 mb-10">
                    {/* Tabs */}
                    <div className="flex items-center justify-center mb-8">
                        <div className="glass-dark rounded-xl p-2 flex space-x-2 border border-white/10 overflow-x-auto">
                            <button
                                onClick={() => { setActiveTab('solicitud'); setHasSearched(false); }}
                                className={`tab-button glass-button px-6 py-3 text-white font-medium rounded-lg flex items-center space-x-2 transition-all duration-300 min-w-[180px] justify-center ${activeTab === 'solicitud' ? 'active' : ''}`}
                            >
                                <FileText className="w-4 h-4" />
                                <span>Consulta por Solicitud</span>
                            </button>
                            <button
                                onClick={() => { setActiveTab('fecha'); setHasSearched(false); }}
                                className={`tab-button glass-button px-6 py-3 text-white font-medium rounded-lg flex items-center space-x-2 transition-all duration-300 min-w-[140px] justify-center ${activeTab === 'fecha' ? 'active' : ''}`}
                            >
                                <Calendar className="w-4 h-4" />
                                <span>Resumen Diario</span>
                            </button>
                        </div>
                    </div>

                    {/* Solicitud Form */}
                    {activeTab === 'solicitud' && (
                        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-semibold text-white/90 mb-2">Búsqueda por Número de Solicitud</h3>
                                <p className="text-sm text-white/60">Ingresa el número de solicitud para ver todas las salidas asociadas</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 items-end">
                                <div className="flex-1 w-full">
                                    <label className="block text-sm font-semibold text-white/90 mb-3">
                                        Número de Solicitud
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 2025-000123"
                                        value={solicitudInput}
                                        onChange={(e) => setSolicitudInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleBuscarSolicitud()}
                                        className="glass-input w-full rounded-xl px-5 py-4 text-white placeholder-white/50 focus:outline-none transition-all duration-300 text-lg font-medium border border-white/20 focus:border-purple-400/50"
                                    />
                                </div>
                                <button
                                    onClick={handleBuscarSolicitud}
                                    disabled={loading}
                                    className="glass-button px-8 py-4 text-white font-bold rounded-xl focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-3 border border-white/20 hover:border-white/40 hover:scale-105 shadow-lg w-full sm:w-auto justify-center"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                    <span>Buscar Salidas</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Fecha Form */}
                    {activeTab === 'fecha' && (
                        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-semibold text-white/90 mb-2">Resumen Diario de Salidas</h3>
                                <p className="text-sm text-white/60">Selecciona un rango de fechas para generar el resumen diario</p>
                            </div>

                            {/* Quick Filters */}
                            <div className="flex justify-center mb-6 space-x-2">
                                <button onClick={() => applyQuickFilter('today')} className="glass-button px-3 py-1.5 text-xs text-white/80 hover:text-white rounded-lg flex items-center space-x-1">
                                    <CalendarCheck className="w-3 h-3" /> <span>Hoy</span>
                                </button>
                                <button onClick={() => applyQuickFilter('week')} className="glass-button px-3 py-1.5 text-xs text-white/80 hover:text-white rounded-lg flex items-center space-x-1">
                                    <CalendarDays className="w-3 h-3" /> <span>Esta Semana</span>
                                </button>
                                <button onClick={() => applyQuickFilter('month')} className="glass-button px-3 py-1.5 text-xs text-white/80 hover:text-white rounded-lg flex items-center space-x-1">
                                    <Calendar className="w-3 h-3" /> <span>Este Mes</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-semibold text-white/90 mb-3">
                                        <CalendarDays className="w-4 h-4 inline mr-2" />
                                        Fecha Desde
                                    </label>
                                    <input
                                        type="date"
                                        value={fechaDesde}
                                        onChange={(e) => setFechaDesde(e.target.value)}
                                        className="glass-input w-full rounded-xl px-4 py-4 text-white focus:outline-none transition-all duration-300 border border-white/20 focus:border-purple-400/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-white/90 mb-3">
                                        <CalendarCheck className="w-4 h-4 inline mr-2" />
                                        Fecha Hasta
                                    </label>
                                    <input
                                        type="date"
                                        value={fechaHasta}
                                        onChange={(e) => setFechaHasta(e.target.value)}
                                        className="glass-input w-full rounded-xl px-4 py-4 text-white focus:outline-none transition-all duration-300 border border-white/20 focus:border-purple-400/50"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <div className="flex space-x-3">
                                        <button
                                            onClick={handleBuscarResumen}
                                            disabled={loading}
                                            className="glass-button px-6 py-4 text-white font-bold rounded-xl focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2 flex-1 border border-white/20 hover:border-white/40 hover:scale-105 shadow-lg justify-center"
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarSearch className="w-5 h-5" />}
                                            <span>Consultar</span>
                                        </button>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={generarPDF}
                                                disabled={resumen.length === 0}
                                                className="glass-button px-4 py-4 text-white font-bold rounded-xl focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center border border-white/20 hover:border-white/40 hover:scale-105 shadow-lg"
                                                title="Exportar PDF"
                                            >
                                                <Download className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={generarExcel}
                                                disabled={resumen.length === 0}
                                                className="glass-button px-4 py-4 text-white font-bold rounded-xl focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center border border-white/20 hover:border-green-400/40 hover:scale-105 shadow-lg"
                                                title="Exportar Excel"
                                            >
                                                <FileSpreadsheet className="w-5 h-5 text-green-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Area */}
                {loading && (
                    <div className="glass rounded-xl shadow-xl border border-white/20 p-8 text-center animate-in fade-in">
                        <div className="inline-flex items-center space-x-3">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                            <span className="text-white/80 font-medium">Cargando datos...</span>
                        </div>
                    </div>
                )}

                {!loading && hasSearched && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                        {/* Summary Banner */}
                        {(salidas.length > 0 || resumen.length > 0) && (
                            <div className="resumen-glass rounded-lg p-4 mb-6 flex items-center space-x-2">
                                <Info className="w-5 h-5 text-purple-300" />
                                <span className="text-white font-medium">
                                    {activeTab === 'solicitud'
                                        ? `Se encontraron ${salidas.length} salida${salidas.length !== 1 ? 's' : ''} (${salidas.filter(s => s.finalizada).length} finalizadas) - Total: ${formatearMoneda(salidas.reduce((sum, s) => sum + calcularTotalSalida(s), 0))}`
                                        : `${resumen.length} registros encontrados en ${new Set(resumen.map(r => r.fecha)).size} días - Cantidad total: ${resumen.reduce((sum, r) => sum + Number(r.cantidad_total || 0), 0).toFixed(2)}`
                                    }
                                </span>
                            </div>
                        )}

                        {/* Empty State */}
                        {((activeTab === 'solicitud' && salidas.length === 0) || (activeTab === 'fecha' && resumen.length === 0)) && (
                            <div className="glass rounded-xl shadow-xl border border-white/20 p-12 text-center">
                                <FileX className="w-12 h-12 text-white/40 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-white mb-2">No se encontraron resultados</h3>
                                <p className="text-white/60">No hay datos para los criterios de búsqueda especificados.</p>
                            </div>
                        )}

                        {/* Solicitud Results */}
                        {activeTab === 'solicitud' && salidas.length > 0 && (
                            <div className="space-y-4">
                                {salidas.map((salida) => {
                                    const totalSalida = calcularTotalSalida(salida);
                                    const isExpanded = expandedSalidas.includes(salida.id_salida);

                                    return (
                                        <div key={salida.id_salida} className="glass rounded-xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-[1.01]">
                                            <div className="p-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="flex items-center space-x-2">
                                                            <Package className="w-5 h-5 text-white/70" />
                                                            <h3 className="text-lg font-semibold text-white">Salida #{salida.id_salida}</h3>
                                                        </div>
                                                        {salida.finalizada ? (
                                                            <span className="status-finalizada inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border">
                                                                <CheckCircle className="w-3 h-3 mr-1" /> Finalizada
                                                            </span>
                                                        ) : (
                                                            <span className="status-pendiente inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border">
                                                                <Clock className="w-3 h-3 mr-1" /> Pendiente
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => toggleSalidaDetails(salida.id_salida)}
                                                        className="glass-button px-3 py-1 text-sm text-white/80 hover:text-white font-medium flex items-center space-x-1 rounded-lg"
                                                    >
                                                        <span>{isExpanded ? 'Ocultar detalles' : 'Ver detalles'}</span>
                                                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                    <div className="flex items-center space-x-2 text-sm text-white/70">
                                                        <Calendar className="w-4 h-4" />
                                                        <span>{formatDate(salida.fecha_salida)}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2 text-sm text-white/70">
                                                        <Hash className="w-4 h-4" />
                                                        <span>{salida.dato_salida_13?.length || 0} artículos</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                                                        <Banknote className="w-4 h-4" />
                                                        <span>{formatearMoneda(totalSalida)}</span>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="border-t border-white/20 pt-4 animate-in fade-in slide-in-from-top-2">
                                                        <div className="overflow-x-auto">
                                                            <table className="table-glass w-full text-sm rounded-lg overflow-hidden">
                                                                <thead>
                                                                    <tr className="border-b border-white/20">
                                                                        <th className="px-4 py-3 text-left font-medium">Código</th>
                                                                        <th className="px-4 py-3 text-left font-medium">Artículo</th>
                                                                        <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                                                                        <th className="px-4 py-3 text-right font-medium">Subtotal</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {salida.dato_salida_13?.map((item, idx) => (
                                                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                                                            <td className="px-4 py-2 font-mono text-xs text-white/70">{item.articulo}</td>
                                                                            <td className="px-4 py-2 text-white/90">{item.articulo_01?.nombre_articulo}</td>
                                                                            <td className="px-4 py-2 text-right text-white/90">{item.cantidad}</td>
                                                                            <td className="px-4 py-2 text-right text-white/90">{formatearMoneda(item.subtotal)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot>
                                                                    <tr>
                                                                        <td colSpan={3} className="px-4 py-3 text-right font-semibold text-white">Total:</td>
                                                                        <td className="px-4 py-3 text-right font-bold text-lg text-white">{formatearMoneda(totalSalida)}</td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Resumen Results */}
                        {activeTab === 'fecha' && resumen.length > 0 && (
                            <div className="glass rounded-xl shadow-xl border border-white/20 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold gradient-text">Resumen Diario de Salidas</h2>
                                    <div className="flex items-center space-x-4">
                                        <div className="flex items-center space-x-2 text-sm text-white/70 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                                            <Filter className="w-4 h-4" />
                                            <span>Ordenado por: {sortConfig ? `${sortConfig.key} (${sortConfig.direction === 'asc' ? 'Asc' : 'Desc'})` : 'Defecto'}</span>
                                        </div>
                                        <div className="flex items-center space-x-2 text-sm text-white/70">
                                            <CalendarDays className="w-4 h-4" />
                                            <span>{new Set(resumen.map(r => r.fecha)).size} días</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="table-glass w-full text-sm rounded-lg overflow-hidden">
                                        <thead>
                                            <tr className="border-b border-white/20">
                                                {[
                                                    { key: 'fecha', label: 'Fecha' },
                                                    { key: 'codigo_articulo', label: 'Código' },
                                                    { key: 'nombre_articulo', label: 'Artículo' },
                                                    { key: 'numero_solicitud', label: 'Solicitud' },
                                                    { key: 'instalacion_municipal', label: 'Instalación' },
                                                    { key: 'area_mantenimiento', label: 'Área' },
                                                    { key: 'cantidad_total', label: 'Cantidad', align: 'right' }
                                                ].map((col) => (
                                                    <th
                                                        key={col.key}
                                                        onClick={() => handleSort(col.key as keyof ResumenDiario)}
                                                        className={`px-4 py-3 font-medium select-none group ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                                                    >
                                                        <div className={`flex items-center space-x-1 ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                                                            <span>{col.label}</span>
                                                            <div className="text-white/30 group-hover:text-white/70 transition-colors">
                                                                {sortConfig?.key === col.key ? (
                                                                    sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                                ) : (
                                                                    <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {sortedResumen.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-white/5 transition-colors duration-200">
                                                    <td className="px-4 py-3 text-white/80 font-medium">
                                                        {formatDate(item.fecha)}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs text-white/80">{item.codigo_articulo}</td>
                                                    <td className="px-4 py-3 text-white whitespace-normal break-words" title={item.nombre_articulo}>
                                                        {item.nombre_articulo}
                                                    </td>
                                                    <td className="px-4 py-3 text-white/80">{item.numero_solicitud}</td>
                                                    <td className="px-4 py-3 text-white/80 whitespace-normal break-words" title={item.instalacion_municipal}>
                                                        {item.instalacion_municipal || 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-3 text-white/80 whitespace-normal break-words" title={item.area_mantenimiento}>
                                                        {item.area_mantenimiento}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-white">{Number(item.cantidad_total).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
