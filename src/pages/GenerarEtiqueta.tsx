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
// El paquete expone el motor que usa internamente react-qr-code. Dibujarlo aquí
// evita que un error de render del wrapper externo derribe toda la página.
// @ts-expect-error qr.js no incluye declaraciones de TypeScript.
import QRCodeEngine from 'qr.js/lib/QRCode';
// @ts-expect-error qr.js no incluye declaraciones de TypeScript.
import ErrorCorrectLevel from 'qr.js/lib/ErrorCorrectLevel';

// Shared Components
import { PageHeader } from '../components/ui/PageHeader';

interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
    unidad: string | null;
    marca: string | null;
    imagen_url?: string | null;
}

function SafeQRCode({ value, size = 120 }: { value: string; size?: number }) {
    try {
        const qr = new QRCodeEngine(-1, ErrorCorrectLevel.H);
        qr.addData(String(value || 'SIN-CODIGO'));
        qr.make();

        const cells: boolean[][] = qr.modules;
        const foreground = cells
            .map((row, rowIndex) => row
                .map((cell, cellIndex) => cell
                    ? `M ${cellIndex} ${rowIndex} h 1 v 1 h -1 Z`
                    : '')
                .join(' '))
            .join(' ');

        return (
            <svg
                aria-label={`Código QR ${value}`}
                height={size}
                width={size}
                viewBox={`0 0 ${cells.length} ${cells.length}`}
                role="img"
                shapeRendering="crispEdges"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect width="100%" height="100%" fill="#ffffff" />
                <path d={foreground} fill="#000000" />
            </svg>
        );
    } catch (error) {
        console.error('No se pudo generar el código QR:', error);
        return (
            <div
                className="flex items-center justify-center border-2 border-black bg-white text-center text-[10px] font-bold text-black"
                style={{ width: size, height: size }}
            >
                QR NO DISPONIBLE
            </div>
        );
    }
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
    }, [articulos.length, showModal]);

    const handleSelectArticle = (article: Articulo) => {
        // Supabase puede devolver códigos numéricos aunque la columna se tipifique
        // como texto. El generador QR requiere siempre una cadena válida.
        setGeneratedArticle({
            ...article,
            codigo_articulo: String(article.codigo_articulo ?? ''),
            nombre_articulo: String(article.nombre_articulo ?? ''),
            unidad: article.unidad == null ? null : String(article.unidad),
            marca: article.marca == null ? null : String(article.marca),
        });
        setShowModal(false);
        setStatusMessage({ type: 'success', message: 'Artículo seleccionado correctamente.' });
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-black text-[#f4f4f5] px-4 py-6 md:px-8 md:py-8">
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
                        display: block !important;
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

            <div className="max-w-[1536px] mx-auto space-y-6 relative z-10 no-print">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-5 pb-5 border-b border-[#27272a]">
                    <PageHeader title="Generar etiqueta QR" subtitle="Creación de etiquetas térmicas para identificación de artículos." icon={QrCode} themeColor="neutral" />
                    <button
                        onClick={() => navigate(-1)}
                        className="h-11 px-5 bg-[#0d0d0e] border border-[#3f3f46] rounded-lg text-sm font-semibold flex items-center gap-2 text-[#f4f4f5] transition-colors hover:bg-[#18181b]"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Regresar
                    </button>
                </div>

                {/* Status Float Messages */}
                {statusMessage && (
                    <div className="fixed top-8 right-8 z-[100] px-5 py-4 rounded-lg shadow-2xl backdrop-blur-xl border border-[#52525b] bg-[#18181b] text-white animate-in slide-in-from-right-4 flex items-center gap-4">
                        <div className="p-2 rounded-[8px] bg-white/5 shrink-0">
                            {statusMessage.type === 'error' ? <AlertTriangle className="w-5 h-5 text-white" /> :
                                statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-white" /> :
                                    <Info className="w-5 h-5 text-white" />}
                        </div>
                        <span className="font-black uppercase tracking-widest text-[11px] leading-relaxed">{statusMessage.message}</span>
                        <button onClick={() => setStatusMessage(null)} className="ml-auto p-1 hover:bg-white/5 rounded-[4px] transition-colors">
                            <X className="w-4 h-4 text-[#86868B]" />
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Selection Panel */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="bg-[#0d0d0e] p-6 md:p-7 border border-[#3f3f46] rounded-xl">
                            <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-3">
                                <Tag className="w-5 h-5 text-[#d4d4d8]" />
                                Configuración de la etiqueta
                            </h2>
                            <p className="text-sm text-[#a1a1aa] mb-7">Seleccione el artículo que desea identificar.</p>

                            <label className="block text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] mb-4 ml-1">Artículo Seleccionado</label>

                            <div className="mb-8">
                                {generatedArticle ? (
                                    <div className="flex items-center gap-5 p-4 bg-[#151517] border border-[#52525b] rounded-lg overflow-hidden group/item">
                                        <div className="w-20 h-20 bg-black/40 rounded-[4px] overflow-hidden border border-[#333333] shrink-0 flex items-center justify-center">
                                            {generatedArticle.imagen_url ? (
                                                <img src={generatedArticle.imagen_url} className="w-full h-full object-cover opacity-90 group-hover/item:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <Tag className="w-8 h-8 text-[#333333]" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-mono text-xs font-semibold text-[#d4d4d8]">{generatedArticle.codigo_articulo}</span>
                                            <p className="text-sm font-semibold text-white uppercase leading-snug mb-2">{generatedArticle.nombre_articulo}</p>
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
                                    <div className="p-9 border border-dashed border-[#52525b] rounded-lg bg-[#151517] flex flex-col items-center text-center">
                                        <div className="w-14 h-14 rounded-lg bg-[#202024] flex items-center justify-center mb-4 border border-[#3f3f46]">
                                            <Tag className="w-6 h-6 text-[#a1a1aa]" />
                                        </div>
                                        <p className="text-[#86868B] font-bold text-sm tracking-wide uppercase text-[10px]">No se ha seleccionado ningún artículo para generar la etiqueta.</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="w-full h-12 bg-[#f4f4f5] border border-white rounded-lg flex items-center justify-center gap-3 text-black hover:bg-white transition-colors group/btn"
                                >
                                    <Search className="w-5 h-5" />
                                    <span className="font-black uppercase tracking-[0.2em] text-xs">
                                        {generatedArticle ? 'Cambiar Artículo' : 'Localizar Artículo'}
                                    </span>
                                </button>

                                {generatedArticle && (
                                    <button
                                        onClick={handlePrint}
                                        className="w-full h-12 bg-[#27272a] hover:bg-[#3f3f46] border border-[#52525b] text-white rounded-lg transition-colors flex items-center justify-center gap-3 group/print"
                                    >
                                        <Printer className="w-6 h-6 group-hover/print:scale-110 transition-transform" />
                                        <span className="font-black uppercase tracking-[0.2em] text-xs">Imprimir Etiqueta</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Specs Card */}
                        <div className="bg-[#0d0d0e] p-5 border border-[#3f3f46] rounded-xl flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[4px] bg-[#1D1D1F] flex items-center justify-center border border-[#333333]">
                                <Info className="w-6 h-6 text-[#86868B]" />
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">Formato de Salida</h4>
                                <p className="text-xs text-[#a1a1aa] mt-1">6,5 cm de ancho × 10,5 cm de alto, optimizado para impresoras térmicas.</p>
                            </div>
                        </div>
                    </div>

                    {/* Preview Panel */}
                    <div className="lg:col-span-7">
                        <div className="bg-[#0d0d0e] p-6 md:p-7 border border-[#3f3f46] rounded-xl h-full flex flex-col group/preview">
                            <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-3">
                                <Printer className="w-5 h-5 text-[#d4d4d8]" />
                                Vista previa
                            </h3>
                            <p className="text-sm text-[#a1a1aa] mb-7">Resultado final a escala para impresión térmica.</p>

                            <div className="min-h-[560px] flex-1 flex items-center justify-center bg-[#151517] rounded-lg border border-[#3f3f46] p-8 relative overflow-hidden">
                                {generatedArticle ? (
                                    <div className="transform scale-90 md:scale-100 hover:scale-[1.02] transition-transform duration-500 cursor-default">
                                        <div className="w-[6.5cm] h-[10.5cm] bg-white rounded-sm shadow-2xl flex flex-col border-2 border-black overflow-hidden scale-90 md:scale-100 origin-center p-4 justify-between" style={{ boxSizing: 'border-box' }}>
                                            {/* QR Section */}
                                            <div className="flex justify-center">
                                                <SafeQRCode value={String(generatedArticle.codigo_articulo)} size={120} />
                                            </div>

                                            {/* Code Box */}
                                            <div className="border-[2.5px] border-black rounded-lg p-2 text-center bg-white shadow-sm mt-2">
                                                <span className="font-mono text-base font-black tracking-wider text-black">{generatedArticle.codigo_articulo}</span>
                                            </div>

                                            {/* Descriptive Info */}
                                            <div className="flex-1 flex flex-col justify-evenly py-2 overflow-hidden">
                                                <h4 className="text-[1.1rem] font-extrabold text-black leading-tight text-center uppercase">
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
                                        <div className="w-20 h-20 bg-[#202024] rounded-lg flex items-center justify-center mx-auto mb-5 border border-[#3f3f46] relative">
                                            <QrCode className="w-10 h-10 text-[#71717a]" />
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

                    <div className="bg-[#0d0d0e] border border-[#52525b] rounded-xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative z-10">
                        {/* Header */}
                        <div className="px-6 md:px-8 py-6 border-b border-[#3f3f46] flex justify-between items-center bg-[#151517]">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-[#202024] text-white border border-[#52525b]">
                                    <Search className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white">Seleccionar artículo</h3>
                                    <p className="text-sm text-[#a1a1aa] mt-1">Busque por código, nombre o marca.</p>
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
                        <div className="px-6 md:px-8 py-6 bg-[#0d0d0e] relative">
                            <div className="relative group/search-input">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a1a1aa]" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Escriba el nombre, código o marca..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-[#18181b] border border-[#52525b] rounded-lg pl-14 pr-14 py-4 text-base text-white placeholder-[#71717a] focus:outline-none focus:border-white transition-colors"
                                />
                                {loading && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white animate-spin" />}
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
                                                    <span className="font-mono text-sm font-semibold text-white bg-[#202024] px-3 py-1 rounded border border-[#52525b]">
                                                        {art.codigo_articulo}
                                                    </span>
                                                </td>
                                                <td className="px-6">
                                                    <div className="font-semibold text-[#F5F5F7] uppercase leading-tight">
                                                        {art.nombre_articulo}
                                                    </div>
                                                    <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest mt-1 block">
                                                        MARCA: {art.marca || 'N/A'} • UNIDAD: {art.unidad || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 text-center">
                                                    <button
                                                        onClick={() => handleSelectArticle(art)}
                                                        className="px-5 py-2.5 bg-[#f4f4f5] hover:bg-white text-black rounded-lg text-xs font-semibold flex items-center gap-2 mx-auto active:scale-95 transition-all"
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
                                <span className="text-[9px] font-black text-[#d4d4d8] uppercase tracking-widest">Máx. 50 resultados</span>
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
                            <SafeQRCode value={String(generatedArticle.codigo_articulo)} size={120} />
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
