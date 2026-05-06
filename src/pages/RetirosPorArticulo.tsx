import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    X,
    Calendar,
    Table,
    Inbox,
    Loader2,
    ArrowLeft,
    Download,
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
    const navigate = useNavigate();

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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] p-4 md:p-8 relative overflow-hidden">
            <div className="max-w-7xl mx-auto space-y-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-[#333333]">
                    <div className="space-y-1">
                        <PageHeader title="Retiros por Artículo" icon={ClipboardList} themeColor="blue" />
                        <p className="text-[#86868B] text-sm font-medium tracking-wide">
                            Consulta detallada de funcionarios y cantidades retiradas por artículo.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 bg-transparent border border-[#333333] rounded-[8px] text-xs font-black uppercase tracking-widest flex items-center gap-2 text-[#F5F5F7] hover:bg-white/5 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4 text-[#0071E3]" />
                        Regresar
                    </button>
                </div>

                {/* Status Messages */}
                {statusMessage && (
                    <div className={`fixed top-8 right-8 z-[100] px-6 py-5 rounded-[8px] shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 flex items-center gap-4
                        ${statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100' :
                            statusMessage.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-100' :
                                statusMessage.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-100' :
                                    'bg-[#0071E3]/10 border-[#0071E3]/20 text-blue-100'
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
                <div className="bg-[#121212] p-8 border border-[#333333] rounded-[8px] relative group">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        {/* Article Selector */}
                        <div className="md:col-span-12 lg:col-span-5 relative">
                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-3 ml-1">Artículo</label>
                            {selectedArticle ? (
                                <div className="flex items-center gap-4 p-4 bg-[#1D1D1F] border border-[#333333] rounded-[8px] group/selected relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#0071E3]" />
                                    <div className="w-12 h-12 bg-black/40 rounded-[8px] overflow-hidden border border-[#333333] shrink-0">
                                        <img src={selectedArticle.imagen_url || ''} className="w-full h-full object-cover opacity-80" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-mono text-[10px] font-black text-[#0071E3] uppercase tracking-widest bg-[#0071E3]/5 px-2 py-0.5 rounded border border-[#0071E3]/10">
                                            {selectedArticle.codigo_articulo}
                                        </span>
                                        <p className="text-sm font-bold text-white truncate italic uppercase mt-1">{selectedArticle.nombre_articulo}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowSearchModal(true)}
                                            className="p-3 bg-white/5 hover:bg-white/10 text-[#0071E3] hover:text-white rounded-[8px] transition-all border border-[#333333]"
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
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-6 py-4 text-left flex items-center justify-between group/trigger focus:border-[#0071E3]/50 transition-all shadow-inner"
                                >
                                    <div className="flex items-center gap-4">
                                        <Search className="w-5 h-5 text-[#86868B] group-hover/trigger:text-[#0071E3] transition-colors" />
                                        <span className="text-[#86868B] font-bold uppercase text-xs tracking-widest">Seleccionar artículo...</span>
                                    </div>
                                    <span className="text-[10px] font-black text-[#0071E3] bg-[#0071E3]/5 px-3 py-1 rounded-[4px] border border-[#0071E3]/10 uppercase tracking-widest">
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
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-14 pr-4 py-4 text-white font-bold focus:outline-none focus:border-[#0071E3]/50 transition-all [color-scheme:dark]"
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
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-14 pr-4 py-4 text-white font-bold focus:outline-none focus:border-[#0071E3]/50 transition-all [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {/* Search Button */}
                        <div className="md:col-span-12 lg:col-span-1">
                            <button
                                onClick={handleConsultar}
                                disabled={loading}
                                className="w-full h-[58px] bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-[8px] shadow-lg shadow-[#0071E3]/20 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95 group/search"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Activity className="w-6 h-6 group-hover/search:scale-110 transition-transform" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                {!hasSearched ? (
                    <div className="py-40 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-700">
                        <div className="w-32 h-32 bg-[#121212] border border-[#333333] rounded-[8px] flex items-center justify-center shadow-2xl mb-10">
                            <History className="w-16 h-16 text-[#333333]" />
                        </div>
                        <h3 className="text-3xl font-black text-[#F5F5F7] uppercase italic tracking-tighter">Esperando Consulta</h3>
                        <p className="text-[#86868B] mt-3 max-w-sm mx-auto font-black uppercase text-[10px] tracking-widest">
                            Seleccione un artículo para ver el historial de retiros por funcionario.
                        </p>
                    </div>
                ) : loading ? (
                    <div className="py-40 flex flex-col items-center justify-center space-y-6">
                        <Loader2 className="w-16 h-16 animate-spin text-[#0071E3]" />
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
                                <Table className="w-5 h-5 text-[#0071E3]" />
                                Detalle de Retiros
                            </h3>
                            <button
                                onClick={handleExport}
                                className="px-6 py-2.5 bg-transparent border border-[#333333] rounded-[8px] text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#0071E3]/5 text-[#0071E3] transition-all"
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
                                                    <span className="font-mono text-sm font-black text-[#0071E3]/70 group-hover:text-[#0071E3]">#{r.id_salida}</span>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-black/40 rounded-full border border-[#333333] text-[#0071E3]">
                                                            <User className="w-3 h-3" />
                                                        </div>
                                                        <span className="text-sm font-bold text-white uppercase italic">{r.retira_nombre}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xl font-black text-white group-hover:text-[#0071E3] transition-colors font-mono">{r.cantidad.toLocaleString()}</span>
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
                themeColor="blue"
                title="BUSCADOR DE ARTÍCULOS"
            />
        </div>
    );
}
