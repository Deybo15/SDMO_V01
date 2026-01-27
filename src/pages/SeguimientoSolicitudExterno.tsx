import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
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
    Filter
} from 'lucide-react';

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

    const [articulos, setArticulos] = useState<ArticuloAsociado[]>([]);

    // Notification
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

    const cargarSolicitudes = async () => {
        setLoading(true);
        try {
            // 1. Fetch ALL STE Requests with Location Data
            const selectFields = `
                numero_solicitud, 
                fecha_solicitud, 
                descripcion_solicitud, 
                direccion_exacta,
                tipo_solicitud,
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

            // 3. Merge Data and Extract Nested Location
            const mapped: Solicitud[] = solicitudesData.map((s: any) => ({
                ...s,
                barrio: s.barrios_distritos?.barrio || 'No especificado',
                distrito: s.barrios_distritos?.distrito || 'No especificado',
                estado_actual: estadoMap.get(s.numero_solicitud) || 'ACTIVA'
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
            showNotification(`Error al cargar solicitudes: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarSolicitudes();
    }, []);

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
            let { data: seg, error } = await supabase
                .from('seguimiento_solicitud')
                .select('*')
                .eq('numero_solicitud', numero)
                .maybeSingle();

            if (error) throw error;

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
            showNotification(`Error al abrir seguimiento: ${error.message}`, 'error');
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
            showNotification(`Error al cargar registros: ${error.message}`, 'error');
        }
    };

    const cargarMateriales = async (numero: number) => {
        try {
            const { data: salidas, error } = await supabase
                .from('salida_articulo_08')
                .select(`
                    id_salida, 
                    fecha_salida, 
                    dato_salida_13 (
                        cantidad, 
                        articulo, 
                        articulo_01 (nombre_articulo)
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
                const { data: publicUrl } = supabase.storage.from('imagenes-ste').getPublicUrl(name);
                return publicUrl.publicUrl;
            }
            return null;
        };

        const urlActual = await checkAndGetUrl(`FA_${numero}_STE`);
        if (urlActual) setImgActualPreview(urlActual);

        const urlFinal = await checkAndGetUrl(`FD_${numero}_STE`);
        if (urlFinal) setImgFinalPreview(urlFinal);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'actual' | 'final') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
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
        }
    };

    const eliminarImagen = async (type: 'actual' | 'final') => {
        if (!selectedSolicitud || !confirm('¿Estás seguro de que deseas eliminar esta imagen?')) return;

        const fileName = type === 'actual'
            ? `FA_${selectedSolicitud.numero_solicitud}_STE`
            : `FD_${selectedSolicitud.numero_solicitud}_STE`;

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
            showNotification(`Error al eliminar imagen: ${error.message}`, 'error');
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
                await supabase.storage.from('imagenes-ste').upload(
                    `FA_${selectedSolicitud.numero_solicitud}_STE`,
                    fileActual,
                    { upsert: true, contentType: fileActual.type }
                );
                uploadedCount++;
            }
            if (fileFinal) {
                await supabase.storage.from('imagenes-ste').upload(
                    `FD_${selectedSolicitud.numero_solicitud}_STE`,
                    fileFinal,
                    { upsert: true, contentType: fileFinal.type }
                );
                uploadedCount++;
            }

            const msg = uploadedCount > 0
                ? `Seguimiento guardado correctamente. ${uploadedCount} imagen(es) subida(s).`
                : 'Seguimiento guardado correctamente.';

            showNotification(msg, 'success');
            setShowModalSeguimiento(false);
            cargarSolicitudes();

        } catch (error: any) {
            console.error('Error:', error);
            showNotification(`Error al guardar: ${error.message}`, 'error');
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
            showNotification(`Error al guardar registro: ${error.message}`, 'error');
        }
    };

    const handleExportExcel = () => {
        try {
            const dataToExport = filteredSolicitudes.map(s => ({
                'N° Solicitud': s.numero_solicitud,
                'Fecha': s.fecha_solicitud ? new Date(s.fecha_solicitud).toLocaleDateString('es-CR') : 'N/A',
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

            const dateStr = new Date().toISOString().split('T')[0];
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
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden p-1">
            <div className="fixed inset-0 pointer-events-none opacity-30">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[160px]"></div>
                <div className="absolute bottom-[-10%] right-[10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[160px]"></div>
            </div>

            <div className="max-w-[1600px] mx-auto px-4 py-8 relative z-10 space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-[#8e44ad] flex items-center justify-center shadow-2xl shadow-purple-500/40 transform hover:scale-105 transition-transform">
                                <Wrench className="w-7 h-7 text-white" />
                            </div>
                            <span className="text-xs font-black text-purple-400 uppercase tracking-[0.4em] drop-shadow-sm">Gestión Operativa Externa</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-none">
                            Seguimiento <span className="text-[#8e44ad]">STE</span>
                        </h1>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => navigate('/cliente-externo')} className="h-14 px-8 bg-white/5 border-2 border-white/10 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-3 shadow-xl">
                            <ChevronLeft className="w-5 h-5" /> Regresar
                        </button>
                        <button onClick={handleExportExcel} className="h-14 px-8 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all flex items-center gap-3 shadow-xl">
                            <Download className="w-5 h-5" /> Exportar
                        </button>
                    </div>
                </header>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total', value: stats.total, icon: LayoutGrid, color: 'text-blue-400', bg: 'bg-blue-400/20', border: 'border-blue-500/30' },
                        { label: 'Activas', value: stats.activas, icon: PlayCircle, color: 'text-indigo-400', bg: 'bg-indigo-400/20', border: 'border-indigo-500/30' },
                        { label: 'Sincronizadas', value: stats.ejecutadas, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/20', border: 'border-emerald-500/30' },
                        { label: 'Canceladas', value: stats.canceladas, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-400/20', border: 'border-rose-500/30' }
                    ].map((m, i) => (
                        <div key={i} className={cn("bg-white/[0.04] backdrop-blur-3xl border-2 rounded-[2.5rem] p-7 flex items-center gap-6 group hover:bg-white/[0.06] transition-all shadow-2xl", m.border)}>
                            <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center transition-transform group-hover:rotate-12", m.bg, m.color)}>
                                <m.icon className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-4xl font-black text-white tracking-tighter leading-none">{m.value}</p>
                                <p className="text-[11px] font-black text-white/70 uppercase tracking-widest mt-2">{m.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <section className="bg-white/[0.03] border-2 border-white/20 rounded-[3rem] p-10 space-y-8 shadow-3xl">
                    <div className="flex items-center gap-3 mb-2 px-2">
                        <Search className="w-5 h-5 text-purple-500" />
                        <h2 className="text-sm font-black text-white/90 uppercase tracking-[0.3em]">Criterios de Búsqueda</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
                        <div className="lg:col-span-8 space-y-2">
                            <label className="text-[11px] font-black text-white/60 uppercase tracking-widest ml-3">Búsqueda Unificada</label>
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-purple-500 transition-colors" />
                                <input
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-900/50 border-2 border-white/10 rounded-3xl h-16 pl-14 pr-6 text-sm text-white font-bold placeholder:text-white/20 focus:border-purple-500 focus:bg-slate-900 transition-all outline-none"
                                    placeholder="N° Solicitud o descripción..."
                                />
                            </div>
                        </div>
                        <div className="lg:col-span-3 space-y-2">
                            <label className="text-[11px] font-black text-white/60 uppercase tracking-widest ml-3">Estado</label>
                            <div className="relative">
                                <select
                                    value={filterEstado}
                                    onChange={e => setFilterEstado(e.target.value)}
                                    className="w-full bg-slate-900/50 border-2 border-white/10 rounded-3xl h-16 px-6 text-sm text-white font-bold appearance-none cursor-pointer focus:border-purple-500 outline-none transition-all"
                                >
                                    <option value="">TODOS LOS ESTADOS</option>
                                    <option value="ACTIVA">ACTIVAS</option>
                                    <option value="EJECUTADA">EJECUTADAS</option>
                                    <option value="CANCELADA">CANCELADAS</option>
                                </select>
                                <Filter className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                            </div>
                        </div>
                        <div className="lg:col-span-1 flex gap-4 h-16">
                            <button
                                onClick={() => { setSearchTerm(''); setFilterEstado(''); }}
                                className="w-full bg-white/5 border-2 border-white/10 rounded-3xl flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-all text-white/40 hover:text-white group"
                            >
                                <Eraser className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                            </button>
                        </div>
                    </div>
                </section>

                <section className="bg-white/[0.04] backdrop-blur-3xl border-2 border-white/10 rounded-[3.5rem] overflow-hidden shadow-3xl">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b-2 border-white/10">
                                    <th className="px-8 py-8 text-left text-[11px] font-black text-white/50 uppercase tracking-widest bg-white/[0.02]">Solicitud</th>
                                    <th className="px-8 py-8 text-left text-[11px] font-black text-white/50 uppercase tracking-widest bg-white/[0.02]">Descripción</th>
                                    <th className="px-8 py-8 text-left text-[11px] font-black text-white/50 uppercase tracking-widest bg-white/[0.02]">Estado</th>
                                    <th className="px-8 py-8 text-left text-[11px] font-black text-white/50 uppercase tracking-widest bg-white/[0.02]">Última Actividad</th>
                                    <th className="px-8 py-8 text-center text-[11px] font-black text-white/50 uppercase tracking-widest bg-white/[0.02]">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                                                <span className="text-sm font-black text-white/40 uppercase tracking-widest">Sincronizando datos...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredSolicitudes.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-30">
                                                <Search className="w-12 h-12" />
                                                <span className="text-sm font-black uppercase tracking-widest">No se encontraron solicitudes</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSolicitudes.map((sol) => (
                                        <tr key={sol.numero_solicitud} className="group hover:bg-white/[0.05] transition-all cursor-default relative">
                                            <td className="px-8 py-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center font-black text-white shadow-xl">
                                                        {sol.numero_solicitud}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-white/40 uppercase tracking-widest">Radicado</p>
                                                        <p className="text-sm font-bold text-white"># {sol.numero_solicitud}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8">
                                                <p className="text-sm font-bold text-white/90 line-clamp-2 max-w-md leading-relaxed">
                                                    {sol.descripcion_solicitud}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <Calendar className="w-3 h-3 text-white/30" />
                                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">
                                                        {new Date(sol.fecha_solicitud).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8">
                                                <div className={cn(
                                                    "inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest shadow-xl",
                                                    sol.estado_actual === 'ACTIVA' ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" :
                                                        sol.estado_actual === 'EJECUTADA' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                                                            "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                                )}>
                                                    <div className={cn("w-2 h-2 rounded-full animate-pulse shadow-[0_0_12px_rgba(255,255,255,0.5)]",
                                                        sol.estado_actual === 'ACTIVA' ? "bg-indigo-400" :
                                                            sol.estado_actual === 'EJECUTADA' ? "bg-emerald-400" :
                                                                "bg-rose-400"
                                                    )}></div>
                                                    {sol.estado_actual}
                                                </div>
                                            </td>
                                            <td className="px-8 py-8">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-purple-500" />
                                                        <span className="text-sm font-bold text-white">Actualizado</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-6">
                                                        {new Date(sol.fecha_solicitud).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8 text-center">
                                                <button
                                                    onClick={() => abrirModalSeguimiento(sol.numero_solicitud)}
                                                    className="w-14 h-14 bg-white/5 border-2 border-white/10 rounded-[1.25rem] flex items-center justify-center hover:bg-[#8e44ad] hover:border-[#8e44ad] hover:text-white transition-all shadow-xl group/btn mx-auto"
                                                >
                                                    <Eye className="w-6 h-6 transform group-hover/btn:scale-110 transition-transform" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {/* Modal Seguimiento */}
            {showModalSeguimiento && selectedSolicitud && (
                <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-in fade-in zoom-in duration-300">
                    <div className="fixed inset-0 pointer-events-none opacity-20">
                        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#8e44ad]/20 rounded-full blur-[120px]"></div>
                        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
                    </div>

                    {/* Modal Header */}
                    <header className="h-24 min-h-[6rem] border-b-2 border-white/5 bg-white/[0.02] backdrop-blur-3xl px-12 flex items-center justify-between relative z-10 shrink-0">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-[#8e44ad] flex items-center justify-center shadow-2xl shadow-purple-500/20">
                                <History className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.4em]">Seguimiento Técnico</p>
                                <h2 className="text-3xl font-black text-white tracking-tighter">
                                    Solicitud <span className="text-[#8e44ad]"># {selectedSolicitud.numero_solicitud}</span>
                                </h2>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowModalSeguimiento(false)}
                            className="w-14 h-14 bg-white/5 border-2 border-white/10 rounded-2xl flex items-center justify-center hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition-all group"
                        >
                            <X className="w-7 h-7 transform group-hover:rotate-90 transition-transform" />
                        </button>
                    </header>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-y-auto px-12 py-12 relative z-10 custom-scrollbar">
                        <div className="max-w-7xl mx-auto space-y-12 pb-12">

                            {/* Summary Card */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                                <div className="lg:col-span-8 space-y-8">
                                    <div className="bg-white/[0.04] border-2 border-white/10 rounded-[3rem] p-10 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                            <FileText className="w-32 h-32 text-white" />
                                        </div>
                                        <div className="relative z-10">
                                            <h3 className="text-sm font-black text-purple-400 uppercase tracking-widest mb-6">Detalle de la Orden</h3>
                                            <p className="text-2xl font-black text-white leading-tight mb-8">
                                                {selectedSolicitud.descripcion_solicitud}
                                            </p>
                                            <div className="flex flex-wrap gap-8">
                                                <div>
                                                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Estado Operativo</p>
                                                    <div className="relative group">
                                                        <select
                                                            className={cn(
                                                                "appearance-none bg-white/[0.05] border-2 rounded-2xl px-12 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all focus:ring-4 focus:ring-purple-500/20 outline-none cursor-pointer pr-14 h-14",
                                                                seguimientoData.estado_actual === 'ACTIVA' ? "border-indigo-500/30 text-indigo-400 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.1)]" :
                                                                    seguimientoData.estado_actual === 'EJECUTADA' ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]" :
                                                                        "border-rose-500/30 text-rose-400 bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]"
                                                            )}
                                                            value={seguimientoData.estado_actual || ''}
                                                            onChange={(e) => setSeguimientoData({ ...seguimientoData, estado_actual: e.target.value })}
                                                        >
                                                            <option value="" disabled className="bg-[#1a1d29]">SELECCIONAR ESTADO</option>
                                                            <option value="ACTIVA" className="bg-[#1a1d29]">ACTIVA</option>
                                                            <option value="EJECUTADA" className="bg-[#1a1d29]">EJECUTADA</option>
                                                            <option value="CANCELADA" className="bg-[#1a1d29]">CANCELADA</option>
                                                        </select>
                                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                                                            <div className={cn("w-2 h-2 rounded-full animate-pulse shadow-[0_0_10px_currentColor]",
                                                                seguimientoData.estado_actual === 'ACTIVA' ? "bg-indigo-400" :
                                                                    seguimientoData.estado_actual === 'EJECUTADA' ? "bg-emerald-400" :
                                                                        "bg-rose-400"
                                                            )}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Fecha Apertura</p>
                                                    <p className="text-lg font-bold text-white">
                                                        {new Date(selectedSolicitud.fecha_solicitud).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Imágenes del Servicio */}
                                    <div className="bg-white/[0.04] border-2 border-white/10 rounded-[3rem] p-10 space-y-8">
                                        <h3 className="text-sm font-black text-purple-400 uppercase tracking-widest flex items-center gap-3">
                                            <ImageIcon className="w-5 h-5" /> Registro Visual del Servicio
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            {[
                                                { label: 'Condición Inicial (Antes)', key: 'actual' as const, preview: imgActualPreview, inputId: 'file-actual' },
                                                { label: 'Resultado Final (Después)', key: 'final' as const, preview: imgFinalPreview, inputId: 'file-final' }
                                            ].map((img, idx) => (
                                                <div key={idx} className="space-y-4">
                                                    <div className="flex justify-between items-center px-2">
                                                        <span className="text-[11px] font-black text-white/50 uppercase tracking-widest">{img.label}</span>
                                                        <label htmlFor={img.inputId} className="cursor-pointer text-[#8e44ad] hover:text-[#9b59b6] transition-colors">
                                                            <PlusCircle className="w-5 h-5" />
                                                            <input type="file" className="hidden" id={img.inputId} accept="image/*" onChange={(e) => handleImageChange(e, img.key)} />
                                                        </label>
                                                    </div>
                                                    {img.preview ? (
                                                        <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-white/10 group bg-black/40 shadow-2xl">
                                                            <img src={img.preview} alt={img.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                                                                <button onClick={() => setShowModalImagen({ url: img.preview!, title: img.label })} className="w-12 h-12 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-all">
                                                                    <Eye className="w-6 h-6 text-white" />
                                                                </button>
                                                                <button onClick={() => eliminarImagen(img.key)} className="w-12 h-12 bg-rose-500/20 hover:bg-rose-500/40 rounded-full flex items-center justify-center transition-all">
                                                                    <Trash2 className="w-6 h-6 text-rose-400" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <label htmlFor={img.inputId} className="aspect-video rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#8e44ad]/30 transition-all cursor-pointer group">
                                                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                <Upload className="w-8 h-8 text-white/20 group-hover:text-[#8e44ad]/50" />
                                                            </div>
                                                            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Subir Imagen</span>
                                                        </label>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Stock de Materiales Aplicados */}
                                    <div className="bg-white/[0.04] border-2 border-white/10 rounded-[3rem] p-10 space-y-8">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-sm font-black text-purple-400 uppercase tracking-widest flex items-center gap-3">
                                                <Package className="w-5 h-5" /> Stock de Materiales Aplicados
                                            </h3>
                                        </div>
                                        <div className="overflow-hidden rounded-[2rem] border-2 border-white/5 bg-black/20 shadow-inner">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="bg-white/[0.02] border-b-2 border-white/5">
                                                        <th className="px-6 py-5 text-left text-[10px] font-black text-white/30 uppercase tracking-widest">N° Salida</th>
                                                        <th className="px-6 py-5 text-left text-[10px] font-black text-white/30 uppercase tracking-widest">Fecha</th>
                                                        <th className="px-6 py-5 text-left text-[10px] font-black text-white/30 uppercase tracking-widest">Insumo Técnico</th>
                                                        <th className="px-6 py-5 text-center text-[10px] font-black text-white/30 uppercase tracking-widest">Cantidad</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {articulos.length > 0 ? (
                                                        articulos.map((art, idx) => (
                                                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                                                <td className="px-6 py-5">
                                                                    <span className="text-xs font-black text-white/40">#</span>
                                                                    <span className="text-sm font-bold text-white ml-1">{art.id_salida}</span>
                                                                </td>
                                                                <td className="px-6 py-5 text-sm font-medium text-white/60">
                                                                    {new Date(art.fecha_salida).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-6 py-5">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-bold text-white">{art.nombre_articulo}</span>
                                                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-tight">{art.codigo_articulo}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-5 text-center">
                                                                    <span className="inline-block px-4 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg text-sm font-black text-purple-400 shadow-xl">
                                                                        {art.cantidad}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={4} className="px-6 py-12 text-center text-[11px] font-black text-white/10 uppercase tracking-[0.3em]">
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
                                    <div className="bg-white/[0.04] border-2 border-white/10 rounded-[2.5rem] p-8 space-y-6">
                                        <h3 className="text-[11px] font-black text-white/40 uppercase tracking-widest flex items-center gap-3">
                                            <Clock className="w-4 h-4 text-purple-500" /> Cronograma STE
                                        </h3>
                                        {[
                                            { label: 'Ingreso', key: 'fecha_ingreso', color: 'border-blue-500/30' },
                                            { label: 'Inicio', key: 'fecha_inicio', color: 'border-indigo-500/30' },
                                            { label: 'Asignación', key: 'fecha_asignacion', color: 'border-purple-500/30' },
                                            { label: 'Valoración', key: 'fecha_valoracion', color: 'border-amber-500/30' },
                                            { label: 'Finalización', key: 'fecha_finalizacion', color: 'border-emerald-500/30' }
                                        ].map((t, idx) => (
                                            <div key={idx} className={cn("bg-white/[0.02] border-l-4 rounded-xl p-4 flex flex-col gap-2 group/date hover:bg-white/5 transition-colors", t.color)}>
                                                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{t.label}</span>
                                                <input
                                                    type="date"
                                                    className="bg-transparent border-none text-sm font-bold text-white outline-none focus:ring-0 [color-scheme:dark] w-full cursor-pointer p-0 h-auto"
                                                    value={seguimientoData[t.key as keyof typeof seguimientoData] || ''}
                                                    onChange={(e) => setSeguimientoData({ ...seguimientoData, [t.key]: e.target.value })}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={guardarSeguimiento}
                                        disabled={loading}
                                        className="w-full h-20 bg-[#8e44ad] hover:bg-[#9b59b6] disabled:opacity-50 text-white rounded-[1.5rem] flex items-center justify-center gap-4 shadow-2xl shadow-purple-900/40 group transition-all"
                                    >
                                        <Save className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                        <span className="text-sm font-black uppercase tracking-[0.2em]">Guardar Cambios</span>
                                    </button>
                                </div>
                            </div>

                            {/* Bitácora de Registro Técnico */}
                            <div className="bg-white/[0.04] border-2 border-white/10 rounded-[3rem] p-10 space-y-8">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-black text-purple-400 uppercase tracking-widest flex items-center gap-3">
                                        <History className="w-5 h-5" /> Bitácora de Registro Técnico
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setNuevoRegistro({ fecha: new Date().toISOString().split('T')[0], texto: '', tipo: 'General' });
                                            setShowModalRegistro(true);
                                        }}
                                        className="h-12 px-6 bg-white/5 border-2 border-white/10 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all text-white shadow-xl"
                                    >
                                        <PlusCircle className="w-4 h-4 text-emerald-400" /> Nuevo Registro
                                    </button>
                                </div>
                                <div className="space-y-6">
                                    {registros.length > 0 ? (
                                        registros.map((reg, idx) => (
                                            <div key={idx} className="bg-white/[0.02] border-2 border-white/5 rounded-[2rem] p-8 hover:bg-white/[0.04] transition-all relative overflow-hidden group shadow-2xl">
                                                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#8e44ad] opacity-30 group-hover:opacity-100 transition-opacity"></div>
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                                            <Calendar className="w-5 h-5 text-purple-400" />
                                                        </div>
                                                        <span className="text-sm font-black text-white tracking-widest">
                                                            {new Date(reg.fecha_registro).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-bold text-white/70 leading-relaxed whitespace-pre-wrap ml-14">
                                                    {reg.registro_seguimiento}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="h-40 rounded-[2rem] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 opacity-30">
                                            <History className="w-8 h-8" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Sin registros históricos</span>
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
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#1a1d29] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <PlusCircle size={20} className="text-green-400" /> Agregar Registro
                            </h3>
                            <button onClick={() => setShowModalRegistro(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Fecha *</label>
                                <input
                                    type="date"
                                    className="w-full bg-[#1e2230] border border-white/10 rounded-lg p-2.5 text-white focus:border-[#8e44ad] outline-none [color-scheme:dark]"
                                    value={nuevoRegistro.fecha}
                                    onChange={(e) => setNuevoRegistro({ ...nuevoRegistro, fecha: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Detalle del Registro *</label>
                                <textarea
                                    className="w-full bg-[#1e2230] border border-white/10 rounded-lg p-3 text-white focus:border-[#8e44ad] outline-none h-32 resize-none"
                                    placeholder="Escriba los detalles..."
                                    value={nuevoRegistro.texto}
                                    onChange={(e) => setNuevoRegistro({ ...nuevoRegistro, texto: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10 flex justify-end gap-3">
                            <button onClick={() => setShowModalRegistro(false)} className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5">
                                Cancelar
                            </button>
                            <button onClick={guardarRegistro} className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30">
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Imagen Full */}
            {showModalImagen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setShowModalImagen(null)}>
                    <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowModalImagen(null)} className="absolute -top-4 -right-4 w-8 h-8 bg-[#8e44ad] text-white rounded-full flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-lg">
                            <X size={16} />
                        </button>
                        <img src={showModalImagen.url} alt={showModalImagen.title} className="max-w-full max-h-[85vh] rounded-lg border border-white/20 shadow-2xl" />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full text-white text-sm backdrop-blur-sm border border-white/10">
                            {showModalImagen.title}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
