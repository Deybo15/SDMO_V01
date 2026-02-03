import { useState, useEffect } from 'react';
import {
    Shirt,
    Save,
    User,
    Loader2,
    ArrowLeft,
    ClipboardList
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Custom Architecture
import { useTransactionManager } from '../hooks/useTransactionManager';
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import { Card, CardContent } from '../components/ui/Card';
import ArticleSearchGridModal from '../components/ArticleSearchGridModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';

export default function Vestimenta() {
    const navigate = useNavigate();
    // 1. Hook Integration
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
        <div className="min-h-screen bg-[#000000]">
            <PageHeader
                title="Vestimenta e Indumentaria"
                icon={Shirt}
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
                <Card className="overflow-hidden border-[#333333] shadow-4xl mb-12">
                    <form onSubmit={handleProcess} className="p-8 md:p-10">
                        {/* Headers Section */}
                        <div className="space-y-2 mb-10">
                            <h3 className="text-2xl font-bold text-[#F5F5F7] tracking-tight uppercase flex items-center gap-3 italic">
                                <User className="w-6 h-6 text-[#0071E3]" />
                                Información de Responsables
                            </h3>
                            <p className="text-xs text-[#86868B] font-medium uppercase tracking-widest ml-9">Defina los responsables de la solicitud</p>
                        </div>

                        <div className="bg-[#1D1D1F]/30 border border-[#333333] rounded-[8px] p-6 md:p-8 mb-10">

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
                                                {autoriza ? colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.alias || colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.colaborador : 'Usuario no identificado'}
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
                                    onChange={(e) => setComentarios(e.target.value)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-6 text-[#F5F5F7] focus:border-[#0071E3] outline-none min-h-[140px] transition-all shadow-inner placeholder-[#424245] text-sm font-bold"
                                    placeholder="Detalles adicionales sobre esta solicitud de vestimenta..."
                                />
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="space-y-2 mb-10">
                            <h3 className="text-2xl font-bold text-[#F5F5F7] tracking-tight uppercase flex items-center gap-3 italic">
                                <ClipboardList className="w-6 h-6 text-[#0071E3]" />
                                Detalle de Artículos
                            </h3>
                            <p className="text-xs text-[#86868B] font-medium uppercase tracking-widest ml-9">Seleccione las prendas a entregar</p>
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
            <ArticleSearchGridModal
                isOpen={showSearch}
                onClose={() => setShowSearch(false)}
                onSelect={(article) => handleSelectArticle(currentRowIndex, article)}
                themeColor="blue"
                title="BUSCADOR"
            />
        </div>
    );
}
