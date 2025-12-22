import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
    Calendar,
    Hash,
    Info,
    Search,
    ClipboardList,
    List,
    PlusCircle,
    Trash2,
    ChevronLeft,
    Save,
    Check,
    X,
    Loader2,
    AlertTriangle,
    Printer,
    History
} from 'lucide-react';
import jsPDF from 'jspdf';

interface Origen {
    id: number;
    origen: string;
}

interface Colaborador {
    identificacion: string;
    alias?: string;
    colaborador?: string;
}

interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
    marca: string;
    imagen_url: string | null;
}

interface DetalleRow {
    id: string; // temporary id for react keys
    articulo: Articulo | null;
    cantidad: number | '';
}

interface RecentEntry {
    id: string;
    timestamp: string;
    itemsCount: number;
    origen: string;
}

export default function IngresarArticulo() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data Lists
    const [origenes, setOrigenes] = useState<Origen[]>([]);
    const [autorizados, setAutorizados] = useState<Colaborador[]>([]);
    const [receptores, setReceptores] = useState<Colaborador[]>([]);
    const [articulos, setArticulos] = useState<Articulo[]>([]);

    // Form State
    const [fecha] = useState(new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }));
    const [selectedOrigen, setSelectedOrigen] = useState<Origen | null>(null);
    const [selectedAutoriza, setSelectedAutoriza] = useState<Colaborador | null>(null);
    const [selectedRecibe, setSelectedRecibe] = useState<Colaborador | null>(null);
    const [justificacion, setJustificacion] = useState('');
    const [detalles, setDetalles] = useState<DetalleRow[]>([{ id: crypto.randomUUID(), articulo: null, cantidad: '' }]);

    // Recent History State
    const [recentHistory, setRecentHistory] = useState<RecentEntry[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // Modals State
    const [modalSearchType, setModalSearchType] = useState<'origen' | 'autoriza' | 'recibe' | null>(null);
    const [showArticleModal, setShowArticleModal] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [currentDetailIndex, setCurrentDetailIndex] = useState<number | null>(null);
    const [articleSearchTerm, setArticleSearchTerm] = useState('');
    const [generalSearchTerm, setGeneralSearchTerm] = useState('');

    // Load Initial Data
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);

                // Load Origenes
                const { data: origenesData, error: origenesError } = await supabase
                    .from('origen_articulo_03')
                    .select('id, origen');
                if (origenesError) throw origenesError;
                setOrigenes(origenesData || []);

                // Load Colaboradores
                const { data: authData, error: authError } = await supabase
                    .from('colaboradores_06')
                    .select('identificacion, alias')
                    .eq('autorizado', true);
                if (authError) throw authError;
                setAutorizados(authData || []);

                const { data: recData, error: recError } = await supabase
                    .from('colaboradores_06')
                    .select('identificacion, colaborador')
                    .eq('condicion_laboral', false);
                if (recError) throw recError;
                setReceptores(recData || []);

                // Load Articulos (All - following provided logic)
                let allArticles: Articulo[] = [];
                let start = 0;
                const size = 1000;
                while (true) {
                    const { data: artData, error: artError } = await supabase
                        .from('articulo_01')
                        .select('codigo_articulo, nombre_articulo, marca, imagen_url')
                        .range(start, start + size - 1)
                        .order('codigo_articulo', { ascending: true });

                    if (artError) throw artError;
                    if (!artData || artData.length === 0) break;

                    allArticles = [...allArticles, ...artData];
                    if (artData.length < size) break;
                    start += size;
                }
                setArticulos(allArticles);

            } catch (error: any) {
                console.error('Error loading data:', error);
                alert('Error cargando datos: ' + error.message);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Filtered Lists
    const filteredGeneralList = useMemo(() => {
        const term = generalSearchTerm.toLowerCase();
        if (modalSearchType === 'origen') {
            return origenes.filter(o => o.origen.toLowerCase().includes(term));
        } else if (modalSearchType === 'autoriza') {
            return autorizados.filter(a => (a.alias || '').toLowerCase().includes(term));
        } else if (modalSearchType === 'recibe') {
            return receptores.filter(r => (r.colaborador || '').toLowerCase().includes(term));
        }
        return [];
    }, [modalSearchType, generalSearchTerm, origenes, autorizados, receptores]);

    const filteredArticles = useMemo(() => {
        const term = articleSearchTerm.toLowerCase().trim();
        if (!term) return articulos;
        return articulos.filter(a =>
            (a.nombre_articulo || '').toLowerCase().includes(term) ||
            (a.codigo_articulo || '').toLowerCase().includes(term) ||
            (a.marca || '').toLowerCase().includes(term)
        );
    }, [articleSearchTerm, articulos]);

    // Handlers
    const handleAddRow = () => {
        setDetalles([...detalles, { id: crypto.randomUUID(), articulo: null, cantidad: '' }]);
    };

    const handleRemoveRow = (index: number) => {
        const newDetalles = [...detalles];
        newDetalles.splice(index, 1);
        setDetalles(newDetalles);
    };

    const handleDetailChange = (index: number, field: keyof DetalleRow, value: any) => {
        const newDetalles = [...detalles];
        newDetalles[index] = { ...newDetalles[index], [field]: value };
        setDetalles(newDetalles);
    };

    const handleSelectGeneral = (item: any) => {
        if (modalSearchType === 'origen') setSelectedOrigen(item);
        else if (modalSearchType === 'autoriza') setSelectedAutoriza(item);
        else if (modalSearchType === 'recibe') setSelectedRecibe(item);
        setModalSearchType(null);
        setGeneralSearchTerm('');
    };

    const handleSelectArticle = (articulo: Articulo) => {
        if (currentDetailIndex !== null) {
            handleDetailChange(currentDetailIndex, 'articulo', articulo);
        }
        setShowArticleModal(false);
        setArticleSearchTerm('');
        setCurrentDetailIndex(null);
    };

    const handlePrintReceipt = (entryId: string, items: DetalleRow[], date: string) => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(16);
        doc.text('Comprobante de Entrada', 105, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.text(`ID Entrada: ${entryId}`, 20, 35);
        doc.text(`Fecha: ${date}`, 20, 40);
        doc.text(`Origen: ${selectedOrigen?.origen || '-'}`, 20, 45);
        doc.text(`Autoriza: ${selectedAutoriza?.alias || '-'}`, 20, 50);
        doc.text(`Recibe: ${selectedRecibe?.colaborador || '-'}`, 20, 55);

        // Table Header
        let y = 70;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Código', 20, y);
        doc.text('Artículo', 60, y); // Moved from 50 to 60
        doc.text('Cant.', 180, y, { align: 'right' }); // Moved from 170 to 180

        doc.line(20, y + 2, 190, y + 2);
        y += 10;

        // Items
        doc.setFont('helvetica', 'normal');
        items.forEach(item => {
            if (item.articulo) {
                const name = item.articulo.nombre_articulo.length > 45 // Reduced max length slightly
                    ? item.articulo.nombre_articulo.substring(0, 45) + '...'
                    : item.articulo.nombre_articulo;

                doc.text(item.articulo.codigo_articulo, 20, y);
                doc.text(name, 60, y); // Aligned with header
                doc.text(String(item.cantidad), 180, y, { align: 'right' }); // Aligned with header
                y += 8;
            }
        });

        // Footer
        y += 10;
        doc.line(20, y, 190, y);
        doc.setFontSize(8);
        doc.text('Generado automáticamente por Sistema SDMO', 105, y + 10, { align: 'center' });

        doc.save(`Entrada_${entryId}.pdf`);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedOrigen || !selectedAutoriza || !selectedRecibe) {
            alert('Por favor complete todos los campos de cabecera');
            return;
        }

        const validDetalles = detalles.filter(d => d.articulo && d.cantidad !== '' && Number(d.cantidad) !== 0);
        if (validDetalles.length === 0) {
            alert('Debe agregar al menos un artículo válido con cantidad distinta de cero');
            return;
        }

        const hayNegativos = validDetalles.some(d => Number(d.cantidad) < 0);
        if (hayNegativos && !justificacion.trim()) {
            alert('Cuando hay cantidades negativas (ajustes) la justificación es obligatoria.');
            return;
        }

        try {
            setSaving(true);

            // Insert Header
            const entradaData: any = {
                fecha_entrada: new Date().toISOString(),
                origen_entrada: selectedOrigen.id,
                autoriza_entrada: selectedAutoriza.identificacion,
                recibe_entrada: selectedRecibe.identificacion
            };
            if (justificacion.trim()) entradaData.justificacion = justificacion.trim();

            const { data: entrada, error: errorEntrada } = await supabase
                .from('entrada_articulo_07')
                .insert([entradaData])
                .select('id_entrada')
                .single();

            if (errorEntrada) throw errorEntrada;

            // Insert Details
            const detallesToInsert = validDetalles.map(d => ({
                id_entrada: entrada.id_entrada,
                articulo: d.articulo!.codigo_articulo,
                cantidad: Number(d.cantidad)
            }));

            const { error: errorDetalles } = await supabase
                .from('dato_entrada_12')
                .insert(detallesToInsert);

            if (errorDetalles) throw errorDetalles;

            // Add to Recent History
            const newEntry: RecentEntry = {
                id: String(entrada.id_entrada),
                timestamp: new Date().toLocaleTimeString(),
                itemsCount: validDetalles.length,
                origen: selectedOrigen.origen
            };
            setRecentHistory(prev => [newEntry, ...prev].slice(0, 5));

            // Ask to print
            if (confirm(`¡Entrada #${entrada.id_entrada} registrada exitosamente!\n¿Desea imprimir el comprobante ahora?`)) {
                handlePrintReceipt(String(entrada.id_entrada), validDetalles, new Date().toLocaleString());
            }

            // Reset form but keep history
            setDetalles([{ id: crypto.randomUUID(), articulo: null, cantidad: '' }]);
            setJustificacion('');
            setSelectedOrigen(null);
            setSelectedAutoriza(null);
            setSelectedRecibe(null);

        } catch (error: any) {
            console.error('Error saving entry:', error);
            alert('Error al guardar la entrada: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans relative p-4 md:p-8">

            <div className="relative z-10 max-w-6xl mx-auto">
                {/* Unified Header */}
                <div className="sticky top-0 z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 mb-8 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <PlusCircle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">
                                Ingresar Artículo
                            </h1>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`flex items-center gap-2 px-4 py-2 border border-slate-700 rounded-xl transition-all shadow-sm ${showHistory ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                        >
                            <History className="w-4 h-4" />
                            <span className="hidden md:inline">Historial</span>
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl hover:bg-slate-700 transition-all shadow-sm"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Regresar
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Main Form Area */}
                    <div className={`transition-all duration-300 ${showHistory ? 'lg:col-span-9' : 'lg:col-span-12'}`}>
                        <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

                            {/* Info Bar */}
                            <div className="flex flex-col md:flex-row justify-between items-center p-6 bg-slate-800 border-b border-white/5 gap-4">
                                <div className="flex items-center gap-2 text-slate-300 font-medium">
                                    <Calendar className="w-5 h-5 text-emerald-500" />
                                    {fecha}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-slate-800 border border-white/10 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                                        <Hash className="w-4 h-4 text-emerald-500" />
                                        Nuevo registro
                                    </span>
                                </div>
                            </div>

                            <div className="p-6 md:p-8">
                                <form onSubmit={handleSubmit} className="space-y-8">

                                    {/* Header Form */}
                                    <div className="bg-slate-800 rounded-2xl p-6 border border-white/10 shadow-inner">
                                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                            <Info className="w-6 h-6 text-emerald-500" />
                                            Datos de la Entrada
                                        </h2>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                            {/* Origen */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-slate-300">Origen</label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white min-h-[46px] flex items-center">
                                                        {selectedOrigen ? selectedOrigen.origen : <span className="text-slate-500">-- Seleccione --</span>}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setModalSearchType('origen'); setGeneralSearchTerm(''); }}
                                                        className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl transition-colors shadow-lg border border-white/10"
                                                    >
                                                        <Search className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Autoriza */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-slate-300">Autoriza</label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white min-h-[46px] flex items-center">
                                                        {selectedAutoriza ? selectedAutoriza.alias : <span className="text-slate-500">-- Seleccione --</span>}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setModalSearchType('autoriza'); setGeneralSearchTerm(''); }}
                                                        className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl transition-colors shadow-lg border border-white/10"
                                                    >
                                                        <Search className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Recibe */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-slate-300">Recibe</label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white min-h-[46px] flex items-center">
                                                        {selectedRecibe ? selectedRecibe.colaborador : <span className="text-slate-500">-- Seleccione --</span>}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setModalSearchType('recibe'); setGeneralSearchTerm(''); }}
                                                        className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl transition-colors shadow-lg border border-white/10"
                                                    >
                                                        <Search className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Justificacion */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                                <ClipboardList className="w-4 h-4" />
                                                Justificación
                                            </label>
                                            <textarea
                                                value={justificacion}
                                                onChange={(e) => setJustificacion(e.target.value)}
                                                maxLength={500}
                                                rows={4}
                                                placeholder="Describa el motivo. Obligatorio si hay cantidades negativas (ajuste de inventario)."
                                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-y min-h-[100px]"
                                            />
                                            <div className="flex justify-between items-start text-xs mt-1">
                                                <span className="text-slate-400 flex items-center gap-1">
                                                    <Info className="w-3 h-3" />
                                                    Un valor negativo en el detalle se interpreta como <strong>ajuste de inventario</strong>.
                                                </span>
                                                <span className={`${justificacion.length > 450 ? 'text-red-400' : 'text-slate-500'}`}>
                                                    {justificacion.length} / 500 caracteres
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details Section */}
                                    <div className="bg-slate-800 rounded-2xl p-6 border border-white/10 shadow-inner">
                                        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                <List className="w-6 h-6 text-emerald-500" />
                                                Detalle de Artículos
                                            </h2>
                                            <button
                                                type="button"
                                                onClick={handleAddRow}
                                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-semibold shadow-lg shadow-emerald-500/20 transition-all"
                                            >
                                                <PlusCircle className="w-4 h-4" />
                                                Agregar fila
                                            </button>
                                        </div>

                                        <div className="overflow-x-auto rounded-xl border border-white/10">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-800 text-slate-200">
                                                        <th className="p-4 font-bold border-b border-white/10">Artículo</th>
                                                        <th className="p-4 font-bold border-b border-white/10 w-48">
                                                            Cantidad <span className="text-xs font-normal text-slate-400 block">(negativo = ajuste)</span>
                                                        </th>
                                                        <th className="p-4 font-bold border-b border-white/10 w-24 text-center">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {detalles.map((row, index) => (
                                                        <tr key={row.id} className="hover:bg-white/5 transition-colors">
                                                            <td className="p-4">
                                                                <div className="flex gap-2">
                                                                    <div className="flex-1 bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white min-h-[42px] flex items-center">
                                                                        {row.articulo ? (
                                                                            <span className="truncate">{row.articulo.nombre_articulo}</span>
                                                                        ) : (
                                                                            <span className="text-slate-500 text-sm">-- Seleccione artículo --</span>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setCurrentDetailIndex(index); setShowArticleModal(true); setArticleSearchTerm(''); }}
                                                                        className="bg-slate-700 hover:bg-slate-600 text-white p-2.5 rounded-lg border border-white/10 transition-colors"
                                                                    >
                                                                        <Search className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <input
                                                                    type="number"
                                                                    value={row.cantidad}
                                                                    onChange={(e) => handleDetailChange(index, 'cantidad', e.target.value)}
                                                                    placeholder="Ej: 5 o -5"
                                                                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                                                />
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveRow(index)}
                                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {detalles.length === 0 && (
                                            <div className="text-center py-8 text-slate-500">
                                                No hay artículos en el detalle. Agregue una fila para comenzar.
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex justify-between items-center pt-4">
                                        <button
                                            type="button"
                                            onClick={() => navigate(-1)}
                                            className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold border border-white/10 transition-all"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                            Regresar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving || loading}
                                            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                            Guardar Entrada
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* Recent History Sidebar */}
                    {showHistory && (
                        <div className="lg:col-span-3 animate-in slide-in-from-right-4">
                            <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden h-full">
                                <div className="p-4 bg-slate-800 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        <History className="w-4 h-4 text-emerald-500" />
                                        Recientes
                                    </h3>
                                    <span className="text-xs text-slate-500">Esta sesión</span>
                                </div>
                                <div className="p-4 space-y-3">
                                    {recentHistory.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500 text-sm">
                                            No hay entradas recientes.
                                        </div>
                                    ) : (
                                        recentHistory.map((entry) => (
                                            <div key={entry.id} className="bg-slate-800/50 border border-white/5 rounded-xl p-3 hover:bg-slate-800 transition-colors group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                        #{entry.id}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500">{entry.timestamp}</span>
                                                </div>
                                                <p className="text-xs text-slate-300 mb-1 truncate" title={entry.origen}>
                                                    {entry.origen}
                                                </p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-xs text-slate-400">
                                                        {entry.itemsCount} artículo{entry.itemsCount !== 1 ? 's' : ''}
                                                    </span>
                                                    <button
                                                        onClick={() => alert('Para reimprimir, por favor use el módulo de consultas (función pendiente de implementar en historial rápido).')}
                                                        className="p-1.5 bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                        title="Reimprimir (Simulado)"
                                                    >
                                                        <Printer className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* General Search Modal */}
            {modalSearchType && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-4 bg-slate-800 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg capitalize">
                                Buscar {modalSearchType === 'origen' ? 'Origen' : modalSearchType === 'autoriza' ? 'Autorizador' : 'Receptor'}
                            </h3>
                            <button onClick={() => setModalSearchType(null)} className="text-white/70 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <input
                                type="text"
                                autoFocus
                                placeholder="Escriba para buscar..."
                                value={generalSearchTerm}
                                onChange={(e) => setGeneralSearchTerm(e.target.value)}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mb-4"
                            />
                            <div className="max-h-64 overflow-y-auto space-y-1">
                                {filteredGeneralList.map((item: any) => (
                                    <button
                                        key={item.id || item.identificacion}
                                        onClick={() => handleSelectGeneral(item)}
                                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 text-slate-200 transition-colors flex items-center justify-between group"
                                    >
                                        <span>
                                            {modalSearchType === 'origen' ? item.origen :
                                                modalSearchType === 'autoriza' ? item.alias : item.colaborador}
                                        </span>
                                        <Check className="w-4 h-4 opacity-0 group-hover:opacity-100 text-emerald-500" />
                                    </button>
                                ))}
                                {filteredGeneralList.length === 0 && (
                                    <p className="text-center text-slate-500 py-4">No se encontraron resultados</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Article Search Modal */}
            {showArticleModal && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 bg-slate-800 border-b border-white/10 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    <Search className="w-5 h-5" />
                                    Buscar Artículo
                                </h3>
                                <span className="bg-white/10 text-white text-xs px-2 py-1 rounded-full border border-white/10">
                                    {articulos.length} artículos
                                </span>
                            </div>
                            <button onClick={() => setShowArticleModal(false)} className="text-white/70 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-white/5 shrink-0 bg-slate-900">
                            <input
                                type="text"
                                autoFocus
                                placeholder="Buscar por nombre, código o marca..."
                                value={articleSearchTerm}
                                onChange={(e) => setArticleSearchTerm(e.target.value)}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                            <p className="text-xs text-slate-500 mt-2 ml-1">
                                Mostrando {filteredArticles.length} resultados
                            </p>
                        </div>

                        <div className="flex-1 overflow-hidden p-4 flex flex-col">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                    <p>Cargando artículos...</p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-auto rounded-xl border border-white/10">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800 text-slate-200 border-b border-white/10">
                                                <th className="p-4 font-semibold w-24 text-center sticky top-0 z-10 bg-slate-800 shadow-sm">Imagen</th>
                                                <th className="p-4 font-semibold sticky top-0 z-10 bg-slate-800 shadow-sm">Nombre</th>
                                                <th className="p-4 font-semibold w-40 sticky top-0 z-10 bg-slate-800 shadow-sm">Marca</th>
                                                <th className="p-4 font-semibold w-48 sticky top-0 z-10 bg-slate-800 shadow-sm">Código</th>
                                                <th className="p-4 font-semibold w-32 text-center sticky top-0 z-10 bg-slate-800 shadow-sm">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredArticles.slice(0, 100).map((art) => (
                                                <tr key={art.codigo_articulo} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-3 text-center">
                                                        <div
                                                            className="w-12 h-12 bg-slate-900 rounded-lg overflow-hidden border border-white/10 mx-auto cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all"
                                                            onDoubleClick={() => art.imagen_url && setPreviewImage(art.imagen_url)}
                                                            title="Doble clic para ampliar"
                                                        >
                                                            <img
                                                                src={art.imagen_url || 'https://via.placeholder.com/100?text=IMG'}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="text-white font-medium block text-pretty">{art.nombre_articulo}</span>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="text-slate-400 text-sm">{art.marca}</span>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="bg-slate-800 px-2 py-1 rounded text-xs border border-white/10 font-mono text-slate-300">
                                                            {art.codigo_articulo}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            onClick={() => handleSelectArticle(art)}
                                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-lg border border-white/10 shadow-sm transition-all"
                                                        >
                                                            Seleccionar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredArticles.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-12 text-slate-500">
                                                        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                                        <p>No se encontraron artículos</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    {filteredArticles.length > 100 && (
                                        <div className="p-4 text-center border-t border-white/10 bg-slate-800/30">
                                            <p className="text-slate-500 text-sm">
                                                ... y {filteredArticles.length - 100} más. Refine su búsqueda.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Image Preview Modal */}
            {previewImage && createPortal(
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors bg-white/10 p-2 rounded-full backdrop-blur-sm"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img
                            src={previewImage}
                            alt="Vista previa"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10 bg-slate-900"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
