import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp,
    Filter,
    Package,
    Search,
    X,
    Calendar,
    BarChart2,
    BarChart3,
    CalendarDays,
    Users,
    Table,
    Inbox,
    Loader2,
    ArrowLeft,
    ChevronRight,
    Download,
    History,
    FileSpreadsheet,
    Activity,
    LineChart as LineChartIcon,
    AlertCircle,
    CheckCircle2,
    Info,
    ArrowRight
} from 'lucide-react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { utils, writeFile } from 'xlsx';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';
import ArticleSearchGridModal from '../components/ArticleSearchGridModal';

// Interfaces
interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
    unidad?: string;
    imagen_url?: string | null;
}

interface SalidaProcessed {
    id_salida: number;
    fecha_salida: string;
    cantidad: number;
    registro: string;
}

interface ChartData {
    month: string;
    label: string;
    cantidad: number;
    regression?: number;
}

export default function HistorialArticulo() {
    const navigate = useNavigate();

    // State
    const [loading, setLoading] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState<Articulo | null>(null);
    const [showSearchModal, setShowSearchModal] = useState(false);

    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 365), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

    const [salidas, setSalidas] = useState<SalidaProcessed[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null);


    // Consultar Salidas
    const handleConsultar = async () => {
        if (!selectedArticle) {
            setStatusMessage({ type: 'warning', message: 'Por favor seleccione un artículo primero.' });
            return;
        }
        if (!dateFrom || !dateTo) {
            setStatusMessage({ type: 'warning', message: 'Por favor seleccione el rango de fechas.' });
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setStatusMessage(null);
        try {
            let allData: any[] = [];
            let hasMore = true;
            let offset = 0;
            const BATCH_SIZE = 1000;
            let totalCount = 0;

            while (hasMore) {
                const { data, error, count } = await supabase
                    .from('dato_salida_13')
                    .select(`
                        registro_salida,
                        articulo,
                        cantidad,
                        salida_articulo_08 (
                            id_salida,
                            fecha_salida
                        )
                    `, { count: 'exact' })
                    .eq('articulo', selectedArticle.codigo_articulo)
                    .gte('salida_articulo_08.fecha_salida', dateFrom)
                    .lte('salida_articulo_08.fecha_salida', dateTo)
                    .range(offset, offset + BATCH_SIZE - 1)
                    .order('fecha_salida', { foreignTable: 'salida_articulo_08', ascending: true });

                if (error) throw error;

                if (offset === 0 && count !== null) {
                    totalCount = count;
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += data.length;
                    hasMore = data.length === BATCH_SIZE;

                    if (offset >= 50000) break;
                } else {
                    hasMore = false;
                }
            }

            // Process data
            const processed: SalidaProcessed[] = allData.map(item => ({
                id_salida: item.salida_articulo_08?.id_salida,
                fecha_salida: item.salida_articulo_08?.fecha_salida,
                cantidad: Number(item.cantidad) || 0,
                registro: item.registro_salida
            })).filter(item => item.fecha_salida);

            console.log('Procesamiento completado. Registros finales:', processed.length);

            setSalidas(processed);
            if (processed.length > 0) {
                setStatusMessage({
                    type: 'success',
                    message: `${processed.length} registros recuperados${totalCount > 1000 ? ` de ${totalCount}` : ''}.`
                });
            }
        } catch (error: any) {
            console.error('Error fetching salidas:', error);
            setStatusMessage({ type: 'error', message: 'Error al consultar: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    // Export to Excel (XLSX)
    const handleExport = () => {
        try {
            if (salidas.length === 0) return;

            const dataToExport = salidas.map(s => ({
                'ID Salida': s.id_salida,
                'Fecha': format(parseISO(s.fecha_salida), 'dd/MM/yyyy'),
                'Cantidad': s.cantidad
            }));

            const ws = utils.json_to_sheet(dataToExport);
            const wscols = [{ wch: 10 }, { wch: 15 }, { wch: 10 }];
            ws['!cols'] = wscols;

            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Historial");
            writeFile(wb, `historial_${selectedArticle?.codigo_articulo}_${dateFrom}_${dateTo}.xlsx`);
            setStatusMessage({ type: 'success', message: 'Excel exportado correctamente.' });
        } catch (error) {
            console.error('Error exporting Excel:', error);
            setStatusMessage({ type: 'error', message: 'Error al exportar Excel.' });
        }
    };

    // Statistics & Regression
    const stats = useMemo(() => {
        const totalSalidas = salidas.length;
        const cantidadTotal = salidas.reduce((sum, s) => sum + s.cantidad, 0);
        const salidasUnicas = new Set(salidas.map(s => s.id_salida)).size;
        const meses = new Set(salidas.map(s => s.fecha_salida.substring(0, 7))); // YYYY-MM
        const promedioMensual = meses.size > 0 ? Math.round(cantidadTotal / meses.size) : 0;
        return { totalSalidas, cantidadTotal, promedioMensual, salidasUnicas };
    }, [salidas]);

    const chartData = useMemo(() => {
        if (salidas.length === 0) return { data: [], regression: null };

        const grouped: Record<string, number> = {};
        salidas.forEach(s => {
            const monthKey = s.fecha_salida.substring(0, 7);
            grouped[monthKey] = (grouped[monthKey] || 0) + s.cantidad;
        });

        const sortedKeys = Object.keys(grouped).sort();
        const data: ChartData[] = sortedKeys.map(key => {
            const [y, m] = key.split('-');
            const date = new Date(parseInt(y), parseInt(m) - 1);
            return {
                month: key,
                label: format(date, 'MMM yyyy', { locale: es }),
                cantidad: grouped[key]
            };
        });

        const n = data.length;
        let regressionInfo = null;

        if (n >= 2) {
            const x = data.map((_, i) => i);
            const y = data.map(d => d.cantidad);
            const sumX = x.reduce((a, b) => a + b, 0);
            const sumY = y.reduce((a, b) => a + b, 0);
            const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
            const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            const yMean = sumY / n;
            const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
            const residualSumSquares = y.reduce((sum, yi, i) => {
                const predicted = slope * x[i] + intercept;
                return sum + Math.pow(yi - predicted, 2);
            }, 0);
            const r2 = 1 - (residualSumSquares / totalSumSquares);

            data.forEach((d, i) => {
                d.regression = slope * i + intercept;
            });

            regressionInfo = {
                slope, intercept, r2,
                equation: `y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`,
                prediction: Math.round(slope * n + intercept)
            };
        }

        return { data, regression: regressionInfo };
    }, [salidas]);

    return (
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] p-4 md:p-8 relative overflow-hidden">
            <div className="max-w-7xl mx-auto space-y-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-[#333333]">
                    <div className="space-y-1">
                        <PageHeader title="Historial de Artículo" icon={History} themeColor="blue" />
                        <p className="text-[#86868B] text-sm font-medium tracking-wide">
                            Análisis cronológico de consumos y proyecciones basadas en regresión lineal.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 bg-transparent border border-[#333333] rounded-[8px] text-xs font-black uppercase tracking-widest flex items-center gap-2 text-[#F5F5F7] hover:bg-white/5 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4 text-[#0071E3]" />
                        Regresar
                    </button>
                </div>

                {/* Status Float Messages */}
                {statusMessage && (
                    <div className={`fixed top-8 right-8 z-[100] px-6 py-5 rounded-[8px] shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 flex items-center gap-4
                        ${statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100' :
                            statusMessage.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-100' :
                                statusMessage.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-100' :
                                    'bg-[#0071E3]/10 border-[#0071E3]/20 text-blue-100'
                        }`}>
                        <div className="p-2 rounded-[8px] bg-white/5 shrink-0">
                            {statusMessage.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400" /> :
                                statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                                    <Info className="w-5 h-5 text-amber-400" />}
                        </div>
                        <span className="font-black uppercase tracking-widest text-[11px] leading-relaxed">{statusMessage.message}</span>
                        <button onClick={() => setStatusMessage(null)} className="ml-auto p-1 hover:bg-white/5 rounded-[4px] transition-colors">
                            <X className="w-4 h-4 text-[#86868B]" />
                        </button>
                    </div>
                )}

                {/* Filters Section */}
                <div className="bg-[#121212] p-8 border border-[#333333] rounded-[8px] relative group">
                    <h2 className="text-xs font-black text-[#86868B] uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                        <span className="w-8 h-px bg-[#0071E3]/30" />
                        Filtros de Análisis
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        {/* Article Selector Trigger */}
                        <div className="md:col-span-12 lg:col-span-12 xl:col-span-5 relative">
                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Artículo Seleccionado</label>
                            {selectedArticle ? (
                                <div className="flex items-center gap-4 p-4 bg-[#1D1D1F] border border-[#333333] rounded-[8px] group/selected relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#0071E3]" />
                                    <div className="w-12 h-12 bg-black/40 rounded-[8px] overflow-hidden border border-[#333333] shrink-0">
                                        <img src={selectedArticle.imagen_url || ''} className="w-full h-full object-cover opacity-80" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-mono text-[10px] font-black text-[#0071E3] uppercase tracking-widest bg-[#0071E3]/5 px-2 py-0.5 rounded border border-[#0071E3]/10">
                                            {selectedArticle.codigo_articulo}
                                        </span>
                                        <p className="text-sm font-bold text-white truncate italic uppercase mt-1">{selectedArticle.nombre_articulo}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowSearchModal(true)}
                                            className="p-3 bg-white/5 hover:bg-white/10 text-[#0071E3] hover:text-white rounded-[8px] transition-all border border-[#333333]"
                                            title="Cambiar artículo"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setSelectedArticle(null); setSalidas([]); setHasSearched(false); }}
                                            className="p-3 bg-white/5 hover:bg-white/10 text-rose-400 hover:text-white rounded-[8px] transition-all border border-[#333333]"
                                            title="Quitar"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowSearchModal(true)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-6 py-4 text-left flex items-center justify-between group/trigger focus:border-[#0071E3]/50 transition-all shadow-inner"
                                >
                                    <div className="flex items-center gap-4">
                                        <Search className="w-5 h-5 text-[#86868B] group-hover/trigger:text-[#0071E3] transition-colors" />
                                        <span className="text-[#86868B] font-bold">Seleccionar artículo para analizar...</span>
                                    </div>
                                    <span className="text-[10px] font-black text-[#0071E3] bg-[#0071E3]/5 px-3 py-1 rounded-[4px] border border-[#0071E3]/10 uppercase tracking-widest group-hover/trigger:bg-[#0071E3]/10 transition-colors">
                                        Buscar
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Date Range */}
                        <div className="md:col-span-6 xl:col-span-3">
                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Rango Desde</label>
                            <div className="relative group/date">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#86868B] group-focus-within/date:text-[#0071E3] pointer-events-none" />
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-14 pr-4 py-4 text-white font-bold focus:outline-none focus:border-[#0071E3]/50 transition-all shadow-inner [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-6 xl:col-span-3">
                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Rango Hasta</label>
                            <div className="relative group/date">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#86868B] group-focus-within/date:text-[#0071E3] pointer-events-none" />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-14 pr-4 py-4 text-white font-bold focus:outline-none focus:border-[#0071E3]/50 transition-all shadow-inner [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {/* Consult Action */}
                        <div className="md:col-span-12 xl:col-span-1">
                            <button
                                onClick={handleConsultar}
                                disabled={loading}
                                className="w-full h-[58px] bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-[8px] shadow-lg shadow-[#0071E3]/20 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95 group/search"
                                title="Consultar Historial"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Activity className="w-6 h-6 group-hover/search:scale-110 transition-transform" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                {!hasSearched ? (
                    <div className="py-40 flex flex-col items-center justify-center text-center group animate-in fade-in zoom-in duration-700">
                        <div className="relative mb-10">
                            <div className="absolute inset-0 bg-[#0071E3]/10 rounded-full blur-3xl scale-150 group-hover:scale-200 transition-transform duration-1000" />
                            <div className="w-32 h-32 bg-[#121212] border border-[#333333] rounded-[8px] flex items-center justify-center relative z-10 group-hover:rotate-3 transition-all duration-700 shadow-2xl">
                                <LineChartIcon className="w-16 h-16 text-[#333333]" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-[#F5F5F7] uppercase italic tracking-tighter">Sin Análisis Ejecutado</h3>
                        <p className="text-[#86868B] mt-3 max-w-sm mx-auto font-medium text-sm leading-relaxed tracking-wide uppercase text-[10px]">
                            Seleccione un artículo y el rango temporal para generar el historial de salidas y la proyección estadística de consumo.
                        </p>
                    </div>
                ) : loading ? (
                    <div className="py-40 flex flex-col items-center justify-center space-y-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-[#0071E3]/20 rounded-full blur-2xl animate-pulse" />
                            <Loader2 className="w-16 h-16 animate-spin text-[#0071E3] relative z-10" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#86868B] animate-pulse">Procesando registros...</p>
                    </div>
                ) : salidas.length === 0 ? (
                    <div className="py-40 flex flex-col items-center justify-center text-center bg-[#121212] border border-[#333333] rounded-[8px]">
                        <Inbox className="w-16 h-16 text-[#333333] mb-6" />
                        <h3 className="text-xl font-bold text-[#F5F5F7]">No se encontraron movimientos</h3>
                        <p className="text-[#86868B] mt-2">Para el período seleccionado no existen registros de salida en este artículo.</p>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-700">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-[#121212] p-6 border border-[#333333] rounded-[8px] relative overflow-hidden group">
                                <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest block mb-4">Total Salidas</span>
                                <div className="flex items-end gap-3">
                                    <span className="text-4xl font-black text-[#F5F5F7] italic tracking-tighter">{stats.totalSalidas.toLocaleString()}</span>
                                    <span className="text-[#0071E3]/50 text-xs font-black uppercase mb-1">Registros</span>
                                </div>
                            </div>
                            <div className="bg-[#121212] p-6 border border-[#333333] rounded-[8px] relative overflow-hidden group">
                                <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest block mb-4">Cantidad Total</span>
                                <div className="flex items-end gap-3">
                                    <span className="text-4xl font-black text-[#F5F5F7] italic tracking-tighter">{stats.cantidadTotal.toLocaleString()}</span>
                                    <span className="text-[#0071E3]/50 text-xs font-black uppercase mb-1">{selectedArticle?.unidad || 'unid'}</span>
                                </div>
                            </div>
                            <div className="bg-[#121212] p-6 border border-[#333333] rounded-[8px] relative overflow-hidden group">
                                <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest block mb-4">Promedio Mensual</span>
                                <div className="flex items-end gap-3">
                                    <span className="text-4xl font-black text-[#F5F5F7] italic tracking-tighter">{stats.promedioMensual.toLocaleString()}</span>
                                    <span className="text-[#0071E3]/50 text-xs font-black uppercase mb-1">/ mes</span>
                                </div>
                            </div>
                            <div className="bg-[#121212] p-6 border border-[#333333] rounded-[8px] relative overflow-hidden group">
                                <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest block mb-4">Salidas Únicas</span>
                                <div className="flex items-end gap-3">
                                    <span className="text-4xl font-black text-[#F5F5F7] italic tracking-tighter">{stats.salidasUnicas.toLocaleString()}</span>
                                    <span className="text-[#0071E3]/50 text-xs font-black uppercase mb-1">ID</span>
                                </div>
                            </div>
                        </div>

                        {/* Analysis & Chart */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Linear Regression Card */}
                            {chartData.regression && (
                                <div className="lg:col-span-4 bg-[#121212] p-8 border border-[#333333] rounded-[8px] relative overflow-hidden flex flex-col">
                                    <h3 className="text-xs font-black text-[#86868B] uppercase tracking-[0.3em] mb-8 flex items-center gap-3 italic">
                                        <TrendingUp className="w-5 h-5 text-[#0071E3]" />
                                        Regresión Lineal
                                    </h3>

                                    <div className="space-y-6 flex-1">
                                        <div className="p-4 rounded-[4px] bg-black/40 border border-[#333333]">
                                            <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest block mb-2">Ecuación de la Recta</label>
                                            <div className="text-xl font-black text-[#0071E3] font-mono tracking-tight">{chartData.regression.equation}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-[4px] bg-black/40 border border-[#333333]">
                                                <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest block mb-1">Coeficiente R²</label>
                                                <div className="text-lg font-black text-white">{chartData.regression.r2.toFixed(4)}</div>
                                            </div>
                                            <div className="p-4 rounded-[4px] bg-black/40 border border-[#333333]">
                                                <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest block mb-1">Pendiente (m)</label>
                                                <div className="text-lg font-black text-white">{chartData.regression.slope.toFixed(2)}</div>
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-6 border-t border-[#333333]">
                                            <div className="flex items-center justify-between p-6 bg-[#0071E3]/5 rounded-[8px] border border-[#0071E3]/20 shadow-2xl">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black text-[#0071E3] uppercase tracking-widest block">Predicción Próximo Mes</span>
                                                    <p className="text-3xl font-black text-white italic leading-none">{chartData.regression.prediction.toLocaleString()}</p>
                                                </div>
                                                <div className="w-12 h-12 bg-[#0071E3]/10 rounded-[4px] flex items-center justify-center">
                                                    <TrendingUp className="w-6 h-6 text-[#0071E3]" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Chart Card */}
                            <div className={`${chartData.regression ? 'lg:col-span-8' : 'lg:col-span-12'} bg-[#121212] p-8 border border-[#333333] rounded-[8px] min-h-[450px] flex flex-col`}>
                                <h3 className="text-xs font-black text-[#86868B] uppercase tracking-[0.3em] mb-8 flex items-center gap-3 shrink-0">
                                    <BarChart3 className="w-5 h-5 text-[#0071E3]" />
                                    Consumo Histórico
                                </h3>

                                <div className="flex-1 w-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData.data}>
                                            <defs>
                                                <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#0071E3" stopOpacity={0.6} />
                                                    <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333333" vertical={false} />
                                            <XAxis
                                                dataKey="label"
                                                stroke="#86868B"
                                                fontSize={10}
                                                axisLine={false}
                                                tickLine={false}
                                                fontWeight="bold"
                                            />
                                            <YAxis
                                                stroke="#86868B"
                                                fontSize={10}
                                                axisLine={false}
                                                tickLine={false}
                                                fontWeight="bold"
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#121212',
                                                    border: '1px solid #333333',
                                                    borderRadius: '8px',
                                                    padding: '12px',
                                                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                                                    backdropFilter: 'blur(20px)'
                                                }}
                                                itemStyle={{ fontWeight: '900', fontSize: '12px', textTransform: 'uppercase' }}
                                                labelStyle={{ color: '#86868B', fontWeight: 'bold', fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase' }}
                                                cursor={{ fill: 'white', opacity: 0.03 }}
                                            />
                                            <Legend
                                                verticalAlign="top"
                                                align="right"
                                                iconType="circle"
                                                wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '20px' }}
                                            />
                                            <Bar dataKey="cantidad" name="Consumo Real" fill="url(#colorBar)" radius={[4, 4, 0, 0]} />
                                            {chartData.regression && (
                                                <Line
                                                    type="monotone"
                                                    dataKey="regression"
                                                    name="Progresión"
                                                    stroke="#0071E3"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, fill: '#0071E3', strokeWidth: 0 }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                />
                                            )}
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* List Area */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-xs font-black text-[#86868B] uppercase tracking-[0.3em] flex items-center gap-3">
                                    <Table className="w-5 h-5 text-[#0071E3]" />
                                    Consumos Cronológicos
                                </h3>
                                <button
                                    onClick={handleExport}
                                    className="px-6 py-2.5 bg-transparent border border-[#333333] rounded-[8px] text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#0071E3]/5 text-[#0071E3] transition-all"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Exportar Excel
                                </button>
                            </div>

                            <div className="bg-[#121212] border border-[#333333] rounded-[8px] overflow-hidden shadow-2xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#1D1D1F] text-[#86868B] text-[10px] font-black uppercase tracking-[0.2em] border-b border-[#333333]">
                                                <th className="p-6">ID Salida</th>
                                                <th className="p-6">Fecha Efectiva</th>
                                                <th className="p-6 text-right">Cantidad</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#333333]">
                                            {salidas.map((s) => (
                                                <tr key={s.id_salida} className="hover:bg-white/[0.02] transition-colors group h-16">
                                                    <td className="p-6">
                                                        <span className="font-mono text-sm font-black text-[#0071E3]/70 group-hover:text-[#0071E3] transition-colors">#{s.id_salida}</span>
                                                    </td>
                                                    <td className="p-6 text-[#F5F5F7] font-medium text-sm">
                                                        {format(parseISO(s.fecha_salida), 'PPPP', { locale: es })}
                                                    </td>
                                                    <td className="p-6 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-xl font-black text-white group-hover:text-[#0071E3] transition-colors font-mono">{s.cantidad.toLocaleString()}</span>
                                                            <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">{selectedArticle?.unidad}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Article Search Modal (Galaxy Grid) */}
            <ArticleSearchGridModal
                isOpen={showSearchModal}
                onClose={() => setShowSearchModal(false)}
                onSelect={(article) => {
                    setSelectedArticle(article);
                    setSalidas([]);
                    setHasSearched(false);
                    setShowSearchModal(false);
                }}
                themeColor="blue"
                title="BUSCADOR"
            />
        </div>
    );
}
