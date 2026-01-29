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
import { PageHeader } from '../components/ui/PageHeader';

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
        <div className="min-h-screen bg-[#0f111a] p-4 md:p-8 relative overflow-hidden">
            {/* Premium Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <PageHeader
                        title="Historial de Auditoría"
                        icon={History}
                        themeColor="blue"
                    />
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/5">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-widest text-blue-400">
                            {totalItems} Registros Totales
                        </span>
                    </div>
                </div>

                <div className="glass-card border-white/5 overflow-hidden shadow-2xl shadow-black/50">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead>
                                <tr className="bg-white/5 text-slate-400 text-[10px] font-black tracking-widest uppercase italic">
                                    <th className="p-5 w-48">Fecha y Hora</th>
                                    <th className="p-5 w-32">Operación</th>
                                    <th className="p-5 w-48">Módulo / Tabla</th>
                                    <th className="p-5 w-32">Identificador</th>
                                    <th className="p-5 w-1/3">Detalle de Actividad</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-slate-300 divide-y divide-white/5">
                                {loading ? (
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="p-5"><div className="h-4 bg-white/5 rounded w-full" /></td>
                                        </tr>
                                    ))
                                ) : logs.length > 0 ? (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-white/5 transition-all duration-300 group">
                                            <td className="p-5 text-slate-400 font-medium tabular-nums text-xs">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-blue-400 transition-colors" />
                                                    {format(new Date(log.created_at), "eeee, dd 'de' MMMM", { locale: es })}
                                                    <span className="text-slate-600 font-bold ml-1">
                                                        {format(new Date(log.created_at), 'HH:mm')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-lg text-[10px] font-black tracking-tighter uppercase ring-1",
                                                    log.action === 'INSERT' ? 'bg-emerald-400/10 text-emerald-400 ring-emerald-400/20' :
                                                        log.action === 'UPDATE' ? 'bg-blue-400/10 text-blue-400 ring-blue-400/20' :
                                                            'bg-red-400/10 text-red-400 ring-red-400/20'
                                                )}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-2 font-black uppercase text-[10px] text-slate-400 group-hover:text-white transition-colors">
                                                    <div className="p-1.5 bg-slate-400/10 rounded-md">
                                                        <TableIcon className="w-3 h-3" />
                                                    </div>
                                                    {log.table_name}
                                                </div>
                                            </td>
                                            <td className="p-5 font-mono text-xs text-blue-400/80 group-hover:text-blue-400 transition-colors font-bold">
                                                #{log.record_id}
                                            </td>
                                            <td className="p-5">
                                                <div className="text-xs text-slate-500 font-medium leading-relaxed group-hover:text-slate-300 transition-colors">
                                                    {log.action === 'UPDATE'
                                                        ? 'Actualización de campos existentes en el registro'
                                                        : log.action === 'INSERT' ? 'Creación de nuevo registro en el sistema' : 'Eliminación permanente de registro'
                                                    }
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="p-24 text-center">
                                            <div className="bg-slate-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-white/5">
                                                <AlertCircle className="w-10 h-10 text-slate-700" />
                                            </div>
                                            <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">No hay registros de auditoría disponibles</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-5 bg-black/20 border-t border-white/5 flex items-center justify-between">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic flex items-center gap-4">
                                <span>Página <span className="text-blue-400 ml-1">{currentPage}</span> / {totalPages}</span>
                                <div className="h-4 w-px bg-white/10" />
                                <span className="hidden md:inline">Mostrando <span className="text-white">{logs.length}</span> resultados</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1 || loading}
                                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-90"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages || loading}
                                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-90"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
