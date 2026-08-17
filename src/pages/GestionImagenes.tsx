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
        <div className="min-h-screen bg-black p-4 md:p-8 text-[#f4f4f5] selection:bg-white/20">
            <div className="max-w-[1536px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-5">
                    <PageHeader
                        title="Asociar imagen a artículo"
                        icon={ImageIcon}
                        themeColor="neutral"
                        subtitle="Vinculación de fotografías con los artículos del inventario."
                    />
                    <button
                        onClick={() => navigate(-1)}
                        className="h-12 px-6 rounded-lg bg-[#111112] border border-[#52525b] flex items-center gap-3 text-[#d4d4d8] hover:text-white hover:bg-[#18181b] transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-semibold">Regresar</span>
                    </button>
                </div>

                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    {/* Left: Form */}
                    <div className="lg:col-span-7 bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-6 md:p-8 space-y-8">

                        <div className="space-y-1 pb-5 border-b border-[#27272a]">
                            <h2 className="text-xl font-semibold text-white tracking-tight">Detalles de la asociación</h2>
                            <p className="text-sm text-[#a1a1aa]">Indique el código del artículo y seleccione su fotografía.</p>
                        </div>

                        <div className="space-y-6">
                            {/* Article Code Input */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                    <Barcode className="w-4 h-4 text-[#d4d4d8]" />
                                    Código del Artículo
                                </label>
                                <div className="relative group/input">
                                    <input
                                        type="text"
                                        value={codigo}
                                        onChange={(e) => setCodigo(e.target.value)}
                                        placeholder="Ejem: ART-001..."
                                        className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white placeholder-[#52525b] focus:outline-none focus:border-[#a1a1aa] transition-colors uppercase font-mono"
                                    />
                                </div>
                            </div>

                            {/* Dropzone Container */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                    <FileImage className="w-4 h-4 text-[#d4d4d8]" />
                                    Imagen del Artículo
                                </label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={cn(
                                        "relative group cursor-pointer border border-dashed rounded-xl p-8 transition-colors flex flex-col items-center gap-4 text-center overflow-hidden bg-[#09090b]",
                                        file
                                            ? "border-white bg-[#18181b]"
                                            : "border-[#52525b] hover:border-[#a1a1aa] hover:bg-[#111112]"
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
                                            file ? "bg-white text-black" : "bg-[#18181b] border border-[#52525b] group-hover:scale-105"
                                        )}>
                                            <Upload className={cn("w-8 h-8 transition-colors", file ? "text-black" : "text-[#d4d4d8]")} />
                                        </div>
                                        {file && (
                                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center animate-in zoom-in shadow-lg">
                                                <CheckCircle2 className="w-4 h-4 text-black" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-white">
                                            {file ? 'Imagen seleccionada' : 'Haz clic para seleccionar'}
                                        </p>
                                        <p className="text-xs text-[#71717a] leading-relaxed break-all">
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
                                    "w-full h-12 rounded-lg flex items-center justify-center gap-3 transition-colors group/btn font-semibold text-sm",
                                    isFormValid
                                        ? "bg-[#e4e4e7] text-black hover:bg-white active:scale-[0.99]"
                                        : "bg-[#18181b] text-[#71717a] border border-[#3f3f46] opacity-60"
                                )}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span>Sincronizando...</span>
                                    </>
                                ) : (
                                    <>
                                        <LinkIcon className={cn("w-6 h-6 transition-transform", isFormValid && "group-hover/btn:rotate-45")} />
                                        <span>
                                            Subir imagen y asociar
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Status Messages */}
                        {message && (
                            <div className={cn(
                                "p-4 rounded-lg flex items-center gap-4 animate-in slide-in-from-top-2 duration-300 border bg-[#111112] text-[#d4d4d8]",
                                message.type === 'error' && "border-[#71717a]",
                                message.type === 'success' && "border-white",
                                message.type === 'info' && "border-[#52525b]"
                            )}>
                                {message.type === 'error' && <AlertTriangle className="w-5 h-5 shrink-0 text-white" />}
                                {message.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />}
                                {message.type === 'info' && <Loader2 className="w-5 h-5 shrink-0 animate-spin text-white" />}
                                <p className="text-sm leading-relaxed">{message.text}</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Preview Preview */}
                    <div className="lg:col-span-5 h-full">
                        {preview ? (
                            <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-6 h-full flex flex-col items-center justify-center relative overflow-hidden min-h-[520px]">
                                <img
                                    src={preview}
                                    alt="Vista Previa"
                                    className="max-w-full max-h-[440px] object-contain rounded-lg shadow-2xl relative z-10"
                                />
                                <button
                                    onClick={() => {
                                        setFile(null);
                                        setPreview(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    className="absolute top-6 right-6 p-3 rounded-lg bg-[#111112] text-white hover:bg-white hover:text-black transition-colors border border-[#71717a] z-20"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                                <div className="mt-8 text-center relative z-10">
                                    <div className="inline-block px-3 py-1.5 rounded-md bg-[#18181b] border border-[#52525b] mb-2">
                                        <p className="text-xs font-semibold text-white">Vista previa</p>
                                    </div>
                                    <p className="text-[#a1a1aa] text-xs font-mono truncate max-w-[280px]">{file?.name}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[#0d0d0e] border border-[#3f3f46] border-dashed rounded-xl h-full flex flex-col items-center justify-center p-12 min-h-[520px]">
                                <div className="p-6 rounded-xl bg-[#18181b] border border-[#52525b] mb-6">
                                    <ImageIcon className="w-12 h-12 text-[#71717a]" />
                                </div>
                                <div className="text-center space-y-3">
                                    <p className="text-lg font-semibold text-white">Sin imagen seleccionada</p>
                                    <p className="text-sm text-[#71717a] leading-relaxed max-w-[260px]">
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
