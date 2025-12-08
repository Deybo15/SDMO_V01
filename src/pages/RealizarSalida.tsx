import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box,
    Calendar,
    FileText,
    User,
    Search,
    MessageSquare,
    PlusCircle,
    Save,
    Printer,
    Trash2,
    X,
    CheckCircle,
    AlertTriangle,
    Info,
    Loader2
} from 'lucide-react';

// Interfaces
interface Colaborador {
    identificacion: string;
    alias?: string;
    colaborador?: string;
}

interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
    cantidad_disponible: number;
    unidad: string;
    imagen_url: string | null;
    precio_unitario: number;
    marca?: string;
}

interface DetalleSalida {
    codigo_articulo: string;
    articulo: string;
    cantidad: number | string;
    unidad: string;
    precio_unitario: number;
    marca: string;
    cantidad_disponible?: number;
}

interface Feedback {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

export default function RealizarSalida() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // State
    const [fechaActual, setFechaActual] = useState('');
    const [responsables, setResponsables] = useState<Colaborador[]>([]);
    const [retirantes, setRetirantes] = useState<Colaborador[]>([]);
    const [inventario, setInventario] = useState<Articulo[]>([]);

    const [formData, setFormData] = useState({
        autoriza: '',
        retira: '',
        numero_solicitud: '',
        comentarios: ''
    });

    const [detalles, setDetalles] = useState<DetalleSalida[]>([{
        codigo_articulo: '',
        articulo: '',
        cantidad: 0,
        unidad: '',
        precio_unitario: 0,
        marca: '',
        cantidad_disponible: 0
    }]);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [loading, setLoading] = useState(false);
    const [finalizado, setFinalizado] = useState(false);
    const [ultimoIdSalida, setUltimoIdSalida] = useState<number | null>(null);

    // Modals State
    const [showComentariosModal, setShowComentariosModal] = useState(false);
    const [showBusquedaModal, setShowBusquedaModal] = useState(false);
    const [showArticulosModal, setShowArticulosModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string } | null>(null);

    // Search State
    const [busquedaTipo, setBusquedaTipo] = useState<'autoriza' | 'retira'>('autoriza');
    const [busquedaTermino, setBusquedaTermino] = useState('');
    const [articuloTermino, setArticuloTermino] = useState('');
    const [currentRowIndex, setCurrentRowIndex] = useState<number | null>(null);

    // Inventory Loading
    const [inventoryPage, setInventoryPage] = useState(1);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [totalInventory, setTotalInventory] = useState(0);
    const ITEMS_PER_PAGE = 1000; // Matching user's logic

    // Initialize
    useEffect(() => {
        const now = new Date();
        setFechaActual(now.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }));

        const numSolicitud = searchParams.get('numero');
        if (numSolicitud) {
            setFormData(prev => ({ ...prev, numero_solicitud: numSolicitud }));
        }

        cargarColaboradores();
        // Initial empty row
        // agregarFila(); // Removed to prevent double rows if state init changes, but let's check state init.
        // Actually, the user wants 1 row initially. The state initialization is empty array [], and useEffect calls agregarFila().
        // If the user sees 2 rows, it might be because of React.StrictMode double invocation or similar.
        // Let's force state initialization to have 1 row and remove the useEffect call.
    }, []);

    // Load Data
    const cargarColaboradores = async () => {
        try {
            const [{ data: autorizados }, { data: retirados }] = await Promise.all([
                supabase.from('colaboradores_06').select('identificacion, alias').eq('autorizado', true),
                supabase.from('colaboradores_06').select('identificacion, colaborador').eq('condicion_laboral', false)
            ]);
            setResponsables(autorizados || []);
            setRetirantes(retirados || []);
        } catch (error) {
            console.error('Error loading collaborators:', error);
            showFeedback('Error al cargar colaboradores', 'error');
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

            let items = data || [];

            // Fetch brands
            if (items.length > 0) {
                const codigos = items.map(i => i.codigo_articulo).filter(Boolean);
                if (codigos.length > 0) {
                    const { data: marcas } = await supabase
                        .from('articulo_01')
                        .select('codigo_articulo, marca')
                        .in('codigo_articulo', codigos);

                    const marcasMap = (marcas || []).reduce((acc: any, curr) => {
                        acc[curr.codigo_articulo] = curr.marca;
                        return acc;
                    }, {});

                    items = items.map(item => ({
                        ...item,
                        marca: marcasMap[item.codigo_articulo] || 'Sin marca'
                    }));
                }
            }

            setTotalInventory(count || 0);
            setInventario(prev => append ? [...prev, ...items] : items);

            if (page === 1 && items.length > 0) {
                // Optional: show feedback
            }

        } catch (error) {
            console.error('Error loading inventory:', error);
            showFeedback('Error al cargar inventario', 'error');
        } finally {
            setInventoryLoading(false);
        }
    };

    // Handlers
    const handleOpenBusqueda = (tipo: 'autoriza' | 'retira') => {
        setBusquedaTipo(tipo);
        setBusquedaTermino('');
        setShowBusquedaModal(true);
    };

    const handleSelectColaborador = (colaborador: Colaborador) => {
        setFormData(prev => ({
            ...prev,
            [busquedaTipo]: colaborador.identificacion
        }));
        setShowBusquedaModal(false);
    };

    const handleOpenArticulos = async (index: number) => {
        setCurrentRowIndex(index);
        setArticuloTermino('');
        setShowArticulosModal(true);
        if (inventario.length === 0) {
            await cargarInventario(1);
        }
    };

    const handleSelectArticulo = (articulo: Articulo) => {
        if (currentRowIndex === null) return;

        // 1. Duplicate Detection
        const exists = detalles.some((d, i) => i !== currentRowIndex && d.codigo_articulo === articulo.codigo_articulo);
        if (exists) {
            showFeedback('Este artículo ya ha sido agregado a la lista.', 'warning');
            return;
        }

        const newDetalles = [...detalles];
        newDetalles[currentRowIndex] = {
            codigo_articulo: articulo.codigo_articulo,
            articulo: articulo.nombre_articulo,
            cantidad: 0, // Reset quantity
            unidad: articulo.unidad || 'Unidad',
            precio_unitario: articulo.precio_unitario,
            marca: articulo.marca || 'Sin marca',
            cantidad_disponible: articulo.cantidad_disponible
        };
        setDetalles(newDetalles);
        setShowArticulosModal(false);
    };

    const agregarFila = () => {
        setDetalles(prev => [...prev, {
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
        setDetalles(prev => prev.filter((_, i) => i !== index));
    };

    const updateDetalle = (index: number, field: keyof DetalleSalida, value: any) => {
        const newDetalles = [...detalles];
        newDetalles[index] = { ...newDetalles[index], [field]: value };
        setDetalles(newDetalles);
    };

    const showFeedback = (message: string, type: Feedback['type']) => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 5000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.autoriza || !formData.retira) {
            showFeedback('Debe seleccionar responsable y quien retira', 'warning');
            return;
        }

        if (!formData.numero_solicitud) {
            showFeedback('Número de solicitud requerido', 'warning');
            return;
        }

        const validDetalles = detalles.filter(d => d.codigo_articulo && Number(d.cantidad) > 0);
        if (validDetalles.length === 0) {
            showFeedback('Debe agregar al menos un artículo válido con cantidad mayor a 0', 'warning');
            return;
        }

        // Validar que no exceda la cantidad disponible (Validación inicial local)
        const exceedsLimit = validDetalles.some(d => d.cantidad_disponible !== undefined && Number(d.cantidad) > d.cantidad_disponible);
        if (exceedsLimit) {
            showFeedback('La cantidad de uno o más artículos supera el disponible en inventario.', 'warning');
            return;
        }

        setLoading(true);
        try {
            // 2. Real-time Stock Validation
            const codigos = validDetalles.map(d => d.codigo_articulo);
            const { data: currentStock, error: stockError } = await supabase
                .from('inventario_actual')
                .select('codigo_articulo, cantidad_disponible')
                .in('codigo_articulo', codigos);

            if (stockError) throw stockError;

            // Check if any item exceeds the REAL-TIME available quantity
            const stockMap = (currentStock || []).reduce((acc: any, curr) => {
                acc[curr.codigo_articulo] = curr.cantidad_disponible;
                return acc;
            }, {});

            for (const d of validDetalles) {
                const realAvailable = stockMap[d.codigo_articulo];
                if (realAvailable === undefined || Number(d.cantidad) > realAvailable) {
                    throw new Error(`El artículo ${d.articulo} solo tiene ${realAvailable ?? 0} disponible(s). Por favor ajuste la cantidad.`);
                }
            }

            // 1. Insert Header
            const { data: headerData, error: headerError } = await supabase
                .from('salida_articulo_08')
                .insert({
                    fecha_salida: new Date().toISOString(),
                    autoriza: formData.autoriza,
                    retira: formData.retira,
                    numero_solicitud: formData.numero_solicitud,
                    comentarios: formData.comentarios
                })
                .select('id_salida')
                .single();

            if (headerError) throw headerError;

            const newId = headerData.id_salida;
            setUltimoIdSalida(newId);

            // 2. Insert Details
            const detallesToInsert = validDetalles.map(d => ({
                id_salida: newId,
                articulo: d.codigo_articulo,
                cantidad: Number(d.cantidad),
                precio_unitario: d.precio_unitario
            }));

            const { error: detailsError } = await supabase
                .from('dato_salida_13')
                .insert(detallesToInsert);

            if (detailsError) throw detailsError;

            showFeedback(`Salida registrada exitosamente: SA-${newId.toString().padStart(4, '0')}`, 'success');
            setFinalizado(true);

        } catch (error: any) {
            console.error('Error submitting:', error);
            showFeedback('Error al guardar: ' + error.message, 'error');
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

            showFeedback('Registro finalizado correctamente', 'success');
            navigate('/cliente-interno/realizar-salidas');

        } catch (error: any) {
            showFeedback('Error al finalizar: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filtered lists
    const filteredColaboradores = (busquedaTipo === 'autoriza' ? responsables : retirantes).filter(c =>
        (busquedaTipo === 'autoriza' ? c.alias : c.colaborador)?.toLowerCase().includes(busquedaTermino.toLowerCase())
    );

    const filteredArticulos = inventario.filter(i =>
        i.nombre_articulo.toLowerCase().includes(articuloTermino.toLowerCase()) ||
        i.codigo_articulo.toLowerCase().includes(articuloTermino.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 md:p-8 relative overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-[#00d4ff]/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-[#00fff0]/10 rounded-full blur-[100px]" />
            </div>

            {/* Feedback Toast */}
            {feedback && (
                <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[60] animate-in slide-in-from-top-4">
                    <div className={`px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 ${feedback.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                        feedback.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                            feedback.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                                'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        }`}>
                        {feedback.type === 'success' && <CheckCircle className="w-5 h-5" />}
                        {feedback.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                        {feedback.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                        {feedback.type === 'info' && <Info className="w-5 h-5" />}
                        <span className="font-medium">{feedback.message}</span>
                        <button onClick={() => setFeedback(null)} className="ml-2 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden mb-8 shadow-2xl">
                    <div className="p-6 border-b border-white/10 bg-gradient-to-r from-[#00d4ff]/10 to-[#00fff0]/10 flex items-center justify-center relative">
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00d4ff] to-[#00fff0]" />
                        <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                            <Box className="w-6 h-6 text-[#00d4ff]" />
                            REGISTRO DE SALIDA DE ARTÍCULOS
                        </h2>
                        <button
                            onClick={() => navigate(-1)}
                            className="absolute right-6 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                            title="Cerrar"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6 md:p-8">
                        {/* Info Bar */}
                        <div className="flex flex-col md:flex-row justify-content-between items-center mb-8 gap-4">
                            <div className="flex items-center gap-2 text-gray-300">
                                <Calendar className="w-5 h-5 text-[#00d4ff]" />
                                <span className="text-lg">{fechaActual}</span>
                            </div>
                            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2">
                                <FileText className="w-4 h-4 text-[#00fff0]" />
                                <span className="text-sm font-medium">Nuevo registro</span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Section 1: Info */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-3">
                                    <User className="w-5 h-5 text-[#00d4ff]" />
                                    Información de la Salida
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Responsable que autoriza <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={formData.autoriza}
                                                onChange={(e) => setFormData({ ...formData, autoriza: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white focus:border-[#00d4ff] focus:outline-none appearance-none"
                                                required
                                            >
                                                <option value="" disabled className="bg-[#1e2330] text-white">-- Seleccione --</option>
                                                {responsables.map(r => (
                                                    <option key={r.identificacion} value={r.identificacion} className="bg-[#1e2330] text-white">{r.alias}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenBusqueda('autoriza')}
                                                className="absolute right-0 top-0 bottom-0 px-4 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 text-[#00d4ff] rounded-r-lg border-l border-white/10 transition-colors"
                                            >
                                                <Search className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Persona que retira <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={formData.retira}
                                                onChange={(e) => setFormData({ ...formData, retira: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white focus:border-[#00d4ff] focus:outline-none appearance-none"
                                                required
                                            >
                                                <option value="" disabled className="bg-[#1e2330] text-white">-- Seleccione --</option>
                                                {retirantes.map(r => (
                                                    <option key={r.identificacion} value={r.identificacion} className="bg-[#1e2330] text-white">{r.colaborador}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenBusqueda('retira')}
                                                className="absolute right-0 top-0 bottom-0 px-4 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 text-[#00d4ff] rounded-r-lg border-l border-white/10 transition-colors"
                                            >
                                                <Search className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Número de solicitud <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">#</div>
                                            <input
                                                type="text"
                                                value={formData.numero_solicitud}
                                                onChange={(e) => setFormData({ ...formData, numero_solicitud: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:border-[#00d4ff] focus:outline-none"
                                                placeholder="Ingrese número de solicitud"
                                                required
                                                readOnly={!!searchParams.get('numero')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowComentariosModal(true)}
                                        className="px-4 py-2 bg-transparent border border-[#00d4ff] text-[#00d4ff] rounded-lg hover:bg-[#00d4ff] hover:text-black transition-all flex items-center gap-2"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        Agregar Comentarios
                                    </button>
                                    {formData.comentarios && (
                                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium flex items-center gap-1 animate-in fade-in">
                                            <CheckCircle className="w-3 h-3" />
                                            Comentarios agregados
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Section 2: Articles */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                                <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-3">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Box className="w-5 h-5 text-[#00d4ff]" />
                                        Artículos a Retirar
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={agregarFila}
                                        className="px-4 py-2 bg-gradient-to-r from-[#00d4ff] to-[#00fff0] text-black font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all flex items-center gap-2"
                                    >
                                        <PlusCircle className="w-4 h-4" />
                                        Agregar Artículo
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-left text-sm text-gray-400 border-b border-white/10">
                                                <th className="pb-4 pl-2 w-[40%]">Artículo</th>
                                                <th className="pb-4 w-[15%]">Marca</th>
                                                <th className="pb-4 w-[15%]">Cantidad</th>
                                                <th className="pb-4 w-[20%]">Unidad</th>
                                                <th className="pb-4 w-[10%] text-center">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {detalles.map((detalle, index) => (
                                                <tr key={index} className="group hover:bg-white/5 transition-colors">
                                                    <td className="py-3 pl-2">
                                                        <div className="flex gap-2">
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={detalle.articulo}
                                                                    readOnly
                                                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none cursor-pointer"
                                                                    onClick={() => handleOpenArticulos(index)}
                                                                    placeholder="Seleccione un artículo..."
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenArticulos(index)}
                                                                    className="absolute right-0 top-0 bottom-0 px-3 text-[#00d4ff] hover:bg-[#00d4ff]/10 rounded-r-lg transition-colors"
                                                                >
                                                                    <Search className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3">
                                                        <input
                                                            type="text"
                                                            value={detalle.marca}
                                                            readOnly
                                                            className="w-full bg-transparent border-none text-gray-300 text-sm focus:ring-0"
                                                        />
                                                    </td>
                                                    <td className="py-3">
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={detalle.cantidad}
                                                                onFocus={() => {
                                                                    if (Number(detalle.cantidad) === 0) {
                                                                        updateDetalle(index, 'cantidad', '');
                                                                    }
                                                                }}
                                                                onBlur={() => {
                                                                    const val = detalle.cantidad;
                                                                    let finalVal = val;

                                                                    // Handle empty or invalid
                                                                    if (val === '' || val === undefined || val === '.') {
                                                                        finalVal = 0;
                                                                    } else if (String(val).endsWith('.')) {
                                                                        finalVal = String(val).slice(0, -1);
                                                                    }

                                                                    // Validate max quantity on blur - REMOVED to allow 3 decimals input without auto-clamping
                                                                    // const numVal = parseFloat(String(finalVal));
                                                                    // if (!isNaN(numVal) && detalle.cantidad_disponible !== undefined && numVal > detalle.cantidad_disponible) {
                                                                    //     finalVal = detalle.cantidad_disponible;
                                                                    // }

                                                                    updateDetalle(index, 'cantidad', finalVal);
                                                                }}
                                                                onChange={(e) => {
                                                                    const rawVal = e.target.value;

                                                                    // Permitir vacío
                                                                    if (rawVal === '') {
                                                                        updateDetalle(index, 'cantidad', '');
                                                                        return;
                                                                    }

                                                                    // Validar formato: Solo números y un punto, máx 3 decimales
                                                                    if (!/^\d*\.?\d{0,3}$/.test(rawVal)) {
                                                                        return;
                                                                    }

                                                                    // Manejo especial para punto inicial
                                                                    if (rawVal === '.') {
                                                                        updateDetalle(index, 'cantidad', '0.');
                                                                        return;
                                                                    }

                                                                    updateDetalle(index, 'cantidad', rawVal);
                                                                }}
                                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:border-[#00d4ff] focus:outline-none"
                                                                placeholder="0"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        if (index === detalles.length - 1) {
                                                                            agregarFila();
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                            {detalle.cantidad_disponible !== undefined && detalle.codigo_articulo && (
                                                                <div className="text-xs text-gray-500 mt-1 text-right">
                                                                    Máx: {detalle.cantidad_disponible}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3">
                                                        <input
                                                            type="text"
                                                            value={detalle.unidad}
                                                            readOnly
                                                            className="w-full bg-transparent border-none text-gray-300 text-sm focus:ring-0"
                                                        />
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => eliminarFila(index)}
                                                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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
                </div>
            </div >

            {/* Modal Comentarios */}
            {
                showComentariosModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                        <div className="w-full max-w-2xl bg-[#1a1d29] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-[#00d4ff]" />
                                    Comentarios Adicionales
                                </h3>
                                <button onClick={() => setShowComentariosModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6">
                                <textarea
                                    value={formData.comentarios}
                                    onChange={(e) => setFormData({ ...formData, comentarios: e.target.value })}
                                    className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-[#00d4ff] focus:outline-none resize-none"
                                    placeholder="Detalles adicionales sobre esta salida..."
                                />
                            </div>
                            <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                                <button onClick={() => setShowComentariosModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
                                <button onClick={() => setShowComentariosModal(false)} className="px-6 py-2 bg-[#00d4ff] text-black font-bold rounded-lg hover:bg-[#00fff0]">Guardar Comentarios</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal Busqueda Colaborador */}
            {
                showBusquedaModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                        <div className="w-full max-w-md bg-[#1a1d29] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white">
                                    Buscar {busquedaTipo === 'autoriza' ? 'Responsable' : 'Persona que Retira'}
                                </h3>
                                <button onClick={() => setShowBusquedaModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6">
                                <input
                                    type="text"
                                    value={busquedaTermino}
                                    onChange={(e) => setBusquedaTermino(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white mb-4 focus:border-[#00d4ff] focus:outline-none"
                                    placeholder="Escriba para buscar..."
                                    autoFocus
                                />
                                <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                                    {filteredColaboradores.length === 0 ? (
                                        <div className="text-center text-gray-500 py-4">No se encontraron resultados</div>
                                    ) : (
                                        filteredColaboradores.map(c => (
                                            <button
                                                key={c.identificacion}
                                                onClick={() => handleSelectColaborador(c)}
                                                className="w-full text-left p-3 rounded-lg hover:bg-white/5 transition-colors text-gray-300 hover:text-white"
                                            >
                                                {busquedaTipo === 'autoriza' ? c.alias : c.colaborador}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal Busqueda Articulos */}
            {
                showArticulosModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                        <div className="w-full max-w-4xl bg-[#1a1d29] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
                                <h3 className="text-xl font-bold text-white">Buscar Artículo</h3>
                                <button onClick={() => setShowArticulosModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 shrink-0">
                                <input
                                    type="text"
                                    value={articuloTermino}
                                    onChange={(e) => setArticuloTermino(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00d4ff] focus:outline-none"
                                    placeholder="Buscar por nombre o código..."
                                    autoFocus
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-[#1a1d29] z-10">
                                        <tr className="text-gray-400 border-b border-white/10">
                                            <th className="pb-3 pl-2">Imagen</th>
                                            <th className="pb-3">Artículo</th>
                                            <th className="pb-3">Marca</th>
                                            <th className="pb-3">Disponible</th>
                                            <th className="pb-3 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {inventoryLoading && inventario.length === 0 ? (
                                            <tr><td colSpan={5} className="py-8 text-center text-gray-500">Cargando inventario...</td></tr>
                                        ) : filteredArticulos.length === 0 ? (
                                            <tr><td colSpan={5} className="py-8 text-center text-gray-500">No se encontraron artículos</td></tr>
                                        ) : (
                                            filteredArticulos.slice(0, 100).map(art => (
                                                <tr key={art.codigo_articulo} className="hover:bg-white/5 transition-colors">
                                                    <td className="py-3 pl-2">
                                                        <div
                                                            className="w-10 h-10 rounded bg-white/10 overflow-hidden cursor-pointer hover:ring-2 ring-[#00d4ff]"
                                                            onClick={() => {
                                                                setSelectedImage({
                                                                    src: art.imagen_url || 'https://via.placeholder.com/150',
                                                                    alt: art.nombre_articulo
                                                                });
                                                                setShowImageModal(true);
                                                            }}
                                                        >
                                                            <img
                                                                src={art.imagen_url || 'https://via.placeholder.com/150'}
                                                                alt={art.nombre_articulo}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="py-3">
                                                        <div className="font-medium text-white">{art.nombre_articulo}</div>
                                                        <div className="text-xs text-gray-500">{art.codigo_articulo}</div>
                                                    </td>
                                                    <td className="py-3 text-gray-300">{art.marca}</td>
                                                    <td className="py-3 text-gray-300">{art.cantidad_disponible} {art.unidad}</td>
                                                    <td className="py-3 text-right">
                                                        <button
                                                            onClick={() => handleSelectArticulo(art)}
                                                            className="px-3 py-1 bg-[#00d4ff]/20 text-[#00d4ff] rounded hover:bg-[#00d4ff] hover:text-black transition-colors text-sm font-medium"
                                                        >
                                                            Seleccionar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                {filteredArticulos.length > 100 && (
                                    <div className="text-center py-4 text-gray-500 text-sm">
                                        Mostrando primeros 100 resultados de {filteredArticulos.length}...
                                    </div>
                                )}

                                {/* Load More Button */}
                                <div className="p-4 text-center border-t border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextPage = inventoryPage + 1;
                                            setInventoryPage(nextPage);
                                            cargarInventario(nextPage, true);
                                        }}
                                        disabled={inventoryLoading || inventario.length >= totalInventory}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#00d4ff] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                    >
                                        {inventoryLoading ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
                                            </span>
                                        ) : (
                                            inventario.length >= totalInventory ? 'Todos los artículos cargados' : 'Cargar más artículos'
                                        )}
                                    </button>
                                    <div className="text-xs text-gray-500 mt-2">
                                        {inventario.length} de {totalInventory} artículos cargados
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Image Modal */}
            {
                showImageModal && selectedImage && (
                    <div
                        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
                        onClick={() => setShowImageModal(false)}
                    >
                        <div className="relative max-w-3xl max-h-[90vh] p-2 bg-white/10 rounded-xl border border-white/20" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => setShowImageModal(false)}
                                className="absolute -top-4 -right-4 w-8 h-8 bg-[#00d4ff] text-black rounded-full flex items-center justify-center font-bold hover:scale-110 transition-transform"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <img
                                src={selectedImage.src}
                                alt={selectedImage.alt}
                                className="max-w-full max-h-[85vh] rounded-lg object-contain"
                            />
                        </div>
                    </div>
                )
            }
        </div >
    );
}
