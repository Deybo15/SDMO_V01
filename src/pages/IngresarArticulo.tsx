import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    Calendar,
    Hash,
    Info,
    Search,
    ClipboardList,
    List,
    PlusCircle,
    Trash2,
    Save,
    Loader2,
    History,
    ChevronRight,
    UserCircle,
    Building2
} from 'lucide-react';


import jsPDF from 'jspdf';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';
import ArticuloSearchModal from '../components/ArticleSearchModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';

interface Origen {
    id: number;
    origen: string;
}

interface Colaborador {
    identificacion: string;
    alias?: string;
    colaborador: string;
}

interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
    marca: string;
    imagen_url: string | null;
    unidad?: string;
    cantidad_disponible?: number;
}

interface DetalleRow {
    id: string;
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
    const [colaboradoresData, setColaboradoresData] = useState<{
        autorizados: Colaborador[];
        todos: Colaborador[];
    }>({ autorizados: [], todos: [] });

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
    const [showColaboradorModal, setShowColaboradorModal] = useState(false);
    const [colaboradorField, setColaboradorField] = useState<'autoriza' | 'recibe'>('autoriza');
    const [showArticleModal, setShowArticleModal] = useState(false);
    const [showOrigenModal, setShowOrigenModal] = useState(false);
    const [currentDetailIndex, setCurrentDetailIndex] = useState<number | null>(null);
    const [origenSearchTerm, setOrigenSearchTerm] = useState('');

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
                const { data: colabData, error: colabError } = await supabase
                    .from('colaboradores_06')
                    .select('identificacion, alias, colaborador, autorizado');
                if (colabError) throw colabError;

                if (colabData) {
                    const formatted = colabData.map(c => ({
                        identificacion: c.identificacion,
                        alias: c.alias,
                        colaborador: c.colaborador
                    }));
                    setColaboradoresData({
                        autorizados: colabData.filter(c => c.autorizado).map(c => ({
                            identificacion: c.identificacion,
                            alias: c.alias,
                            colaborador: c.colaborador
                        })),
                        todos: formatted
                    });
                }

            } catch (error: any) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Filtered Lists
    const filteredOrigenes = useMemo(() => {
        const term = origenSearchTerm.toLowerCase().trim();
        if (!term) return origenes;
        return origenes.filter(o => o.origen.toLowerCase().includes(term));
    }, [origenSearchTerm, origenes]);

    // Handlers
    const handleAddRow = () => {
        setDetalles([...detalles, { id: crypto.randomUUID(), articulo: null, cantidad: '' }]);
    };

    const handleRemoveRow = (index: number) => {
        const newDetalles = [...detalles];
        newDetalles.splice(index, 1);
        setDetalles(newDetalles);
        if (newDetalles.length === 0) {
            setDetalles([{ id: crypto.randomUUID(), articulo: null, cantidad: '' }]);
        }
    };

    const handleDetailChange = (index: number, field: keyof DetalleRow, value: any) => {
        const newDetalles = [...detalles];
        newDetalles[index] = { ...newDetalles[index], [field]: value };
        setDetalles(newDetalles);
    };

    const handleSelectArticle = (articulo: any) => {
        if (currentDetailIndex !== null) {
            handleDetailChange(currentDetailIndex, 'articulo', articulo);
        }
        setShowArticleModal(false);
        setCurrentDetailIndex(null);
    };

    const handlePrintReceipt = (entryId: string, items: DetalleRow[], date: string) => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Comprobante de Entrada', 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`ID Entrada: ${entryId}`, 20, 35);
        doc.text(`Fecha: ${date}`, 20, 40);
        doc.text(`Origen: ${selectedOrigen?.origen || '-'}`, 20, 45);
        doc.text(`Autoriza: ${selectedAutoriza?.alias || '-'}`, 20, 50);
        doc.text(`Recibe: ${selectedRecibe?.colaborador || '-'}`, 20, 55);

        let y = 70;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Código', 20, y);
        doc.text('Artículo', 60, y);
        doc.text('Cant.', 180, y, { align: 'right' });
        doc.line(20, y + 2, 190, y + 2);
        y += 10;

        doc.setFont('helvetica', 'normal');
        items.forEach(item => {
            if (item.articulo) {
                const name = item.articulo.nombre_articulo.length > 45
                    ? item.articulo.nombre_articulo.substring(0, 45) + '...'
                    : item.articulo.nombre_articulo;
                doc.text(item.articulo.codigo_articulo, 20, y);
                doc.text(name, 60, y);
                doc.text(String(item.cantidad), 180, y, { align: 'right' });
                y += 8;
            }
        });

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

            alert(`¡Entrada #${entrada.id_entrada} registrada exitosamente!\nSe descargará el comprobante.`);
            handlePrintReceipt(String(entrada.id_entrada), validDetalles, new Date().toLocaleString());

            // Reset form
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
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8">
            <PageHeader
                title="Ingresar Artículo"
                icon={PlusCircle}
                themeColor="emerald"
            />

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 relative">

                {/* Main Content */}
                <div className={`transition-all duration-300 ${showHistory ? 'lg:col-span-9' : 'lg:col-span-12'} space-y-6`}>

                    {/* Header Controls */}
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                            <Calendar className="w-5 h-5 text-emerald-400" />
                            <span className="text-gray-300 font-medium">{fecha}</span>
                        </div>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg ${showHistory
                                ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                : 'bg-[#1e2235] text-gray-400 border border-white/10 hover:bg-[#252a41]'
                                }`}
                        >
                            <History className="w-5 h-5" />
                            {showHistory ? 'Cerrar Historial' : 'Ver Recientes'}
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Section 1: Cabecera */}
                        <div className="bg-[#1e2235] border border-white/10 rounded-2xl shadow-xl overflow-hidden p-6 md:p-8">
                            <h3 className="text-lg font-bold text-emerald-400 mb-6 flex items-center gap-2 border-b border-white/10 pb-3">
                                <Info className="w-5 h-5" />
                                Datos de la Entrada
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                {/* Origen Selector */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-black text-gray-500 uppercase tracking-widest">Origen</label>
                                    <div
                                        onClick={() => setShowOrigenModal(true)}
                                        className="group relative bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/10 hover:border-emerald-500/30 transition-all flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Building2 className="w-5 h-5 text-emerald-500/50 group-hover:text-emerald-400 transition-colors shrink-0" />
                                            <span className={`truncate font-bold ${selectedOrigen ? 'text-white' : 'text-gray-500 italic'}`}>
                                                {selectedOrigen ? selectedOrigen.origen : 'Seleccionar origen...'}
                                            </span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-600 group-hover:translate-x-1 transition-transform shrink-0" />
                                    </div>
                                </div>

                                {/* Autoriza Selector */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-black text-gray-500 uppercase tracking-widest">Autoriza</label>
                                    <div
                                        onClick={() => {
                                            setColaboradorField('autoriza');
                                            setShowColaboradorModal(true);
                                        }}
                                        className="group relative bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/10 hover:border-emerald-500/30 transition-all flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <UserCircle className="w-5 h-5 text-emerald-500/50 group-hover:text-emerald-400 transition-colors shrink-0" />
                                            <span className={`truncate font-bold ${selectedAutoriza ? 'text-white' : 'text-gray-500 italic'}`}>
                                                {selectedAutoriza ? selectedAutoriza.alias || selectedAutoriza.colaborador : '¿Quién autoriza?'}
                                            </span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-600 group-hover:translate-x-1 transition-transform shrink-0" />
                                    </div>
                                </div>

                                {/* Recibe Selector */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-black text-gray-500 uppercase tracking-widest">Recibe</label>
                                    <div
                                        onClick={() => {
                                            setColaboradorField('recibe');
                                            setShowColaboradorModal(true);
                                        }}
                                        className="group relative bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/10 hover:border-emerald-500/30 transition-all flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <UserCircle className="w-5 h-5 text-emerald-500/50 group-hover:text-emerald-400 transition-colors shrink-0" />
                                            <span className={`truncate font-bold ${selectedRecibe ? 'text-white' : 'text-gray-500 italic'}`}>
                                                {selectedRecibe ? selectedRecibe.colaborador : '¿Quién recibe?'}
                                            </span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-600 group-hover:translate-x-1 transition-transform shrink-0" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4" />
                                    Justificación
                                </label>
                                <textarea
                                    value={justificacion}
                                    onChange={(e) => setJustificacion(e.target.value)}
                                    maxLength={500}
                                    rows={3}
                                    placeholder="Describa el motivo. Obligatorio si hay cantidades negativas (ajuste de inventario)."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 focus:border-emerald-500 outline-none transition-all focus:ring-4 focus:ring-emerald-500/5 min-h-[100px] shadow-inner"
                                />
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tighter">
                                    <span className="text-gray-500 flex items-center gap-1">
                                        <Info className="w-3 h-3" />
                                        Valores negativos = ajuste de inventario
                                    </span>
                                    <span className={justificacion.length > 450 ? 'text-red-400' : 'text-gray-500'}>
                                        {justificacion.length} / 500
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Detalle */}
                        <div className="bg-[#1e2235] border border-white/10 rounded-2xl shadow-xl overflow-hidden p-6 md:p-8">
                            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 border-b border-white/10 pb-4">
                                <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                                    <List className="w-5 h-5" />
                                    Detalle de Artículos
                                </h3>
                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    className="w-full sm:w-auto px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black rounded-xl transition-all flex items-center justify-center gap-2 group active:scale-95 shadow-lg shadow-emerald-500/5"
                                >
                                    <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                    Agregar Fila
                                </button>
                            </div>

                            <div className="space-y-4">
                                {detalles.map((row, index) => (
                                    <div
                                        key={row.id}
                                        className="bg-[#151921] border border-white/5 rounded-2xl p-5 relative overflow-hidden group animate-in slide-in-from-right-4 duration-300 shadow-lg"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500/50" />

                                        <div className="flex flex-col md:flex-row gap-6 items-start">
                                            {/* Article Selector */}
                                            <div className="flex-1 w-full space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Artículo</label>
                                                <div
                                                    onClick={() => {
                                                        setCurrentDetailIndex(index);
                                                        setShowArticleModal(true);
                                                    }}
                                                    className="bg-black/40 border border-white/10 rounded-xl p-4 text-white text-sm min-h-[60px] flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all group/field shadow-inner"
                                                >
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="w-10 h-10 bg-[#1e2235] rounded-lg border border-white/10 flex items-center justify-center shrink-0 overflow-hidden text-emerald-400/30 font-bold text-xs uppercase">
                                                            {row.articulo?.imagen_url ? (
                                                                <img src={row.articulo.imagen_url} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Search className="w-5 h-5" />
                                                            )}
                                                        </div>
                                                        <span className={`line-clamp-2 font-bold leading-tight ${!row.articulo ? 'text-gray-600 italic' : 'text-white'}`}>
                                                            {row.articulo ? row.articulo.nombre_articulo : 'Buscar en inventario...'}
                                                        </span>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover/field:translate-x-1 transition-transform" />
                                                </div>
                                            </div>

                                            {/* Quantity & Actions */}
                                            <div className="w-full md:w-auto flex gap-4 md:items-end">
                                                <div className="flex-1 md:w-40 space-y-2">
                                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Cantidad</label>
                                                    <input
                                                        type="number"
                                                        value={row.cantidad}
                                                        onChange={(e) => handleDetailChange(index, 'cantidad', e.target.value)}
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-xl font-black focus:border-emerald-500 outline-none transition-all shadow-inner text-center"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRow(index)}
                                                    className="p-4 bg-red-400/10 text-red-400 rounded-xl active:scale-95 transition-all mt-auto shadow-lg shadow-red-400/5 hover:bg-red-400/20"
                                                >
                                                    <Trash2 className="w-6 h-6" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Metadata Row */}
                                        {row.articulo && (
                                            <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-4 items-center">
                                                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Detalles:</span>
                                                <div className="flex gap-2">
                                                    <span className="bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 px-3 py-1 rounded-lg text-xs font-bold font-mono">
                                                        {row.articulo.codigo_articulo}
                                                    </span>
                                                    <span className="bg-white/5 border border-white/10 text-gray-400 px-3 py-1 rounded-lg text-xs font-bold uppercase">
                                                        {row.articulo.marca || 'S/M'}
                                                    </span>
                                                    <span className="bg-white/5 border border-white/10 text-gray-400 px-3 py-1 rounded-lg text-xs font-bold uppercase">
                                                        {row.articulo.unidad || 'UND'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Form Submit */}
                        <div className="flex pt-4">
                            <button
                                type="submit"
                                disabled={saving || loading}
                                className="w-full md:w-auto md:ml-auto px-10 py-5 bg-gradient-to-r from-emerald-600 to-emerald-400 text-white font-black rounded-2xl hover:brightness-110 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-emerald-500/20 active:scale-95"
                            >
                                {saving ? <Loader2 className="w-7 h-7 animate-spin" /> : <Save className="w-7 h-7" />}
                                <span className="text-xl">Procesar Entrada</span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* Recent History Sidebar */}
                {showHistory && (
                    <div className="lg:col-span-3 lg:sticky lg:top-24 h-fit animate-in slide-in-from-right-8 duration-500">
                        <div className="bg-[#1e2235] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                            <div className="p-5 bg-white/5 border-b border-white/10 flex items-center justify-between">
                                <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
                                    <History className="w-4 h-4 text-emerald-400" />
                                    Recientes
                                </h3>
                                <Hash className="w-4 h-4 text-gray-600" />
                            </div>
                            <div className="p-4 space-y-3">
                                {recentHistory.length === 0 ? (
                                    <div className="text-center py-12 px-4 space-y-4">
                                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                            <History className="w-6 h-6 text-gray-700" />
                                        </div>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                                            No hay entradas registradas en esta sesión
                                        </p>
                                    </div>
                                ) : (
                                    recentHistory.map((entry) => (
                                        <div key={entry.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all group relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="font-black text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/20">
                                                    #{entry.id}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-600 tabular-nums">{entry.timestamp}</span>
                                            </div>
                                            <p className="text-sm font-bold text-white mb-1 truncate leading-tight">
                                                {entry.origen}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-3">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">
                                                    {entry.itemsCount} artículo{entry.itemsCount !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div className="absolute top-0 right-0 w-0.5 h-full bg-emerald-500/0 group-hover:bg-emerald-500/50 transition-colors" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <ColaboradorSearchModal
                isOpen={showColaboradorModal}
                onClose={() => setShowColaboradorModal(false)}
                onSelect={(c) => {
                    if (colaboradorField === 'autoriza') setSelectedAutoriza(c);
                    else setSelectedRecibe(c);
                    setShowColaboradorModal(false);
                }}
                colaboradores={colaboradorField === 'autoriza' ? colaboradoresData.autorizados : colaboradoresData.todos}
                title={`Seleccionar ${colaboradorField === 'autoriza' ? 'Responsable que Autoriza' : 'Persona que Recibe'}`}
            />

            <ArticuloSearchModal
                isOpen={showArticleModal}
                onClose={() => {
                    setShowArticleModal(false);
                    setCurrentDetailIndex(null);
                }}
                onSelect={handleSelectArticle}
                themeColor="emerald"
                showOnlyAvailable={false}
            />

            {/* Origen Search Modal */}
            {showOrigenModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#1e2235] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-emerald-400" />
                                    Origen
                                </h3>
                                <p className="text-[10px] font-bold text-gray-500 uppercase mt-1 tracking-widest">Seleccione la procedencia</p>
                            </div>
                            <button onClick={() => setShowOrigenModal(false)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                                <Search className="w-6 h-6 rotate-90" />
                            </button>
                        </div>
                        <div className="p-6 border-b border-white/5 bg-[#1a1d29]">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 w-5 h-5" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Buscar origen..."
                                    value={origenSearchTerm}
                                    onChange={(e) => setOrigenSearchTerm(e.target.value)}
                                    className="w-full bg-[#0f111a] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all text-lg font-bold"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0f111a]/50 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {filteredOrigenes.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setSelectedOrigen(item);
                                        setShowOrigenModal(false);
                                        setOrigenSearchTerm('');
                                    }}
                                    className="w-full text-left px-5 py-4 rounded-xl border border-white/5 hover:border-emerald-500/50 hover:bg-white/5 text-gray-300 hover:text-white transition-all flex items-center justify-between group"
                                >
                                    <span className="font-bold">{item.origen}</span>
                                    <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                                </button>
                            ))}
                            {filteredOrigenes.length === 0 && (
                                <div className="text-center py-12 space-y-4">
                                    <Search className="w-12 h-12 text-gray-800 mx-auto opacity-50" />
                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No se encontraron resultados</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
