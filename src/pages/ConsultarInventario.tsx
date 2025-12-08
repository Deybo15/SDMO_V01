import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Download, FileText, ChevronLeft, ChevronRight, X, Loader2, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

    const itemsPerPage = 15;
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
            let more = true;

            while (more) {
                const { data: batch, error } = await supabase
                    .from(VIEW)
                    .select('codigo_articulo, nombre_articulo, unidad, codigo_gasto, precio_unitario, cantidad_disponible')
                    .order('nombre_articulo')
                    .range(from, from + step - 1);

                if (error) throw error;

                if (batch && batch.length > 0) {
                    const batchWithImages = batch.map((item: any) => ({
                        ...item,
                        imagen_url: null
                    }));
                    allData = [...allData, ...batchWithImages];
                    from += step;
                    more = batch.length === step;
                } else {
                    more = false;
                }
            }

            const cods = allData.map(r => r.codigo_articulo).filter(Boolean);
            let marcasMap: Record<string, string> = {};
            const batchSize = 500;

            for (let i = 0; i < cods.length; i += batchSize) {
                const { data: marcas } = await supabase
                    .from('articulo_01')
                    .select('codigo_articulo, marca')
                    .in('codigo_articulo', cods.slice(i, i + batchSize));

                marcas?.forEach((m: MarcaItem) => {
                    marcasMap[m.codigo_articulo] = m.marca;
                });
            }

            const excelData = allData.map(r => ({
                'Código': r.codigo_articulo,
                'Artículo': r.nombre_articulo,
                'Marca': marcasMap[r.codigo_articulo] || 'Sin marca',
                'Unidad': r.unidad,
                'GASTO': r.codigo_gasto || '',
                'PRECIO': r.precio_unitario,
                'Cantidad': r.cantidad_disponible
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);
            ws['!cols'] = [
                { wch: 15 }, { wch: 44 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
            XLSX.writeFile(wb, `Inventario_Completo_SDMO_${new Date().toISOString().split('T')[0]}.xlsx`);

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
            let more = true;

            while (more) {
                const { data: batch, error } = await supabase
                    .from(VIEW)
                    .select('codigo_articulo, nombre_articulo, unidad, codigo_gasto, precio_unitario, cantidad_disponible')
                    .order('nombre_articulo')
                    .range(from, from + step - 1);

                if (error) throw error;

                if (batch && batch.length > 0) {
                    const batchWithImages = batch.map((item: any) => ({
                        ...item,
                        imagen_url: null
                    }));
                    allData = [...allData, ...batchWithImages];
                    from += step;
                    more = batch.length === step;
                } else {
                    more = false;
                }
            }

            const cods = allData.map(r => r.codigo_articulo).filter(Boolean);
            let marcasMap: Record<string, string> = {};
            const batchSize = 500;
            for (let i = 0; i < cods.length; i += batchSize) {
                const { data: marcas } = await supabase
                    .from('articulo_01')
                    .select('codigo_articulo, marca')
                    .in('codigo_articulo', cods.slice(i, i + batchSize));
                marcas?.forEach((m: MarcaItem) => {
                    marcasMap[m.codigo_articulo] = m.marca;
                });
            }

            const doc = new jsPDF('l', 'mm', 'a4');

            doc.setFontSize(18);
            doc.text('Inventario Actual - SDMO', 14, 18);
            doc.setFontSize(11);
            doc.text(`Generado el: ${new Date().toLocaleDateString('es-CR')}`, 14, 26);
            doc.text(`Total de artículos: ${allData.length}`, 14, 32);

            const body = allData.map(r => [
                r.codigo_articulo || 'N/D',
                r.nombre_articulo || 'N/D',
                marcasMap[r.codigo_articulo] || 'Sin marca',
                r.unidad || 'N/D',
                r.codigo_gasto || '',
                'CRC ' + Number(r.precio_unitario).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                Number(r.cantidad_disponible).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ]);

            autoTable(doc, {
                head: [['Código', 'Artículo', 'Marca', 'Unidad', 'GASTO', 'PRECIO', 'Cantidad']],
                body,
                theme: 'striped',
                headStyles: { fillColor: [249, 115, 22] },
                styles: { fontSize: 8 },
                startY: 38,
                margin: { top: 38, bottom: 18 },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'center' },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 25, halign: 'center' },
                    3: { cellWidth: 15, halign: 'center' },
                    4: { cellWidth: 20, halign: 'center' },
                    5: { cellWidth: 35, halign: 'center' },
                    6: { cellWidth: 25, halign: 'center' }
                },
                showHead: 'everyPage'
            });

            doc.save(`Inventario_Completo_SDMO_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('Error exporting PDF:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            {/* Header */}
            <div className="sticky top-0 z-50 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 mb-8 bg-slate-50/90 dark:bg-[#0f1419]/90 backdrop-blur-xl -mx-6 px-6 border-b border-slate-200/50 dark:border-white/5 shadow-lg shadow-black/5 dark:shadow-black/20 transition-all">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/30">
                        <ClipboardList className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-slate-800 to-slate-500 dark:from-white dark:to-slate-400">
                            Inventario Actual
                        </h1>
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
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-center">
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
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={handleExportExcel}
                        disabled={loading}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        <FileText className="w-4 h-4" />
                        Excel
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={loading}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        PDF
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-4 font-bold">Imagen</th>
                                <th className="px-6 py-4 font-bold">Código</th>
                                <th className="px-6 py-4 font-bold">Artículo</th>
                                <th className="px-6 py-4 font-bold">Marca</th>
                                <th className="px-6 py-4 font-bold">Unidad</th>
                                <th className="px-6 py-4 font-bold">Gasto</th>
                                <th className="px-6 py-4 font-bold text-right">Precio</th>
                                <th className="px-6 py-4 font-bold text-right">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                                            <p>Cargando datos...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        No se encontraron resultados
                                    </td>
                                </tr>
                            ) : (
                                data.map((item) => (
                                    <tr key={item.codigo_articulo} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-sm"
                                                onDoubleClick={() => setSelectedImage({
                                                    src: item.imagen_url || 'https://via.placeholder.com/150?text=Sin+Imagen',
                                                    alt: item.nombre_articulo
                                                })}
                                            >
                                                <img
                                                    src={item.imagen_url || 'https://via.placeholder.com/150?text=Sin+Imagen'}
                                                    alt={item.nombre_articulo}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Sin+Imagen';
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                                            {item.codigo_articulo}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 min-w-[300px]">
                                            {item.nombre_articulo}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                                {item.marca || 'Sin marca'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {item.unidad}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            {item.codigo_gasto || 'N/D'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-right font-mono">
                                            {Number(item.precio_unitario).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}
                                        </td>
                                        <td className={`px-6 py-4 font-bold text-right ${item.cantidad_disponible === 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                                            {Number(item.cantidad_disponible).toLocaleString('es-CR')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                    </button>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                        Página <span className="font-medium text-slate-900 dark:text-white">{page}</span> de <span className="font-medium text-slate-900 dark:text-white">{totalPages || 1}</span>
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                        className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Image Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <div
                        className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
                            <h3 className="text-lg font-bold text-white">Vista Detallada</h3>
                            <button
                                onClick={() => setSelectedImage(null)}
                                className="p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4 flex items-center justify-center bg-black/50 h-[calc(90vh-80px)]">
                            <img
                                src={selectedImage.src}
                                alt={selectedImage.alt}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
