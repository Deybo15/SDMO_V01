import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    ArrowLeft, Save, Plus, Trash2, Calendar, User,
    FileText, ArrowDownCircle, ArrowUpCircle, Search,
    UserPlus, ChevronLeft, Shield, MousePointer2,
    Package, Loader2, ChevronDown
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
        loadData();
    }, []);

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

    const loadData = async () => {
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
            showToast('Error al cargar datos', 'error');
        }
    };

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
                backRoute="/activos"
            />

            <div className="max-w-7xl mx-auto px-8 pb-12 animate-fade-in-up">
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={() => setActiveTab('entrada')}
                        className={cn(
                            "flex-1 py-4 px-6 rounded-2xl border transition-all flex items-center justify-center gap-3",
                            activeTab === 'entrada'
                                ? "border-[#0071E3] bg-[#0071E3]/10 text-[#0071E3] shadow-lg shadow-[#0071E3]/20"
                                : "border-[#333333] bg-[#121212] text-[#86868B] hover:border-[#F5F5F7]/20"
                        )}
                    >
                        <ArrowDownCircle className="w-6 h-6" />
                        <span className="font-black text-[12px] uppercase tracking-widest">Registrar Entrada (Ingreso)</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('salida')}
                        className={cn(
                            "flex-1 py-4 px-6 rounded-2xl border transition-all flex items-center justify-center gap-3",
                            activeTab === 'salida'
                                ? "border-[#0071E3] bg-[#0071E3]/10 text-[#0071E3] shadow-lg shadow-[#0071E3]/20"
                                : "border-[#333333] bg-[#121212] text-[#86868B] hover:border-[#F5F5F7]/20"
                        )}
                    >
                        <ArrowUpCircle className="w-6 h-6" />
                        <span className="font-black text-[12px] uppercase tracking-widest">Registrar Salida (Asignación)</span>
                    </button>
                </div>

                <div className="bg-[#121212] rounded-3xl border border-[#333333] overflow-hidden shadow-2xl p-6 relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#0071E3]/5 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="p-2 relative z-10">
                        {activeTab === 'entrada' ? (
                            <form onSubmit={confirmSubmitEntrada} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-4 py-3 text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all"
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
                                                "w-full bg-[#1D1D1F] border rounded-[8px] px-4 py-3 text-[#F5F5F7] outline-none transition-all",
                                                entradaForm.autoriza_entrada_activo ? "border-[#0071E3]/20 bg-[#0071E3]/5 opacity-80 cursor-not-allowed" : "border-[#333333] focus:border-[#0071E3]"
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
                                            <p className="text-[10px] text-[#0071E3]/70 font-black uppercase mt-1 ml-1 flex items-center gap-1 tracking-widest">
                                                <Shield className="w-3 h-3" /> Asignado automáticamente
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 pb-4 border-b border-[#333333]">
                                        <span className="p-2 rounded-lg bg-[#0071E3]/10 text-[#0071E3]">
                                            <Package className="w-5 h-5" />
                                        </span>
                                        <h3 className="text-lg font-black text-[#F5F5F7] uppercase tracking-widest text-[12px]">Activo a Ingresar</h3>
                                    </div>

                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-5 w-5 text-[#86868B]" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Buscar activo por número, nombre o serie..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-10 pr-4 py-3 text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all placeholder-[#86868B]"
                                        />
                                        {searchTerm && filteredActivos.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl max-h-60 overflow-y-auto">
                                                {filteredActivos.map(activo => (
                                                    <button
                                                        key={activo.numero_activo}
                                                        type="button"
                                                        onClick={() => handleAddActivoEntrada(activo)}
                                                        className="w-full text-left px-4 py-3 hover:bg-[#1D1D1F] transition-colors border-b border-[#333333] last:border-0 flex justify-between items-center group"
                                                    >
                                                        <div>
                                                            <span className="font-black text-[#0071E3]">#{activo.numero_activo}</span>
                                                            <span className="text-[#F5F5F7] ml-2 font-medium">{activo.nombre_corto_activo}</span>
                                                            <span className="text-[#86868B] text-[10px] ml-2 font-black uppercase tracking-widest">({activo.marca_activo})</span>
                                                        </div>
                                                        <Plus className="w-5 h-5 text-[#86868B] group-hover:text-[#0071E3]" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-[#000000]/30 rounded-2xl border border-[#333333] overflow-hidden">
                                        {entradaForm.activosSeleccionados.length === 0 ? (
                                            <div className="p-8 text-center text-[#86868B] font-black uppercase text-[10px] tracking-widest">
                                                No hay activo seleccionado.
                                            </div>
                                        ) : (
                                            <table className="w-full text-left">
                                                <thead className="bg-[#000000]/50 text-[#86868B] text-[10px] font-black uppercase tracking-widest">
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
                                                            <td className="px-6 py-4 font-mono text-[#0071E3] font-bold">#{activo.numero_activo}</td>
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

                                <div className="flex justify-end pt-4 border-t border-[#333333]">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-8 py-3.5 bg-[#0071E3] hover:bg-[#0071E3] text-white font-black uppercase text-[10px] tracking-widest rounded-[8px] shadow-lg shadow-[#0071E3]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        Guardar Entrada
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={confirmSubmitSalida} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-4 py-3 text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all"
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
                                                className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-4 py-3 text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all cursor-default placeholder-[#86868B]"
                                                onClick={() => setShowColaboradorModal(true)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowColaboradorModal(true)}
                                                className="px-4 py-3 bg-[#1D1D1F] border border-[#333333] hover:border-[#F5F5F7]/20 text-[#F5F5F7] rounded-[8px] transition-all"
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
                                                "w-full bg-[#1D1D1F] border rounded-[8px] px-4 py-3 text-[#F5F5F7] outline-none transition-all",
                                                salidaForm.autoriza ? "border-[#0071E3]/20 bg-[#0071E3]/5 opacity-80 cursor-not-allowed" : "border-[#333333] focus:border-[#0071E3]"
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
                                            <p className="text-[10px] text-[#0071E3]/70 font-black uppercase mt-1 ml-1 flex items-center gap-1 tracking-widest">
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
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-4 py-3 text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all placeholder-[#86868B]"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 pb-4 border-b border-[#333333]">
                                        <span className="p-2 rounded-lg bg-[#0071E3]/10 text-[#0071E3]">
                                            <Plus className="w-5 h-5" />
                                        </span>
                                        <h3 className="text-lg font-black text-[#F5F5F7] uppercase tracking-widest text-[12px]">Activos a Asignar (Salida)</h3>
                                    </div>

                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-5 w-5 text-[#86868B]" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Buscar activo por número, nombre o serie..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-10 pr-4 py-3 text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all placeholder-[#86868B]"
                                        />
                                        {searchTerm && filteredActivos.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl max-h-60 overflow-y-auto">
                                                {filteredActivos.map(activo => (
                                                    <button
                                                        key={activo.numero_activo}
                                                        type="button"
                                                        onClick={() => handleAddActivoSalida(activo)}
                                                        className="w-full text-left px-4 py-3 hover:bg-[#1D1D1F] transition-colors border-b border-[#333333] last:border-0 flex justify-between items-center group"
                                                    >
                                                        <div>
                                                            <span className="font-black text-[#0071E3]">#{activo.numero_activo}</span>
                                                            <span className="text-[#F5F5F7] ml-2 font-medium">{activo.nombre_corto_activo}</span>
                                                            <span className="text-[#86868B] text-[10px] ml-2 font-black uppercase tracking-widest">({activo.marca_activo})</span>
                                                        </div>
                                                        <Plus className="w-5 h-5 text-[#86868B] group-hover:text-[#0071E3]" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-[#000000]/30 rounded-2xl border border-[#333333] overflow-hidden">
                                        {salidaForm.activosSeleccionados.length === 0 ? (
                                            <div className="p-8 text-center text-[#86868B] font-black uppercase text-[10px] tracking-widest">
                                                No hay activos seleccionados para la salida.
                                            </div>
                                        ) : (
                                            <table className="w-full text-left">
                                                <thead className="bg-[#000000]/50 text-[#86868B] text-[10px] font-black uppercase tracking-widest">
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
                                                            <td className="px-6 py-4 font-mono text-[#0071E3] font-bold">#{activo.numero_activo}</td>
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

                                <div className="flex justify-end pt-4 border-t border-[#333333]">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-8 py-3.5 bg-[#0071E3] hover:bg-[#0071E3] text-white font-black uppercase text-[10px] tracking-widest rounded-[8px] shadow-lg shadow-[#0071E3]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
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
