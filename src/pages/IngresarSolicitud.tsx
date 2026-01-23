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
                    fecha_solicitud: new Date().toISOString().split("T")[0],
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

            showNotification(`Solicitud #${data.numero_solicitud} guardada exitosamente`, 'success');

            setFormData({
                descripcion: '',
                area: '',
                instalacion: '',
                supervisor: '',
                profesional: '',
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
        required = false
    }: any) => (
        <div className="space-y-3">
            <label className={cn(
                "text-[10px] font-black uppercase tracking-widest ml-1 block opacity-60",
                required && "after:content-['*'] after:text-rose-500 after:ml-1"
            )}>
                {label}
            </label>
            <div
                onClick={onOpen}
                className="group relative bg-[#1e2235]/40 border border-white/10 rounded-2xl p-4 cursor-pointer hover:bg-white/5 hover:border-purple-500/30 transition-all flex items-center justify-between shadow-inner"
            >
                <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/10">
                        <Icon className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="min-w-0">
                        <span className={cn(
                            "block truncate font-bold tracking-tight",
                            value ? 'text-white' : 'text-gray-600 italic text-sm'
                        )}>
                            {displayValue || 'Seleccionar...'}
                        </span>
                        {value && <span className="text-[9px] text-blue-500/50 font-black uppercase tracking-tighter">Sincronizado</span>}
                    </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-700 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8 relative">
            {/* Ambient Background Elements */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-[100px]" />
            </div>

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
                        <div className="bg-[#1e2235] border border-white/10 rounded-[2.5rem] shadow-2xl p-6 md:p-8 space-y-8">
                            <div className="flex items-center gap-3 mb-2">
                                <Edit className="w-5 h-5 text-blue-400" />
                                <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Detalles del Requerimiento</h3>
                            </div>

                            {/* Descriptions */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest ml-1 block opacity-60 after:content-['*'] after:text-rose-500 after:ml-1">
                                    Descripción Técnica
                                </label>
                                <div className="relative group/text">
                                    <MessageSquare className="absolute left-5 top-5 w-5 h-5 text-gray-700 group-focus-within/text:text-purple-400 transition-colors" />
                                    <textarea
                                        value={formData.descripcion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                                        className="w-full min-h-[160px] bg-black/30 border border-white/10 rounded-3xl py-5 pl-14 pr-6 text-white font-medium placeholder-gray-700 focus:outline-none focus:border-blue-500/50 transition-all shadow-inner resize-none leading-relaxed"
                                        placeholder="Describa detalladamente el requerimiento o falla técnica..."
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
                                    onOpen={() => handleOpenSearch('profesionales', 'Seleccionar Responsable')}
                                    icon={Users}
                                    required
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
                        <div className="bg-[#1e2235] border border-white/10 rounded-[2.5rem] shadow-2xl p-6 md:p-8 space-y-6">
                            <div className="flex items-center gap-3">
                                <Camera className="w-5 h-5 text-blue-400" />
                                <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Evidencia</h3>
                            </div>

                            {imagePreview ? (
                                <div className="relative group/preview aspect-square bg-black/40 rounded-3xl overflow-hidden border border-white/10 shadow-inner">
                                    <img src={imagePreview} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Evidencia" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/preview:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 text-center">
                                        <button
                                            onClick={handleRemoveImage}
                                            className="w-14 h-14 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all mb-4"
                                        >
                                            <Trash2 className="w-6 h-6" />
                                        </button>
                                        <p className="text-white text-xs font-black uppercase tracking-widest">Eliminar Fotografía</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    <button
                                        onClick={startCamera}
                                        className="h-32 rounded-3xl bg-black/30 border border-white/5 border-dashed hover:border-blue-500/40 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center gap-3 group/opt"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover/opt:scale-110 transition-transform">
                                            <Camera className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 group-hover/opt:text-blue-400">Tomar Foto</span>
                                    </button>
                                    <label
                                        htmlFor="file-upload"
                                        className="h-32 rounded-3xl bg-black/30 border border-white/5 border-dashed hover:border-blue-500/40 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center gap-3 group/opt cursor-pointer"
                                    >
                                        <input id="file-upload" type="file" className="hidden" onChange={handleImageSelect} accept="image/*" />
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover/opt:scale-110 transition-transform">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 group-hover/opt:text-blue-400">Subir Archivo</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Save Button Container */}
                        <div className="bg-gradient-to-br from-blue-600 to-cyan-700 rounded-[2.5rem] p-8 shadow-2xl shadow-blue-900/40 relative overflow-hidden group">
                            <Zap className="absolute -right-4 -top-4 w-32 h-32 text-white/5 -rotate-12 group-hover:scale-110 transition-transform duration-700" />

                            <div className="relative z-10 space-y-6">
                                <div className="space-y-1">
                                    <h4 className="text-white font-black text-2xl uppercase tracking-tighter italic">Finalizar</h4>
                                    <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest opacity-80">Asegúrese que los datos son correctos</p>
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={saving || loading}
                                    className="w-full py-5 bg-white text-blue-700 font-black text-xl rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-tight"
                                >
                                    {saving ? <Loader2 className="w-7 h-7 animate-spin" /> : <Save className="w-7 h-7" />}
                                    Guardar STI
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Camera Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[#1e2235] border border-white/10 rounded-[3rem] p-4 max-w-3xl w-full relative overflow-hidden shadow-[0_0_100px_rgba(168,85,247,0.2)]">
                        <div className="absolute top-8 left-8 z-10">
                            <div className="px-4 py-2 bg-purple-500 text-white rounded-full flex items-center gap-3 shadow-2xl">
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Cámara Activa</span>
                            </div>
                        </div>

                        <button onClick={stopCamera} className="absolute top-8 right-8 z-10 w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all backdrop-blur-md">
                            <X className="w-6 h-6" />
                        </button>

                        <div className="relative aspect-video bg-black rounded-[2rem] overflow-hidden mb-6 group">
                            <video
                                id="camera-video"
                                autoPlay
                                playsInline
                                ref={(video) => video && cameraStream && (video.srcObject = cameraStream)}
                                className="w-full h-full object-cover"
                            />
                            {/* Sci-Fi Overlay Markers */}
                            <div className="absolute inset-0 pointer-events-none border-[30px] border-black/20">
                                <div className="absolute top-10 left-10 w-12 h-12 border-t-4 border-l-4 border-purple-500/50 rounded-tl-2xl" />
                                <div className="absolute top-10 right-10 w-12 h-12 border-t-4 border-r-4 border-purple-500/50 rounded-tr-2xl" />
                                <div className="absolute bottom-10 left-10 w-12 h-12 border-b-4 border-l-4 border-purple-500/50 rounded-bl-2xl" />
                                <div className="absolute bottom-10 right-10 w-12 h-12 border-b-4 border-r-4 border-purple-500/50 rounded-br-2xl" />
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.5)] animate-scan-line-slow" />
                            </div>
                        </div>

                        <div className="flex justify-center pb-4">
                            <button
                                onClick={capturePhoto}
                                className="w-24 h-24 rounded-full bg-white border-[8px] border-purple-500/20 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all group/shot"
                            >
                                <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center text-white group-hover/shot:scale-90 transition-transform">
                                    <Camera className="w-8 h-8" />
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
