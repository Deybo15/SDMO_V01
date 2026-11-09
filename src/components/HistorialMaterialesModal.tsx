import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
    AlertCircle,
    Boxes,
    FileSpreadsheet,
    Loader2,
    Package,
    ReceiptText,
    X
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { formatDateOnly } from '../lib/utils';

interface MaterialResumen {
    codigo_articulo: string;
    descripcion: string;
    unidad: string;
    cantidad_total: number;
    costo_unitario: number;
    costo_total: number;
}

interface SolicitudResumen {
    fecha?: string;
    descripcion?: string;
    supervisor?: string;
    estado?: string;
}

interface HistorialMaterialesModalProps {
    isOpen: boolean;
    onClose: () => void;
    numeroSolicitud: string | number;
    solicitud?: SolicitudResumen;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2
}).format(value);

export default function HistorialMaterialesModal({
    isOpen,
    onClose,
    numeroSolicitud,
    solicitud
}: HistorialMaterialesModalProps) {
    const [loading, setLoading] = useState(false);
    const [materiales, setMateriales] = useState<MaterialResumen[]>([]);
    const [error, setError] = useState<string | null>(null);

    const cargarHistorial = useCallback(async () => {
        const solicitudId = Number(numeroSolicitud);
        if (!Number.isFinite(solicitudId)) return;

        setLoading(true);
        setError(null);

        try {
            const { data: salidas, error: errorSalidas } = await supabase
                .from('salida_articulo_08')
                .select(`
                    id_salida,
                    dato_salida_13 (
                        cantidad,
                        precio_unitario,
                        subtotal,
                        articulo,
                        articulo_01 (
                            nombre_articulo,
                            unidad
                        )
                    )
                `)
                .eq('numero_solicitud', solicitudId);

            if (errorSalidas) throw errorSalidas;

            const agrupados = new Map<string, MaterialResumen>();

            salidas?.forEach((salida: any) => {
                salida.dato_salida_13?.forEach((detalle: any) => {
                    const codigo = String(detalle.articulo || 'SIN-CODIGO');
                    const cantidad = Number(detalle.cantidad) || 0;
                    const costoUnitario = Number(detalle.precio_unitario) || 0;
                    const costoTotal = Number(detalle.subtotal) || cantidad * costoUnitario;
                    const clave = `${codigo}|${costoUnitario}`;
                    const existente = agrupados.get(clave);

                    if (existente) {
                        existente.cantidad_total += cantidad;
                        existente.costo_total += costoTotal;
                    } else {
                        agrupados.set(clave, {
                            codigo_articulo: codigo,
                            descripcion: detalle.articulo_01?.nombre_articulo || 'Sin descripción',
                            unidad: detalle.articulo_01?.unidad || 'Unidad',
                            cantidad_total: cantidad,
                            costo_unitario: costoUnitario,
                            costo_total: costoTotal
                        });
                    }
                });
            });

            setMateriales(Array.from(agrupados.values()).sort((a, b) =>
                a.descripcion.localeCompare(b.descripcion, 'es')
            ));
        } catch (err) {
            console.error('Error cargando materiales por solicitud:', err);
            setMateriales([]);
            setError(err instanceof Error ? err.message : 'No fue posible consultar los materiales.');
        } finally {
            setLoading(false);
        }
    }, [numeroSolicitud]);

    useEffect(() => {
        if (isOpen && numeroSolicitud) {
            cargarHistorial();
        } else if (!isOpen) {
            setMateriales([]);
            setError(null);
        }
    }, [cargarHistorial, isOpen, numeroSolicitud]);

    const totals = useMemo(() => ({
        lineas: materiales.length,
        unidades: materiales.reduce((sum, material) => sum + material.cantidad_total, 0),
        monto: materiales.reduce((sum, material) => sum + material.costo_total, 0)
    }), [materiales]);

    const exportarExcel = () => {
        if (!materiales.length) return;

        const rows: (string | number)[][] = [
            ['REPORTE DE MATERIALES POR SOLICITUD'],
            [],
            ['Número de solicitud', Number(numeroSolicitud)],
            ['Fecha de solicitud', solicitud?.fecha ? formatDateOnly(solicitud.fecha) : 'No disponible'],
            ['Supervisor', solicitud?.supervisor || 'No asignado'],
            ['Estado', solicitud?.estado || 'Sin registro'],
            ['Descripción', solicitud?.descripcion || 'No disponible'],
            [],
            ['Código de artículo', 'Descripción', 'Unidad', 'Cantidad total', 'Costo unitario', 'Costo total'],
            ...materiales.map((material) => [
                material.codigo_articulo,
                material.descripcion,
                material.unidad,
                material.cantidad_total,
                material.costo_unitario,
                material.costo_total
            ]),
            [],
            ['', '', '', 'TOTAL GENERAL', '', totals.monto]
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        worksheet['!cols'] = [
            { wch: 24 },
            { wch: 70 },
            { wch: 14 },
            { wch: 18 },
            { wch: 20 },
            { wch: 20 }
        ];

        const currencyFormat = '₡#,##0.00';
        for (let row = 9; row < 9 + materiales.length; row += 1) {
            const unitCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 4 })];
            const totalCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 5 })];
            if (unitCell) unitCell.z = currencyFormat;
            if (totalCell) totalCell.z = currencyFormat;
        }
        const grandTotalCell = worksheet[XLSX.utils.encode_cell({ r: 10 + materiales.length, c: 5 })];
        if (grandTotalCell) grandTotalCell.z = currencyFormat;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Materiales');
        XLSX.writeFile(workbook, `materiales_solicitud_${numeroSolicitud}.xlsx`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 md:p-6">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

            <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[#3f3f46] bg-[#0b0b0c] shadow-2xl">
                <div className="flex shrink-0 flex-col gap-4 border-b border-[#27272a] px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
                    <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#111112]">
                            <ReceiptText className="h-5 w-5 text-[#d4d4d8]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white">Materiales de la solicitud #{numeroSolicitud}</h2>
                            <p className="mt-1 text-sm text-[#a1a1aa]">Consumo consolidado de todas las salidas vinculadas a esta orden.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                            type="button"
                            onClick={exportarExcel}
                            disabled={loading || materiales.length === 0}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#f4f4f5] px-4 text-sm font-semibold text-[#18181b] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Exportar Excel
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#3f3f46] text-[#a1a1aa] transition-colors hover:border-[#71717a] hover:text-white"
                            aria-label="Cerrar detalle de materiales"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 md:p-7">
                    {loading ? (
                        <div className="flex min-h-72 flex-col items-center justify-center gap-4">
                            <Loader2 className="h-9 w-9 animate-spin text-[#d4d4d8]" />
                            <p className="text-sm text-[#71717a]">Consultando materiales registrados…</p>
                        </div>
                    ) : error ? (
                        <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center">
                            <AlertCircle className="h-9 w-9 text-rose-300" />
                            <div>
                                <p className="font-semibold text-white">No fue posible cargar los materiales</p>
                                <p className="mt-1 text-sm text-[#a1a1aa]">{error}</p>
                            </div>
                            <button type="button" onClick={cargarHistorial} className="rounded-lg border border-[#52525b] px-4 py-2 text-sm text-white hover:border-[#a1a1aa]">Reintentar</button>
                        </div>
                    ) : materiales.length === 0 ? (
                        <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[#3f3f46] bg-[#0f0f10] text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#3f3f46]">
                                <Package className="h-6 w-6 text-[#71717a]" />
                            </div>
                            <div>
                                <p className="font-semibold text-white">Esta solicitud no tiene materiales registrados</p>
                                <p className="mt-1 text-sm text-[#71717a]">No se encontraron salidas de artículos asociadas a la orden #{numeroSolicitud}.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border border-[#27272a] bg-[#111112] p-4">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">Artículos / costos</p>
                                    <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{totals.lineas}</p>
                                </div>
                                <div className="rounded-lg border border-[#27272a] bg-[#111112] p-4">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">Unidades consumidas</p>
                                    <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{totals.unidades.toLocaleString('es-CR')}</p>
                                </div>
                                <div className="rounded-lg border border-[#27272a] bg-[#111112] p-4">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">Costo total</p>
                                    <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{formatCurrency(totals.monto)}</p>
                                </div>
                            </div>

                            {solicitud?.descripcion && (
                                <div className="rounded-lg border border-[#27272a] bg-[#111112] px-4 py-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">Descripción de la orden</p>
                                    <p className="mt-2 text-sm leading-relaxed text-[#d4d4d8]">{solicitud.descripcion}</p>
                                </div>
                            )}

                            <div className="overflow-hidden rounded-lg border border-[#27272a]">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[900px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-[#27272a] bg-[#111112] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">
                                                <th className="px-4 py-4">Código de artículo</th>
                                                <th className="px-4 py-4">Descripción</th>
                                                <th className="px-4 py-4 text-center">Cantidad</th>
                                                <th className="px-4 py-4 text-right">Costo unitario</th>
                                                <th className="px-4 py-4 text-right">Costo total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#27272a]">
                                            {materiales.map((material) => (
                                                <tr key={`${material.codigo_articulo}-${material.costo_unitario}`} className="transition-colors hover:bg-white/[0.025]">
                                                    <td className="px-4 py-4 font-mono text-xs text-[#d4d4d8]">{material.codigo_articulo}</td>
                                                    <td className="px-4 py-4">
                                                        <p className="text-sm font-medium text-white">{material.descripcion}</p>
                                                        <p className="mt-1 text-xs text-[#71717a]">{material.unidad}</p>
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-semibold tabular-nums text-white">{material.cantidad_total.toLocaleString('es-CR')}</td>
                                                    <td className="px-4 py-4 text-right font-mono text-sm tabular-nums text-[#a1a1aa]">{formatCurrency(material.costo_unitario)}</td>
                                                    <td className="px-4 py-4 text-right font-mono text-sm font-semibold tabular-nums text-white">{formatCurrency(material.costo_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-[#52525b] bg-[#111112]">
                                                <td colSpan={4} className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Total general</td>
                                                <td className="px-4 py-4 text-right font-mono text-base font-semibold tabular-nums text-white">{formatCurrency(totals.monto)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex shrink-0 items-center justify-between border-t border-[#27272a] px-5 py-4 md:px-7">
                    <div className="flex items-center gap-2 text-xs text-[#71717a]">
                        <Boxes className="h-4 w-4" />
                        {materiales.length ? `${totals.lineas} líneas consolidadas` : 'Sin consumo registrado'}
                    </div>
                    <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg border border-[#3f3f46] px-4 py-2 text-sm text-[#a1a1aa] transition-colors hover:border-[#71717a] hover:text-white">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
