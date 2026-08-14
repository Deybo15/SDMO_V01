import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { cn, formatDateOnly } from '../lib/utils';
import {
    CheckCircle,
    XCircle,
    PlayCircle,
    Wrench,
    PlusCircle,
    X,
    Loader2,
    Info,
    AlertTriangle,
    ChevronLeft,
    Image as ImageIcon,
    Upload,
    Trash2,
    Save,
    History,
    Clock,
    Eraser,
    LayoutGrid,
    Package,
    Download,
    Eye,
    ArrowLeft,
    RotateCw,
    Calendar,
    FileText,
    LayoutDashboard,
    Search,
    Filter,
    ChevronRight,
    ArrowRight
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

// Helper para limpiar nombres de archivos
const sanitizeFileName = (name: string) => {
    return name.replace(/\s/g, '').replace(/[^a-zA-Z0-9_.]/g, '');
};

// Interfaces
interface Solicitud {
    numero_solicitud: number;
    fecha_solicitud: string;
    descripcion_solicitud: string;
    direccion_exacta?: string;
    barrio?: string;
    distrito?: string;
    tipo_solicitud: string;
    estado_actual?: string;
    finalizada?: boolean;
    fecha_actividad?: string;
    solicitud_17_area_mantenimiento?: {
        nombre_area: string;
    };
    supervisor_asignado?: string;
    supervisor_alias?: string;
}

interface Seguimiento {
    numero_solicitud: number;
    estado_actual: string;
    fecha_ingreso?: string;
    fecha_inicio?: string;
    fecha_asignacion?: string;
    fecha_valoracion?: string;
    fecha_finalizacion?: string;
}

interface Registro {
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

export default function SeguimientoSolicitudExterno() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // Data State
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [stats, setStats] = useState({ total: 0, activas: 0, ejecutadas: 0, canceladas: 0 });
    // const [totalRecords, setTotalRecords] = useState(0);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState('');

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: keyof Solicitud; direction: 'asc' | 'desc' } | null>({ key: 'numero_solicitud', direction: 'desc' });

    // Modal State
    const [showModalSeguimiento, setShowModalSeguimiento] = useState(false);
    const [showModalRegistro, setShowModalRegistro] = useState(false);
    const [showModalImagen, setShowModalImagen] = useState<{ url: string, title: string } | null>(null);

    // Selected Item State
    const [selectedSolicitud, setSelectedSolicitud] = useState<Solicitud | null>(null);
    const [seguimientoData, setSeguimientoData] = useState<Seguimiento>({
        numero_solicitud: 0,
        estado_actual: '',
        fecha_ingreso: '',
        fecha_inicio: '',
        fecha_asignacion: '',
        fecha_valoracion: '',
        fecha_finalizacion: ''
    });
    const [registros, setRegistros] = useState<Registro[]>([]);

    // Form State
    const [nuevoRegistro, setNuevoRegistro] = useState({ fecha: '', texto: '', tipo: 'General' });

    // Images State
    const [imgActualPreview, setImgActualPreview] = useState<string | null>(null);
    const [imgFinalPreview, setImgFinalPreview] = useState<string | null>(null);
    const [fileActual, setFileActual] = useState<File | null>(null);
    const [fileFinal, setFileFinal] = useState<File | null>(null);
    const [isDraggingActual, setIsDraggingActual] = useState(false);
    const [isDraggingFinal, setIsDraggingFinal] = useState(false);

    const [articulos, setArticulos] = useState<ArticuloAsociado[]>([]);

    // Notification
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Hovered Description Tooltip State
    const [hoveredDescription, setHoveredDescription] = useState<{ id: number, text: string, x: number, y: number } | null>(null);

    const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    }, []);

    // Helper to fetch all records handling 1000-row limit
    const fetchAll = useCallback(async (table: string, select: string, filterField?: string, filterValue?: string) => {
        const allData: any[] = [];
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
    }, []);

    const cargarSolicitudes = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch ALL STE Requests with Location Data
            const selectFields = `
                numero_solicitud, 
                fecha_solicitud, 
                descripcion_solicitud, 
                direccion_exacta,
                tipo_solicitud,
                supervisor_asignado,
                barrios_distritos(barrio, distrito)
            `;
            const solicitudesData = await fetchAll('solicitud_17', selectFields, 'tipo_solicitud', 'STE');

            if (!solicitudesData || solicitudesData.length === 0) {
                setSolicitudes([]);
                setStats({ total: 0, activas: 0, ejecutadas: 0, canceladas: 0 });
                setLoading(false);
                return;
            }

            // 2. Fetch ALL Seguimientos (Statuses)
            const allSeguimientos = await fetchAll('seguimiento_solicitud', 'numero_solicitud, estado_actual');

            const estadoMap = new Map();
            allSeguimientos.forEach((s: any) => {
                estadoMap.set(s.numero_solicitud, s.estado_actual);
            });

            // 3. Fetch Supervisor Aliases
            const supIds = solicitudesData.map((s: any) => s.supervisor_asignado).filter(Boolean);
            const colabsMap = new Map();
            if (supIds.length > 0) {
                const { data: colabsData } = await supabase
                    .from('colaboradores_06')
                    .select('identificacion, alias')
                    .in('identificacion', supIds);
                colabsData?.forEach(c => colabsMap.set(c.identificacion, c.alias));
            }

            // 4. Merge Data and Extract Nested Location
            const mapped: Solicitud[] = solicitudesData.map((s: any) => ({
                ...s,
                numero_solicitud: Number(s.numero_solicitud),
                barrio: s.barrios_distritos?.barrio || 'No especificado',
                distrito: s.barrios_distritos?.distrito || 'No especificado',
                estado_actual: estadoMap.get(s.numero_solicitud) || 'ACTIVA',
                supervisor_alias: colabsMap.get(s.supervisor_asignado) || 'Sin asignar'
            }));

            // 4. Calculate Stats
            const conteos = { total: mapped.length, activas: 0, ejecutadas: 0, canceladas: 0 };
            mapped.forEach(s => {
                const estado = s.estado_actual?.toUpperCase();
                if (estado === 'ACTIVA') conteos.activas++;
                else if (estado === 'EJECUTADA') conteos.ejecutadas++;
                else if (estado === 'CANCELADA') conteos.canceladas++;
            });

            setSolicitudes(mapped);
            setStats(conteos);

        } catch (error: any) {
            console.error('Error:', error);
            showNotification(`Error al cargar solicitudes: ${error.message} `, 'error');
        } finally {
            setLoading(false);
        }
    }, [fetchAll, showNotification]);

    useEffect(() => {
        cargarSolicitudes();
    }, [cargarSolicitudes]);

    const handleSort = (key: keyof Solicitud) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Filter & Sort Logic
    const filteredSolicitudes = solicitudes.filter(s => {
        const matchesSearch = searchTerm === '' ||
            s.numero_solicitud.toString().includes(searchTerm) ||
            (s.descripcion_solicitud && s.descripcion_solicitud.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = filterEstado === '' || s.estado_actual === filterEstado;

        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        const aVal = a[key] ?? '';
        const bVal = b[key] ?? '';

        if (aVal < bVal) {
            return direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
            return direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Modal Logic
    const abrirModalSeguimiento = async (numero: number) => {
        const solicitud = solicitudes.find(s => s.numero_solicitud === numero);
        if (!solicitud) return;

        setSelectedSolicitud(solicitud);
        setLoading(true);

        try {
            const { data: existingSeg, error } = await supabase
                .from('seguimiento_solicitud')
                .select('*')
                .eq('numero_solicitud', numero)
                .maybeSingle();

            if (error) throw error;

            let seg = existingSeg;
            if (!seg) {
                const { data: newSeg, error: insertError } = await supabase
                    .from('seguimiento_solicitud')
                    .insert({ numero_solicitud: numero, estado_actual: 'ACTIVA' })
                    .select()
                    .single();

                if (insertError) throw insertError;
                seg = newSeg;
                showNotification('Se creó un nuevo registro de seguimiento', 'info');
            }

            setSeguimientoData(seg);
            setImgActualPreview(null);
            setImgFinalPreview(null);
            setFileActual(null);
            setFileFinal(null);

            await cargarImagenes(numero);
            await cargarRegistros(numero);
            await cargarMateriales(numero);

            setShowModalSeguimiento(true);

        } catch (error: any) {
            console.error('Error:', error);
            showNotification(`Error al abrir seguimiento: ${error.message} `, 'error');
        } finally {
            setLoading(false);
        }
    };

    const cargarRegistros = async (numero: number) => {
        try {
            const { data, error } = await supabase
                .from('registro_seguimiento_solicitud')
                .select('*')
                .eq('numero_solicitud', numero)
                .order('fecha_registro', { ascending: false });

            if (error) throw error;
            setRegistros(data || []);
        } catch (error: any) {
            showNotification(`Error al cargar registros: ${error.message} `, 'error');
        }
    };

    const cargarMateriales = async (numero: number) => {
        try {
            const { data: salidas, error } = await supabase
                .from('salida_articulo_08')
                .select(`
            id_salida,
                fecha_salida,
                dato_salida_13(
                    cantidad,
                    articulo,
                    articulo_01(nombre_articulo)
                )
                    `)
                .eq('numero_solicitud', numero);

            if (error) throw error;

            const found: ArticuloAsociado[] = [];
            salidas?.forEach((s: any) => {
                s.dato_salida_13?.forEach((d: any) => {
                    found.push({
                        id_salida: s.id_salida,
                        fecha_salida: s.fecha_salida,
                        cantidad: d.cantidad,
                        nombre_articulo: d.articulo_01?.nombre_articulo || 'N/A',
                        codigo_articulo: d.articulo
                    });
                });
            });
            setArticulos(found);
        } catch (error: any) {
            console.error('Error cargando materiales:', error);
        }
    };

    const cargarImagenes = async (numero: number) => {
        const checkAndGetUrl = async (name: string) => {
            const { data } = await supabase.storage.from('imagenes-ste').list('', { search: name });
            if (data && data.length > 0) {
                // Usar el nombre real del archivo encontrado (por si tiene extensión o espacios remanentes)
                const realName = data[0].name;
                const { data: publicUrl } = supabase.storage.from('imagenes-ste').getPublicUrl(realName);
                return publicUrl.publicUrl;
            }
            return null;
        };

        const urlActual = await checkAndGetUrl(sanitizeFileName(`FA_${String(numero).trim()}_STE`));
        if (urlActual) setImgActualPreview(urlActual);

        const urlFinal = await checkAndGetUrl(sanitizeFileName(`FD_${String(numero).trim()}_STE`));
        if (urlFinal) setImgFinalPreview(urlFinal);
    };

    const processFile = (file: File, type: 'actual' | 'final') => {
        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
            showNotification('Formato no válido. Use JPG, PNG o WebP', 'info');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showNotification('La imagen es demasiado grande (máx 5MB)', 'info');
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            if (type === 'actual') {
                setImgActualPreview(ev.target?.result as string);
                setFileActual(file);
            } else {
                setImgFinalPreview(ev.target?.result as string);
                setFileFinal(file);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'actual' | 'final') => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0], type);
        }
    };

    const handleDragOver = (e: React.DragEvent, type: 'actual' | 'final') => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'actual') setIsDraggingActual(true);
        else setIsDraggingFinal(true);
    };

    const handleDragLeave = (e: React.DragEvent, type: 'actual' | 'final') => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'actual') setIsDraggingActual(false);
        else setIsDraggingFinal(false);
    };

    const handleDrop = (e: React.DragEvent, type: 'actual' | 'final') => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'actual') setIsDraggingActual(false);
        else setIsDraggingFinal(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0], type);
        }
    };

    const eliminarImagen = async (type: 'actual' | 'final') => {
        if (!selectedSolicitud || !confirm('¿Estás seguro de que deseas eliminar esta imagen?')) return;

        const fileName = type === 'actual'
            ? sanitizeFileName(`FA_${String(selectedSolicitud.numero_solicitud).trim()}_STE`)
            : sanitizeFileName(`FD_${String(selectedSolicitud.numero_solicitud).trim()}_STE`);

        try {
            const { error } = await supabase.storage.from('imagenes-ste').remove([fileName]);
            if (error) throw error;

            if (type === 'actual') {
                setImgActualPreview(null);
                setFileActual(null);
            } else {
                setImgFinalPreview(null);
                setFileFinal(null);
            }
            showNotification('Imagen eliminada correctamente', 'success');
        } catch (error: any) {
            showNotification(`Error al eliminar imagen: ${error.message} `, 'error');
        }
    };

    const guardarSeguimiento = async () => {
        if (!selectedSolicitud || !seguimientoData.estado_actual) {
            showNotification('El estado actual es obligatorio', 'info');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('seguimiento_solicitud')
                .update({
                    estado_actual: seguimientoData.estado_actual,
                    fecha_ingreso: seguimientoData.fecha_ingreso || null,
                    fecha_inicio: seguimientoData.fecha_inicio || null,
                    fecha_asignacion: seguimientoData.fecha_asignacion || null,
                    fecha_valoracion: seguimientoData.fecha_valoracion || null,
                    fecha_finalizacion: seguimientoData.fecha_finalizacion || null
                })
                .eq('numero_solicitud', selectedSolicitud.numero_solicitud);

            if (error) throw error;

            let uploadedCount = 0;
            if (fileActual) {
                const fileNameActual = sanitizeFileName(`FA_${String(selectedSolicitud.numero_solicitud).trim()}_STE`);
                await supabase.storage.from('imagenes-ste').upload(
                    fileNameActual,
                    fileActual,
                    { upsert: true, contentType: fileActual.type }
                );
                uploadedCount++;
            }
            if (fileFinal) {
                const fileNameFinal = sanitizeFileName(`FD_${String(selectedSolicitud.numero_solicitud).trim()}_STE`);
                await supabase.storage.from('imagenes-ste').upload(
                    fileNameFinal,
                    fileFinal,
                    { upsert: true, contentType: fileFinal.type }
                );
                uploadedCount++;
            }

            const msg = uploadedCount > 0
                ? `Seguimiento guardado correctamente.${uploadedCount} imagen(es) subida(s).`
                : 'Seguimiento guardado correctamente.';

            showNotification(msg, 'success');
            setShowModalSeguimiento(false);
            cargarSolicitudes();

        } catch (error: any) {
            console.error('Error:', error);
            showNotification(`Error al guardar: ${error.message} `, 'error');
        } finally {
            setLoading(false);
        }
    };

    const guardarRegistro = async () => {
        if (!selectedSolicitud || !nuevoRegistro.fecha || !nuevoRegistro.texto) {
            showNotification('Por favor complete todos los campos obligatorios', 'info');
            return;
        }

        try {
            const { error } = await supabase
                .from('registro_seguimiento_solicitud')
                .insert({
                    numero_solicitud: selectedSolicitud.numero_solicitud,
                    fecha_registro: nuevoRegistro.fecha,
                    registro_seguimiento: nuevoRegistro.texto,
                });

            if (error) throw error;

            showNotification('Registro agregado correctamente', 'success');
            setShowModalRegistro(false);
            setNuevoRegistro({ fecha: '', texto: '', tipo: 'General' });
            await cargarRegistros(selectedSolicitud.numero_solicitud);

        } catch (error: any) {
            showNotification(`Error al guardar registro: ${error.message} `, 'error');
        }
    };

    const handleExportExcel = () => {
        try {
            const dataToExport = filteredSolicitudes.map(s => ({
                'N° Solicitud': s.numero_solicitud,
                'Fecha': s.fecha_solicitud ? formatDateOnly(s.fecha_solicitud) : 'N/A',
                'Descripción': s.descripcion_solicitud || 'Sin descripción',
                'Dirección Exacta': s.direccion_exacta || 'N/A',
                'Barrio': s.barrio || 'N/A',
                'Distrito': s.distrito || 'N/A',
                'Tipo': s.tipo_solicitud || 'N/A',
                'Estado': s.estado_actual || 'ACTIVA'
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Solicitudes STE");

            // Generar buffer XLSX y forzar descarga manual para asegurar nombre de archivo
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const dateStr = new Date().toLocaleDateString('en-CA');
            const fileName = `Seguimiento_Solicitudes_Externas_${dateStr}.xlsx`;

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();

            // Limpieza diferida
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);

            showNotification('Exportación completada', 'success');
        } catch (error: any) {
            console.error('Error al exportar:', error);
            showNotification('Error al exportar: ' + error.message, 'error');
        }
    };

    return (
        <div className="min-h-screen bg-black text-[#f4f4f5] pb-16 selection:bg-white/20">
            <PageHeader
                title="Seguimiento STE"
                icon={Wrench}
                themeColor="neutral"
                subtitle="Consulta y gestión de solicitudes de clientes externos."
                rightElement={
                    <>
                        <button
                            onClick={() => navigate('/cliente-externo')}
                            className="h-11 px-5 bg-[#111112] border border-[#52525b] rounded-lg text-sm font-semibold text-white hover:bg-[#18181b] transition-colors flex items-center gap-2"
                        >
                            <ChevronLeft className="w-4 h-4" /> Regresar
                        </button>
                        <button
                            onClick={handleExportExcel}
                            disabled={loading}
                            className="h-11 px-5 bg-[#e4e4e7] text-black rounded-lg text-sm font-semibold hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" /> Exportar
                        </button>
                    </>
                }
            />

            <div className="max-w-[1600px] mx-auto px-4 md:px-8 space-y-5">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total', value: stats.total, icon: LayoutGrid },
                        { label: 'Activas', value: stats.activas, icon: PlayCircle },
                        { label: 'Terminadas', value: stats.ejecutadas, icon: CheckCircle },
                        { label: 'Canceladas', value: stats.canceladas, icon: XCircle }
                    ].map((m, i) => (
                        <div key={i} className="bg-[#111112] border border-[#3f3f46] rounded-xl p-5 flex items-center gap-5 hover:border-[#71717a] transition-colors">
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center border border-[#52525b] bg-[#18181b] text-[#e4e4e7]">
                                <m.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-3xl font-semibold text-white tracking-tight leading-none">{m.value}</p>
                                <p className="text-xs font-medium text-[#a1a1aa] mt-2">{m.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <section className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-5 md:p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-[#d4d4d8]" />
                        <h2 className="text-base font-semibold text-white">Criterios de búsqueda</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                        <div className="lg:col-span-8 space-y-3">
                            <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-3">Búsqueda Unificada</label>
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a] group-focus-within:text-white transition-colors" />
                                <input
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); }}
                                    className="w-full bg-[#111112] border border-[#3f3f46] rounded-lg h-12 pl-14 pr-6 text-sm text-white placeholder:text-[#71717a] focus:border-[#a1a1aa] transition-colors outline-none"
                                    placeholder="N° Solicitud o descripción técnica..."
                                />
                            </div>
                        </div>
                        <div className="lg:col-span-3 space-y-3">
                            <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-3">Filtrar por Estado</label>
                            <div className="relative">
                                <select
                                    value={filterEstado}
                                    onChange={e => setFilterEstado(e.target.value)}
                                    className="w-full bg-[#111112] border border-[#3f3f46] rounded-lg h-12 px-5 text-sm text-white font-medium appearance-none cursor-pointer focus:border-[#a1a1aa] outline-none transition-colors"
                                >
                                    <option value="">TODOS LOS ESTADOS</option>
                                    <option value="ACTIVA">ACTIVAS</option>
                                    <option value="EJECUTADA">EJECUTADAS</option>
                                    <option value="CANCELADA">CANCELADAS</option>
                                </select>
                                <Filter className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" />
                            </div>
                        </div>
                        <div className="lg:col-span-1 flex gap-4 h-12">
                            <button
                                onClick={() => { setSearchTerm(''); setFilterEstado(''); }}
                                className="w-full bg-[#111112] border border-[#52525b] rounded-lg flex items-center justify-center hover:bg-[#18181b] transition-colors text-[#a1a1aa] hover:text-white group"
                            >
                                <Eraser className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                            </button>
                        </div>
                    </div>
                </section>

                <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl overflow-hidden">
                    <div className="p-4 md:p-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#18181b] border-b border-[#3f3f46] text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em]">
                                        <th className="px-6 py-5">N° Solicitud</th>
                                        <th className="px-6 py-5">Fecha Registro</th>
                                        <th className="px-6 py-5">Descripción STI</th>
                                        <th className="px-6 py-5 text-center">Supervisor</th>
                                        <th className="px-6 py-5 text-center">Estado STI</th>
                                        <th className="px-6 py-5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#27272a]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-10 h-10 border-2 border-[#3f3f46] border-t-white rounded-full animate-spin"></div>
                                                    <span className="text-xs font-medium text-[#a1a1aa]">Sincronizando datos...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredSolicitudes.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-30">
                                                    <Search className="w-10 h-10 text-[#71717a]" />
                                                    <span className="text-xs font-medium text-[#a1a1aa]">No se encontraron solicitudes</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSolicitudes.map((sol) => (
                                            <tr key={sol.numero_solicitud} className="hover:bg-white/[0.035] transition-colors group">
                                                <td className="px-6 py-6">
                                                    <span className="text-base font-semibold text-white tracking-tight">#{sol.numero_solicitud}</span>
                                                </td>
                                                <td className="px-6 py-6">
                                                    <div className="flex items-center gap-2 text-sm font-medium text-[#a1a1aa]">
                                                        <Calendar className="w-4 h-4" />
                                                        {formatDateOnly(sol.fecha_solicitud)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-sm font-medium text-[#e4e4e7] relative cursor-default" onMouseEnter={e => setHoveredDescription({ id: sol.numero_solicitud, text: sol.descripcion_solicitud, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHoveredDescription(null)}>
                                                    <div className="truncate max-w-[300px]">
                                                        {sol.descripcion_solicitud || 'Sin descripción'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-center">
                                                    <span className="px-3 py-1.5 bg-[#18181b] rounded-md border border-[#3f3f46] text-[10px] font-medium text-[#d4d4d8] whitespace-nowrap block w-fit mx-auto">
                                                        {sol.supervisor_alias || 'Sin asignar'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-6 text-center">
                                                    <div className={cn(
                                                        "inline-flex items-center justify-center gap-2 rounded-full border px-3 py-1.5",
                                                        sol.estado_actual?.toUpperCase() === 'EJECUTADA' ? "border-white bg-white text-black" :
                                                            sol.estado_actual?.toUpperCase() === 'CANCELADA' ? "border-[#3f3f46] bg-[#111112] text-[#71717a]" : "border-[#71717a] bg-[#18181b] text-[#e4e4e7]"
                                                    )}>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                                        <span className="text-[10px] font-semibold uppercase tracking-wider">
                                                            {sol.estado_actual || 'ACTIVA'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => abrirModalSeguimiento(sol.numero_solicitud)}
                                                            className="p-2.5 bg-[#18181b] border border-[#3f3f46] text-[#a1a1aa] hover:text-white hover:border-[#71717a] rounded-lg transition-colors"
                                                            title="Ver detalles"
                                                        >
                                                            <Eye className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Seguimiento */}
            {showModalSeguimiento && selectedSolicitud && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
                    {/* Modal Header */}
                    <header className="h-20 min-h-[5rem] border-b border-[#3f3f46] bg-[#111112] px-6 md:px-10 flex items-center justify-between relative z-10 shrink-0">
                        <div className="flex items-center gap-6">
                            <div className="w-11 h-11 rounded-lg bg-[#18181b] border border-[#52525b] flex items-center justify-center">
                                <History className="w-5 h-5 text-[#e4e4e7]" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.24em]">Seguimiento técnico</p>
                                <h2 className="text-2xl font-semibold text-white tracking-tight">
                                    Solicitud <span className="text-[#d4d4d8]">#{selectedSolicitud.numero_solicitud}</span>
                                </h2>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowModalSeguimiento(false)}
                            className="w-11 h-11 bg-transparent border border-[#52525b] rounded-lg flex items-center justify-center text-[#a1a1aa] hover:bg-[#18181b] hover:text-white transition-colors group"
                        >
                            <X className="w-6 h-6 transform group-hover:rotate-90 transition-transform" />
                        </button>
                    </header>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 relative z-10 custom-scrollbar">
                        <div className="max-w-[1500px] mx-auto space-y-5 pb-8">

                            {/* Summary Card */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                <div className="lg:col-span-8 space-y-5">
                                    <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-6 relative overflow-hidden group">
                                        <div className="relative z-10">
                                            <h3 className="text-base font-semibold text-white mb-4">Detalle de la orden</h3>
                                            <p className="text-lg font-medium text-[#e4e4e7] leading-relaxed mb-6">
                                                {selectedSolicitud.descripcion_solicitud}
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                                <div>
                                                    <p className="text-[9px] font-black text-[#86868B] uppercase tracking-widest mb-2">Estado Operativo</p>
                                                    <div className="relative">
                                                        <select
                                                            className={cn(
                                                                "appearance-none bg-[#18181b] border border-[#3f3f46] rounded-lg px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors focus:border-[#a1a1aa] outline-none cursor-pointer pr-14 h-12 w-full",
                                                                seguimientoData.estado_actual === 'EJECUTADA' ? "text-white" :
                                                                    seguimientoData.estado_actual === 'CANCELADA' ? "text-[#71717a]" : "text-[#d4d4d8]"
                                                            )}
                                                            value={seguimientoData.estado_actual || ''}
                                                            onChange={(e) => setSeguimientoData({ ...seguimientoData, estado_actual: e.target.value })}
                                                        >
                                                            <option value="" disabled className="bg-[#121212]">SELECCIONAR ESTADO</option>
                                                            <option value="ACTIVA" className="bg-[#121212]">ACTIVA</option>
                                                            <option value="EJECUTADA" className="bg-[#121212]">EJECUTADA</option>
                                                            <option value="CANCELADA" className="bg-[#121212]">CANCELADA</option>
                                                        </select>
                                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                                                            <Filter className="w-3 h-3 text-[#333333]" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-[#86868B] uppercase tracking-widest mb-2">Fecha Apertura</p>
                                                    <div className="h-12 flex items-center px-4 bg-[#18181b] border border-[#3f3f46] rounded-lg">
                                                        <Calendar className="w-4 h-4 text-[#d4d4d8] mr-3" />
                                                        <p className="text-sm font-bold text-[#F5F5F7]">
                                                            {formatDateOnly(selectedSolicitud.fecha_solicitud)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Imágenes del Servicio */}
                                    <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-6 space-y-6">
                                        <h3 className="text-base font-semibold text-white flex items-center gap-3">
                                            <ImageIcon className="w-5 h-5 text-[#d4d4d8]" /> Registro visual del servicio
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            {[
                                                { label: 'Condición Inicial (Antes)', key: 'actual' as const, preview: imgActualPreview, inputId: 'file-actual', isDragging: isDraggingActual },
                                                { label: 'Resultado Final (Después)', key: 'final' as const, preview: imgFinalPreview, inputId: 'file-final', isDragging: isDraggingFinal }
                                            ].map((img, idx) => (
                                                <div key={idx} className="space-y-4">
                                                    <div className="flex justify-between items-center px-2">
                                                        <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">{img.label}</span>
                                                        <label htmlFor={img.inputId} className="cursor-pointer text-[#d4d4d8] hover:text-white transition-colors">
                                                            <PlusCircle className="w-5 h-5" />
                                                            <input type="file" className="hidden" id={img.inputId} accept="image/*" onChange={(e) => handleImageChange(e, img.key)} />
                                                        </label>
                                                    </div>
                                                    {img.preview ? (
                                                        <div
                                                            className="relative aspect-video rounded-lg overflow-hidden border border-[#3f3f46] group bg-[#18181b]"
                                                            onDragOver={(e) => handleDragOver(e, img.key)}
                                                            onDragLeave={(e) => handleDragLeave(e, img.key)}
                                                            onDrop={(e) => handleDrop(e, img.key)}
                                                        >
                                                            <img src={img.preview} alt={img.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                                                                <button onClick={() => setShowModalImagen({ url: img.preview!, title: img.label })} className="w-12 h-12 bg-white/20 hover:bg-white/40 rounded-[8px] flex items-center justify-center transition-all">
                                                                    <Eye className="w-6 h-6 text-white" />
                                                                </button>
                                                                <button onClick={() => eliminarImagen(img.key)} className="w-12 h-12 bg-black/60 hover:bg-black rounded-lg border border-white/20 flex items-center justify-center transition-colors">
                                                                    <Trash2 className="w-6 h-6 text-white" />
                                                                </button>
                                                            </div>
                                                            {img.isDragging && (
                                                                <div className="absolute inset-0 bg-white/10 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-white z-20">
                                                                    <Upload className="w-12 h-12 text-white animate-bounce" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <label
                                                            htmlFor={img.inputId}
                                                            className={cn(
                                                                "aspect-video rounded-[8px] border border-dashed flex flex-col items-center justify-center gap-6 bg-[#1D1D1F]/50 hover:bg-[#1D1D1F] transition-all cursor-pointer group px-6 text-center",
                                                                img.isDragging ? "border-white bg-white/5" : "border-[#3f3f46] hover:border-[#71717a]"
                                                            )}
                                                            onDragOver={(e) => handleDragOver(e, img.key)}
                                                            onDragLeave={(e) => handleDragLeave(e, img.key)}
                                                            onDrop={(e) => handleDrop(e, img.key)}
                                                        >
                                                            <div className="w-16 h-16 rounded-full bg-[#18181b] border border-[#52525b] flex items-center justify-center group-hover:border-white transition-colors relative overflow-hidden">
                                                                <Upload className={cn(
                                                                    "w-8 h-8 transition-colors",
                                                                    img.isDragging ? "text-white" : "text-[#71717a] group-hover:text-white"
                                                                )} />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] font-black text-[#F5F5F7] uppercase tracking-[0.2em]">Arrastra o selecciona una imagen</p>
                                                                <p className="text-[9px] font-bold text-[#86868B] uppercase tracking-widest">Soporta PNG, JPG, WEBP (MAX 5MB)</p>
                                                            </div>
                                                        </label>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Stock de Materiales Aplicados */}
                                    <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-6 space-y-6">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-base font-semibold text-white flex items-center gap-3">
                                                <Package className="w-5 h-5 text-[#d4d4d8]" /> Insumos técnicos aplicados
                                            </h3>
                                        </div>
                                        <div className="overflow-hidden rounded-lg border border-[#3f3f46] bg-[#111112]">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="bg-[#18181b] border-b border-[#3f3f46]">
                                                        <th className="px-6 py-5 text-left text-[9px] font-black text-[#86868B] uppercase tracking-widest">N° Salida</th>
                                                        <th className="px-6 py-5 text-left text-[9px] font-black text-[#86868B] uppercase tracking-widest">Fecha</th>
                                                        <th className="px-6 py-5 text-left text-[9px] font-black text-[#86868B] uppercase tracking-widest">Insumo</th>
                                                        <th className="px-6 py-5 text-center text-[9px] font-black text-[#86868B] uppercase tracking-widest">Cant.</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#27272a]">
                                                    {articulos.length > 0 ? (
                                                        articulos.map((art, idx) => (
                                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                                <td className="px-6 py-5">
                                                                    <span className="text-sm font-semibold text-white">#{art.id_salida}</span>
                                                                </td>
                                                                <td className="px-6 py-5 text-sm font-medium text-[#86868B]">
                                                                    {formatDateOnly(art.fecha_salida)}
                                                                </td>
                                                                <td className="px-6 py-5">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-bold text-[#F5F5F7]">{art.nombre_articulo}</span>
                                                                        <span className="text-[9px] font-black text-[#86868B] uppercase tracking-tight">{art.codigo_articulo}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-5 text-center">
                                                                    <span className="inline-block px-4 py-1.5 bg-[#18181b] border border-[#52525b] rounded-md text-xs font-semibold text-white">
                                                                        {art.cantidad}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={4} className="px-6 py-12 text-center text-[10px] font-black text-[#86868B] uppercase tracking-[0.3em] opacity-40 italic">
                                                                No hay materiales vinculados a esta solicitud
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Sidebar Info */}
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-6 space-y-4">
                                        <h3 className="text-base font-semibold text-white flex items-center gap-3 pb-3 border-b border-[#27272a]">
                                            <Clock className="w-4 h-4 text-[#d4d4d8]" /> Cronograma STE
                                        </h3>
                                        {[
                                            { label: 'Ingreso', key: 'fecha_ingreso' },
                                            { label: 'Inicio', key: 'fecha_inicio' },
                                            { label: 'Asignación', key: 'fecha_asignacion' },
                                            { label: 'Valoración', key: 'fecha_valoracion' },
                                            { label: 'Finalización', key: 'fecha_finalizacion' }
                                        ].map((t, idx) => (
                                            <div key={idx} className="bg-[#18181b] border border-[#3f3f46] rounded-lg p-4 flex flex-col gap-2 group/date hover:border-[#71717a] transition-colors">
                                                <span className="text-[9px] font-black text-[#86868B] uppercase tracking-[0.2em]">{t.label}</span>
                                                <input
                                                    type="date"
                                                    className="bg-transparent border-none text-sm font-bold text-[#F5F5F7] outline-none focus:ring-0 [color-scheme:dark] w-full cursor-pointer p-0 h-auto"
                                                    value={seguimientoData[t.key as keyof typeof seguimientoData] || ''}
                                                    onChange={(e) => setSeguimientoData({ ...seguimientoData, [t.key]: e.target.value })}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={guardarSeguimiento}
                                        disabled={loading}
                                        className="w-full h-14 bg-[#e4e4e7] hover:bg-white disabled:opacity-50 text-black rounded-lg flex items-center justify-center gap-3 group transition-colors"
                                    >
                                        <Save className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                        <span className="text-sm font-semibold">Guardar cambios</span>
                                    </button>
                                </div>
                            </div>

                            {/* Bitácora de Registro Técnico */}
                            <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-6 space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-base font-semibold text-white flex items-center gap-3">
                                        <History className="w-5 h-5 text-[#d4d4d8]" /> Bitácora de registro técnico
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setNuevoRegistro({ fecha: new Date().toLocaleDateString('en-CA'), texto: '', tipo: 'General' });
                                            setShowModalRegistro(true);
                                        }}
                                        className="h-10 px-5 bg-[#18181b] border border-[#52525b] rounded-lg flex items-center gap-2 text-xs font-semibold hover:bg-[#27272a] transition-colors text-white"
                                    >
                                        <PlusCircle className="w-4 h-4 text-white" /> Nuevo registro
                                    </button>
                                </div>
                                <div className="space-y-6">
                                    {registros.length > 0 ? (
                                        registros.map((reg, idx) => (
                                            <div key={idx} className="bg-[#18181b] border border-[#3f3f46] rounded-lg p-6 hover:border-[#71717a] transition-colors relative overflow-hidden group">
                                                <div className="absolute top-0 left-0 w-px h-full bg-white/40"></div>
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-[#111112] border border-[#52525b] flex items-center justify-center">
                                                            <Calendar className="w-5 h-5 text-[#d4d4d8]" />
                                                        </div>
                                                        <span className="text-[10px] font-black text-[#F5F5F7] tracking-[0.2em] uppercase">
                                                            {formatDateOnly(reg.fecha_registro)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-medium text-[#d4d4d8] leading-relaxed whitespace-pre-wrap ml-14">
                                                    {reg.registro_seguimiento}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="h-40 rounded-[8px] border border-dashed border-[#333333] flex flex-col items-center justify-center gap-3 opacity-40">
                                            <History className="w-8 h-8 text-[#333333]" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[#86868B]">Sin registros históricos</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Agregar Registro */}
            {showModalRegistro && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 shadow-3xl">
                    <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl shadow-4xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-[#3f3f46] bg-[#111112] flex justify-between items-center">
                            <h3 className="text-sm font-black text-[#F5F5F7] uppercase tracking-widest flex items-center gap-3">
                                <PlusCircle size={20} className="text-[#d4d4d8]" /> Agregar Registro
                            </h3>
                            <button onClick={() => setShowModalRegistro(false)} className="text-[#86868B] hover:text-[#F5F5F7] transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-1">Fecha de Registro *</label>
                                <input
                                    type="date"
                                    className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg p-4 text-white font-medium focus:border-[#a1a1aa] outline-none [color-scheme:dark] h-12"
                                    value={nuevoRegistro.fecha}
                                    onChange={(e) => setNuevoRegistro({ ...nuevoRegistro, fecha: e.target.value })}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-[#86868B] uppercase tracking-widest ml-1">Detalle Técnico *</label>
                                <textarea
                                    className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg p-4 text-white font-medium focus:border-[#a1a1aa] outline-none h-40 resize-none text-sm"
                                    placeholder="Describa el avance técnico o novedad..."
                                    value={nuevoRegistro.texto}
                                    onChange={(e) => setNuevoRegistro({ ...nuevoRegistro, texto: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="p-6 bg-[#111112] border-t border-[#3f3f46] flex justify-end gap-4">
                            <button onClick={() => setShowModalRegistro(false)} className="px-6 h-12 rounded-[8px] border border-[#F5F5F7] text-[#F5F5F7] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                                Cancelar
                            </button>
                            <button onClick={guardarRegistro} className="px-8 h-12 rounded-lg bg-[#e4e4e7] text-black text-xs font-semibold hover:bg-white transition-colors">
                                Guardar Registro
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Imagen Full */}
            {showModalImagen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6 animate-in fade-in duration-300" onClick={() => setShowModalImagen(null)}>
                    <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowModalImagen(null)} className="absolute -top-6 -right-6 w-12 h-12 bg-[#18181b] border border-[#71717a] text-white rounded-lg flex items-center justify-center hover:bg-[#27272a] transition-colors shadow-2xl z-20">
                            <X size={24} />
                        </button>
                        <div className="rounded-[8px] overflow-hidden border border-white/10 shadow-4xl bg-black">
                            <img src={showModalImagen.url} alt={showModalImagen.title} className="w-full h-auto max-h-[85vh] object-contain" />
                            <div className="bg-[#1D1D1F] p-4 text-center border-t border-[#333333]">
                                <span className="text-[10px] font-black text-[#F5F5F7] uppercase tracking-widest">{showModalImagen.title}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tooltip con más contraste para descripciones largas */}
            {hoveredDescription && (
                <div
                    className="fixed z-[10000] pointer-events-none p-5 bg-black/95 border border-[#333333] rounded-[8px] shadow-4xl max-w-sm backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
                    style={{ left: hoveredDescription.x + 20, top: hoveredDescription.y + 10 }}
                >
                    <p className="text-[11px] text-[#F5F5F7] leading-relaxed italic font-bold">"{hoveredDescription.text}"</p>
                </div>
            )}
        </div>
    );
}
