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
    Shield,
    ClipboardList
} from 'lucide-react';
import { cn } from '../lib/utils';

import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import HistorialMaterialesModal from '../components/HistorialMaterialesModal';
import ArticleSearchGridModal from '../components/ArticleSearchGridModal';
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
    const [showBusquedaModal, setShowBusquedaModal] = useState(false);
    const [busquedaTipo, setBusquedaTipo] = useState<'autoriza' | 'retira'>('autoriza');
    const [showArticulosModal, setShowArticulosModal] = useState(false);
    const [showHistorialModal, setShowHistorialModal] = useState(false);
    const [currentRowIndex, setCurrentRowIndex] = useState<number>(0);

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

    const handleOpenArticulos = (index: number) => {
        setCurrentRowIndex(index);
        setShowArticulosModal(true);
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
                    fecha_salida: new Date().toLocaleDateString('en-CA'),
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

            // Reset Form State
            setAutoriza('');
            setRetira('');
            setComentarios('');
            setItems([{
                codigo_articulo: '',
                articulo: '',
                cantidad: 0,
                unidad: '',
                precio_unitario: 0,
                marca: '',
                cantidad_disponible: 0
            }]);
            setFinalizado(false);
            setUltimoIdSalida(null);

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
                                <div className="relative group flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-teal-400 font-black italic">#</div>
                                        <input
                                            type="text"
                                            value={numeroSolicitud}
                                            readOnly
                                            className="w-full bg-black/10 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-slate-400 font-bold cursor-not-allowed opacity-80 shadow-inner"
                                            placeholder="Sin número..."
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowHistorialModal(true)}
                                        disabled={!numeroSolicitud}
                                        className="px-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed group/btn"
                                        title="Ver historial de materiales entregados"
                                    >
                                        <ClipboardList className="w-6 h-6 group-hover/btn:scale-110 transition-transform" />
                                    </button>
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

            {/* Modal: Article Search (Galaxy Version Centralized) */}
            <ArticleSearchGridModal
                isOpen={showArticulosModal}
                onClose={() => setShowArticulosModal(false)}
                onSelect={handleSelectArticulo}
                themeColor="teal"
                title="BUSCADOR"
                showOnlyAvailable={true}
            />
            {/* Historial Modal */}
            <HistorialMaterialesModal
                isOpen={showHistorialModal}
                onClose={() => setShowHistorialModal(false)}
                numeroSolicitud={numeroSolicitud}
            />
        </div>
    );
}

// Support Icons (Empty as we use lucide-react)
