import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Banknote,
    Box,
    Edit3,
    Eye,
    Hash,
    ImageOff,
    LayoutList,
    Loader2,
    Package,
    Save,
    Search,
    Trash2,
    X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PageHeader } from '../../components/ui/PageHeader';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { Toast, ToastType } from '../../components/ui/Toast';

interface Activo {
    id_activo?: number;
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

const IMAGE_BUCKET = 'Img-activos';

function getImageCandidates(value: string | null) {
    if (!value?.trim()) return [];
    const source = value.trim();
    if (/^https?:\/\//i.test(source)) return [source];

    const names = [source];
    if (/\.jpe?g$/i.test(source)) {
        names.push(source.replace(/\.jpeg$/i, '.jpg'));
        names.push(source.replace(/\.jpg$/i, '.jpeg'));
    }

    return [...new Set(names)].flatMap((name) => {
        const rootUrl = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(name).data.publicUrl;
        const nestedUrl = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(`activos/${name}`).data.publicUrl;
        return [rootUrl, nestedUrl];
    });
}

function AssetImage({ activo, className = '' }: { activo: Activo; className?: string }) {
    const candidates = useMemo(() => getImageCandidates(activo.imagen_activo), [activo.imagen_activo]);
    const [candidateIndex, setCandidateIndex] = useState(0);

    useEffect(() => setCandidateIndex(0), [activo.imagen_activo]);

    if (!candidates[candidateIndex]) {
        return (
            <div className={`flex items-center justify-center bg-[#18181b] text-[#71717a] ${className}`}>
                <ImageOff className="h-5 w-5" aria-hidden="true" />
            </div>
        );
    }

    return (
        <img
            src={candidates[candidateIndex]}
            alt={activo.nombre_corto_activo}
            className={className}
            onError={() => setCandidateIndex((current) => current + 1)}
        />
    );
}

const fieldClass = 'w-full rounded-lg border border-[#3f3f46] bg-[#18181b] px-4 py-3 text-sm text-[#f4f4f5] outline-none transition-colors focus:border-[#a1a1aa]';
const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a1a1aa]';

export default function InventarioActivos() {
    const [activos, setActivos] = useState<Activo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedActivo, setSelectedActivo] = useState<Activo | null>(null);
    const [editingActivo, setEditingActivo] = useState<Activo | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [confirmationModal, setConfirmationModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => undefined as void | Promise<void>
    });

    const fetchActivos = useCallback(async () => {
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
            setToast({ message: 'No fue posible cargar el inventario', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => void fetchActivos(), [fetchActivos]);

    const filteredActivos = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return activos;
        return activos.filter((activo) => [
            activo.nombre_corto_activo,
            activo.codigo_activo,
            activo.numero_serie_activo,
            activo.marca_activo,
            activo.numero_activo?.toString()
        ].some((value) => value?.toLowerCase().includes(term)));
    }, [activos, searchTerm]);

    const assetsWithImage = useMemo(
        () => activos.filter((activo) => activo.imagen_activo?.trim()).length,
        [activos]
    );

    const totalValue = useMemo(
        () => activos.reduce((sum, activo) => sum + (Number(activo.valor_activo) || 0), 0),
        [activos]
    );

    const handleSaveEdit = async () => {
        if (!editingActivo) return;
        setIsSaving(true);
        try {
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
            setActivos((current) => current.map((activo) =>
                activo.numero_activo === editingActivo.numero_activo ? editingActivo : activo
            ));
            setEditingActivo(null);
            setToast({ message: 'Activo actualizado correctamente', type: 'success' });
        } catch (error) {
            console.error('Error al actualizar activo:', error);
            setToast({ message: 'No fue posible actualizar el activo', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (activo: Activo) => {
        setConfirmationModal({
            isOpen: true,
            title: 'Eliminar activo',
            message: `¿Desea eliminar el activo #${activo.numero_activo}? Esta acción no se puede deshacer.`,
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('activos_50')
                        .delete()
                        .eq('numero_activo', activo.numero_activo);
                    if (error) throw error;
                    setActivos((current) => current.filter((item) => item.numero_activo !== activo.numero_activo));
                    setToast({ message: 'Activo eliminado correctamente', type: 'success' });
                } catch (error) {
                    console.error('Error al eliminar activo:', error);
                    setToast({ message: 'No fue posible eliminar el activo', type: 'error' });
                } finally {
                    setConfirmationModal((current) => ({ ...current, isOpen: false }));
                }
            }
        });
    };

    const formatCurrency = (value: number) => `₡${(Number(value) || 0).toLocaleString('es-CR')}`;

    return (
        <div className="min-h-screen bg-black px-4 py-6 text-[#f4f4f5] md:px-8 md:py-8">
            <div className="mx-auto max-w-[1536px] space-y-6">
                <PageHeader
                    title="Inventario general"
                    subtitle="Consulta, identificación y administración de activos institucionales."
                    icon={LayoutList}
                    backRoute="/activos"
                    themeColor="neutral"
                />

                <section className="grid gap-px overflow-hidden rounded-xl border border-[#3f3f46] bg-[#3f3f46] sm:grid-cols-3">
                    {[
                        { label: 'Activos registrados', value: activos.length.toLocaleString('es-CR'), icon: Box },
                        { label: 'Con imagen asociada', value: assetsWithImage.toLocaleString('es-CR'), icon: Package },
                        { label: 'Valor registrado', value: formatCurrency(totalValue), icon: Banknote }
                    ].map((item) => (
                        <div key={item.label} className="flex items-center gap-4 bg-[#0d0d0e] px-5 py-4">
                            <div className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-2.5 text-[#d4d4d8]">
                                <item.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-[#a1a1aa]">{item.label}</p>
                                <p className="mt-0.5 text-xl font-semibold text-[#f4f4f5]">{item.value}</p>
                            </div>
                        </div>
                    ))}
                </section>

                <section className="rounded-xl border border-[#3f3f46] bg-[#0d0d0e] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="w-full max-w-2xl">
                            <label htmlFor="asset-search" className={labelClass}>Buscar en el inventario</label>
                            <div className="relative mt-2">
                                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1a1aa]" />
                                <input
                                    id="asset-search"
                                    type="search"
                                    placeholder="Nombre, número de activo, código, marca o serie…"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    className={`${fieldClass} pl-11`}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
                            <span className="h-2 w-2 rounded-full bg-[#e4e4e7]" />
                            Mostrando <strong className="font-semibold text-[#f4f4f5]">{filteredActivos.length}</strong> de {activos.length}
                        </div>
                    </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-[#3f3f46] bg-[#0d0d0e]">
                    {loading ? (
                        <div className="flex min-h-72 items-center justify-center">
                            <Loader2 className="h-7 w-7 animate-spin text-[#d4d4d8]" />
                        </div>
                    ) : filteredActivos.length === 0 ? (
                        <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
                            <Search className="h-8 w-8 text-[#71717a]" />
                            <div>
                                <p className="font-semibold">No se encontraron activos</p>
                                <p className="mt-1 text-sm text-[#a1a1aa]">Pruebe con otro nombre, código o número de activo.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1040px] text-left">
                                <thead className="border-b border-[#3f3f46] bg-[#18181b]">
                                    <tr className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
                                        <th className="px-5 py-4">Activo</th>
                                        <th className="px-5 py-4">Identificación</th>
                                        <th className="px-5 py-4">Descripción</th>
                                        <th className="px-5 py-4">Valor</th>
                                        <th className="px-5 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#27272a]">
                                    {filteredActivos.map((activo) => (
                                        <tr key={activo.numero_activo} className="transition-colors hover:bg-[#18181b]/70">
                                            <td className="px-5 py-4">
                                                <div className="flex min-w-64 items-center gap-4">
                                                    <AssetImage activo={activo} className="h-16 w-16 shrink-0 rounded-lg border border-[#3f3f46] object-contain bg-[#f4f4f5]" />
                                                    <div>
                                                        <p className="max-w-64 text-sm font-semibold leading-snug text-[#f4f4f5]">{activo.nombre_corto_activo || 'Sin nombre'}</p>
                                                        <p className="mt-1 text-xs text-[#a1a1aa]">{activo.marca_activo || 'Marca no registrada'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="space-y-1.5 text-xs">
                                                    <p className="font-semibold text-[#f4f4f5]">Activo #{activo.numero_activo}</p>
                                                    <p className="font-mono text-[#d4d4d8]">{activo.codigo_activo || 'Sin código'}</p>
                                                    <p className="flex items-center gap-1.5 text-[#71717a]"><Hash className="h-3 w-3" />{activo.numero_serie_activo || 'Sin serie'}</p>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="max-w-md text-sm leading-relaxed text-[#a1a1aa]">{activo.descripcion_activo || 'Sin descripción técnica.'}</p>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#f4f4f5]">{formatCurrency(activo.valor_activo)}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <ActionButton label="Ver detalles" onClick={() => setSelectedActivo(activo)} icon={Eye} />
                                                    <ActionButton label="Editar" onClick={() => setEditingActivo({ ...activo })} icon={Edit3} />
                                                    <ActionButton label="Eliminar" onClick={() => handleDelete(activo)} icon={Trash2} danger />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            {editingActivo && (
                <ModalShell title="Editar activo" subtitle={`Activo #${editingActivo.numero_activo}`} icon={Edit3} onClose={() => setEditingActivo(null)} maxWidth="max-w-3xl">
                    <div className="grid gap-5 p-6 sm:grid-cols-2">
                        <FormField label="Nombre corto"><input value={editingActivo.nombre_corto_activo || ''} onChange={(e) => setEditingActivo({ ...editingActivo, nombre_corto_activo: e.target.value })} className={fieldClass} /></FormField>
                        <FormField label="Marca"><input value={editingActivo.marca_activo || ''} onChange={(e) => setEditingActivo({ ...editingActivo, marca_activo: e.target.value })} className={fieldClass} /></FormField>
                        <FormField label="Número de serie"><input value={editingActivo.numero_serie_activo || ''} onChange={(e) => setEditingActivo({ ...editingActivo, numero_serie_activo: e.target.value })} className={fieldClass} /></FormField>
                        <FormField label="Código o placa"><input value={editingActivo.codigo_activo || ''} onChange={(e) => setEditingActivo({ ...editingActivo, codigo_activo: e.target.value })} className={fieldClass} /></FormField>
                        <div className="sm:col-span-2"><FormField label="Descripción técnica"><textarea value={editingActivo.descripcion_activo || ''} onChange={(e) => setEditingActivo({ ...editingActivo, descripcion_activo: e.target.value })} rows={4} className={`${fieldClass} resize-none`} /></FormField></div>
                        <FormField label="Valor del activo"><input type="number" value={editingActivo.valor_activo || 0} onChange={(e) => setEditingActivo({ ...editingActivo, valor_activo: Number(e.target.value) })} className={fieldClass} /></FormField>
                    </div>
                    <div className="flex justify-end gap-3 border-t border-[#3f3f46] bg-[#18181b] px-6 py-4">
                        <button onClick={() => setEditingActivo(null)} className="rounded-lg border border-[#52525b] px-5 py-2.5 text-sm font-semibold text-[#d4d4d8] hover:bg-[#27272a]">Cancelar</button>
                        <button onClick={handleSaveEdit} disabled={isSaving} className="flex items-center gap-2 rounded-lg bg-[#f4f4f5] px-5 py-2.5 text-sm font-semibold text-black hover:bg-white disabled:opacity-50">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar cambios
                        </button>
                    </div>
                </ModalShell>
            )}

            {selectedActivo && (
                <ModalShell title="Detalle del activo" subtitle={`Registro #${selectedActivo.numero_activo}`} icon={Package} onClose={() => setSelectedActivo(null)} maxWidth="max-w-4xl">
                    <div className="grid md:grid-cols-[300px_1fr]">
                        <div className="border-b border-[#3f3f46] bg-[#18181b] p-6 md:border-b-0 md:border-r">
                            <AssetImage activo={selectedActivo} className="aspect-square w-full rounded-xl border border-[#52525b] bg-[#f4f4f5] object-contain" />
                        </div>
                        <div className="p-6">
                            <h3 className="text-2xl font-semibold leading-tight">{selectedActivo.nombre_corto_activo}</h3>
                            <p className="mt-2 text-sm text-[#a1a1aa]">{selectedActivo.descripcion_activo || 'Sin descripción técnica.'}</p>
                            <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-[#3f3f46] bg-[#3f3f46] sm:grid-cols-2">
                                <Detail label="Número de activo" value={`#${selectedActivo.numero_activo}`} />
                                <Detail label="Marca" value={selectedActivo.marca_activo || 'No registrada'} />
                                <Detail label="Código" value={selectedActivo.codigo_activo || 'No registrado'} />
                                <Detail label="Serie" value={selectedActivo.numero_serie_activo || 'No registrada'} />
                                <Detail label="Valor" value={formatCurrency(selectedActivo.valor_activo)} />
                                <Detail label="Fecha de ingreso" value={selectedActivo.ingreso_activo ? format(new Date(selectedActivo.ingreso_activo), 'dd MMM yyyy', { locale: es }) : 'No registrada'} />
                            </div>
                        </div>
                    </div>
                </ModalShell>
            )}

            <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                onClose={() => setConfirmationModal((current) => ({ ...current, isOpen: false }))}
                onConfirm={confirmationModal.onConfirm}
                title={confirmationModal.title}
                message={confirmationModal.message}
            />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

function ActionButton({ label, onClick, icon: Icon, danger = false }: { label: string; onClick: () => void; icon: typeof Eye; danger?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className={`rounded-lg border p-2.5 transition-colors ${danger ? 'border-[#3f3f46] text-[#a1a1aa] hover:border-[#a1a1aa] hover:text-white' : 'border-[#3f3f46] text-[#a1a1aa] hover:border-[#a1a1aa] hover:bg-[#27272a] hover:text-white'}`}
        >
            <Icon className="h-4 w-4" />
        </button>
    );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return <label className="space-y-2"><span className={labelClass}>{label}</span>{children}</label>;
}

function Detail({ label, value }: { label: string; value: string }) {
    return <div className="bg-[#0d0d0e] p-4"><p className={labelClass}>{label}</p><p className="mt-1.5 break-words text-sm font-semibold text-[#f4f4f5]">{value}</p></div>;
}

function ModalShell({ title, subtitle, icon: Icon, onClose, maxWidth, children }: { title: string; subtitle: string; icon: typeof Package; onClose: () => void; maxWidth: string; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <div className={`max-h-[92vh] w-full overflow-y-auto rounded-xl border border-[#52525b] bg-[#0d0d0e] shadow-2xl ${maxWidth}`}>
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#3f3f46] bg-[#0d0d0e]/95 px-6 py-4 backdrop-blur">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-2.5"><Icon className="h-5 w-5 text-[#d4d4d8]" /></div>
                        <div><h2 className="text-lg font-semibold">{title}</h2><p className="text-xs text-[#a1a1aa]">{subtitle}</p></div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg border border-[#3f3f46] p-2 text-[#a1a1aa] hover:bg-[#27272a] hover:text-white"><X className="h-5 w-5" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}
