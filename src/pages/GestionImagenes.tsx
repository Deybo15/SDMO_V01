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

        // Validate type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(selectedFile.type)) {
            setMessage({ type: 'error', text: 'Formato no válido. Use JPG, PNG o WebP.' });
            return;
        }

        // Validate size (5MB)
        if (selectedFile.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'El tamaño máximo permitido es 5MB.' });
            return;
        }

        setFile(selectedFile);

        // Preview
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

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, file);

            if (uploadError) throw new Error(`Error al subir imagen: ${uploadError.message}`);

            // 2. Get Public URL
            const { data: urlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(fileName);

            if (!urlData.publicUrl) throw new Error('No se pudo obtener la URL pública.');

            // 3. Update Article Record
            const { error: updateError } = await supabase
                .from('articulo_01')
                .update({ imagen_url: urlData.publicUrl })
                .eq('codigo_articulo', codigo);

            if (updateError) throw new Error(`Error al actualizar artículo: ${updateError.message}`);

            setMessage({ type: 'success', text: `Imagen asociada correctamente al artículo ${codigo}` });

            // Reset form
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
        <div className="min-h-screen bg-[#0f111a] text-slate-100 p-4 md:p-8 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-4xl mx-auto space-y-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-white/10">
                    <div className="space-y-1">
                        <PageHeader title="Asociar imagen a artículo" icon={ImageIcon} themeColor="emerald" />
                        <p className="text-slate-400 text-sm font-medium tracking-wide">
                            Vincula rápidamente fotografías reales a los artículos del inventario.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="glass-button px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-200 hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4 text-emerald-400" />
                        Regresar
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Form */}
                    <div className="lg:col-span-7 glass-card p-8 space-y-8 bg-slate-900/60 relative group">
                        <div className="absolute top-0 left-0 w-1.5 h-32 bg-gradient-to-b from-emerald-500 to-transparent rounded-full -ml-0.5 mt-8 group-hover:h-48 transition-all duration-700" />

                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Detalles de la Asociación</h2>
                            <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest">Ingrese los datos para actualizar la galería</p>
                        </div>

                        <div className="space-y-6">
                            {/* Article Code Input */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-200 uppercase tracking-[0.2em] ml-1">
                                    <Barcode className="w-4 h-4 text-emerald-400" />
                                    Código del Artículo
                                </label>
                                <div className="relative group/input">
                                    <input
                                        type="text"
                                        value={codigo}
                                        onChange={(e) => setCodigo(e.target.value)}
                                        placeholder="Ejem: ART-001..."
                                        className="w-full bg-slate-950/80 border border-white/20 rounded-2xl px-5 py-4 text-base text-white font-bold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all shadow-inner uppercase font-mono"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent scale-x-0 group-focus-within/input:scale-x-100 transition-transform duration-500" />
                                </div>
                            </div>

                            {/* Dropzone Container */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-200 uppercase tracking-[0.2em] ml-1">
                                    <FileImage className="w-4 h-4 text-emerald-400" />
                                    Imagen del Artículo
                                </label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`relative group cursor-pointer border-2 border-dashed rounded-[2rem] p-10 transition-all duration-500 flex flex-col items-center gap-4 text-center overflow-hidden
                                        ${file ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/20 bg-slate-950/40 hover:border-emerald-400 hover:bg-slate-950/60 shadow-xl'}
                                    `}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg, image/png, image/webp"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />

                                    <div className="relative">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-2xl
                                            ${file ? 'bg-emerald-500 rotate-6 scale-110' : 'bg-white/10 rotate-0 group-hover:scale-110 group-hover:rotate-12'}
                                        `}>
                                            <Upload className={`w-8 h-8 transition-colors ${file ? 'text-black' : 'text-slate-300 group-hover:text-emerald-400'}`} />
                                        </div>
                                        {file && (
                                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center animate-in zoom-in shadow-lg">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-base font-black text-white uppercase italic tracking-tight">
                                            {file ? '¡Imagen Seleccionada!' : 'Haz clic para seleccionar'}
                                        </p>
                                        <p className={`text-[10px] font-black uppercase tracking-widest leading-loose ${file ? 'text-emerald-400' : 'text-slate-400'}`}>
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
                                className={`w-full py-5 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all duration-500 shadow-2xl relative overflow-hidden group/btn
                                    ${isFormValid
                                        ? 'bg-emerald-500 text-black hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] shadow-emerald-500/20'
                                        : 'bg-white/5 text-slate-500 border border-white/10 opacity-50'
                                    }
                                `}
                            >
                                {isFormValid && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                                )}

                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span className="text-sm font-black uppercase tracking-[0.2em]">Sincronizando...</span>
                                    </>
                                ) : (
                                    <>
                                        <LinkIcon className={`w-6 h-6 transition-transform duration-500 ${isFormValid ? 'group-hover/btn:rotate-45' : ''}`} />
                                        <span className="text-sm font-black uppercase tracking-[0.2em]">
                                            Subir imagen y asociar
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Status Messages */}
                        {message && (
                            <div className={`p-5 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300 border shadow-2xl backdrop-blur-xl
                                ${message.type === 'error' ? 'bg-rose-500/20 border-rose-500/40 text-rose-100' :
                                    message.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100' :
                                        'bg-blue-500/20 border-blue-500/40 text-blue-100'
                                }`}>
                                {message.type === 'error' && <AlertTriangle className="w-6 h-6 shrink-0 text-rose-400" />}
                                {message.type === 'success' && <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-400" />}
                                {message.type === 'info' && <Loader2 className="w-6 h-6 shrink-0 animate-spin text-blue-400" />}
                                <p className="text-xs font-black uppercase tracking-widest leading-relaxed">{message.text}</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Preview Preview */}
                    <div className="lg:col-span-5 h-full">
                        {preview ? (
                            <div className="glass-card p-6 h-full flex flex-col items-center justify-center bg-black/60 border-white/10 group relative overflow-hidden min-h-[450px] shadow-[0_0_80px_rgba(0,0,0,0.5)]">
                                <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                <img
                                    src={preview}
                                    alt="Vista Previa"
                                    className="max-w-full max-h-[550px] object-contain rounded-2xl shadow-[0_32px_128px_rgba(0,0,0,0.8)] relative z-10 transition-all duration-700 group-hover:scale-[1.03]"
                                />
                                <button
                                    onClick={() => {
                                        setFile(null);
                                        setPreview(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    className="absolute top-8 right-8 p-3 rounded-2xl bg-black/80 text-white hover:bg-rose-500 transition-all shadow-2xl border border-white/20 z-20"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                                <div className="mt-8 text-center relative z-10">
                                    <div className="inline-block px-4 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-2">
                                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Vista Previa Activa</p>
                                    </div>
                                    <p className="text-slate-200 text-sm font-bold mt-2 font-mono uppercase tracking-tighter truncate max-w-[250px]">{file?.name}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="glass-card h-full flex flex-col items-center justify-center p-12 bg-slate-900/40 border-2 border-dashed border-white/5 min-h-[450px]">
                                <div className="p-10 rounded-[3rem] bg-white/[0.03] border border-white/5 mb-8 shadow-inner group-hover:scale-110 transition-transform duration-700">
                                    <ImageIcon className="w-24 h-24 text-slate-700" />
                                </div>
                                <div className="text-center space-y-3">
                                    <p className="text-2xl font-black text-slate-600 uppercase italic tracking-tighter">Sin Imagen</p>
                                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] leading-loose max-w-[240px]">
                                        Seleccione una fotografía para visualizar el resultado en alta definición.
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
