import { useRef, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, X, Upload, Package, DollarSign, FileText, QrCode, Hash, Tag, Image as ImageIcon, Camera, Trash2, Loader2, Plus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { cn } from '../../lib/utils';

export default function IngresoActivos() {
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

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

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            uploadFile(file);
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
                    ingreso_activo: new Date().toLocaleDateString('en-CA')
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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7]">
            <PageHeader
                title="Ingreso de Activos"
                subtitle="Registre la identificación, características y evidencia del nuevo activo."
                icon={Plus}
                themeColor="neutral"
                backRoute="/activos"
            />

            <div className="max-w-[1400px] mx-auto px-4 md:px-8 pb-12 animate-fade-in-up">

                <form onSubmit={handleSubmit} className="relative rounded-xl border border-[#3f3f46] bg-[#111112] p-5 md:p-8 lg:p-10 space-y-8 md:space-y-10">
                    <div className="border-b border-[#27272a] pb-6">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#71717a]">Nuevo registro</p>
                        <h2 className="mt-2 text-xl font-bold text-white">Datos del activo</h2>
                        <p className="mt-1 text-sm text-[#a1a1aa]">Complete los datos principales y agregue una fotografía cuando esté disponible.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                        {/* Column 1: Información Básica */}
                        <section className="space-y-6 rounded-xl border border-[#27272a] bg-[#0c0c0d] p-5 md:p-6">
                            <div className="flex items-center gap-3 pb-4 border-b border-[#333333]">
                                <span className="p-2 rounded-lg bg-[#18181b] text-[#d4d4d8] border border-[#3f3f46]">
                                    <Package className="w-5 h-5" />
                                </span>
                                <div><h3 className="text-base font-bold text-white">Información básica</h3><p className="mt-1 text-xs text-[#71717a]">Descripción y valor del bien</p></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#a1a1aa] ml-1">Número de Activo <span className="text-white">*</span></label>
                                    <div className="relative group">
                                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a] group-focus-within:text-white transition-colors" />
                                        <input
                                            required
                                            type="number"
                                            name="numero_activo"
                                            value={formData.numero_activo}
                                            onChange={handleChange}
                                            placeholder="1001"
                                            className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg pl-12 pr-4 py-3.5 text-white placeholder-[#71717a] focus:outline-none focus:border-[#a1a1aa] transition-all font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] ml-1">Valor Estimado</label>
                                    <div className="relative group">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a] group-focus-within:text-white transition-colors" />
                                        <input
                                            name="valor_activo"
                                            value={formData.valor_activo}
                                            onChange={handleChange}
                                            placeholder="500,000"
                                            className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg pl-12 pr-4 py-3.5 text-white placeholder-[#71717a] focus:outline-none focus:border-[#a1a1aa] transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#a1a1aa] ml-1">Nombre Corto <span className="text-white">*</span></label>
                                <div className="relative group">
                                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a] group-focus-within:text-white transition-colors" />
                                    <input
                                        required
                                        name="nombre_corto_activo"
                                        value={formData.nombre_corto_activo}
                                        onChange={handleChange}
                                        placeholder="Ej: Laptop Dell Latitude"
                                        className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg pl-12 pr-4 py-3.5 text-white placeholder-[#71717a] focus:outline-none focus:border-[#a1a1aa] transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] ml-1">Marca</label>
                                <div className="relative group">
                                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a] group-focus-within:text-white transition-colors" />
                                    <input
                                        name="marca_activo"
                                        value={formData.marca_activo}
                                        onChange={handleChange}
                                        placeholder="Ej: Dell"
                                        className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg pl-12 pr-4 py-3.5 text-white placeholder-[#71717a] focus:outline-none focus:border-[#a1a1aa] transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] ml-1">Descripción Detallada</label>
                                <div className="relative group">
                                    <FileText className="absolute left-4 top-4 w-5 h-5 text-[#71717a] group-focus-within:text-white transition-colors" />
                                    <textarea
                                        name="descripcion_activo"
                                        value={formData.descripcion_activo}
                                        onChange={handleChange}
                                        rows={4}
                                        placeholder="Características técnicas, estado, accesorios incluidos..."
                                        className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg pl-12 pr-4 py-3.5 text-white placeholder-[#71717a] focus:outline-none focus:border-[#a1a1aa] transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Column 2: Identificación y Control */}
                        <section className="space-y-6 rounded-xl border border-[#27272a] bg-[#0c0c0d] p-5 md:p-6">
                            <div className="flex items-center gap-3 pb-4 border-b border-[#333333]">
                                <span className="p-2 rounded-lg bg-[#18181b] text-[#d4d4d8] border border-[#3f3f46]">
                                    <QrCode className="w-5 h-5" />
                                </span>
                                <div><h3 className="text-base font-bold text-white">Identificación y control</h3><p className="mt-1 text-xs text-[#71717a]">Placa, serie y evidencia fotográfica</p></div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#a1a1aa] ml-1">Código de Activo (Placa) <span className="text-white">*</span></label>
                                <div className="relative group">
                                    <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a] group-focus-within:text-white transition-colors" />
                                    <input
                                        required
                                        name="codigo_activo"
                                        value={formData.codigo_activo}
                                        onChange={handleChange}
                                        placeholder="Ej: MSJ-001-2024"
                                        className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg pl-12 pr-4 py-3.5 text-white placeholder-[#71717a] focus:outline-none focus:border-[#a1a1aa] transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] ml-1">Número de Serie</label>
                                <div className="relative group">
                                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a] group-focus-within:text-white transition-colors" />
                                    <input
                                        name="numero_serie_activo"
                                        value={formData.numero_serie_activo}
                                        onChange={handleChange}
                                        placeholder="Ej: 8H2J9K1"
                                        className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg pl-12 pr-4 py-3.5 text-white placeholder-[#71717a] focus:outline-none focus:border-[#a1a1aa] transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] flex items-center gap-2 ml-1">
                                    <ImageIcon className="w-4 h-4 text-[#a1a1aa]" />
                                    Fotografía del Activo
                                </label>

                                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />

                                {!formData.imagen_activo ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={startCamera}
                                            disabled={uploadingImage}
                                            className="relative overflow-hidden flex flex-col items-center justify-center gap-3 p-6 border border-[#3f3f46] bg-[#18181b] rounded-lg hover:border-[#71717a] hover:bg-[#202023] transition-all group disabled:opacity-50"
                                        >
                                            <div className="w-12 h-12 bg-[#0c0c0d] border border-[#3f3f46] rounded-lg flex items-center justify-center group-hover:border-[#71717a] transition-all duration-300">
                                                <Camera className="w-6 h-6 text-[#a1a1aa] group-hover:text-white" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[#86868B] group-hover:text-white">Tomar Foto</span>
                                        </button>

                                        <div
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-3 p-6 group cursor-pointer rounded-lg border-2 border-dashed bg-[#18181b] transition-all duration-300",
                                                isDragging ? "border-[#a1a1aa] bg-[#27272a]" : "border-[#3f3f46] hover:border-[#71717a] hover:bg-[#202023]"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-12 h-12 bg-[#121212] rounded-full flex items-center justify-center group-hover:scale-110 transition-all duration-300",
                                                isDragging ? "bg-[#3f3f46]" : "group-hover:bg-[#27272a]"
                                            )}>
                                                {uploadingImage ? (
                                                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                                                ) : (
                                                    <Upload className={cn(
                                                        "w-6 h-6 text-[#86868B] group-hover:text-white",
                                                        isDragging && "text-white"
                                                    )} />
                                                )}
                                            </div>
                                            <span className={cn(
                                                "text-[10px] font-black uppercase tracking-widest text-[#86868B] group-hover:text-white text-center",
                                                isDragging && "text-white"
                                            )}>
                                                {uploadingImage ? 'Subiendo...' : 'Subir o Arrastrar'}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative group rounded-[8px] overflow-hidden border border-[#333333] shadow-2xl">
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
                                                className="p-2.5 bg-white/10 hover:bg-white/20 apple-blur rounded-[8px] text-white border border-white/20 transition-all"
                                                title="Ver imagen completa"
                                            >
                                                <ImageIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                className="p-2.5 bg-red-500/80 hover:bg-red-500 apple-blur rounded-[8px] text-white transition-all shadow-lg shadow-red-500/20"
                                                title="Eliminar imagen"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] ml-1">Notas Adicionales</label>
                                <div className="relative group">
                                    <FileText className="absolute left-4 top-4 w-5 h-5 text-[#71717a] group-focus-within:text-white transition-colors" />
                                    <textarea
                                        name="nota_activo"
                                        value={formData.nota_activo}
                                        onChange={handleChange}
                                        rows={2}
                                        placeholder="Observaciones importantes..."
                                        className="w-full bg-[#18181b] border border-[#3f3f46] rounded-lg pl-12 pr-4 py-3.5 text-white placeholder-[#71717a] focus:outline-none focus:border-[#a1a1aa] transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="pt-6 mt-6 md:pt-8 md:mt-8 border-t border-[#333333] flex flex-col sm:flex-row justify-end gap-3 md:gap-4">
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
                            className="w-full sm:w-auto px-6 py-3.5 text-[#86868B] hover:text-[#F5F5F7] font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 border border-[#333333] hover:bg-white/5 rounded-[8px] order-2 sm:order-1"
                        >
                            <X className="w-4 h-4" />
                            Limpiar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full sm:w-auto px-8 py-3.5 bg-[#f4f4f5] hover:bg-white text-[#09090b] font-black uppercase text-[10px] tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 order-1 sm:order-2"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 apple-blur animate-in fade-in duration-200">
                    <div className="relative w-full max-w-lg bg-[#121212] rounded-[8px] overflow-hidden shadow-2xl border border-[#333333] flex flex-col max-h-[90vh]">
                        {/* Camera Header */}
                        <div className="p-4 flex justify-between items-center z-10 bg-black/20 border-b border-[#333333]">
                            <h3 className="text-[#F5F5F7] font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                                <Camera className="w-5 h-5 text-[#d4d4d8]" />
                                Cámara
                            </h3>
                            <button
                                onClick={stopCamera}
                                className="p-2 hover:bg-white/10 text-[#F5F5F7] rounded-full transition-colors"
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
                        <div className="p-6 bg-black/20 border-t border-[#333333] flex justify-center pb-8">
                            <button
                                onClick={capturePhoto}
                                className="group relative p-1 rounded-full cursor-pointer hover:scale-105 transition-transform"
                                title="Tomar foto"
                            >
                                <div className="absolute inset-0 bg-white/20 rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity" />
                                <div className="relative w-16 h-16 bg-[#F5F5F7] rounded-full border-4 border-[#121212] flex items-center justify-center">
                                    <div className="w-12 h-12 bg-[#71717a] rounded-full group-hover:bg-white transition-colors" />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
