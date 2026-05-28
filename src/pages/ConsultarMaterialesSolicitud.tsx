import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';
import {
    ArrowLeft,
    FileSpreadsheet,
    FileText,
    Eraser,
    Loader2,
    ClipboardList,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Search,
    X,
    LayoutGrid,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Package,
    Banknote
} from 'lucide-react';

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

interface MaterialResumen {
    articulo: string;
    descripcion: string;
    unidad: string;
    cantidad_total: number;
    precio_unitario: number;
    costo_total: number;
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
    fecha_fin: ''
};

type SortField = 'numero_solicitud' | 'fecha_solicitud' | 'nombre_cliente' | 'estado_actual';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
    field: SortField;
    direction: SortDirection;
}

export default function ConsultarMaterialesSolicitud() {
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

    // Expanded rows for materials
    const [expandedSolicitudes, setExpandedSolicitudes] = useState<number[]>([]);
    const [materialsMap, setMaterialsMap] = useState<Record<number, MaterialResumen[]>>({});
    const [loadingMaterials, setLoadingMaterials] = useState<Record<number, boolean>>({});
    const [basesMap, setBasesMap] = useState<Record<number, string>>({});

    // Currency Formatter
    const formatearMoneda = (valor: number) => {
        return new Intl.NumberFormat("es-CR", {
            style: "currency",
            currency: "CRC",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            currencyDisplay: "symbol"
        }).format(valor).replace('CRC', '₡');
    };

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
        queryKey: ['solicitudes-materiales', page, debouncedFilters, sortConfig],
        queryFn: fetchSolicitudes,
        refetchOnWindowFocus: false,
    });

    const allRows = data?.data || [];
    const totalRecords = data?.count || 0;
    const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

    useEffect(() => {
        cargarOpcionesFiltro();
    }, []);

    // Load materials for the current page automatically or on demand
    useEffect(() => {
        if (allRows.length > 0) {
            cargarMaterialesPorSolicitudes(allRows.map(r => r.numero_solicitud));
            cargarBasesPorSolicitudes(allRows.map(r => r.numero_solicitud));
        }
    }, [allRows]);

    const cargarOpcionesFiltro = async () => {
        try {
            let allData: any[] = [];
            let hasMore = true;
            let offset = 0;
            const BATCH_SIZE = 1000;

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
            console.error('Error cargando opciones de filtro:', error);
        }
    };

    const cargarMaterialesPorSolicitudes = async (solicitudIds: number[]) => {
        if (solicitudIds.length === 0) return;

        // Set loading states
        setLoadingMaterials(prev => {
            const next = { ...prev };
            solicitudIds.forEach(id => {
                next[id] = true;
            });
            return next;
        });

        try {
            const { data: salidas, error } = await supabase
                .from('salida_articulo_08')
                .select(`
                    numero_solicitud,
                    id_salida,
                    dato_salida_13 (
                        cantidad,
                        precio_unitario,
                        subtotal,
                        articulo,
                        articulo_01 (
                            nombre_articulo,
                            unidad
                        )
                    )
                `)
                .in('numero_solicitud', solicitudIds);

            if (error) throw error;

            const tempMap: Record<number, any[]> = {};
            solicitudIds.forEach(id => {
                tempMap[id] = [];
            });

            salidas?.forEach((s: any) => {
                const solNum = Number(s.numero_solicitud);
                if (tempMap[solNum] !== undefined) {
                    s.dato_salida_13?.forEach((d: any) => {
                        tempMap[solNum].push({
                            articulo: d.articulo,
                            descripcion: d.articulo_01?.nombre_articulo || 'Sin descripción',
                            unidad: d.articulo_01?.unidad || 'Unidad',
                            cantidad: Number(d.cantidad) || 0,
                            precio_unitario: Number(d.precio_unitario) || 0,
                            subtotal: Number(d.subtotal) || (Number(d.cantidad) * (Number(d.precio_unitario) || 0))
                        });
                    });
                }
            });

            // Group and aggregate identical items per request
            const aggregatedMap: Record<number, MaterialResumen[]> = {};
            Object.keys(tempMap).forEach(key => {
                const id = Number(key);
                const items = tempMap[id];
                const groups: Record<string, MaterialResumen> = {};

                items.forEach(item => {
                    const groupKey = item.articulo;
                    if (!groups[groupKey]) {
                        groups[groupKey] = {
                            articulo: item.articulo,
                            descripcion: item.descripcion,
                            unidad: item.unidad,
                            cantidad_total: 0,
                            precio_unitario: item.precio_unitario,
                            costo_total: 0
                        };
                    }
                    groups[groupKey].cantidad_total += item.cantidad;
                    groups[groupKey].costo_total += item.subtotal;
                });

                aggregatedMap[id] = Object.values(groups);
            });

            setMaterialsMap(prev => ({ ...prev, ...aggregatedMap }));
        } catch (err) {
            console.error('Error cargando materiales:', err);
        } finally {
            setLoadingMaterials(prev => {
                const next = { ...prev };
                solicitudIds.forEach(id => {
                    next[id] = false;
                });
                return next;
            });
        }
    };

    const cargarBasesPorSolicitudes = async (solicitudIds: number[]) => {
        if (solicitudIds.length === 0) return;
        try {
            const { data: solBases, error } = await supabase
                .from('solicitud_17')
                .select(`
                    numero_solicitud,
                    instalaciones_municipales_16 (
                        instalacion_base (
                            base
                        )
                    )
                `)
                .in('numero_solicitud', solicitudIds);

            if (error) throw error;

            const map: Record<number, string> = {};
            solicitudIds.forEach(id => {
                map[id] = 'N/A';
            });

            solBases?.forEach((sb: any) => {
                map[sb.numero_solicitud] = sb.instalaciones_municipales_16?.instalacion_base?.base || 'N/A';
            });

            setBasesMap(prev => ({ ...prev, ...map }));
        } catch (err) {
            console.error('Error cargando bases:', err);
        }
    };

    const toggleRow = (numeroSolicitud: number) => {
        setExpandedSolicitudes(prev =>
            prev.includes(numeroSolicitud)
                ? prev.filter(id => id !== numeroSolicitud)
                : [...prev, numeroSolicitud]
        );
    };

    const handleFilterChange = (key: keyof Filters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(0);
    };

    const limpiarFiltros = () => {
        setFilters(initialFilters);
        setPage(0);
    };

    const handleSort = (field: SortField) => {
        setSortConfig(current => ({
            field,
            direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const fetchAllFilteredDataWithMaterials = async () => {
        let allData: any[] = [];
        const BATCH_SIZE = 1000;
        const totalPages = Math.ceil(totalRecords / BATCH_SIZE);

        console.log(`Iniciando exportación de ${totalRecords} registros en ${totalPages} lotes...`);

        // 1. Fetch all matching requests
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
        }

        if (allData.length === 0) return { requests: [], materials: {}, bases: {} };

        // 2. Fetch all materials and bases for all these requests in chunks
        const allRequestIds = allData.map(r => r.numero_solicitud);
        const materialsGroupedMap: Record<number, MaterialResumen[]> = {};
        const basesGroupedMap: Record<number, string> = {};
        const CHUNK_SIZE = 500;

        for (let i = 0; i < allRequestIds.length; i += CHUNK_SIZE) {
            const chunk = allRequestIds.slice(i, i + CHUNK_SIZE);

            const [materialsRes, basesRes] = await Promise.all([
                supabase
                    .from('salida_articulo_08')
                    .select(`
                        numero_solicitud,
                        id_salida,
                        dato_salida_13 (
                            cantidad,
                            precio_unitario,
                            subtotal,
                            articulo,
                            articulo_01 (
                                nombre_articulo,
                                unidad
                            )
                        )
                    `)
                    .in('numero_solicitud', chunk),
                supabase
                    .from('solicitud_17')
                    .select(`
                        numero_solicitud,
                        instalaciones_municipales_16 (
                            instalacion_base (
                                base
                            )
                        )
                    `)
                    .in('numero_solicitud', chunk)
            ]);

            if (materialsRes.error) throw materialsRes.error;
            if (basesRes.error) throw basesRes.error;

            materialsRes.data?.forEach((s: any) => {
                const solNum = Number(s.numero_solicitud);
                if (!materialsGroupedMap[solNum]) {
                    materialsGroupedMap[solNum] = [];
                }

                s.dato_salida_13?.forEach((d: any) => {
                    const existing = materialsGroupedMap[solNum].find(item => item.articulo === d.articulo);
                    const qty = Number(d.cantidad) || 0;
                    const sub = Number(d.subtotal) || (qty * (Number(d.precio_unitario) || 0));

                    if (existing) {
                        existing.cantidad_total += qty;
                        existing.costo_total += sub;
                    } else {
                        materialsGroupedMap[solNum].push({
                            articulo: d.articulo,
                            descripcion: d.articulo_01?.nombre_articulo || 'Sin descripción',
                            unidad: d.articulo_01?.unidad || 'Unidad',
                            cantidad_total: qty,
                            precio_unitario: Number(d.precio_unitario) || 0,
                            costo_total: sub
                        });
                    }
                });
            });

            basesRes.data?.forEach((sb: any) => {
                basesGroupedMap[sb.numero_solicitud] = sb.instalaciones_municipales_16?.instalacion_base?.base || 'N/A';
            });
        }

        return {
            requests: allData,
            materials: materialsGroupedMap,
            bases: basesGroupedMap
        };
    };

    const exportarExcel = async () => {
        if (confirm(`¿Desea exportar los ${totalRecords} registros de solicitudes junto a sus materiales utilizados?`)) {
            try {
                const { requests, materials, bases } = await fetchAllFilteredDataWithMaterials();

                if (requests.length === 0) {
                    alert('No hay datos para exportar con los filtros actuales.');
                    return;
                }

                const excelRows: any[] = [];

                requests.forEach((req: SolicitudSTI) => {
                    const solNum = req.numero_solicitud;
                    const mats = materials[solNum] || [];
                    const baseVal = bases[solNum] || 'N/A';

                    const baseData = {
                        'N° Solicitud': solNum,
                        'Fecha Solicitud': req.fecha_solicitud ? new Date(req.fecha_solicitud).toLocaleDateString('es-ES') : '',
                        'Descripción Solicitud': req.descripcion_solicitud || '',
                        'Cliente': req.nombre_cliente || '',
                        'Dependencia': req.dependencia_cliente || '',
                        'Profesional Responsable': req.profesional_responsable || '',
                        'Supervisor Asignado': req.supervisor_asignado || '',
                        'Instalación': req.instalacion_municipal || '',
                        'Base': baseVal,
                        'Área Mantenimiento': req.descripcion_area || '',
                        'Estado': req.estado_actual || ''
                    };

                    if (mats.length === 0) {
                        excelRows.push({
                            ...baseData,
                            'Código Material': '',
                            'Descripción Material': 'SIN MATERIALES REGISTRADOS',
                            'Cantidad Utilizada': '',
                            'Unidad Medida': '',
                            'Costo Unitario': '',
                            'Costo Total Material': ''
                        });
                    } else {
                        mats.forEach(mat => {
                            excelRows.push({
                                ...baseData,
                                'Código Material': mat.articulo,
                                'Descripción Material': mat.descripcion,
                                'Cantidad Utilizada': mat.cantidad_total,
                                'Unidad Medida': mat.unidad,
                                'Costo Unitario': mat.precio_unitario,
                                'Costo Total Material': mat.costo_total
                            });
                        });
                    }
                });

                const ws = XLSX.utils.json_to_sheet(excelRows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Materiales por Solicitud');
                XLSX.writeFile(wb, `materiales_solicitudes_${new Date().toLocaleDateString('en-CA')}.xlsx`);

            } catch (e: any) {
                alert('Error exportando a Excel: ' + e.message);
                console.error('Error in exportarExcel:', e);
            }
        }
    };

    const exportarPDF = async () => {
        if (confirm(`¿Desea generar el reporte PDF para los ${totalRecords} registros?`)) {
            try {
                const { requests, materials, bases } = await fetchAllFilteredDataWithMaterials();

                if (requests.length === 0) {
                    alert('No hay datos para exportar con los filtros actuales.');
                    return;
                }

                const doc = new jsPDF('l', 'mm', 'a4');
                doc.setFont('helvetica');
                doc.setFontSize(16);
                doc.text('Reporte de Materiales y Costos por Solicitud', 20, 20);
                doc.setFontSize(10);
                doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')} - Coincidencias: ${requests.length} solicitudes`, 20, 28);

                const columnas = [
                    'Sol. #',
                    'Fecha',
                    'Cliente',
                    'Instalación',
                    'Base',
                    'Estado',
                    'Material (Código - Descripción)',
                    'Cant.',
                    'Unidad',
                    'Costo Unit.',
                    'Total Material'
                ];

                const filas: any[] = [];

                requests.forEach((req: SolicitudSTI) => {
                    const solNum = req.numero_solicitud;
                    const mats = materials[solNum] || [];
                    const baseVal = bases[solNum] || 'N/A';
                    const instVal = req.instalacion_municipal || '';

                    const dateStr = req.fecha_solicitud ? new Date(req.fecha_solicitud).toLocaleDateString('es-ES') : '';
                    const client = req.nombre_cliente || '';
                    const status = req.estado_actual || '';

                    if (mats.length === 0) {
                        filas.push([
                            solNum,
                            dateStr,
                            client,
                            instVal,
                            baseVal,
                            status,
                            'SIN MATERIALES REGISTRADOS',
                            '-',
                            '-',
                            '-',
                            '-'
                        ]);
                    } else {
                        mats.forEach((mat, idx) => {
                            // Only display request header info on the first row of grouped materials to keep it clean
                            filas.push([
                                idx === 0 ? solNum : '',
                                idx === 0 ? dateStr : '',
                                idx === 0 ? client : '',
                                idx === 0 ? instVal : '',
                                idx === 0 ? baseVal : '',
                                idx === 0 ? status : '',
                                `${mat.articulo} - ${mat.descripcion}`,
                                mat.cantidad_total.toString(),
                                mat.unidad,
                                formatearMoneda(mat.precio_unitario).replace('₡', 'CRC '),
                                formatearMoneda(mat.costo_total).replace('₡', 'CRC ')
                            ]);
                        });
                    }
                });

                autoTable(doc, {
                    head: [columnas],
                    body: filas,
                    startY: 36,
                    styles: { fontSize: 7, cellPadding: 2 },
                    headStyles: { fillColor: [0, 113, 227], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [18, 18, 18] },
                });

                doc.save(`materiales_solicitudes_${new Date().toLocaleDateString('en-CA')}.pdf`);

            } catch (e: any) {
                alert('Error exportando a PDF: ' + e.message);
                console.error('Error in exportarPDF:', e);
            }
        }
    };

    const getEstadoClass = (estado: string) => {
        if (!estado) return 'bg-[#333333]/10 text-[#86868B] border-[#333333]';
        const estadoUpper = estado.toUpperCase();
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
                title="Materiales por Solicitud"
                icon={ClipboardList}
                subtitle="Consulta de consumos y costos"
                rightElement={
                    <div className="flex items-center gap-4">
                        <button
                            onClick={exportarExcel}
                            className="h-11 px-6 bg-[#0071E3] text-white rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2.5 shadow-xl active:scale-95"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
                        </button>
                        <button
                            onClick={exportarPDF}
                            className="h-11 px-6 bg-transparent border border-[#0071E3] text-[#0071E3] rounded-[8px] text-[10px] font-black uppercase tracking-widest hover:bg-[#0071E3]/10 transition-all flex items-center gap-2.5 shadow-xl active:scale-95"
                        >
                            <FileText className="w-4 h-4" /> Exportar PDF
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
                            <div className="grid grid-cols-[80px_100px_2fr_1.5fr_1fr_1fr_1.5fr_1fr_60px] bg-[#1D1D1F] border-b border-[#333333] text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] sticky top-0 z-20">
                                <div className="px-6 py-5 cursor-pointer hover:bg-white/5 hover:text-[#F5F5F7] transition-all flex items-center gap-2 border-r border-[#333333]/30" onClick={() => handleSort('numero_solicitud')}>
                                    # <SortIcon field="numero_solicitud" />
                                </div>
                                <div className="px-6 py-5 cursor-pointer hover:bg-white/5 hover:text-[#F5F5F7] transition-all flex items-center gap-2 border-r border-[#333333]/30" onClick={() => handleSort('fecha_solicitud')}>
                                    Fecha <SortIcon field="fecha_solicitud" />
                                </div>
                                <div className="px-6 py-5 border-r border-[#333333]/30">Reporte Técnico / Descripción</div>
                                <div className="px-6 py-5 border-r border-[#333333]/30">Profesional Responsable</div>
                                <div className="px-6 py-5 border-r border-[#333333]/30">Instalación</div>
                                <div className="px-6 py-5 border-r border-[#333333]/30">Base</div>
                                <div className="px-6 py-5 border-r border-[#333333]/30">Área Mantenimiento</div>
                                <div className="px-6 py-5 cursor-pointer hover:bg-white/5 hover:text-[#F5F5F7] transition-all flex items-center justify-center gap-2 border-r border-[#333333]/30" onClick={() => handleSort('estado_actual')}>
                                    Estado <SortIcon field="estado_actual" />
                                </div>
                                <div className="px-6 py-5 flex items-center justify-center">Ver</div>
                            </div>

                            {/* Data Rows */}
                            <div className="relative">
                                {(isLoading || isFetching) && (
                                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40 backdrop-blur-[2px]">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#0071E3]" />
                                    </div>
                                )}

                                {allRows.length > 0 ? (
                                    allRows.map((row, index) => {
                                        const isExpanded = expandedSolicitudes.includes(row.numero_solicitud);
                                        const materials = materialsMap[row.numero_solicitud] || [];
                                        const isLoadingMats = loadingMaterials[row.numero_solicitud];
                                        const materialsTotalCost = materials.reduce((sum, m) => sum + m.costo_total, 0);

                                        return (
                                            <div key={row.numero_solicitud} className="border-b border-[#333333]/30">
                                                {/* Main Row */}
                                                <div
                                                    onClick={() => toggleRow(row.numero_solicitud)}
                                                    className={cn(
                                                        "grid grid-cols-[80px_100px_2fr_1.5fr_1fr_1fr_1.5fr_1fr_60px] items-center transition-all hover:bg-white/[0.02] cursor-pointer",
                                                        index % 2 === 0 ? 'bg-[#121212]' : 'bg-black/20'
                                                    )}
                                                >
                                                    <div className="px-6 py-4 font-mono text-[11px] font-black text-[#0071E3] tracking-tighter">#{row.numero_solicitud}</div>
                                                    <div className="px-6 py-4 text-[10px] font-bold text-[#86868B]">{row.fecha_solicitud ? new Date(row.fecha_solicitud).toLocaleDateString('es-ES') : ''}</div>
                                                    <div className="px-6 py-4 text-[11px] italic text-[#F5F5F7] font-medium leading-relaxed truncate" title={row.descripcion_solicitud}>{row.descripcion_solicitud}</div>
                                                    <div className="px-6 py-4 text-[11px] font-black text-[#F5F5F7] uppercase tracking-tight" title={row.profesional_responsable}>{row.profesional_responsable}</div>
                                                    <div className="px-6 py-4 text-[10px] font-bold text-[#86868B] uppercase" title={row.instalacion_municipal}>{row.instalacion_municipal}</div>
                                                    <div className="px-6 py-4 text-[10px] font-bold text-[#86868B] uppercase" title={basesMap[row.numero_solicitud] || 'N/A'}>{basesMap[row.numero_solicitud] || 'N/A'}</div>
                                                    <div className="px-6 py-4 text-[10px] font-bold text-[#86868B] uppercase" title={row.descripcion_area}>{row.descripcion_area}</div>
                                                    <div className="px-6 py-4 flex items-center justify-center">
                                                        <span className={cn(
                                                            "px-4 py-1.5 rounded-[8px] text-[10px] font-black uppercase tracking-widest border transition-colors",
                                                            getEstadoClass(row.estado_actual)
                                                        )}>
                                                            {row.estado_actual || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="px-6 py-4 flex items-center justify-center">
                                                        <ChevronDown className={cn("w-4 h-4 text-[#86868B] transition-transform duration-300", isExpanded && "transform rotate-180 text-[#0071E3]")} />
                                                    </div>
                                                </div>

                                                {/* Expanded Materials Section */}
                                                {isExpanded && (
                                                    <div className="bg-black/40 border-t border-b border-[#333333]/50 px-12 py-6 animate-in slide-in-from-top-2 duration-200">
                                                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                                            <div className="flex flex-wrap items-center gap-6">
                                                                <div className="flex items-center gap-2">
                                                                    <Package className="w-4 h-4 text-[#0071E3]" />
                                                                    <h4 className="text-[10px] font-black text-white/80 uppercase tracking-wider">Materiales Utilizados</h4>
                                                                </div>
                                                                <div className="text-[9px] font-black text-[#86868B] uppercase tracking-wider bg-[#1D1D1F] px-3 py-1 rounded-[6px] border border-[#333333]">
                                                                    Base: <span className="text-[#F5F5F7]">{basesMap[row.numero_solicitud] || 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                            {materials.length > 0 && (
                                                                <div className="flex items-center gap-2 text-xs font-bold text-[#0071E3] bg-[#0071E3]/10 px-3 py-1 rounded-[6px]">
                                                                    <Banknote className="w-4 h-4" />
                                                                    <span>Costo Total: {formatearMoneda(materialsTotalCost)}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {isLoadingMats ? (
                                                            <div className="flex items-center gap-3 py-4 text-[#86868B]">
                                                                <Loader2 className="w-4 h-4 animate-spin text-[#0071E3]" />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider">Cargando desglose de materiales...</span>
                                                            </div>
                                                        ) : materials.length === 0 ? (
                                                            <div className="py-6 text-center text-[#424245]">
                                                                <p className="text-[9px] font-black uppercase tracking-widest">Sin materiales registrados para esta solicitud</p>
                                                            </div>
                                                        ) : (
                                                            <div className="overflow-hidden rounded-[8px] border border-[#333333]/50 bg-[#121212]">
                                                                <table className="w-full text-left text-[11px]">
                                                                    <thead>
                                                                        <tr className="bg-[#1D1D1F] border-b border-[#333333]/50 text-[9px] font-black text-[#86868B] uppercase tracking-wider">
                                                                            <th className="px-6 py-3">Código</th>
                                                                            <th className="px-6 py-3">Descripción de Material</th>
                                                                            <th className="px-6 py-3 text-center">Cant. Utilizada</th>
                                                                            <th className="px-6 py-3">Unidad</th>
                                                                            <th className="px-6 py-3 text-right">Costo Unitario</th>
                                                                            <th className="px-6 py-3 text-right">Costo Total</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-[#333333]/20">
                                                                        {materials.map((m, idx) => (
                                                                            <tr key={idx} className="hover:bg-white/[0.01]">
                                                                                <td className="px-6 py-2.5 font-mono text-[#0071E3] font-bold">{m.articulo}</td>
                                                                                <td className="px-6 py-2.5 font-bold uppercase text-white/90">{m.descripcion}</td>
                                                                                <td className="px-6 py-2.5 text-center font-bold text-white">{m.cantidad_total}</td>
                                                                                <td className="px-6 py-2.5 text-[#86868B] uppercase font-bold">{m.unidad}</td>
                                                                                <td className="px-6 py-2.5 text-right font-mono text-[#86868B]">{formatearMoneda(m.precio_unitario)}</td>
                                                                                <td className="px-6 py-2.5 text-right font-mono font-bold text-white">{formatearMoneda(m.costo_total)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
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
            {/* Back Button */}
            <div className="max-w-[1600px] mx-auto w-full px-8 flex justify-start">
                <button
                    onClick={() => navigate('/gestion-interna')}
                    className="btn-ghost !px-8 !py-4"
                >
                    <div className="flex items-center gap-3">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Regresar a Gestión Interna</span>
                    </div>
                </button>
            </div>
        </div>
    );
}
