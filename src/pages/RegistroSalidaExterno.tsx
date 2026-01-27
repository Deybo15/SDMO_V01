import { useState, useEffect, useMemo } from 'react';
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
    ArrowLeft,
    ChevronRight,
    Edit,
    Shield
} from 'lucide-react';
import { cn } from '../lib/utils';

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
    const [colaboradores, setColaboradores] = useState<{ autorizados: Colaborador[], todos: Colaborador[] }>({
        autorizados: [],
        todos: []
    });
    const [inventario, setInventario] = useState<Articulo[]>([]);

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

    const themeColor = 'teal';

    // 5. Validation Logic
    const isFormValid = useMemo(() => {
        const hasAutoriza = !!autoriza;
        const hasRetira = !!retira;
        const hasValidItems = items.some(item =>
            item.codigo_articulo.trim() !== '' &&
            Number(item.cantidad) > 0
        );

        return hasAutoriza && hasRetira && hasValidItems;
    }, [autoriza, retira, items]);

    useEffect(() => {
        cargarColaboradores();
    }, []);

    // Load Data
    const cargarColaboradores = async () => {
        try {
            // 1. Get current user session
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email;

            // 2. Fetch all relevant collaborators
            const { data } = await supabase
                .from('colaboradores_06')
                .select('identificacion, alias, colaborador, autorizado, condicion_laboral, correo_colaborador')
                .or('autorizado.eq.true,condicion_laboral.eq.false');

            if (data) {
                const mappedData = data.map((c: any) => ({
                    ...c,
                    colaborador: c.colaborador || c.alias
                }));

                setColaboradores({
                    autorizados: mappedData.filter((c: any) => c.autorizado),
                    todos: mappedData
                });

                // 3. Auto-populate Profesional Responsable based on email
                if (userEmail) {
                    const matchedUser = mappedData.find(c =>
                        c.correo_colaborador?.toLowerCase() === userEmail.toLowerCase() && c.autorizado
                    );
                    if (matchedUser) {
                        setAutoriza(matchedUser.identificacion);
                    }
                }
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

            // 3. Finalize automatically to trigger MAKE
            const { error: finalError } = await supabase
                .from('salida_articulo_08')
                .update({ finalizada: true })
                .eq('id_salida', newId);

            if (finalError) throw finalError;

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
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8">
            <PageHeader
                title="Registro de Salida Externo"
                icon={Box}
                themeColor={themeColor}
            />

            <div className="max-w-6xl mx-auto">
                {/* Feedback Toast */}
                {feedback && (
                    <div className={`fixed top-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${feedback.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                        feedback.type === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' :
                            feedback.type === 'warning' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' :
                                'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        }`}>
                        {feedback.type === 'success' && <CheckCircle className="w-5 h-5" />}
                        {feedback.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                        {feedback.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                        {feedback.type === 'info' && <Info className="w-5 h-5" />}
                        <span className="font-bold">{feedback.message}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Section 1: Header Information */}
                    <div className="bg-[#1e2235] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
                            <Info className={`w-5 h-5 text-${themeColor}-400`} />
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Información de la Salida Externa</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {/* Autoriza Selector */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 block">Responsable (Autoriza)</label>
                                <div
                                    className="group relative bg-black/10 border border-white/5 rounded-2xl p-4 cursor-not-allowed transition-all flex items-center justify-between shadow-inner"
                                    title="Campo bloqueado por auditoría: Se asigna automáticamente al responsable titular."
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-white/5">
                                            <Shield className="w-5 h-5 text-teal-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block truncate font-bold text-slate-300">
                                                {colaboradores.todos.find(c => c.identificacion === autoriza)?.alias || colaboradores.todos.find(c => c.identificacion === autoriza)?.colaborador || 'Cargando responsable...'}
                                            </span>
                                            {autoriza && <span className="text-[9px] text-gray-500 font-mono tracking-tighter uppercase">Asignado: {autoriza}</span>}
                                        </div>
                                    </div>
                                    <Shield className="w-4 h-4 text-slate-700 shrink-0" />
                                </div>
                            </div>

                            {/* Retira Selector */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 block">Entregado a (Retira)</label>
                                <div
                                    onClick={() => handleOpenBusqueda('retira')}
                                    className="group relative bg-black/30 border border-white/10 rounded-2xl p-4 cursor-pointer hover:bg-white/5 hover:border-teal-500/30 transition-all flex items-center justify-between shadow-inner"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl bg-${themeColor}-500/10 flex items-center justify-center shrink-0 border border-teal-500/10`}>
                                            <User className={`w-5 h-5 text-${themeColor}-400 group-hover:scale-110 transition-transform`} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className={`block truncate font-bold ${retira ? 'text-white' : 'text-gray-600 italic text-sm'}`}>
                                                {colaboradores.todos.find((c: any) => c.identificacion === retira)?.colaborador || 'Seleccionar...'}
                                            </span>
                                            {retira && <span className="text-[9px] text-gray-500 font-mono tracking-tighter uppercase">{retira}</span>}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-700 group-hover:translate-x-1 transition-transform shrink-0" />
                                </div>
                            </div>

                            {/* Solicitud Input */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 block">Número de Solicitud</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-teal-400 font-black italic">#</div>
                                    <input
                                        type="text"
                                        value={numeroSolicitud}
                                        readOnly
                                        className="w-full bg-black/10 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-slate-400 font-bold cursor-not-allowed opacity-80 shadow-inner"
                                        placeholder="Sin número..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 block">Observaciones adicionales</label>
                            <div className="relative group">
                                <Info className="absolute left-5 top-5 w-5 h-5 text-gray-600 group-focus-within:text-teal-400 transition-colors" />
                                <textarea
                                    value={comentarios}
                                    onChange={(e) => setComentarios(e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-medium placeholder-gray-700 focus:outline-none focus:border-teal-500/50 transition-all shadow-inner min-h-[120px] resize-none"
                                    placeholder="Detalles sobre la entrega, destino o requerimientos especiales..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Items Table */}
                    <div className="bg-[#1e2235] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
                            <Box className={`w-5 h-5 text-${themeColor}-400`} />
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Artículos a Retirar</h3>
                        </div>
                        <TransactionTable
                            items={items}
                            onUpdateRow={updateDetalle}
                            onRemoveRow={eliminarFila}
                            onOpenSearch={handleOpenArticulos}
                            onAddRow={agregarFila}
                            onWarning={(msg) => showAlert(msg, 'warning')}
                            themeColor={themeColor}
                        />
                    </div>

                    {/* Form Controls */}
                    <div className="flex justify-between items-center pt-4">
                        <button
                            type="button"
                            onClick={() => navigate('/cliente-externo/realizar')}
                            className="px-8 py-4 border border-white/10 rounded-2xl text-gray-500 font-black uppercase text-xs tracking-widest hover:bg-white/5 hover:text-white transition-all flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Cancelar
                        </button>

                        {!finalizado ? (
                            <button
                                type="submit"
                                disabled={loading || !isFormValid}
                                className={cn(
                                    "px-12 py-5 text-white font-black text-xl rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl uppercase tracking-tight",
                                    (loading || !isFormValid)
                                        ? "bg-slate-700 opacity-50 cursor-not-allowed shadow-none"
                                        : "bg-gradient-to-r from-teal-600 to-teal-400 hover:brightness-110 active:scale-95 shadow-teal-500/20"
                                )}
                            >
                                {loading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Save className="w-7 h-7" />}
                                Procesar Salida
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="px-12 py-5 bg-gradient-to-r from-emerald-600 to-emerald-400 text-white font-black text-xl rounded-2xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 uppercase tracking-tight"
                            >
                                <PlusCircle className="w-7 h-7" />
                                Nueva Salida
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
                    colaboradores={busquedaTipo === 'autoriza'
                        ? colaboradores.autorizados
                        : colaboradores.todos.filter(c => c.identificacion !== autoriza)
                    }
                    title={busquedaTipo === 'autoriza' ? 'Seleccionar Responsable' : 'Seleccionar Quien Retira'}
                />
            )}

            {/* Modal: Article Search (Galaxy Version) */}
            {showArticulosModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setShowArticulosModal(false)} />

                    <div className="relative w-full max-w-5xl bg-[#0f111a]/90 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-teal-500/10 to-cyan-500/10 shrink-0">
                            <div>
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <Search className="w-6 h-6 text-teal-400" />
                                    Buscar Artículo
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">Seleccione un artículo para agregar a la lista</p>
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
                                            cargarInventario(nextPage, true);
                                        }}
                                        disabled={inventoryLoading}
                                        className="inline-flex items-center gap-2 px-8 py-3 bg-white/5 hover:bg-white/10 text-teal-400 rounded-xl transition-all border border-white/10 hover:border-teal-500/30 disabled:opacity-50 font-bold"
                                    >
                                        {inventoryLoading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Cargando más artículos...
                                            </>
                                        ) : (
                                            'Explorar más artículos'
                                        )}
                                    </button>
                                    <p className="text-xs text-gray-500 mt-3 font-mono">
                                        Viendo {inventario.length} de {totalInventory} artículos disponibles
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Image Modal */}
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
