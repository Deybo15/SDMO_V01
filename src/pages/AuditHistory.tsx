import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    History,
    Table as TableIcon,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    ArrowLeft
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PageHeader } from '../components/ui/PageHeader';
import { useNavigate } from 'react-router-dom';

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
    const navigate = useNavigate();
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
        <div className="min-h-screen bg-[#000000] p-8 text-[#F5F5F7]">
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <PageHeader
                            title="Historial de Auditoría"
                            icon={History}
                            themeColor="blue"
                        />
                        <div className="flex items-center gap-3 px-4 py-2 bg-[#1D1D1F] border border-[#333333] rounded-[8px] w-fit">
                            <span className="w-2 h-2 rounded-full bg-[#0071E3] animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F5F5F7]">
                                {totalItems} Registros Totales
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/gestion-interna')}
                        className="btn-ghost"
                    >
                        <div className="flex items-center gap-2">
                            <ArrowLeft className="w-5 h-5" />
                            <span className="text-[11px] font-bold uppercase tracking-widest">Gestión Interna</span>
                        </div>
                    </button>
                </div>

                <div className="relative bg-[#121212] border border-[#333333] rounded-[8px] overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/20 border-b border-[#333333] text-[#86868B] text-[9px] font-black tracking-widest uppercase">
                                    <th className="p-5 w-56">Fecha y Hora</th>
                                    <th className="p-5 w-32 text-center">Operación</th>
                                    <th className="p-5 w-48">Módulo / Tabla</th>
                                    <th className="p-5 w-32">Identificador</th>
                                    <th className="p-5">Detalle de Actividad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333333]/30">
                                {loading ? (
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="p-5"><div className="h-4 bg-[#1D1D1F] rounded-[8px] w-full" /></td>
                                        </tr>
                                    ))
                                ) : logs.length > 0 ? (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-white/[0.04] transition-colors group">
                                            <td className="p-5">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-bold text-[#F5F5F7] italic">
                                                        {format(new Date(log.created_at), "eeee, dd 'de' MMMM", { locale: es })}
                                                    </span>
                                                    <span className="text-[10px] font-black text-[#86868B] tracking-wider uppercase">
                                                        {format(new Date(log.created_at), 'HH:mm:ss')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-5 text-center">
                                                <span className={cn(
                                                    "px-3 py-1.5 rounded-[8px] text-[9px] font-black tracking-widest uppercase border",
                                                    log.action === 'INSERT' ? 'bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/20' :
                                                        log.action === 'UPDATE' ? 'bg-[#0071E3]/5 text-[#F5F5F7] border-[#0071E3]/20' :
                                                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                )}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-2 font-black uppercase text-[10px] text-[#86868B] group-hover:text-[#F5F5F7] transition-colors">
                                                    <div className="p-1.5 bg-black/40 rounded-[8px] border border-[#333333]">
                                                        <TableIcon className="w-3.5 h-3.5" />
                                                    </div>
                                                    {log.table_name}
                                                </div>
                                            </td>
                                            <td className="p-5 font-mono text-xs text-[#0071E3] font-black tracking-tighter group-hover:brightness-125 transition-all italic">
                                                #{log.record_id}
                                            </td>
                                            <td className="p-5">
                                                <p className="text-[11px] text-[#86868B] font-bold leading-relaxed group-hover:text-[#F5F5F7] transition-colors uppercase italic tracking-tight">
                                                    {log.action === 'UPDATE'
                                                        ? 'Actualización de campos existentes en el registro'
                                                        : log.action === 'INSERT' ? 'Creación de nuevo registro en el sistema' : 'Eliminación permanente de registro'
                                                    }
                                                </p>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="p-24 text-center">
                                            <div className="bg-[#121212] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#333333] shadow-xl">
                                                <AlertCircle className="w-10 h-10 text-[#86868B]" />
                                            </div>
                                            <p className="text-[#86868B] font-black uppercase tracking-[0.2em] text-[10px]">No hay registros de auditoría disponibles</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-8 border-t border-[#333333] bg-black/20 flex items-center justify-between">
                            <div className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em] flex items-center gap-4">
                                <span>Página <span className="text-[#0071E3] ml-1">{currentPage}</span> / {totalPages}</span>
                                <div className="h-4 w-px bg-[#333333]" />
                                <span className="hidden md:inline opacity-40">Mostrando {logs.length} registros</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1 || loading}
                                    className="px-6 py-3 bg-transparent border border-[#F5F5F7] rounded-[8px] text-[#F5F5F7] hover:bg-[#F5F5F7]/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                                >
                                    <ChevronLeft className="w-5 h-5" /> Anterior
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages || loading}
                                    className="px-6 py-3 bg-transparent border border-[#F5F5F7] rounded-[8px] text-[#F5F5F7] hover:bg-[#F5F5F7]/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                                >
                                    Siguiente <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
