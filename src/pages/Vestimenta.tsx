import { useState, useEffect } from 'react';
import {
    Shirt,
    Save,
    User,
    Loader2
} from 'lucide-react';

// Custom Architecture
import { useTransactionManager } from '../hooks/useTransactionManager';
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import ArticuloSearchModal from '../components/ArticleSearchModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';

export default function Vestimenta() {
    // 1. Hook Integration
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
        tipoSalidaId: 'V',
        defaultDescription: 'Solicitud de Vestimenta',
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
    const [showSearch, setShowSearch] = useState(false);
    const [currentRowIndex, setCurrentRowIndex] = useState<number>(0);

    useEffect(() => {
        if (autorizaId) {
            setAutoriza(autorizaId);
        }
    }, [autorizaId]);

    // Modals
    const [showColaboradorModal, setShowColaboradorModal] = useState(false);
    const [colaboradorField, setColaboradorField] = useState<'autoriza' | 'retira'>('autoriza');

    // Theme (Indigo for Clothing/Uniforms)
    const colorTheme = 'indigo';

    // Handlers
    const handleOpenSearch = (index: number) => {
        setCurrentRowIndex(index);
        setShowSearch(true);
    };

    const handleSelectArticle = (index: number, article: any) => {
        updateRowWithArticle(index, article);
        setShowSearch(false);
    };

    const handleProcess = (e: React.FormEvent) => {
        e.preventDefault();
        processTransaction({
            autoriza,
            retira,
            comentarios
        });
    };

    return (
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8">
            <PageHeader
                title="Vestimenta e Indumentaria"
                icon={Shirt}
                themeColor={colorTheme}
            />

            <div className="max-w-7xl mx-auto space-y-6">
                <div className="bg-[#1e2235] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                    <form onSubmit={handleProcess} className="p-4 md:p-8">
                        {/* Headers Section */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-6 mb-8">
                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-3 text-indigo-400">
                                <User className="w-5 h-5" />
                                Información de Responsables
                            </h3>

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
                                            <span className={autoriza ? 'text-indigo-400 font-bold' : 'text-gray-500 italic'}>
                                                {autoriza ? colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.alias || colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.colaborador : 'Usuario no identificado'}
                                            </span>
                                            <User className={`w-5 h-5 text-indigo-400/50 ml-2`} />
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
                                            <User className={`w-5 h-5 text-indigo-400 ml-2`} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Comentarios</label>
                                <textarea
                                    value={comentarios}
                                    onChange={(e) => setComentarios(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-indigo-500 outline-none min-h-[120px] transition-all focus:ring-1 focus:ring-indigo-500/50 shadow-inner"
                                    placeholder="Detalles adicionales sobre esta solicitud de vestimenta..."
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
                    if (colaboradorField === 'retira') {
                        setRetira(c.identificacion);
                    } else if (colaboradorField === 'autoriza') {
                        setAutoriza(c.identificacion);
                    }
                    setShowColaboradorModal(false);
                }}
                colaboradores={colaboradorField === 'autoriza'
                    ? colaboradores.autorizados
                    : colaboradores.todos.filter((c: any) => c.identificacion !== autoriza)
                }
            />

            {/* Article Search Modal */}
            <ArticuloSearchModal
                isOpen={showSearch}
                onClose={() => setShowSearch(false)}
                onSelect={(article) => handleSelectArticle(currentRowIndex, article)}
                themeColor={colorTheme}
            />
        </div>
    );
}
