import { Shirt } from 'lucide-react';
import GenericRequestModule from '../components/GenericRequestModule';

export default function Vestimenta() {
    return (
        <GenericRequestModule
            title="Vestimenta e Indumentaria"
            subtitle="Solicitud de Vestimenta"
            description="Detalle las prendas o indumentaria requerida"
            icon={Shirt}
            colorTheme="indigo"
            searchKeywords={['vestimenta', 'indumentaria', 'ropa']}
            onValidateAndGetExtraData={() => ({})}
        >
            {({ profesionales, fechaSolicitud, selectedProfesional, setSelectedProfesional, loading }) => (
                loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Profesional Responsable */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">
                                    Profesional Responsable <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={selectedProfesional}
                                    onChange={(e) => setSelectedProfesional(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
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
                    </div>
                )
            )}
        </GenericRequestModule>
    );
}
