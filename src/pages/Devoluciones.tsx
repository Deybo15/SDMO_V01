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
    const themeColor = 'blue';

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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] p-4 md:p-8 relative overflow-hidden">
            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-6 border-b border-[#333333]">
                    <div className="space-y-2">
                        <PageHeader title="Devolución de Material" icon={RotateCcw} themeColor="blue" />
                        <p className="text-[#86868B] text-sm font-medium tracking-wide">
                            Gestione el retorno de materiales al inventario general desde salidas registradas.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 rounded-[8px] bg-transparent border border-[#333333] text-xs font-black uppercase tracking-widest flex items-center gap-2 text-[#F5F5F7] hover:bg-[#1D1D1F] transition-all"
                    >
                        <ArrowLeft className="w-4 h-4 text-[#0071E3]" />
                        Regresar
                    </button>
                </div>

                {/* Status Float Messages */}
                {feedback && (
                    <div className={`fixed top-8 right-8 z-[100] px-6 py-4 rounded-[8px] shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 flex items-center gap-4
                        ${feedback.type === 'success' ? 'bg-[#0071E3]/10 border-[#0071E3]/30 text-[#0071E3]' :
                            feedback.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                                feedback.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                                    'bg-[#0071E3]/10 border-[#0071E3]/30 text-[#0071E3]'
                        }`}>
                        <div className="p-2 rounded-[8px] bg-white/5 shrink-0">
                            {feedback.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500" /> :
                                feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-[#0071E3]" /> :
                                    <Info className="w-5 h-5 text-amber-500" />}
                        </div>
                        <span className="font-bold uppercase tracking-widest text-[10px] leading-relaxed">{feedback.message}</span>
                    </div>
                )}

                {/* Search Bar Section */}
                <div className="bg-[#121212] p-8 border border-[#333333] rounded-[8px] relative group overflow-hidden">
                    <h2 className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                        <span className="w-8 h-px bg-[#333333]" />
                        Buscar Salida Registrada
                    </h2>

                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group/input">
                            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                                <Hash className="w-5 h-5 text-[#424245] group-focus-within/input:text-[#0071E3] transition-colors" />
                            </div>
                            <input
                                type="number"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && buscarSalida()}
                                placeholder="ID de salida (ej: 8639)"
                                className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-16 pr-6 py-4 text-white text-lg font-bold placeholder-[#424245] focus:outline-none focus:border-[#0071E3]/50 transition-all"
                            />
                        </div>
                        <button
                            onClick={buscarSalida}
                            disabled={searching}
                            className="px-10 py-4 bg-[#0071E3] hover:bg-[#0077ED] text-white font-black rounded-[8px] transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 group/btn"
                        >
                            {searching ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Search className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                            )}
                            <span className="text-xs uppercase tracking-widest">Consultar</span>
                        </button>
                        {resultados.length > 0 && (
                            <button
                                onClick={() => { setSearchTerm(''); setResultados([]); setFeedback(null); setSelectedItem(null); }}
                                className="px-6 py-4 bg-transparent border border-[#333333] text-[#86868B] hover:text-[#F5F5F7] rounded-[8px] transition-all active:scale-95"
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
                        <div className="py-32 flex flex-col items-center justify-center space-y-6 text-[#424245]">
                            <div className="relative">
                                <Loader2 className="w-12 h-12 animate-spin text-[#0071E3] relative z-10" />
                            </div>
                            <p className="font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Sincronizando Base de Datos...</p>
                        </div>
                    ) : resultados.length > 0 ? (
                        <>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                                <h3 className="text-white font-black flex items-center gap-4 text-2xl italic uppercase tracking-tighter">
                                    <List className="w-7 h-7 text-[#0071E3]" />
                                    Artículos encontrados
                                    <span className="text-[#86868B] text-lg not-italic font-mono ml-1">[{resultados.length}]</span>
                                </h3>
                                <div className="flex items-center gap-3 bg-[#121212] border border-[#333333] px-4 py-2 rounded-[8px]">
                                    <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">Salida Activa:</span>
                                    <span className="text-sm font-mono font-black text-[#0071E3]">#{searchTerm}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {resultados.map((item, index) => (
                                    <div
                                        key={item.articulo}
                                        className="bg-[#121212] p-6 border border-[#333333] rounded-[8px] relative overflow-hidden group animate-in fade-in slide-in-from-bottom-4 duration-500 hover:border-[#424245] transition-all"
                                        style={{ animationDelay: `${index * 80}ms` }}
                                    >
                                        <div className="flex flex-col lg:flex-row gap-8 items-center">
                                            {/* Article Image Container */}
                                            <div className="w-24 h-24 bg-[#000000] rounded-[8px] border border-[#333333] overflow-hidden shrink-0 shadow-2xl relative group-hover:scale-[1.03] transition-all duration-500">
                                                <img
                                                    src={item.articulo_01.imagen_url || 'https://via.placeholder.com/150?text=No+Img'}
                                                    alt={item.articulo_01.nombre_articulo}
                                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                                                />
                                            </div>

                                            {/* Info Grid */}
                                            <div className="flex-1 w-full space-y-6">
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                    <div>
                                                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] font-mono text-[10px] uppercase font-black tracking-widest block mb-2">
                                                            <Barcode className="w-3 h-3" />
                                                            {item.articulo_01.codigo_articulo}
                                                        </span>
                                                        <h4 className="text-[#F5F5F7] font-black text-xl italic uppercase tracking-tight leading-none group-hover:text-[#0071E3] transition-colors">
                                                            {item.articulo_01.nombre_articulo}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-3">
                                                            <span className="text-[#86868B] font-black text-[10px] uppercase tracking-widest">{item.articulo_01.marca || 'GENÉRICO'}</span>
                                                            <span className="w-1 h-1 rounded-full bg-[#333333]" />
                                                            <span className="text-[#86868B] font-black text-[10px] uppercase tracking-widest">{item.articulo_01.unidad}</span>
                                                        </div>
                                                    </div>

                                                    {/* Right Stats (Subtotal) */}
                                                    <div className="text-right hidden md:block">
                                                        <p className="text-[#86868B] text-[9px] font-black uppercase tracking-[0.2em] mb-1">Subtotal Salida</p>
                                                        <p className="text-xl font-mono font-black text-[#F5F5F7]">{formatCurrency(item.subtotal)}</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 p-5 bg-[#000000]/40 rounded-[8px] border border-[#333333] shadow-inner">
                                                    <div className="space-y-1">
                                                        <span className="text-[#86868B] text-[10px] font-black uppercase tracking-widest block">Entregado</span>
                                                        <span className="text-2xl font-black text-white italic tracking-tighter">{item.cantidad}</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[#86868B] text-[10px] font-black uppercase tracking-widest block">Precio Unit.</span>
                                                        <span className="text-base font-bold text-[#86868B] font-mono">{formatCurrency(item.precio_unitario)}</span>
                                                    </div>
                                                    <div className="space-y-1 lg:col-span-1 md:hidden">
                                                        <span className="text-[#86868B] text-[10px] font-black uppercase tracking-widest block">Subtotal</span>
                                                        <span className="text-lg font-black text-[#F5F5F7]">{formatCurrency(item.subtotal)}</span>
                                                    </div>
                                                    {/* Space for the button on LG */}
                                                    <div className="lg:col-span-2 flex items-center justify-end">
                                                        <button
                                                            onClick={() => handleSelect(item)}
                                                            className="w-full lg:w-auto px-8 py-4 bg-[#0071E3] hover:bg-[#0077ED] text-white font-black rounded-[8px] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-[#0071E3]/10 group/itembtn"
                                                        >
                                                            <span className="text-[10px] uppercase tracking-widest">Iniciar Devolución</span>
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
                        <div className="py-40 flex flex-col items-center justify-center text-center group">
                            <div className="relative mb-8">
                                <div className="w-24 h-24 bg-[#121212] border border-[#333333] rounded-[8px] flex items-center justify-center relative z-10 group-hover:rotate-6 transition-all duration-700">
                                    <PackageOpen className="w-12 h-12 text-[#424245]" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-[#424245] uppercase italic tracking-tighter">Esperando Registro</h3>
                            <p className="text-[#86868B] mt-2 max-w-sm mx-auto font-medium text-sm leading-relaxed tracking-wide">
                                Ingrese el identificador de una salida registrada para procesar el retorno de materiales al inventario general.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* PROCESS MODAL */}
            {selectedItem && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-[#121212] w-full h-full md:h-auto md:max-w-2xl shadow-2xl border border-[#333333] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 rounded-[8px]">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-[#333333] flex justify-between items-center shrink-0 bg-white/[0.02]">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-[#0071E3] rounded-[8px] flex items-center justify-center shadow-lg shadow-[#0071E3]/20">
                                    <RotateCcw className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-[#F5F5F7] italic uppercase tracking-tighter leading-tight">Configurar Retorno</h3>
                                    <p className="text-[#0071E3] font-black text-[10px] uppercase tracking-[0.2em] mt-1 opacity-80 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#0071E3] animate-pulse" />
                                        Asociado a Salida ID: #{selectedItem.id_salida}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-3 bg-transparent border border-[#333333] rounded-[8px] text-[#86868B] hover:text-[#F5F5F7] transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                            {/* Selected Item Detail */}
                            <div className="bg-[#000000] rounded-[8px] p-6 flex gap-6 items-center border border-[#333333]">
                                <div className="w-16 h-16 bg-[#1D1D1F] rounded-[8px] overflow-hidden shrink-0 border border-[#333333]">
                                    <img
                                        src={selectedItem.articulo_01.imagen_url || ''}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-black text-[#F5F5F7] text-lg uppercase italic tracking-tight truncate">{selectedItem.articulo_01.nombre_articulo}</h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] font-black text-[#0071E3] uppercase tracking-widest px-2 py-0.5 rounded-[4px] bg-[#0071E3]/5 border border-[#0071E3]/10 font-mono">{selectedItem.articulo}</span>
                                        <span className="w-1 h-1 rounded-full bg-[#333333]" />
                                        <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">{selectedItem.articulo_01.marca}</span>
                                    </div>
                                    <div className="mt-3">
                                        <div className="px-3 py-1 rounded-[4px] bg-[#0071E3]/10 border border-[#0071E3]/20 inline-block">
                                            <p className="text-[10px] font-black text-[#0071E3] uppercase tracking-widest">
                                                Disponible: {selectedItem.cantidad} {selectedItem.articulo_01.unidad}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Inputs Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] block">Cantidad a devolver</label>
                                    <div className="relative group/num">
                                        <input
                                            type="number"
                                            value={cantidadDev}
                                            onChange={(e) => setCantidadDev(e.target.value)}
                                            placeholder="0"
                                            className={`w-full bg-[#1D1D1F] border rounded-[8px] p-5 text-white text-3xl font-black placeholder:text-[#333333] focus:outline-none transition-all shadow-inner
                                                ${parseFloat(cantidadDev) > selectedItem.cantidad
                                                    ? 'border-red-500 ring-2 ring-red-500/10 text-red-500'
                                                    : 'border-[#333333] focus:border-[#0071E3]/50'
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
                                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-1 animate-in fade-in slide-in-from-top-1">
                                            ⚠️ Excede el disponible ({selectedItem.cantidad})
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] block">Motivo Principal</label>
                                    <div className="relative">
                                        <select
                                            value={motivoDev}
                                            onChange={(e) => setMotivoDev(e.target.value)}
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-5 text-white font-black text-xs uppercase tracking-widest outline-none cursor-pointer appearance-none focus:border-[#0071E3]/50 shadow-inner pr-12 transition-all"
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
                                            <ChevronRight className="w-4 h-4 text-[#0071E3] rotate-90" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {motivoDev === 'Otros' && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <label className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] block flex items-center gap-3">
                                        <MessageSquare className="w-4 h-4 text-[#0071E3]" />
                                        Especificaciones del Ajuste
                                    </label>
                                    <textarea
                                        value={otroMotivo}
                                        onChange={(e) => setOtroMotivo(e.target.value)}
                                        placeholder="Describa el motivo detalladamente..."
                                        className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-5 text-white font-bold placeholder-[#424245] outline-none focus:border-[#0071E3]/50 min-h-[120px] shadow-inner transition-all resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 bg-white/[0.02] border-t border-[#333333] flex flex-col md:flex-row gap-4 shrink-0">
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="flex-1 py-4 bg-transparent border border-[#333333] text-[#86868B] hover:text-[#F5F5F7] font-black rounded-[8px] uppercase tracking-[0.2em] text-[10px] transition-all"
                            >
                                Cancelar Operación
                            </button>
                            <button
                                onClick={validateAndConfirm}
                                disabled={!cantidadDev || parseFloat(cantidadDev) <= 0 || parseFloat(cantidadDev) > selectedItem.cantidad || !motivoDev}
                                className={`flex-1 py-4 font-black rounded-[8px] transition-all flex items-center justify-center gap-3 group/valid
                                    ${(!cantidadDev || parseFloat(cantidadDev) <= 0 || parseFloat(cantidadDev) > selectedItem.cantidad || !motivoDev)
                                        ? 'bg-[#1D1D1F] text-[#424245] border border-[#333333] opacity-50 cursor-not-allowed'
                                        : 'bg-[#0071E3] text-white hover:bg-[#0077ED] active:scale-[0.98]'
                                    }
                                `}
                            >
                                <span className="text-[10px] uppercase tracking-[0.2em]">Verificar y Continuar</span>
                                <ArrowRight className="w-5 h-5 group-hover/valid:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION SUB-MODAL */}
            {showConfirmModal && selectedItem && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-500 p-10 relative">
                        <div className="text-center relative z-10">
                            <div className="w-16 h-16 bg-[#0071E3] text-white rounded-[8px] flex items-center justify-center mx-auto mb-6 shadow-2xl">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">¿Confirmar Retorno?</h3>

                            <div className="space-y-6 mb-8 mt-6">
                                <div className="p-5 bg-[#000000] rounded-[8px] border border-[#333333]">
                                    <p className="text-[#86868B] font-bold text-sm leading-relaxed tracking-wide">
                                        Procederá a devolver <span className="text-[#F5F5F7] font-black text-base italic">{cantidadDev} {selectedItem.articulo_01.unidad}</span> de <span className="text-[#0071E3] font-black">{selectedItem.articulo_01.nombre_articulo}</span>.
                                    </p>
                                </div>
                                <div className="bg-[#0071E3]/10 border border-[#0071E3]/20 px-4 py-2 rounded-[4px] inline-block">
                                    <p className="text-[9px] text-[#0071E3] font-black uppercase tracking-[0.2em]">Acción Irreversible por Sistema</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={procesarDevolucion}
                                    disabled={loading}
                                    className="w-full py-4 bg-[#0071E3] hover:bg-[#0077ED] text-white font-black rounded-[8px] transition-all flex items-center justify-center gap-3 group/final"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5 group-final:scale-125 transition-transform" />}
                                    <span className="uppercase tracking-widest text-[10px]">Sí, Procesar Retorno</span>
                                </button>
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    disabled={loading}
                                    className="w-full py-3 text-[#86868B] hover:text-[#F5F5F7] font-black uppercase tracking-[0.3em] text-[9px] transition-all"
                                >
                                    Girar Atrás
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
