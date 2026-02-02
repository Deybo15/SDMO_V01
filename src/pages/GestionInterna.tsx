import { useNavigate } from 'react-router-dom';
import {
    Users,
    ChevronRight,
    Settings2,
    ArrowLeft
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

export default function GestionInterna() {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Informe de Colaboradores',
            icon: <Users className="w-8 h-8" />,
            path: '/gestion-interna/colaboradores',
            description: 'Gestión y visualización detallada del personal y sus roles'
        }
    ];

    return (
        <div className="min-h-screen bg-[#000000] p-8 text-[#F5F5F7]">
            <div className="max-w-7xl mx-auto space-y-12 animate-fade-in-up">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <PageHeader
                        title="Gestión Interna"
                        icon={Settings2}
                    />
                    <button
                        onClick={() => navigate('/')}
                        className="btn-ghost !px-8 !py-4"
                    >
                        <div className="flex items-center gap-3">
                            <ArrowLeft className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Menú Principal</span>
                        </div>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {modules.map((module, index) => (
                        <button
                            key={index}
                            onClick={() => navigate(module.path)}
                            className="bg-[#121212] border border-[#333333] rounded-[8px] group relative p-8 flex flex-col h-80 text-left hover:border-[#0071E3]/50 transition-all duration-300"
                        >
                            {/* Icon Container */}
                            <div className="mb-6 p-5 bg-black/40 rounded-[4px] w-fit group-hover:scale-105 transition-all duration-300 text-[#0071E3] border border-[#333333]">
                                {module.icon}
                            </div>

                            {/* Content */}
                            <div className="flex-1 space-y-4">
                                <h3 className="text-xl font-black text-[#F5F5F7] leading-tight tracking-tight uppercase group-hover:text-[#0071E3] transition-colors italic">
                                    {module.title}
                                </h3>
                                <p className="text-[#86868B] text-[11px] font-black uppercase leading-relaxed tracking-wider">
                                    {module.description}
                                </p>
                            </div>

                            {/* Footer Interaction */}
                            <div className="mt-6 flex items-center gap-3 text-[#0071E3] opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[9px] font-black uppercase tracking-widest">Acceder al módulo</span>
                                <ChevronRight className="w-4 h-4" />
                            </div>

                            {/* Apple Accent Indicator */}
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#0071E3] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
