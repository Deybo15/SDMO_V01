import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Search, CheckCircle } from 'lucide-react';
import GenericRequestModule from '../components/GenericRequestModule';

interface Dependencia {
    id_dependencia: number;
    dependencia_municipal: string;
}

export default function Prestamo() {
    const [dependencias, setDependencias] = useState<Dependencia[]>([]);
    const [selectedDependencia, setSelectedDependencia] = useState('');

    // Search Modal State
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredDependencias, setFilteredDependencias] = useState<Dependencia[]>([]);

    useEffect(() => {
        const loadDependencias = async () => {
            const { data } = await supabase
                .from('dependencias_municipales')
                .select('id_dependencia, dependencia_municipal');

            if (data) {
                setDependencias(data);
                setFilteredDependencias(data);
            }
        };
        loadDependencias();
    }, []);

    const handleSearchDependencia = (term: string) => {
        setSearchTerm(term);
        const filtered = dependencias.filter(dep =>
            dep.dependencia_municipal.toLowerCase().includes(term.toLowerCase())
        );
        setFilteredDependencias(filtered);
    };

    const handleSelectDependencia = (dep: Dependencia) => {
        setSelectedDependencia(dep.id_dependencia.toString());
        setShowSearchModal(false);
        setSearchTerm('');
        setFilteredDependencias(dependencias);
    };

    return (
        <>
            <GenericRequestModule
                title="Préstamo"
                subtitle="Solicitud de Préstamo"
                description="Registre una nueva solicitud de préstamo de materiales"
                icon={Clock}
                colorTheme="purple"
                searchKeywords={['préstamo', 'prestamo']}
                onValidateAndGetExtraData={() => {
                    if (!selectedDependencia) {
                        return 'Por favor seleccione la dependencia municipal.';
                    }
                    return { dependencia_municipal: parseInt(selectedDependencia) };
                }}
            >
                {({ profesionales, fechaSolicitud, selectedProfesional, setSelectedProfesional, loading }) => (
                    loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Dependencia Municipal */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">
                                    Dependencia Municipal <span className="text-red-400">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            value={selectedDependencia}
                                            onChange={(e) => setSelectedDependencia(e.target.value)}
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all appearance-none"
                                        >
                                            <option value="">-- Seleccione una dependencia --</option>
                                            {dependencias.map((dep) => (
                                                <option key={dep.id_dependencia} value={dep.id_dependencia}>
                                                    {dep.dependencia_municipal}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => setShowSearchModal(true)}
                                        className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/20 transition-colors"
                                        title="Buscar dependencia"
                                    >
                                        <Search className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500">Seleccione la dependencia solicitante</p>
                            </div>

                            {/* Profesional Responsable */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">
                                    Profesional Responsable <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={selectedProfesional}
                                    onChange={(e) => setSelectedProfesional(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                >
                                    <option value="">-- Seleccione un profesional --</option>
                                    {profesionales.map((prof) => (
                                        <option key={prof.identificacion} value={prof.identificacion}>
                                            {prof.alias}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Fecha de Solicitud */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">
                                    Fecha de Solicitud
                                </label>
                                <input
                                    type="text"
                                    value={fechaSolicitud}
                                    disabled
                                    className="w-full bg-slate-900/30 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    )
                )}
            </GenericRequestModule>

            {/* Search Modal */}
            {showSearchModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                            <h3 className="font-bold text-white">Buscar Dependencia</h3>
                            <button
                                onClick={() => setShowSearchModal(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <span className="text-2xl">&times;</span>
                            </button>
                        </div>
                        <div className="p-4">
                            <input
                                type="text"
                                placeholder="Escriba para buscar..."
                                value={searchTerm}
                                onChange={(e) => handleSearchDependencia(e.target.value)}
                                autoFocus
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all mb-4"
                            />
                            <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                                {filteredDependencias.length > 0 ? (
                                    filteredDependencias.map((dep) => (
                                        <button
                                            key={dep.id_dependencia}
                                            onClick={() => handleSelectDependencia(dep)}
                                            className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-700/50 text-slate-300 hover:text-white transition-colors flex items-center justify-between group"
                                        >
                                            <span>{dep.dependencia_municipal}</span>
                                            {selectedDependencia === dep.id_dependencia.toString() && (
                                                <CheckCircle className="w-4 h-4 text-purple-400" />
                                            )}
                                        </button>
                                    ))
                                ) : (
                                    <p className="text-center text-slate-500 py-4">No se encontraron resultados</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
