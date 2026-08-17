import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    PackagePlus,
    ArrowLeft,
    Save,
    Hash,
    Tag,
    Box,
    Package,
    DollarSign,
    CheckCircle2,
    XCircle,
    Info,
    Warehouse,
    Upload,
    Image as ImageIcon,
    X,
    Loader2
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

export default function RegistrarArticulo() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [fetchingData, setFetchingData] = useState(true);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Dynamic data states
    const [marcas, setMarcas] = useState<string[]>([]);
    const [gastos, setGastos] = useState<{ codigo: string; subpartida: string }[]>([]);
    const [unidades, setUnidades] = useState<{ unidad: string; descripcion: string }[]>([]);

    // Image upload states
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const [formData, setFormData] = useState({
        codigo_articulo: '',
        nombre_articulo: '',
        unidad: '',
        marca: '',
        codigo_gasto: '',
        precio_unitario: '',
        imagen_url: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [marcasRes, gastosRes, unidadesRes] = await Promise.all([
                    supabase.from('marca_articulo_02').select('marca_articulo').order('marca_articulo'),
                    supabase.from('codigo_gasto_05').select('codigo_gasto, subpartida_presupuestaria').order('subpartida_presupuestaria'),
                    supabase.from('unidad_14').select('unidad, descripcion_unidad').order('unidad')
                ]);

                if (marcasRes.data) {
                    setMarcas(marcasRes.data.map(m => m.marca_articulo));
                }
                if (gastosRes.data) {
                    setGastos(gastosRes.data.map(g => ({
                        codigo: g.codigo_gasto,
                        subpartida: g.subpartida_presupuestaria
                    })));
                }
                if (unidadesRes.data) {
                    setUnidades(unidadesRes.data.map(u => ({
                        unidad: u.unidad,
                        descripcion: u.descripcion_unidad
                    })));
                }
            } catch (error) {
                console.error('Error fetching dynamic data:', error);
            } finally {
                setFetchingData(false);
            }
        };

        fetchData();
    }, []);

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleImageChange = useCallback((file: File | null) => {
        if (!file) {
            setImageFile(null);
            setImagePreview(null);
            return;
        }

        if (!file.type.startsWith('image/')) {
            showNotification('El archivo debe ser una imagen', 'error');
            return;
        }

        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }, []);

    const uploadImage = async (file: File): Promise<string | null> => {
        try {
            setUploadingImage(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${formData.codigo_articulo || 'ART'}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('imagenes_articulo')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('imagenes_articulo')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            showNotification('Error al subir la imagen', 'error');
            return null;
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.codigo_articulo.trim()) throw new Error('El código es obligatorio');
            if (!formData.nombre_articulo.trim()) throw new Error('El nombre es obligatorio');

            let finalImageUrl = '';
            if (imageFile) {
                const uploadedUrl = await uploadImage(imageFile);
                if (uploadedUrl) finalImageUrl = uploadedUrl;
            }

            const payload = {
                ...formData,
                imagen_url: finalImageUrl || formData.imagen_url,
                precio_unitario: formData.precio_unitario ? Number(formData.precio_unitario) : 0,
                fecha_registro: new Date().toLocaleDateString('en-CA')
            };

            const { error } = await supabase
                .from('articulo_01')
                .insert([payload]);

            if (error) {
                if (error.code === '23505') throw new Error('Este código de artículo ya existe');
                throw error;
            }

            showNotification('Artículo registrado exitosamente', 'success');
            setFormData({
                codigo_articulo: '',
                nombre_articulo: '',
                unidad: '',
                marca: '',
                codigo_gasto: '',
                precio_unitario: '',
                imagen_url: ''
            });
            setImageFile(null);
            setImagePreview(null);
        } catch (error: any) {
            console.error('Error al registrar artículo:', error);
            showNotification(error.message || 'Error al procesar la solicitud', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="min-h-screen bg-black p-4 md:p-8 text-[#f4f4f5] selection:bg-white/20">
            <div className="max-w-[1536px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <PageHeader
                        title="Registrar Nuevo Artículo"
                        icon={PackagePlus}
                        themeColor="neutral"
                        subtitle="Creación de productos para el catálogo institucional."
                    />
                    <button
                        onClick={() => navigate('/articulos')}
                        className="h-12 px-6 rounded-lg bg-[#111112] border border-[#52525b] flex items-center gap-3 text-[#d4d4d8] hover:text-white hover:bg-[#18181b] transition-colors group"
                    >
                        <div className="flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-sm font-semibold leading-none">Regresar</span>
                        </div>
                    </button>
                </div>

                <div className="bg-[#0d0d0e] border border-[#3f3f46] rounded-xl overflow-hidden">
                    <div className="p-6 md:p-8 space-y-8">
                        <div className="space-y-1 pb-5 border-b border-[#27272a]">
                            <h3 className="text-xl font-semibold text-white tracking-tight flex items-center gap-3">
                                <Warehouse className="w-5 h-5 text-[#d4d4d8]" />
                                Especificaciones del producto
                            </h3>
                            <p className="text-sm text-[#a1a1aa]">Defina los parámetros técnicos del nuevo artículo. El código y la descripción son obligatorios.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                                {/* Código */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                        <Hash className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                        Código de Artículo
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        name="codigo_articulo"
                                        value={formData.codigo_articulo}
                                        onChange={handleChange}
                                        placeholder="Ej: ART-001"
                                        className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white font-mono placeholder-[#52525b] focus:outline-none focus:border-[#a1a1aa] transition-colors"
                                    />
                                </div>

                                {/* Nombre */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                        <Box className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                        Nombre / Descripción
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        name="nombre_articulo"
                                        value={formData.nombre_articulo}
                                        onChange={handleChange}
                                        placeholder="Descripción técnica"
                                        className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white placeholder-[#52525b] focus:outline-none focus:border-[#a1a1aa] transition-colors"
                                    />
                                </div>

                                {/* Unidad */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                        <Package className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                        Unidad de Medida
                                    </label>
                                    <select
                                        name="unidad"
                                        value={formData.unidad}
                                        onChange={handleChange}
                                        className="w-full h-14 appearance-none bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white focus:outline-none focus:border-[#a1a1aa] transition-colors"
                                    >
                                        <option value="" className="bg-[#121212]">Seleccionar Unidad</option>
                                        {unidades.map(u => (
                                            <option key={u.unidad} value={u.unidad} className="bg-[#121212]">
                                                {u.descripcion.toUpperCase()} ({u.unidad})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Marca */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                        <Tag className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                        Marca
                                    </label>
                                    <select
                                        name="marca"
                                        value={formData.marca}
                                        onChange={handleChange}
                                        className="w-full h-14 appearance-none bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white focus:outline-none focus:border-[#a1a1aa] transition-colors"
                                    >
                                        <option value="" className="bg-[#121212]">Seleccionar Marca</option>
                                        {marcas.map(marca => (
                                            <option key={marca} value={marca} className="bg-[#121212]">{marca}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Código Gasto */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                        <Info className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                        Código de Gasto
                                    </label>
                                    <select
                                        name="codigo_gasto"
                                        value={formData.codigo_gasto}
                                        onChange={handleChange}
                                        className="w-full h-14 appearance-none bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white focus:outline-none focus:border-[#a1a1aa] transition-colors"
                                    >
                                        <option value="" className="bg-[#121212]">Seleccionar Partida</option>
                                        {gastos.map(gasto => (
                                            <option key={gasto.codigo} value={gasto.codigo} className="bg-[#121212]">
                                                {gasto.subpartida}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Precio Unitario */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                        <DollarSign className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                        Precio Unitario
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="precio_unitario"
                                        value={formData.precio_unitario}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                        className="w-full h-14 bg-[#111112] border border-[#3f3f46] rounded-lg px-5 text-white placeholder-[#52525b] focus:outline-none focus:border-[#a1a1aa] transition-colors"
                                    />
                                </div>

                                {/* Image Upload */}
                                <div className="md:col-span-2 space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-[0.14em] ml-1">
                                        <ImageIcon className="w-3.5 h-3.5 text-[#d4d4d8]" />
                                        Imagen del Producto
                                    </label>
                                    <div
                                        onClick={() => document.getElementById('image-upload')?.click()}
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setIsDragging(false);
                                            const file = e.dataTransfer.files[0];
                                            if (file) handleImageChange(file);
                                        }}
                                        className={cn(
                                            "relative min-h-[220px] rounded-xl border border-dashed border-[#52525b] bg-[#09090b] flex flex-col items-center justify-center p-8 gap-5 cursor-pointer transition-colors active:scale-[0.995]",
                                            isDragging ? "border-white bg-[#18181b]" : "hover:border-[#a1a1aa] hover:bg-[#111112]"
                                        )}
                                    >
                                        <input
                                            id="image-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                                        />

                                        {imagePreview ? (
                                            <div className="relative group">
                                                <img
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    className="h-40 w-auto rounded-lg object-contain ring-1 ring-[#333333]"
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleImageChange(null);
                                                    }}
                                                    className="absolute -top-3 -right-3 p-2 bg-[#111112] border border-[#71717a] text-white rounded-full hover:bg-white hover:text-black transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="p-5 bg-[#18181b] rounded-full border border-[#52525b]">
                                                    <Upload className="w-9 h-9 text-white" />
                                                </div>
                                                <div className="text-center space-y-2">
                                                    <p className="text-sm font-semibold text-white">Arrastra o selecciona una imagen</p>
                                                    <p className="text-xs text-[#71717a]">PNG, JPG o WEBP · máximo 5 MB</p>
                                                </div>
                                            </>
                                        )}

                                        {uploadingImage && (
                                            <div className="absolute inset-0 apple-blur flex items-center justify-center z-20 rounded-[8px]">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                                                    <span className="text-xs font-semibold text-white">Subiendo imagen...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-[#27272a] flex flex-col md:flex-row gap-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 h-12 bg-[#e4e4e7] hover:bg-white disabled:opacity-50 disabled:pointer-events-none text-black rounded-lg flex items-center justify-center transition-colors"
                                >
                                    {loading ? (
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                    ) : (
                                        <div className="flex items-center justify-center gap-4">
                                            <Save className="w-5 h-5" />
                                            <span className="text-sm font-semibold">Guardar en catálogo</span>
                                        </div>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/articulos')}
                                    className="flex-1 h-12 bg-[#111112] border border-[#52525b] rounded-lg text-white hover:bg-[#18181b] transition-colors"
                                >
                                    <span className="text-sm font-semibold">Cancelar</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="p-4 border-t border-[#27272a] text-center">
                    <p className="text-xs text-[#71717a] leading-relaxed">
                        Al registrar, el artículo estará disponible inmediatamente para ingresos de inventario y transacciones.
                    </p>
                </div>
            </div>

            {/* Notification Toast */}
            {notification && (
                <div className={cn(
                    "fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-lg border border-[#52525b] bg-[#111112] backdrop-blur-2xl flex items-center gap-4 animate-in slide-in-from-right-10 shadow-2xl",
                    notification.type === 'success' ? 'text-white' : 'text-[#d4d4d8]'
                )}>
                    {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">{notification.message}</span>
                </div>
            )}
        </div>
    );
}
