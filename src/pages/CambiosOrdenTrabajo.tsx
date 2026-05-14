import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Edit3,
    ArrowLeft,
    Loader2,
    RefreshCw,
    X,
    Save,
    MapPin,
    Home,
    Users,
    Briefcase,
    User,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';
import SearchModal from '../components/SearchModal';

// --- Interfaces ---
interface Solicitud {
    numero_solicitud: number;
    fecha_solicitud: string;
    descripcion_solicitud: string;
    area_mantenimiento: number | null;
    instalacion_municipal: number | null;
    supervisor_asignado: string | null;
    cliente_interno: number | null;
    // Joined labels
    area_descripcion?: string;
    instalacion_nombre?: string;
    supervisor_alias?: string;
    cliente_nombre?: string;
}

interface CatalogItem {
    id: string | number;
    label: string;
}

interface Catalogs {
    areas: CatalogItem[];
    instalaciones: CatalogItem[];
    supervisores: CatalogItem[];
    clientes: CatalogItem[];
}

export default function CambiosOrdenTrabajo() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Catalogs
    const [catalogs, setCatalogs] = useState<Catalogs>({
        areas: [],
        instalaciones: [],
        supervisores: [],
        clientes: []
    });

    // Modal State
    const [selectedSolicitud, setSelectedSolicitud] = useState<Solicitud | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editData, setEditData] = useState({
        area: '',
        instalacion: '',
        supervisor: '',
        cliente: ''
    });

    // Search Modal for catalogs
    const [searchModal, setSearchModal] = useState<{ isOpen: boolean; type: keyof Catalogs | null; title: string }>({
        isOpen: false,
        type: null,
        title: ''
    });

    // Notification
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // --- Data Loading ---

    const loadCatalogs = async () => {
        try {
            const [areas, instalaciones, supervisores, clientes] = await Promise.all([
                supabase.from("area_mantenimiento_20").select("id_area_mantenimiento, descripcion_area"),
                supabase.from("instalaciones_municipales_16").select("id_instalacion_municipal, instalacion_municipal"),
                supabase.from("colaboradores_06").select("identificacion, alias").eq("supervisor", true).eq("condicion_laboral", false),
                supabase.from("cliente_interno_15").select("id_cliente, nombre")
            ]);

            const mapData = (data: any[], idKey: string, labelKey: string) =>
                (data || []).map(item => ({ id: item[idKey], label: item[labelKey] }))
                    .sort((a, b) => a.label.localeCompare(b.label));

            setCatalogs({
                areas: mapData(areas.data || [], 'id_area_mantenimiento', 'descripcion_area'),
                instalaciones: mapData(instalaciones.data || [], 'id_instalacion_municipal', 'instalacion_municipal'),
                supervisores: mapData(supervisores.data || [], 'identificacion', 'alias'),
                clientes: mapData(clientes.data || [], 'id_cliente', 'nombre')
            });
        } catch (error) {
            console.error("Error loading catalogs:", error);
        }
    };

    const fetchSolicitudes = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch STI solicitudes
            const { data, error } = await supabase
                .from('solicitud_17')
                .select('*')
                .eq('tipo_solicitud', 'STI')
                .order('numero_solicitud', { ascending: false });

            if (error) throw error;

            // 2. Fetch tracking to filter for ACTIVA
            const { data: allStatus } = await supabase
                .from('seguimiento_solicitud')
                .select('numero_solicitud, estado_actual');
            
            const statusMap = new Map(allStatus?.map(s => [s.numero_solicitud, s.estado_actual]));

            // 3. Filter raw data
            const filteredData = (data || []).filter(s => {
                const status = statusMap.get(s.numero_solicitud) || 'ACTIVA';
                return status === 'ACTIVA';
            });

            setSolicitudes(filteredData);
        } catch (error) {
            console.error("Error fetching solicitudes:", error);
            showNotification("Error al cargar las solicitudes", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCatalogs();
        fetchSolicitudes();
    }, [fetchSolicitudes]);

    // Derived state with labels
    const solicitudesConLabels = solicitudes.map(s => {
        const area = catalogs.areas.find(a => a.id === s.area_mantenimiento);
        const instalacion = catalogs.instalaciones.find(i => i.id === s.instalacion_municipal);
        const supervisor = catalogs.supervisores.find(sup => sup.id === s.supervisor_asignado);
        const cliente = catalogs.clientes.find(c => c.id === s.cliente_interno);

        return {
            ...s,
            area_descripcion: area?.label,
            instalacion_nombre: instalacion?.label,
            supervisor_alias: supervisor?.label,
            cliente_nombre: cliente?.label
        };
    });

    // --- Handlers ---

    const handleEdit = (solicitud: Solicitud) => {
        setSelectedSolicitud(solicitud);
        setEditData({
            area: solicitud.area_mantenimiento?.toString() || '',
            instalacion: solicitud.instalacion_municipal?.toString() || '',
            supervisor: solicitud.supervisor_asignado || '',
            cliente: solicitud.cliente_interno?.toString() || ''
        });
        setIsEditModalOpen(true);
    };

    const handleSave = async () => {
        if (!selectedSolicitud) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('solicitud_17')
                .update({
                    area_mantenimiento: editData.area ? parseInt(editData.area) : null,
                    instalacion_municipal: editData.instalacion ? parseInt(editData.instalacion) : null,
                    supervisor_asignado: editData.supervisor || null,
                    cliente_interno: editData.cliente ? parseInt(editData.cliente) : null
                })
                .eq('numero_solicitud', selectedSolicitud.numero_solicitud);

            if (error) throw error;

            showNotification("Orden de trabajo actualizada con éxito", "success");
            setIsEditModalOpen(false);
            fetchSolicitudes();
        } catch (error) {
            console.error("Error updating solicitud:", error);
            showNotification("Error al actualizar la orden", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleOpenSearch = (type: keyof Catalogs, title: string) => {
        setSearchModal({ isOpen: true, type, title });
    };

    const handleSelectSearch = (item: CatalogItem) => {
        if (!searchModal.type) return;
        
        const typeMap: Record<string, string> = {
            areas: 'area',
            instalaciones: 'instalacion',
            supervisores: 'supervisor',
            clientes: 'cliente'
        };

        setEditData(prev => ({ ...prev, [typeMap[searchModal.type!]]: item.id.toString() }));
        setSearchModal({ isOpen: false, type: null, title: '' });
    };

    const filteredSolicitudes = solicitudesConLabels.filter(s => 
        s.numero_solicitud.toString().includes(searchTerm)
    );

    return (
        <div className="min-h-screen bg-black text-[#F5F5F7] p-8">
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <PageHeader 
                        title="Cambios en Orden de Trabajo" 
                        icon={RefreshCw}
                    />
                    <button
                        onClick={() => navigate('/gestion-cambios')}
                        className="btn-ghost !px-6 !py-3 flex items-center gap-2"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">Volver</span>
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-[#121212] border border-[#333333] rounded-[12px] p-6">
                    <div className="relative group max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#86868B] group-focus-within:text-[#0071E3] transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por número de solicitud..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/40 border border-[#333333] rounded-[10px] py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-[#0071E3] transition-all placeholder:text-[#424245] font-medium"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-[#121212] border border-[#333333] rounded-[12px] overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#1D1D1F] border-b border-[#333333]">
                                    <th className="px-8 py-5 text-[10px] font-black text-[#86868B] uppercase tracking-widest italic"># Solicitud</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-[#86868B] uppercase tracking-widest italic text-center">Fecha</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">Solicitante</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">Supervisor</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">Área</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">Instalación</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333333]">
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            {[...Array(7)].map((_, j) => (
                                                <td key={j} className="px-8 py-6">
                                                    <div className="h-4 bg-white/5 rounded w-full"></div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : filteredSolicitudes.length > 0 ? (
                                    filteredSolicitudes.map((s) => (
                                        <tr key={s.numero_solicitud} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-8 py-6 font-black text-[#0071E3] tracking-tight italic">
                                                {s.numero_solicitud}
                                            </td>
                                            <td className="px-8 py-6 text-sm text-[#86868B] font-medium text-center">
                                                {new Date(s.fecha_solicitud).toLocaleDateString()}
                                            </td>
                                            <td className="px-8 py-6 text-sm text-[#F5F5F7] font-bold">
                                                {s.cliente_nombre || 'N/A'}
                                            </td>
                                            <td className="px-8 py-6 text-sm text-[#F5F5F7] font-bold">
                                                {s.supervisor_alias || 'Sin asignar'}
                                            </td>
                                            <td className="px-8 py-6 text-sm text-[#F5F5F7] font-bold">
                                                {s.area_descripcion || 'N/A'}
                                            </td>
                                            <td className="px-8 py-6 text-sm text-[#F5F5F7] font-bold">
                                                {s.instalacion_nombre || 'N/A'}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button
                                                    onClick={() => handleEdit(s)}
                                                    className="p-3 bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20 rounded-[8px] hover:bg-[#0071E3] hover:text-white transition-all group-hover:scale-105"
                                                    title="Editar orden"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="px-8 py-20 text-center text-[#86868B]">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="p-6 bg-white/5 rounded-full">
                                                    <Search className="w-10 h-10 opacity-20" />
                                                </div>
                                                <p className="text-sm font-bold uppercase tracking-widest">No se encontraron órdenes activas</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && selectedSolicitud && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#121212] border border-[#333333] w-full max-w-2xl rounded-[16px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-6 bg-[#1D1D1F] border-b border-[#333333] flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-[#0071E3]/10 rounded-[10px] text-[#0071E3] border border-[#0071E3]/20">
                                    <Edit3 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-[#F5F5F7] italic tracking-tight uppercase">Editar Orden #{selectedSolicitud.numero_solicitud}</h3>
                                    <p className="text-[#86868B] text-[10px] font-bold uppercase tracking-widest mt-1">Realice los cambios necesarios en la solicitud</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-full text-[#86868B] transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Supervisor */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">
                                        <Users className="w-3.5 h-3.5" />
                                        Supervisor Asignado
                                    </label>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            readOnly
                                            value={catalogs.supervisores.find(c => c.id === editData.supervisor)?.label || ''}
                                            placeholder="Seleccione supervisor..."
                                            onClick={() => handleOpenSearch('supervisores', 'Buscar Supervisor')}
                                            className="w-full bg-black/40 border border-[#333333] rounded-[10px] py-4 px-4 text-sm cursor-pointer focus:border-[#0071E3] group-hover:border-[#333333] transition-all font-bold placeholder:text-[#424245]"
                                        />
                                        <button 
                                            onClick={() => handleOpenSearch('supervisores', 'Buscar Supervisor')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#86868B] hover:text-[#0071E3]"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Solicitante */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">
                                        <User className="w-3.5 h-3.5" />
                                        Solicitante (Cliente)
                                    </label>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            readOnly
                                            value={catalogs.clientes.find(c => c.id.toString() === editData.cliente)?.label || ''}
                                            placeholder="Seleccione solicitante..."
                                            onClick={() => handleOpenSearch('clientes', 'Buscar Solicitante')}
                                            className="w-full bg-black/40 border border-[#333333] rounded-[10px] py-4 px-4 text-sm cursor-pointer focus:border-[#0071E3] group-hover:border-[#333333] transition-all font-bold placeholder:text-[#424245]"
                                        />
                                        <button 
                                            onClick={() => handleOpenSearch('clientes', 'Buscar Solicitante')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#86868B] hover:text-[#0071E3]"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Área */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">
                                        <Briefcase className="w-3.5 h-3.5" />
                                        Área de Trabajo
                                    </label>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            readOnly
                                            value={catalogs.areas.find(c => c.id.toString() === editData.area)?.label || ''}
                                            placeholder="Seleccione área..."
                                            onClick={() => handleOpenSearch('areas', 'Buscar Área')}
                                            className="w-full bg-black/40 border border-[#333333] rounded-[10px] py-4 px-4 text-sm cursor-pointer focus:border-[#0071E3] group-hover:border-[#333333] transition-all font-bold placeholder:text-[#424245]"
                                        />
                                        <button 
                                            onClick={() => handleOpenSearch('areas', 'Buscar Área')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#86868B] hover:text-[#0071E3]"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Instalación */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-black text-[#86868B] uppercase tracking-widest italic">
                                        <Home className="w-3.5 h-3.5" />
                                        Instalación Municipal
                                    </label>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            readOnly
                                            value={catalogs.instalaciones.find(c => c.id.toString() === editData.instalacion)?.label || ''}
                                            placeholder="Seleccione instalación..."
                                            onClick={() => handleOpenSearch('instalaciones', 'Buscar Instalación')}
                                            className="w-full bg-black/40 border border-[#333333] rounded-[10px] py-4 px-4 text-sm cursor-pointer focus:border-[#0071E3] group-hover:border-[#333333] transition-all font-bold placeholder:text-[#424245]"
                                        />
                                        <button 
                                            onClick={() => handleOpenSearch('instalaciones', 'Buscar Instalación')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#86868B] hover:text-[#0071E3]"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 bg-[#1D1D1F]/50 border-t border-[#333333] flex items-center justify-end gap-4">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-8 py-4 bg-[#2C2C2E] text-white rounded-[12px] text-[11px] font-black uppercase tracking-widest hover:bg-[#3A3A3C] transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-10 py-4 bg-[#0071E3] text-white rounded-[12px] text-[11px] font-black uppercase tracking-widest hover:bg-[#0077ED] transition-all flex items-center gap-3 shadow-lg shadow-[#0071E3]/20 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        <span>Guardar Cambios</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Catalog Search Modal */}
            <SearchModal
                isOpen={searchModal.isOpen}
                onClose={() => setSearchModal({ isOpen: false, type: null, title: '' })}
                onSelect={handleSelectSearch}
                options={searchModal.type ? catalogs[searchModal.type] : []}
                title={searchModal.title}
            />

            {/* Notifications */}
            {notification && (
                <div className={cn(
                    "fixed bottom-8 right-8 z-[100] flex items-center gap-4 px-6 py-4 rounded-[12px] border shadow-2xl animate-in slide-in-from-right duration-300",
                    notification.type === 'success' ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" : "bg-rose-500/10 border-rose-500/50 text-rose-400"
                )}>
                    {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                    <span className="text-[11px] font-black uppercase tracking-widest">{notification.message}</span>
                </div>
            )}
        </div>
    );
}
