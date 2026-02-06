import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
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
    CheckCircle2,
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
    Filter,
    FileSearch,
    CheckCircle
} from 'lucide-react';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

// Interfaces
interface Salida {
    id_salida: number;
    fecha_salida: string;
    finalizada: boolean;
    numero_solicitud: string;
    retira: string;
    autoriza: string;
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
    costo_unitario: number;
    total_costo: number;
    instalacion_municipal?: string;
}

type SortConfig = {
    key: keyof ResumenDiario;
    direction: 'asc' | 'desc';
} | null;

export default function ConsultarSalidas() {
    const navigate = useNavigate();

    // State
    const [activeTab, setActiveTab] = useState<'solicitud' | 'fecha' | 'id_salida'>('solicitud');
    const [solicitudInput, setSolicitudInput] = useState('');
    const [idSalidaInput, setIdSalidaInput] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [colaboradores, setColaboradores] = useState<Record<string, string>>({});

    const [loading, setLoading] = useState(false);
    const [salidas, setSalidas] = useState<Salida[]>([]);
    const [resumen, setResumen] = useState<ResumenDiario[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [expandedSalidas, setExpandedSalidas] = useState<number[]>([]);

    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null);

    // Initialize dates
    useEffect(() => {
        const hoy = new Date();
        const hasta = format(hoy, 'yyyy-MM-dd');
        const desde = format(startOfMonth(hoy), 'yyyy-MM-dd');
        setFechaDesde(desde);
        setFechaHasta(hasta);
    }, []);

    const resetSearchState = () => {
        setSolicitudInput('');
        setIdSalidaInput('');
        setSalidas([]);
        setResumen([]);
        setHasSearched(false);
        setExpandedSalidas([]);
        setStatusMessage(null);
    };

    // Reset on unmount
    useEffect(() => {
        return () => {
            resetSearchState();
        };
    }, []);

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
                start = startOfWeek(hoy, { weekStartsOn: 1 });
                end = endOfWeek(hoy, { weekStartsOn: 1 });
                break;
            case 'month':
                start = startOfMonth(hoy);
                end = endOfMonth(hoy);
                break;
        }

        setFechaDesde(format(start, 'yyyy-MM-dd'));
        setFechaHasta(format(end, 'yyyy-MM-dd'));
        setStatusMessage({ type: 'info', message: `Rango ajustado: ${type === 'today' ? 'Hoy' : type === 'week' ? 'Esta Semana' : 'Este Mes'}` });
        setTimeout(() => setStatusMessage(null), 3000);
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
            const key = sortConfig.key;
            const valA = a[key] ?? '';
            const valB = b[key] ?? '';
            if (valA < valB) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });

    }, [resumen, sortConfig]);

    // Data Fetching
    const handleBuscarSolicitud = async () => {
        if (!solicitudInput.trim()) {
            setStatusMessage({ type: 'error', message: "Ingrese un número de solicitud." });
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setSalidas([]);
        setStatusMessage(null);

        try {
            const { data, error } = await supabase
                .from("salida_articulo_08")
                .select(`
                    id_salida,
                    fecha_salida,
                    finalizada,
                    numero_solicitud,
                    retira,
                    autoriza,
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
            const fetchedSalidas = data as any[] || [];
            setSalidas(fetchedSalidas);

            // Resolve names
            if (fetchedSalidas.length > 0) {
                const idsUnicos = [...new Set([
                    ...fetchedSalidas.map(s => s.autoriza),
                    ...fetchedSalidas.map(s => s.retira)
                ].filter(Boolean))];

                if (idsUnicos.length > 0) {
                    const { data: cols } = await supabase
                        .from('colaboradores_06')
                        .select('identificacion, alias')
                        .in('identificacion', idsUnicos);

                    if (cols) {
                        const map = cols.reduce((acc, curr) => {
                            acc[curr.identificacion] = curr.alias;
                            return acc;
                        }, {} as Record<string, string>);
                        setColaboradores(prev => ({ ...prev, ...map }));
                    }
                }
            }

            if (!data || data.length === 0) {
                setStatusMessage({ type: 'info', message: "No se encontraron resultados." });
            } else {
                setStatusMessage({ type: 'success', message: `Localizadas ${data.length} salidas.` });
            }
        } catch (error: any) {
            console.error("Error al obtener salidas:", error);
            setStatusMessage({ type: 'error', message: "Error: " + error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleBuscarSalidaId = async () => {
        if (!idSalidaInput.trim()) {
            setStatusMessage({ type: 'error', message: "Ingrese un ID de salida." });
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setSalidas([]);
        setStatusMessage(null);

        try {
            const { data, error } = await supabase
                .from("salida_articulo_08")
                .select(`
                    id_salida,
                    fecha_salida,
                    finalizada,
                    numero_solicitud,
                    retira,
                    autoriza,
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
                .eq("id_salida", idSalidaInput.trim());

            if (error) throw error;
            const fetchedSalidas = data as any[] || [];
            setSalidas(fetchedSalidas);

            // Resolve names
            if (fetchedSalidas.length > 0) {
                const idsUnicos = [...new Set([
                    ...fetchedSalidas.map(s => s.autoriza),
                    ...fetchedSalidas.map(s => s.retira)
                ].filter(Boolean))];

                if (idsUnicos.length > 0) {
                    const { data: cols } = await supabase
                        .from('colaboradores_06')
                        .select('identificacion, alias')
                        .in('identificacion', idsUnicos);

                    if (cols) {
                        const map = cols.reduce((acc, curr) => {
                            acc[curr.identificacion] = curr.alias;
                            return acc;
                        }, {} as Record<string, string>);
                        setColaboradores(prev => ({ ...prev, ...map }));
                    }
                }
            }

            if (!data || data.length === 0) {
                setStatusMessage({ type: 'info', message: "No se encontró la salida." });
            } else {
                setStatusMessage({ type: 'success', message: `Salida # ${idSalidaInput} localizada.` });
                setExpandedSalidas([Number(idSalidaInput)]);
            }
        } catch (error: any) {
            console.error("Error al obtener salida por ID:", error);
            setStatusMessage({ type: 'error', message: "Error: " + error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleBuscarResumen = async () => {
        if (!fechaDesde || !fechaHasta) {
            setStatusMessage({ type: 'error', message: "Seleccione el rango de fechas." });
            return;
        }

        if (new Date(fechaDesde) > new Date(fechaHasta)) {
            setStatusMessage({ type: 'error', message: "Rango de fechas inválido." });
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setResumen([]);
        setStatusMessage(null);

        try {
            let allData: any[] = [];
            let hasMore = true;
            let offset = 0;
            const BATCH_SIZE = 1000;
            let totalCount = 0;

            console.log('Consultando resumen diario...');

            while (hasMore) {
                const { data, error, count } = await supabase
                    .from("vw_resumen_diario_salida")
                    .select("*", { count: 'exact' })
                    .gte("fecha", fechaDesde)
                    .lte("fecha", fechaHasta)
                    .range(offset, offset + BATCH_SIZE - 1)
                    .order("fecha", { ascending: true })
                    .order("codigo_articulo", { ascending: true });

                if (error) throw error;

                if (offset === 0 && count !== null) {
                    totalCount = count;
                    console.log('Total detectado por Supabase (Resumen):', totalCount);
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += data.length;
                    hasMore = data.length === BATCH_SIZE;
                    console.log(`Lote cargado: ${allData.length} registros.`);
                    if (offset >= 50000) break;
                } else {
                    hasMore = false;
                }
            }

            let finalData = allData;

            if (finalData.length > 0) {
                const solicitudes = [...new Set(finalData.map(d => d.numero_solicitud).filter(Boolean))];

                if (solicitudes.length > 0) {
                    // Fetch installations in batches too if there are many unique solicitudes
                    const uniqueSolBatchSize = 100;
                    const instMap = new Map();

                    for (let i = 0; i < solicitudes.length; i += uniqueSolBatchSize) {
                        const batch = solicitudes.slice(i, i + uniqueSolBatchSize);
                        const { data: instData, error: instError } = await supabase
                            .from('solicitud_17')
                            .select('numero_solicitud, instalaciones_municipales_16(instalacion_municipal)')
                            .in('numero_solicitud', batch);

                        if (!instError && instData) {
                            instData.forEach((s: any) => {
                                instMap.set(s.numero_solicitud, s.instalaciones_municipales_16?.instalacion_municipal || 'N/A');
                            });
                        }
                    }

                    finalData = finalData.map(item => ({
                        ...item,
                        instalacion_municipal: instMap.get(item.numero_solicitud) || 'N/A'
                    }));
                }
            }

            setResumen(finalData);

            if (!finalData || finalData.length === 0) {
                setStatusMessage({ type: 'info', message: "Sin movimientos en este período." });
            } else {
                setStatusMessage({
                    type: 'success',
                    message: `${finalData.length} registros cargados${totalCount > 1000 ? ` de ${totalCount}` : ''}.`
                });
            }
        } catch (error: any) {
            console.error("Error al obtener resumen diario:", error);
            setStatusMessage({ type: 'error', message: "Error al cargar: " + error.message });
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
            doc.text('Resumen Diario de Salidas', 20, 20);
            doc.setFontSize(10);
            doc.text(`Período: ${format(new Date(fechaDesde), 'dd/MM/yyyy')} - ${format(new Date(fechaHasta), 'dd/MM/yyyy')}`, 20, 30);

            const columnas = ['Fecha', 'Código', 'Artículo', 'Solicitud', 'Instalación', 'Área', 'Cant.', 'Costo U.', 'Total'];
            const filas = sortedResumen.map(item => [
                formatDate(item.fecha),
                item.codigo_articulo || '',
                item.nombre_articulo || '',
                item.numero_solicitud || '',
                item.instalacion_municipal || '',
                item.area_mantenimiento || '',
                Number(item.cantidad_total || 0).toFixed(2),
                formatearMoneda(item.costo_unitario || 0).replace('₡', 'CRC '),
                formatearMoneda(item.total_costo || 0).replace('₡', 'CRC ')
            ]);

            autoTable(doc, {
                head: [columnas],
                body: filas,
                startY: 50,
                styles: { fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [0, 113, 227], textColor: 255, fontStyle: 'bold' }, // Apple Blue accent
                alternateRowStyles: { fillColor: [18, 18, 18] },
            });

            doc.save(`resumen_salidas_${fechaDesde}_${fechaHasta}.pdf`);
            setStatusMessage({ type: 'success', message: 'PDF generado.' });
        } catch (error: any) {
            setStatusMessage({ type: 'error', message: 'Fallo al generar PDF.' });
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
                'Cantidad': Number(item.cantidad_total),
                'Costo Unitario': Number(item.costo_unitario),
                'Total': Number(item.total_costo)
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Resumen Salidas");
            XLSX.writeFile(wb, `resumen_salidas_${fechaDesde}_${fechaHasta}.xlsx`);
            setStatusMessage({ type: 'success', message: 'Excel generado.' });
        } catch (error: any) {
            setStatusMessage({ type: 'error', message: 'Fallo al generar Excel.' });
        }
    };

    return (
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] p-4 md:p-8 relative overflow-hidden">
            <div className="max-w-7xl mx-auto space-y-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-[#333333]">
                    <div className="space-y-1">
                        <PageHeader title="Historial de Salidas" icon={FileSearch} themeColor="blue" />
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 bg-transparent border border-[#333333] rounded-[8px] text-xs font-black uppercase tracking-widest flex items-center gap-2 text-[#F5F5F7] transition-all hover:bg-white/5"
                    >
                        <ArrowLeft className="w-4 h-4 text-[#0071E3]" />
                        Regresar
                    </button>
                </div>

                {/* Status Float Messages */}
                {statusMessage && (
                    <div className={cn(
                        "fixed top-8 right-8 z-[100] px-6 py-4 rounded-[8px] bg-[#121212] border border-[#333333] shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-4",
                        statusMessage.type === 'error' ? 'border-rose-500/50 text-rose-400' : 'border-[#0071E3]/50 text-white'
                    )}>
                        <div className="p-2 rounded-[4px] bg-white/5 shrink-0">
                            {statusMessage.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400" /> :
                                statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-[#0071E3]" /> :
                                    <Info className="w-5 h-5 text-[#0071E3]" />}
                        </div>
                        <span className="font-black uppercase tracking-widest text-[10px] leading-relaxed">{statusMessage.message}</span>
                        <button onClick={() => setStatusMessage(null)} className="ml-auto p-1 hover:bg-white/5 rounded-[4px] transition-colors">
                            <X className="w-4 h-4 text-[#86868B]" />
                        </button>
                    </div>
                )}

                {/* Filter Panel */}
                <div className="bg-[#121212] p-8 border border-[#333333] rounded-3xl relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#0071E3]/5 rounded-full blur-3xl -mr-16 -mt-16" />

                    {/* Tabs Selector */}
                    <div className="flex justify-center mb-10">
                        <div className="bg-[#1D1D1F] p-1.5 rounded-2xl border border-[#333333] flex gap-2 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => { setActiveTab('solicitud'); resetSearchState(); }}
                                className={`px-6 md:px-8 py-3 rounded-[6px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 whitespace-nowrap
                                     ${activeTab === 'solicitud' ? 'bg-[#0071E3] text-white shadow-lg shadow-[#0071E3]/20' : 'text-[#86868B] hover:text-[#F5F5F7]'}`}
                            >
                                <FileText className="w-4 h-4" />
                                Consulta por Solicitud
                            </button>
                            <button
                                onClick={() => { setActiveTab('id_salida'); resetSearchState(); }}
                                className={`px-6 md:px-8 py-3 rounded-[6px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 whitespace-nowrap
                                     ${activeTab === 'id_salida' ? 'bg-[#0071E3] text-white shadow-lg shadow-[#0071E3]/20' : 'text-[#86868B] hover:text-[#F5F5F7]'}`}
                            >
                                <Hash className="w-4 h-4" />
                                Consulta por Salida
                            </button>
                            <button
                                onClick={() => { setActiveTab('fecha'); resetSearchState(); }}
                                className={`px-6 md:px-8 py-3 rounded-[6px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 whitespace-nowrap
                                     ${activeTab === 'fecha' ? 'bg-[#0071E3] text-white shadow-lg shadow-[#0071E3]/20' : 'text-[#86868B] hover:text-[#F5F5F7]'}`}
                            >
                                <Calendar className="w-4 h-4" />
                                Resumen Diario
                            </button>
                        </div>
                    </div>

                    {/* Form: Por Solicitud */}
                    {activeTab === 'solicitud' && (
                        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="text-center space-y-2 mb-8">
                                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Búsqueda por # Solicitud</h3>
                                <p className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">Ingrese el identificador único para desplegar el desglose de materiales.</p>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 relative group/input">
                                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[#333333] group-focus-within/input:text-[#0071E3] transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Número de Solicitud (Ej: 2025-000123)"
                                        value={solicitudInput}
                                        onChange={(e) => setSolicitudInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleBuscarSolicitud()}
                                        className="w-full h-16 bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-16 pr-6 text-xl text-white font-bold placeholder-[#333333] focus:outline-none focus:border-[#0071E3]/50 transition-all shadow-inner uppercase"
                                    />
                                </div>
                                <button
                                    onClick={handleBuscarSolicitud}
                                    disabled={loading}
                                    className="h-16 px-10 bg-[#0071E3] hover:bg-[#0077ED] text-white font-black uppercase tracking-widest text-xs rounded-[8px] shadow-xl shadow-[#0071E3]/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarSearch className="w-5 h-5" />}
                                    Consultar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Form: Por ID Salida */}
                    {activeTab === 'id_salida' && (
                        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="text-center space-y-2 mb-8">
                                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Búsqueda por # de Salida</h3>
                                <p className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">Ingrese el número de salida directo para una consulta inmediata.</p>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 relative group/input">
                                    <Hash className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[#333333] group-focus-within/input:text-[#0071E3] transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Número de Salida (Ej: 9657)"
                                        value={idSalidaInput}
                                        onChange={(e) => setIdSalidaInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleBuscarSalidaId()}
                                        className="w-full h-16 bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-16 pr-6 text-xl text-white font-bold placeholder-[#333333] focus:outline-none focus:border-[#0071E3]/50 transition-all shadow-inner"
                                    />
                                </div>
                                <button
                                    onClick={handleBuscarSalidaId}
                                    disabled={loading}
                                    className="h-16 px-10 bg-[#0071E3] hover:bg-[#0077ED] text-white font-black uppercase tracking-widest text-xs rounded-[8px] shadow-xl shadow-[#0071E3]/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                    Consultar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Form: Por Fecha / Resumen */}
                    {activeTab === 'fecha' && (
                        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
                            <div className="text-center space-y-2 mb-6">
                                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Resumen Cronológico</h3>
                                <p className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">Generación masiva de consumos agrupados por artículo y ubicación.</p>
                            </div>

                            {/* Quick Filters */}
                            <div className="flex justify-center gap-3">
                                {['today', 'week', 'month'].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => applyQuickFilter(f as any)}
                                        className="px-4 py-2 bg-transparent border border-[#333333] text-[9px] font-black uppercase tracking-widest text-[#86868B] hover:text-[#0071E3] hover:border-[#0071E3]/30 transition-all flex items-center gap-2 rounded-[8px]"
                                    >
                                        <Clock className="w-3 h-3" />
                                        {f === 'today' ? 'Hoy' : f === 'week' ? 'Esta Semana' : 'Este Mes'}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end bg-black/20 p-8 rounded-[8px] border border-[#333333] shadow-inner">
                                <div className="md:col-span-4">
                                    <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Fecha Inicial</label>
                                    <div className="relative group/date">
                                        <CalendarDays className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#333333] group-focus-within/date:text-[#0071E3] transition-colors pointer-events-none" />
                                        <input
                                            type="date"
                                            value={fechaDesde}
                                            onChange={(e) => setFechaDesde(e.target.value)}
                                            className="w-full h-14 bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-14 pr-4 font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 transition-all [color-scheme:dark]"
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-4">
                                    <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Fecha Final</label>
                                    <div className="relative group/date">
                                        <CalendarCheck className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#333333] group-focus-within/date:text-[#0071E3] transition-colors pointer-events-none" />
                                        <input
                                            type="date"
                                            value={fechaHasta}
                                            onChange={(e) => setFechaHasta(e.target.value)}
                                            className="w-full h-14 bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-14 pr-4 font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 transition-all [color-scheme:dark]"
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-4 flex gap-3">
                                    <button
                                        onClick={handleBuscarResumen}
                                        disabled={loading}
                                        className="flex-1 h-14 bg-[#0071E3] hover:bg-[#0077ED] text-white font-black uppercase tracking-widest text-xs rounded-[8px] shadow-xl shadow-[#0071E3]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                        Consultar
                                    </button>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={generarPDF}
                                            disabled={resumen.length === 0}
                                            className="w-14 h-14 bg-transparent border border-[#333333] rounded-[8px] flex items-center justify-center text-[#86868B] hover:text-[#0071E3] hover:border-[#0071E3]/30 transition-all disabled:opacity-20"
                                            title="Generar PDF"
                                        >
                                            <Download className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={generarExcel}
                                            disabled={resumen.length === 0}
                                            className="w-14 h-14 bg-transparent border border-[#333333] rounded-[8px] flex items-center justify-center text-[#86868B] hover:text-[#0071E3] hover:border-[#0071E3]/30 transition-all disabled:opacity-20"
                                            title="Exportar Excel"
                                        >
                                            <FileSpreadsheet className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Area */}
                {!hasSearched ? (
                    <div className="py-40 flex flex-col items-center justify-center text-center group animate-in fade-in zoom-in duration-700">
                        <div className="relative mb-10">
                            <div className="absolute inset-0 bg-[#0071E3]/5 rounded-full blur-3xl scale-150 group-hover:scale-200 transition-transform duration-1000" />
                            <div className="w-32 h-32 bg-[#121212] border border-[#333333] rounded-[8px] flex items-center justify-center relative z-10 group-hover:rotate-6 transition-all duration-700">
                                <FileSearch className="w-16 h-16 text-[#333333]" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-[#F5F5F7] uppercase italic tracking-tighter opacity-20">Sin Datos Consultados</h3>
                        <p className="text-[#86868B] mt-3 max-w-sm mx-auto font-medium text-sm leading-relaxed tracking-wide">
                            Seleccione el método de búsqueda y aplique los filtros necesarios para desplegar el historial de movimientos.
                        </p>
                    </div>
                ) : loading ? (
                    <div className="py-40 flex flex-col items-center justify-center space-y-6">
                        <Loader2 className="w-16 h-16 animate-spin text-[#0071E3]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#86868B] animate-pulse">Recuperando registros del servidor...</p>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-700">
                        {/* Summary Stats Banner */}
                        {(salidas.length > 0 || resumen.length > 0) && (
                            <div className="bg-[#121212] p-6 border border-[#333333] border-l-4 border-l-[#0071E3] rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-[#0071E3]/[0.03] to-transparent pointer-events-none" />
                                <div className="flex items-center gap-6">
                                    <div className="p-4 rounded-[8px] bg-[#1D1D1F] border border-[#333333]">
                                        <Info className="w-6 h-6 text-[#0071E3]" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-black text-[#86868B] uppercase tracking-widest leading-none">Resultados de la Búsqueda</h4>
                                        <p className="text-lg font-black text-white italic truncate uppercase">
                                            {activeTab === 'solicitud'
                                                ? `${salidas.length} Salidas Localizadas • Solicitud: ${solicitudInput}`
                                                : activeTab === 'id_salida'
                                                    ? `Salida # ${idSalidaInput} Localizada`
                                                    : `${resumen.length} Movimientos Registrados • ${new Set(resumen.map(r => r.fecha)).size} Días`
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Empty results */}
                        {((activeTab === 'solicitud' && salidas.length === 0) || (activeTab === 'id_salida' && salidas.length === 0) || (activeTab === 'fecha' && resumen.length === 0)) && (
                            <div className="py-40 flex flex-col items-center justify-center text-center bg-[#121212] border border-[#333333] rounded-[8px]">
                                <FileX className="w-16 h-16 text-[#333333] mb-6" />
                                <h3 className="text-xl font-bold text-[#86868B] uppercase tracking-widest">No hay registros</h3>
                                <p className="text-[#333333] mt-2 font-black uppercase text-[10px]">No se localizó información que cumpla con los criterios especificados.</p>
                            </div>
                        )}

                        {/* Results: Solicitud Cards */}
                        {(activeTab === 'solicitud' || activeTab === 'id_salida') && salidas.length > 0 && (
                            <div className="grid grid-cols-1 gap-6">
                                {salidas.map((salida) => {
                                    const totalSalida = calcularTotalSalida(salida);

                                    return (
                                        <div key={salida.id_salida} className="bg-[#121212] border border-[#333333] rounded-3xl overflow-hidden border-[#0071E3]/30 shadow-2xl">
                                            {/* Header Card */}
                                            <div className="p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-16 h-16 rounded-[4px] bg-[#1D1D1F] border border-[#333333] flex items-center justify-center text-[#333333] group-hover:text-[#0071E3] transition-colors">
                                                        <Package className="w-8 h-8" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest leading-none">ID Salida</span>
                                                            {salida.finalizada ? (
                                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0071E3]/10 border border-[#0071E3]/20 rounded-[4px]">
                                                                    <CheckCircle className="w-3 h-3 text-[#0071E3]" />
                                                                    <span className="text-[8px] font-black text-[#0071E3] uppercase tracking-widest">Finalizada</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-[4px]">
                                                                    <Clock className="w-3 h-3 text-rose-500" />
                                                                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Pendiente</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <h4 className="text-2xl font-black text-white italic tracking-tighter uppercase"># {salida.id_salida}</h4>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4 flex-1 lg:ml-12">
                                                    <div>
                                                        <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest block mb-1">Fecha</span>
                                                        <p className="font-bold text-[#F5F5F7] text-sm">{formatDate(salida.fecha_salida)}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest block mb-1">Contenido</span>
                                                        <p className="font-bold text-[#F5F5F7] text-sm">{salida.dato_salida_13?.length || 0} Líneas</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest block mb-1">Solicitud</span>
                                                        <p className="font-bold text-[#F5F5F7] text-sm truncate max-w-[120px]">{salida.numero_solicitud || 'S/N'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest block mb-1 capitalize">Persona que Retira</span>
                                                        <p className="font-black text-white text-sm uppercase italic">{colaboradores[salida.retira] || 'No identificado'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Alway Visible Breakdown */}
                                            <div className="px-8 pb-8 pt-4 bg-black/20 border-t border-[#333333]">
                                                <div className="overflow-x-auto rounded-[8px] border border-[#333333] bg-[#1D1D1F]">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-[#121212] text-white text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#333333]">
                                                                <th className="p-5">Código Art.</th>
                                                                <th className="p-5">Descripción Detallada</th>
                                                                <th className="p-5 text-right">Cantidad</th>
                                                                <th className="p-5 text-right">Subtotal</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-[#333333]">
                                                            {salida.dato_salida_13?.map((item: any, idx: number) => (
                                                                <tr key={idx} className="hover:bg-white/[0.02] transition-colors group h-14">
                                                                    <td className="p-5">
                                                                        <span className="font-mono text-xs font-black text-[#0071E3] group-hover:text-[#0077ED] transition-colors">{item.articulo}</span>
                                                                    </td>
                                                                    <td className="p-5">
                                                                        <p className="text-[#F5F5F7] font-bold text-xs uppercase italic">{item.articulo_01?.nombre_articulo}</p>
                                                                    </td>
                                                                    <td className="p-5 text-right">
                                                                        <span className="text-sm font-black text-white font-mono">{item.cantidad.toLocaleString()}</span>
                                                                    </td>
                                                                    <td className="p-5 text-right">
                                                                        <span className="text-sm font-black text-[#86868B] font-mono">{formatearMoneda(item.subtotal)}</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="bg-[#1D1D1F] border-t border-[#333333]">
                                                                <td colSpan={3} className="p-5 text-right font-black text-[#86868B] uppercase tracking-widest text-[9px]">Monto Total de Salida</td>
                                                                <td className="p-5 text-right">
                                                                    <span className="text-xl font-black text-[#0071E3] italic font-mono">{formatearMoneda(totalSalida)}</span>
                                                                </td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Results: Resumen Table */}
                        {activeTab === 'fecha' && resumen.length > 0 && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-xs font-black text-[#86868B] uppercase tracking-[0.3em] flex items-center gap-3">
                                        <Filter className="w-5 h-5 text-[#0071E3]" />
                                        Matriz de Resumen Consolidada
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">Registros: {resumen.length}</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#333333]" />
                                        <span className="text-[9px] font-black text-[#0071E3] uppercase tracking-widest">
                                            {sortConfig ? `Orden x ${sortConfig.key} (${sortConfig.direction})` : 'Carga Predeterminada'}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-[#121212] border border-[#333333] rounded-3xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-[#1D1D1F] text-white text-[9px] font-black uppercase tracking-[0.2em] border-b border-[#333333]">
                                                    {[
                                                        { key: 'fecha', label: 'Fecha' },
                                                        { key: 'codigo_articulo', label: 'Código' },
                                                        { key: 'nombre_articulo', label: 'Descripción' },
                                                        { key: 'numero_solicitud', label: 'Solicitud' },
                                                        { key: 'instalacion_municipal', label: 'Ubicación' },
                                                        { key: 'area_mantenimiento', label: 'Área' },
                                                        { key: 'cantidad_total', label: 'Cant.', align: 'right' },
                                                        { key: 'costo_unitario', label: 'Costo U.', align: 'right' },
                                                        { key: 'total_costo', label: 'Total', align: 'right' }
                                                    ].map((col) => (
                                                        <th
                                                            key={col.key}
                                                            onClick={() => handleSort(col.key as keyof ResumenDiario)}
                                                            className={`px-3 py-6 font-black select-none cursor-pointer group hover:bg-white/[0.03] transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                                                        >
                                                            <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                                                                <span className="whitespace-nowrap">{col.label}</span>
                                                                <div className="text-[#0071E3]/20 group-hover:text-[#0071E3] transition-colors shrink-0">
                                                                    {sortConfig?.key === col.key ? (
                                                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />
                                                                    ) : (
                                                                        <ArrowUpDown className="w-2.5 h-2.5" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#333333]">
                                                {sortedResumen.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-white/[0.02] transition-all duration-200 group h-16">
                                                        <td className="px-3 py-4">
                                                            <span className="font-bold text-[#F5F5F7] text-[10px] block whitespace-nowrap">{formatDate(item.fecha)}</span>
                                                        </td>
                                                        <td className="px-3 py-4">
                                                            <span className="font-mono text-[9px] font-black text-[#0071E3] group-hover:text-[#0077ED] transition-colors whitespace-nowrap">{item.codigo_articulo}</span>
                                                        </td>
                                                        <td className="px-3 py-4">
                                                            <p className="text-white font-black text-[10px] uppercase italic leading-tight max-w-[150px] truncate" title={item.nombre_articulo}>
                                                                {item.nombre_articulo}
                                                            </p>
                                                        </td>
                                                        <td className="px-3 py-4">
                                                            <span className="text-[10px] font-black text-[#86868B] font-mono whitespace-nowrap">{item.numero_solicitud}</span>
                                                        </td>
                                                        <td className="px-3 py-4">
                                                            <p className="text-[#86868B] font-bold text-[9px] uppercase truncate max-w-[100px]" title={item.instalacion_municipal}>
                                                                {item.instalacion_municipal || 'N/A'}
                                                            </p>
                                                        </td>
                                                        <td className="px-3 py-4">
                                                            <span className="text-[9px] font-black text-[#86868B] uppercase tracking-tighter truncate max-w-[80px] block" title={item.area_mantenimiento}>{item.area_mantenimiento}</span>
                                                        </td>
                                                        <td className="px-3 py-4 text-right">
                                                            <span className="text-xs font-black text-white font-mono">{Number(item.cantidad_total || 0).toFixed(2)}</span>
                                                        </td>
                                                        <td className="px-3 py-4 text-right">
                                                            <span className="text-[10px] font-black text-[#86868B] font-mono whitespace-nowrap">{formatearMoneda(item.costo_unitario || 0)}</span>
                                                        </td>
                                                        <td className="px-3 py-4 text-right">
                                                            <span className="text-xs font-black text-[#0071E3] font-mono group-hover:scale-110 transition-transform block whitespace-nowrap">{formatearMoneda(item.total_costo || 0)}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div >
                )}
            </div >
        </div >
    );
}
