import { useState, useEffect, useCallback } from 'react';
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
    AlertCircle,
    Layers,
    PlayCircle,
    CheckCircle,
    X
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
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

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
                        eficiencia: m.total > 0 ? (m.executed / m.total) * 100 : 0
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

    useEffect(() => {
        loadDashboard();
        setCurrentPage(1);
    }, [startDate, endDate, selectedArea, selectedSupervisor, selectedMonth, selectedInstallation]);

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

    const TrendBadge = ({ value, isPercentage = false }: { value?: number, isPercentage?: boolean }) => {
        if (value === undefined) return null;
        const isPositive = value >= 0;
        const Icon = isPositive ? TrendingUp : TrendingDown;
        const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';

        return (
            <div className={cn("flex items-center gap-1 text-[10px] font-black mt-2 uppercase tracking-tight", colorClass)}>
                <Icon className="w-3 h-3" />
                <span>{Math.abs(value).toFixed(1)}{isPercentage ? ' pts' : '%'} vs periodo anterior</span>
            </div>
        );
    };

    const CustomTooltip = ({ active, payload, label, unit = "" }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#1E293B]/90 backdrop-blur-xl px-4 py-3 rounded-2xl border border-white/10 shadow-2xl">
                    <p className="text-slate-400 text-[10px] font-black mb-2 uppercase tracking-widest leading-none">{label}</p>
                    <div className="space-y-1.5">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                                <span className="text-slate-200 text-xs font-bold">{entry.name}:</span>
                                <span className="text-white text-xs font-black italic">
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
        <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans relative">
            {/* Background Halos */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[85%] left-[20%] w-[80rem] h-[80rem] bg-amber-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
                <div className="absolute top-[15%] right-[20%] w-[80rem] h-[80rem] bg-indigo-500/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>
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

            {/* Header Content */}
            <div className="max-w-7xl mx-auto px-1 pt-6 flex flex-col gap-8 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                            <Activity className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white italic tracking-tighter leading-none">PANEL STI</h1>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Comparativa de Desempeño y Cobertura</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {selectedArea && (
                                    <button onClick={() => setSelectedArea(null)} className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase hover:bg-amber-500/20">
                                        Área: {selectedArea} <X className="w-3 h-3" />
                                    </button>
                                )}
                                {selectedSupervisor && (
                                    <button onClick={() => setSelectedSupervisor(null)} className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-500/20">
                                        Sup: {selectedSupervisor.split('(')[0]} <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex gap-4">
                            <div className='flex flex-col px-2'>
                                <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Desde</label>
                                <input type="date" className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </div>
                            <div className="w-px bg-white/10 h-8 self-center" />
                            <div className='flex flex-col px-2'>
                                <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Hasta</label>
                                <input type="date" className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                        </div>
                        <button onClick={handleExport} className="h-12 px-6 bg-amber-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-2">
                            <Download className="w-4 h-4" /> EXPORTAR
                        </button>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4">
                    {[
                        { label: 'Solicitudes Totales', value: metrics.totalSolicitudes, icon: Layers, color: 'text-blue-400', bg: 'bg-blue-500/10', trend: comparison?.totalSolicitudesChange, badge: 'VOLUMEN' },
                        { label: 'Completadas', value: metrics.totalEjecutadas, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', trend: comparison?.totalEjecutadasChange, badge: 'ÉXITO' },
                        { label: 'Instalaciones', value: metrics.instalacionesIntervenidas, icon: Building2, color: 'text-orange-400', bg: 'bg-orange-500/10', trend: comparison?.instalacionesIntervenidasChange, badge: 'COBERTURA' },
                        { label: 'Eficiencia Global', value: `${metrics.porcentajeEjecucion.toFixed(1)}%`, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10', trend: comparison?.porcentajeEjecucionChange, badge: 'DESEMPEÑO', isPercentage: true }
                    ].map((m, i) => (
                        <div key={i} className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 flex flex-col group hover:bg-white/[0.08] transition-all duration-300 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-6">
                                <div className={`w-12 h-12 rounded-2xl ${m.bg} flex items-center justify-center ${m.color} group-hover:scale-110 transition-transform`}>
                                    <m.icon className="w-6 h-6" />
                                </div>
                                <span className="bg-white/5 text-gray-500 text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-full border border-white/5">{m.badge}</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">{m.label}</p>
                                <p className="text-4xl font-black text-white mt-2 italic tracking-tighter leading-none">{m.value}</p>
                                <TrendBadge value={m.trend} isPercentage={m.isPercentage} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <main className="relative z-10 max-w-7xl mx-auto p-4 md:p-6 space-y-8">
                {/* Charts Section */}
                <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8 transition-opacity duration-300", loading ? 'opacity-50' : 'opacity-100')}>

                    {/* Performance por Área */}
                    <section className="lg:col-span-2 relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-[2.5rem] blur opacity-25"></div>
                        <div className="relative bg-[#1E293B]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                            <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter italic mb-10 uppercase">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <Wrench className="w-5 h-5" />
                                </div>
                                Desempeño por Área de Trabajo
                            </h3>
                            <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={metrics.solicitudesPorArea} onClick={(data) => data?.activeLabel && setSelectedArea(data.activeLabel)}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="area" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={80} tick={{ fill: '#94a3b8', fontWeight: 900 }} />
                                        <YAxis yAxisId="left" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontWeight: 900 }} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} tickLine={false} axisLine={false} unit="%" tick={{ fill: '#f59e0b', fontWeight: 900 }} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                        <Legend wrapperStyle={{ paddingTop: '30px' }} formatter={(value) => <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{value}</span>} />
                                        <Bar yAxisId="left" dataKey="total" name="Totales" fill="url(#blueGradient)" radius={[6, 6, 0, 0]} barSize={40}>
                                            {metrics.solicitudesPorArea.map((entry, index) => <Cell key={`cell-${index}`} fill={selectedArea === entry.area ? '#f59e0b' : 'url(#blueGradient)'} />)}
                                        </Bar>
                                        <Line yAxisId="right" type="monotone" dataKey="percentage" name="% Eficiencia" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#0F172A', stroke: '#f59e0b', strokeWidth: 2, r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </section>

                    {/* Hot-spots y Histórico */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:col-span-2 gap-8">
                        <section className="bg-[#1E293B]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                            <h3 className="text-lg font-black text-white flex items-center gap-3 tracking-tighter italic mb-8 uppercase">
                                <MapPin className="text-orange-400 w-5 h-5" />
                                Hot-spots Cobertura
                            </h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={metrics.topInstalaciones} margin={{ left: 20 }} onClick={(data) => data?.activeLabel && setSelectedInstallation(data.activeLabel)}>
                                        <XAxis type="number" hide />
                                        <YAxis type="category" dataKey="name" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} width={120} tick={{ fill: '#94a3b8', fontWeight: 900 }} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                        <Bar dataKey="count" name="Solicitudes" fill="url(#orangeGradient)" radius={[0, 6, 6, 0]} barSize={16}>
                                            {metrics.topInstalaciones.map((entry, index) => <Cell key={`cell-${index}`} fill={selectedInstallation === entry.name ? '#f59e0b' : 'url(#orangeGradient)'} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </section>

                        <section className="bg-[#1E293B]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                            <h3 className="text-lg font-black text-white flex items-center gap-3 tracking-tighter italic mb-8 uppercase">
                                <Calendar className="text-emerald-400 w-5 h-5" />
                                Histórico Mensual
                            </h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={metrics.solicitudesPorMes} onClick={(data) => data?.activeLabel && setSelectedMonth(data.activeLabel)}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="month" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontWeight: 900 }} />
                                        <YAxis yAxisId="left" hide />
                                        <YAxis yAxisId="right" orientation="right" hide />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar yAxisId="left" dataKey="total" name="Solicitudes" fill="url(#blueGradient)" radius={[4, 4, 0, 0]} barSize={12} />
                                        <Line yAxisId="right" type="monotone" dataKey="eficiencia" name="% Eficiencia" stroke="#10b981" strokeWidth={3} dot={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </section>
                    </div>

                    {/* Performance Supervisores */}
                    <section className="lg:col-span-2 bg-[#1E293B]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                        <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter italic mb-10 uppercase">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                <Activity className="w-5 h-5" />
                            </div>
                            Desempeño por Supervisión
                        </h3>
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={metrics.performanceSupervisores} layout="vertical" margin={{ left: 100, right: 20 }} onClick={(data) => data?.activeLabel && setSelectedSupervisor(data.activeLabel)}>
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="supervisor" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} width={180} tick={{ fill: '#94a3b8', fontWeight: 900 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                    <Bar dataKey="executed" name="Completado" stackId="a" fill="url(#emeraldGradient)" barSize={20} />
                                    <Bar dataKey="pending" name="Pendiente" stackId="a" fill="url(#orangeGradient)" radius={[0, 6, 6, 0]} barSize={20} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {/* Table Section */}
                    <section className="lg:col-span-2 relative group/table">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-[2.5rem] blur opacity-25"></div>
                        <div className="relative bg-[#1E293B]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
                            <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                                <h3 className="text-xl font-black text-white tracking-tighter italic uppercase flex items-center gap-3">
                                    <Search className="text-blue-400 w-5 h-5" />
                                    Solicitudes Activas <span className="text-blue-400/50">({totalItems})</span>
                                </h3>
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Total en este periodo</div>
                            </div>

                            <div className="p-4 md:p-8 h-[500px]">
                                {tableData.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-500">
                                        <AlertCircle className="w-12 h-12 text-slate-700" />
                                        <p className="font-black uppercase tracking-widest text-xs">Sin registros activos</p>
                                    </div>
                                ) : (
                                    <VirtualizedTable
                                        data={tableData}
                                        rowHeight={70}
                                        columns={[
                                            { header: 'ID', width: '8%', className: 'font-black text-blue-400 italic' },
                                            { header: 'Fecha', width: '12%', className: 'font-bold text-slate-400 text-[11px]' },
                                            { header: 'Ubicación / Instalación', width: '35%' },
                                            { header: 'Área', width: '15%' },
                                            { header: 'Supervisor Asignado', width: '30%' },
                                        ]}
                                        renderCell={(item, colIdx) => {
                                            switch (colIdx) {
                                                case 0: return <span className="tracking-tighter">#{item.numero_solicitud}</span>;
                                                case 1: return <span>{format(parseISO(item.fecha_solicitud), 'dd/MM/yy')}</span>;
                                                case 2: return (
                                                    <div className="flex flex-col gap-0.5 max-w-xs">
                                                        <span className="font-black text-white italic text-[11px] truncate uppercase">{item.base_location}</span>
                                                        <span className="text-[9px] text-gray-500 font-bold uppercase truncate">{item.instalacion_municipal}</span>
                                                    </div>
                                                );
                                                case 3: return (
                                                    <span className="bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded text-[9px] font-black text-indigo-400 uppercase tracking-tighter">
                                                        {item.descripcion_area || 'GENÉRICO'}
                                                    </span>
                                                );
                                                case 4: return (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[10px] font-black text-white italic">
                                                            {(item.supervisor_asignado_alias || '?')[0]}
                                                        </div>
                                                        <span className="font-black text-slate-300 italic text-[11px] truncate uppercase">
                                                            {item.supervisor_asignado_alias || 'PENDIENTE'}
                                                        </span>
                                                    </div>
                                                );
                                                default: return null;
                                            }
                                        }}
                                    />
                                )}
                            </div>

                            <div className="p-6 bg-black/20 border-t border-white/5 flex items-center justify-between">
                                <div className="flex flex-col gap-1 w-full max-w-[200px]">
                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Progreso de Vista</span>
                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{ width: `${(Math.min(currentPage * itemsPerPage, totalItems) / totalItems) * 100}%` }}></div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-2 bg-white/5 border border-white/10 rounded-xl disabled:opacity-20 hover:bg-white/10 transition-all"><ChevronLeft size={20} /></button>
                                    <span className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black text-white italic">PÁGINA {currentPage}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(p + 1, Math.ceil(totalItems / itemsPerPage)))} disabled={currentPage * itemsPerPage >= totalItems} className="p-2 bg-white/5 border border-white/10 rounded-xl disabled:opacity-20 hover:bg-white/10 transition-all"><ChevronRight size={20} /></button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {loading && (
                <div className="fixed bottom-8 right-8 bg-[#1E293B]/80 backdrop-blur-3xl border border-white/10 px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 text-[10px] font-black uppercase text-white tracking-widest animate-in slide-in-from-bottom-4">
                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                    Actualizando...
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
            `}</style>
        </div>
    );
}

const Loader2 = ({ className }: { className?: string }) => (
    <Activity className={cn("animate-pulse", className)} />
);
