-- SDMO Etapa 5: RPCs transaccionales para proyectos de obra.
--
-- Objetivo:
-- - Evitar estados parciales en operaciones compuestas del frontend.
-- - Mantener RLS activo usando SECURITY INVOKER.

begin;

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
    estado,
    anio,
    observaciones_meta_poa,
    activo,
    creado_por
  )
  values (
    nullif(trim(p_proyecto ->> 'nombre_proyecto'), ''),
    nullif(trim(p_proyecto ->> 'codigo_meta'), ''),
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
      true,
      coalesce(v_user_email, 'Sistema')
    );
  end if;

  return v_proyecto;
end;
$$;

create or replace function public.registrar_seguimiento_proyecto(
  p_seguimiento jsonb
)
returns public.seguimiento_proyecto
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_seguimiento public.seguimiento_proyecto;
  v_user_email text := auth.jwt() ->> 'email';
  v_proyecto_id uuid := (p_seguimiento ->> 'proyecto_id')::uuid;
  v_avance numeric := nullif(p_seguimiento ->> 'avance_registrado', '')::numeric;
begin
  insert into public.seguimiento_proyecto (
    proyecto_id,
    fecha_corte,
    avance_registrado,
    observaciones,
    etapa,
    registrado_por
  )
  values (
    v_proyecto_id,
    coalesce(nullif(p_seguimiento ->> 'fecha_corte', '')::date, current_date),
    v_avance,
    coalesce(p_seguimiento ->> 'observaciones', ''),
    nullif(trim(p_seguimiento ->> 'etapa'), ''),
    coalesce(v_user_email, nullif(trim(p_seguimiento ->> 'registrado_por'), ''), 'Sistema')
  )
  returning * into v_seguimiento;

  update public.proyecto_obra
  set avance_poa = v_avance,
      actualizado_en = now()
  where id = v_proyecto_id;

  return v_seguimiento;
end;
$$;

revoke all on function public.crear_proyecto_obra_con_presupuesto(jsonb, numeric) from public;
revoke all on function public.crear_proyecto_obra_con_presupuesto(jsonb, numeric) from anon;
grant execute on function public.crear_proyecto_obra_con_presupuesto(jsonb, numeric) to authenticated;

revoke all on function public.registrar_seguimiento_proyecto(jsonb) from public;
revoke all on function public.registrar_seguimiento_proyecto(jsonb) from anon;
grant execute on function public.registrar_seguimiento_proyecto(jsonb) to authenticated;

commit;
