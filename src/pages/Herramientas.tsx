import { useState, useEffect } from 'react';
import {
    Wrench,
    Save,
    User,
    Loader2,
    ClipboardList
} from 'lucide-react';

// Custom Architecture
import { useTransactionManager } from '../hooks/useTransactionManager';
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import { Card } from '../components/ui/Card';
import ArticleSearchGridModal from '../components/ArticleSearchGridModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import { Articulo } from '../types/inventory';

export default function Herramientas() {
    const {
        loading,
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
        tipoSalidaId: 'H',
        defaultDescription: 'Solicitud de Herramientas',
        onSuccess: () => {
            setRetira('');
            setComentarios('');
            showAlert('Solicitud procesada y ventana reiniciada', 'success');
        }
    });

    // 2. Local State
    const [autoriza, setAutoriza] = useState('');
    const [retira, setRetira] = useState('');
    const [comentarios, setComentarios] = useState('');

    // 3. Validation
    const isFormValid =
        autoriza !== '' &&
        retira !== '' &&
        items.some(item => item.codigo_articulo && Number(item.cantidad) > 0);

    useEffect(() => {
        if (autorizaId) {
            setAutoriza(autorizaId);
        }
    }, [autorizaId]);

    // Modals
    const [showColaboradorModal, setShowColaboradorModal] = useState(false);
    const [colaboradorField, setColaboradorField] = useState<'autoriza' | 'retira'>('autoriza');
    const [showSearch, setShowSearch] = useState(false);
    const [currentRowIndex, setCurrentRowIndex] = useState<number>(0);

    // Handlers
    const handleOpenColaborador = (campo: 'autoriza' | 'retira') => {
        setColaboradorField(campo);
        setShowColaboradorModal(true);
    };

    const handleOpenSearch = (index: number) => {
        setCurrentRowIndex(index);
        setShowSearch(true);
    };

    const handleSelectArticle = (index: number, article: Articulo) => {
        updateRowWithArticle(index, article);
        setShowSearch(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        processTransaction({
            autoriza,
            retira,
            comentarios
        });
    };

    const colorTheme = '#e4e4e7';

    return (
        <div className="min-h-screen bg-[#000000]">
            <PageHeader
                title="Herramientas"
                icon={Wrench}
                themeColor="neutral"
                backRoute="/otras-solicitudes"
            />

            <main className="max-w-[1600px] mx-auto px-4 md:px-8 pb-24">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
                    <div className="space-y-5 min-w-0">
                    <Card className="overflow-hidden border-[#27272a] shadow-2xl shadow-black/30">
                    <div className="p-5 md:p-8">
                        {/* Headers Section */}
                        <div className="flex items-start justify-between gap-4 mb-8">
                            <div>
                                <h2 className="text-xl font-semibold text-white tracking-tight">Información de responsables</h2>
                                <p className="text-sm text-[#a1a1aa] mt-1">Defina las personas responsables de la solicitud.</p>
                            </div>
                            <div className="w-11 h-11 rounded-lg border border-[#3f3f46] flex items-center justify-center shrink-0"><User className="w-5 h-5 text-[#d4d4d8]" /></div>
                        </div>

                        <div className="space-y-7">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                                {autoriza ? colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.alias || colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.colaborador : 'Usuario no identificado'}
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
                                            onClick={() => handleOpenColaborador('retira')}
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
                                    onChange={(e) => setComentarios(e.target.value)}
                                    className="w-full bg-[#111112] border border-[#3f3f46] rounded-lg p-5 text-white focus:border-[#71717a] outline-none min-h-[150px] transition-all placeholder:text-[#52525b] text-sm resize-y"
                                    placeholder="Detalles adicionales sobre esta solicitud de herramientas..."
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
                                <p className="text-sm text-[#a1a1aa] mt-1">Seleccione las herramientas que se entregarán.</p>
                            </div>
                            <div className="w-11 h-11 rounded-lg border border-[#3f3f46] flex items-center justify-center shrink-0"><ClipboardList className="w-5 h-5 text-[#d4d4d8]" /></div>
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
                            <p className="text-[10px] text-center text-[#52525b] uppercase tracking-[0.15em] mt-4">Nueva solicitud</p>
                        </Card>
                    </aside>
                </form>
            </main>

            {/* Colaborador Search Modal */}
            <ColaboradorSearchModal
                isOpen={showColaboradorModal}
                onClose={() => setShowColaboradorModal(false)}
                onSelect={(col) => {
                    if (colaboradorField === 'autoriza') setAutoriza(col.identificacion);
                    else setRetira(col.identificacion);
                }}
                colaboradores={colaboradorField === 'autoriza' ? colaboradores.autorizados : colaboradores.todos}
            />

            {/* Article Search Modal */}
            <ArticleSearchGridModal
                isOpen={showSearch}
                onClose={() => setShowSearch(false)}
                onSelect={(article) => handleSelectArticle(currentRowIndex, article)}
                themeColor="neutral"
                title="BUSCADOR"
            />
        </div>
    );
}
