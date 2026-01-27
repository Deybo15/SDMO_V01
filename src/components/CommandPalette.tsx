import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    X,
    FileText,
    MapPin,
    Package,
    Command,
    ChevronRight,
    Loader2,
    Users,
    Construction
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

type SearchResult = {
    id: string | number;
    title: string;
    subtitle: string;
    type: 'solicitud' | 'instalacion' | 'articulo' | 'page' | 'activo' | 'colaborador';
    path: string;
};

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();

    // Pages for quick navigation
    const pages: SearchResult[] = [
        { id: 'p1', title: 'Dashboard de Mantenimiento', subtitle: 'Panel principal y KPIs', type: 'page', path: '/' },
        { id: 'p2', title: 'Gestión de Artículos', subtitle: 'Inventario y materiales', type: 'page', path: '/articulos' },
        { id: 'p3', title: 'Cliente Interno', subtitle: 'Solicitudes institucionales', type: 'page', path: '/cliente-interno' },
        { id: 'p4', title: 'Gestión de Activos', subtitle: 'Inventario de activos fijos', type: 'page', path: '/activos' },
    ];

    // Toggle palette with Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Search logic
    useEffect(() => {
        if (!query.trim()) {
            setResults(pages.filter(p => p.title.toLowerCase().includes(query.toLowerCase())));
            return;
        }

        const fetchResults = async () => {
            setIsLoading(true);
            const searchTerm = `%${query}%`;

            try {
                const [solicitudes, instalaciones, articulos, activos, colaboradores] = await Promise.all([
                    supabase.from('solicitud_17').select('numero_solicitud, descripcion').ilike('numero_solicitud::text', searchTerm).limit(3),
                    supabase.from('ubicaciones_01').select('id, nombre_ubicacion, alias').or(`nombre_ubicacion.ilike.${searchTerm},alias.ilike.${searchTerm}`).limit(3),
                    supabase.from('articulo_01').select('codigo_articulo, nombre_articulo').or(`nombre_articulo.ilike.${searchTerm},codigo_articulo.ilike.${searchTerm}`).limit(3),
                    supabase.from('activos_50').select('numero_activo, nombre_corto_activo').or(`nombre_corto_activo.ilike.${searchTerm},numero_activo::text.ilike.${searchTerm}`).limit(3),
                    supabase.from('colaboradores_06').select('identificacion, colaborador, alias').or(`colaborador.ilike.${searchTerm},identificacion.ilike.${searchTerm}`).limit(3)
                ]);

                const formattedResults: SearchResult[] = [
                    ...pages.filter(p => p.title.toLowerCase().includes(query.toLowerCase())),
                    ...(solicitudes.data?.map(s => ({
                        id: s.numero_solicitud,
                        title: `Solicitud #${s.numero_solicitud}`,
                        subtitle: s.descripcion || 'Sin descripción',
                        type: 'solicitud' as const,
                        path: `/consultar-solicitudes?search=${s.numero_solicitud}`
                    })) || []),
                    ...(instalaciones.data?.map(i => ({
                        id: i.id,
                        title: i.nombre_ubicacion,
                        subtitle: i.alias || 'Instalación Municipal',
                        type: 'instalacion' as const,
                        path: `/consultar-solicitudes?ubicacion=${i.id}`
                    })) || []),
                    ...(articulos.data?.map(a => ({
                        id: a.codigo_articulo,
                        title: a.nombre_articulo,
                        subtitle: a.codigo_articulo || 'Sin código',
                        type: 'articulo' as const,
                        path: `/articulos?search=${a.codigo_articulo}`
                    })) || []),
                    ...(activos.data?.map(a => ({
                        id: a.numero_activo,
                        title: a.nombre_corto_activo,
                        subtitle: `Activo #${a.numero_activo}`,
                        type: 'activo' as const,
                        path: `/activos/consulta?search=${a.numero_activo}`
                    })) || []),
                    ...(colaboradores.data?.map(c => ({
                        id: c.identificacion,
                        title: c.colaborador,
                        subtitle: `${c.identificacion} ${c.alias ? `(${c.alias})` : ''}`,
                        type: 'colaborador' as const,
                        path: `/gestion-interna/colaboradores?colaborador=${encodeURIComponent(c.colaborador)}`
                    })) || []),
                ];

                setResults(formattedResults);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsLoading(false);
                setSelectedIndex(0);
            }
        };

        const debounce = setTimeout(fetchResults, 300);
        return () => clearTimeout(debounce);
    }, [query]);

    const handleSelect = (result: SearchResult) => {
        navigate(result.path);
        setIsOpen(false);
        setQuery('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 sm:px-6">
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsOpen(false)} />

            <div className="relative w-full max-w-2xl glass-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/5">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input
                        autoFocus
                        className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder:text-slate-500"
                        placeholder="Buscar solicitudes, instalaciones, artículos o navegar..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <Command className="w-3 h-3" /> K
                        </div>
                    )}
                </div>

                {/* Results List */}
                <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {results.length > 0 ? (
                        <div className="space-y-1">
                            {results.map((result, index) => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    onClick={() => handleSelect(result)}
                                    className={cn(
                                        "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 text-left group",
                                        selectedIndex === index ? "bg-blue-600 shadow-lg shadow-blue-500/20" : "hover:bg-white/5"
                                    )}
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                        selectedIndex === index ? "bg-white/20" : "bg-slate-800 border border-white/10"
                                    )}>
                                        {result.type === 'solicitud' && <FileText className="w-5 h-5 text-blue-400 group-hover:text-white" />}
                                        {result.type === 'instalacion' && <MapPin className="w-5 h-5 text-emerald-400 group-hover:text-white" />}
                                        {result.type === 'articulo' && <Package className="w-5 h-5 text-orange-400 group-hover:text-white" />}
                                        {result.type === 'activo' && <Construction className="w-5 h-5 text-amber-500 group-hover:text-white" />}
                                        {result.type === 'colaborador' && <Users className="w-5 h-5 text-sky-400 group-hover:text-white" />}
                                        {result.type === 'page' && <ChevronRight className="w-5 h-5 text-purple-400 group-hover:text-white" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            "text-sm font-bold truncate",
                                            selectedIndex === index ? "text-white" : "text-slate-200"
                                        )}>
                                            {result.title}
                                        </p>
                                        <p className={cn(
                                            "text-xs truncate",
                                            selectedIndex === index ? "text-blue-100" : "text-slate-500"
                                        )}>
                                            {result.subtitle}
                                        </p>
                                    </div>

                                    {selectedIndex === index && (
                                        <div className="text-[10px] font-black uppercase tracking-tighter text-white/60">
                                            Intro
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <Search className="w-12 h-12 text-slate-800 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">No se encontraron resultados para "{query}"</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-white/10 bg-slate-950/50 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">↓↑</kbd> Navegar</span>
                        <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">Enter</kbd> Seleccionar</span>
                    </div>
                    <span>Ctrl + K para cerrar</span>
                </div>
            </div>
        </div>
    );
}
