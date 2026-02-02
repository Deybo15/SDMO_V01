// AccesoriosActivos.tsx - v3.0 Style Guide Alignment & Drag-and-Drop
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    ChevronLeft, Camera, Upload, Trash2, Wrench, Save,
    X, RefreshCw, Image as ImageIcon, Search, Loader2,
    Package, Plus, MousePointer2
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Toast, ToastType } from '../../components/ui/Toast';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { cn } from '../../lib/utils';

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
    const [isDragging, setIsDragging] = useState(false);

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

    const setVideoRef = (el: HTMLVideoElement | null) => {
        videoElementRef.current = el;
        if (el && stream) {
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
            .order('id_accesorio_activo', { ascending: false });

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
            showToast("Error al acceder a la cámara", "error");
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

    // Drag & Drop Handlers
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
        const files = e.dataTransfer.files;
        if (files && files[0]) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                setSelectedFile(file);
                setPreviewUrl(URL.createObjectURL(file));
            } else {
                showToast('Por favor suba un archivo de imagen válido', 'error');
            }
        }
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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7]">
            <PageHeader
                title="Gestión de Accesorios"
                subtitle="Gabinete de Gestión Operativa"
                icon={Wrench}
                backRoute="/activos"
            />

            <div className="max-w-7xl mx-auto px-8 pb-12 animate-fade-in-up">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Sección Formulario */}
                    <div className="lg:col-span-1">
                        <div className="bg-[#121212] rounded-[8px] border border-[#333333] shadow-2xl p-6 sticky top-24">
                            <h2 className="text-[12px] font-black uppercase tracking-widest text-[#F5F5F7] mb-6 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-[#0071E3]" />
                                Nuevo Accesorio
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] ml-1">
                                        Activo Asociado
                                    </label>
                                    <div className="relative group">
                                        <select
                                            required
                                            value={formData.activo_asociado}
                                            onChange={e => setFormData({ ...formData, activo_asociado: e.target.value })}
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] pl-4 pr-12 py-3 text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all appearance-none text-sm"
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
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#86868B] hover:text-[#0071E3] rounded-lg transition-colors"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] ml-1">
                                        Descripción
                                    </label>
                                    <input
                                        required
                                        value={formData.descripcion_accesorio}
                                        onChange={e => setFormData({ ...formData, descripcion_accesorio: e.target.value })}
                                        placeholder="Ej: Cargador original"
                                        className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-4 py-3 text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all placeholder-[#86868B]"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] ml-1">
                                            Marca
                                        </label>
                                        <input
                                            value={formData.marca_accesorio}
                                            onChange={e => setFormData({ ...formData, marca_accesorio: e.target.value })}
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-4 py-3 text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] ml-1">
                                            Serie
                                        </label>
                                        <input
                                            value={formData.numero_serie_accesorio}
                                            onChange={e => setFormData({ ...formData, numero_serie_accesorio: e.target.value })}
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-4 py-3 text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] ml-1 flex items-center justify-between">
                                        Fotografía
                                        <button
                                            type="button"
                                            onClick={() => startCamera()}
                                            className="text-[#0071E3] hover:underline normal-case tracking-normal text-[11px]"
                                        >
                                            Usar Cámara
                                        </button>
                                    </label>

                                    <div
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={cn(
                                            "relative border-2 border-dashed rounded-[8px] p-8 transition-all flex flex-col items-center justify-center gap-3",
                                            isDragging
                                                ? "border-[#0071E3] bg-[#0071E3]/5"
                                                : "border-[#424245] bg-[#1D1D1F] hover:border-[#333333]"
                                        )}
                                    >
                                        {previewUrl ? (
                                            <div className="relative w-full aspect-video rounded-lg overflow-hidden group">
                                                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                                                <button
                                                    type="button"
                                                    onClick={() => { setPreviewUrl(null); setSelectedFile(null); }}
                                                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 rounded-full bg-[#121212] flex items-center justify-center border border-[#333333]">
                                                    <Upload className={cn("w-6 h-6", isDragging ? "text-[#0071E3]" : "text-[#86868B]")} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[12px] font-bold text-[#F5F5F7]">Arrastre una imagen aquí</p>
                                                    <p className="text-[10px] text-[#86868B] mt-1">O haga clic para seleccionar desde su equipo</p>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={handleFileSelect}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#86868B] ml-1">
                                        Nombre del archivo *
                                    </label>
                                    <div className="flex flex-col gap-2">
                                        <input
                                            required
                                            value={formData.filename_accesorio}
                                            onChange={e => setFormData({ ...formData, filename_accesorio: e.target.value })}
                                            placeholder="Ej. bateria_principal"
                                            className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-4 py-3 text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all placeholder-[#86868B]"
                                        />
                                        <div className="px-4 py-2 bg-[#121212] border border-[#333333] rounded-[8px] text-[10px] text-[#86868B] font-mono text-center">
                                            _{formData.activo_asociado || '####'}.jpg
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-[#0071E3] hover:bg-[#0071E3]/90 text-white font-black rounded-[8px] shadow-lg shadow-[#0071E3]/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-[11px]"
                                >
                                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                                    Guardar Accesorio
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Sección Lista */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-[#121212] rounded-[8px] border border-[#333333] shadow-2xl p-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                                <h2 className="text-[12px] font-black uppercase tracking-widest text-[#F5F5F7] flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-[#0071E3]" />
                                    Accesorios Registrados
                                </h2>
                                <select
                                    value={filterActivo}
                                    onChange={e => setFilterActivo(e.target.value ? parseInt(e.target.value) : '')}
                                    className="w-full sm:w-auto px-4 py-2 bg-[#1D1D1F] border border-[#333333] rounded-[8px] text-[#86868B] text-[10px] font-black uppercase tracking-widest outline-none transition-all focus:border-[#0071E3]"
                                >
                                    <option value="">Todos los activos</option>
                                    {activos.map(a => (
                                        <option key={a.numero_activo} value={a.numero_activo}>Activo #{a.numero_activo}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-4">
                                {accesorios.length === 0 ? (
                                    <div className="text-center py-20 bg-[#1D1D1F]/50 rounded-[8px] border border-dashed border-[#333333]">
                                        <ImageIcon className="w-12 h-12 text-[#333333] mx-auto mb-4" />
                                        <p className="text-[#86868B] font-black uppercase text-[10px] tracking-widest">No hay accesorios encontrados</p>
                                    </div>
                                ) : (
                                    accesorios.map(accesorio => (
                                        <div
                                            key={accesorio.id_accesorio_activo}
                                            className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-4 bg-[#1D1D1F]/30 rounded-[8px] border border-[#333333] hover:border-[#0071E3]/30 transition-all group"
                                        >
                                            <div className="w-full sm:w-28 h-40 sm:h-28 bg-[#000000] rounded-[4px] border border-[#333333] overflow-hidden flex-shrink-0 relative group/img">
                                                {accesorio.imagen_accesorio ? (
                                                    <img src={accesorio.imagen_accesorio} alt={accesorio.descripcion_accesorio} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center opacity-20">
                                                        <ImageIcon className="w-10 h-10 text-white" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0 w-full">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-black text-[#F5F5F7] text-[14px] uppercase tracking-wider truncate mb-1">
                                                            {accesorio.descripcion_accesorio}
                                                        </h3>
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] text-[10px] font-black tracking-widest uppercase">
                                                            Activo #{accesorio.activo_asociado}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDelete(accesorio.id_accesorio_activo)}
                                                        className="p-2 text-[#86868B] hover:text-red-500 hover:bg-red-500/10 rounded-[4px] transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 mt-4 text-[10px] font-black uppercase tracking-widest">
                                                    <div className="space-y-1">
                                                        <span className="text-[#86868B] block">Marca</span>
                                                        <span className="text-[#F5F5F7]">{accesorio.marca_accesorio || '-'}</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[#86868B] block">Serie</span>
                                                        <span className="text-[#F5F5F7] font-mono">{accesorio.numero_serie_accesorio || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Búsqueda de Activos */}
            {showSearchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="w-full max-w-md bg-[#121212] border border-[#333333] rounded-[8px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-[#333333] flex justify-between items-center">
                            <h3 className="text-[12px] font-black uppercase tracking-widest text-[#F5F5F7]">Buscar Activo</h3>
                            <button onClick={() => setShowSearchModal(false)} className="text-[#86868B] hover:text-[#F5F5F7] transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-[#333333]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] w-4 h-4" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Buscar por nombre o número..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-[#1D1D1F] border border-[#333333] rounded-[8px] text-[#F5F5F7] focus:border-[#0071E3] outline-none transition-all text-sm placeholder-[#86868B]"
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
                                    className="w-full text-left p-4 rounded-[8px] hover:bg-[#1D1D1F] transition-all flex flex-col gap-1 group"
                                >
                                    <span className="font-bold text-[#F5F5F7] group-hover:text-[#0071E3] transition-colors text-sm">
                                        {activo.nombre_corto_activo}
                                    </span>
                                    <span className="text-[10px] text-[#0071E3] font-black uppercase tracking-widest">
                                        #{activo.numero_activo}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Cámara Overaly */}
            {showCamera && (
                <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-in fade-in duration-200">
                    <div className="flex justify-between items-center p-6 bg-[#000000] border-b border-[#333333]">
                        <button type="button" onClick={stopCamera} className="p-2 text-[#F5F5F7] hover:bg-[#1D1D1F] rounded-full transition-all">
                            <X className="w-6 h-6" />
                        </button>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#F5F5F7]">Captura de Imagen</span>
                        <button type="button" onClick={switchCamera} className="p-2 text-[#F5F5F7] hover:bg-[#1D1D1F] rounded-full transition-all">
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
                    <div className="p-12 bg-[#000000] border-t border-[#333333] flex justify-center pb-16">
                        <button
                            type="button"
                            onClick={capturePhoto}
                            className="w-20 h-20 bg-white rounded-full border-[6px] border-[#333333] p-1 active:scale-95 transition-all shadow-2xl"
                        >
                            <div className="w-full h-full bg-white rounded-full border border-[#D1D1D6]" />
                        </button>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                onClose={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
                onConfirm={confirmationModal.onConfirm}
                title={confirmationModal.title}
                message={confirmationModal.message}
            />

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
