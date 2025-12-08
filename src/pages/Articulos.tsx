import {
    ClipboardList,
    QrCode,
    Image,
    PlusCircle,
    RotateCcw,
    LineChart,
    LogOut,
    Tag,
    ArrowUpRight
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

export default function Articulos() {
    const navigate = useNavigate();
    const modules = [
        {
            title: 'Consultar Inventario',
            icon: <ClipboardList className="w-8 h-8 text-purple-500" />,
            path: '/articulos/consultar-inventario',
            color: 'bg-purple-50 dark:bg-purple-900/20',
            borderColor: 'border-purple-200 dark:border-purple-800'
        },
        {
            title: 'Escáner QR',
            icon: <QrCode className="w-8 h-8 text-orange-500" />,
            path: '/articulos/escaner-qr',
            color: 'bg-orange-50 dark:bg-orange-900/20',
            borderColor: 'border-orange-200 dark:border-orange-800'
        },
        {
            title: 'Ingresar Imagen',
            icon: <Image className="w-8 h-8 text-green-500" />,
            path: '/articulos/gestion-imagenes',
            color: 'bg-green-50 dark:bg-green-900/20',
            borderColor: 'border-green-200 dark:border-green-800'
        },
        {
            title: 'Ingresar Artículo',
            icon: <PlusCircle className="w-8 h-8 text-emerald-500" />,
            path: '/articulos/ingresar-articulo',
            color: 'bg-emerald-50 dark:bg-emerald-900/20',
            borderColor: 'border-emerald-200 dark:border-emerald-800'
        },
        {
            title: 'Devoluciones',
            icon: <RotateCcw className="w-8 h-8 text-red-500" />,
            path: '/articulos/devoluciones',
            color: 'bg-red-50 dark:bg-red-900/20',
            borderColor: 'border-red-200 dark:border-red-800'
        },
        {
            title: 'Kárdex Diario',
            icon: <LineChart className="w-8 h-8 text-amber-500" />,
            path: '/articulos/kardex-diario',
            color: 'bg-amber-50 dark:bg-amber-900/20',
            borderColor: 'border-amber-200 dark:border-amber-800'
        },
        {
            title: 'Historial de Artículo',
            icon: <LogOut className="w-8 h-8 text-indigo-500" />,
            path: '/articulos/historial-articulo',
            color: 'bg-indigo-50 dark:bg-indigo-900/20',
            borderColor: 'border-indigo-200 dark:border-indigo-800'
        },
        {
            title: 'Generar Etiqueta',
            icon: <Tag className="w-8 h-8 text-cyan-500" />,
            path: '/articulos/generar-etiqueta',
            color: 'bg-cyan-50 dark:bg-cyan-900/20',
            borderColor: 'border-cyan-200 dark:border-cyan-800'
        },
        {
            title: 'Consultar Salidas',
            icon: <ArrowUpRight className="w-8 h-8 text-pink-500" />,
            path: '/articulos/consultar-salidas',
            color: 'bg-pink-50 dark:bg-pink-900/20',
            borderColor: 'border-pink-200 dark:border-pink-800'
        },
    ];

    return (
        <div className="p-6">
            <div className="sticky top-0 z-30 flex items-center gap-4 py-4 -mx-6 px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 mb-6">
                <h1 className="text-2xl font-bold text-white">Gestión de Artículos</h1>
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
