import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, Package, Users, Building2, ClipboardList, Settings2, Wrench, LogOut, UserCircle2, Menu, X, Calculator, History } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import CommandPalette from './CommandPalette';

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
        { icon: History, label: 'Historial Auditoría', path: '/gestion-interna/auditoria' },

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
                "fixed inset-y-0 left-0 z-[70] glass-dark border-r border-white/5 shadow-2xl transition-[width,transform] duration-300 cubic-bezier(0.4, 0, 0.2, 1) md:translate-x-0 md:static md:flex md:flex-col group/sidebar",
                mobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full w-72 md:w-24 md:hover:w-72"
            )}>
                {/* Header / Logo */}
                <div className="p-6 md:p-6 md:group-hover/sidebar:p-8 transition-all duration-300 hidden md:block overflow-hidden relative">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-500/20 shrink-0 animate-float">
                            <span className="text-white font-black text-2xl tracking-tighter">S</span>
                        </div>
                        <div className="flex flex-col opacity-0 scale-95 group-hover/sidebar:opacity-100 group-hover/sidebar:scale-100 transition-[opacity,transform] duration-300 whitespace-nowrap overflow-hidden">
                            <h1 className="text-2xl font-black text-white tracking-tighter leading-none mb-1">
                                SDMO
                            </h1>
                            <p className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Municipalidad</p>
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
                        // Improved active logic: find matching items and pick the most specific one
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
                                    "group/item flex items-center gap-4 px-4 py-3.5 text-sm font-bold rounded-2xl transition-[background-color,color,border-color,transform,opacity] duration-200 relative overflow-hidden outline-none border",
                                    isActive
                                        ? "bg-blue-600/10 text-blue-400 inner-glow border-blue-500/20"
                                        : "text-slate-500 hover:text-white hover:bg-white/5 border-transparent"
                                )}
                            >
                                {isActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-r-full shadow-[4px_0_15px_rgba(59,130,246,0.5)] pointer-events-none" />
                                )}
                                <item.icon
                                    className={cn(
                                        "w-6 h-6 shrink-0 transition-all duration-200",
                                        isActive ? "text-blue-400 scale-110" : "text-slate-600 group-hover/item:text-slate-300"
                                    )}
                                />
                                <span className={cn(
                                    "transition-[opacity,transform] duration-300 whitespace-nowrap overflow-hidden transform",
                                    "opacity-0 scale-95 group-hover/sidebar:opacity-100 group-hover/sidebar:scale-100",
                                    isActive ? "text-blue-400" : ""
                                )}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile & Logout */}
                <div className="p-4 border-t border-white/5 bg-black/20 overflow-hidden">
                    <div className="glass px-3 py-3 md:group-hover/sidebar:px-4 md:group-hover/sidebar:py-5 rounded-3xl border border-white/5 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-0 md:group-hover/sidebar:mb-5">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center border border-white/10 shrink-0 shadow-lg">
                                <UserCircle2 className="w-6 h-6 text-slate-400" />
                            </div>
                            <div className="flex flex-col opacity-0 scale-95 group-hover/sidebar:opacity-100 group-hover/sidebar:scale-100 transition-[opacity,transform] duration-300 whitespace-nowrap overflow-hidden">
                                <p className="text-sm font-black text-white truncate tracking-tight">Usuario</p>
                                <p className="text-[10px] text-slate-500 truncate font-bold">dgamboa@msj.go.cr</p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className={cn(
                                "flex items-center justify-center gap-3 w-full mt-2 md:mt-0 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-2xl border border-transparent hover:border-red-500/20 transition-all duration-200 overflow-hidden",
                                "md:h-0 md:opacity-0 md:group-hover/sidebar:h-10 md:group-hover/sidebar:opacity-100 md:group-hover/sidebar:mt-1"
                            )}
                        >
                            <LogOut className="w-4 h-4 shrink-0" />
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

            {/* Global Features */}
            <CommandPalette />
        </div>
    );
}
