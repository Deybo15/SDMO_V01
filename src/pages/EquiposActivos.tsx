import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Monitor } from 'lucide-react';
import GenericRequestModule from '../components/GenericRequestModule';

interface Equipo {
    id_equipo: number;
    descripcion_equipo: string;
}

export default function EquiposActivos() {
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [selectedEquipo, setSelectedEquipo] = useState('');

    useEffect(() => {
        const loadEquipos = async () => {
            const { data } = await supabase
                .from('equipo_automotor')
                .select('id_equipo, descripcion_equipo');

            if (data) {
                setEquipos(data);
            }
        };
        loadEquipos();
    }, []);

    return (
        <GenericRequestModule
            title="Equipos y Activos"
            subtitle="Solicitud de Equipos"
            description="Seleccione el activo o equipo requerido"
            icon={Monitor}
            colorTheme="blue"
            searchKeywords={['equipo', 'activo']}
            onValidateAndGetExtraData={() => {
                if (!selectedEquipo) {
                    return 'Por favor seleccione un activo.';
                }
                return { equipo_automotor: parseInt(selectedEquipo) };
            }}
        >
            {({ profesionales, fechaSolicitud, selectedProfesional, setSelectedProfesional, loading }) => (
                loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Activo del Equipo */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">
                                Activo del Equipo <span className="text-red-400">*</span>
                            </label>
                            <select
                                value={selectedEquipo}
                                onChange={(e) => setSelectedEquipo(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                            >
                                <option value="">-- Seleccione un activo --</option>
                                {equipos.map((eq) => (
                                    <option key={eq.id_equipo} value={eq.id_equipo}>
                                        {eq.descripcion_equipo}
                                    </option>
                                ))}
                            </select>
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
                )
            )}
        </GenericRequestModule>
    );
}
