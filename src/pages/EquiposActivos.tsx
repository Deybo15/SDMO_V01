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
import { Card } from '../components/ui/Card';
import { Equipo } from '../types/inventory';
import ArticleSearchGridModal from '../components/ArticleSearchGridModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import EquipoSearchModal from '../components/EquipoSearchModal';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

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

    // Neutral theme aligned with the current visual system
    const colorTheme = '#e4e4e7';

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
                themeColor="neutral"
                backRoute="/otras-solicitudes"
            />

            <main className="max-w-[1600px] mx-auto px-4 md:px-8 pb-24">
                {/* Feedback Toast */}
                {feedback && (
                    <div className={cn(
                        "fixed top-8 right-8 z-[100] px-6 py-4 rounded-[8px] shadow-2xl backdrop-blur-md border animate-fade-in-down flex items-center gap-3",
                        feedback.type === 'success' ? 'bg-[#18181b] border-[#52525b] text-[#f4f4f5]' :
                            feedback.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                                'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                    )}>
                        {feedback.message}
                    </div>
                )}

                <form onSubmit={handleProcess} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
                    <div className="space-y-5 min-w-0">
                    <Card className="overflow-hidden border-[#27272a] shadow-2xl shadow-black/30">
                    <div className="p-5 md:p-8">
                        {/* Headers Section */}
                        <div className="flex items-start justify-between gap-4 mb-8">
                            <div>
                                <h2 className="text-xl font-semibold text-white tracking-tight">Información de responsables</h2>
                                <p className="text-sm text-[#a1a1aa] mt-1">Configure el equipo y las personas responsables de la entrega.</p>
                            </div>
                            <div className="w-11 h-11 rounded-lg border border-[#3f3f46] flex items-center justify-center shrink-0">
                                <User className="w-5 h-5 text-[#d4d4d8]" />
                            </div>
                        </div>

                        <div className="space-y-7">

                            {/* Equipo Selector */}
                            <div>
                                <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.16em] mb-3">Activo o equipo <span className="text-red-400">*</span></label>
                                <div className="relative group">
                                    <div
                                        onClick={() => setIsEquipoModalOpen(true)}
                                        className={`min-h-[72px] w-full bg-[#111112] border border-[#3f3f46] rounded-lg px-5 cursor-pointer transition-all hover:border-[#71717a] flex items-center justify-between gap-4 ${!selectedEquipoValue ? 'text-[#71717a]' : 'text-white'}`}
                                    >
                                        <span className="truncate font-medium text-sm">
                                            {selectedEquipoValue ? (
                                                (() => {
                                                    const eq = equipos.find(e => e.numero_activo.toString() === selectedEquipoValue);
                                                    return eq ? `${eq.numero_activo} - ${eq.placa} - ${eq.descripcion_equipo}` : selectedEquipoValue;
                                                })()
                                            ) : '-- Seleccione un activo --'}
                                        </span>
                                        <Search className="w-5 h-5 text-[#d4d4d8] shrink-0" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.16em] mb-3">
                                        Responsable que autoriza <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative group">
                                        <div
                                            className="min-h-[72px] w-full bg-[#111112] border border-[#27272a] rounded-lg px-5 text-white cursor-not-allowed flex items-center justify-between gap-4"
                                            title="El responsable se asigna automáticamente según su usuario"
                                        >
                                            <span className={autoriza ? 'text-[#d4d4d8] font-medium text-sm' : 'text-[#71717a] text-sm'}>
                                                {autoriza ? colaboradores.todos.find(c => c.identificacion === autoriza)?.alias || colaboradores.todos.find(c => c.identificacion === autoriza)?.colaborador : 'Usuario no identificado'}
                                            </span>
                                            <User className="w-5 h-5 text-[#52525b] shrink-0" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.16em] mb-3">
                                        Persona que retira <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative group">
                                        <div
                                            onClick={() => {
                                                setColaboradorField('retira');
                                                setShowColaboradorModal(true);
                                            }}
                                            className="min-h-[72px] w-full bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white cursor-pointer hover:border-[#71717a] transition-colors flex items-center justify-between gap-4"
                                        >
                                            <span className={retira ? 'text-white font-medium text-sm' : 'text-[#71717a] text-sm'}>
                                                {retira ? colaboradores.todos.find((c: any) => c.identificacion === retira)?.alias || colaboradores.todos.find((c: any) => c.identificacion === retira)?.colaborador : '-- Seleccione --'}
                                            </span>
                                            <User className="w-5 h-5 text-[#d4d4d8] shrink-0" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.16em] mb-3">Comentarios</label>
                                <textarea
                                    value={comentarios}
                                    onChange={(e) => setcomentarios(e.target.value)}
                                    className="w-full bg-[#111112] border border-[#3f3f46] rounded-lg p-5 text-white focus:border-[#71717a] outline-none min-h-[150px] transition-all placeholder:text-[#52525b] text-sm resize-y"
                                    placeholder="Detalles adicionales sobre esta solicitud de equipos..."
                                />
                            </div>
                        </div>
                    </div>
                    </Card>

                        {/* Items Section */}
                    <Card className="overflow-hidden border-[#27272a] shadow-2xl shadow-black/30">
                    <div className="p-5 md:p-8">
                        <div className="flex items-start justify-between gap-4 mb-8">
                            <div>
                                <h2 className="text-xl font-semibold text-white tracking-tight">Detalle de artículos</h2>
                                <p className="text-sm text-[#a1a1aa] mt-1">Agregue los materiales que se entregarán con el equipo seleccionado.</p>
                            </div>
                            <div className="w-11 h-11 rounded-lg border border-[#3f3f46] flex items-center justify-center shrink-0">
                                <Monitor className="w-5 h-5 text-[#d4d4d8]" />
                            </div>
                        </div>

                        <div className="bg-[#0a0a0a] border border-[#27272a] rounded-lg p-4 md:p-6">
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
                    </div>
                    </Card>
                    </div>

                        {/* Actions */}
                    <aside className="space-y-5 lg:sticky lg:top-6">
                        <Card className="border-[#3f3f46] p-5">
                            <h3 className="font-semibold text-white">Finalizar solicitud</h3>
                            <p className="text-sm text-[#a1a1aa] mt-1 mb-5">Verifique la información antes de procesar.</p>
                        <button
                            type="submit"
                            disabled={loading || !isFormValid}
                            className="w-full h-14 px-6 bg-[#f4f4f5] text-[#18181b] font-semibold rounded-lg hover:bg-white transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] text-sm"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Procesar Solicitud
                        </button>
                            <p className="text-[10px] text-center text-[#52525b] uppercase tracking-[0.15em] mt-4">{numeroSolicitud ? `Solicitud ${numeroSolicitud}` : 'Nueva solicitud'}</p>
                        </Card>
                    </aside>
                </form>
            </main>

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
                themeColor="neutral"
                title="BUSCADOR"
            />
        </div>
    );
}
