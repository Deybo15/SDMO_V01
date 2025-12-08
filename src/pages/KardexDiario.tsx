import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    LineChart,
    Search,
    Eraser,
    Loader2,
    ChevronLeft,
    AlertTriangle,
    Info,
    CheckCircle2,
    X,
    Package,
    FileSpreadsheet,
    FileText,
    ChevronDown,
    ChevronUp,
    TrendingUp,
    AlertCircle
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type to include autoTable
interface jsPDFWithAutoTable extends jsPDF {
    autoTable: (options: any) => void;
}

interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
    unidad: string;
    imagen_url: string | null;
}

interface KardexDetail {
    id: string;
    tipo: 'ENTRADA' | 'SALIDA';
    cantidad: number;
    documento_id: number;
    fecha_hora?: string;
}

interface KardexRow {
    fecha: string;
    entradas: number;
    salidas: number;
    saldoDia: number;
    saldoAcumulado: number;
    detalles: KardexDetail[];
    isLowStock: boolean;
    isHighMovement: boolean;
}

export default function KardexDiario() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');

    // Data
    const [suggestions, setSuggestions] = useState<Articulo[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<Articulo | null>(null);
    const [kardexData, setKardexData] = useState<KardexRow[]>([]);
    const [saldoApertura, setSaldoApertura] = useState(0);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // UI State
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null);

    // Initialize dates (last 30 days)
    useEffect(() => {
        const hoy = new Date();
        const hasta = hoy.toISOString().split('T')[0];
        const desdeDate = new Date();
        desdeDate.setDate(hoy.getDate() - 30);
        const desde = desdeDate.toISOString().split('T')[0];

        setFechaDesde(desde);
        setFechaHasta(hasta);
    }, []);

    // Clear status message after 5 seconds
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => setStatusMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    // Autocomplete Search
    useEffect(() => {
        const searchArticulos = async () => {
            if (!searchTerm.trim() || selectedArticle) {
                setSuggestions([]);
                return;
            }

            setSearching(true);
            try {
                const { data, error } = await supabase
                    .from('articulo_01')
                    .select('codigo_articulo, nombre_articulo, unidad, imagen_url')
                    .or(`codigo_articulo.ilike.%${searchTerm}%,nombre_articulo.ilike.%${searchTerm}%`)
                    .limit(10);

                if (error) throw error;
                setSuggestions(data || []);
                setShowSuggestions(true);
            } catch (error) {
                console.error('Error searching articles:', error);
            } finally {
                setSearching(false);
            }
        };

        const debounce = setTimeout(searchArticulos, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm, selectedArticle]);

    const handleSelectArticle = (articulo: Articulo) => {
        setSelectedArticle(articulo);
        setSearchTerm(`${articulo.codigo_articulo} - ${articulo.nombre_articulo}`);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    const clearSearch = () => {
        setSearchTerm('');
        setSelectedArticle(null);
        setKardexData([]);
        setSaldoApertura(0);
        setStatusMessage(null);
        setExpandedRows(new Set());
    };

    const toggleRow = (fecha: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(fecha)) {
            newExpanded.delete(fecha);
        } else {
            newExpanded.add(fecha);
        }
        setExpandedRows(newExpanded);
    };

    const executeKardexQuery = async () => {
        if (!selectedArticle) {
            setStatusMessage({ type: 'warning', message: 'Por favor seleccione un artículo primero.' });
            return;
        }
        if (!fechaDesde || !fechaHasta) {
            setStatusMessage({ type: 'warning', message: 'Por favor seleccione el rango de fechas.' });
            return;
        }

        setLoading(true);
        setStatusMessage(null);
        setKardexData([]);
        setExpandedRows(new Set());

        try {
            // 1. Get Opening Balance (Saldo Apertura)
            const { data: entPrev, error: errEntPrev } = await supabase
                .from('dato_entrada_12')
                .select('cantidad, entrada:entrada_articulo_07!inner(fecha_entrada)')
                .eq('articulo', selectedArticle.codigo_articulo)
                .lt('entrada.fecha_entrada', fechaDesde);

            if (errEntPrev) throw errEntPrev;

            const { data: salPrev, error: errSalPrev } = await supabase
                .from('dato_salida_13')
                .select('cantidad, salida:salida_articulo_08!inner(fecha_salida)')
                .eq('articulo', selectedArticle.codigo_articulo)
                .lt('salida.fecha_salida', fechaDesde);

            if (errSalPrev) throw errSalPrev;

            const sumEntPrev = (entPrev || []).reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);
            const sumSalPrev = (salPrev || []).reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);
            const apertura = sumEntPrev - sumSalPrev;
            setSaldoApertura(apertura);

            // 2. Get Movements in Range
            const hastaDate = new Date(fechaHasta);
            hastaDate.setDate(hastaDate.getDate() + 1);
            const hastaNextDay = hastaDate.toISOString().split('T')[0];

            // Fetch Entries with ID
            const { data: entRange, error: errEntRange } = await supabase
                .from('dato_entrada_12')
                .select('cantidad, id_entrada, entrada:entrada_articulo_07!inner(fecha_entrada)')
                .eq('articulo', selectedArticle.codigo_articulo)
                .gte('entrada.fecha_entrada', fechaDesde)
                .lt('entrada.fecha_entrada', hastaNextDay);

            if (errEntRange) throw errEntRange;

            // Fetch Exits with ID
            const { data: salRange, error: errSalRange } = await supabase
                .from('dato_salida_13')
                .select('cantidad, id_salida, salida:salida_articulo_08!inner(fecha_salida)')
                .eq('articulo', selectedArticle.codigo_articulo)
                .gte('salida.fecha_salida', fechaDesde)
                .lte('salida.fecha_salida', fechaHasta);

            if (errSalRange) throw errSalRange;

            // 3. Process Daily Data
            const movementsByDay = new Map<string, { ent: number, sal: number, detalles: KardexDetail[] }>();
            const getDateStr = (dateVal: string) => dateVal.split('T')[0];

            // Initialize days
            let curr = new Date(fechaDesde);
            const end = new Date(fechaHasta);
            while (curr <= end) {
                movementsByDay.set(curr.toISOString().split('T')[0], { ent: 0, sal: 0, detalles: [] });
                curr.setDate(curr.getDate() + 1);
            }

            // Fill entries
            (entRange || []).forEach(r => {
                // @ts-ignore
                const d = getDateStr(r.entrada?.fecha_entrada);
                if (movementsByDay.has(d)) {
                    const curr = movementsByDay.get(d)!;
                    const qty = Number(r.cantidad) || 0;
                    curr.ent += qty;
                    curr.detalles.push({
                        id: `ENT-${r.id_entrada}-${Math.random()}`,
                        tipo: 'ENTRADA',
                        cantidad: qty,
                        documento_id: r.id_entrada,
                        // @ts-ignore
                        fecha_hora: r.entrada?.fecha_entrada
                    });
                }
            });

            // Fill exits
            (salRange || []).forEach(r => {
                // @ts-ignore
                const d = getDateStr(r.salida?.fecha_salida);
                if (movementsByDay.has(d)) {
                    const curr = movementsByDay.get(d)!;
                    const qty = Number(r.cantidad) || 0;
                    curr.sal += qty;
                    curr.detalles.push({
                        id: `SAL-${r.id_salida}-${Math.random()}`,
                        tipo: 'SALIDA',
                        cantidad: qty,
                        documento_id: r.id_salida,
                        // @ts-ignore
                        fecha_hora: r.salida?.fecha_salida
                    });
                }
            });

            // Calculate running balance and flags
            let runningBalance = apertura;
            const rows: KardexRow[] = [];
            const sortedDates = Array.from(movementsByDay.keys()).sort();

            // Calculate average movement for "High Movement" flag
            const allMovements = Array.from(movementsByDay.values()).map(m => m.ent + m.sal);
            const avgMovement = allMovements.reduce((a, b) => a + b, 0) / (allMovements.length || 1);
            const highMovementThreshold = avgMovement * 2; // e.g., double the average

            sortedDates.forEach(date => {
                const m = movementsByDay.get(date)!;
                const neto = m.ent - m.sal;
                runningBalance += neto;

                rows.push({
                    fecha: date,
                    entradas: m.ent,
                    salidas: m.sal,
                    saldoDia: neto,
                    saldoAcumulado: runningBalance,
                    detalles: m.detalles,
                    isLowStock: runningBalance < 10, // Example threshold
                    isHighMovement: (m.ent + m.sal) > highMovementThreshold && (m.ent + m.sal) > 0
                });
            });

            setKardexData(rows);
            setStatusMessage({ type: 'success', message: 'Consulta completada exitosamente.' });

        } catch (error: any) {
            console.error('Error fetching kardex:', error);
            setStatusMessage({ type: 'error', message: 'Error al consultar datos: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    const totals = useMemo(() => {
        return kardexData.reduce((acc, curr) => ({
            ent: acc.ent + curr.entradas,
            sal: acc.sal + curr.salidas,
            neto: acc.neto + curr.saldoDia
        }), { ent: 0, sal: 0, neto: 0 });
    }, [kardexData]);

    // --- EXPORT FUNCTIONS ---
    const exportToExcel = () => {
        if (kardexData.length === 0) return;

        const wb = XLSX.utils.book_new();
        const dataForSheet = kardexData.map(row => ({
            Fecha: row.fecha,
            Entradas: row.entradas,
            Salidas: row.salidas,
            'Saldo Día': row.saldoDia,
            'Saldo Acumulado': row.saldoAcumulado,
            'Estado': row.isLowStock ? 'Stock Bajo' : 'Normal'
        }));

        // Add Opening Balance Row
        dataForSheet.unshift({
            Fecha: 'Saldo Anterior',
            Entradas: 0,
            Salidas: 0,
            'Saldo Día': 0,
            'Saldo Acumulado': saldoApertura,
            'Estado': '-'
        });

        const ws = XLSX.utils.json_to_sheet(dataForSheet);
        XLSX.utils.book_append_sheet(wb, ws, "Kardex");
        XLSX.writeFile(wb, `Kardex_${selectedArticle?.codigo_articulo}_${fechaDesde}_${fechaHasta}.xlsx`);
    };

    const exportToPDF = () => {
        if (kardexData.length === 0) return;

        const doc = new jsPDF() as jsPDFWithAutoTable;

        // Header
        doc.setFontSize(18);
        doc.text('Reporte de Kárdex Diario', 14, 22);

        doc.setFontSize(11);
        doc.text(`Artículo: ${selectedArticle?.codigo_articulo} - ${selectedArticle?.nombre_articulo}`, 14, 32);
        doc.text(`Rango: ${fechaDesde} al ${fechaHasta}`, 14, 38);
        doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 44);

        // Table
        const tableBody = [
            ['Saldo Anterior', '-', '-', '-', saldoApertura.toLocaleString('es-CR')],
            ...kardexData.map(row => [
                row.fecha,
                row.entradas > 0 ? `+${row.entradas}` : '-',
                row.salidas > 0 ? `-${row.salidas}` : '-',
                row.saldoDia,
                row.saldoAcumulado
            ])
        ];

        doc.autoTable({
            startY: 50,
            head: [['Fecha', 'Entradas', 'Salidas', 'Saldo Día', 'Saldo Acum.']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [249, 115, 22] }, // Orange header
        });

        doc.save(`Kardex_${selectedArticle?.codigo_articulo}.pdf`);
    };

    return (
        <div className="min-h-screen bg-[#0f1419] text-slate-200 font-sans relative p-4 md:p-8">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[20%] left-[20%] w-[40rem] h-[40rem] bg-orange-900/10 rounded-full blur-3xl" />
                <div className="absolute bottom-[20%] right-[20%] w-[40rem] h-[40rem] bg-blue-900/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="sticky top-0 z-50 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 mb-8 bg-[#0f1419]/90 backdrop-blur-xl -mx-4 px-4 md:-mx-8 md:px-8 border-b border-white/5 shadow-lg shadow-black/20 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/30">
                            <LineChart className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                                Kárdex Diario
                            </h1>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate('/articulos')}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 text-slate-200 border border-white/10 rounded-xl hover:bg-slate-700/50 transition-all shadow-sm backdrop-blur-sm group"
                        >
                            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Regresar
                        </button>
                    </div>
                </div>

                {/* Main Content Card */}
                <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl">
                    <div className="bg-slate-900/50 rounded-xl p-6 md:p-8 space-y-8">

                        {/* Module Info */}
                        <div className="text-center space-y-2 pb-6 border-b border-white/5">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-2">
                                <Package className="w-4 h-4" />
                                Módulo Inventario
                            </div>
                            <h2 className="text-2xl font-bold text-white">Consulta de Movimientos</h2>
                            <p className="text-slate-400 max-w-2xl mx-auto">
                                Visualiza el flujo diario de entradas, salidas y saldos.
                            </p>
                        </div>

                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            {/* Article Search */}
                            <div className="md:col-span-5 relative z-30">
                                <label className="block text-sm font-medium text-slate-400 mb-2">Artículo</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            if (selectedArticle) setSelectedArticle(null);
                                        }}
                                        placeholder="Buscar por código o nombre..."
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                                    />
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500 animate-spin" />}
                                </div>

                                {/* Suggestions Dropdown */}
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f1419] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50">
                                        {suggestions.map((item) => (
                                            <button
                                                key={item.codigo_articulo}
                                                onClick={() => handleSelectArticle(item)}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-800/50 border-b border-white/5 last:border-0 flex items-center gap-3 transition-colors group"
                                            >
                                                <span className="font-mono text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded group-hover:bg-orange-500/20">
                                                    {item.codigo_articulo}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-200 truncate">{item.nombre_articulo}</p>
                                                    <p className="text-xs text-slate-500">{item.unidad}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Date Range */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-400 mb-2">Desde</label>
                                <input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={(e) => setFechaDesde(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all [color-scheme:dark]"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-400 mb-2">Hasta</label>
                                <input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={(e) => setFechaHasta(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all [color-scheme:dark]"
                                />
                            </div>

                            {/* Actions */}
                            <div className="md:col-span-3 flex gap-2">
                                <button
                                    onClick={executeKardexQuery}
                                    disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                    Buscar
                                </button>
                                <button
                                    onClick={clearSearch}
                                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 rounded-xl transition-all"
                                    title="Limpiar búsqueda"
                                >
                                    <Eraser className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Selected Article Summary & Export */}
                        {selectedArticle && kardexData.length > 0 && (
                            <div className="flex flex-col md:flex-row justify-between items-end gap-4 animate-in fade-in slide-in-from-top-4">
                                <div className="bg-slate-800/30 rounded-xl p-4 flex flex-wrap items-center gap-6 border border-white/5 flex-1">
                                    <div className="w-16 h-16 bg-slate-800 rounded-lg overflow-hidden border border-white/10 shrink-0">
                                        <img
                                            src={selectedArticle.imagen_url || ''}
                                            alt={selectedArticle.nombre_articulo}
                                            className="w-full h-full object-cover"
                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                                                {selectedArticle.codigo_articulo}
                                            </span>
                                            <span className="text-xs text-slate-500 font-mono uppercase border border-white/10 px-2 py-0.5 rounded">
                                                {selectedArticle.unidad}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-white">{selectedArticle.nombre_articulo}</h3>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={exportToExcel}
                                        className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center gap-2 transition-all font-medium text-sm"
                                    >
                                        <FileSpreadsheet className="w-4 h-4" />
                                        Excel
                                    </button>
                                    <button
                                        onClick={exportToPDF}
                                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl flex items-center gap-2 transition-all font-medium text-sm"
                                    >
                                        <FileText className="w-4 h-4" />
                                        PDF
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CHART SECTION */}
                        {kardexData.length > 0 && (
                            <div className="h-64 w-full bg-slate-900/30 rounded-xl border border-white/5 p-4 animate-in fade-in">
                                <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    Tendencia de Stock
                                </h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={kardexData}>
                                        <defs>
                                            <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis
                                            dataKey="fecha"
                                            stroke="#64748b"
                                            fontSize={12}
                                            tickFormatter={(val) => val.slice(5)} // Show MM-DD
                                        />
                                        <YAxis stroke="#64748b" fontSize={12} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f1419', borderColor: '#334155', color: '#fff' }}
                                            itemStyle={{ color: '#f97316' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="saldoAcumulado"
                                            stroke="#f97316"
                                            fillOpacity={1}
                                            fill="url(#colorSaldo)"
                                            name="Saldo Acumulado"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Results Table */}
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/30">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider border-b border-white/10">
                                            <th className="p-4 w-10"></th>
                                            <th className="p-4 font-medium">Fecha</th>
                                            <th className="p-4 font-medium text-right text-emerald-400">Entradas</th>
                                            <th className="p-4 font-medium text-right text-red-400">Salidas</th>
                                            <th className="p-4 font-medium text-right">Saldo Día</th>
                                            <th className="p-4 font-medium text-right">Saldo Acum.</th>
                                            <th className="p-4 font-medium text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {/* Opening Balance Row */}
                                        {kardexData.length > 0 && (
                                            <tr className="bg-slate-900/30 font-medium">
                                                <td className="p-4"></td>
                                                <td className="p-4 text-slate-400 italic">Saldo Anterior</td>
                                                <td className="p-4 text-right text-slate-600">-</td>
                                                <td className="p-4 text-right text-slate-600">-</td>
                                                <td className="p-4 text-right text-slate-600">-</td>
                                                <td className="p-4 text-right text-white font-bold font-mono bg-slate-800/30">
                                                    {saldoApertura.toLocaleString('es-CR')}
                                                </td>
                                                <td className="p-4"></td>
                                            </tr>
                                        )}

                                        {kardexData.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-12 text-center text-slate-500">
                                                    {selectedArticle ? 'No hay movimientos en el rango seleccionado' : 'Seleccione un artículo y rango de fechas para consultar'}
                                                </td>
                                            </tr>
                                        ) : (
                                            kardexData.map((row) => (
                                                <>
                                                    <tr
                                                        key={row.fecha}
                                                        className={`hover:bg-white/5 transition-colors cursor-pointer ${expandedRows.has(row.fecha) ? 'bg-white/5' : ''}`}
                                                        onClick={() => toggleRow(row.fecha)}
                                                    >
                                                        <td className="p-4 text-slate-500">
                                                            {row.detalles.length > 0 && (
                                                                expandedRows.has(row.fecha) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-slate-300 font-mono text-sm">{row.fecha}</td>
                                                        <td className="p-4 text-right font-mono text-emerald-300">
                                                            {row.entradas > 0 ? `+${row.entradas.toLocaleString('es-CR')}` : '-'}
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-red-300">
                                                            {row.salidas > 0 ? `-${row.salidas.toLocaleString('es-CR')}` : '-'}
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-slate-300">
                                                            {row.saldoDia !== 0 ? (
                                                                <span className={row.saldoDia > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                                    {row.saldoDia > 0 ? '+' : ''}{row.saldoDia.toLocaleString('es-CR')}
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="p-4 text-right font-mono font-bold text-white bg-slate-800/30">
                                                            {row.saldoAcumulado.toLocaleString('es-CR')}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {row.isLowStock && (
                                                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold" title="Stock Bajo">
                                                                    <AlertCircle className="w-3 h-3" /> Bajo
                                                                </div>
                                                            )}
                                                            {row.isHighMovement && !row.isLowStock && (
                                                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold" title="Alto Movimiento">
                                                                    <TrendingUp className="w-3 h-3" /> Alto
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                    {/* EXPANDED DETAILS */}
                                                    {expandedRows.has(row.fecha) && row.detalles.length > 0 && (
                                                        <tr className="bg-slate-950/30">
                                                            <td colSpan={7} className="p-0">
                                                                <div className="p-4 pl-14 border-b border-white/5 animate-in slide-in-from-top-2">
                                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Detalle de Movimientos</h4>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                        {row.detalles.map((det) => (
                                                                            <div key={det.id} className="flex items-center justify-between p-2 rounded bg-slate-900 border border-white/5">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${det.tipo === 'ENTRADA' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                                                                        }`}>
                                                                                        {det.tipo}
                                                                                    </span>
                                                                                    <span className="text-sm text-slate-300">
                                                                                        Doc #{det.documento_id}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="font-mono text-sm font-bold text-white">
                                                                                    {det.cantidad} {selectedArticle?.unidad}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            ))
                                        )}
                                    </tbody>
                                    {kardexData.length > 0 && (
                                        <tfoot className="bg-slate-950/80 border-t border-white/10 font-bold">
                                            <tr>
                                                <td colSpan={2} className="p-4 text-orange-400">Totales en Rango</td>
                                                <td className="p-4 text-right text-emerald-400">{totals.ent.toLocaleString('es-CR')}</td>
                                                <td className="p-4 text-right text-red-400">{totals.sal.toLocaleString('es-CR')}</td>
                                                <td className="p-4 text-right text-slate-300">{totals.neto > 0 ? '+' : ''}{totals.neto.toLocaleString('es-CR')}</td>
                                                <td className="p-4 text-right text-white bg-slate-800/50">
                                                    {kardexData[kardexData.length - 1].saldoAcumulado.toLocaleString('es-CR')}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Message Toast */}
                {statusMessage && (
                    <div className="fixed bottom-8 right-8 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
                        <div className={`p-4 rounded-xl flex items-start gap-4 shadow-2xl backdrop-blur-xl border ${statusMessage.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-100' :
                                statusMessage.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-100' :
                                    statusMessage.type === 'warning' ? 'bg-amber-500/20 border-amber-500/30 text-amber-100' :
                                        'bg-blue-500/20 border-blue-500/30 text-blue-100'
                            }`}>
                            <div className={`p-2 rounded-full shrink-0 ${statusMessage.type === 'error' ? 'bg-red-500/20' :
                                    statusMessage.type === 'success' ? 'bg-emerald-500/20' :
                                        statusMessage.type === 'warning' ? 'bg-amber-500/20' :
                                            'bg-blue-500/20'
                                }`}>
                                {statusMessage.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                                {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                                {statusMessage.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                                {statusMessage.type === 'info' && <Info className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 pt-1">
                                <h4 className="font-bold text-sm uppercase tracking-wider mb-1 opacity-80">{statusMessage.type}</h4>
                                <p className="text-sm font-medium leading-relaxed">{statusMessage.message}</p>
                            </div>
                            <button onClick={() => setStatusMessage(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
