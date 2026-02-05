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
        <div className="min-h-screen bg-[#000000] p-8 text-[#F5F5F7]">
            <div className="max-w-7xl mx-auto space-y-12 animate-fade-in-up">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <PageHeader
                        title="Registrar Nuevo Artículo"
                        icon={PackagePlus}
                        themeColor="blue"
                    />
                    <button
                        onClick={() => navigate('/articulos')}
                        className="btn-ghost"
                    >
                        <div className="flex items-center gap-2">
                            <ArrowLeft className="w-5 h-5" />
                            <span className="text-[11px] font-bold uppercase tracking-widest">Regresar</span>
                        </div>
                    </button>
                </div>

                <div className="glass-card">
                    <div className="p-12 space-y-12">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-[#F5F5F7] tracking-tight uppercase flex items-center gap-3">
                                <Warehouse className="w-6 h-6 text-[#0071E3]" />
                                Especificaciones del Producto
                            </h3>
                            <p className="text-xs text-[#86868B] font-medium uppercase tracking-widest">Defina los parámetros técnicos del nuevo artículo</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-12">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                {/* Código */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                        <Hash className="w-3.5 h-3.5 text-[#0071E3]" />
                                        Código de Artículo
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        name="codigo_articulo"
                                        value={formData.codigo_articulo}
                                        onChange={handleChange}
                                        placeholder="Ej: ART-001"
                                        className="glass-input w-full font-mono"
                                    />
                                </div>

                                {/* Nombre */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                        <Box className="w-3.5 h-3.5 text-[#0071E3]" />
                                        Nombre / Descripción
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        name="nombre_articulo"
                                        value={formData.nombre_articulo}
                                        onChange={handleChange}
                                        placeholder="Descripción técnica"
                                        className="glass-input w-full"
                                    />
                                </div>

                                {/* Unidad */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                        <Package className="w-3.5 h-3.5 text-[#0071E3]" />
                                        Unidad de Medida
                                    </label>
                                    <select
                                        name="unidad"
                                        value={formData.unidad}
                                        onChange={handleChange}
                                        className="glass-input w-full appearance-none bg-[#1D1D1F]"
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
                                    <label className="flex items-center gap-2 text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                        <Tag className="w-3.5 h-3.5 text-[#0071E3]" />
                                        Marca
                                    </label>
                                    <select
                                        name="marca"
                                        value={formData.marca}
                                        onChange={handleChange}
                                        className="glass-input w-full appearance-none bg-[#1D1D1F]"
                                    >
                                        <option value="" className="bg-[#121212]">Seleccionar Marca</option>
                                        {marcas.map(marca => (
                                            <option key={marca} value={marca} className="bg-[#121212]">{marca}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Código Gasto */}
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                        <Info className="w-3.5 h-3.5 text-[#0071E3]" />
                                        Código de Gasto
                                    </label>
                                    <select
                                        name="codigo_gasto"
                                        value={formData.codigo_gasto}
                                        onChange={handleChange}
                                        className="glass-input w-full appearance-none bg-[#1D1D1F]"
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
                                    <label className="flex items-center gap-2 text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                        <DollarSign className="w-3.5 h-3.5 text-[#0071E3]" />
                                        Precio Unitario
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="precio_unitario"
                                        value={formData.precio_unitario}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                        className="glass-input w-full"
                                    />
                                </div>

                                {/* Image Upload */}
                                <div className="md:col-span-2 space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-bold text-[#86868B] uppercase tracking-[0.2em] ml-1">
                                        <ImageIcon className="w-3.5 h-3.5 text-[#0071E3]" />
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
                                            "drag-drop-zone min-h-[200px] flex flex-col items-center justify-center p-8 gap-6 active:scale-[0.99]",
                                            isDragging && "active"
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
                                                    className="absolute -top-3 -right-3 p-1.5 bg-[#121212] border border-[#333333] text-white rounded-full hover:bg-rose-600 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="p-5 bg-[#1D1D1F] rounded-full border border-[#333333]">
                                                    <Upload className="w-10 h-10 text-[#0071E3]" />
                                                </div>
                                                <div className="text-center space-y-2">
                                                    <p className="text-sm font-bold uppercase tracking-widest text-[#F5F5F7]">Arrastra o selecciona una imagen</p>
                                                    <p className="text-[10px] font-medium text-[#86868B] uppercase tracking-wider">Soporta PNG, JPG, WEBP (Max 5MB)</p>
                                                </div>
                                            </>
                                        )}

                                        {uploadingImage && (
                                            <div className="absolute inset-0 apple-blur flex items-center justify-center z-20 rounded-[8px]">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Loader2 className="w-10 h-10 text-[#0071E3] animate-spin" />
                                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0071E3]">Subiendo imagen...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-12 border-t border-[#333333] flex flex-col md:flex-row gap-8">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary flex-1 h-16"
                                >
                                    {loading ? (
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                    ) : (
                                        <div className="flex items-center justify-center gap-4">
                                            <Save className="w-6 h-6" />
                                            <span className="text-xs font-bold uppercase tracking-[0.2em]">Guardar en Catálogo</span>
                                        </div>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/articulos')}
                                    className="btn-ghost flex-1 h-16"
                                >
                                    <span className="text-xs font-bold uppercase tracking-widest">Cancelar</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="bg-[#121212] border border-[#333333] p-6 rounded-[8px] text-center">
                    <p className="text-[10px] text-[#86868B] font-bold uppercase tracking-widest leading-relaxed">
                        Al registrar, el artículo estará disponible inmediatamente para ingresos de stock y transacciones.
                    </p>
                </div>
            </div>

            {/* Notification Toast */}
            {notification && (
                <div className={cn(
                    "fixed bottom-8 right-8 z-[100] px-8 py-5 apple-blur rounded-[8px] border border-[#333333] flex items-center gap-5 animate-slide-up shadow-2xl",
                    notification.type === 'success' ? 'text-[#0071E3]' : 'text-rose-500'
                )}>
                    {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">{notification.message}</span>
                </div>
            )}
        </div>
    );
}
