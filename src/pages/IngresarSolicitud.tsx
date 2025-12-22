import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import SearchModal from '../components/SearchModal';
import FormSelect from '../components/FormSelect';
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
    Calendar
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

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

    // Load Data
    useEffect(() => {
        const loadCatalogs = async () => {
            setLoading(true);
            try {
                const [areas, instalaciones, supervisores, profesionales, clientes] = await Promise.all([
                    supabase.from("area_mantenimiento_20").select("id_area_mantenimiento, descripcion_area"),
                    supabase.from("instalaciones_municipales_16").select("id_instalacion_municipal, instalacion_municipal"),
                    supabase.from("colaboradores_06").select("identificacion, alias").eq("supervisor", true).eq("condicion_laboral", false),
                    supabase.from("colaboradores_06").select("identificacion, alias").eq("autorizado", true),
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
            // Map the catalog type to the form field name
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
            // Try to get the rear camera (environment)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            setCameraStream(stream);
            setIsCameraOpen(true);
        } catch (err) {
            console.error("Error accessing rear camera, trying default:", err);
            try {
                // Fallback to any available camera (e.g. for desktops or if rear unavailable)
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                setCameraStream(stream);
                setIsCameraOpen(true);
            } catch (err2) {
                console.error("Error accessing camera:", err2);
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
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('imagenes-sti')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('imagenes-sti')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            console.error("Error uploading image:", error);
            return null;
        }
    };

    const handleSave = async () => {
        // Validation
        if (!formData.descripcion.trim()) {
            showNotification("La descripción es requerida", "error");
            return;
        }
        if (!formData.area || !formData.instalacion || !formData.supervisor || !formData.profesional || !formData.cliente) {
            showNotification("Todos los campos son obligatorios", "error");
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
                    // Default nulls as per requirement
                    id_solicitud_sa: null,
                    tipologia_trabajo: null,
                    barrio_solicitud: null,
                    direccion_exacta: null,
                    latitud: null,
                    longitud: null,
                    link_ubicacion: null,
                    cliente_externo: null,
                    numero_activo: null,
                    dependencia_municipal: null,
                    imagen_sti: imageUrl
                }])
                .select('numero_solicitud')
                .single();

            if (error) throw error;

            showNotification(`Solicitud #${data.numero_solicitud} guardada exitosamente`, 'success');

            // Reset form
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
            console.error("Error saving request:", error);
            showNotification("Error al guardar la solicitud: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    // Get label for selected value
    const getSelectedLabel = (catalogKey: keyof Catalogs, value: string | number) => {
        const item = catalogs[catalogKey].find(i => i.id == value);
        return item ? item.label : '';
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-[#1a1d29] text-[#e4e6ea] font-sans relative">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-[#7877c6]/30 rounded-full blur-3xl mix-blend-screen" />
                <div className="absolute top-[80%] right-[20%] w-96 h-96 bg-[#ff77c6]/15 rounded-full blur-3xl mix-blend-screen" />
                <div className="absolute top-[40%] left-[40%] w-96 h-96 bg-[#78dbe2]/10 rounded-full blur-3xl mix-blend-screen" />
            </div>

            {/* Notification Toast */}
            {notification && (
                <div className={`fixed top-24 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right duration-300 ${notification.type === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                    notification.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                        'bg-purple-500/20 border-purple-500/30 text-purple-400'
                    }`}>
                    {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
                    {notification.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                    {notification.type === 'info' && <Info className="w-5 h-5" />}
                    <span className="font-medium">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-2 opacity-70 hover:opacity-100">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Background Halos */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[85%] left-[20%] w-[80rem] h-[80rem] bg-purple-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
                <div className="absolute top-[15%] right-[20%] w-[80rem] h-[80rem] bg-violet-600/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>
            </div>

            {/* Header Content */}
            <div className="max-w-7xl mx-auto px-6 pt-6 flex flex-col gap-6 relative z-10">
                <PageHeader
                    title="REGISTRO DE SOLICITUDES"
                    icon={FileText}
                    themeColor="purple"
                    backRoute="/cliente-interno"
                />

                {/* Date Display */}
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-widest bg-purple-500/10 w-fit px-4 py-2 rounded-full border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
            </div>

            <div className="max-w-6xl mx-auto relative z-10 px-6 pb-8">
                {/* Content Card */}
                <div className="bg-[#1E293B]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-500 hover:border-purple-500/20">

                    <div className="p-8 md:p-12 relative">
                        {/* Section Title */}
                        <div className="relative flex items-center gap-3 mb-12">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                                <Edit className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">Información de la Solicitud</h3>
                                <p className="text-[10px] font-black text-purple-400/60 uppercase tracking-widest mt-0.5">Complete todos los campos requeridos</p>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="space-y-8">
                            {/* Description */}
                            <div className="space-y-3">
                                <label className="block text-[11px] font-black uppercase tracking-wider text-purple-400 opacity-80 after:content-['_*'] after:text-rose-500 after:font-bold">
                                    Descripción de la solicitud
                                </label>
                                <textarea
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                                    placeholder="Describa detalladamente el requerimiento o incidencia técnica..."
                                    className="w-full min-h-[140px] bg-[#1E293B]/40 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-y text-sm font-medium leading-relaxed"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                                <FormSelect
                                    label="Área de Mantenimiento"
                                    value={formData.area}
                                    displayValue={getSelectedLabel('areas', formData.area)}
                                    onOpenSearch={() => handleOpenSearch('areas', 'Buscar Área de Mantenimiento')}
                                    onClear={() => handleClearField('area')}
                                    loading={loading}
                                    required
                                    icon={Home}
                                />

                                <FormSelect
                                    label="Instalación Municipal"
                                    value={formData.instalacion}
                                    displayValue={getSelectedLabel('instalaciones', formData.instalacion)}
                                    onOpenSearch={() => handleOpenSearch('instalaciones', 'Buscar Instalación Municipal')}
                                    onClear={() => handleClearField('instalacion')}
                                    loading={loading}
                                    required
                                    icon={MapPin}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormSelect
                                    label="Supervisor Asignado"
                                    value={formData.supervisor}
                                    displayValue={getSelectedLabel('supervisores', formData.supervisor)}
                                    onOpenSearch={() => handleOpenSearch('supervisores', 'Buscar Supervisor')}
                                    onClear={() => handleClearField('supervisor')}
                                    loading={loading}
                                    required
                                    icon={Shield}
                                />

                                <FormSelect
                                    label="Profesional Responsable"
                                    value={formData.profesional}
                                    displayValue={getSelectedLabel('profesionales', formData.profesional)}
                                    onOpenSearch={() => handleOpenSearch('profesionales', 'Buscar Profesional')}
                                    onClear={() => handleClearField('profesional')}
                                    loading={loading}
                                    required
                                    icon={Users}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormSelect
                                    label="Cliente Interno"
                                    value={formData.cliente}
                                    displayValue={getSelectedLabel('clientes', formData.cliente)}
                                    onOpenSearch={() => handleOpenSearch('clientes', 'Buscar Cliente Interno')}
                                    onClear={() => handleClearField('cliente')}
                                    loading={loading}
                                    required
                                    icon={Users}
                                />
                            </div>
                        </div>

                        {/* Image Upload Section */}
                        <div className="mt-12 pt-10 border-t border-white/5">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                                    <ImageIcon className="w-4 h-4" />
                                </div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wider">Evidencia Fotográfica</h4>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                        className="hidden"
                                        id="image-upload"
                                    />
                                    <label
                                        htmlFor="image-upload"
                                        className="group/btn h-32 rounded-[2rem] bg-white/5 border border-white/10 hover:border-purple-500/40 hover:bg-white/[0.08] transition-all cursor-pointer flex flex-col items-center justify-center gap-2 relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-purple-400 group-hover/btn:scale-110 transition-transform relative z-10">
                                            <Upload className="w-5 h-5" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/btn:text-white relative z-10">Subir Imagen</span>
                                    </label>

                                    <button
                                        onClick={startCamera}
                                        className="group/btn h-32 rounded-[2rem] bg-white/5 border border-white/10 hover:border-purple-500/40 hover:bg-white/[0.08] transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-violet-400 group-hover/btn:scale-110 transition-transform relative z-10">
                                            <Camera className="w-5 h-5" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/btn:text-white relative z-10">Tomar Foto</span>
                                    </button>
                                </div>

                                {/* Preview Area */}
                                <div className="relative group/preview">
                                    {imagePreview ? (
                                        <div className="relative aspect-video bg-black/40 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl group-hover/preview:border-purple-500/30 transition-all">
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="w-full h-full object-contain"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-end justify-center pb-6">
                                                <button
                                                    onClick={handleRemoveImage}
                                                    className="flex items-center gap-2 px-6 py-2 bg-rose-500/20 border border-rose-500/40 text-rose-400 rounded-full hover:bg-rose-500 hover:text-white transition-all duration-300 backdrop-blur-md"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Eliminar Imagen</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="aspect-video bg-white/2 rounded-[2.5rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-slate-600 gap-3 group-hover/preview:border-purple-500/20 transition-all">
                                            <div className="w-12 h-12 rounded-full bg-white/[0.02] flex items-center justify-center">
                                                <ImageIcon className="w-6 h-6 opacity-20" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Sin evidencia seleccionada</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Camera Modal */}
                        {isCameraOpen && (
                            <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                                <div className="bg-[#1e2230] border border-white/10 rounded-2xl p-4 max-w-2xl w-full">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-medium text-white">Tomar Fotografía</h3>
                                        <button onClick={stopCamera} className="text-slate-400 hover:text-white">
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>
                                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-4">
                                        <video
                                            id="camera-video"
                                            autoPlay
                                            playsInline
                                            ref={(video) => {
                                                if (video && cameraStream) {
                                                    video.srcObject = cameraStream;
                                                }
                                            }}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex justify-center gap-4">
                                        <button
                                            onClick={stopCamera}
                                            className="px-6 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={capturePhoto}
                                            className="px-6 py-2 rounded-xl bg-[#8e44ad] text-white hover:bg-[#9b59b6] flex items-center gap-2"
                                        >
                                            <Camera className="w-4 h-4" />
                                            Capturar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Buttons */}
                    <div className="p-8 border-t border-white/5 bg-white/[0.02] flex flex-col md:flex-row justify-between items-center gap-6">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full md:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2 group/back"
                        >
                            <ArrowLeft className="w-4 h-4 transition-transform group-hover/back:-translate-x-1" />
                            Regresar
                        </button>

                        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                            <button
                                onClick={() => navigate('/cliente-interno/realizar-salidas')}
                                className="px-8 py-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 font-black uppercase tracking-widest text-[10px] hover:bg-purple-500/20 hover:border-purple-500/40 transition-all flex items-center justify-center gap-2"
                            >
                                <Table className="w-4 h-4" />
                                Ver Solicitudes
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="relative group/save overflow-hidden px-10 py-4 rounded-2xl bg-purple-500 text-white font-black uppercase tracking-widest text-[10px] hover:bg-purple-600 transition-all shadow-[0_10px_30px_rgba(168,85,247,0.3)] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                            >
                                <div className="relative z-10 flex items-center justify-center gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 transition-transform group-hover/save:scale-110" />}
                                    {saving ? 'Guardando...' : 'Guardar Solicitud'}
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-violet-600 opacity-0 group-hover/save:opacity-100 transition-opacity"></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Modal Component */}
            <SearchModal
                isOpen={searchModal.isOpen}
                onClose={() => setSearchModal({ isOpen: false, type: null, title: '' })}
                title={searchModal.title}
                options={searchModal.type ? catalogs[searchModal.type] : []}
                onSelect={handleSelectOption}
            />

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
        </div>
    );
}
