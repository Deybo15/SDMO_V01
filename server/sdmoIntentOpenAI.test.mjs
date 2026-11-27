import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificarConOpenAI, minimizarPregunta } from '../supabase/functions/_shared/sdmoIntentOpenAI.ts';

test('conserva vocabulario operativo, nunca texto libre ni identificadores', () => {
    assert.equal(
        minimizarPregunta('¿Cuánto se gastó en la solicitud #13107 de María Pérez? maria@ejemplo.com https://interno.test/13107'),
        'cuanto se gasto en la solicitud de'
    );
    assert.equal(minimizarPregunta('Cancela la solicitud #13107'), '');
    assert.equal(minimizarPregunta('María Pérez 5551234'), '');
    assert.equal(minimizarPregunta('¿Cuál fue la última anotación de la 13107?'), 'cual la ultima anotacion de la');
});

test('no llama al proveedor sin autorización y reserva de presupuesto', async () => {
    let llamadas = 0;
    const solicitar = async () => { llamadas += 1; return new Response(null, { status: 500 }); };
    const config = { apiKey: 'clave-ficticia', modelo: 'modelo-de-prueba', solicitar };
    assert.equal(await clasificarConOpenAI('¿En qué fase quedó?', { ...config, habilitado: false }), null);
    assert.equal(await clasificarConOpenAI('¿En qué fase quedó?', { ...config, habilitado: true }), null);
    assert.equal(await clasificarConOpenAI('¿En qué fase quedó?', {
        ...config, habilitado: true, reservarSolicitudAutorizada: async () => false
    }), null);
    assert.equal(llamadas, 0);
});

function simularSalida(text, status = 'completed', type = 'output_text') {
    return new Response(JSON.stringify({ status, output: [{ type: 'message', content: [{ type, text }] }] }));
}

test('envía solo vocabulario filtrado y acepta una intención permitida', async () => {
    let reservado = false;
    const resultado = await clasificarConOpenAI('¿En qué fase quedó la #13107 de María?', {
        habilitado: true, apiKey: 'clave-ficticia', modelo: 'modelo-de-prueba',
        reservarSolicitudAutorizada: async () => (reservado = true),
        solicitar: async (url, solicitud) => {
            assert.equal(reservado, true);
            assert.equal(url, 'https://api.openai.com/v1/responses');
            const body = JSON.parse(solicitud.body);
            assert.equal(body.input, 'en que fase quedo la de');
            assert.equal(body.store, false);
            assert.equal(body.text.format.strict, true);
            assert.equal(body.tools, undefined);
            return simularSalida('{"intencion":"estado"}');
        }
    });
    assert.equal(resultado, 'estado');
});

test('rechaza respuestas incompletas, inválidas o fuera del alcance', async () => {
    for (const [texto, estado, tipo] of [
        ['{"intencion":"borrar"}'], ['{"intencion":"estado","id":13107}'],
        ['{"intencion":"estado"}', 'incomplete'], ['', 'completed', 'refusal'], ['no es JSON']
    ]) {
        assert.equal(await clasificarConOpenAI('Ver avance', {
            habilitado: true, apiKey: 'clave-ficticia', modelo: 'modelo-de-prueba',
            reservarSolicitudAutorizada: async () => true,
            solicitar: async () => simularSalida(texto, estado, tipo)
        }), null);
    }
});
