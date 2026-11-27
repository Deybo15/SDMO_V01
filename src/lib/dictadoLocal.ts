export const idiomaDictadoLocal = 'es-ES';
export const esperaFinalDictadoMs = 8000;

export type ResultadoVoz = ArrayLike<{ transcript: string }> & { isFinal: boolean };

export function separarTranscripcion(resultados: ArrayLike<ResultadoVoz>) {
    const final: string[] = [];
    const provisional: string[] = [];
    for (const resultado of Array.from(resultados)) {
        const texto = resultado[0]?.transcript.trim();
        if (texto) (resultado.isFinal ? final : provisional).push(texto);
    }
    return { final: final.join(' '), provisional: provisional.join(' ') };
}

export function unirTextoDictado(...partes: string[]) {
    return partes.map(parte => parte.trim()).filter(Boolean).join(' ');
}

export function diagnosticarDictadoSinTexto(capturaIniciada: boolean, vozDetectada: boolean) {
    if (vozDetectada) return 'El navegador detectó voz, pero no pudo convertirla a texto en el dispositivo. Reintenta con una frase corta o escribe.';
    if (capturaIniciada) return 'El micrófono se activó, pero el navegador no detectó voz. Revisa el micrófono seleccionado y vuelve a hablar.';
    return 'El navegador no confirmó la captura de audio. Revisa el permiso del micrófono o prueba en un navegador externo.';
}

export type DisponibilidadDictado = 'available' | 'downloadable' | 'downloading' | 'unavailable';
type OpcionesLocales = { langs: string[]; processLocally: true };

export type ApiDictadoLocal = {
    available?: (opciones: OpcionesLocales) => Promise<DisponibilidadDictado>;
    install?: (opciones: OpcionesLocales) => Promise<boolean>;
};

export async function verificarDictadoLocal(api: ApiDictadoLocal) {
    return api.available?.({ langs: [idiomaDictadoLocal], processLocally: true }) ?? Promise.resolve('unavailable' as const);
}

export function instalarDictadoLocal(api: ApiDictadoLocal) {
    return api.install?.({ langs: [idiomaDictadoLocal], processLocally: true }) ?? Promise.resolve(false);
}

export function exigirDictadoLocal(sesion: { processLocally?: boolean }): boolean {
    // Do not add an expando to older browsers: they would still use their default service.
    if (typeof sesion.processLocally !== 'boolean') return false;
    try {
        sesion.processLocally = true;
        return sesion.processLocally === true;
    } catch {
        return false;
    }
}
