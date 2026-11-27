import type { RespuestaAsistente } from './asistenteSdmoConsulta';

export const monedaAsistente = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 2 });

export function textoParaCopiarResumen(respuesta: RespuestaAsistente): string | null {
    if (!respuesta.esResumen || !respuesta.expediente) return null;
    const lineas = [respuesta.mensaje];
    for (const { etiqueta, valor } of respuesta.detalles ?? []) lineas.push(`${etiqueta}: ${valor}`);
    if (respuesta.materiales?.length) {
        lineas.push('');
        for (const material of respuesta.materiales) {
            lineas.push(`- ${material.cantidad} × ${material.nombre} (${material.codigo}): ${monedaAsistente.format(material.subtotal)}`);
        }
        const total = respuesta.materiales.reduce((importe, material) => importe + material.subtotal, 0);
        lineas.push(`Total registrado: ${monedaAsistente.format(total)}`);
    }
    return lineas.join('\n');
}
