import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Users, Search, Eraser, Download, Eye,
    ChevronLeft, ChevronRight, X, FileSpreadsheet, Box,
    ShieldCheck, ClipboardCheck, HardHat, TrendingUp, Loader2
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

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
    const [searchParams] = useSearchParams();
    const initialColaborador = searchParams.get('colaborador') || '';
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
        colaborador: initialColaborador,
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
            link.setAttribute('download', `colaboradores_${new Date().toLocaleDateString('en-CA')}.csv`);
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
            let allSalidas: any[] = [];
            let hasMoreSalidas = true;
            let offsetSalidas = 0;
            const LIMIT = 1000;

            while (hasMoreSalidas) {
                const { data: batch, error } = await supabase
                    .from('salida_articulo_08')
                    .select('id_salida, fecha_salida, numero_solicitud, retira')
                    .eq('retira', colab.identificacion)
                    .order('fecha_salida', { ascending: false })
                    .range(offsetSalidas, offsetSalidas + LIMIT - 1);

                if (error) throw error;
                if (!batch || batch.length === 0) break;
                allSalidas.push(...batch);
                if (batch.length < LIMIT) break;
                offsetSalidas += LIMIT;
            }

            const salidas = allSalidas;

            let mergedArticulos: ArticuloSalida[] = [];

            if (salidas && salidas.length > 0) {
                const numerosSolicitud = [...new Set(salidas.map(s => s.numero_solicitud).filter(Boolean))];
                let tiposMap = new Map();
                if (numerosSolicitud.length > 0) {
                    // Batch .in() for solicitudes
                    const solBatchSize = 100;
                    for (let i = 0; i < numerosSolicitud.length; i += solBatchSize) {
                        const batchArr = numerosSolicitud.slice(i, i + solBatchSize);
                        const { data: solicitudes } = await supabase
                            .from('solicitud_17')
                            .select('numero_solicitud, tipo_solicitud')
                            .in('numero_solicitud', batchArr);
                        solicitudes?.forEach(s => tiposMap.set(s.numero_solicitud, s.tipo_solicitud));
                    }
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
                        const artBatchSize = 100;
                        for (let i = 0; i < codigosArticulo.length; i += artBatchSize) {
                            const batchArr = codigosArticulo.slice(i, i + artBatchSize);
                            const { data: arts } = await supabase
                                .from('articulo_01')
                                .select('codigo_articulo, nombre_articulo')
                                .in('codigo_articulo', batchArr);
                            arts?.forEach(a => articulosMap.set(a.codigo_articulo, a.nombre_articulo));
                        }
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
            let allBoletas: any[] = [];
            let hasMoreBoletas = true;
            let offsetBoletas = 0;

            while (hasMoreBoletas) {
                const { data: batch, error } = await supabase
                    .from('salida_activo_55')
                    .select('boleta_salida_activo, fecha_salida_activo, usuario_de_activo')
                    .eq('usuario_de_activo', colab.identificacion)
                    .order('fecha_salida_activo', { ascending: false })
                    .range(offsetBoletas, offsetBoletas + LIMIT - 1);

                if (error) throw error;
                if (!batch || batch.length === 0) break;
                allBoletas.push(...batch);
                if (batch.length < LIMIT) break;
                offsetBoletas += LIMIT;
            }

            const boletasActivo = allBoletas;

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
        const fecha = new Date().toLocaleDateString('en-CA');

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
        <div className="min-h-screen bg-[#000000] text-[#F5F5F7] font-sans relative">
            {/* Background Halos removed for strict compliance */}

            {/* Header Content */}
            <div className="max-w-7xl mx-auto px-1 pt-6 flex flex-col gap-8 relative z-10">
                <PageHeader
                    title="COLABORADORES"
                    icon={Users}
                    themeColor="amber"
                    backRoute="/gestion-interna"
                />

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {[
                        { label: 'Total Personal', value: metrics.total, icon: Users, color: 'text-[#F5F5F7]', bg: 'bg-[#121212]' },
                        { label: 'Autorizados', value: metrics.autorizados, icon: ShieldCheck, color: 'text-[#0071E3]', bg: 'bg-[#121212]' },
                        { label: 'Supervisores', value: metrics.supervisores, icon: ClipboardCheck, color: 'text-[#F5F5F7]', bg: 'bg-[#121212]' },
                        { label: 'Equipos/Oper.', value: metrics.operadores, icon: HardHat, color: 'text-[#F5F5F7]', bg: 'bg-[#121212]' },
                        { label: 'Prof. Resp.', value: metrics.profesionales, icon: ShieldCheck, color: 'text-[#F5F5F7]', bg: 'bg-[#121212]' }
                    ].map((m, i) => (
                        <div key={i} className={`${m.bg} border border-[#333333] rounded-[8px] p-6 flex items-center gap-4 group transition-all duration-300`}>
                            <div className={`w-12 h-12 rounded-[8px] bg-[#000000] flex items-center justify-center ${m.color}`}>
                                <m.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-[#86868B] uppercase tracking-widest leading-none mb-1.5">{m.label}</p>
                                <p className="text-2xl font-black text-[#F5F5F7] italic">{m.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <main className="relative z-10 max-w-7xl mx-auto p-6 space-y-6">
                {/* Filters Section */}
                <section className="relative group/filters">
                    <div className="relative bg-[#121212] border border-[#333333] rounded-[8px] overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-[#333333] bg-black/20">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tight italic uppercase">Filtros Avanzados</h2>
                                    <p className="text-[#86868B] text-[10px] font-black uppercase tracking-widest mt-1">Gestión y filtrado de la base de datos de personal.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleApplyFilters}
                                        className="h-12 px-8 bg-[#0071E3] text-white font-black rounded-[8px] hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-[#0071E3]/20 flex items-center gap-2 text-[10px] uppercase tracking-widest"
                                    >
                                        <Search className="w-4 h-4" />
                                        Aplicar Filtros
                                    </button>
                                    <button
                                        onClick={() => { clearFilters(); handleApplyFilters(); }}
                                        className="h-12 w-12 bg-transparent border border-[#333333] hover:bg-white/5 text-[#86868B] hover:text-white rounded-[8px] transition-all flex items-center justify-center"
                                        title="Limpiar filtros"
                                    >
                                        <Eraser className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={exportCSV}
                                        className="h-12 w-12 bg-transparent border border-[#333333] hover:bg-white/5 text-[#86868B] hover:text-[#0071E3] rounded-[8px] transition-all flex items-center justify-center"
                                        title="Exportar CSV"
                                    >
                                        <Download className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Text Filters */}
                            <div className="grid grid-cols-1 gap-8">
                                {[
                                    { label: 'Nombre del Colaborador', key: 'colaborador', placeholder: 'Ej: Juan Pérez', icon: Users }
                                ].map((field) => (
                                    <div key={field.key} className="space-y-3">
                                        <label className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] ml-1 block">
                                            {field.label}
                                        </label>
                                        <div className="relative group/input">
                                            <field.icon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#86868B] group-focus-within/input:text-[#0071E3] transition-colors" />
                                            <input
                                                value={filters[field.key as keyof typeof filters]}
                                                onChange={(e) => handleFilterChange(field.key, e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                                className="w-full bg-[#1D1D1F] border border-[#333333] rounded-[8px] h-14 pl-14 pr-6 text-white text-sm font-bold focus:outline-none focus:border-[#0071E3]/50 transition-all placeholder-[#424245] uppercase"
                                                placeholder={field.placeholder}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Boolean Selects & Page Size */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                {[
                                    { label: 'Autorizado', key: 'autorizado' },
                                    { label: 'Supervisor', key: 'supervisor' },
                                    { label: 'Operador', key: 'operador' },
                                    { label: 'Prof. Resp.', key: 'profesional' }
                                ].map((f) => (
                                    <div key={f.key} className="space-y-3">
                                        <label className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] ml-1 block">
                                            {f.label}
                                        </label>
                                        <select
                                            value={filters[f.key as keyof typeof filters]}
                                            onChange={(e) => handleFilterChange(f.key, e.target.value)}
                                            className="w-full h-14 bg-black border border-[#333333] rounded-[8px] px-5 text-white text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-[#0071E3]/50 transition-all appearance-none cursor-pointer hover:bg-black/30 [color-scheme:dark]"
                                        >
                                            <option value="">Todos</option>
                                            <option value="true">SÍ (Activo)</option>
                                            <option value="false">NO (Inactivo)</option>
                                        </select>
                                    </div>
                                ))}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] ml-1 block">
                                        Por página
                                    </label>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => setPageSize(Number(e.target.value))}
                                        className="w-full h-14 bg-black border border-[#333333] rounded-[8px] px-5 text-white text-[10px] font-black tracking-widest uppercase focus:outline-none focus:border-[#0071E3]/50 transition-all appearance-none cursor-pointer [color-scheme:dark]"
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
                    <div className="relative bg-[#121212] border border-[#333333] rounded-[8px] overflow-hidden shadow-2xl flex flex-col">
                        {loading ? (
                            <div className="p-24 flex flex-col items-center justify-center text-[#86868B]">
                                <Loader2 className="w-12 h-12 animate-spin text-[#0071E3] mb-6" />
                                <p className="font-black text-[10px] tracking-[0.2em] uppercase">Sincronizando Personal...</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse table-fixed">
                                        <thead className="sticky top-0 z-20 bg-[#121212]/90 apple-blur">
                                            <tr className="border-b border-white/5 text-gray-500 text-[9px] font-black uppercase tracking-wider">
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
                                                            <div className={`w-1 h-1 rounded-full bg-[#0071E3] transition-all ${sortCol === h.col ? 'opacity-100 scale-100' : 'opacity-0 scale-0 group-hover/th:opacity-50'}`}></div>
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
                                                        <td className="p-3 font-mono text-xs text-[#0071E3]/60 font-black">{row.identificacion || '-'}</td>
                                                        <td className="p-3">
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-bold text-[#F5F5F7] text-[13px] group-hover/row:text-[#0071E3] transition-colors duration-300 truncate" title={row.colaborador}>{row.colaborador || '-'}</span>
                                                                <span className="text-[10px] text-[#86868B] font-black uppercase tracking-tighter mt-0.5 truncate">{row.alias || ''}</span>
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
                                                                className="w-8 h-8 bg-transparent border border-[#333333] hover:bg-white/5 text-[#86868B] hover:text-[#F5F5F7] rounded-[8px] transition-all flex items-center justify-center mx-auto"
                                                                title="Ver historial"
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

                                {/* Pagination Container */}
                                <div className="p-8 border-t border-[#333333] bg-[#000000]/20 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-2 h-2 rounded-full bg-[#0071E3] animate-pulse"></div>
                                        <span className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em]">
                                            Mostrando {totalRows === 0 ? 0 : (page - 1) * pageSize + 1} – {Math.min(page * pageSize, totalRows)} de {totalRows}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="px-6 py-3 bg-transparent border border-[#F5F5F7] rounded-[8px] text-[#F5F5F7] hover:bg-[#F5F5F7]/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                                        >
                                            <ChevronLeft className="w-4 h-4" /> Anterior
                                        </button>
                                        <div className="px-6 py-3 bg-[#1D1D1F] rounded-[8px] border border-[#333333] text-[#0071E3] font-black text-xs">
                                            {page} / {Math.ceil(totalRows / pageSize) || 1}
                                        </div>
                                        <button
                                            onClick={() => setPage(p => Math.min(Math.ceil(totalRows / pageSize), p + 1))}
                                            disabled={page >= Math.ceil(totalRows / pageSize)}
                                            className="px-6 py-3 bg-transparent border border-[#F5F5F7] rounded-[8px] text-[#F5F5F7] hover:bg-[#F5F5F7]/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 apple-blur animate-in fade-in duration-300">
                    <div className="absolute inset-0 z-[-1]" onClick={() => setModalOpen(false)}></div>
                    <div className="relative bg-[#121212] border border-[#333333] rounded-[8px] w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-8 border-b border-[#333333] bg-black/20 gap-4">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-[8px] bg-black/40 flex items-center justify-center text-[#0071E3]">
                                    <Box className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-[#F5F5F7] tracking-tight italic uppercase leading-none">Historial de Artículos</h3>
                                    <p className="text-[10px] font-black text-[#86868B] mt-2 uppercase tracking-widest">{selectedColaborador?.nombre} • <span className="text-[#0071E3]">{selectedColaborador?.id}</span></p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <button
                                    onClick={exportModalExcel}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0071E3] text-white font-black rounded-[8px] hover:brightness-110 active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                                >
                                    <FileSpreadsheet className="w-4 h-4" /> EXCEL
                                </button>
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="p-3 bg-transparent border border-[#F5F5F7]/30 text-[#86868B] hover:text-[#F5F5F7] rounded-[8px] transition-all hover:bg-white/5"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-auto p-8 bg-[#121212]">
                            {modalLoading ? (
                                <div className="flex flex-col items-center justify-center py-24 text-[#86868B]">
                                    <Loader2 className="w-12 h-12 animate-spin text-[#0071E3] mb-6" />
                                    <p className="font-black text-[10px] uppercase tracking-widest">Sincronizando Inventario...</p>
                                </div>
                            ) : articulos.length === 0 && !modalFilterTipo ? (
                                <div className="flex flex-col items-center justify-center py-24 text-[#86868B] border border-dashed border-[#333333] rounded-[8px] bg-black/20">
                                    <Box className="w-16 h-16 opacity-20 mb-6 text-[#86868B]" />
                                    <p className="text-xl font-black text-[#F5F5F7] italic uppercase">Sin Salidas Registradas</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest mt-2">Este colaborador aún no ha retirado artículos.</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {/* Summary & Filters */}
                                    <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <button
                                                onClick={() => filterModalArticulos('')}
                                                className={`px-4 py-2 rounded-[8px] text-[10px] font-black uppercase tracking-widest transition-all ${!modalFilterTipo ? 'bg-[#0071E3] text-white' : 'bg-[#1D1D1F] border border-[#333333] text-[#86868B] hover:text-[#F5F5F7] hover:bg-white/5'}`}
                                            >
                                                Todos
                                            </button>
                                            {tiposSolicitudDisponibles.map(tipo => (
                                                <button
                                                    key={tipo}
                                                    onClick={() => filterModalArticulos(tipo)}
                                                    className={`px-4 py-2 rounded-[8px] text-[10px] font-black uppercase tracking-widest transition-all ${modalFilterTipo === tipo ? 'bg-[#0071E3] text-white' : 'bg-[#1D1D1F] border border-[#333333] text-[#86868B] hover:text-[#F5F5F7] hover:bg-white/5'}`}
                                                >
                                                    {tipo}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="p-4 px-6 bg-[#1D1D1F] border border-[#333333] rounded-[8px] flex items-center gap-8">
                                            <div>
                                                <p className="text-[9px] font-black text-[#86868B] uppercase tracking-widest leading-none mb-1">Items Totales</p>
                                                <p className="text-xl font-black text-[#F5F5F7] italic leading-none">{articulos.length}</p>
                                            </div>
                                            <div className="w-px h-8 bg-[#333333]"></div>
                                            <div>
                                                <p className="text-[9px] font-black text-[#86868B] uppercase tracking-widest leading-none mb-1">Inversión Total</p>
                                                <p className="text-xl font-black text-[#0071E3] italic leading-none">₡{articulos.reduce((sum, item) => sum + item.subtotal, 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Results Table */}
                                    <div className="relative overflow-x-auto border border-[#333333] rounded-[8px] shadow-xl overflow-hidden bg-black/20">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-[#333333] text-[#86868B] text-[9px] font-black uppercase tracking-widest">
                                                    <th className="p-4">Fecha</th>
                                                    <th className="p-4">Categoría</th>
                                                    <th className="p-4">ID</th>
                                                    <th className="p-4">Descripción del Artículo</th>
                                                    <th className="p-4 text-center">Cant.</th>
                                                    <th className="p-4 text-right">Unitario</th>
                                                    <th className="p-4 text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#333333]/30">
                                                {articulos.map((item, idx) => (
                                                    <tr key={`${item.id_salida}-${idx}`} className="hover:bg-white/[0.04] transition-colors group/modal-row animate-in fade-in slide-in-from-top-1 duration-300">
                                                        <td className="p-4 text-[#86868B] font-bold whitespace-nowrap text-xs">
                                                            {new Date(item.fecha_salida).toLocaleDateString('es-ES')}
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="inline-flex px-2 py-1 rounded-[4px] bg-[#1D1D1F] text-[#86868B] text-[9px] font-black uppercase border border-[#333333]">
                                                                {item.tipo_solicitud}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 font-mono text-xs text-[#0071E3]/50 font-black tracking-tight">{item.articulo}</td>
                                                        <td className="p-4 font-black text-[#F5F5F7] group-hover/modal-row:text-[#0071E3] transition-colors text-xs uppercase italic">{item.nombre_articulo}</td>
                                                        <td className="p-4 text-center font-black text-[#F5F5F7]">
                                                            <span className="px-2 py-1 bg-[#1D1D1F] border border-[#333333] rounded-[4px] min-w-[30px] inline-block text-[10px] italic">{item.cantidad}</span>
                                                        </td>
                                                        <td className="p-4 text-right text-[#86868B] font-bold tracking-tighter text-xs">₡{item.precio_unitario.toLocaleString()}</td>
                                                        <td className="p-4 text-right font-black text-[#0071E3] text-xs italic">₡{item.subtotal.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
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
