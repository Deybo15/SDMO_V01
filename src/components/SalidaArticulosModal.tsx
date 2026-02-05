import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    X,
    Search,
    PlusCircle,
    Trash2,
    Save,
    Printer,
    MessageSquare,
    CheckCircle,
    AlertTriangle,
    Box,
    User,
    Hash,
    Loader2
} from 'lucide-react';
import { ColaboradorSearchModal } from '../pages/Activos/components/ColaboradorSearchModal';

interface SalidaArticulosModalProps {
    isOpen: boolean;
    onClose: () => void;
    solicitudId: number | null;
}

interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
    cantidad_disponible: number;
    unidad: string;
    imagen_url: string;
    precio_unitario: number;
}

interface Colaborador {
    identificacion: string;
    alias: string;
    colaborador: string;
    autorizado: boolean;
}

interface DetalleSalida {
    codigo_articulo: string;
    articulo: string;
    cantidad: number | string;
    unidad: string;
    precio_unitario: number;
    cantidad_disponible?: number;
}

export default function SalidaArticulosModal({ isOpen, onClose, solicitudId }: SalidaArticulosModalProps) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'form' | 'success'>('form');

    // Form Data
    const [autoriza, setAutoriza] = useState('');
    const [retira, setRetira] = useState('');
    const [numeroSolicitud, setNumeroSolicitud] = useState<number | string>('');
    const [comentarios, setComentarios] = useState('');
    const [detalles, setDetalles] = useState<DetalleSalida[]>([{
        codigo_articulo: '',
        articulo: '',
        cantidad: 0,
        unidad: '',
        precio_unitario: 0
    }]);

    // Lists & Options
    const [responsables, setResponsables] = useState<Colaborador[]>([]);
    const [retirantes, setRetirantes] = useState<Colaborador[]>([]);

    // UI States
    const [showComentariosModal, setShowComentariosModal] = useState(false);
    const [showArticuloModal, setShowArticuloModal] = useState(false);
    const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Search Modal States
    const [showBusquedaModal, setShowBusquedaModal] = useState(false);
    const [busquedaTipo, setBusquedaTipo] = useState<'autoriza' | 'retira'>('autoriza');
    const [busquedaColaboradores, setBusquedaColaboradores] = useState<Colaborador[]>([]);

    // Inventory Search
    const [inventario, setInventario] = useState<Articulo[]>([]);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [inventoryPage, setInventoryPage] = useState(1);
    const [hasMoreInventory, setHasMoreInventory] = useState(true);
    const [articuloSearchTerm, setArticuloSearchTerm] = useState('');

    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | null }>({ message: '', type: null });
    const [ultimoIdSalida, setUltimoIdSalida] = useState<number | null>(null);

    // Initial Load
    useEffect(() => {
        if (isOpen) {
            loadColaboradores();
            if (solicitudId) {
                setNumeroSolicitud(solicitudId);
            } else {
                generarNumeroSolicitud();
            }
            // Ensure at least one row
            setDetalles(prev => prev.length === 0 ? [{
                codigo_articulo: '',
                articulo: '',
                cantidad: 0,
                unidad: '',
                precio_unitario: 0
            }] : prev);
        }
    }, [isOpen, solicitudId]);

    const showNotify = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification({ message: '', type: null }), 4000);
    };

    const loadColaboradores = async () => {
        try {
            const [{ data: autorizados }, { data: retirados }] = await Promise.all([
                supabase.from('colaboradores_06').select('identificacion, alias, colaborador, autorizado').eq('autorizado', true),
                supabase.from('colaboradores_06').select('identificacion, colaborador, alias, autorizado').eq('condicion_laboral', false)
            ]);

            // Map to ensure alias/colaborador are populated
            const safeAutorizados = (autorizados || []).map(c => ({
                ...c,
                alias: c.alias || c.colaborador, // Fallback if alias missing
                colaborador: c.colaborador || c.alias // Fallback
            }));

            setResponsables(safeAutorizados as Colaborador[]);
            setRetirantes((retirados || []) as Colaborador[]);
        } catch (error) {
            console.error('Error loading colaboradores:', error);
        }
    };

    const generarNumeroSolicitud = async () => {
        try {
            const { data } = await supabase
                .from('salida_articulo_08')
                .select('numero_solicitud')
                .order('numero_solicitud', { ascending: false })
                .limit(1);

            const ultimo = data?.[0]?.numero_solicitud || 0;
            setNumeroSolicitud(ultimo + 1);
        } catch (error) {
            console.error('Error generating number:', error);
            setNumeroSolicitud(Date.now());
        }
    };

    // Handlers for Search Modal
    const handleOpenBusqueda = (tipo: 'autoriza' | 'retira') => {
        setBusquedaTipo(tipo);
        setBusquedaColaboradores(tipo === 'autoriza' ? responsables : retirantes);
        setShowBusquedaModal(true);
    };

    const handleSelectColaborador = (colaborador: Colaborador) => {
        if (busquedaTipo === 'autoriza') {
            setAutoriza(colaborador.identificacion);
        } else {
            setRetira(colaborador.identificacion);
        }
        setShowBusquedaModal(false);
    };

    // Inventory Logic
    const loadInventario = async (page = 1, search = '') => {
        setInventoryLoading(true);
        try {
            let query = supabase
                .from('inventario_actual')
                .select('codigo_articulo, nombre_articulo, cantidad_disponible, unidad, imagen_url, precio_unitario', { count: 'exact' });

            if (search) {
                query = query.or(`nombre_articulo.ilike.%${search}%,codigo_articulo.ilike.%${search}%`);
            }

            const { data } = await query
                .order('nombre_articulo', { ascending: true })
                .range((page - 1) * 50, page * 50 - 1);

            if (page === 1) {
                setInventario(data || []);
            } else {
                setInventario(prev => [...prev, ...(data || [])]);
            }

            setHasMoreInventory((data?.length || 0) === 50);
        } catch (error) {
            console.error('Error loading inventory:', error);
        } finally {
            setInventoryLoading(false);
        }
    };

    useEffect(() => {
        if (showArticuloModal) {
            // Reset search when opening
            const delayDebounceFn = setTimeout(() => {
                setInventoryPage(1);
                loadInventario(1, articuloSearchTerm);
            }, 300);
            return () => clearTimeout(delayDebounceFn);
        }
    }, [articuloSearchTerm, showArticuloModal]);

    const handleLoadMoreInventory = () => {
        const nextPage = inventoryPage + 1;
        setInventoryPage(nextPage);
        loadInventario(nextPage, articuloSearchTerm);
    };

    // Row Management
    const addRow = () => {
        setDetalles([...detalles, { codigo_articulo: '', articulo: '', cantidad: 0, unidad: '', precio_unitario: 0 }]);
    };

    const removeRow = (index: number) => {
        const newDetalles = [...detalles];
        newDetalles.splice(index, 1);
        setDetalles(newDetalles);
    };

    const updateRow = (index: number, field: keyof DetalleSalida, value: any) => {
        const newDetalles = [...detalles];
        newDetalles[index] = { ...newDetalles[index], [field]: value };
        setDetalles(newDetalles);
    };

    const handleSelectArticulo = (articulo: Articulo) => {
        if (activeRowIndex !== null) {
            const newDetalles = [...detalles];
            newDetalles[activeRowIndex] = {
                codigo_articulo: articulo.codigo_articulo,
                articulo: articulo.nombre_articulo,
                cantidad: 0, // Reset quantity for input
                unidad: articulo.unidad || 'Unidad',
                precio_unitario: articulo.precio_unitario,
                cantidad_disponible: articulo.cantidad_disponible
            };
            setDetalles(newDetalles);
            setShowArticuloModal(false);
            setActiveRowIndex(null);
            setArticuloSearchTerm(''); // Clear search
        }
    };

    // Save Logic
    const handleGuardar = async () => {
        if (!autoriza || !retira || !numeroSolicitud) {
            showNotify('Por favor complete los campos obligatorios', 'error');
            return;
        }
        if (detalles.length === 0) {
            showNotify('Debe agregar al menos un artículo', 'error');
            return;
        }


        // Validate details
        for (const d of detalles) {
            const qty = typeof d.cantidad === 'string' ? parseFloat(d.cantidad) : d.cantidad;
            if (!d.codigo_articulo || qty <= 0) {
                showNotify('Verifique que todos los artículos tengan código y cantidad válida', 'error');
                return;
            }
        }

        setLoading(true);
        try {
            // 1. Insert Header
            const { data: headerData, error: headerError } = await supabase
                .from('salida_articulo_08')
                .insert([{
                    fecha_salida: new Date().toLocaleDateString('en-CA'),
                    autoriza,
                    retira,
                    numero_solicitud: numeroSolicitud,
                    comentarios
                }])
                .select('id_salida')
                .single();

            if (headerError) throw headerError;

            const newId = headerData.id_salida;
            setUltimoIdSalida(newId);

            // 2. Insert Details
            const detallesToInsert = detalles.map(d => ({
                id_salida: newId,
                articulo: d.codigo_articulo,
                cantidad: typeof d.cantidad === 'string' ? parseFloat(d.cantidad) : d.cantidad,
                precio_unitario: d.precio_unitario
            }));

            const { error: detailsError } = await supabase
                .from('dato_salida_13')
                .insert(detallesToInsert);

            if (detailsError) throw detailsError;

            // 3. Update Header (finalizada: true) automatically for MAKE
            const { error: finalError } = await supabase
                .from('salida_articulo_08')
                .update({ finalizada: true })
                .eq('id_salida', newId);

            if (finalError) throw finalError;

            showNotify(`Salida registrada exitosamente con folio SA-${newId.toString().padStart(4, '0')}`, 'success');
            setStep('success');

        } catch (error: any) {
            console.error('Error saving:', error);
            showNotify('Error al guardar: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalizar = () => {
        onClose();
        navigate('/otras-solicitudes');
    };


    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-[#0f0f23] w-full max-w-6xl rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh] overflow-hidden relative">

                {/* Background Effects */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[100px]"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[100px]"></div>
                </div>

                {/* Header */}
                <div className="relative z-10 p-6 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-b border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Box className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Registro de Salida de Artículos</h2>
                            <p className="text-xs text-blue-300">Folio Solicitud: {numeroSolicitud}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="relative z-10 flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {notification.message && (
                        <div className={`mb-4 p-4 rounded-xl border flex items-center gap-3 ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}>
                            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                            {notification.message}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        {/* Info Card */}
                        <div className="lg:col-span-3 bg-white/5 border border-white/10 rounded-xl p-5">
                            <h3 className="text-sm font-semibold text-blue-300 mb-4 flex items-center gap-2">
                                <User className="w-4 h-4" /> Información de la Salida
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Responsable que autoriza *</label>
                                    <div className="relative flex gap-2">
                                        <select
                                            value={autoriza}
                                            onChange={(e) => setAutoriza(e.target.value)}
                                            className="w-full bg-[#1a1d29] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none appearance-none"
                                        >
                                            <option value="">-- Seleccione --</option>
                                            {responsables.map(r => (
                                                <option key={r.identificacion} value={r.identificacion}>{r.alias}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => handleOpenBusqueda('autoriza')}
                                            className="px-3 bg-blue-600/20 border border-blue-600/30 text-blue-400 hover:bg-blue-600/40 rounded-lg transition-colors"
                                            title="Buscar Responsable"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Persona que retira *</label>
                                    <div className="relative flex gap-2">
                                        <select
                                            value={retira}
                                            onChange={(e) => setRetira(e.target.value)}
                                            className="w-full bg-[#1a1d29] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none appearance-none"
                                        >
                                            <option value="">-- Seleccione --</option>
                                            {retirantes.map(r => (
                                                <option key={r.identificacion} value={r.identificacion}>{r.colaborador}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => handleOpenBusqueda('retira')}
                                            className="px-3 bg-blue-600/20 border border-blue-600/30 text-blue-400 hover:bg-blue-600/40 rounded-lg transition-colors"
                                            title="Buscar Persona"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Número de Solicitud *</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={numeroSolicitud}
                                            onChange={(e) => setNumeroSolicitud(e.target.value)}
                                            className="w-full bg-[#1a1d29] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none pl-9"
                                        />
                                        <Hash className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-3">
                                <button
                                    onClick={() => setShowComentariosModal(true)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-2 ${comentarios ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <MessageSquare className="w-3 h-3" />
                                    {comentarios ? 'Editar Comentarios' : 'Agregar Comentarios'}
                                    {comentarios && <CheckCircle className="w-3 h-3 ml-1" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Articles Table */}
                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                                <Box className="w-4 h-4" /> Artículos a Retirar
                            </h3>
                            <button
                                onClick={addRow}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <PlusCircle className="w-3 h-3" /> Agregar Artículo
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="bg-white/5 text-xs uppercase font-medium text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3">Artículo</th>
                                        <th className="px-4 py-3 w-32">Cantidad</th>
                                        <th className="px-4 py-3 w-32">Unidad</th>
                                        <th className="px-4 py-3 w-16 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {detalles.map((detalle, index) => (
                                        <tr key={index} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-2">
                                                <div className="flex gap-2">
                                                    <div className="flex-1 relative">
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            placeholder="Seleccione un artículo..."
                                                            value={detalle.articulo}
                                                            className="w-full bg-[#1a1d29] border border-gray-700 rounded-l-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none cursor-pointer"
                                                            onClick={() => {
                                                                setActiveRowIndex(index);
                                                                setShowArticuloModal(true);
                                                            }}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setActiveRowIndex(index);
                                                            setShowArticuloModal(true);
                                                        }}
                                                        className="px-3 bg-blue-600/20 border border-blue-600/30 text-blue-400 hover:bg-blue-600/40 rounded-r-lg"
                                                    >
                                                        <Search className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                {detalle.codigo_articulo && (
                                                    <div className="text-xs text-gray-500 mt-1 ml-1 flex justify-between">
                                                        <span>Código: {detalle.codigo_articulo}</span>
                                                        {detalle.cantidad_disponible !== undefined && (
                                                            <span className="text-blue-400">Disp: {detalle.cantidad_disponible}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="relative">
                                                    <input
                                                        type="text" // Changet to text to control input formatted
                                                        value={detalle.cantidad}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            // Allow numbers and one decimal point, max 3 decimals
                                                            if (/^\d*\.?\d{0,3}$/.test(val)) {
                                                                updateRow(index, 'cantidad', val);
                                                            }
                                                        }}
                                                        onBlur={(e) => {
                                                            let val = parseFloat(e.target.value) || 0;
                                                            // Validate against available stock
                                                            if (detalle.cantidad_disponible !== undefined && val > detalle.cantidad_disponible) {
                                                                showNotify(`La cantidad no puede exceder el disponible (${detalle.cantidad_disponible})`, 'error');
                                                                val = detalle.cantidad_disponible;
                                                            }
                                                            updateRow(index, 'cantidad', val);
                                                        }}
                                                        placeholder="0"
                                                        className="w-full bg-[#1a1d29] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                                        disabled={!detalle.codigo_articulo}
                                                    />
                                                    {detalle.cantidad_disponible !== undefined && (
                                                        <div className="text-[10px] text-gray-500 mt-0.5 text-right">
                                                            Máx: {detalle.cantidad_disponible}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={detalle.unidad}
                                                    className="w-full bg-[#1a1d29]/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400 outline-none cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => removeRow(index)}
                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {detalles.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">
                                                No hay artículos agregados. Haga clic en "Agregar Artículo" para comenzar.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="relative z-10 p-6 bg-[#1a1d29] border-t border-white/10 flex justify-end items-center">
                    <div className="flex gap-3">
                        {step === 'form' ? (
                            <button
                                onClick={handleGuardar}
                                disabled={loading}
                                className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar Salida
                            </button>
                        ) : (
                            <button
                                onClick={handleFinalizar}
                                disabled={loading}
                                className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-medium shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                Nueva Salida
                            </button>
                        )}
                    </div>
                </div>


                {/* Modals Overlays */}

                {/* Comentarios Modal - Moved to bottom */}

                {/* Colaborador Search Modal */}
                <ColaboradorSearchModal
                    isOpen={showBusquedaModal}
                    onClose={() => setShowBusquedaModal(false)}
                    onSelect={handleSelectColaborador}
                    colaboradores={busquedaColaboradores}
                />

                {/* Articulo Search Modal - Moved to bottom */}

                {/* Image Preview Modal */}
                {previewImage && (
                    <div
                        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
                        onClick={() => setPreviewImage(null)}
                    >
                        <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
                            >
                                <X className="w-8 h-8" />
                            </button>
                            <img
                                src={previewImage}
                                alt="Vista previa"
                                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                )}

            </div>

            {/* Modals Overlays (Moved to root level) */}

            {/* Comentarios Modal */}
            {showComentariosModal && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#1e2235] w-full max-w-lg rounded-xl border border-white/10 shadow-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Comentarios Adicionales</h3>
                        <textarea
                            value={comentarios}
                            onChange={(e) => setComentarios(e.target.value)}
                            className="w-full h-32 bg-[#1a1d29] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none resize-none mb-4"
                            placeholder="Escriba los detalles adicionales aquí..."
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowComentariosModal(false)}
                                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => setShowComentariosModal(false)}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Articulo Search Modal */}
            {
                showArticuloModal && createPortal(
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="bg-[#1e2235] w-full max-w-3xl rounded-xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-blue-900/20">
                                <h3 className="text-lg font-bold text-white">Buscar Artículo</h3>
                                <button onClick={() => setShowArticuloModal(false)} className="text-gray-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4 border-b border-white/10">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre o código..."
                                        value={articuloSearchTerm}
                                        onChange={(e) => setArticuloSearchTerm(e.target.value)}
                                        className="w-full bg-[#1a1d29] border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {inventoryLoading && inventoryPage === 1 ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {inventario.map((item) => (
                                            <div
                                                key={item.codigo_articulo}
                                                onClick={() => handleSelectArticulo(item)}
                                                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer border border-transparent hover:border-blue-500/30 transition-all flex items-center gap-3"
                                            >
                                                <img
                                                    src={item.imagen_url || 'https://via.placeholder.com/50'}
                                                    alt={item.nombre_articulo}
                                                    className="w-10 h-10 rounded bg-gray-800 object-cover hover:scale-110 transition-transform"
                                                    title="Doble clic para ampliar"
                                                    onClick={(e) => e.stopPropagation()}
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation();
                                                        if (item.imagen_url) setPreviewImage(item.imagen_url);
                                                    }}
                                                />
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-medium text-white">{item.nombre_articulo}</h4>
                                                    <p className="text-xs text-gray-400">{item.codigo_articulo}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-sm font-bold text-emerald-400">{item.cantidad_disponible}</span>
                                                    <span className="text-xs text-gray-500">{item.unidad}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {inventario.length === 0 && !inventoryLoading && (
                                            <div className="text-center py-8 text-gray-500">
                                                No se encontraron artículos
                                            </div>
                                        )}
                                        {hasMoreInventory && (
                                            <div className="text-center py-2">
                                                <button
                                                    onClick={handleLoadMoreInventory}
                                                    disabled={inventoryLoading}
                                                    className="text-xs text-blue-400 hover:text-blue-300"
                                                >
                                                    {inventoryLoading ? 'Cargando...' : 'Cargar más resultados'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div >,
        document.body
    );
}
