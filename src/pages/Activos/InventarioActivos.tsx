import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, Search, Edit, Trash2, Eye, LayoutList, Filter, X, Save, Loader2, Package, QrCode, Hash } from 'lucide-react';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { Toast, ToastType } from '../../components/ui/Toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Activo {
    id_activo?: number; // Optional because it might not be in the select if not needed, but usually is.
    numero_activo: number;
    nombre_corto_activo: string;
    marca_activo: string;
    numero_serie_activo: string;
    codigo_activo: string;
    descripcion_activo: string;
    valor_activo: number;
    ingreso_activo: string;
    imagen_activo: string | null;
    nota_activo?: string;
}

export default function InventarioActivos() {
    const navigate = useNavigate();
    const [activos, setActivos] = useState<Activo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedActivo, setSelectedActivo] = useState<Activo | null>(null);
    const [editingActivo, setEditingActivo] = useState<Activo | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [confirmationModal, setConfirmationModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    useEffect(() => {
        fetchActivos();
    }, []);

    const fetchActivos = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('activos_50')
                .select('*')
                .order('ingreso_activo', { ascending: false });

            if (error) throw error;
            setActivos(data || []);
        } catch (error) {
            console.error('Error al cargar activos:', error);
            showToast('Error al cargar el inventario', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type });
    };

    const handleEdit = (activo: Activo) => {
        setEditingActivo(activo);
    };

    const handleSaveEdit = async () => {
        if (!editingActivo) return;
        setIsSaving(true);
        try {
            // Note: Assuming 'numero_activo' is the primary key or unique identifier used for updates if 'id_activo' is not available.
            // However, usually Supabase tables have an 'id' column. Based on previous code, 'numero_activo' seems to be the main ID.
            // Let's check if we have an ID. If not, we use numero_activo.

            const { error } = await supabase
                .from('activos_50')
                .update({
                    nombre_corto_activo: editingActivo.nombre_corto_activo,
                    marca_activo: editingActivo.marca_activo,
                    numero_serie_activo: editingActivo.numero_serie_activo,
                    codigo_activo: editingActivo.codigo_activo,
                    descripcion_activo: editingActivo.descripcion_activo,
                    valor_activo: editingActivo.valor_activo,
                    nota_activo: editingActivo.nota_activo
                })
                .eq('numero_activo', editingActivo.numero_activo);

            if (error) throw error;

            setActivos(activos.map(a => a.numero_activo === editingActivo.numero_activo ? editingActivo : a));
            setEditingActivo(null);
            showToast('Activo actualizado correctamente', 'success');
        } catch (error) {
            console.error('Error updating asset:', error);
            showToast('Error al actualizar el activo', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (activo: Activo) => {
        setConfirmationModal({
            isOpen: true,
            title: 'Eliminar Activo',
            message: `¿Está seguro de eliminar el activo #${activo.numero_activo}? Esta acción no se puede deshacer.`,
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('activos_50')
                        .delete()
                        .eq('numero_activo', activo.numero_activo);

                    if (error) throw error;

                    setActivos(activos.filter(a => a.numero_activo !== activo.numero_activo));
                    showToast('Activo eliminado correctamente', 'success');
                } catch (error) {
                    console.error('Error deleting asset:', error);
                    showToast('Error al eliminar el activo', 'error');
                } finally {
                    setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const filteredActivos = activos.filter(activo =>
        activo.nombre_corto_activo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activo.codigo_activo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activo.numero_serie_activo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activo.marca_activo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activo.numero_activo?.toString().includes(searchTerm)
    );

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="sticky top-0 z-30 flex items-center justify-between py-6 mb-8 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 -mx-6 px-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <LayoutList className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Inventario General</h1>
                </div>
                <button
                    onClick={() => navigate('/activos')}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all text-sm font-medium"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Regresar
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-800/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-700 shadow-sm mb-6">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, código, serie..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 text-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-500"
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors border border-transparent hover:border-slate-600">
                    <Filter className="w-5 h-5" />
                    <span>Filtros</span>
                </button>
            </div>

            {/* Table */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-12 flex justify-center items-center">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-slate-400 text-sm uppercase">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Activo</th>
                                    <th className="px-6 py-4 font-semibold">Identificación</th>
                                    <th className="px-6 py-4 font-semibold">Detalles</th>
                                    <th className="px-6 py-4 font-semibold">Valor</th>
                                    <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {filteredActivos.map((activo) => (
                                    <tr key={activo.numero_activo} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-600">
                                                    {activo.imagen_activo ? (
                                                        <img
                                                            src={activo.imagen_activo}
                                                            alt={activo.nombre_corto_activo}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <Package className="w-6 h-6" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-200">{activo.nombre_corto_activo}</div>
                                                    <div className="text-xs text-slate-500">{activo.marca_activo}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm text-emerald-400 font-bold mb-1">
                                                    <span className="text-xs text-slate-500">ID:</span>
                                                    <span>{activo.numero_activo}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                                    <QrCode className="w-3 h-3 text-emerald-500" />
                                                    <span className="font-mono">{activo.codigo_activo}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Hash className="w-3 h-3" />
                                                    <span>{activo.numero_serie_activo}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-400 max-w-xs truncate" title={activo.descripcion_activo}>
                                                {activo.descripcion_activo}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-emerald-400">
                                                ₡{activo.valor_activo?.toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setSelectedActivo(activo)}
                                                    className="p-2 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 rounded-lg transition-colors"
                                                    title="Ver detalles"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(activo)}
                                                    className="p-2 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(activo)}
                                                    className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingActivo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-slate-800">
                            <h2 className="text-xl font-bold text-white">Editar Activo #{editingActivo.numero_activo}</h2>
                            <button
                                onClick={() => setEditingActivo(null)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Nombre Corto</label>
                                    <input
                                        value={editingActivo.nombre_corto_activo}
                                        onChange={e => setEditingActivo({ ...editingActivo, nombre_corto_activo: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Marca</label>
                                    <input
                                        value={editingActivo.marca_activo}
                                        onChange={e => setEditingActivo({ ...editingActivo, marca_activo: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Serie</label>
                                    <input
                                        value={editingActivo.numero_serie_activo}
                                        onChange={e => setEditingActivo({ ...editingActivo, numero_serie_activo: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Código (Placa)</label>
                                    <input
                                        value={editingActivo.codigo_activo}
                                        onChange={e => setEditingActivo({ ...editingActivo, codigo_activo: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Descripción</label>
                                <textarea
                                    value={editingActivo.descripcion_activo}
                                    onChange={e => setEditingActivo({ ...editingActivo, descripcion_activo: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Valor</label>
                                <input
                                    type="number"
                                    value={editingActivo.valor_activo}
                                    onChange={e => setEditingActivo({ ...editingActivo, valor_activo: parseFloat(e.target.value) })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingActivo(null)}
                                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Details Modal (Simple implementation) */}
            {selectedActivo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-slate-800">
                            <h2 className="text-xl font-bold text-white">Detalles del Activo</h2>
                            <button
                                onClick={() => setSelectedActivo(null)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-0 max-h-[85vh] overflow-y-auto custom-scrollbar">
                            {/* Image Header with Overlay */}
                            <div className="relative w-full aspect-[4/3] md:aspect-video bg-slate-800 border-b border-slate-700 group overflow-hidden">
                                {selectedActivo.imagen_activo ? (
                                    <img
                                        src={selectedActivo.imagen_activo}
                                        alt={selectedActivo.nombre_corto_activo}
                                        className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                                        <Package className="w-24 h-24 text-slate-700" />
                                    </div>
                                )}

                                {/* Gradient Overlay & Text */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent flex flex-col justify-end p-6 md:p-8">
                                    <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight drop-shadow-md">
                                        {selectedActivo.nombre_corto_activo}
                                    </h3>
                                </div>
                            </div>

                            <div className="p-6 md:p-8 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">N° Activo</label>
                                        <p className="text-emerald-400 text-xl font-bold">#{selectedActivo.numero_activo}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Marca</label>
                                        <p className="text-slate-300">{selectedActivo.marca_activo}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Serie</label>
                                        <p className="text-slate-300">{selectedActivo.numero_serie_activo}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Código</label>
                                        <p className="text-emerald-400 font-mono">{selectedActivo.codigo_activo}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Valor</label>
                                        <p className="text-slate-300">₡{selectedActivo.valor_activo?.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Descripción</label>
                                    <p className="text-slate-300 text-sm leading-relaxed">{selectedActivo.descripcion_activo}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Fecha Ingreso</label>
                                    <p className="text-slate-300">{selectedActivo.ingreso_activo ? format(new Date(selectedActivo.ingreso_activo), 'dd MMM yyyy', { locale: es }) : '-'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                onClose={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
                onConfirm={confirmationModal.onConfirm}
                title={confirmationModal.title}
                message={confirmationModal.message}
            />

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
