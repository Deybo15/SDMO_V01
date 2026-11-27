import assert from 'node:assert/strict';
import test from 'node:test';

test('el servidor exige un origen permitido, autorización y presupuesto antes de llamar a OpenAI', async () => {
    let handler;
    const fetchOriginal = globalThis.fetch;
    const ajustes = {
        SUPABASE_URL: 'https://proyecto.example',
        SUPABASE_ANON_KEY: 'publica-de-prueba',
        SUPABASE_SERVICE_ROLE_KEY: 'servicio-de-prueba',
        OPENAI_API_KEY: 'clave-de-prueba',
        SDMO_IA_PILOTO_ACTIVA: 'false'
    };
    globalThis.Deno = { env: { get: clave => ajustes[clave] }, serve: fn => { handler = fn; } };
    let autorizado = false;
    let conSaldo = false;
    const llamadas = [];
    globalThis.fetch = async (url, options) => {
        llamadas.push(url);
        if (url.endsWith('/sdmo_asistente_piloto')) {
            assert.equal(options.headers.Authorization, 'Bearer sesion-de-prueba');
            return Response.json({ habilitado: autorizado });
        }
        if (url.endsWith('/sdmo_reservar_ia_piloto')) {
            assert.equal(options.headers.Authorization, 'Bearer servicio-de-prueba');
            return Response.json(conSaldo);
        }
        assert.equal(url, 'https://api.openai.com/v1/responses');
        const cuerpo = JSON.parse(options.body);
        assert.equal(cuerpo.input, 'en que fase quedo la solicitud de');
        assert.equal(cuerpo.service_tier, 'default');
        return Response.json({ status: 'completed', output: [{ type: 'message', content: [
            { type: 'output_text', text: '{"intencion":"estado"}' }
        ] }] });
    };

    try {
        await import('../supabase/functions/sdmo-intencion/index.ts');
        const invocar = (origin = 'http://127.0.0.1:5187', token = 'Bearer sesion-de-prueba', method = 'POST') => handler(new Request('https://proyecto.example/functions/v1/sdmo-intencion', {
            method, headers: { Origin: origin, ...(token ? { Authorization: token } : {}) },
            body: method === 'POST' ? JSON.stringify({ texto: '¿En qué fase quedó la solicitud #13107 de María?' }) : undefined
        }));
        const publicado = 'https://sdmo-v01.onrender.com';
        assert.equal((await invocar('https://otro.example')).status, 403);
        assert.equal((await invocar(publicado)).status, 403);
        ajustes.SDMO_IA_ORIGEN_PRIVADO = 'http://otro.example';
        assert.equal((await invocar('http://otro.example')).status, 403);
        ajustes.SDMO_IA_ORIGEN_PRIVADO = publicado;
        assert.equal((await invocar(`${publicado}.otro.example`)).status, 403);
        const preflight = await invocar(publicado, '', 'OPTIONS');
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), publicado);
        assert.equal(preflight.headers.get('Vary'), 'Origin');
        assert.equal((await invocar(publicado, '')).status, 401);
        assert.equal((await invocar(undefined, '')).status, 401);
        assert.deepEqual(await (await invocar()).json(), { intencion: null });
        assert.deepEqual(llamadas, []);

        ajustes.SDMO_IA_PILOTO_ACTIVA = 'true';
        assert.equal((await invocar(publicado)).status, 403);
        assert.deepEqual(llamadas.splice(0), ['https://proyecto.example/rest/v1/rpc/sdmo_asistente_piloto']);

        autorizado = true;
        assert.deepEqual(await (await invocar()).json(), { intencion: null });
        assert.deepEqual(llamadas.splice(0), [
            'https://proyecto.example/rest/v1/rpc/sdmo_asistente_piloto',
            'https://proyecto.example/rest/v1/rpc/sdmo_reservar_ia_piloto'
        ]);
        conSaldo = true;
        assert.deepEqual(await (await invocar(publicado)).json(), { intencion: 'estado' });
        assert.equal(llamadas.length, 3);
    } finally {
        globalThis.fetch = fetchOriginal;
        delete globalThis.Deno;
    }
});
