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
    Loader2
} from 'lucide-react';

import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import { Articulo, DetalleSalida, Colaborador } from '../types/inventory';

export default function RealizarSalida() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

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
    const [numeroSolicitud, setNumeroSolicitud] = useState('');
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

    // Initialize
    useEffect(() => {
        const now = new Date();
        setFechaActual(now.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }));

        const numSol = searchParams.get('numero');
        if (numSol) setNumeroSolicitud(numSol);

        fetchColaboradores();
    }, []);

    // Load Data
    const fetchColaboradores = async () => {
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

    const fetchInventario = async (page = 1, append = false) => {
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
                if (codigos.length > 0) {
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
            await fetchInventario(1);
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
            // Reset the only row instead of deleting if it's the last one
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
            showAlert('Debe seleccionar responsable y quien retira', 'warning');
            return;
        }

        if (!numeroSolicitud) {
            showAlert('Número de solicitud requerido', 'warning');
            return;
        }

        const validItems = items.filter(d => d.codigo_articulo && Number(d.cantidad) > 0);
        if (validItems.length === 0) {
            showAlert('Debe agregar al menos un artículo válido con cantidad mayor a 0', 'warning');
            return;
        }

        // Validate limits
        const exceedsLimit = validItems.some(d => d.cantidad_disponible !== undefined && Number(d.cantidad) > d.cantidad_disponible);
        if (exceedsLimit) {
            showAlert('La cantidad de uno o más artículos supera el disponible.', 'warning');
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
                    numero_solicitud: numeroSolicitud,
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
            setTimeout(() => navigate('/cliente-interno/realizar-salidas'), 1500);

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

            {/* Feedback Alert */}
            {feedback && (
                <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-top-4">
                    <div className={`px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 ${feedback.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                        feedback.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                            feedback.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        }`}>
                        {feedback.type === 'success' && <CheckCircle className="w-5 h-5" />}
                        {feedback.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                        {feedback.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                        {feedback.type === 'info' && <Info className="w-5 h-5" />}
                        <span className="font-medium">{feedback.message}</span>
                        <button onClick={() => setFeedback(null)} className="ml-2 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto relative z-10">
                <PageHeader
                    title="REGISTRO DE SALIDA DE ARTÍCULOS"
                    icon={Box}
                    themeColor="teal"
                />

                <div className="flex items-center gap-2 text-gray-400 font-medium mt-2 mb-6 px-1">
                    <Calendar className="w-4 h-4 text-teal-400" />
                    {fechaActual}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Section 1: Info (Premium Selectors) */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl">
                        <div className="flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
                            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                <User className="w-6 h-6 text-teal-400" />
                            </div>
                            <h3 className="text-xl font-bold">Información de la Salida</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            {/* Responsable Autoriza */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">
                                    Responsable que autoriza <span className="text-red-400">*</span>
                                </label>
                                <div
                                    onClick={() => handleOpenBusqueda('autoriza')}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-white cursor-pointer hover:bg-white/10 hover:border-teal-500/50 transition-all flex items-center justify-between group shadow-inner"
                                >
                                    <span className={autoriza ? 'text-white font-medium' : 'text-gray-500 italic'}>
                                        {autoriza
                                            ? colaboradores.autorizados.find(c => c.identificacion === autoriza)?.colaborador
                                            : '-- Seleccione un responsable --'}
                                    </span>
                                    <Search className="w-5 h-5 text-gray-500 group-hover:text-teal-400 transition-colors" />
                                </div>
                            </div>

                            {/* Persona que Retira */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">
                                    Persona que retira <span className="text-red-400">*</span>
                                </label>
                                <div
                                    onClick={() => handleOpenBusqueda('retira')}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-white cursor-pointer hover:bg-white/10 hover:border-teal-500/50 transition-all flex items-center justify-between group shadow-inner"
                                >
                                    <span className={retira ? 'text-white font-medium' : 'text-gray-500 italic'}>
                                        {retira
                                            ? colaboradores.retirantes.find(c => c.identificacion === retira)?.colaborador
                                            : '-- Seleccione quien retira --'}
                                    </span>
                                    <Search className="w-5 h-5 text-gray-500 group-hover:text-teal-400 transition-colors" />
                                </div>
                            </div>

                            {/* Número de Solicitud */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">
                                    Número de solicitud <span className="text-red-400">*</span>
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-teal-400 font-bold group-focus-within:scale-110 transition-transform">#</div>
                                    <input
                                        type="text"
                                        value={numeroSolicitud}
                                        onChange={(e) => setNumeroSolicitud(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-5 text-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all placeholder-gray-600 font-mono shadow-inner"
                                        placeholder="Ingrese número de solicitud"
                                        required
                                        readOnly={!!searchParams.get('numero')}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Inline Comments */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-400 ml-1">Comentarios</label>
                            <textarea
                                value={comentarios}
                                onChange={(e) => setComentarios(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none min-h-[120px] transition-all placeholder-gray-600 resize-none shadow-inner"
                                placeholder="Detalles adicionales sobre esta salida..."
                            />
                        </div>
                    </div>

                    {/* Section 2: Articles Table */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl">
                        <TransactionTable
                            items={items}
                            onUpdateRow={updateDetalle}
                            onRemoveRow={eliminarFila}
                            onOpenSearch={handleOpenArticulos}
                            onAddRow={agregarFila}
                            onWarning={(msg) => showAlert(msg, 'warning')}
                            themeColor="teal"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end items-center pt-4">

                        {!finalizado ? (
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00fff0] text-black font-bold rounded-xl hover:shadow-[0_0_25px_rgba(0,212,255,0.4)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Guardar Salida
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleFinalizar}
                                disabled={loading}
                                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-400 text-white font-bold rounded-xl hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed animate-in zoom-in"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                                Imprimir y Finalizar
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Modal: Colaborador Search */}
            {showBusquedaModal && (
                <ColaboradorSearchModal
                    isOpen={showBusquedaModal}
                    onClose={() => setShowBusquedaModal(false)}
                    onSelect={handleSelectColaborador}
                    colaboradores={busquedaTipo === 'autoriza' ? colaboradores.autorizados : colaboradores.retirantes}
                    title={busquedaTipo === 'autoriza' ? 'Seleccionar Responsable' : 'Seleccionar Quien Retira'}
                />
            )}

            {/* Modal: Article Search (Galaxy Version) */}
            {showArticulosModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setShowArticulosModal(false)} />

                    <div className="relative w-full max-w-5xl bg-[#0f111a]/90 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-teal-500/10 to-cyan-500/10 shrink-0">
                            <div>
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <Search className="w-6 h-6 text-teal-400" />
                                    Búsqueda de Artículos
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">Seleccione los artículos para el registro de salida</p>
                            </div>
                            <button
                                onClick={() => setShowArticulosModal(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Article List Search */}
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

                        {/* Article List */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {inventoryLoading && inventario.length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
                                        <Loader2 className="w-12 h-12 text-teal-500 animate-spin" />
                                        <p className="text-gray-400 animate-pulse text-lg">Cargando inventario galáctico...</p>
                                    </div>
                                ) : (
                                    filteredArticulos.map((art) => (
                                        <div
                                            key={art.codigo_articulo}
                                            onClick={() => handleSelectArticulo(art)}
                                            className="group relative bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 hover:border-teal-500/50 transition-all cursor-pointer flex flex-col h-full shadow-lg hover:shadow-teal-500/10"
                                        >
                                            {/* Article Image */}
                                            <div className="relative aspect-square rounded-xl overflow-hidden mb-4 bg-black/40 border border-white/5">
                                                <img
                                                    src={art.imagen_url || 'https://via.placeholder.com/300?text=Sin+Imagen'}
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
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                                <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold text-teal-400 border border-teal-500/30 uppercase tracking-widest pointer-events-none">
                                                    {art.unidad}
                                                </div>
                                            </div>

                                            {/* Article Info */}
                                            <div className="flex-1">
                                                <h4 className="font-bold text-white group-hover:text-teal-400 transition-colors mb-2 leading-tight">
                                                    {art.nombre_articulo}
                                                </h4>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/5 tracking-tighter">
                                                        {art.codigo_articulo}
                                                    </span>
                                                    {art.marca && (
                                                        <span className="text-[10px] uppercase font-bold text-gray-400">
                                                            • {art.marca}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Stock & Action */}
                                            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-500 uppercase font-medium">Disponible</span>
                                                    <span className={`text-lg font-black ${art.cantidad_disponible > 0 ? 'text-teal-400' : 'text-red-400'}`}>
                                                        {art.cantidad_disponible}
                                                    </span>
                                                </div>
                                                <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center group-hover:bg-teal-500 group-hover:text-black transition-all shadow-inner">
                                                    <PlusCircle className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Pagination Button */}
                            {inventario.length < totalInventory && (
                                <div className="mt-12 text-center pb-8 border-t border-white/10 pt-8">
                                    <button
                                        onClick={() => {
                                            const nextPage = inventoryPage + 1;
                                            setInventoryPage(nextPage);
                                            fetchInventario(nextPage, true);
                                        }}
                                        disabled={inventoryLoading}
                                        className="inline-flex items-center gap-2 px-8 py-3 bg-white/5 hover:bg-white/10 text-teal-400 rounded-xl transition-all border border-white/10 hover:border-teal-500/30 disabled:opacity-50 font-bold"
                                    >
                                        {inventoryLoading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Cargando más galaxias...
                                            </>
                                        ) : (
                                            'Explorar más artículos'
                                        )}
                                    </button>
                                    <p className="text-xs text-gray-500 mt-3 font-mono">
                                        Viendo {inventario.length} de {totalInventory} artículos espaciales
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Image Modal (Standard) */}
            {showImageModal && selectedImage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in"
                    onClick={() => setShowImageModal(false)}
                >
                    <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowImageModal(false)}
                            className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <img
                            src={selectedImage.src}
                            alt={selectedImage.alt}
                            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
                        />
                        <p className="mt-4 text-white font-bold text-center text-lg">{selectedImage.alt}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// Support Icons (Empty as we use lucide-react)
