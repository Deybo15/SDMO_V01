import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Monitor, Search } from 'lucide-react';
import GenericRequestModule from '../components/GenericRequestModule';
import EquipoSearchModal from '../components/EquipoSearchModal';

interface Equipo {
    numero_activo: number;
    placa: string;
    descripcion_equipo: string;
}

export default function EquiposActivos() {
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [selectedEquipoValue, setSelectedEquipoValue] = useState('');
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

    useEffect(() => {
        const loadEquipos = async () => {
            const { data } = await supabase
                .from('equipo_automotor')
                .select('numero_activo, placa, descripcion_equipo');

            if (data) {
                setEquipos(data);
            }
        };
        loadEquipos();
    }, []);

    // Helper to get display text for selected equipo
    const getSelectedEquipoText = () => {
        if (!selectedEquipoValue) return '-- Seleccione un activo --';
        const equipo = equipos.find(e => e.numero_activo.toString() === selectedEquipoValue);
        return equipo
            ? `${equipo.numero_activo} - ${equipo.placa} - ${equipo.descripcion_equipo}`
            : '-- Seleccione un activo --';
    };

    return (
        <GenericRequestModule
            title="Equipos y Activos"
            subtitle="Solicitud de Equipos"
            description="Seleccione el activo o equipo requerido"
            icon={Monitor}
            colorTheme="blue"
            searchKeywords={['equipo', 'activo']}
            onValidateAndGetExtraData={() => {
                if (!selectedEquipoValue) {
                    return 'Por favor seleccione un activo.';
                }
                return { equipo_automotor: parseInt(selectedEquipoValue) };
            }}
        >
            {({ profesionales, fechaSolicitud, selectedProfesional, setSelectedProfesional, loading }) => (
                loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Activo del Equipo (Searchable) */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">
                                    Activo del Equipo <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <div
                                        className={`w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-slate-100 ${!selectedEquipoValue ? 'text-slate-400' : ''}`}
                                    >
                                        {getSelectedEquipoText()}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsSearchModalOpen(true)}
                                        className="absolute right-0 top-0 h-full w-12 flex items-center justify-center bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 border-l border-slate-700 rounded-r-xl transition-colors"
                                    >
                                        <Search className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Profesional Responsable */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">
                                    Profesional Responsable <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={selectedProfesional}
                                    onChange={(e) => setSelectedProfesional(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
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

                        {/* Search Modal */}
                        <EquipoSearchModal
                            isOpen={isSearchModalOpen}
                            onClose={() => setIsSearchModalOpen(false)}
                            equipos={equipos}
                            onSelect={(equipo) => setSelectedEquipoValue(equipo.numero_activo.toString())}
                        />
                    </>
                )
            )}
        </GenericRequestModule>
    );
}
