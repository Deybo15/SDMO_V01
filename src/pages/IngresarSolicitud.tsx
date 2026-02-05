import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import SearchModal from '../components/SearchModal';
import {
    Save,
    ArrowLeft,
    FileText,
    Edit,
    CheckCircle,
    AlertTriangle,
    Info,
    X,
    Loader2,
    Table,
    Camera,
    Upload,
    Trash2,
    Image as ImageIcon,
    MapPin,
    Home,
    Shield,
    Users,
    Calendar,
    ChevronRight,
    MessageSquare,
    Zap
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

// Interfaces
interface CatalogItem {
    id: string | number;
    label: string;
}

interface Catalogs {
    areas: CatalogItem[];
    instalaciones: CatalogItem[];
    supervisores: CatalogItem[];
    profesionales: CatalogItem[];
    clientes: CatalogItem[];
}

interface SearchModalState {
    isOpen: boolean;
    type: keyof Catalogs | null;
    title: string;
}

export default function IngresarSolicitud() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        descripcion: '',
        area: '',
        instalacion: '',
        supervisor: '',
        profesional: '',
        cliente: ''
    });

    // Catalogs State
    const [catalogs, setCatalogs] = useState<Catalogs>({
        areas: [],
        instalaciones: [],
        supervisores: [],
        profesionales: [],
        clientes: []
    });

    // Search Modal State
    const [searchModal, setSearchModal] = useState<SearchModalState>({
        isOpen: false,
        type: null,
        title: ''
    });

    // Notification State
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Image State
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [defaultProfessionalId, setDefaultProfessionalId] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);

    const themeColor = 'blue';

    // Load Data
    useEffect(() => {
        const loadCatalogs = async () => {
            setLoading(true);
            try {
                const [areas, instalaciones, supervisores, profesionales, clientes] = await Promise.all([
                    supabase.from("area_mantenimiento_20").select("id_area_mantenimiento, descripcion_area"),
                    supabase.from("instalaciones_municipales_16").select("id_instalacion_municipal, instalacion_municipal"),
                    supabase.from("colaboradores_06").select("identificacion, alias").eq("supervisor", true).eq("condicion_laboral", false),
                    supabase.from("colaboradores_06").select("identificacion, alias, correo_colaborador").eq("autorizado", true),
                    supabase.from("cliente_interno_15").select("id_cliente, nombre")
                ]);

                const mapData = (data: any[], idKey: string, labelKey: string) =>
                    (data || []).map(item => ({ id: item[idKey], label: item[labelKey] }))
                        .sort((a, b) => a.label.localeCompare(b.label));

                setCatalogs({
                    areas: mapData(areas.data || [], 'id_area_mantenimiento', 'descripcion_area'),
                    instalaciones: mapData(instalaciones.data || [], 'id_instalacion_municipal', 'instalacion_municipal'),
                    supervisores: mapData(supervisores.data || [], 'identificacion', 'alias'),
                    profesionales: mapData(profesionales.data || [], 'identificacion', 'alias'),
                    clientes: mapData(clientes.data || [], 'id_cliente', 'nombre')
                });

                const { data: { user } } = await supabase.auth.getUser();
                const userEmail = user?.email;

                if (userEmail) {
                    const matched = profesionales.data?.find((c: any) =>
                        c.correo_colaborador?.toLowerCase() === userEmail.toLowerCase()
                    );
                    if (matched) {
                        setFormData(prev => ({ ...prev, profesional: matched.identificacion }));
                        setDefaultProfessionalId(matched.identificacion);
                    }
                }
            } catch (error) {
                console.error("Unexpected error loading catalogs:", error);
                showNotification("Error al cargar algunos datos de los catálogos", "error");
            } finally {
                setLoading(false);
            }
        };

        loadCatalogs();
    }, []);

    // Helper Functions
    const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleOpenSearch = (type: keyof Catalogs, title: string) => {
        setSearchModal({ isOpen: true, type, title });
    };

    const handleSelectOption = (item: CatalogItem) => {
        if (searchModal.type) {
            const fieldMap: Record<keyof Catalogs, string> = {
                areas: 'area',
                instalaciones: 'instalacion',
                supervisores: 'supervisor',
                profesionales: 'profesional',
                clientes: 'cliente'
            };

            setFormData(prev => ({ ...prev, [fieldMap[searchModal.type!]]: item.id }));
            setSearchModal({ isOpen: false, type: null, title: '' });
        }
    };

    const handleClearField = (field: keyof typeof formData) => {
        setFormData(prev => ({ ...prev, [field]: '' }));
    };

    // Image Handling
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            showNotification("Imagen cargada por arrastre", "success");
        } else {
            showNotification("Por favor, suelte un archivo de imagen válido", "error");
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            setCameraStream(stream);
            setIsCameraOpen(true);
        } catch (err) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                setCameraStream(stream);
                setIsCameraOpen(true);
            } catch (err2) {
                showNotification("No se pudo acceder a la cámara", "error");
            }
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        const video = document.getElementById('camera-video') as HTMLVideoElement;
        if (video) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                        stopCamera();
                    }
                }, 'image/jpeg');
            }
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
            setImagePreview(null);
        }
    };

    const uploadImageToSupabase = async (file: File): Promise<string | null> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('imagenes-sti')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('imagenes-sti')
                .getPublicUrl(fileName);

            return data.publicUrl;
        } catch (error) {
            console.error("Error uploading image:", error);
            return null;
        }
    };

    const handleSave = async () => {
        if (!formData.descripcion.trim()) {
            showNotification("La descripción es requerida", "error");
            return;
        }
        if (!formData.area || !formData.instalacion || !formData.supervisor || !formData.profesional || !formData.cliente) {
            showNotification("Todos los campos con (*) son obligatorios", "error");
            return;
        }

        setSaving(true);
        try {
            let imageUrl = null;
            if (imageFile) {
                imageUrl = await uploadImageToSupabase(imageFile);
                if (!imageUrl) {
                    showNotification("Error al subir la imagen", "error");
                    setSaving(false);
                    return;
                }
            }

            const { data, error } = await supabase
                .from('solicitud_17')
                .insert([{
                    tipo_solicitud: "STI",
                    fecha_solicitud: new Date().toLocaleDateString('en-CA'),
                    area_mantenimiento: formData.area,
                    descripcion_solicitud: formData.descripcion.trim(),
                    instalacion_municipal: formData.instalacion,
                    supervisor_asignado: formData.supervisor,
                    profesional_responsable: formData.profesional,
                    cliente_interno: formData.cliente,
                    imagen_sti: imageUrl
                }])
                .select('numero_solicitud')
                .single();

            if (error) throw error;

            // Automatically create tracking record so it's visible in the dashboard
            await supabase.from('seguimiento_solicitud').insert({
                numero_solicitud: data.numero_solicitud,
                estado_actual: 'ACTIVA'
            });

            showNotification(`Solicitud #${data.numero_solicitud} guardada exitosamente`, 'success');

            setFormData({
                descripcion: '',
                area: '',
                instalacion: '',
                supervisor: '',
                profesional: defaultProfessionalId,
                cliente: ''
            });
            handleRemoveImage();
        } catch (error: any) {
            showNotification("Error al guardar la solicitud", "error");
        } finally {
            setSaving(false);
        }
    };

    const getSelectedLabel = (catalogKey: keyof Catalogs, value: string | number) => {
        const item = catalogs[catalogKey].find(i => i.id == value);
        return item ? item.label : '';
    };

    // Component for Interactive Selector Cards
    const SelectorCard = ({
        label,
        value,
        displayValue,
        onOpen,
        icon: Icon,
        required = false,
        locked = false
    }: any) => (
        <div className="space-y-3">
            <label className={cn(
                "text-[10px] font-black uppercase tracking-widest ml-1 block opacity-60",
                required && "after:content-['*'] after:text-rose-500 after:ml-1"
            )}>
                {label}
            </label>
            <div
                onClick={locked ? undefined : onOpen}
                className={cn(
                    "group relative bg-[#1D1D1F] border rounded-[8px] p-5 transition-all flex items-center justify-between shadow-2xl",
                    locked ? "border-[#333333] opacity-60 cursor-not-allowed" : "border-[#333333] cursor-pointer hover:border-[#0071E3]/50 active:scale-[0.98]"
                )}
            >
                <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                        "w-10 h-10 rounded-[6px] flex items-center justify-center shrink-0 border",
                        locked ? "bg-[#121212] border-[#333333]" : "bg-[#0071E3]/10 border-[#0071E3]/20"
                    )}>
                        <Icon className={cn("w-5 h-5 transition-transform", locked ? "text-slate-500" : "text-[#0071E3] group-hover:scale-110")} />
                    </div>
                    <div className="min-w-0">
                        <span className={cn(
                            "block truncate font-bold tracking-tight text-sm",
                            value ? 'text-[#F5F5F7]' : 'text-[#424245] italic'
                        )}>
                            {displayValue || 'Seleccionar...'}
                        </span>
                        {value && (
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-[0.1em]",
                                locked ? "text-slate-600" : "text-[#0071E3]"
                            )}>
                                {locked ? "Asignado automáticamente" : "Sincronizado con Base de Datos"}
                            </span>
                        )}
                    </div>
                </div>
                {!locked && <ChevronRight className="w-5 h-5 text-[#424245] group-hover:translate-x-1 transition-transform shrink-0" />}
                {locked && <Shield className="w-4 h-4 text-slate-700 shrink-0" />}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#000000] p-4 md:p-8 relative text-[#F5F5F7]">

            <PageHeader
                title="Nueva Solicitud"
                icon={FileText}
                themeColor={themeColor}
            />

            <div className="max-w-6xl mx-auto space-y-6 relative z-10">
                {/* Notification */}
                {notification && (
                    <div className={cn(
                        "fixed top-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300",
                        notification.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                            notification.type === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' :
                                'bg-blue-500/20 border-blue-500/50 text-blue-400'
                    )}>
                        {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        <span className="font-bold">{notification.message}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Form Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl p-6 md:p-8 md:p-12 space-y-10">
                            <div className="space-y-1 flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-white tracking-tight uppercase italic">Detalles del Requerimiento</h3>
                                    <p className="text-[10px] text-[#86868B] font-bold uppercase tracking-[0.2em]">Siga los lineamientos técnicos de reporte</p>
                                </div>
                                <div className="w-12 h-12 bg-[#0071E3]/10 rounded-[8px] flex items-center justify-center border border-[#0071E3]/20">
                                    <Edit className="w-6 h-6 text-[#0071E3]" />
                                </div>
                            </div>

                            {/* Descriptions */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest ml-1 block text-[#86868B] after:content-['*'] after:text-rose-500 after:ml-1">
                                    Descripción Técnica del Requerimiento
                                </label>
                                <div className="relative group/text">
                                    <textarea
                                        value={formData.descripcion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                                        className="w-full min-h-[180px] bg-[#1D1D1F] border border-[#333333] rounded-[8px] p-6 text-white font-bold placeholder-[#333333] focus:outline-none focus:border-[#0071E3]/50 transition-all shadow-inner resize-none leading-relaxed"
                                        placeholder="Describa detalladamente el requerimiento o falla técnica detectada..."
                                    />
                                </div>
                            </div>

                            {/* Selectors Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <SelectorCard
                                    label="Área de Mantenimiento"
                                    value={formData.area}
                                    displayValue={getSelectedLabel('areas', formData.area)}
                                    onOpen={() => handleOpenSearch('areas', 'Seleccionar Área')}
                                    icon={Home}
                                    required
                                />
                                <SelectorCard
                                    label="Instalación Municipal"
                                    value={formData.instalacion}
                                    displayValue={getSelectedLabel('instalaciones', formData.instalacion)}
                                    onOpen={() => handleOpenSearch('instalaciones', 'Seleccionar Instalación')}
                                    icon={MapPin}
                                    required
                                />
                                <SelectorCard
                                    label="Supervisor Asignado"
                                    value={formData.supervisor}
                                    displayValue={getSelectedLabel('supervisores', formData.supervisor)}
                                    onOpen={() => handleOpenSearch('supervisores', 'Seleccionar Supervisor')}
                                    icon={Shield}
                                    required
                                />
                                <SelectorCard
                                    label="Profesional Responsable"
                                    value={formData.profesional}
                                    displayValue={getSelectedLabel('profesionales', formData.profesional)}
                                    onOpen={formData.profesional ? undefined : () => handleOpenSearch('profesionales', 'Seleccionar Responsable')}
                                    icon={Users}
                                    required
                                    locked={!!formData.profesional}
                                />
                                <div className="md:col-span-2">
                                    <SelectorCard
                                        label="Cliente Interno / Solicitante"
                                        value={formData.cliente}
                                        displayValue={getSelectedLabel('clientes', formData.cliente)}
                                        onOpen={() => handleOpenSearch('clientes', 'Seleccionar Cliente')}
                                        icon={Users}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Side Actions Section */}
                    <div className="space-y-6">
                        {/* Evidence Upload Box */}
                        <div className="bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl p-6 md:p-8 space-y-6">
                            <div className="flex items-center gap-3">
                                <Camera className="w-5 h-5 text-[#0071E3]" />
                                <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Evidencia</h3>
                            </div>

                            {imagePreview ? (
                                <div className="relative group/preview aspect-square bg-[#1D1D1F] rounded-[8px] overflow-hidden border border-[#333333] shadow-inner">
                                    <img src={imagePreview} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Evidencia" />
                                    <div className="absolute inset-0 bg-[#000000]/80 opacity-0 group-hover/preview:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 text-center">
                                        <button
                                            onClick={handleRemoveImage}
                                            className="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all mb-4"
                                        >
                                            <Trash2 className="w-6 h-6" />
                                        </button>
                                        <p className="text-white text-[10px] font-black uppercase tracking-widest">Eliminar Fotografía</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    <button
                                        onClick={startCamera}
                                        className="h-32 rounded-[8px] bg-[#1D1D1F] border border-[#333333] hover:border-[#0071E3]/40 hover:bg-[#0071E3]/5 transition-all flex flex-col items-center justify-center gap-3 group/opt"
                                    >
                                        <div className="w-10 h-10 rounded-[6px] bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3] group-hover/opt:scale-110 transition-transform">
                                            <Camera className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#86868B] group-hover/opt:text-[#0071E3]">Tomar Foto</span>
                                    </button>
                                    <label
                                        htmlFor="file-upload"
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={cn(
                                            "h-32 rounded-[8px] bg-[#1D1D1F] border transition-all flex flex-col items-center justify-center gap-3 group/opt cursor-pointer",
                                            isDragging ? "border-[#0071E3] bg-[#0071E3]/10 scale-[1.02] shadow-2xl shadow-[#0071E3]/20" : "border-[#333333] hover:border-[#0071E3]/40 hover:bg-[#0071E3]/5"
                                        )}
                                    >
                                        <input id="file-upload" type="file" className="hidden" onChange={handleImageSelect} accept="image/*" />
                                        <div className={cn(
                                            "w-10 h-10 rounded-[6px] flex items-center justify-center transition-transform group-hover/opt:scale-110",
                                            isDragging ? "bg-[#0071E3] text-white" : "bg-[#0071E3]/10 text-[#0071E3]"
                                        )}>
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-black uppercase tracking-[0.2em] transition-colors",
                                            isDragging ? "text-[#F5F5F7]" : "text-[#86868B] group-hover/opt:text-[#0071E3]"
                                        )}>
                                            {isDragging ? "¡Suéltalo aquí!" : "Subir Archivo"}
                                        </span>
                                        {!isDragging && <span className="text-[8px] font-bold text-[#424245] uppercase tracking-widest -mt-2">o arrastre imagen</span>}
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Save Button Container */}
                        <div className="bg-[#121212] border border-[#333333] rounded-[8px] p-8 shadow-2xl relative overflow-hidden group">
                            <div className="relative z-10 space-y-6">
                                <div className="space-y-1">
                                    <h4 className="text-white font-black text-2xl uppercase tracking-tighter italic">Finalizar</h4>
                                    <p className="text-[#86868B] text-[10px] font-bold uppercase tracking-widest opacity-80">Asegúrese que los datos son correctos</p>
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={saving || loading}
                                    className="w-full py-6 bg-[#0071E3] hover:bg-[#0077ED] text-white font-black text-xl rounded-[8px] shadow-2xl shadow-[#0071E3]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-tight"
                                >
                                    {saving ? <Loader2 className="w-7 h-7 animate-spin" /> : <Save className="w-7 h-7" />}
                                    Guardar STI
                                </button>

                                <p className="text-[9px] text-center text-[#424245] font-bold uppercase tracking-widest font-mono">
                                    ID: {new Date().getTime().toString(16).toUpperCase()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Camera Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[#121212] border border-[#333333] rounded-[8px] p-6 max-w-3xl w-full relative overflow-hidden shadow-3xl">
                        <div className="absolute top-8 left-8 z-10">
                            <div className="px-4 py-2 bg-[#0071E3] text-white rounded-[4px] flex items-center gap-3 shadow-2xl">
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Cámara Activa</span>
                            </div>
                        </div>

                        <button onClick={stopCamera} className="absolute top-8 right-8 z-10 w-12 h-12 rounded-[8px] bg-[#1D1D1F] border border-[#333333] flex items-center justify-center text-[#86868B] hover:text-[#F5F5F7] hover:bg-white/5 transition-all">
                            <X className="w-6 h-6" />
                        </button>

                        <div className="relative aspect-video bg-black rounded-[4px] overflow-hidden mb-8 group">
                            <video
                                id="camera-video"
                                autoPlay
                                playsInline
                                ref={(video) => video && cameraStream && (video.srcObject = cameraStream)}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 pointer-events-none border-[20px] border-black/10">
                                <div className="absolute top-10 left-10 w-12 h-12 border-t-2 border-l-2 border-[#0071E3]/30" />
                                <div className="absolute top-10 right-10 w-12 h-12 border-t-2 border-r-2 border-[#0071E3]/30" />
                                <div className="absolute bottom-10 left-10 w-12 h-12 border-b-2 border-l-2 border-[#0071E3]/30" />
                                <div className="absolute bottom-10 right-10 w-12 h-12 border-b-2 border-r-2 border-[#0071E3]/30" />
                            </div>
                        </div>

                        <div className="flex justify-center pb-4">
                            <button
                                onClick={capturePhoto}
                                className="w-20 h-20 rounded-full bg-white border-[6px] border-[#0071E3]/20 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all group/shot"
                            >
                                <div className="w-12 h-12 rounded-full bg-[#0071E3] flex items-center justify-center text-white group-hover/shot:scale-90 transition-transform">
                                    <Camera className="w-6 h-6" />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <SearchModal
                isOpen={searchModal.isOpen}
                onClose={() => setSearchModal({ isOpen: false, type: null, title: '' })}
                title={searchModal.title}
                options={searchModal.type ? catalogs[searchModal.type] : []}
                onSelect={handleSelectOption}
            />

            <style>{`
                @keyframes scan-line-slow {
                    0% { top: 10%; }
                    100% { top: 90%; }
                }
                .animate-scan-line-slow {
                    animation: scan-line-slow 4s ease-in-out infinite alternate;
                }
            `}</style>
        </div>
    );
}
