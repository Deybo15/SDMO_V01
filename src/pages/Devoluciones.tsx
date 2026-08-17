import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    RotateCcw,
    Search,
    List,
    Eraser,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    Info,
    Undo2,
    Check,
    X,
    PackageOpen,
    ArrowRight,
    AlertCircle,
    Hash,
    ChevronRight,
    MessageSquare,
    Barcode,
    ArrowLeft
} from 'lucide-react';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';

interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
    marca: string;
    unidad: string;
    imagen_url: string | null;
}

interface SalidaItem {
    id_salida: number;
    cantidad: number;
    articulo: string;
    precio_unitario: number;
    subtotal: number;
    fecha_registro: string;
    registro_salida: number;
    articulo_01: Articulo;
}

export default function Devoluciones() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [resultados, setResultados] = useState<SalidaItem[]>([]);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null);

    // Modal/Form State
    const [selectedItem, setSelectedItem] = useState<SalidaItem | null>(null);
    const [cantidadDev, setCantidadDev] = useState<string>('');
    const [motivoDev, setMotivoDev] = useState<string>('');
    const [otroMotivo, setOtroMotivo] = useState<string>('');

    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Theme Color
    const themeColor = 'neutral';

    // Clear feedback after 5 seconds
    useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => setFeedback(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    const buscarSalida = async () => {
        if (!searchTerm.trim()) {
            setFeedback({ type: 'warning', message: 'Por favor, ingrese un número de salida' });
            return;
        }

        setSearching(true);
        setFeedback(null);
        setResultados([]);
        setSelectedItem(null);

        try {
            const { data: salidaData, error: salidaError } = await supabase
                .from('dato_salida_13')
                .select('id_salida, cantidad, articulo, precio_unitario, subtotal, fecha_registro, registro_salida')
                .eq('id_salida', parseInt(searchTerm))
                .order('articulo');

            if (salidaError) throw salidaError;

            if (!salidaData || salidaData.length === 0) {
                setFeedback({ type: 'warning', message: `No se encontraron salidas con ID #${searchTerm}` });
                return;
            }

            const codigosArticulos = [...new Set(salidaData.map(item => item.articulo))];
            const { data: articulosData, error: articulosError } = await supabase
                .from('articulo_01')
                .select('codigo_articulo, nombre_articulo, marca, unidad, imagen_url')
                .in('codigo_articulo', codigosArticulos);

            if (articulosError) throw articulosError;

            const resultadosCombinados = salidaData.map(salida => {
                const articulo = articulosData?.find(art => art.codigo_articulo === salida.articulo) || {
                    codigo_articulo: salida.articulo,
                    nombre_articulo: `Artículo ${salida.articulo}`,
                    marca: 'N/A',
                    unidad: 'unid',
                    imagen_url: null
                };

                return {
                    ...salida,
                    articulo_01: articulo
                };
            });

            setResultados(resultadosCombinados);

        } catch (error: any) {
            console.error('Error:', error);
            setFeedback({ type: 'error', message: 'Error: ' + error.message });
        } finally {
            setSearching(false);
        }
    };

    const handleSelect = (item: SalidaItem) => {
        setSelectedItem(item);
        setCantidadDev('');
        setMotivoDev('');
        setOtroMotivo('');
        setShowConfirmModal(false);
    };

    const validateAndConfirm = () => {
        if (!selectedItem) return;

        const cantidad = parseFloat(cantidadDev);
        const motivoFinal = motivoDev === 'Otros' ? otroMotivo : motivoDev;

        if (!cantidad || cantidad <= 0) {
            setFeedback({ type: 'warning', message: 'Ingrese una cantidad válida mayor a 0' });
            return;
        }

        if (cantidad > selectedItem.cantidad) {
            setFeedback({ type: 'warning', message: `La cantidad no puede ser mayor a ${selectedItem.cantidad}` });
            return;
        }

        if (!motivoFinal.trim()) {
            setFeedback({ type: 'warning', message: 'Seleccione o especifique un motivo' });
            return;
        }

        setShowConfirmModal(true);
    };

    const procesarDevolucion = async () => {
        if (!selectedItem) return;

        const cantidad = parseFloat(cantidadDev);
        const motivoFinal = motivoDev === 'Otros' ? otroMotivo : motivoDev;

        setLoading(true);
        setShowConfirmModal(false);

        try {
            // 1. Verify current quantity
            const { data: salidaActual, error: errorConsulta } = await supabase
                .from('dato_salida_13')
                .select('cantidad, precio_unitario')
                .eq('id_salida', selectedItem.id_salida)
                .eq('articulo', selectedItem.articulo)
                .single();

            if (errorConsulta) throw new Error('Error al consultar salida: ' + errorConsulta.message);

            if (cantidad > (salidaActual?.cantidad || 0)) {
                throw new Error(`La cantidad a devolver (${cantidad}) es mayor que la cantidad disponible (${salidaActual?.cantidad || 0})`);
            }

            // 2. Insert Master Record
            const { data: dataMaestro, error: errorMaestro } = await supabase
                .from('devolucion_articulo_09')
                .insert({
                    id_salida: selectedItem.id_salida,
                    motivo: motivoFinal,
                    fecha_devolucion: new Date().toLocaleDateString('en-CA')
                })
                .select('id_devolucion')
                .single();

            if (errorMaestro) throw new Error('Error en tabla maestro: ' + errorMaestro.message);

            // 3. Insert Detail Record
            const { error: errorDetalle } = await supabase
                .from('dato_devolucion_14')
                .insert({
                    id_devolucion: dataMaestro.id_devolucion,
                    articulo: selectedItem.articulo,
                    cantidad: cantidad
                });

            if (errorDetalle) {
                await supabase.from('devolucion_articulo_09').delete().eq('id_devolucion', dataMaestro.id_devolucion);
                throw new Error('Error en tabla detalle: ' + errorDetalle.message);
            }

            // 4. Update Inventory (dato_salida_13)
            const nuevaCantidad = salidaActual.cantidad - cantidad;
            const nuevoSubtotal = nuevaCantidad * salidaActual.precio_unitario;

            const { error: errorUpdate } = await supabase
                .from('dato_salida_13')
                .update({
                    cantidad: nuevaCantidad,
                    subtotal: nuevoSubtotal
                })
                .eq('id_salida', selectedItem.id_salida)
                .eq('articulo', selectedItem.articulo);

            if (errorUpdate) throw new Error('Error al actualizar inventario: ' + errorUpdate.message);

            setFeedback({ type: 'success', message: '¡Éxito! Devolución registrada correctamente' });
            setSelectedItem(null);
            buscarSalida(); // Refresh list

        } catch (error: any) {
            console.error('Error:', error);
            setFeedback({ type: 'error', message: 'Error al procesar: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(amount);
    };

    return (
        <div className="min-h-screen bg-black p-4 md:p-8 text-[#f4f4f5] selection:bg-white/20 relative overflow-hidden">
            <div className="max-w-[1536px] mx-auto space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-5">
                    <PageHeader
                        title="Devolución de material"
                        icon={RotateCcw}
                        themeColor={themeColor}
                        subtitle="Retorno de materiales al inventario desde salidas registradas."
                    />
                    <button
                        onClick={() => navigate(-1)}
                        className="h-12 px-6 rounded-lg bg-[#111112] border border-[#52525b] flex items-center gap-3 text-[#d4d4d8] hover:text-white hover:bg-[#18181b] transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-semibold">Regresar</span>
                    </button>
                </div>

                {/* Status Float Messages */}
                {feedback && (
                    <div className="fixed top-8 right-8 z-[100] max-w-md px-6 py-4 rounded-lg shadow-2xl backdrop-blur-xl border border-[#71717a] bg-[#111112] text-[#d4d4d8] animate-in slide-in-from-right-4 flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-[#18181b] shrink-0">
                            {feedback.type === 'error' ? <AlertCircle className="w-5 h-5 text-white" /> :
                                feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-white" /> :
                                    <Info className="w-5 h-5 text-white" />}
                        </div>
                        <span className="text-sm leading-relaxed">{feedback.message}</span>
                    </div>
                )}

                {/* Search Bar Section */}
                <div className="bg-[#0d0d0e] p-6 border border-[#3f3f46] rounded-xl">
                    <div className="space-y-1 mb-5">
                        <h2 className="text-lg font-semibold text-white">Buscar salida registrada</h2>
                        <p className="text-sm text-[#a1a1aa]">Ingrese el número de salida que contiene los materiales por devolver.</p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group/input">
                            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                                <Hash className="w-5 h-5 text-[#71717a]" />
                            </div>
                            <input
                                type="number"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && buscarSalida()}
                                placeholder="ID de salida (ej: 8639)"
                                className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg pl-16 pr-6 text-white text-base font-mono placeholder-[#52525b] focus:outline-none focus:border-[#a1a1aa] transition-colors"
                            />
                        </div>
                        <button
                            onClick={buscarSalida}
                            disabled={searching}
                            className="px-8 h-14 bg-[#e4e4e7] hover:bg-white text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.99] group/btn"
                        >
                            {searching ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Search className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                            )}
                            <span className="text-sm">Consultar</span>
                        </button>
                        {resultados.length > 0 && (
                            <button
                                onClick={() => { setSearchTerm(''); setResultados([]); setFeedback(null); setSelectedItem(null); }}
                                className="w-14 h-14 bg-[#111112] border border-[#52525b] text-[#d4d4d8] hover:text-white hover:bg-[#18181b] rounded-lg transition-colors flex items-center justify-center"
                                title="Limpiar búsqueda"
                            >
                                <Eraser className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="space-y-6">
                    {searching ? (
                        <div className="py-24 flex flex-col items-center justify-center space-y-5 text-[#71717a]">
                            <div className="relative">
                                <Loader2 className="w-10 h-10 animate-spin text-white relative z-10" />
                            </div>
                            <p className="text-sm animate-pulse">Consultando la salida...</p>
                        </div>
                    ) : resultados.length > 0 ? (
                        <>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                                <h3 className="text-white font-semibold flex items-center gap-3 text-xl">
                                    <List className="w-6 h-6 text-[#d4d4d8]" />
                                    Artículos encontrados
                                    <span className="text-[#a1a1aa] text-sm font-mono">({resultados.length})</span>
                                </h3>
                                <div className="flex items-center gap-3 bg-[#111112] border border-[#3f3f46] px-4 py-2 rounded-lg">
                                    <span className="text-xs text-[#a1a1aa]">Salida consultada</span>
                                    <span className="text-sm font-mono text-white">#{searchTerm}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {resultados.map((item, index) => (
                                    <div
                                        key={item.articulo}
                                        className="bg-[#0d0d0e] p-6 border border-[#3f3f46] rounded-xl relative overflow-hidden group animate-in fade-in slide-in-from-bottom-4 duration-500 hover:border-[#71717a] transition-colors"
                                        style={{ animationDelay: `${index * 80}ms` }}
                                    >
                                        <div className="flex flex-col lg:flex-row gap-8 items-center">
                                            {/* Article Image Container */}
                                            <div className="w-24 h-24 bg-black rounded-lg border border-[#3f3f46] overflow-hidden shrink-0">
                                                <img
                                                    src={item.articulo_01.imagen_url || 'https://via.placeholder.com/150?text=No+Img'}
                                                    alt={item.articulo_01.nombre_articulo}
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>

                                            {/* Info Grid */}
                                            <div className="flex-1 w-full space-y-6">
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                    <div>
                                                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#18181b] border border-[#52525b] text-[#d4d4d8] font-mono text-xs mb-2">
                                                            <Barcode className="w-3 h-3" />
                                                            {item.articulo_01.codigo_articulo}
                                                        </span>
                                                        <h4 className="text-white font-semibold text-lg leading-snug">
                                                            {item.articulo_01.nombre_articulo}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-3">
                                                            <span className="text-[#a1a1aa] text-xs">{item.articulo_01.marca || 'Genérico'}</span>
                                                            <span className="w-1 h-1 rounded-full bg-[#333333]" />
                                                            <span className="text-[#a1a1aa] text-xs uppercase">{item.articulo_01.unidad}</span>
                                                        </div>
                                                    </div>

                                                    {/* Right Stats (Subtotal) */}
                                                    <div className="text-right hidden md:block">
                                                        <p className="text-[#a1a1aa] text-xs mb-1">Subtotal de salida</p>
                                                        <p className="text-lg font-mono font-semibold text-white">{formatCurrency(item.subtotal)}</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 p-5 bg-black rounded-lg border border-[#27272a]">
                                                    <div className="space-y-1">
                                                        <span className="text-[#a1a1aa] text-xs block">Cantidad entregada</span>
                                                        <span className="text-2xl font-semibold text-white">{item.cantidad}</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[#a1a1aa] text-xs block">Precio unitario</span>
                                                        <span className="text-base text-[#d4d4d8] font-mono">{formatCurrency(item.precio_unitario)}</span>
                                                    </div>
                                                    <div className="space-y-1 lg:col-span-1 md:hidden">
                                                        <span className="text-[#a1a1aa] text-xs block">Subtotal</span>
                                                        <span className="text-lg font-semibold text-white">{formatCurrency(item.subtotal)}</span>
                                                    </div>
                                                    {/* Space for the button on LG */}
                                                    <div className="lg:col-span-2 flex items-center justify-end">
                                                        <button
                                                            onClick={() => handleSelect(item)}
                                                            className="w-full lg:w-auto px-7 h-12 bg-[#e4e4e7] hover:bg-white text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-3 active:scale-[0.99] group/itembtn"
                                                        >
                                                            <span className="text-sm">Iniciar devolución</span>
                                                            <RotateCcw className="w-5 h-5 group-hover/itembtn:rotate-180 transition-transform duration-500" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl py-24 flex flex-col items-center justify-center text-center">
                            <div className="relative mb-8">
                                <div className="w-20 h-20 bg-[#18181b] border border-[#52525b] rounded-xl flex items-center justify-center">
                                    <PackageOpen className="w-10 h-10 text-[#a1a1aa]" />
                                </div>
                            </div>
                            <h3 className="text-lg font-semibold text-white">Esperando una salida</h3>
                            <p className="text-[#a1a1aa] mt-2 max-w-md mx-auto text-sm leading-relaxed">
                                Ingrese el identificador de una salida registrada para procesar el retorno de materiales al inventario general.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* PROCESS MODAL */}
            {selectedItem && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-[#0d0d0e] w-full h-full md:h-auto md:max-w-2xl shadow-2xl border border-[#3f3f46] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 rounded-xl">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-[#27272a] flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-[#18181b] border border-[#52525b] rounded-lg flex items-center justify-center">
                                    <RotateCcw className="w-6 h-6 text-[#d4d4d8]" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white leading-tight">Configurar devolución</h3>
                                    <p className="text-[#a1a1aa] text-sm mt-1 flex items-center gap-2">
                                        Salida #{selectedItem.id_salida}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-3 bg-[#111112] border border-[#52525b] rounded-lg text-[#a1a1aa] hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                            {/* Selected Item Detail */}
                            <div className="bg-black rounded-lg p-5 flex gap-5 items-center border border-[#27272a]">
                                <div className="w-16 h-16 bg-[#1D1D1F] rounded-[8px] overflow-hidden shrink-0 border border-[#333333]">
                                    <img
                                        src={selectedItem.articulo_01.imagen_url || ''}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-semibold text-white text-base truncate">{selectedItem.articulo_01.nombre_articulo}</h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-[#d4d4d8] px-2 py-1 rounded-md bg-[#18181b] border border-[#52525b] font-mono">{selectedItem.articulo}</span>
                                        <span className="w-1 h-1 rounded-full bg-[#333333]" />
                                        <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">{selectedItem.articulo_01.marca}</span>
                                    </div>
                                    <div className="mt-3">
                                        <div className="px-3 py-1.5 rounded-md bg-[#18181b] border border-[#52525b] inline-block">
                                            <p className="text-xs text-white">
                                                Disponible: {selectedItem.cantidad} {selectedItem.articulo_01.unidad}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Inputs Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] block">Cantidad a devolver</label>
                                    <div className="relative group/num">
                                        <input
                                            type="number"
                                            value={cantidadDev}
                                            onChange={(e) => setCantidadDev(e.target.value)}
                                            onWheel={(e) => e.currentTarget.blur()}
                                            placeholder="0"
                                            className={`w-full h-16 bg-[#111112] border rounded-lg px-5 text-white text-2xl font-semibold placeholder:text-[#52525b] focus:outline-none transition-colors
                                                ${parseFloat(cantidadDev) > selectedItem.cantidad
                                                    ? 'border-white ring-1 ring-white text-white'
                                                    : 'border-[#3f3f46] focus:border-[#a1a1aa]'
                                                }
                                            `}
                                            autoFocus
                                        />
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col items-center">
                                            <span className="text-[#86868B] font-black text-[10px] uppercase tracking-widest bg-white/5 px-2 py-1 rounded-[4px]">
                                                {selectedItem.articulo_01.unidad}
                                            </span>
                                        </div>
                                    </div>
                                    {parseFloat(cantidadDev) > selectedItem.cantidad && (
                                        <p className="text-xs font-semibold text-white ml-1 animate-in fade-in slide-in-from-top-1">
                                            ⚠️ Excede el disponible ({selectedItem.cantidad})
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] block">Motivo principal</label>
                                    <div className="relative">
                                        <select
                                            value={motivoDev}
                                            onChange={(e) => setMotivoDev(e.target.value)}
                                            className="w-full h-16 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white text-sm outline-none cursor-pointer appearance-none focus:border-[#a1a1aa] pr-12 transition-colors"
                                        >
                                            <option value="" disabled className="bg-[#121212]">-- SELECCIONE --</option>
                                            <option value="Material en exceso" className="bg-[#121212]">Material en exceso</option>
                                            <option value="Material defectuoso" className="bg-[#121212]">Material defectuoso</option>
                                            <option value="Cambio en proyecto" className="bg-[#121212]">Cambio en proyecto</option>
                                            <option value="Material no utilizado" className="bg-[#121212]">Material no utilizado</option>
                                            <option value="Error en salida" className="bg-[#121212]">Error en salida</option>
                                            <option value="Otros" className="bg-[#121212]">Otros (Especificar)</option>
                                        </select>
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none p-1 bg-white/5 rounded-[4px]">
                                            <ChevronRight className="w-4 h-4 text-[#d4d4d8] rotate-90" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {motivoDev === 'Otros' && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <label className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] block flex items-center gap-3">
                                        <MessageSquare className="w-4 h-4 text-[#d4d4d8]" />
                                        Especificaciones del Ajuste
                                    </label>
                                    <textarea
                                        value={otroMotivo}
                                        onChange={(e) => setOtroMotivo(e.target.value)}
                                        placeholder="Describa el motivo detalladamente..."
                                        className="w-full bg-[#111112] border border-[#3f3f46] rounded-lg p-5 text-white placeholder-[#52525b] outline-none focus:border-[#a1a1aa] min-h-[120px] transition-colors resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-[#27272a] flex flex-col md:flex-row gap-4 shrink-0">
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="flex-1 h-12 bg-[#111112] border border-[#52525b] text-[#d4d4d8] hover:text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                                Cancelar Operación
                            </button>
                            <button
                                onClick={validateAndConfirm}
                                disabled={!cantidadDev || parseFloat(cantidadDev) <= 0 || parseFloat(cantidadDev) > selectedItem.cantidad || !motivoDev}
                                className={`flex-1 h-12 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-3 group/valid
                                    ${(!cantidadDev || parseFloat(cantidadDev) <= 0 || parseFloat(cantidadDev) > selectedItem.cantidad || !motivoDev)
                                        ? 'bg-[#18181b] text-[#71717a] border border-[#3f3f46] opacity-60 cursor-not-allowed'
                                        : 'bg-[#e4e4e7] text-black hover:bg-white active:scale-[0.99]'
                                    }
                                `}
                            >
                                <span>Verificar y continuar</span>
                                <ArrowRight className="w-5 h-5 group-hover/valid:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION SUB-MODAL */}
            {showConfirmModal && selectedItem && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-500 p-8 relative">
                        <div className="text-center relative z-10">
                            <div className="w-16 h-16 bg-[#18181b] text-white border border-[#52525b] rounded-xl flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">¿Confirmar devolución?</h3>

                            <div className="space-y-6 mb-8 mt-6">
                                <div className="p-5 bg-black rounded-lg border border-[#27272a]">
                                    <p className="text-[#a1a1aa] text-sm leading-relaxed">
                                        Se devolverán <span className="text-white font-semibold">{cantidadDev} {selectedItem.articulo_01.unidad}</span> de <span className="text-white font-semibold">{selectedItem.articulo_01.nombre_articulo}</span>.
                                    </p>
                                </div>
                                <div className="bg-[#18181b] border border-[#52525b] px-4 py-2 rounded-md inline-block">
                                    <p className="text-xs text-[#d4d4d8]">Esta acción actualiza el inventario</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={procesarDevolucion}
                                    disabled={loading}
                                    className="w-full h-12 bg-[#e4e4e7] hover:bg-white text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-3 group/final"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5 group-final:scale-125 transition-transform" />}
                                    <span>Procesar devolución</span>
                                </button>
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    disabled={loading}
                                    className="w-full py-3 text-[#a1a1aa] hover:text-white text-sm font-semibold transition-colors"
                                >
                                    Volver
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
