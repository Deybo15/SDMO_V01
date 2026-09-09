import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real service with an in-memory client: no credentials or network.
const source = readFileSync(new URL('../src/lib/proyectosObraService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;

function fixture(responses) {
  const calls = [];
  const logs = [];
  const queue = [...responses];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { email: 'prueba@example.invalid' } } }) },
    from(table) {
      const call = { table, steps: [] };
      calls.push(call);
      const query = {};
      for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'single']) {
        query[method] = (...args) => { call.steps.push([method, ...args]); return query; };
      }
      query.then = (resolve, reject) => {
        assert.ok(queue.length, `Unexpected query: ${table}`);
        const response = queue.shift();
        assert.equal(table, response.table);
        return Promise.resolve({ data: response.data ?? null, error: response.error ?? null }).then(resolve, reject);
      };
      return query;
    }
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      assert.equal(name, './supabase');
      return { supabase };
    },
    console: { error: (...args) => logs.push(args) }
  });
  return { service: exports, calls, logs, done: () => assert.equal(queue.length, 0) };
}

const result = (table, data, error) => ({ table, data, error });
const payload = call => call.steps.find(step => step[0] === 'insert' || step[0] === 'update')[1];

test('new budget saves successfully with the original zero amounts and trimmed code', async () => {
  const saved = { id: 'budget-1', proyecto_id: 'project-1', codigo_presupuestario: 'ABC' };
  const f = fixture([result('presupuesto_proyecto', []), result('presupuesto_proyecto', saved)]);
  assert.equal(await f.service.actualizarCodigoPresupuestario('project-1', ' ABC '), saved);
  const row = payload(f.calls[1])[0];
  assert.equal(row.codigo_presupuestario, 'ABC');
  assert.equal(row.proyecto_id, 'project-1');
  assert.equal(row.version, 1);
  assert.equal(row.es_vigente, true);
  for (const field of ['asignado', 'adjudicado', 'ejecutado', 'comprometido', 'reserva']) {
    assert.equal(row[`presupuesto_${field}`], 0);
  }
  assert.equal(f.calls.length, 2, 'budget creation must not write project-field history');
  f.done();
});

test('existing budget updates only its code, preserving amounts and version', async () => {
  const saved = { id: 'budget-2', presupuesto_asignado: 7500, version: 3 };
  const f = fixture([result('presupuesto_proyecto', [{ id: 'budget-2' }]), result('presupuesto_proyecto', saved)]);
  assert.equal(await f.service.actualizarCodigoPresupuestario('project-1', ' XYZ '), saved);
  assert.equal(JSON.stringify(payload(f.calls[1])), JSON.stringify({ codigo_presupuestario: 'XYZ' }));
  assert.ok(f.calls[1].steps.some(([method, field, value]) => method === 'eq' && field === 'id' && value === 'budget-2'));
  f.done();
});

test('empty code with no budget does not create a budget', async () => {
  for (const code of ['', '  ', null, undefined]) {
    const f = fixture([result('presupuesto_proyecto', [])]);
    assert.equal(await f.service.actualizarCodigoPresupuestario('project-1', code), null);
    assert.equal(f.calls.length, 1);
    f.done();
  }
});

test('clearing an existing code preserves the budget record', async () => {
  const f = fixture([result('presupuesto_proyecto', [{ id: 2 }]), result('presupuesto_proyecto', { id: 2 })]);
  await f.service.actualizarCodigoPresupuestario('project-1', ' ');
  assert.equal(JSON.stringify(payload(f.calls[1])), '{"codigo_presupuestario":null}');
  f.done();
});

test('budget lookup and write failures propagate without extra writes', async () => {
  const error = new Error('Simulated database failure');
  for (const responses of [
    [result('presupuesto_proyecto', null, error)],
    [result('presupuesto_proyecto', []), result('presupuesto_proyecto', null, error)],
    [result('presupuesto_proyecto', [{ id: 2 }]), result('presupuesto_proyecto', null, error)]
  ]) {
    const f = fixture(responses);
    await assert.rejects(f.service.actualizarCodigoPresupuestario('project-1', 'ABC'), e => e === error);
    f.done();
  }
});

test('project edit records changed fields and status against the correct project', async () => {
  const before = { nombre_proyecto: 'Original', estado: 'Activo' };
  const after = { id: 'project-1', nombre_proyecto: 'Actualizado', estado: 'Finalizado' };
  const f = fixture([
    result('proyecto_obra', before), result('proyecto_obra', after),
    result('historial_proyecto', null), result('historial_estado_proyecto', null)
  ]);
  assert.equal(await f.service.actualizarProyectoObra('project-1', { nombre_proyecto: 'Actualizado', estado: 'Finalizado' }), after);
  const history = payload(f.calls[2]);
  assert.equal(history.length, 2);
  assert.ok(history.every(row => row.proyecto_id === 'project-1' && row.modificado_por === 'prueba@example.invalid'));
  const name = history.find(row => row.campo_modificado === 'nombre_proyecto');
  assert.equal(name.valor_anterior, 'Original');
  assert.equal(name.valor_nuevo, 'Actualizado');
  const status = payload(f.calls[3])[0];
  assert.equal(status.proyecto_id, 'project-1');
  assert.equal(status.estado_anterior, 'Activo');
  assert.equal(status.estado_nuevo, 'Finalizado');
  f.done();
});

test('unchanged project fields do not create duplicate history', async () => {
  const f = fixture([result('proyecto_obra', { nombre_proyecto: 'Original' }), result('proyecto_obra', { nombre_proyecto: 'Original' })]);
  await f.service.actualizarProyectoObra('project-1', { nombre_proyecto: 'Original' });
  assert.equal(f.calls.length, 2);
  f.done();
});

test('partial project edits do not audit omitted fields or create status history', async () => {
  const f = fixture([
    result('proyecto_obra', { nombre_proyecto: 'Original', estado: 'Activo' }),
    result('proyecto_obra', { nombre_proyecto: 'Nuevo', estado: 'Activo' }), result('historial_proyecto', null)
  ]);
  await f.service.actualizarProyectoObra('project-1', { nombre_proyecto: 'Nuevo' });
  assert.equal(payload(f.calls[2]).length, 1);
  assert.equal(payload(f.calls[2])[0].campo_modificado, 'nombre_proyecto');
  f.done();
});

test('failed project update does not write history', async () => {
  const error = new Error('Update rejected');
  const f = fixture([result('proyecto_obra', { estado: 'Activo' }), result('proyecto_obra', null, error)]);
  await assert.rejects(f.service.actualizarProyectoObra('project-1', { estado: 'Finalizado' }), e => e === error);
  assert.equal(f.calls.length, 2);
  f.done();
});

test('history API error is logged without reporting the saved project as unsaved', async () => {
  const saved = { nombre_proyecto: 'Nuevo' };
  const f = fixture([
    result('proyecto_obra', { nombre_proyecto: 'Original' }), result('proyecto_obra', saved),
    result('historial_proyecto', null, new Error('History unavailable'))
  ]);
  assert.equal(await f.service.actualizarProyectoObra('project-1', saved), saved);
  assert.equal(f.logs.length, 1);
  f.done();
});
