import { useEffect, useRef, useState } from 'react';
import { Copy, History, Mic, Send, Sparkles, Square, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { preguntasDemo, responderDemo } from '../lib/asistenteSdmoDemo';
import { consultarSolicitudInterna, verificarAccesoPiloto, type CoincidenciaSolicitud, type RespuestaAsistente } from '../lib/asistenteSdmoConsulta';
import { formatDateOnly } from '../lib/utils';
import { monedaAsistente as moneda, textoParaCopiarResumen } from '../lib/asistenteSdmoResumen';
import { registrarConsultaReciente, type ConsultaReciente } from '../lib/asistenteSdmoHistorial';
import { actualizarContexto } from '../lib/asistenteSdmoContexto';
import { supabase } from '../lib/supabase';
import { diagnosticarDictadoSinTexto, esperaFinalDictadoMs, exigirDictadoLocal, idiomaDictadoLocal, instalarDictadoLocal, separarTranscripcion, unirTextoDictado, verificarDictadoLocal, type ApiDictadoLocal, type ResultadoVoz } from '../lib/dictadoLocal';

const limitePregunta = 240;

type ReconocimientoVoz = {
    lang: string;
    processLocally?: boolean;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onstart: (() => void) | null;
    onaudiostart: (() => void) | null;
    onaudioend: (() => void) | null;
    onspeechstart: (() => void) | null;
    onspeechend: (() => void) | null;
    onnomatch: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onresult: ((event: { results: ArrayLike<ResultadoVoz> }) => void) | null;
};

type ConstructorDictado = (new () => ReconocimientoVoz) & ApiDictadoLocal;
type NavegadorConDictado = Window & {
    SpeechRecognition?: ConstructorDictado;
    webkitSpeechRecognition?: ConstructorDictado;
};

function cancelarDictado(ref: { current: ReconocimientoVoz | null }) {
    const sesion = ref.current;
    ref.current = null;
    sesion?.abort();
}

const erroresDictado: Partial<Record<string, string>> = {
    'not-allowed': 'No se pudo usar el micrófono. Revisa el permiso del sitio o escribe tu pregunta.',
    'service-not-allowed': 'El navegador no permite usar su servicio de dictado. Puedes escribir tu pregunta.',
    'audio-capture': 'No se encontró un micrófono disponible.',
    'no-speech': 'No se detectó voz. Intenta de nuevo.',
    'network': 'No se pudo conectar con el servicio de dictado del navegador.',
    'language-not-supported': 'El navegador no admite el dictado en español (Costa Rica).'
};

export default function AsistenteSdmoDemo({ datosReales = false }: { datosReales?: boolean }) {
    const [habilitado, setHabilitado] = useState(false);

    useEffect(() => {
        if (!datosReales) return;
        let control: AbortController | undefined;
        let comprobacion: ReturnType<typeof setTimeout> | undefined;
        let usuarioComprobado: string | undefined;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, sesion) => {
            if (evento !== 'INITIAL_SESSION' && evento !== 'SIGNED_IN' && evento !== 'SIGNED_OUT' && evento !== 'USER_UPDATED') return;
            const usuario = sesion?.user.id;
            if (evento === 'SIGNED_IN' && usuario === usuarioComprobado) return;
            usuarioComprobado = usuario;
            control?.abort();
            clearTimeout(comprobacion);
            setHabilitado(false);
            if (!sesion) return;
            const intento = new AbortController();
            control = intento;
            comprobacion = setTimeout(() => {
                void verificarAccesoPiloto(intento.signal).then(acceso => {
                    if (!intento.signal.aborted) setHabilitado(acceso);
                }).catch(() => { /* Sin verificación, el piloto permanece oculto. */ });
            }, 0);
        });
        return () => {
            subscription.unsubscribe();
            clearTimeout(comprobacion);
            control?.abort();
        };
    }, [datosReales]);

    if (datosReales && !habilitado) return null;
    return <PanelAsistenteSdmo datosReales={datosReales} />;
}

function PanelAsistenteSdmo({ datosReales }: { datosReales: boolean }) {
    const dialogo = useRef<HTMLDialogElement>(null);
    const activador = useRef<HTMLButtonElement>(null);
    const campoPregunta = useRef<HTMLInputElement>(null);
    const reconocimiento = useRef<ReconocimientoVoz | null>(null);
    const plazoDictado = useRef<ReturnType<typeof setTimeout>>();
    const esperarResultado = useRef<(() => void) | null>(null);
    const usarTextoDictado = useRef<(() => void) | null>(null);
    const consultaPendiente = useRef<AbortController | null>(null);
    const preparacionDictado = useRef<AbortController | null>(null);
    const [entrada, setEntrada] = useState('');
    const [pregunta, setPregunta] = useState('');
    const [respuestaReal, setRespuestaReal] = useState<RespuestaAsistente | null>(null);
    const [numeroEnContexto, setNumeroEnContexto] = useState<string>();
    const [historial, setHistorial] = useState<ConsultaReciente[]>([]);
    const secuenciaConsulta = useRef(0);
    const [copiaResumen, setCopiaResumen] = useState<{ respuesta: RespuestaAsistente; manual: boolean } | null>(null);
    const intentoCopia = useRef(0);
    const [consultando, setConsultando] = useState(false);
    const [faseDictado, setFaseDictado] = useState<'inactivo' | 'iniciando' | 'escuchando' | 'procesando'>('inactivo');
    const [mensajeDictado, setMensajeDictado] = useState('');
    const [textoReconocido, setTextoReconocido] = useState('');
    const [preparandoDictado, setPreparandoDictado] = useState(false);
    const [ofrecerInstalacion, setOfrecerInstalacion] = useState(false);
    const dictando = faseDictado !== 'inactivo';
    const navegador = window as NavegadorConDictado;
    const Dictado = navegador.SpeechRecognition ?? navegador.webkitSpeechRecognition;
    const puedeDictar = Boolean(Dictado && (!datosReales || typeof Dictado.available === 'function'));
    const respuesta = datosReales ? respuestaReal : pregunta ? responderDemo(pregunta) : null;
    const materiales = respuesta?.materiales ?? [];
    const textoResumen = respuestaReal ? textoParaCopiarResumen(respuestaReal) : null;
    const copiaActual = copiaResumen?.respuesta === respuestaReal ? copiaResumen : null;

    async function copiarResumen() {
        if (!respuestaReal || textoResumen === null) return;
        const intento = ++intentoCopia.current;
        try {
            await navigator.clipboard.writeText(textoResumen);
            if (intento === intentoCopia.current) setCopiaResumen({ respuesta: respuestaReal, manual: false });
        } catch {
            if (intento === intentoCopia.current) setCopiaResumen({ respuesta: respuestaReal, manual: true });
        }
    }

    function seleccionarSolicitud(coincidencia: CoincidenciaSolicitud) {
        setNumeroEnContexto(coincidencia.numero);
        setRespuestaReal({
            mensaje: `Solicitud #${coincidencia.numero} seleccionada. Puedes pedir un resumen o hacer una pregunta sobre ella.`,
            expediente: { numero: coincidencia.numero, estado: coincidencia.estado, descripcion: coincidencia.extracto }
        });
        campoPregunta.current?.focus();
    }

    function volverAConsulta(consulta: ConsultaReciente) {
        intentoCopia.current += 1;
        setCopiaResumen(null);
        setPregunta(consulta.pregunta);
        setRespuestaReal(consulta.respuesta);
        setNumeroEnContexto(actualizarContexto(undefined, consulta.respuesta));
    }

    useEffect(() => () => {
        clearTimeout(plazoDictado.current);
        cancelarDictado(reconocimiento);
        preparacionDictado.current?.abort();
        consultaPendiente.current?.abort();
    }, []);

    async function prepararIdioma() {
        if (!Dictado || preparacionDictado.current) return;
        const control = new AbortController();
        preparacionDictado.current = control;
        setPreparandoDictado(true);
        setMensajeDictado('Preparando el paquete de español…');
        let instalado = false;
        try {
            instalado = await instalarDictadoLocal(Dictado);
        } catch {
            // The browser can block installation; text remains available.
        }
        if (control.signal.aborted) return;
        preparacionDictado.current = null;
        setPreparandoDictado(false);
        setOfrecerInstalacion(!instalado);
        setMensajeDictado(instalado ? 'Español listo. Pulsa el micrófono para dictar.' : 'No se pudo preparar el paquete de español. Puedes escribir tu pregunta.');
    }

    async function alternarDictado() {
        if (reconocimiento.current) {
            if (faseDictado === 'iniciando' || faseDictado === 'procesando') {
                clearTimeout(plazoDictado.current);
                esperarResultado.current = null;
                usarTextoDictado.current = null;
                cancelarDictado(reconocimiento);
                setTextoReconocido('');
                setFaseDictado('inactivo');
                setMensajeDictado('Dictado cancelado. Puedes volver a intentarlo o escribir.');
            } else {
                esperarResultado.current?.();
            }
            return;
        }
        if (!Dictado || !puedeDictar || preparacionDictado.current) return;
        if (datosReales) {
            const control = new AbortController();
            preparacionDictado.current = control;
            setPreparandoDictado(true);
            setMensajeDictado('Comprobando si el dictado local está disponible…');
            const estado = await verificarDictadoLocal(Dictado).catch(() => 'unavailable' as const);
            if (control.signal.aborted) return;
            preparacionDictado.current = null;
            setPreparandoDictado(false);
            setOfrecerInstalacion(estado === 'downloadable' && typeof Dictado.install === 'function');
            if (estado !== 'available') {
                setMensajeDictado(estado === 'downloading'
                    ? 'El navegador está preparando el español. Intenta de nuevo cuando termine.'
                    : estado === 'downloadable' && typeof Dictado.install === 'function'
                        ? 'Prepara el paquete de español para dictar sin enviar el audio.'
                        : 'El dictado local en español no está disponible. Puedes escribir tu pregunta.');
                return;
            }
        }

        let sesion: ReconocimientoVoz;
        try {
            sesion = new Dictado();
            if (datosReales && !exigirDictadoLocal(sesion)) {
                setMensajeDictado('El navegador no admite dictado local seguro. Puedes escribir tu pregunta.');
                return;
            }
        } catch {
            setMensajeDictado('No se pudo preparar el micrófono. Puedes escribir tu pregunta.');
            return;
        }
        sesion.lang = datosReales ? idiomaDictadoLocal : 'es-CR';
        sesion.continuous = false;
        sesion.interimResults = true;
        reconocimiento.current = sesion;
        setFaseDictado('iniciando');
        setMensajeDictado('Activando el micrófono…');
        setTextoReconocido('');
        let convirtiendo = false;
        let capturaIniciada = false;
        let vozDetectada = false;
        let borrador = { final: '', provisional: '' };

        function terminarDictado(detener: boolean, error?: string) {
            if (reconocimiento.current !== sesion) return;
            clearTimeout(plazoDictado.current);
            esperarResultado.current = null;
            usarTextoDictado.current = null;
            if (detener) cancelarDictado(reconocimiento);
            else reconocimiento.current = null;
            setFaseDictado('inactivo');
            setTextoReconocido('');
            const texto = unirTextoDictado(borrador.final, borrador.provisional);
            if (texto) {
                setEntrada(anterior => unirTextoDictado(anterior, texto).slice(0, limitePregunta));
                setMensajeDictado(borrador.provisional
                    ? 'El texto incluye un fragmento provisional. Revísalo antes de enviar.'
                    : 'Revisa el texto antes de enviarlo.');
                campoPregunta.current?.focus();
            } else if (error && error !== 'no-speech') {
                setMensajeDictado(datosReales && ['network', 'language-not-supported', 'service-not-allowed'].includes(error)
                    ? 'El navegador no pudo transcribir en el dispositivo. Puedes escribir tu pregunta.'
                    : erroresDictado[error] ?? 'El dictado se interrumpió. Puedes reintentar o escribir.');
            } else {
                setMensajeDictado(diagnosticarDictadoSinTexto(capturaIniciada, vozDetectada));
            }
        }

        function comenzarEspera() {
            if (reconocimiento.current !== sesion || convirtiendo) return;
            convirtiendo = true;
            setFaseDictado('procesando');
            setMensajeDictado('Finalizando el dictado…');
            clearTimeout(plazoDictado.current);
            plazoDictado.current = setTimeout(() => terminarDictado(true), esperaFinalDictadoMs);
        }

        function solicitarFin() {
            if (reconocimiento.current !== sesion || convirtiendo) return;
            comenzarEspera();
            try {
                sesion.stop();
            } catch {
                // The timeout restores the controls even if the browser cannot finish.
            }
        }

        esperarResultado.current = solicitarFin;
        usarTextoDictado.current = () => terminarDictado(true);
        sesion.onaudioend = comenzarEspera;

        sesion.onstart = () => {
            if (reconocimiento.current !== sesion || convirtiendo) return;
            setFaseDictado('escuchando');
            if (!capturaIniciada && !vozDetectada) setMensajeDictado('Esperando señal del micrófono…');
        };
        sesion.onaudiostart = () => {
            if (reconocimiento.current !== sesion || convirtiendo) return;
            capturaIniciada = true;
            if (!vozDetectada) setMensajeDictado('Micrófono activo. Di una pregunta corta.');
            clearTimeout(plazoDictado.current);
            plazoDictado.current = setTimeout(solicitarFin, vozDetectada ? 25000 : 12000);
        };
        sesion.onspeechstart = () => {
            if (reconocimiento.current !== sesion || convirtiendo) return;
            vozDetectada = true;
            setMensajeDictado('Voz detectada…');
            clearTimeout(plazoDictado.current);
            plazoDictado.current = setTimeout(solicitarFin, 25000);
        };
        sesion.onspeechend = solicitarFin;
        sesion.onnomatch = () => terminarDictado(true);
        sesion.onresult = event => {
            if (reconocimiento.current !== sesion) return;
            // Each event contains the running transcript, not just the newest words.
            borrador = separarTranscripcion(event.results);
            if (borrador.final && !borrador.provisional) {
                terminarDictado(true);
                return;
            }
            setTextoReconocido(unirTextoDictado(borrador.final, borrador.provisional).slice(0, limitePregunta));
        };
        sesion.onerror = event => terminarDictado(false, event.error);
        sesion.onend = () => terminarDictado(false);
        try {
            plazoDictado.current = setTimeout(() => terminarDictado(true), 15000);
            sesion.start();
        } catch {
            terminarDictado(true);
            setMensajeDictado('No se pudo iniciar el dictado. Puedes escribir tu pregunta.');
        }
    }

    const preguntar = async (texto: string) => {
        if (!texto.trim()) return;
        preparacionDictado.current?.abort();
        preparacionDictado.current = null;
        setPreparandoDictado(false);
        clearTimeout(plazoDictado.current);
        esperarResultado.current = null;
        usarTextoDictado.current = null;
        cancelarDictado(reconocimiento);
        setTextoReconocido('');
        setFaseDictado('inactivo');
        setMensajeDictado('');
        setPregunta(texto.trim());
        setEntrada('');
        if (!datosReales) return;

        consultaPendiente.current?.abort();
        const control = new AbortController();
        const id = ++secuenciaConsulta.current;
        consultaPendiente.current = control;
        setRespuestaReal(null);
        intentoCopia.current += 1;
        setCopiaResumen(null);
        setConsultando(true);
        try {
            const resultado = await consultarSolicitudInterna(texto.trim(), control.signal, numeroEnContexto);
            if (!control.signal.aborted) {
                setRespuestaReal(resultado);
                setNumeroEnContexto(anterior => actualizarContexto(anterior, resultado));
                setHistorial(anterior => resultado.accesoDenegado ? [] : registrarConsultaReciente(anterior, { id, pregunta: texto.trim(), respuesta: resultado }));
            }
        } catch {
            if (!control.signal.aborted) setRespuestaReal({ mensaje: 'No fue posible completar la consulta. Inténtalo de nuevo o abre el expediente desde Seguimiento.' });
        } finally {
            if (!control.signal.aborted) {
                consultaPendiente.current = null;
                setConsultando(false);
            }
        }
    };

    return (
        <>
            <button ref={activador} type="button" aria-haspopup="dialog" onClick={() => dialogo.current?.showModal()}
                className="inline-flex items-center gap-2 rounded-lg border border-[#71717a] bg-[#111112] px-4 py-3 text-sm font-semibold text-white hover:bg-[#18181b]">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Asistente IA
            </button>
            <dialog ref={dialogo} aria-labelledby="asistente-sdmo-titulo" onClose={() => {
                clearTimeout(plazoDictado.current);
                esperarResultado.current = null;
                usarTextoDictado.current = null;
                cancelarDictado(reconocimiento);
                setTextoReconocido('');
                preparacionDictado.current?.abort();
                preparacionDictado.current = null;
                setPreparandoDictado(false);
                setOfrecerInstalacion(false);
                consultaPendiente.current?.abort();
                consultaPendiente.current = null;
                setConsultando(false);
                if (datosReales) {
                    setRespuestaReal(null);
                    setNumeroEnContexto(undefined);
                    setHistorial([]);
                    intentoCopia.current += 1;
                    setCopiaResumen(null);
                    setPregunta('');
                    setEntrada('');
                }
                setFaseDictado('inactivo');
                setMensajeDictado('');
                activador.current?.focus();
            }}
                className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-md border-l border-[#3f3f46] bg-[#111112] p-0 text-[#f4f4f5] backdrop:bg-black/60">
                <div className="flex min-h-full flex-col">
                    <header className="flex items-center justify-between gap-4 border-b border-[#3f3f46] p-5">
                        <div>
                            <h2 id="asistente-sdmo-titulo" className="flex items-center gap-2 text-lg font-semibold">
                                <Sparkles className="h-5 w-5" aria-hidden="true" /> Asistente SDMO
                            </h2>
                            <p className="mt-1 text-xs text-[#a1a1aa]">{datosReales
                                ? `${import.meta.env.DEV ? 'Piloto local' : 'Acceso privado'} · Solo consulta · Datos reales`
                                : 'Demostración · Solo consulta · Datos ficticios'}</p>
                        </div>
                        <button type="button" aria-label="Cerrar asistente" onClick={() => dialogo.current?.close()}
                            className="rounded-lg border border-[#3f3f46] p-2 hover:bg-[#27272a]"><X className="h-5 w-5" aria-hidden="true" /></button>
                    </header>
                    <div className="flex-1 space-y-4 p-5">
                        <p className="text-sm text-[#a1a1aa]">{datosReales
                            ? 'Pide un resumen por número o busca una solicitud interna por palabras de su descripción. Los datos vienen del expediente.'
                            : 'Consulta el estado, los materiales o los costos de una solicitud. Esta prueba no usa IA ni consulta registros reales.'}</p>
                        {datosReales && historial.length > 0 ? (
                            <details className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-3 text-sm">
                                <summary className="cursor-pointer font-medium">
                                    <History className="mr-2 inline h-4 w-4" aria-hidden="true" />Consultas recientes ({historial.length})
                                </summary>
                                <p className="mt-2 text-xs text-[#a1a1aa]">Muestra respuestas anteriores sin volver a consultar. Se borra al cerrar el asistente.</p>
                                <ul className="mt-2 space-y-1">
                                    {historial.map(consulta => (
                                        <li key={consulta.id}>
                                            <button type="button" onClick={() => volverAConsulta(consulta)}
                                                disabled={consultando || dictando} aria-current={respuestaReal === consulta.respuesta ? 'true' : undefined}
                                                className="w-full rounded-md border border-[#3f3f46] px-2 py-1.5 text-left [overflow-wrap:anywhere] hover:bg-[#27272a] disabled:opacity-50">
                                                {consulta.pregunta}
                                                {consulta.respuesta.expediente ? <span className="ml-2 text-xs text-[#a1a1aa]">#{consulta.respuesta.expediente.numero}</span> : null}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        ) : null}
                        <div aria-live="polite" aria-atomic="true" className="space-y-3">
                            {pregunta ? <p className="ml-auto w-fit max-w-full break-words rounded-lg bg-[#27272a] px-3 py-2 text-sm">{pregunta}</p> : null}
                            {consultando ? <p className="text-sm text-[#a1a1aa]">Consultando solicitudes…</p> : null}
                            {respuesta ? (
                                <>
                                    <div className="space-y-3 rounded-lg border border-[#3f3f46] bg-[#18181b] p-4 text-sm">
                                        <p className="font-semibold">{respuesta.mensaje}</p>
                                        {respuestaReal?.coincidencias?.length ? (
                                            <ul className="space-y-2">
                                                {respuestaReal.coincidencias.map(coincidencia => (
                                                    <li key={coincidencia.numero}>
                                                        <button type="button" disabled={dictando || preparandoDictado}
                                                            onClick={() => seleccionarSolicitud(coincidencia)}
                                                            aria-label={`Seleccionar solicitud ${coincidencia.numero}`}
                                                            className="w-full space-y-1 rounded-lg border border-[#52525b] px-3 py-2 text-left hover:bg-[#27272a] disabled:opacity-50">
                                                            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                                                                <strong>#{coincidencia.numero}</strong>
                                                                <span className="text-xs text-[#a1a1aa]">{formatDateOnly(coincidencia.fecha)} · {coincidencia.estado}</span>
                                                            </span>
                                                            <span className="block text-xs text-[#d4d4d8] [overflow-wrap:anywhere]">{coincidencia.extracto}</span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : null}
                                        {respuestaReal?.detalles?.length ? (
                                            <dl className="space-y-3">
                                                {respuestaReal.detalles.map(({ etiqueta, valor }) => (
                                                    <div key={etiqueta}>
                                                        <dt className="text-xs font-medium text-[#a1a1aa]">{etiqueta}</dt>
                                                        <dd className="mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">{valor}</dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        ) : null}
                                        {materiales.length > 0 ? (
                                            <dl className="space-y-2">
                                                {materiales.map(item => (
                                                    <div key={'codigo' in item ? String(item.codigo) : item.nombre} className="flex flex-wrap justify-between gap-x-2">
                                                        <dt>{item.cantidad} × {item.nombre}{'codigo' in item ? <span className="block text-xs text-[#a1a1aa]">{String(item.codigo)}</span> : null}</dt>
                                                        <dd className="tabular-nums">{moneda.format(item.subtotal)}</dd>
                                                    </div>
                                                ))}
                                                <div className="flex flex-wrap justify-between gap-x-2 border-t border-[#3f3f46] pt-2 font-semibold">
                                                    <dt>Total registrado</dt>
                                                    <dd className="tabular-nums">{moneda.format(materiales.reduce((total, item) => total + item.subtotal, 0))}</dd>
                                                </div>
                                            </dl>
                                        ) : null}
                                        {respuesta.expediente && datosReales ? (
                                            <div className="flex flex-wrap gap-2">
                                                <Link to={`/cliente-interno/expediente/${respuesta.expediente.numero}`} className="inline-block rounded-md border border-[#52525b] px-2 py-1 hover:bg-[#27272a]">
                                                    Ver expediente #{respuesta.expediente.numero}
                                                </Link>
                                                {textoResumen !== null ? (
                                                    <button type="button" onClick={() => void copiarResumen()} className="inline-flex items-center gap-2 rounded-md border border-[#52525b] px-2 py-1 hover:bg-[#27272a]">
                                                        <Copy className="h-4 w-4" aria-hidden="true" /> Copiar resumen
                                                    </button>
                                                ) : null}
                                            </div>
                                        ) : respuesta.expediente ? (
                                            <details key={pregunta}>
                                                <summary className="w-fit cursor-pointer rounded-md border border-[#52525b] px-2 py-1">Ver expediente de ejemplo</summary>
                                                <p className="mt-2 text-[#a1a1aa]">#{respuesta.expediente.numero} · {respuesta.expediente.descripcion} · {respuesta.expediente.estado}</p>
                                            </details>
                                        ) : null}
                                        {copiaActual && textoResumen !== null ? (
                                            <div className="space-y-2">
                                                <p className="text-xs text-[#d4d4d8]" role="status">
                                                    {copiaActual.manual ? 'El navegador no permitió copiar automáticamente. Selecciona el texto y cópialo.' : 'Resumen copiado al portapapeles.'}
                                                </p>
                                                {copiaActual.manual ? (
                                                    <textarea aria-label="Resumen para copiar" readOnly value={textoResumen} rows={5}
                                                        onFocus={event => event.currentTarget.select()}
                                                        className="w-full rounded-lg border border-[#52525b] bg-[#111112] p-2 text-sm" />
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                </>
                            ) : null}
                        </div>
                        {datosReales && numeroEnContexto ? (
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#a1a1aa]">
                                    <p>Solicitud en contexto: <strong className="text-[#f4f4f5]">#{numeroEnContexto}</strong></p>
                                    <button type="button" disabled={consultando || dictando} onClick={() => {
                                        setNumeroEnContexto(undefined);
                                        campoPregunta.current?.focus();
                                    }} className="rounded-md px-2 py-1 text-[#d4d4d8] underline underline-offset-2 hover:bg-[#27272a] disabled:opacity-50">
                                        Quitar contexto
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2" aria-label={`Consultar sobre la solicitud ${numeroEnContexto}`}>
                                    {['Resumen', 'Estado', 'Supervisor', 'Fechas', 'Última actualización', 'Materiales', 'Costo total'].map(opcion => (
                                        <button key={opcion} type="button" disabled={consultando || dictando} onClick={() => void preguntar(opcion)}
                                            className="rounded-lg border border-[#52525b] px-3 py-2 text-xs hover:bg-[#27272a] disabled:opacity-50">{opcion}</button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {!datosReales ? <div className="flex flex-wrap gap-2" aria-label="Preguntas de ejemplo">
                            {['Materiales y costos', 'Estado de solicitud', 'Sin materiales', 'Sin acceso'].map((label, index) => (
                                <button key={label} type="button" onClick={() => preguntar(preguntasDemo[index])}
                                    className="rounded-lg border border-[#52525b] px-3 py-2 text-xs hover:bg-[#27272a]">{label}</button>
                            ))}
                        </div> : null}
                    </div>
                    <form className="space-y-2 border-t border-[#3f3f46] p-5" onSubmit={event => {
                        event.preventDefault();
                        if (!dictando && !consultando) void preguntar(entrada);
                    }}>
                        <div className="flex items-end gap-2">
                        <label className="min-w-0 flex-1 text-xs font-medium">
                            Escribe tu pregunta
                            <input ref={campoPregunta} autoComplete="off" maxLength={limitePregunta} readOnly={dictando}
                                value={dictando && textoReconocido ? unirTextoDictado(entrada, textoReconocido).slice(0, limitePregunta) : entrada}
                                onChange={event => setEntrada(event.target.value)}
                                placeholder={numeroEnContexto ? 'Ej.: ¿Y cuánto costó?' : 'Ej.: Busca solicitudes sobre luces'} className="mt-1 block w-full rounded-lg border border-[#52525b] bg-[#18181b] px-3 py-2 text-base text-white" />
                        </label>
                        <button type="button" disabled={!puedeDictar || preparandoDictado} onClick={alternarDictado}
                            aria-label={!dictando ? 'Dictar pregunta' : faseDictado === 'escuchando' ? 'Detener dictado' : 'Cancelar dictado'} aria-describedby="asistente-dictado-ayuda"
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border disabled:opacity-40 ${dictando ? 'border-[#fda4af] bg-[#4c0519] text-[#ffe4e6]' : 'border-[#52525b] bg-[#18181b] hover:bg-[#27272a]'}`}>
                            {dictando ? <Square className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                        </button>
                        <button type="submit" disabled={!entrada.trim() || consultando || dictando} aria-label="Enviar pregunta"
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e4e4e7] text-black disabled:opacity-40"><Send className="h-4 w-4" aria-hidden="true" /></button>
                        </div>
                        <p id="asistente-dictado-ayuda" className="text-xs text-[#a1a1aa]">
                            {!puedeDictar ? 'El dictado no está disponible en este navegador. Puedes escribir tu pregunta.'
                                : datosReales ? 'El audio se transcribe en el dispositivo. Revisa el texto antes de enviarlo.'
                                    : 'El navegador puede enviar el audio a su servicio de voz; usa solo datos de ejemplo.'}
                        </p>
                        {datosReales && ofrecerInstalacion ? (
                            <button type="button" disabled={preparandoDictado} onClick={prepararIdioma}
                                className="rounded-lg border border-[#52525b] px-3 py-2 text-xs hover:bg-[#27272a] disabled:opacity-50">
                                Preparar español en este dispositivo
                            </button>
                        ) : null}
                        <p role="status" className="text-xs text-[#e4e4e7]">{mensajeDictado}</p>
                        {dictando && textoReconocido ? (
                            <button type="button" onClick={() => usarTextoDictado.current?.()} className="rounded-md border border-[#52525b] px-3 py-1.5 text-xs hover:bg-[#27272a]">Usar este texto</button>
                        ) : null}
                        {faseDictado === 'procesando' ? <button type="button" onClick={alternarDictado} className="ml-2 rounded-md border border-[#52525b] px-3 py-1.5 text-xs hover:bg-[#27272a]">Cancelar dictado</button> : null}
                    </form>
                </div>
            </dialog>
        </>
    );
}
