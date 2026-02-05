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
    X,
    LayoutGrid,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

// Pagination size
const PAGE_SIZE = 20;


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
            <div className="relative flex items-center group">
                <input
                    type="text"
                    className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] h-10 px-4 pr-12 text-xs text-[#F5F5F7] font-bold placeholder:text-[#424245] focus:border-[#0071E3]/50 transition-all outline-none cursor-pointer"
                    placeholder={placeholder}
                    value={value || searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onClick={() => {
                        setSearchTerm('');
                        setIsOpen(!isOpen);
                    }}
                />
                <div className="absolute right-3 flex items-center gap-2">
                    {value && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                                setSearchTerm('');
                            }}
                            className="text-[#86868B] hover:text-[#F5F5F7] transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <Search className="w-3.5 h-3.5 text-[#424245] group-focus-within:text-[#0071E3] transition-colors" />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 min-w-full w-max max-w-sm mt-4 bg-black/80 backdrop-blur-[20px] border border-[#333333] rounded-[8px] shadow-4xl max-h-64 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-[#333333] bg-black/20">
                        <input
                            type="text"
                            className="w-full h-8 px-4 bg-[#121212] border border-[#333333] rounded-[8px] text-xs text-white outline-none focus:border-[#0071E3]/40 transition-all"
                            placeholder="Buscar en la lista..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, idx) => (
                                <div
                                    key={idx}
                                    className="px-4 py-2.5 text-[11px] font-bold text-[#86868B] hover:bg-white/5 hover:text-[#0071E3] cursor-pointer whitespace-normal break-words border-b border-white/[0.03] last:border-0 transition-colors"
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
                            <div className="px-4 py-6 text-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#424245]">Sin resultados</p>
                            </div>
                        )}
                    </div>
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

    // Pagination State
    const [page, setPage] = useState(0);

    // Sort State
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        field: 'numero_solicitud',
        direction: 'desc'
    });

    // --- REACT QUERY FETCHING ---
    const fetchSolicitudes = async () => {
        const from = page * PAGE_SIZE;
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
            count: count || 0
        };
    };

    const {
        data,
        isLoading,
        isFetching
    } = useQuery({
        queryKey: ['solicitudes', page, debouncedFilters, sortConfig],
        queryFn: fetchSolicitudes,
        refetchOnWindowFocus: false,
    });

    const allRows = data?.data || [];
    const totalRecords = data?.count || 0;
    const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

    useEffect(() => {
        cargarOpcionesFiltro();
    }, []);

    const cargarOpcionesFiltro = async () => {
        try {
            let allData: any[] = [];
            let hasMore = true;
            let offset = 0;
            const BATCH_SIZE = 1000;

            // Fetch all records in batches to get complete filter options
            while (hasMore) {
                const { data, error } = await supabase
                    .from('vw_solicitudes_sti_estado')
                    .select('nombre_cliente, dependencia_cliente, profesional_responsable, supervisor_asignado, instalacion_municipal, descripcion_area, estado_actual')
                    .range(offset, offset + BATCH_SIZE - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += BATCH_SIZE;
                    hasMore = data.length === BATCH_SIZE;
                    // Safety break to prevent infinite loops if something goes wrong
                    if (offset > 50000) break;
                } else {
                    hasMore = false;
                }
            }

            if (allData.length > 0) {
                const getUnique = (key: keyof SolicitudSTI) =>
                    [...new Set(allData.map(item => item[key]).filter(Boolean))].sort() as string[];

                const estadosFromDb = getUnique('estado_actual');
                const estadosEsenciales = ['ACTIVA', 'CANCELADA', 'EJECUTADA'];
                const estadosFinales = [...new Set([...estadosEsenciales, ...estadosFromDb])].sort();

                // Get all active collaborators (Aliases) for Professional and Supervisor fields
                const { data: collabData } = await supabase
                    .from('colaboradores_06')
                    .select('alias')
                    .eq('condicion_laboral', false)
                    .order('alias', { ascending: true });

                const { data: supervisorData } = await supabase
                    .from('colaboradores_06')
                    .select('alias')
                    .eq('supervisor', true)
                    .eq('condicion_laboral', false)
                    .order('alias', { ascending: true });

                const allCollabs = [...new Set(collabData?.map(c => c.alias).filter(Boolean) || [])].sort();
                const allSupervisors = [...new Set(supervisorData?.map(c => c.alias).filter(Boolean) || [])].sort();

                setFilterOptions({
                    nombre_cliente: getUnique('nombre_cliente'),
                    dependencia_cliente: getUnique('dependencia_cliente'),
                    profesional_responsable: allCollabs,
                    supervisor_asignado: allSupervisors,
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
        setPage(0); // Reset to first page on filter change
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
                XLSX.writeFile(wb, `reporte_sti_estado_${new Date().toLocaleDateString('en-CA')}.xlsx`);

            } catch (e: any) {
                alert('Error exportando: ' + e.message);
                console.error('Error in exportarExcel:', e);
            }
        }
    };

    const getEstadoClass = (estado: string) => {
        if (!estado) return 'bg-[#333333]/10 text-[#86868B] border-[#333333]';
        const estadoUpper = estado.toUpperCase();
        // Strict adherence: No greens, no reds. Using Blue for active/done and Gray for others.
        if (estadoUpper === 'EJECUTADA') return 'bg-[#0071E3] text-white border-[#0071E3]';
        if (estadoUpper === 'ACTIVA') return 'bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/30';
        if (estadoUpper === 'CANCELADA') return 'bg-[#333333]/50 text-[#86868B] border-[#333333]';
        return 'bg-[#333333]/10 text-[#86868B] border-[#333333]';
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortConfig.field !== field) return <ArrowUpDown className="w-3.5 h-3.5 opacity-20" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-3.5 h-3.5 text-[#0071E3] animate-in slide-in-from-bottom-2 duration-300" />
            : <ArrowDown className="w-3.5 h-3.5 text-[#0071E3] animate-in slide-in-from-top-2 duration-300" />;
    };


    return (
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans relative flex flex-col selection:bg-[#0071E3]/30 pb-24">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333333; border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #424245; }
            `}</style>

            <PageHeader
                title="Estados de Solicitud"
                icon={Activity}
                subtitle="Consulta de Seguimiento"
                rightElement={
                    <div className="flex items-center gap-4">
                        <button
                            onClick={exportarExcel}
                            className="h-11 px-6 bg-[#0071E3] text-white rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2.5 shadow-xl active:scale-95"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Exportar
                        </button>
                        <button
                            onClick={limpiarFiltros}
                            className="h-11 px-6 bg-transparent border border-[#F5F5F7]/30 text-[#F5F5F7] rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all flex items-center gap-2.5 active:scale-95"
                        >
                            <Eraser className="w-4 h-4" /> Limpiar
                        </button>
                    </div>
                }
            />

            <div className="max-w-[1600px] mx-auto w-full px-8 space-y-8 flex-1 flex flex-col">
                {/* Filters Section */}
                <div className="bg-[#121212] border border-[#333333] rounded-[8px] p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Search className="w-4 h-4 text-[#0071E3]" />
                            <h3 className="text-[10px] font-black text-white/90 uppercase tracking-[0.3em]">Filtros de Búsqueda</h3>
                        </div>
                        <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full border border-[#333333]">
                            {totalRecords.toLocaleString()} registros
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        <SearchableDropdown options={filterOptions.nombre_cliente} value={filters.nombre_cliente} onChange={(val) => handleFilterChange('nombre_cliente', val)} placeholder="Cliente..." />
                        <SearchableDropdown options={filterOptions.dependencia_cliente} value={filters.dependencia_cliente} onChange={(val) => handleFilterChange('dependencia_cliente', val)} placeholder="Dependencia..." />
                        <SearchableDropdown options={filterOptions.profesional_responsable} value={filters.profesional_responsable} onChange={(val) => handleFilterChange('profesional_responsable', val)} placeholder="Profesional..." />
                        <SearchableDropdown options={filterOptions.supervisor_asignado} value={filters.supervisor_asignado} onChange={(val) => handleFilterChange('supervisor_asignado', val)} placeholder="Supervisor..." />
                        <SearchableDropdown options={filterOptions.instalacion_municipal} value={filters.instalacion_municipal} onChange={(val) => handleFilterChange('instalacion_municipal', val)} placeholder="Instalación..." />
                        <SearchableDropdown options={filterOptions.descripcion_area} value={filters.descripcion_area} onChange={(val) => handleFilterChange('descripcion_area', val)} placeholder="Área..." />
                        <SearchableDropdown options={filterOptions.estado_actual} value={filters.estado_actual} onChange={(val) => handleFilterChange('estado_actual', val)} placeholder="Estado..." />
                    </div>

                    <div className="flex flex-wrap items-center gap-8 mt-8 bg-black/20 p-4 rounded-[8px] border border-[#333333]/30">
                        <div className="flex items-center gap-4">
                            <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest whitespace-nowrap">Desde:</label>
                            <input
                                type="date"
                                className="bg-[#1D1D1F] border border-[#333333] rounded-[8px] h-8 px-4 text-[11px] text-white uppercase font-bold focus:border-[#0071E3]/50 outline-none transition-all w-48"
                                value={filters.fecha_inicio}
                                onChange={(e) => handleFilterChange('fecha_inicio', e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="text-[9px] font-black text-[#86868B] uppercase tracking-widest whitespace-nowrap">Hasta:</label>
                            <input
                                type="date"
                                className="bg-[#1D1D1F] border border-[#333333] rounded-[8px] h-8 px-4 text-[11px] text-white uppercase font-bold focus:border-[#0071E3]/50 outline-none transition-all w-48"
                                value={filters.fecha_fin}
                                onChange={(e) => handleFilterChange('fecha_fin', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-[#121212] border border-[#333333] rounded-[8px] shadow-3xl overflow-hidden mb-16">
                    <div className="overflow-x-auto custom-scrollbar">
                        <div className="min-w-[1400px]">
                            {/* Header Row */}
                            <div className="grid grid-cols-[80px_100px_2fr_1.5fr_1fr_1.5fr_1fr] bg-[#1D1D1F] border-b border-[#333333] text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] sticky top-0 z-20">
                                <div className="px-6 py-5 cursor-pointer hover:bg-white/5 hover:text-[#F5F5F7] transition-all flex items-center gap-2 border-r border-[#333333]/30" onClick={() => handleSort('numero_solicitud')}>
                                    # <SortIcon field="numero_solicitud" />
                                </div>
                                <div className="px-6 py-5 cursor-pointer hover:bg-white/5 hover:text-[#F5F5F7] transition-all flex items-center gap-2 border-r border-[#333333]/30" onClick={() => handleSort('fecha_solicitud')}>
                                    Fecha <SortIcon field="fecha_solicitud" />
                                </div>
                                <div className="px-6 py-5 border-r border-[#333333]/30">Reporte Técnico / Descripción</div>
                                <div className="px-6 py-5 border-r border-[#333333]/30">Profesional Responsable</div>
                                <div className="px-6 py-5 border-r border-[#333333]/30">Instalación</div>
                                <div className="px-6 py-5 border-r border-[#333333]/30">Área Mantenimiento</div>
                                <div className="px-6 py-5 cursor-pointer hover:bg-white/5 hover:text-[#F5F5F7] transition-all flex items-center justify-center gap-2" onClick={() => handleSort('estado_actual')}>
                                    Estado <SortIcon field="estado_actual" />
                                </div>
                            </div>

                            {/* Data Rows */}
                            <div className="relative">
                                {(isLoading || isFetching) && (
                                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40 backdrop-blur-[2px]">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#0071E3]" />
                                    </div>
                                )}

                                {allRows.length > 0 ? (
                                    allRows.map((row, index) => (
                                        <div
                                            key={row.numero_solicitud}
                                            className={cn(
                                                "grid grid-cols-[80px_100px_2fr_1.5fr_1fr_1.5fr_1fr] items-center border-b border-[#333333]/30 transition-all hover:bg-white/[0.02]",
                                                index % 2 === 0 ? 'bg-[#121212]' : 'bg-black/20'
                                            )}
                                        >
                                            <div className="px-6 py-4 font-mono text-[11px] font-black text-[#0071E3] tracking-tighter">#{row.numero_solicitud}</div>
                                            <div className="px-6 py-4 text-[10px] font-bold text-[#86868B]">{row.fecha_solicitud ? new Date(row.fecha_solicitud).toLocaleDateString('es-ES') : ''}</div>
                                            <div className="px-6 py-4 text-[11px] italic text-[#F5F5F7] font-medium leading-relaxed italic" title={row.descripcion_solicitud}>{row.descripcion_solicitud}</div>
                                            <div className="px-6 py-4 text-[11px] font-black text-[#F5F5F7] uppercase tracking-tight" title={row.profesional_responsable}>{row.profesional_responsable}</div>
                                            <div className="px-6 py-4 text-[10px] font-bold text-[#86868B] uppercase" title={row.instalacion_municipal}>{row.instalacion_municipal}</div>
                                            <div className="px-6 py-4 text-[10px] font-bold text-[#86868B] uppercase" title={row.descripcion_area}>{row.descripcion_area}</div>
                                            <div className="px-6 py-4 flex items-center justify-center">
                                                <span className={cn(
                                                    "px-4 py-1.5 rounded-[8px] text-[10px] font-black uppercase tracking-widest border transition-colors",
                                                    getEstadoClass(row.estado_actual)
                                                )}>
                                                    {row.estado_actual || 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : !isLoading && (
                                    <div className="flex flex-col items-center justify-center py-20 text-[#424245]">
                                        <LayoutGrid className="w-12 h-12 mb-4 opacity-20" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">No se encontraron registros</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Pagination Controls */}
                    <div className="bg-[#1D1D1F] border-t border-[#333333] px-8 py-4 flex items-center justify-between">
                        <div className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">
                            Página <span className="text-[#F5F5F7]">{page + 1}</span> de <span className="text-[#F5F5F7]">{totalPages || 1}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="h-10 px-6 bg-transparent border border-[#333333] text-[#F5F5F7] rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                            >
                                <ChevronLeft className="w-4 h-4 text-[#0071E3]" /> Anterior
                            </button>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={allRows.length < PAGE_SIZE || page >= totalPages - 1}
                                className="h-10 px-6 bg-transparent border border-[#333333] text-[#F5F5F7] rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                            >
                                Siguiente <ChevronRight className="w-4 h-4 text-[#0071E3]" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
