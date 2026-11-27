import assert from 'node:assert/strict';
import test from 'node:test';
import { registrarConsultaReciente } from '../src/lib/asistenteSdmoHistorial.ts';

test('guarda hasta cinco consultas, de la más reciente a la más antigua', () => {
    let historial = [];
    for (let id = 1; id <= 7; id++) {
        historial = registrarConsultaReciente(historial, {
            id, pregunta: 'Resumen', respuesta: { mensaje: 'Respuesta', expediente: { numero: String(id) } }
        });
    }
    assert.deepEqual(historial.map(({ id }) => id), [7, 6, 5, 4, 3]);
    assert.deepEqual(historial.map(({ respuesta }) => respuesta.expediente.numero), ['7', '6', '5', '4', '3']);
});

test('conserva búsquedas con coincidencias y excluye respuestas sin resultados', () => {
    const busqueda = { id: 1, pregunta: 'Busca luminarias', respuesta: { coincidencias: [{ numero: '42' }] } };
    const historial = registrarConsultaReciente([], busqueda);
    assert.deepEqual(historial, [busqueda]);
    assert.equal(registrarConsultaReciente(historial, { id: 2, pregunta: 'Busca ausente', respuesta: { coincidencias: [] } }), historial);
    assert.equal(registrarConsultaReciente(historial, { id: 3, pregunta: 'Resumen', respuesta: { mensaje: 'Error' } }), historial);
});
