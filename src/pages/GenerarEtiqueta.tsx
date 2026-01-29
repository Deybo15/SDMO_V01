import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    X,
    QrCode,
    Printer,
    Tag,
    AlertTriangle,
    Loader2,
    ChevronRight,
    ArrowLeft,
    Info,
    CheckCircle2
} from 'lucide-react';
import QRCode from 'react-qr-code';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';

interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
    unidad: string | null;
    marca: string | null;
    imagen_url?: string | null;
}

export default function GenerarEtiqueta() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [articulos, setArticulos] = useState<Articulo[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [generatedArticle, setGeneratedArticle] = useState<Articulo | null>(null);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null);

    // Search Articles (Server-side)
    useEffect(() => {
        const fetchArticles = async () => {
            setLoading(true);
            try {
                let query = supabase
                    .from('articulo_01')
                    .select('codigo_articulo, nombre_articulo, unidad, marca, imagen_url')
                    .limit(50);

                if (searchTerm.trim()) {
                    query = query.or(`nombre_articulo.ilike.%${searchTerm}%,codigo_articulo.ilike.%${searchTerm}%`);
                } else {
                    query = query.order('nombre_articulo', { ascending: true });
                }

                const { data, error } = await query;

                if (error) throw error;
                setArticulos(data || []);
            } catch (error) {
                console.error('Error fetching articles:', error);
            } finally {
                setLoading(false);
            }
        };

        const debounceTimer = setTimeout(() => {
            if (showModal) {
                fetchArticles();
            }
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [searchTerm, showModal]);

    // Initial load when modal opens
    useEffect(() => {
        if (showModal && articulos.length === 0) {
            setSearchTerm('');
        }
    }, [showModal]);

    const handleSelectArticle = (article: Articulo) => {
        setGeneratedArticle(article);
        setShowModal(false);
        setStatusMessage({ type: 'success', message: 'Artículo seleccionado correctamente.' });
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-[#0f111a] text-slate-100 p-4 md:p-8 relative overflow-hidden">
            {/* Ambient Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[10%] left-[-5%] w-[50%] h-[50%] bg-orange-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[120px]" />
            </div>

            <style>{`
                /* Print Styles */
                @media print {
                    @page { margin: 0; size: auto; }
                    
                    html, body, #root, .min-h-screen {
                        background-color: white !important;
                        background: white !important;
                        color: black !important;
                        width: 100%;
                        height: 100%;
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                    }

                    body * {
                        visibility: hidden;
                    }

                    .print-area, .print-area * {
                        visibility: visible;
                    }

                    .print-area {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: white !important;
                        z-index: 9999;
                    }

                    .etiqueta {
                        background: white !important;
                        color: black !important;
                        border: 1.5px solid #000 !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                        width: 6.5cm !important;
                        height: 10.5cm !important;
                        display: flex;
                        flex-direction: column;
                        padding: 0.25cm !important;
                        border-radius: 0 !important;
                    }

                    .etiqueta-qr {
                        margin-top: 0.4cm !important;
                        padding: 0.3cm !important;
                        background: white !important;
                        align-self: center;
                        display: flex;
                        justify-content: center;
                    }

                    .etiqueta-codigo {
                        background: white !important;
                        color: black !important;
                        border: 2.5px solid #000 !important;
                        text-align: center !important;
                        margin-top: 0.5cm !important;
                        margin-bottom: 0.5cm !important;
                        border-radius: 4px !important;
                        font-weight: 900 !important;
                        font-size: 1.25rem !important;
                        letter-spacing: 0.1em !important;
                        padding: 0.2cm !important;
                        font-family: monospace !important;
                    }

                    .etiqueta-info {
                        background: white !important;
                        color: black !important;
                        border-top: 1.5px solid #000 !important;
                        margin-top: auto !important;
                        padding: 0.4cm !important;
                        line-height: 1.4 !important;
                        font-size: 0.8rem !important;
                        text-transform: uppercase !important;
                    }
                    
                    .etiqueta-info strong {
                        color: #000 !important;
                        display: block !important;
                        margin-bottom: 0.2cm !important;
                        font-size: 0.9rem !important;
                        font-weight: 900 !important;
                    }
                }
            `}</style>

            <div className="max-w-6xl mx-auto space-y-8 relative z-10 no-print">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-white/5">
                    <div className="space-y-1">
                        <PageHeader title="Generar Etiqueta QR" icon={QrCode} themeColor="orange" />
                        <p className="text-slate-500 text-sm font-medium tracking-wide">
                            Generación de etiquetas térmicas estandarizadas (6.5 × 10.5 cm).
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="glass-button px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-200"
                    >
                        <ArrowLeft className="w-4 h-4 text-orange-500" />
                        Regresar
                    </button>
                </div>

                {/* Status Float Messages */}
                {statusMessage && (
                    <div className={`fixed top-8 right-8 z-[100] px-6 py-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl border animate-in slide-in-from-right-4 flex items-center gap-4
                        ${statusMessage.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100' :
                            statusMessage.type === 'error' ? 'bg-rose-500/20 border-rose-500/40 text-rose-100' :
                                'bg-blue-500/20 border-blue-500/40 text-blue-100'
                        }`}>
                        <div className="p-2 rounded-xl bg-white/10 shrink-0">
                            {statusMessage.type === 'error' ? <AlertTriangle className="w-5 h-5 text-rose-400" /> :
                                statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                                    <Info className="w-5 h-5 text-blue-400" />}
                        </div>
                        <span className="font-black uppercase tracking-widest text-[11px] leading-relaxed">{statusMessage.message}</span>
                        <button onClick={() => setStatusMessage(null)} className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Selection Panel */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="glass-card p-8 bg-slate-900/40 relative group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-16 -mt-16" />

                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                                <Tag className="w-4 h-4 text-orange-500" />
                                Configuración de Etiqueta
                            </h2>

                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-1">Artículo Seleccionado</label>

                            <div className="mb-8">
                                {generatedArticle ? (
                                    <div className="flex items-center gap-5 p-5 bg-slate-950/60 border border-orange-500/30 rounded-2xl relative overflow-hidden group/item">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                                        <div className="w-20 h-20 bg-black/60 rounded-xl overflow-hidden border border-white/10 shrink-0 flex items-center justify-center">
                                            {generatedArticle.imagen_url ? (
                                                <img src={generatedArticle.imagen_url} className="w-full h-full object-cover opacity-90 group-hover/item:scale-110 transition-transform duration-500" />
                                            ) : (
                                                <Tag className="w-8 h-8 text-slate-700" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-mono text-[10px] font-black text-orange-400 uppercase tracking-widest">{generatedArticle.codigo_articulo}</span>
                                            <p className="text-base font-black text-white truncate italic uppercase leading-tight mb-2">{generatedArticle.nombre_articulo}</p>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="px-2 py-0.5 bg-white/5 rounded text-[9px] font-black text-slate-400 uppercase tracking-widest border border-white/10">
                                                    Marca: {generatedArticle.marca || 'N/A'}
                                                </span>
                                                <span className="px-2 py-0.5 bg-white/5 rounded text-[9px] font-black text-slate-400 uppercase tracking-widest border border-white/10">
                                                    Unidad: {generatedArticle.unidad || '-'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-10 border-2 border-dashed border-white/5 rounded-[2rem] bg-slate-950/20 flex flex-col items-center text-center">
                                        <div className="w-16 h-16 rounded-3xl bg-slate-900 flex items-center justify-center mb-4 border border-white/5">
                                            <AlertTriangle className="w-8 h-8 text-slate-700" />
                                        </div>
                                        <p className="text-slate-500 font-bold text-sm">No se ha seleccionado ningún artículo para generar la etiqueta.</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="w-full h-16 glass-button rounded-2xl flex items-center justify-center gap-3 text-slate-200 group/btn"
                                >
                                    <Search className="w-5 h-5 text-orange-500 group-hover/btn:scale-110 transition-transform" />
                                    <span className="font-black uppercase tracking-[0.2em] text-xs">
                                        {generatedArticle ? 'Cambiar Artículo' : 'Localizar Artículo'}
                                    </span>
                                </button>

                                {generatedArticle && (
                                    <button
                                        onClick={handlePrint}
                                        className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-3 group/print"
                                    >
                                        <Printer className="w-6 h-6 group-hover/print:scale-110 transition-transform" />
                                        <span className="font-black uppercase tracking-[0.2em] text-xs">Imprimir Etiqueta</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Specs Card */}
                        <div className="glass-card p-6 bg-slate-900/20 border border-white/5 flex items-center gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                                <Info className="w-6 h-6 text-slate-500" />
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Formato de Salida</h4>
                                <p className="text-xs text-slate-500 font-medium">Dimensiones exactas de 6.5cm ancho x 10.5cm alto. Optimizado para impresoras térmicas.</p>
                            </div>
                        </div>
                    </div>

                    {/* Preview Panel */}
                    <div className="lg:col-span-7">
                        <div className="glass-card p-8 bg-slate-900/40 h-full flex flex-col group/preview">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                                <Printer className="w-4 h-4 text-orange-500" />
                                Vista Previa del Resultado
                            </h3>

                            <div className="flex-1 flex items-center justify-center bg-slate-950/40 rounded-[2.5rem] border border-white/5 p-12 relative overflow-hidden">
                                {/* Background glow in preview */}
                                <div className="absolute inset-0 bg-gradient-to-t from-orange-500/[0.02] to-transparent pointer-events-none" />

                                {generatedArticle ? (
                                    <div className="transform scale-90 md:scale-100 hover:scale-[1.02] transition-transform duration-500 cursor-default">
                                        <div className="w-[6.5cm] h-[10.5cm] p-[0.25cm] bg-white rounded-sm shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col justify-start">
                                            {/* QR Container Preview */}
                                            <div className="self-center mt-[0.4cm] p-[0.3cm] bg-white flex justify-center border border-slate-100">
                                                <QRCode
                                                    value={generatedArticle.codigo_articulo}
                                                    size={110}
                                                    fgColor="#000000"
                                                    bgColor="#ffffff"
                                                    level="M"
                                                />
                                            </div>

                                            {/* Code Preview */}
                                            <div className="text-center my-[0.5cm] bg-white text-black border-[2.5px] border-black rounded-md font-black text-xl tracking-widest p-[0.2cm] font-mono shadow-sm">
                                                {generatedArticle.codigo_articulo}
                                            </div>

                                            {/* Info Preview */}
                                            <div className="mt-auto bg-white border-t-[1.5px] border-black p-[0.4cm] leading-none">
                                                <strong className="block mb-[0.2cm] text-black text-sm font-black uppercase tracking-tight">
                                                    {generatedArticle.nombre_articulo || '(Sin nombre)'}
                                                </strong>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-black font-bold uppercase">Unidad: {generatedArticle.unidad || '-'}</p>
                                                    <p className="text-[10px] text-black font-bold uppercase">Marca: {generatedArticle.marca || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center group-hover/preview:scale-110 transition-transform duration-700">
                                        <div className="w-24 h-24 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-2xl relative">
                                            <div className="absolute inset-0 bg-orange-500/10 rounded-[2rem] blur-xl opacity-0 group-hover/preview:opacity-100 transition-opacity" />
                                            <QrCode className="w-12 h-12 text-slate-800" />
                                        </div>
                                        <p className="text-slate-600 font-black uppercase tracking-[0.2em] text-[10px]">Esperando selección de artículo...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Search Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-300">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowModal(false)} />

                    <div className="bg-[#0f141a] border border-white/10 rounded-[2.5rem] w-full max-w-5xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh] relative z-10 border-t-white/20">
                        {/* Header */}
                        <div className="px-10 py-8 bg-slate-900/50 border-b border-white/5 flex justify-between items-center group">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-400">
                                    <Search className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Buscador de Artículos</h3>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Localización por código, nombre o marca</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-12 h-12 glass-button text-slate-500 hover:text-white rounded-2xl flex items-center justify-center transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Search Input Area */}
                        <div className="px-10 py-8 bg-slate-950/40 relative">
                            <div className="relative group/search-input">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-600 group-focus-within/search-input:text-orange-500 transition-colors" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Escriba el nombre, código o marca..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-900/80 border border-white/10 rounded-[1.5rem] pl-16 pr-6 py-5 text-xl text-white font-bold placeholder-slate-700 focus:outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all shadow-inner"
                                />
                                {loading && <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-orange-500 animate-spin" />}
                            </div>
                        </div>

                        {/* Results Area */}
                        <div className="flex-1 overflow-hidden flex flex-col bg-[#0f141a]">
                            <div className="flex-1 overflow-auto px-6 pb-10">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-[#0f141a]/95 backdrop-blur-lg">
                                        <tr className="border-b border-white/5">
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Referencia</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Código</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción / Marca</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {articulos.map((art) => (
                                            <tr key={art.codigo_articulo} className="hover:bg-white/[0.02] transition-all group/row-search h-20">
                                                <td className="px-6 text-center">
                                                    <div className="w-12 h-12 bg-black/40 rounded-xl overflow-hidden border border-white/10 mx-auto transform group-hover/row-search:scale-110 transition-transform flex items-center justify-center">
                                                        {art.imagen_url ? (
                                                            <img src={art.imagen_url} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Tag className="w-5 h-5 text-slate-700" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6">
                                                    <span className="font-mono text-sm font-black text-orange-400 bg-orange-500/5 px-3 py-1 rounded-lg border border-orange-500/10">
                                                        {art.codigo_articulo}
                                                    </span>
                                                </td>
                                                <td className="px-6">
                                                    <div className="font-black text-slate-200 group-hover/row-search:text-white transition-colors uppercase leading-tight italic">
                                                        {art.nombre_articulo}
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1 block">
                                                        MARCA: {art.marca || 'N/A'} • UNIDAD: {art.unidad || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 text-center">
                                                    <button
                                                        onClick={() => handleSelectArticle(art)}
                                                        className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mx-auto active:scale-95 transition-all shadow-lg shadow-orange-900/40"
                                                    >
                                                        Seleccionar
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {articulos.length === 0 && !loading && searchTerm.length >= 2 && (
                                            <tr>
                                                <td colSpan={4} className="text-center py-20">
                                                    <AlertTriangle className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Sin coincidencias para la búsqueda</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-10 py-5 bg-slate-950/60 border-t border-white/5 flex justify-between items-center shrink-0">
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Criterio de búsqueda sensible a mayúsculas</span>
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Max. 50 Resultados</span>
                                <div className="w-1 h-1 rounded-full bg-slate-700" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{searchTerm.length} Caracteres</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Final Printable Area */}
            {generatedArticle && (
                <div className="print-area hidden">
                    <div className="etiqueta">
                        <div className="etiqueta-qr">
                            <QRCode
                                value={generatedArticle.codigo_articulo}
                                size={110}
                                fgColor="#000000"
                                bgColor="#ffffff"
                                level="M"
                            />
                        </div>
                        <div className="etiqueta-codigo">{generatedArticle.codigo_articulo}</div>
                        <div className="etiqueta-info">
                            <strong>{generatedArticle.nombre_articulo || '(Sin nombre)'}</strong>
                            Unidad: {generatedArticle.unidad || '-'}<br />
                            Marca: {generatedArticle.marca || 'N/A'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
