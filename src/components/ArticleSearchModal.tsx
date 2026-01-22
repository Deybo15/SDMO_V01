import { useState, useEffect } from 'react';
import { Search, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Articulo } from '../types/inventory';

interface ArticleSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (article: Articulo) => void;
    themeColor?: string;
    title?: string;
    placeholder?: string;
}

export default function ArticleSearchModal({
    isOpen,
    onClose,
    onSelect,
    themeColor = 'blue',
    title = 'Buscar Artículo',
    placeholder = 'Buscar por código, nombre...'
}: ArticleSearchModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [articles, setArticles] = useState<Articulo[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const fetchArticles = async () => {
                setLoading(true);
                try {
                    let query = supabase
                        .from('inventario_actual')
                        .select('codigo_articulo, nombre_articulo, cantidad_disponible, unidad, imagen_url, precio_unitario')
                        .gt('cantidad_disponible', 0)
                        .limit(50);

                    if (searchTerm) {
                        query = query.or(`nombre_articulo.ilike.%${searchTerm}%,codigo_articulo.ilike.%${searchTerm}%`);
                    }

                    const { data, error } = await query;
                    if (error) throw error;

                    if (data) {
                        setArticles(data.map(a => ({
                            codigo_articulo: a.codigo_articulo,
                            nombre_articulo: a.nombre_articulo,
                            cantidad_disponible: a.cantidad_disponible || 0,
                            unidad: a.unidad || 'UND',
                            imagen_url: a.imagen_url,
                            precio_unitario: a.precio_unitario || 0
                        })));
                    } else {
                        setArticles([]);
                    }
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
    }, [isOpen, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/90 md:backdrop-blur-md">
            <div className="bg-[#1e2235] w-full h-full md:h-initial md:max-w-4xl md:rounded-2xl border-0 md:border md:border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Search className={`w-5 h-5 text-${themeColor}-400`} />
                            {title}
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">Seleccione un elemento para agregar a la lista</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="p-6 border-b border-white/5 bg-[#1a1d29] shrink-0">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full bg-[#0f111a] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none transition-all text-lg`}
                            placeholder={placeholder}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0f111a]/50 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <Loader2 className={`w-8 h-8 animate-spin mb-3 text-${themeColor}-400`} />
                            <p>Buscando artículos...</p>
                        </div>
                    ) : articles.length > 0 ? (
                        articles.map((article) => (
                            <div
                                key={article.codigo_articulo}
                                onClick={() => {
                                    onSelect(article);
                                    onClose();
                                    setSearchTerm('');
                                }}
                                className={`group bg-[#1e2235] border border-white/5 p-4 rounded-xl hover:border-${themeColor}-500/50 hover:bg-white/5 cursor-pointer transition-all duration-200 flex items-center gap-4 shadow-sm hover:shadow-lg hover:shadow-${themeColor}-500/10`}
                            >
                                {/* Image */}
                                <div className="w-16 h-16 rounded-lg bg-black/20 shrink-0 overflow-hidden border border-white/10 flex items-center justify-center">
                                    {article.imagen_url ? (
                                        <img
                                            src={article.imagen_url}
                                            alt={article.nombre_articulo}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                        />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-gray-600" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className={`text-white font-medium group-hover:text-${themeColor}-400 transition-colors text-lg text-pretty`}>
                                                {article.nombre_articulo}
                                            </h3>
                                            <p className="text-sm text-gray-400 font-mono mt-1">
                                                Code: <span className="text-gray-300">{article.codigo_articulo}</span>
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className={`bg-${themeColor}-500/10 px-3 py-1 rounded-lg border border-${themeColor}-500/20`}>
                                                <span className={`text-2xl font-bold text-${themeColor}-400 block`}>
                                                    {article.cantidad_disponible}
                                                </span>
                                                <span className={`text-xs text-${themeColor}-300/70 font-medium uppercase`}>
                                                    {article.unidad}
                                                </span>
                                            </div>
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
                </div>

                {/* Footer Hint */}
                <div className="p-3 bg-[#1a1d29] border-t border-white/10 text-center">
                    <p className="text-xs text-gray-500">
                        Mostrando primeros 50 resultados. Refine su búsqueda para ver más.
                    </p>
                </div>
            </div>
        </div>
    );
}
