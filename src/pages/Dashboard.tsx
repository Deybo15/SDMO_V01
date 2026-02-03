import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, ClipboardList, Users, ArrowUpRight, AlertTriangle, PlusCircle, Search, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        articulosCount: 0,
        solicitudesCount: 0,
        clientesCount: 0,
        lowStockCount: 0
    });
    const [recentMovements, setRecentMovements] = useState<any[]>([]);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            // 1. Count Articulos (Inventario)
            const { count: artCount } = await supabase
                .from('inventario_actual')
                .select('*', { count: 'exact', head: true });

            // 2. Count Solicitudes (Active/Recent - e.g., last 30 days or total active)
            // Assuming 'salida_articulo_08' is the main requests table
            const { count: solCount } = await supabase
                .from('salida_articulo_08')
                .select('*', { count: 'exact', head: true });

            // 3. Count Clientes (Colaboradores)
            const { count: cliCount } = await supabase
                .from('colaboradores_06')
                .select('*', { count: 'exact', head: true });

            // 4. Low Stock Alert (Items with quantity < 5)
            const { count: lowStock } = await supabase
                .from('inventario_actual')
                .select('*', { count: 'exact', head: true })
                .lt('cantidad_disponible', 5);

            setStats({
                articulosCount: artCount || 0,
                solicitudesCount: solCount || 0,
                clientesCount: cliCount || 0,
                lowStockCount: lowStock || 0
            });

            // 5. Recent Movements (Last 5 exits)
            const { data: movements } = await supabase
                .from('salida_articulo_08')
                .select('id_salida, fecha_salida, numero_solicitud, retira')
                .order('fecha_salida', { ascending: false })
                .limit(5);

            // Fetch names for 'retira' IDs manually or via join if setup (doing manual for safety)
            let movementsWithNames: any[] = [];
            if (movements && movements.length > 0) {
                const ids = movements.map(m => m.retira).filter(Boolean);
                const { data: names } = await supabase
                    .from('colaboradores_06')
                    .select('identificacion, colaborador, alias')
                    .in('identificacion', ids);

                movementsWithNames = movements.map(m => {
                    const person = names?.find(n => n.identificacion === m.retira);
                    return {
                        ...m,
                        retiraNombre: person?.alias || person?.colaborador || m.retira
                    };
                });
            }
            setRecentMovements(movementsWithNames);

        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        {
            label: 'Artículos en Inventario',
            value: stats.articulosCount,
            icon: Package,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            trend: 'Total'
        },
        {
            label: 'Solicitudes Registradas',
            value: stats.solicitudesCount,
            icon: ClipboardList,
            color: 'text-orange-400',
            bg: 'bg-orange-500/10',
            border: 'border-orange-500/20',
            trend: 'Histórico'
        },
        {
            label: 'Colaboradores',
            value: stats.clientesCount,
            icon: Users,
            color: 'text-indigo-400',
            bg: 'bg-indigo-500/10',
            border: 'border-indigo-500/20',
            trend: 'Activos'
        },
        {
            label: 'Stock Bajo (< 5)',
            value: stats.lowStockCount,
            icon: AlertTriangle,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
            trend: 'Alerta'
        },
    ];

    return (
        <div className="p-6 space-y-8 animate-fade-in">
            <div className="sticky top-0 z-30 flex items-center justify-between py-4 -mx-6 px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white font-heading">Panel de Control</h2>
                    <p className="text-slate-400 mt-1 text-sm">Resumen general de operaciones</p>
                </div>
                <div className="text-sm text-slate-400 font-medium bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                    onClick={() => navigate('/cliente-interno/ingresar')}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-800 transition-all flex items-center gap-3 group"
                >
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                        <PlusCircle className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <span className="block text-white font-medium">Nueva Solicitud</span>
                        <span className="text-xs text-slate-400">Crear salida de almacén</span>
                    </div>
                </button>

                <button
                    onClick={() => navigate('/articulos/consultar-inventario')}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-800 transition-all flex items-center gap-3 group"
                >
                    <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400 group-hover:scale-110 transition-transform">
                        <Search className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <span className="block text-white font-medium">Consultar Inventario</span>
                        <span className="text-xs text-slate-400">Ver stock disponible</span>
                    </div>
                </button>

                <button
                    onClick={() => navigate('/consultar-estado')}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-800 transition-all flex items-center gap-3 group"
                >
                    <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <span className="block text-white font-medium">Reportes</span>
                        <span className="text-xs text-slate-400">Ver historial de movimientos</span>
                    </div>
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat) => (
                    <div key={stat.label} className={`relative overflow-hidden p-6 rounded-2xl border backdrop-blur-sm bg-slate-800/50 ${stat.border} transition-all hover:scale-[1.02] hover:shadow-lg`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-xl ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <span className={`flex items-center text-xs font-medium px-2 py-1 rounded-full border ${stat.color.replace('text-', 'bg-').replace('400', '500')}/10 ${stat.border} ${stat.color}`}>
                                {stat.trend}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                            <p className="text-3xl font-bold text-white mt-1">
                                {loading ? '...' : stat.value}
                            </p>
                        </div>
                        {/* Decorative background gradient */}
                        <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-20 ${stat.bg.replace('/10', '/30')}`}></div>
                    </div>
                ))}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Movements Table */}
                <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <ArrowUpRight className="w-5 h-5 text-blue-400" />
                            Últimos Movimientos de Almacén
                        </h3>
                        <button
                            onClick={() => navigate('/consultar-estado')}
                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Ver todo
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-slate-400 border-b border-slate-700">
                                    <th className="py-3 px-2 font-medium">Fecha</th>
                                    <th className="py-3 px-2 font-medium">Folio</th>
                                    <th className="py-3 px-2 font-medium">Retira</th>
                                    <th className="py-3 px-2 font-medium text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-500">Cargando movimientos...</td>
                                    </tr>
                                ) : recentMovements.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-500">No hay movimientos recientes</td>
                                    </tr>
                                ) : (
                                    recentMovements.map((mov) => (
                                        <tr key={mov.id_salida} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                            <td className="py-3 px-2 text-slate-300">
                                                {new Date(mov.fecha_salida).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-2 text-blue-400 font-mono">
                                                #{mov.numero_solicitud}
                                            </td>
                                            <td className="py-3 px-2 text-slate-300">
                                                {mov.retiraNombre}
                                            </td>
                                            <td className="py-3 px-2 text-right">
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    Completado
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick Stats / Info */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-6">Estado del Sistema</h3>

                    <div className="space-y-4 flex-1">
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-slate-400">Conexión BD</span>
                                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Online
                                </span>
                            </div>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full w-full"></div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-slate-400">Inventario Saludable</span>
                                <span className="text-xs font-medium text-blue-400">
                                    {stats.articulosCount > 0 ? Math.round(((stats.articulosCount - stats.lowStockCount) / stats.articulosCount) * 100) : 0}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-blue-500 h-full transition-all duration-1000"
                                    style={{ width: `${stats.articulosCount > 0 ? ((stats.articulosCount - stats.lowStockCount) / stats.articulosCount) * 100 : 0}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                {stats.lowStockCount} artículos requieren atención
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-700">
                        <p className="text-xs text-slate-500 text-center">
                            SDMO v1.0.0 &copy; 2024
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
