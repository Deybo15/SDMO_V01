import { useState, useEffect } from 'react';
import {
    Clock,
    Save,
    User,
    Loader2,
    Building2,
    CheckCircle,
    Search
} from 'lucide-react';

// Custom Architecture
import ArticuloSearchModal from '../components/ArticleSearchModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import { supabase } from '../lib/supabase';

interface Dependencia {
    id_dependencia: number;
    dependencia_municipal: string;
}

export default function Prestamo() {
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
        tipoSalidaId: 'P',
        defaultDescription: 'Solicitud de Préstamo',
        onSuccessRoute: '/otras-solicitudes/prestamo',
        onSuccess: () => {
            setRetira('');
            setComentarios('');
            setDependencia('');
        }
    });

    // 2. Local State
    const [autoriza, setAutoriza] = useState('');
    const [retira, setRetira] = useState('');
    const [comentarios, setComentarios] = useState('');

    useEffect(() => {
        if (autorizaId) {
            setAutoriza(autorizaId);
        }
    }, [autorizaId]);
    const [dependencia, setDependencia] = useState('');

    // Dependencias Logic
    const [dependencias, setDependencias] = useState<Dependencia[]>([]);
    const [showDependenciaModal, setShowDependenciaModal] = useState(false);
    const [depSearchTerm, setDepSearchTerm] = useState('');

    useEffect(() => {
        const loadDependencias = async () => {
            const { data } = await supabase
                .from('dependencias_municipales')
                .select('id_dependencia, dependencia_municipal');
            if (data) setDependencias(data);
        };
        loadDependencias();
    }, []);

    const filteredDependencias = dependencias.filter(d =>
        d.dependencia_municipal.toLowerCase().includes(depSearchTerm.toLowerCase())
    );

    // Modals state
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!dependencia) {
            showAlert('Seleccione una dependencia municipal', 'warning');
            return;
        }

        processTransaction({
            autoriza,
            retira,
            comentarios: comentarios,
            destino: dependencia
        });
    };

    const handleSelectArticle = (index: number, article: any) => {
        updateRowWithArticle(index, article);
        setShowSearch(false);
    };

    const colorTheme = 'purple';

    return (
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8">
            <PageHeader
                title="Préstamo"
                icon={Clock}
                themeColor={colorTheme}
            />

            <div className="max-w-7xl mx-auto space-y-6">

                <div className="bg-[#1e2235] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                    <form onSubmit={handleSubmit} className="p-4 md:p-8">
                        {/* Headers Section */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-6 mb-8">
                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-3 text-purple-400">
                                <User className="w-5 h-5" />
                                Información de Responsables
                            </h3>

                            {/* Dependencia Selector */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Dependencia Municipal <span className="text-red-400">*</span></label>
                                <div
                                    onClick={() => setShowDependenciaModal(true)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-5 pr-12 text-white cursor-pointer hover:bg-white/10 transition-colors flex items-center justify-between active:scale-[0.99] shadow-inner"
                                >
                                    <span className={dependencia ? 'text-white' : 'text-gray-500 italic font-medium'}>
                                        {dependencia ? dependencias.find(dep => dep.id_dependencia.toString() === dependencia)?.dependencia_municipal || dependencia : '-- Seleccione una dependencia --'}
                                    </span>
                                    <Building2 className="w-5 h-5 text-purple-400 ml-2" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Responsable que autoriza <span className="text-red-400">*</span></label>
                                    <div className="relative group">
                                        <div
                                            className="w-full bg-black/40 border border-white/5 rounded-xl py-4 px-5 text-white cursor-not-allowed flex items-center justify-between opacity-75 shadow-inner"
                                            title="El responsable se asigna automáticamente según su usuario"
                                        >
                                            <span className={autoriza ? 'text-purple-400 font-bold' : 'text-gray-500 italic'}>
                                                {autoriza ? colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.alias || colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.colaborador : 'Usuario no identificado'}
                                            </span>
                                            <User className={`w-5 h-5 text-purple-400/50 ml-2`} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Persona que retira <span className="text-red-400">*</span></label>
                                    <div className="relative group">
                                        <div
                                            onClick={() => handleOpenColaborador('retira')}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-5 pr-12 text-white cursor-pointer hover:bg-white/10 transition-colors flex items-center justify-between active:scale-[0.99] shadow-inner"
                                        >
                                            <span className={retira ? 'text-white' : 'text-gray-500 italic font-medium'}>
                                                {retira ? colaboradores.todos.find((c: any) => c.identificacion === retira)?.alias || colaboradores.todos.find((c: any) => c.identificacion === retira)?.colaborador : '-- Seleccione --'}
                                            </span>
                                            <User className={`w-5 h-5 text-purple-400 ml-2`} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Comentarios</label>
                                <textarea
                                    value={comentarios}
                                    onChange={(e) => setComentarios(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-purple-500 outline-none min-h-[120px] transition-all focus:ring-1 focus:ring-purple-500/50 shadow-inner"
                                    placeholder="Notas adicionales sobre este préstamo..."
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
                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full md:w-auto px-8 py-4 bg-gradient-to-r from-${colorTheme}-600 to-${colorTheme}-400 text-white font-black rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-${colorTheme}-500/20 active:scale-95`}
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                                <span className="text-lg">Procesar Solicitud</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Colaborador Modal */}
            <ColaboradorSearchModal
                isOpen={showColaboradorModal}
                onClose={() => setShowColaboradorModal(false)}
                onSelect={(c: any) => {
                    if (colaboradorField === 'autoriza') {
                        setAutoriza(c.identificacion);
                    } else {
                        setRetira(c.identificacion);
                    }
                    setShowColaboradorModal(false);
                }}
                colaboradores={colaboradorField === 'autoriza'
                    ? colaboradores.autorizados
                    : colaboradores.todos.filter((c: any) => c.identificacion !== autoriza)
                }
            />

            {/* Dependencia Modal */}
            {showDependenciaModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-[#1e2235] w-full max-w-lg rounded-2xl border border-white/10 flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-purple-400" />
                                Seleccionar Dependencia
                            </h3>
                            <button
                                onClick={() => setShowDependenciaModal(false)}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 border-b border-white/5 bg-[#1a1d29]">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    value={depSearchTerm}
                                    onChange={e => setDepSearchTerm(e.target.value)}
                                    className="w-full bg-[#0f111a] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                                    placeholder="Buscar por nombre..."
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0f111a]/50 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {filteredDependencias.map(d => (
                                <div
                                    key={d.id_dependencia}
                                    onClick={() => {
                                        setDependencia(d.id_dependencia.toString());
                                        setShowDependenciaModal(false);
                                    }}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center group ${dependencia === d.id_dependencia.toString()
                                        ? 'bg-purple-500/10 border-purple-500/50 text-white'
                                        : 'bg-white/5 border-white/5 hover:border-purple-500/30 text-gray-300 hover:bg-white/10'
                                        }`}
                                >
                                    <span className="font-medium">{d.dependencia_municipal}</span>
                                    {dependencia === d.id_dependencia.toString() ? (
                                        <CheckCircle className="w-5 h-5 text-purple-400" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border-2 border-white/10 group-hover:border-purple-500/30 transition-colors" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Article Search Modal */}
            <ArticuloSearchModal
                isOpen={showSearch}
                onClose={() => setShowSearch(false)}
                onSelect={(article) => handleSelectArticle(currentRowIndex, article)}
                themeColor={colorTheme}
            />
        </div>
    );
}
