import { useNavigate } from 'react-router-dom';
import {
    ClipboardList,
    QrCode,
    Image as ImageIcon,
    PlusCircle,
    RotateCcw,
    LineChart,
    History,
    Tag,
    ArrowUpRight,
    ChevronRight,
    LayoutGrid
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

export default function Articulos() {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Consultar Inventario',
            icon: <ClipboardList className="w-8 h-8" />,
            path: '/articulos/consultar-inventario',
            color: 'purple',
            description: 'Ver y gestionar el stock completo de artículos'
        },
        {
            title: 'Escáner QR',
            icon: <QrCode className="w-8 h-8" />,
            path: '/articulos/escaner-qr',
            color: 'orange',
            description: 'Identificar productos mediante códigos QR'
        },
        {
            title: 'Ingresar Imagen',
            icon: <ImageIcon className="w-8 h-8" />,
            path: '/articulos/gestion-imagenes',
            color: 'blue',
            description: 'Adjuntar y gestionar fotografías de productos'
        },
        {
            title: 'Ingresar Artículo',
            icon: <PlusCircle className="w-8 h-8" />,
            path: '/articulos/ingresar-articulo',
            color: 'emerald',
            description: 'Registrar nuevos elementos en el inventario'
        },
        {
            title: 'Devoluciones',
            icon: <RotateCcw className="w-8 h-8" />,
            path: '/articulos/devoluciones',
            color: 'red',
            description: 'Gestionar el retorno de artículos prestados'
        },
        {
            title: 'Kárdex Diario',
            icon: <LineChart className="w-8 h-8" />,
            path: '/articulos/kardex-diario',
            color: 'amber',
            description: 'Seguimiento detallado de movimientos diarios'
        },
        {
            title: 'Historial de Artículo',
            icon: <History className="w-8 h-8" />,
            path: '/articulos/historial-articulo',
            color: 'indigo',
            description: 'Trazabilidad completa de cada artículo'
        },
        {
            title: 'Generar Etiqueta',
            icon: <Tag className="w-8 h-8" />,
            path: '/articulos/generar-etiqueta',
            color: 'cyan',
            description: 'Crear etiquetas de identificación para stock'
        },
        {
            title: 'Consultar Salidas',
            icon: <ArrowUpRight className="w-8 h-8" />,
            path: '/articulos/consultar-salidas',
            color: 'pink',
            description: 'Ver historial de entregas y consumos'
        }
    ];

    return (
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8 relative overflow-hidden">
            {/* Premium Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-8">
                <PageHeader
                    title="Gestión de Artículos"
                    icon={LayoutGrid}
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
