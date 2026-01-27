import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    X,
    Package,
    Calendar,
    Hash,
    Loader2,
    AlertCircle,
    ClipboardList,
    TrendingDown
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Material {
    id_salida: number;
    fecha: string;
    cantidad: number;
    marca: string;
    descripcion: string;
}

interface HistorialMaterialesModalProps {
    isOpen: boolean;
    onClose: () => void;
    numeroSolicitud: string;
}

const HistorialMaterialesModal: React.FC<HistorialMaterialesModalProps> = ({ isOpen, onClose, numeroSolicitud }) => {
    const [loading, setLoading] = useState(false);
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && numeroSolicitud) {
            cargarHistorial();
        }
    }, [isOpen, numeroSolicitud]);

    const cargarHistorial = async () => {
        setLoading(true);
        setError(null);
        try {
            // Consulta para obtener las salidas y sus detalles asociados a la solicitud
            const { data: salidas, error: errorSalidas } = await supabase
                .from('salida_articulo_08')
                .select(`
                    id_salida,
                    fecha_salida,
                    dato_salida_13 (
                        cantidad,
                        articulo_01 (
                            nombre_articulo,
                            marca
                        )
                    )
                `)
                .eq('numero_solicitud', parseInt(numeroSolicitud));

            if (errorSalidas) throw errorSalidas;

            const listaMateriales: Material[] = [];
            salidas?.forEach((s: any) => {
                s.dato_salida_13?.forEach((d: any) => {
                    listaMateriales.push({
                        id_salida: s.id_salida,
                        fecha: s.fecha_salida,
                        cantidad: d.cantidad,
                        marca: d.articulo_01?.marca || 'N/A',
                        descripcion: d.articulo_01?.nombre_articulo || 'Sin descripción'
                    });
                });
            });

            // Ordenar por fecha descendente
            setMateriales(listaMateriales.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
        } catch (err: any) {
            console.error('Error cargando historial:', err);
            setError(err.message || 'Error al consultar los datos');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />

            <div className="relative w-full max-w-5xl bg-[#1a1d29] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
                {/* Header Section */}
                <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center shadow-lg border border-purple-500/20">
                            <ClipboardList className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Historial de Materiales</h3>
                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mt-0.5">
                                Solicitud # <span className="text-white text-xs">{numeroSolicitud}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-400 transition-all group"
                    >
                        <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                            <p className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">Consultando Inventario...</p>
                        </div>
                    ) : error ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4 bg-rose-500/5 rounded-[2rem] border border-rose-500/20">
                            <AlertCircle className="w-12 h-12 text-rose-500" />
                            <p className="text-rose-400 font-bold">{error}</p>
                            <button onClick={cargarHistorial} className="px-6 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold uppercase">Reintentar</button>
                        </div>
                    ) : materiales.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-6 bg-white/[0.02] rounded-[2rem] border border-white/5">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                                <TrendingDown className="w-10 h-10 text-white/10" />
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-black text-white/50 uppercase tracking-tight">Sin entregas previas</p>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">
                                    No se encontraron materiales registrados para esta orden.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-[2rem] border border-white/5 bg-black/20 overflow-hidden shadow-inner">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-white/[0.03] border-b border-white/5">
                                        <th className="px-6 py-5 text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                                            <Hash className="w-3 h-3" /> N° Salida
                                        </th>
                                        <th className="px-6 py-5 text-[10px] font-black text-white/40 uppercase tracking-widest">
                                            <Calendar className="w-3 h-3 inline mr-1" /> Fecha
                                        </th>
                                        <th className="px-6 py-5 text-[10px] font-black text-white/40 uppercase tracking-widest">
                                            <Package className="w-3 h-3 inline mr-1" /> Descripción
                                        </th>
                                        <th className="px-6 py-5 text-[10px] font-black text-white/40 uppercase tracking-widest">Marca</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-white/40 uppercase tracking-widest text-center">Cantidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {materiales.map((m, idx) => (
                                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-4">
                                                <span className="inline-flex px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono font-bold text-gray-400 group-hover:text-purple-400 transition-colors">
                                                    SA-{m.id_salida.toString().padStart(4, '0')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-white/70">
                                                {new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-xs font-black text-white uppercase leading-relaxed max-w-xs">{m.descripcion}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{m.marca}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-lg font-black text-purple-400 bg-purple-500/10 px-4 py-1.5 rounded-xl border border-purple-500/20 min-w-[3rem] inline-block shadow-lg">
                                                    {m.cantidad}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="px-8 py-4 border-t border-white/5 bg-white/[0.01] flex justify-between items-center shrink-0">
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Total de artículos consultados: {materiales.length}</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                        Cerrar Consulta
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HistorialMaterialesModal;
