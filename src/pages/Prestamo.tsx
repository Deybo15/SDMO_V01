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
    ClipboardList
} from 'lucide-react';


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

    const colorTheme = '#e4e4e7';

    return (
        <div className="min-h-screen bg-[#000000]">
            <PageHeader
                title="Préstamo"
                icon={Clock}
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
                            <div><h2 className="text-xl font-semibold text-white tracking-tight">Información de responsables</h2><p className="text-sm text-[#a1a1aa] mt-1">Defina la dependencia y las personas responsables del préstamo.</p></div>
                            <div className="w-11 h-11 rounded-lg border border-[#3f3f46] flex items-center justify-center shrink-0"><User className="w-5 h-5 text-[#d4d4d8]" /></div>
                        </div>

                        <div className="space-y-7">

                            {/* Dependencia Selector */}
                            <div>
                                <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.16em] mb-3">Dependencia Municipal <span className="text-red-400">*</span></label>
                                <div
                                    onClick={() => setShowDependenciaModal(true)}
                                    className="min-h-[72px] w-full bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white cursor-pointer hover:border-[#71717a] transition-all flex items-center justify-between gap-4"
                                >
                                    <span className={dependencia ? 'text-white font-medium text-sm' : 'text-[#71717a] text-sm'}>
                                        {dependencia ? dependencias.find(dep => dep.id_dependencia.toString() === dependencia)?.dependencia_municipal || dependencia : '-- Seleccione una dependencia --'}
                                    </span>
                                    <Building2 className="w-5 h-5 text-[#d4d4d8] shrink-0" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.16em] mb-3">Responsable que autoriza <span className="text-red-400">*</span></label>
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
                                    <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.16em] mb-3">Persona que retira <span className="text-red-400">*</span></label>
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
                                    placeholder="Notas adicionales sobre este préstamo..."
                                />
                            </div>
                        </div>
                    </div>
                    </Card>

                        {/* Items Section */}
                    <Card className="overflow-hidden border-[#27272a] shadow-2xl shadow-black/30">
                    <div className="p-5 md:p-8">
                        <div className="flex items-start justify-between gap-4 mb-8">
                            <div><h2 className="text-xl font-semibold text-white tracking-tight">Detalle de artículos</h2><p className="text-sm text-[#a1a1aa] mt-1">Seleccione los materiales que se entregarán en préstamo.</p></div>
                            <div className="w-11 h-11 rounded-lg border border-[#3f3f46] flex items-center justify-center shrink-0"><ClipboardList className="w-5 h-5 text-[#d4d4d8]" /></div>
                        </div>

                        <div className="bg-[#0a0a0a] border border-[#27272a] rounded-lg p-4 md:p-6">
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#111112] w-full max-w-2xl rounded-xl border border-[#3f3f46] shadow-2xl shadow-black/70 flex flex-col max-h-[82vh] overflow-hidden">
                        <div className="p-5 md:p-6 border-b border-[#27272a] flex justify-between items-center gap-4">
                            <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-lg border border-[#3f3f46] bg-[#18181b] flex items-center justify-center"><Building2 className="w-5 h-5 text-[#d4d4d8]" /></div><div><h3 className="text-lg font-semibold text-white">Seleccionar dependencia</h3><p className="text-xs text-[#a1a1aa] mt-0.5">Busque y seleccione la dependencia municipal.</p></div></div>
                            <button
                                onClick={() => setShowDependenciaModal(false)}
                                className="w-10 h-10 border border-[#3f3f46] hover:bg-[#27272a] rounded-lg text-[#a1a1aa] hover:text-white transition-all flex items-center justify-center"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 md:p-6 border-b border-[#27272a]">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a1a1aa] group-focus-within:text-white transition-colors" />
                                <input
                                    value={depSearchTerm}
                                    onChange={e => setDepSearchTerm(e.target.value)}
                                    className="w-full h-14 bg-[#18181b] border border-[#3f3f46] rounded-lg pl-12 pr-5 text-white placeholder:text-[#71717a] focus:border-[#71717a] outline-none transition-all text-sm"
                                    placeholder="Buscar por nombre..."
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
                            {filteredDependencias.map(d => (
                                <div
                                    key={d.id_dependencia}
                                    onClick={() => {
                                        setDependencia(d.id_dependencia.toString());
                                        setShowDependenciaModal(false);
                                    }}
                                    className={`p-4 rounded-lg border transition-all cursor-pointer flex justify-between items-center gap-4 group ${dependencia === d.id_dependencia.toString()
                                        ? 'bg-[#27272a] border-[#71717a] text-white'
                                        : 'bg-[#151516] border-[#27272a] hover:bg-[#1c1c1e] hover:border-[#52525b] text-[#d4d4d8]'
                                        }`}
                                >
                                    <span className="text-sm font-semibold uppercase leading-snug">{d.dependencia_municipal}</span>
                                    {dependencia === d.id_dependencia.toString() ? (
                                        <CheckCircle className="w-5 h-5 text-white shrink-0" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border border-[#52525b] group-hover:border-[#a1a1aa] transition-colors shrink-0" />
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
                themeColor="neutral"
                title="BUSCADOR"
            />
        </div>
    );
}
