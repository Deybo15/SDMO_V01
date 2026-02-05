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
    Clock,
    Zap
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
        return format(lastDayOfMonth(new Date()), 'yyyy-MM-dd');
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
            query = query.lte('fecha_solicitud', subDays(new Date(), 10).toLocaleDateString('en-CA'));
        }

        query = query.not('status_normalized', 'in', '(EJECUTADA,FINALIZADA,COMPLETADA,CERRADA)');

        const { data, count, error } = await query;
        if (error) {
            console.error("Dashboard Table Error:", error);
        } else {
            setTableData(data || []);
            setTotalItems(count || 0);
        }
    };

    const handleRepairDates = async () => {
        try {
            setLoading(true);
            const { data: misdated, error: fetchError } = await supabase
                .from('solicitud_17')
                .select('numero_solicitud')
                .eq('fecha_solicitud', '2026-02-05');

            if (fetchError) throw fetchError;

            if (!misdated || misdated.length === 0) {
                alert('Sincronización completa. No hay registros desfasados.');
                return;
            }

            const ids = misdated.map(m => m.numero_solicitud);
            const { error: updateError } = await supabase
                .from('solicitud_17')
                .update({ fecha_solicitud: '2026-02-04' })
                .in('numero_solicitud', ids);

            if (updateError) throw updateError;

            alert(`¡Éxito! Se han sincronizado ${ids.length} solicitudes.`);
            loadDashboard();
        } catch (err) {
            console.error('Error repairing dates:', err);
            alert('Error durante la sincronización.');
        } finally {
            setLoading(false);
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
                    .lte('fecha_solicitud', subDays(new Date(), 10).toLocaleDateString('en-CA'))
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
        const colorClass = isPositive ? 'text-[#10B981]' : 'text-[#EF4444]';

        return (
            <div className={cn("flex items-center gap-1 text-[10px] font-bold mt-2 uppercase tracking-tight", colorClass)}>
                <Icon className="w-3 h-3" />
                <span>{Math.abs(value).toFixed(1)}{isPercentage ? ' pts' : '%'} vs periodo anterior</span>
            </div>
        );
    };

    const CustomTooltip = ({ active, payload, label, unit = "" }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#1D1D1F] border border-[#333333] px-4 py-3 rounded-[8px] shadow-2xl">
                    <p className="text-[#86868B] text-[10px] font-bold mb-2 uppercase tracking-widest">{label}</p>
                    <div className="space-y-1.5">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                                <span className="text-[#F5F5F7] text-xs font-medium">{entry.name}:</span>
                                <span className="text-[#F5F5F7] text-xs font-bold">
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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans selection:bg-[#0071E3]/30">
            <div className="animate-fade-in-up">
                <PageHeader
                    title="Panel de Control (STI) - V2.2"
                    icon={Activity}
                    themeColor="blue"
                />

                <div className="max-w-7xl mx-auto px-8 pt-8 flex flex-col gap-10">
                    {/* Filters Row */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <div className="bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-2.5 flex gap-6">
                                <div className='flex items-center gap-3 px-3'>
                                    <Calendar className="w-4 h-4 text-[#0071E3]" />
                                    <div className='flex flex-col'>
                                        <label className="text-[9px] text-[#86868B] uppercase font-bold tracking-widest mb-1">Desde</label>
                                        <input
                                            type="date"
                                            className="bg-transparent text-[#F5F5F7] text-xs font-bold outline-none cursor-pointer [color-scheme:dark]"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="w-px bg-[#333333] h-8 self-center" />
                                <div className='flex items-center gap-3 px-3'>
                                    <Calendar className="w-4 h-4 text-[#0071E3]" />
                                    <div className='flex flex-col'>
                                        <label className="text-[9px] text-[#86868B] uppercase font-bold tracking-widest mb-1">Hasta</label>
                                        <input
                                            type="date"
                                            className="bg-transparent text-[#F5F5F7] text-xs font-bold outline-none cursor-pointer [color-scheme:dark]"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleExport}
                                className="h-12 px-8 bg-[#1D1D1F] border border-[#333333] text-white font-bold text-xs uppercase tracking-widest rounded-[8px] hover:bg-[#333333] active:scale-95 transition-all flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" /> EXPORTAR
                            </button>
                            <button
                                onClick={handleRepairDates}
                                className="h-12 px-8 bg-[#0071E3] text-white font-bold text-xs uppercase tracking-widest rounded-[8px] hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-xl shadow-[#0071E3]/20"
                            >
                                <Zap className="w-4 h-4" /> SINCRONIZAR DATOS
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-end">
                            {selectedArea && (
                                <button onClick={() => setSelectedArea(null)} className="flex items-center gap-2 bg-[#0071E3]/20 border border-[#0071E3]/30 text-[#0071E3] px-3.5 py-1.5 rounded-[8px] text-[10px] font-bold hover:bg-[#0071E3]/30 transition-colors">
                                    Área: {selectedArea} <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {selectedSupervisor && (
                                <button onClick={() => setSelectedSupervisor(null)} className="flex items-center gap-2 bg-[#10B981]/20 border border-[#10B981]/30 text-[#10B981] px-3.5 py-1.5 rounded-[8px] text-[10px] font-bold hover:bg-[#10B981]/30 transition-colors">
                                    Supervisor: {selectedSupervisor.split('(')[0]} <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {selectedMonth && (
                                <button onClick={() => setSelectedMonth(null)} className="flex items-center gap-2 bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-[#8B5CF6] px-3.5 py-1.5 rounded-[8px] text-[10px] font-bold hover:bg-[#8B5CF6]/30 transition-colors">
                                    Mes: {selectedMonth} <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {selectedInstallation && (
                                <button onClick={() => setSelectedInstallation(null)} className="flex items-center gap-2 bg-[#F59E0B]/20 border border-[#F59E0B]/30 text-[#F59E0B] px-3.5 py-1.5 rounded-[8px] text-[10px] font-bold hover:bg-[#F59E0B]/30 transition-colors">
                                    Instalación: {selectedInstallation.split('(')[0]} <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {showCriticalOnly && (
                                <button onClick={() => setShowCriticalOnly(false)} className="flex items-center gap-2 bg-[#EF4444]/20 border border-[#EF4444]/30 text-[#EF4444] px-3.5 py-1.5 rounded-[8px] text-[10px] font-bold animate-pulse">
                                    FILTRO: ALERTAS CRÍTICAS <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                        {[
                            { label: 'Solicitudes Totales', value: metrics.totalSolicitudes, icon: Layers, color: 'text-[#0071E3]', bg: 'bg-[#0071E3]/10', trend: comparison?.totalSolicitudesChange, badge: 'VOLUMEN' },
                            { label: 'Ejecutadas', value: metrics.totalEjecutadas, icon: CheckCircle, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', trend: comparison?.totalEjecutadasChange, badge: 'ÉXITO' },
                            { label: 'Alertas Críticas', value: metrics.stalledRequests, icon: AlertCircle, color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', trend: metrics.stalledRequests > 0 ? 100 : 0, badge: 'URGENTE', pulse: metrics.stalledRequests > 0 },
                            { label: 'Instalaciones', value: metrics.instalacionesIntervenidas, icon: Building2, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', trend: comparison?.instalacionesIntervenidasChange, badge: 'COBERTURA' },
                            { label: 'Eficiencia Global', value: `${metrics.porcentajeEjecucion.toFixed(1)}%`, icon: Activity, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10', trend: comparison?.porcentajeEjecucionChange, badge: 'DESEMPEÑO', isPercentage: true }
                        ].map((m, i) => (
                            <div
                                key={i}
                                onClick={() => m.label === 'Alertas Críticas' && setShowCriticalOnly(!showCriticalOnly)}
                                className={cn(
                                    "glass-card p-6 flex flex-col group transition-all duration-300 relative overflow-hidden",
                                    m.label === 'Alertas Críticas' ? "cursor-pointer hover:border-[#EF4444]/50" : "hover:border-[#0071E3]/30",
                                    m.pulse && "border-[#EF4444]/50",
                                    showCriticalOnly && m.label === 'Alertas Críticas' && "border-[#EF4444]"
                                )}>
                                <div className="flex justify-between items-start mb-6">
                                    <div className={cn("w-12 h-12 rounded-[12px] flex items-center justify-center group-hover:scale-105 transition-transform", m.bg, m.color)}>
                                        <m.icon className="w-6 h-6" />
                                    </div>
                                    <span className={cn(
                                        "bg-[#1D1D1F] text-[#86868B] text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded-[4px] border border-[#333333]",
                                        m.pulse && "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20"
                                    )}>{m.badge}</span>
                                </div>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest leading-none">{m.label}</p>
                                    <p className={cn("text-4xl font-bold text-[#F5F5F7] mt-3 tracking-tighter leading-none", m.pulse && "text-[#EF4444]")}>{m.value}</p>
                                    {m.trend !== undefined && <TrendBadge value={m.trend} isPercentage={m.isPercentage} />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <main className="max-w-7xl mx-auto p-8 space-y-12 pb-32">
                    {/* Charts Section */}
                    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8 transition-opacity duration-300", loading ? 'opacity-50' : 'opacity-100')}>

                        {/* Performance por Área */}
                        <section className="lg:col-span-2">
                            <div className="glass-card p-8">
                                <h3 className="text-xl font-bold text-[#F5F5F7] flex items-center gap-3 tracking-tight mb-10 uppercase">
                                    <div className="w-10 h-10 rounded-[8px] bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3] border border-[#0071E3]/20">
                                        <Wrench className="w-5 h-5" />
                                    </div>
                                    Desempeño por Área de Trabajo
                                </h3>
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={metrics.solicitudesPorArea} onClick={(data) => data?.activeLabel && setSelectedArea(data.activeLabel)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333333" vertical={false} />
                                            <XAxis dataKey="area" stroke="#333333" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={80} tick={{ fill: '#86868B', fontWeight: 700 }} />
                                            <YAxis yAxisId="left" stroke="#333333" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontWeight: 700 }} />
                                            <YAxis yAxisId="right" orientation="right" stroke="#333333" fontSize={11} tickLine={false} axisLine={false} unit="%" tick={{ fill: '#86868B', fontWeight: 700 }} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                                            <Legend wrapperStyle={{ paddingTop: '30px' }} formatter={(value) => <span className="text-[#86868B] text-[10px] font-bold uppercase tracking-widest">{value}</span>} />
                                            <Bar yAxisId="left" dataKey="total" name="Totales" radius={[4, 4, 0, 0]} barSize={40}>
                                                {metrics.solicitudesPorArea.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill="#0071E3"
                                                        fillOpacity={selectedArea === entry.area ? 1 : 0.4}
                                                    />
                                                ))}
                                            </Bar>
                                            <Line yAxisId="right" type="linear" dataKey="percentage" name="% Eficiencia" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#000000', stroke: '#F59E0B', strokeWidth: 2, r: 4 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </section>

                        {/* Cobertura por Instalación */}
                        <section>
                            <div className="glass-card p-8 h-full">
                                <h3 className="text-xl font-bold text-[#F5F5F7] flex items-center gap-3 tracking-tight mb-8 uppercase">
                                    <div className="w-10 h-10 rounded-[8px] bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B] border border-[#F59E0B]/20">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    Instalaciones con Mayor Demanda
                                </h3>
                                <div className="h-[550px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={metrics.topInstalaciones} onClick={(data) => data?.activeLabel && setSelectedInstallation(data.activeLabel)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333333" horizontal={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" stroke="#333333" fontSize={9} width={200} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontWeight: 700 }} />
                                            <Tooltip content={<CustomTooltip unit="sol." />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                                            <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => <span className="text-[#86868B] text-[10px] font-bold uppercase tracking-widest">{value}</span>} />
                                            <Bar dataKey="executed" name="Ejecutadas" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} barSize={20} />
                                            <Bar dataKey="pending" name="Pendientes" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </section>

                        {/* Desempeño por Supervisión */}
                        <section>
                            <div className="glass-card p-8 h-full">
                                <h3 className="text-xl font-bold text-[#F5F5F7] flex items-center gap-3 tracking-tight mb-8 uppercase">
                                    <div className="w-10 h-10 rounded-[8px] bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] border border-[#8B5CF6]/20">
                                        <Activity className="w-5 h-5" />
                                    </div>
                                    Desempeño por Supervisión
                                </h3>
                                <div className="h-[550px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={metrics.performanceSupervisores} onClick={(data) => data?.activeLabel && setSelectedSupervisor(data.activeLabel)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333333" horizontal={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="supervisor" type="category" stroke="#333333" fontSize={9} width={200} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontWeight: 700 }} />
                                            <Tooltip content={<CustomTooltip unit="sol." />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                                            <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => <span className="text-[#86868B] text-[10px] font-bold uppercase tracking-widest">{value}</span>} />
                                            <Bar dataKey="executed" name="Ejecutadas" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} barSize={20} />
                                            <Bar dataKey="pending" name="Pendientes" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </section>
                        {/* Evolución Cronológica */}
                        <section className="lg:col-span-2">
                            <div className="glass-card p-8">
                                <h3 className="text-xl font-bold text-[#F5F5F7] flex items-center gap-3 tracking-tight mb-8 uppercase">
                                    <div className="w-10 h-10 rounded-[8px] bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] border border-[#8B5CF6]/20">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    Evolución Cronológica (Histórico Mensual)
                                </h3>
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={metrics.solicitudesPorMes} onClick={(data) => data?.activeLabel && setSelectedMonth(data.activeLabel)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333333" vertical={false} />
                                            <XAxis dataKey="month" stroke="#333333" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontWeight: 700 }} />
                                            <YAxis stroke="#333333" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontWeight: 700 }} />
                                            <Tooltip content={<CustomTooltip unit="sol." />} />
                                            <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => <span className="text-[#86868B] text-[10px] font-bold uppercase tracking-widest">{value}</span>} />
                                            <Bar dataKey="executed" name="Ejecutadas" stackId="a" fill="#10B981" barSize={40} radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="pending" name="Pendientes" stackId="a" fill="#EF4444" barSize={40} radius={[4, 4, 0, 0]} />
                                            <Area type="monotone" dataKey="total" name="Total" stroke="#8B5CF6" strokeWidth={3} fillOpacity={0.1} fill="#8B5CF6" />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </section>

                        {/* Tabla de Solicitudes Activas */}
                        <section className="lg:col-span-2">
                            <div className="glass-card overflow-hidden flex flex-col">
                                <div className="p-8 border-b border-[#333333] bg-[#1D1D1F]/50 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-[#F5F5F7] tracking-tight uppercase flex items-center gap-3">
                                        <Search className="text-[#0071E3] w-5 h-5" />
                                        Solicitudes Activas <span className="text-[#0071E3]/50">({totalItems})</span>
                                    </h3>
                                    <div className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest pl-2">Total en el periodo</div>
                                </div>

                                <div className="p-8 h-[550px]">
                                    {tableData.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center gap-4 text-[#86868B]">
                                            <AlertCircle className="w-12 h-12 text-[#333333]" />
                                            <p className="font-bold uppercase tracking-widest text-[10px]">Sin registros activos</p>
                                        </div>
                                    ) : (
                                        <VirtualizedTable
                                            data={tableData}
                                            rowHeight={90}
                                            columns={[
                                                { header: 'ID', width: '6%', className: 'font-bold text-[#0071E3]' },
                                                { header: 'Fecha', width: '10%', className: 'text-[#86868B] text-[11px]' },
                                                { header: 'Ubicación', width: '28%' },
                                                { header: 'Instalación', width: '15%' },
                                                { header: 'Área', width: '12%' },
                                                { header: 'Supervisor', width: '15%' },
                                                { header: 'Prioridad', width: '8%' },
                                                { header: 'Estado', width: '12%' },
                                            ]}
                                            renderCell={(item, colIdx) => {
                                                switch (colIdx) {
                                                    case 0: return <span className="text-[10px] font-black tracking-tighter">#{item.numero_solicitud}</span>;
                                                    case 1: return <span className="text-[10px] font-medium">{format(parseISO(item.fecha_solicitud), 'dd/MM/yy')}</span>;
                                                    case 2: return <span className="font-bold text-[#F5F5F7] uppercase text-[10px] line-clamp-2" title={item.base_location}>{item.base_location}</span>;
                                                    case 3: return <span className="text-[9px] text-[#86868B] uppercase line-clamp-2" title={item.instalacion_municipal}>{item.instalacion_municipal}</span>;
                                                    case 4: return (
                                                        <span className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 px-2 py-1 rounded-[4px] text-[9px] font-bold text-[#8B5CF6] uppercase text-center truncate">
                                                            {item.descripcion_area || 'GENÉRICO'}
                                                        </span>
                                                    );
                                                    case 5: return (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-[#1D1D1F] border border-[#333333] flex items-center justify-center text-[9px] font-bold text-[#F5F5F7]">
                                                                {(item.supervisor_asignado_alias || '?')[0]}
                                                            </div>
                                                            <span className="font-bold text-[#F5F5F7] text-[10px] uppercase truncate">
                                                                {item.supervisor_asignado_alias || 'PENDIENTE'}
                                                            </span>
                                                        </div>
                                                    );
                                                    case 6: {
                                                        const days = differenceInDays(new Date(), parseISO(item.fecha_solicitud));
                                                        return (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <div className={cn(
                                                                    "w-2.5 h-2.5 rounded-full",
                                                                    days > 10 ? "bg-[#EF4444]" : days > 5 ? "bg-[#F59E0B]" : "bg-[#333333]"
                                                                )} />
                                                                <span className="text-[8px] font-bold text-[#86868B]">{days}d</span>
                                                            </div>
                                                        );
                                                    }
                                                    case 7: return (
                                                        <span className={cn(
                                                            "text-center px-2 py-1 rounded-[4px] text-[9px] font-bold uppercase",
                                                            item.status_normalized === 'ACTIVA' ? 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20' :
                                                                item.status_normalized === 'EJECUTADA' ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20' :
                                                                    'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20'
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

                                <div className="p-8 bg-[#1D1D1F] border-t border-[#333333] flex items-center justify-between">
                                    <div className="flex flex-col gap-1 w-full max-w-[200px]">
                                        <span className="text-[9px] font-bold text-[#86868B] uppercase tracking-widest">Progreso de Vista</span>
                                        <div className="h-1 bg-[#333333] rounded-full overflow-hidden">
                                            <div className="h-full bg-[#0071E3]" style={{ width: `${(Math.min(currentPage * itemsPerPage, totalItems) / totalItems) * 100}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 border border-[#333333] rounded-[8px] disabled:opacity-20 hover:border-[#0071E3] transition-all"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <span className="px-4 py-2 text-[10px] font-bold text-[#F5F5F7] tracking-widest uppercase">Página {currentPage}</span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(p + 1, Math.ceil(totalItems / itemsPerPage)))}
                                            disabled={currentPage * itemsPerPage >= totalItems}
                                            className="p-2 border border-[#333333] rounded-[8px] disabled:opacity-20 hover:border-[#0071E3] transition-all"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Alertas de Retraso */}
                        {metrics.solicitudesEstancadas.length > 0 && (
                            <section className="lg:col-span-2">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xl font-bold text-[#F5F5F7] flex items-center gap-3 tracking-tight uppercase">
                                        <div className="w-10 h-10 rounded-[8px] bg-[#EF4444]/10 flex items-center justify-center text-[#EF4444] border border-[#EF4444]/20">
                                            <AlertTriangle className="w-5 h-5" />
                                        </div>
                                        Alertas de Atención Crítica
                                    </h3>
                                    <span className="bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-bold tracking-widest uppercase px-4 py-2 rounded-[8px] border border-[#EF4444]/20">
                                        {metrics.solicitudesEstancadas.length} Solicitudes con Retraso
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {metrics.solicitudesEstancadas.map((s, idx) => (
                                        <div key={idx} className="glass-card p-6 hover:border-[#EF4444]/40 transition-all group relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-4">
                                                <p className="text-[10px] font-bold text-[#EF4444] uppercase tracking-widest">{s.descripcion_area || 'Área N/A'}</p>
                                                <p className="text-[10px] font-bold text-[#F5F5F7] bg-[#EF4444] px-2 py-1 rounded-[4px]">#{s.numero_solicitud}</p>
                                            </div>
                                            <h4 className="text-[#F5F5F7] font-bold text-sm mb-6 leading-tight line-clamp-2">{s.detalle_solicitud || 'Sin detalles'}</h4>
                                            <div className="flex items-center gap-3 pt-4 border-t border-[#333333]">
                                                <Clock className="w-4 h-4 text-[#EF4444]" />
                                                <div>
                                                    <p className="text-[9px] font-bold text-[#86868B] uppercase tracking-widest mb-0.5">Retraso Estimado</p>
                                                    <p className="text-[#EF4444] font-bold text-xs">{s.dias_espera} Días en Espera</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </main>
            </div>

            {loading && (
                <div className="fixed bottom-8 right-8 apple-blur border border-[#333333] px-6 py-4 rounded-[12px] shadow-2xl z-50 flex items-center gap-4 text-[11px] font-bold uppercase text-[#F5F5F7] tracking-widest animate-fade-in">
                    <Activity className="w-5 h-5 text-[#0071E3] animate-spin" />
                    Actualizando Dashboard
                </div>
            )}
        </div>
    );
}
