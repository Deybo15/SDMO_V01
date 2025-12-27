import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Download, FileText, ChevronLeft, ChevronRight, X, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SmartImage from '../components/SmartImage';
import VirtualizedTable from '../components/VirtualizedTable';
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
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<InventoryItem[]>([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string } | null>(null);

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
        <div className="p-6 space-y-6 flex flex-col h-full bg-slate-50 dark:bg-[#070b14]">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 mb-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventario Actual</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Consulta y gestión de artículos en tiempo real</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Regresar
                    </button>
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-slate-200/50 dark:border-white/5 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código o artículo..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-900/50 border border-transparent focus:border-blue-500 dark:focus:border-blue-500 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={handleExportExcel}
                        disabled={loading}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-600/20 rounded-xl hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 font-semibold"
                    >
                        <Download className="w-4 h-4" />
                        Excel
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={loading}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600/10 text-red-600 dark:text-red-400 border border-red-600/20 rounded-xl hover:bg-red-600 hover:text-white transition-all disabled:opacity-50 font-semibold"
                    >
                        <FileText className="w-4 h-4" />
                        PDF
                    </button>
                </div>
            </div>

            {/* Table Container with Virtualization */}
            <div className="flex-1 min-h-0 bg-white dark:bg-slate-800/20 rounded-2xl shadow-xl border border-slate-200/50 dark:border-white/5 overflow-hidden flex flex-col">
                {loading && data.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
                        <div className="relative">
                            <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                            <div className="absolute inset-0 blur-xl bg-blue-500/20 animate-pulse"></div>
                        </div>
                        <p className="font-semibold text-lg animate-pulse">Optimizando datos...</p>
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500 grayscale opacity-50">
                        <AlertCircle className="w-16 h-16" />
                        <p className="font-bold text-xl">Sin resultados</p>
                    </div>
                ) : (
                    <VirtualizedTable
                        data={data}
                        rowHeight={110}
                        columns={[
                            { header: 'Imagen', width: '120px' },
                            { header: 'Código', width: '150px', className: 'font-mono text-[10px] tracking-tight' },
                            { header: 'Artículo', width: '450px', className: 'text-sm' },
                            { header: 'Marca', width: '180px' },
                            { header: 'Unidad', width: '120px' },
                            { header: 'Gasto', width: '120px' },
                            { header: 'Precio', width: '180px', className: 'text-right font-mono' },
                            { header: 'Cantidad', width: '140px', className: 'text-right' },
                        ]}
                        renderCell={(item, colIdx) => {
                            switch (colIdx) {
                                case 0:
                                    return (
                                        <div
                                            className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 group/img cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg shadow-black/5"
                                            onDoubleClick={() => setSelectedImage({
                                                src: item.imagen_url || '',
                                                alt: item.nombre_articulo
                                            })}
                                        >
                                            <SmartImage
                                                src={item.imagen_url}
                                                alt={item.nombre_articulo}
                                                className="w-full h-full"
                                            />
                                        </div>
                                    );
                                case 1:
                                    return <span className="text-slate-400 font-bold uppercase">{item.codigo_articulo}</span>;
                                case 2:
                                    return <span className="text-slate-900 dark:text-white font-semibold leading-snug">{item.nombre_articulo}</span>;
                                case 3:
                                    return (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase tracking-wider">
                                            {item.marca || 'Sin marca'}
                                        </span>
                                    );
                                case 4:
                                    return <span className="text-slate-500 dark:text-slate-400 font-medium">{item.unidad}</span>;
                                case 5:
                                    return <span className="text-slate-500 dark:text-slate-400 font-medium">{item.codigo_gasto || 'N/D'}</span>;
                                case 6:
                                    return (
                                        <span className="text-slate-900 dark:text-white font-black">
                                            {Number(item.precio_unitario).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}
                                        </span>
                                    );
                                case 7:
                                    return (
                                        <div className="flex flex-col items-end">
                                            <span className={cn(
                                                "text-lg font-black tracking-tighter",
                                                item.cantidad_disponible === 0 ? 'text-red-500' : 'text-slate-900 dark:text-emerald-400'
                                            )}>
                                                {Number(item.cantidad_disponible).toLocaleString('es-CR')}
                                            </span>
                                            <span className="text-[10px] uppercase font-bold text-slate-400">En stock</span>
                                        </div>
                                    );
                                default:
                                    return null;
                            }
                        }}
                    />
                )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 mt-2">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-20 disabled:cursor-not-allowed uppercase tracking-widest"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Anterior
                </button>
                <div className="flex items-center gap-6">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                        Página <span className="text-blue-500 font-black">{page}</span> de <span className="text-blue-500 font-black">{totalPages || 1}</span>
                    </span>
                    <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700"></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                        Total Items: {totalItems}
                    </span>
                </div>
                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-20 disabled:cursor-not-allowed uppercase tracking-widest"
                >
                    Siguiente
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Image Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-[#070b14]/95 backdrop-blur-xl p-4 animate-in fade-in duration-300"
                    onClick={() => setSelectedImage(null)}
                >
                    <div
                        className="relative max-w-5xl w-full max-h-[90vh] bg-slate-900/50 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-3xl animate-in zoom-in-95 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="absolute top-6 right-6 z-10">
                            <button
                                onClick={() => setSelectedImage(null)}
                                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all border border-white/20"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-12 flex items-center justify-center min-h-[500px]">
                            <img
                                src={selectedImage.src}
                                alt={selectedImage.alt}
                                className="max-w-full max-h-[70vh] object-contain rounded-3xl shadow-2xl shadow-black/50"
                            />
                        </div>
                        <div className="bg-gradient-to-t from-black/80 to-transparent p-12 pt-24 absolute bottom-0 left-0 right-0">
                            <h3 className="text-2xl font-black text-white tracking-tight">{selectedImage.alt}</h3>
                            <p className="text-slate-400 font-medium">Visualización de alta resolución</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
