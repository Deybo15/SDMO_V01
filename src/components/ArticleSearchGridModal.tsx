import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, Image as ImageIcon, PlusCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Articulo } from '../types/inventory';
import { cn } from '../lib/utils';

interface ArticleSearchGridModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (article: Articulo) => void;
    themeColor?: string;
    title?: string;
    showOnlyAvailable?: boolean;
}

export default function ArticleSearchGridModal({
    isOpen,
    onClose,
    onSelect,
    themeColor = 'teal',
    title = 'BUSCADOR',
    showOnlyAvailable = false
}: ArticleSearchGridModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [articles, setArticles] = useState<Articulo[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalResults, setTotalResults] = useState(0);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string } | null>(null);

    const ITEMS_PER_PAGE = 48;

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setPage(1);
            setArticles([]);
            fetchArticles(1, false, '');
        }
    }, [isOpen]);

    const fetchArticles = async (pageToFetch: number, append: boolean, term: string) => {
        setLoading(true);
        try {
            const from = (pageToFetch - 1) * ITEMS_PER_PAGE;
            const to = pageToFetch * ITEMS_PER_PAGE - 1;

            let query = supabase
                .from('inventario_actual')
                .select('codigo_articulo, nombre_articulo, cantidad_disponible, unidad, imagen_url, precio_unitario', { count: 'exact' });

            if (showOnlyAvailable) {
                query = query.gt('cantidad_disponible', 0);
            }

            const cleanTerm = term.trim();
            if (cleanTerm) {
                query = query.or(`nombre_articulo.ilike.%${cleanTerm}%,codigo_articulo.ilike.%${cleanTerm}%`);
            }

            query = query.order('nombre_articulo', { ascending: true }).range(from, to);

            const { data, error, count } = await query;
            if (error) throw error;

            let fetchedItems = data || [];

            // Fetch brands for these specific items
            if (fetchedItems.length > 0) {
                const codigos = fetchedItems.map(i => i.codigo_articulo).filter(Boolean);
                const { data: marcas } = await supabase
                    .from('articulo_01')
                    .select('codigo_articulo, marca')
                    .in('codigo_articulo', codigos);

                const marcasMap = (marcas || []).reduce((acc: any, curr) => {
                    acc[curr.codigo_articulo] = curr.marca;
                    return acc;
                }, {});

                fetchedItems = fetchedItems.map(item => ({
                    ...item,
                    marca: marcasMap[item.codigo_articulo] || ''
                }));
            }

            setTotalResults(count || 0);
            setArticles(prev => append ? [...prev, ...fetchedItems] : fetchedItems);
            setHasMore((count || 0) > (append ? articles.length + fetchedItems.length : fetchedItems.length));

        } catch (error) {
            console.error('Error fetching articles:', error);
        } finally {
            setLoading(false);
        }
    };

    // Debounced search
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            if (searchTerm.length >= 0) {
                setPage(1);
                fetchArticles(1, false, searchTerm);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchArticles(nextPage, true, searchTerm);
    };

    if (!isOpen) return null;

    const accentClasses = {
        teal: 'text-teal-400 border-teal-500/30 bg-teal-500/10 hover:border-teal-500/50 shadow-teal-500/10',
        blue: 'text-blue-400 border-blue-500/30 bg-blue-500/10 hover:border-blue-500/50 shadow-blue-500/10',
        purple: 'text-purple-400 border-purple-500/30 bg-purple-500/10 hover:border-purple-500/50 shadow-purple-500/10'
    }[themeColor as 'teal' | 'blue' | 'purple'] || 'text-teal-400 border-teal-500/30 bg-teal-500/10';

    const accentButtonClasses = {
        teal: 'text-teal-400 hover:border-teal-500/30 hover:bg-teal-500/10',
        blue: 'text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/10',
        purple: 'text-purple-400 hover:border-purple-500/30 hover:bg-purple-500/10'
    }[themeColor as 'teal' | 'blue' | 'purple'] || 'text-teal-400 hover:border-teal-500/30 hover:bg-teal-500/10';

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

            <div className="relative w-full max-w-6xl bg-[#0f111a]/95 border border-white/10 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Modal Header */}
                <div className="px-8 py-6 border-b border-white/10 flex justify-between items-center bg-black/40 shrink-0">
                    <div>
                        <h3 className="text-3xl font-black text-white flex items-center gap-4 italic tracking-tight uppercase">
                            <Search className={cn("w-8 h-8", themeColor === 'teal' ? "text-teal-400" : themeColor === 'blue' ? "text-blue-400" : "text-purple-400")} />
                            {title}
                        </h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mt-2">Seleccione un elemento de la rejilla para continuar</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/5 border border-white/10 text-gray-400 rounded-2xl hover:text-white hover:bg-white/10 transition-all active:scale-95"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-8 py-6 bg-black/20 border-b border-white/5 shrink-0">
                    <div className="relative group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600 group-focus-within:text-teal-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por código o nombre del artículo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-16 pr-8 text-white text-lg font-medium outline-none focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5 transition-all placeholder:text-gray-700"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Article Grid */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-black/10">
                    {loading && articles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-6">
                            <Loader2 className="w-16 h-16 text-teal-400 animate-spin" />
                            <p className="text-gray-500 font-bold text-xl animate-pulse uppercase tracking-[0.1em]">Consultando Inventario...</p>
                        </div>
                    ) : articles.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-8">
                            {articles.map((art) => (
                                <div
                                    key={art.codigo_articulo}
                                    onClick={() => onSelect(art)}
                                    className={cn(
                                        "group relative bg-white/[0.03] border border-white/5 rounded-3xl p-5 hover:bg-white/[0.08] hover:border-teal-500/40 transition-all cursor-pointer flex flex-col h-full shadow-2xl hover:shadow-teal-500/20",
                                        art.cantidad_disponible === 0 && "opacity-60"
                                    )}
                                >
                                    {/* Thumb */}
                                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-5 bg-black/60 border border-white/5">
                                        {art.imagen_url ? (
                                            <img
                                                src={art.imagen_url}
                                                alt={art.nombre_articulo}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedImage({ src: art.imagen_url!, alt: art.nombre_articulo });
                                                    setShowImageModal(true);
                                                }}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 cursor-zoom-in"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon className="w-12 h-12 text-gray-800" />
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3 px-3 py-1 bg-black/80 backdrop-blur-md rounded-lg text-[9px] font-black text-teal-400 border border-teal-500/40 uppercase tracking-widest shadow-xl">
                                            {art.unidad}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 flex flex-col">
                                        <h4 className="font-bold text-white group-hover:text-teal-400 transition-colors mb-3 leading-snug line-clamp-2 uppercase italic text-sm tracking-tight">
                                            {art.nombre_articulo}
                                        </h4>
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-[10px] font-mono text-gray-500 bg-black/40 px-2 py-1 rounded-md border border-white/5 tracking-tighter">
                                                {art.codigo_articulo}
                                            </span>
                                            {art.marca && (
                                                <span className="text-[10px] uppercase font-black text-teal-500/70 tracking-widest">
                                                    {art.marca}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Foot */}
                                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-600 uppercase font-black tracking-widest mb-1 italic">Stock Disponible</span>
                                            <span className={cn(
                                                "text-2xl font-black italic",
                                                art.cantidad_disponible > 0 ? "text-teal-400" : "text-rose-500"
                                            )}>
                                                {art.cantidad_disponible}
                                            </span>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center group-hover:bg-teal-400 group-hover:text-black transition-all shadow-inner">
                                            <PlusCircle className="w-6 h-6" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-40">
                            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                                <Search className="w-12 h-12 text-gray-700" />
                            </div>
                            <h3 className="text-white text-2xl font-black italic mb-2 uppercase tracking-tight">Sin resultados</h3>
                            <p className="text-gray-500 font-medium">No se encontró ningún artículo bajo ese término.</p>
                        </div>
                    )}

                    {/* Pagination */}
                    {hasMore && (
                        <div className="mt-16 text-center pb-12">
                            <button
                                onClick={handleLoadMore}
                                disabled={loading}
                                className={cn(
                                    "inline-flex items-center gap-3 px-10 py-5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/10 disabled:opacity-50 font-black uppercase text-xs tracking-[0.2em]",
                                    accentButtonClasses
                                )}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Cargando más...
                                    </>
                                ) : (
                                    'Explorar catálogo completo'
                                )}
                            </button>
                            <p className="text-[10px] text-gray-600 mt-4 font-black uppercase tracking-widest italic">
                                Mostrando {articles.length} de {totalResults} artículos
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Simple Image Modal for the Grid */}
            {showImageModal && selectedImage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in"
                    onClick={() => setShowImageModal(false)}
                >
                    <div className="relative max-w-4xl w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowImageModal(false)}
                            className="absolute -top-16 right-0 p-3 text-white/40 hover:text-white transition-colors"
                        >
                            <X className="w-10 h-10" />
                        </button>
                        <img
                            src={selectedImage.src}
                            alt={selectedImage.alt}
                            className="max-w-full max-h-[75vh] object-contain rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10"
                        />
                        <p className="mt-8 text-white font-black italic text-2xl text-center uppercase tracking-tight">{selectedImage.alt}</p>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
