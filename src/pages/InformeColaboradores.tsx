import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Users, ArrowLeft, Filter, Search, Eraser, Download, Eye,
    ChevronLeft, ChevronRight, X, FileSpreadsheet, Box
} from 'lucide-react';

// Types
interface Colaborador {
    identificacion: string;
    colaborador: string;
    alias: string;
    correo_colaborador: string;
    autorizado: boolean;
    supervisor: boolean;
    operador_de_equipo: boolean;
    profesional_responsable: boolean;
    fecha_ingreso: string;
    [key: string]: any;
}

interface ArticuloSalida {
    id_salida: number;
    fecha_salida: string;
    tipo_solicitud: string;
    articulo: string;
    nombre_articulo: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
}

export default function InformeColaboradores() {
    const navigate = useNavigate();

    // -- State --
    const [loading, setLoading] = useState(false);
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
    const [totalRows, setTotalRows] = useState(0);

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Sorting
    const [sortCol, setSortCol] = useState<string>('colaborador');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Filters
    const [filters, setFilters] = useState({
        colaborador: '',
        alias: '',
        correo: '',
        autorizado: '',
        supervisor: '',
        operador: '',
        profesional: ''
    });

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [selectedColaborador, setSelectedColaborador] = useState<{ id: string, nombre: string } | null>(null);
    const [articulos, setArticulos] = useState<ArticuloSalida[]>([]);
    const [articulosOriginal, setArticulosOriginal] = useState<ArticuloSalida[]>([]); // For local filtering
    const [modalFilterTipo, setModalFilterTipo] = useState('');
    const [tiposSolicitudDisponibles, setTiposSolicitudDisponibles] = useState<string[]>([]);

    // -- Data Fetching --
    const [activeFilters, setActiveFilters] = useState(filters);

    const handleApplyFilters = () => {
        setPage(1);
        setActiveFilters(filters);
    };



    const fetchColaboradores = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from('colaboradores_06').select('*', { count: 'exact' });

            if (activeFilters.colaborador) query = query.ilike('colaborador', `%${activeFilters.colaborador}%`);
            if (activeFilters.alias) query = query.ilike('alias', `%${activeFilters.alias}%`);
            if (activeFilters.correo) query = query.ilike('correo_colaborador', `%${activeFilters.correo}%`);
            if (activeFilters.autorizado) query = query.eq('autorizado', activeFilters.autorizado === 'true');
            if (activeFilters.supervisor) query = query.eq('supervisor', activeFilters.supervisor === 'true');
            if (activeFilters.operador) query = query.eq('operador_de_equipo', activeFilters.operador === 'true');
            if (activeFilters.profesional) query = query.eq('profesional_responsable', activeFilters.profesional === 'true');

            query = query.order(sortCol, { ascending: sortDir === 'asc', nullsFirst: true });
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data, count, error } = await query;
            if (error) throw error;

            setColaboradores(data || []);
            setTotalRows(count || 0);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, sortCol, sortDir, activeFilters]);

    useEffect(() => {
        fetchColaboradores();
    }, [fetchColaboradores]);

    // -- Handlers --
    const handleSort = (col: string) => {
        if (sortCol === col) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(col);
            setSortDir('asc');
        }
        setPage(1);
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({
            colaborador: '',
            alias: '',
            correo: '',
            autorizado: '',
            supervisor: '',
            operador: '',
            profesional: ''
        });
        setPage(1);
    };

    // -- Export CSV --
    const exportCSV = async () => {
        setLoading(true);
        try {
            let allData: any[] = [];
            let hasMore = true;
            let offset = 0;
            const batch = 1000;

            while (hasMore) {
                let query = supabase.from('colaboradores_06').select('*');
                if (activeFilters.colaborador) query = query.ilike('colaborador', `%${activeFilters.colaborador}%`);
                if (activeFilters.alias) query = query.ilike('alias', `%${activeFilters.alias}%`);
                if (activeFilters.correo) query = query.ilike('correo_colaborador', `%${activeFilters.correo}%`);
                if (activeFilters.autorizado) query = query.eq('autorizado', activeFilters.autorizado === 'true');
                if (activeFilters.supervisor) query = query.eq('supervisor', activeFilters.supervisor === 'true');
                if (activeFilters.operador) query = query.eq('operador_de_equipo', activeFilters.operador === 'true');
                if (activeFilters.profesional) query = query.eq('profesional_responsable', activeFilters.profesional === 'true');

                query = query.order(sortCol, { ascending: sortDir === 'asc', nullsFirst: true });
                query = query.range(offset, offset + batch - 1);

                const { data, error } = await query;
                if (error) throw error;

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    if (data.length < batch) hasMore = false;
                    offset += batch;
                } else {
                    hasMore = false;
                }
            }

            if (allData.length === 0) {
                alert('No hay datos para exportar');
                return;
            }

            const headers = ['identificacion', 'colaborador', 'alias', 'correo_colaborador', 'autorizado', 'supervisor', 'operador_de_equipo', 'profesional_responsable', 'fecha_ingreso'];
            const csvContent = [
                headers.join(','),
                ...allData.map(row => headers.map(fieldName => {
                    const val = row[fieldName];
                    const str = val === null || val === undefined ? '' : String(val);
                    return `"${str.replace(/"/g, '""')}"`;
                }).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `colaboradores_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setLoading(false);
        }
    };

    // -- Modal Logic --
    const openModal = async (colab: Colaborador) => {
        setSelectedColaborador({ id: colab.identificacion, nombre: colab.colaborador });
        setModalOpen(true);
        setModalLoading(true);
        setArticulos([]);
        setArticulosOriginal([]);
        setModalFilterTipo('');

        try {
            const { data: salidas } = await supabase
                .from('salida_articulo_08')
                .select('id_salida, fecha_salida, numero_solicitud, retira')
                .eq('retira', colab.identificacion)
                .order('fecha_salida', { ascending: false });

            if (!salidas || salidas.length === 0) {
                setModalLoading(false);
                return;
            }

            const numerosSolicitud = [...new Set(salidas.map(s => s.numero_solicitud).filter(Boolean))];
            let tiposMap = new Map();
            if (numerosSolicitud.length > 0) {
                const { data: solicitudes } = await supabase
                    .from('solicitud_17')
                    .select('numero_solicitud, tipo_solicitud')
                    .in('numero_solicitud', numerosSolicitud);
                solicitudes?.forEach(s => tiposMap.set(s.numero_solicitud, s.tipo_solicitud));
            }

            const idsSalida = salidas.map(s => s.id_salida);
            const { data: detalles } = await supabase
                .from('dato_salida_13')
                .select('id_salida, articulo, cantidad, precio_unitario, subtotal')
                .in('id_salida', idsSalida);

            if (!detalles || detalles.length === 0) {
                setModalLoading(false);
                return;
            }

            const codigosArticulo = [...new Set(detalles.map(d => d.articulo))];
            let articulosMap = new Map();
            if (codigosArticulo.length > 0) {
                const { data: arts } = await supabase
                    .from('articulo_01')
                    .select('codigo_articulo, nombre_articulo')
                    .in('codigo_articulo', codigosArticulo);
                arts?.forEach(a => articulosMap.set(a.codigo_articulo, a.nombre_articulo));
            }

            const merged: ArticuloSalida[] = detalles.map(d => {
                const salida = salidas.find(s => s.id_salida === d.id_salida);
                const tipo = tiposMap.get(salida?.numero_solicitud) || 'Sin tipo';
                const nombreArt = articulosMap.get(d.articulo) || 'Artículo no encontrado';

                return {
                    id_salida: d.id_salida,
                    fecha_salida: salida?.fecha_salida,
                    tipo_solicitud: tipo,
                    articulo: d.articulo,
                    nombre_articulo: nombreArt,
                    cantidad: d.cantidad,
                    precio_unitario: d.precio_unitario,
                    subtotal: d.subtotal
                };
            }).sort((a, b) => new Date(b.fecha_salida).getTime() - new Date(a.fecha_salida).getTime());

            setArticulos(merged);
            setArticulosOriginal(merged);

            const types = [...new Set(merged.map(m => m.tipo_solicitud))].sort();
            setTiposSolicitudDisponibles(types);

        } catch (error) {
            console.error(error);
        } finally {
            setModalLoading(false);
        }
    };

    const filterModalArticulos = (tipo: string) => {
        setModalFilterTipo(tipo);
        if (!tipo) {
            setArticulos(articulosOriginal);
        } else {
            setArticulos(articulosOriginal.filter(a => a.tipo_solicitud === tipo));
        }
    };

    const exportModalExcel = () => {
        if (articulos.length === 0) return;

        const nombre = (selectedColaborador?.nombre || 'colaborador').replace(/[^a-zA-Z0-9]/g, '_');
        const fecha = new Date().toISOString().split('T')[0];

        let html = `
        <table border="1">
            <tr><td colspan="8" style="font-weight:bold;font-size:16px;">Colaborador: ${selectedColaborador?.nombre} (${selectedColaborador?.id})</td></tr>
            <tr></tr>
            <tr style="font-weight:bold;background:#f0f0f0;">
                <td>ID Salida</td><td>Fecha Salida</td><td>Tipo Solicitud</td><td>Código Artículo</td>
                <td>Nombre Artículo</td><td>Cantidad</td><td>Precio Unitario</td><td>Subtotal</td>
            </tr>`;

        articulos.forEach(it => {
            html += `<tr>
                <td>${it.id_salida}</td>
                <td>${new Date(it.fecha_salida).toLocaleDateString('es-ES')}</td>
                <td>${it.tipo_solicitud}</td>
                <td>${it.articulo}</td>
                <td>${it.nombre_articulo}</td>
                <td>${it.cantidad}</td>
                <td>${it.precio_unitario}</td>
                <td>${it.subtotal}</td>
            </tr>`;
        });
        html += '</table>';

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `articulos_${nombre}_${fecha}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const BadgeBool = ({ val }: { val: boolean }) => {
        if (val === true) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">✓ Sí</span>;
        if (val === false) return <span className="text-slate-600 text-xs font-medium px-2">No</span>;
        return <span className="opacity-50">-</span>;
    };

    return (
        <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans relative">
            {/* Background Halos */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[85%] left-[20%] w-[80rem] h-[80rem] bg-orange-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
                <div className="absolute top-[15%] right-[20%] w-[80rem] h-[80rem] bg-blue-500/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>
            </div>

            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-700/50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/gestion-interna')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" title="Regresar">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">Colaboradores</h1>
                                <p className="text-xs text-slate-400">Gestión de personal autorizado</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:block px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-sm text-slate-300">
                            {totalRows} colaboradores
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative z-10 max-w-7xl mx-auto p-6 space-y-6">
                {/* Filters */}
                <section className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-slate-700/50">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium">
                                <Filter className="w-3 h-3" /> Filtros de búsqueda
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-white">Encuentra colaboradores</h2>
                        <p className="text-sm text-slate-400 mt-1">Filtra por nombre, alias, correo y marcadores de rol.</p>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Buscar por nombre</label>
                                <input
                                    value={filters.colaborador}
                                    onChange={(e) => handleFilterChange('colaborador', e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                                    placeholder="Ej: Juan Pérez"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Buscar por alias</label>
                                <input
                                    value={filters.alias}
                                    onChange={(e) => handleFilterChange('alias', e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                                    placeholder="Ej: JPerez"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Correo contiene</label>
                                <input
                                    value={filters.correo}
                                    onChange={(e) => handleFilterChange('correo', e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                                    placeholder="Ej: @msj.go.cr"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {[
                                { label: 'Autorizado', key: 'autorizado' },
                                { label: 'Supervisor', key: 'supervisor' },
                                { label: 'Operador', key: 'operador' },
                                { label: 'Prof. Resp.', key: 'profesional' }
                            ].map((f) => (
                                <div key={f.key}>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">{f.label}</label>
                                    <select
                                        value={filters[f.key as keyof typeof filters]}
                                        onChange={(e) => handleFilterChange(f.key, e.target.value)}
                                        className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                                    >
                                        <option value="">Todos</option>
                                        <option value="true">Sí</option>
                                        <option value="false">No</option>
                                    </select>
                                </div>
                            ))}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Por página</label>
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                                >
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <button
                                onClick={handleApplyFilters}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-600/20 to-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl hover:bg-orange-500/30 transition-all font-medium text-sm"
                            >
                                <Search className="w-4 h-4" /> Aplicar filtros
                            </button>
                            <button
                                onClick={() => { clearFilters(); handleApplyFilters(); }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700 transition-all font-medium text-sm"
                            >
                                <Eraser className="w-4 h-4" /> Limpiar
                            </button>
                            <button
                                onClick={exportCSV}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700 transition-all font-medium text-sm"
                            >
                                <Download className="w-4 h-4" /> Exportar CSV
                            </button>
                        </div>
                    </div>
                </section>

                {/* Table Section */}
                <section className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
                    {loading ? (
                        <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-3"></div>
                            <p>Cargando colaboradores...</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto max-h-[600px]">
                                <table className="w-full text-left border-collapse relative">
                                    <thead>
                                        <tr className="sticky top-0 z-20 bg-slate-900 border-b border-slate-700 shadow-md text-slate-300 text-sm font-bold">
                                            {[
                                                { label: 'Identificación', col: 'identificacion' },
                                                { label: 'Colaborador', col: 'colaborador' },
                                                { label: 'Alias', col: 'alias' },
                                                { label: 'Correo', col: 'correo_colaborador' },
                                                { label: 'Autorizado', col: 'autorizado', center: true },
                                                { label: 'Supervisor', col: 'supervisor', center: true },
                                                { label: 'Operador', col: 'operador_de_equipo', center: true },
                                                { label: 'Prof. Resp.', col: 'profesional_responsable', center: true },
                                                { label: 'Fecha Ingreso', col: 'fecha_ingreso' }
                                            ].map((h) => (
                                                <th
                                                    key={h.col}
                                                    onClick={() => handleSort(h.col)}
                                                    className={`p-4 cursor-pointer hover:bg-slate-800 transition-colors whitespace-nowrap ${h.center ? 'text-center' : ''}`}
                                                >
                                                    {h.label}
                                                </th>
                                            ))}
                                            <th className="p-4 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/30">
                                        {colaboradores.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="p-8 text-center text-slate-500">
                                                    No se encontraron colaboradores con los filtros aplicados.
                                                </td>
                                            </tr>
                                        ) : (
                                            colaboradores.map((row) => (
                                                <tr
                                                    key={row.identificacion}
                                                    className="hover:bg-slate-700/20 transition-colors group"
                                                >
                                                    <td className="p-4 font-mono text-sm text-slate-400">{row.identificacion || '-'}</td>
                                                    <td className="p-4">
                                                        <div
                                                            className="font-medium text-white"
                                                            title={row.colaborador}
                                                        >
                                                            {row.colaborador || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-slate-300">{row.alias || '-'}</td>
                                                    <td className="p-4 font-mono text-sm text-slate-400">{row.correo_colaborador || '-'}</td>
                                                    <td className="p-4 text-center"><BadgeBool val={row.autorizado} /></td>
                                                    <td className="p-4 text-center"><BadgeBool val={row.supervisor} /></td>
                                                    <td className="p-4 text-center"><BadgeBool val={row.operador_de_equipo} /></td>
                                                    <td className="p-4 text-center"><BadgeBool val={row.profesional_responsable} /></td>
                                                    <td className="p-4 text-sm text-slate-400">
                                                        {row.fecha_ingreso ? new Date(row.fecha_ingreso).toLocaleDateString('es-ES') : '-'}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <button
                                                            onClick={() => openModal(row)}
                                                            className="p-2 bg-slate-800 hover:bg-orange-500/20 text-slate-400 hover:text-orange-400 rounded-lg transition-all border border-slate-700 hover:border-orange-500/30"
                                                            title="Ver artículos"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="p-4 border-t border-slate-700/50 bg-slate-900/30 flex items-center justify-between">
                                <span className="text-sm text-slate-500">
                                    Mostrando {totalRows === 0 ? 0 : (page - 1) * pageSize + 1} – {Math.min(page * pageSize, totalRows)} de {totalRows}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm text-slate-400">
                                        Página {page} de {Math.ceil(totalRows / pageSize) || 1}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(Math.ceil(totalRows / pageSize), p + 1))}
                                        disabled={page >= Math.ceil(totalRows / pageSize)}
                                        className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            </main>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#0F172A] border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <Box className="w-6 h-6 text-orange-500" />
                                <div>
                                    <h3 className="font-bold text-white text-lg">Artículos del Colaborador</h3>
                                    <p className="text-sm text-slate-400">{selectedColaborador?.nombre} (ID: {selectedColaborador?.id})</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={exportModalExcel}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium"
                                >
                                    <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
                                </button>
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-auto p-6 bg-slate-900/30">
                            {modalLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-3"></div>
                                    <p>Cargando información...</p>
                                </div>
                            ) : articulos.length === 0 && !modalFilterTipo ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-700/50 rounded-xl">
                                    <Box className="w-12 h-12 text-slate-600 mb-3" />
                                    <p className="font-medium">No hay artículos registrados</p>
                                    <p className="text-sm text-slate-500">Este colaborador no tiene salidas registradas.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Modal Filters */}
                                    <div className="flex flex-wrap items-center gap-3 mb-4">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700 text-sm text-slate-300">
                                            <Filter className="w-3.5 h-3.5" />
                                            <span>Filtrar por tipo:</span>
                                        </div>
                                        <button
                                            onClick={() => filterModalArticulos('')}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!modalFilterTipo ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                        >
                                            Todos
                                        </button>
                                        {tiposSolicitudDisponibles.map(tipo => (
                                            <button
                                                key={tipo}
                                                onClick={() => filterModalArticulos(tipo)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${modalFilterTipo === tipo ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                            >
                                                {tipo}
                                            </button>
                                        ))}
                                        {modalFilterTipo && (
                                            <button
                                                onClick={() => filterModalArticulos('')}
                                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors ml-auto"
                                                title="Limpiar filtro"
                                            >
                                                <Eraser className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Modal Table */}
                                    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-slate-900/80 text-slate-300 border-b border-slate-700">
                                                    <th className="p-3 font-semibold">Fecha</th>
                                                    <th className="p-3 font-semibold">Tipo</th>
                                                    <th className="p-3 font-semibold">Cód. Artículo</th>
                                                    <th className="p-3 font-semibold">Descripción</th>
                                                    <th className="p-3 font-semibold text-center">Cant.</th>
                                                    <th className="p-3 font-semibold text-right">Precio Unit.</th>
                                                    <th className="p-3 font-semibold text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/50">
                                                {articulos.map((item, idx) => (
                                                    <tr key={`${item.id_salida}-${idx}`} className="hover:bg-slate-700/30 transition-colors">
                                                        <td className="p-3 text-slate-400 whitespace-nowrap">
                                                            {new Date(item.fecha_salida).toLocaleDateString('es-ES')}
                                                        </td>
                                                        <td className="p-3">
                                                            <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-300 text-xs border border-slate-600/50">
                                                                {item.tipo_solicitud}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 font-mono text-slate-400">{item.articulo}</td>
                                                        <td className="p-3 font-medium text-slate-200">{item.nombre_articulo}</td>
                                                        <td className="p-3 text-center text-slate-300">{item.cantidad}</td>
                                                        <td className="p-3 text-right text-slate-400">₡{item.precio_unitario.toLocaleString()}</td>
                                                        <td className="p-3 text-right font-medium text-emerald-400">₡{item.subtotal.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-slate-900/50 font-bold border-t border-slate-700">
                                                    <td colSpan={6} className="p-3 text-right text-slate-300">Total General:</td>
                                                    <td className="p-3 text-right text-emerald-400 text-base">
                                                        ₡{articulos.reduce((sum, item) => sum + item.subtotal, 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
