import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Box,
    ClipboardList,
    FileText,
    Globe,
    LineChart
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ExternalClientStats {
    registeredRequests: number;
    activeRequests: number;
    activeRequestsWithMaterialOutput: number;
}

const modules = [
    {
        id: 'request',
        title: 'Ingresar solicitud',
        icon: FileText,
        path: '/cliente-externo/ingresar',
        description: 'Crear una nueva solicitud para clientes externos'
    },
    {
        id: 'tracking',
        title: 'Seguimiento de solicitud',
        icon: LineChart,
        path: '/cliente-externo/seguimiento',
        description: 'Consultar el estado de trámites en curso'
    },
    {
        id: 'delivery',
        title: 'Realizar salida',
        icon: Box,
        path: '/cliente-externo/realizar',
        description: 'Procesar la entrega de activos o materiales'
    }
] as const;

async function fetchExternalClientStats(): Promise<ExternalClientStats> {
    const [registeredResult, activeResult] = await Promise.all([
        supabase
            .from('solicitud_17')
            .select('numero_solicitud', { count: 'exact', head: true })
            .eq('tipo_solicitud', 'STE'),
        supabase
            .from('solicitud_17')
            .select('numero_solicitud, seguimiento_solicitud!inner(estado_actual)')
            .eq('tipo_solicitud', 'STE')
            .eq('seguimiento_solicitud.estado_actual', 'ACTIVA')
    ]);

    if (registeredResult.error) throw registeredResult.error;
    if (activeResult.error) throw activeResult.error;

    const activeIds = [...new Set((activeResult.data || []).map((request) => String(request.numero_solicitud)))];
    let activeRequestsWithMaterialOutput = 0;

    if (activeIds.length > 0) {
        const { data: deliveries, error } = await supabase
            .from('salida_articulo_08')
            .select('numero_solicitud')
            .in('numero_solicitud', activeIds);

        if (error) throw error;
        const deliveredIds = new Set((deliveries || []).map((delivery) => String(delivery.numero_solicitud)));
        activeRequestsWithMaterialOutput = activeIds.filter((id) => deliveredIds.has(id)).length;
    }

    return {
        registeredRequests: registeredResult.count || 0,
        activeRequests: activeIds.length,
        activeRequestsWithMaterialOutput
    };
}

export default function ClienteExterno() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<ExternalClientStats | null>(null);

    useEffect(() => {
        const loadStats = async () => {
            try {
                setStats(await fetchExternalClientStats());
            } catch (error) {
                console.error('Error cargando indicadores de cliente externo:', error);
                setStats({ registeredRequests: 0, activeRequests: 0, activeRequestsWithMaterialOutput: 0 });
            }
        };

        loadStats();
    }, []);

    const renderModule = (module: (typeof modules)[number]) => {
        const Icon = module.icon;
        return (
            <button
                key={module.id}
                type="button"
                onClick={() => navigate(module.path)}
                className="group flex min-h-[136px] w-full items-center gap-5 rounded-xl border border-[#3f3f46] bg-[#0d0d0e] p-5 text-left transition-colors hover:border-[#71717a] hover:bg-[#111112]"
            >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#52525b] bg-[#151517] text-[#e4e4e7]">
                    <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                    <strong className="block text-[15px] font-semibold text-white">{module.title}</strong>
                    <span className="mt-1 block text-xs leading-relaxed text-[#a1a1aa]">{module.description}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-[#a1a1aa] transition-transform group-hover:translate-x-1 group-hover:text-white" />
            </button>
        );
    };

    return (
        <div className="min-h-screen bg-black p-4 text-[#f4f4f5] selection:bg-white/20 md:px-8 md:py-6">
            <div className="w-full space-y-6 animate-fade-in-up">
                <header className="flex flex-col justify-between gap-4 border-b border-[#27272a] pb-4 md:flex-row md:items-center">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-[#71717a] bg-[#111112] p-3 text-[#e4e4e7]">
                            <Globe className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white md:text-[30px]">Cliente Externo</h1>
                            <p className="text-sm text-[#a1a1aa]">Gestión de solicitudes y entregas para clientes externos</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#71717a] bg-[#111112] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#18181b]"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Menú principal
                    </button>
                </header>

                <section className="grid grid-cols-1 rounded-xl border border-[#3f3f46] bg-[#0d0d0e] md:grid-cols-3">
                    {[
                        { label: 'Solicitudes registradas', value: stats?.registeredRequests, icon: FileText },
                        { label: 'Solicitudes activas', value: stats?.activeRequests, icon: ClipboardList },
                        { label: 'Solicitudes activas con salida de material', value: stats?.activeRequestsWithMaterialOutput, icon: Box }
                    ].map((metric, index) => (
                        <div key={metric.label} className={`flex items-center gap-4 px-5 py-4 ${index > 0 ? 'border-t border-[#3f3f46] md:border-l md:border-t-0' : ''}`}>
                            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#52525b] bg-[#151517] text-[#d4d4d8]">
                                <metric.icon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-2xl font-semibold tabular-nums text-white">{metric.value === undefined ? '—' : metric.value.toLocaleString('es-CR')}</p>
                                <p className="mt-0.5 text-xs font-medium leading-snug text-[#a1a1aa]">{metric.label}</p>
                            </div>
                        </div>
                    ))}
                </section>

                <section>
                    <h2 className="mb-3 flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">
                        Flujo operativo
                        <span className="h-px flex-1 bg-[#27272a]" />
                    </h2>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{modules.map(renderModule)}</div>
                </section>
            </div>
        </div>
    );
}
