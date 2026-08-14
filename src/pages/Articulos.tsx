import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    Boxes,
    ClipboardList,
    History,
    Image as ImageIcon,
    LayoutGrid,
    LineChart,
    Package,
    PlusCircle,
    QrCode,
    RotateCcw,
    Tag
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InventoryStats {
    articles: number;
    units: number;
    movements: number;
}

const modules = [
    {
        id: 'register',
        title: 'Registrar nuevo artículo',
        icon: PlusCircle,
        path: '/articulos/registrar-nuevo',
        description: 'Definir un nuevo producto en el catálogo maestro',
        group: 'quick'
    },
    {
        id: 'inventory',
        title: 'Consultar inventario',
        icon: ClipboardList,
        path: '/articulos/consultar-inventario',
        description: 'Ver y gestionar el stock completo de artículos',
        group: 'inventory'
    },
    {
        id: 'scanner',
        title: 'Escáner QR',
        icon: QrCode,
        path: '/articulos/escaner-qr',
        description: 'Identificar productos mediante códigos QR',
        group: 'quick'
    },
    {
        id: 'images',
        title: 'Ingresar imagen',
        icon: ImageIcon,
        path: '/articulos/gestion-imagenes',
        description: 'Adjuntar y gestionar fotografías de productos',
        group: 'inventory'
    },
    {
        id: 'entry',
        title: 'Ingresar artículo',
        icon: ClipboardList,
        path: '/articulos/ingresar-articulo',
        description: 'Registrar entradas de stock para artículos existentes',
        group: 'quick'
    },
    {
        id: 'returns',
        title: 'Devoluciones',
        icon: RotateCcw,
        path: '/articulos/devoluciones',
        description: 'Gestionar el retorno de artículos prestados',
        group: 'movements'
    },
    {
        id: 'kardex',
        title: 'Kárdex diario',
        icon: LineChart,
        path: '/articulos/kardex-diario',
        description: 'Seguimiento detallado de movimientos diarios',
        group: 'movements'
    },
    {
        id: 'history',
        title: 'Historial de artículo',
        icon: History,
        path: '/articulos/historial-articulo',
        description: 'Trazabilidad completa de cada artículo',
        group: 'movements'
    },
    {
        id: 'labels',
        title: 'Generar etiqueta',
        icon: Tag,
        path: '/articulos/generar-etiqueta',
        description: 'Crear etiquetas de identificación para stock',
        group: 'support'
    },
    {
        id: 'outputs',
        title: 'Consultar salidas',
        icon: ArrowUpRight,
        path: '/articulos/consultar-salidas',
        description: 'Ver historial de entregas y consumos',
        group: 'support'
    }
] as const;

const getLocalIsoDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

async function fetchInventorySummary() {
    const batchSize = 1000;
    let offset = 0;
    let units = 0;
    let articles = 0;

    while (true) {
        const { data, count, error } = await supabase
            .from('inventario_con_datos')
            .select('cantidad_disponible', { count: offset === 0 ? 'exact' : undefined })
            .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (offset === 0) articles = count || 0;
        units += (data || []).reduce((total, item) => total + (Number(item.cantidad_disponible) || 0), 0);
        if (!data || data.length < batchSize) break;
        offset += batchSize;
    }

    return { articles, units };
}

export default function Articulos() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<InventoryStats | null>(null);

    useEffect(() => {
        const loadStats = async () => {
            try {
                const today = getLocalIsoDate();
                const [inventory, entries, outputs] = await Promise.all([
                    fetchInventorySummary(),
                    supabase.from('entrada_articulo_07').select('id_entrada', { count: 'exact', head: true }).eq('fecha_entrada', today),
                    supabase.from('salida_articulo_08').select('id_salida', { count: 'exact', head: true }).eq('fecha_salida', today)
                ]);

                setStats({
                    articles: inventory.articles,
                    units: inventory.units,
                    movements: (entries.count || 0) + (outputs.count || 0)
                });
            } catch (error) {
                console.error('Error cargando indicadores de artículos:', error);
                setStats({ articles: 0, units: 0, movements: 0 });
            }
        };

        loadStats();
    }, []);

    const primaryModuleIds = ['inventory', 'entry', 'register', 'scanner'];
    const primaryModules = primaryModuleIds
        .map((id) => modules.find((module) => module.id === id))
        .filter((module): module is (typeof modules)[number] => Boolean(module));
    const secondaryModules = modules.filter((module) => !primaryModuleIds.includes(module.id));

    const renderModule = (module: (typeof modules)[number], compact = false) => {
        const Icon = module.icon;
        return (
            <button
                key={module.id}
                type="button"
                onClick={() => navigate(module.path)}
                className={`group flex w-full items-center rounded-xl border border-[#3f3f46] bg-[#0d0d0e] text-left transition-colors hover:border-[#71717a] hover:bg-[#111112] ${
                    compact ? 'min-h-[96px] gap-4 p-4' : 'min-h-[120px] gap-4 p-5'
                }`}
            >
                <span className={`flex shrink-0 items-center justify-center rounded-lg border border-[#52525b] bg-[#151517] text-[#e4e4e7] ${compact ? 'h-12 w-12' : 'h-14 w-14'}`}>
                    <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
                </span>
                <span className="min-w-0 flex-1">
                    <strong className="block text-[15px] font-semibold text-white">{module.title}</strong>
                    <span className="mt-1 block text-xs leading-relaxed text-[#a1a1aa]">{module.description}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-[#a1a1aa] transition-transform group-hover:translate-x-1 group-hover:text-white" />
            </button>
        );
    };

    return (
        <div className="min-h-screen bg-black p-4 text-[#f4f4f5] selection:bg-white/20 md:px-8 md:py-6">
            <div className="w-full space-y-6 animate-fade-in-up">
                <header className="flex flex-col justify-between gap-4 border-b border-[#27272a] pb-4 md:flex-row md:items-center">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-[#71717a] bg-[#111112] p-3 text-[#e4e4e7]">
                            <LayoutGrid className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white md:text-[30px]">Gestión de artículos</h1>
                            <p className="text-sm text-[#a1a1aa]">Administración y control del inventario de artículos del SDMO</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#71717a] bg-[#111112] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#18181b]"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Menú principal
                    </button>
                </header>

                <section className="grid grid-cols-1 rounded-xl border border-[#3f3f46] bg-[#0d0d0e] md:grid-cols-3">
                    {[
                        { label: 'Artículos registrados', value: stats?.articles, icon: Package },
                        { label: 'Unidades en inventario', value: stats?.units, icon: Boxes },
                        { label: 'Movimientos de hoy', value: stats?.movements, icon: Activity }
                    ].map((metric, index) => (
                        <div key={metric.label} className={`flex items-center gap-4 px-5 py-4 ${index > 0 ? 'border-t border-[#3f3f46] md:border-l md:border-t-0' : ''}`}>
                            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#52525b] bg-[#151517] text-[#d4d4d8]">
                                <metric.icon className="h-5 w-5" />
                            </span>
                            <div>
                                <p className="text-2xl font-semibold tabular-nums text-white">{metric.value === undefined ? '—' : metric.value.toLocaleString('es-CR')}</p>
                                <p className="mt-0.5 text-xs font-medium text-[#a1a1aa]">{metric.label}</p>
                            </div>
                        </div>
                    ))}
                </section>

                <section>
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">Operaciones principales</h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{primaryModules.map((module) => renderModule(module))}</div>
                </section>

                <section className="pb-8">
                    <h2 className="mb-3 border-t border-[#27272a] pt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">Gestión y trazabilidad</h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{secondaryModules.map((module) => renderModule(module, true))}</div>
                </section>
            </div>
        </div>
    );
}
