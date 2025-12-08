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
    Image as ImageIcon
} from 'lucide-react';

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

            {/* Sticky Header */}
            <div className="sticky top-0 z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 mb-8 bg-[#1a1d29]/90 backdrop-blur-xl px-4 md:px-8 border-b border-white/5 shadow-lg shadow-black/20 transition-all">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8e44ad]/20 to-[#9b59b6]/20 border border-white/20 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-[#8e44ad]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            Registro de Solicitudes
                        </h1>
                    </div>
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-xl transition-all shadow-sm backdrop-blur-md"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Regresar
                </button>
            </div>

            <div className="max-w-6xl mx-auto relative z-10 px-6 pb-8">
                {/* Content Card */}
                <div className="bg-[#1e2230]/80 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl overflow-hidden">

                    <div className="p-8 md:p-12">
                        {/* Section Title */}
                        <div className="relative flex items-center gap-3 mb-8 pb-3">
                            <Edit className="w-5 h-5 text-[#8e44ad]" />
                            <h3 className="text-xl font-semibold text-[#8e44ad]">Información de la Solicitud</h3>
                            <div className="absolute bottom-0 left-0 w-[60px] h-[3px] bg-gradient-to-r from-[#8e44ad] to-[#9b59b6] rounded-full" />
                        </div>

                        {/* Form */}
                        <div className="space-y-8">
                            {/* Description */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-[#e4e6ea] after:content-['_*'] after:text-red-500 after:font-bold">
                                    Descripción de la solicitud
                                </label>
                                <textarea
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                                    placeholder="Describa detalladamente la solicitud..."
                                    className="w-full min-h-[120px] bg-[#2d3241]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3.5 text-[#e4e6ea] placeholder-[#9ca3af]/70 focus:outline-none focus:border-[#8e44ad]/50 focus:ring-1 focus:ring-[#8e44ad]/50 transition-all resize-y"
                                />
                            </div>

                            {/* Row 1 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormSelect
                                    label="Área de Mantenimiento"
                                    value={formData.area}
                                    displayValue={getSelectedLabel('areas', formData.area)}
                                    onOpenSearch={() => handleOpenSearch('areas', 'Buscar Área de Mantenimiento')}
                                    onClear={() => handleClearField('area')}
                                    loading={loading}
                                    required
                                />

                                <FormSelect
                                    label="Instalación Municipal"
                                    value={formData.instalacion}
                                    displayValue={getSelectedLabel('instalaciones', formData.instalacion)}
                                    onOpenSearch={() => handleOpenSearch('instalaciones', 'Buscar Instalación Municipal')}
                                    onClear={() => handleClearField('instalacion')}
                                    loading={loading}
                                    required
                                />
                            </div>

                            {/* Row 2 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormSelect
                                    label="Supervisor Asignado"
                                    value={formData.supervisor}
                                    displayValue={getSelectedLabel('supervisores', formData.supervisor)}
                                    onOpenSearch={() => handleOpenSearch('supervisores', 'Buscar Supervisor')}
                                    onClear={() => handleClearField('supervisor')}
                                    loading={loading}
                                    required
                                />

                                <FormSelect
                                    label="Profesional Responsable"
                                    value={formData.profesional}
                                    displayValue={getSelectedLabel('profesionales', formData.profesional)}
                                    onOpenSearch={() => handleOpenSearch('profesionales', 'Buscar Profesional')}
                                    onClear={() => handleClearField('profesional')}
                                    loading={loading}
                                    required
                                />
                            </div>

                            {/* Row 3 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormSelect
                                    label="Cliente Interno"
                                    value={formData.cliente}
                                    displayValue={getSelectedLabel('clientes', formData.cliente)}
                                    onOpenSearch={() => handleOpenSearch('clientes', 'Buscar Cliente Interno')}
                                    onClear={() => handleClearField('cliente')}
                                    loading={loading}
                                    required
                                />
                            </div>
                        </div>

                        {/* Image Upload Section */}
                        <div className="mt-8 pt-8 border-t border-white/10">
                            <h4 className="text-lg font-medium text-[#e4e6ea] mb-4 flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-[#8e44ad]" />
                                Evidencia Fotográfica
                            </h4>

                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="flex flex-col gap-3 w-full md:w-auto">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                        className="hidden"
                                        id="image-upload"
                                    />
                                    <label
                                        htmlFor="image-upload"
                                        className="px-4 py-2.5 rounded-xl bg-[#2d3241]/50 border border-white/10 hover:bg-[#2d3241] text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Subir Imagen
                                    </label>
                                    <button
                                        onClick={startCamera}
                                        className="px-4 py-2.5 rounded-xl bg-[#2d3241]/50 border border-white/10 hover:bg-[#2d3241] text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2"
                                    >
                                        <Camera className="w-4 h-4" />
                                        Tomar Foto
                                    </button>
                                </div>

                                {/* Preview Area */}
                                <div className="flex-1 w-full">
                                    {imagePreview ? (
                                        <div className="relative w-full max-w-md aspect-video bg-black/20 rounded-xl overflow-hidden border border-white/10 group">
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="w-full h-full object-contain"
                                            />
                                            <button
                                                onClick={handleRemoveImage}
                                                className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-md aspect-video bg-[#2d3241]/30 rounded-xl border border-white/5 flex flex-col items-center justify-center text-slate-500 gap-2">
                                            <ImageIcon className="w-8 h-8 opacity-50" />
                                            <span className="text-sm">Sin imagen seleccionada</span>
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
                    <div className="p-8 border-t border-white/10 bg-[#1a1d29]/30 flex flex-col md:flex-row justify-between items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full md:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-br from-slate-600/30 to-slate-700/30 border border-slate-600/40 text-[#e4e6ea] font-medium hover:from-slate-600/40 hover:to-slate-700/40 hover:shadow-lg hover:shadow-slate-600/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Regresar
                        </button>

                        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                            <button
                                onClick={() => navigate('/cliente-interno/realizar-salidas')}
                                className="px-6 py-3.5 rounded-xl bg-[#2d3241]/30 border border-[#8e44ad]/40 text-[#8e44ad] font-medium hover:bg-[#8e44ad]/20 hover:border-[#8e44ad]/60 hover:text-[#9b59b6] transition-all flex items-center justify-center gap-2"
                            >
                                <Table className="w-4 h-4" />
                                Ver Solicitudes
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-3.5 rounded-xl bg-gradient-to-br from-[#8e44ad]/30 to-[#9b59b6]/30 border border-[#8e44ad]/40 text-[#e4e6ea] font-medium hover:from-[#8e44ad]/40 hover:to-[#9b59b6]/40 hover:shadow-lg hover:shadow-[#8e44ad]/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar Solicitud
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
