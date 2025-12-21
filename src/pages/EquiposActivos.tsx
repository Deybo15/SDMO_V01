import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Monitor,
    Save,
    MessageSquare,
    User,
    PlusCircle,
    Search,
    X,
    Loader2
} from 'lucide-react';

// Custom Architecture
import { useTransactionManager } from '../hooks/useTransactionManager';
import { PageHeader } from '../components/ui/PageHeader';
import { TransactionTable } from '../components/ui/TransactionTable';
import { Colaborador, Articulo, Equipo } from '../types/inventory';
import ColaboradorSearchModal from '../components/ColaboradorSearchModal';
import EquipoSearchModal from '../components/EquipoSearchModal'; // specific modal
import { supabase } from '../lib/supabase';

export default function EquiposActivos() {
    const [searchParams] = useSearchParams();

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
        tipoSalidaId: 'equipos',
        defaultDescription: 'Solicitud Equipos Tecnológicos',
        onSuccessRoute: '/activos/equipos'
    });

    // 2. Local State specific to this page
    const [header, setHeader] = useState({
        autoriza: '',
        retira: '',
        comentarios: '',
        numero_solicitud: searchParams.get('numero') || ''
    });

    // Equipos State (Custom for this page)
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [selectedEquipoValue, setSelectedEquipoValue] = useState('');

    useEffect(() => {
        const fetchEquipos = async () => {
            const { data } = await supabase
                .from('equipo_automotor')
                .select('numero_activo, placa, descripcion_equipo'); // Assuming table/columns are correct
            if (data) setEquipos(data);
        };
        fetchEquipos();
    }, []);

    // Modals
    const [showBusquedaModal, setShowBusquedaModal] = useState(false);
    const [isEquipoModalOpen, setIsEquipoModalOpen] = useState(false);
    const [busquedaTipo, setBusquedaTipo] = useState<'autoriza' | 'retira'>('autoriza');
    const [showComentariosModal, setShowComentariosModal] = useState(false);

    // Article Search (Inline or Component?) 
    // For this refactor I will use an inline modal logic or reuse logic, 
    // but better to keep it consistent. Let's use a simple state for now.
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

        if (!selectedEquipoValue) {
            // We'll rely on hook feedback or simple alert? Hook doesn't handle this custom validation easily yet.
            alert('Seleccione un equipo');
            return;
        }

        processTransaction(header, async (idSalida, numeroSolicitud) => {
            // Update Solicitud with Equipo
            if (selectedEquipoValue) {
                await supabase.from('solicitud_17')
                    .update({ equipo_automotor: parseInt(selectedEquipoValue) })
                    .eq('numero_solicitud', numeroSolicitud);
            }
        });
    };

    // Article Search Logic (Simplified inline for now as we don't have a generic ArticleSearchModal verified)
    const [articles, setArticles] = useState<Articulo[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (showArticulosModal) {
            const fetchArticles = async () => {
                const { data } = await supabase
                    .from('activos_50')
                    .select('*')
                    .not('cantidad_disponible', 'eq', 0); // Basic filter

                if (data) {
                    setArticles(data.map(a => ({
                        codigo_articulo: a.numero_activo, // Mapping for this table
                        nombre_articulo: a.descripcion,
                        cantidad_disponible: 1, // Assets usually 1
                        unidad: 'UND',
                        imagen_url: null,
                        precio_unitario: 0
                    })));
                }
            };
            fetchArticles();
        }
    }, [showArticulosModal]);

    const filteredArticles = articles.filter(a =>
        a.nombre_articulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.codigo_articulo.toString().includes(searchTerm)
    );

    return (
        <div className="min-h-screen bg-[#0f111a] font-['Inter']">
            <PageHeader
                title="Equipos Tecnológicos"
                icon={Monitor}
                themeColor="blue"
                gradientFrom="from-blue-900"
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
                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-3 text-blue-400">
                                <User className="w-5 h-5" />
                                Información de Responsables
                            </h3>

                            {/* Equipo Selector */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Activo / Equipo *</label>
                                <div className="relative group">
                                    <div
                                        onClick={() => setIsEquipoModalOpen(true)}
                                        className={`w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 cursor-pointer transition-all ${!selectedEquipoValue ? 'text-gray-500' : 'text-white'}`}
                                    >
                                        {selectedEquipoValue ? (
                                            (() => {
                                                const eq = equipos.find(e => e.numero_activo.toString() === selectedEquipoValue);
                                                return eq ? `${eq.numero_activo} - ${eq.placa} - ${eq.descripcion_equipo}` : selectedEquipoValue;
                                            })()
                                        ) : '-- Seleccione un activo --'}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsEquipoModalOpen(true)}
                                        className="absolute right-0 top-0 bottom-0 px-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-r-lg border-l border-white/10"
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
                                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white focus:border-blue-400 focus:outline-none appearance-none"
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
                                            className="absolute right-0 top-0 bottom-0 px-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-r-lg border-l border-white/10"
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
                                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-12 text-white focus:border-blue-400 focus:outline-none appearance-none"
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
                                            className="absolute right-0 top-0 bottom-0 px-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-r-lg border-l border-white/10"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowComentariosModal(true)}
                                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                <MessageSquare className="w-4 h-4" />
                                {header.comentarios ? 'Editar Comentarios' : 'Agregar Comentarios'}
                            </button>
                        </div>

                        {/* Items Section */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-3">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-blue-400">
                                    <Monitor className="w-5 h-5" />
                                    Equipos a Retirar
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowArticulosModal(true)}
                                    className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-all flex items-center gap-2"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    Agregar Equipo
                                </button>
                            </div>

                            <TransactionTable
                                items={items}
                                onUpdateQuantity={updateItemQuantity}
                                onRemoveItem={removeItem}
                                onOpenSearch={() => setShowArticulosModal(true)}
                                themeColor="blue"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
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

            {/* Equipo Search Modal */}
            <EquipoSearchModal
                isOpen={isEquipoModalOpen}
                onClose={() => setIsEquipoModalOpen(false)}
                equipos={equipos}
                onSelect={(e) => {
                    setSelectedEquipoValue(e.numero_activo.toString());
                    setIsEquipoModalOpen(false);
                }}
            />

            {/* Comments Modal (Inline for now) */}
            {showComentariosModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#1e2235] w-full max-w-lg rounded-xl border border-white/10 p-6 animate-fadeInUp">
                        <h3 className="text-lg font-bold text-white mb-4">Comentarios</h3>
                        <textarea
                            value={header.comentarios}
                            onChange={(e) => setHeader({ ...header, comentarios: e.target.value })}
                            className="w-full bg-[#1a1d29] border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none min-h-[100px]"
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
                            <h3 className="text-white font-bold">Buscar Equipo</h3>
                            <button onClick={() => setShowArticulosModal(false)}><X className="text-white" /></button>
                        </div>
                        <div className="p-4"><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-[#1a1d29] p-2 text-white rounded border border-gray-700" placeholder="Buscar..." autoFocus /></div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {filteredArticles.map(a => (
                                <div key={a.codigo_articulo} onClick={() => { addItem(a); setShowArticulosModal(false); }} className="p-3 bg-white/5 hover:bg-white/10 cursor-pointer rounded text-white flex justify-between">
                                    <span>{a.nombre_articulo}</span>
                                    <span className="text-gray-400">{a.codigo_articulo}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
