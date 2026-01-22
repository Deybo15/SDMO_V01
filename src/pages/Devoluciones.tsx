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
    MessageSquare
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
    const themeColor = 'rose';

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
                    fecha_devolucion: new Date().toISOString()
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
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8">
            <PageHeader
                title="Devolución de Material"
                icon={RotateCcw}
                themeColor={themeColor}
            />

            <div className="max-w-6xl mx-auto space-y-6">

                {/* Status Messages */}
                {feedback && (
                    <div className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-top-4 flex items-center gap-3 ${feedback.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                            feedback.type === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' :
                                feedback.type === 'warning' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' :
                                    'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        }`}>
                        {feedback.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
                            feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                                <Info className="w-5 h-5" />}
                        <span className="font-bold">{feedback.message}</span>
                    </div>
                )}

                {/* Search Bar Section */}
                <div className="bg-[#1e2235] border border-white/10 rounded-2xl shadow-xl overflow-hidden p-4 md:p-8">
                    <h2 className="text-lg font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Search className={`w-5 h-5 text-${themeColor}-500`} />
                        Buscar Salida Registrada
                    </h2>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                <Hash className="w-5 h-5 text-gray-600 group-focus-within:text-rose-500 transition-colors" />
                            </div>
                            <input
                                type="number"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && buscarSalida()}
                                placeholder="Ingrese el número de salida (ej: 8639)"
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-14 pr-4 py-4 text-white text-lg font-bold placeholder-gray-600 focus:outline-none focus:border-rose-500/50 transition-all shadow-inner"
                            />
                        </div>
                        <button
                            onClick={buscarSalida}
                            disabled={searching}
                            className={`px-8 py-4 bg-gradient-to-r from-rose-600 to-rose-400 text-white font-black rounded-xl shadow-xl shadow-rose-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95`}
                        >
                            {searching ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                            <span className="text-lg">Buscar</span>
                        </button>
                        {resultados.length > 0 && (
                            <button
                                onClick={() => { setSearchTerm(''); setResultados([]); setFeedback(null); setSelectedItem(null); }}
                                className="px-6 py-4 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-xl border border-white/10 transition-all active:scale-95"
                            >
                                <Eraser className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="space-y-4">
                    {searching ? (
                        <div className="py-20 flex flex-col items-center justify-center space-y-4 text-gray-500">
                            <Loader2 className="w-12 h-12 animate-spin text-rose-500" />
                            <p className="font-bold uppercase tracking-widest text-sm">Consultando registros...</p>
                        </div>
                    ) : resultados.length > 0 ? (
                        <>
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-white font-bold flex items-center gap-3 text-xl">
                                    <List className="w-6 h-6 text-rose-500" />
                                    Artículos encontrados ({resultados.length})
                                </h3>
                                <span className="bg-rose-500/10 text-rose-400 text-[10px] font-black px-3 py-1 rounded-full border border-rose-500/20 uppercase tracking-widest">
                                    Salida #{searchTerm}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {resultados.map((item, index) => (
                                    <div
                                        key={item.articulo}
                                        className="bg-[#1e2235] border border-white/10 rounded-2xl p-5 relative overflow-hidden group animate-in slide-in-from-right-4 duration-300"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500/50" />

                                        <div className="flex flex-col md:flex-row gap-6 items-center">
                                            {/* Article Image */}
                                            <div className="w-24 h-24 bg-black/40 rounded-2xl border border-white/10 overflow-hidden shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                                                <img
                                                    src={item.articulo_01.imagen_url || 'https://via.placeholder.com/100?text=No+Img'}
                                                    alt={item.articulo_01.nombre_articulo}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 w-full space-y-4">
                                                <div>
                                                    <span className="text-rose-400 font-black text-[10px] uppercase tracking-widest block mb-1">
                                                        {item.articulo_01.codigo_articulo}
                                                    </span>
                                                    <h4 className="text-white font-bold text-lg leading-tight group-hover:text-rose-400 transition-colors">
                                                        {item.articulo_01.nombre_articulo}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-gray-500 font-bold text-xs uppercase">{item.articulo_01.marca || 'S/M'}</span>
                                                        <span className="w-1 h-1 rounded-full bg-gray-700" />
                                                        <span className="text-gray-500 font-bold text-xs uppercase">{item.articulo_01.unidad}</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-white/5 pt-4">
                                                    <div>
                                                        <span className="text-gray-600 text-[9px] font-black uppercase tracking-tighter block mb-1">Entregado</span>
                                                        <span className="text-white font-black text-base">{item.cantidad}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-600 text-[9px] font-black uppercase tracking-tighter block mb-1">Precio Unit.</span>
                                                        <span className="text-gray-400 font-bold text-sm">{formatCurrency(item.precio_unitario)}</span>
                                                    </div>
                                                    <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                                                        <span className="text-gray-600 text-[9px] font-black uppercase tracking-tighter block mb-1">Subtotal</span>
                                                        <span className="text-emerald-400 font-black text-base">{formatCurrency(item.subtotal)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            <button
                                                onClick={() => handleSelect(item)}
                                                className="w-full md:w-auto px-8 py-4 bg-white/5 hover:bg-rose-500/10 text-gray-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 rounded-xl font-black transition-all flex items-center justify-center gap-3 active:scale-95"
                                            >
                                                <span>Devolver</span>
                                                <RotateCcw className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/5">
                                <PackageOpen className="w-12 h-12 text-gray-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-500 uppercase tracking-widest">Esperando Búsqueda</h3>
                            <p className="text-gray-600 mt-2 max-w-xs mx-auto">
                                Ingrese el ID de una salida registrada para ver los materiales disponibles para devolución.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* PROCESS MODAL */}
            {selectedItem && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#1e2235] w-full h-full md:h-auto md:max-w-lg md:rounded-3xl border-0 md:border md:border-white/10 shadow-2xl overflow-y-auto flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-white/5 p-8 border-b border-white/10 flex justify-between items-start shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                                    <RotateCcw className="w-6 h-6 text-rose-500" />
                                    Devolución
                                </h3>
                                <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mt-2">Item perteneciente a Salida #{selectedItem.id_salida}</p>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-2 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white transition-colors"
                            >
                                <X className="w-7 h-7" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-8 flex-1">
                            {/* Selected Item Summary */}
                            <div className="bg-black/20 rounded-2xl p-5 flex gap-5 items-center border border-white/5 shadow-inner">
                                <div className="w-20 h-20 bg-[#1e2235] rounded-xl overflow-hidden shrink-0 border border-white/10">
                                    <img
                                        src={selectedItem.articulo_01.imagen_url || ''}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-black text-white text-lg leading-tight truncate">{selectedItem.articulo_01.nombre_articulo}</h4>
                                    <p className="text-xs text-rose-400 font-black font-mono mt-1 opacity-80">{selectedItem.articulo}</p>
                                    <div className="inline-flex items-center gap-2 mt-3 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                                        <span className="text-[10px] uppercase text-emerald-500/80 font-black">Stock de Salida</span>
                                        <span className="text-sm font-black text-emerald-400">
                                            {selectedItem.cantidad} {selectedItem.articulo_01.unidad}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block px-1">Cantidad a devolver</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={cantidadDev}
                                            onChange={(e) => setCantidadDev(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-white text-2xl font-black placeholder-gray-700 focus:outline-none focus:border-rose-500/50 shadow-inner"
                                            autoFocus
                                        />
                                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-600 font-black text-sm uppercase">
                                            {selectedItem.articulo_01.unidad}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block px-1">Motivo de la devolución</label>
                                    <div className="relative">
                                        <select
                                            value={motivoDev}
                                            onChange={(e) => setMotivoDev(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-white font-bold outline-none cursor-pointer appearance-none focus:border-rose-500/50 shadow-inner pr-12"
                                        >
                                            <option value="" disabled className="bg-[#1e2235]">-- Seleccione un motivo --</option>
                                            <option value="Material en exceso" className="bg-[#1e2235]">Material en exceso</option>
                                            <option value="Material defectuoso" className="bg-[#1e2235]">Material defectuoso</option>
                                            <option value="Cambio en proyecto" className="bg-[#1e2235]">Cambio en proyecto</option>
                                            <option value="Material no utilizado" className="bg-[#1e2235]">Material no utilizado</option>
                                            <option value="Error en salida" className="bg-[#1e2235]">Error en salida</option>
                                            <option value="Otros" className="bg-[#1e2235]">Otros (Especificar)</option>
                                        </select>
                                        <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600 pointer-events-none rotate-90" />
                                    </div>
                                </div>

                                {motivoDev === 'Otros' && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block px-1 flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4" />
                                            Especificaciones adicionales
                                        </label>
                                        <textarea
                                            value={otroMotivo}
                                            onChange={(e) => setOtroMotivo(e.target.value)}
                                            placeholder="Describa el motivo detalladamente..."
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-white font-medium placeholder-gray-700 outline-none focus:border-rose-500/50 min-h-[120px] shadow-inner"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 bg-white/5 border-t border-white/10 flex flex-col sm:flex-row gap-4 shrink-0">
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="flex-1 py-4 bg-transparent hover:bg-white/5 text-gray-400 font-black rounded-2xl border border-white/10 transition-all uppercase tracking-widest shadow-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={validateAndConfirm}
                                className="flex-1 py-4 bg-gradient-to-r from-rose-600 to-rose-400 text-white font-black rounded-2xl shadow-xl shadow-rose-900/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                            >
                                <span>Verificar</span>
                                <ArrowRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION SUB-MODAL */}
            {showConfirmModal && selectedItem && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
                    <div className="bg-[#1e2235] border border-rose-500/30 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 ring-4 ring-rose-500/5">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <AlertTriangle className="w-10 h-10 text-rose-500" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-3">¿Confirmar Acción?</h3>
                            <div className="space-y-4 mb-8">
                                <p className="text-gray-400 font-medium leading-relaxed">
                                    Se devolverán <span className="text-white font-black">{cantidadDev} {selectedItem.articulo_01.unidad}</span> de <span className="text-white font-bold">{selectedItem.articulo_01.nombre_articulo}</span> al inventario general.
                                </p>
                                <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl">
                                    <p className="text-[10px] text-rose-400 font-black uppercase tracking-tighter">Esta acción no se puede deshacer de forma automática</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={procesarDevolucion}
                                    disabled={loading}
                                    className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl shadow-xl shadow-rose-900/40 transition-all flex items-center justify-center gap-3 active:scale-95"
                                >
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                                    Sí, Procesar
                                </button>
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    disabled={loading}
                                    className="w-full py-4 bg-transparent hover:bg-white/5 text-gray-500 font-black rounded-2xl transition-all uppercase tracking-widest text-xs"
                                >
                                    Girar atrás
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
