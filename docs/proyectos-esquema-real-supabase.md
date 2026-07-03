# Esquema real Supabase - Proyectos SDMO

Fecha de introspeccion: 2026-07-02
Proyecto Supabase: `qpccqoeronbcdyejfjod`

## Objetivo

Registrar el esquema real de Supabase para las tablas del modulo `proyectos-obra` antes de iniciar Fase 2. Esto complementa la matriz funcional en `docs/proyectos-fase-1-matriz-modelo.md`.

## Resultado principal

La base real confirma que las tablas principales ya existen y tienen RLS activo:

- `proyecto_obra`
- `presupuesto_proyecto`
- `contrato_obra`
- `fase_proyecto`
- `seguimiento_proyecto`
- `historial_fase_proyecto`

Tambien confirma que hay datos reales cargados:

| Tabla | Filas aproximadas |
| --- | ---: |
| `proyecto_obra` | 120 |
| `presupuesto_proyecto` | 173 |
| `contrato_obra` | 109 |
| `fase_proyecto` | 418 |
| `seguimiento_proyecto` | 945 |
| `historial_fase_proyecto` | 0 |

## Columnas reales por tabla

### `proyecto_obra`

| Columna | Tipo | Nulo | Default / nota |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `codigo_meta` | text | Si |  |
| `nombre_proyecto` | text | No |  |
| `gerencia` | text | Si |  |
| `dependencia` | text | Si |  |
| `profesional_responsable` | text | Si | FK a `colaboradores_06.identificacion` |
| `tipo_contrato` | text | Si |  |
| `tipo_ejecucion` | text | Si |  |
| `poa_origen` | text | Si |  |
| `origen_presupuesto` | text | Si |  |
| `linea_estrategica` | text | Si |  |
| `programa` | text | Si |  |
| `prioridad` | integer | Si | Existe en BD, falta en TypeScript/UI |
| `pais` | text | Si | `'Costa Rica'` |
| `canton` | text | Si |  |
| `distrito` | text | Si |  |
| `georeferencia` | geometry | Si | Existe en BD, falta captura en formulario |
| `estado` | text | Si |  |
| `cumplimiento_poa` | boolean | Si | Default `false`; TypeScript lo modela como numero, hay que corregir |
| `avance_poa` | numeric | Si | Default `0`; escala 0-1 |
| `observaciones_meta_poa` | text | Si |  |
| `anio` | integer | Si | Anio actual por default |
| `activo` | boolean | Si | Default `true` |
| `creado_por` | text | Si | FK a `colaboradores_06.identificacion` |
| `creado_en` | timestamptz | Si | `now()` |
| `actualizado_en` | timestamptz | Si | `now()` |

### `presupuesto_proyecto`

| Columna | Tipo | Nulo | Default / nota |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `proyecto_id` | uuid | No | FK a `proyecto_obra.id` |
| `version` | integer | Si | Default `1` |
| `descripcion_modificacion` | text | Si |  |
| `presupuesto_asignado` | numeric | Si | Default `0` |
| `presupuesto_adjudicado` | numeric | Si | Default `0` |
| `presupuesto_ejecutado` | numeric | Si | Default `0` |
| `presupuesto_comprometido` | numeric | Si | Default `0` |
| `presupuesto_reserva` | numeric | Si | Default `0` |
| `presupuesto_libre` | numeric | Si | Generado: `presupuesto_asignado - presupuesto_adjudicado - presupuesto_reserva` |
| `es_vigente` | boolean | Si | Default `true` |
| `registrado_por` | text | Si | FK a `colaboradores_06.identificacion` |
| `creado_en` | timestamptz | Si | `now()` |
| `actualizado_en` | timestamptz | Si | `now()` |

### `contrato_obra`

| Columna | Tipo | Nulo | Default / nota |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `proyecto_id` | uuid | No | FK a `proyecto_obra.id` |
| `numero_solicitud_contratacion` | text | Si |  |
| `numero_procedimiento_sicop` | text | Si |  |
| `analista_proveeduria` | text | Si |  |
| `empresa_adjudicada` | text | Si |  |
| `contratista` | text | Si |  |
| `numero_contrato_sicop` | text | Si |  |
| `numero_orden_compra` | text | Si |  |
| `comentario_proveeduria` | text | Si |  |
| `fecha_envio_proveeduria` | date | Si |  |
| `fecha_estimacion_adjudicacion` | date | Si |  |
| `fecha_adjudicacion` | date | Si |  |
| `estado_contratacion` | text | Si |  |
| `publicado` | boolean | Si | Default `false` |
| `registrado_por` | text | Si | FK a `colaboradores_06.identificacion` |
| `creado_en` | timestamptz | Si | `now()` |
| `actualizado_en` | timestamptz | Si | `now()` |

### `fase_proyecto`

| Columna | Tipo | Nulo | Default / nota |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `proyecto_id` | uuid | No | FK a `proyecto_obra.id` |
| `fase` | text | No | Check con cuatro fases |
| `fecha_inicio_plan` | date | Si |  |
| `fecha_fin_plan` | date | Si |  |
| `fecha_inicio_real` | date | Si |  |
| `fecha_fin_real` | date | Si |  |
| `porcentaje_avance` | numeric | Si | Default `0`; check 0-1 |
| `entregables` | text | Si |  |
| `completada` | boolean | Si | Default `false` |
| `creado_en` | timestamptz | Si | `now()` |
| `actualizado_en` | timestamptz | Si | `now()` |

Restricciones relevantes:

- `unique(proyecto_id, fase)`
- `porcentaje_avance >= 0 and porcentaje_avance <= 1`

### `seguimiento_proyecto`

| Columna | Tipo | Nulo | Default / nota |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `proyecto_id` | uuid | No | FK a `proyecto_obra.id` |
| `fecha_corte` | date | No |  |
| `avance_registrado` | numeric | Si | Check 0-1 |
| `observaciones` | text | No |  |
| `etapa` | text | Si |  |
| `registrado_por` | text | Si | FK a `colaboradores_06.identificacion` |
| `creado_en` | timestamptz | Si | `now()` |

### `historial_fase_proyecto`

| Columna | Tipo | Nulo | Default / nota |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `proyecto_id` | uuid | No | FK a `proyecto_obra.id` |
| `fase` | text | No |  |
| `campo_modificado` | text | No |  |
| `valor_anterior` | text | Si |  |
| `valor_nuevo` | text | Si |  |
| `modificado_por` | text | Si | FK a `colaboradores_06.identificacion` |
| `creado_en` | timestamptz | Si | `now()` |

## Politicas y seguridad

Las tablas del modulo tienen RLS activo. El patron actual es:

- Lectura para usuarios autenticados.
- Insert/update para usuarios autenticados que tengan `colaboradores_06.autorizado = true` y correo coincidente con `auth.jwt() ->> 'email'`.
- `seguimiento_proyecto` e `historial_fase_proyecto` tienen insert, pero no update/delete para authenticated, lo cual respalda el enfoque append-only.

Funciones RPC revisadas:

| Funcion | Security |
| --- | --- |
| `crear_proyecto_obra_con_presupuesto` | `SECURITY INVOKER` |
| `registrar_seguimiento_proyecto` | `SECURITY INVOKER` |

No se encontraron triggers en las tablas del modulo.

## Hallazgos para Fase 2

1. `prioridad` ya existe en `proyecto_obra` como `integer`; no se debe crear de nuevo. Hay que incorporarlo en TypeScript, formularios, detalle y reportes.
2. `pais` ya existe con default `Costa Rica`; no hace falta agregarlo en Fase 2.
3. `creado_en` ya existe en `proyecto_obra`, pero no esta en `ProyectoObra`.
4. `creado_por` y `actualizado_en` ya existen en `proyecto_obra`, pero faltan o estan incompletos en TypeScript.
5. `cumplimiento_poa` es `boolean` en BD, pero el tipo actual lo declara como `number | null`. Esto puede causar lecturas confusas en dashboard y detalle. Debe corregirse.
6. `presupuesto_libre` es columna generada y su formula real es `presupuesto_asignado - presupuesto_adjudicado - presupuesto_reserva`. El frontend/reportes hoy usan fallback con `presupuesto_ejecutado` y `presupuesto_comprometido`, lo cual puede no coincidir con BD.
7. `georeferencia` existe, pero no hay captura en formulario nuevo/editar.
8. `historial_fase_proyecto` no tiene `fase_id`, aunque TypeScript lo exige. Hay que corregir el tipo o migrar la columna. Para evitar romper BD, Fase 2 deberia corregir TypeScript primero.
9. `fase_proyecto.fase` usa valores con tildes en BD (`Planeación_y_Diseños`, `Ejecución_y_Construcción`, `Recepción_y_Cierre`), mientras TypeScript usa variantes mojibake/ASCII visualmente degradadas. Conviene normalizar constantes de frontend contra valores reales.
10. El conector reporto una advertencia critica: `public.spatial_ref_sys` tiene RLS desactivado. Es tabla de PostGIS, no del modulo de proyectos, pero Supabase la marca como expuesta. No se aplico ningun cambio automatico.

## Ajuste al MVP de Fase 2

Despues de la introspeccion, el MVP debe quedar asi:

| Accion | Tabla | Nota |
| --- | --- | --- |
| Usar `prioridad` existente | `proyecto_obra` | Agregar a tipos/UI, posiblemente mapear 1/2/3 a alta/media/baja. |
| Agregar `descripcion_general` | `proyecto_obra` | Nueva columna. |
| Agregar `tipo_proyecto` | `proyecto_obra` | Nueva columna. |
| Agregar `justificacion` | `proyecto_obra` | Nueva columna. |
| Agregar `direccion_exacta` | `proyecto_obra` | Nueva columna. |
| Agregar `barrio_comunidad` | `proyecto_obra` | Nueva columna o FK futura a `barrios_distritos`. |
| Agregar `fecha_solicitud` | `proyecto_obra` | Nueva columna. |
| Agregar `requiere_contratacion` | `contrato_obra` o `proyecto_obra` | Recomendacion: `proyecto_obra` si condiciona el flujo general. |
| Agregar `codigo_presupuestario` | `presupuesto_proyecto` | Nueva columna. |
| Corregir tipos existentes | TypeScript | Antes o junto con UI. |
