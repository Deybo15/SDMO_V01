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
    Image as ImageIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SmartImage from '../components/SmartImage';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../lib/utils';

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
        <div className="min-h-screen bg-black text-[#f4f4f5] font-sans selection:bg-white/20">
            <div className="animate-fade-in-up">
                <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 flex flex-col min-h-screen">
                    {/* Unified Premium Container */}
                    <div className="bg-black overflow-hidden flex flex-col relative group flex-1">

                        {/* Modal-style Header */}
                        <div className="pb-4 border-b border-[#27272a] flex flex-col md:flex-row justify-between md:items-center gap-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-[#111112] border border-[#71717a] rounded-lg text-[#e4e4e7]">
                                    <LayoutGrid className="w-7 h-7" />
                                </div>
                                <div>
                                    <h3 className="text-2xl md:text-[30px] font-black text-white tracking-tight leading-none">
                                        Consulta de inventario
                                    </h3>
                                    <p className="text-sm text-[#a1a1aa] mt-1">
                                        Búsqueda y disponibilidad de artículos
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 w-full md:w-auto shrink-0">
                                <button
                                    onClick={handleExportExcel}
                                    disabled={loading}
                                    className="flex-1 md:flex-none px-5 py-3 bg-[#e4e4e7] border border-white text-black rounded-lg font-semibold text-sm hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-20"
                                >
                                    <Download className="w-5 h-5" />
                                    EXCEL
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    disabled={loading}
                                    className="flex-1 md:flex-none px-5 py-3 bg-[#111112] border border-[#52525b] text-white rounded-lg font-semibold text-sm hover:bg-[#18181b] transition-colors flex items-center justify-center gap-2 disabled:opacity-20"
                                >
                                    <FileText className="w-5 h-5" />
                                    PDF
                                </button>
                            </div>
                        </div>

                        {/* Modal-style Search Bar Row */}
                        <div className="py-4 shrink-0">
                            <div className="relative group/search">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717a] group-focus-within/search:text-white transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar por código o nombre del artículo..."
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full bg-[#0d0d0e] border border-[#3f3f46] rounded-lg py-4 pl-14 pr-6 text-white text-sm font-medium outline-none focus:border-[#a1a1aa] transition-colors placeholder:text-[#71717a]"
                                />
                            </div>
                        </div>

                        {/* Unified Grid Area */}
                        <div className="flex-1 custom-scrollbar-premium relative overflow-y-auto">
                            {!loading && !error && data.length > 0 && (
                                <div className="mb-4 text-sm text-[#a1a1aa]">
                                    <span className="font-semibold text-white">{totalItems.toLocaleString('es-CR')}</span> artículos registrados
                                </div>
                            )}
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
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pb-6">
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
                                                "group relative grid grid-cols-[minmax(112px,42%)_1fr] grid-rows-[1fr_auto] gap-x-4 gap-y-3 bg-[#0d0d0e] border border-[#3f3f46] rounded-xl p-4 hover:bg-[#111112] hover:border-[#71717a] transition-colors cursor-pointer min-h-[220px]",
                                                item.cantidad_disponible === 0 && "opacity-70"
                                            )}
                                        >
                                            {/* Article Image Container */}
                                            <div className={cn(
                                                "relative row-span-2 self-start rounded-lg overflow-hidden bg-[#151517] border border-[#3f3f46]",
                                                !item.imagen_url && "aspect-square"
                                            )}>
                                                {item.imagen_url ? (
                                                    <SmartImage
                                                        src={item.imagen_url}
                                                        alt={item.nombre_articulo}
                                                        containerClassName="w-full"
                                                        className="w-full !h-auto !object-contain p-2 group-hover:scale-[1.02] transition-transform duration-300"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center opacity-20">
                                                        <ImageIcon className="w-16 h-16 text-gray-400" />
                                                    </div>
                                                )}

                                                {/* Float Badge */}
                                                <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/85 rounded-md text-[9px] font-semibold text-[#d4d4d8] border border-[#52525b] uppercase tracking-wider">
                                                    {item.unidad || 'UND'}
                                                </div>

                                            </div>

                                            {/* Article Info */}
                                            <div className="min-w-0 flex flex-col gap-3">
                                                <div className="space-y-2">
                                                    <h4 className="font-semibold text-white leading-snug text-[13px] line-clamp-4">
                                                        {item.nombre_articulo}
                                                    </h4>
                                                    <div className="flex items-center gap-3">
                                                        <span className="max-w-full truncate text-[10px] font-mono font-semibold text-[#d4d4d8] px-2 py-1 bg-[#18181b] rounded border border-[#3f3f46]">
                                                            {item.codigo_articulo}
                                                        </span>
                                                        {item.marca && (
                                                            <span className="text-[9px] uppercase font-medium text-[#71717a] tracking-wider truncate">
                                                                {item.marca}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Price Reveal */}
                                                <div className="text-[9px] text-[#71717a] font-medium uppercase tracking-wider flex flex-col gap-1 border-t border-[#27272a] pt-3">
                                                    <span>Valor unitario</span>
                                                    <span className="text-[#d4d4d8] font-mono text-[11px]">
                                                        {Number(item.precio_unitario).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Stock Reveal Footer */}
                                            <div className="flex items-end justify-between self-end">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-[#71717a] font-medium tracking-wider mb-1">Stock disponible</span>
                                                    <span className={cn(
                                                        "text-2xl font-semibold leading-none tabular-nums",
                                                        item.cantidad_disponible > 0 ? "text-white" : "text-[#71717a]"
                                                    )}>
                                                        {item.cantidad_disponible}
                                                    </span>
                                                </div>
                                                <div className="w-9 h-9 rounded-lg bg-[#151517] border border-[#52525b] flex items-center justify-center text-[#d4d4d8] group-hover:border-[#a1a1aa] group-hover:text-white transition-colors">
                                                    <ChevronRight className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pagination Footer (Inside the container) */}
                        <div className="border-t border-[#27272a] py-5 flex flex-col md:flex-row items-center justify-between gap-4 bg-black shrink-0">
                            <button
                                onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                                className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#111112] rounded-lg hover:border-[#a1a1aa] hover:bg-[#18181b] border border-[#3f3f46] transition-colors disabled:opacity-20 disabled:pointer-events-none"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                Anterior
                            </button>

                            <div className="flex items-center gap-8">
                                <div className="text-center group-hover/footer:scale-110 transition-transform">
                                    <span className="text-[9px] font-semibold text-[#71717a] uppercase tracking-[0.18em] block mb-2">Página</span>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-semibold text-white leading-none">{page}</span>
                                            <span className="text-gray-700 font-bold text-xl">/</span>
                                            <span className="text-2xl font-black text-gray-600 leading-none">{totalPages || 1}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-12 w-[1px] bg-white/10 hidden md:block" />
                                <div className="text-center hidden sm:block">
                                    <span className="text-[9px] font-semibold text-[#71717a] uppercase tracking-[0.18em] block mb-2">Catálogo total</span>
                                    <span className="text-lg font-semibold text-white">{totalItems.toLocaleString()}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || loading}
                                className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#111112] rounded-lg hover:border-[#a1a1aa] hover:bg-[#18181b] border border-[#3f3f46] transition-colors disabled:opacity-20 disabled:pointer-events-none"
                            >
                                Siguiente
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-8 animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    <div
                        className="relative max-w-5xl w-full max-h-[90vh] overflow-y-auto bg-[#0b0b0c] rounded-2xl border border-[#3f3f46] shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[#27272a]">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#71717a]">Inventario</p>
                                <h2 className="mt-1 text-lg font-semibold text-[#f4f4f5]">Detalle del artículo</h2>
                            </div>
                            <button
                                onClick={() => setSelectedImage(null)}
                                aria-label="Cerrar detalle"
                                className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#111112] hover:bg-[#1c1c1f] text-[#d4d4d8] border border-[#3f3f46] transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid md:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
                            <div className="p-6 md:p-8 bg-[#0f0f10] border-b md:border-b-0 md:border-r border-[#27272a] flex items-center justify-center">
                                <div className="w-full min-h-[280px] max-h-[520px] rounded-xl bg-[#18181b] border border-[#3f3f46] p-5 flex items-center justify-center overflow-hidden">
                                    <img
                                        src={selectedImage.src}
                                        alt={selectedImage.alt}
                                        className="max-w-full max-h-[470px] w-auto h-auto object-contain"
                                    />
                                </div>
                            </div>

                            <div className="p-6 md:p-8 flex flex-col">
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-3 py-1.5 rounded-md border border-[#3f3f46] bg-[#111112] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">
                                        Artículo
                                    </span>
                                    {selectedImage.marca && (
                                        <span className="px-3 py-1.5 rounded-md border border-[#3f3f46] bg-[#111112] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">
                                            Marca: {selectedImage.marca}
                                        </span>
                                    )}
                                </div>

                                <h3 className="mt-6 text-2xl md:text-3xl font-semibold text-[#f4f4f5] leading-tight">
                                    {selectedImage.alt}
                                </h3>

                                <div className="mt-8 grid sm:grid-cols-2 gap-3">
                                    <div className="rounded-lg border border-[#3f3f46] bg-[#111112] px-4 py-4">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#71717a]">Código</p>
                                        <p className="mt-2 text-sm font-mono font-semibold text-[#e4e4e7] break-all">{selectedImage.codigo}</p>
                                    </div>
                                    <div className="rounded-lg border border-[#3f3f46] bg-[#111112] px-4 py-4">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#71717a]">Unidad</p>
                                        <p className="mt-2 text-sm font-semibold uppercase text-[#e4e4e7]">{selectedImage.unidad || 'Sin definir'}</p>
                                    </div>
                                </div>

                                <div className="mt-auto pt-8">
                                    <div className="rounded-xl border border-[#52525b] bg-[#141416] px-5 py-5 flex items-end justify-between gap-5">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#71717a]">Stock disponible</p>
                                            <p className="mt-1 text-xs text-[#a1a1aa]">Existencias registradas actualmente</p>
                                        </div>
                                        <div className="flex items-baseline gap-2 shrink-0">
                                            <span className="text-4xl font-semibold tracking-tight text-[#fafafa]">
                                                {selectedImage.stock?.toLocaleString()}
                                            </span>
                                            <span className="text-xs font-semibold uppercase text-[#a1a1aa] tracking-wider">
                                                {selectedImage.unidad}
                                            </span>
                                        </div>
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
