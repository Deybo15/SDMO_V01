# A1: resultados y propuesta funcional de A2

## Alcance aprobado y realizado

Se corrigieron dos archivos de aplicación. No se desplegaron cambios, no se ejecutaron escrituras ni migraciones en Supabase y no se modificaron automatizaciones de Make. La revisión de la base conectada fue exclusivamente de metadatos: funciones, disparadores, restricciones, políticas y definición del inventario; no se consultaron registros personales u operativos.

### Código presupuestario y auditoría

En `src/lib/proyectosObraService.ts`, el bloque que compara campos del proyecto y registra su historial estaba dentro de `actualizarCodigoPresupuestario`. Allí referenciaba variables inexistentes y fallaba después de insertar el primer presupuesto. Se trasladó a `actualizarProyectoObra`, donde existen el identificador, los valores anteriores y los nuevos valores del proyecto.

Efectos funcionales:

- Presupuesto nuevo: conserva versión 1, montos iniciales en cero, condición vigente y normalización del código; devuelve el registro guardado sin ejecutar auditoría de campos ajenos al presupuesto.
- Presupuesto existente: actualiza solamente el código del presupuesto seleccionado con el orden vigente/versionado existente. No cambia montos ni crea otra versión.
- Código vacío sin presupuesto: no crea un presupuesto. Código vacío con presupuesto: conserva el registro y limpia el código.
- Edición del proyecto: vuelve a ejecutar el bloque de historial existente, registrando los campos auditables modificados y el cambio de estado cuando corresponda. No reconstruye ni altera el historial anterior.
- Los errores devueltos por la API al insertar historial mantienen el tratamiento existente del bloque: se registran en consola. Esto no convierte la auditoría en una transacción garantizada.

Las tablas de historial y sus políticas de inserción para usuarios autenticados existen en la base revisada. No hay disparadores de usuario en `proyecto_obra` ni `presupuesto_proyecto` en el catálogo inspeccionado; no se encontró auditoría duplicada mediante esos disparadores.

### Panel de proyectos

En `src/pages/proyectos-obra/ProyectosObraDashboard.tsx`, se declaró el tipo del mapa que relaciona alertas con identificadores y nombres de proyectos. Es un ajuste de tipos: conserva filtros, cálculos, orden, textos y navegación.

## Validación

- `node --test scripts/a1-regression.test.mjs`: 10 pruebas aprobadas, con respuestas de base de datos simuladas y sin red ni credenciales.
- Las mismas pruebas contra el servicio original detectan cuatro casos fallidos, incluido el error posterior a crear un presupuesto. Esto verifica que las pruebas distinguen el defecto de la corrección.
- Casos cubiertos: presupuesto nuevo/existente/vacío, limpieza del código, errores de consulta/escritura, auditoría de campos y estados, campos sin cambios, edición parcial, actualización rechazada y error devuelto por la API de historial.
- `npx tsc --noEmit`: aprobado; resueltos los 14 errores detectados.
- `npm run lint`: aprobado.
- `npm run build`: aprobado. Persisten los avisos previos de tamaño de archivos y datos de compatibilidad de navegadores; no se ampliaron cambios a rendimiento o dependencias.

Límite: no se realizaron guardados reales ni pruebas visuales autenticadas. Las pruebas cubren el servicio y sus decisiones con respuestas simuladas; no garantizan disponibilidad de red, permisos efectivos de cada usuario ni el recorrido completo de la interfaz. La edición de proyecto, presupuesto y contrato continúa siendo un guardado en operaciones separadas, fuera de la corrección puntual de A1.

## A2: dependencias encontradas

### Caminos de salida en el código

| Camino | Comportamiento observado |
|---|---|
| `useTransactionManager` | Solicitud opcional, encabezado con `finalizada=false`, detalles y actualización final. Usado por equipos, herramientas, préstamo, sin asignación y las páginas compartidas de oficina, limpieza, vestimenta y ebanistería. |
| `RealizarSalida` | Salida contra una solicitud; encabezado, detalles y finalización separados. |
| `RegistroSalidaExterno` | Consulta existencias antes de guardar; encabezado, detalles y finalización separados. Esa consulta previa no impide por sí sola retiros simultáneos. |
| `SalidaArticulosModal` | Otra implementación de encabezado, detalles y finalización. Referenciada por `GenericRequestModule`; no se encontraron consumidores de ese módulo en las rutas actuales. Confirmar su uso antes de migrarla. |

El parámetro `extraLogic` del administrador de salidas permite operaciones adicionales y captura sus errores, pero no se encontraron llamadas que pasen ese segundo argumento en el código actual. No hay evidencia de una actualización complementaria de equipos activa mediante ese parámetro; la advertencia inicial era sobre una posibilidad del código.

### Comportamiento confirmado en Supabase

1. `salida_articulo_08.finalizada` tiene valor predeterminado `false`.
2. `actualizar_subtotal` calcula cantidad por precio; si el precio llega nulo o cero, consulta el precio del artículo y rechaza la operación si no lo encuentra.
3. `recalc_total_salida` recalcula el total y número de filas del encabezado ante inserciones, modificaciones o eliminaciones de detalles.
4. El disparador `salida_articulo` envía un aviso a Make ante UPDATE del encabezado, sin condición SQL que lo limite al cambio de `finalizada`. Los recálculos de detalles también actualizan ese encabezado.
5. Dos disparadores de `solicitud_17` envían avisos a Make ante INSERT y UPDATE. Una solicitud STI genera automáticamente un seguimiento ACTIVA; también hay disparadores de auditoría y coordenadas.
6. `inventario_actual` calcula entradas menos todas las cantidades de `dato_salida_13`, sin filtrar por `finalizada`. Una salida con detalles guardados afecta disponibilidad aunque la finalización posterior falle.
7. Las devoluciones modifican cantidades en `dato_salida_13`, por lo que recalculan el total del encabezado y pueden producir avisos adicionales hacia Make.
8. Las restricciones de esas dos tablas incluyen claves e integridad referencial; la consulta de restricciones no muestra una clave de operación para reintentos ni una comprobación de stock suficiente.

No se inspeccionó el contenido de los escenarios de Make: sus filtros, acciones, reintentos y efectos externos siguen pendientes. Se verificó únicamente que los destinos de los avisos corresponden a Make, sin exponer sus direcciones ni credenciales.

## Diseño propuesto de A2, pendiente de aprobación

### Etapa A2.1: operación completa y reintentos

- Crear una función de base de datos que guarde la solicitud cuando aplique, encabezado y detalles dentro de una transacción; finalizar al completar los detalles. Si falla un paso, revertir las escrituras de esa operación.
- Conservar las tablas, identificadores, precios, totales calculados, tipo de solicitud, responsables, máximo de diez artículos y fechas propias de cada flujo. No normalizar diferencias funcionales entre formularios sin validarlas.
- Incorporar una clave única de operación por envío. Un reintento con la misma clave y contenido debe devolver la misma salida; la misma clave con contenido diferente debe rechazarse. Conservar la clave durante un resultado incierto de red y renovarla al iniciar una operación distinta.
- Migrar los caminos activos conservando sus formularios, mensajes y acciones posteriores de impresión/navegación. Mantener los permisos efectivos; no usar privilegios elevados para sortear restricciones.
- No cambiar inicialmente los filtros de Make ni eliminar avisos. Verificar antes cómo procesa eventos intermedios y cuándo consulta los datos: una transacción puede modificar la visibilidad temporal aunque conserve INSERT/UPDATE y los mismos campos.

### Etapa A2.2: existencias simultáneas

- Antes de guardar, serializar retiros de los mismos artículos mediante bloqueos en un orden estable y volver a calcular disponibilidad dentro de la operación protegida.
- Verificar todos los escritores concurrentes: otros formularios, integraciones, importaciones y modificaciones/devoluciones. Bloquear únicamente la nueva función no garantiza protección frente a procesos que escriban directamente sin seguir el mismo protocolo.
- Si ya no alcanza el inventario, rechazar la operación completa, conservar el formulario y explicar qué artículo cambió. Confirmar previamente si existen excepciones autorizadas de inventario negativo.
- No modificar la fórmula histórica del inventario ni regularizar salidas incompletas como parte implícita de esta etapa.

### Pruebas necesarias antes de producción

En un entorno de prueba con avisos externos aislados, comprobar:

1. Cada camino activo, con una y diez líneas, solicitudes existentes y nuevas cuando corresponda.
2. Fallos inducidos en encabezado, detalles y finalización: ninguna escritura parcial de la nueva operación.
3. Doble clic, pérdida de respuesta y reintento: una sola salida por clave de operación.
4. Dos retiros simultáneos que excedan juntos la disponibilidad: comprobar la regla acordada sin afectar otros artículos.
5. Precios, totales, seguimiento STI, inventario, devoluciones, consultas y comprobantes.
6. Número, contenido y procesamiento de eventos de Make, incluidos recálculos y reintentos; ausencia de documentos o notificaciones duplicadas.
7. Usuarios autorizados y no autorizados, sin ampliar permisos.

La transacción protege las escrituras de la base. No garantiza por sí sola que Make ejecute una sola vez efectos externos; eso requiere verificar el escenario y su tratamiento de duplicados.

## Reversión y decisión

A1 puede revertirse mediante el cambio inverso de sus dos archivos; no requiere reversión de base de datos porque no se modificó. No debe usarse una restauración general del proyecto: existe una edición previa del usuario en asignación de activos que quedó intacta.

Para A2 se propone una migración aditiva y una activación controlada: mantener el flujo anterior disponible hasta validar el nuevo. Ante una regresión, detener nuevos envíos, revisar operaciones en curso y avisos pendientes, y volver a la versión de aplicación anterior. No borrar salidas ni repetir envíos para revertir. Mantener los identificadores de reintento y las estructuras nuevas hasta reconciliar lo ya procesado. Los efectos externos de Make requieren revisión separada.

Recomendación: aprobar primero la preparación de A2 en un entorno de prueba y la revisión de los escenarios de Make. La activación en producción debe esperar evidencia de compatibilidad de esos escenarios y de todos los caminos de escritura concurrentes.
