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
        <div className="flex h-screen bg-[#000000] text-[#F5F5F7] overflow-hidden font-sans">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#121212] border-b border-[#333333] flex items-center justify-between px-6 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[4px] bg-[#0071E3] flex items-center justify-center shadow-lg shadow-[#0071E3]/20">
                        <span className="text-white font-black text-sm italic">S</span>
                    </div>
                    <span className="text-white font-black text-lg tracking-tighter uppercase italic">SDMO</span>
                </div>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-[#86868B] hover:text-white transition-colors"
                >
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/80 z-[60] md:hidden backdrop-blur-[20px] transition-opacity"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar (Desktop & Mobile Drawer) */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-[70] bg-[#121212] border-r border-[#333333] transition-[width,transform] duration-300 cubic-bezier(0.4, 0, 0.2, 1) md:translate-x-0 md:static md:flex md:flex-col group/sidebar",
                mobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full w-72 md:w-24 md:hover:w-72"
            )}>
                {/* Header / Logo */}
                <div className="p-8 hidden md:block overflow-hidden relative">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-[4px] bg-[#0071E3] flex items-center justify-center shadow-2xl shadow-[#0071E3]/20 shrink-0">
                            <span className="text-white font-black text-2xl italic">S</span>
                        </div>
                        <div className="flex flex-col opacity-0 scale-95 group-hover/sidebar:opacity-100 group-hover/sidebar:scale-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
                            <h1 className="text-2xl font-black text-white tracking-tighter leading-none uppercase italic">
                                SDMO
                            </h1>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-none">
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
                                    "group/item flex items-center gap-5 px-5 py-4 text-[11px] font-black uppercase tracking-widest rounded-[8px] transition-all duration-200 relative overflow-hidden outline-none border",
                                    isActive
                                        ? "bg-[#0071E3] text-white border-[#0071E3]/20 shadow-lg shadow-[#0071E3]/20"
                                        : "text-[#86868B] hover:text-white hover:bg-white/5 border-transparent"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        "w-5 h-5 shrink-0 transition-transform duration-200",
                                        isActive ? "text-white scale-110" : "text-[#86868B] group-hover/item:text-white"
                                    )}
                                />
                                <span className={cn(
                                    "transition-all duration-300 whitespace-nowrap overflow-hidden transform",
                                    "opacity-0 scale-95 group-hover/sidebar:opacity-100 group-hover/sidebar:scale-100"
                                )}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile & Logout */}
                <div className="p-4 border-t border-[#333333] bg-black/20 overflow-hidden">
                    <div className="bg-[#1D1D1F] px-4 py-5 rounded-[8px] border border-[#333333] transition-all duration-300">
                        <div className="flex items-center gap-4 mb-0 md:group-hover/sidebar:mb-6">
                            <div className="w-10 h-10 rounded-[4px] bg-black/40 flex items-center justify-center border border-[#333333] shrink-0">
                                <UserCircle2 className="w-6 h-6 text-[#86868B]" />
                            </div>
                            <div className="flex flex-col opacity-0 scale-95 group-hover/sidebar:opacity-100 group-hover/sidebar:scale-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
                                <p className="text-[12px] font-black text-white truncate tracking-tight uppercase">Usuario</p>
                                <p className="text-[9px] text-[#86868B] truncate font-black tracking-widest uppercase">dgamboa@msj.go.cr</p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className={cn(
                                "flex items-center justify-center gap-3 w-full mt-2 md:mt-0 px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-[#86868B] hover:text-rose-500 hover:bg-rose-500/10 rounded-[8px] border border-transparent hover:border-rose-500/20 transition-all duration-200 overflow-hidden",
                                "md:h-0 md:opacity-0 md:group-hover/sidebar:h-12 md:group-hover/sidebar:opacity-100 md:group-hover/sidebar:mt-2"
                            )}
                        >
                            <LogOut className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap overflow-hidden">Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-[#000000] pt-16 md:pt-0">
                <div className="p-0">
                    <Outlet />
                </div>
            </main>

            {/* Global Features */}
            <CommandPalette />
        </div>
    );
}
