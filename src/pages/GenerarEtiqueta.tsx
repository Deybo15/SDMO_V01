import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Search, X, QrCode, Printer, Tag, AlertTriangle, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import QRCode from 'react-qr-code';

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
            setSearchTerm(''); // Trigger fetch via dependency
        }
    }, [showModal]);

    const handleSelectArticle = (article: Articulo) => {
        setGeneratedArticle(article);
        setShowModal(false);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-[#0f1419] text-slate-200 font-sans relative p-4 md:p-8">
            <style>{`
                @keyframes bgpulse { to { transform: translateY(-6px); } }
                .bg-blobs::before {
                    content: ""; position: fixed; inset: 0; z-index: -1;
                    background:
                        radial-gradient(80rem 80rem at 20% 85%, rgba(249,115,22,.14), transparent 55%),
                        radial-gradient(80rem 80rem at 80% 15%, rgba(59,130,246,.10), transparent 55%),
                        radial-gradient(50rem 50rem at 40% 40%, rgba(234,88,12,.10), transparent 55%);
                    animation: bgpulse 18s ease-in-out infinite alternate;
                    pointer-events: none;
                }
                
                /* Print Styles */
                @media print {
                    @page { margin: 0; size: auto; }
                    
                    /* Force White Background everywhere */
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

                    /* Hide everything by default using visibility to keep layout flow if needed, 
                       but position fixed for the print area will override it visually */
                    body * {
                        visibility: hidden;
                    }

                    /* Show Print Area */
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
                        border: 1px solid #000 !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                        /* Ensure exact dimensions */
                        width: 6.5cm !important;
                        height: 10.5cm !important;
                        display: flex;
                        flex-direction: column;
                        padding: 0.22cm !important;
                    }

                    .etiqueta-qr {
                        margin-top: 0.3cm !important;
                        padding: 0.25cm !important;
                        background: white !important;
                        border-radius: 0.5rem !important;
                        align-self: center;
                        display: flex;
                        justify-content: center;
                    }

                    .etiqueta-codigo {
                        background: white !important;
                        color: black !important;
                        border: 2px solid #000 !important;
                        text-align: center !important;
                        margin-top: 0.45cm !important;
                        margin-bottom: 0.45cm !important;
                        border-radius: 0.5rem !important;
                        font-weight: 800 !important;
                        font-size: 1.125rem !important;
                        letter-spacing: 0.05em !important;
                        padding: 0.18cm !important;
                    }

                    .etiqueta-info {
                        background: white !important;
                        color: black !important;
                        border: 1px solid #000 !important;
                        margin-top: auto !important;
                        border-radius: 0.5rem !important;
                        padding: 0.35cm !important;
                        line-height: 1.5 !important;
                        font-size: 0.75rem !important;
                    }
                    
                    .etiqueta-info strong {
                        color: #000 !important;
                        display: block !important;
                        margin-bottom: 0.2cm !important;
                        font-size: 0.8125rem !important;
                    }

                    /* Hide non-print elements explicitly */
                    header, .no-print, .bg-blobs { display: none !important; }
                }
            `}</style>

            <div className="bg-blobs" />

            <div className="relative z-10 max-w-6xl mx-auto no-print">
                {/* Header */}
                <div className="sticky top-0 z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 mb-8 bg-[#0f1419]/90 backdrop-blur-xl -mx-4 px-4 md:-mx-8 md:px-8 border-b border-white/5 shadow-lg shadow-black/20 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/30">
                            <QrCode className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                                Generar Etiqueta QR
                            </h1>
                            <p className="text-xs text-slate-500">Inventario • SDMO</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 border border-white/10 rounded-xl hover:bg-slate-700 transition-all shadow-sm"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Regresar
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Panel: Selection */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <span className="bg-orange-500/20 text-orange-500 border border-orange-500/30 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                                    <Tag className="w-4 h-4" />
                                    Etiquetas 6.5 × 10.5 cm
                                </span>
                            </div>

                            <h2 className="text-xl font-bold text-white mb-4">Artículo Seleccionado</h2>

                            {generatedArticle ? (
                                <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6 mb-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center border border-white/5 shrink-0">
                                            {generatedArticle.imagen_url ? (
                                                <img src={generatedArticle.imagen_url} alt="" className="w-full h-full object-cover rounded-xl" />
                                            ) : (
                                                <Tag className="w-8 h-8 text-slate-600" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg leading-tight mb-1">
                                                {generatedArticle.nombre_articulo}
                                            </h3>
                                            <p className="text-slate-400 font-mono text-sm mb-2">
                                                {generatedArticle.codigo_articulo}
                                            </p>
                                            <div className="flex gap-2 text-xs">
                                                <span className="bg-slate-700/50 px-2 py-1 rounded text-slate-300">
                                                    Marca: {generatedArticle.marca || 'N/A'}
                                                </span>
                                                <span className="bg-slate-700/50 px-2 py-1 rounded text-slate-300">
                                                    Unidad: {generatedArticle.unidad || 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-8 mb-6 text-center border-dashed">
                                    <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-400">No se ha seleccionado ningún artículo.</p>
                                </div>
                            )}

                            <button
                                onClick={() => setShowModal(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold border border-white/10 transition-all mb-3"
                            >
                                <Search className="w-5 h-5" />
                                {generatedArticle ? 'Cambiar Artículo' : 'Buscar Artículo'}
                            </button>

                            {generatedArticle && (
                                <button
                                    onClick={handlePrint}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all"
                                >
                                    <Printer className="w-5 h-5" />
                                    Imprimir Etiqueta
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Preview */}
                    <div className="lg:col-span-7">
                        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-6 min-h-[500px] flex flex-col">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Printer className="w-5 h-5 text-orange-500" />
                                Vista Previa
                            </h3>

                            <div className="flex-1 flex items-center justify-center bg-slate-800/30 rounded-2xl border border-white/5 p-8">
                                {generatedArticle ? (
                                    <div className="scale-100">
                                        <div className="etiqueta-preview w-[6.5cm] h-[10.5cm] p-[0.22cm] mx-auto bg-slate-700/50 border border-white/10 rounded-2xl flex flex-col justify-start shadow-inner">
                                            {/* QR Container Preview */}
                                            <div className="self-center mt-[0.3cm] p-[0.25cm] bg-white rounded-xl shadow-lg flex justify-center">
                                                <QRCode
                                                    value={generatedArticle.codigo_articulo}
                                                    size={110}
                                                    fgColor="#000000"
                                                    bgColor="#ffffff"
                                                    level="M"
                                                />
                                            </div>

                                            {/* Code Preview */}
                                            <div className="text-center my-[0.45cm] bg-white text-black border-2 border-slate-200 rounded-lg font-extrabold text-lg tracking-widest p-[0.18cm]">
                                                {generatedArticle.codigo_articulo}
                                            </div>

                                            {/* Info Preview */}
                                            <div className="mt-auto bg-white/5 border border-white/10 rounded-xl p-[0.35cm] leading-relaxed text-slate-200 text-xs">
                                                <strong className="block mb-[0.2cm] text-blue-300 text-[13px]">
                                                    {generatedArticle.nombre_articulo || '(Sin nombre)'}
                                                </strong>
                                                Unidad: {generatedArticle.unidad || '-'}<br />
                                                Marca: {generatedArticle.marca || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-500">
                                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <QrCode className="w-10 h-10 opacity-20" />
                                        </div>
                                        <p>Seleccione un artículo para ver la vista previa</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-4 bg-slate-800 border-b border-white/10 flex justify-between items-center shrink-0">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <Search className="w-5 h-5 text-orange-500" />
                                Buscar Artículo
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-white/5 shrink-0 bg-slate-900">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Buscar por nombre, código o marca..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden p-0 flex flex-col bg-slate-900">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2 text-orange-500" />
                                    <p>Buscando artículos...</p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-slate-800 text-slate-200 shadow-sm">
                                            <tr>
                                                <th className="p-4 font-semibold w-24 text-center">Código</th>
                                                <th className="p-4 font-semibold">Descripción</th>
                                                <th className="p-4 font-semibold w-32">Marca</th>
                                                <th className="p-4 font-semibold w-24 text-center">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {articulos.map((art) => (
                                                <tr key={art.codigo_articulo} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-4 font-mono text-sm text-slate-300 text-center">
                                                        {art.codigo_articulo}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-medium text-white">{art.nombre_articulo}</div>
                                                        {art.unidad && (
                                                            <div className="text-xs text-slate-500 mt-1">Unidad: {art.unidad}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-slate-400 text-sm">
                                                        {art.marca || '-'}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <button
                                                            onClick={() => handleSelectArticle(art)}
                                                            className="p-2 bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white rounded-lg transition-colors"
                                                        >
                                                            <ChevronRight className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {articulos.length === 0 && !loading && (
                                                <tr>
                                                    <td colSpan={4} className="text-center py-12 text-slate-500">
                                                        <p>No se encontraron resultados para "{searchTerm}"</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-slate-800 border-t border-white/10 text-center text-xs text-slate-500 shrink-0">
                            Mostrando {articulos.length} resultados (máx. 50)
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Print Container */}
            {generatedArticle && (
                <div className="print-area hidden">
                    <PrintableLabel article={generatedArticle} />
                </div>
            )}
        </div>
    );
}

// Subcomponent for the printable label
function PrintableLabel({ article }: { article: Articulo }) {
    return (
        <div className="etiqueta">
            <div className="etiqueta-qr">
                <QRCode
                    value={article.codigo_articulo}
                    size={110}
                    fgColor="#000000"
                    bgColor="#ffffff"
                    level="M"
                />
            </div>
            <div className="etiqueta-codigo">{article.codigo_articulo}</div>
            <div className="etiqueta-info">
                <strong>{article.nombre_articulo || '(Sin nombre)'}</strong>
                Unidad: {article.unidad || '-'}<br />
                Marca: {article.marca || 'N/A'}
            </div>
        </div>
    );
}
