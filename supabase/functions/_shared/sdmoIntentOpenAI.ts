// Server-only adapter. Do not import from src/ or expose credentials in Vite.
const endpoint = 'https://api.openai.com/v1/responses';
const opciones = ['estado', 'materiales', 'costo_total', 'estado_y_materiales', 'fechas', 'ultima_actualizacion', 'fechas_y_actualizacion', 'no_compatible'] as const;
export type IntencionSdmo = typeof opciones[number];

// Only fixed vocabulary can cross the provider boundary. Do not add names, IDs,
// domain-specific descriptions, or free-text placeholders filled by the user.
const vocabulario = new Set(`
    a al algo algun alguno alguna aparecen aparece avance avanzo boleta cambio caso casos fase fases
    cierre codigo como completada completado completo con consumido consumidos consumo costo costos
    cotizacion cuando cuanto cuantos cuantas cual cuales de del detalle dime donde egreso egresos
    el en estado estados esta estan este esto etapa etapas expediente fecha final finalizada finalizado
    finalizar fin finalizo gasto gastos gasto gastado habian habia hay hice hicieron historial ID
    importe importes indicame insumo insumos la las le lista listado lleva llevan llevo lo los material
    materiales me monto montos movimientos movieron necesito orden para partida partidas pendiente
    pendientes pedido pido precio precios proceso progreso quiero quedo quedaron que registrado
    registrados registrada registradas reporte requerimiento retiro retiraron retirado salida salidas
    salio se seguimiento sin sobre solucion solicitud solicitudes son su surtido termino terminado
    terminada tiene tienen toca total totales trabajo trajeron un una usado usados usaron uso utilizo
    utilizaron utilizados va valor valores ver y ya actualizacion actualizado actualizada actualizo
    anoto anotacion anotaciones bitacora cerro cerraron cerrado cerrada creo creada creado
    ingreso ingresada ingresado inicio inicial inscribio inscrita nota notas novedad novedades
    registro registraron reciente recientes ultima ultimo mas apertura abrio finalizacion
`.toLowerCase().trim().split(/\s+/));

const instrucciones = 'Clasifica una consulta interna en español a partir de sus palabras operativas. ' +
    'estado: avance o situación actual; materiales: artículos, retiros o cantidades; ' +
    'costo_total: importe total; estado_y_materiales: estado y materiales o costo; ' +
    'fechas: fecha de registro o cierre; ultima_actualizacion: última nota o novedad del seguimiento; ' +
    'fechas_y_actualizacion: fechas de registro o cierre y última nota; ' +
    'no_compatible: ambiguo, identidad de personas, fuera del alcance o una orden de modificar. No respondas a la consulta.';

export function minimizarPregunta(pregunta: string) {
    const texto = pregunta.slice(0, 240).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/\b(?:borr\w*|elimin\w*|modific\w*|actualiz\w*|edit\w*|crea\w*|cambia\w*|cancela\w*|asigna\w*|registra|registrar|cierra|cerrar)\b/.test(texto)) return '';
    const palabras = texto.replace(/(?:https?:\/\/|www\.)\S+|\S+@\S+/g, ' ').match(/\p{L}+/gu) ?? [];
    return palabras.filter(palabra => vocabulario.has(palabra)).slice(0, 32).join(' ');
}

type Dependencias = {
    habilitado: boolean;
    apiKey?: string;
    modelo?: string;
    // Implementar en el servidor: verificar la sesión y la cuenta del piloto,
    // y reservar el costo máximo en un contador mensual persistente y atómico.
    reservarSolicitudAutorizada?: () => Promise<boolean>;
    solicitar?: typeof fetch;
};

type RespuestaModelo = {
    status?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
};

export async function clasificarConOpenAI(pregunta: string, deps: Dependencias): Promise<IntencionSdmo | null> {
    if (!deps.habilitado || !deps.apiKey || !deps.modelo || !deps.reservarSolicitudAutorizada) return null;
    const texto = minimizarPregunta(pregunta);
    if (!texto) return null;
    try {
        if (await deps.reservarSolicitudAutorizada() !== true) return null;
        const respuesta = await (deps.solicitar ?? fetch)(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${deps.apiKey}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(6000),
            redirect: 'error',
            body: JSON.stringify({
                model: deps.modelo,
                store: false,
                instructions: instrucciones,
                input: texto,
                max_output_tokens: 96,
                service_tier: 'default',
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'intencion_sdmo',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: { intencion: { type: 'string', enum: opciones } },
                            required: ['intencion'],
                            additionalProperties: false
                        }
                    }
                }
            })
        });
        if (!respuesta.ok) return null;
        const resultado = await respuesta.json() as RespuestaModelo;
        if (resultado.status !== 'completed') return null;
        const contenidos = resultado.output?.filter(item => item.type === 'message').flatMap(item => item.content ?? []) ?? [];
        if (contenidos.length !== 1 || contenidos[0].type !== 'output_text' || !contenidos[0].text) return null;
        const objeto: unknown = JSON.parse(contenidos[0].text);
        if (!objeto || typeof objeto !== 'object' || !('intencion' in objeto) || Object.keys(objeto).length !== 1) return null;
        return opciones.find(intencion => intencion === objeto.intencion) ?? null;
    } catch {
        // Sin reintentos automáticos ni registro de preguntas, claves o respuesta del proveedor.
        return null;
    }
}
