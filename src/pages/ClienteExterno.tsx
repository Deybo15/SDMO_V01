import { useNavigate } from 'react-router-dom';
import {
    FileText,
    LineChart,
    PlusCircle,
    ChevronRight,
    Globe
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

export default function ClienteExterno() {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Ingresar Solicitud',
            icon: <FileText className="w-8 h-8" />,
            path: '/cliente-externo/ingresar',
            color: 'purple',
            description: 'Crear una nueva solicitud para clientes externos'
        },
        {
            title: 'Seguimiento de Solicitud',
            icon: <LineChart className="w-8 h-8" />,
            path: '/cliente-externo/seguimiento',
            color: 'indigo',
            description: 'Consultar el estado de trámites en curso'
        },
        {
            title: 'Realizar Salida',
            icon: <PlusCircle className="w-8 h-8" />,
            path: '/cliente-externo/realizar',
            color: 'cyan',
            description: 'Procesar la entrega de activos o materiales'
        }
    ];

    return (
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8 relative overflow-hidden">
            {/* Premium Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-8">
                <PageHeader
                    title="Cliente Externo"
                    icon={Globe}
                    themeColor="blue"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {modules.map((module, index) => (
                        <button
                            key={index}
                            onClick={() => navigate(module.path)}
                            className="glass-card group relative p-8 pb-10 flex flex-col h-72 text-left overflow-hidden border-white/5 hover:border-white/20"
                        >
                            {/* Accent Glow */}
                            <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${module.color}-500/10 rounded-full blur-2xl group-hover:bg-${module.color}-500/20 transition-all duration-500`} />

                            <div className={`mb-6 p-4 bg-${module.color}-500/10 rounded-2xl w-fit group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 text-${module.color}-400 ring-1 ring-${module.color}-500/20`}>
                                {module.icon}
                            </div>

                            <div className="flex-1 space-y-2">
                                <h3 className="text-xl font-black text-white leading-tight tracking-tight uppercase italic group-hover:text-blue-400 transition-colors">
                                    {module.title}
                                </h3>
                                <p className="text-slate-400 text-xs font-medium leading-relaxed line-clamp-2">
                                    {module.description}
                                </p>
                            </div>

                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
