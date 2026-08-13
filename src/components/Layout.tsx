import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, Package, Users, Building2, ClipboardList, Settings2, Wrench, LogOut, UserCircle2, Menu, X, Calculator, History, RefreshCw, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import CommandPalette from './CommandPalette';

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();

    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        // Fetch current user
        const getCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email ?? null);
                setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario');
            }
        };

        getCurrentUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUserEmail(session.user.email ?? null);
                setUserName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario');
            } else {
                setUserEmail(null);
                setUserName(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Inicio', path: '/' },
        { icon: Layers, label: 'Proyectos de Obra', path: '/proyectos-obra' },
        { icon: Package, label: 'Gestión de Artículos', path: '/articulos' },
        { icon: Users, label: 'Cliente Interno', path: '/cliente-interno' },
        { icon: Building2, label: 'Cliente Externo', path: '/cliente-externo' },
        { icon: ClipboardList, label: 'Otras Solicitudes', path: '/otras-solicitudes' },
        { icon: Settings2, label: 'Gestión Interna', path: '/gestion-interna' },
        { icon: RefreshCw, label: 'Gestión de Cambios', path: '/gestion-cambios' },
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
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0A0A0A] border-b border-[#2A2A2D] flex items-center justify-between px-5 z-50">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-9 rounded-[6px] bg-[#111111] border border-[#3A3A3D] flex items-center justify-center shrink-0">
                        <span className="text-[#F5F5F5] font-bold text-[9px] tracking-tight">SDMO</span>
                    </div>
                    <span className="text-[#F5F5F5] font-semibold text-[10px] leading-tight tracking-[0.04em] uppercase max-w-52">
                        {'SECCI\u00D3N DESARROLLO Y MANTENIMIENTO DE OBRAS'}
                    </span>
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
                "fixed inset-y-0 left-0 z-[70] bg-[#0A0A0A] border-r border-[#2A2A2D] transition-[width,transform] duration-300 cubic-bezier(0.4, 0, 0.2, 1) md:translate-x-0 md:static md:flex md:flex-col group/sidebar",
                mobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full w-72 md:w-24 md:hover:w-72"
            )}>
                {/* Header / Logo */}
                <div className="px-[22px] py-7 hidden md:block overflow-hidden relative">
                    <div className="flex items-center gap-4">
                        <div className="w-[50px] h-[50px] rounded-[7px] bg-[#111111] border border-[#3A3A3D] flex items-center justify-center shrink-0">
                            <span className="text-[#F5F5F5] font-bold text-[11px] tracking-tight">SDMO</span>
                        </div>
                        <div className="flex flex-col opacity-0 scale-95 group-hover/sidebar:opacity-100 group-hover/sidebar:scale-100 transition-all duration-300 overflow-hidden">
                            <h1 className="w-40 text-[11px] font-semibold text-[#F5F5F5] tracking-[0.04em] leading-[1.25] uppercase">
                                {'SECCI\u00D3N DESARROLLO Y MANTENIMIENTO DE OBRAS'}
                            </h1>
                        </div>
                    </div>
                    <div className="mt-7 h-px bg-[#2A2A2D] opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-none">
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
                                    "group/item flex items-center gap-5 px-[22px] py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-[9px] transition-all duration-200 relative overflow-hidden outline-none border",
                                    isActive
                                        ? "bg-[#1B1B1D] text-[#F5F5F5] border-[#2A2A2D] before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-0.5 before:rounded-full before:bg-white"
                                        : "text-[#909096] hover:text-[#F5F5F5] hover:bg-[#141414] border-transparent"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        "w-5 h-5 shrink-0 transition-colors duration-200",
                                        isActive ? "text-[#F5F5F5]" : "text-[#77777D] group-hover/item:text-[#D4D4D6]"
                                    )}
                                />
                                <span className={cn(
                                    "transition-all duration-300 whitespace-nowrap overflow-hidden transform",
                                    "opacity-100 scale-100 md:opacity-0 md:scale-95 md:group-hover/sidebar:opacity-100 md:group-hover/sidebar:scale-100"
                                )}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile & Logout */}
                <div className="px-3 py-4 border-t border-[#2A2A2D] bg-[#0A0A0A] overflow-hidden">
                    <div className="px-[10px] transition-all duration-300">
                        <div className="flex items-center gap-4 mb-0 md:group-hover/sidebar:mb-4">
                            <div className="w-12 h-12 rounded-full bg-[#111111] flex items-center justify-center border border-[#3A3A3D] shrink-0">
                                <UserCircle2 className="w-6 h-6 text-[#909096]" />
                            </div>
                            <div className="flex flex-col opacity-100 scale-100 md:opacity-0 md:scale-95 md:group-hover/sidebar:opacity-100 md:group-hover/sidebar:scale-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
                                <p className="text-[12px] font-bold text-[#F5F5F5] truncate tracking-[0.04em] uppercase">
                                    {userName || 'Cargando...'}
                                </p>
                                <p className="text-[9px] text-[#909096] truncate font-medium tracking-[0.1em] uppercase mt-1">
                                    {userEmail || 'Iniciando sesión...'}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className={cn(
                                "flex items-center justify-start gap-3 w-full mt-2 md:mt-0 px-3 py-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#909096] hover:text-white hover:bg-[#141414] rounded-[8px] border-t border-[#2A2A2D] transition-all duration-200 overflow-hidden",
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
