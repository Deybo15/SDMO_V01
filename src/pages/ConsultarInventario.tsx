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
    Image as ImageIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SmartImage from '../components/SmartImage';
import VirtualizedTable from '../components/VirtualizedTable';
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

    const themeColor = 'blue';

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const itemsPerPage = 50;
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

            const ws = XLSX.utils.json_to_sheet(allData);
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
                headStyles: { fillColor: [0, 113, 227] },
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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans selection:bg-[#0071E3]/30">
            <div className="animate-fade-in-up">
                <PageHeader
                    title="Consulta de Inventario"
                    icon={LayoutGrid}
                    themeColor={themeColor}
                />

                <div className="max-w-7xl mx-auto px-8 pt-8 space-y-8">
                    {/* Search and Action Bar */}
                    <div className="bg-[#121212] border border-[#333333] rounded-[8px] p-8 flex flex-col lg:flex-row gap-8 justify-between items-end group shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#0071E3]/20 to-transparent" />

                        <div className="relative w-full lg:w-[600px] flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-2xl font-black text-white flex items-center gap-4 italic tracking-tight uppercase">
                                    <Search className="w-6 h-6 text-[#0071E3]" />
                                    BUSCADOR
                                </h3>
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#86868B] ml-10">Búsqueda avanzada de artículos en tiempo real</p>
                            </div>

                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#424245] group-focus-within:text-[#0071E3] transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar por código o artículo..."
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full pl-14 pr-6 py-5 bg-[#1D1D1F] border border-[#333333] rounded-[8px] text-[#F5F5F7] placeholder-[#424245] focus:border-[#0071E3]/50 transition-all font-bold uppercase text-sm outline-none shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 w-full lg:w-auto h-fit pb-1">
                            <button
                                onClick={handleExportExcel}
                                disabled={loading}
                                className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-[#0071E3] text-[#FFFFFF] rounded-[8px] hover:brightness-110 transition-all disabled:opacity-20 font-bold uppercase text-[10px] tracking-widest shadow-lg active:scale-95"
                            >
                                <Download className="w-5 h-5" />
                                EXCEL
                            </button>
                            <button
                                onClick={handleExportPDF}
                                disabled={loading}
                                className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-transparent border border-[#F5F5F7] text-[#F5F5F7] rounded-[8px] hover:bg-[#F5F5F7]/10 transition-all disabled:opacity-20 font-bold uppercase text-[10px] tracking-widest active:scale-95"
                            >
                                <FileText className="w-5 h-5" />
                                PDF
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="bg-[#121212] border border-[#333333] rounded-[8px] flex flex-col h-[70vh] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#0071E3]/20 to-transparent z-20" />

                        {loading && data.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-8">
                                <Activity className="w-12 h-12 text-[#0071E3] animate-spin" />
                                <p className="font-bold text-[#86868B] uppercase tracking-[0.3em] text-[10px] animate-pulse">
                                    Sincronizando Inventario...
                                </p>
                            </div>
                        ) : error ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                                <AlertCircle className="w-16 h-16 text-red-500" />
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-bold text-[#F5F5F7] uppercase tracking-widest">Error de Carga</h3>
                                    <p className="text-[#86868B] text-xs font-medium max-w-md">{error}</p>
                                    <button
                                        onClick={() => fetchData()}
                                        className="mt-4 px-6 py-2 bg-[#1D1D1F] border border-[#333333] text-[#0071E3] rounded-[8px] hover:bg-[#0071E3] hover:text-[#000000] transition-all text-[10px] font-bold uppercase tracking-widest"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            </div>
                        ) : data.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 opacity-50">
                                <Filter className="w-16 h-16 text-[#333333]" />
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-bold text-[#F5F5F7] uppercase tracking-widest">Sin Coincidencias</h3>
                                    <p className="text-[#86868B] text-xs font-medium">No se encontraron artículos para "{search}"</p>
                                </div>
                            </div>
                        ) : (
                            <VirtualizedTable
                                data={data}
                                rowHeight={160}
                                columns={[
                                    { header: 'Listado de Artículos', width: '100%' }
                                ]}
                                renderCell={(item) => {
                                    return (
                                        <div
                                            onClick={() => setSelectedImage({
                                                src: item.imagen_url || '',
                                                alt: item.nombre_articulo,
                                                stock: item.cantidad_disponible,
                                                unidad: item.unidad,
                                                codigo: item.codigo_articulo,
                                                marca: item.marca
                                            })}
                                            className="group bg-[#1D1D1F]/40 border border-[#333333]/50 p-6 rounded-[12px] hover:border-[#0071E3]/50 hover:bg-white/[0.02] cursor-pointer transition-all duration-300 flex items-center gap-8 shadow-xl mx-4 my-2"
                                        >
                                            {/* Image with hover effect */}
                                            <div className="w-28 h-28 rounded-[12px] bg-black/40 shrink-0 overflow-hidden border border-[#333333] flex items-center justify-center relative shadow-2xl">
                                                {item.imagen_url ? (
                                                    <SmartImage
                                                        src={item.imagen_url}
                                                        alt={item.nombre_articulo}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                                                    />
                                                ) : (
                                                    <ImageIcon className="w-10 h-10 text-[#333333]" />
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                                    <Maximize2 className="w-6 h-6 text-white" />
                                                </div>
                                            </div>

                                            {/* Article Content */}
                                            <div className="flex-1 min-w-0 py-1">
                                                <div className="flex items-start justify-between gap-6">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-[#F5F5F7] font-black group-hover:text-[#0071E3] transition-colors text-xl uppercase italic tracking-tighter leading-none mb-4">
                                                            {item.nombre_articulo}
                                                        </h3>

                                                        <div className="flex flex-wrap items-center gap-4">
                                                            <div className="flex items-center gap-2 bg-[#121212] px-4 py-2 rounded-[6px] border border-[#333333] shadow-sm">
                                                                <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">CÓDIGO</span>
                                                                <span className="text-[11px] font-mono font-black text-[#0071E3] tracking-tight">{item.codigo_articulo}</span>
                                                            </div>

                                                            {item.marca && (
                                                                <div className="flex items-center gap-2 bg-[#0071E3]/5 px-4 py-2 rounded-[6px] border border-[#0071E3]/20 shadow-sm">
                                                                    <span className="text-[9px] font-black text-[#0071E3]/50 uppercase tracking-widest">MARCA</span>
                                                                    <span className="text-[10px] font-black uppercase text-[#F5F5F7] italic group-hover:text-[#0071E3] transition-colors">{item.marca}</span>
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-2 bg-[#121212] px-4 py-2 rounded-[6px] border border-[#333333] shadow-sm">
                                                                <span className="text-[9px] font-black text-[#86868B] uppercase tracking-widest">COSTO</span>
                                                                <span className="text-[11px] font-mono font-black text-[#F5F5F7] opacity-60">{Number(item.precio_unitario).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Stock Badge */}
                                                    <div className="text-right shrink-0">
                                                        <div className={cn(
                                                            "px-6 py-4 rounded-[12px] border flex flex-col items-center transition-all duration-500",
                                                            item.cantidad_disponible > 0
                                                                ? "bg-[#0071E3]/10 border-[#0071E3]/30 shadow-[0_0_30px_rgba(0,113,227,0.1)] group-hover:bg-[#0071E3]/20 group-hover:border-[#0071E3]/50 group-hover:scale-105"
                                                                : "bg-red-500/5 border-red-500/10 grayscale opacity-40 group-hover:opacity-100 transition-all"
                                                        )}>
                                                            <span className={cn(
                                                                "text-4xl font-black italic tracking-tighter leading-none",
                                                                item.cantidad_disponible > 0 ? "text-[#0071E3]" : "text-red-500/50"
                                                            )}>
                                                                {item.cantidad_disponible}
                                                            </span>
                                                            <span className="text-[9px] text-[#86868B] font-black uppercase tracking-[0.2em] mt-2">
                                                                {item.unidad || 'UND'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                        )}
                    </div>

                    {/* Pagination Controls */}
                    <div className="bg-[#121212] border border-[#333333] rounded-[8px] p-6 flex flex-col md:flex-row items-center justify-between gap-8 mb-32">
                        <button
                            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="w-full md:w-auto flex items-center justify-center gap-3 px-10 py-4 text-[11px] font-black text-[#F5F5F7] bg-[#1D1D1F] rounded-[8px] hover:border-[#0071E3] hover:bg-[#1D1D1F] hover:brightness-125 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(0,113,227,0.15)] border border-[#333333] transition-all duration-300 disabled:opacity-10 disabled:pointer-events-none uppercase tracking-[0.15em] active:scale-95 group"
                        >
                            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1.5 transition-transform text-[#0071E3]" />
                            ANTERIOR
                        </button>

                        <div className="flex items-center gap-12">
                            <div className="text-center">
                                <span className="text-[9px] font-bold text-[#86868B] uppercase tracking-widest block mb-2">PÁGINA</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl font-bold text-[#0071E3] italic px-5 py-1 bg-[#0071E3]/10 rounded-[4px] border border-[#0071E3]/20 leading-none">{page}</span>
                                    <span className="text-[#333333] font-bold text-xl">/</span>
                                    <span className="text-xl font-bold text-[#86868B]">{totalPages || 1}</span>
                                </div>
                            </div>
                            <div className="h-10 w-[1px] bg-[#333333] hidden md:block" />
                            <div className="text-center hidden sm:block">
                                <span className="text-[9px] font-bold text-[#86868B] uppercase tracking-widest block mb-2">TOTAL ARTÍCULOS</span>
                                <span className="text-xl font-bold text-[#F5F5F7] tracking-tighter">{totalItems.toLocaleString()}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || loading}
                            className="w-full md:w-auto flex items-center justify-center gap-3 px-10 py-4 text-[11px] font-black text-[#F5F5F7] bg-[#1D1D1F] rounded-[8px] hover:border-[#0071E3] hover:bg-[#1D1D1F] hover:brightness-125 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(0,113,227,0.15)] border border-[#333333] transition-all duration-300 disabled:opacity-10 disabled:pointer-events-none uppercase tracking-[0.15em] active:scale-95 group"
                        >
                            SIGUIENTE
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform text-[#0071E3]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Image Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6 animate-in fade-in duration-300"
                    onClick={() => setSelectedImage(null)}
                >
                    <div
                        className="relative max-w-4xl w-full bg-[#121212] rounded-[8px] overflow-hidden border border-[#333333] shadow-2xl flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-6 right-6 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-[#1D1D1F] hover:bg-[#333333] text-[#F5F5F7] transition-all border border-[#333333]"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="p-12 flex items-center justify-center min-h-[400px] bg-[#000000]/50">
                            <img
                                src={selectedImage.src}
                                alt={selectedImage.alt}
                                className="max-w-full max-h-[50vh] object-contain rounded-[8px] shadow-2xl"
                            />
                        </div>

                        <div className="p-10 border-t border-[#333333] bg-[#121212]">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[#0071E3] font-bold text-[10px] uppercase tracking-[0.2em] bg-[#0071E3]/10 px-3 py-1 rounded-[4px] border border-[#0071E3]/20">Detalle del Artículo</span>
                                        {selectedImage.marca && (
                                            <span className="text-[#86868B] font-bold text-[10px] uppercase tracking-[0.2em] bg-[#1D1D1F] px-3 py-1 rounded-[4px] border border-[#333333] italic">MARCA: {selectedImage.marca}</span>
                                        )}
                                    </div>
                                    <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-tight">{selectedImage.alt}</h3>

                                    <div className="flex items-center gap-4 pt-2">
                                        <div className="flex items-center gap-3 bg-black/40 px-5 py-3 rounded-[8px] border border-[#333333] shadow-inner group transition-all">
                                            <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest">CÓDIGO</span>
                                            <span className="text-sm font-mono font-black text-[#0071E3] tracking-tighter">{selectedImage.codigo}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-[#1D1D1F] border border-[#333333] px-10 py-6 rounded-[12px] flex flex-col items-center gap-2 group hover:border-[#0071E3]/30 transition-all shadow-xl">
                                    <span className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em]">Stock Disponible</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className={cn(
                                            "text-5xl font-black italic tracking-tighter transition-colors duration-500",
                                            (selectedImage.stock || 0) <= 0 ? 'text-red-500/50' : 'text-[#0071E3]'
                                        )}>
                                            {selectedImage.stock?.toLocaleString()}
                                        </span>
                                        <span className="text-xs font-black uppercase text-[#86868B] tracking-widest">{selectedImage.unidad}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
