import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    ClipboardList,
    LineChart,
    Search,
    Truck,
    UserCircle,
    UserPlus,
    Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClientStats {
    clients: number;
    activeRequests: number;
    activeRequestsWithMaterialOutput: number;
}

const modules = [
    {
        id: 'request',
        title: 'Ingresar solicitud',
        icon: ClipboardList,
        path: '/cliente-interno/ingresar',
        description: 'Crear una nueva solicitud de mantenimiento o materiales'
    },
    {
        id: 'tracking',
        title: 'Seguimiento de solicitud',
        icon: LineChart,
        path: '/cliente-interno/seguimiento',
        description: 'Ver el estado y bitácora de solicitudes activas'
    },
    {
        id: 'deliveries',
        title: 'Realizar salidas',
        icon: Truck,
        path: '/cliente-interno/realizar-salidas',
        description: 'Procesar la entrega física de materiales'
    },
    {
        id: 'client',
        title: 'Ingresar cliente interno',
        icon: UserPlus,
        path: '/cliente-interno/ingresar-cliente',
        description: 'Registrar nuevos clientes internos en el sistema'
    },
    {
        id: 'status',
        title: 'Consultar estado de solicitud',
        icon: Search,
        path: '/cliente-interno/consultar-estado',
        description: 'Búsqueda rápida de solicitudes por número'
    }
] as const;

async function fetchClientStats(): Promise<ClientStats> {
    const [clientsResult, activeResult] = await Promise.all([
        supabase.from('cliente_interno_15').select('id_cliente', { count: 'exact', head: true }),
        supabase
            .from('solicitud_17')
            .select('numero_solicitud, seguimiento_solicitud!inner(estado_actual)')
            .eq('tipo_solicitud', 'STI')
            .eq('seguimiento_solicitud.estado_actual', 'ACTIVA')
    ]);

    if (clientsResult.error) throw clientsResult.error;
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
        clients: clientsResult.count || 0,
        activeRequests: activeIds.length,
        activeRequestsWithMaterialOutput
    };
}

export default function ClienteInterno() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<ClientStats | null>(null);

    useEffect(() => {
        const loadStats = async () => {
            try {
                setStats(await fetchClientStats());
            } catch (error) {
                console.error('Error cargando indicadores de cliente interno:', error);
                setStats({ clients: 0, activeRequests: 0, activeRequestsWithMaterialOutput: 0 });
            }
        };

        loadStats();
    }, []);

    const primaryModules = modules.slice(0, 3);
    const secondaryModules = modules.slice(3);

    const renderModule = (module: (typeof modules)[number], compact = false) => {
        const Icon = module.icon;
        return (
            <button
                key={module.id}
                type="button"
                onClick={() => navigate(module.path)}
                className={`group flex w-full items-center rounded-xl border border-[#3f3f46] bg-[#0d0d0e] text-left transition-colors hover:border-[#71717a] hover:bg-[#111112] ${
                    compact ? 'min-h-[104px] gap-5 p-5' : 'min-h-[128px] gap-5 p-5'
                }`}
            >
                <span className={`flex shrink-0 items-center justify-center rounded-lg border border-[#52525b] bg-[#151517] text-[#e4e4e7] ${compact ? 'h-12 w-12' : 'h-14 w-14'}`}>
                    <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
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
                            <UserCircle className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white md:text-[30px]">Cliente Interno</h1>
                            <p className="text-sm text-[#a1a1aa]">Gestión de solicitudes y entregas para clientes internos</p>
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
                        { label: 'Clientes registrados', value: stats?.clients, icon: Users },
                        { label: 'Solicitudes activas', value: stats?.activeRequests, icon: ClipboardList },
                        { label: 'Solicitudes activas con salida de material', value: stats?.activeRequestsWithMaterialOutput, icon: Truck }
                    ].map((metric, index) => (
                        <div key={metric.label} className={`flex items-center gap-4 px-5 py-4 ${index > 0 ? 'border-t border-[#3f3f46] md:border-l md:border-t-0' : ''}`}>
                            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#52525b] bg-[#151517] text-[#d4d4d8]">
                                <metric.icon className="h-5 w-5" />
                            </span>
                            <div>
                                <p className="text-2xl font-semibold tabular-nums text-white">{metric.value === undefined ? '—' : metric.value.toLocaleString('es-CR')}</p>
                                <p className="mt-0.5 text-xs font-medium text-[#a1a1aa]">{metric.label}</p>
                            </div>
                        </div>
                    ))}
                </section>

                <section>
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">Flujo operativo</h2>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{primaryModules.map((module) => renderModule(module))}</div>
                </section>

                <section className="pb-8">
                    <h2 className="mb-3 border-t border-[#27272a] pt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">Gestión y consulta</h2>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{secondaryModules.map((module) => renderModule(module, true))}</div>
                </section>
            </div>
        </div>
    );
}
