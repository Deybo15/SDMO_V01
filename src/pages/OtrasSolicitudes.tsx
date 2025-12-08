import { useNavigate } from 'react-router-dom';
import {
    Monitor,
    Wrench,
    Clock,
    Paperclip,
    HelpCircle,
    Hammer,
    Shirt,
    Sparkles
} from 'lucide-react';

export default function OtrasSolicitudes() {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Equipos y activos',
            icon: <Monitor className="w-8 h-8 text-blue-500" />,
            path: '/otras-solicitudes/equipos-activos',
            color: 'bg-blue-50 dark:bg-blue-900/20',
            borderColor: 'border-blue-200 dark:border-blue-800'
        },
        {
            title: 'Herramientas',
            icon: <Wrench className="w-8 h-8 text-orange-500" />,
            path: '/otras-solicitudes/herramientas',
            color: 'bg-orange-50 dark:bg-orange-900/20',
            borderColor: 'border-orange-200 dark:border-orange-800'
        },
        {
            title: 'Préstamo',
            icon: <Clock className="w-8 h-8 text-purple-500" />,
            path: '/otras-solicitudes/prestamo',
            color: 'bg-purple-50 dark:bg-purple-900/20',
            borderColor: 'border-purple-200 dark:border-purple-800'
        },
        {
            title: 'Artículos de oficina',
            icon: <Paperclip className="w-8 h-8 text-pink-500" />,
            path: '/otras-solicitudes/articulos-oficina',
            color: 'bg-pink-50 dark:bg-pink-900/20',
            borderColor: 'border-pink-200 dark:border-pink-800'
        },
        {
            title: 'Sin asignación especifica',
            icon: <HelpCircle className="w-8 h-8 text-gray-500" />,
            path: '/otras-solicitudes/sin-asignacion',
            color: 'bg-gray-50 dark:bg-gray-800',
            borderColor: 'border-gray-200 dark:border-gray-700'
        },
        {
            title: 'Para trabajos en el taller de ebanistería',
            icon: <Hammer className="w-8 h-8 text-amber-600" />,
            path: '/otras-solicitudes/taller-ebanisteria',
            color: 'bg-amber-50 dark:bg-amber-900/20',
            borderColor: 'border-amber-200 dark:border-amber-800'
        },
        {
            title: 'Vestimenta e indumentaría',
            icon: <Shirt className="w-8 h-8 text-indigo-500" />,
            path: '/otras-solicitudes/vestimenta',
            color: 'bg-indigo-50 dark:bg-indigo-900/20',
            borderColor: 'border-indigo-200 dark:border-indigo-800'
        },
        {
            title: 'Artículos de limpieza y aseo',
            icon: <Sparkles className="w-8 h-8 text-teal-500" />,
            path: '/otras-solicitudes/limpieza-aseo',
            color: 'bg-teal-50 dark:bg-teal-900/20',
            borderColor: 'border-teal-200 dark:border-teal-800'
        }
    ];

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Otras Solicitudes</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {modules.map((module, index) => (
                    <button
                        key={index}
                        onClick={() => navigate(module.path)}
                        className={`flex flex-col items-center justify-center p-6 rounded-xl border transition-all hover:scale-105 hover:shadow-lg ${module.color} ${module.borderColor}`}
                    >
                        <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                            {module.icon}
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white text-center">
                            {module.title}
                        </h3>
                    </button>
                ))}
            </div>
        </div>
    );
}
