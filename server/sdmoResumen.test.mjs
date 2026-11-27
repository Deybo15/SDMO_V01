import assert from 'node:assert/strict';
import test from 'node:test';
import { monedaAsistente, textoParaCopiarResumen } from '../src/lib/asistenteSdmoResumen.ts';

const resumen = {
    mensaje: 'Resumen de la solicitud #13107',
    expediente: { numero: '13107', estado: 'ACTIVA' },
    esResumen: true,
    detalles: [{ etiqueta: 'Estado', valor: 'ACTIVA' }]
};

test('copia los datos del resumen y el desglose registrado en colones', () => {
    assert.equal(textoParaCopiarResumen({ ...resumen, materiales: [
        { cantidad: 2, nombre: 'Tornillo', codigo: '0001', subtotal: 100 },
        { cantidad: 3, nombre: 'Tuerca', codigo: '0002', subtotal: 150 }
    ] }), [resumen.mensaje, 'Estado: ACTIVA', '',
        `- 2 × Tornillo (0001): ${monedaAsistente.format(100)}`,
        `- 3 × Tuerca (0002): ${monedaAsistente.format(150)}`,
        `Total registrado: ${monedaAsistente.format(250)}`
    ].join('\n'));
});

test('conserva avisos y no inventa un total cuando no hay desglose', () => {
    const aviso = 'No se pudieron verificar todos los importes o cantidades.';
    assert.equal(textoParaCopiarResumen({ ...resumen, detalles: [{ etiqueta: 'Materiales', valor: aviso }] }),
        `${resumen.mensaje}\nMateriales: ${aviso}`);
    assert.equal(textoParaCopiarResumen({ ...resumen, esResumen: undefined }), null);
    assert.equal(textoParaCopiarResumen({ ...resumen, expediente: undefined }), null);
});
