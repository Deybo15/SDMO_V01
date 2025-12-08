import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Users, Building2, ClipboardList, Settings2, Wrench, LogOut, UserCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

export default function Layout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Inicio', path: '/' },
        { icon: Package, label: 'Gestión de Artículos', path: '/articulos' },
        { icon: Users, label: 'Cliente Interno', path: '/cliente-interno' },
        { icon: Building2, label: 'Cliente Externo', path: '/cliente-externo' },
        { icon: ClipboardList, label: 'Otras Solicitudes', path: '/otras-solicitudes' },
        { icon: Settings2, label: 'Gestión Interna', path: '/gestion-interna' },
        { icon: Wrench, label: 'Gestión de Activos', path: '/activos' },

    ];

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex flex-col w-72 bg-slate-950 border-r border-slate-800/50 h-screen sticky top-0 shadow-2xl z-50">
                {/* Header / Logo */}
                <div className="p-8 pb-6">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <span className="text-white font-bold text-lg">S</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            SDMO
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500 font-medium tracking-wider pl-11 uppercase">Municipalidad de San José</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "group flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                                    isActive
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-900"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        "w-5 h-5 transition-transform duration-200",
                                        isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                                    )}
                                />
                                <span className={isActive ? "font-semibold" : ""}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile & Logout */}
                <div className="p-4 border-t border-slate-800/50 bg-slate-950">
                    <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50 hover:border-slate-700 transition-colors group">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                <UserCircle2 className="w-6 h-6 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">Usuario</p>
                                <p className="text-xs text-slate-500 truncate">dgamboa@msj.go.cr</p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
