import { useState, useEffect } from 'react';
import {
    Clock,
    Save,
    MessageSquare,
    User,
    PlusCircle,
    Search,
    X,
    Loader2,
    Building2,
    CheckCircle
} from 'lucide-react';

// Custom Architecture
import { useTransactionManager } from '../hooks/useTransactionManager';
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import { Colaborador, Articulo } from '../types/inventory';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import { supabase } from '../lib/supabase';

interface Dependencia {
    id_dependencia: number;
    dependencia_municipal: string;
}

export default function Prestamo() {
    // 1. Hook Integration
    const {
        loading,
        feedback,
        items,
        colaboradores,
        addItem,
        updateItemQuantity,
        removeItem,
        processTransaction
    } = useTransactionManager({
        tipoSalidaId: 'prestamo',
        defaultDescription: 'Solicitud de Préstamo',
        onSuccessRoute: '/activos/prestamo'
    });

    // 2. Local State
    const [header, setHeader] = useState({
        autoriza: '',
        retira: '',
        comentarios: '',
        dependencia: ''
    });

    // Dependencias Logic
    const [dependencias, setDependencias] = useState<Dependencia[]>([]);
    const [showDependenciaModal, setShowDependenciaModal] = useState(false);
    const [depSearchTerm, setDepSearchTerm] = useState('');

    useEffect(() => {
        const loadDependencias = async () => {
            const { data } = await supabase
                .from('dependencias_municipales')
                .select('id_dependencia, dependencia_municipal');
            if (data) setDependencias(data);
        };
        loadDependencias();
    }, []);

    const filteredDependencias = dependencias.filter(d =>
        d.dependencia_municipal.toLowerCase().includes(depSearchTerm.toLowerCase())
    );

    // Modals state
    const [showBusquedaModal, setShowBusquedaModal] = useState(false);
    const [busquedaTipo, setBusquedaTipo] = useState<'autoriza' | 'retira'>('autoriza');
    const [showComentariosModal, setShowComentariosModal] = useState(false);
    const [showArticulosModal, setShowArticulosModal] = useState(false);

    // Handlers
    const handleOpenBusqueda = (tipo: 'autoriza' | 'retira') => {
        setBusquedaTipo(tipo);
        setShowBusquedaModal(true);
    };

    const handleSelectColaborador = (c: Colaborador) => {
        setHeader(prev => ({ ...prev, [busquedaTipo]: c.identificacion }));
        setShowBusquedaModal(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!header.dependencia) {
            // Need feedback
            alert('Seleccione una dependencia municipal');
            return;
        }

        processTransaction({
            ...header,
            destino: header.dependencia // Map dependency to destino
        });
    };

    // Article Search Logic (Inventory)
    const [articles, setArticles] = useState<Articulo[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (showArticulosModal) {
            const fetchArticles = async () => {
                let query = supabase
                    .from('inventario_actual')
                    .select('codigo_articulo, nombre_articulo, cantidad_disponible, unidad, imagen_url, precio_unitario')
                    .gt('cantidad_disponible', 0)
                    .limit(50);

                if (searchTerm) {
                    query = query.or(`nombre_articulo.ilike.%${searchTerm}%,codigo_articulo.ilike.%${searchTerm}%`);
                }

                const { data } = await query;

                if (data) {
                    setArticles(data.map(a => ({
                        codigo_articulo: a.codigo_articulo,
                        nombre_articulo: a.nombre_articulo,
                        cantidad_disponible: a.cantidad_disponible || 0,
                        unidad: a.unidad || 'UND',
                        imagen_url: a.imagen_url,
                        precio_unitario: a.precio_unitario || 0
                    })));
                }
            };

            const timer = setTimeout(fetchArticles, 300);
            return () => clearTimeout(timer);
        }
    }, [showArticulosModal, searchTerm]);

    return (
        <div className="min-h-screen bg-[#0f111a] font-['Inter']">
            <PageHeader
                title="Préstamo"
                icon={Clock}
                themeColor="purple"
                gradientFrom="from-purple-900"
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
                    <form onSubmit={handleSubmit} className="p-8">
                        {/* Headers Section */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-3 text-purple-400">
                                <User className="w-5 h-5" />
                                Información de Responsables
                            </h3>

                            {/* Dependencia Selector */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Dependencia Municipal *</label>
                                <div className="relative group">
                                    <div
                                        onClick={() => setShowDependenciaModal(true)}
                                        className={`w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 cursor-pointer transition-all ${!header.dependencia ? 'text-gray-500' : 'text-white'}`}
                                    >
                                        {header.dependencia ? (
                                            (() => {
                                                const d = dependencias.find(dep => dep.id_dependencia.toString() === header.dependencia);
                                                return d ? d.dependencia_municipal : header.dependencia;
                                            })()
                                        ) : '-- Seleccione una dependencia --'}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowDependenciaModal(true)}
                                        className="absolute right-0 top-0 bottom-0 px-4 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-r-lg border-l border-white/10"
                                    >
                                        <Search className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Profesional Responsable *</label>
                                    <div className="relative">
                                        <select
                                            value={header.autoriza}
                                            onChange={(e) => setHeader({ ...header, autoriza: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white focus:border-purple-400 focus:outline-none appearance-none"
                                            required
                                        >
                                            <option value="" className="bg-gray-900">-- Seleccione --</option>
                                            {colaboradores.autorizados.map(c => (
                                                <option key={c.identificacion} value={c.identificacion} className="bg-gray-900">{c.alias || c.colaborador}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenBusqueda('autoriza')}
                                            className="absolute right-0 top-0 bottom-0 px-4 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-r-lg border-l border-white/10"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Entregado a (Quien retira) *</label>
                                    <div className="relative">
                                        <select
                                            value={header.retira}
                                            onChange={(e) => setHeader({ ...header, retira: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white focus:border-purple-400 focus:outline-none appearance-none"
                                            required
                                        >
                                            <option value="" className="bg-gray-900">-- Seleccione --</option>
                                            {colaboradores.retirantes.map(c => (
                                                <option key={c.identificacion} value={c.identificacion} className="bg-gray-900">{c.alias || c.colaborador}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenBusqueda('retira')}
                                            className="absolute right-0 top-0 bottom-0 px-4 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-r-lg border-l border-white/10"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowComentariosModal(true)}
                                className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
                            >
                                <MessageSquare className="w-4 h-4" />
                                {header.comentarios ? 'Editar Comentarios' : 'Agregar Comentarios'}
                            </button>
                        </div>

                        {/* Items Section */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-3">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-purple-400">
                                    <Clock className="w-5 h-5" />
                                    Materiales a Prestar
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowArticulosModal(true)}
                                    className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    Agregar Material
                                </button>
                            </div>

                            <TransactionTable
                                items={items}
                                onUpdateQuantity={updateItemQuantity}
                                onRemoveItem={removeItem}
                                onOpenSearch={() => setShowArticulosModal(true)}
                                themeColor="purple"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Procesar Solicitud
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Modals */}
            <ColaboradorSearchModal
                isOpen={showBusquedaModal}
                onClose={() => setShowBusquedaModal(false)}
                onSelect={handleSelectColaborador}
                colaboradores={busquedaTipo === 'autoriza' ? colaboradores.autorizados : colaboradores.retirantes}
            />

            {/* Dependencia Modal */}
            {showDependenciaModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#1e2235] w-full max-w-lg rounded-xl border border-white/10 flex flex-col max-h-[85vh] animate-fadeInUp">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-purple-900/20 rounded-t-xl">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-purple-400" />
                                Buscar Dependencia
                            </h3>
                            <button onClick={() => setShowDependenciaModal(false)}><X className="text-gray-400 hover:text-white" /></button>
                        </div>
                        <div className="p-4">
                            <input
                                value={depSearchTerm}
                                onChange={e => setDepSearchTerm(e.target.value)}
                                className="w-full bg-[#1a1d29] border border-gray-700 rounded-lg p-2 text-white"
                                placeholder="Buscar dependencia..."
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {filteredDependencias.map(d => (
                                <div
                                    key={d.id_dependencia}
                                    onClick={() => {
                                        setHeader(prev => ({ ...prev, dependencia: d.id_dependencia.toString() }));
                                        setShowDependenciaModal(false);
                                    }}
                                    className="p-3 bg-white/5 hover:bg-white/10 cursor-pointer rounded-lg text-white flex justify-between items-center group"
                                >
                                    <span>{d.dependencia_municipal}</span>
                                    {header.dependencia === d.id_dependencia.toString() && <CheckCircle className="w-4 h-4 text-purple-400" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Comments Modal */}
            {showComentariosModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#1e2235] w-full max-w-lg rounded-xl border border-white/10 p-6 animate-fadeInUp">
                        <h3 className="text-lg font-bold text-white mb-4">Comentarios</h3>
                        <textarea
                            value={header.comentarios}
                            onChange={(e) => setHeader({ ...header, comentarios: e.target.value })}
                            className="w-full bg-[#1a1d29] border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none min-h-[100px]"
                            placeholder="Ingrese observaciones..."
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setShowComentariosModal(false)} className="px-4 py-2 text-white hover:bg-white/10 rounded-lg">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Article Search Modal (Simple Inline) */}
            {showArticulosModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#1e2235] w-full max-w-2xl rounded-xl border border-white/10 flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b border-white/10 flex justify-between">
                            <h3 className="text-white font-bold">Buscar Material</h3>
                            <button onClick={() => setShowArticulosModal(false)}><X className="text-white" /></button>
                        </div>
                        <div className="p-4"><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-[#1a1d29] p-2 text-white rounded border border-gray-700" placeholder="Buscar por nombre o código..." autoFocus /></div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {articles.map(a => (
                                <div key={a.codigo_articulo} onClick={() => { addItem(a); setShowArticulosModal(false); }} className="p-3 bg-white/5 hover:bg-white/10 cursor-pointer rounded text-white flex justify-between items-center group">
                                    <div className="flex items-center gap-3">
                                        {a.imagen_url ? (
                                            <img src={a.imagen_url} alt={a.nombre_articulo} className="w-12 h-12 object-cover rounded bg-black/20" />
                                        ) : (
                                            <div className="w-12 h-12 rounded bg-white/5 flex items-center justify-center text-gray-500">
                                                <ImageIcon className="w-6 h-6" />
                                            </div>
                                        )}
                                        <span>{a.nombre_articulo}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-purple-400 font-bold">{a.cantidad_disponible} UND</div>
                                        <div className="text-gray-400 text-xs">{a.codigo_articulo}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
