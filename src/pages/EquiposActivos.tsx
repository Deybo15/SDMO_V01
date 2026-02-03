import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Monitor,
    Save,
    User,
    Loader2,
    Search,
    ArrowLeft
} from 'lucide-react';

// Custom Architecture
import { useTransactionManager } from '../hooks/useTransactionManager';
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import { Card } from '../components/ui/Card';
import { Equipo } from '../types/inventory';
import ArticleSearchGridModal from '../components/ArticleSearchGridModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import EquipoSearchModal from '../components/EquipoSearchModal';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export default function EquiposActivos() {
    const navigate = useNavigate();
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
        <div className="min-h-screen bg-[#000000]">
            <PageHeader
                title="Equipos y Activos"
                icon={Monitor}
                themeColor={colorTheme}
                rightElement={
                    <button
                        onClick={() => navigate('/otras-solicitudes')}
                        className="btn-ghost px-6 py-3 border border-[#F5F5F7]/20 rounded-[8px] hover:bg-[#F5F5F7]/5 transition-all flex items-center gap-2 group"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#86868B] group-hover:text-[#F5F5F7] transition-colors" />
                        <span className="text-[11px] font-bold text-[#86868B] group-hover:text-[#F5F5F7] uppercase tracking-widest">Regresar</span>
                    </button>
                }
            />

            <div className="max-w-7xl mx-auto p-8 pb-32">
                {/* Feedback Toast */}
                {feedback && (
                    <div className={cn(
                        "fixed top-8 right-8 z-[100] px-6 py-4 rounded-[8px] shadow-2xl backdrop-blur-md border animate-fade-in-down flex items-center gap-3",
                        feedback.type === 'success' ? 'bg-[#0071E3]/20 border-[#0071E3]/50 text-[#0071E3]' :
                            feedback.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                                'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                    )}>
                        {feedback.message}
                    </div>
                )}

                <Card className="overflow-hidden border-[#333333] shadow-4xl mb-12">
                    <form onSubmit={handleProcess} className="p-8 md:p-10">
                        {/* Headers Section */}
                        <div className="space-y-2 mb-10">
                            <h3 className="text-2xl font-bold text-[#F5F5F7] tracking-tight uppercase flex items-center gap-3 italic">
                                <User className="w-6 h-6 text-[#0071E3]" />
                                Información de Responsables
                            </h3>
                            <p className="text-xs text-[#86868B] font-medium uppercase tracking-widest ml-9">Defina los parámetros de la asignación y responsables</p>
                        </div>

                        <div className="bg-[#1D1D1F]/30 border border-[#333333] rounded-[8px] p-6 md:p-8 mb-10">

                            {/* Equipo Selector */}
                            <div className="mb-8">
                                <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-widest mb-3">Activo / Equipo <span className="text-red-400">*</span></label>
                                <div className="relative group">
                                    <div
                                        onClick={() => setIsEquipoModalOpen(true)}
                                        className={`w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] py-5 pl-6 pr-12 cursor-pointer transition-all hover:bg-[#1D1D1F]/80 flex items-center justify-between active:scale-[0.99] shadow-inner ${!selectedEquipoValue ? 'text-[#86868B]' : 'text-[#F5F5F7]'}`}
                                    >
                                        <span className="truncate font-black text-sm tracking-tight">
                                            {selectedEquipoValue ? (
                                                (() => {
                                                    const eq = equipos.find(e => e.numero_activo.toString() === selectedEquipoValue);
                                                    return eq ? `${eq.numero_activo} - ${eq.placa} - ${eq.descripcion_equipo}` : selectedEquipoValue;
                                                })()
                                            ) : '-- Seleccione un activo --'}
                                        </span>
                                        <Search className="w-5 h-5 text-[#0071E3] group-hover:scale-110 transition-transform" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                <div>
                                    <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-widest mb-3">
                                        Responsable que autoriza <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative group">
                                        <div
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] py-5 px-6 text-[#F5F5F7] cursor-not-allowed flex items-center justify-between opacity-80 shadow-inner"
                                            title="El responsable se asigna automáticamente según su usuario"
                                        >
                                            <span className={autoriza ? 'text-[#0071E3] font-black text-sm' : 'text-[#86868B] italic'}>
                                                {autoriza ? colaboradores.todos.find(c => c.identificacion === autoriza)?.alias || colaboradores.todos.find(c => c.identificacion === autoriza)?.colaborador : 'Usuario no identificado'}
                                            </span>
                                            <User className={`w-5 h-5 text-[#0071E3]/50 ml-2`} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-widest mb-3">
                                        Persona que retira <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative group">
                                        <div
                                            onClick={() => {
                                                setColaboradorField('retira');
                                                setShowColaboradorModal(true);
                                            }}
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] py-5 pl-6 pr-12 text-[#F5F5F7] cursor-pointer hover:bg-[#1D1D1F]/80 transition-colors flex items-center justify-between active:scale-[0.99] shadow-inner"
                                        >
                                            <span className={retira ? 'text-[#F5F5F7] font-black text-sm' : 'text-[#86868B] italic font-black text-sm'}>
                                                {retira ? colaboradores.todos.find((c: any) => c.identificacion === retira)?.alias || colaboradores.todos.find((c: any) => c.identificacion === retira)?.colaborador : '-- Seleccione --'}
                                            </span>
                                            <User className={`w-5 h-5 text-[#0071E3] ml-2`} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-widest mb-3">Comentarios</label>
                                <textarea
                                    value={comentarios}
                                    onChange={(e) => setcomentarios(e.target.value)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-6 text-[#F5F5F7] focus:border-[#0071E3] outline-none min-h-[140px] transition-all shadow-inner placeholder-[#424245] text-sm font-bold"
                                    placeholder="Detalles adicionales sobre esta solicitud de equipos..."
                                />
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="space-y-2 mb-10">
                            <h3 className="text-2xl font-bold text-[#F5F5F7] tracking-tight uppercase flex items-center gap-3 italic">
                                <Monitor className="w-6 h-6 text-[#0071E3]" />
                                Detalle de Artículos
                            </h3>
                            <p className="text-xs text-[#86868B] font-medium uppercase tracking-widest ml-9">Seleccione los activos y equipos a entregar</p>
                        </div>

                        <div className="bg-[#1D1D1F]/30 border border-[#333333] rounded-[8px] p-6 md:p-8 mb-10">
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
                            className={`w-full md:w-auto h-16 px-12 bg-[#0071E3] text-white font-black rounded-[8px] hover:brightness-110 transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shadow-2xl shadow-[#0071E3]/20 active:scale-95 text-sm uppercase tracking-widest`}
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                            Procesar Solicitud
                        </button>
                    </form>
                </Card>
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
                onSelect={(e: any) => {
                    setSelectedEquipoValue(e.numero_activo.toString());
                    setIsEquipoModalOpen(false);
                }}
            />

            {/* Article Search Modal */}
            <ArticleSearchGridModal
                isOpen={showSearch}
                onClose={() => setShowSearch(false)}
                onSelect={(article) => {
                    updateRowWithArticle(currentRowIndex, article);
                    setShowSearch(false);
                }}
                themeColor="blue"
                title="BUSCADOR"
            />
        </div>
    );
}
