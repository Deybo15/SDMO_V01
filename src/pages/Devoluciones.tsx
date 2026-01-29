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
        <div className="min-h-screen bg-[#0f111a] text-slate-100 p-4 md:p-8 relative overflow-hidden">
            {/* Ambient Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[10%] left-[-5%] w-[50%] h-[50%] bg-rose-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-white/5">
                    <div className="space-y-1">
                        <PageHeader title="Devolución de Material" icon={RotateCcw} themeColor="rose" />
                        <p className="text-slate-500 text-sm font-medium tracking-wide">
                            Gestione el retorno de materiales al inventario general desde salidas registradas.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="glass-button px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-200"
                    >
                        <ArrowLeft className="w-4 h-4 text-rose-500" />
                        Regresar
                    </button>
                </div>

                {/* Status Float Messages */}
                {feedback && (
                    <div className={`fixed top-8 right-8 z-[100] px-6 py-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl border animate-in slide-in-from-right-4 flex items-center gap-4
                        ${feedback.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100' :
                            feedback.type === 'error' ? 'bg-rose-500/20 border-rose-500/40 text-rose-100' :
                                feedback.type === 'warning' ? 'bg-amber-500/20 border-amber-500/40 text-amber-100' :
                                    'bg-blue-500/20 border-blue-500/40 text-blue-100'
                        }`}>
                        <div className="p-2 rounded-xl bg-white/10 shrink-0">
                            {feedback.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400" /> :
                                feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                                    <Info className="w-5 h-5 text-amber-400" />}
                        </div>
                        <span className="font-black uppercase tracking-widest text-[11px] leading-relaxed">{feedback.message}</span>
                    </div>
                )}

                {/* Search Bar Section */}
                <div className="glass-card p-6 md:p-10 bg-slate-900/40 relative group overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-rose-500/10 transition-colors" />

                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                        <span className="w-8 h-px bg-rose-500/30" />
                        Buscar Salida Registrada
                    </h2>

                    <div className="flex flex-col md:flex-row gap-5">
                        <div className="flex-1 relative group/input">
                            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                                <Hash className="w-5 h-5 text-slate-600 group-focus-within/input:text-rose-500 transition-colors" />
                            </div>
                            <input
                                type="number"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && buscarSalida()}
                                placeholder="ID de salida (ej: 8639)"
                                className="w-full bg-slate-950/60 border border-white/10 rounded-2xl pl-16 pr-6 py-5 text-white text-xl font-bold placeholder-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all shadow-inner"
                            />
                        </div>
                        <button
                            onClick={buscarSalida}
                            disabled={searching}
                            className="px-10 py-5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl shadow-xl shadow-rose-950/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 group/btn"
                        >
                            {searching ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <Search className="w-6 h-6 group-hover/btn:scale-110 transition-transform" />
                            )}
                            <span className="text-sm uppercase tracking-widest">Consultar</span>
                        </button>
                        {resultados.length > 0 && (
                            <button
                                onClick={() => { setSearchTerm(''); setResultados([]); setFeedback(null); setSelectedItem(null); }}
                                className="px-6 py-5 glass-button text-slate-400 hover:text-white rounded-2xl transition-all active:scale-95"
                                title="Limpiar búsqueda"
                            >
                                <Eraser className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="space-y-6">
                    {searching ? (
                        <div className="py-32 flex flex-col items-center justify-center space-y-6 text-slate-600">
                            <div className="relative">
                                <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-2xl animate-pulse" />
                                <Loader2 className="w-16 h-16 animate-spin text-rose-500 relative z-10" />
                            </div>
                            <p className="font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Sincronizando Base de Datos...</p>
                        </div>
                    ) : resultados.length > 0 ? (
                        <>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                                <h3 className="text-white font-black flex items-center gap-4 text-2xl italic uppercase tracking-tighter">
                                    <List className="w-7 h-7 text-rose-500" />
                                    Artículos encontrados
                                    <span className="text-slate-600 text-lg not-italic font-mono ml-1">[{resultados.length}]</span>
                                </h3>
                                <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Salida Activa:</span>
                                    <span className="text-sm font-mono font-black text-rose-400">#{searchTerm}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-5">
                                {resultados.map((item, index) => (
                                    <div
                                        key={item.articulo}
                                        className="glass-card p-6 relative overflow-hidden group animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-900/40 hover:bg-slate-900/60"
                                        style={{ animationDelay: `${index * 80}ms` }}
                                    >
                                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-rose-500/50 to-transparent group-hover:h-full transition-all duration-700" />

                                        <div className="flex flex-col lg:flex-row gap-8 items-center">
                                            {/* Article Image Container */}
                                            <div className="w-32 h-32 bg-slate-950/60 rounded-[2rem] border border-white/10 overflow-hidden shrink-0 shadow-2xl relative group-hover:scale-[1.03] transition-all duration-500 p-2">
                                                <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-[#0f111a]">
                                                    <img
                                                        src={item.articulo_01.imagen_url || 'https://via.placeholder.com/150?text=No+Img'}
                                                        alt={item.articulo_01.nombre_articulo}
                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                                                    />
                                                </div>
                                            </div>

                                            {/* Info Grid */}
                                            <div className="flex-1 w-full space-y-6">
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                    <div>
                                                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[10px] uppercase font-black tracking-widest block mb-2">
                                                            <Barcode className="w-3 h-3" />
                                                            {item.articulo_01.codigo_articulo}
                                                        </span>
                                                        <h4 className="text-white font-black text-xl italic uppercase tracking-tight leading-none group-hover:text-rose-400 transition-colors">
                                                            {item.articulo_01.nombre_articulo}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-3">
                                                            <span className="text-slate-500 font-black text-[10px] uppercase tracking-widest">{item.articulo_01.marca || 'GENÉRICO'}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-800" />
                                                            <span className="text-slate-500 font-black text-[10px] uppercase tracking-widest">{item.articulo_01.unidad}</span>
                                                        </div>
                                                    </div>

                                                    {/* Right Stats (Subtotal) */}
                                                    <div className="text-right hidden md:block">
                                                        <p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Subtotal Salida</p>
                                                        <p className="text-xl font-mono font-black text-slate-100">{formatCurrency(item.subtotal)}</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 p-5 bg-slate-950/40 rounded-2xl border border-white/5 shadow-inner">
                                                    <div className="space-y-1">
                                                        <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest block">Entregado</span>
                                                        <span className="text-2xl font-black text-white italic tracking-tighter">{item.cantidad}</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest block">Precio Unit.</span>
                                                        <span className="text-base font-bold text-slate-400 font-mono">{formatCurrency(item.precio_unitario)}</span>
                                                    </div>
                                                    <div className="space-y-1 lg:col-span-1 md:hidden">
                                                        <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest block">Subtotal</span>
                                                        <span className="text-lg font-black text-slate-300">{formatCurrency(item.subtotal)}</span>
                                                    </div>
                                                    {/* Space for the button on LG */}
                                                    <div className="lg:col-span-2 flex items-center justify-end">
                                                        <button
                                                            onClick={() => handleSelect(item)}
                                                            className="w-full lg:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-emerald-500/10 group/itembtn"
                                                        >
                                                            <span className="text-xs uppercase tracking-widest">Iniciar Devolución</span>
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
                            <div className="relative mb-10">
                                <div className="absolute inset-0 bg-rose-500/10 rounded-full blur-3xl scale-150 group-hover:scale-200 transition-transform duration-1000" />
                                <div className="w-32 h-32 glass-card rounded-[3rem] flex items-center justify-center relative z-10 border-white/10 group-hover:rotate-6 transition-all duration-700">
                                    <PackageOpen className="w-16 h-16 text-slate-800" />
                                </div>
                            </div>
                            <h3 className="text-3xl font-black text-slate-700 uppercase italic tracking-tighter">Esperando Registro</h3>
                            <p className="text-slate-600 mt-3 max-w-sm mx-auto font-medium text-sm leading-relaxed tracking-wide">
                                Ingrese el identificador de una salida registrada para procesar el retorno de materiales al inventario general.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* PROCESS MODAL */}
            {selectedItem && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="glass-card w-full h-full md:h-auto md:max-w-2xl bg-slate-900 shadow-[0_50px_100px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 rounded-[2.5rem]">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-white/5 flex justify-between items-center shrink-0 bg-white/[0.02]">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                                    <RotateCcw className="w-7 h-7 text-black" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-tight">Configurar Retorno</h3>
                                    <p className="text-rose-400 font-black text-[10px] uppercase tracking-[0.2em] mt-1 opacity-80 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                        Asociado a Salida ID: #{selectedItem.id_salida}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-4 glass-button rounded-2xl text-slate-400 hover:text-white transition-all shadow-xl"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                            {/* Selected Item Detail */}
                            <div className="bg-black/40 rounded-3xl p-6 flex gap-6 items-center border border-white/5 shadow-inner">
                                <div className="w-20 h-20 bg-slate-900 rounded-2xl overflow-hidden shrink-0 border border-white/10 p-1">
                                    <img
                                        src={selectedItem.articulo_01.imagen_url || ''}
                                        className="w-full h-full object-cover rounded-xl"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-black text-white text-xl uppercase italic tracking-tight truncate">{selectedItem.articulo_01.nombre_articulo}</h4>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[10px] font-black text-rose-500/80 uppercase tracking-widest px-2 py-0.5 rounded-md bg-rose-500/5 border border-rose-500/10 font-mono">{selectedItem.articulo}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-800" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedItem.articulo_01.marca}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-4">
                                        <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                            <p className="text-[11px] font-black text-emerald-400">
                                                Disponible: {selectedItem.cantidad} {selectedItem.articulo_01.unidad}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Inputs Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block px-1 ml-1">Cantidad a devolver</label>
                                    <div className="relative group/num">
                                        <input
                                            type="number"
                                            value={cantidadDev}
                                            onChange={(e) => setCantidadDev(e.target.value)}
                                            placeholder="0"
                                            className={`w-full bg-slate-950/80 border rounded-2xl p-6 text-white text-4xl font-black placeholder:text-slate-900 focus:outline-none transition-all shadow-inner
                                                ${parseFloat(cantidadDev) > selectedItem.cantidad
                                                    ? 'border-rose-500 ring-2 ring-rose-500/20 text-rose-500'
                                                    : 'border-white/10 focus:ring-2 focus:ring-emerald-500/30'
                                                }
                                            `}
                                            autoFocus
                                        />
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center">
                                            <span className="text-slate-600 font-black text-[10px] uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md">
                                                {selectedItem.articulo_01.unidad}
                                            </span>
                                        </div>
                                    </div>
                                    {parseFloat(cantidadDev) > selectedItem.cantidad && (
                                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-2 animate-in fade-in slide-in-from-top-1">
                                            ⚠️ Excede el disponible ({selectedItem.cantidad})
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block px-1 ml-1">Motivo Principal</label>
                                    <div className="relative">
                                        <select
                                            value={motivoDev}
                                            onChange={(e) => setMotivoDev(e.target.value)}
                                            className="w-full bg-slate-950/80 border border-white/10 rounded-2xl p-6 text-white font-black text-sm uppercase tracking-widest outline-none cursor-pointer appearance-none focus:ring-2 focus:ring-emerald-500/30 shadow-inner pr-12 transition-all"
                                        >
                                            <option value="" disabled className="bg-slate-900">-- SELECCIONE --</option>
                                            <option value="Material en exceso" className="bg-slate-900">Material en exceso</option>
                                            <option value="Material defectuoso" className="bg-slate-900">Material defectuoso</option>
                                            <option value="Cambio en proyecto" className="bg-slate-900">Cambio en proyecto</option>
                                            <option value="Material no utilizado" className="bg-slate-900">Material no utilizado</option>
                                            <option value="Error en salida" className="bg-slate-900">Error en salida</option>
                                            <option value="Otros" className="bg-slate-900">Otros (Especificar)</option>
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none p-1 bg-white/5 rounded-lg border border-white/10">
                                            <ChevronRight className="w-5 h-5 text-emerald-500 rotate-90" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {motivoDev === 'Otros' && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block px-2 flex items-center gap-3">
                                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                                        Especificaciones del Ajuste
                                    </label>
                                    <textarea
                                        value={otroMotivo}
                                        onChange={(e) => setOtroMotivo(e.target.value)}
                                        placeholder="Describa el motivo detalladamente..."
                                        className="w-full bg-slate-950/80 border border-white/10 rounded-[1.5rem] p-6 text-white font-bold placeholder-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/30 min-h-[140px] shadow-inner transition-all resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 bg-white/5 border-t border-white/5 flex flex-col md:flex-row gap-5 shrink-0">
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="flex-1 py-5 glass-button text-slate-500 hover:text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] transition-all"
                            >
                                Cancelar Operación
                            </button>
                            <button
                                onClick={validateAndConfirm}
                                disabled={!cantidadDev || parseFloat(cantidadDev) <= 0 || parseFloat(cantidadDev) > selectedItem.cantidad || !motivoDev}
                                className={`flex-1 py-5 font-black rounded-2xl transition-all flex items-center justify-center gap-3 group/valid shadow-2xl
                                    ${(!cantidadDev || parseFloat(cantidadDev) <= 0 || parseFloat(cantidadDev) > selectedItem.cantidad || !motivoDev)
                                        ? 'bg-white/5 text-slate-600 border border-white/5 opacity-50 cursor-not-allowed'
                                        : 'bg-emerald-500 text-black hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] shadow-emerald-500/20'
                                    }
                                `}
                            >
                                <span className="text-[11px] uppercase tracking-[0.2em]">Verificar y Continuar</span>
                                <ArrowRight className="w-6 h-6 group-hover/valid:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION SUB-MODAL */}
            {showConfirmModal && selectedItem && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="glass-card bg-slate-900 border border-rose-500/40 rounded-[3rem] shadow-[0_40px_80px_rgba(0,0,0,0.9)] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-500 p-10 relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-16 -mt-16" />

                        <div className="text-center relative z-10">
                            <div className="w-24 h-24 bg-rose-500 text-black rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3">
                                <AlertTriangle className="w-12 h-12" />
                            </div>
                            <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-4">¿Confirmar Retorno?</h3>

                            <div className="space-y-6 mb-10">
                                <div className="p-5 bg-black/40 rounded-2xl border border-white/5">
                                    <p className="text-slate-400 font-bold text-sm leading-relaxed tracking-wide">
                                        Procederá a devolver <span className="text-white font-black text-lg italic">{cantidadDev} {selectedItem.articulo_01.unidad}</span> de <span className="text-rose-400 font-black">{selectedItem.articulo_01.nombre_articulo}</span>.
                                    </p>
                                </div>
                                <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-lg inline-block">
                                    <p className="text-[9px] text-rose-300 font-black uppercase tracking-[0.2em]">Acción Irreversible por Sistema</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={procesarDevolucion}
                                    disabled={loading}
                                    className="w-full py-5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl shadow-[0_20px_40px_rgba(225,29,72,0.3)] hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center justify-center gap-3 group/final"
                                >
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6 group-final:scale-125 transition-transform" />}
                                    <span className="uppercase tracking-widest text-xs">Sí, Procesar Retorno</span>
                                </button>
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    disabled={loading}
                                    className="w-full py-4 text-slate-500 hover:text-white font-black uppercase tracking-[0.3em] text-[10px] transition-all"
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
