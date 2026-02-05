import { useState, useEffect, useMemo, useCallback } from 'react';
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
    Building2,
    Shield,
    X,
    Plus
} from 'lucide-react';

import jsPDF from 'jspdf';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';
import ArticleSearchGridModal from '../components/ArticleSearchGridModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import { cn } from '../lib/utils';

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
    items?: {
        codigo: string;
        nombre: string;
        cantidad: number;
    }[];
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

    const loadRecentHistory = useCallback(async () => {
        try {
            const { data: recentEntries, error: recentError } = await supabase
                .from('entrada_articulo_07')
                .select(`
                    id_entrada,
                    fecha_entrada,
                    origen:origen_articulo_03(origen)
                `)
                .order('fecha_entrada', { ascending: false })
                .limit(5);

            if (recentError) throw recentError;

            if (recentEntries) {
                // Get detailed items for these entries
                const entryIds = recentEntries.map(e => e.id_entrada);
                const { data: detailsData, error: detailsError } = await supabase
                    .from('dato_entrada_12')
                    .select(`
                        id_entrada,
                        cantidad,
                        articulo,
                        datos_articulo:articulo_01(nombre_articulo)
                    `)
                    .in('id_entrada', entryIds);

                if (detailsError) throw detailsError;

                // Group items by entry ID
                const itemsMap = (detailsData || []).reduce((acc: any, curr: any) => {
                    if (!acc[curr.id_entrada]) acc[curr.id_entrada] = [];
                    acc[curr.id_entrada].push({
                        codigo: curr.articulo,
                        nombre: curr.datos_articulo?.nombre_articulo || 'Artículo sin nombre',
                        cantidad: curr.cantidad
                    });
                    return acc;
                }, {});

                const formatted: RecentEntry[] = recentEntries.map((e: any) => ({
                    id: String(e.id_entrada),
                    timestamp: new Date(e.fecha_entrada).toLocaleString('es-CR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    itemsCount: itemsMap[e.id_entrada]?.length || 0,
                    origen: e.origen?.origen || 'Origen Desconocido',
                    items: itemsMap[e.id_entrada] || []
                }));

                setRecentHistory(formatted);
            }
        } catch (error) {
            console.error('Error loading recent history:', error);
        }
    }, []);

    // Load Initial Data
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);

                // Load Recent History
                await loadRecentHistory();

                // Load Origenes
                const { data: origenesData, error: origenesError } = await supabase
                    .from('origen_articulo_03')
                    .select('id, origen');
                if (origenesError) throw origenesError;
                setOrigenes(origenesData || []);

                // Load Colaboradores
                const { data: colabData, error: colabError } = await supabase
                    .from('colaboradores_06')
                    .select('identificacion, alias, colaborador, autorizado, correo_colaborador');
                if (colabError) throw colabError;

                if (colabData) {
                    const formatted = colabData.map(c => ({
                        identificacion: c.identificacion,
                        alias: c.alias,
                        colaborador: c.colaborador
                    }));

                    const autorizados = colabData.filter(c => c.autorizado).map(c => ({
                        identificacion: c.identificacion,
                        alias: c.alias,
                        colaborador: c.colaborador,
                        correo: c.correo_colaborador
                    }));

                    setColaboradoresData({
                        autorizados: autorizados,
                        todos: formatted
                    });

                    // Auto-detect logged user
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user?.email) {
                        const currentUser = autorizados.find(c =>
                            c.correo?.toLowerCase() === user.email?.toLowerCase()
                        );
                        if (currentUser) {
                            setSelectedAutoriza(currentUser);
                        }
                    }
                }

            } catch (error: any) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [loadRecentHistory]);

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
                fecha_entrada: new Date().toLocaleDateString('en-CA'),
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

            alert(`¡Entrada #${entrada.id_entrada} registrada exitosamente!\nSe descargará el comprobante.`);
            handlePrintReceipt(String(entrada.id_entrada), validDetalles, new Date().toLocaleString());

            // Refresh History
            await loadRecentHistory();

            // Reset form
            setDetalles([{ id: crypto.randomUUID(), articulo: null, cantidad: '' }]);
            setJustificacion('');
            setSelectedOrigen(null);
            // selectedAutoriza is PERSISTENT for security/audit (logged user)
            setSelectedRecibe(null);

        } catch (error: any) {
            console.error('Error saving entry:', error);
            alert('Error al guardar la entrada: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7]">
            <PageHeader
                title="Ingresar Artículo"
                icon={PlusCircle}
                themeColor="blue"
            />

            <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative animate-fade-in-up">

                {/* Main Content */}
                <div className={cn("transition-all duration-300 space-y-8", showHistory ? "lg:col-span-9" : "lg:col-span-12")}>

                    {/* Header Controls */}
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-3 bg-[#121212] border border-[#333333] px-5 py-3 rounded-[8px]">
                            <Calendar className="w-5 h-5 text-[#0071E3]" />
                            <span className="text-[#F5F5F7] font-bold text-sm">{fecha}</span>
                        </div>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={cn(
                                "flex items-center gap-2 px-6 py-3 rounded-[8px] font-bold transition-all text-xs uppercase tracking-widest",
                                showHistory
                                    ? "bg-[#0071E3] text-white"
                                    : "bg-transparent border border-[#F5F5F7] text-[#F5F5F7] hover:bg-[#F5F5F7]/10"
                            )}
                        >
                            <History className="w-5 h-5" />
                            {showHistory ? 'Cerrar Historial' : 'Ver Recientes'}
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Section 1: Cabecera */}
                        <div className="bg-[#121212] border border-[#333333] rounded-[8px] p-8 space-y-8 shadow-2xl">
                            <h3 className="text-lg font-bold text-[#0071E3] flex items-center gap-2 border-b border-[#333333] pb-4 uppercase italic">
                                <Info className="w-5 h-5" />
                                Datos de la Entrada
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                                {/* Origen Selector */}
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">Origen</label>
                                    <div
                                        onClick={() => setShowOrigenModal(true)}
                                        className="group relative bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-4 cursor-pointer hover:border-[#0071E3]/50 transition-all flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Building2 className="w-5 h-5 text-[#0071E3]/50 group-hover:text-[#0071E3] transition-colors shrink-0" />
                                            <span className={cn("truncate font-bold text-sm", selectedOrigen ? "text-[#F5F5F7]" : "text-[#86868B] italic")}>
                                                {selectedOrigen ? selectedOrigen.origen : 'Seleccionar origen...'}
                                            </span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-[#86868B] group-hover:translate-x-1 transition-transform shrink-0" />
                                    </div>
                                </div>

                                {/* Autoriza Selector */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <label className="block text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">Autoriza</label>
                                        {selectedAutoriza && (
                                            <span className="text-[9px] font-bold text-[#0071E3] bg-[#0071E3]/10 px-2 py-0.5 rounded-[4px] border border-[#0071E3]/20 mb-1 flex items-center gap-1">
                                                <Shield className="w-2.5 h-2.5" />
                                                ASIGNADO: {selectedAutoriza.identificacion}
                                            </span>
                                        )}
                                    </div>
                                    <div className="bg-[#1D1D1F]/50 border border-[#333333] rounded-[8px] p-4 flex items-center gap-4 cursor-default">
                                        <div className="w-10 h-10 rounded-[8px] bg-[#0071E3]/10 flex items-center justify-center shrink-0">
                                            <Shield className="w-5 h-5 text-[#0071E3]" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className={cn("truncate font-bold text-sm", selectedAutoriza ? "text-[#F5F5F7]" : "text-[#86868B] italic")}>
                                                {selectedAutoriza ? selectedAutoriza.alias || selectedAutoriza.colaborador : 'Cargando responsable...'}
                                            </span>
                                            <span className="text-[9px] text-[#86868B] font-bold uppercase tracking-tight">Titular Responsable</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Recibe Selector */}
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">Recibe</label>
                                    <div
                                        onClick={() => {
                                            setColaboradorField('recibe');
                                            setShowColaboradorModal(true);
                                        }}
                                        className="group relative bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-4 cursor-pointer hover:border-[#0071E3]/50 transition-all flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <UserCircle className="w-5 h-5 text-[#0071E3]/50 group-hover:text-[#0071E3] transition-colors shrink-0" />
                                            <span className={cn("truncate font-bold text-sm", selectedRecibe ? "text-[#F5F5F7]" : "text-[#86868B] italic")}>
                                                {selectedRecibe ? selectedRecibe.colaborador : '¿Quién recibe?'}
                                            </span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-[#86868B] group-hover:translate-x-1 transition-transform shrink-0" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-[#0071E3]" />
                                    Justificación
                                </label>
                                <textarea
                                    value={justificacion}
                                    onChange={(e) => setJustificacion(e.target.value)}
                                    maxLength={500}
                                    rows={3}
                                    placeholder="Describa el motivo. Obligatorio si hay cantidades negativas."
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-5 text-[#F5F5F7] placeholder-[#424245] focus:border-[#0071E3]/50 outline-none transition-all font-medium text-sm"
                                />
                                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-[#86868B]">
                                    <span className="flex items-center gap-1">
                                        <Info className="w-3 h-3 text-[#0071E3]" />
                                        Valores negativos = ajuste de inventario
                                    </span>
                                    <span className={cn(justificacion.length > 450 ? "text-rose-500" : "text-[#86868B]")}>
                                        {justificacion.length} / 500
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Detalle */}
                        <div className="bg-[#121212] border border-[#333333] rounded-[8px] p-8 space-y-8 shadow-2xl">
                            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 border-b border-[#333333] pb-6">
                                <h3 className="text-lg font-bold text-[#0071E3] flex items-center gap-2 uppercase italic">
                                    <List className="w-5 h-5" />
                                    Detalle de Artículos
                                </h3>
                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    className="w-full sm:w-auto px-6 py-3 bg-transparent border border-[#0071E3] text-[#0071E3] rounded-[8px] hover:bg-[#0071E3]/10 transition-all flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest active:scale-95"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    Agregar Fila
                                </button>
                            </div>

                            <div className="space-y-4">
                                {detalles.map((row, index) => (
                                    <div
                                        key={row.id}
                                        className="bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-6 relative overflow-hidden group animate-in slide-in-from-right-4 duration-300"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-[#0071E3]" />

                                        <div className="flex flex-col md:flex-row gap-8 items-start">
                                            {/* Article Selector */}
                                            <div className="flex-1 w-full space-y-3">
                                                <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">Artículo</label>
                                                <div
                                                    onClick={() => {
                                                        setCurrentDetailIndex(index);
                                                        setShowArticleModal(true);
                                                    }}
                                                    className="bg-black/20 border border-[#424245] rounded-[8px] p-4 text-[#F5F5F7] text-sm min-h-[70px] flex items-center justify-between cursor-pointer hover:border-[#0071E3]/50 transition-all group/field"
                                                >
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="w-12 h-12 bg-[#121212] rounded-[8px] border border-[#333333] flex items-center justify-center shrink-0 overflow-hidden text-[#0071E3]/30 font-bold text-xs">
                                                            {row.articulo?.imagen_url ? (
                                                                <img src={row.articulo.imagen_url} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Search className="w-5 h-5" />
                                                            )}
                                                        </div>
                                                        <span className={cn("line-clamp-2 font-bold leading-tight text-sm", !row.articulo ? "text-[#86868B] italic" : "text-[#F5F5F7]")}>
                                                            {row.articulo ? row.articulo.nombre_articulo : 'Buscar en inventario...'}
                                                        </span>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-[#86868B] group-hover/field:translate-x-1 transition-transform" />
                                                </div>
                                            </div>

                                            {/* Quantity & Actions */}
                                            <div className="w-full md:w-auto flex gap-4 md:items-end">
                                                <div className="flex-1 md:w-40 space-y-3">
                                                    <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">Cantidad</label>
                                                    <input
                                                        type="number"
                                                        value={row.cantidad}
                                                        onChange={(e) => handleDetailChange(index, 'cantidad', e.target.value)}
                                                        className="w-full bg-black/20 border border-[#424245] rounded-[8px] p-4 text-[#F5F5F7] text-2xl font-bold focus:border-[#0071E3] outline-none transition-all text-center tabular-nums"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRow(index)}
                                                    className="p-5 bg-rose-500/10 text-rose-500 rounded-[8px] border border-rose-500/20 active:scale-95 transition-all mt-auto hover:bg-rose-500/20"
                                                >
                                                    <Trash2 className="w-6 h-6" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Metadata Row */}
                                        {row.articulo && (
                                            <div className="mt-5 pt-5 border-t border-[#333333] flex flex-wrap gap-4 items-center">
                                                <span className="text-[9px] font-bold text-[#86868B] uppercase tracking-[0.2em]">Detalles:</span>
                                                <div className="flex gap-2">
                                                    <span className="bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] px-3 py-1 rounded-[4px] text-[10px] font-bold font-mono">
                                                        {row.articulo.codigo_articulo}
                                                    </span>
                                                    <span className="bg-black/20 border border-[#333333] text-[#86868B] px-3 py-1 rounded-[4px] text-[10px] font-bold uppercase">
                                                        {row.articulo.marca || 'S/M'}
                                                    </span>
                                                    <span className="bg-black/20 border border-[#333333] text-[#86868B] px-3 py-1 rounded-[4px] text-[10px] font-bold uppercase">
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
                        <div className="flex pt-4 pb-20">
                            <button
                                type="submit"
                                disabled={saving || loading}
                                className="w-full md:w-auto md:ml-auto px-12 py-5 bg-[#0071E3] text-white font-bold rounded-[8px] hover:brightness-110 transition-all flex items-center justify-center gap-4 disabled:opacity-30 shadow-2xl active:scale-[0.98] text-xl uppercase tracking-widest"
                            >
                                {saving ? <Loader2 className="w-7 h-7 animate-spin" /> : <Save className="w-7 h-7" />}
                                <span>Procesar Entrada</span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* Recent History Sidebar */}
                {showHistory && (
                    <div className="lg:col-span-3 lg:sticky lg:top-24 h-fit animate-in slide-in-from-right-8 duration-500">
                        <div className="bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl overflow-hidden flex flex-col">
                            <div className="p-6 bg-black/20 border-b border-[#333333] flex items-center justify-between">
                                <h3 className="font-bold text-[#F5F5F7] text-xs uppercase tracking-widest flex items-center gap-2">
                                    <History className="w-4 h-4 text-[#0071E3]" />
                                    Recientes
                                </h3>
                            </div>
                            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar max-h-[calc(100vh-250px)]">
                                {recentHistory.length === 0 ? (
                                    <div className="text-center py-12 px-4 space-y-4 text-[#86868B]">
                                        <History className="w-10 h-10 mx-auto opacity-20" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                            No hay registros en esta sesión
                                        </p>
                                    </div>
                                ) : (
                                    recentHistory.map((entry) => (
                                        <div key={entry.id} className="bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-5 hover:border-[#0071E3]/30 transition-all group relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-4">
                                                <span className="font-bold text-[10px] text-[#0071E3] bg-[#0071E3]/10 px-3 py-1 rounded-[4px] border border-[#0071E3]/20 font-mono">
                                                    #{entry.id}
                                                </span>
                                                <span className="text-[9px] font-bold text-[#86868B] tabular-nums">{entry.timestamp}</span>
                                            </div>
                                            <p className="text-xs font-bold text-[#F5F5F7] mb-2 truncate uppercase italic">
                                                {entry.origen}
                                            </p>
                                            <div className="flex items-center gap-2 mt-4 text-[#86868B] mb-4">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
                                                <span className="text-[10px] font-bold uppercase tracking-tight">
                                                    {entry.itemsCount} artículo{entry.itemsCount !== 1 ? 's' : ''}
                                                </span>
                                            </div>

                                            {/* Article details peek */}
                                            {entry.items && entry.items.length > 0 && (
                                                <div className="space-y-3 pt-4 border-t border-[#333333]/50">
                                                    {entry.items.map((item, i) => (
                                                        <div key={i} className="flex flex-col gap-1">
                                                            <div className="flex justify-between items-start gap-3">
                                                                <span className="text-[10px] font-bold text-[#F5F5F7] line-clamp-2 leading-tight flex-1">
                                                                    {item.nombre}
                                                                </span>
                                                                <span className="text-[11px] font-black text-[#0071E3] tabular-nums shrink-0 bg-[#0071E3]/5 px-1.5 py-0.5 rounded">
                                                                    x{item.cantidad}
                                                                </span>
                                                            </div>
                                                            <span className="text-[9px] font-mono text-[#424245] group-hover:text-[#86868B] transition-colors">
                                                                {item.codigo}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
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

            <ArticleSearchGridModal
                isOpen={showArticleModal}
                onClose={() => {
                    setShowArticleModal(false);
                    setCurrentDetailIndex(null);
                }}
                onSelect={handleSelectArticle}
                themeColor="blue"
                title="BUSCADOR"
                showOnlyAvailable={false}
            />

            {/* Origen Search Modal */}
            {showOrigenModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#121212] border border-[#333333] rounded-[8px] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-8 border-b border-[#333333] bg-black/20">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-[#F5F5F7] uppercase tracking-widest flex items-center gap-3 italic">
                                        <Building2 className="w-6 h-6 text-[#0071E3]" />
                                        Origen
                                    </h3>
                                    <p className="text-[10px] font-bold text-[#86868B] uppercase mt-2 tracking-[0.2em]">Seleccione la procedencia</p>
                                </div>
                                <button onClick={() => setShowOrigenModal(false)} className="p-2 border border-[#333333] rounded-[8px] text-[#86868B] hover:text-[#F5F5F7] transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#424245] w-5 h-5" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Buscar origen..."
                                    value={origenSearchTerm}
                                    onChange={(e) => setOrigenSearchTerm(e.target.value)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] py-4 pl-12 pr-4 text-[#F5F5F7] placeholder-[#424245] focus:border-[#0071E3]/50 outline-none transition-all text-sm font-bold uppercase"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-black/20 custom-scrollbar">
                            {filteredOrigenes.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setSelectedOrigen(item);
                                        setShowOrigenModal(false);
                                        setOrigenSearchTerm('');
                                    }}
                                    className="w-full text-left px-6 py-5 rounded-[8px] border border-transparent hover:border-[#333333] hover:bg-[#1D1D1F] text-[#F5F5F7] transition-all flex items-center justify-between group"
                                >
                                    <span className="font-bold text-sm tracking-wide">{item.origen}</span>
                                    <ChevronRight className="w-5 h-5 text-[#424245] group-hover:text-[#0071E3] group-hover:translate-x-1 transition-all" />
                                </button>
                            ))}
                            {filteredOrigenes.length === 0 && (
                                <div className="text-center py-20 space-y-4 text-[#86868B]">
                                    <Search className="w-12 h-12 mx-auto opacity-10" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest">Sin resultados</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
