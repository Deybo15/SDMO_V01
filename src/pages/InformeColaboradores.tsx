import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    Users, Search, Eraser, Download, Eye,
    ChevronLeft, ChevronRight, X, FileSpreadsheet, Box,
    ShieldCheck, ClipboardCheck, HardHat, TrendingUp
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

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
    const [metrics, setMetrics] = useState({
        total: 0,
        autorizados: 0,
        supervisores: 0,
        operadores: 0,
        profesionales: 0
    });

    const cargarMetrics = async () => {
        try {
            const { data, error } = await supabase
                .from('colaboradores_06')
                .select('autorizado, supervisor, operador_de_equipo, profesional_responsable');

            if (error) throw error;

            if (data) {
                setMetrics({
                    total: data.length,
                    autorizados: data.filter(c => c.autorizado).length,
                    supervisores: data.filter(c => c.supervisor).length,
                    operadores: data.filter(c => c.operador_de_equipo).length,
                    profesionales: data.filter(c => c.profesional_responsable).length
                });
            }
        } catch (error) {
            console.error('Error loading metrics:', error);
        }
    };

    useEffect(() => {
        cargarMetrics();
    }, []);

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

            const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
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
            // -- PART 1: Standard Article Requests (Consumables) --
            const { data: salidas } = await supabase
                .from('salida_articulo_08')
                .select('id_salida, fecha_salida, numero_solicitud, retira')
                .eq('retira', colab.identificacion)
                .order('fecha_salida', { ascending: false });

            let mergedArticulos: ArticuloSalida[] = [];

            if (salidas && salidas.length > 0) {
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

                if (detalles && detalles.length > 0) {
                    const codigosArticulo = [...new Set(detalles.map(d => d.articulo))];
                    let articulosMap = new Map();
                    if (codigosArticulo.length > 0) {
                        const { data: arts } = await supabase
                            .from('articulo_01')
                            .select('codigo_articulo, nombre_articulo')
                            .in('codigo_articulo', codigosArticulo);
                        arts?.forEach(a => articulosMap.set(a.codigo_articulo, a.nombre_articulo));
                    }

                    const merged = detalles.map(d => {
                        const salida = salidas.find(s => s.id_salida === d.id_salida);
                        const tipo = tiposMap.get(salida?.numero_solicitud) || 'Sin tipo';
                        const nombreArt = articulosMap.get(d.articulo) || 'Artículo no encontrado';

                        return {
                            id_salida: d.id_salida,
                            fecha_salida: salida?.fecha_salida || '',
                            tipo_solicitud: tipo,
                            articulo: d.articulo.toString(),
                            nombre_articulo: nombreArt,
                            cantidad: d.cantidad,
                            precio_unitario: d.precio_unitario,
                            subtotal: d.subtotal
                        };
                    });
                    mergedArticulos = [...mergedArticulos, ...merged];
                }
            }

            // -- PART 2: Asset Assignments (activos_50) --
            const { data: boletasActivo } = await supabase
                .from('salida_activo_55')
                .select('boleta_salida_activo, fecha_salida_activo, usuario_de_activo')
                .eq('usuario_de_activo', colab.identificacion)
                .order('fecha_salida_activo', { ascending: false });

            if (boletasActivo && boletasActivo.length > 0) {
                const idsBoleta = boletasActivo.map(b => b.boleta_salida_activo);
                const { data: detallesActivo } = await supabase
                    .from('dato_salida_activo_56')
                    .select('boleta_salida_activo, numero_activo, cantidad')
                    .in('boleta_salida_activo', idsBoleta);

                if (detallesActivo && detallesActivo.length > 0) {
                    const numsActivo = [...new Set(detallesActivo.map(d => d.numero_activo))];
                    let activosMap = new Map();
                    if (numsActivo.length > 0) {
                        const { data: infoActivos } = await supabase
                            .from('activos_50')
                            .select('numero_activo, nombre_corto_activo, valor_activo')
                            .in('numero_activo', numsActivo);
                        infoActivos?.forEach(a => activosMap.set(a.numero_activo, a));
                    }

                    const mergedActivos = detallesActivo.map(d => {
                        const boleta = boletasActivo.find(b => b.boleta_salida_activo === d.boleta_salida_activo);
                        const info = activosMap.get(d.numero_activo);

                        // Robust parsing for valor_activo (handles both '.' and ',' as decimals)
                        const rawValor = info?.valor_activo?.toString().trim() || '0';
                        const lastComma = rawValor.lastIndexOf(',');
                        const lastDot = rawValor.lastIndexOf('.');
                        let parsedValor = 0;

                        if (lastComma > lastDot) {
                            // Comma is likely the decimal separator
                            parsedValor = parseFloat(rawValor.replace(/\./g, '').replace(',', '.')) || 0;
                        } else {
                            // Dot (or nothing) is the decimal separator
                            parsedValor = parseFloat(rawValor.replace(/,/g, '')) || 0;
                        }

                        return {
                            id_salida: d.boleta_salida_activo,
                            fecha_salida: boleta?.fecha_salida_activo || '',
                            tipo_solicitud: 'ACTIVO',
                            articulo: d.numero_activo.toString(),
                            nombre_articulo: info?.nombre_corto_activo || 'Activo no encontrado',
                            cantidad: d.cantidad,
                            precio_unitario: parsedValor,
                            subtotal: parsedValor * d.cantidad
                        };
                    });
                    mergedArticulos = [...mergedArticulos, ...mergedActivos];
                }
            }

            // -- PART 3: Final Merge and Sorting --
            const finalMerged = mergedArticulos.sort((a, b) =>
                new Date(b.fecha_salida).getTime() - new Date(a.fecha_salida).getTime()
            );

            setArticulos(finalMerged);
            setArticulosOriginal(finalMerged);

            const types = [...new Set(finalMerged.map(m => m.tipo_solicitud))].sort();
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
        <meta charset="utf-8">
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

        const blob = new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `articulos_${nombre}_${fecha}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const BadgeBool = ({ val }: { val: boolean }) => {
        if (val === true) {
            return (
                <div className="flex justify-center">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                </div>
            );
        }
        return (
            <div className="flex justify-center opacity-10">
                <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans relative">
            {/* Background Halos */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[85%] left-[20%] w-[80rem] h-[80rem] bg-orange-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
                <div className="absolute top-[15%] right-[20%] w-[80rem] h-[80rem] bg-blue-500/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>
            </div>

            {/* Header Content */}
            <div className="max-w-7xl mx-auto px-1 pt-6 flex flex-col gap-8 relative z-10">
                <PageHeader
                    title="COLABORADORES"
                    icon={Users}
                    themeColor="amber"
                    backRoute="/gestion-interna"
                />

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[
                        { label: 'Total Personal', value: metrics.total, icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        { label: 'Autorizados', value: metrics.autorizados, icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { label: 'Supervisores', value: metrics.supervisores, icon: ClipboardCheck, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        { label: 'Equipos/Oper.', value: metrics.operadores, icon: HardHat, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                        { label: 'Prof. Resp.', value: metrics.profesionales, icon: ShieldCheck, color: 'text-rose-400', bg: 'bg-rose-500/10' }
                    ].map((m, i) => (
                        <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 flex items-center gap-3 group hover:bg-white/[0.08] transition-all duration-300">
                            <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center ${m.color} group-hover:scale-110 transition-transform`}>
                                <m.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">{m.label}</p>
                                <p className="text-xl font-black text-white mt-1">{m.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <main className="relative z-10 max-w-7xl mx-auto p-6 space-y-6">
                {/* Filters Section */}
                <section className="relative group/filters">
                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-[2.5rem] blur opacity-25 group-hover/filters:opacity-40 transition duration-1000"></div>
                    <div className="relative bg-[#1E293B]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tight">Filtros Avanzados</h2>
                                    <p className="text-gray-400 text-sm mt-1">Refina la búsqueda por nombre, alias o perfiles específicos.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleApplyFilters}
                                        className="px-6 py-3 bg-amber-500 text-black font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-2"
                                    >
                                        <Search className="w-5 h-5" />
                                        APLICAR FILTROS
                                    </button>
                                    <button
                                        onClick={() => { clearFilters(); handleApplyFilters(); }}
                                        className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl transition-all border border-white/10"
                                        title="Limpiar filtros"
                                    >
                                        <Eraser className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={exportCSV}
                                        className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl transition-all border border-emerald-500/20"
                                        title="Exportar CSV"
                                    >
                                        <Download className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Text Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    { label: 'Nombre del Colaborador', key: 'colaborador', placeholder: 'Ej: Juan Pérez', icon: Users },
                                    { label: 'Alias / Apodo', key: 'alias', placeholder: 'Ej: JPerez', icon: TrendingUp },
                                    { label: 'Correo Electrónico', key: 'correo', placeholder: '@msj.go.cr', icon: TrendingUp }
                                ].map((field) => (
                                    <div key={field.key} className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-2">
                                            {field.label}
                                        </label>
                                        <div className="relative group/input">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within/input:text-amber-500 transition-colors">
                                                <field.icon className="w-5 h-5" />
                                            </div>
                                            <input
                                                value={filters[field.key as keyof typeof filters]}
                                                onChange={(e) => handleFilterChange(field.key, e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                                className="w-full bg-black/20 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/10 transition-all placeholder:text-gray-600"
                                                placeholder={field.placeholder}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Boolean Selects & Page Size */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {[
                                    { label: 'Autorizado', key: 'autorizado', icon: ShieldCheck },
                                    { label: 'Supervisor', key: 'supervisor', icon: ClipboardCheck },
                                    { label: 'Operador', key: 'operador', icon: HardHat },
                                    { label: 'Prof. Resp.', key: 'profesional', icon: ShieldCheck }
                                ].map((f) => (
                                    <div key={f.key} className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-2">
                                            {f.label}
                                        </label>
                                        <select
                                            value={filters[f.key as keyof typeof filters]}
                                            onChange={(e) => handleFilterChange(f.key, e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-2xl py-4 px-4 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all appearance-none cursor-pointer hover:bg-black/30"
                                        >
                                            <option value="">Todos</option>
                                            <option value="true">SÍ (Activo)</option>
                                            <option value="false">NO (Inactivo)</option>
                                        </select>
                                    </div>
                                ))}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-2">
                                        Por página
                                    </label>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => setPageSize(Number(e.target.value))}
                                        className="w-full bg-black/20 border border-white/10 rounded-2xl py-4 px-4 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all appearance-none cursor-pointer"
                                    >
                                        {[10, 25, 50, 100].map(v => (
                                            <option key={v} value={v}>{v} Resultados</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Table Section */}
                <section className="relative group/table">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-[2.5rem] blur opacity-25 group-hover/table:opacity-40 transition duration-1000"></div>
                    <div className="relative bg-[#1E293B]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
                        {loading ? (
                            <div className="p-24 flex flex-col items-center justify-center text-gray-500">
                                <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-6"></div>
                                <p className="font-black text-sm tracking-[0.2em] uppercase">Sincronizando Personal...</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-white/[0.02] border-b border-white/5 text-gray-500 text-[9px] font-black uppercase tracking-wider">
                                                {[
                                                    { label: 'Identificación', col: 'identificacion', w: 'w-[140px]' },
                                                    { label: 'Colaborador', col: 'colaborador', w: 'w-auto' },
                                                    { label: 'Autorizado', col: 'autorizado', center: true, w: 'w-[100px]' },
                                                    { label: 'Supervisor', col: 'supervisor', center: true, w: 'w-[100px]' },
                                                    { label: 'Operador', col: 'operador_de_equipo', center: true, w: 'w-[100px]' },
                                                    { label: 'Prof. Resp.', col: 'profesional_responsable', center: true, w: 'w-[100px]' },
                                                    { label: 'Ingreso', col: 'fecha_ingreso', w: 'w-[120px]', hide: 'hidden md:table-cell' }
                                                ].map((h) => (
                                                    <th
                                                        key={h.col}
                                                        onClick={() => handleSort(h.col)}
                                                        className={`p-3 cursor-pointer hover:bg-white/5 transition-colors group/th ${h.center ? 'text-center' : ''} ${h.w} ${h.hide || ''}`}
                                                    >
                                                        <div className={`flex items-center gap-1 ${h.center ? 'justify-center' : ''}`}>
                                                            <span className="truncate">{h.label}</span>
                                                            <div className={`w-1 h-1 rounded-full bg-amber-500 transition-all ${sortCol === h.col ? 'opacity-100 scale-100' : 'opacity-0 scale-0 group-hover/th:opacity-50'}`}></div>
                                                        </div>
                                                    </th>
                                                ))}
                                                <th className="p-3 text-center w-[60px]">Acc.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.03]">
                                            {colaboradores.length === 0 ? (
                                                <tr>
                                                    <td colSpan={10} className="p-24 text-center">
                                                        <Users className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-20" />
                                                        <p className="text-gray-500 font-bold tracking-tight">No se encontraron registros activos</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                colaboradores.map((row, idx) => (
                                                    <tr
                                                        key={row.identificacion}
                                                        className="hover:bg-white/[0.04] transition-all duration-300 group/row animate-in fade-in slide-in-from-left-4 duration-500"
                                                        style={{ animationDelay: `${idx * 30}ms` }}
                                                    >
                                                        <td className="p-3 font-mono text-xs text-amber-500/60 font-black">{row.identificacion || '-'}</td>
                                                        <td className="p-3">
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-bold text-white text-[13px] group-hover/row:text-amber-400 transition-colors duration-300 truncate" title={row.colaborador}>{row.colaborador || '-'}</span>
                                                                <span className="text-[10px] text-gray-500 font-black uppercase tracking-tighter mt-0.5 truncate">{row.alias || ''}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3"><BadgeBool val={row.autorizado} /></td>
                                                        <td className="p-3"><BadgeBool val={row.supervisor} /></td>
                                                        <td className="p-3"><BadgeBool val={row.operador_de_equipo} /></td>
                                                        <td className="p-3"><BadgeBool val={row.profesional_responsable} /></td>
                                                        <td className="p-3 text-[9px] text-gray-400 font-bold whitespace-nowrap hidden lg:table-cell">
                                                            {row.fecha_ingreso ? new Date(row.fecha_ingreso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '-'}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <button
                                                                onClick={() => openModal(row)}
                                                                className="w-7 h-7 bg-white/5 hover:bg-amber-500 text-gray-400 hover:text-black rounded-lg transition-all duration-300 border border-white/10 hover:border-amber-500 flex items-center justify-center mx-auto"
                                                                title="Ver historial"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Container */}
                                <div className="p-8 border-t border-white/5 bg-black/20 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                        <span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
                                            Mostrando {totalRows === 0 ? 0 : (page - 1) * pageSize + 1} – {Math.min(page * pageSize, totalRows)} de {totalRows}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all font-black text-xs uppercase tracking-widest flex items-center gap-2"
                                        >
                                            <ChevronLeft className="w-4 h-4" /> Anterior
                                        </button>
                                        <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/10 text-amber-500 font-black text-xs">
                                            {page} / {Math.ceil(totalRows / pageSize) || 1}
                                        </div>
                                        <button
                                            onClick={() => setPage(p => Math.min(Math.ceil(totalRows / pageSize), p + 1))}
                                            disabled={page >= Math.ceil(totalRows / pageSize)}
                                            className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all font-black text-xs uppercase tracking-widest flex items-center gap-2"
                                        >
                                            Siguiente <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </section>
            </main>

            {/* Modal: Artículos del Colaborador */}
            {modalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="absolute inset-0 z-[-1]" onClick={() => setModalOpen(false)}></div>
                    <div className="relative bg-[#0F172A] border border-white/10 rounded-[2.5rem] w-full max-w-6xl max-h-[90vh] flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-8 border-b border-white/5 bg-white/[0.02] gap-4">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                    <Box className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white tracking-tight">Historial de Artículos</h3>
                                    <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest">{selectedColaborador?.nombre} • <span className="text-amber-500/70">{selectedColaborador?.id}</span></p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <button
                                    onClick={exportModalExcel}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-black font-black rounded-xl hover:scale-105 active:scale-95 transition-all text-xs uppercase"
                                >
                                    <FileSpreadsheet className="w-4 h-4" /> EXCEL
                                </button>
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all border border-white/10"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-auto p-8 bg-[#0F172A]">
                            {modalLoading ? (
                                <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                                    <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-6"></div>
                                    <p className="font-black text-sm uppercase tracking-widest">Consultando Inventario...</p>
                                </div>
                            ) : articulos.length === 0 && !modalFilterTipo ? (
                                <div className="flex flex-col items-center justify-center py-24 text-gray-600 border-2 border-dashed border-white/5 rounded-[2rem] bg-white/[0.01]">
                                    <Box className="w-16 h-16 opacity-20 mb-6" />
                                    <p className="text-xl font-black text-gray-500">Sin Salidas Registradas</p>
                                    <p className="text-sm font-medium mt-1">Este colaborador aún no ha retirado artículos.</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {/* Summary & Filters */}
                                    <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <button
                                                onClick={() => filterModalArticulos('')}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!modalFilterTipo ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                            >
                                                Todos
                                            </button>
                                            {tiposSolicitudDisponibles.map(tipo => (
                                                <button
                                                    key={tipo}
                                                    onClick={() => filterModalArticulos(tipo)}
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${modalFilterTipo === tipo ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                                >
                                                    {tipo}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="p-4 px-6 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center gap-8">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Items Totales</p>
                                                <p className="text-xl font-black text-white">{articulos.length}</p>
                                            </div>
                                            <div className="w-px h-8 bg-white/5"></div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Inversión Total</p>
                                                <p className="text-xl font-black text-emerald-400">₡{articulos.reduce((sum, item) => sum + item.subtotal, 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Results Table */}
                                    <div className="relative group/modal-table">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-2xl blur opacity-25"></div>
                                        <div className="relative overflow-x-auto border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                                            <table className="w-full text-left border-collapse text-sm">
                                                <thead>
                                                    <tr className="bg-white/[0.02] border-b border-white/5 text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                                        <th className="p-4">Fecha</th>
                                                        <th className="p-4">Categoría</th>
                                                        <th className="p-4">ID</th>
                                                        <th className="p-4">Descripción del Artículo</th>
                                                        <th className="p-4 text-center">Cant.</th>
                                                        <th className="p-4 text-right">Unitario</th>
                                                        <th className="p-4 text-right">Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/[0.03]">
                                                    {articulos.map((item, idx) => (
                                                        <tr key={`${item.id_salida}-${idx}`} className="hover:bg-white/[0.02] transition-colors group/modal-row animate-in fade-in slide-in-from-top-1 duration-300">
                                                            <td className="p-4 text-gray-400 font-bold whitespace-nowrap">
                                                                {new Date(item.fecha_salida).toLocaleDateString('es-ES')}
                                                            </td>
                                                            <td className="p-4">
                                                                <span className="inline-flex px-2 py-1 rounded-lg bg-white/5 text-gray-300 text-[10px] font-black uppercase border border-white/5">
                                                                    {item.tipo_solicitud}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 font-mono text-xs text-amber-500/50 font-black tracking-tight">{item.articulo}</td>
                                                            <td className="p-4 font-black text-gray-200 group-hover/modal-row:text-white transition-colors">{item.nombre_articulo}</td>
                                                            <td className="p-4 text-center font-black text-gray-300">
                                                                <span className="px-2 py-1 bg-white/5 rounded-md min-w-[30px] inline-block">{item.cantidad}</span>
                                                            </td>
                                                            <td className="p-4 text-right text-gray-500 font-bold tracking-tighter">₡{item.precio_unitario.toLocaleString()}</td>
                                                            <td className="p-4 text-right font-black text-emerald-400">₡{item.subtotal.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
