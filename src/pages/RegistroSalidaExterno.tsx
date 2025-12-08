import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Search,
    PlusCircle,
    ArrowLeft,
    Save,
    Printer,
    MessageSquare,
    CheckCircle,
    Trash2,
    AlertTriangle,
    Box,
    User,
    FileText,
    Calendar,
    X,
    Loader2
} from 'lucide-react';

// Types
interface Colaborador {
    identificacion: string;
    alias?: string;
    colaborador?: string;
}

interface InventarioItem {
    codigo_articulo: string;
    nombre_articulo: string;
    cantidad_disponible: number;
    unidad: string;
    imagen_url?: string;
    precio_unitario: number;
    marca?: string;
}

interface DetalleSalida {
    id: string; // temporary id for the row
    codigo_articulo: string;
    articulo: string;
    marca: string;
    cantidad: number | string;
    unidad: string;
    precio_unitario: number;
    max_disponible: number;
}

export default function RegistroSalidaExterno() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const numeroSolicitudParam = searchParams.get('numero');

    // State
    const [loading, setLoading] = useState(false);
    const [responsables, setResponsables] = useState<Colaborador[]>([]);
    const [retirantes, setRetirantes] = useState<Colaborador[]>([]);
    const [inventario, setInventario] = useState<InventarioItem[]>([]);
    const [detalles, setDetalles] = useState<DetalleSalida[]>([{
        id: Math.random().toString(36).substr(2, 9),
        codigo_articulo: '',
        articulo: '',
        marca: '',
        cantidad: 0,
        unidad: '',
        precio_unitario: 0,
        max_disponible: 0
    }]);
    const [comentarios, setComentarios] = useState('');
    const [ultimoIdSalida, setUltimoIdSalida] = useState<number | null>(null);
    const [fechaActual, setFechaActual] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        autoriza: '',
        retira: '',
        numero_solicitud: numeroSolicitudParam || ''
    });

    // Modals State
    const [showBusquedaModal, setShowBusquedaModal] = useState(false);
    const [busquedaType, setBusquedaType] = useState<'autoriza' | 'retira' | null>(null);
    const [busquedaQuery, setBusquedaQuery] = useState('');

    const [showArticuloModal, setShowArticuloModal] = useState(false);
    const [articuloQuery, setArticuloQuery] = useState('');
    const [currentRowId, setCurrentRowId] = useState<string | null>(null);
    const [loadingInventario, setLoadingInventario] = useState(false);
    const [inventoryPage, setInventoryPage] = useState(1);
    const [totalInventory, setTotalInventory] = useState(0);

    const [showComentariosModal, setShowComentariosModal] = useState(false);
    const [tempComentarios, setTempComentarios] = useState('');

    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string } | null>(null);

    const [alert, setAlert] = useState<{ type: 'success' | 'danger', message: string } | null>(null);

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

    // Data Loading
    const cargarColaboradores = async () => {
        try {
            const { data } = await supabase
                .from('colaboradores_06')
                .select('identificacion, alias, colaborador, autorizado, condicion_laboral')
                .or('autorizado.eq.true,condicion_laboral.eq.false');

            if (data) {
                setResponsables(data.filter((c: any) => c.autorizado) || []);
                setRetirantes(data.filter((c: any) => c.condicion_laboral === false) || []);
            }
        } catch (error) {
            console.error('Error loading collaborators:', error);
        }
    };

    const cargarInventario = async (page = 1, append = false) => {
        setLoadingInventario(true);
        try {
            const itemsPerPage = 1000;
            const { data, count, error } = await supabase
                .from('inventario_actual')
                .select('codigo_articulo, nombre_articulo, cantidad_disponible, unidad, imagen_url, precio_unitario', { count: 'exact' })
                .order('nombre_articulo', { ascending: true })
                .range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

            if (error) throw error;

            let newItems = data || [];

            if (newItems.length > 0) {
                const codigos = newItems.map(i => i.codigo_articulo);
                const { data: marcasData } = await supabase
                    .from('articulo_01')
                    .select('codigo_articulo, marca')
                    .in('codigo_articulo', codigos);

                const marcasMap: Record<string, string> = {};
                marcasData?.forEach((m: any) => marcasMap[m.codigo_articulo] = m.marca);

                newItems = newItems.map(item => ({
                    ...item,
                    marca: marcasMap[item.codigo_articulo] || 'Sin marca'
                }));
            }

            setTotalInventory(count || 0);
            if (append) {
                setInventario(prev => [...prev, ...newItems]);
            } else {
                setInventario(newItems);
            }
        } catch (error) {
            console.error('Error loading inventory:', error);
            showAlert('Error al cargar inventario', 'danger');
        } finally {
            setLoadingInventario(false);
        }
    };

    // Actions
    const agregarFila = () => {
        const newRow: DetalleSalida = {
            id: Math.random().toString(36).substr(2, 9),
            codigo_articulo: '',
            articulo: '',
            marca: '',
            cantidad: 0,
            unidad: '',
            precio_unitario: 0,
            max_disponible: 0
        };
        setDetalles(prev => [...prev, newRow]);
    };

    const eliminarFila = (id: string) => {
        setDetalles(prev => prev.filter(d => d.id !== id));
    };

    const updateDetalle = (id: string, field: keyof DetalleSalida, value: any) => {
        setDetalles(prev => prev.map(d => {
            if (d.id === id) {
                return { ...d, [field]: value };
            }
            return d;
        }));
    };

    const handleSearchArticulo = (rowId: string) => {
        setCurrentRowId(rowId);
        setArticuloQuery('');
        setInventoryPage(1);
        setShowArticuloModal(true);
        cargarInventario(1, false);
    };

    const seleccionarArticulo = (item: InventarioItem) => {
        if (currentRowId) {
            setDetalles(prev => prev.map(d => {
                if (d.id === currentRowId) {
                    return {
                        ...d,
                        codigo_articulo: item.codigo_articulo,
                        articulo: item.nombre_articulo,
                        marca: item.marca || 'Sin marca',
                        unidad: item.unidad,
                        precio_unitario: item.precio_unitario,
                        max_disponible: item.cantidad_disponible,
                        cantidad: 0 // Reset quantity
                    };
                }
                return d;
            }));
        }
        setShowArticuloModal(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.autoriza || !formData.retira) {
            showAlert('Debe seleccionar responsable y persona que retira', 'danger');
            return;
        }
        if (!formData.numero_solicitud) {
            showAlert('Número de solicitud inválido', 'danger');
            return;
        }
        if (detalles.length === 0 || detalles.some(d => !d.codigo_articulo || Number(d.cantidad) <= 0)) {
            showAlert('Revise los artículos y cantidades', 'danger');
            return;
        }

        setLoading(true);
        try {
            // Insert Header
            const { data: insertedEnc, error: errEnc } = await supabase
                .from('salida_articulo_08')
                .insert([{
                    fecha_salida: new Date().toISOString(),
                    autoriza: formData.autoriza,
                    retira: formData.retira,
                    numero_solicitud: parseInt(formData.numero_solicitud),
                    comentarios: comentarios
                }])
                .select('id_salida')
                .single();

            if (errEnc) throw errEnc;

            const newId = insertedEnc.id_salida;

            // Insert Details
            const detallesParaInsertar = detalles.map(d => ({
                id_salida: newId,
                articulo: d.codigo_articulo,
                cantidad: d.cantidad,
                precio_unitario: d.precio_unitario
            }));

            const { error: errDet } = await supabase
                .from('dato_salida_13')
                .insert(detallesParaInsertar);

            if (errDet) throw errDet;

            setUltimoIdSalida(newId);
            showAlert(`Salida registrada exitosamente con folio SA-${newId.toString().padStart(4, '0')}`, 'success');

        } catch (error: any) {
            console.error('Error saving:', error);
            showAlert(`Error al guardar: ${error.message}`, 'danger');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalizar = async () => {
        if (!ultimoIdSalida) return;

        try {
            const { error } = await supabase
                .from('salida_articulo_08')
                .update({ finalizada: true })
                .eq('id_salida', ultimoIdSalida);

            if (error) throw error;

            showAlert('Registro finalizado correctamente', 'success');
            setTimeout(() => {
                navigate('/cliente-externo/realizar');
            }, 2000);
        } catch (error: any) {
            showAlert(`Error al finalizar: ${error.message}`, 'danger');
        }
    };

    const showAlert = (msg: string, type: 'success' | 'danger') => {
        setAlert({ type, message: msg });
        setTimeout(() => setAlert(null), 5000);
    };

    // Filtered lists
    const filteredResponsables = responsables.filter(r =>
        r.alias?.toLowerCase().includes(busquedaQuery.toLowerCase())
    );
    const filteredRetirantes = retirantes.filter(r =>
        r.colaborador?.toLowerCase().includes(busquedaQuery.toLowerCase())
    );
    const filteredInventario = inventario.filter(i =>
        i.nombre_articulo.toLowerCase().includes(articuloQuery.toLowerCase()) ||
        i.codigo_articulo.toLowerCase().includes(articuloQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 md:p-8 relative overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-[#00d4ff]/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-[#00fff0]/10 rounded-full blur-[100px]" />
            </div>

            {/* Alert/Feedback Toast */}
            {alert && (
                <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[60] animate-in slide-in-from-top-4">
                    <div className={`px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 ${alert.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                        'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>
                        {alert.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        <span className="font-medium">{alert.message}</span>
                        <button onClick={() => setAlert(null)} className="ml-2 hover:text-white"><X className="w-4 h-4" /></button>
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
                    </div>

                    <div className="p-6 md:p-8">
                        {/* Info Bar */}
                        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
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
                                                onChange={e => setFormData({ ...formData, autoriza: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white focus:border-[#00d4ff] focus:outline-none appearance-none"
                                                required
                                            >
                                                <option value="" className="bg-[#1e2330]">-- Seleccione --</option>
                                                {responsables.map(r => (
                                                    <option key={r.identificacion} value={r.identificacion} className="bg-[#1e2330]">
                                                        {r.alias}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => { setBusquedaType('autoriza'); setShowBusquedaModal(true); }}
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
                                                onChange={e => setFormData({ ...formData, retira: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white focus:border-[#00d4ff] focus:outline-none appearance-none"
                                                required
                                            >
                                                <option value="" className="bg-[#1e2330]">-- Seleccione --</option>
                                                {retirantes.map(r => (
                                                    <option key={r.identificacion} value={r.identificacion} className="bg-[#1e2330]">
                                                        {r.colaborador}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => { setBusquedaType('retira'); setShowBusquedaModal(true); }}
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
                                                type="number"
                                                value={formData.numero_solicitud}
                                                readOnly
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:border-[#00d4ff] focus:outline-none opacity-75 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setTempComentarios(comentarios); setShowComentariosModal(true); }}
                                        className="px-4 py-2 bg-transparent border border-[#00d4ff] text-[#00d4ff] rounded-lg hover:bg-[#00d4ff] hover:text-black transition-all flex items-center gap-2"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        Agregar Comentarios
                                    </button>
                                    {comentarios && (
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
                                            {detalles.map((detalle) => (
                                                <tr key={detalle.id} className="group hover:bg-white/5 transition-colors">
                                                    <td className="py-3 pl-2">
                                                        <div className="flex gap-2">
                                                            <div className="relative flex-1">
                                                                <select
                                                                    disabled
                                                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none appearance-none opacity-75"
                                                                    value={detalle.codigo_articulo ? detalle.codigo_articulo : ""}
                                                                >
                                                                    <option value="">{detalle.articulo || "-- Seleccione --"}</option>
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSearchArticulo(detalle.id)}
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
                                                            readOnly
                                                            value={detalle.marca}
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
                                                                        updateDetalle(detalle.id, 'cantidad', '');
                                                                    }
                                                                }}
                                                                onBlur={() => {
                                                                    const val = detalle.cantidad;
                                                                    let finalVal = val;
                                                                    if (val === '' || val === undefined || val === '.') {
                                                                        finalVal = 0;
                                                                    } else if (String(val).endsWith('.')) {
                                                                        finalVal = String(val).slice(0, -1);
                                                                    }
                                                                    updateDetalle(detalle.id, 'cantidad', finalVal);
                                                                }}
                                                                onChange={(e) => {
                                                                    const rawVal = e.target.value;
                                                                    if (rawVal === '') {
                                                                        updateDetalle(detalle.id, 'cantidad', '');
                                                                        return;
                                                                    }
                                                                    // Regex: Optional sign, number, optional dot, max 3 decimals
                                                                    if (!/^\d*\.?\d{0,3}$/.test(rawVal)) return;
                                                                    if (rawVal === '.') {
                                                                        updateDetalle(detalle.id, 'cantidad', '0.');
                                                                        return;
                                                                    }
                                                                    updateDetalle(detalle.id, 'cantidad', rawVal);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        // Add row if last one
                                                                        const idx = detalles.findIndex(d => d.id === detalle.id);
                                                                        if (idx === detalles.length - 1) {
                                                                            agregarFila();
                                                                        }
                                                                    }
                                                                }}
                                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:border-[#00d4ff] focus:outline-none"
                                                                placeholder="0"
                                                            />
                                                            {detalle.max_disponible > 0 && (
                                                                <div className="text-xs text-gray-500 mt-1 text-right">
                                                                    Máx: {detalle.max_disponible}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3">
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={detalle.unidad}
                                                            className="w-full bg-transparent border-none text-gray-300 text-sm focus:ring-0"
                                                        />
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => eliminarFila(detalle.id)}
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

                            {/* Footer Actions */}
                            <div className="flex justify-between items-center pt-4">
                                <button
                                    type="button"
                                    onClick={() => navigate('/cliente-externo/realizar')}
                                    className="px-6 py-3 rounded-xl border border-white/30 text-white hover:bg-white/10 transition-all flex items-center gap-2"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Regresar
                                </button>

                                <div className="flex gap-4">
                                    {!ultimoIdSalida ? (
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
                                            className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-400 text-white font-bold rounded-xl hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] transition-all flex items-center gap-2 animate-in zoom-in"
                                        >
                                            <Printer className="w-5 h-5" />
                                            Imprimir y Finalizar
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Modals */}

            {/* Search Person Modal */}
            {showBusquedaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-md bg-[#1a1d29] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">
                                Buscar {busquedaType === 'autoriza' ? 'Responsable' : 'Persona'}
                            </h3>
                            <button onClick={() => setShowBusquedaModal(false)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <input
                                type="text"
                                placeholder="Escriba para buscar..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white mb-4 focus:border-[#00d4ff] focus:outline-none"
                                value={busquedaQuery}
                                onChange={e => setBusquedaQuery(e.target.value)}
                                autoFocus
                            />
                            <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                                {(busquedaType === 'autoriza' ? filteredResponsables : filteredRetirantes).length === 0 ? (
                                    <div className="text-center text-gray-500 py-4">No se encontraron resultados</div>
                                ) : (
                                    (busquedaType === 'autoriza' ? filteredResponsables : filteredRetirantes).map(item => (
                                        <button
                                            key={item.identificacion}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    [busquedaType!]: item.identificacion
                                                }));
                                                setShowBusquedaModal(false);
                                                setBusquedaQuery('');
                                            }}
                                            className="w-full text-left p-3 rounded-lg hover:bg-white/5 transition-colors text-gray-300 hover:text-white"
                                        >
                                            {busquedaType === 'autoriza' ? item.alias : item.colaborador}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Article Modal */}
            {showArticuloModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-4xl bg-[#1a1d29] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Buscar Artículo</h3>
                            <button onClick={() => setShowArticuloModal(false)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 border-b border-white/10">
                            <input
                                type="text"
                                placeholder="Buscar por nombre o código..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00d4ff] focus:outline-none"
                                value={articuloQuery}
                                onChange={e => setArticuloQuery(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {loadingInventario && inventoryPage === 1 ? (
                                <div className="text-center py-8 text-gray-400 flex flex-col items-center gap-2">
                                    <Loader2 className="w-8 h-8 animate-spin text-[#00d4ff]" />
                                    Cargando inventario...
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-gray-400 text-sm border-b border-white/10">
                                            <th className="pb-4 pl-2">Imagen</th>
                                            <th className="pb-4">Artículo</th>
                                            <th className="pb-4">Marca</th>
                                            <th className="pb-4">Disponible</th>
                                            <th className="pb-4 text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredInventario.slice(0, 100).map(item => (
                                            <tr key={item.codigo_articulo} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3 pl-2">
                                                    <div
                                                        className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 overflow-hidden cursor-pointer hover:border-[#00d4ff]/50 transition-colors"
                                                        onClick={() => {
                                                            setSelectedImage({
                                                                src: item.imagen_url || 'https://via.placeholder.com/150',
                                                                alt: item.nombre_articulo
                                                            });
                                                            setShowImageModal(true);
                                                        }}
                                                    >
                                                        <img
                                                            src={item.imagen_url || 'https://via.placeholder.com/150'}
                                                            alt={item.nombre_articulo}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <div className="font-medium text-white">{item.nombre_articulo}</div>
                                                    <div className="text-xs text-gray-500">{item.codigo_articulo}</div>
                                                </td>
                                                <td className="py-3 text-sm text-gray-400">{item.marca || 'Sin marca'}</td>
                                                <td className="py-3 text-sm text-gray-300 font-mono">{item.cantidad_disponible} {item.unidad}</td>
                                                <td className="py-3 text-center">
                                                    <button
                                                        onClick={() => seleccionarArticulo(item)}
                                                        className="px-3 py-1.5 rounded-lg bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20 hover:bg-[#00d4ff]/20 transition-colors text-sm font-medium"
                                                    >
                                                        Seleccionar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {filteredInventario.length > 100 && (
                                <div className="text-center py-4 text-gray-500 text-sm">
                                    Mostrando primeros 100 resultados de {filteredInventario.length}...
                                </div>
                            )}

                            <div className="p-4 text-center border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextPage = inventoryPage + 1;
                                        setInventoryPage(nextPage);
                                        cargarInventario(nextPage, true);
                                    }}
                                    disabled={loadingInventario || inventario.length >= totalInventory}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#00d4ff] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                >
                                    {loadingInventario ? (
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
            )}

            {/* Comments Modal */}
            {showComentariosModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-2xl bg-[#1a1d29] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-[#00d4ff]" />
                                Comentarios Adicionales
                            </h3>
                            <button onClick={() => setShowComentariosModal(false)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <textarea
                                className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-[#00d4ff] focus:outline-none resize-none"
                                placeholder="Detalles adicionales sobre esta salida..."
                                value={tempComentarios}
                                onChange={e => setTempComentarios(e.target.value)}
                            />
                        </div>
                        <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                            <button
                                onClick={() => setShowComentariosModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    setComentarios(tempComentarios);
                                    setShowComentariosModal(false);
                                }}
                                className="px-6 py-2 bg-[#00d4ff] text-black font-bold rounded-lg hover:bg-[#00fff0] transition-colors"
                            >
                                Guardar Comentarios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Modal */}
            {showImageModal && selectedImage && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setShowImageModal(false)}>
                    <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowImageModal(false)} className="absolute -top-4 -right-4 w-8 h-8 bg-[#00d4ff] text-black rounded-full flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-lg">
                            <X size={16} />
                        </button>
                        <img src={selectedImage.src} alt={selectedImage.alt} className="max-w-full max-h-[85vh] rounded-lg border border-white/20 shadow-2xl" />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full text-white text-sm backdrop-blur-sm border border-white/10">
                            {selectedImage.alt}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
