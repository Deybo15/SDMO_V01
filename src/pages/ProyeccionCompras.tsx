import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
    Calculator,
    Download,
    Calendar,
    DollarSign,
    Package,
    ArrowRight,
    PieChart,
    BarChart as BarChartIcon,
    Settings2,
    ChevronLeft,
    ChevronRight,
    Search,
    Filter,
    ArrowUpDown,
    FileText,
    AlertOctagon,
    ChevronDown,
    Activity,
    Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

interface ProyeccionItem {
    codigo_articulo: string;
    nombre_articulo: string;
    unidad: string;
    codigo_gasto: string;
    nombre_partida: string;
    stock_actual: number;
    promedio_mensual: number;
    consumo_espera: number;
    stock_residual: number;
    demanda_futura: number;
    cantidad_sugerida: number;
    ultimo_precio: number;
    costo_estimado: number;
}

export default function ProyeccionCompras() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ProyeccionItem[]>([]);

    // Parameters
    const [mesesLeadTime, setMesesLeadTime] = useState(10);
    const [mesesCiclo, setMesesCiclo] = useState(12);
    const [factorSeguridad, setFactorSeguridad] = useState(1.1);
    const [mesesHistorico, setMesesHistorico] = useState(12);

    // Filter/Sort State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGasto, setSelectedGasto] = useState<string>('TODOS');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ProyeccionItem; direction: 'asc' | 'desc' } | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initial Fetch (triggered by parameters)
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProyeccion();
        }, 500);
        return () => clearTimeout(timer);
    }, [mesesLeadTime, mesesCiclo, factorSeguridad, mesesHistorico]);

    // Click outside for dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchProyeccion = async () => {
        setLoading(true);
        try {
            let allData: ProyeccionItem[] = [];
            let from = 0;
            const batchSize = 1000;
            let fetching = true;

            while (fetching) {
                const { data: batch, error } = await supabase.rpc('calcular_proyeccion_compras', {
                    meses_historico: mesesHistorico,
                    meses_espera: mesesLeadTime,
                    meses_ciclo: mesesCiclo,
                    factor_seguridad: factorSeguridad
                }).range(from, from + batchSize - 1);

                if (error) throw error;
                if (batch && batch.length > 0) {
                    allData = [...allData, ...batch];
                    if (batch.length < batchSize) fetching = false;
                    else from += batchSize;
                } else {
                    fetching = false;
                }
            }
            setData(allData);
        } catch (error) {
            console.error('Error fetching projection:', error);
        } finally {
            setLoading(false);
        }
    };

    // Derived Logic
    const uniqueGastos = useMemo(() => Array.from(new Set(data.filter(i => i.nombre_partida).map(i => i.nombre_partida))).sort(), [data]);

    const processedData = useMemo(() => {
        return data.filter(item => {
            const matchSearch =
                (item.nombre_articulo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (item.codigo_articulo?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            const matchGasto = selectedGasto === 'TODOS' || item.nombre_partida === selectedGasto;
            return matchSearch && matchGasto;
        }).sort((a, b) => {
            if (!sortConfig) return 0;
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, searchTerm, selectedGasto, sortConfig]);

    const totalPages = Math.ceil(processedData.length / itemsPerPage);
    const paginatedData = useMemo(() => processedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [processedData, currentPage]);

    const chartData = useMemo(() => {
        const gastosMap = data.reduce((acc, item) => {
            const codigo = item.codigo_gasto || 'SIN ASIGNAR';
            const nombre = item.nombre_partida || 'Desconocido';
            if (!acc[codigo]) acc[codigo] = { code: codigo, name: nombre, value: 0 };
            acc[codigo].value += item.costo_estimado;
            return acc;
        }, {} as Record<string, { code: string, name: string, value: number }>);
        return Object.values(gastosMap).sort((a, b) => b.value - a.value).slice(0, 15);
    }, [data]);

    const stats = useMemo(() => ({
        totalPresupuesto: data.reduce((acc, i) => acc + (i.costo_estimado || 0), 0),
        itemsAComprar: data.filter(i => i.cantidad_sugerida > 0).length,
        totalItems: data.length,
        totalCategorias: uniqueGastos.length
    }), [data, uniqueGastos]);

    const handleSort = (key: keyof ProyeccionItem) => {
        setSortConfig(current => ({
            key,
            direction: current?.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        const itemsToBuy = processedData.filter(i => i.cantidad_sugerida > 0);
        if (itemsToBuy.length === 0) {
            alert('No hay artículos sugeridos para compra en la selección actual.');
            return;
        }
        doc.setFontSize(20);
        doc.text('Requisición de Compra Sugerida (SDMO)', 14, 22);
        const tableBody = itemsToBuy.map(item => [
            item.codigo_articulo,
            item.nombre_articulo.substring(0, 60),
            item.unidad,
            Math.ceil(item.cantidad_sugerida),
            `Col. ${item.ultimo_precio.toLocaleString()}`,
            `Col. ${item.costo_estimado.toLocaleString()}`
        ]);
        autoTable(doc, {
            head: [['Código', 'Artículo', 'Unidad', 'Cant.', 'Precio Unit.', 'Total Estimado']],
            body: tableBody,
            startY: 30,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 113, 227] }
        });
        doc.save(`Requisicion_SDMO_${new Date().toLocaleDateString('en-CA')}.pdf`);
    };

    const handleExportExcel = () => {
        const wsDetalle = XLSX.utils.json_to_sheet(data.map(item => ({
            'Código': item.codigo_articulo,
            'Artículo': item.nombre_articulo,
            'Unidad': item.unidad,
            'Cod. Gasto': item.codigo_gasto,
            'Partida Budgetaria': item.nombre_partida,
            'Stock Actual': item.stock_actual,
            'Consumo Mensual': item.promedio_mensual,
            'Sugerencia': item.cantidad_sugerida,
            'Costo Total': item.costo_estimado
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle");
        XLSX.writeFile(wb, `Proyeccion_SDMO_${new Date().toLocaleDateString('en-CA')}.xlsx`);
    };

    const SortIcon = ({ column }: { column: keyof ProyeccionItem }) => {
        if (sortConfig?.key !== column) return <ArrowUpDown className="w-4 h-4 text-[#86868B] inline ml-1 opacity-50" />;
        return <ArrowUpDown className={cn("w-4 h-4 text-[#0071E3] inline ml-1 transition-transform", sortConfig.direction === 'asc' ? 'rotate-180' : '')} />;
    };

    return (
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans selection:bg-[#0071E3]/30">
            <div className="animate-fade-in-up">
                <PageHeader
                    title="Proyección de Compras Anual"
                    icon={Calculator}
                    themeColor="blue"
                />

                <div className="max-w-7xl mx-auto px-8 pt-8 space-y-10">
                    {/* Header Controls Row */}
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                        <div className="space-y-1">
                            <p className="text-[#86868B] text-xs font-bold uppercase tracking-widest pl-1 opacity-70">
                                Cálculo basado en histórico de consumo real considerando Lead Time.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleExportPDF} className="flex items-center gap-2 bg-[#1D1D1F] border border-[#333333] px-6 py-2.5 rounded-[8px] text-[#F5F5F7] hover:bg-[#333333] transition-all active:scale-95 text-[10px] font-bold uppercase tracking-widest">
                                <FileText className="w-4 h-4 text-[#8B5CF6]" />
                                PDF REQUISICIÓN
                            </button>
                            <button onClick={handleExportExcel} className="flex items-center gap-2 bg-[#1D1D1F] border border-[#333333] px-6 py-2.5 rounded-[8px] text-[#F5F5F7] hover:bg-[#333333] transition-all active:scale-95 text-[10px] font-bold uppercase tracking-widest">
                                <Download className="w-4 h-4 text-[#10B981]" />
                                EXCEL COMPLETO
                            </button>
                        </div>
                    </div>

                    {/* KPIs Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        <StatCard title="Presupuesto Estimado" value={`₡${stats.totalPresupuesto.toLocaleString()}`} icon={DollarSign} color="text-[#0071E3]" bg="bg-[#0071E3]/10" loading={loading} badge="COSTO" />
                        <StatCard title="Artículos a Comprar" value={stats.itemsAComprar} subtitle={`de ${stats.totalItems}`} icon={Package} color="text-[#10B981]" bg="bg-[#10B981]/10" loading={loading} badge="CANTIDAD" />
                        <StatCard title="Lead Time (Promedio)" value={`${mesesLeadTime} Meses`} icon={Calendar} color="text-[#8B5CF6]" bg="bg-[#8B5CF6]/10" badge="LOGÍSTICA" />
                        <StatCard title="Rubros Activos" value={stats.totalCategorias} icon={BarChartIcon} color="text-[#F59E0B]" bg="bg-[#F59E0B]/10" loading={loading} badge="PARTIDAS" />
                    </div>

                    {/* Configuration and Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Config Sidebar */}
                        <div className="lg:col-span-4 glass-card p-8 flex flex-col justify-between min-h-[500px]">
                            <div className="space-y-10">
                                <div className="flex items-center gap-4 border-b border-[#333333] pb-6">
                                    <div className="w-10 h-10 rounded-[8px] bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3] border border-[#0071E3]/20">
                                        <Settings2 className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-sm font-bold text-[#F5F5F7] uppercase tracking-widest">Configuración del Modelo</h3>
                                </div>

                                <div className="space-y-10">
                                    <HighContrastSlider label="Histórico (Meses)" min={1} max={60} value={mesesHistorico} onChange={setMesesHistorico} accent="#8B5CF6" />
                                    <HighContrastSlider label="Lead Time (Espera)" min={1} max={18} value={mesesLeadTime} onChange={setMesesLeadTime} accent="#0071E3" />
                                    <HighContrastSlider label="Cobertura (Ciclo)" min={1} max={24} value={mesesCiclo} onChange={setMesesCiclo} accent="#10B981" />
                                </div>
                            </div>

                            <div className="space-y-4 pt-10 border-t border-[#333333]">
                                <label className="block text-[10px] font-bold text-[#86868B] uppercase tracking-widest pl-1">Factor de Seguridad</label>
                                <div className="relative group">
                                    <select
                                        value={factorSeguridad}
                                        onChange={e => setFactorSeguridad(Number(e.target.value))}
                                        className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-5 py-4 text-[#F5F5F7] font-bold text-xs outline-none appearance-none hover:border-[#0071E3]/50 transition-all cursor-pointer"
                                    >
                                        <option value="1.0">0% (Justo a Tiempo)</option>
                                        <option value="1.1">10% (Recomendado)</option>
                                        <option value="1.2">20% (Conservador)</option>
                                    </select>
                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none group-hover:text-[#F5F5F7] transition-colors" />
                                </div>
                            </div>
                        </div>

                        {/* Chart Area */}
                        <div className="lg:col-span-8 glass-card p-8 flex flex-col min-h-[500px]">
                            <div className="flex items-center justify-between mb-10 border-b border-[#333333] pb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-[8px] bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] border border-[#8B5CF6]/20">
                                        <PieChart className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-sm font-bold text-[#F5F5F7] uppercase tracking-widest">Distribución Presupuestaria</h3>
                                </div>
                                <span className="bg-[#1D1D1F] text-[#86868B] text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded-[4px] border border-[#333333]">TOP 15 PARTIDAS</span>
                            </div>

                            <div className="flex-1 w-full relative">
                                {loading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-[#000000]/40 backdrop-blur-sm rounded-[8px] z-20">
                                        <Activity className="w-8 h-8 text-[#0071E3] animate-spin" />
                                    </div>
                                )}
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333333" vertical={false} />
                                        <XAxis dataKey="code" stroke="#333333" fontSize={10} tickLine={false} axisLine={false} angle={-45} textAnchor="end" interval={0} height={80} dy={10} tick={{ fill: '#86868B', fontWeight: 700 }} />
                                        <YAxis stroke="#333333" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₡${(val / 1000000).toFixed(1)}M`} tick={{ fill: '#86868B', fontWeight: 700 }} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                                            {chartData.map((_, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={index % 2 === 0 ? "#0071E3" : "#0071E3"}
                                                    fillOpacity={index % 2 === 0 ? 1 : 0.7}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Filter Area */}
                    <div className="glass-card p-6 flex flex-col md:flex-row gap-5 items-center justify-between">
                        <div className="flex items-center gap-5 w-full lg:w-3/4">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] group-focus-within:text-[#0071E3] transition-colors" />
                                <input
                                    placeholder="Buscar por artículo o código específico..."
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-14 pr-6 py-4 text-sm text-[#F5F5F7] focus:border-[#0071E3]/50 outline-none transition-all placeholder:text-[#86868B] font-medium"
                                />
                            </div>
                            <div className="relative w-full max-w-[340px]" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-6 py-4 text-[10px] font-bold text-[#F5F5F7] flex items-center justify-between hover:border-[#0071E3]/50 transition-all uppercase tracking-widest"
                                >
                                    <span className="truncate flex items-center gap-3">
                                        <Filter className="w-4 h-4 text-[#0071E3]" />
                                        {selectedGasto === 'TODOS' ? 'Rubro de Gasto' : selectedGasto}
                                    </span>
                                    <ChevronRight className={cn("w-4 h-4 text-[#86868B] transition-transform duration-300", isDropdownOpen ? 'rotate-[-90deg]' : 'rotate-90')} />
                                </button>
                                {isDropdownOpen && (
                                    <div className="absolute bottom-[calc(100%+8px)] left-0 w-full bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl z-[100] p-2 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="max-h-[300px] overflow-y-auto space-y-1 p-1">
                                            <button onClick={() => { setSelectedGasto('TODOS'); setIsDropdownOpen(false); }} className={cn("w-full text-left px-5 py-3 rounded-[6px] text-[9px] font-bold uppercase transition-all", selectedGasto === 'TODOS' ? 'bg-[#0071E3]/20 text-[#0071E3]' : 'text-[#86868B] hover:bg-[#1D1D1F] hover:text-[#F5F5F7]')}>TODAS LAS PARTIDAS</button>
                                            {uniqueGastos.map(g => (
                                                <button key={g} onClick={() => { setSelectedGasto(g); setIsDropdownOpen(false); }} className={cn("w-full text-left px-5 py-3 rounded-[6px] text-[9px] font-bold uppercase transition-all", selectedGasto === g ? 'bg-[#0071E3]/20 text-[#0071E3]' : 'text-[#86868B] hover:bg-[#1D1D1F] hover:text-[#F5F5F7]')}>{g}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-[#86868B] text-[10px] font-bold uppercase tracking-widest bg-[#1D1D1F] px-6 py-4 rounded-[8px] border border-[#333333]">
                            Filtros: <span className="text-[#0071E3] font-black italic">{processedData.length}</span> resultados
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="glass-card overflow-hidden flex flex-col min-h-[600px] mb-32">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#1D1D1F]/50 text-[#86868B] text-[10px] font-bold tracking-widest uppercase border-b border-[#333333]">
                                        <th className="p-6 cursor-pointer hover:bg-[#1D1D1F] transition-colors w-[45%]" onClick={() => handleSort('nombre_articulo')}>ARTÍCULO <SortIcon column="nombre_articulo" /></th>
                                        <th className="p-6 text-right cursor-pointer hover:bg-[#1D1D1F] transition-colors" onClick={() => handleSort('stock_actual')}>STOCK <SortIcon column="stock_actual" /></th>
                                        <th className="p-6 text-right cursor-pointer hover:bg-[#1D1D1F] transition-colors" onClick={() => handleSort('promedio_mensual')}>CONS/MES <SortIcon column="promedio_mensual" /></th>
                                        <th className="p-6 text-right cursor-pointer hover:bg-[#1D1D1F] transition-colors" onClick={() => handleSort('cantidad_sugerida')}>SUGERENCIA <SortIcon column="cantidad_sugerida" /></th>
                                        <th className="p-6 text-right cursor-pointer hover:bg-[#1D1D1F] transition-colors" onClick={() => handleSort('costo_estimado')}>COSTO EST. <SortIcon column="costo_estimado" /></th>
                                    </tr>
                                </thead>
                                <tbody className={cn("text-sm text-[#F5F5F7] divide-y divide-[#333333]/50 transition-opacity duration-500", loading ? 'opacity-30' : 'opacity-100')}>
                                    {paginatedData.map(item => (
                                        <tr key={item.codigo_articulo} className="hover:bg-[#1D1D1F]/30 transition-colors group">
                                            <td className="p-6">
                                                <div>
                                                    <p className="text-[14px] font-bold text-[#F5F5F7] uppercase tracking-tight group-hover:text-[#0071E3] transition-colors">{item.nombre_articulo}</p>
                                                    <div className="flex items-center gap-3 mt-2">
                                                        <span className="text-[10px] font-mono text-[#0071E3] bg-[#0071E3]/10 px-2 py-0.5 rounded-[4px] font-bold">#{item.codigo_articulo}</span>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#333333]" />
                                                        <span className="uppercase text-[9px] font-bold text-[#86868B]">{item.unidad}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6 text-right font-mono text-[11px] font-bold text-[#86868B]">{item.stock_actual}</td>
                                            <td className="p-6 text-right font-mono text-[11px] font-bold text-[#0071E3]">{item.promedio_mensual}</td>
                                            <td className="p-6 text-right">
                                                <span className={cn(
                                                    "px-4 py-1.5 rounded-[4px] text-[12px] font-black italic tracking-tight transition-all",
                                                    item.cantidad_sugerida > 0
                                                        ? 'bg-[#10B981] text-[#000000] shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                                        : 'text-[#86868B] bg-[#1D1D1F] border border-[#333333]'
                                                )}>
                                                    {Math.ceil(item.cantidad_sugerida)}
                                                </span>
                                            </td>
                                            <td className="p-6 text-right font-mono text-[11px] font-bold text-[#F5F5F7]">₡{item.costo_estimado.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {!loading && paginatedData.length === 0 && (
                                <div className="p-20 flex flex-col items-center justify-center gap-4 text-[#86868B]">
                                    <AlertOctagon className="w-10 h-10 text-[#333333]" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest">Sin registros encontrados</p>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="mt-auto p-8 border-t border-[#333333] bg-[#1D1D1F]/30 flex items-center justify-between">
                            <div className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest">
                                Página <span className="text-[#0071E3] mx-1">{currentPage}</span> de {totalPages || 1}
                            </div>
                            <div className="flex gap-3">
                                <button disabled={currentPage <= 1 || loading} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border border-[#333333] rounded-[8px] disabled:opacity-20 hover:border-[#0071E3] transition-all"><ChevronLeft className="w-5 h-5" /></button>
                                <button disabled={currentPage >= totalPages || loading} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border border-[#333333] rounded-[8px] disabled:opacity-20 hover:border-[#0071E3] transition-all"><ChevronRight className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Internal Components
function StatCard({ title, value, subtitle, icon: Icon, color, loading, bg, badge }: any) {
    return (
        <div className="glass-card p-6 flex flex-col group transition-all duration-300 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
                <div className={cn("w-12 h-12 rounded-[12px] flex items-center justify-center group-hover:scale-105 transition-transform", bg, color)}>
                    <Icon className="w-5 h-5" />
                </div>
                <span className="bg-[#1D1D1F] text-[#86868B] text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded-[4px] border border-[#333333]">{badge}</span>
            </div>
            <div className="relative z-10">
                <p className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest leading-none">{title}</p>
                {loading ? <div className="h-8 w-3/4 bg-[#1D1D1F] animate-pulse rounded-[4px] mt-4" /> : (
                    <div className="flex items-baseline gap-2 mt-4">
                        <p className="text-2xl font-bold text-[#F5F5F7] tracking-tighter">{value}</p>
                        {subtitle && <span className="text-[9px] font-bold text-[#86868B] mb-0.5">{subtitle}</span>}
                    </div>
                )}
            </div>
        </div>
    );
}

function HighContrastSlider({ label, value, min, max, onChange, accent }: any) {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest">{label}</label>
                <div className="bg-[#1D1D1F] border border-[#333333] px-3 py-1 rounded-[4px] flex items-center gap-2">
                    <span className="text-xs font-bold text-[#F5F5F7]" style={{ color: accent }}>{value}</span>
                    <span className="text-[9px] font-bold text-[#86868B] uppercase uppercase">Meses</span>
                </div>
            </div>
            <div className="relative h-6 flex items-center">
                <input
                    type="range" min={min} max={max} value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className="w-full h-1 bg-[#1D1D1F] rounded-full appearance-none cursor-pointer accent-[#0071E3] hover:accent-[#0071E3]/80 transition-all shadow-inner"
                />
            </div>
        </div>
    );
}

function ChartTooltip({ active, payload }: any) {
    if (active && payload?.[0]) {
        const d = payload[0].payload;
        return (
            <div className="bg-[#1D1D1F] border border-[#333333] px-5 py-4 rounded-[8px] shadow-2xl">
                <div className="flex items-center gap-3 mb-3 border-b border-[#333333] pb-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0071E3]" />
                    <p className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest">{d.name}</p>
                </div>
                <p className="text-[#F5F5F7] text-lg font-bold tracking-tighter">₡{d.value.toLocaleString()}</p>
                <p className="text-[9px] text-[#86868B] font-bold mt-2 uppercase tracking-widest">Partida: {d.code}</p>
            </div>
        );
    }
    return null;
}
