import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    History,
    Table as TableIcon,
    ChevronLeft,
    ChevronRight,
    AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AuditLog {
    id: string;
    table_name: string;
    record_id: string;
    action: string;
    old_data: any;
    new_data: any;
    changed_by: string;
    created_at: string;
}

export default function AuditHistory() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 15;

    const fetchLogs = async () => {
        setLoading(true);
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage - 1;

        const { data, count, error } = await supabase
            .from('audit_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(start, end);

        if (error) {
            console.error('Audit Load Error:', error);
        } else {
            setLogs(data || []);
            setTotalItems(count || 0);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, [currentPage]);

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <History className="w-6 h-6 text-white" />
                        </div>
                        Historial de Auditoría
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium tracking-wide flex items-center gap-2">
                        Trazabilidad completa de cambios en el sistema
                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                        <span className="text-blue-400">{totalItems} registros</span>
                    </p>
                </div>
            </div>

            {/* Table Card */}
            <div className="glass-card border-white/5 overflow-hidden">
                <div className="overflow-x-auto w-full bg-slate-950/20">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                            <tr className="bg-white/5 text-slate-400 text-[10px] font-bold tracking-widest uppercase">
                                <th className="p-4 w-40">Fecha</th>
                                <th className="p-4 w-32">Acción</th>
                                <th className="p-4 w-40">Tabla</th>
                                <th className="p-4 w-32">ID Registro</th>
                                <th className="p-4 w-1/3">Resumen de Cambios</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-slate-300 divide-y divide-white/5">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="p-4"><div className="h-4 bg-white/5 rounded w-full" /></td>
                                    </tr>
                                ))
                            ) : logs.length > 0 ? (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-all duration-200">
                                        <td className="p-4 text-slate-400 font-medium tabular-nums">
                                            {format(new Date(log.created_at), 'dd MMM, HH:mm', { locale: es })}
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded text-[10px] font-black tracking-tighter uppercase",
                                                log.action === 'INSERT' ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' :
                                                    log.action === 'UPDATE' ? 'bg-blue-400/10 text-blue-400 border border-blue-400/20' :
                                                        'bg-red-400/10 text-red-400 border border-red-400/20'
                                            )}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="p-4 flex items-center gap-2 font-bold uppercase text-[10px] text-slate-400">
                                            <TableIcon className="w-3 h-3" /> {log.table_name}
                                        </td>
                                        <td className="p-4 font-mono text-xs text-blue-400">
                                            #{log.record_id}
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs truncate text-slate-500 italic max-w-xs">
                                                {log.action === 'UPDATE'
                                                    ? 'Campos modificados detectados'
                                                    : log.action === 'INSERT' ? 'Nuevo registro creado' : 'Registro eliminado'
                                                }
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <AlertCircle className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No hay registros de auditoría</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 bg-slate-950/40 border-t border-white/5 flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Página <span className="text-white">{currentPage}</span> de <span className="text-white">{totalPages}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || loading}
                                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || loading}
                                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
