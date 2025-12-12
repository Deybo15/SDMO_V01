import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { differenceInDays, subDays, format, isValid, parseISO, parse, lastDayOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Activity,
    CheckCircle2,
    Calendar,
    MapPin,
    Wrench,
    Building2,
    FileText,
    ChevronLeft,
    ChevronRight,
    Search,
    Download,
    TrendingUp,
    TrendingDown,
    Minus,
    XCircle
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ComposedChart,
    Line,
    Legend,
    Cell,
    PieChart,
    Pie,
    LabelList
} from 'recharts';

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

    const [tableData, setTableData] = useState<any[]>([]); // Typed as any for flexibility with view
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [totalItems, setTotalItems] = useState(0); // For server pagination

    // Main Data Loading Effect
    useEffect(() => {
        loadDashboard();
        setCurrentPage(1); // Reset to page 1 on filter change
    }, [startDate, endDate, selectedArea, selectedSupervisor, selectedMonth, selectedInstallation]);

    // Table Pagination Effect
    useEffect(() => {
        fetchTableData(currentPage);
    }, [currentPage]); // Only Refetch table when page changes (filters handled by above generic reset)

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

            // Filters
            // Supervisor needs special handling to strip "(%)" if it comes from chart click
            const cleanSupervisor = selectedSupervisor ? selectedSupervisor.replace(/ \(\d+(\.\d+)?%\)$/, '') : null;

            const rpcParams = {
                p_area: selectedArea,
                p_supervisor: cleanSupervisor,
                p_installation: selectedInstallation,
                p_month_filter: null // Month filter in view compares YYYY-MM
            };

            // Month logic: Chart passes "MMM. yy" (e.g. "dic. 24")
            // We need to convert to "2024-12" for SQL
            // However, the RPC expects string matching.
            // Let's rely on the RPC doing the exact match if we passed it correctly? 
            // Wait, the RPC expects 'YYYY-MM'.
            // Simple map or parse:
            let monthParam = null;
            if (selectedMonth) {
                // Parse "MMM. yy" back to date
                const parsedM = parse(selectedMonth, 'MMM. yy', new Date(), { locale: es });
                if (isValid(parsedM)) {
                    monthParam = format(parsedM, 'yyyy-MM');
                }
            }

            // 1. Fetch Metrics (Current vs Previous)
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

                // Calculations
                const pct = cur.overall.total > 0 ? (cur.overall.executed / cur.overall.total) * 100 : 0;
                const prevPct = prev.overall.total > 0 ? (prev.overall.executed / prev.overall.total) * 100 : 0;

                // Format Top Install
                // RPC returns {name, count} - compatible

                // Format Areas
                // RPC: {area, total, executed} -> Add percentage
                const solicitudesPorArea = (cur.areas || []).map((a: any) => ({
                    ...a,
                    percentage: a.total > 0 ? (a.executed / a.total) * 100 : 0
                }));

                // Format Supervisors
                // RPC: {supervisor, total, executed} -> Add percentage and formatted name
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

                // Format Months
                // RPC: {month_key: '2024-12', total, executed}
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

                // Comparisons
                const calcChange = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;
                setComparison({
                    totalSolicitudesChange: calcChange(cur.overall.total, prev.overall.total),
                    totalEjecutadasChange: calcChange(cur.overall.executed, prev.overall.executed),
                    porcentajeEjecucionChange: pct - prevPct,
                    instalacionesIntervenidasChange: calcChange(cur.overall.coverage, prev.overall.coverage)
                });
            }

            // 2. Fetch Initial Table Data (Page 1)
            await fetchTableData(1);

        } catch (error) {
            console.error("Dashboard Load Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTableData = async (page: number) => {
        // We reuse the same filters logic
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
        // Note: Supabase doesn't have a simple "to_char" filter in JS client.
        // We can use a custom filter or just rely on the view having the date column.
        // Wait, for MONTH filter on Table, it's tricky with standard JS client without a computed column.
        // But wait, the view has 'fecha_solicitud'.
        // We can mimic the month filter using gte/lte for the specific month range IF month is selected.
        if (monthParam) {
            // e.g. 2024-12
            const mStart = `${monthParam}-01`;
            const mLast = format(lastDayOfMonth(parseISO(mStart)), 'yyyy-MM-dd');
            // Constrain query to this month (intersection with global range)
            query = query.gte('fecha_solicitud', mStart).lte('fecha_solicitud', `${mLast} 23:59:59`);
        }

        // Exclude unwanted statuses for the table list (to match previous logic)
        // 'EJECUTADA', 'FINALIZADA', 'COMPLETADA', 'CERRADA' were EXCLUDED in the frontend filter before?
        // Wait, checking code... 
        // "const activeTableData = currentResults.processedList.filter... isExcluded ... if (isExcluded) return false;"
        // YES, the table showed PENDING items.
        // So we should filter OUT those statuses.
        // Using not.in
        query = query.not('status_normalized', 'in', '("EJECUTADA","FINALIZADA","COMPLETADA","CERRADA")');

        const { data, count, error } = await query;
        if (error) {
            console.error("Table Error", error);
        } else {
            setTableData(data || []);
            setTotalItems(count || 0);
        }
    };

    const handleExport = async () => {
        setLoading(true);
        // Download ALL data for export
        const cleanSupervisor = selectedSupervisor ? selectedSupervisor.replace(/ \(\d+(\.\d+)?%\)$/, '') : null;
        let query = supabase.from('vw_dashboard_analyzed').select('*');
        // Apply inputs same as table... (duplicated logic, could extract)
        query = query.gte('fecha_solicitud', startDate).lte('fecha_solicitud', `${endDate} 23:59:59`);
        if (selectedArea) query = query.eq('descripcion_area', selectedArea);
        if (cleanSupervisor) query = query.eq('supervisor_asignado_alias', cleanSupervisor);
        if (selectedInstallation) query = query.eq('base_location', selectedInstallation);
        // Filter 'Pending' only? Usually reports want EVERYTHING right?
        // The previous "handleExport" used "tableData" which was Filtered for Pending.
        // But the Summary Sheet used "metrics".
        // Let's assume the user wants the same list as the table (Pending) OR everything?
        // Usually a "Reporte de Mantenimiento" implies what happened.
        // "Detail Sheet" in previous code was `tableData` which WAS filtered. 
        // Okay, sticking to filtered Pending for detail to match UI.
        query = query.not('status_normalized', 'in', '("EJECUTADA","FINALIZADA","COMPLETADA","CERRADA")');

        const { data, error } = await query;
        if (error || !data) {
            setLoading(false);
            return;
        }

        // 1. Summary Sheet (Use current Metrics state)
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

        // 2. Detail Sheet
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

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTableItems = tableData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(tableData.length / itemsPerPage);

    const TrendBadge = ({ value, isPercentage = false }: { value?: number, isPercentage?: boolean }) => {
        if (value === undefined) return null;
        const isPositive = value >= 0;
        const Icon = isPositive ? TrendingUp : TrendingDown;
        // For efficiency, higher is generally better. For pure volume, visual depends on context.
        const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';

        return (
            <div className={`flex items-center gap-1 text-xs font-medium ${colorClass} mt-2`}>
                <Icon className="w-3 h-3" />
                <span>{Math.abs(value).toFixed(1)}{isPercentage ? ' pts' : '%'} vs periodo anterior</span>
            </div>
        );
    };

    // Initial Loading State (Full Screen)
    if (loading && !metrics) {
        return (
            <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Cargando Dashboard de Mantenimiento...</p>
                    <p className="text-xs text-slate-600 mt-2">Analizando desempeño histórico...</p>
                </div>
            </div>
        );
    }

    if (!metrics) return null;

    return (
        <div className="min-h-screen bg-[#0F172A] text-slate-100 p-8 relative">

            {/* Update Indicator (Non-blocking) */}
            {loading && (
                <div className="fixed bottom-4 right-4 bg-emerald-500/90 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 text-sm font-medium backdrop-blur-sm animate-pulse">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Actualizando datos...
                </div>
            )}

            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Activity className="w-8 h-8 text-emerald-500" />
                        Panel de Control de Mantenimiento (STI)
                    </h1>
                    <div className="flex items-center gap-3 mt-2">
                        <p className="text-slate-400">
                            Comparativa de Desempeño y Cobertura
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {selectedArea && (
                                <button
                                    onClick={() => setSelectedArea(null)}
                                    className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-blue-500/30 transition-colors"
                                >
                                    Área: {selectedArea} <XCircle className="w-3 h-3" />
                                </button>
                            )}
                            {selectedSupervisor && (
                                <button
                                    onClick={() => setSelectedSupervisor(null)}
                                    className="flex items-center gap-1 bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-purple-500/30 transition-colors"
                                >
                                    Sup: {selectedSupervisor.split('(')[0]} <XCircle className="w-3 h-3" />
                                </button>
                            )}
                            {selectedMonth && (
                                <button
                                    onClick={() => setSelectedMonth(null)}
                                    className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
                                >
                                    Mes: {selectedMonth} <XCircle className="w-3 h-3" />
                                </button>
                            )}
                            {selectedInstallation && (
                                <button
                                    onClick={() => setSelectedInstallation(null)}
                                    className="flex items-center gap-1 bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-orange-500/30 transition-colors"
                                >
                                    Instalación: {selectedInstallation} <XCircle className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 items-center">
                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors border border-blue-500 shadow-lg shadow-blue-900/20"
                    >
                        <Download className="w-4 h-4" />
                        Exportar Reporte
                    </button>

                    {/* Date Filter */}
                    <div className="flex gap-4 bg-slate-800 p-2 rounded-lg border border-slate-700">
                        <div className='flex flex-col'>
                            <label className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Desde</label>
                            <input
                                type="date"
                                className="bg-slate-700 text-white text-sm rounded px-3 py-1 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className='flex flex-col'>
                            <label className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Hasta</label>
                            <input
                                type="date"
                                className="bg-slate-700 text-white text-sm rounded px-3 py-1 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className={`grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                {/* Solicitudes Totales */}
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute opacity-10 right-[-20px] top-[-20px] bg-blue-500 w-32 h-32 rounded-full blur-3xl group-hover:opacity-20 transition-opacity"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-xl">
                            <FileText className="w-6 h-6 text-blue-500" />
                        </div>
                        <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-1 rounded-full">Total Periodo</span>
                    </div>
                    <div>
                        <p className="text-slate-400 text-sm font-medium">Solicitudes Totales</p>
                        <p className="text-4xl font-bold text-white mt-1">{metrics.totalSolicitudes}</p>
                        <TrendBadge value={comparison?.totalSolicitudesChange} />
                    </div>
                </div>

                {/* Solicitudes Ejecutadas */}
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute opacity-10 right-[-20px] top-[-20px] bg-emerald-500 w-32 h-32 rounded-full blur-3xl group-hover:opacity-20 transition-opacity"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-500/10 rounded-xl">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        </div>
                        <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-1 rounded-full">Completadas</span>
                    </div>
                    <div>
                        <p className="text-slate-400 text-sm font-medium">Solicitudes Ejecutadas</p>
                        <p className="text-4xl font-bold text-white mt-1">{metrics.totalEjecutadas}</p>
                        <TrendBadge value={comparison?.totalEjecutadasChange} />
                    </div>
                </div>

                {/* % Ejecución - Gauge Visual */}
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl relative overflow-hidden group flex flex-col items-center justify-between">
                    <div className="absolute opacity-10 right-[-20px] top-[-20px] bg-purple-500 w-32 h-32 rounded-full blur-3xl group-hover:opacity-20 transition-opacity"></div>

                    <div className="w-full h-[120px] flex items-center justify-center relative mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[{ value: 100 }]}
                                    cx="50%"
                                    cy="100%" // Anchor at bottom
                                    startAngle={180}
                                    endAngle={0}
                                    innerRadius={60}
                                    outerRadius={80}
                                    dataKey="value"
                                    stroke="none"
                                    fill="#334155" // Track color
                                />
                                <Pie
                                    data={[{ value: metrics.porcentajeEjecucion }, { value: 100 - metrics.porcentajeEjecucion }]}
                                    cx="50%"
                                    cy="100%"
                                    startAngle={180}
                                    endAngle={0}
                                    innerRadius={60}
                                    outerRadius={80}
                                    dataKey="value"
                                    stroke="none"
                                    cornerRadius={6}
                                    paddingAngle={0}
                                >
                                    <Cell fill="#8B5CF6" />
                                    <Cell fill="transparent" />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Centered Percentage (Absolute relative to container) */}
                        <div className="absolute bottom-0 mb-2 flex flex-col items-center">
                            <p className="text-3xl font-bold text-white drop-shadow-lg">{metrics.porcentajeEjecucion.toFixed(1)}%</p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center mt-2 z-10">
                        <p className="text-slate-400 text-sm font-medium">Eficiencia Global</p>
                        <TrendBadge value={comparison?.porcentajeEjecucionChange} isPercentage={true} />
                    </div>
                </div>

                {/* Instalaciones Intervenidas */}
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute opacity-10 right-[-20px] top-[-20px] bg-orange-500 w-32 h-32 rounded-full blur-3xl group-hover:opacity-20 transition-opacity"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-orange-500/10 rounded-xl">
                            <Building2 className="w-6 h-6 text-orange-500" />
                        </div>
                        <span className="bg-orange-500/10 text-orange-400 text-xs px-2 py-1 rounded-full">Cobertura</span>
                    </div>
                    <div>
                        <p className="text-slate-400 text-sm font-medium">Instalaciones Intervenidas</p>
                        <p className="text-4xl font-bold text-white mt-1">{metrics.instalacionesIntervenidas}</p>
                        <TrendBadge value={comparison?.instalacionesIntervenidasChange} />
                    </div>
                </div>
            </div>

            {/* Main Content Info Rows */}
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>

                {/* 1. Solicitudes por Area (Combo Chart) */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Wrench className="w-5 h-5 text-blue-400" />
                            Solicitudes por Área de Trabajo y % Ejecución
                        </h3>
                        {!selectedArea && <span className="text-xs text-slate-500 italic">Haz clic en una barra para filtrar</span>}
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={metrics.solicitudesPorArea}
                                onClick={(data) => {
                                    if (data && data.activeLabel) {
                                        setSelectedArea(data.activeLabel);
                                    }
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis
                                    dataKey="area"
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={0}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#8B5CF6" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                                <Tooltip
                                    cursor={{ fill: '#334155', opacity: 0.2 }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar
                                    yAxisId="left"
                                    dataKey="total"
                                    name="Solicitudes Totales"
                                    fill="#3b82f6"
                                    radius={[4, 4, 0, 0]}
                                    barSize={40}
                                    className="cursor-pointer hover:opacity-80"
                                >
                                    {metrics.solicitudesPorArea.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={selectedArea === entry.area ? '#f59e0b' : '#3b82f6'}
                                        />
                                    ))}
                                </Bar>
                                <Line
                                    yAxisId="right"
                                    type="linear"
                                    dataKey="percentage"
                                    name="% Ejecutado"
                                    stroke="#f59e0b"
                                    strokeWidth={3}
                                    dot={{ fill: '#f59e0b', r: 4 }}
                                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Top Instalaciones Intervenidas (Horizontal Bar) */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-orange-400" />
                            Instalaciones Más Intervenidas
                        </h3>
                        {!selectedInstallation && <span className="text-xs text-slate-500 italic">Clic para filtrar</span>}
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={metrics.topInstalaciones}
                                margin={{ left: 20 }}
                                onClick={(data) => {
                                    if (data && data.activeLabel) setSelectedInstallation(data.activeLabel);
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    width={150}
                                />
                                <Tooltip
                                    cursor={{ fill: '#334155', opacity: 0.2 }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                />
                                <Bar
                                    dataKey="count"
                                    name="Intervenciones"
                                    fill="#f97316"
                                    radius={[0, 4, 4, 0]}
                                    barSize={20}
                                    className="cursor-pointer hover:opacity-80"
                                >
                                    {metrics.topInstalaciones.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={selectedInstallation === entry.name ? '#f59e0b' : '#f97316'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Solicitudes por Mes (Trend) */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-emerald-400" />
                            Tendencia Mensual de Solicitudes
                        </h3>
                        {!selectedMonth && <span className="text-xs text-slate-500 italic">Clic para filtrar</span>}
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={metrics.solicitudesPorMes}
                                onClick={(data) => {
                                    if (data && data.activeLabel) setSelectedMonth(data.activeLabel);
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#34d399" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                                <Tooltip
                                    cursor={{ fill: '#334155', opacity: 0.2 }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar
                                    yAxisId="left"
                                    dataKey="total"
                                    name="Recibidas"
                                    fill="#60a5fa"
                                    radius={[4, 4, 0, 0]}
                                    barSize={20}
                                    className="cursor-pointer hover:opacity-80"
                                >
                                    {metrics.solicitudesPorMes.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={selectedMonth === entry.month ? '#f59e0b' : '#60a5fa'}
                                        />
                                    ))}
                                </Bar>
                                <Line yAxisId="right" type="monotone" dataKey="percentage" name="% Ejecución" stroke="#34d399" strokeWidth={3} dot={{ fill: '#34d399' }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Carga por Supervisor (Stacked Bar) */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-purple-400" />
                            Carga de Trabajo y Desempeño por Supervisor
                        </h3>
                        {!selectedSupervisor && <span className="text-xs text-slate-500 italic">Clic para filtrar</span>}
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={metrics.performanceSupervisores}
                                layout="vertical"
                                margin={{ left: 100, right: 20 }}
                                onClick={(data) => {
                                    if (data && data.activeLabel) setSelectedSupervisor(data.activeLabel);
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis
                                    type="category"
                                    dataKey="supervisor"
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={0}
                                    width={200}
                                />
                                <Tooltip
                                    cursor={{ fill: '#334155', opacity: 0.2 }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                <Bar
                                    dataKey="executed"
                                    name="Completado"
                                    stackId="a"
                                    fill="#10b981"
                                    radius={[0, 4, 4, 0]}
                                    barSize={20}
                                    className="cursor-pointer hover:opacity-80"
                                >
                                    {metrics.performanceSupervisores.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={selectedSupervisor === entry.supervisor ? '#f59e0b' : '#10b981'}
                                        />
                                    ))}
                                </Bar>
                                <Bar
                                    dataKey="pending"
                                    name="Pendiente"
                                    stackId="a"
                                    fill="#3b82f6"
                                    radius={[0, 4, 4, 0]}
                                    barSize={20}
                                    className="cursor-pointer hover:opacity-80"
                                >
                                    {metrics.performanceSupervisores.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={selectedSupervisor === entry.supervisor ? '#fbbf24' : '#3b82f6'}
                                        />
                                    ))}
                                </Bar>

                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* Detailed Data Table */}
            <div className={`bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Search className="w-5 h-5 text-slate-400" />
                        Detalle de Solicitudes Activas ({tableData.length})
                    </h3>
                </div>

                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                            <tr className="border-b border-slate-700 text-slate-400 text-sm">
                                <th className="p-3 w-16">#</th>
                                <th className="p-3 w-28">Fecha</th>
                                <th className="p-3 w-1/5">Ubicación (Base)</th>
                                <th className="p-3 w-1/6">Área</th>
                                <th className="p-3 w-1/6">Supervisor</th>
                                <th className="p-3">Descripción</th>
                                <th className="p-3 w-28">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-slate-300 divide-y divide-slate-700">
                            {currentTableItems.length > 0 ? (
                                currentTableItems.map((item) => (
                                    <tr key={item.numero_solicitud} className="hover:bg-slate-700/50 transition-colors">
                                        <td className="p-3 font-medium text-white truncate">{item.numero_solicitud}</td>
                                        <td className="p-3 truncate">{item.fecha_solicitud}</td>
                                        <td className="p-3 truncate" title={item.baseLocation}>{item.baseLocation}</td>
                                        <td className="p-3 truncate" title={item.descripcion_area || ''}>{item.descripcion_area || '-'}</td>
                                        <td className="p-3 truncate" title={item.supervisor_asignado_alias || ''}>
                                            {item.supervisor_asignado_alias || <span className="text-slate-500 italic">Sin Asignar</span>}
                                        </td>
                                        <td className="p-3 max-w-[200px] truncate" title={item.descripcion_solicitud || ''}>
                                            {item.descripcion_solicitud || '-'}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                                ${item.status === 'PENDIENTE' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    item.status === 'EN PROCESO' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-slate-600/30 text-slate-400'
                                                }`}>
                                                {item.status || 'N/A'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        No se encontraron solicitudes activas para los filtros seleccionados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalItems > 0 && (
                    <div className="mt-6 flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <span className="text-sm text-slate-400">
                            Mostrando {totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} resultados
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 text-slate-300" />
                            </button>
                            <span className="flex items-center px-4 bg-slate-700/50 rounded-lg text-sm text-slate-300 font-medium">
                                Página {currentPage} de {Math.max(1, Math.ceil(totalItems / itemsPerPage))}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalItems / itemsPerPage)))}
                                disabled={currentPage >= Math.ceil(totalItems / itemsPerPage)}
                                className="p-2 hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-slate-300" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
