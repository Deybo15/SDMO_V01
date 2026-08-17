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
    base: string;
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
                            fecha_salida,
                            solicitud_17 (
                                instalaciones_municipales_16 (
                                    instalacion_base (
                                        base
                                    )
                                )
                            )
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
                registro: item.registro_salida,
                base: item.salida_articulo_08?.solicitud_17?.instalaciones_municipales_16?.instalacion_base?.base || 'N/A'
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
                'Base': s.base,
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
        <div className="min-h-screen bg-black text-[#f4f4f5] p-4 md:p-8 relative overflow-hidden selection:bg-white/20">
            <div className="max-w-[1536px] mx-auto space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-5">
                    <PageHeader title="Historial de artículo" icon={History} themeColor="neutral" subtitle="Consumos históricos, tendencias y proyección estadística por artículo." />
                    <button
                        onClick={() => navigate(-1)}
                        className="h-12 px-6 bg-[#111112] border border-[#52525b] rounded-lg flex items-center gap-3 text-sm font-semibold text-[#d4d4d8] hover:text-white hover:bg-[#18181b] transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Regresar
                    </button>
                </div>

                {/* Status Float Messages */}
                {statusMessage && (
                    <div className="fixed top-8 right-8 z-[100] max-w-md px-6 py-4 rounded-lg shadow-2xl backdrop-blur-xl border border-[#71717a] bg-[#111112] text-[#d4d4d8] animate-in slide-in-from-right-4 flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-[#18181b] shrink-0">
                            {statusMessage.type === 'error' ? <AlertCircle className="w-5 h-5 text-white" /> :
                                statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-white" /> :
                                    <Info className="w-5 h-5 text-white" />}
                        </div>
                        <span className="text-sm leading-relaxed">{statusMessage.message}</span>
                        <button onClick={() => setStatusMessage(null)} className="ml-auto p-1 hover:bg-white/5 rounded-[4px] transition-colors">
                            <X className="w-4 h-4 text-[#86868B]" />
                        </button>
                    </div>
                )}

                {/* Filters Section */}
                <div className="bg-[#0d0d0e] p-6 border border-[#3f3f46] rounded-xl">
                    <div className="space-y-1 mb-6">
                        <h2 className="text-lg font-semibold text-white">Configurar análisis</h2>
                        <p className="text-sm text-[#a1a1aa]">Seleccione el artículo y el período que desea comparar.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
                        {/* Article Selector Trigger */}
                        <div className="lg:col-span-6 relative">
                            <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] mb-3">Artículo a analizar</label>
                            {selectedArticle ? (
                                <div className="flex items-center gap-4 p-3 bg-[#111112] border border-[#3f3f46] rounded-lg group/selected relative overflow-hidden h-14">
                                    <div className="w-12 h-12 bg-black/40 rounded-[8px] overflow-hidden border border-[#333333] shrink-0">
                                        <img src={selectedArticle.imagen_url || ''} className="w-full h-full object-cover opacity-80" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-mono text-xs text-[#d4d4d8] bg-[#18181b] px-2 py-0.5 rounded border border-[#52525b]">
                                            {selectedArticle.codigo_articulo}
                                        </span>
                                        <p className="text-sm font-semibold text-white truncate mt-1">{selectedArticle.nombre_articulo}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowSearchModal(true)}
                                            className="p-2 bg-[#18181b] text-[#d4d4d8] hover:text-white rounded-lg transition-colors border border-[#52525b]"
                                            title="Cambiar artículo"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setSelectedArticle(null); setSalidas([]); setHasSearched(false); }}
                                            className="p-2 bg-[#18181b] text-[#a1a1aa] hover:text-white rounded-lg transition-colors border border-[#52525b]"
                                            title="Quitar"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowSearchModal(true)}
                                    className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-left flex items-center justify-between group/trigger hover:border-[#71717a] transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <Search className="w-5 h-5 text-[#a1a1aa] group-hover/trigger:text-white transition-colors" />
                                        <span className="text-[#a1a1aa] text-sm">Seleccionar artículo del inventario...</span>
                                    </div>
                                    <span className="text-xs font-semibold text-[#d4d4d8] bg-[#18181b] px-3 py-1.5 rounded-md border border-[#52525b]">
                                        Buscar
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Date Range */}
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] mb-3">Desde</label>
                            <div className="relative group/date">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-4 text-white font-semibold focus:outline-none focus:border-[#a1a1aa] transition-colors [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] mb-3">Hasta</label>
                            <div className="relative group/date">
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-4 text-white font-semibold focus:outline-none focus:border-[#a1a1aa] transition-colors [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {/* Consult Action */}
                        <div className="lg:col-span-2">
                            <button
                                onClick={handleConsultar}
                                disabled={loading}
                                className="w-full h-14 bg-[#e4e4e7] hover:bg-white text-black rounded-lg transition-colors flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.99] group/search"
                                title="Consultar Historial"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5 group-hover/search:scale-110 transition-transform" />}
                                <span className="text-sm font-semibold">Analizar</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                {!hasSearched ? (
                    <div className="min-h-[380px] bg-[#0d0d0e] border border-[#27272a] rounded-xl flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
                        <div className="relative mb-7">
                            <div className="w-20 h-20 bg-[#18181b] border border-[#52525b] rounded-xl flex items-center justify-center relative z-10">
                                <LineChartIcon className="w-10 h-10 text-[#a1a1aa]" />
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-white">Análisis pendiente</h3>
                        <p className="text-[#a1a1aa] mt-3 max-w-md mx-auto text-sm leading-relaxed">
                            Seleccione un artículo y un rango de fechas para generar su historial y proyección de consumo.
                        </p>
                    </div>
                ) : loading ? (
                    <div className="py-40 flex flex-col items-center justify-center space-y-6">
                        <div className="relative">
                            <Loader2 className="w-12 h-12 animate-spin text-white relative z-10" />
                        </div>
                        <p className="text-sm text-[#a1a1aa] animate-pulse">Procesando registros...</p>
                    </div>
                ) : salidas.length === 0 ? (
                    <div className="min-h-[380px] flex flex-col items-center justify-center text-center bg-[#0d0d0e] border border-[#3f3f46] rounded-xl">
                        <Inbox className="w-16 h-16 text-[#333333] mb-6" />
                        <h3 className="text-xl font-bold text-[#F5F5F7]">No se encontraron movimientos</h3>
                        <p className="text-[#86868B] mt-2">Para el período seleccionado no existen registros de salida en este artículo.</p>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-700">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-[#0d0d0e] p-6 border border-[#52525b] rounded-xl">
                                <span className="text-xs text-[#a1a1aa] block mb-5">Total de salidas</span>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-semibold text-white tracking-tight">{stats.totalSalidas.toLocaleString()}</span>
                                    <span className="text-[#a1a1aa] text-xs">registros</span>
                                </div>
                            </div>
                            <div className="bg-[#0d0d0e] p-6 border border-[#3f3f46] rounded-xl">
                                <span className="text-xs text-[#a1a1aa] block mb-5">Cantidad consumida</span>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-semibold text-white tracking-tight">{stats.cantidadTotal.toLocaleString()}</span>
                                    <span className="text-[#a1a1aa] text-xs uppercase">{selectedArticle?.unidad || 'unid'}</span>
                                </div>
                            </div>
                            <div className="bg-[#0d0d0e] p-6 border border-[#3f3f46] rounded-xl">
                                <span className="text-xs text-[#a1a1aa] block mb-5">Promedio mensual</span>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-semibold text-white tracking-tight">{stats.promedioMensual.toLocaleString()}</span>
                                    <span className="text-[#a1a1aa] text-xs">por mes</span>
                                </div>
                            </div>
                            <div className="bg-[#0d0d0e] p-6 border border-[#3f3f46] rounded-xl">
                                <span className="text-xs text-[#a1a1aa] block mb-5">Movimientos únicos</span>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-semibold text-white tracking-tight">{stats.salidasUnicas.toLocaleString()}</span>
                                    <span className="text-[#a1a1aa] text-xs">identificadores</span>
                                </div>
                            </div>
                        </div>

                        {/* Analysis & Chart */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Linear Regression Card */}
                            {chartData.regression && (
                                <div className="lg:col-span-4 bg-[#0d0d0e] p-7 border border-[#3f3f46] rounded-xl relative overflow-hidden flex flex-col">
                                    <div className="mb-7">
                                        <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                                            <TrendingUp className="w-5 h-5 text-[#d4d4d8]" />
                                            Tendencia estimada
                                        </h3>
                                        <p className="text-sm text-[#a1a1aa] mt-2">Comportamiento calculado a partir del consumo histórico.</p>
                                    </div>

                                    <div className="space-y-6 flex-1">
                                        <div className="p-5 rounded-lg bg-black border border-[#3f3f46]">
                                            <label className="text-xs text-[#a1a1aa] block mb-2">Modelo calculado</label>
                                            <div className="text-xl font-semibold text-white font-mono tracking-tight">{chartData.regression.equation}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-lg bg-black border border-[#3f3f46]">
                                                <label className="text-xs text-[#a1a1aa] block mb-1">Confiabilidad R²</label>
                                                <div className="text-lg font-semibold text-white">{chartData.regression.r2.toFixed(4)}</div>
                                            </div>
                                            <div className="p-4 rounded-lg bg-black border border-[#3f3f46]">
                                                <label className="text-xs text-[#a1a1aa] block mb-1">Variación mensual</label>
                                                <div className="text-lg font-semibold text-white">{chartData.regression.slope.toFixed(2)}</div>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-lg border border-[#3f3f46] bg-[#111112]">
                                            <p className="text-sm text-[#d4d4d8] leading-relaxed">
                                                {chartData.regression.r2 < 0.3
                                                    ? 'La relación histórica es débil; la proyección debe tomarse únicamente como referencia.'
                                                    : chartData.regression.r2 < 0.7
                                                        ? 'La tendencia presenta una confiabilidad moderada y conviene contrastarla con la demanda operativa.'
                                                        : 'La tendencia histórica presenta una relación consistente para apoyar la planificación.'}
                                                {' '}{chartData.regression.slope < 0 ? 'El consumo muestra una tendencia descendente.' : chartData.regression.slope > 0 ? 'El consumo muestra una tendencia ascendente.' : 'El consumo se mantiene estable.'}
                                            </p>
                                        </div>

                                        <div className="mt-auto pt-6 border-t border-[#333333]">
                                            <div className="flex items-center justify-between p-6 bg-[#18181b] rounded-lg border border-[#71717a]">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-semibold text-[#d4d4d8] uppercase tracking-widest block">Predicción próximo mes</span>
                                                    <p className="text-3xl font-semibold text-white leading-none">{chartData.regression.prediction.toLocaleString()}</p>
                                                </div>
                                                <div className="w-12 h-12 bg-[#111112] border border-[#52525b] rounded-lg flex items-center justify-center">
                                                    <TrendingUp className="w-6 h-6 text-white" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Chart Card */}
                            <div className={`${chartData.regression ? 'lg:col-span-8' : 'lg:col-span-12'} bg-[#0d0d0e] p-7 border border-[#3f3f46] rounded-xl min-h-[520px] flex flex-col`}>
                                <div className="mb-6 shrink-0">
                                    <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                                        <BarChart3 className="w-5 h-5 text-[#d4d4d8]" />
                                        Consumo histórico
                                    </h3>
                                    <p className="text-sm text-[#a1a1aa] mt-2">Cantidad consumida por mes y tendencia estadística estimada.</p>
                                </div>

                                <div className="flex-1 w-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData.data}>
                                            <defs>
                                                <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.55} />
                                                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0.08} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 5" stroke="#27272a" vertical={false} />
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
                                                itemStyle={{ color: '#f4f4f5', fontWeight: '600', fontSize: '12px' }}
                                                labelStyle={{ color: '#a1a1aa', fontWeight: '500', fontSize: '11px', marginBottom: '8px' }}
                                                cursor={{ fill: 'white', opacity: 0.03 }}
                                            />
                                            <Legend
                                                verticalAlign="top"
                                                align="right"
                                                iconType="line"
                                                wrapperStyle={{ color: '#d4d4d8', fontSize: '11px', fontWeight: '500', paddingBottom: '20px' }}
                                            />
                                            <Bar dataKey="cantidad" name="Consumo Real" fill="url(#colorBar)" radius={[4, 4, 0, 0]} />
                                            {chartData.regression && (
                                                <Line
                                                    type="monotone"
                                                    dataKey="regression"
                                                    name="Progresión"
                                                    stroke="#ffffff"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, fill: '#000000', stroke: '#ffffff', strokeWidth: 2 }}
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
                                <div>
                                <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                                    <Table className="w-5 h-5 text-[#d4d4d8]" />
                                    Consumos cronológicos
                                </h3>
                                <p className="text-sm text-[#a1a1aa] mt-2">Detalle individual de los movimientos incluidos en el análisis.</p>
                                </div>
                                <button
                                    onClick={handleExport}
                                    className="h-12 px-6 bg-[#111112] border border-[#52525b] rounded-lg text-sm font-semibold flex items-center gap-2 text-[#d4d4d8] hover:text-white transition-colors"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Exportar Excel
                                </button>
                            </div>

                            <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#18181b] text-[#a1a1aa] text-[10px] font-semibold uppercase tracking-[0.14em] border-b border-[#3f3f46]">
                                                <th className="p-6">Salida</th>
                                                <th className="p-6">Fecha efectiva</th>
                                                <th className="p-6">Base</th>
                                                <th className="p-6 text-right">Cantidad</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#27272a]">
                                            {salidas.map((s) => (
                                                <tr key={s.id_salida} className="hover:bg-white/[0.02] transition-colors group h-16">
                                                    <td className="p-6">
                                                        <span className="font-mono text-sm font-semibold text-white bg-[#18181b] border border-[#52525b] px-3 py-1.5 rounded-md">#{s.id_salida}</span>
                                                    </td>
                                                    <td className="p-6 text-[#F5F5F7] font-medium text-sm">
                                                        {format(parseISO(s.fecha_salida), 'PPPP', { locale: es })}
                                                    </td>
                                                    <td className="p-6">
                                                        <span className="text-xs text-[#a1a1aa] uppercase">{s.base}</span>
                                                    </td>
                                                    <td className="p-6 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-xl font-semibold text-white font-mono">{s.cantidad.toLocaleString()}</span>
                                                            <span className="text-[10px] text-[#a1a1aa] uppercase">{selectedArticle?.unidad}</span>
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
                themeColor="neutral"
                title="Seleccionar artículo"
            />
        </div>
    );
}
