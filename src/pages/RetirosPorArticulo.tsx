import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
    Search,
    X,
    Calendar,
    Table,
    Inbox,
    Loader2,
    History,
    FileSpreadsheet,
    Activity,
    AlertCircle,
    CheckCircle2,
    Info,
    User,
    ClipboardList
} from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { utils, writeFile } from 'xlsx';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';
import ArticleSearchGridModal from '../components/ArticleSearchGridModal';

// Interfaces
interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
    unidad?: string;
    imagen_url?: string | null;
}

interface RetiroDetalle {
    id_salida: number;
    fecha_salida: string;
    cantidad: number;
    retira_id: string;
    retira_nombre: string;
}

export default function RetirosPorArticulo() {
    // State
    const [loading, setLoading] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState<Articulo | null>(null);
    const [showSearchModal, setShowSearchModal] = useState(false);

    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

    const [retiros, setRetiros] = useState<RetiroDetalle[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null);

    // Consultar Retiros
    const handleConsultar = async () => {
        if (!selectedArticle) {
            setStatusMessage({ type: 'warning', message: 'Por favor seleccione un artículo primero.' });
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setStatusMessage(null);
        try {
            // 1. Fetch withdrawal details for the article
            const { data: details, error: detailsError } = await supabase
                .from('dato_salida_13')
                .select(`
                    cantidad,
                    salida_articulo_08 (
                        id_salida,
                        fecha_salida,
                        retira
                    )
                `)
                .eq('articulo', selectedArticle.codigo_articulo)
                .gte('salida_articulo_08.fecha_salida', dateFrom)
                .lte('salida_articulo_08.fecha_salida', dateTo)
                .order('fecha_salida', { foreignTable: 'salida_articulo_08', ascending: false });

            if (detailsError) throw detailsError;

            if (!details || details.length === 0) {
                setRetiros([]);
                setStatusMessage({ type: 'info', message: 'No se encontraron retiros para este artículo en el rango seleccionado.' });
                return;
            }

            // 2. Extract unique collaborator IDs
            const idsRetira = [...new Set(details.map((d: any) => d.salida_articulo_08?.retira).filter(Boolean))];

            // 3. Fetch collaborator names
            let namesMap: Record<string, string> = {};
            if (idsRetira.length > 0) {
                const { data: collaborators, error: colabError } = await supabase
                    .from('colaboradores_06')
                    .select('identificacion, alias, colaborador')
                    .in('identificacion', idsRetira);

                if (colabError) throw colabError;

                namesMap = collaborators.reduce((acc, curr) => {
                    acc[curr.identificacion] = curr.alias || curr.colaborador || curr.identificacion;
                    return acc;
                }, {} as Record<string, string>);
            }

            // 4. Process final data
            const processed: RetiroDetalle[] = details.map((item: any) => ({
                id_salida: item.salida_articulo_08?.id_salida,
                fecha_salida: item.salida_articulo_08?.fecha_salida,
                cantidad: Number(item.cantidad) || 0,
                retira_id: item.salida_articulo_08?.retira,
                retira_nombre: namesMap[item.salida_articulo_08?.retira] || 'N/A'
            })).filter(item => item.id_salida);

            setRetiros(processed);
            setStatusMessage({ type: 'success', message: `${processed.length} registros recuperados.` });

        } catch (error: any) {
            console.error('Error fetching retiros:', error);
            setStatusMessage({ type: 'error', message: 'Error al consultar: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    // Export to Excel
    const handleExport = () => {
        try {
            if (retiros.length === 0) return;

            const dataToExport = retiros.map(r => ({
                'Fecha': format(parseISO(r.fecha_salida), 'dd/MM/yyyy'),
                'Número Salida': r.id_salida,
                'Funcionario': r.retira_nombre,
                'Cantidad': r.cantidad,
                'Unidad': selectedArticle?.unidad || 'unid'
            }));

            const ws = utils.json_to_sheet(dataToExport);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Retiros");
            writeFile(wb, `retiros_${selectedArticle?.codigo_articulo}.xlsx`);
            setStatusMessage({ type: 'success', message: 'Excel exportado correctamente.' });
        } catch (error) {
            console.error('Error exporting Excel:', error);
            setStatusMessage({ type: 'error', message: 'Error al exportar Excel.' });
        }
    };

    return (
        <div className="min-h-screen bg-black text-[#f4f4f5] relative overflow-hidden">
            <PageHeader
                title="Retiros por Artículo"
                subtitle="Consulte quién retiró un artículo y las cantidades registradas."
                icon={ClipboardList}
                themeColor="neutral"
                backRoute="/gestion-interna"
            />
            <div className="max-w-[1400px] mx-auto px-4 md:px-8 pb-12 space-y-6 relative z-10">

                {/* Status Messages */}
                {statusMessage && (
                    <div className={`fixed top-8 right-8 z-[100] px-6 py-5 rounded-[8px] shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 flex items-center gap-4
                        ${statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100' :
                            statusMessage.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-100' :
                                statusMessage.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-100' :
                                    'bg-[#18181b] border-[#3f3f46] text-[#e4e4e7]'
                        }`}>
                        <div className="p-2 rounded-[8px] bg-white/5 shrink-0">
                            {statusMessage.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400" /> :
                                statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                                    <Info className="w-5 h-5 text-amber-400" />}
                        </div>
                        <span className="font-black uppercase tracking-widest text-[11px] leading-relaxed">{statusMessage.message}</span>
                        <button onClick={() => setStatusMessage(null)} className="ml-auto p-1 hover:bg-white/5 rounded-[4px] transition-colors">
                            <X className="w-4 h-4 text-[#86868B]" />
                        </button>
                    </div>
                )}

                {/* Filters */}
                <section className="bg-[#111112] p-5 md:p-8 border border-[#3f3f46] rounded-xl relative group">
                    <div className="mb-6 border-b border-[#27272a] pb-5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#71717a]">Filtros de consulta</p>
                        <h2 className="mt-2 text-lg font-bold text-white">Seleccione el artículo y el período</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        {/* Article Selector */}
                        <div className="md:col-span-12 lg:col-span-5 relative">
                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Artículo</label>
                            {selectedArticle ? (
                                <div className="flex items-center gap-4 p-4 bg-[#1D1D1F] border border-[#333333] rounded-[8px] group/selected relative overflow-hidden">
                                    <div className="w-12 h-12 bg-black/40 rounded-[8px] overflow-hidden border border-[#333333] shrink-0">
                                        <img src={selectedArticle.imagen_url || ''} className="w-full h-full object-cover opacity-80" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-mono text-[10px] font-bold text-[#d4d4d8] uppercase tracking-widest bg-[#27272a] px-2 py-0.5 rounded border border-[#3f3f46]">
                                            {selectedArticle.codigo_articulo}
                                        </span>
                                        <p className="text-sm font-bold text-white truncate italic uppercase mt-1">{selectedArticle.nombre_articulo}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowSearchModal(true)}
                                            className="p-3 bg-white/5 hover:bg-white/10 text-[#a1a1aa] hover:text-white rounded-lg transition-all border border-[#3f3f46]"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setSelectedArticle(null); setRetiros([]); setHasSearched(false); }}
                                            className="p-3 bg-white/5 hover:bg-white/10 text-rose-400 hover:text-white rounded-[8px] transition-all border border-[#333333]"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowSearchModal(true)}
                                    className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg px-6 py-4 text-left flex items-center justify-between group/trigger hover:border-[#71717a] transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <Search className="w-5 h-5 text-[#71717a] group-hover/trigger:text-white transition-colors" />
                                        <span className="text-[#86868B] font-bold uppercase text-xs tracking-widest">Seleccionar artículo...</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-[#d4d4d8] bg-[#27272a] px-3 py-1 rounded border border-[#3f3f46] uppercase tracking-widest">
                                        Buscar
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Date Range */}
                        <div className="md:col-span-6 lg:col-span-3">
                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Desde</label>
                            <div className="relative">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#86868B] pointer-events-none" />
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg pl-14 pr-4 py-4 text-white font-bold focus:outline-none focus:border-[#a1a1aa] transition-all [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-6 lg:col-span-3">
                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Hasta</label>
                            <div className="relative">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#86868B] pointer-events-none" />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg pl-14 pr-4 py-4 text-white font-bold focus:outline-none focus:border-[#a1a1aa] transition-all [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {/* Search Button */}
                        <div className="md:col-span-12 lg:col-span-1">
                            <button
                                onClick={handleConsultar}
                                disabled={loading}
                                className="w-full h-[58px] bg-[#f4f4f5] hover:bg-white text-[#09090b] rounded-lg transition-all flex items-center justify-center disabled:opacity-50 active:scale-95 group/search"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Activity className="w-6 h-6 group-hover/search:scale-110 transition-transform" />}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Results Section */}
                {!hasSearched ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-700">
                        <div className="w-20 h-20 bg-[#111112] border border-[#3f3f46] rounded-xl flex items-center justify-center mb-6">
                            <History className="w-9 h-9 text-[#52525b]" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Esperando consulta</h3>
                        <p className="text-[#71717a] mt-2 max-w-sm mx-auto text-sm">
                            Seleccione un artículo para ver el historial de retiros por funcionario.
                        </p>
                    </div>
                ) : loading ? (
                    <div className="py-40 flex flex-col items-center justify-center space-y-6">
                        <Loader2 className="w-12 h-12 animate-spin text-[#d4d4d8]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#86868B]">Cargando datos...</p>
                    </div>
                ) : retiros.length === 0 ? (
                    <div className="py-40 flex flex-col items-center justify-center text-center bg-[#121212] border border-[#333333] rounded-[8px]">
                        <Inbox className="w-16 h-16 text-[#333333] mb-6" />
                        <h3 className="text-xl font-bold text-[#F5F5F7]">No hay registros</h3>
                        <p className="text-[#86868B] mt-2">No se encontraron movimientos para este artículo en las fechas seleccionadas.</p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-700">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-black text-[#86868B] uppercase tracking-[0.3em] flex items-center gap-3">
                                <Table className="w-5 h-5 text-[#a1a1aa]" />
                                Detalle de Retiros
                            </h3>
                            <button
                                onClick={handleExport}
                                className="px-6 py-2.5 bg-[#f4f4f5] border border-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white text-[#09090b] transition-all"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                Exportar Excel
                            </button>
                        </div>

                        <div className="bg-[#121212] border border-[#333333] rounded-[8px] overflow-hidden shadow-2xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#1D1D1F] text-[#86868B] text-[10px] font-black uppercase tracking-[0.2em] border-b border-[#333333]">
                                            <th className="p-6">Fecha</th>
                                            <th className="p-6"># Salida</th>
                                            <th className="p-6">Funcionario</th>
                                            <th className="p-6 text-right">Cantidad</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#333333]">
                                        {retiros.map((r, idx) => (
                                            <tr key={`${r.id_salida}-${idx}`} className="hover:bg-white/[0.02] transition-colors group h-16">
                                                <td className="p-6 text-[#F5F5F7] font-medium text-sm">
                                                    {format(parseISO(r.fecha_salida), 'dd/MM/yyyy')}
                                                </td>
                                                <td className="p-6">
                                                    <span className="font-mono text-sm font-black text-[#d4d4d8]">#{r.id_salida}</span>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-black/40 rounded-full border border-[#3f3f46] text-[#a1a1aa]">
                                                            <User className="w-3 h-3" />
                                                        </div>
                                                        <span className="text-sm font-bold text-white uppercase italic">{r.retira_nombre}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xl font-black text-white transition-colors font-mono">{r.cantidad.toLocaleString()}</span>
                                                        <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">{selectedArticle?.unidad}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Article Search Modal */}
            <ArticleSearchGridModal
                isOpen={showSearchModal}
                onClose={() => setShowSearchModal(false)}
                onSelect={(article) => {
                    setSelectedArticle(article);
                    setRetiros([]);
                    setHasSearched(false);
                    setShowSearchModal(false);
                }}
                themeColor="neutral"
                title="BUSCADOR DE ARTÍCULOS"
            />
        </div>
    );
}
