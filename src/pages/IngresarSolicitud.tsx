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

    const themeColor = 'neutral';

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
                "text-[10px] font-semibold uppercase tracking-[0.14em] ml-1 block text-[#a1a1aa]",
                required && "after:content-['*'] after:text-rose-500 after:ml-1"
            )}>
                {label}
            </label>
            <div
                onClick={locked ? undefined : onOpen}
                className={cn(
                    "group relative bg-[#111112] border rounded-lg p-4 transition-colors flex items-center justify-between",
                    locked ? "border-[#27272a] opacity-60 cursor-not-allowed" : "border-[#3f3f46] cursor-pointer hover:border-[#a1a1aa]"
                )}
            >
                <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border",
                        locked ? "bg-[#0d0d0e] border-[#27272a]" : "bg-[#18181b] border-[#3f3f46]"
                    )}>
                        <Icon className={cn("w-5 h-5", locked ? "text-[#71717a]" : "text-[#d4d4d8]")} />
                    </div>
                    <div className="min-w-0">
                        <span className={cn(
                            "block truncate font-semibold text-sm",
                            value ? 'text-[#f4f4f5]' : 'text-[#71717a]'
                        )}>
                            {displayValue || 'Seleccionar...'}
                        </span>
                        {value && (
                            <span className={cn(
                                "text-[9px] font-medium uppercase tracking-[0.1em]",
                                locked ? "text-[#52525b]" : "text-[#a1a1aa]"
                            )}>
                                {locked ? "Asignado automáticamente" : "Sincronizado con Base de Datos"}
                            </span>
                        )}
                    </div>
                </div>
                {!locked && <ChevronRight className="w-5 h-5 text-[#71717a] group-hover:text-white transition-colors shrink-0" />}
                {locked && <Shield className="w-4 h-4 text-[#52525b] shrink-0" />}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black p-4 md:p-8 relative text-[#f4f4f5]">

            <PageHeader
                title="Nueva Solicitud"
                icon={FileText}
                themeColor={themeColor}
            />

            <div className="max-w-[1320px] mx-auto space-y-6 relative z-10">
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

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
                    {/* Main Form Section */}
                    <div className="space-y-5">
                        <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-6 md:p-8 space-y-8">
                            <div className="space-y-1 flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-semibold text-white tracking-tight">Detalles del requerimiento</h3>
                                    <p className="text-sm text-[#a1a1aa]">Información necesaria para gestionar la solicitud</p>
                                </div>
                                <div className="w-11 h-11 bg-[#18181b] rounded-lg flex items-center justify-center border border-[#3f3f46]">
                                    <Edit className="w-5 h-5 text-[#d4d4d8]" />
                                </div>
                            </div>

                            {/* Descriptions */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] ml-1 block text-[#a1a1aa] after:content-['*'] after:text-white after:ml-1">
                                    Descripción Técnica del Requerimiento
                                </label>
                                <div className="relative group/text">
                                    <textarea
                                        value={formData.descripcion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                                        className="w-full min-h-[150px] bg-[#111112] border border-[#3f3f46] rounded-lg p-5 text-white text-sm placeholder-[#52525b] focus:outline-none focus:border-[#a1a1aa] transition-colors resize-y leading-relaxed"
                                        placeholder="Describa detalladamente el requerimiento o falla técnica detectada..."
                                    />
                                </div>
                            </div>

                            {/* Selectors Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                    <div className="space-y-5 lg:sticky lg:top-6">
                        {/* Evidence Upload Box */}
                        <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-5 space-y-5">
                            <div className="flex items-center gap-3">
                                <Camera className="w-5 h-5 text-[#d4d4d8]" />
                                <div>
                                    <h3 className="text-base font-semibold text-white">Evidencia fotográfica</h3>
                                    <p className="text-xs text-[#71717a] mt-0.5">Opcional</p>
                                </div>
                            </div>

                            {imagePreview ? (
                                <div className="relative group/preview aspect-[4/3] bg-[#18181b] rounded-lg overflow-hidden border border-[#3f3f46]">
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
                                        className="h-24 rounded-lg bg-[#111112] border border-[#3f3f46] hover:border-[#a1a1aa] transition-colors flex items-center justify-center gap-3 group/opt"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#d4d4d8]">
                                            <Camera className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-semibold text-[#d4d4d8]">Tomar foto</span>
                                    </button>
                                    <label
                                        htmlFor="file-upload"
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={cn(
                                            "h-24 rounded-lg bg-[#111112] border transition-colors flex items-center justify-center gap-3 group/opt cursor-pointer",
                                            isDragging ? "border-white bg-[#18181b]" : "border-[#3f3f46] hover:border-[#a1a1aa]"
                                        )}
                                    >
                                        <input id="file-upload" type="file" className="hidden" onChange={handleImageSelect} accept="image/*" />
                                        <div className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center border",
                                            isDragging ? "bg-white text-black border-white" : "bg-[#18181b] text-[#d4d4d8] border-[#3f3f46]"
                                        )}>
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <span className={cn(
                                            "text-xs font-semibold transition-colors",
                                            isDragging ? "text-white" : "text-[#d4d4d8]"
                                        )}>
                                            {isDragging ? "¡Suéltalo aquí!" : "Subir Archivo"}
                                        </span>
                                        {!isDragging && <span className="text-[10px] text-[#71717a] -ml-1">o arrastre</span>}
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Save Button Container */}
                        <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-5 relative overflow-hidden group">
                            <div className="relative z-10 space-y-5">
                                <div className="space-y-1">
                                    <h4 className="text-white font-semibold text-base">Finalizar solicitud</h4>
                                    <p className="text-[#a1a1aa] text-xs">Verifique los datos antes de guardar</p>
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={saving || loading}
                                    className="w-full py-4 bg-[#e4e4e7] hover:bg-white text-black font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    Guardar STI
                                </button>

                                <p className="text-[9px] text-center text-[#52525b] font-medium uppercase tracking-widest font-mono">
                                    ID: {new Date().getTime().toString(16).toUpperCase()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Camera Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0b0b0c] border border-[#3f3f46] rounded-2xl p-5 max-w-3xl w-full relative overflow-hidden shadow-2xl">
                        <div className="absolute top-8 left-8 z-10">
                            <div className="px-3 py-2 bg-black/75 text-white rounded-lg border border-white/30 flex items-center gap-2 backdrop-blur-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Cámara activa</span>
                            </div>
                        </div>

                        <button onClick={stopCamera} aria-label="Cerrar cámara" className="absolute top-8 right-8 z-10 w-10 h-10 rounded-lg bg-black/75 border border-white/30 flex items-center justify-center text-[#d4d4d8] hover:text-white hover:bg-black transition-colors backdrop-blur-md">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-6 border border-[#3f3f46] group">
                            <video
                                id="camera-video"
                                autoPlay
                                playsInline
                                ref={(video) => video && cameraStream && (video.srcObject = cameraStream)}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 pointer-events-none border-[20px] border-black/10">
                                <div className="absolute top-10 left-10 w-12 h-12 border-t border-l border-white/60" />
                                <div className="absolute top-10 right-10 w-12 h-12 border-t border-r border-white/60" />
                                <div className="absolute bottom-10 left-10 w-12 h-12 border-b border-l border-white/60" />
                                <div className="absolute bottom-10 right-10 w-12 h-12 border-b border-r border-white/60" />
                            </div>
                        </div>

                        <div className="flex justify-center pb-2">
                            <button
                                onClick={capturePhoto}
                                aria-label="Capturar fotografía"
                                className="w-16 h-16 rounded-full bg-[#e4e4e7] border-4 border-[#3f3f46] flex items-center justify-center hover:bg-white transition-colors group/shot"
                            >
                                <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white">
                                    <Camera className="w-5 h-5" />
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
