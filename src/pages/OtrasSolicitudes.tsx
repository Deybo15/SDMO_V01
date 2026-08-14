import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Clock,
    Hammer,
    HelpCircle,
    LayoutGrid,
    Monitor,
    Paperclip,
    Shirt,
    Sparkles,
    Wrench
} from 'lucide-react';

const modules = [
    {
        id: 'equipment',
        title: 'Equipos y activos',
        icon: Monitor,
        path: '/otras-solicitudes/equipos-activos',
        description: 'Insumos para maquinaria y equipos',
        group: 'equipment'
    },
    {
        id: 'tools',
        title: 'Herramientas',
        icon: Wrench,
        path: '/otras-solicitudes/herramientas',
        description: 'Taladros, sierras y equipo manual',
        group: 'equipment'
    },
    {
        id: 'loan',
        title: 'Préstamo',
        icon: Clock,
        path: '/otras-solicitudes/prestamo',
        description: 'Insumos para otras dependencias',
        group: 'equipment'
    },
    {
        id: 'workshop',
        title: 'Taller de ebanistería',
        icon: Hammer,
        path: '/otras-solicitudes/taller-ebanisteria',
        description: 'Materiales para madera y carpintería',
        group: 'equipment'
    },
    {
        id: 'office',
        title: 'Artículos de oficina',
        icon: Paperclip,
        path: '/otras-solicitudes/articulos-oficina',
        description: 'Papelería, tintas y accesorios',
        group: 'supplies'
    },
    {
        id: 'clothing',
        title: 'Vestimenta e indumentaria',
        icon: Shirt,
        path: '/otras-solicitudes/vestimenta',
        description: 'Uniformes y equipo de protección',
        group: 'supplies'
    },
    {
        id: 'cleaning',
        title: 'Limpieza y aseo',
        icon: Sparkles,
        path: '/otras-solicitudes/limpieza-aseo',
        description: 'Insumos de limpieza y desinfección',
        group: 'supplies'
    },
    {
        id: 'unassigned',
        title: 'Sin asignación específica',
        icon: HelpCircle,
        path: '/otras-solicitudes/sin-asignacion',
        description: 'Otros artículos no categorizados',
        group: 'supplies'
    }
] as const;

export default function OtrasSolicitudes() {
    const navigate = useNavigate();
    const equipmentModules = modules.filter((module) => module.group === 'equipment');
    const supplyModules = modules.filter((module) => module.group === 'supplies');

    const renderModule = (module: (typeof modules)[number]) => {
        const Icon = module.icon;
        return (
            <button
                key={module.id}
                type="button"
                onClick={() => navigate(module.path)}
                className={`group flex min-h-[104px] w-full items-center gap-4 rounded-xl border bg-[#0d0d0e] p-4 text-left transition-colors hover:border-[#71717a] hover:bg-[#111112] ${
                    module.id === 'unassigned' ? 'border-[#333336]' : 'border-[#3f3f46]'
                }`}
            >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#52525b] bg-[#151517] text-[#e4e4e7]">
                    <Icon className="h-5 w-5" />
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
                            <LayoutGrid className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white md:text-[30px]">Otras Solicitudes</h1>
                            <p className="text-sm text-[#a1a1aa]">Acceso a solicitudes especializadas de bienes y servicios</p>
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

                {equipmentModules.length > 0 && (
                    <section>
                        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">Equipamiento y servicios</h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{equipmentModules.map(renderModule)}</div>
                    </section>
                )}

                {supplyModules.length > 0 && (
                    <section className="pb-8">
                        <h2 className="mb-3 border-t border-[#27272a] pt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">Suministros y consumo</h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{supplyModules.map(renderModule)}</div>
                    </section>
                )}
            </div>
        </div>
    );
}
