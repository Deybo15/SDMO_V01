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
    ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PageHeader } from '../components/ui/PageHeader';

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

    const COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444'];

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
            headStyles: { fillColor: [16, 185, 129] }
        });
        doc.save(`Requisicion_SDMO_${new Date().toISOString().split('T')[0]}.pdf`);
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
        XLSX.writeFile(wb, `Proyeccion_SDMO_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const SortIcon = ({ column }: { column: keyof ProyeccionItem }) => {
        if (sortConfig?.key !== column) return <ArrowUpDown className="w-4 h-4 text-slate-600 inline ml-1 opacity-50" />;
        return <ArrowUpDown className={`w-4 h-4 text-emerald-400 inline ml-1 ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />;
    };

    return (
        <div className="min-h-screen bg-[#0f111a] text-slate-100 p-4 md:p-8 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-white/5">
                    <div className="space-y-1">
                        <PageHeader title="Proyección de Compras Anual" icon={Calculator} themeColor="emerald" />
                        <p className="text-slate-500 text-sm font-medium tracking-wide">
                            Cálculo basado en histórico de consumo real considerando Lead Time.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleExportPDF} className="glass-button px-5 py-2.5 flex items-center gap-2 text-purple-400 hover:text-white rounded-xl">
                            <FileText className="w-4 h-4" />
                            <span className="font-bold text-xs">PDF REQUISICIÓN</span>
                        </button>
                        <button onClick={handleExportExcel} className="glass-button px-5 py-2.5 flex items-center gap-2 text-emerald-400 hover:text-white rounded-xl">
                            <Download className="w-4 h-4" />
                            <span className="font-bold text-xs">EXCEL COMPLETO</span>
                        </button>
                    </div>
                </div>

                {/* KPIs Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Presupuesto Estimado" value={`₡${stats.totalPresupuesto.toLocaleString()}`} icon={DollarSign} color="emerald" loading={loading} />
                    <StatCard title="Artículos a Comprar" value={stats.itemsAComprar} subtitle={`de ${stats.totalItems}`} icon={Package} color="blue" loading={loading} />
                    <StatCard title="Lead Time (Promedio)" value={`${mesesLeadTime} Meses`} icon={Calendar} color="purple" />
                    <StatCard title="Rubros Activos" value={stats.totalCategorias} icon={BarChartIcon} color="orange" loading={loading} />
                </div>

                {/* Model and Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Controls Sidebar */}
                    <div className="lg:col-span-4 glass-card p-6 space-y-8 flex flex-col justify-between">
                        <div className="space-y-8">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                <div className="p-2 bg-emerald-500/10 rounded-lg">
                                    <Settings2 className="w-5 h-5 text-emerald-400" />
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest italic">Configuración del Modelo</h3>
                            </div>

                            <HighContrastSlider label="Histórico (Meses)" min={1} max={60} value={mesesHistorico} onChange={setMesesHistorico} color="purple" />
                            <HighContrastSlider label="Lead Time (Espera)" min={1} max={18} value={mesesLeadTime} onChange={setMesesLeadTime} color="blue" />
                            <HighContrastSlider label="Cobertura (Ciclo)" min={1} max={24} value={mesesCiclo} onChange={setMesesCiclo} color="emerald" />
                        </div>

                        <div className="space-y-3 pt-6 border-t border-white/5">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest italic px-1">Factor de Seguridad</label>
                            <div className="relative group">
                                <select
                                    value={factorSeguridad}
                                    onChange={e => setFactorSeguridad(Number(e.target.value))}
                                    className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white font-black text-sm outline-none appearance-none hover:border-white/20 transition-all cursor-pointer shadow-inner"
                                >
                                    <option value="1.0">0% (Justo a Tiempo)</option>
                                    <option value="1.1">10% (Recomendado)</option>
                                    <option value="1.2">20% (Conservador)</option>
                                </select>
                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none transition-transform group-hover:text-slate-300" />
                            </div>
                        </div>
                    </div>

                    {/* Bar Chart Section */}
                    <div className="lg:col-span-8 glass-card p-6 flex flex-col h-full min-h-[500px]">
                        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                    <PieChart className="w-5 h-5 text-purple-400" />
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest italic">Distribución Presupuestaria</h3>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Top 15 Partidas por Costo</span>
                        </div>

                        <div className="flex-1 w-full relative">
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm rounded-2xl z-20">
                                    <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                                </div>
                            )}
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis dataKey="code" stroke="#94a3b830" fontSize={10} tickLine={false} axisLine={false} angle={-45} textAnchor="end" interval={0} height={80} dy={10} tick={{ fill: '#64748b', fontWeight: 900 }} />
                                    <YAxis stroke="#94a3b830" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₡${(val / 1000000).toFixed(1)}M`} tick={{ fill: '#64748b', fontWeight: 900 }} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff05' }} />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                                        {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.9} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="glass-card p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-4 w-full md:w-[70%] lg:w-[75%]">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-emerald-400 transition-colors" />
                            <input
                                placeholder="Buscar por artículo o código específico..."
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-200 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-slate-700 font-medium"
                            />
                        </div>
                        <div className="relative w-full max-w-[340px]" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="w-full bg-slate-950/50 border border-emerald-500/20 rounded-2xl px-6 py-3.5 text-xs font-black text-slate-300 flex items-center justify-between hover:bg-slate-900 transition-all uppercase tracking-widest italic"
                            >
                                <span className="truncate flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-emerald-400" />
                                    {selectedGasto === 'TODOS' ? 'Filtrar por Rubro de Gasto' : selectedGasto}
                                </span>
                                <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isDropdownOpen ? 'rotate-[-90deg]' : 'rotate-90'}`} />
                            </button>
                            {isDropdownOpen && (
                                <div className="absolute bottom-[calc(100%+8px)] left-0 w-full bg-[#020617] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[100] animate-in fade-in slide-in-from-bottom-2">
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                                        <button onClick={() => { setSelectedGasto('TODOS'); setIsDropdownOpen(false); }} className={`w-full text-left px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedGasto === 'TODOS' ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}>TODAS LAS PARTIDAS</button>
                                        {uniqueGastos.map(g => (
                                            <button key={g} onClick={() => { setSelectedGasto(g); setIsDropdownOpen(false); }} className={`w-full text-left px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedGasto === g ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}>{g}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest whitespace-nowrap bg-white/5 px-4 py-3.5 rounded-2xl border border-white/5">
                        Mostrando <span className="text-emerald-400 italic text-sm font-black mx-1">{processedData.length}</span> resultados filtrados
                    </div>
                </div>

                {/* Table Section */}
                <div className="glass-card overflow-hidden flex flex-col min-h-[600px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 text-slate-500 text-[10px] font-black tracking-widest uppercase italic border-b border-white/5">
                                    <th className="p-6 cursor-pointer hover:bg-white/10 transition-colors w-[45%]" onClick={() => handleSort('nombre_articulo')}>ARTÍCULO <SortIcon column="nombre_articulo" /></th>
                                    <th className="p-6 text-right cursor-pointer hover:bg-white/10 transition-colors" onClick={() => handleSort('stock_actual')}>STOCK <SortIcon column="stock_actual" /></th>
                                    <th className="p-6 text-right cursor-pointer hover:bg-white/10 transition-colors" onClick={() => handleSort('promedio_mensual')}>CONS/MES <SortIcon column="promedio_mensual" /></th>
                                    <th className="p-6 text-right text-emerald-400 cursor-pointer hover:bg-emerald-500/10 transition-colors" onClick={() => handleSort('cantidad_sugerida')}>SUGERENCIA <SortIcon column="cantidad_sugerida" /></th>
                                    <th className="p-6 text-right cursor-pointer hover:bg-white/10 transition-colors" onClick={() => handleSort('costo_estimado')}>COSTO EST. <SortIcon column="costo_estimado" /></th>
                                </tr>
                            </thead>
                            <tbody className={`text-sm text-slate-300 divide-y divide-white/[0.03] transition-opacity duration-500 ${loading ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                {paginatedData.map(item => (
                                    <tr key={item.codigo_articulo} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-6">
                                            <div>
                                                <p className="text-[13px] font-black text-white uppercase italic tracking-tight leading-tight group-hover:text-emerald-400 transition-colors">{item.nombre_articulo}</p>
                                                <div className="flex items-center gap-2 mt-2 text-slate-400 text-[11px] font-bold">
                                                    <span className="font-mono bg-white/5 px-2 py-0.5 rounded-md">#{item.codigo_articulo}</span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                                                    <span className="uppercase tracking-widest text-[10px]">{item.unidad}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 text-right font-mono text-[11px] font-black text-slate-500">{item.stock_actual}</td>
                                        <td className="p-6 text-right font-mono text-[11px] font-black text-blue-400">{item.promedio_mensual}</td>
                                        <td className="p-6 text-right">
                                            <span className={`px-4 py-2 rounded-xl text-[12px] font-black italic shadow-2xl transition-all ${item.cantidad_sugerida > 0 ? 'bg-emerald-500 text-[#020617] ring-2 ring-emerald-500/50 shadow-emerald-500/20' : 'bg-white/5 text-slate-500 border border-white/5 opacity-40'}`}>
                                                {Math.ceil(item.cantidad_sugerida)}
                                            </span>
                                        </td>
                                        <td className="p-6 text-right font-mono text-[11px] font-black text-slate-400 italic">₡{item.costo_estimado.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!loading && paginatedData.length === 0 && (
                            <div className="p-32 flex flex-col items-center justify-center gap-4">
                                <AlertOctagon className="w-12 h-12 text-slate-800" />
                                <p className="text-xs font-black uppercase text-slate-700 tracking-widest">Sin datos encontrados</p>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="mt-auto p-6 border-t border-white/5 bg-black/20 flex items-center justify-between">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
                            Página <span className="text-blue-400 mx-1">{currentPage}</span> de {totalPages || 1}
                        </div>
                        <div className="flex gap-2">
                            <button disabled={currentPage <= 1 || loading} onClick={() => setCurrentPage(p => p - 1)} className="glass-button p-2.5 rounded-xl"><ChevronLeft className="w-5 h-5 text-slate-400" /></button>
                            <button disabled={currentPage >= totalPages || loading} onClick={() => setCurrentPage(p => p + 1)} className="glass-button p-2.5 rounded-xl"><ChevronRight className="w-5 h-5 text-slate-400" /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Components
function StatCard({ title, value, subtitle, icon: Icon, color, loading }: any) {
    const colorMap: any = {
        emerald: 'text-emerald-500 bg-emerald-500/10 ring-emerald-500/20',
        blue: 'text-blue-500 bg-blue-500/10 ring-blue-500/20',
        purple: 'text-purple-500 bg-purple-500/10 ring-purple-500/20',
        orange: 'text-orange-500 bg-orange-500/10 ring-orange-500/20'
    };
    return (
        <div className="glass-card p-6 flex flex-col justify-between h-28 hover:translate-y-[-2px]">
            <div className="flex items-center justify-between">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{title}</p>
                <div className={`p-2 rounded-lg ring-1 ${colorMap[color]}`}><Icon className="w-4 h-4" /></div>
            </div>
            {loading ? <div className="h-6 w-3/4 bg-white/5 animate-pulse rounded mt-2" /> : (
                <div className="flex items-baseline gap-2">
                    <p className="text-xl font-black text-white italic tracking-tight">{value}</p>
                    {subtitle && <span className="text-[10px] font-bold text-slate-600 mb-0.5">{subtitle}</span>}
                </div>
            )}
        </div>
    );
}

function HighContrastSlider({ label, value, min, max, onChange, color }: any) {
    const accentMap: any = {
        emerald: 'accent-emerald-500 text-emerald-400 bg-emerald-500/10',
        blue: 'accent-blue-500 text-blue-400 bg-blue-500/10',
        purple: 'accent-purple-500 text-purple-400 bg-purple-500/10'
    };
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">{label}</label>
                <span className={`px-4 py-1.5 rounded-full text-[13px] font-black italic shadow-lg ring-1 ring-white/10 ${accentMap[color]}`}>{value} meses</span>
            </div>
            <input
                type="range" min={min} max={max} value={value}
                onChange={e => onChange(Number(e.target.value))}
                className={`w-full h-1.5 bg-black rounded-full appearance-none cursor-pointer ${accentMap[color].split(' ')[0]}`}
            />
        </div>
    );
}

function ChartTooltip({ active, payload }: any) {
    if (active && payload?.[0]) {
        const d = payload[0].payload;
        return (
            <div className="bg-[#020617] border border-white/20 p-5 rounded-2xl shadow-2xl backdrop-blur-xl">
                <p className="text-[10px] font-black text-blue-400 uppercase italic mb-2">{d.name}</p>
                <p className="text-white text-lg font-black italic leading-none">₡{d.value.toLocaleString()}</p>
                <p className="text-[9px] text-slate-600 font-bold mt-2 uppercase tracking-tighter">Código Partida: {d.code}</p>
            </div>
        );
    }
    return null;
}
