import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, Image as ImageIcon, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Articulo } from '../types/inventory';
import { cn } from '../lib/utils';

interface ArticleSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (article: Articulo) => void;
    themeColor?: string;
    title?: string;
    placeholder?: string;
    showOnlyAvailable?: boolean;
}

export default function ArticleSearchModal({
    isOpen,
    onClose,
    onSelect,
    themeColor = 'blue',
    title = 'Buscar Artículo',
    placeholder = 'Buscar por código, nombre...',
    showOnlyAvailable = false
}: ArticleSearchModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [articles, setArticles] = useState<Articulo[]>([]);
    const [loading, setLoading] = useState(false);
    const [limit, setLimit] = useState(50);
    const [hasMore, setHasMore] = useState(false);
    const [totalResults, setTotalResults] = useState(0);

    useEffect(() => {
        if (isOpen) {
            const fetchArticles = async () => {
                setLoading(true);
                try {
                    let query = supabase
                        .from('inventario_actual')
                        .select('codigo_articulo, nombre_articulo, cantidad_disponible, unidad, imagen_url, precio_unitario', { count: 'exact' });

                    if (showOnlyAvailable) {
                        query = query.gt('cantidad_disponible', 0);
                    }

                    const term = searchTerm.trim();
                    if (term) {
                        query = query.or(`nombre_articulo.ilike.%${term}%,codigo_articulo.ilike.%${term}%`);
                    }

                    query = query.limit(limit);

                    console.log('Fetching articles for term:', term || 'all', 'limit:', limit);
                    const { data, error, count } = await query;
                    if (error) throw error;

                    setTotalResults(count || 0);
                    setHasMore(data ? data.length < (count || 0) : false);

                    let processedArticles: Articulo[] = [];

                    if (data && data.length > 0) {
                        const codigos = data.map(a => a.codigo_articulo).filter(Boolean);

                        const { data: marcasData } = await supabase
                            .from('articulo_01')
                            .select('codigo_articulo, marca')
                            .in('codigo_articulo', codigos);

                        const marcasMap = (marcasData || []).reduce((acc, curr) => {
                            acc[curr.codigo_articulo] = curr.marca;
                            return acc;
                        }, {} as Record<string, string>);

                        processedArticles = data.map(a => ({
                            codigo_articulo: a.codigo_articulo,
                            nombre_articulo: a.nombre_articulo,
                            cantidad_disponible: a.cantidad_disponible || 0,
                            unidad: a.unidad || 'UND',
                            imagen_url: a.imagen_url,
                            precio_unitario: a.precio_unitario || 0,
                            marca: marcasMap[a.codigo_articulo] || 'N/A'
                        }));
                    }

                    setArticles(processedArticles);
                } catch (error) {
                    console.error('Error fetching articles:', error);
                    setArticles([]);
                } finally {
                    setLoading(false);
                }
            };

            const timer = setTimeout(fetchArticles, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen, searchTerm, showOnlyAvailable, limit]);

    const handleLoadMore = () => {
        setLimit(prev => prev + 50);
    };

    // Reset limit when searchTerm changes or modal opens
    useEffect(() => {
        setLimit(50);
    }, [searchTerm, isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-0 md:p-8 bg-black/90">
            <div className="relative bg-[#121212] w-full h-full md:h-auto md:max-h-[85vh] md:max-w-4xl md:rounded-[8px] border-0 md:border md:border-[#333333] shadow-2xl flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="p-8 border-b border-[#333333] bg-black/20 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-2xl font-black text-[#F5F5F7] flex items-center gap-3 uppercase italic tracking-tighter">
                            <Search className="w-6 h-6 text-[#0071E3]" />
                            {title}
                        </h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#86868B] mt-1">Seleccione un elemento para agregar a la lista</p>
                    </div>
                    <button
                        onClick={(e) => {
                            console.log('Close button clicked');
                            onClose();
                        }}
                        className="p-3 bg-transparent border border-[#F5F5F7]/30 text-[#86868B] rounded-[8px] hover:text-[#F5F5F7] hover:bg-white/5 transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="p-8 border-b border-[#333333] bg-black/40 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] py-4 pl-12 pr-4 text-[#F5F5F7] placeholder-[#424245] focus:border-[#0071E3]/50 outline-none transition-all text-sm font-medium"
                            placeholder={placeholder}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0f111a]/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0071E3]" />
                            <p>Buscando artículos...</p>
                        </div>
                    ) : articles.length > 0 ? (
                        articles.map((article) => (
                            <div
                                key={article.codigo_articulo}
                                onClick={(e) => {
                                    console.log('Item selected via click:', article.nombre_articulo);
                                    onSelect(article);
                                    onClose();
                                    setSearchTerm('');
                                }}
                                className={cn(
                                    "group bg-[#1D1D1F] border border-[#333333] p-6 rounded-[8px] hover:border-[#0071E3]/50 hover:bg-white/[0.02] cursor-pointer transition-all duration-200 flex items-center gap-6 shadow-xl",
                                    article.cantidad_disponible === 0 && "opacity-60 grayscale-[0.5]"
                                )}
                            >
                                {/* Image */}
                                <div className="w-20 h-20 rounded-[8px] bg-black/40 shrink-0 overflow-hidden border border-[#333333] flex items-center justify-center">
                                    {article.imagen_url ? (
                                        <img
                                            src={article.imagen_url}
                                            alt={article.nombre_articulo}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-[#333333]" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="text-[#F5F5F7] font-black group-hover:text-[#0071E3] transition-colors text-base uppercase italic tracking-tight leading-snug">
                                                {article.nombre_articulo}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-2">
                                                <p className="text-[11px] font-mono font-black text-[#86868B] uppercase tracking-tighter">
                                                    Code: <span className="text-[#F5F5F7]">{article.codigo_articulo}</span>
                                                </p>
                                                {article.marca && (
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0071E3] bg-[#0071E3]/10 px-3 py-1 rounded-[4px] border border-[#0071E3]/20 italic">
                                                        {article.marca}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className={cn(
                                                "px-4 py-2 rounded-[6px] border flex flex-col items-center min-w-[60px]",
                                                article.cantidad_disponible > 0
                                                    ? "bg-[#0071E3]/10 border-[#0071E3]/20"
                                                    : "bg-rose-500/10 border-rose-500/20"
                                            )}>
                                                <span className={cn(
                                                    "text-2xl font-black italic leading-none",
                                                    article.cantidad_disponible > 0 ? "text-[#0071E3]" : "text-rose-500"
                                                )}>
                                                    {article.cantidad_disponible}
                                                </span>
                                                <span className="text-[9px] text-[#86868B] font-black uppercase tracking-widest mt-1">
                                                    {article.unidad}
                                                </span>
                                            </div>
                                            {article.cantidad_disponible === 0 && (
                                                <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mt-1">Sin Stock</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search className="w-8 h-8 text-gray-600" />
                            </div>
                            <h3 className="text-gray-300 font-medium mb-1">No se encontraron resultados</h3>
                            <p className="text-gray-500 text-sm">Intente con otro término de búsqueda</p>
                        </div>
                    )}

                    {/* Load More Button */}
                    {!loading && hasMore && (
                        <div className="pt-4 pb-8 flex justify-center">
                            <button
                                onClick={handleLoadMore}
                                className="px-8 py-3 bg-[#1D1D1F] border border-[#333333] text-[#0071E3] rounded-[8px] font-black uppercase text-[10px] tracking-widest hover:bg-[#0071E3]/5 hover:border-[#0071E3]/30 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Cargar más artículos
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Hint */}
                <div className="p-6 bg-black/20 border-t border-[#333333] flex justify-between items-center shrink-0">
                    <p className="text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">
                        {loading ? 'Buscando...' : `Mostrando ${articles.length} de ${totalResults} resultados`}
                    </p>
                    {!hasMore && !loading && totalResults > 0 && (
                        <p className="text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">
                            Fin de los resultados
                        </p>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
