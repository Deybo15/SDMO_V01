import {
    LayoutList,
    PlusCircle,
    UserPlus,
    Wrench
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Activos() {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Inventario General',
            icon: <LayoutList className="w-8 h-8 text-blue-600" />,
            path: '/activos/inventario',
            color: 'bg-blue-50 dark:bg-blue-900/20',
            borderColor: 'border-blue-200 dark:border-blue-800'
        },
        {
            title: 'Registrar Nuevo',
            icon: <PlusCircle className="w-8 h-8 text-emerald-600" />,
            path: '/activos/ingreso',
            color: 'bg-emerald-50 dark:bg-emerald-900/20',
            borderColor: 'border-emerald-200 dark:border-emerald-800'
        },
        {
            title: 'Asignar a Colaborador',
            icon: <UserPlus className="w-8 h-8 text-purple-600" />,
            path: '/activos/asignacion',
            color: 'bg-purple-50 dark:bg-purple-900/20',
            borderColor: 'border-purple-200 dark:border-purple-800'
        },
        {
            title: 'Registrar Accesorios',
            icon: <Wrench className="w-8 h-8 text-orange-600" />,
            path: '/activos/accesorios',
            color: 'bg-orange-50 dark:bg-orange-900/20',
            borderColor: 'border-orange-200 dark:border-orange-800'
        }
    ];

    return (
        <div className="p-6">
            <div className="sticky top-0 z-30 flex items-center justify-between py-6 mb-8 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 -mx-6 px-6">
                <h1 className="text-2xl font-bold text-white">Gestión de Activos</h1>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
