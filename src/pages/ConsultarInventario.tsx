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
    Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SmartImage from '../components/SmartImage';
import VirtualizedTable from '../components/VirtualizedTable';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../lib/utils';

// Shared Components
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
    const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string, stock?: number, unidad?: string } | null>(null);
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

        } catch (error) {
            console.error('Error fetching data:', error);
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
                head: [['Código', 'Artículo', 'Unidad', 'Stock', 'Precio']],
                body: allData.map(item => [
                    item.codigo_articulo,
                    item.nombre_articulo,
                    item.unidad,
                    item.cantidad_disponible,
                    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(item.precio_unitario)
                ]),
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246] }
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
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8">
            <PageHeader
                title="Consulta de Inventario"
                icon={LayoutGrid}
                themeColor={themeColor}
            />

            <div className="max-w-7xl mx-auto space-y-6">

                {/* Search and Action Bar */}
                <div className="bg-[#1e2235] border border-white/10 rounded-2xl shadow-xl p-4 md:p-6 flex flex-col lg:flex-row gap-4 justify-between items-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />

                    <div className="relative w-full lg:w-96 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por código o artículo..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            className="w-full pl-12 pr-4 py-3.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all font-bold shadow-inner"
                        />
                    </div>

                    <div className="flex gap-3 w-full lg:w-auto">
                        <button
                            onClick={handleExportExcel}
                            disabled={loading}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50 font-black uppercase tracking-tighter shadow-lg shadow-emerald-500/5"
                        >
                            <Download className="w-5 h-5" />
                            Excel
                        </button>
                        <button
                            onClick={handleExportPDF}
                            disabled={loading}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-xl hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50 font-black uppercase tracking-tighter shadow-lg shadow-rose-500/5"
                        >
                            <FileText className="w-5 h-5" />
                            PDF
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-[#1e2235] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[70vh] relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50" />

                    {loading && data.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <Loader2 className="w-16 h-16 animate-spin text-blue-500" />
                                <div className="absolute inset-0 blur-2xl bg-blue-500/30 animate-pulse" />
                            </div>
                            <p className="font-black text-gray-500 uppercase tracking-[0.3em] text-sm animate-pulse italic">
                                Sincronizando Base de Datos...
                            </p>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8 grayscale opacity-30">
                            <Filter className="w-20 h-20 text-gray-600" />
                            <h3 className="text-2xl font-black text-gray-400 uppercase tracking-widest">Sin Coincidencias</h3>
                            <p className="text-gray-500 max-w-xs font-bold">No se encontraron artículos con el término "{search}"</p>
                        </div>
                    ) : (
                        <VirtualizedTable
                            data={data}
                            rowHeight={isMobile ? 140 : 100}
                            columns={isMobile ? [
                                { header: 'Inventario Móvil', width: '100%' }
                            ] : [
                                { header: 'Imagen', width: '7%' },
                                { header: 'Código', width: '12%', className: 'font-mono text-xs tracking-tighter text-blue-400/80' },
                                { header: 'Artículo', width: '36%', className: 'font-bold text-white' },
                                { header: 'Marca', width: '10%' },
                                { header: 'Unidad', width: '7%' },
                                { header: 'Precio Unitario', width: '13%', className: 'text-right font-mono text-gray-400' },
                                { header: 'Stock Disponible', width: '15%', className: 'text-right font-black shadow-rose-500/5' },
                            ]}
                            renderCell={(item, colIdx) => {
                                if (isMobile) {
                                    return (
                                        <div className="flex items-center gap-6 w-full p-4 h-full relative">
                                            <div
                                                className="w-24 h-24 rounded-2xl bg-black/40 border border-white/10 overflow-hidden shrink-0 shadow-2xl group transition-transform active:scale-95"
                                                onClick={() => setSelectedImage({
                                                    src: item.imagen_url || '',
                                                    alt: item.nombre_articulo,
                                                    stock: item.cantidad_disponible,
                                                    unidad: item.unidad
                                                })}
                                            >
                                                <SmartImage src={item.imagen_url} alt={item.nombre_articulo} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <h3 className="text-white font-black text-sm leading-tight line-clamp-2 uppercase italic tracking-tight">
                                                    {item.nombre_articulo}
                                                </h3>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="bg-white/5 text-gray-500 px-2 py-0.5 rounded-lg border border-white/5 font-mono text-[9px] uppercase">
                                                        #{item.codigo_articulo}
                                                    </span>
                                                    <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-lg border border-blue-500/20 text-[9px] font-black uppercase tracking-tighter">
                                                        {item.marca || 'GENERIC'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-end pt-1">
                                                    <div>
                                                        <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest block">Precio</span>
                                                        <span className="text-gray-300 font-bold text-xs">{Number(item.precio_unitario).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest block">Stock</span>
                                                        <span className={cn(
                                                            "text-xl font-black italic tracking-tighter",
                                                            item.cantidad_disponible === 0 ? 'text-rose-500' : 'text-emerald-400'
                                                        )}>
                                                            {Number(item.cantidad_disponible).toLocaleString('es-CR')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                switch (colIdx) {
                                    case 0:
                                        return (
                                            <div
                                                className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-black/40 cursor-pointer transition-all hover:scale-110 active:scale-95 shadow-lg group"
                                                onClick={() => setSelectedImage({
                                                    src: item.imagen_url || '',
                                                    alt: item.nombre_articulo,
                                                    stock: item.cantidad_disponible,
                                                    unidad: item.unidad
                                                })}
                                            >
                                                <SmartImage src={item.imagen_url} alt={item.nombre_articulo} className="w-full h-full object-cover group-hover:brightness-110" />
                                            </div>
                                        );
                                    case 1: return <span className="font-mono font-bold uppercase tracking-tighter opacity-80">{item.codigo_articulo}</span>;
                                    case 2: return <span className="font-black text-sm text-gray-200 tracking-tight leading-snug line-clamp-2 uppercase">{item.nombre_articulo}</span>;
                                    case 3: return (
                                        <span className="inline-flex px-3 py-1 rounded-lg text-[10px] font-black bg-white/5 text-gray-400 border border-white/5 uppercase tracking-widest">
                                            {item.marca || 'GENERIC'}
                                        </span>
                                    );
                                    case 4: return <span className="font-bold text-xs text-gray-500 uppercase">{item.unidad}</span>;
                                    case 5: return <span className="font-mono text-sm text-gray-400">{Number(item.precio_unitario).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}</span>;
                                    case 6: return (
                                        <div className="flex flex-col items-end">
                                            <span className={cn(
                                                "text-xl font-black italic tracking-tighter",
                                                item.cantidad_disponible <= 0 ? 'text-rose-500' : 'text-emerald-400'
                                            )}>
                                                {Number(item.cantidad_disponible).toLocaleString('es-CR')}
                                            </span>
                                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] -mt-1">{item.unidad}</span>
                                        </div>
                                    );
                                    default: return null;
                                }
                            }}
                        />
                    )}
                </div>

                {/* Enhanced Pagination Controls */}
                <div className="bg-[#1e2235] border border-white/10 rounded-3xl p-4 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
                    <button
                        onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-3.5 text-xs font-black text-gray-400 bg-white/5 rounded-2xl hover:bg-white/10 border border-white/10 transition-all disabled:opacity-20 uppercase tracking-widest active:scale-95 group shadow-lg"
                    >
                        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Anterior
                    </button>

                    <div className="flex items-center gap-8">
                        <div className="text-center">
                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] block mb-1">Página Actual</span>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl font-black text-blue-500 italic px-4 py-1 bg-blue-500/10 rounded-xl border border-blue-500/20">{page}</span>
                                <span className="text-gray-600 font-black text-lg">/</span>
                                <span className="text-xl font-bold text-gray-500">{totalPages || 1}</span>
                            </div>
                        </div>
                        <div className="h-10 w-[1px] bg-white/10 hidden md:block" />
                        <div className="text-center hidden sm:block">
                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] block mb-1">Total Registros</span>
                            <span className="text-lg font-black text-gray-400 tracking-tighter tabular-nums">{totalItems.toLocaleString()}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                        className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-3.5 text-xs font-black text-gray-400 bg-white/5 rounded-2xl hover:bg-white/10 border border-white/10 transition-all disabled:opacity-20 uppercase tracking-widest active:scale-95 group shadow-lg"
                    >
                        Siguiente
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Premium Image Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-[#070b14]/95 backdrop-blur-3xl p-4 animate-in fade-in duration-500"
                    onClick={() => setSelectedImage(null)}
                >
                    <div
                        className="relative max-w-5xl w-full max-h-[90vh] bg-[#1e2235]/50 rounded-[3rem] overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-500 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-8 right-8 z-10 w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10"
                        >
                            <X className="w-8 h-8" />
                        </button>

                        <div className="flex-1 p-12 md:p-20 flex items-center justify-center min-h-[400px]">
                            <img
                                src={selectedImage.src}
                                alt={selectedImage.alt}
                                className="max-w-full max-h-[60vh] object-contain rounded-3xl shadow-2xl transition-transform duration-700 hover:scale-105"
                            />
                        </div>

                        <div className="bg-gradient-to-t from-black/95 via-black/80 to-transparent p-12 md:p-16 pt-32 shrink-0">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                                <div>
                                    <span className="text-blue-500 font-black text-[10px] uppercase tracking-[0.4em] block mb-3">Detalle de Producto</span>
                                    <h3 className="text-2xl md:text-4xl font-black text-white tracking-tight uppercase italic leading-none">{selectedImage.alt}</h3>
                                </div>
                                <div className="flex gap-4">
                                    <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-md">
                                        <span className="text-[10px] font-black text-gray-500 uppercase block mb-1">Stock Disponible</span>
                                        <span className={cn(
                                            "text-xl font-black tracking-tighter italic",
                                            (selectedImage.stock || 0) <= 0 ? 'text-rose-500' : 'text-emerald-400'
                                        )}>
                                            {selectedImage.stock?.toLocaleString()} {selectedImage.unidad}
                                        </span>
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
