import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, Edit, Trash2, Eye, LayoutList, Filter, X, Save, Loader2, Package, QrCode, Hash } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7]">
            {/* Standard Header */}
            <PageHeader
                title="Inventario General"
                subtitle="Gabinete de Gestión Operativa"
                icon={LayoutList}
                backRoute="/activos"
            />

            <div className="max-w-7xl mx-auto px-8 pb-12 space-y-8 animate-fade-in-up">

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#121212] p-6 rounded-[8px] border border-[#333333] shadow-2xl">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B] w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, código, serie..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-[#1D1D1F] border border-[#333333] text-[#F5F5F7] rounded-[8px] focus:outline-none focus:border-[#0071E3]/50 transition-all placeholder:text-[#86868B] text-sm font-medium"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-6 py-3 text-[#86868B] hover:text-[#F5F5F7] hover:bg-white/5 rounded-[8px] transition-all border border-transparent hover:border-[#333333] font-black uppercase text-[10px] tracking-widest">
                        <Filter className="w-5 h-5" />
                        <span>Filtros Avanzados</span>
                    </button>
                </div>

                {/* Table */}
                <div className="bg-[#121212] rounded-[8px] border border-[#333333] overflow-hidden shadow-2xl">
                    {loading ? (
                        <div className="p-12 flex justify-center items-center">
                            <Loader2 className="w-8 h-8 text-[#0071E3] animate-spin" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-black/20 border-b border-[#333333] text-[#86868B] text-[9px] font-black tracking-widest uppercase">
                                    <tr>
                                        <th className="px-6 py-5">Activo</th>
                                        <th className="px-6 py-5">Identificación</th>
                                        <th className="px-6 py-5">Detalles</th>
                                        <th className="px-6 py-5">Valor</th>
                                        <th className="px-6 py-5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#333333]/30">
                                    {filteredActivos.map((activo) => (
                                        <tr key={activo.numero_activo} className="hover:bg-white/[0.04] transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 rounded-[8px] bg-black/40 flex items-center justify-center text-[#86868B] overflow-hidden border border-[#333333]">
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
                                                        <div className="font-black text-[#F5F5F7] text-sm tracking-tight">{activo.nombre_corto_activo}</div>
                                                        <div className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider">{activo.marca_activo}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-xs text-[#0071E3] font-black mb-1">
                                                        <span className="text-[9px] text-[#86868B] font-bold uppercase tracking-widest">ID:</span>
                                                        <span className="italic">#{activo.numero_activo}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] text-[#F5F5F7] font-bold italic tracking-tight">
                                                        <QrCode className="w-3 h-3 text-[#0071E3]" />
                                                        <span>{activo.codigo_activo}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-[#86868B] font-black uppercase tracking-tighter">
                                                        <Hash className="w-3 h-3" />
                                                        <span>{activo.numero_serie_activo}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="text-xs text-[#86868B] max-w-xs font-bold leading-relaxed italic" title={activo.descripcion_activo}>
                                                    {activo.descripcion_activo}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="font-mono text-[#0071E3] font-black text-sm">
                                                    ₡{activo.valor_activo?.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setSelectedActivo(activo)}
                                                        className="p-2.5 bg-[#1D1D1F] border border-[#333333] hover:border-[#0071E3] text-[#86868B] hover:text-[#0071E3] rounded-[8px] transition-all"
                                                        title="Ver detalles"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(activo)}
                                                        className="p-2.5 bg-[#1D1D1F] border border-[#333333] hover:border-[#0071E3] text-[#86868B] hover:text-[#0071E3] rounded-[8px] transition-all"
                                                        title="Editar"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(activo)}
                                                        className="p-2.5 bg-[#1D1D1F] border border-[#333333] hover:border-red-500 text-[#86868B] hover:text-red-400 rounded-[8px] transition-all"
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 apple-blur">
                        <div className="bg-[#121212] border border-[#333333] rounded-[8px] w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up">
                            <div className="flex items-center justify-between p-6 bg-black/20 border-b border-[#333333]">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-black/40 rounded-[8px] border border-[#333333]">
                                        <Edit className="w-5 h-5 text-[#0071E3]" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-[#F5F5F7]">Editar Activo</h2>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#86868B]">ID: #{editingActivo.numero_activo}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditingActivo(null)}
                                    className="p-2 text-[#86868B] hover:text-[#F5F5F7] transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B]">Nombre Corto</label>
                                        <input
                                            value={editingActivo.nombre_corto_activo}
                                            onChange={e => setEditingActivo({ ...editingActivo, nombre_corto_activo: e.target.value })}
                                            className="w-full px-4 py-3 bg-[#1D1D1F] border border-[#333333] rounded-[8px] text-[#F5F5F7] focus:outline-none focus:border-[#0071E3]/50 transition-all font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B]">Marca</label>
                                        <input
                                            value={editingActivo.marca_activo}
                                            onChange={e => setEditingActivo({ ...editingActivo, marca_activo: e.target.value })}
                                            className="w-full px-4 py-3 bg-[#1D1D1F] border border-[#333333] rounded-[8px] text-[#F5F5F7] focus:outline-none focus:border-[#0071E3]/50 transition-all font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B]">Serie</label>
                                        <input
                                            value={editingActivo.numero_serie_activo}
                                            onChange={e => setEditingActivo({ ...editingActivo, numero_serie_activo: e.target.value })}
                                            className="w-full px-4 py-3 bg-[#1D1D1F] border border-[#333333] rounded-[8px] text-[#F5F5F7] focus:outline-none focus:border-[#0071E3]/50 transition-all font-bold font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B]">Código (Placa)</label>
                                        <input
                                            value={editingActivo.codigo_activo}
                                            onChange={e => setEditingActivo({ ...editingActivo, codigo_activo: e.target.value })}
                                            className="w-full px-4 py-3 bg-[#1D1D1F] border border-[#333333] rounded-[8px] text-[#F5F5F7] focus:outline-none focus:border-[#0071E3]/50 transition-all font-bold font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B]">Descripción</label>
                                    <textarea
                                        value={editingActivo.descripcion_activo}
                                        onChange={e => setEditingActivo({ ...editingActivo, descripcion_activo: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-[#1D1D1F] border border-[#333333] rounded-[8px] text-[#F5F5F7] focus:outline-none focus:border-[#0071E3]/50 transition-all font-bold resize-none italic"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B]">Valor del Activo</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0071E3] font-black">₡</span>
                                        <input
                                            type="number"
                                            value={editingActivo.valor_activo}
                                            onChange={e => setEditingActivo({ ...editingActivo, valor_activo: parseFloat(e.target.value) })}
                                            className="w-full pl-8 pr-4 py-3 bg-[#1D1D1F] border border-[#333333] rounded-[8px] text-[#F5F5F7] focus:outline-none focus:border-[#0071E3]/50 transition-all font-black font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 bg-black/20 border-t border-[#333333] flex justify-end gap-4">
                                <button
                                    onClick={() => setEditingActivo(null)}
                                    className="px-6 py-3 text-[#86868B] hover:text-[#F5F5F7] font-black uppercase text-[10px] tracking-widest transition-colors border border-transparent hover:border-[#333333] rounded-[8px]"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={isSaving}
                                    className="px-8 py-3 bg-[#0071E3] hover:bg-[#0071E3] text-white rounded-[8px] font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-[#0071E3]/20 flex items-center gap-3 active:scale-95 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* View Details Modal */}
                {selectedActivo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 apple-blur">
                        <div className="bg-[#121212] border border-[#333333] rounded-[8px] w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up">
                            <div className="flex items-center justify-between p-6 bg-black/20 border-b border-[#333333]">
                                <h2 className="text-xl font-black text-[#F5F5F7] tracking-tight">Detalles del Activo</h2>
                                <button
                                    onClick={() => setSelectedActivo(null)}
                                    className="p-2 text-[#86868B] hover:text-[#F5F5F7] transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-0 max-h-[85vh] overflow-y-auto">
                                {/* Image Header with Overlay */}
                                <div className="relative w-full aspect-video bg-black/40 border-b border-[#333333] group overflow-hidden">
                                    {selectedActivo.imagen_activo ? (
                                        <img
                                            src={selectedActivo.imagen_activo}
                                            alt={selectedActivo.nombre_corto_activo}
                                            className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#121212]">
                                            <Package className="w-24 h-24 text-[#333333]" />
                                        </div>
                                    )}

                                    {/* Gradient Overlay & Text */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-transparent flex flex-col justify-end p-8">
                                        <p className="text-[#0071E3] text-[10px] font-black uppercase tracking-[0.3em] mb-1">Activo Registrado</p>
                                        <h3 className="text-2xl font-black text-[#F5F5F7] leading-tight italic">
                                            {selectedActivo.nombre_corto_activo}
                                        </h3>
                                    </div>
                                </div>

                                <div className="p-8 space-y-8">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">N° Activo</label>
                                            <p className="text-[#0071E3] text-xl font-black italic">#{selectedActivo.numero_activo}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">Marca</label>
                                            <p className="text-[#F5F5F7] font-bold uppercase text-sm">{selectedActivo.marca_activo}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">Serie</label>
                                            <p className="text-[#F5F5F7] font-mono font-bold text-sm tracking-tighter">{selectedActivo.numero_serie_activo}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">Código</label>
                                            <p className="text-[#0071E3] font-mono font-black italic text-sm">{selectedActivo.codigo_activo}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">Valor</label>
                                            <p className="text-[#F5F5F7] font-black font-mono">₡{selectedActivo.valor_activo?.toLocaleString()}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">Ingreso</label>
                                            <p className="text-[#F5F5F7] font-bold text-sm">{selectedActivo.ingreso_activo ? format(new Date(selectedActivo.ingreso_activo), 'dd MMM yyyy', { locale: es }) : '-'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 pt-4 border-t border-[#333333]/30">
                                        <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">Descripción Técnica</label>
                                        <p className="text-[#86868B] text-xs leading-relaxed font-bold italic">{selectedActivo.descripcion_activo}</p>
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
        </div>
    );
}
