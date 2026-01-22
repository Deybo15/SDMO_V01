import { useNavigate } from 'react-router-dom';
import {
    Monitor,
    Wrench,
    Clock,
    Paperclip,
    HelpCircle,
    Hammer,
    Shirt,
    Sparkles,
    ChevronRight,
    LayoutGrid
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

export default function OtrasSolicitudes() {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Equipos y activos',
            icon: <Monitor className="w-8 h-8" />,
            path: '/otras-solicitudes/equipos-activos',
            color: 'blue',
            description: 'Computadoras, monitores y periféricos'
        },
        {
            title: 'Herramientas',
            icon: <Wrench className="w-8 h-8" />,
            path: '/otras-solicitudes/herramientas',
            color: 'orange',
            description: 'Taladros, sierras y equipo manual'
        },
        {
            title: 'Préstamo',
            icon: <Clock className="w-8 h-8" />,
            path: '/otras-solicitudes/prestamo',
            color: 'purple',
            description: 'Equipo para uso temporal'
        },
        {
            title: 'Artículos de oficina',
            icon: <Paperclip className="w-8 h-8" />,
            path: '/otras-solicitudes/articulos-oficina',
            color: 'pink',
            description: 'Papelería, tintas y accesorios'
        },
        {
            title: 'Sin asignación especifica',
            icon: <HelpCircle className="w-8 h-8" />,
            path: '/otras-solicitudes/sin-asignacion',
            color: 'slate',
            description: 'Otros artículos no categorizados'
        },
        {
            title: 'Taller de ebanistería',
            icon: <Hammer className="w-8 h-8" />,
            path: '/otras-solicitudes/taller-ebanisteria',
            color: 'amber',
            description: 'Materiales para madera y carpintería'
        },
        {
            title: 'Vestimenta e indumentaría',
            icon: <Shirt className="w-8 h-8" />,
            path: '/otras-solicitudes/vestimenta',
            color: 'indigo',
            description: 'Uniformes y equipo de protección'
        },
        {
            title: 'Limpieza y aseo',
            icon: <Sparkles className="w-8 h-8" />,
            path: '/otras-solicitudes/limpieza-aseo',
            color: 'teal',
            description: 'Insumos de limpieza y desinfección'
        }
    ];

    return (
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8">
            <PageHeader
                title="Otras Solicitudes"
                icon={LayoutGrid}
                themeColor="blue"
            />

            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {modules.map((module, index) => (
                        <button
                            key={index}
                            onClick={() => navigate(module.path)}
                            className="group relative bg-[#1e2235] border border-white/10 p-6 rounded-2xl transition-all duration-300 hover:border-white/20 hover:bg-[#252a41] hover:shadow-2xl hover:shadow-black/50 text-left overflow-hidden flex flex-col h-full active:scale-95 shadow-lg"
                        >
                            {/* Decorative background gradient */}
                            <div className={`absolute -right-8 -top-8 w-32 h-32 bg-${module.color}-500/10 rounded-full blur-3xl group-hover:bg-${module.color}-500/20 transition-all duration-500`} />

                            <div className={`mb-6 p-4 bg-${module.color}-500/10 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-300 text-${module.color}-400`}>
                                {module.icon}
                            </div>

                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-white mb-2 leading-tight">
                                    {module.title}
                                </h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    {module.description}
                                </p>
                            </div>

                            <div className="mt-8 flex items-center gap-2 text-sm font-bold text-white/40 group-hover:text-white transition-colors">
                                Explorar categoría
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
