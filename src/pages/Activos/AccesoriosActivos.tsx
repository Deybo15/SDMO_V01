// AccesoriosActivos.tsx - v2.2 robust camera fix
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, Camera, Upload, Trash2, Wrench, Save, X, RefreshCw, Image as ImageIcon, Search, Loader2 } from 'lucide-react';
import { Toast, ToastType } from '../../components/ui/Toast';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

interface Activo {
    numero_activo: number;
    nombre_corto_activo: string;
}

interface Accesorio {
    id_accesorio_activo: number;
    descripcion_accesorio: string;
    marca_accesorio: string;
    numero_serie_accesorio: string;
    activo_asociado: number;
    imagen_accesorio: string | null;
}

export default function AccesoriosActivos() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [activos, setActivos] = useState<Activo[]>([]);
    const [accesorios, setAccesorios] = useState<Accesorio[]>([]);
    const [filterActivo, setFilterActivo] = useState<number | ''>('');

    // Form State
    const [formData, setFormData] = useState({
        descripcion_accesorio: '',
        marca_accesorio: '',
        numero_serie_accesorio: '',
        activo_asociado: '' as string | number,
        filename_accesorio: ''
    });

    // Camera & Image State
    const [showCamera, setShowCamera] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const videoElementRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Search Modal State
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // UI State
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [confirmationModal, setConfirmationModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    useEffect(() => {
        loadActivos();
        loadAccesorios();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Callback ref to attach stream to video element as soon as it mounts
    const setVideoRef = (el: HTMLVideoElement | null) => {
        videoElementRef.current = el;
        if (el && stream) {
            console.log("Attaching stream to video element:", stream.id);
            el.srcObject = stream;
        }
    };

    useEffect(() => {
        loadAccesorios();
    }, [filterActivo]);

    const loadActivos = async () => {
        const { data } = await supabase
            .from('activos_50')
            .select('numero_activo, nombre_corto_activo')
            .order('numero_activo', { ascending: false });
        if (data) setActivos(data);
    };

    const loadAccesorios = async () => {
        let query = supabase
            .from('accesorio_activo_51')
            .select('*')
            .order('id_accesorio_activo', { ascending: false })
            .limit(50);

        if (filterActivo) {
            query = query.eq('activo_asociado', filterActivo);
        }

        const { data } = await query;
        if (data) setAccesorios(data);
    };

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type });
    };

    // Camera Logic
    const startCamera = async (mode?: 'user' | 'environment') => {
        const currentMode = mode || facingMode;
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: currentMode, width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            setStream(newStream);
            setShowCamera(true);
        } catch (err: any) {
            console.error("Error accessing camera:", err);

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                showToast("Acceso denegado: Por favor habilite la cámara en su navegador.", "error");
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                showToast("No se encontró ninguna cámara disponible.", "error");
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                showToast("La cámara está en uso por otra aplicación.", "error");
            } else {
                showToast("Error al acceder a la cámara: " + (err.message || "Desconocido"), "error");
            }
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setShowCamera(false);
    };

    const capturePhoto = () => {
        if (videoElementRef.current && canvasRef.current) {
            const video = videoElementRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], "captura.jpg", { type: "image/jpeg" });
                        setSelectedFile(file);
                        setPreviewUrl(URL.createObjectURL(file));
                        stopCamera();
                    }
                }, 'image/jpeg', 0.8);
            }
        }
    };

    const switchCamera = () => {
        const newMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newMode);
        startCamera(newMode);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.activo_asociado) {
            showToast('Debe seleccionar un activo asociado', 'error');
            return;
        }

        setLoading(true);
        try {
            let imageUrl = null;

            // Upload image if exists
            // Upload image if exists
            if (selectedFile) {
                if (!formData.filename_accesorio) {
                    throw new Error('Debe ingresar un nombre para el archivo de imagen');
                }
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${formData.filename_accesorio}_${formData.activo_asociado}.${fileExt}`;
                const filePath = `accesorios/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('Img-activos')
                    .upload(filePath, selectedFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('Img-activos')
                    .getPublicUrl(filePath);

                imageUrl = publicUrl;
            }

            // Insert Data
            const { error: insertError } = await supabase
                .from('accesorio_activo_51')
                .insert([{
                    descripcion_accesorio: formData.descripcion_accesorio,
                    marca_accesorio: formData.marca_accesorio,
                    numero_serie_accesorio: formData.numero_serie_accesorio,
                    activo_asociado: parseInt(formData.activo_asociado.toString()),
                    imagen_accesorio: imageUrl
                }]);

            if (insertError) throw insertError;

            showToast('Accesorio registrado correctamente', 'success');

            // Reset Form
            setFormData({
                descripcion_accesorio: '',
                marca_accesorio: '',
                numero_serie_accesorio: '',
                activo_asociado: '',
                filename_accesorio: ''
            });
            setSelectedFile(null);
            setPreviewUrl(null);
            loadAccesorios();

        } catch (error: any) {
            console.error('Error saving accesorio:', error);
            showToast('Error al guardar el accesorio: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        setConfirmationModal({
            isOpen: true,
            title: 'Eliminar Accesorio',
            message: '¿Está seguro de eliminar este accesorio?',
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('accesorio_activo_51')
                        .delete()
                        .eq('id_accesorio_activo', id);

                    if (error) throw error;

                    showToast('Accesorio eliminado', 'success');
                    setAccesorios(accesorios.filter(a => a.id_accesorio_activo !== id));
                } catch (error: any) {
                    showToast('Error al eliminar: ' + error.message, 'error');
                } finally {
                    setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6">
            {/* Header */}
            <div className="sticky top-0 z-30 flex items-center justify-between py-4 md:py-6 mb-6 md:mb-8 bg-[#0f1419]/90 backdrop-blur-xl -mx-4 px-4 md:-mx-6 md:px-6 border-b border-white/5 shadow-lg shadow-black/20 transition-all">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                        <Wrench className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <h1 className="text-lg md:text-2xl font-bold text-white truncate">Gestión de Accesorios</h1>
                </div>
                <button
                    onClick={() => navigate('/activos')}
                    className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-slate-800/50 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all text-xs md:text-sm font-medium shrink-0"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Regresar</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-4 md:p-6 shadow-2xl">
                        <h2 className="text-base md:text-lg font-bold text-white mb-5 flex items-center gap-2">
                            <Save className="w-5 h-5 text-orange-500" />
                            Nuevo Accesorio
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs md:text-sm font-medium text-slate-300 ml-1">Activo Asociado</label>
                                <div className="relative group">
                                    <select
                                        required
                                        value={formData.activo_asociado}
                                        onChange={e => setFormData({ ...formData, activo_asociado: e.target.value })}
                                        className="w-full pl-4 pr-12 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none transition-all appearance-none text-sm md:text-base"
                                    >
                                        <option value="">Seleccionar activo...</option>
                                        {activos.map(activo => (
                                            <option key={activo.numero_activo} value={activo.numero_activo}>
                                                #{activo.numero_activo} - {activo.nombre_corto_activo}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => { setSearchTerm(''); setShowSearchModal(true); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors"
                                        title="Buscar activo"
                                    >
                                        <Search className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs md:text-sm font-medium text-slate-300 ml-1">Descripción</label>
                                <input
                                    required
                                    value={formData.descripcion_accesorio}
                                    onChange={e => setFormData({ ...formData, descripcion_accesorio: e.target.value })}
                                    placeholder="Ej: Cargador original"
                                    className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none transition-all text-sm md:text-base"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 md:gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs md:text-sm font-medium text-slate-300 ml-1">Marca</label>
                                    <input
                                        value={formData.marca_accesorio}
                                        onChange={e => setFormData({ ...formData, marca_accesorio: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none transition-all text-sm md:text-base"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs md:text-sm font-medium text-slate-300 ml-1">Serie</label>
                                    <input
                                        value={formData.numero_serie_accesorio}
                                        onChange={e => setFormData({ ...formData, numero_serie_accesorio: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none transition-all text-sm md:text-base"
                                    />
                                </div>
                            </div>

                            {/* Image Upload */}
                            <div className="space-y-3">
                                <label className="text-xs md:text-sm font-medium text-slate-300 ml-1">Fotografía</label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => startCamera()}
                                        className="flex-1 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-slate-200 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg"
                                    >
                                        <Camera className="w-5 h-5 text-orange-500" />
                                        <span className="font-bold">Cámara</span>
                                    </button>
                                    <label className="flex-1 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-slate-200 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-lg">
                                        <Upload className="w-5 h-5 text-blue-400" />
                                        <span className="font-bold">Subir</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                                    </label>
                                </div>
                            </div>

                            {/* Preview */}
                            {previewUrl && (
                                <div className="relative rounded-2xl overflow-hidden border-2 border-orange-500/30 aspect-video bg-black shadow-2xl group">
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                                    <button
                                        type="button"
                                        onClick={() => { setPreviewUrl(null); setSelectedFile(null); }}
                                        className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-red-500 transition-all backdrop-blur-md"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs md:text-sm font-medium text-slate-300 ml-1">Nombre del archivo *</label>
                                <div className="flex flex-col gap-2">
                                    <input
                                        required
                                        value={formData.filename_accesorio}
                                        onChange={e => setFormData({ ...formData, filename_accesorio: e.target.value })}
                                        placeholder="Ej. bateria_principal"
                                        className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none transition-all text-sm md:text-base"
                                    />
                                    <div className="px-4 py-2.5 bg-slate-900/80 border border-white/5 rounded-xl text-[10px] md:text-xs text-slate-400 font-mono text-center">
                                        _{formData.activo_asociado || '0000'}.jpg
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black rounded-xl shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 mt-4 uppercase tracking-wider"
                            >
                                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                                Guardar Accesorio
                            </button>
                        </form>
                    </div>

                    {/* Camera Modal Overlay */}
                    {showCamera && (
                        <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-200">
                            <div className="flex justify-between items-center p-4 bg-[#0f1419] border-b border-white/5">
                                <button type="button" onClick={stopCamera} className="p-2 bg-white/5 rounded-full text-white">
                                    <X className="w-6 h-6" />
                                </button>
                                <button type="button" onClick={switchCamera} className="p-2 bg-white/5 rounded-full text-white">
                                    <RefreshCw className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                                <video
                                    ref={setVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-contain"
                                />
                                <canvas ref={canvasRef} className="hidden" />
                            </div>
                            <div className="p-8 bg-[#0f1419] border-t border-white/5 flex justify-center pb-12">
                                <button
                                    type="button"
                                    onClick={capturePhoto}
                                    className="group relative p-1 rounded-full cursor-pointer hover:scale-105 transition-transform"
                                >
                                    <div className="absolute inset-0 bg-white/20 rounded-full blur group-hover:bg-white/30 transition-all" />
                                    <div className="relative w-20 h-20 bg-white rounded-full border-4 border-slate-900 flex items-center justify-center shadow-2xl">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full group-active:bg-slate-300 transition-colors" />
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* List Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-4 md:p-6 shadow-2xl overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <h2 className="text-base md:text-lg font-bold text-white">Accesorios Registrados</h2>
                            <div className="w-full sm:w-auto">
                                <select
                                    value={filterActivo}
                                    onChange={e => setFilterActivo(e.target.value ? parseInt(e.target.value) : '')}
                                    className="w-full sm:w-auto px-4 py-2 bg-slate-950/50 border border-white/10 rounded-xl text-slate-300 text-sm focus:ring-2 focus:ring-orange-500/30 outline-none transition-all"
                                >
                                    <option value="">Filtro: Todos los activos</option>
                                    {activos.map(a => (
                                        <option key={a.numero_activo} value={a.numero_activo}>Activo #{a.numero_activo}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {accesorios.length === 0 ? (
                                <div className="text-center py-16 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                                    <Wrench className="w-10 h-10 text-slate-600 mx-auto mb-3 opacity-20" />
                                    <p className="text-slate-500 font-medium">No hay accesorios encontrados.</p>
                                </div>
                            ) : (
                                accesorios.map(accesorio => (
                                    <div key={accesorio.id_accesorio_activo} className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-slate-900/40 rounded-2xl border border-white/5 hover:border-orange-500/30 transition-all group relative">
                                        <div className="w-full sm:w-24 h-48 sm:h-24 bg-black rounded-xl border border-white/5 overflow-hidden flex-shrink-0">
                                            {accesorio.imagen_accesorio ? (
                                                <img src={accesorio.imagen_accesorio} alt={accesorio.descripcion_accesorio} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center opacity-10">
                                                    <ImageIcon className="w-10 h-10 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 w-full text-center sm:text-left">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-bold text-white text-lg sm:text-base truncate pr-8">{accesorio.descripcion_accesorio}</h3>
                                                <button
                                                    onClick={() => handleDelete(accesorio.id_accesorio_activo)}
                                                    className="p-2 text-slate-500 hover:text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all absolute top-3 right-3 sm:static"
                                                >
                                                    <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                                                </button>
                                            </div>
                                            <p className="text-sm font-bold text-orange-400 mb-3 sm:mb-2">
                                                Activo Asociado: <span className="p-1 px-2 rounded-md bg-orange-500/10 border border-orange-500/20 ml-1 font-mono">#{accesorio.activo_asociado}</span>
                                            </p>
                                            <div className="flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2 text-xs text-slate-400 font-medium">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-slate-600">MARCA</span>
                                                    <span className="text-slate-200">{accesorio.marca_accesorio || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-slate-600">SERIE</span>
                                                    <span className="font-mono text-slate-200">{accesorio.numero_serie_accesorio || '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div >

            <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                onClose={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
                onConfirm={confirmationModal.onConfirm}
                title={confirmationModal.title}
                message={confirmationModal.message}
            />

            {
                toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )
            }
            {/* Asset Search Modal */}
            {
                showSearchModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-white">Buscar Activo</h3>
                                <button onClick={() => setShowSearchModal(false)} className="text-slate-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4 border-b border-slate-800">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Buscar por nombre o número..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-orange-500/50 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {activos.filter(a =>
                                    a.nombre_corto_activo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    a.numero_activo.toString().includes(searchTerm)
                                ).map(activo => (
                                    <button
                                        key={activo.numero_activo}
                                        onClick={() => {
                                            setFormData({ ...formData, activo_asociado: activo.numero_activo });
                                            setShowSearchModal(false);
                                        }}
                                        className="w-full text-left p-3 rounded-xl hover:bg-slate-800 transition-colors flex flex-col gap-1 group"
                                    >
                                        <span className="font-medium text-slate-200 group-hover:text-white transition-colors">
                                            {activo.nombre_corto_activo}
                                        </span>
                                        <span className="text-xs text-orange-400 font-mono">
                                            #{activo.numero_activo}
                                        </span>
                                    </button>
                                ))}
                                {activos.filter(a =>
                                    a.nombre_corto_activo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    a.numero_activo.toString().includes(searchTerm)
                                ).length === 0 && (
                                        <div className="text-center py-8 text-slate-500">
                                            No se encontraron resultados
                                        </div>
                                    )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
