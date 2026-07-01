-- SDMO Etapa 6: normalizar avances de proyectos en escala 0-1.
--
-- Objetivo:
-- - Convertir datos historicos que esten en escala 0-100 a 0-1.
-- - Hacer que el RPC de seguimiento normalice defensivamente 75, 0.75 o "75%".

begin;

update public.proyecto_obra
set avance_poa = avance_poa / 100
where avance_poa > 1;

update public.fase_proyecto
set porcentaje_avance = porcentaje_avance / 100
where porcentaje_avance > 1;

update public.seguimiento_proyecto
set avance_registrado = avance_registrado / 100
where avance_registrado > 1;

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
  v_avance_raw numeric := nullif(replace(p_seguimiento ->> 'avance_registrado', '%', ''), '')::numeric;
  v_avance numeric;
begin
  v_avance := least(greatest(case when v_avance_raw > 1 then v_avance_raw / 100 else coalesce(v_avance_raw, 0) end, 0), 1);

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

revoke all on function public.registrar_seguimiento_proyecto(jsonb) from public;
revoke all on function public.registrar_seguimiento_proyecto(jsonb) from anon;
grant execute on function public.registrar_seguimiento_proyecto(jsonb) to authenticated;

commit;

-- Verificacion sugerida:
-- select
--   (select count(*) from public.proyecto_obra where avance_poa > 1) as proyectos_fuera_escala,
--   (select count(*) from public.fase_proyecto where porcentaje_avance > 1) as fases_fuera_escala,
--   (select count(*) from public.seguimiento_proyecto where avance_registrado > 1) as seguimientos_fuera_escala;
