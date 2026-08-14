import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    ClipboardList,
    Search,
    Settings2,
    Users
} from 'lucide-react';

const modules = [
    {
        id: 'staff',
        title: 'Informe de colaboradores',
        icon: Users,
        path: '/gestion-interna/colaboradores',
        description: 'Gestión y visualización detallada del personal y sus roles'
    },
    {
        id: 'withdrawals',
        title: 'Retiros por artículo',
        icon: Search,
        path: '/gestion-interna/retiros-articulo',
        description: 'Consultar qué funcionarios han retirado un artículo específico'
    },
    {
        id: 'materials',
        title: 'Materiales por solicitud',
        icon: ClipboardList,
        path: '/gestion-interna/materiales-solicitud',
        description: 'Consultar materiales utilizados por número de solicitud y sus costos'
    }
] as const;

export default function GestionInterna() {
    const navigate = useNavigate();

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
                            <Settings2 className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white md:text-[30px]">Gestión Interna</h1>
                            <p className="text-sm text-[#a1a1aa]">Administración, consultas y reportes internos del SDMO</p>
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
                    <h2 className="mb-3 flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">
                        Consultas e informes
                        <span className="h-px flex-1 bg-[#27272a]" />
                    </h2>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{modules.map(renderModule)}</div>
                </section>
            </div>
        </div>
    );
}
