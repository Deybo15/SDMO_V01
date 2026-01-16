import { useState, useEffect } from 'react';
import {
    Sparkles,
    Save,
    User,
    Search,
    X,
    Loader2,
    Image as ImageIcon
} from 'lucide-react';

// Custom Architecture
import { useTransactionManager } from '../hooks/useTransactionManager';
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import { Articulo } from '../types/inventory';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import { supabase } from '../lib/supabase';

export default function LimpiezaAseo() {
    const {
        loading,
        feedback,
        items,
        colaboradores,
        addEmptyRow,
        updateRow,
        updateRowWithArticle,
        removeRow,
        autorizaId,
        processTransaction,
        showAlert
    } = useTransactionManager({
        tipoSalidaId: 'LIM',
        defaultDescription: 'Solicitud de Limpieza y Aseo',
        onSuccess: () => {
            setRetira('');
            setComentarios('');
        }
    });

    useEffect(() => {
        if (autorizaId) {
            setAutoriza(autorizaId);
        }
    }, [autorizaId]);

    // 2. Local State
    const [showSearch, setShowSearch] = useState(false);
    const [currentRowIndex, setCurrentRowIndex] = useState<number>(-1);
    const [searchTerm, setSearchTerm] = useState('');
    const [articles, setArticles] = useState<Articulo[]>([]);
    const [loadingArticles, setLoadingArticles] = useState(false);

    // Form State
    const [autoriza, setAutoriza] = useState('');
    const [retira, setRetira] = useState('');
    const [comentarios, setComentarios] = useState('');

    // Modals
    const [showColaboradorModal, setShowColaboradorModal] = useState(false);
    const [colaboradorField, setColaboradorField] = useState<'autoriza' | 'retira'>('autoriza');

    // Theme
    const colorTheme = 'teal';

    // Handlers
    const handleSelectArticle = (index: number, article: Articulo) => {
        updateRowWithArticle(index, article);
    };

    const handleOpenSearch = (index: number) => {
        setCurrentRowIndex(index);
        setShowSearch(true);
        setSearchTerm('');
    };

    // Article Search Effect (v2 with server-side filtering)
    useEffect(() => {
        if (showSearch) {
            const fetchArticles = async () => {
                setLoadingArticles(true);
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
                            precio_unitario: a.precio_unitario || 0,
                            marca: 'Genérico'
                        })));
                    } else {
                        setArticles([]);
                    }
                } catch (err) {
                    console.error('Error fetching articles:', err);
                    setArticles([]);
                } finally {
                    setLoadingArticles(false);
                }
            };

            const timer = setTimeout(fetchArticles, 300);
            return () => clearTimeout(timer);
        }
    }, [showSearch, searchTerm]);

    const handleProcess = (e: React.FormEvent) => {
        e.preventDefault();
        processTransaction({
            autoriza,
            retira,
            comentarios
        });
    };

    return (
        <div className="min-h-screen bg-[#0f111a] font-['Inter']">
            <PageHeader
                title="Artículos de Limpieza y Aseo"
                icon={Sparkles}
                themeColor={colorTheme}
                gradientFrom="from-teal-900"
                gradientTo="to-slate-900"
            />

            <div className="max-w-7xl mx-auto p-6">
                {/* Feedback Toast */}
                {feedback && (
                    <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md border animate-fade-in-down flex items-center gap-3 ${feedback.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                        feedback.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                            'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                        }`}>
                        {feedback.message}
                    </div>
                )}

                <div className="bg-[#1e2235] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <form onSubmit={handleProcess} className="p-8">
                        {/* Headers Section */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Responsable que autoriza <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative group">
                                        <div
                                            className="w-full bg-black/20 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white cursor-not-allowed flex items-center justify-between opacity-75 shadow-inner"
                                            title="El responsable se asigna automáticamente según su usuario"
                                        >
                                            <span className={autoriza ? 'text-teal-400 font-bold' : 'text-gray-500 italic'}>
                                                {autoriza ? colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.alias || colaboradores.todos.find((c: any) => c.identificacion === autoriza)?.colaborador : 'Usuario no identificado'}
                                            </span>
                                            <User className={`w-4 h-4 text-teal-400/50 ml-2`} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Persona que retira <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative group">
                                        <div
                                            onClick={() => {
                                                setColaboradorField('retira');
                                                setShowColaboradorModal(true);
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white cursor-pointer hover:bg-white/10 transition-colors flex items-center justify-between shadow-inner"
                                        >
                                            <span className={retira ? 'text-white' : 'text-gray-500 italic'}>
                                                {retira ? colaboradores.todos.find((c: any) => c.identificacion === retira)?.alias || colaboradores.todos.find((c: any) => c.identificacion === retira)?.colaborador : '-- Seleccione --'}
                                            </span>
                                            <User className={`w-4 h-4 text-teal-400 ml-2`} />
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Comentarios
                                    </label>
                                    <textarea
                                        value={comentarios}
                                        onChange={(e) => setComentarios(e.target.value)}
                                        className="w-full bg-[#151921] border border-white/10 rounded-lg p-3 text-white focus:border-teal-500 outline-none min-h-[100px] resize-none"
                                        placeholder="Detalles adicionales..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                            <TransactionTable
                                items={items}
                                onUpdateRow={updateRow}
                                onRemoveRow={removeRow}
                                onOpenSearch={handleOpenSearch}
                                onAddRow={addEmptyRow}
                                onWarning={(msg) => showAlert(msg, 'warning')}
                                themeColor={colorTheme}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`px-8 py-3 bg-gradient-to-r from-teal-600 to-teal-400 text-white font-bold rounded-xl hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20`}
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Procesar Solicitud
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Colaborador Modal */}
            <ColaboradorSearchModal
                isOpen={showColaboradorModal}
                onClose={() => setShowColaboradorModal(false)}
                onSelect={(c) => {
                    if (colaboradorField === 'retira') {
                        setRetira(c.identificacion);
                    }
                    setShowColaboradorModal(false);
                }}
                colaboradores={colaboradorField === 'autoriza'
                    ? colaboradores.autorizados
                    : colaboradores.todos.filter((c: any) => c.identificacion !== autoriza)
                }
            />
            {/* Article Search Modal */}
            {showSearch && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-[#1e2235] w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl flex flex-col h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Search className="w-5 h-5 text-teal-500" />
                                    Buscar Artículo
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">Seleccione un artículo para agregar a la lista</p>
                            </div>
                            <button
                                onClick={() => setShowSearch(false)}
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
                                    className="w-full bg-[#0f111a] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all text-lg"
                                    placeholder="Buscar por código, nombre..."
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Results List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0f111a]/50 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {loadingArticles ? (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                    <Loader2 className="w-8 h-8 animate-spin mb-3 text-teal-400" />
                                    <p>Buscando artículos...</p>
                                </div>
                            ) : articles.length > 0 ? (
                                articles.map((article) => (
                                    <div
                                        key={article.codigo_articulo}
                                        onClick={() => {
                                            handleSelectArticle(currentRowIndex, article);
                                            setShowSearch(false);
                                            setSearchTerm('');
                                        }}
                                        className="group bg-[#1e2235] border border-white/5 p-4 rounded-xl hover:border-teal-500/50 hover:bg-white/5 cursor-pointer transition-all duration-200 flex items-center gap-4 shadow-sm hover:shadow-lg hover:shadow-teal-500/10"
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
                                                    <h3 className="text-white font-medium group-hover:text-teal-400 transition-colors text-lg text-pretty">
                                                        {article.nombre_articulo}
                                                    </h3>
                                                    <p className="text-sm text-gray-400 font-mono mt-1">
                                                        Code: <span className="text-gray-300">{article.codigo_articulo}</span>
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="bg-teal-500/10 px-3 py-1 rounded-lg border border-teal-500/20">
                                                        <span className="text-2xl font-bold text-teal-400 block">
                                                            {article.cantidad_disponible}
                                                        </span>
                                                        <span className="text-xs text-teal-300/70 font-medium uppercase">
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
                                    <h3 className="text-gray-300 font-medium mb-1">No se encontraron artículos</h3>
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
            )}
        </div>
    );
}
