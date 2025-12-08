import {
    Users,
    LineChart,
    Search,
    Truck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ClienteInterno() {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Ingresar Solicitud',
            icon: <Users className="w-8 h-8 text-purple-600" />,
            path: '/cliente-interno/ingresar',
            color: 'bg-purple-50 dark:bg-purple-900/20',
            borderColor: 'border-purple-200 dark:border-purple-800'
        },
        {
            title: 'Seguimiento de Solicitud',
            icon: <LineChart className="w-8 h-8 text-indigo-600" />,
            path: '/cliente-interno/seguimiento',
            color: 'bg-indigo-50 dark:bg-indigo-900/20',
            borderColor: 'border-indigo-200 dark:border-indigo-800'
        },
        {
            title: 'Consultar Estado de Solicitud',
            icon: <Search className="w-8 h-8 text-cyan-600" />,
            path: '/cliente-interno/consultar-estado',
            color: 'bg-cyan-50 dark:bg-cyan-900/20',
            borderColor: 'border-cyan-200 dark:border-cyan-800'
        },
        {
            title: 'Realizar Salidas',
            icon: <Truck className="w-8 h-8 text-orange-600" />,
            path: '/cliente-interno/realizar-salidas',
            color: 'bg-orange-50 dark:bg-orange-900/20',
            borderColor: 'border-orange-200 dark:border-orange-800'
        }
    ];

    return (
        <div className="p-6">
            <div className="sticky top-0 z-30 flex items-center gap-4 py-4 -mx-6 px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 mb-6">
                <h1 className="text-2xl font-bold text-white">Cliente Interno</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {modules.map((module, index) => (
                    <button
                        key={index}
                        onClick={() => navigate(module.path)}
                        className="group relative flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 overflow-hidden"
                    >
                        {/* Hover Gradient Effect */}
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br ${module.color.replace('bg-', 'from-').replace('50', '500').split(' ')[0]} to-transparent`} />

                        <div className={`mb-5 p-4 rounded-2xl bg-slate-900/80 border border-slate-700 shadow-lg group-hover:scale-110 transition-transform duration-300 ${module.borderColor}`}>
                            {module.icon}
                        </div>
                        <h3 className="text-lg font-bold text-slate-200 group-hover:text-white text-center z-10">
                            {module.title}
                        </h3>
                    </button>
                ))}
            </div>
        </div>
    );
}
