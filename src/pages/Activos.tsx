import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Briefcase,
    LayoutList,
    PlusCircle,
    SearchCode,
    UserPlus,
    Wrench
} from 'lucide-react';

const modules = [
    {
        id: 'inventory',
        title: 'Inventario general',
        icon: LayoutList,
        path: '/activos/inventario',
        description: 'Consulta detallada del catálogo completo de activos institucionales'
    },
    {
        id: 'register',
        title: 'Registrar nuevo',
        icon: PlusCircle,
        path: '/activos/ingreso',
        description: 'Alta y registro de nuevos activos en el sistema central'
    },
    {
        id: 'assign',
        title: 'Asignar a colaborador',
        icon: UserPlus,
        path: '/activos/asignacion',
        description: 'Gestión de asignaciones y responsabilidades de activos por personal'
    },
    {
        id: 'accessories',
        title: 'Registrar accesorios',
        icon: Wrench,
        path: '/activos/accesorios',
        description: 'Control, registro y vinculación de complementos para activos específicos'
    },
    {
        id: 'search',
        title: 'Consulta por descripción',
        icon: SearchCode,
        path: '/activos/consulta',
        description: 'Localización rápida de responsables y estado actual por descripción del equipo'
    }
] as const;

export default function Activos() {
    const navigate = useNavigate();
    const operationalModules = modules.slice(0, 4);
    const queryModules = modules.slice(4);

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
                            <Briefcase className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white md:text-[30px]">Gestión de Activos</h1>
                            <p className="text-sm text-[#a1a1aa]">Administración y trazabilidad de los activos institucionales</p>
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

                <section>
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">Operación de activos</h2>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                        {operationalModules.map((module) => renderModule(module))}
                    </div>
                </section>

                <section className="pb-8">
                    <h2 className="mb-3 border-t border-[#27272a] pt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">Consulta especializada</h2>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {queryModules.map((module) => renderModule(module, true))}
                    </div>
                </section>
            </div>
        </div>
    );
}
