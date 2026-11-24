import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    ArrowLeft, Save, Plus, Trash2, Calendar, User,
    FileText, ArrowDownCircle, ArrowUpCircle, Search,
    UserPlus, ChevronLeft, Shield, MousePointer2,
    Package, PackageOpen, Loader2, ChevronDown, CheckCircle2
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { cn } from '../../lib/utils';
import { Toast, ToastType } from '../../components/ui/Toast';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { ColaboradorSearchModal } from './components/ColaboradorSearchModal';

interface Activo {
    numero_activo: number;
    nombre_corto_activo: string;
    descripcion_activo: string;
    marca_activo: string;
    modelo_activo: string;
    numero_serie_activo: string;
    estado_activo: string;
    asignado_a: number | null;
}

interface Colaborador {
    id_colaborador: number;
    nombre_colaborador: string;
    departamento_colaborador: string;
    identificacion: string;
    colaborador: string;
    alias: string;
    autorizado: boolean;
}

export default function AsignacionActivos() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'entrada' | 'salida'>('entrada');
    const [loading, setLoading] = useState(false);

    // UI States
    const [showColaboradorModal, setShowColaboradorModal] = useState(false);
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

    // Data States
    const [activos, setActivos] = useState<Activo[]>([]);
    const [filteredActivos, setFilteredActivos] = useState<Activo[]>([]);
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [assignedActivos, setAssignedActivos] = useState<number[]>([]);

    // Entrada Form State
    const [entradaForm, setEntradaForm] = useState({
        fecha_entrada_activo: new Date().toLocaleDateString('en-CA'),
        autoriza_entrada_activo: '',
        activosSeleccionados: [] as Activo[]
    });

    // Salida Form State
    const [salidaForm, setSalidaForm] = useState({
        fecha_salida_activo: new Date().toLocaleDateString('en-CA'),
        usuario_de_activo: '',
        nombre_usuario_activo: '', // Helper to show name
        autoriza: '',
        observaciones: '',
        activosSeleccionados: [] as Activo[]
    });

    useEffect(() => {
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            setFilteredActivos(activos.filter(a => {
                const matchesSearch =
                    a.numero_activo.toString().includes(lower) ||
                    a.nombre_corto_activo.toLowerCase().includes(lower) ||
                    (a.numero_serie_activo && a.numero_serie_activo.toLowerCase().includes(lower));

                if (activeTab === 'salida') {
                    return matchesSearch && !assignedActivos.includes(a.numero_activo);
                }
                return matchesSearch;
            }));
        } else {
            setFilteredActivos([]);
        }
    }, [searchTerm, activos, activeTab, assignedActivos]);

    const loadData = useCallback(async () => {
        try {
            const [activosRes, colabRes, assignedRes] = await Promise.all([
                supabase.from('activos_50').select('numero_activo, nombre_corto_activo, marca_activo, numero_serie_activo').order('numero_activo', { ascending: false }),
                supabase.from('colaboradores_06').select('identificacion, colaborador, alias, autorizado, correo_colaborador').order('colaborador'),
                supabase.from('dato_salida_activo_56').select('numero_activo')
            ]);

            if (activosRes.data) setActivos(activosRes.data as any);
            if (colabRes.data) setColaboradores(colabRes.data as any);

            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email;

            if (userEmail && colabRes.data) {
                const matched = colabRes.data.find(c =>
                    c.correo_colaborador?.toLowerCase() === userEmail.toLowerCase() && c.autorizado
                );
                if (matched) {
                    setEntradaForm(prev => ({ ...prev, autoriza_entrada_activo: matched.identificacion }));
                    setSalidaForm(prev => ({ ...prev, autoriza: matched.identificacion }));
                }
            }

            if (assignedRes.data) {
                const ids = assignedRes.data.map(item => item.numero_activo).filter((id): id is number => id !== null);
                setAssignedActivos(ids);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            setToast({ message: 'Error al cargar datos', type: 'error' });
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type });
    };

    const handleAddActivoEntrada = (activo: Activo) => {
        setEntradaForm(prev => ({
            ...prev,
            activosSeleccionados: [activo]
        }));
        setSearchTerm('');
    };

    const handleRemoveActivoEntrada = () => {
        setEntradaForm(prev => ({
            ...prev,
            activosSeleccionados: []
        }));
    };

    const confirmSubmitEntrada = (e: React.FormEvent) => {
        e.preventDefault();
        if (entradaForm.activosSeleccionados.length === 0) {
            showToast('Debe seleccionar un activo para la entrada.', 'error');
            return;
        }

        const activo = entradaForm.activosSeleccionados[0];
        setConfirmationModal({
            isOpen: true,
            title: 'Confirmar Entrada',
            message: `¿Está seguro de registrar la entrada del activo #${activo.numero_activo} - ${activo.nombre_corto_activo}?`,
            onConfirm: processSubmitEntrada
        });
    };

    const processSubmitEntrada = async () => {
        setLoading(true);
        try {
            const { data: headerData, error: headerError } = await supabase
                .from('entrada_activo_52')
                .insert([{
                    fecha_entrada_activo: entradaForm.fecha_entrada_activo,
                    autoriza_entrada_activo: entradaForm.autoriza_entrada_activo
                }])
                .select('id_entrada_activo')
                .single();

            if (headerError) throw headerError;

            const details = entradaForm.activosSeleccionados.map(activo => ({
                no_entrada_activo: headerData.id_entrada_activo,
                activo: activo.numero_activo
            }));

            const { error: detailsError } = await supabase
                .from('dato_entrada_activo_54')
                .insert(details);

            if (detailsError) throw detailsError;

            showToast('Entrada de activo registrada correctamente.', 'success');
            setEntradaForm({
                fecha_entrada_activo: new Date().toLocaleDateString('en-CA'),
                autoriza_entrada_activo: '',
                activosSeleccionados: []
            });

        } catch (error: any) {
            console.error('Error en entrada:', error);
            showToast('Error al registrar la entrada: ' + error.message, 'error');
        } finally {
            setLoading(false);
            setConfirmationModal(prev => ({ ...prev, isOpen: false }));
        }
    };

    const handleSelectColaborador = (colaborador: any) => {
        setSalidaForm(prev => ({
            ...prev,
            usuario_de_activo: colaborador.identificacion,
            nombre_usuario_activo: colaborador.colaborador
        }));
        setShowColaboradorModal(false);
    };

    const handleAddActivoSalida = (activo: Activo) => {
        if (!salidaForm.activosSeleccionados.find(a => a.numero_activo === activo.numero_activo)) {
            setSalidaForm(prev => ({
                ...prev,
                activosSeleccionados: [...prev.activosSeleccionados, activo]
            }));
        }
        setSearchTerm('');
    };

    const handleRemoveActivoSalida = (numero_activo: number) => {
        setSalidaForm(prev => ({
            ...prev,
            activosSeleccionados: prev.activosSeleccionados.filter(a => a.numero_activo !== numero_activo)
        }));
    };

    const confirmSubmitSalida = (e: React.FormEvent) => {
        e.preventDefault();
        if (salidaForm.activosSeleccionados.length === 0) {
            showToast('Debe seleccionar al menos un activo para la salida.', 'error');
            return;
        }
        if (!salidaForm.usuario_de_activo) {
            showToast('Debe seleccionar un colaborador.', 'error');
            return;
        }

        const count = salidaForm.activosSeleccionados.length;
        setConfirmationModal({
            isOpen: true,
            title: 'Confirmar Asignación',
            message: `¿Está seguro de asignar ${count} activo(s) a ${salidaForm.nombre_usuario_activo}?`,
            onConfirm: processSubmitSalida
        });
    };

    const processSubmitSalida = async () => {
        setLoading(true);
        try {
            const { data: headerData, error: headerError } = await supabase
                .from('salida_activo_55')
                .insert([{
                    fecha_salida_activo: salidaForm.fecha_salida_activo,
                    usuario_de_activo: salidaForm.usuario_de_activo,
                    autoriza: salidaForm.autoriza,
                    observaciones: salidaForm.observaciones,
                    detalle_listo: false
                }])
                .select('boleta_salida_activo')
                .single();

            if (headerError) throw headerError;

            const details = salidaForm.activosSeleccionados.map(activo => ({
                boleta_salida_activo: headerData.boleta_salida_activo,
                numero_activo: activo.numero_activo,
                cantidad: 1
            }));

            const { error: detailsError } = await supabase
                .from('dato_salida_activo_56')
                .insert(details);

            if (detailsError) throw detailsError;

            showToast('Salida/Asignación registrada correctamente.', 'success');
            setSalidaForm({
                fecha_salida_activo: new Date().toLocaleDateString('en-CA'),
                usuario_de_activo: '',
                nombre_usuario_activo: '',
                autoriza: '',
                observaciones: '',
                activosSeleccionados: []
            });
            loadData();

        } catch (error: any) {
            console.error('Error en salida:', error);
            showToast('Error al registrar la salida: ' + error.message, 'error');
        } finally {
            setLoading(false);
            setConfirmationModal(prev => ({ ...prev, isOpen: false }));
        }
    };

    return (
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7]">
            <PageHeader
                title="Movimientos de Activos"
                subtitle="Gabinete de Gestión Operativa"
                icon={MousePointer2}
                themeColor="neutral"
                backRoute="/activos"
            />

            <div className="mx-auto max-w-7xl animate-fade-in-up px-4 pb-12 sm:px-6 lg:px-8">
                <div className="mb-6 grid grid-cols-1 gap-1.5 rounded-2xl border border-[#2d2d31] bg-[#0d0d0f] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.22)] sm:grid-cols-2">
                    <button
                        onClick={() => setActiveTab('entrada')}
                        className={cn(
                            "group flex min-h-[62px] items-center justify-center gap-3 rounded-xl border px-5 py-3 text-left transition-all",
                            activeTab === 'entrada'
                                ? "border-[#52525b] bg-[#242427] text-white shadow-[0_8px_24px_rgba(0,0,0,.28)]"
                                : "border-transparent bg-transparent text-[#71717a] hover:bg-[#171719] hover:text-[#d4d4d8]"
                        )}
                    >
                        <span className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                            activeTab === 'entrada' ? "border-[#63636b] bg-[#18181b]" : "border-[#303034] bg-[#121214]"
                        )}>
                            <ArrowDownCircle className="h-[18px] w-[18px]" />
                        </span>
                        <span>
                            <span className="block text-[12px] font-bold uppercase tracking-[0.12em]">Registrar entrada</span>
                            <span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-[#8c8c93]">Ingreso al inventario</span>
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('salida')}
                        className={cn(
                            "group flex min-h-[62px] items-center justify-center gap-3 rounded-xl border px-5 py-3 text-left transition-all",
                            activeTab === 'salida'
                                ? "border-[#52525b] bg-[#242427] text-white shadow-[0_8px_24px_rgba(0,0,0,.28)]"
                                : "border-transparent bg-transparent text-[#71717a] hover:bg-[#171719] hover:text-[#d4d4d8]"
                        )}
                    >
                        <span className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                            activeTab === 'salida' ? "border-[#63636b] bg-[#18181b]" : "border-[#303034] bg-[#121214]"
                        )}>
                            <ArrowUpCircle className="h-[18px] w-[18px]" />
                        </span>
                        <span>
                            <span className="block text-[12px] font-bold uppercase tracking-[0.12em]">Registrar salida</span>
                            <span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-[#8c8c93]">Asignación a un colaborador</span>
                        </span>
                    </button>
                </div>

                <div className="relative overflow-visible rounded-2xl border border-[#34343a] bg-[linear-gradient(145deg,#121214_0%,#0e0e10_100%)] shadow-[0_28px_90px_rgba(0,0,0,.38)] [&_label]:!font-semibold [&_label]:!normal-case [&_label]:!tracking-normal [&_label]:!text-[#b0b0b6] [&_label_svg]:!text-[#d4d4d8]">
                    <div className="relative p-5 sm:p-7 lg:p-9">
                        <div className="mb-8 flex items-start justify-between gap-4 border-b border-[#2b2b30] pb-7">
                            <div className="flex items-start gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#45454c] bg-[#19191c] text-[#f4f4f5] shadow-inner">
                                    {activeTab === 'entrada' ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
                                </span>
                                <div>
                                    <h2 className="text-xl font-bold tracking-[-0.02em] text-white sm:text-2xl">
                                        {activeTab === 'entrada' ? 'Registrar entrada de activo' : 'Registrar salida y asignación'}
                                    </h2>
                                    <p className="mt-1 text-sm text-[#a1a1aa]">
                                        {activeTab === 'entrada'
                                            ? 'Documente el ingreso de un activo al inventario institucional.'
                                            : 'Asigne uno o varios activos al colaborador responsable.'}
                                    </p>
                                </div>
                            </div>
                            <span className="hidden items-center gap-2 rounded-full border border-[#39393f] bg-[#171719] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b4b4ba] sm:flex">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#a1a1aa]" />
                                {activeTab === 'entrada' ? 'Movimiento de ingreso' : 'Movimiento de salida'}
                            </span>
                        </div>
                        {activeTab === 'entrada' ? (
                            <form onSubmit={confirmSubmitEntrada} className="space-y-8">
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] flex items-center gap-2 ml-1">
                                            <Calendar className="w-4 h-4 text-[#0071E3]" />
                                            Fecha de Entrada
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={entradaForm.fecha_entrada_activo}
                                            onChange={e => setEntradaForm({ ...entradaForm, fecha_entrada_activo: e.target.value })}
                                            className="min-h-[50px] w-full rounded-xl border border-[#35353a] bg-[#19191c] px-4 py-3 text-[#f4f4f5] outline-none transition-all focus:border-[#777780] focus:ring-2 focus:ring-white/5"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] flex items-center gap-2 ml-1">
                                            <User className="w-4 h-4 text-[#0071E3]" />
                                            Autoriza
                                        </label>
                                        <select
                                            required
                                            disabled={!!entradaForm.autoriza_entrada_activo}
                                            value={entradaForm.autoriza_entrada_activo}
                                            onChange={e => setEntradaForm({ ...entradaForm, autoriza_entrada_activo: e.target.value })}
                                            className={cn(
                                                "min-h-[50px] w-full rounded-xl border bg-[#19191c] px-4 py-3 text-[#f4f4f5] outline-none transition-all focus:ring-2 focus:ring-white/5",
                                                entradaForm.autoriza_entrada_activo ? "cursor-not-allowed border-[#3d3d43] bg-[#161619] text-[#c7c7cc]" : "border-[#35353a] focus:border-[#777780]"
                                            )}
                                        >
                                            <option value="">Seleccionar funcionario...</option>
                                            {colaboradores.map(col => (
                                                <option key={col.identificacion} value={col.identificacion}>
                                                    {col.alias}
                                                </option>
                                            ))}
                                        </select>
                                        {entradaForm.autoriza_entrada_activo && (
                                            <p className="mt-1 ml-1 flex items-center gap-1 text-[11px] font-medium text-[#a1a1aa]">
                                                <Shield className="w-3 h-3" /> Asignado automáticamente
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-[#2f2f34] bg-[#0b0b0d]/60 p-4 sm:p-6">
                                    <div className="mb-5 flex items-center gap-3 border-b border-[#2c2c31] pb-5">
                                        <span className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-2 text-[#d4d4d8]">
                                            <Package className="w-5 h-5" />
                                        </span>
                                        <div>
                                            <h3 className="text-base font-bold text-[#F5F5F7]">Activo a ingresar</h3>
                                            <p className="mt-0.5 text-xs text-[#8c8c93]">Busque y seleccione el activo que vuelve al inventario.</p>
                                        </div>
                                    </div>

                                    <div className="relative mb-4">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-5 w-5 text-[#86868B]" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Buscar activo por número, nombre o serie..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="min-h-[52px] w-full rounded-xl border border-[#3a3a40] bg-[#19191c] pl-11 pr-4 text-[#f4f4f5] outline-none transition-all placeholder:text-[#74747c] focus:border-[#777780] focus:ring-2 focus:ring-white/5"
                                        />
                                        {searchTerm && filteredActivos.length > 0 && (
                                            <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#414148] bg-[#151518] p-1.5 shadow-[0_22px_60px_rgba(0,0,0,.55)]">
                                                {filteredActivos.map(activo => (
                                                    <button
                                                        key={activo.numero_activo}
                                                        type="button"
                                                        onClick={() => handleAddActivoEntrada(activo)}
                                                        className="group flex w-full items-center justify-between rounded-lg px-3.5 py-3 text-left transition-colors hover:bg-[#242428]"
                                                    >
                                                        <div>
                                                            <span className="font-mono font-bold text-[#f4f4f5]">#{activo.numero_activo}</span>
                                                            <span className="text-[#F5F5F7] ml-2 font-medium">{activo.nombre_corto_activo}</span>
                                                            <span className="text-[#86868B] text-[10px] ml-2 font-black uppercase tracking-widest">({activo.marca_activo})</span>
                                                        </div>
                                                        <Plus className="h-5 w-5 text-[#777780] group-hover:text-white" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-[#303036] bg-[#101012]">
                                        {entradaForm.activosSeleccionados.length === 0 ? (
                                            <div className="flex min-h-[156px] flex-col items-center justify-center px-5 py-8 text-center">
                                                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[#34343a] bg-[#171719] text-[#777780]">
                                                    <PackageOpen className="h-5 w-5" />
                                                </span>
                                                <p className="text-sm font-semibold text-[#b4b4ba]">Ningún activo seleccionado</p>
                                                <p className="mt-1 text-xs text-[#71717a]">Utilice el buscador para agregar el activo.</p>
                                            </div>
                                        ) : (
                                            <table className="w-full text-left">
                                                <thead className="bg-[#171719] text-[10px] font-bold uppercase tracking-[0.12em] text-[#8c8c93]">
                                                    <tr>
                                                        <th className="px-6 py-4">No. Activo</th>
                                                        <th className="px-6 py-4">Nombre</th>
                                                        <th className="px-6 py-4">Serie</th>
                                                        <th className="px-6 py-4 text-right">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#333333]">
                                                    {entradaForm.activosSeleccionados.map(activo => (
                                                        <tr key={activo.numero_activo} className="hover:bg-white/5 transition-colors">
                                                            <td className="px-6 py-4 font-mono font-bold text-white">#{activo.numero_activo}</td>
                                                            <td className="px-6 py-4 text-[#F5F5F7] font-medium">{activo.nombre_corto_activo}</td>
                                                            <td className="px-6 py-4 text-[#86868B]">{activo.numero_serie_activo || '-'}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveActivoEntrada()}
                                                                    className="text-red-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-[4px] transition-all"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col-reverse items-stretch justify-between gap-4 border-t border-[#2c2c31] pt-6 sm:flex-row sm:items-center">
                                    <p className="flex items-center gap-2 text-xs text-[#777780]">
                                        <CheckCircle2 className="h-4 w-4" /> Revise los datos antes de guardar el movimiento.
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#f4f4f5] bg-[#f4f4f5] px-8 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#09090b] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        Guardar Entrada
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={confirmSubmitSalida} className="space-y-8">
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] flex items-center gap-2 ml-1">
                                            <Calendar className="w-4 h-4 text-[#0071E3]" />
                                            Fecha de Salida
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={salidaForm.fecha_salida_activo}
                                            onChange={e => setSalidaForm({ ...salidaForm, fecha_salida_activo: e.target.value })}
                                            className="min-h-[50px] w-full rounded-xl border border-[#35353a] bg-[#19191c] px-4 py-3 text-[#f4f4f5] outline-none transition-all focus:border-[#777780] focus:ring-2 focus:ring-white/5"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] flex items-center gap-2 ml-1">
                                            <User className="w-4 h-4 text-[#0071E3]" />
                                            Colaborador (Usuario)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                placeholder="Seleccionar colaborador..."
                                                value={salidaForm.nombre_usuario_activo || ''}
                                                className="min-h-[50px] w-full cursor-pointer rounded-xl border border-[#35353a] bg-[#19191c] px-4 py-3 text-[#f4f4f5] outline-none transition-all placeholder:text-[#74747c] hover:border-[#55555d] focus:border-[#777780] focus:ring-2 focus:ring-white/5"
                                                onClick={() => setShowColaboradorModal(true)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowColaboradorModal(true)}
                                                className="flex min-h-[50px] min-w-[50px] items-center justify-center rounded-xl border border-[#35353a] bg-[#19191c] text-[#c7c7cc] transition-all hover:border-[#5b5b63] hover:bg-[#222225] hover:text-white"
                                            >
                                                <Search className="w-5 h-5 text-[#86868B]" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] flex items-center gap-2 ml-1">
                                            <User className="w-4 h-4 text-[#0071E3]" />
                                            Autoriza
                                        </label>
                                        <select
                                            required
                                            disabled={!!salidaForm.autoriza}
                                            value={salidaForm.autoriza}
                                            onChange={e => setSalidaForm({ ...salidaForm, autoriza: e.target.value })}
                                            className={cn(
                                                "min-h-[50px] w-full rounded-xl border bg-[#19191c] px-4 py-3 text-[#f4f4f5] outline-none transition-all focus:ring-2 focus:ring-white/5",
                                                salidaForm.autoriza ? "cursor-not-allowed border-[#3d3d43] bg-[#161619] text-[#c7c7cc]" : "border-[#35353a] focus:border-[#777780]"
                                            )}
                                        >
                                            <option value="">Seleccionar funcionario...</option>
                                            {colaboradores.map(col => (
                                                <option key={col.identificacion} value={col.identificacion}>
                                                    {col.alias}
                                                </option>
                                            ))}
                                        </select>
                                        {salidaForm.autoriza && (
                                            <p className="mt-1 ml-1 flex items-center gap-1 text-[11px] font-medium text-[#a1a1aa]">
                                                <Shield className="w-3 h-3" /> Asignado automáticamente
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] flex items-center gap-2 ml-1">
                                            <FileText className="w-4 h-4 text-[#0071E3]" />
                                            Observaciones
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Notas adicionales..."
                                            value={salidaForm.observaciones}
                                            onChange={e => setSalidaForm({ ...salidaForm, observaciones: e.target.value })}
                                            className="min-h-[50px] w-full rounded-xl border border-[#35353a] bg-[#19191c] px-4 py-3 text-[#f4f4f5] outline-none transition-all placeholder:text-[#74747c] focus:border-[#777780] focus:ring-2 focus:ring-white/5"
                                        />
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-[#2f2f34] bg-[#0b0b0d]/60 p-4 sm:p-6">
                                    <div className="mb-5 flex items-center gap-3 border-b border-[#2c2c31] pb-5">
                                        <span className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-2 text-[#d4d4d8]">
                                            <Plus className="w-5 h-5" />
                                        </span>
                                        <div>
                                            <h3 className="text-base font-bold text-[#F5F5F7]">Activos a asignar</h3>
                                            <p className="mt-0.5 text-xs text-[#8c8c93]">Agregue uno o varios activos disponibles a esta salida.</p>
                                        </div>
                                    </div>

                                    <div className="relative mb-4">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-5 w-5 text-[#86868B]" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Buscar activo por número, nombre o serie..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="min-h-[52px] w-full rounded-xl border border-[#3a3a40] bg-[#19191c] pl-11 pr-4 text-[#f4f4f5] outline-none transition-all placeholder:text-[#74747c] focus:border-[#777780] focus:ring-2 focus:ring-white/5"
                                        />
                                        {searchTerm && filteredActivos.length > 0 && (
                                            <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#414148] bg-[#151518] p-1.5 shadow-[0_22px_60px_rgba(0,0,0,.55)]">
                                                {filteredActivos.map(activo => (
                                                    <button
                                                        key={activo.numero_activo}
                                                        type="button"
                                                        onClick={() => handleAddActivoSalida(activo)}
                                                        className="group flex w-full items-center justify-between rounded-lg px-3.5 py-3 text-left transition-colors hover:bg-[#242428]"
                                                    >
                                                        <div>
                                                            <span className="font-mono font-bold text-[#f4f4f5]">#{activo.numero_activo}</span>
                                                            <span className="text-[#F5F5F7] ml-2 font-medium">{activo.nombre_corto_activo}</span>
                                                            <span className="text-[#86868B] text-[10px] ml-2 font-black uppercase tracking-widest">({activo.marca_activo})</span>
                                                        </div>
                                                        <Plus className="h-5 w-5 text-[#777780] group-hover:text-white" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-[#303036] bg-[#101012]">
                                        {salidaForm.activosSeleccionados.length === 0 ? (
                                            <div className="flex min-h-[156px] flex-col items-center justify-center px-5 py-8 text-center">
                                                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[#34343a] bg-[#171719] text-[#777780]">
                                                    <PackageOpen className="h-5 w-5" />
                                                </span>
                                                <p className="text-sm font-semibold text-[#b4b4ba]">Ningún activo seleccionado</p>
                                                <p className="mt-1 text-xs text-[#71717a]">Utilice el buscador para preparar la asignación.</p>
                                            </div>
                                        ) : (
                                            <table className="w-full text-left">
                                                <thead className="bg-[#171719] text-[10px] font-bold uppercase tracking-[0.12em] text-[#8c8c93]">
                                                    <tr>
                                                        <th className="px-6 py-4">No. Activo</th>
                                                        <th className="px-6 py-4">Nombre</th>
                                                        <th className="px-6 py-4">Serie</th>
                                                        <th className="px-6 py-4 text-right">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#333333]">
                                                    {salidaForm.activosSeleccionados.map(activo => (
                                                        <tr key={activo.numero_activo} className="hover:bg-white/5 transition-colors">
                                                            <td className="px-6 py-4 font-mono font-bold text-white">#{activo.numero_activo}</td>
                                                            <td className="px-6 py-4 text-[#F5F5F7] font-medium">{activo.nombre_corto_activo}</td>
                                                            <td className="px-6 py-4 text-[#86868B]">{activo.numero_serie_activo || '-'}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveActivoSalida(activo.numero_activo)}
                                                                    className="text-red-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-[4px] transition-all"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col-reverse items-stretch justify-between gap-4 border-t border-[#2c2c31] pt-6 sm:flex-row sm:items-center">
                                    <p className="flex items-center gap-2 text-xs text-[#777780]">
                                        <CheckCircle2 className="h-4 w-4" /> Revise los datos antes de guardar el movimiento.
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#f4f4f5] bg-[#f4f4f5] px-8 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#09090b] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        Guardar Salida
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            <ColaboradorSearchModal
                isOpen={showColaboradorModal}
                onClose={() => setShowColaboradorModal(false)}
                onSelect={handleSelectColaborador}
                colaboradores={colaboradores}
            />

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
