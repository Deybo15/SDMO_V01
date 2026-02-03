import { useState, useEffect } from 'react';
import {
    Clock,
    Save,
    User,
    Loader2,
    Building2,
    CheckCircle,
    Search,
    X,
    ArrowLeft,
    ClipboardList
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';


// Custom Architecture
import ArticleSearchGridModal from '../components/ArticleSearchGridModal';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import { supabase } from '../lib/supabase';
import { useTransactionManager } from '../hooks/useTransactionManager';
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import { Card } from '../components/ui/Card';
import { cn } from '../lib/utils';


interface Dependencia {
    id_dependencia: number;
    dependencia_municipal: string;
}

export default function Prestamo() {
    const navigate = useNavigate();
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
            showAlert('Solicitud procesada y ventana reiniciada', 'success');
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

    // 3. Validation
    const isFormValid =
        dependencia !== '' &&
        autoriza !== '' &&
        retira !== '' &&
        items.some(item => item.codigo_articulo && Number(item.cantidad) > 0);

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
        <div className="min-h-screen bg-[#000000]">
            <PageHeader
                title="Préstamo"
                icon={Clock}
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
                    <form onSubmit={handleSubmit} className="p-8 md:p-10">
                        {/* Headers Section */}
                        <div className="space-y-2 mb-10">
                            <h3 className="text-2xl font-bold text-[#F5F5F7] tracking-tight uppercase flex items-center gap-3 italic">
                                <User className="w-6 h-6 text-[#0071E3]" />
                                Información de Responsables
                            </h3>
                            <p className="text-xs text-[#86868B] font-medium uppercase tracking-widest ml-9">Defina los parámetros del préstamo y responsables</p>
                        </div>

                        <div className="bg-[#1D1D1F]/30 border border-[#333333] rounded-[8px] p-6 md:p-8 mb-10">

                            {/* Dependencia Selector */}
                            <div className="mb-8">
                                <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-widest mb-3">Dependencia Municipal <span className="text-red-400">*</span></label>
                                <div
                                    onClick={() => setShowDependenciaModal(true)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] py-5 pl-6 pr-12 text-[#F5F5F7] cursor-pointer hover:bg-[#1D1D1F]/80 transition-all flex items-center justify-between active:scale-[0.99] shadow-inner"
                                >
                                    <span className={dependencia ? 'text-[#F5F5F7] font-black text-sm tracking-tight' : 'text-[#86868B] italic font-black text-sm'}>
                                        {dependencia ? dependencias.find(dep => dep.id_dependencia.toString() === dependencia)?.dependencia_municipal || dependencia : '-- Seleccione una dependencia --'}
                                    </span>
                                    <Building2 className="w-5 h-5 text-[#0071E3] ml-2" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                <div>
                                    <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-widest mb-3">Responsable que autoriza <span className="text-red-400">*</span></label>
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
                                    <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-widest mb-3">Persona que retira <span className="text-red-400">*</span></label>
                                    <div className="relative group">
                                        <div
                                            onClick={() => handleOpenColaborador('retira')}
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
                                    placeholder="Notas adicionales sobre este préstamo..."
                                />
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="space-y-2 mb-10">
                            <h3 className="text-2xl font-bold text-[#F5F5F7] tracking-tight uppercase flex items-center gap-3 italic">
                                <ClipboardList className="w-6 h-6 text-[#0071E3]" />
                                Detalle de Artículos
                            </h3>
                            <p className="text-xs text-[#86868B] font-medium uppercase tracking-widest ml-9">Seleccione los materiales a entregar en préstamo</p>
                        </div>

                        <div className="bg-[#1D1D1F]/30 border border-[#333333] rounded-[8px] p-6 md:p-8 mb-10">
                            <TransactionTable
                                items={items}
                                onUpdateRow={updateRow}
                                onRemoveRow={removeRow}
                                onOpenSearch={handleOpenSearch}
                                onAddRow={addEmptyRow}
                                onWarning={(msg: string) => showAlert(msg, 'warning')}
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-[20px] animate-in fade-in duration-300">
                    <div className="bg-[#121212] w-full max-w-lg rounded-[8px] border border-[#333333] shadow-4xl flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="p-6 border-b border-[#333333] flex justify-between items-center bg-black/20">
                            <h3 className="text-[15px] font-black text-[#F5F5F7] uppercase tracking-widest flex items-center gap-3">
                                <Building2 className="w-5 h-5 text-[#0071E3]" />
                                Seleccionar Dependencia
                            </h3>
                            <button
                                onClick={() => setShowDependenciaModal(false)}
                                className="p-2 hover:bg-white/5 rounded-[8px] text-[#86868B] hover:text-[#F5F5F7] transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 border-b border-[#333333]">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] group-focus-within:text-[#0071E3] transition-colors" />
                                <input
                                    value={depSearchTerm}
                                    onChange={e => setDepSearchTerm(e.target.value)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] py-4 pl-12 pr-6 text-[#F5F5F7] placeholder-[#424245] focus:border-[#0071E3] outline-none transition-all font-bold text-sm"
                                    placeholder="Buscar por nombre..."
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-black/5">
                            {filteredDependencias.map(d => (
                                <div
                                    key={d.id_dependencia}
                                    onClick={() => {
                                        setDependencia(d.id_dependencia.toString());
                                        setShowDependenciaModal(false);
                                    }}
                                    className={`p-4 rounded-[8px] border transition-all cursor-pointer flex justify-between items-center group ${dependencia === d.id_dependencia.toString()
                                        ? 'bg-[#0071E3]/10 border-[#0071E3]/50 text-[#F5F5F7]'
                                        : 'bg-transparent border-transparent hover:bg-[#1D1D1F] hover:border-[#333333] text-[#86868B] hover:text-[#F5F5F7]'
                                        }`}
                                >
                                    <span className="text-sm font-black uppercase tracking-tight">{d.dependencia_municipal}</span>
                                    {dependencia === d.id_dependencia.toString() ? (
                                        <CheckCircle className="w-5 h-5 text-[#0071E3]" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border-2 border-[#333333] group-hover:border-[#0071E3]/30 transition-colors" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Article Search Modal */}
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
