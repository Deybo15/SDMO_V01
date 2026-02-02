import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    Image as ImageIcon,
    Upload,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    ArrowLeft,
    Barcode,
    Link as LinkIcon,
    X,
    FileImage
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

export default function GestionImagenes() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [codigo, setCodigo] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const BUCKET_NAME = 'imagenes-articulos';

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        setMessage(null);

        if (!selectedFile) {
            setFile(null);
            setPreview(null);
            return;
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(selectedFile.type)) {
            setMessage({ type: 'error', text: 'Formato no válido. Use JPG, PNG o WebP.' });
            return;
        }

        if (selectedFile.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'El tamaño máximo permitido es 5MB.' });
            return;
        }

        setFile(selectedFile);

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
    };

    const handleUpload = async () => {
        if (!codigo || !file) return;

        setLoading(true);
        setMessage({ type: 'info', text: 'Procesando imagen y asociando al artículo...' });

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${codigo}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, file);

            if (uploadError) throw new Error(`Error al subir imagen: ${uploadError.message}`);

            const { data: urlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(fileName);

            if (!urlData.publicUrl) throw new Error('No se pudo obtener la URL pública.');

            const { error: updateError } = await supabase
                .from('articulo_01')
                .update({ imagen_url: urlData.publicUrl })
                .eq('codigo_articulo', codigo);

            if (updateError) throw new Error(`Error al actualizar artículo: ${updateError.message}`);

            setMessage({ type: 'success', text: `Imagen asociada correctamente al artículo ${codigo}` });

            setCodigo('');
            setFile(null);
            setPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (error: any) {
            console.error(error);
            setMessage({ type: 'error', text: error.message || 'Ocurrió un error inesperado.' });
        } finally {
            setLoading(false);
        }
    };

    const isFormValid = codigo.trim() !== '' && file !== null;

    return (
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans selection:bg-[#0071E3]/30">
            <div className="max-w-4xl mx-auto px-8 pt-8 space-y-8 animate-fade-in-up">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-4 border-b border-[#333333]">
                    <div className="space-y-2">
                        <PageHeader title="Asociar imagen a artículo" icon={ImageIcon} themeColor="blue" />
                        <p className="text-[#86868B] text-sm font-medium">
                            Vincula rápidamente fotografías reales a los artículos del inventario.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-6 py-3 bg-transparent border border-[#F5F5F7] text-[#F5F5F7] rounded-[8px] hover:bg-[#F5F5F7]/10 transition-all text-xs font-bold uppercase tracking-widest active:scale-95"
                    >
                        <ArrowLeft className="w-4 h-4 text-[#0071E3]" />
                        Regresar
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Form */}
                    <div className="lg:col-span-7 bg-[#121212] border border-[#333333] rounded-[8px] p-8 space-y-8 relative group">
                        <div className="absolute top-0 left-0 w-1.5 h-32 bg-gradient-to-b from-[#0071E3] to-transparent rounded-full -ml-0.5 mt-8 group-hover:h-48 transition-all duration-700" />

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-[#F5F5F7] uppercase tracking-tight italic">Detalles de la Asociación</h2>
                            <p className="text-[#86868B] text-[10px] font-bold uppercase tracking-widest">Ingrese los datos para actualizar la galería</p>
                        </div>

                        <div className="space-y-6">
                            {/* Article Code Input */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-bold text-[#F5F5F7] uppercase tracking-[0.2em] ml-1">
                                    <Barcode className="w-4 h-4 text-[#0071E3]" />
                                    Código del Artículo
                                </label>
                                <div className="relative group/input">
                                    <input
                                        type="text"
                                        value={codigo}
                                        onChange={(e) => setCodigo(e.target.value)}
                                        placeholder="Ejem: ART-001..."
                                        className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] px-5 py-4 text-base text-[#F5F5F7] placeholder-[#86868B] focus:outline-none focus:border-[#0071E3]/50 transition-all shadow-inner uppercase font-mono font-bold"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-[1px] bg-[#0071E3] scale-x-0 group-focus-within/input:scale-x-100 transition-transform duration-500" />
                                </div>
                            </div>

                            {/* Dropzone Container */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-bold text-[#F5F5F7] uppercase tracking-[0.2em] ml-1">
                                    <FileImage className="w-4 h-4 text-[#0071E3]" />
                                    Imagen del Artículo
                                </label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={cn(
                                        "relative group cursor-pointer border-2 border-dashed rounded-[8px] p-8 transition-all duration-500 flex flex-col items-center gap-4 text-center overflow-hidden bg-[#1D1D1F]",
                                        file
                                            ? "border-[#0071E3] bg-[#0071E3]/5 shadow-[0_0_30px_rgba(0,113,227,0.1)]"
                                            : "border-[#424245] hover:border-[#0071E3] hover:bg-[#0071E3]/5 shadow-xl"
                                    )}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg, image/png, image/webp"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />

                                    <div className="relative">
                                        <div className={cn(
                                            "w-16 h-16 rounded-[8px] flex items-center justify-center transition-all duration-500 shadow-2xl",
                                            file ? "bg-[#0071E3] scale-110" : "bg-black/20 group-hover:scale-110 group-hover:rotate-6"
                                        )}>
                                            <Upload className={cn("w-8 h-8 transition-colors", file ? "text-white" : "text-[#86868B] group-hover:text-[#0071E3]")} />
                                        </div>
                                        {file && (
                                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center animate-in zoom-in shadow-lg">
                                                <CheckCircle2 className="w-4 h-4 text-[#0071E3]" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-base font-bold text-[#F5F5F7] uppercase italic tracking-tight">
                                            {file ? '¡Imagen Seleccionada!' : 'Haz clic para seleccionar'}
                                        </p>
                                        <p className={cn("text-[10px] font-bold uppercase tracking-widest leading-loose", file ? "text-[#0071E3]" : "text-[#86868B]")}>
                                            {file ? file.name : 'JPG, PNG o WebP (Máx. 5MB)'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4">
                            <button
                                onClick={handleUpload}
                                disabled={loading || !isFormValid}
                                className={cn(
                                    "w-full py-5 rounded-[8px] flex items-center justify-center gap-4 transition-all duration-500 shadow-2xl relative overflow-hidden group/btn font-bold",
                                    isFormValid
                                        ? "bg-[#0071E3] text-white hover:brightness-110 hover:scale-[1.01] active:scale-[0.98]"
                                        : "bg-[#1D1D1F] text-[#86868B] border border-[#333333] opacity-30"
                                )}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span className="text-sm uppercase tracking-[0.2em]">Sincronizando...</span>
                                    </>
                                ) : (
                                    <>
                                        <LinkIcon className={cn("w-6 h-6 transition-transform", isFormValid && "group-hover/btn:rotate-45")} />
                                        <span className="text-sm uppercase tracking-[0.2em]">
                                            Subir imagen y asociar
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Status Messages */}
                        {message && (
                            <div className={cn(
                                "p-5 rounded-[8px] flex items-center gap-4 animate-in slide-in-from-top-2 duration-300 border shadow-2xl backdrop-blur-xl",
                                message.type === 'error' && "bg-rose-500/10 border-rose-500/20 text-rose-100",
                                message.type === 'success' && "bg-[#0071E3]/10 border-[#0071E3]/20 text-blue-100",
                                message.type === 'info' && "bg-[#1D1D1F] border-[#333333] text-blue-100"
                            )}>
                                {message.type === 'error' && <AlertTriangle className="w-6 h-6 shrink-0 text-rose-500" />}
                                {message.type === 'success' && <CheckCircle2 className="w-6 h-6 shrink-0 text-[#0071E3]" />}
                                {message.type === 'info' && <Loader2 className="w-6 h-6 shrink-0 animate-spin text-[#0071E3]" />}
                                <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">{message.text}</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Preview Preview */}
                    <div className="lg:col-span-5 h-full">
                        {preview ? (
                            <div className="bg-[#121212] border border-[#333333] rounded-[8px] p-8 h-full flex flex-col items-center justify-center relative overflow-hidden min-h-[450px] shadow-2xl">
                                <div className="absolute inset-0 bg-[#0071E3]/5" />
                                <img
                                    src={preview}
                                    alt="Vista Previa"
                                    className="max-w-full max-h-[500px] object-contain rounded-[8px] shadow-2xl relative z-10 transition-transform duration-700 hover:scale-[1.02]"
                                />
                                <button
                                    onClick={() => {
                                        setFile(null);
                                        setPreview(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    className="absolute top-8 right-8 p-3 rounded-[8px] bg-black/60 text-[#F5F5F7] hover:bg-rose-500 transition-all shadow-2xl border border-[#333333] z-20"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                                <div className="mt-8 text-center relative z-10">
                                    <div className="inline-block px-4 py-1 rounded-[4px] bg-[#0071E3]/10 border border-[#0071E3]/20 mb-2">
                                        <p className="text-[9px] font-bold text-[#0071E3] uppercase tracking-[0.3em]">Vista Previa Activa</p>
                                    </div>
                                    <p className="text-[#86868B] text-xs font-mono font-bold uppercase truncate max-w-[250px]">{file?.name}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[#121212] border border-[#333333] border-dashed rounded-[8px] h-full flex flex-col items-center justify-center p-12 min-h-[450px] opacity-40">
                                <div className="p-8 rounded-[8px] bg-black/20 border border-[#333333] mb-8">
                                    <ImageIcon className="w-16 h-16 text-[#333333]" />
                                </div>
                                <div className="text-center space-y-3">
                                    <p className="text-xl font-bold text-[#86868B] uppercase tracking-tight italic">Sin Imagen</p>
                                    <p className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] leading-loose max-w-[240px]">
                                        Seleccione una fotografía para visualizar el resultado.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
