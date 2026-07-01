-- SDMO Etapa 4: RLS para modulo de proyectos de obra.
--
-- Objetivo:
-- - Cerrar acceso anonimo a las tablas del modulo de proyectos de obra.
-- - Permitir lectura a usuarios autenticados.
-- - Permitir escritura solo a usuarios autenticados marcados como autorizados
--   en colaboradores_06 por correo_colaborador.
-- - Bloquear borrado desde roles anon/authenticated.
--
-- Nota:
-- Esta migracion asume que colaboradores_06 ya tiene RLS de lectura para
-- authenticated, como se definio en la etapa 1.

begin;

-- Tablas del modulo.
alter table public.proyecto_obra enable row level security;
alter table public.presupuesto_proyecto enable row level security;
alter table public.contrato_obra enable row level security;
alter table public.fase_proyecto enable row level security;
alter table public.seguimiento_proyecto enable row level security;
alter table public.historial_fase_proyecto enable row level security;

-- Limpiar politicas previas conocidas o genericas.
drop policy if exists "Enable read access for all users" on public.proyecto_obra;
drop policy if exists "Enable insert for authenticated users only" on public.proyecto_obra;
drop policy if exists "Enable update for authenticated users" on public.proyecto_obra;
drop policy if exists "authenticated_can_read_proyecto_obra" on public.proyecto_obra;
drop policy if exists "authorized_can_create_proyecto_obra" on public.proyecto_obra;
drop policy if exists "authorized_can_update_proyecto_obra" on public.proyecto_obra;

drop policy if exists "Enable read access for all users" on public.presupuesto_proyecto;
drop policy if exists "Enable insert for authenticated users only" on public.presupuesto_proyecto;
drop policy if exists "Enable update for authenticated users" on public.presupuesto_proyecto;
drop policy if exists "authenticated_can_read_presupuesto_proyecto" on public.presupuesto_proyecto;
drop policy if exists "authorized_can_create_presupuesto_proyecto" on public.presupuesto_proyecto;
drop policy if exists "authorized_can_update_presupuesto_proyecto" on public.presupuesto_proyecto;

drop policy if exists "Enable read access for all users" on public.contrato_obra;
drop policy if exists "Enable insert for authenticated users only" on public.contrato_obra;
drop policy if exists "Enable update for authenticated users" on public.contrato_obra;
drop policy if exists "authenticated_can_read_contrato_obra" on public.contrato_obra;
drop policy if exists "authorized_can_create_contrato_obra" on public.contrato_obra;
drop policy if exists "authorized_can_update_contrato_obra" on public.contrato_obra;

drop policy if exists "Enable read access for all users" on public.fase_proyecto;
drop policy if exists "Enable insert for authenticated users only" on public.fase_proyecto;
drop policy if exists "Enable update for authenticated users" on public.fase_proyecto;
drop policy if exists "authenticated_can_read_fase_proyecto" on public.fase_proyecto;
drop policy if exists "authorized_can_create_fase_proyecto" on public.fase_proyecto;
drop policy if exists "authorized_can_update_fase_proyecto" on public.fase_proyecto;

drop policy if exists "Enable read access for all users" on public.seguimiento_proyecto;
drop policy if exists "Enable insert for authenticated users only" on public.seguimiento_proyecto;
drop policy if exists "Enable update for authenticated users" on public.seguimiento_proyecto;
drop policy if exists "authenticated_can_read_seguimiento_proyecto" on public.seguimiento_proyecto;
drop policy if exists "authorized_can_create_seguimiento_proyecto" on public.seguimiento_proyecto;

drop policy if exists "Enable read access for all users" on public.historial_fase_proyecto;
drop policy if exists "Enable insert for authenticated users only" on public.historial_fase_proyecto;
drop policy if exists "Enable update for authenticated users" on public.historial_fase_proyecto;
drop policy if exists "authenticated_can_read_historial_fase_proyecto" on public.historial_fase_proyecto;
drop policy if exists "authorized_can_create_historial_fase_proyecto" on public.historial_fase_proyecto;

-- Privilegios base.
revoke all privileges on table public.proyecto_obra from anon;
revoke all privileges on table public.presupuesto_proyecto from anon;
revoke all privileges on table public.contrato_obra from anon;
revoke all privileges on table public.fase_proyecto from anon;
revoke all privileges on table public.seguimiento_proyecto from anon;
revoke all privileges on table public.historial_fase_proyecto from anon;

revoke delete, truncate, references, trigger on table public.proyecto_obra from authenticated;
revoke delete, truncate, references, trigger on table public.presupuesto_proyecto from authenticated;
revoke delete, truncate, references, trigger on table public.contrato_obra from authenticated;
revoke delete, truncate, references, trigger on table public.fase_proyecto from authenticated;
revoke update, delete, truncate, references, trigger on table public.seguimiento_proyecto from authenticated;
revoke update, delete, truncate, references, trigger on table public.historial_fase_proyecto from authenticated;

grant select, insert, update on table public.proyecto_obra to authenticated;
grant select, insert, update on table public.presupuesto_proyecto to authenticated;
grant select, insert, update on table public.contrato_obra to authenticated;
grant select, insert, update on table public.fase_proyecto to authenticated;
grant select, insert on table public.seguimiento_proyecto to authenticated;
grant select, insert on table public.historial_fase_proyecto to authenticated;

-- Politicas de lectura: usuarios con sesion pueden consultar el portafolio.
create policy "authenticated_can_read_proyecto_obra"
on public.proyecto_obra
for select
to authenticated
using (true);

create policy "authenticated_can_read_presupuesto_proyecto"
on public.presupuesto_proyecto
for select
to authenticated
using (true);

create policy "authenticated_can_read_contrato_obra"
on public.contrato_obra
for select
to authenticated
using (true);

create policy "authenticated_can_read_fase_proyecto"
on public.fase_proyecto
for select
to authenticated
using (true);

create policy "authenticated_can_read_seguimiento_proyecto"
on public.seguimiento_proyecto
for select
to authenticated
using (true);

create policy "authenticated_can_read_historial_fase_proyecto"
on public.historial_fase_proyecto
for select
to authenticated
using (true);

-- Politicas de escritura: solo colaboradores autorizados por correo.
create policy "authorized_can_create_proyecto_obra"
on public.proyecto_obra
for insert
to authenticated
with check (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
);

create policy "authorized_can_update_proyecto_obra"
on public.proyecto_obra
for update
to authenticated
using (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
);

create policy "authorized_can_create_presupuesto_proyecto"
on public.presupuesto_proyecto
for insert
to authenticated
with check (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
);

create policy "authorized_can_update_presupuesto_proyecto"
on public.presupuesto_proyecto
for update
to authenticated
using (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
);

create policy "authorized_can_create_contrato_obra"
on public.contrato_obra
for insert
to authenticated
with check (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
);

create policy "authorized_can_update_contrato_obra"
on public.contrato_obra
for update
to authenticated
using (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
);

create policy "authorized_can_create_fase_proyecto"
on public.fase_proyecto
for insert
to authenticated
with check (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
);

create policy "authorized_can_update_fase_proyecto"
on public.fase_proyecto
for update
to authenticated
using (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
);

create policy "authorized_can_create_seguimiento_proyecto"
on public.seguimiento_proyecto
for insert
to authenticated
with check (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
);

create policy "authorized_can_create_historial_fase_proyecto"
on public.historial_fase_proyecto
for insert
to authenticated
with check (
  exists (
    select 1
    from public.colaboradores_06 c
    where c.autorizado is true
      and lower(c.correo_colaborador) = lower((select auth.jwt() ->> 'email'))
  )
);

commit;

-- Verificacion sugerida despues de aplicar:
--
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in (
--     'proyecto_obra',
--     'presupuesto_proyecto',
--     'contrato_obra',
--     'fase_proyecto',
--     'seguimiento_proyecto',
--     'historial_fase_proyecto'
--   )
-- order by tablename, policyname;
--
-- select table_name, grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and grantee in ('anon', 'authenticated')
--   and table_name in (
--     'proyecto_obra',
--     'presupuesto_proyecto',
--     'contrato_obra',
--     'fase_proyecto',
--     'seguimiento_proyecto',
--     'historial_fase_proyecto'
--   )
-- order by table_name, grantee, privilege_type;
