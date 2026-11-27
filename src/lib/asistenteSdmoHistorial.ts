import type { RespuestaAsistente } from './asistenteSdmoConsulta';

export type ConsultaReciente = { id: number; pregunta: string; respuesta: RespuestaAsistente };

export function registrarConsultaReciente(historial: ConsultaReciente[], consulta: ConsultaReciente): ConsultaReciente[] {
    if (!consulta.respuesta.expediente && !consulta.respuesta.coincidencias?.length) return historial;
    return [consulta, ...historial].slice(0, 5);
}
