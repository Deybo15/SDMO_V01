// AccesoriosActivos.tsx - v2.2 robust camera fix
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, Camera, Upload, Trash2, Wrench, Save, X, RefreshCw, Image as ImageIcon, Search } from 'lucide-react';
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
                    .from('imagenes-sti')
                    .upload(filePath, selectedFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('imagenes-sti')
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
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="sticky top-0 z-30 flex items-center justify-between py-6 mb-8 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 -mx-6 px-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Wrench className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Gestión de Accesorios</h1>
                </div>
                <button
                    onClick={() => navigate('/activos')}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all text-sm font-medium"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Regresar
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Save className="w-5 h-5 text-orange-500" />
                            Nuevo Accesorio
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Activo Asociado</label>
                                <div className="relative">
                                    <select
                                        required
                                        value={formData.activo_asociado}
                                        onChange={e => setFormData({ ...formData, activo_asociado: e.target.value })}
                                        className="w-full pl-4 pr-12 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all appearance-none"
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
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors"
                                        title="Buscar activo"
                                    >
                                        <Search className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Descripción</label>
                                <input
                                    required
                                    value={formData.descripcion_accesorio}
                                    onChange={e => setFormData({ ...formData, descripcion_accesorio: e.target.value })}
                                    placeholder="Ej: Cargador original"
                                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Marca</label>
                                    <input
                                        value={formData.marca_accesorio}
                                        onChange={e => setFormData({ ...formData, marca_accesorio: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Serie</label>
                                    <input
                                        value={formData.numero_serie_accesorio}
                                        onChange={e => setFormData({ ...formData, numero_serie_accesorio: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Image Upload */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Fotografía</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => startCamera()}
                                        className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Camera className="w-4 h-4" />
                                        Cámara
                                    </button>
                                    <label className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer">
                                        <Upload className="w-4 h-4" />
                                        Subir
                                        <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                                    </label>
                                </div>
                            </div>

                            {/* Preview */}
                            {previewUrl && (
                                <div className="relative rounded-xl overflow-hidden border border-slate-600 aspect-video bg-black">
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                                    <button
                                        type="button"
                                        onClick={() => { setPreviewUrl(null); setSelectedFile(null); }}
                                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {/* Camera Modal Overlay */}
                            {showCamera && (
                                <div className="fixed inset-0 z-50 bg-black flex flex-col">
                                    <div className="flex justify-between items-center p-4 bg-slate-900">
                                        <button type="button" onClick={stopCamera} className="text-white">
                                            <X className="w-6 h-6" />
                                        </button>
                                        <button type="button" onClick={switchCamera} className="text-white">
                                            <RefreshCw className="w-6 h-6" />
                                        </button>
                                    </div>
                                    <div className="flex-1 relative bg-black flex items-center justify-center">
                                        <video
                                            ref={setVideoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-contain"
                                        />
                                        <canvas ref={canvasRef} className="hidden" />
                                    </div>
                                    <div className="p-6 bg-slate-900 flex justify-center">
                                        <button
                                            type="button"
                                            onClick={capturePhoto}
                                            className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:bg-white/50 transition-colors"
                                        >
                                            <div className="w-12 h-12 rounded-full bg-white" />
                                        </button>
                                    </div>
                                </div>

                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Nombre del archivo *</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        required
                                        value={formData.filename_accesorio}
                                        onChange={e => setFormData({ ...formData, filename_accesorio: e.target.value })}
                                        placeholder="Ej. bateria_principal"
                                        className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-slate-200 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all"
                                    />
                                    <div className="px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-slate-400 font-mono whitespace-nowrap">
                                        _{formData.activo_asociado || '0000'}.jpg
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500">Se añadirá automáticamente el sufijo con el número de activo.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <Save className="w-5 h-5" />}
                                Guardar Accesorio
                            </button>
                        </form>
                    </div>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-white">Accesorios Registrados</h2>
                            <div className="flex gap-2">
                                <select
                                    value={filterActivo}
                                    onChange={e => setFilterActivo(e.target.value ? parseInt(e.target.value) : '')}
                                    className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-300 text-sm focus:ring-2 focus:ring-orange-500/50 outline-none"
                                >
                                    <option value="">Todos los activos</option>
                                    {activos.map(a => (
                                        <option key={a.numero_activo} value={a.numero_activo}>#{a.numero_activo}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {accesorios.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    No hay accesorios registrados.
                                </div>
                            ) : (
                                accesorios.map(accesorio => (
                                    <div key={accesorio.id_accesorio_activo} className="flex items-start gap-4 p-4 bg-slate-900/30 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors group">
                                        <div className="w-20 h-20 bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {accesorio.imagen_accesorio ? (
                                                <img src={accesorio.imagen_accesorio} alt={accesorio.descripcion_accesorio} className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon className="w-8 h-8 text-slate-600" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-bold text-slate-200 truncate">{accesorio.descripcion_accesorio}</h3>
                                                <button
                                                    onClick={() => handleDelete(accesorio.id_accesorio_activo)}
                                                    className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <p className="text-sm text-slate-400 mt-1">
                                                Activo: <span className="text-orange-400 font-mono">#{accesorio.activo_asociado}</span>
                                            </p>
                                            <div className="flex gap-4 mt-2 text-xs text-slate-500">
                                                <span>Marca: {accesorio.marca_accesorio || '-'}</span>
                                                <span>Serie: {accesorio.numero_serie_accesorio || '-'}</span>
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
