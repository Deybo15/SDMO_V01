import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    LineChart as LineChartIcon,
    Search,
    Eraser,
    Loader2,
    ArrowLeft,
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
    AlertCircle,
    Calendar,
    ArrowRight,
    BarChart3,
    History
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
import autoTable from 'jspdf-autotable';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';

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

    // Theme Color
    const themeColor = 'blue';

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
                setShowSuggestions(false);
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(amount);
    };

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

        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('Reporte de Kárdex Diario', 14, 22);
        doc.setFontSize(11);
        doc.text(`Artículo: ${selectedArticle?.codigo_articulo} - ${selectedArticle?.nombre_articulo}`, 14, 32);
        doc.text(`Rango: ${fechaDesde} al ${fechaHasta}`, 14, 38);
        doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 44);

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

        autoTable(doc, {
            startY: 50,
            head: [['Fecha', 'Entradas', 'Salidas', 'Saldo Día', 'Saldo Acum.']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [0, 113, 227] },
        });

        doc.save(`Kardex_${selectedArticle?.codigo_articulo}.pdf`);
    };

    return (
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] p-4 md:p-8 relative overflow-hidden">
            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-[#333333]">
                    <div className="space-y-1">
                        <PageHeader title="Kárdex Diario" icon={History} themeColor="blue" />
                        <p className="text-[#86868B] text-sm font-medium tracking-wide">
                            Seguimiento detallado de movimientos de inventario y saldos acumulados.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/articulos')}
                        className="px-6 py-2.5 bg-transparent border border-[#333333] rounded-[8px] text-xs font-black uppercase tracking-widest flex items-center gap-2 text-[#F5F5F7] hover:bg-white/5 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4 text-[#0071E3]" />
                        Regresar
                    </button>
                </div>

                {/* Status Float Messages */}
                {statusMessage && (
                    <div className={`fixed top-8 right-8 z-[100] px-6 py-5 rounded-[8px] shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 flex items-center gap-4
                        ${statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100' :
                            statusMessage.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-100' :
                                statusMessage.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-100' :
                                    'bg-[#0071E3]/10 border-[#0071E3]/20 text-blue-100'
                        }`}>
                        <div className="p-2 rounded-[8px] bg-white/5 shrink-0">
                            {statusMessage.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400" /> :
                                statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                                    <Info className="w-5 h-5 text-amber-400" />}
                        </div>
                        <span className="font-black uppercase tracking-widest text-[11px] leading-relaxed">{statusMessage.message}</span>
                        <button onClick={() => setStatusMessage(null)} className="ml-auto p-1 hover:bg-white/5 rounded-[4px] transition-colors">
                            <X className="w-4 h-4 text-[#86868B]" />
                        </button>
                    </div>
                )}

                {/* Filters Section */}
                <div className="bg-[#121212] p-8 border border-[#333333] rounded-[8px] relative group">
                    <h2 className="text-xs font-black text-[#86868B] uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                        <span className="w-8 h-px bg-[#0071E3]/30" />
                        Configuración de Consulta
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        {/* Article Search */}
                        <div className="md:col-span-12 lg:col-span-5 relative">
                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Artículo a Consultar</label>
                            <div className="relative group/input">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#86868B] group-focus-within/input:text-[#0071E3] transition-colors" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        if (selectedArticle) setSelectedArticle(null);
                                    }}
                                    placeholder="Código o nombre..."
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-14 pr-12 py-4 text-white font-bold placeholder-[#424245] focus:outline-none focus:border-[#0071E3]/50 transition-all shadow-inner"
                                />
                                {searching && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0071E3] animate-spin" />}
                            </div>

                            {/* Suggestions Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#121212] backdrop-blur-2xl border border-[#333333] rounded-[8px] shadow-2xl overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-300">
                                    {suggestions.map((item) => (
                                        <button
                                            key={item.codigo_articulo}
                                            onClick={() => handleSelectArticle(item)}
                                            className="w-full text-left px-5 py-4 hover:bg-white/5 border-b border-[#333333] last:border-0 flex items-center gap-4 transition-all group/item"
                                        >
                                            <div className="w-10 h-10 bg-black/40 rounded-[8px] overflow-hidden border border-[#333333] shrink-0">
                                                <img src={item.imagen_url || ''} className="w-full h-full object-cover opacity-60 group-hover/item:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[10px] font-black text-[#0071E3] bg-[#0071E3]/5 px-2 py-0.5 rounded border border-[#0071E3]/10">
                                                        {item.codigo_articulo}
                                                    </span>
                                                    <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">{item.unidad}</span>
                                                </div>
                                                <p className="text-sm font-bold text-[#F5F5F7] truncate mt-1 group-hover/item:text-white transition-colors">
                                                    {item.nombre_articulo}
                                                </p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-[#333333] group-hover/item:text-[#0071E3] group-hover/item:translate-x-1 transition-all" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Date Range */}
                        <div className="md:col-span-6 lg:col-span-3">
                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Desde</label>
                            <div className="relative group/date">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#86868B] group-focus-within/date:text-[#0071E3] pointer-events-none" />
                                <input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={(e) => setFechaDesde(e.target.value)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-14 pr-4 py-4 text-white font-bold focus:outline-none focus:border-[#0071E3]/50 transition-all shadow-inner [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-6 lg:col-span-3">
                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Hasta</label>
                            <div className="relative group/date">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#86868B] group-focus-within/date:text-[#0071E3] pointer-events-none" />
                                <input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={(e) => setFechaHasta(e.target.value)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-14 pr-4 py-4 text-white font-bold focus:outline-none focus:border-[#0071E3]/50 transition-all shadow-inner [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="md:col-span-12 lg:col-span-1 flex gap-3">
                            <button
                                onClick={executeKardexQuery}
                                disabled={loading}
                                className="flex-1 lg:w-16 h-[58px] bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-[8px] shadow-lg shadow-[#0071E3]/20 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95 group/search"
                                title="Consultar Kárdex"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6 group-hover/search:scale-110 transition-transform" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                {loading ? (
                    <div className="py-40 flex flex-col items-center justify-center space-y-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-[#0071E3]/20 rounded-full blur-2xl animate-pulse" />
                            <Loader2 className="w-16 h-16 animate-spin text-[#0071E3] relative z-10" />
                        </div>
                        <p className="font-black uppercase tracking-[0.3em] text-[10px] animate-pulse text-[#86868B]">Recuperando Historial...</p>
                    </div>
                ) : selectedArticle && kardexData.length > 0 ? (
                    <div className="space-y-8 animate-in fade-in duration-700">
                        {/* Selected Article Detail & Export */}
                        <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-end justify-between px-2">
                            <div className="flex flex-col md:flex-row items-center gap-6 w-full lg:w-auto">
                                <div className="w-20 h-20 bg-[#121212] rounded-[8px] border border-[#333333] overflow-hidden shrink-0 shadow-2xl relative p-1">
                                    <div className="w-full h-full rounded-[4px] overflow-hidden bg-black">
                                        <img
                                            src={selectedArticle.imagen_url || ''}
                                            alt={selectedArticle.nombre_articulo}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1 text-center md:text-left">
                                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                                        <span className="px-3 py-1 rounded-[4px] bg-[#0071E3]/5 border border-[#0071E3]/10 text-[#0071E3] font-mono text-[10px] uppercase font-black tracking-widest">
                                            {selectedArticle.codigo_articulo}
                                        </span>
                                        <span className="px-3 py-1 rounded-[4px] bg-white/5 border border-[#333333] text-[#86868B] text-[10px] uppercase font-black tracking-widest">
                                            {selectedArticle.unidad}
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-black text-[#F5F5F7] italic uppercase tracking-tighter leading-none">
                                        {selectedArticle.nombre_articulo}
                                    </h3>
                                </div>
                            </div>

                            <div className="flex gap-3 w-full md:w-auto">
                                <button
                                    onClick={exportToExcel}
                                    className="flex-1 md:flex-none px-6 py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-[8px] transition-all flex items-center justify-center gap-3 group/excel"
                                >
                                    <FileSpreadsheet className="w-5 h-5 group-hover/excel:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Exportar Excel</span>
                                </button>
                                <button
                                    onClick={exportToPDF}
                                    className="flex-1 md:flex-none px-6 py-3 bg-transparent border border-[#333333] text-[#F5F5F7] hover:bg-white/5 rounded-[8px] transition-all flex items-center justify-center gap-3 group/pdf"
                                >
                                    <FileText className="w-5 h-5 group-hover/pdf:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Generar PDF</span>
                                </button>
                            </div>
                        </div>

                        {/* Chart and Summary Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Chart */}
                            <div className="lg:col-span-8 bg-[#121212] border border-[#333333] rounded-[8px] p-8 relative overflow-hidden flex flex-col h-[400px]">
                                <h3 className="text-xs font-black text-[#86868B] uppercase tracking-[0.3em] mb-8 flex items-center gap-3 shrink-0">
                                    <BarChart3 className="w-5 h-5 text-[#0071E3]" />
                                    Tendencia de Existencias
                                </h3>

                                <div className="flex-1 w-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={kardexData}>
                                            <defs>
                                                <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#0071E3" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333333" vertical={false} />
                                            <XAxis
                                                dataKey="fecha"
                                                stroke="#86868B"
                                                fontSize={10}
                                                tickFormatter={(val) => val.slice(5)}
                                                axisLine={false}
                                                tickLine={false}
                                                fontWeight="bold"
                                            />
                                            <YAxis
                                                stroke="#86868B"
                                                fontSize={10}
                                                axisLine={false}
                                                tickLine={false}
                                                fontWeight="bold"
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#121212',
                                                    border: '1px solid #333333',
                                                    borderRadius: '8px',
                                                    padding: '12px',
                                                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                                                    backdropFilter: 'blur(20px)'
                                                }}
                                                itemStyle={{ color: '#0071E3', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase' }}
                                                labelStyle={{ color: '#86868B', fontWeight: 'bold', fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase' }}
                                                cursor={{ stroke: '#0071E333', strokeWidth: 2 }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="saldoAcumulado"
                                                stroke="#0071E3"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorSaldo)"
                                                name="Saldo Final"
                                                animationDuration={1500}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Totals Summary */}
                            <div className="lg:col-span-4 grid grid-cols-1 gap-5">
                                <div className="bg-[#121212] border border-[#333333] p-6 rounded-[8px] relative overflow-hidden group">
                                    <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest block mb-4">Total Entradas</span>
                                    <div className="flex items-end gap-3">
                                        <span className="text-4xl font-black text-[#F5F5F7] italic tracking-tighter">+{totals.ent.toLocaleString('es-CR')}</span>
                                        <span className="text-[#86868B] text-xs font-black uppercase mb-1">{selectedArticle.unidad}</span>
                                    </div>
                                    <div className="mt-4 h-1 w-full bg-[#1D1D1F] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#0071E3] w-[70%] opacity-50" />
                                    </div>
                                </div>

                                <div className="bg-[#121212] border border-[#333333] p-6 rounded-[8px] relative overflow-hidden group">
                                    <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest block mb-4">Total Salidas</span>
                                    <div className="flex items-end gap-3">
                                        <span className="text-4xl font-black text-[#F5F5F7] italic tracking-tighter">-{totals.sal.toLocaleString('es-CR')}</span>
                                        <span className="text-[#86868B] text-xs font-black uppercase mb-1">{selectedArticle.unidad}</span>
                                    </div>
                                    <div className="mt-4 h-1 w-full bg-[#1D1D1F] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#0071E3] w-[45%] opacity-30" />
                                    </div>
                                </div>

                                <div className="bg-[#0071E3]/5 border border-[#0071E3]/20 p-6 rounded-[8px] relative overflow-hidden group">
                                    <span className="text-[10px] font-black text-[#0071E3] uppercase tracking-widest block mb-4">Saldo Final en Rango</span>
                                    <div className="flex items-end gap-3">
                                        <span className="text-4xl font-black text-[#F5F5F7] italic tracking-tighter">
                                            {kardexData[kardexData.length - 1].saldoAcumulado.toLocaleString('es-CR')}
                                        </span>
                                        <span className="text-[#0071E3]/50 text-xs font-black uppercase mb-1">{selectedArticle.unidad}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Table Section */}
                        <div className="bg-[#121212] border border-[#333333] rounded-[8px] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#1D1D1F] text-[#86868B] text-[10px] font-black uppercase tracking-[0.2em] border-b border-[#333333]">
                                            <th className="p-6 w-16 text-center"></th>
                                            <th className="p-6">Fecha Movimiento</th>
                                            <th className="p-6 text-right">Ingresos</th>
                                            <th className="p-6 text-right">Egresos</th>
                                            <th className="p-6 text-right">Saldo Neto</th>
                                            <th className="p-6 text-right bg-white/[0.02]">Saldo Acum.</th>
                                            <th className="p-6 text-center">Referencia</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#333333]">
                                        {/* Opening Balance Row */}
                                        <tr className="bg-white/[0.01] group/apertura">
                                            <td className="p-6"></td>
                                            <td className="p-6 text-[#86868B] font-black text-xs uppercase italic tracking-widest">Saldo Apertura (Anterior)</td>
                                            <td className="p-6 text-right text-[#424245] font-mono">-</td>
                                            <td className="p-6 text-right text-[#424245] font-mono">-</td>
                                            <td className="p-6 text-right text-[#424245] font-mono">-</td>
                                            <td className="p-6 text-right text-[#F5F5F7] font-black font-mono bg-white/[0.02] text-lg">
                                                {saldoApertura.toLocaleString('es-CR')}
                                            </td>
                                            <td className="p-6 text-center">
                                                <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest bg-white/5 px-3 py-1 rounded-[4px]">Histórico</span>
                                            </td>
                                        </tr>

                                        {kardexData.map((row, index) => (
                                            <React.Fragment key={row.fecha}>
                                                <tr
                                                    className={`hover:bg-white/[0.03] transition-all cursor-pointer group/row ${expandedRows.has(row.fecha) ? 'bg-white/[0.04]' : ''}`}
                                                    onClick={() => toggleRow(row.fecha)}
                                                >
                                                    <td className="p-6 text-center">
                                                        {row.detalles.length > 0 && (
                                                            <div className={`w-8 h-8 rounded-[4px] flex items-center justify-center transition-all ${expandedRows.has(row.fecha) ? 'bg-[#0071E3] text-white' : 'bg-white/5 text-[#86868B] group-hover/row:bg-white/10 group-hover/row:text-[#F5F5F7]'}`}>
                                                                {expandedRows.has(row.fecha) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-3">
                                                            <Calendar className="w-4 h-4 text-[#86868B]" />
                                                            <span className="text-[#F5F5F7] font-bold font-mono text-sm">{row.fecha}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-right font-black font-mono text-[#0071E3] text-base">
                                                        {row.entradas > 0 ? `+${row.entradas.toLocaleString('es-CR')}` : <span className="text-[#424245]">-</span>}
                                                    </td>
                                                    <td className="p-6 text-right font-black font-mono text-[#86868B] text-base">
                                                        {row.salidas > 0 ? `-${row.salidas.toLocaleString('es-CR')}` : <span className="text-[#424245]">-</span>}
                                                    </td>
                                                    <td className="p-6 text-right font-black font-mono">
                                                        {row.saldoDia !== 0 ? (
                                                            <span className={row.saldoDia > 0 ? 'text-[#0071E3]/80' : 'text-[#86868B]'}>
                                                                {row.saldoDia > 0 ? '+' : ''}{row.saldoDia.toLocaleString('es-CR')}
                                                            </span>
                                                        ) : <span className="text-[#424245]">-</span>}
                                                    </td>
                                                    <td className="p-6 text-right font-black font-mono text-white text-lg bg-white/[0.01]">
                                                        {row.saldoAcumulado.toLocaleString('es-CR')}
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {row.isLowStock && (
                                                                <div className="px-3 py-1 rounded-[4px] bg-[#0071E3]/5 border border-[#0071E3]/10 text-[#0071E3] text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                                                    <AlertTriangle className="w-3 h-3" /> Bajo
                                                                </div>
                                                            )}
                                                            {row.isHighMovement && !row.isLowStock && (
                                                                <div className="px-3 py-1 rounded-[4px] bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                                                    <TrendingUp className="w-3 h-3" /> Alto
                                                                </div>
                                                            )}
                                                            {!row.isLowStock && !row.isHighMovement && (
                                                                <span className="w-2 h-2 rounded-full bg-[#333333]" />
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Expanded Details Sub-table */}
                                                {expandedRows.has(row.fecha) && row.detalles.length > 0 && (
                                                    <tr className="bg-black/40 animate-in slide-in-from-top-4 duration-300">
                                                        <td colSpan={7} className="p-0">
                                                            <div className="p-8 pl-24 border-b border-[#333333] relative">
                                                                <div className="absolute left-10 top-0 bottom-0 w-px bg-[#333333]" />
                                                                <h4 className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                                    <History className="w-4 h-4 text-[#0071E3]/50" />
                                                                    Documentación de Movimientos
                                                                </h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    {row.detalles.map((det) => (
                                                                        <div key={det.id} className="flex items-center justify-between p-5 rounded-[8px] bg-white/[0.02] border border-[#333333] hover:border-[#0071E3]/30 transition-colors shadow-inner group/det">
                                                                            <div className="flex items-center gap-4">
                                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${det.tipo === 'ENTRADA' ? 'bg-emerald-500/10 text-emerald-500 shadow-emerald-500/5' : 'bg-rose-500/10 text-rose-500 shadow-rose-500/5'}`}>
                                                                                    {det.tipo === 'ENTRADA' ? <Package className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-white font-black text-sm uppercase tracking-tight mt-1">{det.tipo}</p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <span className="text-xl font-black font-mono text-white group-hover/det:text-[#0071E3] transition-colors">
                                                                                    {det.cantidad}
                                                                                </span>
                                                                                <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-2">{selectedArticle?.unidad}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-40 flex flex-col items-center justify-center text-center group animate-in fade-in zoom-in duration-700">
                        <div className="relative mb-10">
                            <div className="absolute inset-0 bg-[#0071E3]/10 rounded-full blur-3xl scale-150 group-hover:scale-200 transition-transform duration-1000" />
                            <div className="w-32 h-32 bg-[#121212] border border-[#333333] rounded-[8px] flex items-center justify-center relative z-10 group-hover:rotate-3 transition-all duration-700 shadow-2xl">
                                <History className="w-16 h-16 text-[#333333]" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-[#F5F5F7] uppercase italic tracking-tighter">Historial sin Consultar</h3>
                        <p className="text-[#86868B] mt-3 max-w-sm mx-auto font-medium text-sm leading-relaxed tracking-wide uppercase text-[10px]">
                            Seleccione un artículo y defina un rango de fechas para visualizar la cronología de movimientos y variaciones de inventario.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
