import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    Image as ImageIcon,
    Upload,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    ChevronLeft,
    Barcode,
    Link as LinkIcon,
    X
} from 'lucide-react';

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

    return (
        <div className="p-6 space-y-6 min-h-screen bg-[#0f1419]">
            {/* Header */}
            <div className="sticky top-0 z-50 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 mb-8 bg-[#0f1419]/90 backdrop-blur-xl -mx-6 px-6 border-b border-white/5 shadow-lg shadow-black/20 transition-all">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-lg shadow-green-500/30">
                        <ImageIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                            Asociar imagen a artículo
                        </h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 text-slate-200 border border-white/10 rounded-xl hover:bg-slate-700/50 transition-all shadow-sm backdrop-blur-sm"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Regresar
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-2xl mx-auto">
                <div className="bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-8 space-y-8">

                    <div className="text-center space-y-2">
                        <h2 className="text-xl font-semibold text-white">Detalles de la Asociación</h2>
                        <p className="text-slate-400">Selecciona un archivo de imagen y asócialo a un artículo existente</p>
                    </div>

                    <div className="space-y-6">
                        {/* Código Input */}
                        <div className="space-y-2">
                            <label htmlFor="codigo" className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                <Barcode className="w-4 h-4 text-green-500" />
                                Código del artículo
                            </label>
                            <input
                                id="codigo"
                                type="text"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                placeholder="Ingrese el código del artículo"
                                className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 text-white placeholder-slate-500 transition-all"
                            />
                        </div>

                        {/* File Input */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                <ImageIcon className="w-4 h-4 text-green-500" />
                                Imagen del artículo
                            </label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="relative group cursor-pointer border-2 border-dashed border-white/10 hover:border-green-500/50 rounded-xl p-8 transition-all bg-slate-900/30 hover:bg-slate-900/50 text-center"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg, image/png, image/webp"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-green-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-white">
                                            {file ? file.name : 'Seleccionar imagen'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            JPG, PNG o WebP (Máx. 5MB)
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        {preview && (
                            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/50 aspect-video flex items-center justify-center group">
                                <img
                                    src={preview}
                                    alt="Preview"
                                    className="max-w-full max-h-full object-contain"
                                />
                                <button
                                    onClick={() => {
                                        setFile(null);
                                        setPreview(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-red-500/80 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Messages */}
                        {message && (
                            <div className={`p-4 rounded-xl flex items-start gap-3 ${message.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-200' :
                                message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-200' :
                                    'bg-blue-500/10 border border-blue-500/20 text-blue-200'
                                }`}>
                                {message.type === 'error' && <AlertTriangle className="w-5 h-5 shrink-0" />}
                                {message.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                                {message.type === 'info' && <Loader2 className="w-5 h-5 shrink-0 animate-spin" />}
                                <p className="text-sm">{message.text}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            onClick={handleUpload}
                            disabled={loading || !codigo || !file}
                            className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <LinkIcon className="w-5 h-5" />
                                    Subir imagen y asociar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
