import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    LayoutDashboard,
    Search,
    Filter,
    Calendar,
    FileText,
    Eye,
    ArrowLeft,
    RotateCw,
    CheckCircle,
    XCircle,
    PlayCircle,
    Wrench,
    Package,
    PlusCircle,
    Save,
    X,
    Loader2,
    Info,
    AlertTriangle,
    History,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

// Interfaces
interface SolicitudSTI {
    numero_solicitud: number;
    fecha_solicitud: string;
    descripcion_solicitud: string;
    tipo_solicitud: string;
    supervisor_asignado: string | null;
    // Campos computados/unidos
    estado_actual?: string;
    supervisor_alias?: string;
}

interface Seguimiento {
    id_seguimiento?: number;
    numero_solicitud: number;
    estado_actual: string;
    fecha_inicio: string | null;
    fecha_finalizacion: string | null;
}

interface RegistroSeguimiento {
    id_registro?: number;
    numero_solicitud: number;
    fecha_registro: string;
    registro_seguimiento: string;
}

interface ArticuloAsociado {
    id_salida: number;
    fecha_salida: string;
    cantidad: number;
    nombre_articulo: string;
    codigo_articulo: string;
}

export default function SeguimientoSolicitud() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [solicitudes, setSolicitudes] = useState<SolicitudSTI[]>([]);
    const [stats, setStats] = useState({ total: 0, activas: 0, ejecutadas: 0, canceladas: 0 });
    const [totalRecords, setTotalRecords] = useState(0);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState('');

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    // Ordenamiento
    const [sortConfig, setSortConfig] = useState<{ key: keyof SolicitudSTI | 'estado_actual'; direction: 'asc' | 'desc' } | null>({ key: 'numero_solicitud', direction: 'desc' });

    // Modal State
    const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudSTI | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);

    // Datos del Modal
    const [seguimientoData, setSeguimientoData] = useState<Seguimiento | null>(null);
    const [registros, setRegistros] = useState<RegistroSeguimiento[]>([]);
    const [articulos, setArticulos] = useState<ArticuloAsociado[]>([]);
    const [articulosLoading, setArticulosLoading] = useState(false);

    // Formulario Nuevo Registro
    const [showNuevoRegistro, setShowNuevoRegistro] = useState(false);
    const [nuevoRegistro, setNuevoRegistro] = useState({ fecha: new Date().toISOString().split('T')[0], texto: '' });

    // Notificaciones
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // Helper to fetch all records handling 1000-row limit
    const fetchAll = async (table: string, select: string, filterField?: string, filterValue?: string) => {
        let allData: any[] = [];
        let page = 0;
        const size = 1000;
        while (true) {
            let query = supabase
                .from(table)
                .select(select)
                .range(page * size, (page + 1) * size - 1);

            if (filterField && filterValue) {
                query = query.eq(filterField, filterValue);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) break;
            allData.push(...data);
            if (data.length < size) break;
            page++;
        }
        return allData;
    };

    // Cargar Estadísticas
    const loadStats = async () => {
        try {
            // 1. Fetch ALL STI IDs
            // We need to know the total count and which IDs are STI to correctly attribute 'ACTIVA' (default)
            // However, fetching just the count is fast. Fetching all IDs might be needed for accurate status mapping.

            // Get Total Count
            const { count: total } = await supabase
                .from('solicitud_17')
                .select('*', { count: 'exact', head: true })
                .eq('tipo_solicitud', 'STI');

            // 2. Fetch ALL Seguimientos (Status)
            // We fetch all because filtering by STI IDs (if we had them) in 'in()' clause is limited.
            // Alternatively, we can fetch all seguimientos and filter in memory if we have the STI IDs.
            // But 'seguimiento_solicitud' table might be smaller than 'solicitud_17' or similar size.
            const allSeguimientos = await fetchAll('seguimiento_solicitud', 'numero_solicitud, estado_actual');

            // 3. Fetch ALL STI IDs to filter the seguimientos (intersection)
            // This is necessary because seguimiento_solicitud might have STE or other types.
            const allStiIdsData = await fetchAll('solicitud_17', 'numero_solicitud', 'tipo_solicitud', 'STI');
            const stiIdsSet = new Set(allStiIdsData.map((s: any) => s.numero_solicitud));

            const newStats = {
                total: total || 0,
                activas: 0,
                ejecutadas: 0,
                canceladas: 0
            };

            // Count statuses for STI requests
            let seguimientosCounted = 0;
            allSeguimientos.forEach((s: any) => {
                if (stiIdsSet.has(s.numero_solicitud)) {
                    seguimientosCounted++;
                    const estado = s.estado_actual?.toUpperCase();
                    if (estado === 'ACTIVA') newStats.activas++;
                    else if (estado === 'EJECUTADA') newStats.ejecutadas++;
                    else if (estado === 'CANCELADA') newStats.canceladas++;
                }
            });

            // The ones without record in seguimiento_solicitud are ACTIVA
            const sinRegistro = (total || 0) - seguimientosCounted;
            newStats.activas += Math.max(0, sinRegistro);

            setStats(newStats);
        } catch (error) {
            console.error("Error loading stats:", error);
        }
    };

    // Cargar Datos Paginados desde el Servidor
    const fetchSolicitudes = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('solicitud_17')
                .select('numero_solicitud, fecha_solicitud, descripcion_solicitud, tipo_solicitud, supervisor_asignado', { count: 'exact' })
                .eq('tipo_solicitud', 'STI');

            // 1. Filtro por Estado (Complejo porque está en otra tabla)
            if (filterEstado) {
                // Fetch ALL IDs with this status to avoid 1000 limit
                const idsData = await fetchAll('seguimiento_solicitud', 'numero_solicitud', 'estado_actual', filterEstado);
                const ids = idsData.map((i: any) => i.numero_solicitud);

                if (ids.length === 0) {
                    setSolicitudes([]);
                    setTotalRecords(0);
                    setLoading(false);
                    return;
                }

                // If ids list is huge, 'in' might fail. Supabase handles large lists in body, but let's be careful.
                // If > 1000, we might need to handle it differently or accept the limit here for display.
                // But usually 'in' can handle a few thousands.
                query = query.in('numero_solicitud', ids);
            }

            // 2. Búsqueda por Texto
            if (searchTerm) {
                const isNumeric = /^\d+$/.test(searchTerm);
                if (isNumeric) {
                    query = query.or(`numero_solicitud.eq.${searchTerm},descripcion_solicitud.ilike.%${searchTerm}%`);
                } else {
                    query = query.ilike('descripcion_solicitud', `%${searchTerm}%`);
                }
            }

            // 3. Ordenamiento
            if (sortConfig && sortConfig.key !== 'estado_actual') {
                query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });
            } else {
                query = query.order('numero_solicitud', { ascending: false });
            }

            // 4. Paginación
            const from = (currentPage - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            query = query.range(from, to);

            const { data: solicitudesData, count, error } = await query;

            if (error) throw error;

            if (!solicitudesData || solicitudesData.length === 0) {
                setSolicitudes([]);
                setTotalRecords(0);
                setLoading(false);
                return;
            }

            setTotalRecords(count || 0);

            // 5. Cargar Datos Relacionados (Estado y Supervisor) para ESTA página
            const idsPagina = solicitudesData.map(s => s.numero_solicitud);
            const supervisoresIds = solicitudesData
                .map(s => s.supervisor_asignado)
                .filter(id => id !== null) as string[];

            // Fetch Estados
            const { data: estadosData } = await supabase
                .from('seguimiento_solicitud')
                .select('numero_solicitud, estado_actual')
                .in('numero_solicitud', idsPagina);

            // Fetch Supervisores
            let colaboradoresMap = new Map();
            if (supervisoresIds.length > 0) {
                const { data: colabsData } = await supabase
                    .from('colaboradores_06')
                    .select('identificacion, alias')
                    .in('identificacion', supervisoresIds);

                if (colabsData) {
                    colabsData.forEach(c => colaboradoresMap.set(c.identificacion, c.alias));
                }
            }

            // Mapas
            const estadosMap = new Map();
            if (estadosData) {
                estadosData.forEach(s => estadosMap.set(s.numero_solicitud, s.estado_actual));
            }

            // Combinar
            const finalData = solicitudesData.map(s => ({
                ...s,
                estado_actual: estadosMap.get(s.numero_solicitud) || 'ACTIVA',
                supervisor_alias: s.supervisor_asignado ? (colaboradoresMap.get(s.supervisor_asignado) || 'No asignado') : 'No asignado'
            }));

            // Si el usuario ordenó por estado (que no se hizo en server), ordenamos esta página
            if (sortConfig?.key === 'estado_actual') {
                finalData.sort((a, b) => {
                    const valA = a.estado_actual || '';
                    const valB = b.estado_actual || '';
                    return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                });
            }

            setSolicitudes(finalData);

        } catch (error: any) {
            console.error('Error fetching solicitudes:', error);
            showNotification('Error al cargar datos: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Efectos
    useEffect(() => {
        loadStats();
    }, []); // Solo al montar

    useEffect(() => {
        fetchSolicitudes();
    }, [currentPage, searchTerm, filterEstado, sortConfig]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterEstado]);

    // Exportación a Excel (Bajo Demanda - Carga TODO)
    const handleExportExcel = async () => {
        setLoading(true);
        try {
            // Replicamos la lógica de filtrado pero SIN paginación
            let query = supabase
                .from('solicitud_17')
                .select('numero_solicitud, fecha_solicitud, descripcion_solicitud, tipo_solicitud, supervisor_asignado')
                .eq('tipo_solicitud', 'STI');

            if (filterEstado) {
                const { data: idsData } = await supabase
                    .from('seguimiento_solicitud')
                    .select('numero_solicitud')
                    .eq('estado_actual', filterEstado);
                const ids = idsData ? idsData.map(i => i.numero_solicitud) : [];
                if (ids.length === 0) {
                    showNotification('No hay datos para exportar con este filtro', 'info');
                    setLoading(false);
                    return;
                }
                query = query.in('numero_solicitud', ids);
            }

            if (searchTerm) {
                const isNumeric = /^\d+$/.test(searchTerm);
                if (isNumeric) {
                    query = query.or(`numero_solicitud.eq.${searchTerm},descripcion_solicitud.ilike.%${searchTerm}%`);
                } else {
                    query = query.ilike('descripcion_solicitud', `%${searchTerm}%`);
                }
            }

            // Fetch ALL (cuidado con límites muy grandes, pero Supabase maneja streaming o chunks internamente si es necesario, aquí asumimos < 10k ok)
            // Para seguridad, usamos un límite alto
            const { data: allData, error } = await query.limit(5000);

            if (error) throw error;
            if (!allData || allData.length === 0) {
                showNotification('No hay datos para exportar', 'info');
                return;
            }

            // Cargar datos relacionados para el Excel
            const ids = allData.map(s => s.numero_solicitud);
            const supIds = allData.map(s => s.supervisor_asignado).filter(Boolean) as string[];

            // Estados
            // Fetch en chunks si son muchos? Supabase in() tiene límite?
            // Haremos fetch de todo seguimiento_solicitud si son muchos, o in() si son pocos.
            // Simplificación: Fetch de estados para los IDs exportados.
            const { data: estadosData } = await supabase
                .from('seguimiento_solicitud')
                .select('numero_solicitud, estado_actual')
                .in('numero_solicitud', ids);

            const { data: colabsData } = await supabase
                .from('colaboradores_06')
                .select('identificacion, alias')
                .in('identificacion', supIds);

            const estadosMap = new Map();
            estadosData?.forEach(s => estadosMap.set(s.numero_solicitud, s.estado_actual));

            const colabsMap = new Map();
            colabsData?.forEach(c => colabsMap.set(c.identificacion, c.alias));

            const dataToExport = allData.map(s => ({
                'N° Solicitud': s.numero_solicitud,
                'Fecha': new Date(s.fecha_solicitud).toLocaleDateString(),
                'Descripción': s.descripcion_solicitud,
                'Tipo': s.tipo_solicitud,
                'Supervisor': s.supervisor_asignado ? (colabsMap.get(s.supervisor_asignado) || 'No asignado') : 'No asignado',
                'Estado': estadosMap.get(s.numero_solicitud) || 'ACTIVA'
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Solicitudes");
            XLSX.writeFile(wb, `Seguimiento_Solicitudes_${new Date().toISOString().split('T')[0]}.xlsx`);

            showNotification('Exportación completada', 'success');

        } catch (error: any) {
            console.error("Error exporting:", error);
            showNotification('Error al exportar: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: keyof SolicitudSTI | 'estado_actual') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const totalPages = Math.ceil(totalRecords / itemsPerPage);

    // Lógica del Modal
    const handleOpenModal = async (solicitud: SolicitudSTI) => {
        setSelectedSolicitud(solicitud);
        setIsModalOpen(true);
        setModalLoading(true);
        setSeguimientoData(null);
        setRegistros([]);
        setArticulos([]);
        setShowNuevoRegistro(false);

        try {
            // 1. Cargar Supervisor Alias
            let supervisorAlias = 'No asignado';
            if (solicitud.supervisor_asignado) {
                const { data: supData } = await supabase
                    .from('colaboradores_06')
                    .select('alias')
                    .eq('identificacion', solicitud.supervisor_asignado)
                    .single();
                if (supData) supervisorAlias = supData.alias;
            }
            setSelectedSolicitud(prev => prev ? ({ ...prev, supervisor_alias: supervisorAlias }) : null);

            // 2. Cargar Seguimiento
            let { data: segData, error: segError } = await supabase
                .from('seguimiento_solicitud')
                .select('*')
                .eq('numero_solicitud', solicitud.numero_solicitud)
                .maybeSingle();

            if (!segData) {
                // Crear si no existe
                const { data: newSeg, error: createError } = await supabase
                    .from('seguimiento_solicitud')
                    .insert({
                        numero_solicitud: solicitud.numero_solicitud,
                        estado_actual: 'ACTIVA'
                    })
                    .select()
                    .single();

                if (createError) throw createError;
                segData = newSeg;
            }
            setSeguimientoData(segData);

            // 3. Cargar Registros
            const { data: regData } = await supabase
                .from('registro_seguimiento_solicitud')
                .select('*')
                .eq('numero_solicitud', solicitud.numero_solicitud)
                .order('fecha_registro', { ascending: false });
            setRegistros(regData || []);

            // 4. Cargar Artículos (Lógica compleja)
            loadArticulos(solicitud.numero_solicitud);

        } catch (error: any) {
            console.error('Error opening modal:', error);
            showNotification('Error al cargar detalles: ' + error.message, 'error');
        } finally {
            setModalLoading(false);
        }
    };

    const loadArticulos = async (numeroSolicitud: number) => {
        setArticulosLoading(true);
        try {
            // Consulta relacional optimizada
            const { data: salidas, error } = await supabase
                .from('salida_articulo_08')
                .select(`
                    id_salida,
                    fecha_salida,
                    dato_salida_13 (
                        cantidad,
                        articulo,
                        articulo_01 (
                            nombre_articulo
                        )
                    )
                `)
                .eq('numero_solicitud', numeroSolicitud);

            if (error) throw error;

            if (!salidas || salidas.length === 0) {
                setArticulos([]);
                return;
            }

            const articulosEncontrados: ArticuloAsociado[] = [];

            salidas.forEach((salida: any) => {
                if (salida.dato_salida_13) {
                    salida.dato_salida_13.forEach((dato: any) => {
                        articulosEncontrados.push({
                            id_salida: salida.id_salida,
                            fecha_salida: salida.fecha_salida,
                            cantidad: dato.cantidad,
                            nombre_articulo: dato.articulo_01?.nombre_articulo || 'Desconocido',
                            codigo_articulo: dato.articulo
                        });
                    });
                }
            });

            setArticulos(articulosEncontrados);

        } catch (error) {
            console.error('Error loading articles:', error);
            showNotification('Error al cargar artículos asociados', 'error');
        } finally {
            setArticulosLoading(false);
        }
    };

    const handleSaveSeguimiento = async () => {
        if (!seguimientoData || !selectedSolicitud) return;

        try {
            const { error } = await supabase
                .from('seguimiento_solicitud')
                .update({
                    estado_actual: seguimientoData.estado_actual,
                    fecha_inicio: seguimientoData.fecha_inicio || null,
                    fecha_finalizacion: seguimientoData.fecha_finalizacion || null
                })
                .eq('numero_solicitud', selectedSolicitud.numero_solicitud);

            if (error) throw error;

            showNotification('Seguimiento actualizado correctamente', 'success');
            setIsModalOpen(false);
            loadData(); // Recargar tabla principal

        } catch (error: any) {
            showNotification('Error al guardar: ' + error.message, 'error');
        }
    };

    const handleAddRegistro = async () => {
        if (!nuevoRegistro.fecha || !nuevoRegistro.texto.trim() || !selectedSolicitud) {
            showNotification('Complete todos los campos del registro', 'info');
            return;
        }

        try {
            const { error } = await supabase
                .from('registro_seguimiento_solicitud')
                .insert({
                    numero_solicitud: selectedSolicitud.numero_solicitud,
                    fecha_registro: nuevoRegistro.fecha,
                    registro_seguimiento: nuevoRegistro.texto
                });

            if (error) throw error;

            showNotification('Registro agregado', 'success');
            setShowNuevoRegistro(false);
            setNuevoRegistro({ fecha: new Date().toISOString().split('T')[0], texto: '' });

            // Recargar registros
            const { data: regData } = await supabase
                .from('registro_seguimiento_solicitud')
                .select('*')
                .eq('numero_solicitud', selectedSolicitud.numero_solicitud)
                .order('fecha_registro', { ascending: false });
            setRegistros(regData || []);

        } catch (error: any) {
            showNotification('Error al agregar registro: ' + error.message, 'error');
        }
    };

    return (
        <div className="min-h-screen bg-[#1a1d29] text-[#e4e6ea] font-sans relative">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[10%] left-[10%] w-96 h-96 bg-[#7877c6]/20 rounded-full blur-3xl mix-blend-screen" />
                <div className="absolute top-[60%] right-[10%] w-96 h-96 bg-[#ff77c6]/10 rounded-full blur-3xl mix-blend-screen" />
            </div>

            {/* Notification Toast */}
            {notification && (
                <div className={`fixed top-24 right-6 z-[60] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right duration-300 ${notification.type === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                    notification.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                        'bg-blue-500/20 border-blue-500/30 text-blue-400'
                    }`}>
                    {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
                    {notification.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                    {notification.type === 'info' && <Info className="w-5 h-5" />}
                    <span className="font-medium">{notification.message}</span>
                </div>
            )}

            {/* Sticky Header */}
            <div className="sticky top-0 z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 mb-8 bg-[#1a1d29]/90 backdrop-blur-xl -mx-4 px-4 md:-mx-8 md:px-8 -mt-8 border-b border-white/5 shadow-lg shadow-black/20 transition-all">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8e44ad]/20 to-[#9b59b6]/20 border border-white/20 flex items-center justify-center">
                        <Wrench className="w-6 h-6 text-[#8e44ad]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Seguimiento de Solicitudes</h1>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-xl transition-all"
                    >
                        <FileText className="w-4 h-4" />
                        Exportar Excel
                    </button>
                    <button
                        onClick={() => navigate('/cliente-interno')}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-xl transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Regresar
                    </button>
                    <button
                        onClick={fetchSolicitudes}
                        className="flex items-center gap-2 px-4 py-2 bg-[#8e44ad]/20 hover:bg-[#8e44ad]/30 border border-[#8e44ad]/30 text-[#e4e6ea] rounded-xl transition-all"
                    >
                        <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 pb-12 relative z-10">

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-[#1e2230]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center hover:bg-[#1e2230]/80 transition-all group">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <LayoutDashboard className="w-6 h-6 text-blue-400" />
                        </div>
                        <span className="text-3xl font-bold text-white mb-1">{stats.total}</span>
                        <span className="text-sm text-gray-400 uppercase tracking-wider">Total</span>
                    </div>
                    <div className="bg-[#1e2230]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center hover:bg-[#1e2230]/80 transition-all group">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <PlayCircle className="w-6 h-6 text-green-400" />
                        </div>
                        <span className="text-3xl font-bold text-white mb-1">{stats.activas}</span>
                        <span className="text-sm text-gray-400 uppercase tracking-wider">Activas</span>
                    </div>
                    <div className="bg-[#1e2230]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center hover:bg-[#1e2230]/80 transition-all group">
                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <CheckCircle className="w-6 h-6 text-purple-400" />
                        </div>
                        <span className="text-3xl font-bold text-white mb-1">{stats.ejecutadas}</span>
                        <span className="text-sm text-gray-400 uppercase tracking-wider">Ejecutadas</span>
                    </div>
                    <div className="bg-[#1e2230]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center hover:bg-[#1e2230]/80 transition-all group">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <XCircle className="w-6 h-6 text-red-400" />
                        </div>
                        <span className="text-3xl font-bold text-white mb-1">{stats.canceladas}</span>
                        <span className="text-sm text-gray-400 uppercase tracking-wider">Canceladas</span>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por número o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#1e2230]/80 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#8e44ad]/50 transition-all"
                        />
                    </div>
                    <div className="relative min-w-[200px]">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <select
                            value={filterEstado}
                            onChange={(e) => setFilterEstado(e.target.value)}
                            className="w-full bg-[#1e2230]/80 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white appearance-none focus:outline-none focus:border-[#8e44ad]/50 transition-all cursor-pointer"
                        >
                            <option value="">Todos los estados</option>
                            <option value="ACTIVA">Activa</option>
                            <option value="EJECUTADA">Ejecutada</option>
                            <option value="CANCELADA">Cancelada</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-[#1e2230]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-black/20 border-b border-white/5">
                                    <th
                                        onClick={() => handleSort('numero_solicitud')}
                                        className="px-6 py-4 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors select-none"
                                    >
                                        <div className="flex items-center gap-2">
                                            N° Solicitud
                                            {sortConfig?.key === 'numero_solicitud' && (
                                                sortConfig.direction === 'asc' ? <ChevronLeft className="w-4 h-4 rotate-90" /> : <ChevronLeft className="w-4 h-4 -rotate-90" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('fecha_solicitud')}
                                        className="px-6 py-4 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors select-none"
                                    >
                                        <div className="flex items-center gap-2">
                                            Fecha
                                            {sortConfig?.key === 'fecha_solicitud' && (
                                                sortConfig.direction === 'asc' ? <ChevronLeft className="w-4 h-4 rotate-90" /> : <ChevronLeft className="w-4 h-4 -rotate-90" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Descripción</th>
                                    <th
                                        onClick={() => handleSort('estado_actual')}
                                        className="px-6 py-4 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors select-none"
                                    >
                                        <div className="flex items-center gap-2">
                                            Estado
                                            {sortConfig?.key === 'estado_actual' && (
                                                sortConfig.direction === 'asc' ? <ChevronLeft className="w-4 h-4 rotate-90" /> : <ChevronLeft className="w-4 h-4 -rotate-90" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                                            Cargando solicitudes...
                                        </td>
                                    </tr>
                                ) : solicitudes.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                            No se encontraron solicitudes
                                        </td>
                                    </tr>
                                ) : (
                                    solicitudes.map((sol) => (
                                        <tr key={sol.numero_solicitud} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">#{sol.numero_solicitud}</td>
                                            <td className="px-6 py-4 text-gray-300">{new Date(sol.fecha_solicitud).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-gray-300 max-w-md truncate" title={sol.descripcion_solicitud}>
                                                {sol.descripcion_solicitud || 'Sin descripción'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${sol.estado_actual === 'ACTIVA' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                                    sol.estado_actual === 'EJECUTADA' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                                        'bg-red-500/20 text-red-400 border-red-500/30'
                                                    }`}>
                                                    {sol.estado_actual}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleOpenModal(sol)}
                                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-all flex items-center gap-2 ml-auto"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    Ver/Editar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex items-center justify-between">
                        <div className="text-sm text-gray-400">
                            Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalRecords)} a {Math.min(currentPage * itemsPerPage, totalRecords)} de {totalRecords} solicitudes
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-white font-medium px-2">
                                Página {currentPage} de {Math.max(1, totalPages)}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Detalle */}
            {
                isModalOpen && selectedSolicitud && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full max-w-5xl bg-[#1e2230] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-[#1e2230] to-[#2d3241] flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#8e44ad]/20 rounded-lg">
                                        <Wrench className="w-6 h-6 text-[#8e44ad]" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Seguimiento de Solicitud #{selectedSolicitud.numero_solicitud}</h2>
                                        <p className="text-sm text-gray-400">Detalles y gestión de estado</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Modal Body - Scrollable */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                                {/* Info General */}
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                    <h3 className="text-blue-400 font-semibold flex items-center gap-2 mb-3">
                                        <Info className="w-5 h-5" />
                                        Información General
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <span className="block text-gray-400">Fecha Solicitud</span>
                                            <span className="text-white font-medium">{new Date(selectedSolicitud.fecha_solicitud).toLocaleDateString()}</span>
                                        </div>
                                        <div>
                                            <span className="block text-gray-400">Tipo</span>
                                            <span className="text-white font-medium">STI</span>
                                        </div>
                                        <div>
                                            <span className="block text-gray-400">Supervisor</span>
                                            <span className="text-white font-medium">{selectedSolicitud.supervisor_alias || 'Cargando...'}</span>
                                        </div>
                                        <div className="md:col-span-4">
                                            <span className="block text-gray-400">Descripción</span>
                                            <p className="text-white mt-1">{selectedSolicitud.descripcion_solicitud}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Artículos Asociados */}
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Package className="w-5 h-5 text-[#8e44ad]" />
                                        Artículos Asociados
                                    </h3>
                                    <div className="bg-[#1a1d29]/50 border border-white/10 rounded-xl overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-white/5">
                                                    <th className="px-4 py-3 text-left text-gray-400">ID Salida</th>
                                                    <th className="px-4 py-3 text-left text-gray-400">Fecha</th>
                                                    <th className="px-4 py-3 text-left text-gray-400">Artículo</th>
                                                    <th className="px-4 py-3 text-right text-gray-400">Cantidad</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {articulosLoading ? (
                                                    <tr><td colSpan={4} className="p-4 text-center text-gray-500">Cargando artículos...</td></tr>
                                                ) : articulos.length === 0 ? (
                                                    <tr><td colSpan={4} className="p-4 text-center text-gray-500">No hay artículos asociados</td></tr>
                                                ) : (
                                                    articulos.map((art, idx) => (
                                                        <tr key={idx}>
                                                            <td className="px-4 py-3 text-white">#{art.id_salida}</td>
                                                            <td className="px-4 py-3 text-gray-400">{new Date(art.fecha_salida).toLocaleDateString()}</td>
                                                            <td className="px-4 py-3">
                                                                <div className="text-white">{art.nombre_articulo}</div>
                                                                <div className="text-xs text-gray-500">{art.codigo_articulo}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <span className="px-2 py-1 bg-white/10 rounded text-white font-medium">{art.cantidad}</span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Formulario Seguimiento */}
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Wrench className="w-5 h-5 text-[#8e44ad]" />
                                        Estado y Fechas
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#1a1d29]/50 p-6 rounded-xl border border-white/10">
                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400">Estado Actual</label>
                                            <select
                                                value={seguimientoData?.estado_actual || ''}
                                                onChange={(e) => setSeguimientoData(prev => prev ? ({ ...prev, estado_actual: e.target.value }) : null)}
                                                className="w-full bg-[#2d3241] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#8e44ad]"
                                            >
                                                <option value="ACTIVA">ACTIVA</option>
                                                <option value="EJECUTADA">EJECUTADA</option>
                                                <option value="CANCELADA">CANCELADA</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400">Fecha Inicio</label>
                                            <input
                                                type="date"
                                                value={seguimientoData?.fecha_inicio || ''}
                                                onChange={(e) => setSeguimientoData(prev => prev ? ({ ...prev, fecha_inicio: e.target.value }) : null)}
                                                className="w-full bg-[#2d3241] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#8e44ad]"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400">Fecha Finalización</label>
                                            <input
                                                type="date"
                                                value={seguimientoData?.fecha_finalizacion || ''}
                                                onChange={(e) => setSeguimientoData(prev => prev ? ({ ...prev, fecha_finalizacion: e.target.value }) : null)}
                                                className="w-full bg-[#2d3241] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#8e44ad]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Bitácora / Registros */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                            <History className="w-5 h-5 text-[#8e44ad]" />
                                            Bitácora de Seguimiento
                                        </h3>
                                        <button
                                            onClick={() => setShowNuevoRegistro(!showNuevoRegistro)}
                                            className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                        >
                                            <PlusCircle className="w-4 h-4" />
                                            Agregar Registro
                                        </button>
                                    </div>

                                    {showNuevoRegistro && (
                                        <div className="bg-[#2d3241] p-4 rounded-xl border border-white/10 mb-4 animate-in slide-in-from-top-2">
                                            <div className="grid gap-4">
                                                <div>
                                                    <label className="text-sm text-gray-400 mb-1 block">Fecha</label>
                                                    <input
                                                        type="date"
                                                        value={nuevoRegistro.fecha}
                                                        onChange={(e) => setNuevoRegistro(prev => ({ ...prev, fecha: e.target.value }))}
                                                        className="bg-[#1a1d29] border border-white/10 rounded-lg px-3 py-2 text-white w-full"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-sm text-gray-400 mb-1 block">Descripción</label>
                                                    <textarea
                                                        value={nuevoRegistro.texto}
                                                        onChange={(e) => setNuevoRegistro(prev => ({ ...prev, texto: e.target.value }))}
                                                        placeholder="Detalles del avance..."
                                                        className="bg-[#1a1d29] border border-white/10 rounded-lg px-3 py-2 text-white w-full min-h-[80px]"
                                                    />
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setShowNuevoRegistro(false)} className="px-3 py-1.5 text-gray-400 hover:text-white">Cancelar</button>
                                                    <button onClick={handleAddRegistro} className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg">Guardar Registro</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        {registros.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500 bg-[#1a1d29]/30 rounded-xl border border-white/5">
                                                No hay registros de seguimiento
                                            </div>
                                        ) : (
                                            registros.map((reg) => (
                                                <div key={reg.id_registro} className="bg-[#1a1d29]/50 border border-white/5 rounded-xl p-4 border-l-4 border-l-[#8e44ad]">
                                                    <div className="flex items-center gap-2 text-sm text-[#8e44ad] font-medium mb-1">
                                                        <Calendar className="w-4 h-4" />
                                                        {new Date(reg.fecha_registro).toLocaleDateString()}
                                                    </div>
                                                    <p className="text-gray-300 text-sm">{reg.registro_seguimiento}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-white/10 bg-[#1e2230] flex justify-end gap-3 shrink-0">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
                                >
                                    Cerrar
                                </button>
                                <button
                                    onClick={handleSaveSeguimiento}
                                    className="px-6 py-2.5 bg-[#8e44ad] hover:bg-[#9b59b6] text-white font-medium rounded-xl shadow-lg shadow-[#8e44ad]/20 transition-all flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(45, 50, 65, 0.3);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(142, 68, 173, 0.4);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(142, 68, 173, 0.6);
                }
            `}</style>
        </div >
    );
}
