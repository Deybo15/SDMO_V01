import { useState, useEffect } from 'react';
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
    AlertOctagon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

    // Advanced UI State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGasto, setSelectedGasto] = useState<string>('TODOS');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ProyeccionItem; direction: 'asc' | 'desc' } | null>(null);

    // Derived Data Logic
    const uniqueGastos = Array.from(new Set(data.map(i => i.nombre_partida || 'SIN ASIGNAR'))).sort();

    const processedData = data.filter(item => {
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

    // Pagination based on PROCESSED data
    const totalPages = Math.ceil(processedData.length / itemsPerPage);
    const paginatedData = processedData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSort = (key: keyof ProyeccionItem) => {
        let direction: 'asc' | 'desc' = 'desc'; // Default to desc for relevance
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        const itemsToBuy = processedData.filter(i => i.cantidad_sugerida > 0);

        if (itemsToBuy.length === 0) {
            alert('No hay artículos sugeridos para compra en la selección actual.');
            return;
        }

        // Sort by Gasto then Article
        itemsToBuy.sort((a, b) => {
            const gastoA = a.codigo_gasto || 'ZZZ';
            const gastoB = b.codigo_gasto || 'ZZZ';
            if (gastoA !== gastoB) return gastoA.localeCompare(gastoB);
            return a.nombre_articulo.localeCompare(b.nombre_articulo);
        });

        doc.setFontSize(20);
        doc.text('Requisición de Compra Sugerida (SDMO)', 14, 22);

        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-CR')}`, 14, 30);
        doc.text(`Criterios: Histórico ${mesesHistorico}m | Lead ${mesesLeadTime}m | Cobertura ${mesesCiclo}m`, 14, 36);
        doc.text(`Total Ítems: ${itemsToBuy.length} | Costo Est. Total: CRC ${itemsToBuy.reduce((a, b) => a + b.costo_estimado, 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 42);

        const tableBody: any[] = [];
        let currentGasto = '';

        itemsToBuy.forEach(item => {
            const gastoCode = item.codigo_gasto || 'SIN ASIGNAR';
            const gastoName = item.nombre_partida || '';

            // Group Header
            if (gastoCode !== currentGasto) {
                tableBody.push([{
                    content: `${gastoCode} - ${gastoName}`,
                    colSpan: 6,
                    styles: {
                        fillColor: [241, 245, 249],
                        textColor: [71, 85, 105],
                        fontStyle: 'bold',
                        halign: 'left'
                    }
                }]);
                currentGasto = gastoCode;
            }

            // Item Row
            tableBody.push([
                item.codigo_articulo,
                item.nombre_articulo.substring(0, 60),
                item.unidad,
                Math.ceil(item.cantidad_sugerida),
                `CRC ${item.ultimo_precio.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                `CRC ${item.costo_estimado.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ]);
        });

        autoTable(doc, {
            head: [['Código', 'Artículo', 'Unidad', 'Cant.', 'Precio Unit.', 'Total Estimado']],
            body: tableBody,
            startY: 50,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [16, 185, 129] },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 15 },
                3: { cellWidth: 15, halign: 'center' },
                4: { cellWidth: 30, halign: 'right' },
                5: { cellWidth: 35, halign: 'right' }
            }
        });

        doc.save(`Requisicion_SDMO_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // Stats
    const totalEstimado = data.reduce((acc, item) => acc + (item.costo_estimado || 0), 0);
    const articulosAComprar = data.filter(i => i.cantidad_sugerida > 0).length;

    // Grouping for Chart
    const gastosData = data.reduce((acc, item) => {
        const codigo = item.codigo_gasto || 'SIN ASIGNAR';
        const nombre = item.nombre_partida || 'Desconocido';

        if (!acc[codigo]) {
            acc[codigo] = { code: codigo, name: nombre, value: 0 };
        }
        acc[codigo].value += item.costo_estimado;
        return acc;
    }, {} as Record<string, { code: string, name: string, value: number }>);

    const chartData = Object.values(gastosData).sort((a, b) => b.value - a.value);

    // Color palette for chart
    const COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444'];

    useEffect(() => {
        fetchProyeccion();
    }, [mesesLeadTime, mesesCiclo, factorSeguridad, mesesHistorico]);

    const fetchProyeccion = async () => {
        setLoading(true);
        setCurrentPage(1); // Reset page on new fetch
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
                })
                    .range(from, from + batchSize - 1);

                if (error) throw error;

                if (batch && batch.length > 0) {
                    allData = [...allData, ...batch];

                    if (batch.length < batchSize) {
                        fetching = false;
                    } else {
                        from += batchSize;
                    }
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

    const handleExportExcel = () => {
        // Sheet 1: Detalle Artículos
        const wsDetalle = XLSX.utils.json_to_sheet(data.map(item => ({
            'Código': item.codigo_articulo,
            'Artículo': item.nombre_articulo,
            'Unidad': item.unidad,
            'Cod. Gasto': item.codigo_gasto,
            'Partida Presupuestaria': item.nombre_partida,
            'Stock Actual': item.stock_actual,
            'Consumo Mensual': item.promedio_mensual,
            'Consumo Espera': item.consumo_espera,
            'Stock Residual': item.stock_residual,
            'Demanda Futura': item.demanda_futura,
            'SUGERENCIA': item.cantidad_sugerida,
            'Precio Est.': item.ultimo_precio,
            'Costo Total': item.costo_estimado
        })));

        // Sheet 2: Resumen por Código de Gasto
        const resumenGasto = Object.values(gastosData).map(g => ({
            'Código Gasto': g.code,
            'Descripción Partida': g.name,
            'Presupuesto Requerido': g.value
        }));
        const wsResumen = XLSX.utils.json_to_sheet(resumenGasto);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle Artículos");
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Presupuestario");

        XLSX.writeFile(wb, `Proyeccion_Compras_Anual_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Helper for table sort icon
    const SortIcon = ({ column }: { column: keyof ProyeccionItem }) => {
        if (sortConfig?.key !== column) return <ArrowUpDown className="w-4 h-4 text-slate-600 inline ml-1 opacity-50" />;
        return <ArrowUpDown className={`w-4 h-4 text-emerald-400 inline ml-1 ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />;
    };

    return (
        <div className="min-h-screen bg-[#0F172A] text-slate-100 p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3 text-white">
                        <Calculator className="w-8 h-8 text-emerald-500" />
                        Proyección de Compras Anual
                    </h1>
                    <p className="text-slate-400 mt-2 max-w-2xl">
                        Cálculo automático basado en histórico de consumo considerando Lead Time (Tiempos de Entrega).
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportPDF}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 rounded-xl flex items-center gap-2 font-medium transition-all shadow-lg hover:shadow-purple-500/20"
                    >
                        <FileText className="w-5 h-5" />
                        PDF Requisición
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl flex items-center gap-2 font-medium transition-all shadow-lg hover:shadow-emerald-500/20"
                    >
                        <Download className="w-5 h-5" />
                        Excel Completo
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl">
                        <DollarSign className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-sm">Presupuesto Estimado</p>
                        <p className="text-2xl font-bold text-white">
                            ₡{totalEstimado.toLocaleString('es-CR', { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl">
                        <Package className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-sm">Artículos a Comprar</p>
                        <p className="text-2xl font-bold text-white">
                            {articulosAComprar} <span className="text-sm font-normal text-slate-500">de {data.length}</span>
                        </p>
                    </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-xl">
                        <Calendar className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-sm">Lead Time</p>
                        <p className="text-2xl font-bold text-white">
                            {mesesLeadTime} <span className="text-sm font-normal text-slate-500">Meses</span>
                        </p>
                    </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-orange-500/10 rounded-xl">
                        <BarChartIcon className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-sm">Rubros de Gasto</p>
                        <p className="text-2xl font-bold text-white">
                            {chartData.length} <span className="text-sm font-normal text-slate-500">Categorías</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Analysis Section: Chart & Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Controls */}
                <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-6 lg:col-span-1">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-blue-400" />
                        Configuración del Modelo
                    </h3>
                    <div className="space-y-8">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Histórico a Considerar (Meses)
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="60"
                                value={mesesHistorico}
                                onChange={e => setMesesHistorico(Number(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                            <div className="flex justify-between text-xs text-slate-500 mt-2">
                                <span>1 mes</span>
                                <span className="text-purple-400 font-bold bg-purple-500/10 px-2 py-1 rounded">{mesesHistorico} meses</span>
                                <span>60 meses</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Tiempo de Espera (Lead Time)
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="18"
                                value={mesesLeadTime}
                                onChange={e => setMesesLeadTime(Number(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <div className="flex justify-between text-xs text-slate-500 mt-2">
                                <span>1 mes</span>
                                <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-1 rounded">{mesesLeadTime} meses</span>
                                <span>18 meses</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Ciclo Operativo (Cobertura)
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="24"
                                value={mesesCiclo}
                                onChange={e => setMesesCiclo(Number(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <div className="flex justify-between text-xs text-slate-500 mt-2">
                                <span>1 mes</span>
                                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded">{mesesCiclo} meses</span>
                                <span>24 meses</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Factor de Seguridad
                            </label>
                            <select
                                value={factorSeguridad}
                                onChange={e => setFactorSeguridad(Number(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none"
                            >
                                <option value="1.0">0% (Justo a tiempo)</option>
                                <option value="1.1">10% (Recomendado)</option>
                                <option value="1.2">20% (Conservador)</option>
                                <option value="1.3">30% (Muy Conservador)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-6 lg:col-span-2 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-400" />
                        Distribución Presupuestaria por Código de Gasto
                    </h3>
                    <div className="flex-1 min-h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                    dataKey="code"
                                    stroke="#F8FAFC"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    angle={-90}
                                    textAnchor="end"
                                    interval={0}
                                    height={60}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#F8FAFC"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `₡${(value / 1000000).toFixed(1)}M`}
                                />
                                <Tooltip
                                    cursor={{ fill: '#374151', opacity: 0.4 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-[#1E293B] border border-[#475569] p-3 rounded shadow-lg">
                                                    <p className="font-bold text-[#FACC15] mb-1">{data.name}</p>
                                                    <p className="text-white text-sm">
                                                        Monto Proyectado <span className="text-[#FACC15] font-bold">({data.code})</span>:
                                                        <span className="font-bold ml-1">₡{data.value.toLocaleString()}</span>
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {chartData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                <div className="flex items-center gap-4 w-full md:w-auto flex-1">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por código o nombre..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        />
                    </div>

                    <div className="relative w-full max-w-sm">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <select
                            value={selectedGasto}
                            onChange={(e) => { setSelectedGasto(e.target.value); setCurrentPage(1); }}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-8 py-2.5 text-white focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer truncate"
                        >
                            <option value="TODOS">Todos los Rubros de Gasto</option>
                            {uniqueGastos.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="text-sm text-slate-400 px-4">
                    Mostrando <span className="text-white font-bold">{processedData.length}</span> resultados filtrados
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden shadow-xl flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="p-4 border-b border-slate-700 font-medium cursor-pointer hover:bg-slate-800/50 transition-colors"
                                    onClick={() => handleSort('nombre_articulo')}>
                                    Artículo <SortIcon column="nombre_articulo" />
                                </th>
                                <th className="p-4 border-b border-slate-700 font-medium text-right cursor-pointer hover:bg-slate-800/50"
                                    onClick={() => handleSort('stock_actual')}>
                                    Stock Hoy <SortIcon column="stock_actual" />
                                </th>
                                <th className="p-4 border-b border-slate-700 font-medium text-right bg-blue-900/10 cursor-pointer hover:bg-slate-800/50"
                                    onClick={() => handleSort('promedio_mensual')}>
                                    Consumo/Mes <SortIcon column="promedio_mensual" />
                                </th>
                                <th className="p-4 border-b border-slate-700 font-medium text-right bg-blue-900/10 cursor-pointer hover:bg-slate-800/50"
                                    onClick={() => handleSort('consumo_espera')}>
                                    <span className="flex items-center justify-end gap-1">
                                        Consumo Espera <ArrowRight className="w-3 h-3" />
                                    </span>
                                </th>
                                <th className="p-4 border-b border-slate-700 font-medium text-right cursor-pointer hover:bg-slate-800/50"
                                    onClick={() => handleSort('stock_residual')}>
                                    Residual Est. <SortIcon column="stock_residual" />
                                </th>
                                <th className="p-4 border-b border-slate-700 font-medium text-right bg-emerald-900/20 text-emerald-400 cursor-pointer hover:bg-slate-800/50"
                                    onClick={() => handleSort('cantidad_sugerida')}>
                                    Sugerencia Compra <SortIcon column="cantidad_sugerida" />
                                </th>
                                <th className="p-4 border-b border-slate-700 font-medium text-right cursor-pointer hover:bg-slate-800/50"
                                    onClick={() => handleSort('costo_estimado')}>
                                    Costo Est. <SortIcon column="costo_estimado" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        <div className="flex justify-center mb-2">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                                        </div>
                                        Calculando proyecciones (Descargando datos completos)...
                                    </td>
                                </tr>
                            ) : paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        No hay datos de consumo histórico para proyectar.
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((item) => {
                                    // Alert Logic: Stockout before lead time?
                                    // If stock < consumption_during_wait, it is critical.
                                    const isCritical = item.stock_actual < item.consumo_espera;

                                    return (
                                        <tr key={item.codigo_articulo} className={`hover:bg-slate-800/50 transition-colors ${isCritical ? 'bg-red-900/10' : ''}`}>
                                            <td className="p-4">
                                                <div className="flex items-start gap-3">
                                                    {isCritical && (
                                                        <div className="mt-1" title="ALERTA: Stock insuficiente para cubrir el tiempo de espera">
                                                            <AlertOctagon className="w-5 h-5 text-red-500 animate-pulse" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className={`font-medium ${isCritical ? 'text-red-200' : 'text-white'}`}>
                                                            {item.nombre_articulo}
                                                        </div>
                                                        <div className="text-xs text-slate-500">#{item.codigo_articulo} • {item.unidad}</div>
                                                        {item.nombre_partida && (
                                                            <div className="text-[10px] text-slate-600 mt-1 uppercase tracking-wider">{item.nombre_partida.substring(0, 40)}...</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-mono text-slate-300">
                                                {item.stock_actual}
                                            </td>
                                            <td className="p-4 text-right font-mono text-blue-300 bg-blue-500/5">
                                                {item.promedio_mensual}
                                            </td>
                                            <td className="p-4 text-right font-mono text-blue-300 bg-blue-500/5">
                                                {item.consumo_espera}
                                            </td>
                                            <td className={`p-4 text-right font-mono font-bold ${item.stock_residual < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                                {item.stock_residual}
                                                {/* Removed generic icon, using context icon in first column */}
                                            </td>
                                            <td className="p-4 text-right bg-emerald-500/5">
                                                <span className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${item.cantidad_sugerida > 0
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'text-slate-600'
                                                    }`}>
                                                    {Math.ceil(item.cantidad_sugerida)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-mono text-slate-300">
                                                ₡{item.costo_estimado.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {!loading && processedData.length > 0 && (
                    <div className="p-4 border-t border-slate-700 flex items-center justify-between bg-slate-900/50">
                        <div className="text-sm text-slate-400">
                            Mostrando <span className="font-bold text-white">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-white">{Math.min(currentPage * itemsPerPage, processedData.length)}</span> de <span className="font-bold text-white">{processedData.length}</span> resultados
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-sm font-medium text-slate-300 px-2 min-w-[3rem] text-center">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
