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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] p-4 md:p-8 relative overflow-hidden">
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
                        border: 2px solid #000 !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                        width: 6.5cm !important;
                        height: 10.5cm !important;
                        display: flex;
                        flex-direction: column;
                        padding: 0.4cm !important;
                        border-radius: 0 !important;
                        font-family: 'Arial', sans-serif !important;
                        box-sizing: border-box !important;
                        overflow: hidden !important;
                    }

                    .etiqueta-qr {
                        padding: 0 !important;
                        background: white !important;
                        align-self: center;
                        display: flex;
                        justify-content: center;
                    }

                    .etiqueta-codigo-box {
                        border: 2.5px solid #000 !important;
                        border-radius: 6px !important;
                        padding: 0.2cm !important;
                        text-align: center !important;
                        font-family: 'Courier New', Courier, monospace !important;
                        font-weight: 900 !important;
                        font-size: 1.1rem !important;
                        background: white !important;
                        margin-top: 0.3cm !important;
                        box-sizing: border-box !important;
                        width: 100% !important;
                    }

                    .etiqueta-info {
                        flex: 1 !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-evenly !important;
                        padding-top: 0.3cm !important;
                        min-height: 0 !important;
                    }
                    
                    .etiqueta-nombre {
                        font-size: 1.05rem !important;
                        font-weight: 800 !important;
                        text-transform: uppercase !important;
                        line-height: 1.2 !important;
                        text-align: center !important;
                        display: -webkit-box !important;
                        -webkit-line-clamp: 3 !important;
                        -webkit-box-orient: vertical !important;
                        overflow: hidden !important;
                    }

                    .etiqueta-meta {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 0.1cm !important;
                        font-size: 0.85rem !important;
                        font-weight: 700 !important;
                        text-transform: uppercase !important;
                        border-top: 1.5px solid #000 !important;
                        padding-top: 0.3cm !important;
                    }
                }
            `}</style>

            <div className="max-w-6xl mx-auto space-y-8 relative z-10 no-print">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-[#333333]">
                    <div className="space-y-1">
                        <PageHeader title="Generar Etiqueta QR" icon={QrCode} themeColor="blue" />
                        <p className="text-[#86868B] text-sm font-medium tracking-wide">
                            Generación de etiquetas térmicas estandarizadas (6.5 × 10.5 cm).
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 bg-transparent border border-[#333333] rounded-[8px] text-xs font-black uppercase tracking-widest flex items-center gap-2 text-[#F5F5F7] transition-all hover:bg-white/5"
                    >
                        <ArrowLeft className="w-4 h-4 text-[#0071E3]" />
                        Regresar
                    </button>
                </div>

                {/* Status Float Messages */}
                {statusMessage && (
                    <div className={`fixed top-8 right-8 z-[100] px-6 py-5 rounded-[8px] shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 flex items-center gap-4
                        ${statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100' :
                            statusMessage.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-100' :
                                'bg-[#0071E3]/10 border-[#0071E3]/20 text-blue-100'
                        }`}>
                        <div className="p-2 rounded-[8px] bg-white/5 shrink-0">
                            {statusMessage.type === 'error' ? <AlertTriangle className="w-5 h-5 text-rose-400" /> :
                                statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                                    <Info className="w-5 h-5 text-blue-400" />}
                        </div>
                        <span className="font-black uppercase tracking-widest text-[11px] leading-relaxed">{statusMessage.message}</span>
                        <button onClick={() => setStatusMessage(null)} className="ml-auto p-1 hover:bg-white/5 rounded-[4px] transition-colors">
                            <X className="w-4 h-4 text-[#86868B]" />
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Selection Panel */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-[#121212] p-8 border border-[#333333] rounded-[8px] relative group">
                            <h2 className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                                <Tag className="w-4 h-4 text-[#0071E3]" />
                                Configuración de Etiqueta
                            </h2>

                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-4 ml-1">Artículo Seleccionado</label>

                            <div className="mb-8">
                                {generatedArticle ? (
                                    <div className="flex items-center gap-5 p-5 bg-[#1D1D1F] border border-[#333333] rounded-[8px] relative overflow-hidden group/item">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-[#0071E3]" />
                                        <div className="w-20 h-20 bg-black/40 rounded-[4px] overflow-hidden border border-[#333333] shrink-0 flex items-center justify-center">
                                            {generatedArticle.imagen_url ? (
                                                <img src={generatedArticle.imagen_url} className="w-full h-full object-cover opacity-90 group-hover/item:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <Tag className="w-8 h-8 text-[#333333]" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-mono text-[10px] font-black text-[#0071E3] uppercase tracking-widest">{generatedArticle.codigo_articulo}</span>
                                            <p className="text-base font-black text-[#F5F5F7] truncate italic uppercase leading-tight mb-2">{generatedArticle.nombre_articulo}</p>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="px-2 py-0.5 bg-white/5 rounded-[4px] text-[9px] font-black text-[#86868B] uppercase tracking-widest border border-[#333333]">
                                                    Marca: {generatedArticle.marca || 'N/A'}
                                                </span>
                                                <span className="px-2 py-0.5 bg-white/5 rounded-[4px] text-[9px] font-black text-[#86868B] uppercase tracking-widest border border-[#333333]">
                                                    Unidad: {generatedArticle.unidad || '-'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-10 border-2 border-dashed border-[#333333] rounded-[8px] bg-[#1D1D1F]/50 flex flex-col items-center text-center">
                                        <div className="w-16 h-16 rounded-[8px] bg-[#1D1D1F] flex items-center justify-center mb-4 border border-[#333333]">
                                            <AlertTriangle className="w-8 h-8 text-[#333333]" />
                                        </div>
                                        <p className="text-[#86868B] font-bold text-sm tracking-wide uppercase text-[10px]">No se ha seleccionado ningún artículo para generar la etiqueta.</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="w-full h-16 bg-transparent border border-[#333333] rounded-[8px] flex items-center justify-center gap-3 text-[#F5F5F7] hover:bg-white/5 transition-all group/btn"
                                >
                                    <Search className="w-5 h-5 text-[#0071E3] group-hover/btn:scale-110 transition-transform" />
                                    <span className="font-black uppercase tracking-[0.2em] text-xs">
                                        {generatedArticle ? 'Cambiar Artículo' : 'Localizar Artículo'}
                                    </span>
                                </button>

                                {generatedArticle && (
                                    <button
                                        onClick={handlePrint}
                                        className="w-full h-16 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-[8px] shadow-lg shadow-[#0071E3]/20 transition-all flex items-center justify-center gap-3 group/print"
                                    >
                                        <Printer className="w-6 h-6 group-hover/print:scale-110 transition-transform" />
                                        <span className="font-black uppercase tracking-[0.2em] text-xs">Imprimir Etiqueta</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Specs Card */}
                        <div className="bg-[#121212] p-6 border border-[#333333] rounded-[8px] flex items-center gap-5">
                            <div className="w-12 h-12 rounded-[4px] bg-[#1D1D1F] flex items-center justify-center border border-[#333333]">
                                <Info className="w-6 h-6 text-[#86868B]" />
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">Formato de Salida</h4>
                                <p className="text-[10px] text-[#333333] font-black uppercase">Dimensiones: 6.5cm ancho x 10.5cm alto. Optimizado para impresoras térmicas.</p>
                            </div>
                        </div>
                    </div>

                    {/* Preview Panel */}
                    <div className="lg:col-span-7">
                        <div className="bg-[#121212] p-8 border border-[#333333] rounded-[8px] h-full flex flex-col group/preview">
                            <h3 className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                                <Printer className="w-4 h-4 text-[#0071E3]" />
                                Vista Previa del Resultado
                            </h3>

                            <div className="flex-1 flex items-center justify-center bg-[#1D1D1F] rounded-[8px] border border-[#333333] p-12 relative overflow-hidden shadow-inner">
                                {generatedArticle ? (
                                    <div className="transform scale-90 md:scale-100 hover:scale-[1.02] transition-transform duration-500 cursor-default">
                                        <div className="w-[6.5cm] h-[10.5cm] bg-white rounded-sm shadow-2xl flex flex-col border-2 border-black overflow-hidden scale-90 md:scale-100 origin-center p-4 justify-between" style={{ boxSizing: 'border-box' }}>
                                            {/* QR Section */}
                                            <div className="flex justify-center">
                                                <QRCode
                                                    value={generatedArticle.codigo_articulo}
                                                    size={120}
                                                    fgColor="#000000"
                                                    bgColor="#ffffff"
                                                    level="H"
                                                />
                                            </div>

                                            {/* Code Box */}
                                            <div className="border-[2.5px] border-black rounded-lg p-2 text-center bg-white shadow-sm mt-2">
                                                <span className="font-mono text-base font-black tracking-wider text-black">{generatedArticle.codigo_articulo}</span>
                                            </div>

                                            {/* Descriptive Info */}
                                            <div className="flex-1 flex flex-col justify-evenly py-2 overflow-hidden">
                                                <h4 className="text-[1.1rem] font-extrabold text-black leading-tight text-center uppercase overflow-hidden line-clamp-3">
                                                    {generatedArticle.nombre_articulo}
                                                </h4>

                                                <div className="space-y-1 pt-2 border-t-2 border-black text-[10px] font-black text-black uppercase">
                                                    <div className="flex justify-between">
                                                        <span>MARCA:</span>
                                                        <span>{generatedArticle.marca || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>UNIDAD:</span>
                                                        <span>{generatedArticle.unidad || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center group-hover/preview:scale-105 transition-transform duration-700">
                                        <div className="w-24 h-24 bg-black/20 rounded-[8px] flex items-center justify-center mx-auto mb-6 border border-[#333333] shadow-2xl relative">
                                            <QrCode className="w-12 h-12 text-[#333333]" />
                                        </div>
                                        <p className="text-[#86868B] font-black uppercase tracking-[0.2em] text-[10px]">Esperando selección de artículo...</p>
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

                    <div className="bg-[#121212] border border-[#333333] rounded-[8px] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative z-10">
                        {/* Header */}
                        <div className="px-10 py-8 border-b border-[#333333] flex justify-between items-center bg-[#1D1D1F]">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-[4px] bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
                                    <Search className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Buscador de Artículos</h3>
                                    <p className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mt-1">Localización por código, nombre o marca</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-12 h-12 bg-transparent border border-[#333333] text-[#86868B] hover:text-white rounded-[8px] flex items-center justify-center transition-all hover:bg-white/5"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Search Input Area */}
                        <div className="px-10 py-8 bg-[#121212] relative">
                            <div className="relative group/search-input">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[#86868B] group-focus-within/search-input:text-[#0071E3] transition-colors" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Escriba el nombre, código o marca..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-16 pr-6 py-5 text-xl text-white font-bold placeholder-[#333333] focus:outline-none focus:border-[#0071E3]/50 transition-all shadow-inner"
                                />
                                {loading && <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[#0071E3] animate-spin" />}
                            </div>
                        </div>

                        {/* Results Area */}
                        <div className="flex-1 overflow-hidden flex flex-col bg-[#121212]">
                            <div className="flex-1 overflow-auto px-6 pb-10">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-[#121212]/95 backdrop-blur-lg">
                                        <tr className="border-b border-[#333333]">
                                            <th className="px-6 py-4 text-[10px] font-black text-[#86868B] uppercase tracking-widest text-center">Referencia</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-[#86868B] uppercase tracking-widest">Código</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-[#86868B] uppercase tracking-widest">Descripción / Marca</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-[#86868B] uppercase tracking-widest text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#333333]">
                                        {articulos.map((art) => (
                                            <tr key={art.codigo_articulo} className="hover:bg-white/[0.02] transition-all group/row-search h-20">
                                                <td className="px-6 text-center">
                                                    <div className="w-12 h-12 bg-black/40 rounded-[4px] overflow-hidden border border-[#333333] mx-auto transform group-hover/row-search:scale-105 transition-transform flex items-center justify-center">
                                                        {art.imagen_url ? (
                                                            <img src={art.imagen_url} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Tag className="w-5 h-5 text-[#333333]" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6">
                                                    <span className="font-mono text-sm font-black text-[#0071E3] bg-[#0071E3]/5 px-3 py-1 rounded-[4px] border border-[#0071E3]/10">
                                                        {art.codigo_articulo}
                                                    </span>
                                                </td>
                                                <td className="px-6">
                                                    <div className="font-black text-[#F5F5F7] group-hover/row-search:text-[#0071E3] transition-colors uppercase leading-tight italic">
                                                        {art.nombre_articulo}
                                                    </div>
                                                    <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest mt-1 block">
                                                        MARCA: {art.marca || 'N/A'} • UNIDAD: {art.unidad || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 text-center">
                                                    <button
                                                        onClick={() => handleSelectArticle(art)}
                                                        className="px-6 py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-[8px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mx-auto active:scale-95 transition-all shadow-lg shadow-[#0071E3]/20"
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
                                                    <AlertTriangle className="w-10 h-10 text-[#333333] mx-auto mb-4" />
                                                    <p className="text-[#86868B] font-bold uppercase tracking-widest text-[10px]">Sin coincidencias para la búsqueda</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-10 py-5 bg-[#1D1D1F] border-t border-[#333333] flex justify-between items-center shrink-0">
                            <span className="text-[9px] font-black text-[#86868B] uppercase tracking-[0.2em]">Criterio de búsqueda sensible a mayúsculas</span>
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-[#0071E3] uppercase tracking-widest">Max. 50 Resultados</span>
                                <div className="w-1 h-1 rounded-full bg-[#333333]" />
                                <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">{searchTerm.length} Caracteres</span>
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
                                size={120}
                                fgColor="#000000"
                                bgColor="#ffffff"
                                level="H"
                            />
                        </div>
                        <div className="etiqueta-codigo-box">{generatedArticle.codigo_articulo}</div>
                        <div className="etiqueta-info">
                            <span className="etiqueta-nombre">{generatedArticle.nombre_articulo || '(Sin nombre)'}</span>
                            <div className="etiqueta-meta">
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>MARCA:</span>
                                    <span>{generatedArticle.marca || 'N/A'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>UNIDAD:</span>
                                    <span>{generatedArticle.unidad || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
