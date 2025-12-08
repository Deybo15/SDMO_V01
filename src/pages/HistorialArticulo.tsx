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
    ChevronLeft,
    ChevronRight,
    Download
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
    ResponsiveContainer
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { utils, writeFile } from 'xlsx';

// Interfaces
interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
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

    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

    const [salidas, setSalidas] = useState<SalidaProcessed[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const [showModal, setShowModal] = useState(false);





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
                    .select('codigo_articulo, nombre_articulo')
                    .or(`nombre_articulo.ilike.%${searchTerm}%,codigo_articulo.ilike.%${searchTerm}%`)
                    .limit(15);

                if (error) throw error;
                setArticulosFound(data || []);
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
            alert('Seleccione un artículo');
            return;
        }
        if (!dateFrom || !dateTo) {
            alert('Seleccione las fechas');
            return;
        }

        setLoading(true);
        setHasSearched(true);
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
        } catch (error: any) {
            console.error('Error fetching salidas:', error);
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Export to Excel (XLSX)
    const handleExport = () => {
        try {
            if (salidas.length === 0) return;

            // Prepare data for Excel
            const dataToExport = salidas.map(s => ({
                'ID Salida': s.id_salida,
                'Fecha': format(parseISO(s.fecha_salida), 'dd/MM/yyyy'),
                'Cantidad': s.cantidad,
                'Registro': s.registro
            }));

            // Create worksheet
            const ws = utils.json_to_sheet(dataToExport);

            // Auto-width columns
            const wscols = [
                { wch: 10 }, // ID
                { wch: 15 }, // Fecha
                { wch: 10 }, // Cantidad
                { wch: 50 }  // Registro
            ];
            ws['!cols'] = wscols;

            // Create workbook
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Historial");

            // Generate filename
            const fileName = `historial_${selectedArticle?.codigo_articulo || 'articulo'}_${dateFrom}_${dateTo}.xlsx`;

            // Save file
            writeFile(wb, fileName);

        } catch (error) {
            console.error('Error exporting Excel:', error);
            alert('Error al exportar: ' + (error as Error).message);
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

        // Group by month
        const grouped: Record<string, number> = {};
        salidas.forEach(s => {
            const monthKey = s.fecha_salida.substring(0, 7); // YYYY-MM
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

        // Linear Regression
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

            // R2
            const yMean = sumY / n;
            const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
            const residualSumSquares = y.reduce((sum, yi, i) => {
                const predicted = slope * x[i] + intercept;
                return sum + Math.pow(yi - predicted, 2);
            }, 0);
            const r2 = 1 - (residualSumSquares / totalSumSquares);

            // Add regression points
            data.forEach((d, i) => {
                d.regression = slope * i + intercept;
            });

            const nextMonthPrediction = slope * n + intercept;

            regressionInfo = {
                slope,
                intercept,
                r2,
                equation: `y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`,
                prediction: Math.round(nextMonthPrediction)
            };
        }

        return { data, regression: regressionInfo };
    }, [salidas]);

    return (
        <div className="min-h-screen bg-[#0f1419] text-slate-200 font-sans relative">
            {/* Custom Styles from User Request */}
            <style>{`
                .glass {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .glass-dark {
                    background: rgba(0, 0, 0, 0.2);
                    backdrop-filter: blur(15px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .glass-button {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    transition: all 0.3s ease;
                }
                .glass-button:hover {
                    background: rgba(255, 255, 255, 0.2);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
                }
                .glass-input {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                }
                .glass-input:focus {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(168, 85, 247, 0.5);
                    outline: none;
                }
                .gradient-text {
                    background: linear-gradient(135deg, #a855f7, #3b82f6, #06b6d4);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .stat-card-blue { background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.05)); border: 1px solid rgba(59, 130, 246, 0.3); }
                .stat-card-emerald { background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(16, 185, 129, 0.3); }
                .stat-card-purple { background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.05)); border: 1px solid rgba(168, 85, 247, 0.3); }
                .stat-card-orange { background: linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(249, 115, 22, 0.05)); border: 1px solid rgba(249, 115, 22, 0.3); }
                .regression-info {
                    background: linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(255, 193, 7, 0.05));
                    border: 1px solid rgba(255, 193, 7, 0.3);
                    backdrop-filter: blur(10px);
                }
            `}</style>

            {/* Header */}
            {/* Header Standardized */}
            <div className="sticky top-0 z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 mb-8 bg-[#0f1419]/90 backdrop-blur-xl -mx-4 px-4 md:-mx-8 md:px-8 border-b border-white/5 shadow-lg shadow-black/20 transition-all">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                            Historial de Artículo
                        </h1>
                    </div>
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 border border-white/10 rounded-xl hover:bg-slate-700 transition-all shadow-sm"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Regresar
                </button>
            </div>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Filters */}
                <div className="glass rounded-xl shadow-xl border border-white/20 p-6 mb-8">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center">
                        <Filter className="w-5 h-5 mr-2 text-purple-300" />
                        Filtros de Consulta
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        {/* Search */}
                        {/* Search Trigger */}
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-medium text-white/90 mb-2">
                                <Package className="w-4 h-4 inline mr-1 text-purple-300" />
                                Artículo
                            </label>

                            {selectedArticle ? (
                                <div className="p-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg flex items-center justify-between group">
                                    <div className="flex items-center space-x-3 overflow-hidden">
                                        <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center border border-purple-500/30 shrink-0">
                                            <Package className="w-4 h-4 text-purple-300" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="text-sm font-bold text-white truncate">{selectedArticle.nombre_articulo}</div>
                                            <div className="text-xs text-purple-300 font-mono">{selectedArticle.codigo_articulo}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <button
                                            onClick={() => setShowSearchModal(true)}
                                            className="p-1.5 text-blue-300 hover:text-white hover:bg-blue-500/20 rounded-lg transition-colors mr-1"
                                            title="Cambiar artículo"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedArticle(null);
                                                setSearchTerm('');
                                                setSalidas([]);
                                                setHasSearched(false);
                                            }}
                                            className="p-1.5 text-red-300 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                                            title="Quitar artículo"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setShowSearchModal(true);
                                    }}
                                    className="w-full glass-input text-left px-4 py-3 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center justify-between group border border-white/10 hover:border-purple-500/50"
                                >
                                    <span className="flex items-center">
                                        <Search className="w-4 h-4 mr-2 opacity-50 group-hover:opacity-100 transition-opacity" />
                                        Buscar artículo...
                                    </span>
                                    <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/40 group-hover:text-white/80 transition-colors">
                                        Click para buscar
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Dates */}
                        <div className="lg:col-span-1">
                            <label className="block text-sm font-medium text-white/90 mb-2">
                                <Calendar className="w-4 h-4 inline mr-1 text-emerald-300" />
                                Desde
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="glass-input w-full rounded-lg px-3 py-3 text-white focus:outline-none transition-all duration-300"
                            />
                        </div>
                        <div className="lg:col-span-1">
                            <label className="block text-sm font-medium text-white/90 mb-2">
                                <Calendar className="w-4 h-4 inline mr-1 text-emerald-300" />
                                Hasta
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="glass-input w-full rounded-lg px-3 py-3 text-white focus:outline-none transition-all duration-300"
                            />
                        </div>

                        {/* Actions */}
                        <div className="lg:col-span-1 space-y-2">
                            <label className="block text-sm font-medium text-white/90 mb-2">Acciones</label>
                            <button
                                onClick={handleConsultar}
                                disabled={loading}
                                className="glass-button w-full px-4 py-3 text-white font-bold rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 text-sm hover:bg-white/20"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                <span>Consultar</span>
                            </button>

                            {hasSearched && salidas.length > 0 && (
                                <>
                                    <button
                                        onClick={() => setShowModal(true)}
                                        className="glass-button w-full px-4 py-2 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30"
                                    >
                                        <BarChart2 className="w-4 h-4" />
                                        <span>Consumo</span>
                                    </button>
                                    <button
                                        onClick={handleExport}
                                        className="glass-button w-full px-4 py-2 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>Exportar Excel</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="glass rounded-xl shadow-xl border border-white/20 p-16 text-center">
                        <Loader2 className="w-12 h-12 text-purple-400 mx-auto mb-4 animate-spin" />
                        <p className="text-white/60">Consultando salidas...</p>
                    </div>
                ) : hasSearched && salidas.length === 0 ? (
                    <div className="glass rounded-xl shadow-xl border border-white/20 p-16 text-center">
                        <Inbox className="w-12 h-12 text-white/40 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">No se encontraron salidas</h3>
                        <p className="text-white/60">No hay salidas registradas para el artículo y rango de fechas seleccionados.</p>
                    </div>
                ) : hasSearched && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="stat-card-blue rounded-lg p-4 shadow-xl">
                                <div className="flex items-center">
                                    <div className="p-2 bg-blue-500/20 rounded-lg backdrop-blur-sm">
                                        <Package className="w-5 h-5 text-blue-300" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-xs font-semibold text-blue-300">Total Salidas</p>
                                        <p className="text-xl font-bold text-white">{stats.totalSalidas.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="stat-card-emerald rounded-lg p-4 shadow-xl">
                                <div className="flex items-center">
                                    <div className="p-2 bg-emerald-500/20 rounded-lg backdrop-blur-sm">
                                        <TrendingUp className="w-5 h-5 text-emerald-300" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-xs font-semibold text-emerald-300">Cantidad Total</p>
                                        <p className="text-xl font-bold text-white">{stats.cantidadTotal.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="stat-card-purple rounded-lg p-4 shadow-xl">
                                <div className="flex items-center">
                                    <div className="p-2 bg-purple-500/20 rounded-lg backdrop-blur-sm">
                                        <CalendarDays className="w-5 h-5 text-purple-300" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-xs font-semibold text-purple-300">Promedio Mensual</p>
                                        <p className="text-xl font-bold text-white">{stats.promedioMensual.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="stat-card-orange rounded-lg p-4 shadow-xl">
                                <div className="flex items-center">
                                    <div className="p-2 bg-orange-500/20 rounded-lg backdrop-blur-sm">
                                        <Users className="w-5 h-5 text-orange-300" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-xs font-semibold text-orange-300">Salidas Únicas</p>
                                        <p className="text-xl font-bold text-white">{stats.salidasUnicas.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Regression Info */}
                        {chartData.regression && (
                            <div className="regression-info rounded-xl p-6 mb-6">
                                <h3 className="text-lg font-bold text-yellow-300 mb-4 flex items-center">
                                    <TrendingUp className="w-5 h-5 mr-2" />
                                    Análisis de Regresión Lineal
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="bg-white/10 rounded-lg p-4 text-center border border-white/10">
                                        <div className="text-sm text-white/70">Ecuación</div>
                                        <div className="text-lg font-bold text-yellow-300">{chartData.regression.equation}</div>
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-4 text-center border border-white/10">
                                        <div className="text-sm text-white/70">Coeficiente R²</div>
                                        <div className="text-lg font-bold text-yellow-300">{chartData.regression.r2.toFixed(3)}</div>
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-4 text-center border border-white/10">
                                        <div className="text-sm text-white/70">Pendiente</div>
                                        <div className="text-lg font-bold text-yellow-300">{chartData.regression.slope.toFixed(2)}</div>
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-4 text-center border border-white/10">
                                        <div className="text-sm text-white/70">Predicción próximo mes</div>
                                        <div className="text-lg font-bold text-yellow-300">{chartData.regression.prediction}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Chart */}
                        <div className="glass rounded-xl shadow-xl border border-white/20 p-6 mb-6">
                            <h2 className="text-lg font-bold text-white flex items-center mb-4">
                                <BarChart3 className="w-5 h-5 mr-2 text-purple-300" />
                                Tendencia de Salidas por Mes
                            </h2>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData.data}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.8)' }} />
                                        <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.8)' }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Legend />
                                        <Bar dataKey="cantidad" name="Cantidad" fill="rgba(168, 85, 247, 0.6)" radius={[4, 4, 0, 0]} />
                                        {chartData.regression && (
                                            <Line type="monotone" dataKey="regression" name="Regresión Lineal" stroke="#fbbf24" strokeWidth={3} dot={{ r: 4, fill: '#fbbf24' }} />
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="glass rounded-xl shadow-xl border border-white/20 overflow-hidden">
                            <div className="glass-dark p-4 border-b border-white/20 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-white flex items-center">
                                    <Table className="w-5 h-5 mr-2 text-emerald-300" />
                                    Listado de Salidas
                                </h2>
                                <span className="text-sm text-white/70">{salidas.length} registros</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-white/20 bg-white/5">
                                            <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">ID Salida</th>
                                            <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">Fecha</th>
                                            <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider text-right">Cantidad</th>
                                            <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">Registro</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {salidas.map((s, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-white">{s.id_salida}</td>
                                                <td className="px-6 py-4 text-sm text-white/80">{format(parseISO(s.fecha_salida), 'dd/MM/yyyy')}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-white text-right">{s.cantidad.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-sm text-white/80">{s.registro}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Search Modal */}
            {showSearchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#0f1419] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center shrink-0">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <Search className="w-5 h-5 text-purple-400" />
                                Buscar Artículo
                            </h3>
                            <button onClick={() => setShowSearchModal(false)} className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-white/5 shrink-0 bg-[#0f1419]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Buscar por nombre o código..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden p-0 flex flex-col bg-[#0f1419]">
                            {searching ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2 text-purple-500" />
                                    <p>Buscando artículos...</p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-md text-slate-200 shadow-sm">
                                            <tr>
                                                <th className="p-4 font-semibold w-32 text-left">Código</th>
                                                <th className="p-4 font-semibold text-left">Descripción</th>
                                                <th className="p-4 font-semibold w-24 text-center">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {articulosFound.map((art) => (
                                                <tr key={art.codigo_articulo} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-4 font-mono text-sm text-purple-300">
                                                        {art.codigo_articulo}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-medium text-white">{art.nombre_articulo}</div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedArticle(art);
                                                                setShowSearchModal(false);
                                                                setSearchTerm('');
                                                            }}
                                                            className="p-2 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white rounded-lg transition-colors"
                                                        >
                                                            <ChevronRight className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {articulosFound.length === 0 && !searching && searchTerm.length >= 2 && (
                                                <tr>
                                                    <td colSpan={3} className="text-center py-12 text-slate-500">
                                                        <p>No se encontraron resultados para "{searchTerm}"</p>
                                                    </td>
                                                </tr>
                                            )}
                                            {searchTerm.length < 2 && (
                                                <tr>
                                                    <td colSpan={3} className="text-center py-12 text-slate-500">
                                                        <p>Ingrese al menos 2 caracteres para buscar</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-white/5 border-t border-white/10 text-center text-xs text-slate-500 shrink-0">
                            Mostrando {articulosFound.length} resultados
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Consumo */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-white/20 flex flex-col bg-[#0f1419]">
                        <div className="glass-dark px-6 py-4 flex items-center justify-between border-b border-white/20 shrink-0">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-emerald-500/20 rounded-lg backdrop-blur-sm">
                                    <BarChart2 className="w-6 h-6 text-emerald-300" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Análisis de Consumo Mensual</h3>
                                    <p className="text-white/70 text-sm">
                                        {selectedArticle?.nombre_articulo} • {dateFrom} a {dateTo}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="glass-button p-2 rounded-lg transition-all duration-300 text-white hover:bg-white/20"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Modal Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                                    <div className="text-2xl font-bold text-blue-300">{chartData.data.length}</div>
                                    <div className="text-sm text-white/70">Meses Analizados</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                                    <div className="text-2xl font-bold text-emerald-300">{stats.promedioMensual.toLocaleString()}</div>
                                    <div className="text-sm text-white/70">Promedio Mensual</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                                    <div className="text-2xl font-bold text-purple-300">
                                        {Math.max(...chartData.data.map(d => d.cantidad), 0).toLocaleString()}
                                    </div>
                                    <div className="text-sm text-white/70">Máximo Mensual</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                                    <div className="text-2xl font-bold text-orange-300">{stats.cantidadTotal.toLocaleString()}</div>
                                    <div className="text-sm text-white/70">Total Período</div>
                                </div>
                            </div>

                            {/* Modal Chart */}
                            <div className="glass rounded-xl p-6 mb-6 border border-white/10">
                                <h4 className="text-lg font-semibold text-white mb-4 text-center">Consumo Mensual con Regresión Lineal</h4>
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData.data}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.8)' }} />
                                            <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.8)' }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                            <Legend />
                                            <Bar dataKey="cantidad" name="Cantidad" fill="rgba(16, 185, 129, 0.7)" radius={[4, 4, 0, 0]} />
                                            {chartData.regression && (
                                                <Line type="monotone" dataKey="regression" name="Regresión Lineal" stroke="#fbbf24" strokeWidth={3} dot={{ r: 4, fill: '#fbbf24' }} />
                                            )}
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Modal Table */}
                            <div>
                                <h4 className="text-lg font-semibold text-white mb-4">Datos Detallados</h4>
                                <div className="overflow-x-auto rounded-lg border border-white/10">
                                    <table className="w-full text-left">
                                        <thead className="bg-white/5">
                                            <tr>
                                                <th className="px-4 py-3 text-xs font-bold text-white uppercase">Mes</th>
                                                <th className="px-4 py-3 text-xs font-bold text-white uppercase text-right">Cantidad</th>
                                                <th className="px-4 py-3 text-xs font-bold text-white uppercase text-right">% del Total</th>
                                                <th className="px-4 py-3 text-xs font-bold text-white uppercase text-center">Tendencia</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {chartData.data.map((d, i) => {
                                                const prev = chartData.data[i - 1]?.cantidad || 0;
                                                const trend = i === 0 ? '→' : d.cantidad > prev ? '↗' : d.cantidad < prev ? '↘' : '→';
                                                const percent = stats.cantidadTotal > 0 ? (d.cantidad / stats.cantidadTotal * 100).toFixed(1) : '0.0';

                                                return (
                                                    <tr key={i} className="hover:bg-white/5">
                                                        <td className="px-4 py-3 text-sm font-medium text-white">{d.label}</td>
                                                        <td className="px-4 py-3 text-sm font-bold text-white text-right">{d.cantidad.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-sm text-white/80 text-right">{percent}%</td>
                                                        <td className="px-4 py-3 text-lg text-white text-center">{trend}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
