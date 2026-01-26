import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Monitor,
    Save,
    User,
    Loader2,
    Search
} from 'lucide-react';

// Custom Architecture
import { useTransactionManager } from '../hooks/useTransactionManager';
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import { Equipo } from '../types/inventory';
import ArticuloSearchModal from '../components/ArticleSearchModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import EquipoSearchModal from '../components/EquipoSearchModal';
import { supabase } from '../lib/supabase';

export default function EquiposActivos() {
    const [searchParams] = useSearchParams();

    // 1. Hook Integration
    const {
        loading,
        feedback,
        items,
        colaboradores,
        addEmptyRow,
        updateRow,
        updateRowWithArticle,
        removeRow,
        autorizaId,
        processTransaction,
        showAlert
    } = useTransactionManager({
        tipoSalidaId: 'EQ',
        defaultDescription: 'Solicitud Equipos Tecnológicos',
        onSuccessRoute: '/otras-solicitudes/equipos-activos',
        onSuccess: () => {
            setretira('');
            setcomentarios('');
            setSelectedEquipoValue('');
            showAlert('Solicitud procesada y ventana reiniciada', 'success');
        }
    });

    // 2. Local State
    const [showSearch, setShowSearch] = useState(false);
    const [currentRowIndex, setCurrentRowIndex] = useState<number>(-1);
    const [autoriza, setautoriza] = useState('');
    const [retira, setretira] = useState('');
    const [comentarios, setcomentarios] = useState('');
    const [numeroSolicitud] = useState(searchParams.get('numero') || '');

    // Equipos State (Custom for this page)
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [selectedEquipoValue, setSelectedEquipoValue] = useState('');
    const [isEquipoModalOpen, setIsEquipoModalOpen] = useState(false);
    // 3. Validation
    const isFormValid =
        selectedEquipoValue !== '' &&
        autoriza !== '' &&
        retira !== '' &&
        items.some(item => item.codigo_articulo && Number(item.cantidad) > 0);

    useEffect(() => {
        if (autorizaId) {
            setautoriza(autorizaId);
        }
    }, [autorizaId]);

    useEffect(() => {
        const fetchEquipos = async () => {
            const { data } = await supabase
                .from('equipo_automotor')
                .select('numero_activo, placa, descripcion_equipo');
            if (data) setEquipos(data);
        };
        fetchEquipos();
    }, []);

    // Modals
    const [showColaboradorModal, setShowColaboradorModal] = useState(false);
    const [colaboradorField, setColaboradorField] = useState<'autoriza' | 'retira'>('autoriza');

    // Theme (Blue for Equipment)
    const colorTheme = 'blue';

    // Handlers
    const handleOpenSearch = (index: number) => {
        setCurrentRowIndex(index);
        setShowSearch(true);
    };

    const handleProcess = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedEquipoValue) {
            showAlert('Seleccione un activo / equipo', 'error');
            return;
        }

        processTransaction(
            {
                autoriza,
                retira,
                comentarios,
                numero_solicitud: numeroSolicitud,
                equipo_automotor: selectedEquipoValue
            }
        );
    };


    return (
        <div className="min-h-screen bg-[#0f111a] font-['Inter']">
            <PageHeader
                title="Equipos y Activos"
                icon={Monitor}
                themeColor={colorTheme}
                gradientFrom="from-blue-900"
                gradientTo="to-slate-900"
            />

            <div className="max-w-7xl mx-auto p-6">
                {/* Feedback Toast */}
                {feedback && (
                    <div className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md border animate-fade-in-down flex items-center gap-3 ${feedback.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                        feedback.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                            'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                        }`}>
                        {feedback.message}
                    </div>
                )}

                <div className="bg-[#1e2235] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                    <form onSubmit={handleProcess} className="p-4 md:p-8">
                        {/* Headers Section */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-6 mb-8">
                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-3 text-blue-400">
                                <User className="w-5 h-5" />
                                Información de Responsables
                            </h3>

                            {/* Equipo Selector */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Activo / Equipo <span className="text-red-400">*</span></label>
                                <div className="relative group">
                                    <div
                                        onClick={() => setIsEquipoModalOpen(true)}
                                        className={`w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-5 pr-12 cursor-pointer transition-all hover:bg-white/10 flex items-center justify-between active:scale-[0.99] ${!selectedEquipoValue ? 'text-gray-500' : 'text-white'}`}
                                    >
                                        <span className="truncate font-medium">
                                            {selectedEquipoValue ? (
                                                (() => {
                                                    const eq = equipos.find(e => e.numero_activo.toString() === selectedEquipoValue);
                                                    return eq ? `${eq.numero_activo} - ${eq.placa} - ${eq.descripcion_equipo}` : selectedEquipoValue;
                                                })()
                                            ) : '-- Seleccione un activo --'}
                                        </span>
                                        <Search className="w-5 h-5 text-blue-400" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Responsable que autoriza <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative group">
                                        <div
                                            className="w-full bg-black/40 border border-white/5 rounded-xl py-4 px-5 text-white cursor-not-allowed flex items-center justify-between opacity-75 shadow-inner"
                                            title="El responsable se asigna automáticamente según su usuario"
                                        >
                                            <span className={autoriza ? 'text-blue-400 font-bold' : 'text-gray-500 italic'}>
                                                {autoriza ? colaboradores.todos.find(c => c.identificacion === autoriza)?.alias || colaboradores.todos.find(c => c.identificacion === autoriza)?.colaborador : 'Usuario no identificado'}
                                            </span>
                                            <User className={`w-5 h-5 text-blue-400/50 ml-2`} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Persona que retira <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative group">
                                        <div
                                            onClick={() => {
                                                setColaboradorField('retira');
                                                setShowColaboradorModal(true);
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-5 pr-12 text-white cursor-pointer hover:bg-white/10 transition-colors flex items-center justify-between active:scale-[0.99] shadow-inner"
                                        >
                                            <span className={retira ? 'text-white' : 'text-gray-500 italic font-medium'}>
                                                {retira ? colaboradores.todos.find((c: any) => c.identificacion === retira)?.alias || colaboradores.todos.find((c: any) => c.identificacion === retira)?.colaborador : '-- Seleccione --'}
                                            </span>
                                            <User className={`w-5 h-5 text-blue-400 ml-2`} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Comentarios</label>
                                <textarea
                                    value={comentarios}
                                    onChange={(e) => setcomentarios(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none min-h-[120px] transition-all focus:ring-1 focus:ring-blue-500/50 shadow-inner"
                                    placeholder="Detalles adicionales sobre esta solicitud de equipos..."
                                />
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-6 mb-8">
                            <TransactionTable
                                items={items}
                                onUpdateRow={updateRow}
                                onRemoveRow={removeRow}
                                onOpenSearch={handleOpenSearch}
                                onAddRow={addEmptyRow}
                                onWarning={(msg) => showAlert(msg, 'warning')}
                                themeColor={colorTheme}
                            />
                        </div>

                        {/* Actions */}
                        <button
                            type="submit"
                            disabled={loading || !isFormValid}
                            className={`w-full md:w-auto px-8 py-4 bg-gradient-to-r from-${colorTheme}-600 to-${colorTheme}-400 text-white font-black rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shadow-xl shadow-${colorTheme}-500/20 active:scale-95`}
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                            <span className="text-lg">Procesar Solicitud</span>
                        </button>
                    </form>
                </div>
            </div>

            {/* Colaborador Modal */}
            <ColaboradorSearchModal
                isOpen={showColaboradorModal}
                onClose={() => setShowColaboradorModal(false)}
                onSelect={(c) => {
                    if (colaboradorField === 'autoriza') {
                        // Autoriza is locked, but we keep the handler for completeness if needed
                    } else {
                        setretira(c.identificacion);
                    }
                    setShowColaboradorModal(false);
                }}
                colaboradores={colaboradorField === 'autoriza' ? colaboradores.autorizados : colaboradores.todos.filter((c: any) => c.identificacion !== autoriza)}
            />

            {/* Equipo Search Modal */}
            <EquipoSearchModal
                isOpen={isEquipoModalOpen}
                onClose={() => setIsEquipoModalOpen(false)}
                equipos={equipos}
                onSelect={(e) => {
                    setSelectedEquipoValue(e.numero_activo.toString());
                    setIsEquipoModalOpen(false);
                }}
            />

            {/* Article Search Modal */}
            <ArticuloSearchModal
                isOpen={showSearch}
                onClose={() => setShowSearch(false)}
                onSelect={(article) => updateRowWithArticle(currentRowIndex, article)}
                themeColor={colorTheme}
            />
        </div>
    );
}
