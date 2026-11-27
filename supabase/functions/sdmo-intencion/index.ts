import { clasificarConOpenAI } from '../_shared/sdmoIntentOpenAI.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };

const origenLocal = 'http://127.0.0.1:5187';
const modelo = 'gpt-5.4-nano-2026-03-17';
const cabeceras = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
};

function origenPermitido(origen: string | null) {
    if (origen === origenLocal) return true;
    const configurado = Deno.env.get('SDMO_IA_ORIGEN_PRIVADO');
    if (!origen || !configurado || origen !== configurado) return false;
    try {
        const url = new URL(configurado);
        return url.protocol === 'https:' && url.origin === configurado;
    } catch {
        return false;
    }
}

Deno.serve(async request => {
    const origen = request.headers.get('Origin');
    if (!origen || !origenPermitido(origen)) return Response.json({ intencion: null }, { status: 403, headers: { 'Cache-Control': 'no-store', Vary: 'Origin' } });
    const cors = { ...cabeceras, 'Access-Control-Allow-Origin': origen };
    const json = (datos: unknown, status = 200) => Response.json(datos, { status, headers: cors });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ intencion: null }, 405);
    const sesion = request.headers.get('Authorization');
    if (!sesion?.startsWith('Bearer ')) return json({ intencion: null }, 401);
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (Deno.env.get('SDMO_IA_PILOTO_ACTIVA') !== 'true' || !apiKey || !url || !anon || !servicio) return json({ intencion: null });

    try {
        if (Number(request.headers.get('Content-Length') ?? 0) > 2048) return json({ intencion: null }, 413);
        const cuerpo = await request.text();
        if (cuerpo.length > 2048) return json({ intencion: null }, 413);
        const datos = JSON.parse(cuerpo);
        if (typeof datos?.texto !== 'string' || datos.texto.length > 240 || Object.keys(datos).length !== 1) {
            return json({ intencion: null }, 400);
        }
        const acceso = await fetch(`${url}/rest/v1/rpc/sdmo_asistente_piloto`, {
            headers: { apikey: anon, Authorization: sesion },
            signal: AbortSignal.timeout(3000),
            redirect: 'error'
        });
        if (!acceso.ok || (await acceso.json())?.habilitado !== true) return json({ intencion: null }, 403);

        const intencion = await clasificarConOpenAI(datos.texto, {
            apiKey, modelo, habilitado: true,
            reservarSolicitudAutorizada: async () => {
                const reserva = await fetch(`${url}/rest/v1/rpc/sdmo_reservar_ia_piloto`, {
                    method: 'POST',
                    headers: { apikey: servicio, Authorization: `Bearer ${servicio}`, 'Content-Type': 'application/json' },
                    body: '{}',
                    signal: AbortSignal.timeout(3000),
                    redirect: 'error'
                });
                return reserva.ok && await reserva.json() === true;
            }
        });
        return json({ intencion });
    } catch {
        return json({ intencion: null });
    }
});
