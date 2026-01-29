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
    X,
    AlertTriangle,
    Clock
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
    Pie,
    AreaChart,
    Area
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
import { Card } from '../components/ui/Card';
import { cn } from '../lib/utils';

interface DashboardMetrics {
    totalSolicitudes: number;
    totalEjecutadas: number;
    porcentajeEjecucion: number;
    instalacionesIntervenidas: number;
    topInstalaciones: { name: string; total: number; executed: number; pending: number; percentage: number }[];
    solicitudesPorMes: { month: string; total: number; executed: number; eficiencia: number }[];
    solicitudesPorArea: { area: string; total: number; executed: number; percentage: number }[];
    performanceSupervisores: { supervisor: string; total: number; executed: number; pending: number; percentage: number }[];
    stalledRequests: number;
    solicitudesEstancadas: any[];
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
    const [showCriticalOnly, setShowCriticalOnly] = useState(false);

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
        const cleanInstallation = selectedInstallation ? selectedInstallation.replace(/ \(\d+(\.\d+)?%\)$/, '') : null;
        if (cleanInstallation) query = query.eq('base_location', cleanInstallation);

        if (monthParam) {
            const mStart = `${monthParam}-01`;
            const mLast = format(lastDayOfMonth(parseISO(mStart)), 'yyyy-MM-dd');
            query = query.gte('fecha_solicitud', mStart).lte('fecha_solicitud', `${mLast} 23:59:59`);
        }

        if (showCriticalOnly) {
            query = query.lte('fecha_solicitud', subDays(new Date(), 10).toISOString());
        }

        // Corregir sintaxis para excluir estados finalizados
        query = query.not('status_normalized', 'in', '(EJECUTADA,FINALIZADA,COMPLETADA,CERRADA)');

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

            const cleanInstallation = selectedInstallation ? selectedInstallation.replace(/ \(\d+(\.\d+)?%\)$/, '') : null;

            const rpcParams = {
                p_area: selectedArea,
                p_supervisor: cleanSupervisor,
                p_installation: cleanInstallation,
                p_month_filter: null
            };

            let monthParam = null;
            if (selectedMonth) {
                const parsedM = parse(selectedMonth, 'MMM. yy', new Date(), { locale: es });
                if (isValid(parsedM)) {
                    monthParam = format(parsedM, 'yyyy-MM');
                }
            }

            const [curRes, prevRes, stalledRes]: [any, any, any] = await Promise.all([
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
                }),
                supabase
                    .from('vw_dashboard_analyzed')
                    .select('*')
                    .lte('fecha_solicitud', subDays(new Date(), 10).toISOString())
                    .not('status_normalized', 'in', '(EJECUTADA,FINALIZADA,COMPLETADA,CERRADA,CANCELADA)')
                    .limit(6)
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
                        pending: m.total - m.executed,
                        eficiencia: m.total > 0 ? (m.executed / m.total) * 100 : 0
                    };
                });

                const topInstalaciones = (cur.installations || []).map((i: any) => {
                    const p = i.total > 0 ? (i.executed / i.total) * 100 : 0;
                    return {
                        name: `${i.name} (${p.toFixed(1)}%)`,
                        total: i.total,
                        executed: i.executed,
                        pending: i.pending,
                        percentage: p
                    };
                });

                setMetrics({
                    totalSolicitudes: cur.overall.total,
                    totalEjecutadas: cur.overall.executed,
                    porcentajeEjecucion: pct,
                    instalacionesIntervenidas: cur.overall.coverage,
                    topInstalaciones,
                    solicitudesPorArea,
                    solicitudesPorMes,
                    performanceSupervisores,
                    stalledRequests: stalledRes?.data?.length || 0,
                    solicitudesEstancadas: stalledRes?.data?.map((s: any) => ({
                        ...s,
                        dias_espera: differenceInDays(new Date(), parseISO(s.fecha_solicitud))
                    })) || []
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
    }, [startDate, endDate, selectedArea, selectedSupervisor, selectedMonth, selectedInstallation, showCriticalOnly]);

    useEffect(() => {
        fetchTableData(currentPage);
    }, [currentPage]);

    const handleExport = async () => {
        if (!metrics) return;
        setLoading(true);
        const cleanSupervisor = selectedSupervisor ? selectedSupervisor.replace(/ \(\d+(\.\d+)?%\)$/, '') : null;
        let query = supabase.from('vw_dashboard_analyzed').select('*');
        query = query.gte('fecha_solicitud', startDate).lte('fecha_solicitud', `${endDate} 23:59:59`);
        const cleanInstallation = selectedInstallation ? selectedInstallation.replace(/ \(\d+(\.\d+)?%\)$/, '') : null;
        if (selectedArea) query = query.eq('descripcion_area', selectedArea);
        if (cleanSupervisor) query = query.eq('supervisor_asignado_alias', cleanSupervisor);
        if (cleanInstallation) query = query.eq('base_location', cleanInstallation);
        query = query.neq('status_normalized', 'CANCELADA');

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
        XLSX.utils.book_append_sheet(wb, wsDetail, "Detalle de Solicitudes");
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
        <div className="min-h-screen bg-[#0f111a] text-slate-100 font-sans relative">
            <PageHeader
                title="Panel de Control (STI)"
                icon={Activity}
                themeColor="amber"
            />

            <div className="max-w-7xl mx-auto px-4 pt-6 flex flex-col gap-8 relative z-10">
                {/* Filters Row */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex gap-4 shadow-inner">
                            <div className='flex items-center gap-3 px-3'>
                                <Calendar className="w-5 h-5 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" />
                                <div className='flex flex-col'>
                                    <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Desde</label>
                                    <input type="date" className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer [color-scheme:dark]" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </div>
                            </div>
                            <div className="w-px bg-white/10 h-8 self-center" />
                            <div className='flex items-center gap-3 px-3'>
                                <Calendar className="w-5 h-5 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" />
                                <div className='flex flex-col'>
                                    <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Hasta</label>
                                    <input type="date" className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer [color-scheme:dark]" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <button onClick={handleExport} className="h-12 px-6 bg-amber-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-2">
                            <Download className="w-4 h-4" /> EXPORTAR
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                        {selectedArea && (
                            <button onClick={() => setSelectedArea(null)} className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-blue-500/30 transition-colors shadow-lg shadow-blue-500/10">
                                Área: {selectedArea} <XCircle className="w-4 h-4" />
                            </button>
                        )}
                        {selectedSupervisor && (
                            <button onClick={() => setSelectedSupervisor(null)} className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-emerald-500/30 transition-colors shadow-lg shadow-emerald-500/10">
                                Supervisor: {selectedSupervisor.split('(')[0]} <XCircle className="w-4 h-4" />
                            </button>
                        )}
                        {selectedMonth && (
                            <button onClick={() => setSelectedMonth(null)} className="flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-purple-500/30 transition-colors shadow-lg shadow-purple-500/10">
                                Mes: {selectedMonth} <XCircle className="w-4 h-4" />
                            </button>
                        )}
                        {selectedInstallation && (
                            <button onClick={() => setSelectedInstallation(null)} className="flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 text-orange-400 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-orange-500/30 transition-colors shadow-lg shadow-orange-500/10">
                                Instalación: {selectedInstallation.split('(')[0]} <XCircle className="w-4 h-4" />
                            </button>
                        )}
                        {showCriticalOnly && (
                            <button onClick={() => setShowCriticalOnly(false)} className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse shadow-lg shadow-red-500/20">
                                FILTRO: ALERTAS CRÍTICAS <XCircle className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[
                        { label: 'Solicitudes Totales', value: metrics.totalSolicitudes, icon: Layers, color: 'text-blue-400', bg: 'bg-blue-500/10', trend: comparison?.totalSolicitudesChange, badge: 'VOLUMEN' },
                        { label: 'Ejecutadas', value: metrics.totalEjecutadas, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', trend: comparison?.totalEjecutadasChange, badge: 'ÉXITO' },
                        { label: 'Alertas Críticas', value: metrics.stalledRequests, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', trend: metrics.stalledRequests > 0 ? 100 : 0, badge: 'URGENTE', pulse: metrics.stalledRequests > 0 },
                        { label: 'Instalaciones', value: metrics.instalacionesIntervenidas, icon: Building2, color: 'text-orange-400', bg: 'bg-orange-500/10', trend: comparison?.instalacionesIntervenidasChange, badge: 'COBERTURA' },
                        { label: 'Eficiencia Global', value: `${metrics.porcentajeEjecucion.toFixed(1)}%`, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10', trend: comparison?.porcentajeEjecucionChange, badge: 'DESEMPEÑO', isPercentage: true }
                    ].map((m, i) => (
                        <div
                            key={i}
                            onClick={() => m.label === 'Alertas Críticas' && setShowCriticalOnly(!showCriticalOnly)}
                            className={cn(
                                "bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col group transition-all duration-300 relative overflow-hidden",
                                m.label === 'Alertas Críticas' ? "cursor-pointer hover:bg-red-500/5 hover:border-red-500/50" : "hover:bg-white/10",
                                m.pulse && "border-red-500/30 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.1)]",
                                showCriticalOnly && m.label === 'Alertas Críticas' && "border-red-500 ring-2 ring-red-500/20 bg-red-500/10"
                            )}>
                            <div className="flex justify-between items-start mb-6">
                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform", m.bg, m.color)}>
                                    <m.icon className="w-6 h-6" />
                                </div>
                                <span className={cn(
                                    "bg-white/5 text-gray-500 text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-full border border-white/5",
                                    m.pulse && "bg-red-500/10 text-red-500 border-red-500/20"
                                )}>{m.badge}</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">{m.label}</p>
                                <p className={cn("text-4xl font-black text-white mt-2 italic tracking-tighter leading-none", m.pulse && "text-red-500")}>{m.value}</p>
                                {m.trend !== undefined && <TrendBadge value={m.trend} isPercentage={m.isPercentage} />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <main className="relative z-10 max-w-7xl mx-auto p-4 md:p-6 space-y-8 pb-20">
                {/* Charts Section */}
                <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8 transition-opacity duration-300", loading ? 'opacity-50' : 'opacity-100')}>

                    {/* Performance por Área */}
                    <section className="lg:col-span-2">
                        <Card className="p-8">
                            <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter italic mb-10 uppercase">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <Wrench className="w-5 h-5" />
                                </div>
                                Desempeño por Área de Trabajo
                            </h3>
                            <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={metrics.solicitudesPorArea} onClick={(data) => data?.activeLabel && setSelectedArea(data.activeLabel)}>
                                        <defs>
                                            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="area" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={80} tick={{ fill: '#94a3b8', fontWeight: 900 }} />
                                        <YAxis yAxisId="left" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontWeight: 900 }} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} tickLine={false} axisLine={false} unit="%" tick={{ fill: '#f59e0b', fontWeight: 900 }} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                        <Legend wrapperStyle={{ paddingTop: '30px' }} formatter={(value) => <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{value}</span>} />
                                        <Bar yAxisId="left" dataKey="total" name="Totales" fill="url(#blueGradient)" radius={[6, 6, 0, 0]} barSize={40}>
                                            {metrics.solicitudesPorArea.map((entry, index) => <Cell key={`cell-${index}`} fill={selectedArea === entry.area ? '#f59e0b' : 'url(#blueGradient)'} />)}
                                        </Bar>
                                        <Line yAxisId="right" type="linear" dataKey="percentage" name="% Eficiencia" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#0f111a', stroke: '#f59e0b', strokeWidth: 2, r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </section>

                    {/* Cobertura por Instalación */}
                    <section>
                        <Card className="p-8 h-full">
                            <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter italic mb-8 uppercase">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                Instalaciones con Mayor Demanda
                            </h3>
                            <div className="h-[550px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={metrics.topInstalaciones} onClick={(data) => data?.activeLabel && setSelectedInstallation(data.activeLabel)}>
                                        <defs>
                                            <linearGradient id="orangeGradient" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.2} />
                                            </linearGradient>
                                            <linearGradient id="greenGradientInst" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
                                            </linearGradient>
                                            <linearGradient id="redGradientInst" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={200} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                                        <Tooltip content={<CustomTooltip unit="sol." />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{value}</span>} />
                                        <Bar dataKey="executed" name="Ejecutadas" stackId="a" fill="url(#greenGradientInst)" radius={[0, 0, 0, 0]} barSize={20} />
                                        <Bar dataKey="pending" name="Pendientes" stackId="a" fill="url(#redGradientInst)" radius={[0, 6, 6, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </section>

                    {/* Desempeño por Supervisión */}
                    <section>
                        <Card className="p-8 h-full">
                            <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter italic mb-8 uppercase">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                    <Activity className="w-5 h-5" />
                                </div>
                                Desempeño por Supervisión
                            </h3>
                            <div className="h-[550px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={metrics.performanceSupervisores} onClick={(data) => data?.activeLabel && setSelectedSupervisor(data.activeLabel)}>
                                        <defs>
                                            <linearGradient id="greenGradient" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
                                            </linearGradient>
                                            <linearGradient id="redGradient" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="supervisor" type="category" stroke="#94a3b8" fontSize={9} width={200} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                                        <Tooltip content={<CustomTooltip unit="sol." />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{value}</span>} />
                                        <Bar dataKey="executed" name="Ejecutadas" stackId="a" fill="url(#greenGradient)" radius={[0, 0, 0, 0]} barSize={20} />
                                        <Bar dataKey="pending" name="Pendientes" stackId="a" fill="url(#redGradient)" radius={[0, 6, 6, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </section>

                    {/* Evolución Cronológica */}
                    <section>
                        <Card className="p-8 h-full">
                            <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter italic mb-8 uppercase">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                Evolución Cronológica
                            </h3>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={metrics.solicitudesPorMes} onClick={(data) => data?.activeLabel && setSelectedMonth(data.activeLabel)}>
                                        <defs>
                                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="greenGradientEvol" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                                                <stop offset="95%" stopColor="#065f46" stopOpacity={0.6} />
                                            </linearGradient>
                                            <linearGradient id="redGradientEvol" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9} />
                                                <stop offset="95%" stopColor="#991b1b" stopOpacity={0.6} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                                        <Tooltip content={<CustomTooltip unit="sol." />} />
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{value}</span>} />
                                        <Bar dataKey="executed" name="Ejecutadas" stackId="a" fill="url(#greenGradientEvol)" barSize={40} />
                                        <Bar dataKey="pending" name="Pendientes" stackId="a" fill="url(#redGradientEvol)" barSize={40} />
                                        <Area type="monotone" dataKey="total" name="Total" stroke="#8b5cf6" strokeWidth={4} fillOpacity={0.2} fill="url(#colorTotal)" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </section>

                    {/* Tabla de Solicitudes Activas */}
                    <section className="lg:col-span-2">
                        <Card className="overflow-hidden flex flex-col">
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
                                        rowHeight={110}
                                        columns={[
                                            { header: 'ID', width: '6%', className: 'font-black text-blue-400 italic' },
                                            { header: 'Fecha', width: '8%', className: 'font-bold text-slate-400 text-[11px]' },
                                            { header: 'Ubicación', width: '28%' },
                                            { header: 'Instalación', width: '15%' },
                                            { header: 'Área', width: '12%' },
                                            { header: 'Supervisor', width: '15%' },
                                            { header: 'Prioridad', width: '10%' },
                                            { header: 'Estado', width: '12%' },
                                        ]}
                                        renderCell={(item, colIdx) => {
                                            switch (colIdx) {
                                                case 0: return <span className="block italic text-[10px] whitespace-normal">#{item.numero_solicitud}</span>;
                                                case 1: return <span className="block text-[10px] whitespace-normal">{format(parseISO(item.fecha_solicitud), 'dd/MM/yy')}</span>;
                                                case 2: return <span className="block font-bold text-white uppercase text-[10px] leading-tight break-words whitespace-normal" title={item.base_location}>{item.base_location}</span>;
                                                case 3: return <span className="block text-[9px] text-slate-400 uppercase leading-tight break-words whitespace-normal" title={item.instalacion_municipal}>{item.instalacion_municipal}</span>;
                                                case 4: return (
                                                    <span className="block bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded text-[9px] font-black text-indigo-400 uppercase tracking-tighter text-center break-words whitespace-normal">
                                                        {item.descripcion_area || 'GENÉRICO'}
                                                    </span>
                                                );
                                                case 5: return (
                                                    <div className="flex items-start gap-2 w-full whitespace-normal">
                                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[9px] font-black text-white italic mt-0.5">
                                                            {(item.supervisor_asignado_alias || '?')[0]}
                                                        </div>
                                                        <span className="font-bold text-slate-300 italic text-[10px] uppercase leading-tight break-words">
                                                            {item.supervisor_asignado_alias || 'PENDIENTE'}
                                                        </span>
                                                    </div>
                                                );
                                                case 6: {
                                                    const days = differenceInDays(new Date(), parseISO(item.fecha_solicitud));
                                                    const isFinished = ['EJECUTADA', 'FINALIZADA', 'COMPLETADA', 'CERRADA'].includes(item.status_normalized);

                                                    if (isFinished) return <span className="block text-[9px] text-slate-500 text-center">-</span>;

                                                    return (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className={cn(
                                                                "w-3 h-3 rounded-full shadow-lg",
                                                                days > 10 ? "bg-red-500 animate-pulse" :
                                                                    days > 5 ? "bg-orange-500" : "bg-slate-600"
                                                            )} />
                                                            <span className="text-[8px] font-black text-slate-400">{days}d</span>
                                                        </div>
                                                    );
                                                }
                                                case 7: return (
                                                    <span className={cn(
                                                        "block text-center px-2 py-1 rounded-full text-[9px] font-black uppercase break-words whitespace-normal",
                                                        item.status_normalized === 'ACTIVA' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                                            item.status_normalized === 'EJECUTADA' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                                'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    )}>
                                                        {item.status_normalized}
                                                    </span>
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
                        </Card>
                    </section>

                    {/* Alertas de Retraso */}
                    {metrics.solicitudesEstancadas.length > 0 && (
                        <section className="lg:col-span-2">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter italic uppercase">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 animate-pulse">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    Alertas de Atención Crítica
                                </h3>
                                <span className="bg-red-500/10 text-red-500 text-[10px] font-black tracking-widest uppercase px-4 py-2 rounded-full border border-red-500/20">
                                    {metrics.solicitudesEstancadas.length} Solicitudes con Retraso
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {metrics.solicitudesEstancadas.map((s, idx) => (
                                    <div key={idx} className="bg-red-500/5 backdrop-blur-3xl border border-red-500/20 rounded-2xl p-6 hover:bg-red-500/10 transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Clock className="w-12 h-12 text-red-500" />
                                        </div>
                                        <div className="flex justify-between items-start mb-4">
                                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{s.descripcion_area || 'Área N/A'}</p>
                                            <p className="text-[10px] font-black text-white bg-red-500 px-2 py-1 rounded italic">#{s.numero_solicitud}</p>
                                        </div>
                                        <h4 className="text-white font-black text-sm mb-4 leading-tight group-hover:text-red-300 transition-colors line-clamp-2">{s.detalle_solicitud || 'Sin detalles'}</h4>
                                        <div className="flex items-center gap-3 pt-4 border-t border-red-500/10">
                                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                                                <TrendingDown className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Retraso Estimado</p>
                                                <p className="text-white font-black text-xs italic">{s.dias_espera} Días en Espera</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </main>

            {loading && (
                <div className="fixed bottom-8 right-8 bg-[#1e293b]/80 backdrop-blur-3xl border border-white/10 px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 text-[10px] font-black uppercase text-white tracking-widest animate-in slide-in-from-bottom-4">
                    <div className="bg-amber-500/20 p-1.5 rounded-lg">
                        <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
                    </div>
                    Actualizando Dashboard
                </div>
            )}

            {/* Background elements */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/5 blur-[120px] rounded-full"></div>
            </div>

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
