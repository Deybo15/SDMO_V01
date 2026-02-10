import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    Search,
    Download,
    FileText,
    X,
    Loader2,
    AlertCircle,
    LayoutGrid,
    ChevronLeft,
    ChevronRight,
    Filter,
    Activity,
    Maximize2,
    Image as ImageIcon,
    PlusCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SmartImage from '../components/SmartImage';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../lib/utils';
import { PageHeader } from '../components/ui/PageHeader';

// Define types for our data
interface InventoryItem {
    codigo_articulo: string;
    nombre_articulo: string;
    unidad: string;
    codigo_gasto: string;
    precio_unitario: number;
    cantidad_disponible: number;
    imagen_url: string | null;
    marca?: string;
}

interface MarcaItem {
    codigo_articulo: string;
    marca: string;
}

export default function ConsultarInventario() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<InventoryItem[]>([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string, stock?: number, unidad?: string, codigo?: string, marca?: string } | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const themeColor = 'teal';

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const itemsPerPage = 48; // Grid optimized number (divisible by 2, 3, 4)
    const VIEW = 'inventario_con_datos';

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase.from(VIEW).select('*', { count: 'exact' });

            if (search) {
                query = query.or(`codigo_articulo.ilike.%${search}%,nombre_articulo.ilike.%${search}%`);
            }

            const { data: inventarioData, count, error } = await query
                .order('nombre_articulo')
                .range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

            if (error) throw error;

            let dataConMarcas: InventoryItem[] = inventarioData || [];

            if (inventarioData && inventarioData.length > 0) {
                const codigos = inventarioData.map((i: InventoryItem) => i.codigo_articulo).filter(Boolean);

                if (codigos.length > 0) {
                    const { data: marcasData } = await supabase
                        .from('articulo_01')
                        .select('codigo_articulo, marca')
                        .in('codigo_articulo', codigos);

                    if (marcasData) {
                        const map = (marcasData as MarcaItem[]).reduce((acc, item) => {
                            acc[item.codigo_articulo] = item.marca;
                            return acc;
                        }, {} as Record<string, string>);

                        dataConMarcas = inventarioData.map((item: InventoryItem) => ({
                            ...item,
                            marca: map[item.codigo_articulo] || 'Sin marca'
                        }));
                    }
                }
            }

            setData(dataConMarcas);
            setTotalItems(count || 0);

        } catch (error: any) {
            console.error('Error fetching data:', error);
            setError(error.message || 'Error de conexión con el servidor. Por favor, verifica tu conexión a internet.');
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 300); // Debounce search

        return () => clearTimeout(timer);
    }, [fetchData]);

    const handleExportExcel = async () => {
        setLoading(true);
        try {
            let allData: InventoryItem[] = [];
            let from = 0;
            const step = 1000;
            let keepFetching = true;

            while (keepFetching) {
                const { data: chunk, error } = await supabase
                    .from(VIEW)
                    .select('*')
                    .range(from, from + step - 1);

                if (error || !chunk || chunk.length === 0) {
                    keepFetching = false;
                } else {
                    allData = [...allData, ...chunk];
                    from += step;
                    if (chunk.length < step) keepFetching = false;
                }
            }

            // Mapear datos para asegurar que el código sea tratado como texto por XLSX
            const formattedData = allData.map(item => ({
                'Código': String(item.codigo_articulo),
                'Artículo': item.nombre_articulo,
                'Unidad': item.unidad,
                'Stock': item.cantidad_disponible,
                'Precio Unitario': item.precio_unitario
            }));

            const ws = XLSX.utils.json_to_sheet(formattedData);

            // Forzar formato de texto para la columna A (Código)
            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: 0 }); // Columna A
                if (ws[cellRef]) {
                    ws[cellRef].t = 's'; // Tipo string
                    ws[cellRef].z = '@'; // Formato texto
                }
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Inventario");
            XLSX.writeFile(wb, "Inventario_Completo_SDMO.xlsx");
        } catch (error) {
            console.error('Error exporting Excel:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        setLoading(true);
        try {
            let allData: InventoryItem[] = [];
            let from = 0;
            const step = 1000;
            let keepFetching = true;

            while (keepFetching) {
                const { data: chunk, error } = await supabase
                    .from(VIEW)
                    .select('*')
                    .range(from, from + step - 1);

                if (error || !chunk || chunk.length === 0) {
                    keepFetching = false;
                } else {
                    allData = [...allData, ...chunk];
                    from += step;
                    if (chunk.length < step) keepFetching = false;
                }
            }

            const doc = new jsPDF();
            doc.text("Inventario Completo SDMO", 14, 15);
            doc.setFontSize(10);
            doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 22);
            doc.text(`Total de artículos: ${allData.length}`, 14, 29);

            autoTable(doc, {
                startY: 35,
                head: [['Código', 'Artículo', 'Unidad', 'Stock', 'Precio (CRC)']],
                body: allData.map(item => [
                    item.codigo_articulo,
                    item.nombre_articulo,
                    item.unidad,
                    item.cantidad_disponible,
                    new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.precio_unitario)
                ]),
                theme: 'striped',
                headStyles: { fillColor: [13, 148, 136] }, // teal-600
                columnStyles: {
                    3: { halign: 'right' }, // Stock
                    4: { halign: 'right' }  // Precio
                }
            });

            doc.save("Inventario_Completo_SDMO.pdf");
        } catch (error) {
            console.error('Error exporting PDF:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return (
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans selection:bg-teal-500/30">
            <div className="animate-fade-in-up">
                <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col min-h-screen">
                    {/* Unified Premium Container */}
                    <div className="bg-[#0f111a]/95 border border-white/10 rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative group flex-1 my-4">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-teal-500/40 to-transparent z-20" />

                        {/* Modal-style Header */}
                        <div className="px-10 py-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-center bg-black/40 gap-6 shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-3xl group-hover:scale-110 transition-transform duration-500">
                                    <LayoutGrid className="w-10 h-10 text-teal-400" />
                                </div>
                                <div>
                                    <h3 className="text-4xl font-black text-white italic tracking-tight uppercase leading-none">
                                        BUSCADOR
                                    </h3>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mt-3 ml-1 opacity-70">
                                        Gestión de inventario en tiempo real · SDMO Premium
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4 w-full md:w-auto shrink-0">
                                <button
                                    onClick={handleExportExcel}
                                    disabled={loading}
                                    className="flex-1 md:flex-none px-10 py-4 bg-teal-600/10 border border-teal-500/20 text-teal-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-teal-600/20 hover:text-teal-300 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-20 shadow-2xl shadow-teal-500/10"
                                >
                                    <Download className="w-5 h-5" />
                                    EXCEL
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    disabled={loading}
                                    className="flex-1 md:flex-none px-10 py-4 bg-white/5 border border-white/10 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-20"
                                >
                                    <FileText className="w-5 h-5" />
                                    PDF
                                </button>
                            </div>
                        </div>

                        {/* Modal-style Search Bar Row */}
                        <div className="px-10 py-8 bg-black/20 shrink-0 border-b border-white/5">
                            <div className="relative group/search">
                                <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-7 h-7 text-gray-600 group-focus-within/search:text-teal-400 transition-all duration-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar por código o nombre del artículo..."
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full bg-black/40 border-2 border-white/5 rounded-3xl py-6 pl-20 pr-10 text-white text-xl font-medium outline-none focus:border-teal-500/40 focus:ring-8 focus:ring-teal-500/5 transition-all placeholder:text-gray-700/50"
                                />
                            </div>
                        </div>

                        {/* Unified Grid Area */}
                        <div className="flex-1 p-4 md:p-8 custom-scrollbar-premium relative bg-black/5 overflow-y-auto">
                            {loading && data.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-8">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-teal-500/20 blur-2xl animate-pulse rounded-full" />
                                        <Loader2 className="w-20 h-20 text-teal-400 animate-spin relative z-10" />
                                    </div>
                                    <p className="font-black text-[#86868B] uppercase tracking-[0.4em] text-xs animate-pulse italic">
                                        Sincronizando Artículos...
                                    </p>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center h-full gap-8 p-12">
                                    <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-full animate-bounce">
                                        <AlertCircle className="w-16 h-16 text-red-500" />
                                    </div>
                                    <div className="text-center space-y-4">
                                        <h3 className="text-3xl font-black text-[#F5F5F7] uppercase tracking-widest italic">Interrupción de Enlace</h3>
                                        <p className="text-[#86868B] text-sm font-medium max-w-md">{error}</p>
                                        <button
                                            onClick={() => fetchData()}
                                            className="mt-6 px-12 py-5 bg-white/5 border border-white/10 text-teal-400 rounded-2xl hover:bg-teal-500 hover:text-black transition-all text-xs font-black uppercase tracking-widest shadow-2xl"
                                        >
                                            Reestablecer Conexión
                                        </button>
                                    </div>
                                </div>
                            ) : data.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-8 p-12 opacity-40">
                                    <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center border border-white/5 shadow-inner">
                                        <Filter className="w-16 h-16 text-gray-700" />
                                    </div>
                                    <div className="text-center space-y-4">
                                        <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">Sin Coincidencias</h3>
                                        <p className="text-[#86868B] text-sm font-medium uppercase tracking-widest">No se encontraron artículos para "{search}"</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-10">
                                    {data.map((item) => (
                                        <div
                                            key={item.codigo_articulo}
                                            onClick={() => setSelectedImage({
                                                src: item.imagen_url || '',
                                                alt: item.nombre_articulo,
                                                stock: item.cantidad_disponible,
                                                unidad: item.unidad,
                                                codigo: item.codigo_articulo,
                                                marca: item.marca
                                            })}
                                            className={cn(
                                                "group relative bg-[#1D1D1F]/40 border border-white/5 rounded-[2rem] p-6 hover:bg-white/[0.08] hover:border-teal-500/40 transition-all duration-500 cursor-pointer flex flex-col h-full shadow-2xl hover:shadow-teal-500/20",
                                                item.cantidad_disponible === 0 && "opacity-60"
                                            )}
                                        >
                                            {/* Article Image Container */}
                                            <div className="relative aspect-square rounded-[1.5rem] overflow-hidden mb-6 bg-white/[0.02] border border-white/5 shadow-inner group-hover:scale-[1.02] transition-transform duration-700">
                                                {item.imagen_url ? (
                                                    <SmartImage
                                                        src={item.imagen_url}
                                                        alt={item.nombre_articulo}
                                                        className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-1000 ease-out"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center opacity-20">
                                                        <ImageIcon className="w-16 h-16 text-gray-400" />
                                                    </div>
                                                )}

                                                {/* Float Badge */}
                                                <div className="absolute top-4 right-4 px-4 py-1.5 bg-black/80 backdrop-blur-md rounded-xl text-[10px] font-black text-teal-400 border border-teal-500/30 uppercase tracking-[0.1em] shadow-2xl">
                                                    {item.unidad || 'UND'}
                                                </div>

                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-500">
                                                    <Maximize2 className="w-10 h-10 text-white scale-75 group-hover:scale-100 transition-transform duration-500" />
                                                </div>
                                            </div>

                                            {/* Article Info */}
                                            <div className="flex-1 flex flex-col space-y-4">
                                                <div className="space-y-2">
                                                    <h4 className="font-black text-white group-hover:text-teal-400 transition-colors leading-tight uppercase italic text-[13px] tracking-tighter">
                                                        {item.nombre_articulo}
                                                    </h4>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[12px] font-mono font-black text-white/90 tracking-tighter uppercase px-2 py-0.5 bg-black/40 rounded-md border border-white/5">
                                                            {item.codigo_articulo}
                                                        </span>
                                                        {item.marca && (
                                                            <span className="text-[9px] uppercase font-black text-gray-500 tracking-widest opacity-80 italic">
                                                                {item.marca}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Price Reveal */}
                                                <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest flex justify-between items-center border-t border-white/5 pt-4">
                                                    <span>VALOR UNITARIO</span>
                                                    <span className="text-[#F5F5F7] opacity-60 font-mono">
                                                        {Number(item.precio_unitario).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Stock Reveal Footer */}
                                            <div className="mt-6 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-gray-600 uppercase font-black tracking-widest mb-1 italic opacity-60">Stock Real</span>
                                                    <span className={cn(
                                                        "text-3xl font-black italic leading-none tracking-tighter",
                                                        item.cantidad_disponible > 0 ? "text-teal-400" : "text-red-500/50"
                                                    )}>
                                                        {item.cantidad_disponible}
                                                    </span>
                                                </div>
                                                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center group-hover:bg-teal-400 group-hover:text-black transition-all duration-700 shadow-inner group-hover:shadow-[0_0_20px_rgba(20,184,166,0.3)]">
                                                    <PlusCircle className="w-8 h-8" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pagination Footer (Inside the container) */}
                        <div className="border-t border-white/10 p-8 flex flex-col md:flex-row items-center justify-between gap-8 bg-black/60 shrink-0">
                            <button
                                onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                                className="w-full md:w-auto flex items-center justify-center gap-4 px-12 py-5 text-[11px] font-black text-[#F5F5F7] bg-white/[0.03] rounded-2xl hover:border-teal-500 hover:bg-white/5 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(20,184,166,0.15)] border border-white/10 transition-all duration-500 disabled:opacity-10 disabled:pointer-events-none uppercase tracking-[0.2em] active:scale-95 group shadow-2xl"
                            >
                                <ChevronLeft className="w-6 h-6 group-hover:-translate-x-2 transition-transform text-teal-500" />
                                ANTERIOR
                            </button>

                            <div className="flex items-center gap-16">
                                <div className="text-center group-hover/footer:scale-110 transition-transform">
                                    <span className="text-[9px] font-black text-[#86868B] uppercase tracking-[0.3em] block mb-3 opacity-60">PÁGINA</span>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-black text-teal-400 italic leading-none tracking-tighter">{page}</span>
                                            <span className="text-gray-700 font-bold text-xl">/</span>
                                            <span className="text-2xl font-black text-gray-600 leading-none">{totalPages || 1}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-12 w-[1px] bg-white/10 hidden md:block" />
                                <div className="text-center hidden sm:block">
                                    <span className="text-[9px] font-black text-[#86868B] uppercase tracking-[0.3em] block mb-3 opacity-60">CATÁLOGO TOTAL</span>
                                    <span className="text-2xl font-black text-[#F5F5F7] tracking-tighter italic">{totalItems.toLocaleString()}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || loading}
                                className="w-full md:w-auto flex items-center justify-center gap-4 px-12 py-5 text-[11px] font-black text-[#F5F5F7] bg-white/[0.03] rounded-2xl hover:border-teal-500 hover:bg-white/5 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(20,184,166,0.15)] border border-white/10 transition-all duration-500 disabled:opacity-10 disabled:pointer-events-none uppercase tracking-[0.2em] active:scale-95 group shadow-2xl"
                            >
                                SIGUIENTE
                                <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform text-teal-500" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/98 backdrop-blur-3xl p-6 animate-in fade-in duration-500"
                    onClick={() => setSelectedImage(null)}
                >
                    <div
                        className="relative max-w-4xl w-full bg-[#0f111a] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_0_120px_rgba(0,0,0,0.9)] flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-6 right-6 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 hover:bg-teal-500/20 text-white transition-all border border-white/10 group shadow-2xl"
                        >
                            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                        </button>

                        <div className="p-8 flex items-center justify-center min-h-[300px] bg-black/20 overflow-hidden">
                            <img
                                src={selectedImage.src}
                                alt={selectedImage.alt}
                                className="max-w-full max-h-[40vh] object-contain rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/5 hover:scale-[1.02] transition-transform duration-700"
                            />
                        </div>

                        <div className="p-8 border-t border-white/10 bg-black/60 overflow-y-auto">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-center gap-3">
                                        <span className="text-teal-400 font-black text-[9px] uppercase tracking-[0.3em] bg-teal-500/10 px-4 py-1.5 rounded-xl border border-teal-500/20 shadow-inner">
                                            Identificación
                                        </span>
                                        {selectedImage.marca && (
                                            <span className="text-gray-500 font-black text-[9px] uppercase tracking-[0.3em] bg-black/40 px-4 py-1.5 rounded-xl border border-white/5 italic">
                                                MARCA: {selectedImage.marca}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-tight">{selectedImage.alt}</h3>

                                    <div className="flex items-center gap-4 pt-1">
                                        <div className="flex items-center gap-3 bg-black/40 px-5 py-3 rounded-xl border border-white/10 shadow-inner group transition-all">
                                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">CÓDIGO</span>
                                            <span className="text-base font-mono font-black text-teal-400 tracking-tighter">{selectedImage.codigo}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-teal-500/5 to-transparent border border-white/10 px-10 py-6 rounded-[1.5rem] flex flex-col items-center gap-2 group hover:border-teal-500/40 transition-all duration-700 shadow-2xl shrink-0">
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.4em] opacity-60 text-center">Disponibilidad</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className={cn(
                                            "text-6xl font-black italic tracking-tighter transition-all duration-700 leading-none",
                                            (selectedImage.stock || 0) <= 0 ? 'text-red-500/50' : 'text-teal-400 group-hover:text-teal-300'
                                        )}>
                                            {selectedImage.stock?.toLocaleString()}
                                        </span>
                                        <span className="text-xs font-black uppercase text-gray-600 tracking-widest">{selectedImage.unidad}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar-premium::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar-premium::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar-premium::-webkit-scrollbar-thumb {
                    background: rgba(20, 184, 166, 0.1);
                    border-radius: 20px;
                }
                .custom-scrollbar-premium::-webkit-scrollbar-thumb:hover {
                    background: rgba(20, 184, 166, 0.3);
                }
            `}</style>
        </div>
    );
}
