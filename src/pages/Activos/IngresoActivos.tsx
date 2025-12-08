import { useRef, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, X, Upload, Package, DollarSign, FileText, QrCode, Hash, Tag, Image as ImageIcon, ChevronLeft, Camera, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function IngresoActivos() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showCameraModal, setShowCameraModal] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const [formData, setFormData] = useState({
        numero_activo: '',
        nombre_corto_activo: '',
        marca_activo: '',
        numero_serie_activo: '',
        codigo_activo: '',
        descripcion_activo: '',
        valor_activo: '',
        nota_activo: '',
        imagen_activo: ''
    });

    // Effect to attach stream to video element when modal is open
    useEffect(() => {
        if (showCameraModal && videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [showCameraModal, stream]);

    // Handle form input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Camera handling functions
    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            setStream(mediaStream);
            setShowCameraModal(true);
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("No se pudo acceder a la cámara. Verifique los permisos o intente subir el archivo.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setShowCameraModal(false);
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
                        uploadFile(file);
                    }
                }, 'image/jpeg', 0.8);
            }
            stopCamera();
        }
    };

    // Unified upload function
    const uploadFile = async (file: File) => {
        try {
            setUploadingImage(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `activos/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('Img-activos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('Img-activos')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, imagen_activo: publicUrlData.publicUrl }));
        } catch (error: any) {
            console.error('Error uploading image:', error);
            alert('Error al subir la imagen: ' + error.message);
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Handler for file input
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) uploadFile(file);
    };

    const handleRemoveImage = () => {
        setFormData(prev => ({ ...prev, imagen_activo: '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Validar que el numero_activo no exista
            const { data: existingData, error: existingError } = await supabase
                .from('activos_50')
                .select('numero_activo')
                .eq('numero_activo', formData.numero_activo)
                .single();

            if (existingError && existingError.code !== 'PGRST116') throw existingError;
            if (existingData) {
                alert(`El Número de Activo #${formData.numero_activo} ya existe. Por favor use otro.`);
                setLoading(false);
                return;
            }

            // 2. Sanitizar valor_activo
            const valorSanitizado = formData.valor_activo ? parseFloat(formData.valor_activo.toString().replace(/[^0-9.]/g, '')) : 0;

            // 3. Insertar en activos_50
            const { error: activoError } = await supabase
                .from('activos_50')
                .insert([{
                    ...formData,
                    numero_activo: parseInt(formData.numero_activo),
                    valor_activo: valorSanitizado,
                    ingreso_activo: new Date().toISOString()
                }])
                .select()
                .single();

            if (activoError) throw activoError;

            alert(`Activo registrado exitosamente con Número #${formData.numero_activo}`);
            setFormData({
                numero_activo: '',
                nombre_corto_activo: '',
                marca_activo: '',
                numero_serie_activo: '',
                codigo_activo: '',
                descripcion_activo: '',
                valor_activo: '',
                nota_activo: '',
                imagen_activo: ''
            });

        } catch (error: any) {
            console.error('Error al registrar activo:', error);
            alert('Error al registrar activo: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-1 ring-white/20">
                        <Package className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Ingreso de Activos</h1>
                        <p className="text-slate-400 font-medium">Registrar nuevo activo en el sistema</p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/activos')}
                    className="group flex items-center gap-2 px-5 py-2.5 bg-slate-900/50 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 rounded-xl transition-all duration-300 backdrop-blur-md"
                >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Regresar
                </button>
            </div>

            {/* Main Content */}
            <div className="relative backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                <form onSubmit={handleSubmit} className="relative p-8 md:p-10 space-y-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-10">
                        {/* Column 1: Información Básica */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                                <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                    <Package className="w-5 h-5" />
                                </span>
                                <h3 className="text-lg font-bold text-white tracking-wide">Información Básica</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Número de Activo <span className="text-red-400">*</span></label>
                                    <div className="relative group">
                                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                        <input
                                            required
                                            type="number"
                                            name="numero_activo"
                                            value={formData.numero_activo}
                                            onChange={handleChange}
                                            placeholder="1001"
                                            className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Valor Estimado</label>
                                    <div className="relative group">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-green-400 transition-colors" />
                                        <input
                                            name="valor_activo"
                                            value={formData.valor_activo}
                                            onChange={handleChange}
                                            placeholder="500,000"
                                            className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-green-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-green-500/50 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Nombre Corto <span className="text-red-400">*</span></label>
                                <div className="relative group">
                                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                    <input
                                        required
                                        name="nombre_corto_activo"
                                        value={formData.nombre_corto_activo}
                                        onChange={handleChange}
                                        placeholder="Ej: Laptop Dell Latitude"
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Marca</label>
                                <div className="relative group">
                                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                    <input
                                        name="marca_activo"
                                        value={formData.marca_activo}
                                        onChange={handleChange}
                                        placeholder="Ej: Dell"
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Descripción Detallada</label>
                                <div className="relative group">
                                    <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                    <textarea
                                        name="descripcion_activo"
                                        value={formData.descripcion_activo}
                                        onChange={handleChange}
                                        rows={4}
                                        placeholder="Características técnicas, estado, accesorios incluidos..."
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Identificación y Control */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                                <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                    <QrCode className="w-5 h-5" />
                                </span>
                                <h3 className="text-lg font-bold text-white tracking-wide">Identificación y Control</h3>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Código de Activo (Placa) <span className="text-red-400">*</span></label>
                                <div className="relative group">
                                    <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                    <input
                                        required
                                        name="codigo_activo"
                                        value={formData.codigo_activo}
                                        onChange={handleChange}
                                        placeholder="Ej: MSJ-001-2024"
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Número de Serie</label>
                                <div className="relative group">
                                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                    <input
                                        name="numero_serie_activo"
                                        value={formData.numero_serie_activo}
                                        onChange={handleChange}
                                        placeholder="Ej: 8H2J9K1"
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2 ml-1">
                                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                                    Fotografía del Activo
                                </label>

                                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />

                                {!formData.imagen_activo ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={startCamera}
                                            disabled={uploadingImage}
                                            className="relative overflow-hidden flex flex-col items-center justify-center gap-3 p-6 border border-white/10 bg-slate-950/30 rounded-2xl hover:bg-slate-900 hover:border-blue-500/50 transition-all group disabled:opacity-50"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500 transition-all duration-300">
                                                <Camera className="w-6 h-6 text-slate-300 group-hover:text-white" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-300 group-hover:text-white relative z-10">Tomar Foto</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingImage}
                                            className="relative overflow-hidden flex flex-col items-center justify-center gap-3 p-6 border border-white/10 bg-slate-950/30 rounded-2xl hover:bg-slate-900 hover:border-emerald-500/50 transition-all group disabled:opacity-50"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500 transition-all duration-300">
                                                {uploadingImage ? (
                                                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                                                ) : (
                                                    <Upload className="w-6 h-6 text-slate-300 group-hover:text-white" />
                                                )}
                                            </div>
                                            <span className="text-sm font-medium text-slate-300 group-hover:text-white relative z-10">
                                                {uploadingImage ? 'Subiendo...' : 'Subir Imagen'}
                                            </span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative group rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 z-10" />
                                        <img
                                            src={formData.imagen_activo}
                                            alt="Activo"
                                            className="w-full h-56 object-cover transform group-hover:scale-105 transition-transform duration-700"
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 p-4 z-20 flex justify-end gap-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                            <button
                                                type="button"
                                                onClick={() => window.open(formData.imagen_activo, '_blank')}
                                                className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-white border border-white/20 transition-all"
                                                title="Ver imagen completa"
                                            >
                                                <ImageIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                className="p-2.5 bg-red-500/80 hover:bg-red-500 backdrop-blur-md rounded-xl text-white transition-all shadow-lg shadow-red-500/20"
                                                title="Eliminar imagen"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Notas Adicionales</label>
                                <div className="relative group">
                                    <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                    <textarea
                                        name="nota_activo"
                                        value={formData.nota_activo}
                                        onChange={handleChange}
                                        rows={2}
                                        placeholder="Observaciones importantes..."
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-900/80 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 mt-8 border-t border-white/10 flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => setFormData({
                                numero_activo: '',
                                nombre_corto_activo: '',
                                marca_activo: '',
                                numero_serie_activo: '',
                                codigo_activo: '',
                                descripcion_activo: '',
                                valor_activo: '',
                                nota_activo: '',
                                imagen_activo: ''
                            })}
                            className="px-6 py-3.5 text-slate-300 font-medium hover:bg-white/5 rounded-xl transition-all flex items-center gap-2 border border-transparent hover:border-white/10"
                        >
                            <X className="w-4 h-4" />
                            Limpiar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 ring-1 ring-white/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            Guardar Activo
                        </button>
                    </div>
                </form>
            </div>

            {/* Camera Modal */}
            {showCameraModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="relative w-full max-w-lg bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
                        {/* Camera Header */}
                        <div className="p-4 flex justify-between items-center z-10 bg-slate-900 border-b border-white/5">
                            <h3 className="text-white font-medium flex items-center gap-2">
                                <Camera className="w-5 h-5 text-blue-400" />
                                Cámara
                            </h3>
                            <button
                                onClick={stopCamera}
                                className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Video Feed */}
                        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Camera Controls */}
                        <div className="p-6 bg-slate-900 border-t border-white/5 flex justify-center pb-8">
                            <button
                                onClick={capturePhoto}
                                className="group relative p-1 rounded-full cursor-pointer hover:scale-105 transition-transform"
                                title="Tomar foto"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity" />
                                <div className="relative w-16 h-16 bg-white rounded-full border-4 border-slate-900 flex items-center justify-center">
                                    <div className="w-12 h-12 bg-slate-200 rounded-full group-hover:bg-blue-50 transition-colors" />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
