import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    RotateCcw,
    Search,
    List,
    Eraser,
    Loader2,
    ChevronLeft,
    AlertTriangle,
    CheckCircle2,
    Info,
    Undo2,
    Check,
    X,
    PackageOpen,
    ArrowRight,
    AlertCircle
} from 'lucide-react';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [resultados, setResultados] = useState<SalidaItem[]>([]);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null);

    // Modal/Form State
    const [selectedItem, setSelectedItem] = useState<SalidaItem | null>(null);
    const [cantidadDev, setCantidadDev] = useState<string>('');
    const [motivoDev, setMotivoDev] = useState<string>('');
    const [otroMotivo, setOtroMotivo] = useState<string>('');

    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Clear status message after 5 seconds
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => setStatusMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    const buscarSalida = async () => {
        if (!searchTerm.trim()) {
            setStatusMessage({ type: 'warning', message: 'Por favor, ingrese un número de salida para buscar' });
            return;
        }

        setLoading(true);
        setStatusMessage(null);
        setResultados([]);
        setSelectedItem(null);

        try {
            // 1. Search in dato_salida_13
            const { data: salidaData, error: salidaError } = await supabase
                .from('dato_salida_13')
                .select('id_salida, cantidad, articulo, precio_unitario, subtotal, fecha_registro, registro_salida')
                .eq('id_salida', parseInt(searchTerm))
                .order('articulo');

            if (salidaError) throw salidaError;

            if (!salidaData || salidaData.length === 0) {
                setStatusMessage({ type: 'warning', message: `No se encontraron salidas con ID "${searchTerm}"` });
                return;
            }

            // 2. Fetch Article Details
            const codigosArticulos = [...new Set(salidaData.map(item => item.articulo))];
            const { data: articulosData, error: articulosError } = await supabase
                .from('articulo_01')
                .select('codigo_articulo, nombre_articulo, marca, unidad, imagen_url')
                .in('codigo_articulo', codigosArticulos);

            if (articulosError) throw articulosError;

            // 3. Combine Data
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
            // Don't show success message for search, results are self-explanatory
            // setStatusMessage({ type: 'success', message: `¡Éxito! Se encontraron ${resultadosCombinados.length} líneas de la salida ${searchTerm}` });

        } catch (error: any) {
            console.error('Error:', error);
            setStatusMessage({ type: 'error', message: 'Error: ' + error.message });
        } finally {
            setLoading(false);
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
            setStatusMessage({ type: 'warning', message: 'Ingrese una cantidad válida mayor a 0' });
            return;
        }

        if (cantidad > selectedItem.cantidad) {
            setStatusMessage({ type: 'warning', message: `La cantidad no puede ser mayor a ${selectedItem.cantidad}` });
            return;
        }

        if (!motivoFinal.trim()) {
            setStatusMessage({ type: 'warning', message: 'Seleccione o especifique un motivo' });
            return;
        }

        setShowConfirmModal(true);
    };

    const procesarDevolucion = async () => {
        if (!selectedItem) return;

        const cantidad = parseFloat(cantidadDev);
        const motivoFinal = motivoDev === 'Otros' ? otroMotivo : motivoDev;

        setLoading(true);
        setShowConfirmModal(false); // Close modal

        try {
            // 1. Verify current quantity (concurrency check)
            const { data: salidaActual, error: errorConsulta } = await supabase
                .from('dato_salida_13')
                .select('cantidad, precio_unitario')
                .eq('id_salida', selectedItem.id_salida)
                .eq('articulo', selectedItem.articulo)
                .single();

            if (errorConsulta) throw new Error('Error al consultar salida: ' + errorConsulta.message);

            if (cantidad > salidaActual.cantidad) {
                throw new Error(`La cantidad a devolver (${cantidad}) es mayor que la cantidad disponible (${salidaActual.cantidad})`);
            }

            // 2. Insert Master Record (devolucion_articulo_09)
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

            // 3. Insert Detail Record (dato_devolucion_14)
            const { error: errorDetalle } = await supabase
                .from('dato_devolucion_14')
                .insert({
                    id_devolucion: dataMaestro.id_devolucion,
                    articulo: selectedItem.articulo,
                    cantidad: cantidad
                });

            if (errorDetalle) {
                // Rollback master if detail fails
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

            setStatusMessage({ type: 'success', message: '¡Éxito! Devolución registrada correctamente' });
            setSelectedItem(null);
            buscarSalida(); // Refresh list

        } catch (error: any) {
            console.error('Error:', error);
            setStatusMessage({ type: 'error', message: 'Error al procesar: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(amount);
    };

    return (
        <div className="min-h-screen bg-[#0f1419] text-slate-200 font-sans relative p-4 md:p-8">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[20%] left-[80%] w-[40rem] h-[40rem] bg-red-900/10 rounded-full blur-3xl" />
                <div className="absolute bottom-[20%] right-[80%] w-[40rem] h-[40rem] bg-blue-900/10 rounded-full blur-3xl" />
            </div>



            <div className="relative z-10 max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="sticky top-0 z-50 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 mb-8 bg-[#0f1419]/90 backdrop-blur-xl -mx-4 px-4 md:-mx-8 md:px-8 border-b border-white/5 shadow-lg shadow-black/20 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
                            <RotateCcw className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                                Devolución de Material
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

                {/* Search Section */}
                <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl">
                    <div className="bg-slate-900/50 rounded-xl p-6 md:p-8">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Search className="w-5 h-5 text-red-500" />
                            Seleccionar Salida
                        </h2>

                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="text-slate-500 font-mono">#</span>
                                </div>
                                <input
                                    type="number"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && buscarSalida()}
                                    placeholder="Ingrese el número de salida (ej: 8639)"
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-8 pr-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all shadow-inner"
                                />
                            </div>
                            <button
                                onClick={buscarSalida}
                                disabled={loading}
                                className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                Buscar Salida
                            </button>
                            {resultados.length > 0 && (
                                <button
                                    onClick={() => { setSearchTerm(''); setResultados([]); setStatusMessage(null); setSelectedItem(null); }}
                                    className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2 hover:text-white"
                                >
                                    <Eraser className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status Message Banner */}
                {statusMessage && (
                    <div className={`fixed bottom-8 right-8 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 fade-in duration-300`}>
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
                                {statusMessage.type === 'error' && <AlertCircle className="w-5 h-5" />}
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

                {/* Empty State */}
                {resultados.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
                            <PackageOpen className="w-10 h-10 text-slate-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-400">Esperando búsqueda</h3>
                        <p className="text-slate-500 mt-2">Ingrese un ID de salida para ver los artículos disponibles</p>
                    </div>
                )}

                {/* Results List */}
                {resultados.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-white font-bold flex items-center gap-2 text-lg">
                                <List className="w-5 h-5 text-red-500" />
                                Artículos en Salida #{searchTerm}
                            </h3>
                            <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-white/10">
                                {resultados.length} ITEMS
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {resultados.map((item) => (
                                <div
                                    key={item.articulo}
                                    className="bg-slate-800/40 backdrop-blur-md border border-white/5 rounded-2xl p-1 hover:bg-slate-800/60 transition-all group hover:border-red-500/30 hover:shadow-lg hover:shadow-red-900/10"
                                >
                                    <div className="bg-slate-900/40 rounded-xl p-5 flex flex-col md:flex-row gap-6 items-center">
                                        {/* Image */}
                                        <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-800 rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-500">
                                            <img
                                                src={item.articulo_01.imagen_url || 'https://via.placeholder.com/100?text=No+Img'}
                                                alt={item.articulo_01.nombre_articulo}
                                                className="w-full h-full object-cover"
                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                            />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 w-full text-center md:text-left">
                                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 mb-3">
                                                <div>
                                                    <span className="text-red-400 font-mono text-xs font-bold uppercase tracking-wider mb-1 block">
                                                        {item.articulo_01.codigo_articulo}
                                                    </span>
                                                    <h4 className="text-white font-bold text-lg leading-tight group-hover:text-red-400 transition-colors">
                                                        {item.articulo_01.nombre_articulo}
                                                    </h4>
                                                    <span className="text-slate-500 text-sm">{item.articulo_01.marca}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-3">
                                                <div className="text-center md:text-left">
                                                    <span className="text-slate-500 text-[10px] uppercase tracking-wider block">Cant.</span>
                                                    <span className="text-emerald-400 font-bold font-mono">
                                                        {item.cantidad} <span className="text-xs text-slate-500">{item.articulo_01.unidad}</span>
                                                    </span>
                                                </div>
                                                <div className="text-center md:text-left">
                                                    <span className="text-slate-500 text-[10px] uppercase tracking-wider block">Precio</span>
                                                    <span className="text-slate-300 font-mono text-sm">
                                                        {formatCurrency(item.precio_unitario)}
                                                    </span>
                                                </div>
                                                <div className="text-center md:text-left">
                                                    <span className="text-slate-500 text-[10px] uppercase tracking-wider block">Total</span>
                                                    <span className="text-slate-300 font-mono text-sm">
                                                        {formatCurrency(item.subtotal)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <div className="w-full md:w-auto">
                                            <button
                                                onClick={() => handleSelect(item)}
                                                className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-red-600/20 text-slate-300 hover:text-red-400 border border-white/10 hover:border-red-500/50 rounded-xl font-bold transition-all flex items-center justify-center gap-2 group/btn"
                                            >
                                                <span>Devolver</span>
                                                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* RETURN MODAL */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#0f1419] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 border-b border-white/5 flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Undo2 className="w-5 h-5 text-red-500" />
                                    Procesar Devolución
                                </h3>
                                <p className="text-slate-400 text-sm mt-1">Salida #{selectedItem.id_salida}</p>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">
                            {/* Item Summary */}
                            <div className="bg-slate-800/50 rounded-xl p-4 flex gap-4 items-center border border-white/5">
                                <div className="w-16 h-16 bg-slate-700 rounded-lg overflow-hidden shrink-0">
                                    <img
                                        src={selectedItem.articulo_01.imagen_url || ''}
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                    />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-sm">{selectedItem.articulo_01.nombre_articulo}</h4>
                                    <p className="text-xs text-slate-400 font-mono mt-1">{selectedItem.articulo}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] uppercase text-slate-500 font-bold">Disponible:</span>
                                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                            {selectedItem.cantidad} {selectedItem.articulo_01.unidad}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-300">Cantidad a devolver</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={cantidadDev}
                                            onChange={(e) => setCantidadDev(e.target.value)}
                                            placeholder="0.00"
                                            max={selectedItem.cantidad}
                                            min="0.1"
                                            step="0.1"
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 text-lg font-mono"
                                            autoFocus
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">
                                            {selectedItem.articulo_01.unidad}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-300">Motivo</label>
                                    <select
                                        value={motivoDev}
                                        onChange={(e) => setMotivoDev(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 appearance-none cursor-pointer"
                                    >
                                        <option value="">-- Seleccione un motivo --</option>
                                        <option value="Material en exceso">Material en exceso</option>
                                        <option value="Material defectuoso">Material defectuoso</option>
                                        <option value="Cambio en proyecto">Cambio en proyecto</option>
                                        <option value="Material no utilizado">Material no utilizado</option>
                                        <option value="Error en salida">Error en salida</option>
                                        <option value="Otros">Otros</option>
                                    </select>
                                </div>

                                {motivoDev === 'Otros' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <label className="text-sm font-bold text-slate-300">Especifique</label>
                                        <textarea
                                            value={otroMotivo}
                                            onChange={(e) => setOtroMotivo(e.target.value)}
                                            placeholder="Describa el motivo de la devolución..."
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 min-h-[80px] resize-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 pt-2 flex gap-3">
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-white/10 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={validateAndConfirm}
                                className="flex-1 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                Continuar
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION MODAL (Nested) */}
            {showConfirmModal && selectedItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#0f1419] border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-red-500/20">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">¿Confirmar Devolución?</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Se devolverán <strong className="text-white">{cantidadDev} {selectedItem.articulo_01.unidad}</strong> de <strong className="text-white">{selectedItem.articulo_01.nombre_articulo}</strong> al inventario.
                            </p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={procesarDevolucion}
                                    disabled={loading}
                                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                    Sí, Confirmar
                                </button>
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    disabled={loading}
                                    className="w-full py-3 bg-transparent hover:bg-white/5 text-slate-400 font-bold rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
