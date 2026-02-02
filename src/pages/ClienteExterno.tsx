import { useNavigate } from 'react-router-dom';
import {
    FileText,
    LineChart,
    PlusCircle,
    ChevronRight,
    Globe,
    ArrowLeft
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

export default function ClienteExterno() {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Ingresar Solicitud',
            icon: <FileText className="w-8 h-8" />,
            path: '/cliente-externo/ingresar',
            description: 'Crear una nueva solicitud para clientes externos'
        },
        {
            title: 'Seguimiento de Solicitud',
            icon: <LineChart className="w-8 h-8" />,
            path: '/cliente-externo/seguimiento',
            description: 'Consultar el estado de trámites en curso'
        },
        {
            title: 'Realizar Salida',
            icon: <PlusCircle className="w-8 h-8" />,
            path: '/cliente-externo/realizar',
            description: 'Procesar la entrega de activos o materiales'
        }
    ];

    return (
        <div className="min-h-screen bg-[#000000] p-8 text-[#F5F5F7]">
            <div className="max-w-7xl mx-auto space-y-12 animate-fade-in-up">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <PageHeader
                        title="Cliente Externo"
                        icon={Globe}
                        themeColor="blue"
                    />
                    <button
                        onClick={() => navigate('/')}
                        className="btn-ghost"
                    >
                        <div className="flex items-center gap-2">
                            <ArrowLeft className="w-5 h-5" />
                            <span className="text-[11px] font-bold uppercase tracking-widest">Menú Principal</span>
                        </div>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {modules.map((module, index) => (
                        <button
                            key={index}
                            onClick={() => navigate(module.path)}
                            className="glass-card group relative p-8 flex flex-col h-72 text-left hover:border-[#0071E3]/50 transition-all duration-300"
                        >
                            {/* Icon Container */}
                            <div className="mb-6 p-4 bg-[#0071E3]/10 rounded-[8px] w-fit group-hover:scale-105 transition-all duration-300 text-[#0071E3] border border-[#0071E3]/20">
                                {module.icon}
                            </div>

                            {/* Content */}
                            <div className="flex-1 space-y-3">
                                <h3 className="text-xl font-bold text-[#F5F5F7] leading-tight tracking-tight uppercase group-hover:text-[#0071E3] transition-colors">
                                    {module.title}
                                </h3>
                                <p className="text-[#86868B] text-xs font-medium leading-relaxed line-clamp-3">
                                    {module.description}
                                </p>
                            </div>

                            {/* Footer Interaction */}
                            <div className="mt-4 flex items-center gap-2 text-[#0071E3] opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] font-black uppercase tracking-widest">Explorar categoría</span>
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
