import assert from 'node:assert/strict';
import test from 'node:test';
import { actualizarContexto } from '../src/lib/asistenteSdmoContexto.ts';

test('conserva la solicitud durante aclaraciones y búsquedas sin coincidencias', () => {
    assert.equal(actualizarContexto('13107', { mensaje: 'No pude interpretar la consulta' }), '13107');
    assert.equal(actualizarContexto('13107', { mensaje: 'Sin coincidencias', coincidencias: [] }), '13107');
});

test('cambia a la solicitud consultada y pide una selección si hay coincidencias nuevas', () => {
    assert.equal(actualizarContexto('13107', { mensaje: 'Estado', expediente: { numero: '13948' } }), '13948');
    assert.equal(actualizarContexto('13107', { mensaje: 'Coincidencias', coincidencias: [{ numero: '13948' }] }), undefined);
});

test('no reutiliza el contexto cuando la solicitud o el acceso no están disponibles', () => {
    assert.equal(actualizarContexto('13107', { mensaje: 'No disponible', solicitudNoDisponible: true }), undefined);
    assert.equal(actualizarContexto('13107', { mensaje: 'Sin acceso', accesoDenegado: true }), undefined);
});
