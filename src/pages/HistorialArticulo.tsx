import { useState, useEffect, useMemo } from 'react';
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
    Info
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
    const [searching, setSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [articulosFound, setArticulosFound] = useState<Articulo[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<Articulo | null>(null);
    const [showSearchModal, setShowSearchModal] = useState(false);

    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 365), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

    const [salidas, setSalidas] = useState<SalidaProcessed[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null);

    // Search Articles
    useEffect(() => {
        const searchArticles = async () => {
            if (searchTerm.trim().length < 2) {
                setArticulosFound([]);
                return;
            }

            setSearching(true);
            try {
                const { data, error } = await supabase
                    .from('articulo_01')
                    .select('codigo_articulo, nombre_articulo, unidad, imagen_url')
                    .or(`nombre_articulo.ilike.%${searchTerm}%,codigo_articulo.ilike.%${searchTerm}%`)
                    .limit(15);

                if (error) throw error;
                setArticulosFound(data || []);
            } catch (error) {
                console.error('Error searching articles:', error);
            } finally {
                setSearching(false);
            }
        };

        const debounce = setTimeout(searchArticles, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm]);

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
            const { data, error } = await supabase
                .from('dato_salida_13')
                .select(`
                    registro_salida,
                    articulo,
                    cantidad,
                    salida_articulo_08!inner (
                        id_salida,
                        fecha_salida
                    )
                `)
                .eq('articulo', selectedArticle.codigo_articulo)
                .gte('salida_articulo_08.fecha_salida', dateFrom)
                .lte('salida_articulo_08.fecha_salida', dateTo);

            if (error) throw error;

            // Process data
            const processed: SalidaProcessed[] = (data as any[]).map(item => ({
                id_salida: item.salida_articulo_08?.id_salida,
                fecha_salida: item.salida_articulo_08?.fecha_salida,
                cantidad: Number(item.cantidad) || 0,
                registro: item.registro_salida
            })).filter(item => item.fecha_salida)
                .sort((a, b) => new Date(a.fecha_salida).getTime() - new Date(b.fecha_salida).getTime());

            setSalidas(processed);
            if (processed.length > 0) {
                setStatusMessage({ type: 'success', message: `${processed.length} registros encontrados.` });
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
        <div className="min-h-screen bg-[#0f111a] text-slate-100 p-4 md:p-8 relative overflow-hidden">
            {/* Ambient Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[10%] left-[-5%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto space-y-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-white/5">
                    <div className="space-y-1">
                        <PageHeader title="Historial de Artículo" icon={History} themeColor="purple" />
                        <p className="text-slate-500 text-sm font-medium tracking-wide">
                            Análisis cronológico de consumos y proyecciones basadas en regresión lineal.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="glass-button px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-200"
                    >
                        <ArrowLeft className="w-4 h-4 text-purple-500" />
                        Regresar
                    </button>
                </div>

                {/* Status Float Messages */}
                {statusMessage && (
                    <div className={`fixed top-8 right-8 z-[100] px-6 py-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl border animate-in slide-in-from-right-4 flex items-center gap-4
                        ${statusMessage.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100' :
                            statusMessage.type === 'error' ? 'bg-rose-500/20 border-rose-500/40 text-rose-100' :
                                statusMessage.type === 'warning' ? 'bg-amber-500/20 border-amber-500/40 text-amber-100' :
                                    'bg-blue-500/20 border-blue-500/40 text-blue-100'
                        }`}>
                        <div className="p-2 rounded-xl bg-white/10 shrink-0">
                            {statusMessage.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400" /> :
                                statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                                    <Info className="w-5 h-5 text-amber-400" />}
                        </div>
                        <span className="font-black uppercase tracking-widest text-[11px] leading-relaxed">{statusMessage.message}</span>
                        <button onClick={() => setStatusMessage(null)} className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                )}

                {/* Filters Section */}
                <div className="glass-card p-6 md:p-8 bg-slate-900/40 relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16" />

                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                        <Filter className="w-4 h-4 text-purple-500" />
                        Filtros de Análisis
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        {/* Article Selector Trigger */}
                        <div className="md:col-span-12 lg:col-span-12 xl:col-span-5 relative">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Artículo Seleccionado</label>
                            {selectedArticle ? (
                                <div className="flex items-center gap-4 p-4 bg-slate-950/60 border border-purple-500/30 rounded-2xl group/selected relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                                    <div className="w-12 h-12 bg-black/40 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                        <img src={selectedArticle.imagen_url || ''} className="w-full h-full object-cover opacity-80" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-mono text-[10px] font-black text-purple-400 uppercase tracking-widest">{selectedArticle.codigo_articulo}</span>
                                        <p className="text-sm font-bold text-white truncate italic uppercase">{selectedArticle.nombre_articulo}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowSearchModal(true)}
                                            className="p-3 glass-button text-purple-400 hover:text-white rounded-xl transition-all"
                                            title="Cambiar artículo"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setSelectedArticle(null); setSalidas([]); setHasSearched(false); }}
                                            className="p-3 glass-button text-rose-400 hover:text-white rounded-xl transition-all"
                                            title="Quitar"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowSearchModal(true)}
                                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-6 py-4 text-left flex items-center justify-between group/trigger hover:border-purple-500/50 transition-all shadow-inner"
                                >
                                    <div className="flex items-center gap-4">
                                        <Search className="w-5 h-5 text-slate-600 group-hover/trigger:text-purple-500 transition-colors" />
                                        <span className="text-slate-500 font-bold">Seleccionar artículo para analizar...</span>
                                    </div>
                                    <span className="text-[10px] font-black text-purple-400/60 bg-purple-500/5 px-3 py-1 rounded-full uppercase tracking-widest group-hover/trigger:bg-purple-500/10 transition-colors">
                                        Buscar
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Date Range */}
                        <div className="md:col-span-6 xl:col-span-3">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Rango Desde</label>
                            <div className="relative group/date">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within/date:text-purple-500 pointer-events-none" />
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl pl-14 pr-4 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all shadow-inner [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-6 xl:col-span-3">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Rango Hasta</label>
                            <div className="relative group/date">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within/date:text-purple-500 pointer-events-none" />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl pl-14 pr-4 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all shadow-inner [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {/* Consult Action */}
                        <div className="md:col-span-12 xl:col-span-1">
                            <button
                                onClick={handleConsultar}
                                disabled={loading}
                                className="w-full h-[58px] bg-purple-600 hover:bg-purple-500 text-white rounded-2xl shadow-xl shadow-purple-900/20 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95 group/search"
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
                            <div className="absolute inset-0 bg-purple-500/10 rounded-full blur-3xl scale-150 group-hover:scale-200 transition-transform duration-1000" />
                            <div className="w-32 h-32 glass-card rounded-[3rem] flex items-center justify-center relative z-10 border-white/10 group-hover:rotate-6 transition-all duration-700">
                                <LineChartIcon className="w-16 h-16 text-slate-800" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-slate-700 uppercase italic tracking-tighter">Sin Análisis Ejecutado</h3>
                        <p className="text-slate-600 mt-3 max-w-sm mx-auto font-medium text-sm leading-relaxed tracking-wide">
                            Seleccione un artículo y el rango temporal para generar el historial de salidas y la proyección estadística de consumo.
                        </p>
                    </div>
                ) : loading ? (
                    <div className="py-40 flex flex-col items-center justify-center space-y-6">
                        <Loader2 className="w-16 h-16 animate-spin text-purple-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 animate-pulse">Procesando registros...</p>
                    </div>
                ) : salidas.length === 0 ? (
                    <div className="py-40 flex flex-col items-center justify-center text-center glass-card bg-slate-900/40">
                        <Inbox className="w-16 h-16 text-slate-700 mb-6" />
                        <h3 className="text-xl font-bold text-slate-400">No se encontraron movimientos</h3>
                        <p className="text-slate-600 mt-2">Para el período seleccionado no existen registros de salida en este artículo.</p>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-700">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="glass-card p-6 bg-slate-900/40 border-l-4 border-l-purple-500 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Total Salidas</span>
                                <div className="flex items-end gap-3">
                                    <span className="text-4xl font-black text-white italic tracking-tighter">{stats.totalSalidas.toLocaleString()}</span>
                                    <span className="text-purple-500/50 text-xs font-black uppercase mb-1">Registros</span>
                                </div>
                            </div>
                            <div className="glass-card p-6 bg-slate-900/40 border-l-4 border-l-emerald-500 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Cantidad Total</span>
                                <div className="flex items-end gap-3">
                                    <span className="text-4xl font-black text-white italic tracking-tighter">{stats.cantidadTotal.toLocaleString()}</span>
                                    <span className="text-emerald-500/50 text-xs font-black uppercase mb-1">{selectedArticle?.unidad || 'unid'}</span>
                                </div>
                            </div>
                            <div className="glass-card p-6 bg-slate-900/40 border-l-4 border-l-blue-500 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Promedio Mensual</span>
                                <div className="flex items-end gap-3">
                                    <span className="text-4xl font-black text-white italic tracking-tighter">{stats.promedioMensual.toLocaleString()}</span>
                                    <span className="text-blue-500/50 text-xs font-black uppercase mb-1">/ mes</span>
                                </div>
                            </div>
                            <div className="glass-card p-6 bg-slate-900/40 border-l-4 border-l-amber-500 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Salidas Únicas</span>
                                <div className="flex items-end gap-3">
                                    <span className="text-4xl font-black text-white italic tracking-tighter">{stats.salidasUnicas.toLocaleString()}</span>
                                    <span className="text-amber-500/50 text-xs font-black uppercase mb-1">Salidas ID</span>
                                </div>
                            </div>
                        </div>

                        {/* Analysis & Chart */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Linear Regression Card */}
                            {chartData.regression && (
                                <div className="lg:col-span-4 glass-card p-8 bg-slate-900/50 border border-amber-500/20 relative overflow-hidden flex flex-col">
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent pointer-events-none" />
                                    <h3 className="text-xs font-black text-amber-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                                        <TrendingUp className="w-5 h-5" />
                                        Análisis de Regresión Lineal
                                    </h3>

                                    <div className="space-y-6 flex-1">
                                        <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Ecuación de la Recta</label>
                                            <div className="text-xl font-black text-amber-400 font-mono tracking-tight">{chartData.regression.equation}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Coeficiente R²</label>
                                                <div className="text-lg font-black text-white">{chartData.regression.r2.toFixed(4)}</div>
                                            </div>
                                            <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Pendiente (m)</label>
                                                <div className="text-lg font-black text-white">{chartData.regression.slope.toFixed(2)}</div>
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-6 border-t border-white/5">
                                            <div className="flex items-center justify-between p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20 shadow-2xl shadow-amber-950/20">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block">Predicción Próximo Mes</span>
                                                    <p className="text-3xl font-black text-white italic leading-none">{chartData.regression.prediction.toLocaleString()}</p>
                                                </div>
                                                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                                                    <TrendingUp className="w-6 h-6 text-amber-500" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Chart Card */}
                            <div className={`${chartData.regression ? 'lg:col-span-8' : 'lg:col-span-12'} glass-card p-8 bg-slate-900/40 min-h-[450px] flex flex-col`}>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                                    <BarChart3 className="w-5 h-5 text-purple-500" />
                                    Tendencia de Consumo Histórico
                                </h3>

                                <div className="flex-1 w-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData.data}>
                                            <defs>
                                                <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6} />
                                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                            <XAxis
                                                dataKey="label"
                                                stroke="#475569"
                                                fontSize={10}
                                                axisLine={false}
                                                tickLine={false}
                                                fontWeight="bold"
                                            />
                                            <YAxis
                                                stroke="#475569"
                                                fontSize={10}
                                                axisLine={false}
                                                tickLine={false}
                                                fontWeight="bold"
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#0f111a',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '16px',
                                                    padding: '12px',
                                                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                                                    backdropFilter: 'blur(20px)'
                                                }}
                                                itemStyle={{ fontWeight: '900', fontSize: '12px', textTransform: 'uppercase' }}
                                                labelStyle={{ color: '#64748b', fontWeight: 'bold', fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase' }}
                                            />
                                            <Legend
                                                verticalAlign="top"
                                                align="right"
                                                iconType="circle"
                                                wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '20px' }}
                                            />
                                            <Bar dataKey="cantidad" name="Consumo Real" fill="url(#colorBar)" radius={[6, 6, 0, 0]} />
                                            {chartData.regression && (
                                                <Line
                                                    type="monotone"
                                                    dataKey="regression"
                                                    name="Progreso Estadístico"
                                                    stroke="#fbbf24"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, fill: '#fbbf24', strokeWidth: 0 }}
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
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
                                    <Table className="w-5 h-5 text-emerald-500" />
                                    Listado Cronológico de Salidas
                                </h3>
                                <button
                                    onClick={handleExport}
                                    className="glass-button px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Exportar Excel
                                </button>
                            </div>

                            <div className="glass-card overflow-hidden bg-slate-900/40 border border-white/5">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-950/80 text-white text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/5">
                                                <th className="p-6">ID Salida</th>
                                                <th className="p-6">Fecha Efectiva</th>
                                                <th className="p-6 text-right">Cantidad</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.03]">
                                            {salidas.map((s) => (
                                                <tr key={s.id_salida} className="hover:bg-white/[0.03] transition-colors group h-16">
                                                    <td className="p-6">
                                                        <span className="font-mono text-sm font-black text-purple-400 group-hover:text-purple-300 transition-colors">#{s.id_salida}</span>
                                                    </td>
                                                    <td className="p-6 text-slate-200 font-bold text-sm">
                                                        {format(parseISO(s.fecha_salida), 'PPPP', { locale: es })}
                                                    </td>
                                                    <td className="p-6 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors font-mono">{s.cantidad.toLocaleString()}</span>
                                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest uppercase">{selectedArticle?.unidad}</span>
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

            {/* Premium Search Modal */}
            {showSearchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-300">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowSearchModal(false)} />

                    <div className="bg-[#0f141a] border border-white/10 rounded-[2.5rem] w-full max-w-5xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh] relative z-10 border-t-white/20">
                        {/* Header */}
                        <div className="px-10 py-8 bg-slate-900/50 border-b border-white/5 flex justify-between items-center group">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400">
                                    <Search className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Buscador Especializado</h3>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Localización de artículos por código o descriptivo</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSearchModal(false)}
                                className="w-12 h-12 glass-button text-slate-500 hover:text-white rounded-2xl flex items-center justify-center transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Search Input Area */}
                        <div className="px-10 py-8 bg-slate-950/40 relative">
                            <div className="relative group/search-input">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-600 group-focus-within/search-input:text-purple-500 transition-colors" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Escriba código o nombre del material..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-900/80 border border-white/10 rounded-[1.5rem] pl-16 pr-6 py-5 text-xl text-white font-bold placeholder-slate-700 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500/40 transition-all shadow-inner"
                                />
                                {searching && <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-purple-500 animate-spin" />}
                            </div>
                        </div>

                        {/* Results Area */}
                        <div className="flex-1 overflow-hidden flex flex-col bg-[#0f141a]">
                            <div className="flex-1 overflow-auto px-6 pb-10">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-[#0f141a]/95 backdrop-blur-lg">
                                        <tr className="border-b border-white/5">
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Referencia</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Código</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción del Artículo</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {articulosFound.map((art) => (
                                            <tr key={art.codigo_articulo} className="hover:bg-white/[0.02] transition-all group/row-search h-20">
                                                <td className="px-6 text-center">
                                                    <div className="w-12 h-12 bg-black/40 rounded-xl overflow-hidden border border-white/10 mx-auto transform group-hover/row-search:scale-110 transition-transform">
                                                        <img src={art.imagen_url || ''} className="w-full h-full object-cover" />
                                                    </div>
                                                </td>
                                                <td className="px-6">
                                                    <span className="font-mono text-sm font-black text-purple-400 bg-purple-500/5 px-3 py-1 rounded-lg border border-purple-500/10">
                                                        {art.codigo_articulo}
                                                    </span>
                                                </td>
                                                <td className="px-6">
                                                    <div className="font-black text-slate-200 group-hover/row-search:text-white transition-colors uppercase leading-tight">
                                                        {art.nombre_articulo}
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1 block">{art.unidad}</span>
                                                </td>
                                                <td className="px-6 text-center">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedArticle(art);
                                                            setShowSearchModal(false);
                                                            setSearchTerm('');
                                                            setHasSearched(false);
                                                        }}
                                                        className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mx-auto active:scale-95 transition-all shadow-lg shadow-purple-900/40"
                                                    >
                                                        Seleccionar
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {articulosFound.length === 0 && !searching && searchTerm.length >= 2 && (
                                            <tr>
                                                <td colSpan={4} className="text-center py-20">
                                                    <AlertCircle className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Sin coincidencias para la búsqueda</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-10 py-5 bg-slate-950/60 border-t border-white/5 flex justify-between items-center shrink-0">
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Criterio de búsqueda sensible a mayúsculas</span>
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">{articulosFound.length} Artículos Encontrados</span>
                                <div className="w-1 h-1 rounded-full bg-slate-700" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{searchTerm.length} Caracteres</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
