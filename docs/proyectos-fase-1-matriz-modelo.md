# Fase 1 - Matriz de modelo para Proyectos SDMO

Fecha de analisis: 2026-07-02

## Alcance

Esta fase no modifica la base de datos ni el frontend. Su objetivo es ordenar lo indicado en el adjunto contra la estructura actual del modulo `proyectos-obra`, para decidir donde debe vivir cada dato antes de implementar migraciones, formularios o reportes.

## Fuentes revisadas

- `src/types/proyectosObra.ts`
- `src/lib/proyectosObraService.ts`
- `src/pages/proyectos-obra/ProyectoObraFormulario.tsx`
- `src/pages/proyectos-obra/ProyectoObraEditar.tsx`
- `src/pages/proyectos-obra/ProyectoObraDetalle.tsx`
- `src/pages/proyectos-obra/ProyectosObraDashboard.tsx`
- `src/lib/reportesService.ts`
- `supabase/migrations/20260701000000_stage4_secure_project_rls.sql`
- `supabase/migrations/20260701034000_stage5_project_transaction_rpcs.sql`
- `supabase/migrations/20260701035000_stage6_normalize_project_progress.sql`
- Introspeccion real de Supabase documentada en `docs/proyectos-esquema-real-supabase.md`

## Modelo actual observado

### `proyecto_obra`

Tabla principal del proyecto. Actualmente concentra identificacion POA, responsable, clasificacion, ubicacion basica, estado, avance y auditoria parcial.

Campos usados por tipos/RPC/frontend:

| Campo | Estado actual | Comentario |
| --- | --- | --- |
| `id` | Existe | Llave interna. Solo lectura. |
| `codigo_meta` | Existe | Cumple parcialmente como codigo del proyecto/meta. |
| `nombre_proyecto` | Existe | Campo principal. |
| `gerencia` | Existe | Selector limitado en frontend. |
| `dependencia` | Existe | Se fuerza a "Desarrollo y Mantenimiento de Obras" al crear/editar. |
| `profesional_responsable` | Existe | Se enlaza contra `colaboradores_06` por alias/identificacion. |
| `tipo_contrato` | Existe | Hoy mezcla clasificacion contractual con tipo de proyecto. |
| `tipo_ejecucion` | Existe | Contrato, administracion, mixto. |
| `poa_origen` | Existe | Campo de planificacion institucional. |
| `origen_presupuesto` | Existe | Equivale parcialmente a fuente de financiamiento. |
| `linea_estrategica` | Existe | Campo de programa/estrategia. |
| `programa` | Existe | Campo de programa. |
| `canton` | Existe | Ubicacion basica. |
| `distrito` | Existe | Ubicacion basica. |
| `georeferencia` | Existe | Se usa para mapa, pero no esta en formulario. |
| `estado` | Existe | Estado general del proyecto. |
| `anio` | Existe | Anio de referencia. |
| `cumplimiento_poa` | Existe | Usado como fallback de avance. Conviene normalizar criterio con `avance_poa`. |
| `avance_poa` | Existe | Normalizado a escala 0-1. Se actualiza desde seguimiento. |
| `observaciones_meta_poa` | Existe | Cumple parcialmente descripcion/observaciones/justificacion. |
| `activo` | Existe | Estado logico. |
| `creado_por` | Existe en RPC | No aparece en TypeScript; debe agregarse al tipo como auditoria. |
| `actualizado_en` | Existe en RPC | Se actualiza en seguimiento; no aparece en TypeScript. |

### `presupuesto_proyecto`

Submodelo presupuestario. Ya separa los montos de la tabla principal.

| Campo | Estado actual | Comentario |
| --- | --- | --- |
| `proyecto_id` | Existe | Relacion con proyecto. |
| `version` | Existe | Permite historizar versiones. |
| `descripcion_modificacion` | Existe | Soporta trazabilidad de cambios presupuestarios. |
| `presupuesto_asignado` | Existe | Equivale a presupuesto aprobado/asignado. |
| `presupuesto_adjudicado` | Existe | Equivale a monto contratado/adjudicado. |
| `presupuesto_ejecutado` | Existe | Monto ejecutado. |
| `presupuesto_comprometido` | Existe | Monto comprometido. |
| `presupuesto_reserva` | Existe | Reserva presupuestaria. |
| `presupuesto_libre` | Existe generado | No enviar en insert/update. Calculo de BD. |
| `es_vigente` | Existe | Control de version vigente. |
| `registrado_por` | Existe | Auditoria basica. |

### `contrato_obra`

Submodelo administrativo/SICOP. Ya cubre parte importante del adjunto.

| Campo | Estado actual | Comentario |
| --- | --- | --- |
| `numero_solicitud_contratacion` | Existe | Solicitud administrativa. |
| `numero_procedimiento_sicop` | Existe | Numero SICOP principal. |
| `analista_proveeduria` | Existe | Dato administrativo. |
| `empresa_adjudicada` | Existe | Contratista juridico/adjudicado. |
| `contratista` | Existe | Contratista alternativo/texto. |
| `numero_contrato_sicop` | Existe | Contrato SICOP. |
| `numero_orden_compra` | Existe | Orden de compra. |
| `comentario_proveeduria` | Existe | Observaciones de proveeduria. |
| `fecha_envio_proveeduria` | Existe | Fecha administrativa. |
| `fecha_estimacion_adjudicacion` | Existe | Fecha estimada. |
| `fecha_adjudicacion` | Existe | Fecha real de adjudicacion. |
| `estado_contratacion` | Existe | Estado contractual. |
| `publicado` | Existe | Indicador administrativo. |
| `registrado_por` | Existe | Auditoria basica. |

### `fase_proyecto`

Submodelo de planificacion y avance por fases.

| Campo | Estado actual | Comentario |
| --- | --- | --- |
| `fase` | Existe | Enum de cuatro fases actuales. |
| `fecha_inicio_plan` | Existe | Fecha planificada. |
| `fecha_fin_plan` | Existe | Fecha planificada. |
| `fecha_inicio_real` | Existe | Editable desde detalle. |
| `fecha_fin_real` | Existe | Editable desde detalle. |
| `porcentaje_avance` | Existe | Normalizado 0-1. |
| `entregables` | Existe | Puede cubrir hitos/entregables iniciales. |
| `completada` | Existe | Se actualiza al llegar a 100%. |

### `seguimiento_proyecto`

Bitacora append-only de avance.

| Campo | Estado actual | Comentario |
| --- | --- | --- |
| `fecha_corte` | Existe | Fecha del seguimiento. |
| `avance_registrado` | Existe | Normalizado 0-1. |
| `observaciones` | Existe | Resumen/observacion de avance. |
| `etapa` | Existe | Estado narrativo/etapa. |
| `registrado_por` | Existe | Auditoria. |
| `creado_en` | Existe en tipo | Solo lectura. |

### `historial_fase_proyecto`

Auditoria de cambios de fases.

| Campo | Estado actual | Comentario |
| --- | --- | --- |
| `fase_id` | Existe | Relacion con fase. |
| `campo_modificado` | Existe | Campo auditado. |
| `valor_anterior` | Existe | Solo lectura. |
| `valor_nuevo` | Existe | Solo lectura. |
| `modificado_por` | Existe | Auditoria. |
| `creado_en` | Existe | Auditoria. |

## Matriz de campos del adjunto

### 1. Identificacion general

| Dato del adjunto | Decision | Ubicacion recomendada | Observacion |
| --- | --- | --- | --- |
| Codigo del proyecto | Ya existe / ajustar nombre visible | `proyecto_obra.codigo_meta` | Puede mantenerse como codigo/meta o renombrarse en UI a "Codigo del proyecto". |
| Nombre del proyecto | Ya existe | `proyecto_obra.nombre_proyecto` | Campo obligatorio. |
| Descripcion general | Falta como campo propio | `proyecto_obra.descripcion_general` | Hoy se mezcla con `observaciones_meta_poa`. Recomiendo agregarlo. |
| Tipo de proyecto | Falta como campo propio | `proyecto_obra.tipo_proyecto` | No usar `tipo_contrato`; son conceptos distintos. |
| Categoria / programa | Parcial | `proyecto_obra.programa`, `linea_estrategica`, `poa_origen` | Ya existe lo institucional. Falta definir si "categoria" es catalogo aparte. |
| Estado del proyecto | Ya existe | `proyecto_obra.estado` | Conviene normalizar catalogo. |
| Prioridad | Existe en BD / falta en UI | `proyecto_obra.prioridad` | Campo integer en Supabase. Falta incorporarlo en TypeScript y frontend. |
| Justificacion | Falta como campo propio | `proyecto_obra.justificacion` | No mezclar con observaciones. |
| Objetivo general | Falta | `proyecto_obra.objetivo_general` | Util para reportes. |
| Alcance resumido | Falta | `proyecto_obra.alcance_resumido` | Util para expediente y reportes. |

### 2. Ubicacion y beneficiario

| Dato del adjunto | Decision | Ubicacion recomendada | Observacion |
| --- | --- | --- | --- |
| Canton | Ya existe | `proyecto_obra.canton` | Ya usado. |
| Distrito | Ya existe | `proyecto_obra.distrito` | Ya usado. |
| Barrio / comunidad | Falta | `proyecto_obra.barrio_comunidad` | Puede ser texto inicialmente. |
| Direccion exacta | Falta | `proyecto_obra.direccion_exacta` | Necesario para ficha y mapa. |
| Coordenadas | Parcial | `proyecto_obra.georeferencia` | Existe en modelo, falta captura en formulario. |
| Instalacion municipal asociada | Falta | Tabla relacional o campo FK | Recomiendo FK si ya existe catalogo de instalaciones. |
| Espacio publico asociado | Falta | Tabla relacional o campo texto inicial | Puede empezar texto y luego catalogo. |
| Dependencia solicitante | Parcial | `proyecto_obra.dependencia_solicitante` | No confundir con `dependencia` ejecutora SDMO. |
| Persona solicitante / contacto | Falta | `proyecto_obra.persona_solicitante` o tabla contactos | Si se integra STI/STE, mejor relacion. |
| Poblacion beneficiaria | Falta | `proyecto_obra.poblacion_beneficiaria` | Texto o numero estimado. |

### 3. Datos tecnicos

| Dato del adjunto | Decision | Ubicacion recomendada | Observacion |
| --- | --- | --- | --- |
| Area estimada de intervencion | Falta | `proyecto_obra.area_intervencion` | Numeric. |
| Unidad principal de medicion | Falta | `proyecto_obra.unidad_medicion` | Catalogo pequeno. |
| Componentes principales | Falta | Tabla `proyecto_componente` o `text[]` | Recomiendo tabla si habra reportes/filtros. |
| Especialidades involucradas | Falta | Tabla `proyecto_especialidad` o `text[]` | Recomiendo tabla/catalogo. |
| Requiere diseno | Falta | `proyecto_obra.requiere_diseno` | Boolean. |
| Requiere planos | Falta | `proyecto_obra.requiere_planos` | Boolean. |
| Requiere presupuesto detallado | Falta | `proyecto_obra.requiere_presupuesto_detallado` | Boolean. |
| Requiere inspeccion tecnica | Falta | `proyecto_obra.requiere_inspeccion_tecnica` | Boolean. |
| Requiere permiso CFIA | Falta | `proyecto_obra.requiere_permiso_cfia` | Enum: si/no/no_determinado. |
| Requiere permisos externos | Falta | Tabla `proyecto_permiso` | Mejor como tabla por entidad/estado/fecha. |
| Observaciones tecnicas | Falta | `proyecto_obra.observaciones_tecnicas` | Texto amplio. |
| Restricciones tecnicas | Falta | `proyecto_obra.restricciones_tecnicas` | Texto amplio. |

### 4. Planificacion

| Dato del adjunto | Decision | Ubicacion recomendada | Observacion |
| --- | --- | --- | --- |
| Fecha de solicitud | Falta | `proyecto_obra.fecha_solicitud` | Puede venir de solicitud STI/STE si se integra. |
| Fecha estimada de inicio | Ya existe parcialmente | `fase_proyecto.fecha_inicio_plan` | Para proyecto completo se puede derivar de primera fase. |
| Fecha estimada de finalizacion | Ya existe parcialmente | `fase_proyecto.fecha_fin_plan` | Para proyecto completo se puede derivar de ultima fase. |
| Fecha real de inicio | Ya existe parcialmente | `fase_proyecto.fecha_inicio_real` | Derivable de fases. |
| Fecha real de finalizacion | Ya existe parcialmente | `fase_proyecto.fecha_fin_real` | Derivable de fases. |
| Plazo estimado | Calcular o campo controlado | Vista/RPC o `proyecto_obra.plazo_estimado_dias` | Si se permite ajuste manual, guardar dias. |
| Cronograma resumido | Falta | Documento adjunto o `proyecto_obra.cronograma_resumido` | Si es archivo, va a documentos. |
| Hitos principales | Parcial | `fase_proyecto.entregables` o tabla `proyecto_hito` | Para seguimiento real, mejor tabla de hitos. |
| Responsable interno | Ya existe | `proyecto_obra.profesional_responsable` | OK. |
| Supervisor / inspector | Falta | `proyecto_obra.supervisor_inspector` | Podria FK a colaboradores. |
| Cuadrilla asignada | Falta | Tabla relacionada | Puede requerir multiples personas/equipos. |

### 5. Presupuesto y finanzas

| Dato del adjunto | Decision | Ubicacion recomendada | Observacion |
| --- | --- | --- | --- |
| Costo estimado inicial | Falta | `presupuesto_proyecto.costo_estimado_inicial` o primera version | Si difiere del aprobado, agregar campo. |
| Costo actualizado | Parcial | Version vigente en `presupuesto_proyecto` | Puede derivarse de version vigente. |
| Presupuesto aprobado | Ya existe | `presupuesto_proyecto.presupuesto_asignado` | Nombre UI puede ser "aprobado/asignado". |
| Fuente de financiamiento | Parcial | `proyecto_obra.origen_presupuesto` | Podria catalogarse mejor. |
| Codigo presupuestario | Falta | `presupuesto_proyecto.codigo_presupuestario` | Pertenece a presupuesto. |
| Centro de costo | Falta | `presupuesto_proyecto.centro_costo` | Pertenece a presupuesto. |
| Monto contratado | Ya existe parcial | `presupuesto_proyecto.presupuesto_adjudicado` | Tambien se vincula con contrato. |
| Monto ejecutado | Ya existe | `presupuesto_proyecto.presupuesto_ejecutado` | Editable con control o desde pagos. |
| Saldo disponible | Ya existe calculado | `presupuesto_proyecto.presupuesto_libre` | Solo lectura. |
| Porcentaje ejecucion financiera | Calcular | Vista/RPC/frontend derivado | No almacenar manualmente. |
| Donaciones asociadas | Falta | Tabla `proyecto_donacion` | No poner en proyecto principal. |
| Valor estimado donaciones | Calcular desde donaciones | Vista/RPC | Puede mostrarse en ficha. |

### 6. Contratacion administrativa

| Dato del adjunto | Decision | Ubicacion recomendada | Observacion |
| --- | --- | --- | --- |
| Requiere contratacion | Falta | `contrato_obra.requiere_contratacion` o `proyecto_obra.requiere_contratacion` | Si afecta flujo general, puede estar en proyecto. |
| Tipo de contratacion | Parcial | `proyecto_obra.tipo_ejecucion` / nuevo `contrato_obra.tipo_contratacion` | Mejor agregar en contrato. |
| Numero SICOP | Ya existe | `contrato_obra.numero_procedimiento_sicop` | OK. |
| Numero decision inicial | Falta | `contrato_obra.numero_decision_inicial` | Contratacion. |
| Numero orden de compra | Ya existe | `contrato_obra.numero_orden_compra` | OK. |
| Contratista adjudicado | Ya existe | `contrato_obra.empresa_adjudicada` / `contratista` | Normalizar un solo campo visible. |
| Fecha de adjudicacion | Ya existe | `contrato_obra.fecha_adjudicacion` | OK. |
| Fecha orden de inicio | Falta | `contrato_obra.fecha_orden_inicio` | Contratacion/ejecucion. |
| Plazo contractual | Falta | `contrato_obra.plazo_contractual_dias` | Dias naturales/habiles requiere otro campo. |
| Fecha recepcion provisional | Falta | `contrato_obra.fecha_recepcion_provisional` | Contratacion/cierre. |
| Fecha recepcion definitiva | Falta | `contrato_obra.fecha_recepcion_definitiva` | Contratacion/cierre. |
| Garantias | Falta | Tabla `contrato_garantia` o campo texto inicial | Tabla si se requieren vencimientos. |
| Observaciones contractuales | Parcial | `contrato_obra.comentario_proveeduria` | Agregar `observaciones_contractuales` si excede proveeduria. |

### 7. Control de avance

| Dato del adjunto | Decision | Ubicacion recomendada | Observacion |
| --- | --- | --- | --- |
| Porcentaje avance fisico | Ya existe | `seguimiento_proyecto.avance_registrado` y `proyecto_obra.avance_poa` | Mantener seguimiento como fuente historica. |
| Estado de avance | Parcial | `seguimiento_proyecto.etapa` o nuevo `estado_avance` | Mejor agregar estado catalogado en seguimiento. |
| Ultima actualizacion de avance | Calcular | Ultimo `seguimiento_proyecto.fecha_corte` / `creado_en` | Solo lectura. |
| Resumen de avance | Ya existe parcial | `seguimiento_proyecto.observaciones` | OK. |
| Problemas detectados | Falta | `seguimiento_proyecto.problemas_detectados` | Pertenece a bitacora. |
| Acciones correctivas | Falta | `seguimiento_proyecto.acciones_correctivas` | Pertenece a bitacora. |
| Riesgos identificados | Falta | `seguimiento_proyecto.riesgos_identificados` o tabla riesgos | Tabla si se integra SEVRI. |
| Nivel de riesgo | Falta | `seguimiento_proyecto.nivel_riesgo` | Catalogo bajo/medio/alto/critico. |
| Observaciones de inspeccion | Falta | `seguimiento_proyecto.observaciones_inspeccion` | Pertenece a bitacora. |

### 8. Documentos

| Dato del adjunto | Decision | Ubicacion recomendada | Observacion |
| --- | --- | --- | --- |
| Solicitud inicial | Falta | `proyecto_documento` + Storage | Tipo documental. |
| Fotografias iniciales | Falta | `proyecto_documento` + Storage | Tipo documental. |
| Fotografias de avance | Falta | `proyecto_documento` + Storage | Tipo documental. |
| Fotografias finales | Falta | `proyecto_documento` + Storage | Tipo documental. |
| Planos | Falta | `proyecto_documento` + Storage | Tipo documental. |
| Presupuesto | Falta | `proyecto_documento` + Storage | Puede ser archivo o reporte generado. |
| Cronograma | Falta | `proyecto_documento` + Storage | Archivo. |
| Decision inicial | Falta | `proyecto_documento` + Storage | Tipo documental. |
| Cartel / pliego | Falta | `proyecto_documento` + Storage | Tipo documental. |
| Orden de compra | Falta | `proyecto_documento` + Storage | Vincular tambien a contrato. |
| Orden de inicio | Falta | `proyecto_documento` + Storage | Vincular tambien a contrato. |
| Informes de inspeccion | Falta | `proyecto_documento` + Storage | Puede vincularse a seguimiento. |
| Actas de recepcion | Falta | `proyecto_documento` + Storage | Tipo documental. |
| Cierre del proyecto | Falta | `proyecto_documento` + Storage | Tipo documental. |

## Datos calculados o de solo lectura

| Dato | Decision | Fuente recomendada |
| --- | --- | --- |
| Dias transcurridos desde inicio | Calcular | Fecha real de inicio derivada de fases o contrato. |
| Dias restantes | Calcular | Plazo contractual/plan + fecha actual. |
| Porcentaje ejecucion financiera | Calcular | `presupuesto_ejecutado / presupuesto_asignado`. |
| Saldo presupuestario | Ya calculado | `presupuesto_libre`. |
| Semaforo de atraso | Calcular | Fechas plan, avance y fecha actual. |
| Estado vencido/vigente | Calcular | Fechas y cierre. |
| Fecha ultima modificacion | Solo lectura | `actualizado_en` o trigger futuro. |
| Usuario que modifico | Solo lectura | Agregar `actualizado_por` o historial general. |
| Numero interno consecutivo | Solo lectura | `id` o secuencia/codigo generado. |
| Cantidad documentos adjuntos | Calcular | Conteo en `proyecto_documento`. |
| Total donaciones | Calcular | Suma en `proyecto_donacion`. |
| Costo total incluyendo donaciones | Calcular | Presupuesto/costo + donaciones. |
| Historial de cambios | Solo lectura | Tabla de auditoria general futura. |
| Historial de estados | Solo lectura | Tabla `historial_estado_proyecto` futura. |
| Vinculos STI/STE | Controlado | Tabla relacional, no edicion libre. |

## Recomendacion de tablas futuras

### Extender tablas existentes

`proyecto_obra`:

- `descripcion_general`
- `tipo_proyecto`
- `prioridad` (ya existe en BD; falta en tipos/UI)
- `justificacion`
- `objetivo_general`
- `alcance_resumido`
- `barrio_comunidad`
- `direccion_exacta`
- `dependencia_solicitante`
- `persona_solicitante`
- `poblacion_beneficiaria`
- `area_intervencion`
- `unidad_medicion`
- `requiere_diseno`
- `requiere_planos`
- `requiere_presupuesto_detallado`
- `requiere_inspeccion_tecnica`
- `requiere_permiso_cfia`
- `observaciones_tecnicas`
- `restricciones_tecnicas`
- `fecha_solicitud`
- `supervisor_inspector`

`presupuesto_proyecto`:

- `costo_estimado_inicial`
- `codigo_presupuestario`
- `centro_costo`

`contrato_obra`:

- `requiere_contratacion`
- `tipo_contratacion`
- `numero_decision_inicial`
- `fecha_orden_inicio`
- `plazo_contractual_dias`
- `tipo_plazo_contractual`
- `fecha_recepcion_provisional`
- `fecha_recepcion_definitiva`
- `observaciones_contractuales`

`seguimiento_proyecto`:

- `estado_avance`
- `problemas_detectados`
- `acciones_correctivas`
- `riesgos_identificados`
- `nivel_riesgo`
- `observaciones_inspeccion`

### Crear tablas relacionadas

| Tabla propuesta | Proposito | Prioridad |
| --- | --- | --- |
| `proyecto_documento` | Archivos, fotos, planos, actas, informes y cierre. | Alta |
| `proyecto_donacion` | Donaciones de materiales, mobiliario, luminarias, jardineras, etc. | Media |
| `proyecto_permiso` | Permisos externos por entidad, estado y fecha. | Media |
| `proyecto_hito` | Hitos mas granulares que las fases. | Media |
| `proyecto_componente` | Componentes tecnicos filtrables. | Baja/media |
| `proyecto_especialidad` | Especialidades involucradas filtrables. | Baja/media |
| `contrato_garantia` | Garantias y vencimientos. | Media |
| `historial_estado_proyecto` | Cambios de estado general. | Alta |
| `historial_proyecto` | Auditoria general de campos criticos. | Alta |
| `proyecto_solicitud_vinculo` | Relacion con solicitudes STI/STE. | Media |

## MVP recomendado para Fase 2

Para no inflar el formulario inicial, Fase 2 deberia limitarse a:

| Campo | Accion |
| --- | --- |
| `descripcion_general` | Agregar a BD, tipos, crear/editar/detalle/reporte. |
| `tipo_proyecto` | Agregar catalogo simple en UI. |
| `prioridad` | Usar columna existente; agregar a tipos/UI y mapear valor numerico a etiqueta. |
| `justificacion` | Agregar textarea. |
| `direccion_exacta` | Agregar campo de ubicacion. |
| `barrio_comunidad` | Agregar campo de ubicacion. |
| `fecha_solicitud` | Agregar fecha. |
| `requiere_contratacion` | Agregar control booleano, idealmente en contrato/proyecto. |
| `numero_procedimiento_sicop` | Habilitar captura desde pestana contrato. |
| `codigo_presupuestario` | Agregar a presupuesto vigente. |

## Riesgos y decisiones pendientes

1. Ya se documento el esquema real de Supabase en `docs/proyectos-esquema-real-supabase.md`; Fase 2 debe partir de ese snapshot.
2. Hay campos de auditoria reales (`creado_por`, `creado_en`, `actualizado_en`) que no estan reflejados en `ProyectoObra`. Conviene sincronizar tipos antes de ampliar UI.
3. `tipo_contrato`, `tipo_ejecucion` y `tipo_proyecto` deben separarse conceptualmente.
4. `dependencia` actualmente representa la dependencia ejecutora SDMO; el adjunto pide tambien dependencia solicitante. No deben mezclarse.
5. `avance_poa` es el valor actual, pero la fuente historica debe seguir siendo `seguimiento_proyecto`.
6. Los documentos no deben convertirse en columnas de `proyecto_obra`; deben ir a tabla relacionada + Storage.
7. Para vistas calculadas en Supabase, usar `security_invoker = true` si se exponen a roles autenticados.

## Resultado de Fase 1

La estructura actual ya soporta una evolucion ordenada del modulo. No se recomienda rehacer el modelo. Se recomienda:

1. Mantener `proyecto_obra` como ficha principal compacta.
2. Fortalecer tablas existentes para presupuesto, contrato, fases y seguimiento.
3. Crear tablas nuevas solo para colecciones reales: documentos, donaciones, permisos, hitos, garantias, historiales y vinculos con solicitudes.
4. Mantener calculos y auditoria fuera de formularios editables.
