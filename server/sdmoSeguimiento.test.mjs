import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

test('fechas y última actualización usan lectura directa y distinguen datos faltantes', async () => {
    const llamadas = [];
    let llamadasIA = 0;
    let resultadoForzado;
    const clientes = {
        functions: { invoke: async () => { llamadasIA++; return { data: { intencion: 'estado' } }; } },
        rpc: (nombre, parametros) => {
            llamadas.push({ nombre, parametros });
            return {
                abortSignal: async () => resultadoForzado ?? ({ data: nombre === 'sdmo_asistente_buscar_piloto' ? {
                    habilitado: true, entrada_valida: true,
                    coincidencias: parametros.p_palabras.includes('ausente') ? [] : [
                        { numero: '13107', fecha: '2026-08-26', estado: 'ACTIVA', extracto: 'Luces del parque' }
                    ]
                } : {
                    habilitado: true, expediente: { numero: '13107', estado: 'ACTIVA' },
                    fechas: { registro: '2026-08-26', cierre: null },
                    ultima_actualizacion: null,
                    supervisor: { asignado: true, nombre: 'Supervisor de prueba' },
                    materiales: []
                } })
            };
        }
    };
    globalThis.clienteDePruebaSdmo = clientes;
    try {
        const fuente = readFileSync(new URL('../src/lib/asistenteSdmoConsulta.ts', import.meta.url), 'utf8');
        const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
            .outputText.replace(/import \{ supabase \} from .*?;/, 'const supabase = globalThis.clienteDePruebaSdmo;')
            .replace(/import \{ formatDateOnly \} from .*?;/, 'const formatDateOnly = fecha => fecha ? fecha.split("-").reverse().join("/") : "—";');
        const enProduccion = (asistente, ia) => import('data:text/javascript,' + encodeURIComponent(js.replaceAll('import.meta.env', `(${JSON.stringify({ DEV: false, VITE_SDMO_ASISTENTE_PRIVADO: asistente, VITE_SDMO_IA_EXTERNA: ia })})`)));
        const { consultarSolicitudInterna, interpretarConsulta, interpretarBusqueda } = await enProduccion('true', 'true');
        const signal = new AbortController().signal;
        const fechas = await consultarSolicitudInterna('¿Cuándo se registró y cuándo se cerró la 13107?', signal);
        assert.deepEqual(fechas.detalles.map(item => item.valor), ['26/08/2026', 'Sin fecha de cierre registrada']);
        assert.deepEqual(llamadas.at(-1), { nombre: 'sdmo_asistente_seguimiento_piloto', parametros: {
            p_numero: 13107, p_materiales: false, p_fechas: true, p_ultima_actualizacion: false
        } });
        const nota = await consultarSolicitudInterna('Última actualización', signal, '13107');
        assert.match(nota.detalles[0].valor, /No hay actualizaciones/);
        assert.equal(llamadas.at(-1).parametros.p_ultima_actualizacion, true);
        const supervisor = await consultarSolicitudInterna('¿Quién supervisa la #13107?', signal);
        assert.equal(supervisor.detalles[0].valor, 'Supervisor de prueba');
        assert.equal(llamadas.at(-1).nombre, 'sdmo_asistente_supervision_piloto');
        assert.equal(interpretarConsulta('¿Quién está asignado a la solicitud #13107?').supervisor, true);
        assert.equal(interpretarConsulta('¿Quién solicitó la #13107?').numero, undefined);
        assert.equal(interpretarConsulta('¿En qué fase quedó la #13107?').requiereIA, true);
        assert.equal(interpretarConsulta('Materiales de la #13107').materiales, true);
        const resumen = await consultarSolicitudInterna('Dame un resumen de la solicitud #13107', signal);
        assert.equal(resumen.mensaje, 'Resumen de la solicitud #13107');
        assert.equal(resumen.esResumen, true);
        assert.equal(fechas.esResumen, undefined);
        assert.deepEqual(resumen.detalles.map(item => item.etiqueta), [
            'Estado', 'Supervisor asignado', 'Fecha de registro', 'Fecha de cierre',
            'Última actualización registrada', 'Materiales'
        ]);
        assert.match(resumen.detalles.at(-1).valor, /no tiene materiales/);
        assert.deepEqual(llamadas.at(-1), { nombre: 'sdmo_asistente_supervision_piloto', parametros: {
            p_numero: 13107, p_materiales: true, p_fechas: true, p_ultima_actualizacion: true
        } });
        assert.equal(interpretarConsulta('Resumen de materiales de la #13107').supervisor, false);
        assert.equal(interpretarConsulta('Resumen completo de los materiales de la #13107').actualizacion, false);
        assert.equal(interpretarConsulta('Resumen', '13107').resumen, true);
        assert.deepEqual(interpretarBusqueda('¿Hay alguna solicitud sobre iluminación del parque?'), ['iluminacion', 'parque']);
        assert.equal(interpretarBusqueda('Resumen 13107'), null);
        assert.deepEqual(interpretarBusqueda('Busca solicitudes sobre 13107'), []);
        const busqueda = await consultarSolicitudInterna('Busca solicitudes sobre luces del parque', signal, '99999');
        assert.deepEqual(llamadas.at(-1), { nombre: 'sdmo_asistente_buscar_piloto', parametros: { p_palabras: ['luces', 'parque'] } });
        assert.equal(busqueda.coincidencias[0].numero, '13107');
        assert.equal(busqueda.expediente, undefined);
        assert.match((await consultarSolicitudInterna('Busca ausente', signal)).mensaje, /No encontré solicitudes/);
        assert.equal(llamadasIA, 0);
        const preguntaAlternativa = '¿En qué fase quedó la #13107?';
        const sinPiloto = await enProduccion('false', 'true');
        const sinIa = await enProduccion('true', 'false');
        assert.match((await sinPiloto.consultarSolicitudInterna(preguntaAlternativa, signal)).mensaje, /No pude interpretar/);
        assert.match((await sinIa.consultarSolicitudInterna(preguntaAlternativa, signal)).mensaje, /No pude interpretar/);
        assert.equal(llamadasIA, 0);
        assert.equal((await consultarSolicitudInterna(preguntaAlternativa, signal)).mensaje, 'Estado: ACTIVA.');
        assert.equal(llamadasIA, 1);
        resultadoForzado = { data: { habilitado: true, expediente: null } };
        const noDisponible = await consultarSolicitudInterna('Estado #99999', signal, '13107');
        assert.equal(llamadas.at(-1).parametros.p_numero, 99999);
        assert.equal(noDisponible.solicitudNoDisponible, true);
        resultadoForzado = { error: { code: '42501' } };
        assert.equal((await consultarSolicitudInterna('Estado', signal, '13107')).accesoDenegado, true);
        resultadoForzado = { data: { habilitado: false } };
        assert.equal((await consultarSolicitudInterna('Busca luminarias', signal, '13107')).accesoDenegado, true);
    } finally {
        delete globalThis.clienteDePruebaSdmo;
    }
});
