import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Database,
    Eye,
    FilePlus2,
    Filter,
    History,
    PencilLine,
    Search,
    ShieldCheck,
    Trash2,
    UserRound,
    X
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { cn } from '../lib/utils';

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

interface AuditLog {
    id: string;
    table_name: string;
    record_id: string;
    action: AuditAction;
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    changed_by: string | null;
    created_at: string;
}

interface AuditStats {
    total: number;
    inserts: number;
    updates: number;
    deletes: number;
    last24Hours: number;
}

const ITEMS_PER_PAGE = 15;

const ACTION_LABELS: Record<AuditAction, string> = {
    INSERT: 'Creación',
    UPDATE: 'Actualización',
    DELETE: 'Eliminación'
};

const ACTION_STYLES: Record<AuditAction, string> = {
    INSERT: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    UPDATE: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    DELETE: 'border-rose-500/30 bg-rose-500/10 text-rose-300'
};

const humanizeField = (field: string) => field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 'Sin dato';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const getChangedFields = (log: AuditLog) => {
    const before = log.old_data || {};
    const after = log.new_data || {};
    const keys = log.action === 'UPDATE'
        ? Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
            .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
        : Object.keys(log.action === 'DELETE' ? before : after);

    return keys.map((key) => ({
        key,
        before: before[key],
        after: after[key]
    }));
};

const getActivityDetail = (log: AuditLog) => {
    const fields = getChangedFields(log);
    if (log.action === 'INSERT') return `Nuevo registro creado con ${fields.length} campos almacenados`;
    if (log.action === 'UPDATE') return `${fields.length} campo${fields.length === 1 ? '' : 's'} modificado${fields.length === 1 ? '' : 's'}`;
    return `Registro eliminado con ${fields.length} campos conservados en auditoría`;
};

const shortUserId = (userId: string | null) => userId
    ? `${userId.slice(0, 8)}…${userId.slice(-4)}`
    : 'Sistema';

export default function AuditHistory() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [stats, setStats] = useState<AuditStats>({ total: 0, inserts: 0, updates: 0, deletes: 0, last24Hours: 0 });
    const [tableOptions, setTableOptions] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState<'ALL' | AuditAction>('ALL');
    const [tableFilter, setTableFilter] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const hasFilters = Boolean(searchTerm || actionFilter !== 'ALL' || tableFilter !== 'ALL' || dateFrom || dateTo);

    const fetchSummary = useCallback(async () => {
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const countQuery = (action?: AuditAction) => {
            let query = supabase.from('audit_logs').select('id', { count: 'exact', head: true });
            if (action) query = query.eq('action', action);
            return query;
        };

        const [totalResult, insertResult, updateResult, deleteResult, recentResult, tablesResult] = await Promise.all([
            countQuery(),
            countQuery('INSERT'),
            countQuery('UPDATE'),
            countQuery('DELETE'),
            supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', last24Hours),
            supabase.from('audit_logs').select('table_name').order('table_name').limit(5000)
        ]);

        setStats({
            total: totalResult.count || 0,
            inserts: insertResult.count || 0,
            updates: updateResult.count || 0,
            deletes: deleteResult.count || 0,
            last24Hours: recentResult.count || 0
        });

        if (tablesResult.data) {
            setTableOptions(Array.from(new Set(tablesResult.data.map((row) => row.table_name))).sort());
        }
    }, []);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setLoadError('');

        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE - 1;
        let query = supabase
            .from('audit_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(start, end);

        if (actionFilter !== 'ALL') query = query.eq('action', actionFilter);
        if (tableFilter !== 'ALL') query = query.eq('table_name', tableFilter);
        if (searchTerm.trim()) query = query.ilike('record_id', `%${searchTerm.trim()}%`);
        if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00-06:00`);
        if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999-06:00`);

        const { data, count, error } = await query;
        if (error) {
            console.error('Audit Load Error:', error);
            setLoadError('No fue posible recuperar el historial de auditoría.');
            setLogs([]);
            setTotalItems(0);
        } else {
            setLogs((data || []) as AuditLog[]);
            setTotalItems(count || 0);
        }
        setLoading(false);
    }, [actionFilter, currentPage, dateFrom, dateTo, searchTerm, tableFilter]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    useEffect(() => {
        const timer = window.setTimeout(fetchLogs, searchTerm ? 350 : 0);
        return () => window.clearTimeout(timer);
    }, [fetchLogs, searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [actionFilter, dateFrom, dateTo, searchTerm, tableFilter]);

    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    const visibleRange = useMemo(() => {
        if (!totalItems) return '0 registros';
        const start = (currentPage - 1) * ITEMS_PER_PAGE + 1;
        const end = Math.min(start + logs.length - 1, totalItems);
        return `${start}–${end} de ${totalItems}`;
    }, [currentPage, logs.length, totalItems]);

    const clearFilters = () => {
        setSearchTerm('');
        setActionFilter('ALL');
        setTableFilter('ALL');
        setDateFrom('');
        setDateTo('');
    };

    const summaryCards = [
        { label: 'Registros totales', value: stats.total, icon: Database },
        { label: 'Creaciones', value: stats.inserts, icon: FilePlus2 },
        { label: 'Actualizaciones', value: stats.updates, icon: PencilLine },
        { label: 'Eliminaciones', value: stats.deletes, icon: Trash2 },
        { label: 'Últimas 24 horas', value: stats.last24Hours, icon: Clock3 }
    ];

    return (
        <div className="min-h-screen bg-black text-white">
            <PageHeader
                title="Historial de Auditoría"
                icon={History}
                themeColor="neutral"
                subtitle="Trazabilidad y control de las operaciones realizadas en el sistema."
                backRoute="/gestion-interna"
            />

            <main className="max-w-[1600px] mx-auto px-4 md:px-8 pb-24 space-y-5">
                <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {summaryCards.map(({ label, value, icon: Icon }) => (
                        <Card key={label} className="p-4 md:p-5 border-[#27272a]">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">{label}</p>
                                    <p className="text-2xl font-semibold text-white mt-2 tabular-nums">{value.toLocaleString('es-CR')}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg border border-[#3f3f46] bg-[#0a0a0a] flex items-center justify-center shrink-0">
                                    <Icon className="w-4 h-4 text-[#d4d4d8]" />
                                </div>
                            </div>
                        </Card>
                    ))}
                </section>

                <Card className="p-4 md:p-5 border-[#27272a]">
                    <div className="flex flex-col xl:flex-row xl:items-end gap-4">
                        <div className="flex-1 min-w-0">
                            <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] mb-2">Buscar identificador</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" />
                                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Número de solicitud, activo o registro…" className="w-full h-12 rounded-lg border border-[#3f3f46] bg-[#111112] pl-11 pr-4 text-sm text-white outline-none focus:border-[#71717a] placeholder:text-[#52525b]" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-[180px_220px_160px_160px] gap-3">
                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] mb-2">Operación</label>
                                <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value as 'ALL' | AuditAction)} className="w-full h-12 rounded-lg border border-[#3f3f46] bg-[#111112] px-4 text-sm text-[#d4d4d8] outline-none focus:border-[#71717a]">
                                    <option value="ALL">Todas</option>
                                    <option value="INSERT">Creaciones</option>
                                    <option value="UPDATE">Actualizaciones</option>
                                    <option value="DELETE">Eliminaciones</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] mb-2">Módulo / tabla</label>
                                <select value={tableFilter} onChange={(event) => setTableFilter(event.target.value)} className="w-full h-12 rounded-lg border border-[#3f3f46] bg-[#111112] px-4 text-sm text-[#d4d4d8] outline-none focus:border-[#71717a]">
                                    <option value="ALL">Todos los módulos</option>
                                    {tableOptions.map((table) => <option key={table} value={table}>{table}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] mb-2">Desde</label>
                                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full h-12 rounded-lg border border-[#3f3f46] bg-[#111112] px-4 text-sm text-[#d4d4d8] outline-none focus:border-[#71717a] [color-scheme:dark]" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] mb-2">Hasta</label>
                                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full h-12 rounded-lg border border-[#3f3f46] bg-[#111112] px-4 text-sm text-[#d4d4d8] outline-none focus:border-[#71717a] [color-scheme:dark]" />
                            </div>
                        </div>

                        {hasFilters && (
                            <button type="button" onClick={clearFilters} className="h-12 px-4 rounded-lg border border-[#3f3f46] text-sm text-[#a1a1aa] hover:text-white hover:border-[#71717a] transition-colors flex items-center justify-center gap-2 shrink-0">
                                <X className="w-4 h-4" /> Limpiar
                            </button>
                        )}
                    </div>
                </Card>

                <Card className="overflow-hidden border-[#27272a] shadow-2xl shadow-black/30">
                    <div className="px-5 py-4 border-b border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg border border-[#3f3f46] flex items-center justify-center"><Filter className="w-4 h-4 text-[#d4d4d8]" /></div>
                            <div>
                                <h2 className="font-semibold text-white">Actividad registrada</h2>
                                <p className="text-xs text-[#71717a] mt-0.5">{hasFilters ? 'Resultados de los filtros aplicados' : 'Eventos ordenados del más reciente al más antiguo'}</p>
                            </div>
                        </div>
                        <span className="text-xs text-[#a1a1aa] tabular-nums">{visibleRange}</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1040px] text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[#27272a] bg-[#0a0a0a] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">
                                    <th className="px-5 py-4 w-44">Fecha y hora</th>
                                    <th className="px-5 py-4 w-40">Operación</th>
                                    <th className="px-5 py-4 w-48">Módulo / tabla</th>
                                    <th className="px-5 py-4 w-48">Identificador</th>
                                    <th className="px-5 py-4">Actividad</th>
                                    <th className="px-5 py-4 w-44">Responsable</th>
                                    <th className="px-5 py-4 w-20 text-right">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#27272a]">
                                {loading ? (
                                    Array.from({ length: 7 }).map((_, index) => (
                                        <tr key={index} className="animate-pulse">
                                            <td colSpan={7} className="px-5 py-5"><div className="h-10 bg-[#18181b] rounded-lg" /></td>
                                        </tr>
                                    ))
                                ) : loadError ? (
                                    <tr><td colSpan={7} className="p-16 text-center"><AlertCircle className="w-8 h-8 text-rose-300 mx-auto mb-3" /><p className="text-sm text-[#a1a1aa]">{loadError}</p></td></tr>
                                ) : logs.length ? (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-white/[0.025] transition-colors">
                                            <td className="px-5 py-4">
                                                <p className="text-sm text-[#d4d4d8]">{format(new Date(log.created_at), 'dd MMM yyyy', { locale: es })}</p>
                                                <p className="text-xs text-[#71717a] mt-1 tabular-nums">{format(new Date(log.created_at), 'HH:mm:ss')}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={cn('inline-flex px-2.5 py-1 rounded-md border text-[10px] font-semibold uppercase tracking-wider', ACTION_STYLES[log.action])}>{ACTION_LABELS[log.action]}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2 text-sm text-[#d4d4d8]"><Database className="w-4 h-4 text-[#71717a]" /><span className="font-mono text-xs">{log.table_name}</span></div>
                                            </td>
                                            <td className="px-5 py-4"><span className="font-mono text-xs text-white">#{log.record_id}</span></td>
                                            <td className="px-5 py-4"><p className="text-sm text-[#a1a1aa]">{getActivityDetail(log)}</p></td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2 text-xs text-[#a1a1aa]" title={log.changed_by || 'Acción del sistema'}><UserRound className="w-4 h-4 text-[#71717a]" /><span className="font-mono">{shortUserId(log.changed_by)}</span></div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <button type="button" onClick={() => setSelectedLog(log)} className="w-9 h-9 rounded-lg border border-[#3f3f46] inline-flex items-center justify-center text-[#a1a1aa] hover:text-white hover:border-[#71717a] transition-colors" aria-label={`Ver detalle del registro ${log.record_id}`}><Eye className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="p-20 text-center">
                                            <div className="w-14 h-14 rounded-xl border border-[#3f3f46] flex items-center justify-center mx-auto mb-4"><ShieldCheck className="w-6 h-6 text-[#71717a]" /></div>
                                            <p className="font-semibold text-white">No hay eventos para mostrar</p>
                                            <p className="text-sm text-[#71717a] mt-1">Ajuste o elimine los filtros de búsqueda.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!loading && !loadError && totalItems > 0 && (
                        <div className="px-5 py-4 border-t border-[#27272a] bg-[#0a0a0a] flex items-center justify-between gap-4">
                            <p className="text-xs text-[#71717a]">Página <span className="text-white">{currentPage}</span> de {totalPages}</p>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="h-10 px-4 rounded-lg border border-[#3f3f46] text-sm text-[#a1a1aa] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"><ChevronLeft className="w-4 h-4" /> Anterior</button>
                                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="h-10 px-4 rounded-lg border border-[#3f3f46] text-sm text-[#a1a1aa] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2">Siguiente <ChevronRight className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )}
                </Card>
            </main>

            {selectedLog && (
                <div className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-md p-4 flex items-center justify-center" onClick={() => setSelectedLog(null)}>
                    <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-xl border border-[#3f3f46] bg-[#0b0b0c] shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-[#27272a] flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className={cn('inline-flex px-2.5 py-1 rounded-md border text-[10px] font-semibold uppercase tracking-wider', ACTION_STYLES[selectedLog.action])}>{ACTION_LABELS[selectedLog.action]}</span>
                                    <span className="font-mono text-xs text-[#a1a1aa]">{selectedLog.table_name} · #{selectedLog.record_id}</span>
                                </div>
                                <p className="text-sm text-[#71717a] mt-2">{format(new Date(selectedLog.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es })} · Responsable {shortUserId(selectedLog.changed_by)}</p>
                            </div>
                            <button type="button" onClick={() => setSelectedLog(null)} className="w-10 h-10 rounded-lg border border-[#3f3f46] flex items-center justify-center text-[#a1a1aa] hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-5 overflow-y-auto max-h-[calc(88vh-90px)]">
                            <div className="mb-5">
                                <h3 className="font-semibold text-white">Campos registrados</h3>
                                <p className="text-sm text-[#71717a] mt-1">{getActivityDetail(selectedLog)}. Los valores se presentan únicamente para consulta.</p>
                            </div>

                            <div className="rounded-lg border border-[#27272a] overflow-hidden">
                                <div className="grid grid-cols-[minmax(150px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] bg-[#111112] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">
                                    <div className="px-4 py-3">Campo</div>
                                    <div className="px-4 py-3 border-l border-[#27272a]">Valor anterior</div>
                                    <div className="px-4 py-3 border-l border-[#27272a]">Valor nuevo</div>
                                </div>
                                <div className="divide-y divide-[#27272a]">
                                    {getChangedFields(selectedLog).map((field) => (
                                        <div key={field.key} className="grid grid-cols-[minmax(150px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] text-xs">
                                            <div className="px-4 py-3 font-medium text-[#d4d4d8] break-words">{humanizeField(field.key)}</div>
                                            <div className="px-4 py-3 border-l border-[#27272a] text-[#a1a1aa] break-all whitespace-pre-wrap">{formatValue(field.before)}</div>
                                            <div className="px-4 py-3 border-l border-[#27272a] text-white break-all whitespace-pre-wrap">{formatValue(field.after)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
