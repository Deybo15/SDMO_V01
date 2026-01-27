import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Search,
    ArrowLeft,
    User,
    Package,
    Calendar,
    Loader2,
    Info,
    HelpCircle,
    CheckCircle2,
    AlertCircle,
    SearchCode,
    Clock,
    UserCircle
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

interface ActivoDetalle {
    numero_activo: number;
    nombre_corto_activo: string;
    descripcion_activo: string;
    marca_activo: string;
    status: 'ASIGNADO' | 'BODEGA' | 'DESCONOCIDO';
    responsable: string | null;
    fecha_accion: string | null;
    boleta_id: number | null;
}

export default function ConsultaActivos() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [results, setResults] = useState<ActivoDetalle[]>([]);

    const buscarActivos = async () => {
        if (!searchTerm.trim() || searchTerm.length < 3) return;

        setLoading(true);
        try {
            // 1. Buscar activos por nombre o descripción
            const { data: activos, error: activosError } = await supabase
                .from('activos_50')
                .select('numero_activo, nombre_corto_activo, descripcion_activo, marca_activo')
                .or(`nombre_corto_activo.ilike.%${searchTerm}%,descripcion_activo.ilike.%${searchTerm}%`)
                .limit(50);

            if (activosError) throw activosError;

            if (!activos || activos.length === 0) {
                setResults([]);
                return;
            }

            const detalleResultados: ActivoDetalle[] = [];

            // 2. Para cada activo, determinar su estado actual
            for (const activo of activos) {
                // Buscar última salida (asignación)
                const { data: ultimaSalida, error: salidaError } = await supabase
                    .from('dato_salida_activo_56')
                    .select(`
                        boleta_salida_activo,
                        salida_activo_55 (
                            fecha_salida_activo,
                            usuario_de_activo,
                            colaboradores_06!salida_activo_55_usuario_de_activo_fkey (
                                colaborador
                            )
                        )
                    `)
                    .eq('numero_activo', activo.numero_activo)
                    .order('boleta_salida_activo', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (salidaError) console.error('Error buscando salida:', salidaError);

                // Buscar última entrada (devolución)
                const { data: ultimaEntrada, error: entradaError } = await supabase
                    .from('dato_entrada_activo_54')
                    .select(`
                        no_entrada_activo,
                        entrada_activo_52 (
                            fecha_entrada_activo
                        )
                    `)
                    .eq('activo', activo.numero_activo)
                    .order('no_entrada_activo', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (entradaError) console.error('Error buscando entrada:', entradaError);

                let status: 'ASIGNADO' | 'BODEGA' | 'DESCONOCIDO' = 'BODEGA';
                let responsable = null;
                let fechaAccion = null;
                let boletaId = null;

                const salidaInfo = Array.isArray(ultimaSalida?.salida_activo_55)
                    ? ultimaSalida?.salida_activo_55[0]
                    : (ultimaSalida?.salida_activo_55 as any);

                const entradaInfo = Array.isArray(ultimaEntrada?.entrada_activo_52)
                    ? ultimaEntrada?.entrada_activo_52[0]
                    : (ultimaEntrada?.entrada_activo_52 as any);

                const fechaSalida = salidaInfo?.fecha_salida_activo;
                const fechaEntrada = entradaInfo?.fecha_entrada_activo;

                if (!fechaSalida && !fechaEntrada) {
                    status = 'BODEGA'; // Nunca ha salido
                } else if (fechaSalida && !fechaEntrada) {
                    status = 'ASIGNADO';
                    responsable = salidaInfo.colaboradores_06?.[0]?.colaborador || salidaInfo.colaboradores_06?.colaborador || 'Funcionario no identificado';
                    fechaAccion = fechaSalida;
                    boletaId = ultimaSalida?.boleta_salida_activo;
                } else if (!fechaSalida && fechaEntrada) {
                    status = 'BODEGA';
                    fechaAccion = fechaEntrada;
                } else {
                    if (new Date(fechaSalida) >= new Date(fechaEntrada)) {
                        status = 'ASIGNADO';
                        responsable = salidaInfo.colaboradores_06?.[0]?.colaborador || salidaInfo.colaboradores_06?.colaborador || 'Funcionario no identificado';
                        fechaAccion = fechaSalida;
                        boletaId = ultimaSalida?.boleta_salida_activo;
                    } else {
                        status = 'BODEGA';
                        fechaAccion = fechaEntrada;
                    }
                }

                detalleResultados.push({
                    ...activo,
                    status,
                    responsable,
                    fecha_accion: fechaAccion,
                    boleta_id: boletaId
                });
            }

            setResults(detalleResultados);

        } catch (error: any) {
            console.error('Error en búsqueda:', error);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.length >= 3) {
                buscarActivos();
            } else if (searchTerm.length === 0) {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    return (
        <div className="min-h-screen bg-[#0f111a] text-white p-4 md:p-8">
            <PageHeader
                title="Consulta de Activos"
                icon={SearchCode}
                themeColor="blue"
            />

            <div className="max-w-7xl mx-auto space-y-8">
                {/* Search Bar section */}
                <div className="bg-[#1e2235]/50 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-400 group-focus-within:text-blue-300 w-6 h-6 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por descripción (mín. 3 letras)... Ej: hidrolavadora, taladro, generador"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0f111a]/80 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-gray-500 shadow-inner"
                            autoFocus
                        />
                        {loading && (
                            <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                            </div>
                        )}
                    </div>
                    {searchTerm.length > 0 && searchTerm.length < 3 && (
                        <p className="mt-3 text-sm text-gray-500 flex items-center gap-2 px-2">
                            <Info className="w-4 h-4" /> Escribe al menos 3 caracteres para buscar
                        </p>
                    )}
                </div>

                {/* Results Section */}
                <div className="space-y-6">
                    {results.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6">
                            {results.map((activo) => (
                                <div
                                    key={activo.numero_activo}
                                    className="bg-[#1e2235] border border-white/10 rounded-3xl overflow-hidden shadow-xl hover:border-white/20 transition-all group"
                                >
                                    <div className="flex flex-col md:flex-row">
                                        {/* Status Sidebar */}
                                        <div className={`md:w-3 flex-shrink-0 ${activo.status === 'ASIGNADO' ? 'bg-orange-500' : 'bg-emerald-500'
                                            }`} />

                                        <div className="flex-1 p-6 md:p-8">
                                            <div className="flex flex-col lg:flex-row justify-between gap-6">
                                                {/* Asset Info */}
                                                <div className="flex-1 space-y-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-2xl ${activo.status === 'ASIGNADO' ? 'bg-orange-500/10 text-orange-400' : 'bg-emerald-500/10 text-emerald-400'
                                                            }`}>
                                                            <Package className="w-8 h-8" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs font-bold bg-white/5 border border-white/10 px-2 py-1 rounded text-blue-300 font-mono">
                                                                    ID: #{activo.numero_activo}
                                                                </span>
                                                                {activo.marca_activo && (
                                                                    <span className="text-xs font-bold bg-white/5 border border-white/10 px-2 py-1 rounded text-gray-400">
                                                                        {activo.marca_activo}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h2 className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors tracking-tight">
                                                                {activo.nombre_corto_activo}
                                                            </h2>
                                                        </div>
                                                    </div>

                                                    <p className="text-gray-400 text-base leading-relaxed pl-16 line-clamp-2 md:line-clamp-none">
                                                        {activo.descripcion_activo || 'Sin descripción adicional'}
                                                    </p>
                                                </div>

                                                {/* Responsibility Info */}
                                                <div className="lg:w-96 flex-shrink-0">
                                                    <div className={`h-full rounded-2xl p-6 flex flex-col justify-center gap-4 border ${activo.status === 'ASIGNADO'
                                                        ? 'bg-orange-500/10 border-orange-500/20'
                                                        : 'bg-emerald-500/10 border-emerald-500/20'
                                                        }`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                {activo.status === 'ASIGNADO' ? (
                                                                    <AlertCircle className="w-5 h-5 text-orange-400" />
                                                                ) : (
                                                                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                                                )}
                                                                <span className={`text-sm font-black tracking-widest uppercase ${activo.status === 'ASIGNADO' ? 'text-orange-400' : 'text-emerald-400'
                                                                    }`}>
                                                                    {activo.status}
                                                                </span>
                                                            </div>
                                                            {activo.fecha_accion && (
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                                                    <Clock className="w-3 h-3" />
                                                                    {new Date(activo.fecha_accion).toLocaleDateString()}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {activo.status === 'ASIGNADO' ? (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                                                                        <UserCircle className="w-7 h-7 text-orange-400" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-xs text-orange-400/60 font-medium uppercase tracking-tight mb-0.5">Responsable Actual</div>
                                                                        <div className="text-lg font-bold text-white truncate leading-tight">
                                                                            {activo.responsable}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {activo.boleta_id && (
                                                                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-black/20 p-2 rounded-lg border border-white/5">
                                                                        <span className="font-bold">Boleta de Salida:</span>
                                                                        <span className="font-mono text-gray-400">#{activo.boleta_id}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center py-2 gap-2">
                                                                <Package className="w-10 h-10 text-emerald-400/40" />
                                                                <p className="text-emerald-400/80 font-bold text-lg">Disponible en Bodega</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : searchTerm.length >= 3 && !loading ? (
                        <div className="py-20 text-center animate-in fade-in zoom-in duration-300">
                            <div className="inline-flex items-center justify-center w-24 h-24 bg-[#1e2235] rounded-full mb-6 border border-white/10 shadow-xl">
                                <HelpCircle className="w-12 h-12 text-gray-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">No se encontraron activos</h3>
                            <p className="text-gray-500 max-w-sm mx-auto">
                                Intenta buscando con otras palabras clave comunes como "hidro", "bomba" o el número de activo directo.
                            </p>
                        </div>
                    ) : searchTerm.length === 0 ? (
                        <div className="py-20 text-center opacity-50">
                            <Search className="w-16 h-16 text-gray-700 mx-auto mb-6" />
                            <h3 className="text-xl font-medium text-gray-600">Comienza a escribir para buscar...</h3>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
