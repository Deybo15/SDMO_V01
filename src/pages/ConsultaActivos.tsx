import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Search,
    Package,
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
import { formatDateOnly } from '../lib/utils';

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
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [results, setResults] = useState<ActivoDetalle[]>([]);

    const buscarActivos = useCallback(async () => {
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
    }, [searchTerm]);

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
    }, [buscarActivos, searchTerm]);

    return (
        <div className="min-h-screen bg-black text-white">
            <PageHeader
                title="Consulta de Activos"
                icon={SearchCode}
                themeColor="neutral"
                subtitle="Localice activos y consulte su disponibilidad o asignación actual."
                backRoute="/activos"
            />

            <div className="max-w-[1400px] mx-auto px-4 md:px-8 pb-12 space-y-6">
                {/* Search Bar section */}
                <section className="bg-[#111112] border border-[#3f3f46] p-5 md:p-6 rounded-xl">
                    <div className="mb-5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#71717a]">Búsqueda de inventario</p>
                        <h2 className="mt-2 text-lg font-bold text-white">¿Qué activo desea consultar?</h2>
                        <p className="mt-1 text-sm text-[#a1a1aa]">Busque por nombre o por palabras incluidas en la descripción.</p>
                    </div>
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#71717a] group-focus-within:text-white w-5 h-5 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por descripción (mín. 3 letras)... Ej: hidrolavadora, taladro, generador"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg py-4 pl-14 pr-14 text-base text-white focus:outline-none focus:border-[#a1a1aa] transition-all placeholder:text-[#71717a]"
                            autoFocus
                        />
                        {loading && (
                            <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-5 h-5 text-[#d4d4d8] animate-spin" />
                            </div>
                        )}
                    </div>
                    {searchTerm.length > 0 && searchTerm.length < 3 && (
                        <p className="mt-3 text-sm text-[#71717a] flex items-center gap-2 px-2">
                            <Info className="w-4 h-4" /> Escribe al menos 3 caracteres para buscar
                        </p>
                    )}
                </section>

                {/* Results Section */}
                <div className="space-y-6">
                    {results.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6">
                            {results.map((activo) => (
                                <article
                                    key={activo.numero_activo}
                                    className="bg-[#111112] border border-[#3f3f46] rounded-xl overflow-hidden hover:border-[#71717a] transition-colors"
                                >
                                    <div className="flex flex-col md:flex-row">
                                        <div className="h-px md:h-auto md:w-px flex-shrink-0 bg-[#52525b]" />

                                        <div className="flex-1 p-6 md:p-8">
                                            <div className="flex flex-col lg:flex-row justify-between gap-6">
                                                {/* Asset Info */}
                                                <div className="flex-1 space-y-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-3 rounded-lg border border-[#3f3f46] bg-[#18181b] text-[#d4d4d8]">
                                                            <Package className="w-8 h-8" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs font-bold bg-[#27272a] border border-[#3f3f46] px-2 py-1 rounded text-[#d4d4d8] font-mono">
                                                                    ID: #{activo.numero_activo}
                                                                </span>
                                                                {activo.marca_activo && (
                                                                    <span className="text-xs font-bold bg-white/5 border border-white/10 px-2 py-1 rounded text-gray-400">
                                                                        {activo.marca_activo}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h2 className="text-xl font-bold text-white tracking-tight">
                                                                {activo.nombre_corto_activo}
                                                            </h2>
                                                        </div>
                                                    </div>

                                                    <p className="text-[#a1a1aa] text-sm leading-relaxed pl-16 line-clamp-2 md:line-clamp-none">
                                                        {activo.descripcion_activo || 'Sin descripción adicional'}
                                                    </p>
                                                </div>

                                                {/* Responsibility Info */}
                                                <div className="lg:w-96 flex-shrink-0">
                                                    <div className="h-full rounded-lg p-5 flex flex-col justify-center gap-4 border border-[#3f3f46] bg-[#18181b]">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                {activo.status === 'ASIGNADO' ? (
                                                                    <AlertCircle className="w-5 h-5 text-[#a1a1aa]" />
                                                                ) : (
                                                                    <CheckCircle2 className="w-5 h-5 text-[#a1a1aa]" />
                                                                )}
                                                                <span className="text-xs font-bold tracking-[0.16em] uppercase text-white">
                                                                    {activo.status}
                                                                </span>
                                                            </div>
                                                            {activo.fecha_accion && (
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                                                    <Clock className="w-3 h-3" />
                                                                    {formatDateOnly(activo.fecha_accion)}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {activo.status === 'ASIGNADO' ? (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 rounded-lg bg-[#111112] flex items-center justify-center border border-[#3f3f46]">
                                                                        <UserCircle className="w-7 h-7 text-[#a1a1aa]" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-[10px] text-[#71717a] font-bold uppercase tracking-[0.14em] mb-1">Responsable actual</div>
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
                                                                <Package className="w-9 h-9 text-[#71717a]" />
                                                                <p className="text-white font-bold text-base">Disponible en bodega</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : searchTerm.length >= 3 && !loading ? (
                        <div className="py-20 text-center animate-in fade-in zoom-in duration-300">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#111112] rounded-xl mb-6 border border-[#3f3f46]">
                                <HelpCircle className="w-9 h-9 text-[#52525b]" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">No se encontraron activos</h3>
                            <p className="text-gray-500 max-w-sm mx-auto">
                                Intenta buscando con otras palabras clave comunes como "hidro", "bomba" o el número de activo directo.
                            </p>
                        </div>
                    ) : searchTerm.length === 0 ? (
                        <div className="py-24 text-center">
                            <div className="w-20 h-20 bg-[#111112] border border-[#3f3f46] rounded-xl flex items-center justify-center mx-auto mb-6">
                                <Search className="w-9 h-9 text-[#52525b]" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Esperando búsqueda</h3>
                            <p className="mt-2 text-sm text-[#71717a]">Escriba al menos tres caracteres para consultar el inventario.</p>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
