import { useEffect, useState } from 'react';
import { ClipboardList, Loader2, Save, User, type LucideIcon } from 'lucide-react';

import { useTransactionManager } from '../hooks/useTransactionManager';
import { PageHeader } from './ui/PageHeader';
import { TransactionTable } from './ui/TransactionTable';
import { Card } from './ui/Card';
import ArticleSearchGridModal from './ArticleSearchGridModal';
import ColaboradorSearchModal from './ColaboradorSearchModal';
import type { Articulo } from '../types/inventory';

interface Props {
    title: string;
    icon: LucideIcon;
    tipoSalidaId: string;
    defaultDescription: string;
    commentsPlaceholder: string;
    itemsDescription: string;
}

export function SolicitudArticulosPage({ title, icon, tipoSalidaId, defaultDescription, commentsPlaceholder, itemsDescription }: Props) {
    const { loading, items, colaboradores, addEmptyRow, updateRow, updateRowWithArticle, removeRow, autorizaId, processTransaction, showAlert } = useTransactionManager({
        tipoSalidaId,
        defaultDescription,
        onSuccess: () => {
            setRetira('');
            setComentarios('');
            showAlert('Solicitud procesada y ventana reiniciada', 'success');
        }
    });
    const [autoriza, setAutoriza] = useState('');
    const [retira, setRetira] = useState('');
    const [comentarios, setComentarios] = useState('');
    const [showColaboradorModal, setShowColaboradorModal] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [currentRowIndex, setCurrentRowIndex] = useState(0);

    useEffect(() => { if (autorizaId) setAutoriza(autorizaId); }, [autorizaId]);

    const isFormValid = Boolean(autoriza && retira && items.some((item) => item.codigo_articulo && Number(item.cantidad) > 0));
    const handleProcess = (event: React.FormEvent) => {
        event.preventDefault();
        processTransaction({ autoriza, retira, comentarios });
    };
    const handleSelectArticle = (article: Articulo) => {
        updateRowWithArticle(currentRowIndex, article);
        setShowSearch(false);
    };

    return (
        <div className="min-h-screen bg-black">
            <PageHeader title={title} icon={icon} themeColor="neutral" backRoute="/otras-solicitudes" />

            <main className="max-w-[1600px] mx-auto px-4 md:px-8 pb-24">
                <form onSubmit={handleProcess} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
                    <div className="space-y-5 min-w-0">
                        <Card className="overflow-hidden border-[#27272a] shadow-2xl shadow-black/30">
                            <div className="p-5 md:p-8">
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
                                            <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.16em] mb-3">Responsable que autoriza <span className="text-red-400">*</span></label>
                                            <div className="min-h-[72px] w-full bg-[#111112] border border-[#27272a] rounded-lg px-5 text-white cursor-not-allowed flex items-center justify-between gap-4" title="El responsable se asigna automáticamente según su usuario">
                                                <span className={autoriza ? 'text-[#d4d4d8] font-medium text-sm' : 'text-[#71717a] text-sm'}>
                                                    {autoriza ? colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.alias || colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.colaborador : 'Usuario no identificado'}
                                                </span>
                                                <User className="w-5 h-5 text-[#52525b] shrink-0" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.16em] mb-3">Persona que retira <span className="text-red-400">*</span></label>
                                            <button type="button" onClick={() => setShowColaboradorModal(true)} className="min-h-[72px] w-full bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white cursor-pointer hover:border-[#71717a] transition-colors flex items-center justify-between gap-4 text-left">
                                                <span className={retira ? 'text-white font-medium text-sm' : 'text-[#71717a] text-sm'}>
                                                    {retira ? colaboradores.todos.find((c: any) => c.identificacion === retira)?.alias || colaboradores.todos.find((c: any) => c.identificacion === retira)?.colaborador : '-- Seleccione --'}
                                                </span>
                                                <User className="w-5 h-5 text-[#d4d4d8] shrink-0" />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.16em] mb-3">Comentarios</label>
                                        <textarea value={comentarios} onChange={(event) => setComentarios(event.target.value)} className="w-full bg-[#111112] border border-[#3f3f46] rounded-lg p-5 text-white focus:border-[#71717a] outline-none min-h-[150px] transition-all placeholder:text-[#52525b] text-sm resize-y" placeholder={commentsPlaceholder} />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card className="overflow-hidden border-[#27272a] shadow-2xl shadow-black/30">
                            <div className="p-5 md:p-8">
                                <div className="flex items-start justify-between gap-4 mb-8">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white tracking-tight">Detalle de artículos</h2>
                                        <p className="text-sm text-[#a1a1aa] mt-1">{itemsDescription}</p>
                                    </div>
                                    <div className="w-11 h-11 rounded-lg border border-[#3f3f46] flex items-center justify-center shrink-0"><ClipboardList className="w-5 h-5 text-[#d4d4d8]" /></div>
                                </div>
                                <div className="bg-[#0a0a0a] border border-[#27272a] rounded-lg p-4 md:p-6">
                                    <TransactionTable items={items} onUpdateRow={updateRow} onRemoveRow={removeRow} onOpenSearch={(index) => { setCurrentRowIndex(index); setShowSearch(true); }} onAddRow={addEmptyRow} onWarning={(message) => showAlert(message, 'warning')} themeColor="#e4e4e7" />
                                </div>
                            </div>
                        </Card>
                    </div>

                    <aside className="space-y-5 lg:sticky lg:top-6">
                        <Card className="border-[#3f3f46] p-5">
                            <h3 className="font-semibold text-white">Finalizar solicitud</h3>
                            <p className="text-sm text-[#a1a1aa] mt-1 mb-5">Verifique la información antes de procesar.</p>
                            <button type="submit" disabled={loading || !isFormValid} className="w-full h-14 px-6 bg-[#f4f4f5] text-[#18181b] font-semibold rounded-lg hover:bg-white transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] text-sm">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Procesar solicitud
                            </button>
                            <p className="text-[10px] text-center text-[#52525b] uppercase tracking-[0.15em] mt-4">Nueva solicitud</p>
                        </Card>
                    </aside>
                </form>
            </main>

            <ColaboradorSearchModal isOpen={showColaboradorModal} onClose={() => setShowColaboradorModal(false)} onSelect={(colaborador) => { setRetira(colaborador.identificacion); setShowColaboradorModal(false); }} colaboradores={colaboradores.todos.filter((colaborador: any) => colaborador.identificacion !== autoriza)} />
            <ArticleSearchGridModal isOpen={showSearch} onClose={() => setShowSearch(false)} onSelect={handleSelectArticle} themeColor="neutral" title="BUSCADOR" />
        </div>
    );
}
