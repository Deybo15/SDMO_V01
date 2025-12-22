import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box,
    Calendar,
    User,
    Search,
    PlusCircle,
    Save,
    Printer,
    X,
    CheckCircle,
    AlertTriangle,
    Info,
    Loader2,
    ArrowLeft
} from 'lucide-react';

import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import { Articulo, DetalleSalida, Colaborador } from '../types/inventory';

export default function RegistroSalidaExterno() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const numeroSolicitudParam = searchParams.get('numero');

    // 1. Transaction State
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ message: string, type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
    const [items, setItems] = useState<DetalleSalida[]>([{
        codigo_articulo: '',
        articulo: '',
        cantidad: 0,
        unidad: '',
        precio_unitario: 0,
        marca: '',
        cantidad_disponible: 0
    }]);

    // 2. Header State
    const [autoriza, setAutoriza] = useState('');
    const [retira, setRetira] = useState('');
    const [numeroSolicitud] = useState(numeroSolicitudParam || '');
    const [comentarios, setComentarios] = useState('');
    const [finalizado, setFinalizado] = useState(false);
    const [ultimoIdSalida, setUltimoIdSalida] = useState<number | null>(null);

    // 3. Data State
    const [colaboradores, setColaboradores] = useState<{ autorizados: Colaborador[], retirantes: Colaborador[] }>({
        autorizados: [],
        retirantes: []
    });
    const [inventario, setInventario] = useState<Articulo[]>([]);
    const [fechaActual, setFechaActual] = useState('');

    // 4. Modals State
    const [showBusquedaModal, setShowBusquedaModal] = useState(false);
    const [busquedaTipo, setBusquedaTipo] = useState<'autoriza' | 'retira'>('autoriza');
    const [showArticulosModal, setShowArticulosModal] = useState(false);
    const [currentRowIndex, setCurrentRowIndex] = useState<number>(0);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string } | null>(null);
    const [articuloTermino, setArticuloTermino] = useState('');

    // Inventory Controls
    const [inventoryPage, setInventoryPage] = useState(1);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [totalInventory, setTotalInventory] = useState(0);
    const ITEMS_PER_PAGE = 1000;

    // Effects
    useEffect(() => {
        const now = new Date();
        setFechaActual(now.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }));
        cargarColaboradores();
        // Removed agregarFila() to prevent duplicate rows in strict mode
    }, []);

    // Load Data
    const cargarColaboradores = async () => {
        try {
            const { data } = await supabase
                .from('colaboradores_06')
                .select('identificacion, alias, colaborador, autorizado, condicion_laboral')
                .or('autorizado.eq.true,condicion_laboral.eq.false');

            if (data) {
                setColaboradores({
                    autorizados: data.filter((c: any) => c.autorizado).map((c: any) => ({
                        ...c,
                        colaborador: c.colaborador || c.alias
                    })),
                    retirantes: data.filter((c: any) => !c.autorizado).map((c: any) => ({
                        ...c,
                        colaborador: c.colaborador || c.alias
                    }))
                });
            }
        } catch (error) {
            console.error('Error loading collaborators:', error);
            showAlert('Error al cargar colaboradores', 'error');
        }
    };

    const cargarInventario = async (page = 1, append = false) => {
        setInventoryLoading(true);
        try {
            const from = (page - 1) * ITEMS_PER_PAGE;
            const to = page * ITEMS_PER_PAGE - 1;

            const { data, error, count } = await supabase
                .from('inventario_actual')
                .select('codigo_articulo, nombre_articulo, cantidad_disponible, unidad, imagen_url, precio_unitario', { count: 'exact' })
                .order('nombre_articulo', { ascending: true })
                .range(from, to);

            if (error) throw error;

            let fetchedItems = data || [];

            // Fetch brands
            if (fetchedItems.length > 0) {
                const codigos = fetchedItems.map(i => i.codigo_articulo).filter(Boolean);
                const { data: marcas } = await supabase
                    .from('articulo_01')
                    .select('codigo_articulo, marca')
                    .in('codigo_articulo', codigos);

                const marcasMap = (marcas || []).reduce((acc: any, curr) => {
                    acc[curr.codigo_articulo] = curr.marca;
                    return acc;
                }, {});

                fetchedItems = fetchedItems.map(item => ({
                    ...item,
                    marca: marcasMap[item.codigo_articulo] || 'Sin marca'
                }));
            }

            setTotalInventory(count || 0);
            setInventario(prev => append ? [...prev, ...fetchedItems] : fetchedItems);

        } catch (error) {
            console.error('Error loading inventory:', error);
            showAlert('Error al cargar inventario', 'error');
        } finally {
            setInventoryLoading(false);
        }
    };

    // Feedback Helper
    const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 5000);
    };

    // Handlers
    const handleOpenBusqueda = (tipo: 'autoriza' | 'retira') => {
        setBusquedaTipo(tipo);
        setShowBusquedaModal(true);
    };

    const handleSelectColaborador = (colaborador: Colaborador) => {
        if (busquedaTipo === 'autoriza') setAutoriza(colaborador.identificacion);
        else setRetira(colaborador.identificacion);
        setShowBusquedaModal(false);
    };

    const handleOpenArticulos = async (index: number) => {
        setCurrentRowIndex(index);
        setShowArticulosModal(true);
        if (inventario.length === 0) {
            await cargarInventario(1);
        }
    };

    const handleSelectArticulo = (article: Articulo) => {
        if (currentRowIndex === null) return;

        // Duplicate Detection
        const exists = items.some((item, i) => i !== currentRowIndex && item.codigo_articulo === article.codigo_articulo);
        if (exists) {
            showAlert('Este artículo ya ha sido agregado a la lista.', 'warning');
            return;
        }

        setItems(prev => {
            const newItems = [...prev];
            newItems[currentRowIndex] = {
                codigo_articulo: article.codigo_articulo,
                articulo: article.nombre_articulo,
                cantidad: 0,
                unidad: article.unidad || 'Unidad',
                precio_unitario: article.precio_unitario,
                marca: article.marca || 'Sin marca',
                cantidad_disponible: article.cantidad_disponible
            };
            return newItems;
        });
        setShowArticulosModal(false);
    };

    const agregarFila = () => {
        setItems(prev => [...prev, {
            codigo_articulo: '',
            articulo: '',
            cantidad: 0,
            unidad: '',
            precio_unitario: 0,
            marca: '',
            cantidad_disponible: 0
        }]);
    };

    const eliminarFila = (index: number) => {
        if (items.length === 1) {
            setItems([{
                codigo_articulo: '',
                articulo: '',
                cantidad: 0,
                unidad: '',
                precio_unitario: 0,
                marca: '',
                cantidad_disponible: 0
            }]);
            return;
        }
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateDetalle = (index: number, field: keyof DetalleSalida, value: any) => {
        setItems(prev => {
            const newItems = [...prev];
            newItems[index] = { ...newItems[index], [field]: value };
            return newItems;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!autoriza || !retira) {
            showAlert('Debe seleccionar responsable y persona que retira', 'error');
            return;
        }

        if (!numeroSolicitud) {
            showAlert('Número de solicitud requerido', 'error');
            return;
        }

        const validItems = items.filter(d => d.codigo_articulo && Number(d.cantidad) > 0);
        if (validItems.length === 0) {
            showAlert('Debe agregar al menos un artículo válido con cantidad mayor a 0', 'error');
            return;
        }

        // Validate limits
        const exceedsLimit = validItems.some(d => d.cantidad_disponible !== undefined && Number(d.cantidad) > d.cantidad_disponible);
        if (exceedsLimit) {
            showAlert('La cantidad de uno o más artículos supera el disponible.', 'error');
            return;
        }

        setLoading(true);
        try {
            // Real-time Stock Validation
            const { data: currentStock, error: stockError } = await supabase
                .from('inventario_actual')
                .select('codigo_articulo, cantidad_disponible')
                .in('codigo_articulo', validItems.map(d => d.codigo_articulo));

            if (stockError) throw stockError;

            const stockMap = (currentStock || []).reduce((acc: any, curr) => {
                acc[curr.codigo_articulo] = curr.cantidad_disponible;
                return acc;
            }, {});

            for (const d of validItems) {
                const available = stockMap[d.codigo_articulo];
                if (available === undefined || Number(d.cantidad) > available) {
                    throw new Error(`El artículo ${d.articulo} solo tiene ${available ?? 0} disponible(s).`);
                }
            }

            // 1. Insert Header
            const { data: headerData, error: headerError } = await supabase
                .from('salida_articulo_08')
                .insert({
                    fecha_salida: new Date().toISOString(),
                    autoriza,
                    retira,
                    numero_solicitud: parseInt(numeroSolicitud),
                    comentarios
                })
                .select('id_salida')
                .single();

            if (headerError) throw headerError;

            const newId = headerData.id_salida;
            setUltimoIdSalida(newId);

            // 2. Insert Details
            const { error: detailsError } = await supabase
                .from('dato_salida_13')
                .insert(validItems.map(d => ({
                    id_salida: newId,
                    articulo: d.codigo_articulo,
                    cantidad: Number(d.cantidad),
                    precio_unitario: d.precio_unitario
                })));

            if (detailsError) throw detailsError;

            showAlert(`Salida registrada (SA-${newId.toString().padStart(4, '0')})`, 'success');
            setFinalizado(true);

        } catch (error: any) {
            console.error('Error submitting:', error);
            showAlert('Error al guardar: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalizar = async () => {
        if (!ultimoIdSalida) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('salida_articulo_08')
                .update({ finalizada: true })
                .eq('id_salida', ultimoIdSalida);

            if (error) throw error;

            showAlert('Registro finalizado correctamente', 'success');
            setTimeout(() => navigate('/cliente-externo/realizar'), 1500);

        } catch (error: any) {
            showAlert('Error al finalizar: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filtered lists
    const filteredArticulos = inventario.filter(i =>
        i.nombre_articulo.toLowerCase().includes(articuloTermino.toLowerCase()) ||
        i.codigo_articulo.toLowerCase().includes(articuloTermino.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 md:p-8 relative overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-teal-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]" />
            </div>

            {/* Alert/Feedback Toast */}
            {feedback && (
                <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
                    <div className={`px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 ${feedback.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                        feedback.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                            feedback.type === 'warning' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' :
                                'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        }`}>
                        {feedback.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                            feedback.type === 'error' ? <AlertTriangle className="w-5 h-5" /> :
                                <Info className="w-5 h-5" />}
                        <span className="font-medium">{feedback.message}</span>
                        <button onClick={() => setFeedback(null)} className="ml-2 hover:scale-110 transition-transform">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto relative z-10">
                <PageHeader
                    title="REGISTRO DE SALIDA EXTERNO"
                    icon={Box}
                    themeColor="teal"
                />

                <div className="flex items-center gap-2 text-gray-400 font-medium mt-2 mb-6 px-1">
                    <Calendar className="w-4 h-4 text-teal-400" />
                    {fechaActual}
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Header Section */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-2 h-full bg-teal-500/50" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Responsable Selector */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-400 ml-1">
                                    <User className="w-4 h-4 text-teal-400" />
                                    RESPONSABLE QUE AUTORIZA
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleOpenBusqueda('autoriza')}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:border-teal-500/50 transition-all text-left"
                                >
                                    <span className={autoriza ? 'text-white font-medium' : 'text-gray-500'}>
                                        {autoriza ? colaboradores.autorizados.find(c => c.identificacion === autoriza)?.colaborador : 'Seleccionar responsable...'}
                                    </span>
                                    <Search className="w-5 h-5 text-gray-500 group-hover:text-teal-400 transition-colors" />
                                </button>
                            </div>

                            {/* Retira Selector */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-400 ml-1">
                                    <User className="w-4 h-4 text-cyan-400" />
                                    PERSONA QUE RETIRA
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleOpenBusqueda('retira')}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:border-cyan-500/50 transition-all text-left"
                                >
                                    <span className={retira ? 'text-white font-medium' : 'text-gray-500'}>
                                        {retira ? colaboradores.retirantes.find(c => c.identificacion === retira)?.colaborador : 'Seleccionar quien retira...'}
                                    </span>
                                    <Search className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                                </button>
                            </div>

                            {/* Numero Solicitud */}
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-gray-400 ml-1">
                                    NÚMERO DE SOLICITUD
                                </label>
                                <input
                                    type="number"
                                    value={numeroSolicitud}
                                    readOnly
                                    className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 text-white opacity-60 cursor-not-allowed"
                                />
                            </div>

                            {/* Comentarios Inline */}
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-gray-400 ml-1">
                                    COMENTARIOS ADICIONALES
                                </label>
                                <textarea
                                    value={comentarios}
                                    onChange={(e) => setComentarios(e.target.value)}
                                    placeholder="Ingrese detalles adicionales aquí..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:border-teal-500/50 focus:outline-none transition-all resize-none h-[58px]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Box className="w-5 h-5 text-teal-400" />
                                LISTADO DE ARTÍCULOS
                            </h3>
                            <button
                                type="button"
                                onClick={agregarFila}
                                className="px-5 py-2.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 rounded-xl font-bold transition-all flex items-center gap-2 group"
                            >
                                <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                AGREGAR FILA
                            </button>
                        </div>

                        <TransactionTable
                            items={items}
                            onUpdateRow={updateDetalle}
                            onRemoveRow={eliminarFila}
                            onOpenSearch={handleOpenArticulos}
                            onAddRow={agregarFila}
                            onWarning={(msg) => showAlert(msg, 'warning')}
                            themeColor="teal"
                        />

                        {/* Summary / Actions */}
                        <div className="p-8 bg-black/20 flex flex-col md:flex-row justify-between items-center gap-6">
                            <button
                                type="button"
                                onClick={() => navigate('/cliente-externo/realizar')}
                                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-medium"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                REGRESAR AL MENÚ
                            </button>

                            <div className="flex gap-4">
                                {!finalizado ? (
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-10 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-black font-black rounded-2xl hover:shadow-[0_0_30px_rgba(20,184,166,0.4)] transition-all flex items-center gap-3 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                                        GUARDAR REGISTRO
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleFinalizar}
                                        disabled={loading}
                                        className="px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black rounded-2xl hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all flex items-center gap-3 active:scale-95"
                                    >
                                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}
                                        IMPRIMIR Y FINALIZAR
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {/* Modals */}
            <ColaboradorSearchModal
                isOpen={showBusquedaModal}
                onClose={() => setShowBusquedaModal(false)}
                onSelect={handleSelectColaborador}
                colaboradores={busquedaTipo === 'autoriza' ? colaboradores.autorizados : colaboradores.retirantes}
                title={busquedaTipo === 'autoriza' ? 'Seleccionar Responsable' : 'Seleccionar Quien Retira'}
            />

            {/* Galaxy Article Modal */}
            {showArticulosModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-6xl bg-[#0f1117] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh] relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500" />

                        {/* Header */}
                        <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                                    <Box className="w-8 h-8 text-teal-400" />
                                    CATÁLOGO GALÁCTICO
                                </h3>
                                <p className="text-gray-500 text-sm mt-1">Seleccione el artículo para añadir a la transacción</p>
                            </div>
                            <button
                                onClick={() => setShowArticulosModal(false)}
                                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-all group"
                            >
                                <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-8 py-4 bg-black/20 border-b border-white/5">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-teal-400 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar por código o nombre del artículo..."
                                    value={articuloTermino}
                                    onChange={(e) => setArticuloTermino(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white outline-none focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5 transition-all"
                                />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {inventoryLoading && inventario.length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
                                        <Loader2 className="w-12 h-12 text-teal-500 animate-spin" />
                                        <p className="text-gray-400 animate-pulse text-lg">Cargando inventario...</p>
                                    </div>
                                ) : (
                                    filteredArticulos.map((art) => (
                                        <div
                                            key={art.codigo_articulo}
                                            onClick={() => handleSelectArticulo(art)}
                                            className="group bg-white/5 border border-white/10 rounded-[2rem] p-4 hover:bg-white/[0.08] hover:border-teal-500/30 transition-all duration-500 cursor-pointer relative overflow-hidden flex flex-col h-full"
                                        >
                                            <div className="aspect-square rounded-2xl bg-black/40 border border-white/5 mb-4 overflow-hidden relative">
                                                <img
                                                    src={art.imagen_url || 'https://via.placeholder.com/150?text=No+Image'}
                                                    alt={art.nombre_articulo}
                                                    onClick={(e) => {
                                                        if (art.imagen_url) {
                                                            e.stopPropagation();
                                                            setSelectedImage({ src: art.imagen_url, alt: art.nombre_articulo });
                                                            setShowImageModal(true);
                                                        }
                                                    }}
                                                    className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${art.imagen_url ? 'cursor-zoom-in' : ''}`}
                                                />
                                                <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold text-teal-400 border border-teal-500/20">
                                                    {art.codigo_articulo}
                                                </div>
                                            </div>

                                            <div className="flex-1 flex flex-col">
                                                <h4 className="text-white font-bold leading-tight group-hover:text-teal-300 transition-colors mb-2 text-pretty">
                                                    {art.nombre_articulo}
                                                </h4>
                                                <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/5">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Stock Disponible</p>
                                                        <p className={`text-xl font-black ${art.cantidad_disponible > 0 ? 'text-teal-400' : 'text-red-400'}`}>
                                                            {art.cantidad_disponible}
                                                            <span className="text-[10px] ml-1 text-gray-400 uppercase tracking-tighter">{art.unidad}</span>
                                                        </p>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 group-hover:bg-teal-500 group-hover:text-black transition-all">
                                                        <PlusCircle size={20} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Footer Info */}
                        <div className="px-8 py-4 bg-black/40 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500 gap-4">
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-teal-500" /> {inventario.length} Artículos Cargados</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500" /> Página {inventoryPage} de {Math.ceil(totalInventory / ITEMS_PER_PAGE)}</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const nextPage = inventoryPage + 1;
                                        setInventoryPage(nextPage);
                                        cargarInventario(nextPage, true);
                                    }}
                                    disabled={inventoryLoading || inventario.length >= totalInventory}
                                    className="px-6 py-2 bg-white/5 hover:bg-teal-500/20 hover:text-teal-400 rounded-xl transition-all disabled:opacity-30 border border-white/10"
                                >
                                    {inventoryLoading ? 'CARGANDO...' : 'CARGAR MÁS ARTÍCULOS'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox / Image Preview */}
            {showImageModal && selectedImage && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-in fade-in duration-300" onClick={() => setShowImageModal(false)}>
                    <div className="relative max-w-4xl max-h-[90vh] group" onClick={e => e.stopPropagation()}>
                        <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                        <img
                            src={selectedImage.src}
                            alt={selectedImage.alt}
                            className="relative max-w-full max-h-[85vh] rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                        />
                        <button
                            onClick={() => setShowImageModal(false)}
                            className="absolute -top-4 -right-4 w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center font-black hover:scale-110 active:scale-95 transition-all shadow-2xl z-10"
                        >
                            <X size={24} />
                        </button>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-black/60 backdrop-blur-md rounded-2xl text-white font-bold border border-white/10 shadow-2xl whitespace-nowrap">
                            {selectedImage.alt}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
