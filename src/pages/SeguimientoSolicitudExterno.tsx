import { useState, useEffect } from 'react';
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
    PlusCircle,
    X,
    Loader2,
    Info,
    AlertTriangle,
    ChevronLeft,
    Image as ImageIcon,
    Upload,
    Trash2,
    Save
} from 'lucide-react';

// Interfaces
interface Solicitud {
    numero_solicitud: number;
    fecha_solicitud: string;
    descripcion_solicitud: string;
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
    fecha_registro: string;
    registro_seguimiento: string;
    tipo_registro?: string;
}

export default function SeguimientoSolicitudExterno() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // Data State
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [stats, setStats] = useState({ total: 0, activas: 0, ejecutadas: 0, canceladas: 0 });
    const [totalRecords, setTotalRecords] = useState(0);

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
            // 1. Fetch ALL STE Requests
            const solicitudesData = await fetchAll('solicitud_17', 'numero_solicitud, fecha_solicitud, descripcion_solicitud, tipo_solicitud', 'tipo_solicitud', 'STE');

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

            // 3. Merge Data
            const mapped: Solicitud[] = solicitudesData.map((s: any) => ({
                ...s,
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
            setTotalRecords(mapped.length);

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

        if (a[key] < b[key]) {
            return direction === 'asc' ? -1 : 1;
        }
        if (a[key] > b[key]) {
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
                'Fecha': new Date(s.fecha_solicitud).toLocaleDateString(),
                'Descripción': s.descripcion_solicitud,
                'Tipo': s.tipo_solicitud,
                'Estado': s.estado_actual
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Solicitudes STE");
            XLSX.writeFile(wb, `Seguimiento_Solicitudes_Externas_${new Date().toISOString().split('T')[0]}.xlsx`);

            showNotification('Exportación completada', 'success');
        } catch (error: any) {
            showNotification('Error al exportar: ' + error.message, 'error');
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
                <div className={`fixed top-24 right-6 z-[110] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right duration-300 ${notification.type === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
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
                        <h1 className="text-2xl font-bold text-white">Seguimiento de Solicitudes Externas</h1>
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
                        onClick={() => navigate('/cliente-externo')}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-xl transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Regresar
                    </button>
                    <button
                        onClick={cargarSolicitudes}
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
                                                <ChevronLeft className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Fecha</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Descripción</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Estado</th>
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
                                ) : filteredSolicitudes.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                            No se encontraron solicitudes
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSolicitudes.map((sol) => (
                                        <tr key={sol.numero_solicitud} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">#{sol.numero_solicitud}</td>
                                            <td className="px-6 py-4 text-gray-300">{new Date(sol.fecha_solicitud).toLocaleDateString('es-ES')}</td>
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
                                                    onClick={() => abrirModalSeguimiento(sol.numero_solicitud)}
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
                </div>
            </div>

            {/* Modal Seguimiento */}
            {showModalSeguimiento && selectedSolicitud && (
                <>
                    {/* Backdrop: Z-60 (Debajo del Sidebar Z-70) para que el menú se vea claro */}
                    <div
                        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowModalSeguimiento(false)}
                    />

                    {/* Modal Wrapper: Z-100 (Encima del Sidebar) para que el modal no se corte */}
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
                        onClick={(e) => {
                            // Close if clicking the empty space (wrapper), but ensuring standard modal behavior
                            if (e.target === e.currentTarget) setShowModalSeguimiento(false);
                        }}
                    >
                        <div className="bg-[#1a1d29] border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl my-8 flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
                                <h2 className="text-xl font-bold flex items-center gap-3 text-white">
                                    <FileText className="text-[#8e44ad]" />
                                    Seguimiento de Solicitud #{selectedSolicitud.numero_solicitud}
                                </h2>
                                <button onClick={() => setShowModalSeguimiento(false)} className="text-gray-400 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
                                {/* Info Card */}
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
                                    <h3 className="text-blue-400 font-semibold flex items-center gap-2 mb-3">
                                        <Info size={18} /> Información
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-400 block">Fecha:</span>
                                            <span className="text-white font-medium">{new Date(selectedSolicitud.fecha_solicitud).toLocaleDateString('es-ES')}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block">Estado:</span>
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border mt-1 ${seguimientoData.estado_actual === 'ACTIVA' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                                seguimientoData.estado_actual === 'EJECUTADA' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                                    'bg-red-500/20 text-red-400 border-red-500/30'
                                                }`}>
                                                {seguimientoData.estado_actual}
                                            </span>
                                        </div>
                                        <div className="md:col-span-3">
                                            <span className="text-gray-400 block">Descripción:</span>
                                            <span className="text-white">{selectedSolicitud.descripcion_solicitud}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Form */}
                                <div>
                                    <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
                                        <RotateCw size={20} className="text-[#8e44ad]" /> Datos de Seguimiento
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-300">Estado Actual *</label>
                                            <select
                                                className="w-full bg-[#1e2230] border border-white/10 rounded-lg p-2.5 text-white focus:border-[#8e44ad] outline-none"
                                                value={seguimientoData.estado_actual || ''}
                                                onChange={(e) => setSeguimientoData({ ...seguimientoData, estado_actual: e.target.value })}
                                            >
                                                <option value="">Seleccionar estado...</option>
                                                <option value="ACTIVA">ACTIVA</option>
                                                <option value="EJECUTADA">EJECUTADA</option>
                                                <option value="CANCELADA">CANCELADA</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-300">Fecha Ingreso</label>
                                            <input type="date" className="w-full bg-[#1e2230] border border-white/10 rounded-lg p-2.5 text-white focus:border-[#8e44ad] outline-none" value={seguimientoData.fecha_ingreso || ''} onChange={(e) => setSeguimientoData({ ...seguimientoData, fecha_ingreso: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-300">Fecha Inicio</label>
                                            <input type="date" className="w-full bg-[#1e2230] border border-white/10 rounded-lg p-2.5 text-white focus:border-[#8e44ad] outline-none" value={seguimientoData.fecha_inicio || ''} onChange={(e) => setSeguimientoData({ ...seguimientoData, fecha_inicio: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-300">Fecha Asignación</label>
                                            <input type="date" className="w-full bg-[#1e2230] border border-white/10 rounded-lg p-2.5 text-white focus:border-[#8e44ad] outline-none" value={seguimientoData.fecha_asignacion || ''} onChange={(e) => setSeguimientoData({ ...seguimientoData, fecha_asignacion: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-300">Fecha Valoración</label>
                                            <input type="date" className="w-full bg-[#1e2230] border border-white/10 rounded-lg p-2.5 text-white focus:border-[#8e44ad] outline-none" value={seguimientoData.fecha_valoracion || ''} onChange={(e) => setSeguimientoData({ ...seguimientoData, fecha_valoracion: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-300">Fecha Finalización</label>
                                            <input type="date" className="w-full bg-[#1e2230] border border-white/10 rounded-lg p-2.5 text-white focus:border-[#8e44ad] outline-none" value={seguimientoData.fecha_finalizacion || ''} onChange={(e) => setSeguimientoData({ ...seguimientoData, fecha_finalizacion: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                {/* Images */}
                                <div>
                                    <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
                                        <ImageIcon size={20} className="text-[#8e44ad]" /> Imágenes
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium text-gray-300 block">Condición Actual</label>
                                            <div className="relative group">
                                                <input type="file" className="hidden" id="file-actual" accept="image/*" onChange={(e) => handleImageChange(e, 'actual')} />
                                                <label htmlFor="file-actual" className="flex items-center justify-center w-full px-4 py-2 bg-[#1e2230] border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition-colors gap-2 text-sm text-gray-300">
                                                    <Upload size={16} /> Seleccionar Imagen
                                                </label>
                                            </div>
                                            {imgActualPreview ? (
                                                <div className="relative rounded-xl overflow-hidden border border-white/10 group">
                                                    <img src={imgActualPreview} alt="Actual" className="w-full h-48 object-cover cursor-pointer hover:scale-105 transition-transform" onClick={() => setShowModalImagen({ url: imgActualPreview, title: 'Condición Actual' })} />
                                                    <button onClick={() => eliminarImagen('actual')} className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <div className="absolute bottom-0 left-0 w-full bg-black/50 p-2 text-xs text-white text-center backdrop-blur-sm">
                                                        Condición Actual
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-48 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-gray-500 bg-white/5">
                                                    <ImageIcon size={32} className="mb-2 opacity-50" />
                                                    <span className="text-sm">Sin imagen</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-sm font-medium text-gray-300 block">Condición Final</label>
                                            <div className="relative group">
                                                <input type="file" className="hidden" id="file-final" accept="image/*" onChange={(e) => handleImageChange(e, 'final')} />
                                                <label htmlFor="file-final" className="flex items-center justify-center w-full px-4 py-2 bg-[#1e2230] border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition-colors gap-2 text-sm text-gray-300">
                                                    <Upload size={16} /> Seleccionar Imagen
                                                </label>
                                            </div>
                                            {imgFinalPreview ? (
                                                <div className="relative rounded-xl overflow-hidden border border-white/10 group">
                                                    <img src={imgFinalPreview} alt="Final" className="w-full h-48 object-cover cursor-pointer hover:scale-105 transition-transform" onClick={() => setShowModalImagen({ url: imgFinalPreview, title: 'Condición Final' })} />
                                                    <button onClick={() => eliminarImagen('final')} className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <div className="absolute bottom-0 left-0 w-full bg-black/50 p-2 text-xs text-white text-center backdrop-blur-sm">
                                                        Condición Final
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-48 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-gray-500 bg-white/5">
                                                    <ImageIcon size={32} className="mb-2 opacity-50" />
                                                    <span className="text-sm">Sin imagen</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Registros */}
                                <div>
                                    <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-4">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <FileText size={20} className="text-[#8e44ad]" /> Registros
                                        </h3>
                                        <button
                                            onClick={() => {
                                                setNuevoRegistro({ fecha: new Date().toISOString().split('T')[0], texto: '', tipo: 'General' });
                                                setShowModalRegistro(true);
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors border border-green-500/30 text-sm font-medium"
                                        >
                                            <PlusCircle size={16} /> Agregar
                                        </button>
                                    </div>

                                    <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                        {registros.length > 0 ? (
                                            registros.map((reg, idx) => (
                                                <div key={idx} className="bg-[#1e2230] border border-white/10 rounded-xl p-4 hover:bg-white/5 transition-colors">
                                                    <div className="flex items-center gap-2 mb-2 text-[#8e44ad] text-sm font-semibold">
                                                        <Calendar size={14} />
                                                        {new Date(reg.fecha_registro).toLocaleDateString('es-ES')}
                                                    </div>
                                                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{reg.registro_seguimiento}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-8 text-gray-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                                                <p>No hay registros de seguimiento.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-white/10 bg-white/5 rounded-b-2xl flex justify-end gap-3">
                                <button onClick={() => setShowModalSeguimiento(false)} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors font-medium">
                                    Cerrar
                                </button>
                                <button onClick={guardarSeguimiento} className="px-5 py-2.5 rounded-xl bg-[#8e44ad] text-white hover:bg-[#9b59b6] transition-all font-medium flex items-center gap-2">
                                    <Save size={18} /> Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </>
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
                                    className="w-full bg-[#1e2230] border border-white/10 rounded-lg p-2.5 text-white focus:border-[#8e44ad] outline-none"
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
