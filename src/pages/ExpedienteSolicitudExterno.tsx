import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Boxes,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Clock3,
    ExternalLink,
    FileImage,
    FileText,
    Loader2,
    MapPin,
    MessageSquareText,
    Package,
    Printer,
    ReceiptText,
    ShieldCheck,
    UserRound,
    UsersRound
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { formatDateOnly } from '../lib/utils';

interface SolicitudExterna {
    numero_solicitud: number;
    fecha_solicitud: string;
    descripcion_solicitud: string;
    direccion_exacta: string | null;
    supervisor_asignado: string | null;
    profesional_responsable: string | null;
    cliente_externo: string | number | null;
    cliente_interno: string | number | null;
    barrio_solicitud: string | number | null;
    tipologia_trabajo: string | number | null;
    link_ubicacion: string | null;
    static_map_url: string | null;
}

interface Seguimiento {
    estado_actual: string | null;
    fecha_ingreso: string | null;
    fecha_inicio: string | null;
    fecha_asignacion: string | null;
    fecha_valoracion: string | null;
    fecha_finalizacion: string | null;
    nota_de_cierre: string | null;
}

interface RegistroSeguimiento {
    id_registro: number;
    fecha_registro: string;
    registro_seguimiento: string;
}

interface DetalleSalida {
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    articulo: string;
    articulo_01: { nombre_articulo: string; unidad: string } | null;
}

interface Salida {
    id_salida: number;
    fecha_salida: string;
    autoriza: string | null;
    retira: string | null;
    finalizada: boolean | null;
    comentarios: string | null;
    nota: string | null;
    total: number | null;
    dato_salida_13: DetalleSalida[];
}

interface MaterialDetalle {
    salidaId: number;
    fechaSalida: string;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    costoUnitario: number;
    costoTotal: number;
}

interface MaterialResumen {
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    costoUnitario: number;
    costoTotal: number;
}

interface DatosRelacionados {
    clienteExterno: string;
    clienteInterno: string;
    profesional: string;
    supervisor: string;
    barrio: string;
    distrito: string;
    tipologia: string;
}

interface TimelineItem {
    id: string;
    fecha: string;
    titulo: string;
    detalle: string;
    tipo: 'creacion' | 'asignacion' | 'seguimiento' | 'materiales' | 'inicio' | 'cierre';
}

type TabId = 'resumen' | 'linea' | 'materiales' | 'seguimiento';

const EMPTY_RELATED: DatosRelacionados = {
    clienteExterno: 'No identificado',
    clienteInterno: 'No registrado',
    profesional: 'No asignado',
    supervisor: 'No asignado',
    barrio: 'No registrado',
    distrito: 'No registrado',
    tipologia: 'No registrada'
};

const money = (value: number) => new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2
}).format(value);

const parseDate = (value: string) => new Date(`${value}T00:00:00`);

const daysBetween = (start: string, end?: string | null) => {
    const startDate = parseDate(start);
    const endDate = end ? parseDate(end) : new Date();
    return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000));
};

const timelineIcon: Record<TimelineItem['tipo'], typeof ClipboardList> = {
    creacion: ClipboardList,
    asignacion: UsersRound,
    seguimiento: MessageSquareText,
    materiales: Package,
    inicio: Clock3,
    cierre: CheckCircle2
};

export default function ExpedienteSolicitudExterno() {
    const { numeroSolicitud } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [solicitud, setSolicitud] = useState<SolicitudExterna | null>(null);
    const [seguimiento, setSeguimiento] = useState<Seguimiento | null>(null);
    const [registros, setRegistros] = useState<RegistroSeguimiento[]>([]);
    const [salidas, setSalidas] = useState<Salida[]>([]);
    const [relacionados, setRelacionados] = useState<DatosRelacionados>(EMPTY_RELATED);
    const [nombres, setNombres] = useState<Record<string, string>>({});
    const [evidencias, setEvidencias] = useState<{ label: string; url: string }[]>([]);
    const [activeTab, setActiveTab] = useState<TabId>('resumen');

    useEffect(() => {
        const id = Number(numeroSolicitud);
        if (!Number.isFinite(id)) {
            setError('El número de solicitud no es válido.');
            setLoading(false);
            return;
        }

        const cargarImagen = async (prefijo: 'FA' | 'FD') => {
            const search = `${prefijo}_${id}_STE`;
            const { data, error: storageError } = await supabase.storage.from('imagenes-ste').list('', { search });
            if (storageError || !data?.length) return null;

            const archivo = data.find((item) => item.name.startsWith(search)) || data[0];
            const { data: publicUrl } = supabase.storage.from('imagenes-ste').getPublicUrl(archivo.name);
            return publicUrl.publicUrl || null;
        };

        const cargarExpediente = async () => {
            setLoading(true);
            setError(null);

            try {
                const [solicitudResult, seguimientoResult, registrosResult, salidasResult, imagenAntes, imagenDespues] = await Promise.all([
                    supabase.from('solicitud_17').select('numero_solicitud, fecha_solicitud, descripcion_solicitud, direccion_exacta, supervisor_asignado, profesional_responsable, cliente_externo, cliente_interno, barrio_solicitud, tipologia_trabajo, link_ubicacion, static_map_url').eq('numero_solicitud', id).eq('tipo_solicitud', 'STE').maybeSingle(),
                    supabase.from('seguimiento_solicitud').select('estado_actual, fecha_ingreso, fecha_inicio, fecha_asignacion, fecha_valoracion, fecha_finalizacion, nota_de_cierre').eq('numero_solicitud', id).maybeSingle(),
                    supabase.from('registro_seguimiento_solicitud').select('id_registro, fecha_registro, registro_seguimiento').eq('numero_solicitud', id).order('fecha_registro', { ascending: true }),
                    supabase.from('salida_articulo_08').select(`
                        id_salida,
                        fecha_salida,
                        autoriza,
                        retira,
                        finalizada,
                        comentarios,
                        nota,
                        total,
                        dato_salida_13 (
                            cantidad,
                            precio_unitario,
                            subtotal,
                            articulo,
                            articulo_01 (nombre_articulo, unidad)
                        )
                    `).eq('numero_solicitud', id).order('fecha_salida', { ascending: true }),
                    cargarImagen('FA'),
                    cargarImagen('FD')
                ]);

                if (solicitudResult.error) throw solicitudResult.error;
                if (!solicitudResult.data) throw new Error('No se encontró una solicitud externa con ese número.');
                if (seguimientoResult.error) throw seguimientoResult.error;
                if (registrosResult.error) throw registrosResult.error;
                if (salidasResult.error) throw salidasResult.error;

                const solicitudData = solicitudResult.data as SolicitudExterna;
                const salidasData = (salidasResult.data || []) as unknown as Salida[];
                const personas = [...new Set([
                    solicitudData.profesional_responsable,
                    solicitudData.supervisor_asignado,
                    ...salidasData.flatMap((salida) => [salida.autoriza, salida.retira])
                ].filter(Boolean))] as string[];

                const [colaboradoresResult, clienteExternoResult, clienteInternoResult, barrioResult, tipologiaResult] = await Promise.all([
                    personas.length
                        ? supabase.from('colaboradores_06').select('identificacion, colaborador, alias').in('identificacion', personas)
                        : Promise.resolve({ data: [], error: null }),
                    solicitudData.cliente_externo
                        ? supabase.from('cliente_externo_24').select('nombre_ce').eq('id_cliente_externo', solicitudData.cliente_externo).maybeSingle()
                        : Promise.resolve({ data: null, error: null }),
                    solicitudData.cliente_interno
                        ? supabase.from('cliente_interno_15').select('nombre').eq('id_cliente', solicitudData.cliente_interno).maybeSingle()
                        : Promise.resolve({ data: null, error: null }),
                    solicitudData.barrio_solicitud
                        ? supabase.from('barrios_distritos').select('barrio, distrito').eq('id_barrio', solicitudData.barrio_solicitud).maybeSingle()
                        : Promise.resolve({ data: null, error: null }),
                    solicitudData.tipologia_trabajo
                        ? supabase.from('tipologia_obra').select('descripcion_tipologia_obra').eq('id_tipologia_obra', solicitudData.tipologia_trabajo).maybeSingle()
                        : Promise.resolve({ data: null, error: null })
                ]);

                const lookupErrors = [colaboradoresResult.error, clienteExternoResult.error, clienteInternoResult.error, barrioResult.error, tipologiaResult.error].filter(Boolean);
                if (lookupErrors.length) console.warn('Algunos datos relacionados no pudieron cargarse:', lookupErrors);

                const mapaNombres = Object.fromEntries((colaboradoresResult.data || []).map((persona) => [
                    persona.identificacion,
                    persona.alias || persona.colaborador || persona.identificacion
                ]));

                setSolicitud(solicitudData);
                setSeguimiento(seguimientoResult.data as Seguimiento | null);
                setRegistros((registrosResult.data || []) as RegistroSeguimiento[]);
                setSalidas(salidasData);
                setNombres(mapaNombres);
                setRelacionados({
                    clienteExterno: clienteExternoResult.data?.nombre_ce || EMPTY_RELATED.clienteExterno,
                    clienteInterno: clienteInternoResult.data?.nombre || EMPTY_RELATED.clienteInterno,
                    profesional: solicitudData.profesional_responsable ? mapaNombres[solicitudData.profesional_responsable] || solicitudData.profesional_responsable : EMPTY_RELATED.profesional,
                    supervisor: solicitudData.supervisor_asignado ? mapaNombres[solicitudData.supervisor_asignado] || solicitudData.supervisor_asignado : EMPTY_RELATED.supervisor,
                    barrio: barrioResult.data?.barrio || EMPTY_RELATED.barrio,
                    distrito: barrioResult.data?.distrito || EMPTY_RELATED.distrito,
                    tipologia: tipologiaResult.data?.descripcion_tipologia_obra || EMPTY_RELATED.tipologia
                });
                setEvidencias([
                    imagenAntes ? { label: 'Evidencia inicial', url: imagenAntes } : null,
                    imagenDespues ? { label: 'Evidencia final', url: imagenDespues } : null
                ].filter(Boolean) as { label: string; url: string }[]);
            } catch (caught) {
                console.error('Error cargando expediente externo:', caught);
                setError(caught instanceof Error ? caught.message : 'No fue posible cargar el expediente.');
            } finally {
                setLoading(false);
            }
        };

        cargarExpediente();
    }, [numeroSolicitud]);

    const materialesDetalle = useMemo(() => salidas.flatMap((salida) => salida.dato_salida_13?.map((detalle) => {
        const cantidad = Number(detalle.cantidad) || 0;
        const costoUnitario = Number(detalle.precio_unitario) || 0;
        return {
            salidaId: salida.id_salida,
            fechaSalida: salida.fecha_salida,
            codigo: detalle.articulo || 'SIN-CODIGO',
            descripcion: detalle.articulo_01?.nombre_articulo || 'Sin descripción',
            unidad: detalle.articulo_01?.unidad || 'Unidad',
            cantidad,
            costoUnitario,
            costoTotal: Number(detalle.subtotal) || cantidad * costoUnitario
        } satisfies MaterialDetalle;
    }) || []), [salidas]);

    const materiales = useMemo(() => {
        const agrupados = new Map<string, MaterialResumen>();
        materialesDetalle.forEach((detalle) => {
            const key = `${detalle.codigo}|${detalle.costoUnitario}`;
            const existente = agrupados.get(key);
            if (existente) {
                existente.cantidad += detalle.cantidad;
                existente.costoTotal += detalle.costoTotal;
            } else {
                agrupados.set(key, {
                    codigo: detalle.codigo,
                    descripcion: detalle.descripcion,
                    unidad: detalle.unidad,
                    cantidad: detalle.cantidad,
                    costoUnitario: detalle.costoUnitario,
                    costoTotal: detalle.costoTotal
                });
            }
        });
        return Array.from(agrupados.values()).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
    }, [materialesDetalle]);

    const totalMateriales = useMemo(() => materialesDetalle.reduce((sum, material) => sum + material.costoTotal, 0), [materialesDetalle]);
    const unidadesMateriales = useMemo(() => materialesDetalle.reduce((sum, material) => sum + material.cantidad, 0), [materialesDetalle]);

    const timeline = useMemo(() => {
        if (!solicitud) return [];
        const items: TimelineItem[] = [{
            id: 'creacion',
            fecha: solicitud.fecha_solicitud,
            titulo: 'Solicitud externa creada',
            detalle: solicitud.descripcion_solicitud,
            tipo: 'creacion'
        }];

        const fechaAsignacion = seguimiento?.fecha_asignacion || seguimiento?.fecha_valoracion;
        if (fechaAsignacion) items.push({
            id: 'asignacion',
            fecha: fechaAsignacion,
            titulo: 'Responsables asignados',
            detalle: `${relacionados.profesional} · ${relacionados.supervisor}`,
            tipo: 'asignacion'
        });

        if (seguimiento?.fecha_inicio) items.push({
            id: 'inicio',
            fecha: seguimiento.fecha_inicio,
            titulo: 'Trabajo iniciado',
            detalle: `Inicio de labores en ${solicitud.direccion_exacta || 'la ubicación indicada'}.`,
            tipo: 'inicio'
        });

        registros.forEach((registro) => items.push({
            id: `registro-${registro.id_registro}`,
            fecha: registro.fecha_registro,
            titulo: 'Seguimiento registrado',
            detalle: registro.registro_seguimiento,
            tipo: 'seguimiento'
        }));

        salidas.forEach((salida) => {
            const cantidad = salida.dato_salida_13?.reduce((sum, detalle) => sum + (Number(detalle.cantidad) || 0), 0) || 0;
            items.push({
                id: `salida-${salida.id_salida}`,
                fecha: salida.fecha_salida,
                titulo: `Salida de materiales #${salida.id_salida}`,
                detalle: `${cantidad.toLocaleString('es-CR')} unidades · Retira: ${salida.retira ? nombres[salida.retira] || salida.retira : 'No identificado'}`,
                tipo: 'materiales'
            });
        });

        if (seguimiento?.fecha_finalizacion) items.push({
            id: 'cierre',
            fecha: seguimiento.fecha_finalizacion,
            titulo: 'Trabajo finalizado',
            detalle: seguimiento.nota_de_cierre || `La solicitud quedó en estado ${seguimiento.estado_actual || 'ejecutado'}.`,
            tipo: 'cierre'
        });

        return items.sort((a, b) => parseDate(a.fecha).getTime() - parseDate(b.fecha).getTime());
    }, [nombres, registros, relacionados, salidas, seguimiento, solicitud]);

    if (loading) return <LoadingState />;

    if (error || !solicitud) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center bg-black px-6 text-white">
                <div className="max-w-md rounded-xl border border-[#3f3f46] bg-[#0d0d0e] p-8 text-center">
                    <FileText className="mx-auto h-10 w-10 text-[#71717a]" />
                    <h1 className="mt-4 text-xl font-semibold">No se pudo abrir el expediente</h1>
                    <p className="mt-2 text-sm text-[#a1a1aa]">{error}</p>
                    <button type="button" onClick={() => navigate(-1)} className="mt-6 rounded-lg border border-[#52525b] px-5 py-2.5 text-sm font-semibold hover:bg-[#18181b]">Regresar</button>
                </div>
            </div>
        );
    }

    const estado = seguimiento?.estado_actual || 'SIN REGISTRO';
    const dias = daysBetween(solicitud.fecha_solicitud, seguimiento?.fecha_finalizacion);
    const tabs: { id: TabId; label: string; icon: typeof ClipboardList }[] = [
        { id: 'resumen', label: 'Resumen', icon: ClipboardList },
        { id: 'linea', label: 'Línea de tiempo', icon: Clock3 },
        { id: 'materiales', label: `Materiales (${materialesDetalle.length})`, icon: Package },
        { id: 'seguimiento', label: 'Seguimiento y evidencias', icon: MessageSquareText }
    ];

    return (
        <div className="min-h-screen bg-black pb-16 text-[#f4f4f5] print:bg-white print:text-black">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-7 md:px-8">
                <header className="flex flex-col gap-5 border-b border-[#27272a] pb-6 lg:flex-row lg:items-center lg:justify-between print:border-black">
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={() => navigate(-1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#18181b] text-[#a1a1aa] hover:text-white print:hidden" aria-label="Regresar">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#52525b] bg-[#111112]"><FileText className="h-5 w-5" /></div>
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Expediente de Cliente Externo</h1>
                            <p className="mt-1 text-sm text-[#a1a1aa] print:text-black">Trazabilidad y materiales consolidados con los datos existentes.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 self-end lg:self-auto print:hidden">
                        <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#f4f4f5] px-5 text-sm font-semibold text-black hover:bg-white"><Printer className="h-4 w-4" /> Imprimir / PDF</button>
                        <button type="button" onClick={() => navigate(-1)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#52525b] px-5 text-sm font-semibold hover:bg-[#18181b]"><ArrowLeft className="h-4 w-4" /> Regresar</button>
                    </div>
                </header>

                <section className="mt-6 rounded-xl border border-[#3f3f46] bg-[#0d0d0e] p-5 md:p-6 print:border-black print:bg-white">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-center gap-3"><h2 className="text-xl font-semibold md:text-2xl">Solicitud #{solicitud.numero_solicitud}</h2><span className="rounded-md border border-[#71717a] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">{estado}</span></div>
                        <p className="max-w-3xl text-sm leading-relaxed text-[#d4d4d8] xl:text-right print:text-black">{solicitud.descripcion_solicitud}</p>
                    </div>
                    <div className="mt-5 grid gap-4 border-t border-[#27272a] pt-5 sm:grid-cols-2 xl:grid-cols-5 print:border-black">
                        <Info label="Fecha de solicitud" value={formatDateOnly(solicitud.fecha_solicitud)} icon={CalendarDays} />
                        <Info label="Cliente externo" value={relacionados.clienteExterno} icon={UsersRound} />
                        <Info label="Profesional responsable" value={relacionados.profesional} icon={UserRound} />
                        <Info label="Supervisor" value={relacionados.supervisor} icon={ShieldCheck} />
                        <Info label="Ubicación" value={solicitud.direccion_exacta || 'No registrada'} icon={MapPin} />
                    </div>
                </section>

                <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric label="Días transcurridos" value={`${dias} días`} icon={Clock3} />
                    <Metric label="Movimientos reconstruidos" value={timeline.length.toLocaleString('es-CR')} icon={ReceiptText} />
                    <Metric label="Unidades consumidas" value={unidadesMateriales.toLocaleString('es-CR')} icon={Package} />
                    <Metric label="Costo acumulado" value={money(totalMateriales)} icon={Boxes} />
                </section>

                <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-[#27272a] print:hidden">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'}`}><Icon className="h-4 w-4" /> {tab.label}</button>;
                    })}
                </nav>

                <main className="mt-5">
                    {activeTab === 'resumen' && (
                        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
                            <Timeline items={timeline.slice(-6)} />
                            <div className="space-y-5">
                                <ResumenMateriales materiales={materiales.slice(0, 5)} total={totalMateriales} />
                                <Panel title="Personas vinculadas" icon={UsersRound}>
                                    <DetailRow label="Cliente externo" value={relacionados.clienteExterno} />
                                    <DetailRow label="Solicitante interno" value={relacionados.clienteInterno} />
                                    <DetailRow label="Profesional" value={relacionados.profesional} />
                                    <DetailRow label="Supervisor" value={relacionados.supervisor} />
                                </Panel>
                                <Panel title="Ubicación y trabajo" icon={MapPin}>
                                    <DetailRow label="Dirección" value={solicitud.direccion_exacta || 'No registrada'} />
                                    <DetailRow label="Distrito" value={relacionados.distrito} />
                                    <DetailRow label="Barrio" value={relacionados.barrio} />
                                    <DetailRow label="Tipología" value={relacionados.tipologia} />
                                    {solicitud.link_ubicacion && <a href={solicitud.link_ubicacion} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#d4d4d8] hover:text-white">Abrir ubicación <ExternalLink className="h-4 w-4" /></a>}
                                </Panel>
                            </div>
                        </div>
                    )}

                    {activeTab === 'linea' && <Timeline items={timeline} />}

                    {activeTab === 'materiales' && (
                        <section className="overflow-hidden rounded-xl border border-[#3f3f46] bg-[#0d0d0e]">
                            <div className="flex flex-col gap-3 border-b border-[#27272a] p-5 md:flex-row md:items-center md:justify-between md:p-6">
                                <div><h2 className="text-lg font-semibold">Materiales utilizados</h2><p className="mt-1 text-sm text-[#71717a]">Detalle por salida de todos los artículos vinculados.</p></div>
                                <div className="text-left md:text-right"><p className="text-xs text-[#71717a]">Total acumulado</p><p className="mt-1 font-mono text-lg font-semibold">{money(totalMateriales)}</p></div>
                            </div>
                            {materialesDetalle.length ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1050px] text-left">
                                        <thead className="bg-[#18181b] text-[10px] uppercase tracking-[0.12em] text-[#a1a1aa]"><tr><th className="px-5 py-4">Salida</th><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Código</th><th className="px-5 py-4">Descripción</th><th className="px-5 py-4 text-center">Cantidad</th><th className="px-5 py-4 text-right">Costo unitario</th><th className="px-5 py-4 text-right">Total</th></tr></thead>
                                        <tbody className="divide-y divide-[#27272a]">
                                            {materialesDetalle.map((material, index) => (
                                                <tr key={`${material.salidaId}-${material.codigo}-${index}`} className="hover:bg-[#151517]">
                                                    <td className="px-5 py-4 font-mono text-xs">#{material.salidaId}</td>
                                                    <td className="px-5 py-4 text-sm text-[#a1a1aa]">{formatDateOnly(material.fechaSalida)}</td>
                                                    <td className="px-5 py-4 font-mono text-xs">{material.codigo}</td>
                                                    <td className="px-5 py-4"><p className="text-sm font-medium">{material.descripcion}</p><p className="mt-1 text-xs text-[#71717a]">{material.unidad}</p></td>
                                                    <td className="px-5 py-4 text-center text-sm font-semibold">{material.cantidad.toLocaleString('es-CR')}</td>
                                                    <td className="px-5 py-4 text-right font-mono text-sm text-[#a1a1aa]">{money(material.costoUnitario)}</td>
                                                    <td className="px-5 py-4 text-right font-mono text-sm font-semibold">{money(material.costoTotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="border-t border-[#52525b] bg-[#18181b]"><tr><td colSpan={6} className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">Total general</td><td className="px-5 py-4 text-right font-mono font-semibold">{money(totalMateriales)}</td></tr></tfoot>
                                    </table>
                                </div>
                            ) : <EmptyState icon={Package} title="Sin materiales registrados" text="Esta solicitud externa no tiene salidas de artículos asociadas." />}
                        </section>
                    )}

                    {activeTab === 'seguimiento' && (
                        <div className="grid gap-5 xl:grid-cols-2">
                            <Panel title="Registros de seguimiento" icon={MessageSquareText}>
                                {registros.length ? registros.map((registro) => <div key={registro.id_registro} className="border-b border-[#27272a] py-4 last:border-0"><p className="text-xs font-medium text-[#71717a]">{formatDateOnly(registro.fecha_registro)}</p><p className="mt-2 text-sm leading-relaxed text-[#e4e4e7]">{registro.registro_seguimiento}</p></div>) : <p className="py-8 text-center text-sm text-[#71717a]">No hay comentarios de seguimiento registrados.</p>}
                            </Panel>
                            <Panel title="Evidencias disponibles" icon={FileImage}>
                                {evidencias.length ? evidencias.map((evidencia) => <a key={evidencia.label} href={evidencia.url} target="_blank" rel="noreferrer" className="flex items-center gap-4 border-b border-[#27272a] py-4 last:border-0 hover:text-white"><div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#18181b]"><FileImage className="h-5 w-5" /></div><div><p className="text-sm font-medium">{evidencia.label}</p><p className="mt-1 text-xs text-[#71717a]">Abrir archivo en una nueva pestaña</p></div></a>) : <p className="py-8 text-center text-sm text-[#71717a]">No hay evidencias fotográficas registradas.</p>}
                                {seguimiento?.nota_de_cierre && <div className="mt-4 rounded-lg border border-[#3f3f46] bg-[#111112] p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#71717a]">Nota de cierre</p><p className="mt-2 text-sm leading-relaxed">{seguimiento.nota_de_cierre}</p></div>}
                            </Panel>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

function LoadingState() {
    return <div className="flex min-h-[70vh] items-center justify-center bg-black text-white"><div className="text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-[#d4d4d8]" /><p className="mt-4 text-sm text-[#71717a]">Construyendo expediente externo…</p></div></div>;
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CalendarDays }) {
    return <div className="flex min-w-0 gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#a1a1aa]" /><div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-[#71717a]">{label}</p><p className="mt-1 truncate text-sm font-medium" title={value}>{value}</p></div></div>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock3 }) {
    return <div className="flex items-center gap-4 rounded-xl border border-[#3f3f46] bg-[#0d0d0e] p-5 print:border-black print:bg-white"><div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#18181b] print:bg-white"><Icon className="h-5 w-5" /></div><div><p className="text-xs text-[#a1a1aa] print:text-black">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div></div>;
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof UsersRound; children: ReactNode }) {
    return <section className="rounded-xl border border-[#3f3f46] bg-[#0d0d0e] p-5 print:border-black print:bg-white"><div className="flex items-center gap-3 border-b border-[#27272a] pb-4 print:border-black"><Icon className="h-5 w-5" /><h2 className="font-semibold">{title}</h2></div><div className="pt-1">{children}</div></section>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return <div className="grid grid-cols-[120px_1fr] gap-4 border-b border-[#27272a] py-3 text-sm last:border-0 print:border-black"><span className="text-[#71717a] print:text-black">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

function Timeline({ items }: { items: TimelineItem[] }) {
    return (
        <section className="rounded-xl border border-[#3f3f46] bg-[#0d0d0e] p-5 md:p-6 print:border-black print:bg-white">
            <div className="border-b border-[#27272a] pb-4 print:border-black"><h2 className="text-lg font-semibold">Línea de tiempo</h2><p className="mt-1 text-sm text-[#71717a] print:text-black">Historial reconstruido con los registros disponibles.</p></div>
            {items.length ? <div className="mt-2">{items.map((item, index) => { const Icon = timelineIcon[item.tipo]; return <div key={item.id} className="relative grid grid-cols-[38px_1fr] gap-3 pb-1"><div className="relative flex justify-center">{index < items.length - 1 && <span className="absolute bottom-0 top-8 w-px bg-[#3f3f46]" />}<span className="z-10 mt-5 flex h-7 w-7 items-center justify-center rounded-full border border-[#52525b] bg-[#111112] print:bg-white"><Icon className="h-3.5 w-3.5" /></span></div><div className="border-b border-[#27272a] py-5 last:border-0 print:border-black"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-sm font-semibold">{item.titulo}</h3><time className="text-xs text-[#71717a] print:text-black">{formatDateOnly(item.fecha)}</time></div><p className="mt-2 text-sm leading-relaxed text-[#a1a1aa] print:text-black">{item.detalle}</p></div></div>; })}</div> : <EmptyState icon={Clock3} title="Sin movimientos registrados" text="Todavía no existen eventos para reconstruir la línea de tiempo." />}
        </section>
    );
}

function ResumenMateriales({ materiales, total }: { materiales: MaterialResumen[]; total: number }) {
    return <Panel title="Resumen de materiales" icon={Package}>{materiales.length ? <><div>{materiales.map((material) => <div key={`${material.codigo}-${material.costoUnitario}`} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#27272a] py-3 text-sm last:border-0"><div><p className="font-medium">{material.descripcion}</p><p className="mt-1 font-mono text-xs text-[#71717a]">{material.codigo} · {material.cantidad.toLocaleString('es-CR')} {material.unidad}</p></div><span className="font-mono text-xs font-semibold">{money(material.costoTotal)}</span></div>)}</div><div className="mt-3 flex justify-between border-t border-[#52525b] pt-4 text-sm font-semibold"><span>Total acumulado</span><span className="font-mono">{money(total)}</span></div></> : <p className="py-8 text-center text-sm text-[#71717a]">Sin materiales registrados.</p>}</Panel>;
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Package; title: string; text: string }) {
    return <div className="flex min-h-60 flex-col items-center justify-center px-6 text-center"><Icon className="h-9 w-9 text-[#52525b]" /><p className="mt-4 font-semibold">{title}</p><p className="mt-1 text-sm text-[#71717a]">{text}</p></div>;
}
