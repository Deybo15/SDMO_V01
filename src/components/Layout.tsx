import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, Package, Users, Building2, ClipboardList, Settings2, Wrench, LogOut, UserCircle2, Menu, X, Calculator } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

export default function Layout() {
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
        { icon: Calculator, label: 'Proyección Compras', path: '/gestion-interna/proyeccion-compras' },
        { icon: Wrench, label: 'Gestión de Activos', path: '/activos' },

    ];

    // Mobile Menu State
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    // Close mobile menu on route change
    React.useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-950 border-b border-slate-800/50 flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <span className="text-white font-bold text-lg">S</span>
                    </div>
                    <span className="text-white font-bold text-lg tracking-tight">SDMO</span>
                </div>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar (Desktop & Mobile Drawer) */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-[70] bg-slate-950 border-r border-slate-800/50 shadow-2xl transition-all duration-300 ease-in-out md:translate-x-0 md:static md:flex md:flex-col group/sidebar",
                mobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full w-72 md:w-20 md:hover:w-72"
            )}>
                {/* Header / Logo */}
                <div className="p-6 md:p-4 md:group-hover/sidebar:p-8 transition-all duration-300 hidden md:block overflow-hidden">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                            <span className="text-white font-bold text-xl">S</span>
                        </div>
                        <div className="flex flex-col opacity-0 group-hover/sidebar:opacity-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
                            <h1 className="text-2xl font-bold text-white tracking-tight leading-none mb-1">
                                SDMO
                            </h1>
                            <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">Municipalidad de San José</p>
                        </div>
                    </div>
                </div>

                {/* Mobile Drawer Header */}
                <div className="p-6 border-b border-slate-800/50 md:hidden flex items-center justify-between bg-slate-900/50">
                    <span className="text-sm font-semibold text-slate-400">Menú de Navegación</span>
                    <button onClick={() => setMobileMenuOpen(false)}>
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {navItems.map((item) => {
                        const matchingItems = navItems.filter(navItem =>
                            navItem.path === '/'
                                ? location.pathname === '/'
                                : location.pathname.startsWith(navItem.path)
                        );

                        const bestMatch = matchingItems.sort((a, b) => b.path.length - a.path.length)[0];
                        const isActive = bestMatch?.path === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "group/item flex items-center gap-4 px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200 relative",
                                    isActive
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-900"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        "w-6 h-6 shrink-0 transition-transform duration-200",
                                        isActive ? "text-white" : "text-slate-500 group-hover/item:text-slate-300"
                                    )}
                                />
                                <span className={cn(
                                    "transition-all duration-300 whitespace-nowrap overflow-hidden",
                                    "opacity-0 group-hover/sidebar:opacity-100",
                                    isActive ? "font-semibold" : ""
                                )}>
                                    {item.label}
                                </span>

                                {/* Tooltip for collapsed state */}
                                <div className="absolute left-full ml-6 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 pointer-events-none group-hover/item:opacity-100 group-hover/sidebar:hidden transition-opacity whitespace-nowrap z-[100] border border-slate-700 shadow-xl">
                                    {item.label}
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile & Logout */}
                <div className="p-3 border-t border-slate-800/50 bg-slate-950 overflow-hidden">
                    <div className="bg-slate-900/50 rounded-2xl p-2.5 md:group-hover/sidebar:p-4 border border-slate-800/50 hover:border-slate-700 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-0 md:group-hover/sidebar:mb-3">
                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                                <UserCircle2 className="w-5 h-5 md:w-6 md:h-6 text-slate-400" />
                            </div>
                            <div className="flex flex-col opacity-0 group-hover/sidebar:opacity-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
                                <p className="text-sm font-semibold text-white truncate">Usuario</p>
                                <p className="text-[10px] text-slate-500 truncate">dgamboa@msj.go.cr</p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className={cn(
                                "flex items-center justify-center gap-2 w-full mt-2 md:mt-0 px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 overflow-hidden",
                                "md:h-0 md:opacity-0 md:group-hover/sidebar:h-8 md:group-hover/sidebar:opacity-100 md:group-hover/sidebar:mt-1"
                            )}
                        >
                            <LogOut className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap overflow-hidden">Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 pt-16 md:pt-0">
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
