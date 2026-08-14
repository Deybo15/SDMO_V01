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
    Bar,
    Line,
    LabelList,
    ReferenceLine,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
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
    tendenciaFormula?: string;
}

interface ComparisonMetrics {
    totalSolicitudesChange: number;
    totalEjecutadasChange: number;
    porcentajeEjecucionChange: number;
    instalacionesIntervenidasChange: number;
}

interface DashboardMonthRpc {
    month_key: string;
    total: number;
    executed: number;
}

interface DashboardMonth {
    month: string;
    month_key: string;
    total: number;
    executed: number;
    pending: number;
    eficiencia: number;
    tendencia?: number;
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

    const fetchTableData = useCallback(async (page: number) => {
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
    }, [
        endDate,
        selectedArea,
        selectedInstallation,
        selectedMonth,
        selectedSupervisor,
        showCriticalOnly,
        startDate,
    ]);

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

    const loadDashboard = useCallback(async () => {
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

                const rawMonths: DashboardMonth[] = ((cur.months || []) as DashboardMonthRpc[]).map((m) => {
                    const d = parseISO(`${m.month_key}-01`);
                    return {
                        month: format(d, 'MMM. yy', { locale: es }),
                        month_key: m.month_key,
                        total: m.total,
                        executed: m.executed,
                        pending: m.total - m.executed,
                        eficiencia: m.total > 0 ? (m.executed / m.total) * 100 : 0
                    };
                });

                // Calcular tendencia lineal (y = mx + b) basada solo en meses anteriores al actual
                const currentMonthKey = format(new Date(), 'yyyy-MM');
                const historicalMonths = rawMonths.filter(m => m.month_key < currentMonthKey);
                let solicitudesPorMes = rawMonths;

                if (historicalMonths.length >= 2) {
                    const n = historicalMonths.length;
                    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

                    historicalMonths.forEach((d) => {
                        const i = rawMonths.findIndex(m => m.month_key === d.month_key);
                        sumX += i;
                        sumY += d.total;
                        sumXY += i * d.total;
                        sumXX += i * i;
                    });

                    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                    const intercept = (sumY - slope * sumX) / n;
                    const formula = `y = ${slope.toFixed(2)}x ${intercept >= 0 ? '+' : '-'} ${Math.abs(intercept).toFixed(2)}`;

                    solicitudesPorMes = rawMonths.map((d, i) => ({
                        ...d,
                        tendencia: parseFloat((slope * i + intercept).toFixed(1))
                    }));

                    (cur as any).tendenciaFormula = formula;
                }

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
                    })) || [],
                    tendenciaFormula: (cur as any).tendenciaFormula
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
    }, [
        endDate,
        fetchTableData,
        selectedArea,
        selectedInstallation,
        selectedMonth,
        selectedSupervisor,
        startDate,
    ]);

    useEffect(() => {
        loadDashboard();
        setCurrentPage(1);
    }, [loadDashboard]);

    useEffect(() => {
        fetchTableData(currentPage);
    }, [currentPage, fetchTableData]);

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

        return (
            <div className="flex items-center gap-1.5 text-[10px] font-medium mt-3 text-[#A1A1AA] tabular-nums">
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
                    {metrics && (
                        <div className="mt-3 pt-3 border-t border-[#333333] flex items-center justify-between gap-4">
                            <span className="text-[#86868B] text-[10px] font-bold uppercase tracking-widest">Total Periodo:</span>
                            <span className="text-[#F5F5F7] text-xs font-bold">{metrics.totalSolicitudes} sol.</span>
                        </div>
                    )}
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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans selection:bg-white/20">
            <div className="animate-fade-in-up">
                <div className="w-full px-4 md:px-8 pt-8">
                    <div className="border-b border-[#27272a] pb-6">
                        <PageHeader
                            title="Panel de Control (STI) - V2.2"
                            icon={Activity}
                            themeColor="blue"
                            subtitle="Resumen general de operaciones del Sistema de Desarrollo y Mantenimiento de Obras (SDMO)"
                            compact
                        />
                    </div>
                </div>

                <div className="w-full px-4 md:px-8 pt-6 flex flex-col gap-8">
                    {/* Filters Row */}
                    <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-5">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="bg-[#111112] border border-[#2A2A2D] rounded-[10px] p-2.5 flex gap-3 sm:gap-6">
                                <div className='flex items-center gap-3 px-3'>
                                    <Calendar className="w-4 h-4 text-[#B8B8BD]" />
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
                                <div className="w-px bg-[#2A2A2D] h-8 self-center" />
                                <div className='flex items-center gap-3 px-3'>
                                    <Calendar className="w-4 h-4 text-[#B8B8BD]" />
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
                                className="h-12 px-7 bg-[#111112] border border-[#3A3A3D] text-[#F1F1F2] font-semibold text-xs uppercase tracking-widest rounded-[10px] hover:bg-[#1A1A1C] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" /> EXPORTAR
                            </button>
                            <button
                                onClick={handleRepairDates}
                                className="h-12 px-7 bg-[#D4D4D6] text-[#0A0A0A] border border-white/60 font-bold text-xs uppercase tracking-widest rounded-[10px] hover:bg-white active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Zap className="w-4 h-4" /> SINCRONIZAR DATOS
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-end">
                            {selectedArea && (
                                <button onClick={() => setSelectedArea(null)} className="flex items-center gap-2 bg-[#18181A] border border-[#3A3A3D] text-[#D4D4D6] px-3.5 py-1.5 rounded-[8px] text-[10px] font-semibold hover:border-[#71717A] transition-colors">
                                    Área: {selectedArea} <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {selectedSupervisor && (
                                <button onClick={() => setSelectedSupervisor(null)} className="flex items-center gap-2 bg-[#18181A] border border-[#3A3A3D] text-[#D4D4D6] px-3.5 py-1.5 rounded-[8px] text-[10px] font-semibold hover:border-[#71717A] transition-colors">
                                    Supervisor: {selectedSupervisor.split('(')[0]} <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {selectedMonth && (
                                <button onClick={() => setSelectedMonth(null)} className="flex items-center gap-2 bg-[#18181A] border border-[#3A3A3D] text-[#D4D4D6] px-3.5 py-1.5 rounded-[8px] text-[10px] font-semibold hover:border-[#71717A] transition-colors">
                                    Mes: {selectedMonth} <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {selectedInstallation && (
                                <button onClick={() => setSelectedInstallation(null)} className="flex items-center gap-2 bg-[#18181A] border border-[#3A3A3D] text-[#D4D4D6] px-3.5 py-1.5 rounded-[8px] text-[10px] font-semibold hover:border-[#71717A] transition-colors">
                                    Instalación: {selectedInstallation.split('(')[0]} <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {showCriticalOnly && (
                                <button onClick={() => setShowCriticalOnly(false)} className="flex items-center gap-2 bg-[#D4D4D6] border border-white text-[#0A0A0A] px-3.5 py-1.5 rounded-[8px] text-[10px] font-bold">
                                    FILTRO: ALERTAS CRÍTICAS <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {[
                            { label: 'Solicitudes totales', value: metrics.totalSolicitudes, icon: Layers, trend: comparison?.totalSolicitudesChange, featured: true },
                            { label: 'Ejecutadas', value: metrics.totalEjecutadas, icon: CheckCircle, trend: comparison?.totalEjecutadasChange },
                            { label: 'Eficiencia global', value: `${metrics.porcentajeEjecucion.toFixed(1)}%`, icon: Activity, trend: comparison?.porcentajeEjecucionChange, isPercentage: true }
                        ].map((metric) => (
                            <div key={metric.label} className={cn(
                                "bg-[#111112] border rounded-[12px] p-5 min-h-[160px] flex flex-col justify-between",
                                metric.featured ? "border-[#B8B8BD]" : "border-[#3F3F46]"
                            )}>
                                <div className="flex items-center gap-3 text-[#B8B8BD]">
                                    <metric.icon className="w-5 h-5" />
                                    <p className="text-sm font-medium">{metric.label}</p>
                                </div>
                                <div>
                                    <p className="text-5xl font-semibold text-[#F1F1F2] tracking-tight tabular-nums">{metric.value}</p>
                                    <TrendBadge value={metric.trend} isPercentage={metric.isPercentage} />
                                </div>
                            </div>
                        ))}

                        <div className="grid grid-rows-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setShowCriticalOnly(!showCriticalOnly)}
                                className={cn(
                                    "bg-[#111112] border rounded-[12px] px-5 py-4 text-left transition-colors",
                                    showCriticalOnly ? "border-[#F1F1F2]" : "border-[#3F3F46] hover:border-[#71717A]"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <AlertCircle className="w-5 h-5 text-[#B8B8BD]" />
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-[#8A8A90]">Alertas críticas</p>
                                        <p className="text-2xl font-semibold text-[#F1F1F2] tabular-nums">{metrics.stalledRequests}</p>
                                    </div>
                                </div>
                            </button>
                            <div className="bg-[#111112] border border-[#3F3F46] rounded-[12px] px-5 py-4 flex items-center gap-4">
                                <Building2 className="w-5 h-5 text-[#B8B8BD]" />
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-[#8A8A90]">Instalaciones</p>
                                    <p className="text-2xl font-semibold text-[#F1F1F2] tabular-nums">{metrics.instalacionesIntervenidas}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <main className="w-full px-4 md:px-8 py-8 space-y-10 pb-32">
                    {/* Charts Section */}
                    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8 transition-opacity duration-300", loading ? 'opacity-50' : 'opacity-100')}>

                        {/* Performance por Área */}
                        <section className="lg:col-span-2">
                            <div className="bg-[#111112] border border-[#3F3F46] rounded-xl p-5 md:p-7">
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-6 border-b border-[#242426]">
                                    <div className="flex items-start gap-3">
                                        <Wrench className="w-5 h-5 text-[#D4D4D6] mt-0.5" />
                                        <div>
                                            <h3 className="text-xl font-semibold text-[#F1F1F2]">Desempeño por área de trabajo</h3>
                                            <p className="text-sm text-[#8A8A90] mt-1">Volumen total y porcentaje de eficiencia por especialidad</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-[#A1A1AA] tabular-nums">
                                        {metrics.solicitudesPorArea.length} áreas · {metrics.totalSolicitudes.toLocaleString()} solicitudes · {metrics.porcentajeEjecucion.toFixed(1)}% eficiencia
                                    </p>
                                </div>

                                <div className="mt-5 overflow-x-auto">
                                    <div className="min-w-[780px]">
                                        <div className="grid grid-cols-[36px_220px_minmax(240px,1fr)_70px_190px] gap-4 px-2 pb-3 text-[10px] uppercase tracking-widest text-[#71717A] border-b border-[#242426]">
                                            <span>#</span><span>Área de trabajo</span><span>Volumen</span><span className="text-right">Total</span><span>Eficiencia</span>
                                        </div>
                                        {metrics.solicitudesPorArea.slice(0, 10).map((area, index) => {
                                            const maxTotal = Math.max(...metrics.solicitudesPorArea.map(item => item.total), 1);
                                            return (
                                                <button
                                                    type="button"
                                                    key={area.area}
                                                    onClick={() => setSelectedArea(area.area)}
                                                    className={cn(
                                                        "w-full grid grid-cols-[36px_220px_minmax(240px,1fr)_70px_190px] gap-4 items-center px-2 py-3.5 text-left border-b border-[#1D1D1F] hover:bg-white/[0.025] transition-colors",
                                                        selectedArea === area.area && "bg-white/[0.045]"
                                                    )}
                                                >
                                                    <span className="text-sm text-[#8A8A90] tabular-nums">{index + 1}</span>
                                                    <span className="text-sm text-[#D4D4D6] truncate">{area.area}</span>
                                                    <span className="h-4 bg-[#1D1D1F] border border-[#5A5A5F] rounded-[3px] overflow-hidden">
                                                        <span
                                                            className="block h-full rounded-[2px]"
                                                            style={{
                                                                width: `${Math.max((area.total / maxTotal) * 100, 1)}%`,
                                                                backgroundColor: '#242426',
                                                                backgroundImage: 'repeating-linear-gradient(135deg, transparent 0, transparent 5px, rgba(255,255,255,0.7) 5px, rgba(255,255,255,0.7) 6px)',
                                                                boxShadow: 'inset 0 0 0 1px #B8B8BD'
                                                            }}
                                                        />
                                                    </span>
                                                    <span className="text-right text-sm font-medium text-[#F1F1F2] tabular-nums">{area.total}</span>
                                                    <span className="flex items-center gap-3">
                                                        <span className="w-12 text-right text-sm text-[#D4D4D6] tabular-nums">{area.percentage.toFixed(1)}%</span>
                                                        <span className="relative flex-1 h-px bg-[#3A3A3D]">
                                                            <span className="absolute left-0 top-0 h-px bg-[#B8B8BD]" style={{ width: `${area.percentage}%` }} />
                                                            <span className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#111112] border border-white" style={{ left: `calc(${area.percentage}% - 5px)` }} />
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Cobertura por Instalación */}
                        <section>
                            <div className="bg-[#111112] border border-[#3F3F46] rounded-xl p-5 md:p-6 h-full">
                                <div className="flex items-start gap-3 mb-6">
                                    <Building2 className="w-5 h-5 text-[#D4D4D6] mt-0.5" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-[#F1F1F2]">Instalaciones con mayor demanda</h3>
                                        <p className="text-xs text-[#8A8A90] mt-1">Ejecutadas y pendientes por ubicación</p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {metrics.topInstalaciones.slice(0, 8).map((item, index) => {
                                        const maxTotal = Math.max(...metrics.topInstalaciones.map(value => value.total), 1);
                                        const name = item.name.replace(/ \(\d+(\.\d+)?%\)$/, '');
                                        return (
                                            <button type="button" key={item.name} onClick={() => setSelectedInstallation(item.name)} className="w-full py-3 border-b border-[#1D1D1F] hover:bg-white/[0.025] transition-colors text-left">
                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                    <span className="text-xs text-[#D4D4D6] line-clamp-2"><span className="text-[#71717A] mr-2">{index + 1}</span>{name}</span>
                                                    <span className="text-xs font-medium text-[#F1F1F2] tabular-nums shrink-0">{item.total} · {item.percentage.toFixed(1)}%</span>
                                                </div>
                                                <div className="h-3 bg-[#1D1D1F] border border-[#B8B8BD] rounded-[3px] overflow-hidden flex" style={{ width: `${Math.max((item.total / maxTotal) * 100, 4)}%` }}>
                                                    <span style={{
                                                        width: `${item.total ? (item.executed / item.total) * 100 : 0}%`,
                                                        backgroundColor: '#242426',
                                                        backgroundImage: 'repeating-linear-gradient(135deg, transparent 0, transparent 4px, rgba(255,255,255,0.7) 4px, rgba(255,255,255,0.7) 5px)',
                                                        boxShadow: 'inset 0 0 0 1px #8A8A90'
                                                    }} />
                                                    <span className="bg-[#77777D] border-l border-white" style={{ width: `${item.total ? (item.pending / item.total) * 100 : 0}%`, boxShadow: 'inset 0 0 0 1px #D4D4D6' }} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-5 mt-5 text-[10px] text-[#8A8A90] uppercase tracking-widest">
                                    <span className="flex items-center gap-2"><i className="w-6 h-3 border border-[#8A8A90]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0, transparent 3px, rgba(255,255,255,0.55) 3px, rgba(255,255,255,0.55) 4px)' }} />Ejecutadas</span>
                                    <span className="flex items-center gap-2"><i className="w-6 h-3 bg-[#77777D] border border-[#D4D4D6]" />Pendientes</span>
                                </div>
                            </div>
                        </section>

                        {/* Desempeño por Supervisión */}
                        <section>
                            <div className="bg-[#111112] border border-[#3F3F46] rounded-xl p-5 md:p-6 h-full">
                                <div className="flex items-start gap-3 mb-6">
                                    <Activity className="w-5 h-5 text-[#D4D4D6] mt-0.5" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-[#F1F1F2]">Desempeño por supervisión</h3>
                                        <p className="text-xs text-[#8A8A90] mt-1">Cumplimiento y volumen por responsable</p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {metrics.performanceSupervisores.slice(0, 8).map((item, index) => {
                                        const maxTotal = Math.max(...metrics.performanceSupervisores.map(value => value.total), 1);
                                        const supervisor = item.supervisor.replace(/ \(\d+(\.\d+)?%\)$/, '');
                                        return (
                                            <button type="button" key={item.supervisor} onClick={() => setSelectedSupervisor(item.supervisor)} className="w-full py-3 border-b border-[#1D1D1F] hover:bg-white/[0.025] transition-colors text-left">
                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                    <span className="text-xs text-[#D4D4D6] line-clamp-2"><span className="text-[#71717A] mr-2">{index + 1}</span>{supervisor}</span>
                                                    <span className="text-xs font-medium text-[#F1F1F2] tabular-nums shrink-0">{item.executed} / {item.pending} · {item.percentage.toFixed(1)}%</span>
                                                </div>
                                                <div className="h-3 bg-[#1D1D1F] border border-[#B8B8BD] rounded-[3px] overflow-hidden flex" style={{ width: `${Math.max((item.total / maxTotal) * 100, 4)}%` }}>
                                                    <span style={{
                                                        width: `${item.total ? (item.executed / item.total) * 100 : 0}%`,
                                                        backgroundColor: '#242426',
                                                        backgroundImage: 'repeating-linear-gradient(135deg, transparent 0, transparent 4px, rgba(255,255,255,0.7) 4px, rgba(255,255,255,0.7) 5px)',
                                                        boxShadow: 'inset 0 0 0 1px #8A8A90'
                                                    }} />
                                                    <span className="bg-[#77777D] border-l border-white" style={{ width: `${item.total ? (item.pending / item.total) * 100 : 0}%`, boxShadow: 'inset 0 0 0 1px #D4D4D6' }} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-5 mt-5 text-[10px] text-[#8A8A90] uppercase tracking-widest">
                                    <span className="flex items-center gap-2"><i className="w-6 h-3 border border-[#8A8A90]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0, transparent 3px, rgba(255,255,255,0.55) 3px, rgba(255,255,255,0.55) 4px)' }} />Ejecutadas</span>
                                    <span className="flex items-center gap-2"><i className="w-6 h-3 bg-[#77777D] border border-[#D4D4D6]" />Pendientes</span>
                                </div>
                            </div>
                        </section>
                        {/* Evolución Cronológica */}
                        <section className="lg:col-span-2">
                            <div className="bg-[#111112] border border-[#3F3F46] rounded-xl p-5 md:p-7">
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 mb-5">
                                    <div className="flex items-start gap-3">
                                        <Calendar className="w-5 h-5 text-[#D4D4D6] mt-0.5" />
                                        <div>
                                            <h3 className="text-xl font-semibold text-[#F1F1F2]">Evolución cronológica</h3>
                                            <p className="text-sm text-[#8A8A90] mt-1">Histórico mensual de solicitudes ejecutadas y pendientes</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-5 text-center tabular-nums">
                                        <div><strong className="block text-lg text-[#F1F1F2]">{metrics.totalSolicitudes.toLocaleString()}</strong><span className="text-[9px] uppercase tracking-widest text-[#71717A]">Total</span></div>
                                        <div><strong className="block text-lg text-[#F1F1F2]">{metrics.totalEjecutadas.toLocaleString()}</strong><span className="text-[9px] uppercase tracking-widest text-[#71717A]">Ejecutadas</span></div>
                                        <div><strong className="block text-lg text-[#F1F1F2]">{(metrics.totalSolicitudes - metrics.totalEjecutadas).toLocaleString()}</strong><span className="text-[9px] uppercase tracking-widest text-[#71717A]">Pendientes</span></div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-5 mb-4 text-[10px] uppercase tracking-widest text-[#8A8A90]">
                                    <span className="flex items-center gap-2"><i className="w-7 h-3 border border-[#8A8A90]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0, transparent 3px, rgba(255,255,255,0.55) 3px, rgba(255,255,255,0.55) 4px)' }} />Ejecutadas</span>
                                    <span className="flex items-center gap-2"><i className="w-7 h-3 bg-[#77777D] border border-[#D4D4D6]" />Pendientes</span>
                                    <span className="flex items-center gap-2"><i className="w-7 border-t border-dashed border-white relative"><b className="absolute w-2 h-2 rounded-full border border-white bg-[#111112] left-1/2 -translate-x-1/2 -top-[5px]" /></i>Tendencia proyectada</span>
                                </div>
                                <div className="h-[430px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={metrics.solicitudesPorMes} margin={{ top: 28, right: 30, left: 0, bottom: 8 }} onClick={(data) => data?.activeLabel && setSelectedMonth(data.activeLabel)}>
                                            <defs>
                                                <pattern id="executedGraphite" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                                    <rect width="8" height="8" fill="#242426" />
                                                    <line x1="0" y1="0" x2="0" y2="8" stroke="#B8B8BD" strokeWidth="1.25" />
                                                </pattern>
                                            </defs>
                                            <CartesianGrid strokeDasharray="4 5" stroke="#303034" vertical={false} />
                                            <XAxis dataKey="month" stroke="#3A3A3D" fontSize={11} tickLine={false} axisLine={{ stroke: '#71717A' }} tick={{ fill: '#B8B8BD' }} />
                                            <YAxis stroke="#3A3A3D" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#8A8A90' }} />
                                            <Tooltip content={<CustomTooltip unit="sol." />} />
                                            <ReferenceLine x={format(new Date(), 'MMM. yy', { locale: es })} stroke="#71717A" strokeDasharray="4 4" label={{ value: 'MES EN CURSO', fill: '#A1A1AA', fontSize: 9, position: 'insideTopRight' }} />
                                            <Bar dataKey="executed" name="Ejecutadas" stackId="a" fill="url(#executedGraphite)" stroke="#B8B8BD" strokeWidth={1} barSize={44} />
                                            <Bar dataKey="pending" name="Pendientes" stackId="a" fill="#77777D" stroke="#F1F1F2" strokeWidth={1} barSize={44} radius={[3, 3, 0, 0]}>
                                                <LabelList dataKey="total" position="top" fill="#F1F1F2" fontSize={11} fontWeight={600} />
                                            </Bar>
                                            <Line type="monotone" dataKey="tendencia" name="Tendencia proyectada" stroke="#F1F1F2" strokeWidth={2} strokeDasharray="7 7" dot={{ r: 4, fill: '#111112', stroke: '#F1F1F2', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#111112', stroke: '#FFFFFF', strokeWidth: 2 }} />
                                            {metrics.tendenciaFormula && (
                                                <text
                                                    x="95%"
                                                    y="13%"
                                                    textAnchor="end"
                                                    fill="#B8B8BD"
                                                    style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}
                                                >
                                                    {metrics.tendenciaFormula}
                                                </text>
                                            )}
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
                                        <Search className="text-[#B8B8BD] w-5 h-5" />
                                        Solicitudes Activas <span className="text-[#8A8A90]">({totalItems})</span>
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
                                                { header: 'ID', width: '6%', className: 'font-bold text-[#D4D4D6]' },
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
                                                        <span className="bg-[#18181A] border border-[#3A3A3D] px-2 py-1 rounded-[4px] text-[9px] font-bold text-[#B8B8BD] uppercase text-center truncate">
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
                                                                    days > 10 ? "bg-white" : days > 5 ? "bg-[#8A8A90]" : "bg-[#3A3A3D]"
                                                                )} />
                                                                <span className="text-[8px] font-bold text-[#86868B]">{days}d</span>
                                                            </div>
                                                        );
                                                    }
                                                    case 7: return (
                                                        <span className={cn(
                                                            "text-center px-2 py-1 rounded-[4px] text-[9px] font-bold uppercase",
                                                            item.status_normalized === 'ACTIVA' ? 'bg-[#242426] text-[#D4D4D6] border border-[#71717A]' :
                                                                item.status_normalized === 'EJECUTADA' ? 'bg-[#D4D4D6] text-[#111112] border border-white' :
                                                                    'bg-[#18181A] text-[#A1A1AA] border border-[#3A3A3D]'
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
                                            <div className="h-full bg-[#D4D4D6]" style={{ width: `${(Math.min(currentPage * itemsPerPage, totalItems) / totalItems) * 100}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 border border-[#333333] rounded-[8px] disabled:opacity-20 hover:border-[#B8B8BD] transition-all"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <span className="px-4 py-2 text-[10px] font-bold text-[#F5F5F7] tracking-widest uppercase">Página {currentPage}</span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(p + 1, Math.ceil(totalItems / itemsPerPage)))}
                                            disabled={currentPage * itemsPerPage >= totalItems}
                                            className="p-2 border border-[#333333] rounded-[8px] disabled:opacity-20 hover:border-[#B8B8BD] transition-all"
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
                                        <div className="w-10 h-10 rounded-[8px] bg-[#18181A] flex items-center justify-center text-[#D4D4D6] border border-[#3A3A3D]">
                                            <AlertTriangle className="w-5 h-5" />
                                        </div>
                                        Alertas de Atención Crítica
                                    </h3>
                                    <span className="bg-[#D4D4D6] text-[#111112] text-[10px] font-bold tracking-widest uppercase px-4 py-2 rounded-[8px] border border-white">
                                        {metrics.solicitudesEstancadas.length} Solicitudes con Retraso
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {metrics.solicitudesEstancadas.map((s, idx) => (
                                        <div key={idx} className="glass-card p-6 hover:border-[#B8B8BD] transition-all group relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-4">
                                                <p className="text-[10px] font-bold text-[#B8B8BD] uppercase tracking-widest">{s.descripcion_area || 'Área N/A'}</p>
                                                <p className="text-[10px] font-bold text-[#111112] bg-[#D4D4D6] px-2 py-1 rounded-[4px]">#{s.numero_solicitud}</p>
                                            </div>
                                            <h4 className="text-[#F5F5F7] font-bold text-sm mb-6 leading-tight line-clamp-2">{s.detalle_solicitud || 'Sin detalles'}</h4>
                                            <div className="flex items-center gap-3 pt-4 border-t border-[#333333]">
                                                <Clock className="w-4 h-4 text-[#B8B8BD]" />
                                                <div>
                                                    <p className="text-[9px] font-bold text-[#86868B] uppercase tracking-widest mb-0.5">Retraso Estimado</p>
                                                    <p className="text-[#D4D4D6] font-bold text-xs">{s.dias_espera} Días en Espera</p>
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
                    <Activity className="w-5 h-5 text-[#D4D4D6] animate-spin" />
                    Actualizando Dashboard
                </div>
            )}
        </div>
    );
}
