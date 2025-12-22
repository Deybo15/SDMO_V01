import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
    ArrowLeft,
    FileSpreadsheet,
    Eraser,
    Loader2,
    Activity,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Search,
    X
} from 'lucide-react';

// --- CUSTOM VIRTUAL LIST IMPLEMENTATION ---
const VirtualList = ({
    height,
    width,
    itemCount,
    itemSize,
    children,
    onItemsRendered
}: {
    height: number;
    width: number;
    itemCount: number;
    itemSize: number;
    children: (props: { index: number; style: React.CSSProperties }) => React.ReactNode;
    onItemsRendered?: (props: { visibleStartIndex: number; visibleStopIndex: number }) => void;
}) => {
    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const totalHeight = itemCount * itemSize;

    const visibleStartIndex = Math.floor(scrollTop / itemSize);
    const visibleStopIndex = Math.min(
        itemCount - 1,
        Math.floor((scrollTop + height) / itemSize)
    );

    const overscan = 3;
    const startIndex = Math.max(0, visibleStartIndex - overscan);
    const endIndex = Math.min(itemCount - 1, visibleStopIndex + overscan);

    useEffect(() => {
        if (onItemsRendered) {
            onItemsRendered({ visibleStartIndex, visibleStopIndex });
        }
    }, [visibleStartIndex, visibleStopIndex, onItemsRendered]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    const items = [];
    for (let i = startIndex; i <= endIndex; i++) {
        items.push(
            children({
                index: i,
                style: {
                    position: 'absolute',
                    top: i * itemSize,
                    left: 0,
                    width: '100%',
                    height: itemSize,
                }
            })
        );
    }

    return (
        <div
            ref={containerRef}
            style={{ height, width, overflowY: 'auto', position: 'relative' }}
            onScroll={handleScroll}
        >
            <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
                {items}
            </div>
        </div>
    );
};

// --- CUSTOM AUTOSIZER HOOK ---
const useContainerSize = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return { ref, width: size.width, height: size.height };
};

// --- CUSTOM DEBOUNCE HOOK ---
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// --- SEARCHABLE DROPDOWN COMPONENT ---
const SearchableDropdown = ({
    options,
    value,
    onChange,
    placeholder
}: {
    options: string[],
    value: string,
    onChange: (val: string) => void,
    placeholder: string
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative flex items-center">
                <input
                    type="text"
                    className="filter-input pr-8 cursor-pointer"
                    placeholder={placeholder}
                    value={value || searchTerm} // Show value if selected, else search term (which is usually empty when closed)
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        onChange(e.target.value); // Allow typing to directly set value as well
                        setIsOpen(true);
                    }}
                    onClick={() => {
                        setSearchTerm('');
                        setIsOpen(!isOpen);
                    }}
                    readOnly={!!value && !isOpen} // Make readOnly if value is selected to force clear first? No, let's allow editing.
                />
                <div className="absolute right-2 flex items-center gap-1">
                    {value && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                                setSearchTerm('');
                            }}
                            className="text-gray-400 hover:text-white"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="text-gray-400 hover:text-white"
                    >
                        <Search className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 min-w-full w-max max-w-sm mt-1 bg-[#2d3241] border border-gray-600 rounded-md shadow-xl max-h-60 overflow-y-auto">
                    <input
                        type="text"
                        className="w-full p-2 bg-[#1a1d29] border-b border-gray-600 text-xs text-white sticky top-0 outline-none focus:border-blue-500"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, idx) => (
                            <div
                                key={idx}
                                className="px-3 py-2 text-xs text-gray-300 hover:bg-[#373c4b] cursor-pointer whitespace-normal break-words border-b border-white/5 last:border-0"
                                title={opt}
                                onClick={() => {
                                    onChange(opt);
                                    setIsOpen(false);
                                    setSearchTerm('');
                                }}
                            >
                                {opt}
                            </div>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-xs text-gray-500">No hay resultados</div>
                    )}
                </div>
            )}
        </div>
    );
};


interface SolicitudSTI {
    numero_solicitud: number;
    fecha_solicitud: string;
    descripcion_solicitud: string;
    nombre_cliente: string;
    dependencia_cliente: string;
    profesional_responsable: string;
    supervisor_asignado: string;
    instalacion_municipal: string;
    descripcion_area: string;
    estado_actual: string;
}

interface FilterOptions {
    nombre_cliente: string[];
    dependencia_cliente: string[];
    profesional_responsable: string[];
    supervisor_asignado: string[];
    instalacion_municipal: string[];
    descripcion_area: string[];
    estado_actual: string[];
}

interface Filters {
    nombre_cliente: string;
    dependencia_cliente: string;
    profesional_responsable: string;
    supervisor_asignado: string;
    instalacion_municipal: string;
    descripcion_area: string;
    estado_actual: string;
    fecha_inicio: string;
    fecha_fin: string;
    // Selects (Legacy support for query logic, now mapped to same fields)
    nombre_cliente_select: string;
    dependencia_cliente_select: string;
    profesional_responsable_select: string;
    supervisor_asignado_select: string;
    instalacion_municipal_select: string;
    descripcion_area_select: string;
    estado_actual_select: string;
}

const initialFilters: Filters = {
    nombre_cliente: '',
    dependencia_cliente: '',
    profesional_responsable: '',
    supervisor_asignado: '',
    instalacion_municipal: '',
    descripcion_area: '',
    estado_actual: '',
    fecha_inicio: '',
    fecha_fin: '',
    nombre_cliente_select: '',
    dependencia_cliente_select: '',
    profesional_responsable_select: '',
    supervisor_asignado_select: '',
    instalacion_municipal_select: '',
    descripcion_area_select: '',
    estado_actual_select: ''
};

type SortField = 'numero_solicitud' | 'fecha_solicitud' | 'nombre_cliente' | 'estado_actual';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
    field: SortField;
    direction: SortDirection;
}

export default function ConsultarEstadoSolicitud() {
    const navigate = useNavigate();

    // Custom AutoSizer
    const { ref: containerRef, width, height } = useContainerSize();

    // Data State
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        nombre_cliente: [],
        dependencia_cliente: [],
        profesional_responsable: [],
        supervisor_asignado: [],
        instalacion_municipal: [],
        descripcion_area: [],
        estado_actual: []
    });

    // Filter State
    const [filters, setFilters] = useState<Filters>(initialFilters);
    const debouncedFilters = useDebounce(filters, 500);

    // Sort State
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        field: 'numero_solicitud',
        direction: 'asc'
    });

    // --- REACT QUERY FETCHING ---
    const fetchSolicitudes = async ({ pageParam = 0 }) => {
        const PAGE_SIZE = 50;
        const from = pageParam * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase
            .from('vw_solicitudes_sti_estado')
            .select('*', { count: 'exact' });

        const f = debouncedFilters;

        if (f.nombre_cliente) query = query.ilike('nombre_cliente', `%${f.nombre_cliente}%`);
        if (f.dependencia_cliente) query = query.ilike('dependencia_cliente', `%${f.dependencia_cliente}%`);
        if (f.profesional_responsable) query = query.ilike('profesional_responsable', `%${f.profesional_responsable}%`);
        if (f.supervisor_asignado) query = query.ilike('supervisor_asignado', `%${f.supervisor_asignado}%`);
        if (f.instalacion_municipal) query = query.ilike('instalacion_municipal', `%${f.instalacion_municipal}%`);
        if (f.descripcion_area) query = query.ilike('descripcion_area', `%${f.descripcion_area}%`);
        if (f.estado_actual) query = query.ilike('estado_actual', `%${f.estado_actual}%`);

        if (f.fecha_inicio) query = query.gte('fecha_solicitud', f.fecha_inicio);
        if (f.fecha_fin) query = query.lte('fecha_solicitud', f.fecha_fin);

        const { data, count, error } = await query
            .order(sortConfig.field, { ascending: sortConfig.direction === 'asc' })
            .range(from, to);

        if (error) throw error;

        return {
            data: data || [],
            count: count || 0,
            nextPage: (data && data.length === PAGE_SIZE) ? pageParam + 1 : undefined
        };
    };

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    } = useInfiniteQuery({
        queryKey: ['solicitudes', debouncedFilters, sortConfig],
        queryFn: fetchSolicitudes,
        getNextPageParam: (lastPage) => lastPage.nextPage,
        initialPageParam: 0,
        refetchOnWindowFocus: false,
    });

    // Flatten data
    const allRows = useMemo(() => {
        return data?.pages.flatMap(page => page.data) || [];
    }, [data]);

    const totalRecords = data?.pages[0]?.count || 0;

    useEffect(() => {
        cargarOpcionesFiltro();
    }, []);

    const cargarOpcionesFiltro = async () => {
        try {
            // Fetch all distinct values for filters
            // Note: For large datasets, this should be optimized or done via RPC
            const { data } = await supabase
                .from('vw_solicitudes_sti_estado')
                .select('nombre_cliente, dependencia_cliente, profesional_responsable, supervisor_asignado, instalacion_municipal, descripcion_area, estado_actual');

            if (data) {
                const getUnique = (key: keyof SolicitudSTI) =>
                    [...new Set((data as any[]).map(item => item[key]).filter(Boolean))].sort() as string[];

                const estadosFromDb = getUnique('estado_actual');
                const estadosEsenciales = ['ACTIVA', 'CANCELADA', 'EJECUTADA'];
                const estadosFinales = [...new Set([...estadosEsenciales, ...estadosFromDb])].sort();

                setFilterOptions({
                    nombre_cliente: getUnique('nombre_cliente'),
                    dependencia_cliente: getUnique('dependencia_cliente'),
                    profesional_responsable: getUnique('profesional_responsable'),
                    supervisor_asignado: getUnique('supervisor_asignado'),
                    instalacion_municipal: getUnique('instalacion_municipal'),
                    descripcion_area: getUnique('descripcion_area'),
                    estado_actual: estadosFinales
                });
            }
        } catch (error) {
            console.error('Error cargando opciones:', error);
        }
    };

    const handleFilterChange = (key: keyof Filters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const limpiarFiltros = () => {
        setFilters(initialFilters);
    };

    const handleSort = (field: SortField) => {
        setSortConfig(current => ({
            field,
            direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const exportarExcel = async () => {
        if (confirm(`¿Desea exportar los ${totalRecords} registros que coinciden con los filtros?`)) {
            try {
                // Set a small toast or internal loading state if available, 
                // but since we don't have a specific global toast, we'll use console and alert for errors.
                let allData: any[] = [];
                const BATCH_SIZE = 1000;
                const totalPages = Math.ceil(totalRecords / BATCH_SIZE);

                console.log(`Iniciando exportación de ${totalRecords} registros en ${totalPages} lotes...`);

                for (let i = 0; i < totalPages; i++) {
                    const from = i * BATCH_SIZE;
                    const to = from + BATCH_SIZE - 1;

                    let query = supabase.from('vw_solicitudes_sti_estado').select('*');
                    const f = filters;

                    if (f.nombre_cliente) query = query.ilike('nombre_cliente', `%${f.nombre_cliente}%`);
                    if (f.dependencia_cliente) query = query.ilike('dependencia_cliente', `%${f.dependencia_cliente}%`);
                    if (f.profesional_responsable) query = query.ilike('profesional_responsable', `%${f.profesional_responsable}%`);
                    if (f.supervisor_asignado) query = query.ilike('supervisor_asignado', `%${f.supervisor_asignado}%`);
                    if (f.instalacion_municipal) query = query.ilike('instalacion_municipal', `%${f.instalacion_municipal}%`);
                    if (f.descripcion_area) query = query.ilike('descripcion_area', `%${f.descripcion_area}%`);
                    if (f.estado_actual) query = query.ilike('estado_actual', `%${f.estado_actual}%`);
                    if (f.fecha_inicio) query = query.gte('fecha_solicitud', f.fecha_inicio);
                    if (f.fecha_fin) query = query.lte('fecha_solicitud', f.fecha_fin);

                    const { data, error } = await query
                        .order(sortConfig.field, { ascending: sortConfig.direction === 'asc' })
                        .range(from, to);

                    if (error) throw error;
                    if (data) allData = [...allData, ...data];

                    console.log(`Lote ${i + 1}/${totalPages} completado...`);
                }

                if (allData.length === 0) {
                    alert('No hay datos para exportar con los filtros actuales.');
                    return;
                }

                const ws = XLSX.utils.json_to_sheet(allData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'STI Estado');
                XLSX.writeFile(wb, `reporte_sti_estado_${new Date().toISOString().split('T')[0]}.xlsx`);

            } catch (e: any) {
                alert('Error exportando: ' + e.message);
                console.error('Error in exportarExcel:', e);
            }
        }
    };

    const getEstadoClass = (estado: string) => {
        if (!estado) return 'estado-default';
        const estadoLower = estado.toLowerCase();
        if (estadoLower.includes('completado') || estadoLower.includes('finalizado') || estadoLower.includes('ejecutada')) return 'estado-completado';
        if (estadoLower.includes('proceso') || estadoLower.includes('progreso') || estadoLower.includes('activa')) return 'estado-proceso';
        if (estadoLower.includes('pendiente')) return 'estado-pendiente';
        if (estadoLower.includes('cancelado') || estadoLower.includes('rechazado') || estadoLower.includes('cancelada')) return 'estado-cancelado';
        return 'estado-default';
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortConfig.field !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />;
    };

    // Infinite Scroll Trigger
    const onItemsRendered = useCallback(({ visibleStopIndex }: { visibleStopIndex: number }) => {
        if (visibleStopIndex >= allRows.length - 5 && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [allRows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

    return (
        <div className="min-h-screen bg-[#1a1d29] text-[#e4e6ea] font-sans p-4 relative flex flex-col h-screen overflow-hidden">
            <style>{`
                .table-header-grid {
                    display: grid;
                    grid-template-columns: 70px 90px 1.5fr 1fr 1fr 1fr 1fr 1fr 1fr 100px;
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%);
                    color: white;
                    font-weight: 600;
                    text-transform: uppercase;
                    font-size: 0.7rem;
                    letter-spacing: 0.05em;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                .table-row-grid {
                    display: grid;
                    grid-template-columns: 70px 90px 1.5fr 1fr 1fr 1fr 1fr 1fr 1fr 100px;
                    align-items: start;
                    font-size: 0.75rem;
                    line-height: 1.2;
                }
                .content-card {
                    background: rgba(30, 34, 48, 0.8);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                .module-header {
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 1rem;
                    text-align: center;
                    flex-shrink: 0;
                }
                .filter-section {
                    background: rgba(30, 34, 48, 0.95);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 0.75rem;
                    flex-shrink: 0;
                }
                .filter-input, .filter-select {
                    background: rgba(45, 50, 65, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: #e4e6ea;
                    padding: 0.4rem;
                    border-radius: 0.5rem;
                    font-size: 0.75rem;
                    width: 100%;
                }
                .filter-input:focus, .filter-select:focus {
                    background: rgba(45, 50, 65, 0.8);
                    border-color: #667eea;
                    outline: none;
                }
                .estado-completado { background: rgba(40, 167, 69, 0.2); color: #28a745; border: 1px solid rgba(40, 167, 69, 0.3); }
                .estado-proceso { background: rgba(255, 193, 7, 0.2); color: #ffc107; border: 1px solid rgba(255, 193, 7, 0.3); }
                .estado-pendiente { background: rgba(23, 162, 184, 0.2); color: #17a2b8; border: 1px solid rgba(23, 162, 184, 0.3); }
                .estado-cancelado { background: rgba(220, 53, 69, 0.2); color: #dc3545; border: 1px solid rgba(220, 53, 69, 0.3); }
                .estado-default { background: rgba(108, 117, 125, 0.2); color: #6c757d; border: 1px solid rgba(108, 117, 125, 0.3); }
                
                /* Custom Scrollbar */
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: rgba(30, 34, 48, 0.5); }
                ::-webkit-scrollbar-thumb { background: rgba(102, 126, 234, 0.5); border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(102, 126, 234, 0.8); }
            `}</style>

            <div className="content-card">
                <div className="module-header">
                    <div className="flex items-center justify-center gap-3 text-lg font-semibold mb-1 text-[#667eea]">
                        <Activity className="w-5 h-5" />
                        <span>Vista STI con Estado Actual</span>
                    </div>
                </div>

                <div className="filter-section">
                    <div className="flex flex-wrap gap-2 items-center mb-3">
                        <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2d3241] hover:bg-[#373c4b] text-xs transition-colors">
                            <ArrowLeft className="w-3 h-3" /> Regresar
                        </button>
                        <button onClick={exportarExcel} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs transition-colors">
                            <FileSpreadsheet className="w-3 h-3" /> Exportar
                        </button>
                        <button onClick={limpiarFiltros} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-xs transition-colors">
                            <Eraser className="w-3 h-3" /> Limpiar
                        </button>
                        <div className="ml-auto text-xs text-gray-400 font-mono">
                            {totalRecords} registros
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                        <SearchableDropdown
                            options={filterOptions.nombre_cliente}
                            value={filters.nombre_cliente}
                            onChange={(val) => handleFilterChange('nombre_cliente', val)}
                            placeholder="Cliente..."
                        />
                        <SearchableDropdown
                            options={filterOptions.dependencia_cliente}
                            value={filters.dependencia_cliente}
                            onChange={(val) => handleFilterChange('dependencia_cliente', val)}
                            placeholder="Dependencia..."
                        />
                        <SearchableDropdown
                            options={filterOptions.profesional_responsable}
                            value={filters.profesional_responsable}
                            onChange={(val) => handleFilterChange('profesional_responsable', val)}
                            placeholder="Profesional..."
                        />
                        <SearchableDropdown
                            options={filterOptions.supervisor_asignado}
                            value={filters.supervisor_asignado}
                            onChange={(val) => handleFilterChange('supervisor_asignado', val)}
                            placeholder="Supervisor..."
                        />
                        <SearchableDropdown
                            options={filterOptions.instalacion_municipal}
                            value={filters.instalacion_municipal}
                            onChange={(val) => handleFilterChange('instalacion_municipal', val)}
                            placeholder="Instalación..."
                        />
                        <SearchableDropdown
                            options={filterOptions.descripcion_area}
                            value={filters.descripcion_area}
                            onChange={(val) => handleFilterChange('descripcion_area', val)}
                            placeholder="Área..."
                        />
                        <SearchableDropdown
                            options={filterOptions.estado_actual}
                            value={filters.estado_actual}
                            onChange={(val) => handleFilterChange('estado_actual', val)}
                            placeholder="Estado..."
                        />
                        <div className="flex flex-col gap-1">
                            <input
                                type="date"
                                className="filter-input !py-0.5 h-7"
                                value={filters.fecha_inicio}
                                onChange={(e) => handleFilterChange('fecha_inicio', e.target.value)}
                                title="Fecha Inicio"
                            />
                            <input
                                type="date"
                                className="filter-input !py-0.5 h-7"
                                value={filters.fecha_fin}
                                onChange={(e) => handleFilterChange('fecha_fin', e.target.value)}
                                title="Fecha Fin"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative" ref={containerRef}>
                    {/* Header Row (Fixed) */}
                    <div className="table-header-grid pr-2">
                        <div
                            className="p-2 cursor-pointer hover:bg-white/5 flex items-center gap-1"
                            onClick={() => handleSort('numero_solicitud')}
                        >
                            # <SortIcon field="numero_solicitud" />
                        </div>
                        <div
                            className="p-2 cursor-pointer hover:bg-white/5 flex items-center gap-1"
                            onClick={() => handleSort('fecha_solicitud')}
                        >
                            Fecha <SortIcon field="fecha_solicitud" />
                        </div>
                        <div className="p-2">Descripción</div>
                        <div
                            className="p-2 cursor-pointer hover:bg-white/5 flex items-center gap-1"
                            onClick={() => handleSort('nombre_cliente')}
                        >
                            Cliente <SortIcon field="nombre_cliente" />
                        </div>
                        <div className="p-2">Dependencia</div>
                        <div className="p-2">Profesional</div>
                        <div className="p-2">Supervisor</div>
                        <div className="p-2">Instalación</div>
                        <div className="p-2">Área</div>
                        <div
                            className="p-2 cursor-pointer hover:bg-white/5 flex items-center gap-1"
                            onClick={() => handleSort('estado_actual')}
                        >
                            Estado <SortIcon field="estado_actual" />
                        </div>
                    </div>

                    {/* Virtual List */}
                    <div className="h-[calc(100%-35px)] w-full relative">
                        {isLoading && allRows.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#1a1d29]/50">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            </div>
                        ) : null}

                        {width > 0 && height > 0 && (
                            <VirtualList
                                height={height - 35}
                                width={width}
                                itemCount={totalRecords}
                                itemSize={70} // Increased row height for wrapping
                                onItemsRendered={onItemsRendered}
                            >
                                {({ index, style }) => {
                                    const row = allRows[index];

                                    if (!row) {
                                        return (
                                            <div style={style} key={index} className="flex items-center justify-center text-gray-500 bg-[#2d3241]/50 border-b border-white/5">
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando...
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={index} style={style} className={`table-row-grid ${index % 2 === 0 ? 'bg-[#2d3241]/20' : 'bg-[#2d3241]/40'} hover:bg-[#2d3241]/60 transition-colors border-b border-white/5`}>
                                            <div className="p-2 truncate font-mono text-xs text-blue-300" title={row.numero_solicitud.toString()}>{row.numero_solicitud}</div>
                                            <div className="p-2 truncate" title={row.fecha_solicitud}>{row.fecha_solicitud ? new Date(row.fecha_solicitud).toLocaleDateString('es-ES') : ''}</div>
                                            <div className="p-2 line-clamp-3 overflow-hidden" title={row.descripcion_solicitud}>{row.descripcion_solicitud}</div>
                                            <div className="p-2 line-clamp-3 overflow-hidden" title={row.nombre_cliente}>{row.nombre_cliente}</div>
                                            <div className="p-2 line-clamp-3 overflow-hidden" title={row.dependencia_cliente}>{row.dependencia_cliente}</div>
                                            <div className="p-2 line-clamp-3 overflow-hidden" title={row.profesional_responsable}>{row.profesional_responsable}</div>
                                            <div className="p-2 line-clamp-3 overflow-hidden" title={row.supervisor_asignado}>{row.supervisor_asignado}</div>
                                            <div className="p-2 line-clamp-3 overflow-hidden" title={row.instalacion_municipal}>{row.instalacion_municipal}</div>
                                            <div className="p-2 line-clamp-3 overflow-hidden" title={row.descripcion_area}>{row.descripcion_area}</div>
                                            <div className="p-2 flex items-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${getEstadoClass(row.estado_actual)}`}>
                                                    {row.estado_actual || 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }}
                            </VirtualList>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
