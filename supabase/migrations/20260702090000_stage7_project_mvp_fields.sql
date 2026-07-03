-- SDMO Etapa 7: campos MVP para ficha de proyectos.
--
-- Objetivo:
-- - Agregar campos funcionales minimos definidos en Fase 2.
-- - Reutilizar prioridad existente en proyecto_obra.
-- - Mantener la creacion transaccional via RPC actualizada.

begin;

alter table public.proyecto_obra
  add column if not exists descripcion_general text,
  add column if not exists tipo_proyecto text,
  add column if not exists justificacion text,
  add column if not exists direccion_exacta text,
  add column if not exists barrio_comunidad text,
  add column if not exists fecha_solicitud date,
  add column if not exists requiere_contratacion boolean default false;

alter table public.presupuesto_proyecto
  add column if not exists codigo_presupuestario text;

create or replace function public.crear_proyecto_obra_con_presupuesto(
  p_proyecto jsonb,
  p_presupuesto_asignado numeric default 0
)
returns public.proyecto_obra
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_proyecto public.proyecto_obra;
  v_user_email text := auth.jwt() ->> 'email';
begin
  insert into public.proyecto_obra (
    nombre_proyecto,
    codigo_meta,
    descripcion_general,
    tipo_proyecto,
    prioridad,
    justificacion,
    gerencia,
    dependencia,
    profesional_responsable,
    tipo_contrato,
    tipo_ejecucion,
    poa_origen,
    origen_presupuesto,
    linea_estrategica,
    programa,
    canton,
    distrito,
    direccion_exacta,
    barrio_comunidad,
    fecha_solicitud,
    requiere_contratacion,
    estado,
    anio,
    observaciones_meta_poa,
    activo,
    creado_por
  )
  values (
    nullif(trim(p_proyecto ->> 'nombre_proyecto'), ''),
    nullif(trim(p_proyecto ->> 'codigo_meta'), ''),
    nullif(trim(p_proyecto ->> 'descripcion_general'), ''),
    nullif(trim(p_proyecto ->> 'tipo_proyecto'), ''),
    nullif(p_proyecto ->> 'prioridad', '')::integer,
    nullif(trim(p_proyecto ->> 'justificacion'), ''),
    nullif(trim(p_proyecto ->> 'gerencia'), ''),
    nullif(trim(p_proyecto ->> 'dependencia'), ''),
    nullif(trim(p_proyecto ->> 'profesional_responsable'), ''),
    nullif(trim(p_proyecto ->> 'tipo_contrato'), ''),
    nullif(trim(p_proyecto ->> 'tipo_ejecucion'), ''),
    nullif(trim(p_proyecto ->> 'poa_origen'), ''),
    nullif(trim(p_proyecto ->> 'origen_presupuesto'), ''),
    nullif(trim(p_proyecto ->> 'linea_estrategica'), ''),
    nullif(trim(p_proyecto ->> 'programa'), ''),
    nullif(trim(p_proyecto ->> 'canton'), ''),
    nullif(trim(p_proyecto ->> 'distrito'), ''),
    nullif(trim(p_proyecto ->> 'direccion_exacta'), ''),
    nullif(trim(p_proyecto ->> 'barrio_comunidad'), ''),
    nullif(p_proyecto ->> 'fecha_solicitud', '')::date,
    coalesce(nullif(p_proyecto ->> 'requiere_contratacion', '')::boolean, false),
    nullif(trim(p_proyecto ->> 'estado'), ''),
    coalesce(nullif(p_proyecto ->> 'anio', '')::integer, extract(year from current_date)::integer),
    nullif(trim(p_proyecto ->> 'observaciones_meta_poa'), ''),
    coalesce(nullif(p_proyecto ->> 'activo', '')::boolean, true),
    coalesce(v_user_email, nullif(trim(p_proyecto ->> 'creado_por'), ''), 'Sistema')
  )
  returning * into v_proyecto;

  if coalesce(p_presupuesto_asignado, 0) > 0 then
    insert into public.presupuesto_proyecto (
      proyecto_id,
      version,
      descripcion_modificacion,
      presupuesto_asignado,
      presupuesto_adjudicado,
      presupuesto_ejecutado,
      presupuesto_comprometido,
      presupuesto_reserva,
      codigo_presupuestario,
      es_vigente,
      registrado_por
    )
    values (
      v_proyecto.id,
      1,
      'Presupuesto inicial asignado al crear el proyecto',
      p_presupuesto_asignado,
      0,
      0,
      0,
      0,
      nullif(trim(p_proyecto ->> 'codigo_presupuestario'), ''),
      true,
      coalesce(v_user_email, 'Sistema')
    );
  end if;

  return v_proyecto;
end;
$$;

revoke all on function public.crear_proyecto_obra_con_presupuesto(jsonb, numeric) from public;
revoke all on function public.crear_proyecto_obra_con_presupuesto(jsonb, numeric) from anon;
grant execute on function public.crear_proyecto_obra_con_presupuesto(jsonb, numeric) to authenticated;

commit;
