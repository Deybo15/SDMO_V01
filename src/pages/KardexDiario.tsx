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
import ArticleSearchGridModal from '../components/ArticleSearchGridModal';

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
    // State
    const [loading, setLoading] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState<Articulo | null>(null);
    const [showSearchModal, setShowSearchModal] = useState(false);

    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');

    // Data
    const [kardexData, setKardexData] = useState<KardexRow[]>([]);
    const [saldoApertura, setSaldoApertura] = useState(0);

    // UI State
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null);

    // Theme Color
    const themeColor = 'blue';

    // Initialize dates (last 30 days)
    useEffect(() => {
        const hoy = new Date();
        const hasta = hoy.toLocaleDateString('en-CA');
        const desdeDate = new Date();
        desdeDate.setDate(hoy.getDate() - 30);
        const desde = desdeDate.toLocaleDateString('en-CA');

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


    const clearSearch = () => {
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
            const entPrev: any[] = [];
            const salPrev: any[] = [];
            const BATCH_SIZE = 1000;

            // Batch for entPrev
            let offsetEnt = 0;
            while (true) {
                const { data, error } = await supabase
                    .from('dato_entrada_12')
                    .select('cantidad, entrada:entrada_articulo_07!inner(fecha_entrada)')
                    .eq('articulo', selectedArticle.codigo_articulo)
                    .lt('entrada.fecha_entrada', fechaDesde)
                    .range(offsetEnt, offsetEnt + BATCH_SIZE - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;
                entPrev.push(...data);
                if (data.length < BATCH_SIZE) break;
                offsetEnt += BATCH_SIZE;
            }

            // Batch for salPrev
            let offsetSal = 0;
            while (true) {
                const { data, error } = await supabase
                    .from('dato_salida_13')
                    .select('cantidad, salida:salida_articulo_08!inner(fecha_salida)')
                    .eq('articulo', selectedArticle.codigo_articulo)
                    .lt('salida.fecha_salida', fechaDesde)
                    .range(offsetSal, offsetSal + BATCH_SIZE - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;
                salPrev.push(...data);
                if (data.length < BATCH_SIZE) break;
                offsetSal += BATCH_SIZE;
            }

            const sumEntPrev = (entPrev || []).reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);
            const sumSalPrev = (salPrev || []).reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);
            const apertura = sumEntPrev - sumSalPrev;
            setSaldoApertura(apertura);

            // 2. Get Movements in Range
            const hastaDate = new Date(fechaHasta);
            hastaDate.setDate(hastaDate.getDate() + 1);
            const hastaNextDay = hastaDate.toLocaleDateString('en-CA');

            // Fetch Entries with ID (Batch)
            const entRange: any[] = [];
            let offsetEntRange = 0;
            while (true) {
                const { data, error } = await supabase
                    .from('dato_entrada_12')
                    .select('cantidad, id_entrada, entrada:entrada_articulo_07!inner(fecha_entrada)')
                    .eq('articulo', selectedArticle.codigo_articulo)
                    .gte('entrada.fecha_entrada', fechaDesde)
                    .lt('entrada.fecha_entrada', hastaNextDay)
                    .range(offsetEntRange, offsetEntRange + BATCH_SIZE - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;
                entRange.push(...data);
                if (data.length < BATCH_SIZE) break;
                offsetEntRange += BATCH_SIZE;
            }

            // Fetch Exits with ID (Batch)
            const salRange: any[] = [];
            let offsetSalRange = 0;
            while (true) {
                const { data, error } = await supabase
                    .from('dato_salida_13')
                    .select('cantidad, id_salida, salida:salida_articulo_08!inner(fecha_salida)')
                    .eq('articulo', selectedArticle.codigo_articulo)
                    .gte('salida.fecha_salida', fechaDesde)
                    .lte('salida.fecha_salida', fechaHasta)
                    .range(offsetSalRange, offsetSalRange + BATCH_SIZE - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;
                salRange.push(...data);
                if (data.length < BATCH_SIZE) break;
                offsetSalRange += BATCH_SIZE;
            }

            // 3. Process Daily Data
            const movementsByDay = new Map<string, { ent: number, sal: number, detalles: KardexDetail[] }>();
            const getDateStr = (dateVal: string) => dateVal.split('T')[0];

            // Initialize days
            const curr = new Date(fechaDesde);
            const end = new Date(fechaHasta);
            while (curr <= end) {
                movementsByDay.set(curr.toLocaleDateString('en-CA'), { ent: 0, sal: 0, detalles: [] });
                curr.setDate(curr.getDate() + 1);
            }

            // Fill entries
            (entRange || []).forEach(r => {
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
                        fecha_hora: r.entrada?.fecha_entrada
                    });
                }
            });

            // Fill exits
            (salRange || []).forEach(r => {
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
        <div className="min-h-screen bg-black text-[#f4f4f5] p-4 md:p-8 relative overflow-hidden selection:bg-white/20">
            <div className="max-w-[1536px] mx-auto space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-5">
                    <PageHeader title="Kárdex diario" icon={History} themeColor="neutral" subtitle="Movimientos de inventario y evolución de existencias por artículo." />
                    <button
                        onClick={() => navigate('/articulos')}
                        className="h-12 px-6 bg-[#111112] border border-[#52525b] rounded-lg flex items-center gap-3 text-sm font-semibold text-[#d4d4d8] hover:text-white hover:bg-[#18181b] transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Regresar
                    </button>
                </div>

                {/* Status Float Messages */}
                {statusMessage && (
                    <div className="fixed top-8 right-8 z-[100] max-w-md px-6 py-4 rounded-lg shadow-2xl backdrop-blur-xl border border-[#71717a] bg-[#111112] text-[#d4d4d8] animate-in slide-in-from-right-4 flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-[#18181b] shrink-0">
                            {statusMessage.type === 'error' ? <AlertCircle className="w-5 h-5 text-white" /> :
                                statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-white" /> :
                                    <Info className="w-5 h-5 text-white" />}
                        </div>
                        <span className="text-sm leading-relaxed">{statusMessage.message}</span>
                        <button onClick={() => setStatusMessage(null)} className="ml-auto p-1 hover:bg-white/5 rounded-[4px] transition-colors">
                            <X className="w-4 h-4 text-[#86868B]" />
                        </button>
                    </div>
                )}

                {/* Filters Section */}
                <div className="bg-[#0d0d0e] p-6 border border-[#3f3f46] rounded-xl">
                    <div className="space-y-1 mb-6">
                        <h2 className="text-lg font-semibold text-white">Configurar consulta</h2>
                        <p className="text-sm text-[#a1a1aa]">Seleccione un artículo y el período que desea analizar.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
                        {/* Article Search Trigger */}
                        <div className="lg:col-span-6 relative">
                            <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] mb-3">Artículo a consultar</label>
                            {selectedArticle ? (
                                <div className="flex items-center gap-4 p-3 bg-[#111112] border border-[#3f3f46] rounded-lg group/selected relative overflow-hidden h-14">
                                    <div className="w-12 h-12 bg-black rounded-lg overflow-hidden border border-[#52525b] shrink-0">
                                        <img src={selectedArticle.imagen_url || ''} className="w-full h-full object-cover opacity-80" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-mono text-xs text-[#d4d4d8] bg-[#18181b] px-2 py-0.5 rounded border border-[#52525b]">
                                            {selectedArticle.codigo_articulo}
                                        </span>
                                        <p className="text-sm font-semibold text-white truncate mt-1">{selectedArticle.nombre_articulo}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowSearchModal(true)}
                                            className="p-2 bg-[#18181b] text-[#d4d4d8] hover:text-white rounded-lg transition-colors border border-[#52525b]"
                                            title="Cambiar artículo"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { clearSearch(); }}
                                            className="p-2 bg-[#18181b] text-[#a1a1aa] hover:text-white rounded-lg transition-colors border border-[#52525b]"
                                            title="Quitar"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowSearchModal(true)}
                                    className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-left flex items-center justify-between group/trigger hover:border-[#71717a] transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <Search className="w-5 h-5 text-[#a1a1aa] group-hover/trigger:text-white transition-colors" />
                                        <span className="text-[#a1a1aa] text-sm">Seleccionar artículo del inventario...</span>
                                    </div>
                                    <span className="text-xs font-semibold text-[#d4d4d8] bg-[#18181b] px-3 py-1.5 rounded-md border border-[#52525b]">
                                        Explorar
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Date Range */}
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] mb-3">Desde</label>
                            <div className="relative group/date">
                                <input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={(e) => setFechaDesde(e.target.value)}
                                    className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-4 text-white font-semibold focus:outline-none focus:border-[#a1a1aa] transition-colors [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] mb-3">Hasta</label>
                            <div className="relative group/date">
                                <input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={(e) => setFechaHasta(e.target.value)}
                                    className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-4 text-white font-semibold focus:outline-none focus:border-[#a1a1aa] transition-colors [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="lg:col-span-2 flex gap-3">
                            <button
                                onClick={executeKardexQuery}
                                disabled={loading}
                                className="flex-1 h-14 bg-[#e4e4e7] hover:bg-white text-black rounded-lg transition-colors flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.99] group/search"
                                title="Consultar Kárdex"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 group-hover/search:scale-110 transition-transform" />}
                                <span className="text-sm font-semibold">Consultar</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                {loading ? (
                    <div className="py-40 flex flex-col items-center justify-center space-y-6">
                        <div className="relative">
                            <Loader2 className="w-12 h-12 animate-spin text-white relative z-10" />
                        </div>
                        <p className="text-sm animate-pulse text-[#a1a1aa]">Consultando movimientos...</p>
                    </div>
                ) : selectedArticle && kardexData.length > 0 ? (
                    <div className="space-y-8 animate-in fade-in duration-700">
                        {/* Selected Article Detail & Export */}
                        <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-end justify-between px-2">
                            <div className="flex flex-col md:flex-row items-center gap-6 w-full lg:w-auto">
                                <div className="w-20 h-20 bg-[#111112] rounded-lg border border-[#52525b] overflow-hidden shrink-0 relative p-1">
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
                                        <span className="px-3 py-1 rounded-md bg-[#18181b] border border-[#52525b] text-[#d4d4d8] font-mono text-xs">
                                            {selectedArticle.codigo_articulo}
                                        </span>
                                        <span className="px-3 py-1 rounded-md bg-[#111112] border border-[#3f3f46] text-[#a1a1aa] text-xs uppercase">
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
                                    className="flex-1 md:flex-none px-6 h-12 bg-[#e4e4e7] hover:bg-white text-black rounded-lg transition-colors flex items-center justify-center gap-3 group/excel"
                                >
                                    <FileSpreadsheet className="w-5 h-5 group-hover/excel:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Exportar Excel</span>
                                </button>
                                <button
                                    onClick={exportToPDF}
                                    className="flex-1 md:flex-none px-6 h-12 bg-[#111112] border border-[#52525b] text-[#d4d4d8] hover:text-white rounded-lg transition-colors flex items-center justify-center gap-3 group/pdf"
                                >
                                    <FileText className="w-5 h-5 group-hover/pdf:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Generar PDF</span>
                                </button>
                            </div>
                        </div>

                        {/* Chart and Summary Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Chart */}
                            <div className="lg:col-span-8 bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-7 relative overflow-hidden flex flex-col h-[400px]">
                                <h3 className="text-lg font-semibold text-white mb-8 flex items-center gap-3 shrink-0">
                                    <BarChart3 className="w-5 h-5 text-[#d4d4d8]" />
                                    Tendencia de existencias
                                </h3>

                                <div className="flex-1 w-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={kardexData}>
                                            <defs>
                                                <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.22} />
                                                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
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
                                                itemStyle={{ color: '#ffffff', fontWeight: '600', fontSize: '12px' }}
                                                labelStyle={{ color: '#86868B', fontWeight: 'bold', fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase' }}
                                                cursor={{ stroke: '#a1a1aa', strokeWidth: 1 }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="saldoAcumulado"
                                                stroke="#ffffff"
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
                                <div className="bg-[#0d0d0e] border border-[#3f3f46] p-6 rounded-xl relative overflow-hidden group">
                                    <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest block mb-4">Total Entradas</span>
                                    <div className="flex items-end gap-3">
                                        <span className="text-4xl font-black text-[#F5F5F7] italic tracking-tighter">+{totals.ent.toLocaleString('es-CR')}</span>
                                        <span className="text-[#86868B] text-xs font-black uppercase mb-1">{selectedArticle.unidad}</span>
                                    </div>
                                    <div className="mt-4 h-1 w-full bg-[#1D1D1F] rounded-full overflow-hidden">
                                        <div className="h-full bg-white w-[70%] opacity-70" />
                                    </div>
                                </div>

                                <div className="bg-[#0d0d0e] border border-[#3f3f46] p-6 rounded-xl relative overflow-hidden group">
                                    <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest block mb-4">Total Salidas</span>
                                    <div className="flex items-end gap-3">
                                        <span className="text-4xl font-black text-[#F5F5F7] italic tracking-tighter">-{totals.sal.toLocaleString('es-CR')}</span>
                                        <span className="text-[#86868B] text-xs font-black uppercase mb-1">{selectedArticle.unidad}</span>
                                    </div>
                                    <div className="mt-4 h-1 w-full bg-[#1D1D1F] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#a1a1aa] w-[45%] opacity-70" />
                                    </div>
                                </div>

                                <div className="bg-[#18181b] border border-[#71717a] p-6 rounded-xl relative overflow-hidden group">
                                    <span className="text-[10px] font-semibold text-[#d4d4d8] uppercase tracking-widest block mb-4">Saldo final en rango</span>
                                    <div className="flex items-end gap-3">
                                        <span className="text-4xl font-black text-[#F5F5F7] italic tracking-tighter">
                                            {kardexData[kardexData.length - 1].saldoAcumulado.toLocaleString('es-CR')}
                                        </span>
                                        <span className="text-[#a1a1aa] text-xs font-semibold uppercase mb-1">{selectedArticle.unidad}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Table Section */}
                        <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#18181b] text-[#a1a1aa] text-[10px] font-semibold uppercase tracking-[0.14em] border-b border-[#3f3f46]">
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
                                                            <div className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${expandedRows.has(row.fecha) ? 'bg-white text-black' : 'bg-[#18181b] text-[#a1a1aa] group-hover/row:text-white'}`}>
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
                                                    <td className="p-6 text-right font-semibold font-mono text-white text-base">
                                                        {row.entradas > 0 ? `+${row.entradas.toLocaleString('es-CR')}` : <span className="text-[#424245]">-</span>}
                                                    </td>
                                                    <td className="p-6 text-right font-black font-mono text-[#86868B] text-base">
                                                        {row.salidas > 0 ? `-${row.salidas.toLocaleString('es-CR')}` : <span className="text-[#424245]">-</span>}
                                                    </td>
                                                    <td className="p-6 text-right font-black font-mono">
                                                        {row.saldoDia !== 0 ? (
                                                            <span className={row.saldoDia > 0 ? 'text-white' : 'text-[#a1a1aa]'}>
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
                                                                <div className="px-3 py-1 rounded-md bg-[#18181b] border border-[#71717a] text-white text-[9px] font-semibold uppercase tracking-widest flex items-center gap-1">
                                                                    <AlertTriangle className="w-3 h-3" /> Bajo
                                                                </div>
                                                            )}
                                                            {row.isHighMovement && !row.isLowStock && (
                                                                <div className="px-3 py-1 rounded-md bg-[#18181b] border border-[#52525b] text-[#d4d4d8] text-[9px] font-semibold uppercase tracking-widest flex items-center gap-1">
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
                                                            <div className="p-8 pl-24 border-b border-[#3f3f46] relative">
                                                                <div className="absolute left-10 top-0 bottom-0 w-px bg-[#333333]" />
                                                                <h4 className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                                    <History className="w-4 h-4 text-[#a1a1aa]" />
                                                                    Documentación de Movimientos
                                                                </h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    {row.detalles.map((det) => (
                                                                        <div key={det.id} className="flex items-center justify-between p-5 rounded-lg bg-[#111112] border border-[#3f3f46] hover:border-[#71717a] transition-colors group/det">
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#18181b] border border-[#52525b] text-white">
                                                                                    {det.tipo === 'ENTRADA' ? <Package className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-white font-black text-sm uppercase tracking-tight mt-1">{det.tipo}</p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <span className="text-xl font-semibold font-mono text-white">
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
                    <div className="min-h-[380px] bg-[#0d0d0e] border border-[#27272a] rounded-xl flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
                        <div className="relative mb-7">
                            <div className="w-20 h-20 bg-[#18181b] border border-[#52525b] rounded-xl flex items-center justify-center relative z-10">
                                <History className="w-10 h-10 text-[#a1a1aa]" />
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-white">Historial sin consultar</h3>
                        <p className="text-[#a1a1aa] mt-3 max-w-md mx-auto text-sm leading-relaxed">
                            Seleccione un artículo y un rango de fechas para visualizar sus movimientos y variaciones de inventario.
                        </p>
                    </div>
                )}
            </div>
            {/* Article Search Modal (Galaxy Grid) */}
            <ArticleSearchGridModal
                isOpen={showSearchModal}
                onClose={() => setShowSearchModal(false)}
                onSelect={(article) => {
                    setSelectedArticle(article);
                    setKardexData([]);
                    setShowSearchModal(false);
                }}
                themeColor="neutral"
                title="Seleccionar artículo"
            />
        </div>
    );
}
