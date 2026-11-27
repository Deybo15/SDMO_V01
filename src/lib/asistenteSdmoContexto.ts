import type { RespuestaAsistente } from './asistenteSdmoConsulta';

export function actualizarContexto(anterior: string | undefined, respuesta: RespuestaAsistente): string | undefined {
    if (respuesta.accesoDenegado || respuesta.solicitudNoDisponible || respuesta.coincidencias?.length) return undefined;
    return respuesta.expediente?.numero ?? anterior;
}
