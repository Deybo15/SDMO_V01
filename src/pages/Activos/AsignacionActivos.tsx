import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Save, Plus, Trash2, Calendar, User, FileText, ArrowDownCircle, ArrowUpCircle, Search, UserPlus, ChevronLeft, Shield } from 'lucide-react';
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
        fecha_entrada_activo: new Date().toISOString().split('T')[0],
        autoriza_entrada_activo: '',
        activosSeleccionados: [] as Activo[]
    });

    // Salida Form State
    const [salidaForm, setSalidaForm] = useState({
        fecha_salida_activo: new Date().toISOString().split('T')[0],
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
                // Filter by search term
                const matchesSearch =
                    a.numero_activo.toString().includes(lower) ||
                    a.nombre_corto_activo.toLowerCase().includes(lower) ||
                    (a.numero_serie_activo && a.numero_serie_activo.toLowerCase().includes(lower));

                // If in 'salida' tab, exclude assigned assets
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
                // Extract IDs and filter out nulls if any
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

    // --- Logic for Entrada ---

    const handleAddActivoEntrada = (activo: Activo) => {
        // Enforce single asset selection for Entrada
        setEntradaForm(prev => ({
            ...prev,
            activosSeleccionados: [activo] // Replace any existing selection with the new one
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
            // 1. Insert Header
            const { data: headerData, error: headerError } = await supabase
                .from('entrada_activo_52')
                .insert([{
                    fecha_entrada_activo: entradaForm.fecha_entrada_activo,
                    autoriza_entrada_activo: entradaForm.autoriza_entrada_activo
                }])
                .select('id_entrada_activo')
                .single();

            if (headerError) throw headerError;

            // 2. Insert Details
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
                fecha_entrada_activo: new Date().toISOString().split('T')[0],
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

    // --- Logic for Salida ---

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
            // 1. Insert Header
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

            // 2. Insert Details
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
                fecha_salida_activo: new Date().toISOString().split('T')[0],
                usuario_de_activo: '',
                nombre_usuario_activo: '',
                autoriza: '',
                observaciones: '',
                activosSeleccionados: []
            });
            // Reload data to update assigned assets list
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
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="sticky top-0 z-30 flex items-center justify-between py-6 mb-8 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 -mx-6 px-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <UserPlus className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Movimientos de Activos</h1>
                </div>
                <button
                    onClick={() => navigate('/activos')}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all text-sm font-medium"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Regresar
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => setActiveTab('entrada')}
                    className={`flex-1 py-4 px-6 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${activeTab === 'entrada'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                        }`}
                >
                    <ArrowDownCircle className="w-6 h-6" />
                    <span className="font-bold text-lg">Registrar Entrada (Ingreso)</span>
                </button>
                <button
                    onClick={() => setActiveTab('salida')}
                    className={`flex-1 py-4 px-6 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${activeTab === 'salida'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                        }`}
                >
                    <ArrowUpCircle className="w-6 h-6" />
                    <span className="font-bold text-lg">Registrar Salida (Asignación)</span>
                </button>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden shadow-xl p-6">

                {/* --- ENTRADA FORM --- */}
                {activeTab === 'entrada' && (
                    <form onSubmit={confirmSubmitEntrada} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-emerald-500" />
                                    Fecha de Entrada
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={entradaForm.fecha_entrada_activo}
                                    onChange={e => setEntradaForm({ ...entradaForm, fecha_entrada_activo: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <User className="w-4 h-4 text-emerald-500" />
                                    Autoriza
                                </label>
                                <select
                                    required
                                    disabled={!!entradaForm.autoriza_entrada_activo}
                                    value={entradaForm.autoriza_entrada_activo}
                                    onChange={e => setEntradaForm({ ...entradaForm, autoriza_entrada_activo: e.target.value })}
                                    className={cn(
                                        "w-full px-4 py-3 bg-slate-900/50 border rounded-xl text-slate-200 outline-none transition-all",
                                        entradaForm.autoriza_entrada_activo ? "border-emerald-500/20 bg-emerald-500/5 opacity-80 cursor-not-allowed" : "border-slate-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                    )}
                                >
                                    <option value="">Seleccionar funcionario...</option>
                                    {colaboradores.filter(c => c.autorizado).map(col => (
                                        <option key={col.identificacion} value={col.identificacion}>
                                            {col.alias}
                                        </option>
                                    ))}
                                </select>
                                {entradaForm.autoriza_entrada_activo && (
                                    <p className="text-[10px] text-emerald-500/70 font-bold uppercase mt-1 ml-1 flex items-center gap-1">
                                        <Shield className="w-3 h-3" /> Asignado automáticamente
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Activo a Ingresar</h3>
                            <p className="text-sm text-slate-400">Seleccione un único activo para registrar su entrada.</p>

                            {/* Search Activo */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-slate-500" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar activo por número, nombre o serie..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                                />
                                {searchTerm && filteredActivos.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                        {filteredActivos.map(activo => (
                                            <button
                                                key={activo.numero_activo}
                                                type="button"
                                                onClick={() => handleAddActivoEntrada(activo)}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0 flex justify-between items-center group"
                                            >
                                                <div>
                                                    <span className="font-bold text-emerald-400">#{activo.numero_activo}</span>
                                                    <span className="text-slate-200 ml-2">{activo.nombre_corto_activo}</span>
                                                    <span className="text-slate-500 text-sm ml-2">({activo.marca_activo})</span>
                                                </div>
                                                <Plus className="w-5 h-5 text-slate-400 group-hover:text-emerald-400" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected List */}
                            <div className="bg-slate-900/30 rounded-xl border border-slate-700/50 overflow-hidden">
                                {entradaForm.activosSeleccionados.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">
                                        No hay activo seleccionado.
                                    </div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-900/50 text-slate-400 text-sm uppercase">
                                            <tr>
                                                <th className="px-6 py-3">No. Activo</th>
                                                <th className="px-6 py-3">Nombre</th>
                                                <th className="px-6 py-3">Serie</th>
                                                <th className="px-6 py-3 text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {entradaForm.activosSeleccionados.map(activo => (
                                                <tr key={activo.numero_activo} className="hover:bg-slate-800/30">
                                                    <td className="px-6 py-3 font-mono text-emerald-400">#{activo.numero_activo}</td>
                                                    <td className="px-6 py-3 text-slate-200">{activo.nombre_corto_activo}</td>
                                                    <td className="px-6 py-3 text-slate-400">{activo.numero_serie_activo || '-'}</td>
                                                    <td className="px-6 py-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveActivoEntrada()}
                                                            className="text-red-400 hover:text-red-300 p-1 hover:bg-red-400/10 rounded"
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

                        <div className="flex justify-end pt-4 border-t border-slate-700">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <Save className="w-5 h-5" />}
                                Guardar Entrada
                            </button>
                        </div>
                    </form>
                )}

                {/* --- SALIDA FORM --- */}
                {activeTab === 'salida' && (
                    <form onSubmit={confirmSubmitSalida} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-500" />
                                    Fecha de Salida
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={salidaForm.fecha_salida_activo}
                                    onChange={e => setSalidaForm({ ...salidaForm, fecha_salida_activo: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>

                            {/* Colaborador Searchable Input */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <User className="w-4 h-4 text-blue-500" />
                                    Colaborador (Usuario)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        placeholder="Seleccionar colaborador..."
                                        value={salidaForm.nombre_usuario_activo || ''}
                                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all cursor-default"
                                        onClick={() => setShowColaboradorModal(true)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowColaboradorModal(true)}
                                        className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                                        title="Buscar Colaborador"
                                    >
                                        <Search className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <User className="w-4 h-4 text-blue-500" />
                                    Autoriza
                                </label>
                                <select
                                    required
                                    disabled={!!salidaForm.autoriza}
                                    value={salidaForm.autoriza}
                                    onChange={e => setSalidaForm({ ...salidaForm, autoriza: e.target.value })}
                                    className={cn(
                                        "w-full px-4 py-3 bg-slate-900/50 border rounded-xl text-slate-200 outline-none transition-all",
                                        salidaForm.autoriza ? "border-blue-500/20 bg-blue-500/5 opacity-80 cursor-not-allowed" : "border-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                                    )}
                                >
                                    <option value="">Seleccionar funcionario...</option>
                                    {colaboradores.filter(c => c.autorizado).map(col => (
                                        <option key={col.identificacion} value={col.identificacion}>
                                            {col.alias}
                                        </option>
                                    ))}
                                </select>
                                {salidaForm.autoriza && (
                                    <p className="text-[10px] text-blue-500/70 font-bold uppercase mt-1 ml-1 flex items-center gap-1">
                                        <Shield className="w-3 h-3" /> Asignado automáticamente
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-500" />
                                    Observaciones
                                </label>
                                <input
                                    type="text"
                                    placeholder="Notas adicionales..."
                                    value={salidaForm.observaciones}
                                    onChange={e => setSalidaForm({ ...salidaForm, observaciones: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Activos a Asignar (Salida)</h3>

                            {/* Search Activo */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-slate-500" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar activo por número, nombre o serie..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                />
                                {searchTerm && filteredActivos.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                        {filteredActivos.map(activo => (
                                            <button
                                                key={activo.numero_activo}
                                                type="button"
                                                onClick={() => handleAddActivoSalida(activo)}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0 flex justify-between items-center group"
                                            >
                                                <div>
                                                    <span className="font-bold text-blue-400">#{activo.numero_activo}</span>
                                                    <span className="text-slate-200 ml-2">{activo.nombre_corto_activo}</span>
                                                    <span className="text-slate-500 text-sm ml-2">({activo.marca_activo})</span>
                                                </div>
                                                <Plus className="w-5 h-5 text-slate-400 group-hover:text-blue-400" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected List */}
                            <div className="bg-slate-900/30 rounded-xl border border-slate-700/50 overflow-hidden">
                                {salidaForm.activosSeleccionados.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">
                                        No hay activos seleccionados para la salida.
                                    </div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-900/50 text-slate-400 text-sm uppercase">
                                            <tr>
                                                <th className="px-6 py-3">No. Activo</th>
                                                <th className="px-6 py-3">Nombre</th>
                                                <th className="px-6 py-3">Serie</th>
                                                <th className="px-6 py-3 text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {salidaForm.activosSeleccionados.map(activo => (
                                                <tr key={activo.numero_activo} className="hover:bg-slate-800/30">
                                                    <td className="px-6 py-3 font-mono text-blue-400">#{activo.numero_activo}</td>
                                                    <td className="px-6 py-3 text-slate-200">{activo.nombre_corto_activo}</td>
                                                    <td className="px-6 py-3 text-slate-400">{activo.numero_serie_activo || '-'}</td>
                                                    <td className="px-6 py-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveActivoSalida(activo.numero_activo)}
                                                            className="text-red-400 hover:text-red-300 p-1 hover:bg-red-400/10 rounded"
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

                        <div className="flex justify-end pt-4 border-t border-slate-700">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <Save className="w-5 h-5" />}
                                Guardar Salida
                            </button>
                        </div>
                    </form>
                )}

            </div>

            {/* Modals & Toasts */}
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
