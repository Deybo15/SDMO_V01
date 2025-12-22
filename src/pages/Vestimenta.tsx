import { useState, useEffect } from 'react';
import {
    Shirt,
    Save,
    MessageSquare,
    User,
    Loader2,
    Image as ImageIcon
} from 'lucide-react';

// Custom Architecture
import { useTransactionManager } from '../hooks/useTransactionManager';
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import { Colaborador, Articulo } from '../types/inventory';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import { supabase } from '../lib/supabase';

export default function Vestimenta() {
    // 1. Hook Integration
    const {
        loading,
        feedback,
        items,
        colaboradores,
        addEmptyRow,
        updateRow,
        updateRowWithArticle,
        removeRow,
        processTransaction,
        showAlert
    } = useTransactionManager({
        tipoSalidaId: 'vestimenta',
        defaultDescription: 'Solicitud de Vestimenta',
        onSuccessRoute: '/activos/vestimenta'
    });

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
    const colorTheme = 'indigo';
    const fechaActual = new Date().toLocaleDateString('es-CR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Handlers
    const handleOpenSearch = (index: number) => {
        setCurrentRowIndex(index);
        setShowSearch(true);
        setSearchTerm('');
    };

    const handleProcess = (e: React.FormEvent) => {
        e.preventDefault();
        processTransaction({
            autoriza,
            retira,
            comentarios
        });
    };

    // Article Search Effect (Server-side filtering)
    useEffect(() => {
        if (showSearch) {
            const fetchArticles = async () => {
                setLoadingArticles(true);
                try {
                    // Start building the query
                    let query = supabase
                        .from('inventario_actual')
                        .select('codigo_articulo, nombre_articulo, cantidad_disponible, unidad, imagen_url')
                        .gt('cantidad_disponible', 0)
                        .limit(50);

                    // Apply filters if search term exists
                    if (searchTerm) {
                        query = query.or(`nombre_articulo.ilike.%${searchTerm}%,codigo_articulo.ilike.%${searchTerm}%`);
                    }

                    const { data, error } = await query;

                    if (error) throw error;
                    setArticles(data || []);
                } catch (error) {
                    console.error('Error fetching articles:', error);
                    setArticles([]);
                } finally {
                    setLoadingArticles(false);
                }
            };

            const timer = setTimeout(fetchArticles, 300);
            return () => clearTimeout(timer);
        }
    }, [showSearch, searchTerm]);

    return (
        <div className="min-h-screen bg-[#0f111a] font-['Inter']">
            <PageHeader
                title="Vestimenta e Indumentaria"
                icon={Shirt}
                themeColor={colorTheme}
                gradientFrom="from-indigo-900"
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

                <div className="bg-[#1e2235] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                    <form onSubmit={handleProcess} className="p-8">
                        {/* Headers Section */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Responsable que autoriza <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <div
                                            onClick={() => {
                                                setColaboradorField('autoriza');
                                                setShowColaboradorModal(true);
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white cursor-pointer hover:bg-white/10 transition-colors flex items-center justify-between"
                                        >
                                            <span className={autoriza ? 'text-white' : 'text-gray-500'}>
                                                {autoriza ? colaboradores.autorizados.find(c => c.identificacion === autoriza)?.alias || colaboradores.autorizados.find(c => c.identificacion === autoriza)?.colaborador : '-- Seleccione --'}
                                            </span>
                                            <User className={`w-4 h-4 text-${colorTheme}-400 ml-2`} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Persona que retira <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <div
                                            onClick={() => {
                                                setColaboradorField('retira');
                                                setShowColaboradorModal(true);
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white cursor-pointer hover:bg-white/10 transition-colors flex items-center justify-between"
                                        >
                                            <span className={retira ? 'text-white' : 'text-gray-500'}>
                                                {retira ? colaboradores.retirantes.find(c => c.identificacion === retira)?.alias || colaboradores.retirantes.find(c => c.identificacion === retira)?.colaborador : '-- Seleccione --'}
                                            </span>
                                            <User className={`w-4 h-4 text-${colorTheme}-400 ml-2`} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Comentarios</label>
                                <textarea
                                    value={comentarios}
                                    onChange={(e) => setComentarios(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none min-h-[100px]"
                                    placeholder="Detalles adicionales..."
                                />
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
                                className={`px-8 py-3 bg-gradient-to-r from-${colorTheme}-600 to-${colorTheme}-400 text-white font-bold rounded-xl hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-${colorTheme}-500/20`}
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
                    if (colaboradorField === 'autoriza') setAutoriza(c.identificacion);
                    else setRetira(c.identificacion);
                    setShowColaboradorModal(false);
                }}
                colaboradores={colaboradorField === 'autoriza' ? colaboradores.autorizados : colaboradores.retirantes}
            />

            {/* Article Search Modal */}
            {showSearch && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1e2235] w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">Buscar Artículo</h2>
                                <p className="text-gray-400 text-sm">Seleccione un artículo para agregar a la lista</p>
                            </div>
                            <button
                                onClick={() => setShowSearch(false)}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <div className="i-lucide-x w-6 h-6" />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="p-6 border-b border-white/10 bg-[#1e2235]">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar por código, nombre..."
                                    className="w-full bg-[#151921] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-lg"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Results */}
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {loadingArticles ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                                    <p>Buscando artículos...</p>
                                </div>
                            ) : articles.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3">
                                    {articles.map((article) => (
                                        <button
                                            key={article.codigo_articulo}
                                            onClick={() => {
                                                updateRowWithArticle(currentRowIndex, article);
                                                setShowSearch(false);
                                            }}
                                            className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/50 rounded-xl transition-all group text-left"
                                        >
                                            <div className="w-16 h-16 bg-[#151921] rounded-lg flex items-center justify-center border border-white/10 overflow-hidden shrink-0">
                                                {article.imagen_url ? (
                                                    <img
                                                        src={article.imagen_url}
                                                        alt={article.nombre_articulo}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon className="w-8 h-8 text-gray-600 group-hover:text-indigo-400 transition-colors" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className="text-white font-medium truncate group-hover:text-indigo-400 transition-colors text-lg">
                                                            {article.nombre_articulo}
                                                        </h3>
                                                        <p className="text-sm text-gray-400 font-mono mt-1">
                                                            {article.codigo_articulo}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-lg font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg">
                                                            {article.cantidad_disponible}
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-1 text-center">
                                                            {article.unidad || 'UND'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 text-gray-500">
                                    {searchTerm ? (
                                        <>
                                            <p className="text-lg mb-2">No se encontraron resultados</p>
                                            <p className="text-sm">Intenta con otros términos de búsqueda</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-lg mb-2">Empieza a escribir para buscar</p>
                                            <p className="text-sm">Puedes buscar por nombre o código del artículo</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
