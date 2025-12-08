import {
    FileText,
    LineChart,
    PlusCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ClienteExterno() {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Ingresar Solicitud',
            icon: <FileText className="w-8 h-8 text-purple-600" />,
            path: '/cliente-externo/ingresar',
            color: 'bg-purple-50 dark:bg-purple-900/20',
            borderColor: 'border-purple-200 dark:border-purple-800'
        },
        {
            title: 'Seguimiento de Solicitud',
            icon: <LineChart className="w-8 h-8 text-indigo-600" />,
            path: '/cliente-externo/seguimiento',
            color: 'bg-indigo-50 dark:bg-indigo-900/20',
            borderColor: 'border-indigo-200 dark:border-indigo-800'
        },
        {
            title: 'Realizar Salida',
            icon: <PlusCircle className="w-8 h-8 text-cyan-600" />,
            path: '/cliente-externo/realizar',
            color: 'bg-cyan-50 dark:bg-cyan-900/20',
            borderColor: 'border-cyan-200 dark:border-cyan-800'
        }
    ];

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Cliente Externo</h1>

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
