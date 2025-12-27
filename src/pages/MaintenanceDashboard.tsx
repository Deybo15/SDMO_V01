import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    FileText,
    CheckCircle2,
    Building2,
    Wrench,
    MapPin,
    Calendar,
    Activity,
    Search,
    ChevronLeft,
    ChevronRight,
    Download,
    TrendingUp,
    TrendingDown,
    XCircle,
    AlertCircle
} from 'lucide-react';
import {
    ResponsiveContainer,
    ComposedChart,
    BarChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Cell,
    PieChart,
    Pie
} from 'recharts';
import {
    format,
    parseISO,
    differenceInDays,
    subDays,
    parse,
    isValid,
    lastDayOfMonth
} from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { DashboardSkeleton } from '../components/Skeleton';
import VirtualizedTable from '../components/VirtualizedTable';

interface DashboardMetrics {
    totalSolicitudes: number;
    totalEjecutadas: number;
    porcentajeEjecucion: number;
    instalacionesIntervenidas: number;
    topInstalaciones: { name: string; count: number }[];
    solicitudesPorMes: { month: string; total: number; executed: number; percentage: number }[];
    solicitudesPorArea: { area: string; total: number; executed: number; percentage: number }[];
    performanceSupervisores: { supervisor: string; total: number; executed: number; pending: number; percentage: number }[];
}

interface ComparisonMetrics {
    totalSolicitudesChange: number;
    totalEjecutadasChange: number;
    porcentajeEjecucionChange: number;
    instalacionesIntervenidasChange: number;
}

export default function MaintenanceDashboard() {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [comparison, setComparison] = useState<ComparisonMetrics | null>(null);
    const [selectedArea, setSelectedArea] = useState<string | null>(null);
    const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [selectedInstallation, setSelectedInstallation] = useState<string | null>(null);

    // Default to current year (Jan 1 - Today)
    const [startDate, setStartDate] = useState<string>(() => {
        const date = new Date();
        return format(new Date(date.getFullYear(), 0, 1), 'yyyy-MM-dd');
    });
    const [endDate, setEndDate] = useState<string>(() => {
        return format(new Date(), 'yyyy-MM-dd');
    });

    const [tableData, setTableData] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    const [totalItems, setTotalItems] = useState(0);

    // Helper function for conditional classes
    function cn(...classes: (string | boolean | undefined)[]) {
        return classes.filter(Boolean).join(' ');
    }

    const fetchTableData = async (page: number) => {
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage - 1;

        const cleanSupervisor = selectedSupervisor ? selectedSupervisor.replace(/ \(\d+(\.\d+)?%\)$/, '') : null;
        let monthParam: string | null = null;
        if (selectedMonth) {
            const parsedM = parse(selectedMonth, 'MMM. yy', new Date(), { locale: es });
            if (isValid(parsedM)) monthParam = format(parsedM, 'yyyy-MM');
        }

        let query = supabase
            .from('vw_dashboard_analyzed')
            .select('*', { count: 'exact' })
            .gte('fecha_solicitud', startDate)
            .lte('fecha_solicitud', `${endDate} 23:59:59`)
            .order('numero_solicitud', { ascending: false })
            .range(start, end);

        if (selectedArea) query = query.eq('descripcion_area', selectedArea);
        if (cleanSupervisor) query = query.eq('supervisor_asignado_alias', cleanSupervisor);
        if (selectedInstallation) query = query.eq('base_location', selectedInstallation);

        if (monthParam) {
            const mStart = `${monthParam}-01`;
            const mLast = format(lastDayOfMonth(parseISO(mStart)), 'yyyy-MM-dd');
            query = query.gte('fecha_solicitud', mStart).lte('fecha_solicitud', `${mLast} 23:59:59`);
        }

        query = query.not('status_normalized', 'in', '("EJECUTADA","FINALIZADA","COMPLETADA","CERRADA")');

        const { data, count, error } = await query;
        if (error) {
            console.error("Table Error", error);
        } else {
            setTableData(data || []);
            setTotalItems(count || 0);
        }
    };

    const loadDashboard = async () => {
        setLoading(true);
        try {
            const start = parseISO(startDate);
            const end = parseISO(endDate);
            const daysDiff = differenceInDays(end, start) + 1;
            const prevEnd = subDays(start, 1);
            const prevStart = subDays(prevEnd, daysDiff - 1);
            const prevStartDateStr = format(prevStart, 'yyyy-MM-dd');
            const prevEndDateStr = format(prevEnd, 'yyyy-MM-dd');

            const cleanSupervisor = selectedSupervisor ? selectedSupervisor.replace(/ \(\d+(\.\d+)?%\)$/, '') : null;

            const rpcParams = {
                p_area: selectedArea,
                p_supervisor: cleanSupervisor,
                p_installation: selectedInstallation,
                p_month_filter: null
            };

            let monthParam = null;
            if (selectedMonth) {
                const parsedM = parse(selectedMonth, 'MMM. yy', new Date(), { locale: es });
                if (isValid(parsedM)) {
                    monthParam = format(parsedM, 'yyyy-MM');
                }
            }

            const [curRes, prevRes] = await Promise.all([
                supabase.rpc('get_dashboard_metrics_v2', {
                    p_start_date: startDate,
                    p_end_date: endDate,
                    ...rpcParams,
                    p_month_filter: monthParam
                }),
                supabase.rpc('get_dashboard_metrics_v2', {
                    p_start_date: prevStartDateStr,
                    p_end_date: prevEndDateStr,
                    ...rpcParams,
                    p_month_filter: monthParam
                })
            ]);

            if (curRes.error) throw curRes.error;
            if (curRes.data) {
                const cur = curRes.data;
                const prev = prevRes.data || { overall: { total: 0, executed: 0, coverage: 0 } };

                const pct = cur.overall.total > 0 ? (cur.overall.executed / cur.overall.total) * 100 : 0;
                const prevPct = prev.overall.total > 0 ? (prev.overall.executed / prev.overall.total) * 100 : 0;

                const solicitudesPorArea = (cur.areas || []).map((a: any) => ({
                    ...a,
                    percentage: a.total > 0 ? (a.executed / a.total) * 100 : 0
                }));

                const performanceSupervisores = (cur.supervisors || []).map((s: any) => {
                    const p = s.total > 0 ? (s.executed / s.total) * 100 : 0;
                    return {
                        supervisor: `${s.supervisor} (${p.toFixed(1)}%)`,
                        total: s.total,
                        executed: s.executed,
                        pending: s.total - s.executed,
                        percentage: p
                    };
                }).slice(0, 10);

                const solicitudesPorMes = (cur.months || []).map((m: any) => {
                    const d = parseISO(`${m.month_key}-01`);
                    return {
                        month: format(d, 'MMM. yy', { locale: es }),
                        total: m.total,
                        executed: m.executed,
                        percentage: m.total > 0 ? (m.executed / m.total) * 100 : 0
                    };
                });

                setMetrics({
                    totalSolicitudes: cur.overall.total,
                    totalEjecutadas: cur.overall.executed,
                    porcentajeEjecucion: pct,
                    instalacionesIntervenidas: cur.overall.coverage,
                    topInstalaciones: cur.installations || [],
                    solicitudesPorArea,
                    solicitudesPorMes,
                    performanceSupervisores
                });

                const calcChange = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;
                setComparison({
                    totalSolicitudesChange: calcChange(cur.overall.total, prev.overall.total),
                    totalEjecutadasChange: calcChange(cur.overall.executed, prev.overall.executed),
                    porcentajeEjecucionChange: pct - prevPct,
                    instalacionesIntervenidasChange: calcChange(cur.overall.coverage, prev.overall.coverage)
                });
            }

            await fetchTableData(1);

        } catch (error) {
            console.error("Dashboard Load Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // Main Data Loading Effect
    useEffect(() => {
        loadDashboard();
        setCurrentPage(1);
    }, [startDate, endDate, selectedArea, selectedSupervisor, selectedMonth, selectedInstallation]);

    // Table Pagination Effect
    useEffect(() => {
        fetchTableData(currentPage);
    }, [currentPage]);

    const handleExport = async () => {
        if (!metrics) return;
        setLoading(true);
        const cleanSupervisor = selectedSupervisor ? selectedSupervisor.replace(/ \(\d+(\.\d+)?%\)$/, '') : null;
        let query = supabase.from('vw_dashboard_analyzed').select('*');
        query = query.gte('fecha_solicitud', startDate).lte('fecha_solicitud', `${endDate} 23:59:59`);
        if (selectedArea) query = query.eq('descripcion_area', selectedArea);
        if (cleanSupervisor) query = query.eq('supervisor_asignado_alias', cleanSupervisor);
        if (selectedInstallation) query = query.eq('base_location', selectedInstallation);
        query = query.not('status_normalized', 'in', '("EJECUTADA","FINALIZADA","COMPLETADA","CERRADA")');

        const { data, error } = await query;
        if (error || !data) {
            setLoading(false);
            return;
        }

        const summaryData = [
            ["Reporte de Mantenimiento STI"],
            ["Generado el:", new Date().toLocaleString()],
            ["Periodo:", `${startDate} al ${endDate}`],
            ["Filtro Activo:", [selectedArea, selectedSupervisor, selectedMonth].filter(Boolean).join(", ") || "Ninguno"],
            [],
            ["Indicador", "Valor"],
            ["Solicitudes Totales", metrics.totalSolicitudes],
            ["Solicitudes Ejecutadas", metrics.totalEjecutadas],
            ["% Eficiencia Global", `${metrics.porcentajeEjecucion.toFixed(2)}%`],
            ["Instalaciones Intervenidas", metrics.instalacionesIntervenidas],
            [],
            ["Áreas de Trabajo (Top)"],
            ...metrics.solicitudesPorArea.map(a => [a.area, a.total, `${a.percentage.toFixed(1)}%`])
        ];

        const detailData = data.map(item => ({
            "Solicitud": item.numero_solicitud,
            "Fecha": item.fecha_solicitud,
            "Ubicación Base": item.base_location,
            "Instalación Original": item.instalacion_municipal,
            "Área": item.descripcion_area,
            "Descripción": item.descripcion_solicitud,
            "Estado": item.status_normalized
        }));

        const wb = XLSX.utils.book_new();
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        const wsDetail = XLSX.utils.json_to_sheet(detailData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
        XLSX.utils.book_append_sheet(wb, wsDetail, "Detalle Solicitudes (Pendientes)");
        XLSX.writeFile(wb, `Reporte_STI_${startDate}_${endDate}.xlsx`);
        setLoading(false);
    };

    const currentTableItems = tableData;

    const TrendBadge = ({ value, isPercentage = false }: { value?: number, isPercentage?: boolean }) => {
        if (value === undefined) return null;
        const isPositive = value >= 0;
        const Icon = isPositive ? TrendingUp : TrendingDown;
        const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';

        return (
            <div className={cn("flex items-center gap-1 text-xs font-medium mt-2", colorClass)}>
                <Icon className="w-3 h-3" />
                <span>{Math.abs(value).toFixed(1)}{isPercentage ? ' pts' : '%'} vs periodo anterior</span>
            </div>
        );
    };

    const CustomTooltip = ({ active, payload, label, unit = "" }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="glass-dark px-4 py-3 rounded-2xl border border-white/10 shadow-2xl animate-scale-up">
                    <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">{label}</p>
                    <div className="space-y-1.5">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                                <span className="text-slate-200 text-sm font-medium">{entry.name}:</span>
                                <span className="text-white text-sm font-bold">
                                    {typeof entry.value === 'number' && entry.name.includes('%')
                                        ? `${entry.value.toFixed(1)}%`
                                        : entry.value}
                                    {unit && ` ${unit}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    if (!metrics && loading) {
        return <DashboardSkeleton />;
    }

    if (!metrics) return null;

    return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 p-8 relative selection:bg-blue-500/30">
            {/* Background elements for depth */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-float"></div>
            </div>

            <svg style={{ height: 0, width: 0, position: 'absolute' }}>
                <defs>
                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={1} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={1} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={1} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={1} />
                        <stop offset="95%" stopColor="#ea580c" stopOpacity={0.4} />
                    </linearGradient>
                </defs>
            </svg>

            {loading && (
                <div className="fixed bottom-8 right-8 glass text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 text-sm font-semibold animate-slide-up">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    Sincronizando...
                </div>
            )}

            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Activity className="w-8 h-8 text-emerald-500" />
                        Panel de Control de Mantenimiento (STI)
                    </h1>
                    <div className="flex items-center gap-3 mt-2">
                        <p className="text-slate-400">Comparativa de Desempeño y Cobertura</p>
                        <div className="flex flex-wrap gap-2">
                            {selectedArea && (
                                <button onClick={() => setSelectedArea(null)} className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-blue-500/30 transition-colors">
                                    Área: {selectedArea} <XCircle className="w-3 h-3" />
                                </button>
                            )}
                            {selectedSupervisor && (
                                <button onClick={() => setSelectedSupervisor(null)} className="flex items-center gap-1 bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-purple-500/30 transition-colors">
                                    Sup: {selectedSupervisor.split('(')[0]} <XCircle className="w-3 h-3" />
                                </button>
                            )}
                            {selectedMonth && (
                                <button onClick={() => setSelectedMonth(null)} className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-emerald-500/30 transition-colors">
                                    Mes: {selectedMonth} <XCircle className="w-3 h-3" />
                                </button>
                            )}
                            {selectedInstallation && (
                                <button onClick={() => setSelectedInstallation(null)} className="flex items-center gap-1 bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-orange-500/30 transition-colors">
                                    Instalación: {selectedInstallation} <XCircle className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 items-center">
                    <button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors border border-blue-500 shadow-lg shadow-blue-900/20">
                        <Download className="w-4 h-4" /> Exportar Reporte
                    </button>
                    <div className="flex gap-4 bg-slate-800 p-2 rounded-lg border border-slate-700">
                        <div className='flex flex-col'>
                            <label className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Desde</label>
                            <input type="date" className="bg-slate-700 text-white text-sm rounded px-3 py-1 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className='flex flex-col'>
                            <label className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Hasta</label>
                            <input type="date" className="bg-slate-700 text-white text-sm rounded px-3 py-1 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-6 mb-10 transition-all duration-700", loading ? 'opacity-50' : 'opacity-100')}>
                <div className="glass-card p-6 group animate-float" style={{ animationDelay: '0s' }}>
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-blue-500/10 rounded-2xl group-hover:bg-blue-500/20 transition-colors">
                            <FileText className="w-7 h-7 text-blue-400" />
                        </div>
                        <span className="bg-white/5 text-slate-400 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border border-white/5">VOLUMEN</span>
                    </div>
                    <div>
                        <p className="text-slate-400 text-sm font-medium tracking-tight">Solicitudes Totales</p>
                        <p className="text-5xl font-black text-white mt-1 tracking-tighter">{metrics.totalSolicitudes}</p>
                        <TrendBadge value={comparison?.totalSolicitudesChange} />
                    </div>
                </div>

                <div className="glass-card p-6 group animate-float" style={{ animationDelay: '0.2s' }}>
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-emerald-500/10 rounded-2xl group-hover:bg-emerald-500/20 transition-colors">
                            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                        </div>
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border border-emerald-500/10">ÉXITO</span>
                    </div>
                    <div>
                        <p className="text-slate-400 text-sm font-medium tracking-tight">Completadas</p>
                        <p className="text-5xl font-black text-white mt-1 tracking-tighter">{metrics.totalEjecutadas}</p>
                        <TrendBadge value={comparison?.totalEjecutadasChange} />
                    </div>
                </div>

                <div className="glass-card p-6 group flex flex-col items-center justify-between animate-float" style={{ animationDelay: '0.4s' }}>
                    <div className="w-full h-[140px] flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={[{ value: 100 }]} cx="50%" cy="100%" startAngle={180} endAngle={0} innerRadius={70} outerRadius={90} dataKey="value" stroke="none" fill="rgba(255,255,255,0.03)" />
                                <Pie data={[{ value: metrics.porcentajeEjecucion }, { value: 100 - metrics.porcentajeEjecucion }]} cx="50%" cy="100%" startAngle={180} endAngle={0} innerRadius={70} outerRadius={90} dataKey="value" stroke="none" cornerRadius={10} >
                                    <Cell fill="url(#purpleGradient)" />
                                    <Cell fill="transparent" />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute bottom-0 mb-4 flex flex-col items-center">
                            <p className="text-4xl font-black text-white tracking-tighter">{metrics.porcentajeEjecucion.toFixed(1)}%</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-center z-10">
                        <p className="text-slate-400 text-sm font-medium tracking-tight">Eficiencia Global</p>
                        <TrendBadge value={comparison?.porcentajeEjecucionChange} isPercentage={true} />
                    </div>
                </div>

                <div className="glass-card p-6 group animate-float" style={{ animationDelay: '0.6s' }}>
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-orange-500/10 rounded-2xl group-hover:bg-orange-500/20 transition-colors">
                            <Building2 className="w-7 h-7 text-orange-400" />
                        </div>
                        <span className="bg-orange-500/10 text-orange-400 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border border-orange-500/10">COBERTURA</span>
                    </div>
                    <div>
                        <p className="text-slate-400 text-sm font-medium tracking-tight">Instalaciones</p>
                        <p className="text-5xl font-black text-white mt-1 tracking-tighter">{metrics.instalacionesIntervenidas}</p>
                        <TrendBadge value={comparison?.instalacionesIntervenidasChange} />
                    </div>
                </div>
            </div>

            <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 transition-opacity duration-300", loading ? 'opacity-50' : 'opacity-100')}>
                <div className="glass-card p-8 lg:col-span-2 shadow-blue-500/5 border-white/5">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <Wrench className="w-5 h-5 text-blue-400" />
                            </div>
                            Desempeño por Área de Trabajo
                        </h3>
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={metrics.solicitudesPorArea} onClick={(data) => data?.activeLabel && setSelectedArea(data.activeLabel)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="area" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={80} tick={{ fill: '#fbbf24', fontWeight: 700 }} />
                                <YAxis yAxisId="left" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#fbbf24', fontWeight: 700 }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={12} tickLine={false} axisLine={false} unit="%" tick={{ fill: '#fbbf24', fontWeight: 700 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                <Legend wrapperStyle={{ paddingTop: '30px' }} formatter={(value) => <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{value}</span>} />
                                <Bar yAxisId="left" dataKey="total" name="Totales" fill="url(#blueGradient)" radius={[8, 8, 0, 0]} barSize={45}>
                                    {metrics.solicitudesPorArea.map((entry, index) => <Cell key={`cell-${index}`} fill={selectedArea === entry.area ? '#f59e0b' : 'url(#blueGradient)'} />)}
                                </Bar>
                                <Line yAxisId="right" type="monotone" dataKey="percentage" name="% Ejecución" stroke="#f59e0b" strokeWidth={4} dot={{ fill: '#070b14', stroke: '#f59e0b', strokeWidth: 2, r: 5 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-8 border-white/5">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-orange-400" />
                            </div>
                            Hot-spots de Cobertura
                        </h3>
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={metrics.topInstalaciones} margin={{ left: 20 }} onClick={(data) => data?.activeLabel && setSelectedInstallation(data.activeLabel)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#fbbf24', fontWeight: 700 }} />
                                <YAxis type="category" dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} width={150} tick={{ fill: '#fbbf24', fontWeight: 700 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                <Bar dataKey="count" name="Intervenciones" fill="url(#orangeGradient)" radius={[0, 8, 8, 0]} barSize={20}>
                                    {metrics.topInstalaciones.map((entry, index) => <Cell key={`cell-${index}`} fill={selectedInstallation === entry.name ? '#f59e0b' : 'url(#orangeGradient)'} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-8 border-white/5">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-emerald-400" />
                            </div>
                            Histórico de Solicitudes
                        </h3>
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={metrics.solicitudesPorMes} onClick={(data) => data?.activeLabel && setSelectedMonth(data.activeLabel)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="month" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#fbbf24', fontWeight: 700 }} />
                                <YAxis yAxisId="left" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#fbbf24', fontWeight: 700 }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={12} tickLine={false} axisLine={false} unit="%" tick={{ fill: '#fbbf24', fontWeight: 700 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                <Legend wrapperStyle={{ paddingTop: '30px' }} formatter={(value) => <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{value}</span>} />
                                <Bar yAxisId="left" dataKey="total" name="Recibidas" fill="url(#blueGradient)" radius={[8, 8, 0, 0]} barSize={20}>
                                    {metrics.solicitudesPorMes.map((entry, index) => <Cell key={`cell-${index}`} fill={selectedMonth === entry.month ? '#f59e0b' : 'url(#blueGradient)'} />)}
                                </Bar>
                                <Line yAxisId="right" type="monotone" dataKey="percentage" name="% Ejecución" stroke="#10b981" strokeWidth={4} dot={{ fill: '#070b14', stroke: '#10b981', strokeWidth: 2, r: 5 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-8 lg:col-span-2 border-white/5">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-purple-400" />
                            </div>
                            Gestión por Supervisión
                        </h3>
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={metrics.performanceSupervisores} layout="vertical" margin={{ left: 100, right: 20 }} onClick={(data) => data?.activeLabel && setSelectedSupervisor(data.activeLabel)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#fbbf24', fontWeight: 700 }} />
                                <YAxis type="category" dataKey="supervisor" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} interval={0} width={200} tick={{ fill: '#fbbf24', fontWeight: 700 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                <Legend wrapperStyle={{ paddingTop: '30px' }} formatter={(value) => <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{value}</span>} />
                                <Bar dataKey="executed" name="Completado" stackId="a" fill="url(#emeraldGradient)" radius={[0, 0, 0, 0]} barSize={25}>
                                    {metrics.performanceSupervisores.map((entry, index) => <Cell key={`cell-${index}`} fill={selectedSupervisor === entry.supervisor ? '#10b981' : 'url(#emeraldGradient)'} />)}
                                </Bar>
                                <Bar dataKey="pending" name="Pendiente" stackId="a" fill="url(#orangeGradient)" radius={[0, 8, 8, 0]} barSize={25} className="cursor-pointer">
                                    {metrics.performanceSupervisores.map((entry, index) => <Cell key={`cell-${index}`} fill={selectedSupervisor === entry.supervisor ? '#f97316' : 'url(#orangeGradient)'} />)}
                                </Bar>
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className={cn("glass-card p-8 transition-all duration-700", loading ? 'opacity-50' : 'opacity-100 shadow-2xl shadow-blue-500/5')}>
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
                        <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                            <Search className="w-5 h-5 text-slate-400" />
                        </div>
                        Solicitudes Activas <span className="text-blue-400">({totalItems})</span>
                    </h3>
                </div>
                {/* Active Requests Table with Virtualization */}
                <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl h-[500px] flex flex-col">
                    {currentTableItems.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
                            <div className="w-20 h-20 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center shadow-inner">
                                <AlertCircle className="w-10 h-10 text-slate-700" />
                            </div>
                            <p className="font-bold text-slate-500 uppercase tracking-[0.2em] text-sm">Sin registros activos</p>
                        </div>
                    ) : (
                        <VirtualizedTable
                            data={currentTableItems}
                            rowHeight={70}
                            columns={[
                                { header: 'ID', width: '100px', className: 'font-black text-blue-400' },
                                { header: 'Fecha', width: '150px', className: 'font-mono text-slate-400' },
                                { header: 'Ubicación', width: '300px' },
                                { header: 'Área', width: '200px' },
                                { header: 'Responsable', width: '250px' },
                            ]}
                            renderCell={(item, colIdx) => {
                                switch (colIdx) {
                                    case 0:
                                        return <span className="uppercase tracking-tighter">#{item.numero_solicitud}</span>;
                                    case 1:
                                        return <span>{item.fecha_solicitud}</span>;
                                    case 2:
                                        return <span className="font-semibold truncate block" title={item.base_location}>{item.base_location}</span>;
                                    case 3:
                                        return (
                                            <span className="bg-white/5 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-400 border border-white/5 uppercase tracking-widest">
                                                {item.descripcion_area || 'GENÉRICO'}
                                            </span>
                                        );
                                    case 4:
                                        return (
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-[10px] font-black text-slate-200 border border-white/10 shadow-lg">
                                                    {(item.supervisor_asignado_alias || '?')[0]}
                                                </div>
                                                <span className="font-medium text-slate-300 truncate">{item.supervisor_asignado_alias || 'PENDIENTE'}</span>
                                            </div>
                                        );
                                    default:
                                        return null;
                                }
                            }}
                        />
                    )}
                </div>

                {totalItems > 0 && (
                    <div className="mt-6 flex justify-between items-center bg-black/20 p-4 rounded-2xl border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                                Mostrando {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} solicitudes
                            </span>
                            <div className="h-1 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-500"
                                    style={{ width: `${(Math.min(currentPage * itemsPerPage, totalItems) / totalItems) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="w-12 h-12 flex items-center justify-center bg-slate-900 border border-white/5 rounded-2xl hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                            >
                                <ChevronLeft className="w-6 h-6 text-slate-300" />
                            </button>
                            <div className="flex px-6 items-center bg-slate-950 border border-white/5 rounded-2xl text-[10px] text-white font-black tracking-[0.2em] uppercase">
                                PÁGINA {currentPage} / {Math.max(1, Math.ceil(totalItems / itemsPerPage))}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalItems / itemsPerPage)))}
                                disabled={currentPage >= Math.ceil(totalItems / itemsPerPage)}
                                className="w-12 h-12 flex items-center justify-center bg-slate-900 border border-white/5 rounded-2xl hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                            >
                                <ChevronRight className="w-6 h-6 text-slate-300" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
