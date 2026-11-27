import { supabase } from './supabase';
import { formatDateOnly } from './utils';

type Material = { codigo: string; nombre: string; cantidad: number; subtotal: number };
export type CoincidenciaSolicitud = {
    numero: string;
    fecha: string | null;
    estado: string;
    extracto: string;
};
export type RespuestaAsistente = {
    mensaje: string;
    expediente?: { numero: string; estado: string; descripcion: string };
    materiales?: Material[];
    detalles?: { etiqueta: string; valor: string }[];
    coincidencias?: CoincidenciaSolicitud[];
    esResumen?: true;
    accesoDenegado?: true;
    solicitudNoDisponible?: true;
};

const sinAcceso = { mensaje: 'Esta cuenta no tiene acceso al piloto.', accesoDenegado: true } as const;

type ResultadoPiloto = {
    habilitado: boolean;
    expediente?: RespuestaAsistente['expediente'] | null;
    materiales?: Material[] | null;
    fechas?: { registro: string | null; cierre: string | null } | null;
    ultima_actualizacion?: { fecha: string | null; nota: string | null } | null;
    supervisor?: { asignado: boolean; nombre: string | null };
};

function fechaOMensaje(fecha: string | null | undefined, mensaje: string) {
    const formateada = formatDateOnly(fecha);
    return formateada === '—' ? mensaje : formateada;
}

const palabrasComunes = new Set('el la los las un una unos unas de del al en con sobre para por y e o que se su sus algun alguna algunas algunos haya hay relacion relacionadas relacionados solicitud solicitudes interna internas descripcion texto trata traten acerca tema temas donde dice digan diga'.split(' '));
const ayudaBusqueda = 'Escribe de una a seis palabras de la descripción. Por ejemplo: «Busca solicitudes sobre luces del parque».';

export function interpretarBusqueda(pregunta: string): string[] | null {
    const texto = pregunta.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^[¿¡\s]+/, '');
    const coincidencia = texto.match(/^(?:(?:busca(?:r|me)?|busque|encuentra(?:me)?|encontrar)\b|(?:hay|existe(?:n)?)\s+(?:alguna[s]?\s+|una\s+)?solicitud(?:es)?\b)(.*)$/s);
    if (!coincidencia) return null;
    const palabras = [...new Set((coincidencia[1].match(/[a-z0-9]+/g) ?? [])
        .filter(palabra => palabra.length >= 2 && !palabrasComunes.has(palabra)))];
    return palabras.length <= 6 && palabras.every(palabra => palabra.length <= 40)
        && palabras.some(palabra => palabra.length >= 3 && /[a-z]/.test(palabra)) ? palabras : [];
}

async function buscarPorDescripcion(palabras: string[], signal: AbortSignal): Promise<RespuestaAsistente> {
    if (!palabras.length) return { mensaje: ayudaBusqueda };
    const { data, error } = await supabase.rpc('sdmo_asistente_buscar_piloto', { p_palabras: palabras }).abortSignal(signal);
    if (error?.code === '42501') return sinAcceso;
    if (error) throw error;
    const resultado = data as { habilitado: boolean; entrada_valida?: boolean; coincidencias?: CoincidenciaSolicitud[] } | null;
    if (resultado?.habilitado !== true) return sinAcceso;
    if (resultado.entrada_valida === false) return { mensaje: ayudaBusqueda };
    const coincidencias = resultado.coincidencias ?? [];
    return {
        mensaje: coincidencias.length ? 'Coincidencias más recientes. Selecciona una solicitud para consultarla.'
            : 'No encontré solicitudes con todas esas palabras. Intenta con menos palabras o con otro término.',
        coincidencias
    };
}

export function interpretarConsulta(pregunta: string, numeroEnContexto?: string) {
    const texto = pregunta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/\b(cambia(?:r)?|actualiza(?:r)?|borra(?:r)?|elimina(?:r)?|registra(?:r)?|cierra|cerrar|asigna(?:r)?|cancela(?:r)?)\b/.test(texto)) {
        return { mensaje: 'El asistente es de solo consulta y no puede modificar solicitudes.' };
    }
    const mencionaOtroRol = /\b(?:solicitante|profesional|cliente|tecnic[oa]|registrador|autor)\b|\bquien (?:la (?:creo|registro|cerro|solicito)|(?:creo|registro|cerro|solicito|escribio))\b/.test(texto);
    const supervisor = !mencionaOtroRol && /\b(?:supervisor(?:a)?|supervisa|supervisando)\b|\b(?:quien (?:esta|queda|quedo|se encuentra) (?:a cargo|asignad[oa])|a quien (?:se le asigno|esta asignada)|quien tiene (?:a cargo|asignada|la solicitud asignada))\b/.test(texto);
    if (!supervisor && /\bquien(?:es)?\b/.test(texto)) {
        return { mensaje: 'Por ahora solo puedo identificar al supervisor asignado. Para otros nombres, consulta el expediente.' };
    }
    const numeros = [...new Set(texto.match(/\b\d+\b/g) ?? [])];
    const materiales = /\b(material(?:es)?|articulos?|insumos?|consumo|cost[eo]s?|gastos?|total|cuanto (?:se )?(?:gasto|costo|salio))\b/.test(texto);
    const fechas = /\bfechas\b|\bfecha (?:de (?:la )?)?(?:solicitud|registro|ingreso|apertura|creacion|finalizacion|cierre)\b|\bcuando (?:se )?(?:registro|ingreso|creo|abrio|cerro|finalizo|termino)\b/.test(texto);
    const actualizacion = /\b(?:ultima|ultimo) (?:registro|actualizacion|nota|novedad|anotacion|seguimiento|movimiento)\b|\b(?:registro|actualizacion|nota|novedad|anotacion|movimiento) mas reciente\b|\b(?:que|cuando) se actualizo\b/.test(texto);
    const estado = /\b(estado|como (?:va|esta)|activ[ao]|terminad[ao]|ejecutad[ao]|cerrad[ao]|cancelad[ao])\b/.test(texto)
        || (!fechas && !actualizacion && /\bseguimiento\b/.test(texto));
    const pideOtraSolicitud = /\b(?:otr[ao]|siguiente|anterior|distint[ao]|diferente)\b/.test(texto) || /#\s*(?!\d)[^\d]*$/.test(texto);
    const referencia = numeros[0] ?? (!pideOtraSolicitud ? numeroEnContexto : undefined);
    const numero = Number(referencia);
    if (numeros.length > 1 || !Number.isSafeInteger(numero) || numero <= 0) {
        return { mensaje: 'Indica un solo número válido de solicitud interna.' };
    }
    const pideCampo = materiales || estado || fechas || actualizacion || supervisor;
    const resumen = !pideCampo && /\bresumen\b/.test(texto);
    return {
        numero, resumen, materiales: resumen || materiales, estado: resumen || estado,
        fechas: resumen || fechas, actualizacion: resumen || actualizacion, supervisor: resumen || supervisor,
        requiereIA: !resumen && !pideCampo
    };
}

export async function verificarAccesoPiloto(signal: AbortSignal) {
    const { data, error } = await supabase.rpc('sdmo_asistente_piloto', {}, { get: true }).abortSignal(signal);
    return !error && (data as ResultadoPiloto | null)?.habilitado === true;
}

export async function consultarSolicitudInterna(pregunta: string, signal: AbortSignal, numeroEnContexto?: string): Promise<RespuestaAsistente> {
    const palabras = interpretarBusqueda(pregunta);
    if (palabras !== null) return buscarPorDescripcion(palabras, signal);
    const consulta = interpretarConsulta(pregunta, numeroEnContexto);
    if (consulta.numero === undefined) return { mensaje: consulta.mensaje };
    const { numero } = consulta;
    let { estado, materiales, fechas, actualizacion } = consulta;
    if (consulta.requiereIA) {
        if ((import.meta.env.DEV || import.meta.env.VITE_SDMO_ASISTENTE_PRIVADO === 'true')
            && import.meta.env.VITE_SDMO_IA_EXTERNA === 'true' && !signal.aborted) {
            try {
                const { data, error } = await supabase.functions.invoke<{ intencion: unknown }>('sdmo-intencion', {
                    body: { texto: pregunta.slice(0, 240) }, signal, timeout: 12000
                });
                if (!error) {
                    estado = data?.intencion === 'estado' || data?.intencion === 'estado_y_materiales';
                    materiales = data?.intencion === 'materiales' || data?.intencion === 'costo_total' || data?.intencion === 'estado_y_materiales';
                    fechas = data?.intencion === 'fechas' || data?.intencion === 'fechas_y_actualizacion';
                    actualizacion = data?.intencion === 'ultima_actualizacion' || data?.intencion === 'fechas_y_actualizacion';
                }
            } catch {
                // El asistente sigue ofreciendo sus consultas normales.
            }
        }
        signal.throwIfAborted();
        if (!estado && !materiales && !fechas && !actualizacion) return { mensaje: 'No pude interpretar esa pregunta. Prueba con resumen, estado, supervisor, fechas, última actualización, materiales o costo total.' };
    }
    const parametros = { p_numero: numero, p_materiales: materiales };
    const { data, error } = await (consulta.supervisor || fechas || actualizacion
        ? supabase.rpc(consulta.supervisor ? 'sdmo_asistente_supervision_piloto' : 'sdmo_asistente_seguimiento_piloto', {
            ...parametros, p_fechas: fechas, p_ultima_actualizacion: actualizacion
        }, { get: true })
        : supabase.rpc('sdmo_asistente_piloto', parametros, { get: true })).abortSignal(signal);
    if (error?.code === '42501') return sinAcceso;
    if (error) throw error;
    const resultado = data as ResultadoPiloto | null;
    if (resultado?.habilitado !== true) return sinAcceso;
    const expediente = resultado.expediente;
    if (!expediente) return { mensaje: 'La solicitud interna no está disponible para tu perfil o no existe.', solicitudNoDisponible: true };
    const resumenEstado = `Estado: ${expediente.estado}.`;
    const detalles: NonNullable<RespuestaAsistente['detalles']> = [];
    if (consulta.resumen) detalles.push({ etiqueta: 'Estado', valor: expediente.estado });
    if (consulta.supervisor) {
        const asignacion = resultado.supervisor;
        detalles.push({
            etiqueta: 'Supervisor asignado',
            valor: !asignacion ? 'No se pudo verificar la asignación.'
                : asignacion.asignado ? asignacion.nombre || 'Hay una asignación, pero el nombre no está disponible.'
                    : 'No hay supervisor asignado.'
        });
    }
    if (fechas) {
        detalles.push(
            { etiqueta: 'Fecha de registro', valor: fechaOMensaje(resultado.fechas?.registro, 'Sin fecha registrada') },
            { etiqueta: 'Fecha de cierre', valor: fechaOMensaje(resultado.fechas?.cierre, 'Sin fecha de cierre registrada') }
        );
    }
    if (actualizacion) {
        const ultima = resultado.ultima_actualizacion;
        const nota = ultima?.nota?.trim();
        detalles.push({
            etiqueta: 'Última actualización registrada',
            valor: ultima
                ? `${fechaOMensaje(ultima.fecha, 'Sin fecha registrada')} · ${nota || 'Sin nota registrada'}`
                : 'No hay actualizaciones de seguimiento registradas.'
        });
    }
    if (!materiales) return { mensaje: estado ? resumenEstado : 'Datos de seguimiento', expediente, detalles };

    const consolidado = resultado.materiales;
    const mensaje = !Array.isArray(consolidado) ? 'No se pudieron verificar todos los importes o cantidades. Revisa el expediente.'
        : consolidado.length ? 'Materiales registrados' : 'Esta solicitud no tiene materiales registrados.';
    if (consulta.resumen) {
        detalles.push({ etiqueta: 'Materiales', valor: mensaje });
        return { mensaje: `Resumen de la solicitud #${expediente.numero}`, expediente, detalles, materiales: consolidado ?? undefined, esResumen: true };
    }
    return { mensaje: estado ? `${resumenEstado} ${mensaje}` : mensaje, expediente, detalles, materiales: consolidado ?? undefined };
}
