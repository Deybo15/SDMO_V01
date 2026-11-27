# Asistente privado de SDMO

Apagado por defecto. No se consulta a OpenAI para preguntas que el asistente ya entiende. La función no lee expedientes: solo devuelve una intención de una lista cerrada. Una segunda consulta, con la sesión del usuario, obtiene los datos reales.

## Piloto local

El modo de desarrollo muestra el asistente solo tras confirmar la cuenta autorizada en Supabase. Con `VITE_SDMO_IA_EXTERNA=true` en local, la función admite `http://127.0.0.1:5187`. La clave de OpenAI permanece como secreto `OPENAI_API_KEY` de la función; no va en `.env.local`, Git ni el navegador.

## Publicación privada

1. Usar una actualización que incluya solo el asistente y sus pruebas. No reaplicar los borradores SQL del piloto al proyecto ya configurado. Confirmar que hay una sola cuenta autorizada y que existe el contador mensual.
2. En una versión previa HTTPS, compilar con `VITE_SDMO_ASISTENTE_PRIVADO=true`. La bandera habilita la verificación de acceso; no concede permisos. Configurar `VITE_SDMO_IA_EXTERNA=true` si se probará también OpenAI.
3. Desplegar solo `sdmo-intencion` manteniendo la verificación de JWT y el secreto `SDMO_IA_PILOTO_ACTIVA`. Configurar `SDMO_IA_ORIGEN_PRIVADO` con el origen HTTPS exacto de la versión previa, sin barra final. La función admite el origen local y como máximo ese segundo origen; la autorización de cuenta y la reserva de presupuesto se verifican en el servidor.
4. Comprobar con la cuenta autorizada una lectura común sin reserva y una pregunta como «¿En qué fase quedó la #13948?», que debe devolver el estado y añadir una sola reserva. Con una cuenta no autorizada, comprobar que no se ve el botón y que la función rechaza la llamada sin reservar presupuesto.
5. Solo tras las verificaciones, aplicar la misma configuración de compilación al sitio publicado y sustituir el origen de la versión previa por el de producción. Para apagar solo OpenAI, desactivar `SDMO_IA_PILOTO_ACTIVA`; para ocultar todo el asistente publicado, recompilar con `VITE_SDMO_ASISTENTE_PRIVADO=false`.

## Presupuesto

El servidor reserva 10 centavos por cada intento, con un máximo de 500 centavos por mes UTC. Son reservas conservadoras, no cargos reales. Incluso si la llamada falla no se libera la reserva, ya que podría haberse facturado. El bloqueo no depende de avisos del proveedor.

El máximo de una llamada se calculó para el modelo fijado en el código, usando la ventana completa de entrada y hasta 96 tokens de salida, sin herramientas ni nivel prioritario. Revise las [tarifas de OpenAI](https://developers.openai.com/api/docs/models/gpt-5.4-nano) antes de activar o cambiar el modelo. El contador solo cubre llamadas de SDMO, no otras integraciones ni impuestos. Desactivar `SDMO_IA_PILOTO_ACTIVA` detiene nuevos intentos.
